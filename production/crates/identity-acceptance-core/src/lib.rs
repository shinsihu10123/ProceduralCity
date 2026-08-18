#![forbid(unsafe_code)]
//! Frozen WP-013 / S1.02.10 S1.02 Acceptance Review.
//!
//! This crate is a read-only validation boundary over the completed WP-001 and WP-002
//! identity evidence chain. It never owns or mutates canonical identity state.

use gaonn_identity_continuity_core::ContinuityEvidence;
use gaonn_identity_core::{IdentityDisposition, S1_02_01_OWNER};
use gaonn_identity_reuse_audit_core::AuditEvidence;
use gaonn_world_core::{S1_01_01_CONTRACT_VERSION, ValidationReceipt};
use std::collections::BTreeSet;

pub const SCHEMA_VERSION: u32 = 1;
pub const WORK_ID: &str = "S1.02.10";
pub const WORK_PACKAGE: &str = "WP-013";
pub const REVIEWER: &str = "validation_qa.s1_02_acceptance_review";
pub const OPERANDS: [&str; 5] = ["Stable", "Entity", "ID", "체계", "Namespace"];
pub const MEMBER_IDS: [&str; 9] = [
    "S1.02.01",
    "S1.02.02",
    "S1.02.03",
    "S1.02.04",
    "S1.02.05",
    "S1.02.06",
    "S1.02.07",
    "S1.02.08",
    "S1.02.09",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReviewOrigin {
    ValidationQa,
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PredecessorClosureEvidence {
    pub work_package: String,
    pub source_version: u32,
    pub closed: bool,
    pub evidence_digest64: u64,
    pub root_digest64: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Wp002ClosureEvidence {
    pub work_package: String,
    pub source_version: u32,
    pub closed: bool,
    pub member_ids: [&'static str; 9],
    pub evidence_digest64: u64,
    pub root_digest64: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MemberEvidence {
    pub work_id: String,
    pub run_id: String,
    pub source_version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub evidence_digest64: u64,
    pub source_state_digest64: u64,
    pub root_digest64: u64,
    pub verdict: Verdict,
    pub behavior_pass: bool,
    pub contract_pass: bool,
    pub integration_pass: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IdentitySourceSnapshot {
    pub owner: String,
    pub continuity: ContinuityEvidence,
    pub reuse_audit: AuditEvidence,
}

impl IdentitySourceSnapshot {
    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{self:?}").as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewInput {
    pub schema_version: u32,
    pub run_id: String,
    pub source_version: u32,
    pub reviewer: String,
    pub root: ValidationReceipt,
    pub wp001: PredecessorClosureEvidence,
    pub wp002: Wp002ClosureEvidence,
    pub source: IdentitySourceSnapshot,
    pub members: Vec<MemberEvidence>,
    pub provenance_digest64: u64,
}

impl ReviewInput {
    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{self:?}").as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FailureReason {
    InvalidRoot(&'static str),
    InvalidPredecessor(&'static str),
    InvalidSource(&'static str),
    StaleVersion,
    UnauthorizedReviewer,
    MissingField(&'static str),
    MissingMember(String),
    OutOfScopeEvidence(String),
    DuplicateMember(String),
    RunMismatch(String),
    SourceVersionMismatch(String),
    WrongOwner(String),
    MissingEvidence(String),
    ReferenceMismatch(&'static str),
    ExplicitFailure(String),
    ContractFailure(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewFailure {
    pub work_id: &'static str,
    pub verdict: Verdict,
    pub failed_work_id: String,
    pub reason: FailureReason,
    pub pre_state_digest64: u64,
    pub post_state_digest64: u64,
    pub downstream_blocked: bool,
    pub missing_evidence: Vec<String>,
    pub causal_parent: String,
}

pub type ReviewResult<T> = Result<T, Box<ReviewFailure>>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AcceptanceRecord {
    pub work_id: &'static str,
    pub work_package: &'static str,
    pub operands: [&'static str; 5],
    pub verdict: Verdict,
    pub run_id: String,
    pub source_version: u32,
    pub reviewer: String,
    pub canonical_owner: String,
    pub stable_id: String,
    pub namespace: String,
    pub namespace_version: String,
    pub entity_version: u32,
    pub lifecycle_lineage: String,
    pub root_work_id: &'static str,
    pub root_version: u32,
    pub root_owner: String,
    pub root_causal_parent: String,
    pub root_digest64: u64,
    pub wp001_evidence_digest64: u64,
    pub wp002_evidence_digest64: u64,
    pub continuity_digest64: u64,
    pub reuse_audit_digest64: u64,
    pub member_evidence_digest64: u64,
    pub provenance_digest64: u64,
    pub event_order: [&'static str; 9],
    pub causal_references: Vec<String>,
    pub missing_evidence: Vec<String>,
    pub downstream_blocked: bool,
    pub read_only: bool,
}

impl AcceptanceRecord {
    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{self:?}").as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewSnapshot {
    pub schema_version: u32,
    pub evidence_hash64: u64,
    pub input: ReviewInput,
}

impl ReviewSnapshot {
    pub fn new(input: ReviewInput) -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            evidence_hash64: input.digest64(),
            input,
        }
    }

    pub fn validate(&self) -> Result<(), FailureReason> {
        if self.schema_version != SCHEMA_VERSION || self.input.schema_version != SCHEMA_VERSION {
            return Err(FailureReason::StaleVersion);
        }
        if self.evidence_hash64 == 0 || self.evidence_hash64 != self.input.digest64() {
            return Err(FailureReason::ReferenceMismatch("snapshot.evidence_hash"));
        }
        Ok(())
    }

    pub fn restore(&self) -> Result<ReviewInput, FailureReason> {
        self.validate()?;
        Ok(self.input.clone())
    }

    pub fn replay(&self, origin: ReviewOrigin) -> ReviewResult<AcceptanceRecord> {
        match self.restore() {
            Ok(input) => review(&input, origin),
            Err(reason) => Err(failure(
                &self.input,
                Verdict::Blocked,
                WORK_ID,
                reason,
                Vec::new(),
            )),
        }
    }

    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{self:?}").as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Wp013Closure {
    pub work_package: &'static str,
    pub member_id: &'static str,
    pub acceptance_digest64: u64,
    pub evidence_digest64: u64,
    pub closed: bool,
}

pub fn review(input: &ReviewInput, origin: ReviewOrigin) -> ReviewResult<AcceptanceRecord> {
    if origin != ReviewOrigin::ValidationQa || input.reviewer != REVIEWER {
        return Err(failure(
            input,
            Verdict::Blocked,
            WORK_ID,
            FailureReason::UnauthorizedReviewer,
            Vec::new(),
        ));
    }
    if input.schema_version != SCHEMA_VERSION || input.source_version != SCHEMA_VERSION {
        return Err(failure(
            input,
            Verdict::Blocked,
            WORK_ID,
            FailureReason::StaleVersion,
            Vec::new(),
        ));
    }
    if input.run_id.trim().is_empty() {
        return Err(failure(
            input,
            Verdict::Blocked,
            WORK_ID,
            FailureReason::MissingField("review.run_id"),
            Vec::new(),
        ));
    }
    if input.provenance_digest64 == 0 {
        return Err(failure(
            input,
            Verdict::Blocked,
            WORK_ID,
            FailureReason::MissingField("review.provenance_digest64"),
            Vec::new(),
        ));
    }

    validate_root(input)?;
    validate_predecessors(input)?;
    validate_source(input)?;
    validate_members(input)?;
    validate_source_member_links(input)?;

    let member_evidence_digest64 = fnv1a64(format!("{:?}", input.members).as_bytes());
    let causal_references = input
        .members
        .iter()
        .map(|member| member.causal_parent.clone())
        .collect();

    Ok(AcceptanceRecord {
        work_id: WORK_ID,
        work_package: WORK_PACKAGE,
        operands: OPERANDS,
        verdict: Verdict::Pass,
        run_id: input.run_id.clone(),
        source_version: input.source_version,
        reviewer: input.reviewer.clone(),
        canonical_owner: S1_02_01_OWNER.to_owned(),
        stable_id: input.source.continuity.stable_id.clone(),
        namespace: input.source.continuity.namespace.clone(),
        namespace_version: input.source.continuity.namespace_version.clone(),
        entity_version: input.source.continuity.entity_version,
        lifecycle_lineage: input.source.continuity.lifecycle_lineage.clone(),
        root_work_id: input.root.work_id,
        root_version: input.root.contract_version,
        root_owner: input.root.owner.clone(),
        root_causal_parent: input.root.causal_parent.clone(),
        root_digest64: input.root.evidence_digest64(),
        wp001_evidence_digest64: input.wp001.evidence_digest64,
        wp002_evidence_digest64: input.wp002.evidence_digest64,
        continuity_digest64: input.source.continuity.digest64(),
        reuse_audit_digest64: audit_digest64(&input.source.reuse_audit),
        member_evidence_digest64,
        provenance_digest64: input.provenance_digest64,
        event_order: MEMBER_IDS,
        causal_references,
        missing_evidence: Vec::new(),
        downstream_blocked: false,
        read_only: true,
    })
}

pub fn close_wp013(
    record: &AcceptanceRecord,
    evidence_digest64: u64,
) -> ReviewResult<Wp013Closure> {
    if record.work_id != WORK_ID
        || record.work_package != WORK_PACKAGE
        || record.verdict != Verdict::Pass
        || record.downstream_blocked
        || !record.read_only
        || evidence_digest64 == 0
    {
        let digest = record.digest64();
        return Err(Box::new(ReviewFailure {
            work_id: WORK_ID,
            verdict: Verdict::Blocked,
            failed_work_id: WORK_ID.to_owned(),
            reason: FailureReason::MissingEvidence(WORK_ID.to_owned()),
            pre_state_digest64: digest,
            post_state_digest64: digest,
            downstream_blocked: true,
            missing_evidence: vec![WORK_ID.to_owned()],
            causal_parent: record.root_causal_parent.clone(),
        }));
    }

    Ok(Wp013Closure {
        work_package: WORK_PACKAGE,
        member_id: WORK_ID,
        acceptance_digest64: record.digest64(),
        evidence_digest64,
        closed: true,
    })
}

fn validate_root(input: &ReviewInput) -> ReviewResult<()> {
    let root = &input.root;
    if root.work_id != "S1.01.01" {
        return Err(failure(
            input,
            Verdict::Blocked,
            "WP-001",
            FailureReason::InvalidRoot("work_id"),
            Vec::new(),
        ));
    }
    if root.contract_version != S1_01_01_CONTRACT_VERSION {
        return Err(failure(
            input,
            Verdict::Blocked,
            "WP-001",
            FailureReason::InvalidRoot("contract_version"),
            Vec::new(),
        ));
    }
    if root.operands != ["Canonical", "Authority", "Registry"]
        || root.owner.trim().is_empty()
        || root.writer.trim().is_empty()
        || root.causal_parent.trim().is_empty()
    {
        return Err(failure(
            input,
            Verdict::Blocked,
            "WP-001",
            FailureReason::InvalidRoot("authority_or_causal_reference"),
            Vec::new(),
        ));
    }
    Ok(())
}

fn validate_predecessors(input: &ReviewInput) -> ReviewResult<()> {
    let root_digest64 = input.root.evidence_digest64();
    if input.wp001.work_package != "WP-001"
        || input.wp001.source_version != S1_01_01_CONTRACT_VERSION
        || !input.wp001.closed
        || input.wp001.evidence_digest64 == 0
        || input.wp001.root_digest64 != root_digest64
    {
        return Err(failure(
            input,
            Verdict::Blocked,
            "WP-001",
            FailureReason::InvalidPredecessor("WP-001"),
            Vec::new(),
        ));
    }

    if input.wp002.work_package != "WP-002"
        || input.wp002.source_version != input.source_version
        || !input.wp002.closed
        || input.wp002.member_ids != MEMBER_IDS
        || input.wp002.evidence_digest64 == 0
        || input.wp002.root_digest64 != root_digest64
    {
        return Err(failure(
            input,
            Verdict::Blocked,
            "WP-002",
            FailureReason::InvalidPredecessor("WP-002"),
            Vec::new(),
        ));
    }
    Ok(())
}

fn validate_source(input: &ReviewInput) -> ReviewResult<()> {
    let source = &input.source;
    let continuity = &source.continuity;
    let audit = &source.reuse_audit;

    if source.owner != S1_02_01_OWNER {
        return Err(failure(
            input,
            Verdict::Blocked,
            WORK_ID,
            FailureReason::WrongOwner(source.owner.clone()),
            Vec::new(),
        ));
    }
    if continuity.work_id != "S1.02.08"
        || continuity.disposition != IdentityDisposition::CandidateOnly
        || continuity.predecessor_digest == 0
    {
        return Err(failure(
            input,
            Verdict::Blocked,
            "S1.02.08",
            FailureReason::InvalidSource("continuity"),
            Vec::new(),
        ));
    }
    for (value, field) in [
        (&continuity.stable_id, "stable_id"),
        (&continuity.namespace, "namespace"),
        (&continuity.namespace_version, "namespace_version"),
        (&continuity.lifecycle_lineage, "lifecycle_lineage"),
        (&continuity.snapshot_id, "snapshot_id"),
        (&continuity.reload_id, "reload_id"),
        (&continuity.committed_causal_cut, "committed_causal_cut"),
        (&continuity.causal_parent, "causal_parent"),
    ] {
        if value.trim().is_empty() {
            return Err(failure(
                input,
                Verdict::Blocked,
                "S1.02.08",
                FailureReason::MissingField(field),
                vec!["S1.02.08".to_owned()],
            ));
        }
    }

    if audit.work_id != "S1.02.09"
        || audit.predecessor_digest != continuity.digest64()
        || audit.canonical_mutation
    {
        return Err(failure(
            input,
            Verdict::Blocked,
            "S1.02.09",
            FailureReason::InvalidSource("reuse_audit"),
            Vec::new(),
        ));
    }
    if !audit.pass() {
        return Err(failure(
            input,
            Verdict::Fail,
            "S1.02.09",
            FailureReason::ExplicitFailure("identity-reuse-prohibition-audit".to_owned()),
            Vec::new(),
        ));
    }
    Ok(())
}

fn validate_members(input: &ReviewInput) -> ReviewResult<()> {
    let required: BTreeSet<&str> = MEMBER_IDS.into_iter().collect();
    let mut seen = BTreeSet::new();

    for member in &input.members {
        if !required.contains(member.work_id.as_str()) {
            return Err(failure(
                input,
                Verdict::Blocked,
                &member.work_id,
                FailureReason::OutOfScopeEvidence(member.work_id.clone()),
                Vec::new(),
            ));
        }
        if !seen.insert(member.work_id.clone()) {
            return Err(failure(
                input,
                Verdict::Blocked,
                &member.work_id,
                FailureReason::DuplicateMember(member.work_id.clone()),
                Vec::new(),
            ));
        }
    }

    let missing: Vec<String> = MEMBER_IDS
        .iter()
        .filter(|work_id| !seen.contains(**work_id))
        .map(|work_id| (*work_id).to_owned())
        .collect();
    if !missing.is_empty() {
        let first = missing[0].clone();
        return Err(failure(
            input,
            Verdict::Blocked,
            &first,
            FailureReason::MissingMember(first.clone()),
            missing,
        ));
    }
    if input.members.len() != MEMBER_IDS.len() {
        return Err(failure(
            input,
            Verdict::Blocked,
            WORK_ID,
            FailureReason::ContractFailure("member-count".to_owned()),
            Vec::new(),
        ));
    }

    for (index, member) in input.members.iter().enumerate() {
        let expected = MEMBER_IDS[index];
        if member.work_id != expected {
            return Err(failure(
                input,
                Verdict::Blocked,
                &member.work_id,
                FailureReason::ContractFailure("member-order".to_owned()),
                Vec::new(),
            ));
        }
        if member.run_id != input.run_id {
            return Err(failure(
                input,
                Verdict::Blocked,
                expected,
                FailureReason::RunMismatch(expected.to_owned()),
                Vec::new(),
            ));
        }
        if member.source_version != input.source_version {
            return Err(failure(
                input,
                Verdict::Blocked,
                expected,
                FailureReason::SourceVersionMismatch(expected.to_owned()),
                Vec::new(),
            ));
        }
        if member.owner != S1_02_01_OWNER {
            return Err(failure(
                input,
                Verdict::Blocked,
                expected,
                FailureReason::WrongOwner(expected.to_owned()),
                Vec::new(),
            ));
        }
        if member.causal_parent.trim().is_empty()
            || member.evidence_digest64 == 0
            || member.source_state_digest64 == 0
        {
            return Err(failure(
                input,
                Verdict::Blocked,
                expected,
                FailureReason::MissingEvidence(expected.to_owned()),
                vec![expected.to_owned()],
            ));
        }
        if member.root_digest64 != input.root.evidence_digest64() {
            return Err(failure(
                input,
                Verdict::Blocked,
                expected,
                FailureReason::ReferenceMismatch("member.root_digest64"),
                Vec::new(),
            ));
        }
        match member.verdict {
            Verdict::Pass => {}
            Verdict::Blocked => {
                return Err(failure(
                    input,
                    Verdict::Blocked,
                    expected,
                    FailureReason::MissingEvidence(expected.to_owned()),
                    vec![expected.to_owned()],
                ));
            }
            Verdict::Fail => {
                return Err(failure(
                    input,
                    Verdict::Fail,
                    expected,
                    FailureReason::ExplicitFailure(expected.to_owned()),
                    Vec::new(),
                ));
            }
        }
        if !member.behavior_pass || !member.contract_pass || !member.integration_pass {
            return Err(failure(
                input,
                Verdict::Fail,
                expected,
                FailureReason::ContractFailure(expected.to_owned()),
                Vec::new(),
            ));
        }
    }
    Ok(())
}

fn validate_source_member_links(input: &ReviewInput) -> ReviewResult<()> {
    let continuity_digest = input.source.continuity.digest64();
    let audit_digest = audit_digest64(&input.source.reuse_audit);

    if input.members[7].source_state_digest64 != continuity_digest {
        return Err(failure(
            input,
            Verdict::Blocked,
            "S1.02.08",
            FailureReason::ReferenceMismatch("S1.02.08.source_state_digest64"),
            Vec::new(),
        ));
    }
    if input.members[8].source_state_digest64 != audit_digest {
        return Err(failure(
            input,
            Verdict::Blocked,
            "S1.02.09",
            FailureReason::ReferenceMismatch("S1.02.09.source_state_digest64"),
            Vec::new(),
        ));
    }
    Ok(())
}

fn failure(
    input: &ReviewInput,
    verdict: Verdict,
    failed_work_id: &str,
    reason: FailureReason,
    missing_evidence: Vec<String>,
) -> Box<ReviewFailure> {
    let digest = input.digest64();
    Box::new(ReviewFailure {
        work_id: WORK_ID,
        verdict,
        failed_work_id: failed_work_id.to_owned(),
        reason,
        pre_state_digest64: digest,
        post_state_digest64: digest,
        downstream_blocked: true,
        missing_evidence,
        causal_parent: input.root.causal_parent.clone(),
    })
}

pub fn audit_digest64(audit: &AuditEvidence) -> u64 {
    fnv1a64(format!("{audit:?}").as_bytes())
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf29ce484222325_u64, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
    })
}
