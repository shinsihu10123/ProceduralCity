use gaonn_identity_continuity_core::ContinuityEvidence;
use gaonn_identity_core::IdentityDisposition;
use gaonn_identity_reuse_audit_core::*;

fn continuity() -> ContinuityEvidence {
    ContinuityEvidence {
        work_id: "S1.02.08",
        stable_id: "entity:7".into(),
        namespace: "entity".into(),
        namespace_version: "v1".into(),
        entity_version: 3,
        lifecycle_lineage: "lineage:7".into(),
        snapshot_id: "snap".into(),
        reload_id: "reload".into(),
        committed_causal_cut: "cut".into(),
        partition_state: "p".into(),
        scheduler_state: "s".into(),
        pending_state: "q".into(),
        causal_parent: "S1.02.07:PASS".into(),
        predecessor_digest: 9,
        disposition: IdentityDisposition::CandidateOnly,
    }
}
fn attempt(kind: IssuanceKind) -> IdentityIssuanceAttempt {
    IdentityIssuanceAttempt {
        work_id: "fixture".into(),
        stable_id: "entity:7".into(),
        namespace: "entity".into(),
        namespace_version: "v1".into(),
        entity_version: 3,
        lifecycle_lineage: "lineage:7".into(),
        kind,
    }
}
#[test]
fn exact_continuation_is_not_reuse() {
    let e = audit(&continuity(), &[attempt(IssuanceKind::Continuation)]);
    assert!(e.pass());
}
#[test]
fn new_issuance_of_existing_id_is_detected() {
    let e = audit(&continuity(), &[attempt(IssuanceKind::NewIssuance)]);
    assert_eq!(e.violations.len(), 1);
    assert_eq!(e.violations[0].first_failure, "stable-id-reuse");
}
#[test]
fn changed_lineage_under_same_id_is_detected() {
    let mut a = attempt(IssuanceKind::Continuation);
    a.lifecycle_lineage = "new-lineage".into();
    assert_eq!(audit(&continuity(), &[a]).violations.len(), 1);
}
#[test]
fn unrelated_stable_id_is_outside_reuse_case() {
    let mut a = attempt(IssuanceKind::NewIssuance);
    a.stable_id = "entity:8".into();
    assert!(audit(&continuity(), &[a]).pass());
}
#[test]
fn audit_is_read_only_and_digest_stable() {
    let c = continuity();
    let before = c.digest64();
    let e = audit(&c, &[attempt(IssuanceKind::NewIssuance)]);
    assert!(!e.canonical_mutation);
    assert_eq!(before, c.digest64());
    assert_eq!(e.violations[0].pre_digest, e.violations[0].post_digest);
}
