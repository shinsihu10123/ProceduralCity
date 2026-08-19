#![forbid(unsafe_code)]
//! Frozen WP-018 / S1.06.11 S1.06 Acceptance Review.
//!
//! This crate is a read-only Validation/QA gate over the completed S1.06
//! scheduler implementation. It verifies complete same-run evidence without
//! owning or mutating canonical scheduler state.

use gaonn_identity_acceptance_core::Wp013Closure;
use gaonn_scheduler_core::{MEMBER_IDS as SCHEDULER_MEMBER_IDS, OWNER as SCHEDULER_OWNER, Wp010Acceptance};
use std::collections::BTreeSet;

pub const SCHEMA_VERSION: u32 = 1;
pub const WORK_ID: &str = "S1.06.11";
pub const WORK_PACKAGE: &str = "WP-018";
pub const REVIEWER: &str = "validation_qa.s1_06_acceptance_review";
pub const OPERANDS: [&str; 4] = ["Schedulable", "Event", "Causal", "Deadline"];
pub const REVIEWED_MEMBER_IDS: [&str; 10] = SCHEDULER_MEMBER_IDS;
pub const HARD_SUCCESSORS: [&str; 2] = ["WP-007", "WP-023"];

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
pub struct RootReference {
    pub work_id: String,
    pub version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub evidence_digest64: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MemberEvidence {
    pub work_id: String,
    pub run_id: String,
    pub source_version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub evidence_digest64: u64,
    pub source_wp010_evidence_digest64: u64,
    pub source_wp010_snapshot_digest64: u64,
    pub verdict: Verdict,
    pub behavior_pass: bool,
    pub contract_pass: bool,
    pub integration_pass: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewInput {
    pub schema_version: u32,
    pub run_id: String,
    pub source_version: u32,
    pub reviewer: String,
    pub root: RootReference,
    pub wp010: Wp010Acceptance,
    pub wp013: Wp013Closure,
    pub members: Vec<MemberEvidence>,
    pub provenance_digest64: u64,
    pub derived_lineage_digest64: u64,
}

impl ReviewInput {
    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{self:?}").as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FailureReason {
    UnauthorizedReviewer,
    StaleVersion,
    MissingField(&'static str),
    InvalidRoot(&'static str),
    InvalidPredecessor(&'static str),
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
    pub blocked_successors: [&'static str; 2],
    pub missing_evidence: Vec<String>,
    pub causal_parent: String,
}

pub type ReviewResult<T> = Result<T, Box<ReviewFailure>>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AcceptanceRecord {
    pub work_id: &'static str,
    pub work_package: &'static str,
    pub operands: [&'static str; 4],
    pub verdict: Verdict,
    pub run_id: String,
    pub source_version: u32,
    pub reviewer: String,
    pub scheduler_owner: String,
    pub root_work_id: String,
    pub root_version: u32,
    pub root_owner: String,
    pub root_causal_parent: String,
    pub root_digest64: u64,
    pub wp010_evidence_digest64: u64,
    pub wp010_snapshot_digest64: u64,
    pub wp013_acceptance_digest64: u64,
    pub wp013_evidence_digest64: u64,
    pub member_evidence_digest64: u64,
    pub provenance_digest64: u64,
    pub derived_lineage_digest64: u64,
    pub event_order: [&'static str; 10],
    pub causal_references: Vec<String>,
    pub missing_evidence: Vec<String>,
    pub downstream_blocked: bool,
    pub hard_successors: [&'static str; 2],
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
pub struct Wp018Closure {
    pub work_package: &'static str,
    pub member_id: &'static str,
    pub acceptance_digest64: u64,
    pub evidence_digest64: u64,
    pub predecessor_wp010_digest64: u64,
    pub predecessor_wp013_digest64: u64,
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
    required(&input.run_id, "review.run_id", input)?;
    if input.provenance_digest64 == 0 {
        return Err(failure(
            input,
            Verdict::Blocked,
            WORK_ID,
            FailureReason::MissingField("review.provenance_digest64"),
            Vec::new(),
        ));
    }
    if input.derived_lineage_digest64 == 0 {
        return Err(failure(
            input,
            Verdict::Blocked,
            WORK_ID,
            FailureReason::MissingField("review.derived_lineage_digest64"),
            Vec::new(),
        ));
    }

    validate_root(input)?;
    validate_predecessors(input)?;
    validate_members(input)?;

    let member_evidence_digest64 = fnv1a64(format!("{:?}", input.members).as_bytes());
    let mut causal_references = Vec::with_capacity(REVIEWED_MEMBER_IDS.len());
    for work_id in REVIEWED_MEMBER_IDS {
        let member = input
            .members
            .iter()
            .find(|member| member.work_id == work_id)
            .expect("member completeness validated before acceptance construction");
        causal_references.push(member.causal_parent.clone());
    }

    Ok(AcceptanceRecord {
        work_id: WORK_ID,
        work_package: WORK_PACKAGE,
        operands: OPERANDS,
        verdict: Verdict::Pass,
        run_id: input.run_id.clone(),
        source_version: input.source_version,
        reviewer: input.reviewer.clone(),
        scheduler_owner: SCHEDULER_OWNER.to_owned(),
        root_work_id: input.root.work_id.clone(),
        root_version: input.root.version,
        root_owner: input.root.owner.clone(),
        root_causal_parent: input.root.causal_parent.clone(),
        root_digest64: input.root.evidence_digest64,
        wp010_evidence_digest64: input.wp010.evidence_digest64,
        wp010_snapshot_digest64: input.wp010.snapshot_digest64,
        wp013_acceptance_digest64: input.wp013.acceptance_digest64,
        wp013_evidence_digest64: input.wp013.evidence_digest64,
        member_evidence_digest64,
        provenance_digest64: input.provenance_digest64,
        derived_lineage_digest64: input.derived_lineage_digest64,
        event_order: REVIEWED_MEMBER_IDS,
        causal_references,
        missing_evidence: Vec::new(),
        downstream_blocked: false,
        hard_successors: HARD_SUCCESSORS,
        read_only: true,
    })
}

pub fn close_wp018(record: &AcceptanceRecord, evidence_digest64: u64) -> ReviewResult<Wp018Closure> {
    if record.work_id != WORK_ID
        || record.work_package != WORK_PACKAGE
        || record.verdict != Verdict::Pass
        || record.downstream_blocked
        || !record.read_only
        || record.event_order != REVIEWED_MEMBER_IDS
        || record.wp010_evidence_digest64 == 0
        || record.wp013_acceptance_digest64 == 0
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
            blocked_successors: HARD_SUCCESSORS,
            missing_evidence: vec![WORK_ID.to_owned()],
            causal_parent: record.root_causal_parent.clone(),
        }));
    }

    Ok(Wp018Closure {
        work_package: WORK_PACKAGE,
        member_id: WORK_ID,
        acceptance_digest64: record.digest64(),
        evidence_digest64,
        predecessor_wp010_digest64: record.wp010_evidence_digest64,
        predecessor_wp013_digest64: record.wp013_acceptance_digest64,
        closed: true,
    })
}

fn validate_root(input: &ReviewInput) -> ReviewResult<()> {
    if input.root.work_id != "S1.01.01" {
        return Err(failure(
            input,
            Verdict::Blocked,
            "WP-001",
            FailureReason::InvalidRoot("work_id"),
            Vec::new(),
        ));
    }
    if input.root.version != SCHEMA_VERSION {
        return Err(failure(
            input,
            Verdict::Blocked,
            "WP-001",
            FailureReason::InvalidRoot("version"),
            Vec::new(),
        ));
    }
    if input.root.owner.trim().is_empty()
        || input.root.causal_parent.trim().is_empty()
        || input.root.evidence_digest64 == 0
    {
        return Err(failure(
            input,
            Verdict::Blocked,
            "WP-001",
            FailureReason::InvalidRoot("owner_causal_or_evidence"),
            Vec::new(),
        ));
    }
    Ok(())
}

fn validate_predecessors(input: &ReviewInput) -> ReviewResult<()> {
    if input.wp010.work_package != "WP-010"
        || input.wp010.member_ids != REVIEWED_MEMBER_IDS
        || input.wp010.predecessor_digest64 == 0
        || input.wp010.evidence_digest64 == 0
        || input.wp010.snapshot_digest64 == 0
        || !input.wp010.closed
    {
        return Err(failure(
            input,
            Verdict::Blocked,
            "WP-010",
            FailureReason::InvalidPredecessor("WP-010"),
            Vec::new(),
        ));
    }

    if input.wp013.work_package != "WP-013"
        || input.wp013.member_id != "S1.02.10"
        || input.wp013.acceptance_digest64 == 0
        || input.wp013.evidence_digest64 == 0
        || !input.wp013.closed
    {
        return Err(failure(
            input,
            Verdict::Blocked,
            "WP-013",
            FailureReason::InvalidPredecessor("WP-013"),
            Vec::new(),
        ));
    }
    Ok(())
}

fn validate_members(input: &ReviewInput) -> ReviewResult<()> {
    let expected: BTreeSet<_> = REVIEWED_MEMBER_IDS.iter().copied().collect();
    let mut seen = BTreeSet::new();

    for member in &input.members {
        if !expected.contains(member.work_id.as_str()) {
            return Err(failure(
                input,
                Verdict::Blocked,
                &member.work_id,
                FailureReason::OutOfScopeEvidence(member.work_id.clone()),
                Vec::new(),
            ));
        }
        if !seen.insert(member.work_id.as_str()) {
            return Err(failure(
                input,
                Verdict::Blocked,
                &member.work_id,
                FailureReason::DuplicateMember(member.work_id.clone()),
                Vec::new(),
            ));
        }
        if member.run_id != input.run_id {
            return Err(failure(
                input,
                Verdict::Blocked,
                &member.work_id,
                FailureReason::RunMismatch(member.work_id.clone()),
                Vec::new(),
            ));
        }
        if member.source_version != input.source_version {
            return Err(failure(
                input,
                Verdict::Blocked,
                &member.work_id,
                FailureReason::SourceVersionMismatch(member.work_id.clone()),
                Vec::new(),
            ));
        }
        if member.owner != SCHEDULER_OWNER {
            return Err(failure(
                input,
                Verdict::Blocked,
                &member.work_id,
                FailureReason::WrongOwner(member.owner.clone()),
                Vec::new(),
            ));
        }
        if member.causal_parent.trim().is_empty()
            || member.evidence_digest64 == 0
            || member.source_wp010_evidence_digest64 == 0
            || member.source_wp010_snapshot_digest64 == 0
        {
            return Err(failure(
                input,
                Verdict::Blocked,
                &member.work_id,
                FailureReason::MissingEvidence(member.work_id.clone()),
                vec![member.work_id.clone()],
            ));
        }
        if member.source_wp010_evidence_digest64 != input.wp010.evidence_digest64
            || member.source_wp010_snapshot_digest64 != input.wp010.snapshot_digest64
        {
            return Err(failure(
                input,
                Verdict::Blocked,
                &member.work_id,
                FailureReason::ReferenceMismatch("WP-010 member evidence source"),
                Vec::new(),
            ));
        }
        match member.verdict {
            Verdict::Pass => {}
            Verdict::Fail => {
                return Err(failure(
                    input,
                    Verdict::Fail,
                    &member.work_id,
                    FailureReason::ExplicitFailure(member.work_id.clone()),
                    Vec::new(),
                ));
            }
            Verdict::Blocked => {
                return Err(failure(
                    input,
                    Verdict::Blocked,
                    &member.work_id,
                    FailureReason::MissingEvidence(member.work_id.clone()),
                    vec![member.work_id.clone()],
                ));
            }
        }
        if !member.behavior_pass || !member.contract_pass || !member.integration_pass {
            return Err(failure(
                input,
                Verdict::Fail,
                &member.work_id,
                FailureReason::ContractFailure(member.work_id.clone()),
                Vec::new(),
            ));
        }
    }

    let missing: Vec<String> = REVIEWED_MEMBER_IDS
        .iter()
        .filter(|work_id| !seen.contains(**work_id))
        .map(|work_id| (*work_id).to_owned())
        .collect();
    if let Some(first) = missing.first() {
        return Err(failure(
            input,
            Verdict::Blocked,
            first,
            FailureReason::MissingMember(first.clone()),
            missing,
        ));
    }
    Ok(())
}

fn required(value: &str, field: &'static str, input: &ReviewInput) -> ReviewResult<()> {
    if value.trim().is_empty() {
        Err(failure(
            input,
            Verdict::Blocked,
            WORK_ID,
            FailureReason::MissingField(field),
            Vec::new(),
        ))
    } else {
        Ok(())
    }
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
        blocked_successors: HARD_SUCCESSORS,
        missing_evidence,
        causal_parent: input.root.causal_parent.clone(),
    })
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
