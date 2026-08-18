#![forbid(unsafe_code)]
//! Frozen WP-009 / S1.03 authority-placement boundary.
//!
//! Implements only S1.03.01..S1.03.10. Semantic authority and physical
//! placement are orthogonal. The placement manager owns writer-lease and
//! placement metadata only; it never becomes the semantic owner of world facts.

use gaonn_identity_acceptance_core::Wp013Closure;
use std::collections::{BTreeMap, BTreeSet};

pub const SCHEMA_VERSION: u32 = 1;
pub const WORK_PACKAGE: &str = "WP-009";
pub const OWNER: &str = "runtime.partition-manager.pa-042";
pub const REVIEWER: &str = "validation_qa.s1_03_acceptance_review";
pub const MEMBER_IDS: [&str; 10] = [
    "S1.03.01", "S1.03.02", "S1.03.03", "S1.03.04", "S1.03.05", "S1.03.06", "S1.03.07", "S1.03.08",
    "S1.03.09", "S1.03.10",
];
pub const REVIEW_INPUT_MEMBER_IDS: [&str; 9] = [
    "S1.03.01", "S1.03.02", "S1.03.03", "S1.03.04", "S1.03.05", "S1.03.06", "S1.03.07", "S1.03.08",
    "S1.03.09",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Origin {
    PartitionManager,
    ValidationQa,
    SemanticOwner,
    Derived,
    Observer,
    Renderer,
    Analytics,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verdict {
    Pass,
    Fail,
    Blocked,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CandidateDisposition {
    CandidateOnly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LifecycleState {
    Active,
    Inactive,
    Tombstone,
    Retired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Availability {
    Available,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PredecessorEvidence {
    pub work_package: String,
    pub source_version: u32,
    pub closed: bool,
    pub evidence_digest64: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Admission {
    pub run_id: String,
    pub source_version: u32,
    pub wp001_digest64: u64,
    pub wp002_digest64: u64,
    pub wp013_acceptance_digest64: u64,
    pub wp013_evidence_digest64: u64,
    pub causal_parent: String,
}

impl Admission {
    pub fn digest64(&self) -> u64 {
        digest(self)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FailureReason {
    InvalidPredecessor(&'static str),
    StaleVersion,
    MissingField(&'static str),
    UnauthorizedOrigin,
    WrongOwner,
    DuplicateIdentity(String),
    ReusedRetiredIdentity(String),
    DanglingReference(String),
    StaleReference(String),
    InvalidTransition,
    IncompatiblePayload(&'static str),
    PartialHandoff,
    PartitionUnavailable(String),
    DuplicateAuthority(String),
    CorruptSnapshot,
    MissingEvidence(String),
    OutOfScopeEvidence(String),
    MixedRun(String),
    ExplicitFailure(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Failure {
    pub work_id: &'static str,
    pub verdict: Verdict,
    pub reason: FailureReason,
    pub pre_state_digest64: u64,
    pub post_state_digest64: u64,
    pub downstream_blocked: bool,
    pub causal_parent: String,
}

pub type Result<T> = std::result::Result<T, Box<Failure>>;

pub fn admit_wp009(
    run_id: &str,
    source_version: u32,
    wp001: &PredecessorEvidence,
    wp002: &PredecessorEvidence,
    wp013: &Wp013Closure,
    causal_parent: &str,
) -> Result<Admission> {
    let pre = digest(&(run_id, source_version, wp001, wp002, wp013, causal_parent));
    if run_id.trim().is_empty() || causal_parent.trim().is_empty() {
        return Err(fail(
            "S1.03.01",
            Verdict::Blocked,
            FailureReason::MissingField("admission.run_id_or_causal_parent"),
            pre,
            causal_parent,
        ));
    }
    if source_version != SCHEMA_VERSION {
        return Err(fail(
            "S1.03.01",
            Verdict::Blocked,
            FailureReason::StaleVersion,
            pre,
            causal_parent,
        ));
    }
    validate_predecessor(wp001, "WP-001", pre, causal_parent)?;
    validate_predecessor(wp002, "WP-002", pre, causal_parent)?;
    if wp013.work_package != "WP-013"
        || wp013.member_id != "S1.02.10"
        || !wp013.closed
        || wp013.acceptance_digest64 == 0
        || wp013.evidence_digest64 == 0
    {
        return Err(fail(
            "S1.03.01",
            Verdict::Blocked,
            FailureReason::InvalidPredecessor("WP-013"),
            pre,
            causal_parent,
        ));
    }
    Ok(Admission {
        run_id: run_id.to_owned(),
        source_version,
        wp001_digest64: wp001.evidence_digest64,
        wp002_digest64: wp002.evidence_digest64,
        wp013_acceptance_digest64: wp013.acceptance_digest64,
        wp013_evidence_digest64: wp013.evidence_digest64,
        causal_parent: causal_parent.to_owned(),
    })
}

fn validate_predecessor(
    evidence: &PredecessorEvidence,
    expected: &'static str,
    pre: u64,
    causal_parent: &str,
) -> Result<()> {
    if evidence.work_package != expected
        || evidence.source_version != SCHEMA_VERSION
        || !evidence.closed
        || evidence.evidence_digest64 == 0
    {
        return Err(fail(
            "S1.03.01",
            Verdict::Blocked,
            FailureReason::InvalidPredecessor(expected),
            pre,
            causal_parent,
        ));
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AxisContractInput {
    pub admission_digest64: u64,
    pub contract_version: u32,
    pub semantic_owner: String,
    pub allowed_writer: String,
    pub authority_epoch: u64,
    pub semantic_axis: String,
    pub placement_axis: String,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AxisValidation {
    pub work_id: &'static str,
    pub operands: [&'static str; 5],
    pub contract_version: u32,
    pub semantic_owner: String,
    pub allowed_writer: String,
    pub authority_epoch: u64,
    pub semantic_axis: String,
    pub placement_axis: String,
    pub disposition: CandidateDisposition,
    pub causal_parent: String,
}

impl AxisValidation {
    pub fn digest64(&self) -> u64 {
        digest(self)
    }
}

pub fn validate_axis_contract(input: &AxisContractInput, origin: Origin) -> Result<AxisValidation> {
    let pre = digest(input);
    if matches!(
        origin,
        Origin::Derived | Origin::Observer | Origin::Renderer | Origin::Analytics
    ) {
        return Err(fail(
            "S1.03.01",
            Verdict::Blocked,
            FailureReason::UnauthorizedOrigin,
            pre,
            &input.causal_parent,
        ));
    }
    if input.admission_digest64 == 0
        || input.semantic_owner.trim().is_empty()
        || input.allowed_writer.trim().is_empty()
        || input.semantic_axis.trim().is_empty()
        || input.placement_axis.trim().is_empty()
        || input.causal_parent.trim().is_empty()
    {
        return Err(fail(
            "S1.03.01",
            Verdict::Blocked,
            FailureReason::MissingField("authority_axis_contract"),
            pre,
            &input.causal_parent,
        ));
    }
    if input.contract_version != SCHEMA_VERSION {
        return Err(fail(
            "S1.03.01",
            Verdict::Blocked,
            FailureReason::StaleVersion,
            pre,
            &input.causal_parent,
        ));
    }
    if input.semantic_axis == input.placement_axis {
        return Err(fail(
            "S1.03.01",
            Verdict::Fail,
            FailureReason::InvalidTransition,
            pre,
            &input.causal_parent,
        ));
    }
    Ok(AxisValidation {
        work_id: "S1.03.01",
        operands: ["Authority", "Axis", "Placement", "분리", "Single-Writer"],
        contract_version: input.contract_version,
        semantic_owner: input.semantic_owner.clone(),
        allowed_writer: input.allowed_writer.clone(),
        authority_epoch: input.authority_epoch,
        semantic_axis: input.semantic_axis.clone(),
        placement_axis: input.placement_axis.clone(),
        disposition: CandidateDisposition::CandidateOnly,
        causal_parent: input.causal_parent.clone(),
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PartitionIdentity {
    pub stable_id: String,
    pub namespace: String,
    pub version: u32,
    pub lifecycle_lineage: String,
    pub state: LifecycleState,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlacementDescriptor {
    pub stable_id: String,
    pub namespace: String,
    pub version: u32,
    pub partition_id: String,
    pub physical_descriptor: String,
    pub lifecycle_lineage: String,
    pub state: LifecycleState,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WriterLease {
    pub partition_id: String,
    pub writer: String,
    pub authority_epoch: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthoritySegment {
    pub segment_id: String,
    pub semantic_owner: String,
    pub semantic_digest64: u64,
    pub lease: WriterLease,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthorityPlacementState {
    pub schema_version: u32,
    pub partitions: BTreeMap<String, PartitionIdentity>,
    pub placements: BTreeMap<String, PlacementDescriptor>,
    pub segments: BTreeMap<String, AuthoritySegment>,
    pub availability: BTreeMap<String, Availability>,
    retired_partition_ids: BTreeSet<String>,
    retired_placement_ids: BTreeSet<String>,
}

impl Default for AuthorityPlacementState {
    fn default() -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            partitions: BTreeMap::new(),
            placements: BTreeMap::new(),
            segments: BTreeMap::new(),
            availability: BTreeMap::new(),
            retired_partition_ids: BTreeSet::new(),
            retired_placement_ids: BTreeSet::new(),
        }
    }
}

impl AuthorityPlacementState {
    pub fn digest64(&self) -> u64 {
        digest(self)
    }

    pub fn semantic_digest64(&self, segment_id: &str) -> Option<u64> {
        self.segments
            .get(segment_id)
            .map(|segment| segment.semantic_digest64)
    }

    pub fn create_partition(
        &mut self,
        validation: &AxisValidation,
        identity: PartitionIdentity,
        origin: Origin,
    ) -> Result<()> {
        let pre = self.digest64();
        ensure_partition_writer(validation, origin, pre, &identity.causal_parent)?;
        validate_identity_fields(&identity, pre, "S1.03.02")?;
        if self.retired_partition_ids.contains(&identity.stable_id) {
            return Err(fail(
                "S1.03.02",
                Verdict::Fail,
                FailureReason::ReusedRetiredIdentity(identity.stable_id.clone()),
                pre,
                &identity.causal_parent,
            ));
        }
        if self.partitions.contains_key(&identity.stable_id)
            || self.partitions.values().any(|existing| {
                existing.namespace == identity.namespace && existing.version == identity.version
            })
        {
            return Err(fail(
                "S1.03.02",
                Verdict::Fail,
                FailureReason::DuplicateIdentity(identity.stable_id.clone()),
                pre,
                &identity.causal_parent,
            ));
        }
        self.availability
            .insert(identity.stable_id.clone(), Availability::Available);
        self.partitions.insert(identity.stable_id.clone(), identity);
        Ok(())
    }

    pub fn update_partition(
        &mut self,
        validation: &AxisValidation,
        replacement: PartitionIdentity,
        expected_version: u32,
        origin: Origin,
    ) -> Result<()> {
        let pre = self.digest64();
        ensure_partition_writer(validation, origin, pre, &replacement.causal_parent)?;
        validate_identity_fields(&replacement, pre, "S1.03.02")?;
        let Some(current) = self.partitions.get(&replacement.stable_id) else {
            return Err(fail(
                "S1.03.02",
                Verdict::Blocked,
                FailureReason::DanglingReference(replacement.stable_id.clone()),
                pre,
                &replacement.causal_parent,
            ));
        };
        if current.version != expected_version || replacement.version != expected_version + 1 {
            return Err(fail(
                "S1.03.02",
                Verdict::Fail,
                FailureReason::StaleReference(replacement.stable_id.clone()),
                pre,
                &replacement.causal_parent,
            ));
        }
        if current.namespace != replacement.namespace
            || current.lifecycle_lineage != replacement.lifecycle_lineage
            || current.state == LifecycleState::Retired
        {
            return Err(fail(
                "S1.03.02",
                Verdict::Fail,
                FailureReason::InvalidTransition,
                pre,
                &replacement.causal_parent,
            ));
        }
        self.partitions
            .insert(replacement.stable_id.clone(), replacement);
        Ok(())
    }

    pub fn retire_partition(
        &mut self,
        validation: &AxisValidation,
        stable_id: &str,
        expected_version: u32,
        causal_parent: &str,
        origin: Origin,
    ) -> Result<()> {
        let pre = self.digest64();
        ensure_partition_writer(validation, origin, pre, causal_parent)?;
        let Some(current) = self.partitions.get_mut(stable_id) else {
            return Err(fail(
                "S1.03.02",
                Verdict::Blocked,
                FailureReason::DanglingReference(stable_id.to_owned()),
                pre,
                causal_parent,
            ));
        };
        if current.version != expected_version || current.state == LifecycleState::Retired {
            return Err(fail(
                "S1.03.02",
                Verdict::Fail,
                FailureReason::StaleReference(stable_id.to_owned()),
                pre,
                causal_parent,
            ));
        }
        current.version += 1;
        current.state = LifecycleState::Retired;
        current.causal_parent = causal_parent.to_owned();
        self.retired_partition_ids.insert(stable_id.to_owned());
        self.availability.remove(stable_id);
        Ok(())
    }

    pub fn create_placement(
        &mut self,
        validation: &AxisValidation,
        placement: PlacementDescriptor,
        origin: Origin,
    ) -> Result<()> {
        let pre = self.digest64();
        ensure_partition_writer(validation, origin, pre, &placement.causal_parent)?;
        if placement.stable_id.trim().is_empty()
            || placement.namespace.trim().is_empty()
            || placement.partition_id.trim().is_empty()
            || placement.physical_descriptor.trim().is_empty()
            || placement.lifecycle_lineage.trim().is_empty()
            || placement.causal_parent.trim().is_empty()
        {
            return Err(fail(
                "S1.03.03",
                Verdict::Blocked,
                FailureReason::MissingField("physical_placement_descriptor"),
                pre,
                &placement.causal_parent,
            ));
        }
        if !self.partitions.contains_key(&placement.partition_id) {
            return Err(fail(
                "S1.03.03",
                Verdict::Blocked,
                FailureReason::DanglingReference(placement.partition_id.clone()),
                pre,
                &placement.causal_parent,
            ));
        }
        if self.retired_placement_ids.contains(&placement.stable_id) {
            return Err(fail(
                "S1.03.03",
                Verdict::Fail,
                FailureReason::ReusedRetiredIdentity(placement.stable_id.clone()),
                pre,
                &placement.causal_parent,
            ));
        }
        if self.placements.contains_key(&placement.stable_id) {
            return Err(fail(
                "S1.03.03",
                Verdict::Fail,
                FailureReason::DuplicateIdentity(placement.stable_id.clone()),
                pre,
                &placement.causal_parent,
            ));
        }
        self.placements
            .insert(placement.stable_id.clone(), placement);
        Ok(())
    }

    pub fn update_placement(
        &mut self,
        validation: &AxisValidation,
        replacement: PlacementDescriptor,
        expected_version: u32,
        origin: Origin,
    ) -> Result<()> {
        let pre = self.digest64();
        ensure_partition_writer(validation, origin, pre, &replacement.causal_parent)?;
        if !self.partitions.contains_key(&replacement.partition_id) {
            return Err(fail(
                "S1.03.03",
                Verdict::Blocked,
                FailureReason::DanglingReference(replacement.partition_id.clone()),
                pre,
                &replacement.causal_parent,
            ));
        }
        let Some(current) = self.placements.get(&replacement.stable_id) else {
            return Err(fail(
                "S1.03.03",
                Verdict::Blocked,
                FailureReason::DanglingReference(replacement.stable_id.clone()),
                pre,
                &replacement.causal_parent,
            ));
        };
        if current.version != expected_version || replacement.version != expected_version + 1 {
            return Err(fail(
                "S1.03.03",
                Verdict::Fail,
                FailureReason::StaleReference(replacement.stable_id.clone()),
                pre,
                &replacement.causal_parent,
            ));
        }
        if current.namespace != replacement.namespace
            || current.lifecycle_lineage != replacement.lifecycle_lineage
            || current.state == LifecycleState::Retired
        {
            return Err(fail(
                "S1.03.03",
                Verdict::Fail,
                FailureReason::InvalidTransition,
                pre,
                &replacement.causal_parent,
            ));
        }
        self.placements
            .insert(replacement.stable_id.clone(), replacement);
        Ok(())
    }

    pub fn retire_placement(
        &mut self,
        validation: &AxisValidation,
        stable_id: &str,
        expected_version: u32,
        causal_parent: &str,
        origin: Origin,
    ) -> Result<()> {
        let pre = self.digest64();
        ensure_partition_writer(validation, origin, pre, causal_parent)?;
        let Some(current) = self.placements.get_mut(stable_id) else {
            return Err(fail(
                "S1.03.03",
                Verdict::Blocked,
                FailureReason::DanglingReference(stable_id.to_owned()),
                pre,
                causal_parent,
            ));
        };
        if current.version != expected_version || current.state == LifecycleState::Retired {
            return Err(fail(
                "S1.03.03",
                Verdict::Fail,
                FailureReason::StaleReference(stable_id.to_owned()),
                pre,
                causal_parent,
            ));
        }
        current.version += 1;
        current.state = LifecycleState::Retired;
        current.causal_parent = causal_parent.to_owned();
        self.retired_placement_ids.insert(stable_id.to_owned());
        Ok(())
    }

    pub fn register_segment(
        &mut self,
        validation: &AxisValidation,
        segment: AuthoritySegment,
        origin: Origin,
    ) -> Result<()> {
        let pre = self.digest64();
        ensure_partition_writer(validation, origin, pre, &validation.causal_parent)?;
        if segment.segment_id.trim().is_empty()
            || segment.semantic_owner.trim().is_empty()
            || segment.lease.writer.trim().is_empty()
            || segment.semantic_digest64 == 0
            || !self.partitions.contains_key(&segment.lease.partition_id)
        {
            return Err(fail(
                "S1.03.02",
                Verdict::Blocked,
                FailureReason::MissingField("authority_segment"),
                pre,
                &validation.causal_parent,
            ));
        }
        if segment.semantic_owner != validation.semantic_owner {
            return Err(fail(
                "S1.03.02",
                Verdict::Blocked,
                FailureReason::WrongOwner,
                pre,
                &validation.causal_parent,
            ));
        }
        if self.segments.contains_key(&segment.segment_id) {
            return Err(fail(
                "S1.03.02",
                Verdict::Fail,
                FailureReason::DuplicateAuthority(segment.segment_id.clone()),
                pre,
                &validation.causal_parent,
            ));
        }
        self.segments.insert(segment.segment_id.clone(), segment);
        Ok(())
    }

    pub fn set_partition_availability(
        &mut self,
        partition_id: &str,
        availability: Availability,
        validation: &UnavailabilityValidation,
        origin: Origin,
    ) -> Result<()> {
        let pre = self.digest64();
        if origin != Origin::PartitionManager
            || validation.disposition != CandidateDisposition::CandidateOnly
        {
            return Err(fail(
                "S1.03.08",
                Verdict::Blocked,
                FailureReason::UnauthorizedOrigin,
                pre,
                &validation.causal_parent,
            ));
        }
        if !self.partitions.contains_key(partition_id) {
            return Err(fail(
                "S1.03.08",
                Verdict::Blocked,
                FailureReason::DanglingReference(partition_id.to_owned()),
                pre,
                &validation.causal_parent,
            ));
        }
        self.availability
            .insert(partition_id.to_owned(), availability);
        Ok(())
    }

    pub fn commit_handoff(
        &mut self,
        handoff: &ValidatedHandoff,
        origin: Origin,
    ) -> Result<HandoffCommitRecord> {
        let pre = self.digest64();
        if origin != Origin::PartitionManager {
            return Err(fail(
                "S1.03.06",
                Verdict::Blocked,
                FailureReason::UnauthorizedOrigin,
                pre,
                &handoff.causal_parent,
            ));
        }
        if handoff.schema_version != SCHEMA_VERSION
            || handoff.disposition != CandidateDisposition::CandidateOnly
        {
            return Err(fail(
                "S1.03.06",
                Verdict::Blocked,
                FailureReason::StaleVersion,
                pre,
                &handoff.causal_parent,
            ));
        }
        if self.availability.get(&handoff.target_partition) != Some(&Availability::Available) {
            return Err(fail(
                "S1.03.06",
                Verdict::Blocked,
                FailureReason::PartitionUnavailable(handoff.target_partition.clone()),
                pre,
                &handoff.causal_parent,
            ));
        }
        let Some(segment) = self.segments.get(&handoff.segment_id) else {
            return Err(fail(
                "S1.03.06",
                Verdict::Blocked,
                FailureReason::DanglingReference(handoff.segment_id.clone()),
                pre,
                &handoff.causal_parent,
            ));
        };
        if segment.semantic_owner != handoff.semantic_owner
            || segment.semantic_digest64 != handoff.semantic_digest64
            || segment.lease.partition_id != handoff.source_partition
            || segment.lease.writer != handoff.source_writer
            || segment.lease.authority_epoch != handoff.source_epoch
        {
            return Err(fail(
                "S1.03.06",
                Verdict::Fail,
                FailureReason::PartialHandoff,
                pre,
                &handoff.causal_parent,
            ));
        }
        if handoff.target_epoch != handoff.source_epoch + 1 {
            return Err(fail(
                "S1.03.06",
                Verdict::Fail,
                FailureReason::PartialHandoff,
                pre,
                &handoff.causal_parent,
            ));
        }

        let segment = self
            .segments
            .get_mut(&handoff.segment_id)
            .expect("validated segment exists");
        segment.lease = WriterLease {
            partition_id: handoff.target_partition.clone(),
            writer: handoff.target_writer.clone(),
            authority_epoch: handoff.target_epoch,
        };
        let post = self.digest64();
        Ok(HandoffCommitRecord {
            work_id: "S1.03.06",
            segment_id: handoff.segment_id.clone(),
            source_partition: handoff.source_partition.clone(),
            target_partition: handoff.target_partition.clone(),
            old_epoch: handoff.source_epoch,
            new_epoch: handoff.target_epoch,
            semantic_digest64: handoff.semantic_digest64,
            pre_state_digest64: pre,
            post_state_digest64: post,
            causal_parent: handoff.causal_parent.clone(),
        })
    }
}

fn validate_identity_fields(
    identity: &PartitionIdentity,
    pre: u64,
    work_id: &'static str,
) -> Result<()> {
    if identity.stable_id.trim().is_empty()
        || identity.namespace.trim().is_empty()
        || identity.version == 0
        || identity.lifecycle_lineage.trim().is_empty()
        || identity.causal_parent.trim().is_empty()
    {
        return Err(fail(
            work_id,
            Verdict::Blocked,
            FailureReason::MissingField("stable_id_namespace_version_lineage"),
            pre,
            &identity.causal_parent,
        ));
    }
    Ok(())
}

fn ensure_partition_writer(
    validation: &AxisValidation,
    origin: Origin,
    pre: u64,
    causal_parent: &str,
) -> Result<()> {
    if validation.contract_version != SCHEMA_VERSION
        || validation.allowed_writer != OWNER
        || origin != Origin::PartitionManager
    {
        return Err(fail(
            "S1.03.01",
            Verdict::Blocked,
            FailureReason::WrongOwner,
            pre,
            causal_parent,
        ));
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContractInput {
    pub work_id: &'static str,
    pub contract_version: u32,
    pub semantic_owner: String,
    pub allowed_writer: String,
    pub authority_epoch: u64,
    pub partition_id: String,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContractValidation {
    pub work_id: &'static str,
    pub contract_version: u32,
    pub semantic_owner: String,
    pub allowed_writer: String,
    pub authority_epoch: u64,
    pub partition_id: String,
    pub disposition: CandidateDisposition,
    pub causal_parent: String,
}

impl ContractValidation {
    pub fn digest64(&self) -> u64 {
        digest(self)
    }
}

pub fn validate_routing_contract(
    input: &ContractInput,
    origin: Origin,
) -> Result<ContractValidation> {
    validate_contract("S1.03.04", input, origin)
}

pub fn validate_cross_partition_contract(
    input: &ContractInput,
    origin: Origin,
) -> Result<ContractValidation> {
    validate_contract("S1.03.05", input, origin)
}

fn validate_contract(
    expected_work_id: &'static str,
    input: &ContractInput,
    origin: Origin,
) -> Result<ContractValidation> {
    let pre = digest(input);
    if input.work_id != expected_work_id
        || input.contract_version != SCHEMA_VERSION
        || input.semantic_owner.trim().is_empty()
        || input.allowed_writer != OWNER
        || input.partition_id.trim().is_empty()
        || input.causal_parent.trim().is_empty()
    {
        return Err(fail(
            expected_work_id,
            Verdict::Blocked,
            FailureReason::MissingField("contract_required_field_or_version_owner"),
            pre,
            &input.causal_parent,
        ));
    }
    if matches!(
        origin,
        Origin::Derived | Origin::Observer | Origin::Renderer | Origin::Analytics
    ) {
        return Err(fail(
            expected_work_id,
            Verdict::Blocked,
            FailureReason::UnauthorizedOrigin,
            pre,
            &input.causal_parent,
        ));
    }
    Ok(ContractValidation {
        work_id: expected_work_id,
        contract_version: input.contract_version,
        semantic_owner: input.semantic_owner.clone(),
        allowed_writer: input.allowed_writer.clone(),
        authority_epoch: input.authority_epoch,
        partition_id: input.partition_id.clone(),
        disposition: CandidateDisposition::CandidateOnly,
        causal_parent: input.causal_parent.clone(),
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HandoffRequest {
    pub schema_version: u32,
    pub segment_id: String,
    pub semantic_owner: String,
    pub semantic_digest64: u64,
    pub source_partition: String,
    pub source_writer: String,
    pub source_epoch: u64,
    pub target_partition: String,
    pub target_writer: String,
    pub target_epoch: u64,
    pub original_reference: String,
    pub transformation_basis: String,
    pub causal_parent: String,
    pub complete_payload: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedHandoff {
    pub work_id: &'static str,
    pub schema_version: u32,
    pub segment_id: String,
    pub semantic_owner: String,
    pub semantic_digest64: u64,
    pub source_partition: String,
    pub source_writer: String,
    pub source_epoch: u64,
    pub target_partition: String,
    pub target_writer: String,
    pub target_epoch: u64,
    pub original_reference: String,
    pub transformation_basis: String,
    pub disposition: CandidateDisposition,
    pub causal_parent: String,
}

impl ValidatedHandoff {
    pub fn digest64(&self) -> u64 {
        digest(self)
    }
}

pub fn validate_handoff(
    request: &HandoffRequest,
    routing: &ContractValidation,
    cross_partition: &ContractValidation,
    origin: Origin,
) -> Result<ValidatedHandoff> {
    let pre = digest(request);
    if origin != Origin::PartitionManager {
        return Err(fail(
            "S1.03.06",
            Verdict::Blocked,
            FailureReason::UnauthorizedOrigin,
            pre,
            &request.causal_parent,
        ));
    }
    if request.schema_version != SCHEMA_VERSION
        || routing.work_id != "S1.03.04"
        || cross_partition.work_id != "S1.03.05"
        || routing.contract_version != SCHEMA_VERSION
        || cross_partition.contract_version != SCHEMA_VERSION
    {
        return Err(fail(
            "S1.03.06",
            Verdict::Blocked,
            FailureReason::StaleVersion,
            pre,
            &request.causal_parent,
        ));
    }
    if request.segment_id.trim().is_empty()
        || request.semantic_owner.trim().is_empty()
        || request.semantic_digest64 == 0
        || request.source_partition.trim().is_empty()
        || request.source_writer.trim().is_empty()
        || request.target_partition.trim().is_empty()
        || request.target_writer.trim().is_empty()
        || request.original_reference.trim().is_empty()
        || request.transformation_basis.trim().is_empty()
        || request.causal_parent.trim().is_empty()
    {
        return Err(fail(
            "S1.03.06",
            Verdict::Blocked,
            FailureReason::MissingField("handoff_required_field"),
            pre,
            &request.causal_parent,
        ));
    }
    if !request.complete_payload {
        return Err(fail(
            "S1.03.06",
            Verdict::Fail,
            FailureReason::PartialHandoff,
            pre,
            &request.causal_parent,
        ));
    }
    if routing.semantic_owner != request.semantic_owner
        || cross_partition.semantic_owner != request.semantic_owner
        || routing.allowed_writer != OWNER
        || cross_partition.allowed_writer != OWNER
        || request.source_partition == request.target_partition
        || request.target_epoch != request.source_epoch + 1
    {
        return Err(fail(
            "S1.03.06",
            Verdict::Fail,
            FailureReason::IncompatiblePayload("authority_or_epoch"),
            pre,
            &request.causal_parent,
        ));
    }
    Ok(ValidatedHandoff {
        work_id: "S1.03.06",
        schema_version: request.schema_version,
        segment_id: request.segment_id.clone(),
        semantic_owner: request.semantic_owner.clone(),
        semantic_digest64: request.semantic_digest64,
        source_partition: request.source_partition.clone(),
        source_writer: request.source_writer.clone(),
        source_epoch: request.source_epoch,
        target_partition: request.target_partition.clone(),
        target_writer: request.target_writer.clone(),
        target_epoch: request.target_epoch,
        original_reference: request.original_reference.clone(),
        transformation_basis: request.transformation_basis.clone(),
        disposition: CandidateDisposition::CandidateOnly,
        causal_parent: request.causal_parent.clone(),
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HandoffCommitRecord {
    pub work_id: &'static str,
    pub segment_id: String,
    pub source_partition: String,
    pub target_partition: String,
    pub old_epoch: u64,
    pub new_epoch: u64,
    pub semantic_digest64: u64,
    pub pre_state_digest64: u64,
    pub post_state_digest64: u64,
    pub causal_parent: String,
}

impl HandoffCommitRecord {
    pub fn digest64(&self) -> u64 {
        digest(self)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MigrationArtifact {
    pub work_id: &'static str,
    pub schema_version: u32,
    pub commit_marker: bool,
    pub causal_cut: u64,
    pub recovery_position: u64,
    pub parent_cut: u64,
    pub replay_reference: String,
    pub state: AuthorityPlacementState,
    pub state_digest64: u64,
    pub handoff_digest64: u64,
    pub causal_parent: String,
}

impl MigrationArtifact {
    pub fn new(
        state: &AuthorityPlacementState,
        commit: &HandoffCommitRecord,
        causal_cut: u64,
        recovery_position: u64,
        parent_cut: u64,
        replay_reference: &str,
    ) -> Result<Self> {
        let pre = state.digest64();
        if state.schema_version != SCHEMA_VERSION
            || causal_cut == 0
            || recovery_position == 0
            || replay_reference.trim().is_empty()
            || commit.post_state_digest64 != pre
        {
            return Err(fail(
                "S1.03.07",
                Verdict::Blocked,
                FailureReason::MissingField("durable_migration_boundary"),
                pre,
                &commit.causal_parent,
            ));
        }
        Ok(Self {
            work_id: "S1.03.07",
            schema_version: SCHEMA_VERSION,
            commit_marker: true,
            causal_cut,
            recovery_position,
            parent_cut,
            replay_reference: replay_reference.to_owned(),
            state: state.clone(),
            state_digest64: pre,
            handoff_digest64: commit.digest64(),
            causal_parent: commit.causal_parent.clone(),
        })
    }

    pub fn digest64(&self) -> u64 {
        digest(self)
    }

    pub fn restore(&self) -> Result<AuthorityPlacementState> {
        let pre = self.digest64();
        if self.work_id != "S1.03.07"
            || self.schema_version != SCHEMA_VERSION
            || !self.commit_marker
            || self.causal_cut == 0
            || self.recovery_position == 0
            || self.replay_reference.trim().is_empty()
            || self.state_digest64 == 0
            || self.state_digest64 != self.state.digest64()
            || self.handoff_digest64 == 0
        {
            return Err(fail(
                "S1.03.07",
                Verdict::Blocked,
                FailureReason::CorruptSnapshot,
                pre,
                &self.causal_parent,
            ));
        }
        Ok(self.state.clone())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnavailabilityInput {
    pub contract_version: u32,
    pub partition_id: String,
    pub semantic_owner: String,
    pub allowed_writer: String,
    pub authority_epoch: u64,
    pub desired_state: Availability,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnavailabilityValidation {
    pub work_id: &'static str,
    pub contract_version: u32,
    pub partition_id: String,
    pub semantic_owner: String,
    pub authority_epoch: u64,
    pub desired_state: Availability,
    pub disposition: CandidateDisposition,
    pub causal_parent: String,
}

impl UnavailabilityValidation {
    pub fn digest64(&self) -> u64 {
        digest(self)
    }
}

pub fn validate_unavailability(
    input: &UnavailabilityInput,
    validation: &AxisValidation,
    origin: Origin,
) -> Result<UnavailabilityValidation> {
    let pre = digest(input);
    if matches!(
        origin,
        Origin::Derived | Origin::Observer | Origin::Renderer | Origin::Analytics
    ) {
        return Err(fail(
            "S1.03.08",
            Verdict::Blocked,
            FailureReason::UnauthorizedOrigin,
            pre,
            &input.causal_parent,
        ));
    }
    if input.contract_version != SCHEMA_VERSION
        || input.partition_id.trim().is_empty()
        || input.semantic_owner != validation.semantic_owner
        || input.allowed_writer != OWNER
        || input.authority_epoch < validation.authority_epoch
        || input.causal_parent.trim().is_empty()
    {
        return Err(fail(
            "S1.03.08",
            Verdict::Blocked,
            FailureReason::MissingField("partition_unavailability_contract"),
            pre,
            &input.causal_parent,
        ));
    }
    Ok(UnavailabilityValidation {
        work_id: "S1.03.08",
        contract_version: input.contract_version,
        partition_id: input.partition_id.clone(),
        semantic_owner: input.semantic_owner.clone(),
        authority_epoch: input.authority_epoch,
        desired_state: input.desired_state,
        disposition: CandidateDisposition::CandidateOnly,
        causal_parent: input.causal_parent.clone(),
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthorityClaim {
    pub segment_id: String,
    pub semantic_owner: String,
    pub partition_id: String,
    pub writer: String,
    pub authority_epoch: u64,
    pub in_scope: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuditEvidence {
    pub work_id: &'static str,
    pub verdict: Verdict,
    pub operands: [&'static str; 5],
    pub first_failure: Option<String>,
    pub violating_input: Option<AuthorityClaim>,
    pub pre_state_digest64: u64,
    pub post_state_digest64: u64,
    pub reproduction: String,
    pub causal_parent: String,
    pub read_only: bool,
}

impl AuditEvidence {
    pub fn digest64(&self) -> u64 {
        digest(self)
    }
}

pub fn audit_duplicate_authority(
    claims: &[AuthorityClaim],
    causal_parent: &str,
    origin: Origin,
) -> Result<AuditEvidence> {
    let pre = digest(&claims);
    if origin != Origin::ValidationQa {
        return Err(fail(
            "S1.03.09",
            Verdict::Blocked,
            FailureReason::UnauthorizedOrigin,
            pre,
            causal_parent,
        ));
    }
    if causal_parent.trim().is_empty() {
        return Err(fail(
            "S1.03.09",
            Verdict::Blocked,
            FailureReason::MissingField("audit.causal_parent"),
            pre,
            causal_parent,
        ));
    }
    let mut seen: BTreeMap<(&str, u64), (&str, &str)> = BTreeMap::new();
    for claim in claims.iter().filter(|claim| claim.in_scope) {
        let key = (claim.segment_id.as_str(), claim.authority_epoch);
        if let Some((partition, writer)) = seen.get(&key) {
            if *partition != claim.partition_id || *writer != claim.writer {
                let evidence = AuditEvidence {
                    work_id: "S1.03.09",
                    verdict: Verdict::Fail,
                    operands: [
                        "Duplicate",
                        "Authority",
                        "Axis",
                        "Single-Writer",
                        "Partition",
                    ],
                    first_failure: Some(format!(
                        "segment={} epoch={}",
                        claim.segment_id, claim.authority_epoch
                    )),
                    violating_input: Some(claim.clone()),
                    pre_state_digest64: pre,
                    post_state_digest64: pre,
                    reproduction: "replay same in-scope claims in deterministic order".to_owned(),
                    causal_parent: causal_parent.to_owned(),
                    read_only: true,
                };
                return Ok(evidence);
            }
        } else {
            seen.insert(key, (&claim.partition_id, &claim.writer));
        }
    }
    Ok(AuditEvidence {
        work_id: "S1.03.09",
        verdict: Verdict::Pass,
        operands: [
            "Duplicate",
            "Authority",
            "Axis",
            "Single-Writer",
            "Partition",
        ],
        first_failure: None,
        violating_input: None,
        pre_state_digest64: pre,
        post_state_digest64: pre,
        reproduction: "replay same in-scope claims in deterministic order".to_owned(),
        causal_parent: causal_parent.to_owned(),
        read_only: true,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MemberEvidence {
    pub work_id: String,
    pub run_id: String,
    pub source_version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub source_state_digest64: u64,
    pub evidence_digest64: u64,
    pub verdict: Verdict,
    pub behavior_pass: bool,
    pub contract_pass: bool,
    pub integration_pass: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AcceptanceRecord {
    pub work_id: &'static str,
    pub work_package: &'static str,
    pub verdict: Verdict,
    pub run_id: String,
    pub source_version: u32,
    pub reviewer: String,
    pub operands: [&'static str; 4],
    pub admission_digest64: u64,
    pub member_evidence_digest64: u64,
    pub event_order: [&'static str; 9],
    pub causal_references: Vec<String>,
    pub missing_evidence: Vec<String>,
    pub downstream_blocked: bool,
    pub read_only: bool,
}

impl AcceptanceRecord {
    pub fn digest64(&self) -> u64 {
        digest(self)
    }
}

pub fn review_s1_03(
    admission: &Admission,
    members: &[MemberEvidence],
    origin: Origin,
) -> Result<AcceptanceRecord> {
    let pre = digest(&(admission, members));
    if origin != Origin::ValidationQa {
        return Err(fail(
            "S1.03.10",
            Verdict::Blocked,
            FailureReason::UnauthorizedOrigin,
            pre,
            &admission.causal_parent,
        ));
    }
    if members.len() != REVIEW_INPUT_MEMBER_IDS.len() {
        return Err(fail(
            "S1.03.10",
            Verdict::Blocked,
            FailureReason::MissingEvidence("S1.03 member set".to_owned()),
            pre,
            &admission.causal_parent,
        ));
    }
    let mut seen = BTreeSet::new();
    let mut causal_references = Vec::with_capacity(members.len());
    for (index, member) in members.iter().enumerate() {
        let expected = REVIEW_INPUT_MEMBER_IDS[index];
        if member.work_id != expected {
            let reason = if MEMBER_IDS.contains(&member.work_id.as_str()) {
                FailureReason::MissingEvidence(expected.to_owned())
            } else {
                FailureReason::OutOfScopeEvidence(member.work_id.clone())
            };
            return Err(fail(
                "S1.03.10",
                Verdict::Blocked,
                reason,
                pre,
                &admission.causal_parent,
            ));
        }
        if !seen.insert(member.work_id.clone()) {
            return Err(fail(
                "S1.03.10",
                Verdict::Blocked,
                FailureReason::MissingEvidence(format!("duplicate {}", member.work_id)),
                pre,
                &admission.causal_parent,
            ));
        }
        if member.run_id != admission.run_id {
            return Err(fail(
                "S1.03.10",
                Verdict::Blocked,
                FailureReason::MixedRun(member.work_id.clone()),
                pre,
                &admission.causal_parent,
            ));
        }
        if member.source_version != admission.source_version
            || member.owner.trim().is_empty()
            || member.causal_parent.trim().is_empty()
            || member.source_state_digest64 == 0
            || member.evidence_digest64 == 0
        {
            return Err(fail(
                "S1.03.10",
                Verdict::Blocked,
                FailureReason::MissingEvidence(member.work_id.clone()),
                pre,
                &admission.causal_parent,
            ));
        }
        if member.verdict != Verdict::Pass
            || !member.behavior_pass
            || !member.contract_pass
            || !member.integration_pass
        {
            return Err(fail(
                "S1.03.10",
                Verdict::Fail,
                FailureReason::ExplicitFailure(member.work_id.clone()),
                pre,
                &admission.causal_parent,
            ));
        }
        causal_references.push(member.causal_parent.clone());
    }
    Ok(AcceptanceRecord {
        work_id: "S1.03.10",
        work_package: WORK_PACKAGE,
        verdict: Verdict::Pass,
        run_id: admission.run_id.clone(),
        source_version: admission.source_version,
        reviewer: REVIEWER.to_owned(),
        operands: ["Authority", "Axis", "Single-Writer", "Partition"],
        admission_digest64: admission.digest64(),
        member_evidence_digest64: digest(&members),
        event_order: REVIEW_INPUT_MEMBER_IDS,
        causal_references,
        missing_evidence: Vec::new(),
        downstream_blocked: false,
        read_only: true,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Wp009Closure {
    pub work_package: &'static str,
    pub member_ids: [&'static str; 10],
    pub acceptance_digest64: u64,
    pub s1_03_10_evidence_digest64: u64,
    pub architecture_change: u32,
    pub wbs_scope_delta: u32,
    pub dependency_semantic_change: u32,
    pub frozen_week_change: u32,
    pub closed: bool,
}

pub fn close_wp009(
    record: &AcceptanceRecord,
    s1_03_10_evidence_digest64: u64,
) -> Result<Wp009Closure> {
    let pre = record.digest64();
    if record.work_id != "S1.03.10"
        || record.work_package != WORK_PACKAGE
        || record.verdict != Verdict::Pass
        || record.downstream_blocked
        || !record.read_only
        || record.event_order != REVIEW_INPUT_MEMBER_IDS
        || record.member_evidence_digest64 == 0
        || s1_03_10_evidence_digest64 == 0
    {
        return Err(fail(
            "S1.03.10",
            Verdict::Blocked,
            FailureReason::MissingEvidence("WP-009 closure".to_owned()),
            pre,
            record
                .causal_references
                .first()
                .map(String::as_str)
                .unwrap_or("S1.03.10"),
        ));
    }
    Ok(Wp009Closure {
        work_package: WORK_PACKAGE,
        member_ids: MEMBER_IDS,
        acceptance_digest64: record.digest64(),
        s1_03_10_evidence_digest64,
        architecture_change: 0,
        wbs_scope_delta: 0,
        dependency_semantic_change: 0,
        frozen_week_change: 0,
        closed: true,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StateSnapshot {
    pub schema_version: u32,
    pub state: AuthorityPlacementState,
    pub state_digest64: u64,
}

impl StateSnapshot {
    pub fn new(state: &AuthorityPlacementState) -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            state: state.clone(),
            state_digest64: state.digest64(),
        }
    }

    pub fn restore(&self) -> Result<AuthorityPlacementState> {
        let pre = digest(self);
        if self.schema_version != SCHEMA_VERSION
            || self.state_digest64 == 0
            || self.state_digest64 != self.state.digest64()
        {
            return Err(fail(
                "S1.03.03",
                Verdict::Blocked,
                FailureReason::CorruptSnapshot,
                pre,
                "snapshot.restore",
            ));
        }
        Ok(self.state.clone())
    }
}

fn fail(
    work_id: &'static str,
    verdict: Verdict,
    reason: FailureReason,
    pre: u64,
    causal_parent: &str,
) -> Box<Failure> {
    Box::new(Failure {
        work_id,
        verdict,
        reason,
        pre_state_digest64: pre,
        post_state_digest64: pre,
        downstream_blocked: true,
        causal_parent: causal_parent.to_owned(),
    })
}

fn digest<T: std::fmt::Debug + ?Sized>(value: &T) -> u64 {
    fnv1a64(format!("{value:?}").as_bytes())
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
