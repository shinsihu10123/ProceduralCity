use gaonn_identity_acceptance_core::*;
use gaonn_identity_continuity_core::ContinuityEvidence;
use gaonn_identity_core::{IdentityDisposition, S1_02_01_OWNER};
use gaonn_identity_reuse_audit_core::{audit, IdentityIssuanceAttempt, IssuanceKind};
use gaonn_world_core::{StateClass, ValidationReceipt};

fn root() -> ValidationReceipt {
    ValidationReceipt {
        work_id: "S1.01.01",
        fact_key: "canonical:entity-identity".to_owned(),
        contract_version: 1,
        owner: "world-core.canonical-state-registry".to_owned(),
        writer: "world-core.canonical-state-registry".to_owned(),
        state_class: StateClass::ObjectiveWorld,
        transition: "validate-root".to_owned(),
        causal_parent: "frozen:what-how-root".to_owned(),
        operands: ["Canonical", "Authority", "Registry"],
    }
}

fn continuity() -> ContinuityEvidence {
    ContinuityEvidence {
        work_id: "S1.02.08",
        stable_id: "entity:human:00000001".to_owned(),
        namespace: "entity".to_owned(),
        namespace_version: "identity-namespace-v1".to_owned(),
        entity_version: 7,
        lifecycle_lineage: "lineage:0001".to_owned(),
        snapshot_id: "snapshot:identity:0001".to_owned(),
        reload_id: "reload:identity:0001".to_owned(),
        committed_causal_cut: "cut:00042".to_owned(),
        partition_state: "partition:7".to_owned(),
        scheduler_state: "scheduler:stable".to_owned(),
        pending_state: "pending:none".to_owned(),
        causal_parent: "S1.02.07:evidence".to_owned(),
        predecessor_digest: 0x0207,
        disposition: IdentityDisposition::CandidateOnly,
    }
}

fn source() -> IdentitySourceSnapshot {
    let continuity = continuity();
    let attempt = IdentityIssuanceAttempt {
        work_id: "S1.02.09:fixture".to_owned(),
        stable_id: continuity.stable_id.clone(),
        namespace: continuity.namespace.clone(),
        namespace_version: continuity.namespace_version.clone(),
        entity_version: continuity.entity_version,
        lifecycle_lineage: continuity.lifecycle_lineage.clone(),
        kind: IssuanceKind::Continuation,
    };
    let reuse_audit = audit(&continuity, &[attempt]);
    IdentitySourceSnapshot {
        owner: S1_02_01_OWNER.to_owned(),
        continuity,
        reuse_audit,
    }
}

fn input() -> ReviewInput {
    let root = root();
    let root_digest64 = root.evidence_digest64();
    let source = source();
    let continuity_digest = source.continuity.digest64();
    let reuse_audit_digest = audit_digest64(&source.reuse_audit);
    let members = MEMBER_IDS
        .iter()
        .enumerate()
        .map(|(index, work_id)| MemberEvidence {
            work_id: (*work_id).to_owned(),
            run_id: "run:wp002-final".to_owned(),
            source_version: 1,
            owner: S1_02_01_OWNER.to_owned(),
            causal_parent: format!("{work_id}:evidence"),
            evidence_digest64: 100 + index as u64,
            source_state_digest64: match index {
                7 => continuity_digest,
                8 => reuse_audit_digest,
                _ => 200 + index as u64,
            },
            root_digest64,
            verdict: Verdict::Pass,
            behavior_pass: true,
            contract_pass: true,
            integration_pass: true,
        })
        .collect();

    ReviewInput {
        schema_version: 1,
        run_id: "run:wp002-final".to_owned(),
        source_version: 1,
        reviewer: REVIEWER.to_owned(),
        root,
        wp001: PredecessorClosureEvidence {
            work_package: "WP-001".to_owned(),
            source_version: 1,
            closed: true,
            evidence_digest64: 0x0108,
            root_digest64,
        },
        wp002: Wp002ClosureEvidence {
            work_package: "WP-002".to_owned(),
            source_version: 1,
            closed: true,
            member_ids: MEMBER_IDS,
            evidence_digest64: 0x0209,
            root_digest64,
        },
        source,
        members,
        provenance_digest64: 0x1202,
    }
}

#[test]
fn normal_review_preserves_stable_entity_id_namespace_and_causal_refs() {
    let input = input();
    let pre = input.digest64();
    let record = review(&input, ReviewOrigin::ValidationQa).unwrap();
    assert_eq!(record.work_id, "S1.02.10");
    assert_eq!(record.work_package, "WP-013");
    assert_eq!(record.operands, ["Stable", "Entity", "ID", "체계", "Namespace"]);
    assert_eq!(record.verdict, Verdict::Pass);
    assert_eq!(record.event_order, MEMBER_IDS);
    assert_eq!(record.canonical_owner, S1_02_01_OWNER);
    assert_eq!(record.stable_id, input.source.continuity.stable_id);
    assert_eq!(record.namespace, input.source.continuity.namespace);
    assert_eq!(record.causal_references.len(), 9);
    assert!(record.read_only);
    assert!(!record.downstream_blocked);
    assert_eq!(pre, input.digest64());
}

#[test]
fn hard_predecessor_wp001_mismatch_blocks_without_partial_result() {
    let mut input = input();
    input.wp001.closed = false;
    let error = review(&input, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.verdict, Verdict::Blocked);
    assert_eq!(error.failed_work_id, "WP-001");
    assert_eq!(error.pre_state_digest64, error.post_state_digest64);
    assert!(error.downstream_blocked);
}

#[test]
fn hard_predecessor_wp002_requires_exact_nine_member_closure_and_root_reference() {
    let mut input = input();
    input.wp002.root_digest64 ^= 1;
    let error = review(&input, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.verdict, Verdict::Blocked);
    assert_eq!(error.failed_work_id, "WP-002");

    let mut input = input();
    input.wp002.member_ids[8] = "S1.99.99";
    let error = review(&input, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.failed_work_id, "WP-002");
}

#[test]
fn missing_member_is_blocked_and_out_of_scope_pass_cannot_substitute() {
    let mut missing = input();
    missing.members.remove(4);
    let error = review(&missing, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.verdict, Verdict::Blocked);
    assert_eq!(error.failed_work_id, "S1.02.05");
    assert_eq!(error.missing_evidence, vec!["S1.02.05"]);
    assert_eq!(error.pre_state_digest64, error.post_state_digest64);

    let mut substitute = input();
    substitute.members[4].work_id = "S1.99.99".to_owned();
    let error = review(&substitute, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.verdict, Verdict::Blocked);
    assert!(matches!(error.reason, FailureReason::OutOfScopeEvidence(_)));
}

#[test]
fn explicit_member_failure_propagates_fail_and_blocks_downstream() {
    let mut input = input();
    input.members[2].verdict = Verdict::Fail;
    let error = review(&input, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.verdict, Verdict::Fail);
    assert_eq!(error.failed_work_id, "S1.02.03");
    assert!(error.downstream_blocked);
    assert_eq!(error.pre_state_digest64, error.post_state_digest64);
}

#[test]
fn same_run_and_source_version_are_mandatory() {
    let mut run_mismatch = input();
    run_mismatch.members[5].run_id = "run:other".to_owned();
    let error = review(&run_mismatch, ReviewOrigin::ValidationQa).unwrap_err();
    assert!(matches!(error.reason, FailureReason::RunMismatch(_)));

    let mut version_mismatch = input();
    version_mismatch.members[6].source_version = 2;
    let error = review(&version_mismatch, ReviewOrigin::ValidationQa).unwrap_err();
    assert!(matches!(
        error.reason,
        FailureReason::SourceVersionMismatch(_)
    ));
}

#[test]
fn wrong_owner_and_missing_evidence_fail_closed() {
    let mut wrong_owner = input();
    wrong_owner.members[1].owner = "observer".to_owned();
    let error = review(&wrong_owner, ReviewOrigin::ValidationQa).unwrap_err();
    assert!(matches!(error.reason, FailureReason::WrongOwner(_)));

    let mut missing = input();
    missing.members[7].evidence_digest64 = 0;
    let error = review(&missing, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.verdict, Verdict::Blocked);
    assert_eq!(error.missing_evidence, vec!["S1.02.08"]);
}

#[test]
fn derived_observer_renderer_and_analytics_cannot_issue_acceptance() {
    for origin in [
        ReviewOrigin::Derived,
        ReviewOrigin::Observer,
        ReviewOrigin::Renderer,
        ReviewOrigin::Analytics,
    ] {
        let input = input();
        let pre = input.digest64();
        let error = review(&input, origin).unwrap_err();
        assert_eq!(error.verdict, Verdict::Blocked);
        assert_eq!(error.pre_state_digest64, pre);
        assert_eq!(error.post_state_digest64, pre);
    }
}

#[test]
fn identity_reuse_violation_is_valid_failure_evidence_not_a_pass() {
    let mut input = input();
    let continuity = input.source.continuity.clone();
    let attempt = IdentityIssuanceAttempt {
        work_id: "S1.02.09:reuse".to_owned(),
        stable_id: continuity.stable_id.clone(),
        namespace: continuity.namespace.clone(),
        namespace_version: continuity.namespace_version.clone(),
        entity_version: continuity.entity_version,
        lifecycle_lineage: continuity.lifecycle_lineage.clone(),
        kind: IssuanceKind::NewIssuance,
    };
    input.source.reuse_audit = audit(&continuity, &[attempt]);
    let pre = input.digest64();
    let error = review(&input, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.verdict, Verdict::Fail);
    assert_eq!(error.failed_work_id, "S1.02.09");
    assert_eq!(error.pre_state_digest64, pre);
    assert_eq!(error.post_state_digest64, pre);
}

#[test]
fn continuity_and_reuse_audit_must_share_exact_predecessor_digest() {
    let mut input = input();
    input.source.reuse_audit.predecessor_digest ^= 1;
    let error = review(&input, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.verdict, Verdict::Blocked);
    assert_eq!(error.failed_work_id, "S1.02.09");
    assert!(matches!(error.reason, FailureReason::InvalidSource(_)));
}

#[test]
fn source_state_digests_for_s1_02_08_and_s1_02_09_are_not_replaceable() {
    let mut input = input();
    input.members[7].source_state_digest64 ^= 1;
    let error = review(&input, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.failed_work_id, "S1.02.08");
    assert!(matches!(error.reason, FailureReason::ReferenceMismatch(_)));

    let mut input = input();
    input.members[8].source_state_digest64 ^= 1;
    let error = review(&input, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.failed_work_id, "S1.02.09");
}

#[test]
fn missing_identity_source_field_blocks_before_acceptance() {
    let mut input = input();
    input.source.continuity.stable_id.clear();
    let error = review(&input, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.verdict, Verdict::Blocked);
    assert_eq!(error.failed_work_id, "S1.02.08");
    assert!(matches!(error.reason, FailureReason::MissingField("stable_id")));
}

#[test]
fn evidence_snapshot_restore_and_replay_are_deterministic() {
    let input = input();
    let snapshot = ReviewSnapshot::new(input.clone());
    let restored = snapshot.restore().unwrap();
    assert_eq!(restored, input);
    assert_eq!(snapshot.evidence_hash64, input.digest64());
    let first = snapshot.replay(ReviewOrigin::ValidationQa).unwrap();
    let second = snapshot.replay(ReviewOrigin::ValidationQa).unwrap();
    assert_eq!(first, second);
    assert_eq!(first.digest64(), second.digest64());
    assert_eq!(first.event_order, MEMBER_IDS);
    assert_eq!(snapshot.digest64(), ReviewSnapshot::new(input).digest64());
}

#[test]
fn corrupted_review_snapshot_is_blocked_before_replay() {
    let mut snapshot = ReviewSnapshot::new(input());
    snapshot.evidence_hash64 ^= 1;
    let error = snapshot.replay(ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.verdict, Verdict::Blocked);
    assert!(matches!(error.reason, FailureReason::ReferenceMismatch(_)));
}

#[test]
fn wp013_closure_requires_the_single_s1_02_10_pass_and_evidence() {
    let record = review(&input(), ReviewOrigin::ValidationQa).unwrap();
    let closure = close_wp013(&record, 0xabcdef).unwrap();
    assert!(closure.closed);
    assert_eq!(closure.work_package, "WP-013");
    assert_eq!(closure.member_id, "S1.02.10");
    assert_ne!(closure.acceptance_digest64, 0);

    let error = close_wp013(&record, 0).unwrap_err();
    assert_eq!(error.verdict, Verdict::Blocked);
    assert!(error.downstream_blocked);
}

#[test]
fn member_order_is_part_of_the_review_contract_and_replay_event_order() {
    let mut input = input();
    input.members.swap(0, 1);
    let error = review(&input, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.verdict, Verdict::Blocked);
    assert!(matches!(error.reason, FailureReason::ContractFailure(_)));
}
