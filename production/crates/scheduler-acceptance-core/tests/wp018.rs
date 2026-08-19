use gaonn_identity_acceptance_core::Wp013Closure;
use gaonn_scheduler_acceptance_core::*;
use gaonn_scheduler_core::{
    MEMBER_IDS as SCHEDULER_MEMBER_IDS, OWNER as SCHEDULER_OWNER, Wp010Acceptance,
};

fn wp010() -> Wp010Acceptance {
    Wp010Acceptance {
        work_package: "WP-010",
        member_ids: SCHEDULER_MEMBER_IDS,
        predecessor_digest64: 101,
        evidence_digest64: 102,
        snapshot_digest64: 103,
        closed: true,
    }
}

fn wp013() -> Wp013Closure {
    Wp013Closure {
        work_package: "WP-013",
        member_id: "S1.02.10",
        acceptance_digest64: 201,
        evidence_digest64: 202,
        closed: true,
    }
}

fn members() -> Vec<MemberEvidence> {
    REVIEWED_MEMBER_IDS
        .iter()
        .enumerate()
        .map(|(index, work_id)| MemberEvidence {
            work_id: (*work_id).to_owned(),
            run_id: "run:wp018:001".to_owned(),
            source_version: SCHEMA_VERSION,
            owner: SCHEDULER_OWNER.to_owned(),
            causal_parent: format!("scheduler:evidence:{work_id}"),
            evidence_digest64: 1000 + index as u64,
            source_wp010_evidence_digest64: wp010().evidence_digest64,
            source_wp010_snapshot_digest64: wp010().snapshot_digest64,
            verdict: Verdict::Pass,
            behavior_pass: true,
            contract_pass: true,
            integration_pass: true,
        })
        .collect()
}

fn input() -> ReviewInput {
    ReviewInput {
        schema_version: SCHEMA_VERSION,
        run_id: "run:wp018:001".to_owned(),
        source_version: SCHEMA_VERSION,
        reviewer: REVIEWER.to_owned(),
        root: RootReference {
            work_id: "S1.01.01".to_owned(),
            version: SCHEMA_VERSION,
            owner: "canonical.world_state.registry".to_owned(),
            causal_parent: "WP-001:closure".to_owned(),
            evidence_digest64: 301,
        },
        wp010: wp010(),
        wp013: wp013(),
        members: members(),
        provenance_digest64: 401,
        derived_lineage_digest64: 402,
    }
}

#[test]
fn admission_requires_exact_closed_wp010_and_wp013_evidence() {
    let record = review(&input(), ReviewOrigin::ValidationQa).unwrap();
    assert_eq!(record.verdict, Verdict::Pass);
    assert_eq!(record.wp010_evidence_digest64, 102);
    assert_eq!(record.wp013_acceptance_digest64, 201);

    let mut bad = input();
    bad.wp010.closed = false;
    let failure = review(&bad, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(failure.verdict, Verdict::Blocked);
    assert_eq!(failure.failed_work_id, "WP-010");

    let mut bad = input();
    bad.wp013.closed = false;
    let failure = review(&bad, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(failure.failed_work_id, "WP-013");
}

#[test]
fn normal_review_requires_complete_same_run_same_version_evidence() {
    let record = review(&input(), ReviewOrigin::ValidationQa).unwrap();
    assert_eq!(record.work_id, "S1.06.11");
    assert_eq!(record.work_package, "WP-018");
    assert_eq!(
        record.operands,
        ["Schedulable", "Event", "Causal", "Deadline"]
    );
    assert_eq!(record.event_order, REVIEWED_MEMBER_IDS);
    assert_eq!(record.causal_references.len(), 10);
    assert!(record.read_only);
    assert!(!record.downstream_blocked);
}

#[test]
fn missing_member_is_blocked_and_out_of_scope_pass_cannot_substitute() {
    let mut missing = input();
    missing.members.pop();
    let failure = review(&missing, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(failure.verdict, Verdict::Blocked);
    assert_eq!(failure.failed_work_id, "S1.06.10");
    assert!(failure.missing_evidence.contains(&"S1.06.10".to_owned()));

    let mut substituted = missing;
    substituted.members.push(MemberEvidence {
        work_id: "S1.07.01".to_owned(),
        run_id: "run:wp018:001".to_owned(),
        source_version: SCHEMA_VERSION,
        owner: SCHEDULER_OWNER.to_owned(),
        causal_parent: "out-of-scope".to_owned(),
        evidence_digest64: 9999,
        source_wp010_evidence_digest64: 102,
        source_wp010_snapshot_digest64: 103,
        verdict: Verdict::Pass,
        behavior_pass: true,
        contract_pass: true,
        integration_pass: true,
    });
    let failure = review(&substituted, ReviewOrigin::ValidationQa).unwrap_err();
    assert!(matches!(
        failure.reason,
        FailureReason::OutOfScopeEvidence(_)
    ));
}

#[test]
fn mixed_run_or_source_version_is_blocked() {
    let mut mixed = input();
    mixed.members[3].run_id = "run:other".to_owned();
    let failure = review(&mixed, ReviewOrigin::ValidationQa).unwrap_err();
    assert!(matches!(failure.reason, FailureReason::RunMismatch(_)));

    let mut stale = input();
    stale.members[3].source_version += 1;
    let failure = review(&stale, ReviewOrigin::ValidationQa).unwrap_err();
    assert!(matches!(
        failure.reason,
        FailureReason::SourceVersionMismatch(_)
    ));
}

#[test]
fn wrong_owner_is_blocked_without_authority_repair() {
    let mut bad = input();
    bad.members[1].owner = "observer".to_owned();
    let pre = bad.digest64();
    let failure = review(&bad, ReviewOrigin::ValidationQa).unwrap_err();
    assert!(matches!(failure.reason, FailureReason::WrongOwner(_)));
    assert_eq!(failure.pre_state_digest64, pre);
    assert_eq!(failure.post_state_digest64, pre);
}

#[test]
fn derived_observer_renderer_and_analytics_cannot_issue_acceptance() {
    for origin in [
        ReviewOrigin::Derived,
        ReviewOrigin::Observer,
        ReviewOrigin::Renderer,
        ReviewOrigin::Analytics,
    ] {
        let source = input();
        let pre = source.digest64();
        let failure = review(&source, origin).unwrap_err();
        assert_eq!(failure.verdict, Verdict::Blocked);
        assert_eq!(failure.reason, FailureReason::UnauthorizedReviewer);
        assert_eq!(failure.pre_state_digest64, pre);
        assert_eq!(failure.post_state_digest64, pre);
    }
}

#[test]
fn explicit_fail_is_fail_and_unverifiable_member_is_blocked() {
    let mut failed = input();
    failed.members[4].verdict = Verdict::Fail;
    let failure = review(&failed, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(failure.verdict, Verdict::Fail);
    assert_eq!(failure.failed_work_id, "S1.06.05");

    let mut blocked = input();
    blocked.members[4].verdict = Verdict::Blocked;
    let failure = review(&blocked, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(failure.verdict, Verdict::Blocked);
    assert!(failure.downstream_blocked);
}

#[test]
fn behavior_contract_or_integration_failure_cannot_be_promoted_to_pass() {
    for field in 0..3 {
        let mut source = input();
        match field {
            0 => source.members[2].behavior_pass = false,
            1 => source.members[2].contract_pass = false,
            _ => source.members[2].integration_pass = false,
        }
        let failure = review(&source, ReviewOrigin::ValidationQa).unwrap_err();
        assert_eq!(failure.verdict, Verdict::Fail);
        assert_eq!(failure.failed_work_id, "S1.06.03");
        assert!(matches!(failure.reason, FailureReason::ContractFailure(_)));
    }
}

#[test]
fn missing_or_mismatched_evidence_hash_blocks_at_exact_member() {
    let mut missing = input();
    missing.members[6].evidence_digest64 = 0;
    let failure = review(&missing, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(failure.failed_work_id, "S1.06.07");
    assert!(matches!(failure.reason, FailureReason::MissingEvidence(_)));

    let mut mismatch = input();
    mismatch.members[6].source_wp010_snapshot_digest64 ^= 1;
    let failure = review(&mismatch, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(failure.failed_work_id, "S1.06.07");
    assert_eq!(
        failure.reason,
        FailureReason::ReferenceMismatch("WP-010 member evidence source")
    );
}

#[test]
fn root_id_version_owner_causal_parent_and_digest_are_required() {
    let mut source = input();
    source.root.work_id = "S1.01.02".to_owned();
    assert!(matches!(
        review(&source, ReviewOrigin::ValidationQa)
            .unwrap_err()
            .reason,
        FailureReason::InvalidRoot("work_id")
    ));

    let mut source = input();
    source.root.owner.clear();
    assert!(matches!(
        review(&source, ReviewOrigin::ValidationQa)
            .unwrap_err()
            .reason,
        FailureReason::InvalidRoot("owner_causal_or_evidence")
    ));
}

#[test]
fn snapshot_restore_and_replay_preserve_evidence_hash_verdict_order_and_digest() {
    let snapshot = ReviewSnapshot::new(input());
    snapshot.validate().unwrap();
    let restored = snapshot.restore().unwrap();
    assert_eq!(restored, snapshot.input);
    let first = snapshot.replay(ReviewOrigin::ValidationQa).unwrap();
    let second = snapshot.replay(ReviewOrigin::ValidationQa).unwrap();
    assert_eq!(first, second);
    assert_eq!(first.event_order, REVIEWED_MEMBER_IDS);
    assert_eq!(first.digest64(), second.digest64());
}

#[test]
fn corrupted_review_snapshot_is_blocked_before_replay() {
    let mut snapshot = ReviewSnapshot::new(input());
    snapshot.evidence_hash64 ^= 1;
    let failure = snapshot.replay(ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(failure.verdict, Verdict::Blocked);
    assert_eq!(
        failure.reason,
        FailureReason::ReferenceMismatch("snapshot.evidence_hash")
    );
}

#[test]
fn member_input_order_does_not_change_canonical_review_event_order() {
    let baseline = review(&input(), ReviewOrigin::ValidationQa).unwrap();
    let mut reordered = input();
    reordered.members.reverse();
    let record = review(&reordered, ReviewOrigin::ValidationQa).unwrap();
    assert_eq!(record.event_order, REVIEWED_MEMBER_IDS);
    assert_eq!(
        record.causal_references.len(),
        baseline.causal_references.len()
    );
}

#[test]
fn wp018_closure_requires_s1_06_11_pass_and_nonzero_evidence() {
    let record = review(&input(), ReviewOrigin::ValidationQa).unwrap();
    let closure = close_wp018(&record, 777).unwrap();
    assert_eq!(closure.work_package, "WP-018");
    assert_eq!(closure.member_id, "S1.06.11");
    assert!(closure.closed);
    assert_ne!(closure.acceptance_digest64, 0);

    let failure = close_wp018(&record, 0).unwrap_err();
    assert_eq!(failure.verdict, Verdict::Blocked);
}

#[test]
fn failure_blocks_both_frozen_hard_successors() {
    let mut source = input();
    source.members.pop();
    let failure = review(&source, ReviewOrigin::ValidationQa).unwrap_err();
    assert_eq!(failure.blocked_successors, ["WP-007", "WP-023"]);
    assert!(failure.downstream_blocked);
}

#[test]
fn wp018_integration_root_to_review_to_closure_has_no_shortcut() {
    let source = input();
    let snapshot = ReviewSnapshot::new(source.clone());
    let record = snapshot.replay(ReviewOrigin::ValidationQa).unwrap();
    assert_eq!(record.root_work_id, source.root.work_id);
    assert_eq!(record.root_version, source.root.version);
    assert_eq!(record.root_owner, source.root.owner);
    assert_eq!(record.root_causal_parent, source.root.causal_parent);
    assert_eq!(
        record.wp010_evidence_digest64,
        source.wp010.evidence_digest64
    );
    assert_eq!(
        record.wp013_acceptance_digest64,
        source.wp013.acceptance_digest64
    );
    let closure = close_wp018(&record, snapshot.digest64()).unwrap();
    assert!(closure.closed);

    let mut shortcut = source;
    shortcut.members.remove(0);
    assert!(review(&shortcut, ReviewOrigin::ValidationQa).is_err());
}
