use gaonn_world_core::{CanonicalCandidate, CanonicalStateContract};
use gaonn_world_time_acceptance_core::*;
use gaonn_world_time_core::{MEMBER_IDS as TIME_MEMBER_IDS, OWNER as TIME_OWNER, accept_wp004};

fn root() -> gaonn_world_core::ValidationReceipt {
    CanonicalStateContract
        .validate(&CanonicalCandidate::valid_fixture())
        .unwrap()
}

fn input() -> ReviewInput {
    let root = root();
    let wp004 = accept_wp004(&root, &[true; 9], &[11, 12, 13, 14, 15, 16, 17, 18, 19]).unwrap();
    let root_digest64 = root.evidence_digest64();
    let members = TIME_MEMBER_IDS
        .iter()
        .enumerate()
        .map(|(index, work_id)| MemberEvidence {
            work_id: (*work_id).to_owned(),
            run_id: "run:wp004-final".to_owned(),
            source_version: 1,
            owner: TIME_OWNER.to_owned(),
            causal_parent: format!("{work_id}:evidence"),
            evidence_digest64: 100 + index as u64,
            source_state_digest64: 200 + index as u64,
            root_digest64,
            verdict: Verdict::Pass,
            behavior_pass: true,
            contract_pass: true,
            integration_pass: true,
        })
        .collect();
    ReviewInput {
        schema_version: 1,
        run_id: "run:wp004-final".to_owned(),
        source_version: 1,
        reviewer: REVIEWER.to_owned(),
        root,
        wp004,
        members,
        provenance_digest64: 0x1205,
    }
}

#[test]
fn admission_and_normal_review_preserve_absolute_worldtime_epoch_and_causal_refs() {
    let input = input();
    let pre = input.digest64();
    let record = review(&input, ReviewOrigin::ValidationQa).unwrap();
    assert_eq!(record.work_id, "S1.05.10");
    assert_eq!(record.operands, ["Absolute", "WorldTime", "Epoch"]);
    assert_eq!(record.verdict, Verdict::Pass);
    assert_eq!(record.event_order, TIME_MEMBER_IDS);
    assert_eq!(record.canonical_owner, TIME_OWNER);
    assert_eq!(record.root_digest64, input.root.evidence_digest64());
    assert_eq!(record.wp004_evidence_digest64, input.wp004.evidence_digest64);
    assert_eq!(record.causal_references.len(), 9);
    assert!(record.read_only);
    assert!(!record.downstream_blocked);
    assert_eq!(pre, input.digest64());
}

#[test]
fn hard_predecessor_wp001_mismatch_blocks_without_partial_result() {
    let mut input = input();
    input.root.causal_parent.clear();
    let error = review(&input, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.verdict, Verdict::Blocked);
    assert_eq!(error.failed_work_id, "WP-001");
    assert_eq!(error.pre_state_digest64, error.post_state_digest64);
    assert!(error.downstream_blocked);
}

#[test]
fn hard_predecessor_wp004_reference_mismatch_blocks() {
    let mut input = input();
    input.wp004.predecessor_digest64 ^= 1;
    let error = review(&input, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.verdict, Verdict::Blocked);
    assert_eq!(error.failed_work_id, "WP-004");
    assert!(matches!(error.reason, FailureReason::ReferenceMismatch(_)));
}

#[test]
fn missing_member_is_blocked_and_out_of_scope_pass_cannot_substitute() {
    let mut missing = input();
    missing.members.remove(4);
    let error = review(&missing, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.verdict, Verdict::Blocked);
    assert_eq!(error.failed_work_id, "S1.05.05");
    assert_eq!(error.missing_evidence, vec!["S1.05.05"]);
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
    assert_eq!(error.failed_work_id, "S1.05.03");
    assert!(error.downstream_blocked);
    assert_eq!(error.pre_state_digest64, error.post_state_digest64);
}

#[test]
fn same_run_and_source_version_are_mandatory() {
    let mut run_mismatch = input();
    run_mismatch.members[5].run_id = "run:other".to_owned();
    let error = review(&run_mismatch, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(error.verdict, Verdict::Blocked);
    assert!(matches!(error.reason, FailureReason::RunMismatch(_)));

    let mut version_mismatch = input();
    version_mismatch.members[6].source_version = 2;
    let error = review(&version_mismatch, ReviewOrigin::ValidationQa).unwrap_err();
    assert!(matches!(error.reason, FailureReason::SourceVersionMismatch(_)));
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
    assert_eq!(error.missing_evidence, vec!["S1.05.08"]);
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
fn behavior_contract_or_integration_failure_is_fail_not_pass() {
    for index in 0..3 {
        let mut input = input();
        match index {
            0 => input.members[8].behavior_pass = false,
            1 => input.members[8].contract_pass = false,
            _ => input.members[8].integration_pass = false,
        }
        let error = review(&input, ReviewOrigin::ValidationQa).unwrap_err();
        assert_eq!(error.verdict, Verdict::Fail);
        assert_eq!(error.failed_work_id, "S1.05.09");
    }
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
    assert_eq!(first.event_order, TIME_MEMBER_IDS);
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
fn wp012_closure_requires_the_single_s1_05_10_pass_and_evidence() {
    let record = review(&input(), ReviewOrigin::ValidationQa).unwrap();
    let closure = close_wp012(&record, 0xabcdef).unwrap();
    assert!(closure.closed);
    assert_eq!(closure.work_package, "WP-012");
    assert_eq!(closure.member_id, "S1.05.10");
    assert_ne!(closure.acceptance_digest64, 0);

    let error = close_wp012(&record, 0).unwrap_err();
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
