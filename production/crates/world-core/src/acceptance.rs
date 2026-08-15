//! Frozen L3 `S1.01.08 S1.01 Acceptance Review`.
//!
//! This module is a read-only acceptance gate for WP-001. It verifies that the same-run
//! S1.01.01..S1.01.07 implementation, Behavior/Contract tests, Evidence hashes, frozen source
//! version, root contract reference, and S1.01.07 audit evidence are complete and mutually
//! consistent before producing a closure record. It never mutates Canonical State.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

use crate::exclusion_audit::{NonCanonicalAuditEvidence, S1_01_07_AUDIT_SCHEMA_VERSION};
use crate::{S1_01_01_CONTRACT_VERSION, ValidationReceipt};

pub const S1_01_08_ACCEPTANCE_SCHEMA_VERSION: u32 = 1;
pub const S1_01_08_ACCEPTANCE_OWNER: &str = "world-core.validation.acceptance";
const OPERANDS: [&str; 3] = ["Canonical", "Authority", "Registry"];
const REQUIRED_MEMBERS: [&str; 7] = [
    "S1.01.01", "S1.01.02", "S1.01.03", "S1.01.04", "S1.01.05", "S1.01.06", "S1.01.07",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReviewOrigin {
    ValidationOwner,
    WrongOwner,
    Derived,
    Observer,
    Renderer,
    Analytics,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TestVerdict {
    Pass,
    Fail,
    Blocked,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AcceptanceVerdict {
    Pass,
    Fail,
    Blocked,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReviewIssueKind {
    MissingMember,
    DuplicateMember,
    OutOfScopeSubstitution,
    MissingImplementation,
    MissingBehaviorTest,
    MissingContractTest,
    MissingEvidenceHash,
    DifferentRun,
    SourceVersionMismatch,
    FailedTestPromoted,
    MemberFailed,
    MemberBlocked,
    MissingPredecessorAudit,
    InvalidPredecessorAudit,
    BaselineChangeRequested,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MemberL3Evidence {
    pub work_id: String,
    pub run_identity: String,
    pub source_version: u32,
    pub implementation_present: bool,
    pub behavior_verdict: TestVerdict,
    pub contract_verdict: TestVerdict,
    pub declared_pass: bool,
    pub evidence_hash: Option<String>,
    pub owner: String,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AcceptanceReviewRequest {
    pub schema_version: Option<u32>,
    pub run_identity: Option<String>,
    pub source_version: Option<u32>,
    pub source_hash: Option<String>,
    pub causal_parent: Option<String>,
    pub actor_owner: Option<String>,
    pub origin: Option<ReviewOrigin>,
    pub architecture_change: bool,
    pub wbs_scope_delta: bool,
    pub dependency_semantic_change: bool,
    pub frozen_week_change: bool,
}

impl AcceptanceReviewRequest {
    pub fn valid_fixture(run_identity: impl Into<String>) -> Self {
        Self {
            schema_version: Some(S1_01_08_ACCEPTANCE_SCHEMA_VERSION),
            run_identity: Some(run_identity.into()),
            source_version: Some(1),
            source_hash: Some("frozen-source-hash-s1.01.08".to_owned()),
            causal_parent: Some("S1.01.07:non-canonical-state-exclusion-audit".to_owned()),
            actor_owner: Some(S1_01_08_ACCEPTANCE_OWNER.to_owned()),
            origin: Some(ReviewOrigin::ValidationOwner),
            architecture_change: false,
            wbs_scope_delta: false,
            dependency_semantic_change: false,
            frozen_week_change: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewIssue {
    pub work_id: Option<String>,
    pub kind: ReviewIssueKind,
    pub detail: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MemberReviewResult {
    pub work_id: String,
    pub verdict: AcceptanceVerdict,
    pub evidence_hash: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AcceptanceRecord {
    pub work_id: &'static str,
    pub work_package: &'static str,
    pub schema_version: u32,
    pub verdict: AcceptanceVerdict,
    pub downstream_blocked: bool,
    pub run_identity: String,
    pub source_version: u32,
    pub source_hash: String,
    pub root_fact_key: String,
    pub root_contract_version: u32,
    pub root_owner: String,
    pub root_causal_parent: String,
    pub audit_evidence_digest: Option<u64>,
    pub pre_state_digest: u64,
    pub post_state_digest: u64,
    pub causal_parent: String,
    pub operands: [&'static str; 3],
    pub member_results: Vec<MemberReviewResult>,
    pub issues: Vec<ReviewIssue>,
    pub required_output: &'static str,
}

impl AcceptanceRecord {
    pub fn evidence_digest64(&self) -> u64 {
        let mut encoded = format!(
            "{}|{}|{}|{:?}|{}|{}|{}|{}|{}|{}|{}|{}|{:?}|{}|{}|{}|{:?}|{}\n",
            self.work_id,
            self.work_package,
            self.schema_version,
            self.verdict,
            self.downstream_blocked,
            self.run_identity,
            self.source_version,
            self.source_hash,
            self.root_fact_key,
            self.root_contract_version,
            self.root_owner,
            self.root_causal_parent,
            self.audit_evidence_digest,
            self.pre_state_digest,
            self.post_state_digest,
            self.causal_parent,
            self.operands,
            self.required_output
        );

        for result in &self.member_results {
            encoded.push_str(&format!(
                "M|{}|{:?}|{:?}\n",
                result.work_id, result.verdict, result.evidence_hash
            ));
        }

        for issue in &self.issues {
            encoded.push_str(&format!(
                "I|{:?}|{:?}|{}\n",
                issue.work_id, issue.kind, issue.detail
            ));
        }

        fnv1a64(encoded.as_bytes())
    }

    pub fn snapshot(&self) -> AcceptanceRecordSnapshot {
        AcceptanceRecordSnapshot {
            schema_version: self.schema_version,
            record: self.clone(),
        }
    }

    pub fn restore(snapshot: AcceptanceRecordSnapshot) -> Result<Self, AcceptanceReviewError> {
        if snapshot.schema_version != S1_01_08_ACCEPTANCE_SCHEMA_VERSION {
            return Err(AcceptanceReviewError::UnsupportedSchemaVersion {
                expected: S1_01_08_ACCEPTANCE_SCHEMA_VERSION,
                found: snapshot.schema_version,
            });
        }
        if snapshot.record.work_id != "S1.01.08" || snapshot.record.work_package != "WP-001" {
            return Err(AcceptanceReviewError::CorruptRecord(
                "wrong work identity".to_owned(),
            ));
        }
        if snapshot.record.operands != OPERANDS {
            return Err(AcceptanceReviewError::CorruptRecord(
                "frozen operands changed".to_owned(),
            ));
        }
        if snapshot.record.pre_state_digest != snapshot.record.post_state_digest {
            return Err(AcceptanceReviewError::CorruptRecord(
                "read-only acceptance review changed source state".to_owned(),
            ));
        }
        Ok(snapshot.record)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AcceptanceRecordSnapshot {
    pub schema_version: u32,
    pub record: AcceptanceRecord,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AcceptanceReviewError {
    MissingField(&'static str),
    EmptyField(&'static str),
    UnsupportedSchemaVersion { expected: u32, found: u32 },
    UnsupportedRootContractVersion { expected: u32, found: u32 },
    InvalidRootContract(&'static str),
    UnauthorizedReviewOrigin(ReviewOrigin),
    WrongReviewOwner { expected: String, found: String },
    CorruptRecord(String),
}

impl fmt::Display for AcceptanceReviewError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingField(field) => write!(f, "missing acceptance field: {field}"),
            Self::EmptyField(field) => write!(f, "empty acceptance field: {field}"),
            Self::UnsupportedSchemaVersion { expected, found } => write!(
                f,
                "unsupported acceptance schema version: expected={expected}, found={found}"
            ),
            Self::UnsupportedRootContractVersion { expected, found } => write!(
                f,
                "unsupported root contract version: expected={expected}, found={found}"
            ),
            Self::InvalidRootContract(field) => {
                write!(f, "invalid root contract field: {field}")
            }
            Self::UnauthorizedReviewOrigin(origin) => {
                write!(f, "unauthorized acceptance review origin: {origin:?}")
            }
            Self::WrongReviewOwner { expected, found } => {
                write!(
                    f,
                    "wrong acceptance review owner: expected={expected}, found={found}"
                )
            }
            Self::CorruptRecord(reason) => write!(f, "corrupt acceptance record: {reason}"),
        }
    }
}

impl std::error::Error for AcceptanceReviewError {}

#[derive(Debug, Clone, Copy, Default)]
pub struct S101AcceptanceReviewer;

impl S101AcceptanceReviewer {
    pub fn review(
        &self,
        request: &AcceptanceReviewRequest,
        root: &ValidationReceipt,
        predecessor_audit: Option<&NonCanonicalAuditEvidence>,
        members: &[MemberL3Evidence],
    ) -> Result<AcceptanceRecord, AcceptanceReviewError> {
        validate_request(request)?;
        validate_root(root)?;

        let run_identity = required_text(request.run_identity.as_deref(), "run_identity")?;
        let source_version = request
            .source_version
            .ok_or(AcceptanceReviewError::MissingField("source_version"))?;
        let source_hash = required_text(request.source_hash.as_deref(), "source_hash")?;
        let causal_parent = required_text(request.causal_parent.as_deref(), "causal_parent")?;

        let mut issues = Vec::new();
        if request.architecture_change {
            issues.push(baseline_change_issue("Architecture Change"));
        }
        if request.wbs_scope_delta {
            issues.push(baseline_change_issue("WBS Scope Delta"));
        }
        if request.dependency_semantic_change {
            issues.push(baseline_change_issue("Dependency Semantic Change"));
        }
        if request.frozen_week_change {
            issues.push(baseline_change_issue("Frozen Week Change"));
        }

        let (audit_digest, pre_state_digest, post_state_digest) = match predecessor_audit {
            Some(audit) => {
                validate_predecessor_audit(audit, root, run_identity, source_version, &mut issues);
                (
                    Some(audit.evidence_digest64()),
                    audit.pre_state_digest,
                    audit.post_state_digest,
                )
            }
            None => {
                issues.push(ReviewIssue {
                    work_id: Some("S1.01.07".to_owned()),
                    kind: ReviewIssueKind::MissingPredecessorAudit,
                    detail: "S1.01.07 acceptance input is missing".to_owned(),
                });
                (None, 0, 0)
            }
        };

        let required: BTreeSet<&str> = REQUIRED_MEMBERS.iter().copied().collect();
        let mut by_id: BTreeMap<&str, &MemberL3Evidence> = BTreeMap::new();
        let mut duplicates = BTreeSet::new();

        for member in members {
            if required.contains(member.work_id.as_str())
                && by_id.insert(member.work_id.as_str(), member).is_some()
            {
                duplicates.insert(member.work_id.clone());
            }
        }

        for duplicate in duplicates {
            issues.push(ReviewIssue {
                work_id: Some(duplicate),
                kind: ReviewIssueKind::DuplicateMember,
                detail: "same required Member L3 appears more than once".to_owned(),
            });
        }

        let mut member_results = Vec::with_capacity(REQUIRED_MEMBERS.len());
        for work_id in REQUIRED_MEMBERS {
            match by_id.get(work_id) {
                Some(member) => {
                    let verdict =
                        validate_member(member, run_identity, source_version, &mut issues);
                    member_results.push(MemberReviewResult {
                        work_id: work_id.to_owned(),
                        verdict,
                        evidence_hash: member.evidence_hash.clone(),
                    });
                }
                None => {
                    if members
                        .iter()
                        .any(|member| !required.contains(member.work_id.as_str()))
                    {
                        issues.push(ReviewIssue {
                            work_id: Some(work_id.to_owned()),
                            kind: ReviewIssueKind::OutOfScopeSubstitution,
                            detail:
                                "out-of-scope Work evidence cannot replace a required S1.01 member"
                                    .to_owned(),
                        });
                    } else {
                        issues.push(ReviewIssue {
                            work_id: Some(work_id.to_owned()),
                            kind: ReviewIssueKind::MissingMember,
                            detail: "required S1.01 Member L3 evidence is missing".to_owned(),
                        });
                    }
                    member_results.push(MemberReviewResult {
                        work_id: work_id.to_owned(),
                        verdict: AcceptanceVerdict::Blocked,
                        evidence_hash: None,
                    });
                }
            }
        }

        let verdict = overall_verdict(&issues);
        Ok(AcceptanceRecord {
            work_id: "S1.01.08",
            work_package: "WP-001",
            schema_version: S1_01_08_ACCEPTANCE_SCHEMA_VERSION,
            verdict,
            downstream_blocked: verdict != AcceptanceVerdict::Pass,
            run_identity: run_identity.to_owned(),
            source_version,
            source_hash: source_hash.to_owned(),
            root_fact_key: root.fact_key.clone(),
            root_contract_version: root.contract_version,
            root_owner: root.owner.clone(),
            root_causal_parent: root.causal_parent.clone(),
            audit_evidence_digest: audit_digest,
            pre_state_digest,
            post_state_digest,
            causal_parent: causal_parent.to_owned(),
            operands: OPERANDS,
            member_results,
            issues,
            required_output: "Implemented + validated L3 set S1.01.01…S1.01.08; evidence and acceptance record.",
        })
    }
}

fn validate_request(request: &AcceptanceReviewRequest) -> Result<(), AcceptanceReviewError> {
    let schema_version = request
        .schema_version
        .ok_or(AcceptanceReviewError::MissingField("schema_version"))?;
    if schema_version != S1_01_08_ACCEPTANCE_SCHEMA_VERSION {
        return Err(AcceptanceReviewError::UnsupportedSchemaVersion {
            expected: S1_01_08_ACCEPTANCE_SCHEMA_VERSION,
            found: schema_version,
        });
    }

    let actor_owner = required_text(request.actor_owner.as_deref(), "actor_owner")?;
    if actor_owner != S1_01_08_ACCEPTANCE_OWNER {
        return Err(AcceptanceReviewError::WrongReviewOwner {
            expected: S1_01_08_ACCEPTANCE_OWNER.to_owned(),
            found: actor_owner.to_owned(),
        });
    }

    let origin = request
        .origin
        .ok_or(AcceptanceReviewError::MissingField("origin"))?;
    if origin != ReviewOrigin::ValidationOwner {
        return Err(AcceptanceReviewError::UnauthorizedReviewOrigin(origin));
    }

    required_text(request.run_identity.as_deref(), "run_identity")?;
    required_text(request.source_hash.as_deref(), "source_hash")?;
    required_text(request.causal_parent.as_deref(), "causal_parent")?;
    request
        .source_version
        .ok_or(AcceptanceReviewError::MissingField("source_version"))?;
    Ok(())
}

fn validate_root(root: &ValidationReceipt) -> Result<(), AcceptanceReviewError> {
    if root.contract_version != S1_01_01_CONTRACT_VERSION {
        return Err(AcceptanceReviewError::UnsupportedRootContractVersion {
            expected: S1_01_01_CONTRACT_VERSION,
            found: root.contract_version,
        });
    }

    if root.fact_key.trim().is_empty() {
        return Err(AcceptanceReviewError::InvalidRootContract("fact_key"));
    }
    if root.owner.trim().is_empty() {
        return Err(AcceptanceReviewError::InvalidRootContract("owner"));
    }
    if root.causal_parent.trim().is_empty() {
        return Err(AcceptanceReviewError::InvalidRootContract("causal_parent"));
    }
    Ok(())
}

fn validate_predecessor_audit(
    audit: &NonCanonicalAuditEvidence,
    root: &ValidationReceipt,
    run_identity: &str,
    _source_version: u32,
    issues: &mut Vec<ReviewIssue>,
) {
    let valid = audit.work_id == "S1.01.07"
        && audit.schema_version == S1_01_07_AUDIT_SCHEMA_VERSION
        && audit.root_fact_key == root.fact_key
        && audit.root_contract_version == root.contract_version
        && audit.root_owner == root.owner
        && audit.root_causal_parent == root.causal_parent
        && audit.run_identity == run_identity
        && audit.pre_state_digest == audit.post_state_digest;

    if !valid {
        issues.push(ReviewIssue {
            work_id: Some("S1.01.07".to_owned()),
            kind: ReviewIssueKind::InvalidPredecessorAudit,
            detail: "S1.01.07 output ID/version/root/run/digest does not match the acceptance run"
                .to_owned(),
        });
    }
}

fn validate_member(
    member: &MemberL3Evidence,
    run_identity: &str,
    source_version: u32,
    issues: &mut Vec<ReviewIssue>,
) -> AcceptanceVerdict {
    let mut verdict = AcceptanceVerdict::Pass;

    if member.run_identity != run_identity {
        issues.push(member_issue(
            member,
            ReviewIssueKind::DifferentRun,
            "member evidence belongs to a different run",
        ));
        verdict = AcceptanceVerdict::Blocked;
    }

    if member.source_version != source_version {
        issues.push(member_issue(
            member,
            ReviewIssueKind::SourceVersionMismatch,
            "member evidence uses a different frozen source version",
        ));
        verdict = AcceptanceVerdict::Blocked;
    }

    if !member.implementation_present {
        issues.push(member_issue(
            member,
            ReviewIssueKind::MissingImplementation,
            "implementation evidence is missing",
        ));
        verdict = AcceptanceVerdict::Blocked;
    }

    if member
        .evidence_hash
        .as_deref()
        .is_none_or(|hash| hash.trim().is_empty())
    {
        issues.push(member_issue(
            member,
            ReviewIssueKind::MissingEvidenceHash,
            "member Evidence hash is missing",
        ));
        verdict = AcceptanceVerdict::Blocked;
    }

    if member.owner.trim().is_empty() || member.causal_parent.trim().is_empty() {
        issues.push(member_issue(
            member,
            ReviewIssueKind::MissingEvidenceHash,
            "member owner or causal reference is missing",
        ));
        verdict = AcceptanceVerdict::Blocked;
    }

    verdict = merge_test_verdict(
        member,
        member.behavior_verdict,
        ReviewIssueKind::MissingBehaviorTest,
        "Behavior test",
        verdict,
        issues,
    );
    verdict = merge_test_verdict(
        member,
        member.contract_verdict,
        ReviewIssueKind::MissingContractTest,
        "Contract/Integration test",
        verdict,
        issues,
    );

    if member.declared_pass
        && (member.behavior_verdict != TestVerdict::Pass
            || member.contract_verdict != TestVerdict::Pass)
    {
        issues.push(member_issue(
            member,
            ReviewIssueKind::FailedTestPromoted,
            "failed or blocked test was declared PASS",
        ));
        verdict = AcceptanceVerdict::Fail;
    }

    if !member.declared_pass && verdict == AcceptanceVerdict::Pass {
        issues.push(member_issue(
            member,
            ReviewIssueKind::MemberBlocked,
            "member has complete tests but no PASS declaration",
        ));
        verdict = AcceptanceVerdict::Blocked;
    }

    verdict
}

fn merge_test_verdict(
    member: &MemberL3Evidence,
    test_verdict: TestVerdict,
    blocked_kind: ReviewIssueKind,
    label: &str,
    current: AcceptanceVerdict,
    issues: &mut Vec<ReviewIssue>,
) -> AcceptanceVerdict {
    match test_verdict {
        TestVerdict::Pass => current,
        TestVerdict::Fail => {
            issues.push(member_issue(
                member,
                ReviewIssueKind::MemberFailed,
                &format!("{label} failed"),
            ));
            AcceptanceVerdict::Fail
        }
        TestVerdict::Blocked => {
            issues.push(member_issue(
                member,
                blocked_kind,
                &format!("{label} is not validated"),
            ));
            if current == AcceptanceVerdict::Fail {
                current
            } else {
                AcceptanceVerdict::Blocked
            }
        }
    }
}

fn member_issue(member: &MemberL3Evidence, kind: ReviewIssueKind, detail: &str) -> ReviewIssue {
    ReviewIssue {
        work_id: Some(member.work_id.clone()),
        kind,
        detail: detail.to_owned(),
    }
}

fn baseline_change_issue(detail: &str) -> ReviewIssue {
    ReviewIssue {
        work_id: Some("WP-001".to_owned()),
        kind: ReviewIssueKind::BaselineChangeRequested,
        detail: detail.to_owned(),
    }
}

fn overall_verdict(issues: &[ReviewIssue]) -> AcceptanceVerdict {
    if issues.iter().any(|issue| {
        matches!(
            issue.kind,
            ReviewIssueKind::FailedTestPromoted | ReviewIssueKind::MemberFailed
        )
    }) {
        AcceptanceVerdict::Fail
    } else if issues.is_empty() {
        AcceptanceVerdict::Pass
    } else {
        AcceptanceVerdict::Blocked
    }
}

fn required_text<'a>(
    value: Option<&'a str>,
    field: &'static str,
) -> Result<&'a str, AcceptanceReviewError> {
    let value = value.ok_or(AcceptanceReviewError::MissingField(field))?;
    if value.trim().is_empty() {
        return Err(AcceptanceReviewError::EmptyField(field));
    }
    Ok(value)
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
