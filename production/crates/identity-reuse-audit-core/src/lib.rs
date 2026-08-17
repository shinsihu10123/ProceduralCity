//! Frozen L3 S1.02.09 Identity Reuse Prohibition Audit.
use gaonn_identity_continuity_core::ContinuityEvidence;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IssuanceKind {
    Continuation,
    NewIssuance,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IdentityIssuanceAttempt {
    pub work_id: String,
    pub stable_id: String,
    pub namespace: String,
    pub namespace_version: String,
    pub entity_version: u32,
    pub lifecycle_lineage: String,
    pub kind: IssuanceKind,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReuseViolation {
    pub work_id: String,
    pub first_failure: &'static str,
    pub stable_id: String,
    pub pre_digest: u64,
    pub post_digest: u64,
    pub reproduction: String,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuditEvidence {
    pub work_id: &'static str,
    pub checked: usize,
    pub violations: Vec<ReuseViolation>,
    pub canonical_mutation: bool,
    pub predecessor_digest: u64,
}

pub fn audit(pre: &ContinuityEvidence, attempts: &[IdentityIssuanceAttempt]) -> AuditEvidence {
    let pre_digest = pre.digest64();
    let mut violations = Vec::new();
    for attempt in attempts {
        if attempt.stable_id != pre.stable_id {
            continue;
        }
        let exact_lineage = attempt.namespace == pre.namespace
            && attempt.namespace_version == pre.namespace_version
            && attempt.entity_version == pre.entity_version
            && attempt.lifecycle_lineage == pre.lifecycle_lineage;
        let forbidden = attempt.kind == IssuanceKind::NewIssuance || !exact_lineage;
        if forbidden {
            violations.push(ReuseViolation {
                work_id: attempt.work_id.clone(),
                first_failure: "stable-id-reuse",
                stable_id: attempt.stable_id.clone(),
                pre_digest,
                post_digest: pre.digest64(),
                reproduction: format!(
                    "issue {} as {:?} after S1.02.08 continuity",
                    attempt.stable_id, attempt.kind
                ),
            });
        }
    }
    AuditEvidence {
        work_id: "S1.02.09",
        checked: attempts.len(),
        violations,
        canonical_mutation: false,
        predecessor_digest: pre_digest,
    }
}

impl AuditEvidence {
    pub fn pass(&self) -> bool {
        self.violations.is_empty() && !self.canonical_mutation
    }
}
