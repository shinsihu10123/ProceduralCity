#![forbid(unsafe_code)]
//! Frozen WP-012 / S1.05.10 S1.05 Acceptance Review.
//!
//! This crate is a read-only validation boundary. It reviews already-produced
//! WP-001/WP-004 evidence and never owns or mutates canonical WorldTime.

use gaonn_world_core::ValidationReceipt;
use gaonn_world_time_core::{MEMBER_IDS as TIME_MEMBER_IDS, OWNER as TIME_OWNER, Wp004Acceptance};
use std::collections::BTreeSet;

pub const SCHEMA_VERSION: u32 = 1;
pub const WORK_ID: &str = "S1.05.10";
pub const WORK_PACKAGE: &str = "WP-012";
pub const REVIEWER: &str = "validation_qa.s1_05_acceptance_review";
pub const OPERANDS: [&str; 3] = ["Absolute", "WorldTime", "Epoch"];

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
pub struct ReviewInput {
    pub schema_version: u32,
    pub run_id: String,
    pub source_version: u32,
    pub reviewer: String,
    pub root: ValidationReceipt,
    pub wp004: Wp004Acceptance,
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
    InvalidPredecessor(&'static str),
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
    pub operands: [&'static str; 3],
    pub verdict: Verdict,
    pub run_id: String,
    pub source_version: u32,
    pub reviewer: String,
    pub canonical_owner: String,
    pub root_work_id: &'static str,
    pub root_version: u32,
    pub root_owner: String,
    pub root_causal_parent: String,
    pub root_digest64: u64,
    pub wp004_evidence_digest64: u64,
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
pub struct Wp012Closure {
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
    validate_predecessors(input)?;
    validate_members(input)?;

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
        canonical_owner: TIME_OWNER.to_owned(),
        root_work_id: input.root.work_id,
        root_version: input.root.contract_version,
        root_owner: input.root.owner.clone(),
        root_causal_parent: input.root.causal_parent.clone(),
        root_digest64: input.root.evidence_digest64(),
        wp004_evidence_digest64: input.wp004.evidence_digest64,
        member_evidence_digest64,
        provenance_digest64: input.provenance_digest64,
        event_order: TIME_MEMBER_IDS,
        causal_references,
        missing_evidence: Vec::new(),
        downstream_blocked: false,
        read_only: true,
    })
}

pub fn close_wp012(
    record: &AcceptanceRecord,
    evidence_digest64: u64,
) -> ReviewResult<Wp012Closure> {
    if record.work_id != WORK_ID
        || record.work_package != WORK_PACKAGE
        || record.verdict != Verdict::Pass
        || record.downstream_blocked
        || !record.read_only
        || evidence_digest64 == 0
    {
        let synthetic = ReviewInput {
            schema_version: record.source_version,
            run_id: record.run_id.clone(),
            source_version: record.source_version,
            reviewer: record.reviewer.clone(),
            root: ValidationReceipt {
                work_id: record.root_work_id,
                fact_key: "closure-review".to_owned(),
                contract_version: record.root_version,
                owner: record.root_owner.clone(),
                writer: record.root_owner.clone(),
                state_class: gaonn_world_core::StateClass::ObjectiveWorld,
                transition: "closure-review".to_owned(),
                causal_parent: record.root_causal_parent.clone(),
                operands: ["Canonical", "Authority", "Registry"],
            },
            wp004: Wp004Acceptance {
                work_package: "WP-004",
                member_ids: TIME_MEMBER_IDS,
                predecessor_digest64: record.root_digest64,
                evidence_digest64: record.wp004_evidence_digest64,
                closed: true,
            },
            members: Vec::new(),
            provenance_digest64: record.provenance_digest64,
        };
        return Err(failure(
            &synthetic,
            Verdict::Blocked,
            WORK_ID,
            FailureReason::MissingEvidence(WORK_ID.to_owned()),
            vec![WORK_ID.to_owned()],
        ));
    }
    Ok(Wp012Closure {
        work_package: WORK_PACKAGE,
        member_id: WORK_ID,
        acceptance_digest64: record.digest64(),
        evidence_digest64,
        closed: true,
    })
}

fn validate_predecessors(input: &ReviewInput) -> ReviewResult<()> {
    if input.root.work_id != "S1.01.01"
        || input.root.contract_version != 1
        || input.root.operands != ["Canonical", "Authority", "Registry"]
        || input.root.owner.trim().is_empty()
        || input.root.writer.trim().is_empty()
        || input.root.causal_parent.trim().is_empty()
    {
        return Err(failure(
            input,
            Verdict::Blocked,
            "WP-001",
            FailureReason::InvalidPredecessor("WP-001"),
            Vec::new(),
        ));
    }
    if input.wp004.work_package != "WP-004"
        || !input.wp004.closed
        || input.wp004.member_ids != TIME_MEMBER_IDS
        || input.wp004.evidence_digest64 == 0
    {
        return Err(failure(
            input,
            Verdict::Blocked,
            "WP-004",
            FailureReason::InvalidPredecessor("WP-004"),
            Vec::new(),
        ));
    }
    if input.wp004.predecessor_digest64 != input.root.evidence_digest64() {
        return Err(failure(
            input,
            Verdict::Blocked,
            "WP-004",
            FailureReason::ReferenceMismatch("WP-004.predecessor_digest64"),
            Vec::new(),
        ));
    }
    Ok(())
}

fn validate_members(input: &ReviewInput) -> ReviewResult<()> {
    let required: BTreeSet<&str> = TIME_MEMBER_IDS.into_iter().collect();
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

    let missing: Vec<String> = TIME_MEMBER_IDS
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
    if input.members.len() != TIME_MEMBER_IDS.len() {
        return Err(failure(
            input,
            Verdict::Blocked,
            WORK_ID,
            FailureReason::ContractFailure("member-count".to_owned()),
            Vec::new(),
        ));
    }

    for (index, member) in input.members.iter().enumerate() {
        let expected = TIME_MEMBER_IDS[index];
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
        if member.owner != TIME_OWNER {
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

fn fnv1a64(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf29ce484222325_u64, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
    })
}
