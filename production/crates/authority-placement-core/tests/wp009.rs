use gaonn_authority_placement_core::*;
use gaonn_identity_acceptance_core::Wp013Closure;

fn predecessors() -> (PredecessorEvidence, PredecessorEvidence, Wp013Closure) {
    (
        PredecessorEvidence {
            work_package: "WP-001".into(),
            source_version: 1,
            closed: true,
            evidence_digest64: 101,
        },
        PredecessorEvidence {
            work_package: "WP-002".into(),
            source_version: 1,
            closed: true,
            evidence_digest64: 202,
        },
        Wp013Closure {
            work_package: "WP-013",
            member_id: "S1.02.10",
            acceptance_digest64: 303,
            evidence_digest64: 404,
            closed: true,
        },
    )
}

fn admission() -> Admission {
    let (wp001, wp002, wp013) = predecessors();
    admit_wp009("wp009-run-1", 1, &wp001, &wp002, &wp013, "wp013:evidence").unwrap()
}

fn axis() -> AxisValidation {
    let admission = admission();
    validate_axis_contract(
        &AxisContractInput {
            admission_digest64: admission.digest64(),
            contract_version: 1,
            semantic_owner: "objective.world.domain-owner".into(),
            allowed_writer: OWNER.into(),
            authority_epoch: 7,
            semantic_axis: "semantic-authority".into(),
            placement_axis: "physical-placement".into(),
            causal_parent: "wp009-run-1:S1.03.01".into(),
        },
        Origin::PartitionManager,
    )
    .unwrap()
}

fn partition(id: &str, version: u32) -> PartitionIdentity {
    PartitionIdentity {
        stable_id: id.into(),
        namespace: format!("partition:{id}"),
        version,
        lifecycle_lineage: format!("lineage:{id}"),
        state: LifecycleState::Active,
        causal_parent: format!("cause:{id}:{version}"),
    }
}

fn placement(id: &str, partition_id: &str, version: u32) -> PlacementDescriptor {
    PlacementDescriptor {
        stable_id: id.into(),
        namespace: format!("placement:{id}"),
        version,
        partition_id: partition_id.into(),
        physical_descriptor: format!("node/{partition_id}"),
        lifecycle_lineage: format!("placement-lineage:{id}"),
        state: LifecycleState::Active,
        causal_parent: format!("place-cause:{id}:{version}"),
    }
}

fn state_with_two_partitions() -> AuthorityPlacementState {
    let axis = axis();
    let mut state = AuthorityPlacementState::default();
    state
        .create_partition(&axis, partition("p-a", 1), Origin::PartitionManager)
        .unwrap();
    state
        .create_partition(&axis, partition("p-b", 1), Origin::PartitionManager)
        .unwrap();
    state
        .create_placement(
            &axis,
            placement("loc-a", "p-a", 1),
            Origin::PartitionManager,
        )
        .unwrap();
    state
        .create_placement(
            &axis,
            placement("loc-b", "p-b", 1),
            Origin::PartitionManager,
        )
        .unwrap();
    state
        .register_segment(
            &axis,
            AuthoritySegment {
                segment_id: "seg-1".into(),
                semantic_owner: axis.semantic_owner.clone(),
                semantic_digest64: 0xabc,
                lease: WriterLease {
                    partition_id: "p-a".into(),
                    writer: "writer-a".into(),
                    authority_epoch: 7,
                },
            },
            Origin::PartitionManager,
        )
        .unwrap();
    state
}

fn contract(work_id: &'static str, partition_id: &str) -> ContractValidation {
    let input = ContractInput {
        work_id,
        contract_version: 1,
        semantic_owner: axis().semantic_owner,
        allowed_writer: OWNER.into(),
        authority_epoch: 7,
        partition_id: partition_id.into(),
        causal_parent: format!("{work_id}:cause"),
    };
    if work_id == "S1.03.04" {
        validate_routing_contract(&input, Origin::PartitionManager).unwrap()
    } else {
        validate_cross_partition_contract(&input, Origin::PartitionManager).unwrap()
    }
}

fn validated_handoff() -> ValidatedHandoff {
    validate_handoff(
        &HandoffRequest {
            schema_version: 1,
            segment_id: "seg-1".into(),
            semantic_owner: axis().semantic_owner,
            semantic_digest64: 0xabc,
            source_partition: "p-a".into(),
            source_writer: "writer-a".into(),
            source_epoch: 7,
            target_partition: "p-b".into(),
            target_writer: "writer-b".into(),
            target_epoch: 8,
            original_reference: "seg-1@epoch7".into(),
            transformation_basis: "PA-042 fenced atomic handoff".into(),
            causal_parent: "S1.03.06:handoff-1".into(),
            complete_payload: true,
        },
        &contract("S1.03.04", "p-a"),
        &contract("S1.03.05", "p-a"),
        Origin::PartitionManager,
    )
    .unwrap()
}

#[test]
fn wp009_admission_requires_all_three_frozen_predecessors() {
    let (wp001, wp002, mut wp013) = predecessors();
    let ok = admit_wp009("run", 1, &wp001, &wp002, &wp013, "cause").unwrap();
    assert_ne!(ok.digest64(), 0);

    wp013.closed = false;
    let err = admit_wp009("run", 1, &wp001, &wp002, &wp013, "cause").unwrap_err();
    assert_eq!(err.verdict, Verdict::Blocked);
    assert_eq!(err.pre_state_digest64, err.post_state_digest64);
}

#[test]
fn s1_03_01_authority_and_placement_axes_are_orthogonal_and_read_only_origins_fail() {
    let mut input = AxisContractInput {
        admission_digest64: admission().digest64(),
        contract_version: 1,
        semantic_owner: "semantic-owner".into(),
        allowed_writer: OWNER.into(),
        authority_epoch: 1,
        semantic_axis: "semantic".into(),
        placement_axis: "placement".into(),
        causal_parent: "cause".into(),
    };
    let valid = validate_axis_contract(&input, Origin::PartitionManager).unwrap();
    assert_eq!(valid.disposition, CandidateDisposition::CandidateOnly);
    assert_ne!(valid.semantic_axis, valid.placement_axis);

    let err = validate_axis_contract(&input, Origin::Renderer).unwrap_err();
    assert_eq!(err.pre_state_digest64, err.post_state_digest64);
    input.placement_axis = "semantic".into();
    assert_eq!(
        validate_axis_contract(&input, Origin::PartitionManager)
            .unwrap_err()
            .verdict,
        Verdict::Fail
    );
}

#[test]
fn s1_03_02_single_writer_partition_identity_rejects_duplicate_stale_and_retired_reuse() {
    let axis = axis();
    let mut state = AuthorityPlacementState::default();
    state
        .create_partition(&axis, partition("p-a", 1), Origin::PartitionManager)
        .unwrap();
    let before = state.digest64();
    assert!(state
        .create_partition(&axis, partition("p-a", 1), Origin::PartitionManager)
        .is_err());
    assert_eq!(state.digest64(), before);

    let mut stale = partition("p-a", 4);
    stale.causal_parent = "stale".into();
    assert!(state
        .update_partition(&axis, stale, 1, Origin::PartitionManager)
        .is_err());
    assert_eq!(state.digest64(), before);

    state
        .retire_partition(&axis, "p-a", 1, "retire", Origin::PartitionManager)
        .unwrap();
    let retired = state.digest64();
    assert!(state
        .create_partition(&axis, partition("p-a", 1), Origin::PartitionManager)
        .is_err());
    assert_eq!(state.digest64(), retired);
}

#[test]
fn s1_03_02_wrong_owner_cannot_mutate_partition_registry() {
    let axis = axis();
    let mut state = AuthorityPlacementState::default();
    let before = state.digest64();
    let err = state
        .create_partition(&axis, partition("p-a", 1), Origin::Observer)
        .unwrap_err();
    assert_eq!(err.verdict, Verdict::Blocked);
    assert_eq!(state.digest64(), before);
}

#[test]
fn s1_03_03_physical_placement_create_update_retire_and_snapshot_round_trip() {
    let axis = axis();
    let mut state = AuthorityPlacementState::default();
    state
        .create_partition(&axis, partition("p-a", 1), Origin::PartitionManager)
        .unwrap();
    state
        .create_placement(
            &axis,
            placement("loc-a", "p-a", 1),
            Origin::PartitionManager,
        )
        .unwrap();
    let mut next = placement("loc-a", "p-a", 2);
    next.physical_descriptor = "node/p-a/repositioned".into();
    state
        .update_placement(&axis, next, 1, Origin::PartitionManager)
        .unwrap();
    let snapshot = StateSnapshot::new(&state);
    let restored = snapshot.restore().unwrap();
    assert_eq!(state, restored);
    state
        .retire_placement(
            &axis,
            "loc-a",
            2,
            "retire-placement",
            Origin::PartitionManager,
        )
        .unwrap();
    assert_eq!(state.placements["loc-a"].state, LifecycleState::Retired);
}

#[test]
fn s1_03_03_dangling_placement_and_corrupt_snapshot_fail_closed() {
    let axis = axis();
    let mut state = AuthorityPlacementState::default();
    let before = state.digest64();
    assert!(state
        .create_placement(
            &axis,
            placement("loc-x", "missing", 1),
            Origin::PartitionManager
        )
        .is_err());
    assert_eq!(state.digest64(), before);

    let mut snapshot = StateSnapshot::new(&state);
    snapshot.state_digest64 ^= 1;
    assert!(snapshot.restore().is_err());
}

#[test]
fn s1_03_04_routing_contract_is_versioned_and_observer_cannot_validate_write_path() {
    let input = ContractInput {
        work_id: "S1.03.04",
        contract_version: 1,
        semantic_owner: "semantic-owner".into(),
        allowed_writer: OWNER.into(),
        authority_epoch: 4,
        partition_id: "p-a".into(),
        causal_parent: "route".into(),
    };
    assert_eq!(
        validate_routing_contract(&input, Origin::PartitionManager)
            .unwrap()
            .work_id,
        "S1.03.04"
    );
    let err = validate_routing_contract(&input, Origin::Observer).unwrap_err();
    assert_eq!(err.pre_state_digest64, err.post_state_digest64);
}

#[test]
fn s1_03_05_cross_partition_contract_never_becomes_canonical_writer() {
    let validation = contract("S1.03.05", "p-a");
    assert_eq!(validation.disposition, CandidateDisposition::CandidateOnly);
    assert_eq!(validation.allowed_writer, OWNER);
}

#[test]
fn s1_03_06_atomic_handoff_advances_one_epoch_without_changing_semantic_digest() {
    let mut state = state_with_two_partitions();
    let semantic_before = state.semantic_digest64("seg-1").unwrap();
    let validated = validated_handoff();
    let commit = state
        .commit_handoff(&validated, Origin::PartitionManager)
        .unwrap();
    assert_eq!(commit.old_epoch, 7);
    assert_eq!(commit.new_epoch, 8);
    assert_eq!(state.segments["seg-1"].lease.partition_id, "p-b");
    assert_eq!(state.segments["seg-1"].lease.writer, "writer-b");
    assert_eq!(state.semantic_digest64("seg-1").unwrap(), semantic_before);
}

#[test]
fn s1_03_06_partial_or_stale_handoff_is_all_or_none() {
    let mut state = state_with_two_partitions();
    let before = state.digest64();
    let mut request = HandoffRequest {
        schema_version: 1,
        segment_id: "seg-1".into(),
        semantic_owner: axis().semantic_owner,
        semantic_digest64: 0xabc,
        source_partition: "p-a".into(),
        source_writer: "writer-a".into(),
        source_epoch: 7,
        target_partition: "p-b".into(),
        target_writer: "writer-b".into(),
        target_epoch: 8,
        original_reference: "seg@7".into(),
        transformation_basis: "PA-042".into(),
        causal_parent: "handoff".into(),
        complete_payload: false,
    };
    assert!(validate_handoff(
        &request,
        &contract("S1.03.04", "p-a"),
        &contract("S1.03.05", "p-a"),
        Origin::PartitionManager
    )
    .is_err());
    assert_eq!(state.digest64(), before);

    request.complete_payload = true;
    request.source_epoch = 6;
    request.target_epoch = 7;
    let stale = validate_handoff(
        &request,
        &contract("S1.03.04", "p-a"),
        &contract("S1.03.05", "p-a"),
        Origin::PartitionManager,
    )
    .unwrap();
    assert!(state
        .commit_handoff(&stale, Origin::PartitionManager)
        .is_err());
    assert_eq!(state.digest64(), before);
}

#[test]
fn s1_03_06_unavailable_target_blocks_handoff_without_auto_failover() {
    let axis = axis();
    let mut state = state_with_two_partitions();
    let input = UnavailabilityInput {
        contract_version: 1,
        partition_id: "p-b".into(),
        semantic_owner: axis.semantic_owner.clone(),
        allowed_writer: OWNER.into(),
        authority_epoch: 7,
        desired_state: Availability::Unavailable,
        causal_parent: "unavailable".into(),
    };
    let validation = validate_unavailability(&input, &axis, Origin::PartitionManager).unwrap();
    state
        .set_partition_availability(
            "p-b",
            Availability::Unavailable,
            &validation,
            Origin::PartitionManager,
        )
        .unwrap();
    let before = state.digest64();
    let err = state
        .commit_handoff(&validated_handoff(), Origin::PartitionManager)
        .unwrap_err();
    assert!(matches!(err.reason, FailureReason::PartitionUnavailable(_)));
    assert_eq!(state.digest64(), before);
    assert_eq!(state.segments["seg-1"].lease.writer, "writer-a");
}

#[test]
fn s1_03_07_live_migration_durable_artifact_restores_exact_state_and_digest() {
    let mut state = state_with_two_partitions();
    let commit = state
        .commit_handoff(&validated_handoff(), Origin::PartitionManager)
        .unwrap();
    let artifact = MigrationArtifact::new(&state, &commit, 9, 100, 8, "journal:wp009:100").unwrap();
    let restored = artifact.restore().unwrap();
    assert_eq!(restored, state);
    assert_eq!(restored.digest64(), artifact.state_digest64);
    assert_ne!(artifact.digest64(), 0);
}

#[test]
fn s1_03_07_corrupt_or_precommit_artifact_is_not_a_recovery_point() {
    let mut state = state_with_two_partitions();
    let commit = state
        .commit_handoff(&validated_handoff(), Origin::PartitionManager)
        .unwrap();
    let mut artifact = MigrationArtifact::new(&state, &commit, 9, 100, 8, "journal:100").unwrap();
    artifact.commit_marker = false;
    assert!(artifact.restore().is_err());

    artifact.commit_marker = true;
    artifact.state_digest64 ^= 1;
    assert!(artifact.restore().is_err());
}

#[test]
fn s1_03_08_partition_unavailability_is_a_versioned_candidate_contract() {
    let axis = axis();
    let input = UnavailabilityInput {
        contract_version: 1,
        partition_id: "p-a".into(),
        semantic_owner: axis.semantic_owner.clone(),
        allowed_writer: OWNER.into(),
        authority_epoch: axis.authority_epoch,
        desired_state: Availability::Unavailable,
        causal_parent: "availability-cause".into(),
    };
    let validation = validate_unavailability(&input, &axis, Origin::PartitionManager).unwrap();
    assert_eq!(validation.disposition, CandidateDisposition::CandidateOnly);
    assert_eq!(validation.work_id, "S1.03.08");
    assert!(validate_unavailability(&input, &axis, Origin::Renderer).is_err());
}

#[test]
fn s1_03_09_duplicate_authority_audit_is_read_only_and_scope_exact() {
    let claims = vec![
        AuthorityClaim {
            segment_id: "seg".into(),
            semantic_owner: "owner".into(),
            partition_id: "p-a".into(),
            writer: "writer-a".into(),
            authority_epoch: 4,
            in_scope: true,
        },
        AuthorityClaim {
            segment_id: "seg".into(),
            semantic_owner: "owner".into(),
            partition_id: "p-b".into(),
            writer: "writer-b".into(),
            authority_epoch: 4,
            in_scope: false,
        },
    ];
    let pass = audit_duplicate_authority(&claims, "audit", Origin::ValidationQa).unwrap();
    assert_eq!(pass.verdict, Verdict::Pass);
    assert!(pass.read_only);
    assert_eq!(pass.pre_state_digest64, pass.post_state_digest64);

    let mut violating = claims;
    violating[1].in_scope = true;
    let fail = audit_duplicate_authority(&violating, "audit", Origin::ValidationQa).unwrap();
    assert_eq!(fail.verdict, Verdict::Fail);
    assert!(fail.first_failure.is_some());
    assert_eq!(fail.pre_state_digest64, fail.post_state_digest64);
}

fn member_evidence() -> Vec<MemberEvidence> {
    REVIEW_INPUT_MEMBER_IDS
        .iter()
        .enumerate()
        .map(|(index, work_id)| MemberEvidence {
            work_id: (*work_id).into(),
            run_id: admission().run_id,
            source_version: 1,
            owner: if matches!(*work_id, "S1.03.09") {
                REVIEWER.into()
            } else {
                OWNER.into()
            },
            causal_parent: format!("causal:{work_id}"),
            source_state_digest64: 1000 + index as u64,
            evidence_digest64: 2000 + index as u64,
            verdict: Verdict::Pass,
            behavior_pass: true,
            contract_pass: true,
            integration_pass: true,
        })
        .collect()
}

#[test]
fn s1_03_10_acceptance_requires_exact_same_run_nine_pre_review_members() {
    let admission = admission();
    let members = member_evidence();
    let record = review_s1_03(&admission, &members, Origin::ValidationQa).unwrap();
    assert_eq!(record.verdict, Verdict::Pass);
    assert_eq!(record.event_order, REVIEW_INPUT_MEMBER_IDS);
    assert!(record.read_only);

    let mut mixed = members;
    mixed[3].run_id = "other-run".into();
    let err = review_s1_03(&admission, &mixed, Origin::ValidationQa).unwrap_err();
    assert!(matches!(err.reason, FailureReason::MixedRun(_)));
}

#[test]
fn s1_03_10_out_of_scope_pass_cannot_replace_missing_member() {
    let admission = admission();
    let mut members = member_evidence();
    members[4].work_id = "S9.99.99".into();
    let err = review_s1_03(&admission, &members, Origin::ValidationQa).unwrap_err();
    assert!(matches!(err.reason, FailureReason::OutOfScopeEvidence(_)));
    assert_eq!(err.pre_state_digest64, err.post_state_digest64);
}

#[test]
fn s1_03_10_explicit_member_failure_propagates_fail_not_pass() {
    let admission = admission();
    let mut members = member_evidence();
    members[7].verdict = Verdict::Fail;
    let err = review_s1_03(&admission, &members, Origin::ValidationQa).unwrap_err();
    assert_eq!(err.verdict, Verdict::Fail);
    assert!(matches!(err.reason, FailureReason::ExplicitFailure(_)));
}

#[test]
fn wp009_closure_requires_s1_03_10_evidence_and_reports_zero_frozen_deltas() {
    let admission = admission();
    let record = review_s1_03(&admission, &member_evidence(), Origin::ValidationQa).unwrap();
    assert!(close_wp009(&record, 0).is_err());
    let closure = close_wp009(&record, 0xfeed).unwrap();
    assert!(closure.closed);
    assert_eq!(closure.member_ids, MEMBER_IDS);
    assert_eq!(closure.architecture_change, 0);
    assert_eq!(closure.wbs_scope_delta, 0);
    assert_eq!(closure.dependency_semantic_change, 0);
    assert_eq!(closure.frozen_week_change, 0);
}

#[test]
fn deterministic_replay_same_snapshot_and_handoff_gives_same_event_and_digest() {
    let initial = state_with_two_partitions();
    let snapshot = StateSnapshot::new(&initial);
    let mut first = snapshot.restore().unwrap();
    let mut second = snapshot.restore().unwrap();
    let handoff = validated_handoff();
    let first_commit = first
        .commit_handoff(&handoff, Origin::PartitionManager)
        .unwrap();
    let second_commit = second
        .commit_handoff(&handoff, Origin::PartitionManager)
        .unwrap();
    assert_eq!(first, second);
    assert_eq!(first.digest64(), second.digest64());
    assert_eq!(first_commit, second_commit);
}

#[test]
fn authority_placement_integration_preserves_single_writer_after_repartition() {
    let mut state = state_with_two_partitions();
    let before_semantic = state.semantic_digest64("seg-1").unwrap();
    let commit = state
        .commit_handoff(&validated_handoff(), Origin::PartitionManager)
        .unwrap();
    let artifact = MigrationArtifact::new(&state, &commit, 9, 100, 8, "journal:100").unwrap();
    let restored = artifact.restore().unwrap();
    let segment = &restored.segments["seg-1"];
    assert_eq!(segment.lease.partition_id, "p-b");
    assert_eq!(segment.lease.writer, "writer-b");
    assert_eq!(segment.lease.authority_epoch, 8);
    assert_eq!(segment.semantic_digest64, before_semantic);

    let claims = vec![AuthorityClaim {
        segment_id: segment.segment_id.clone(),
        semantic_owner: segment.semantic_owner.clone(),
        partition_id: segment.lease.partition_id.clone(),
        writer: segment.lease.writer.clone(),
        authority_epoch: segment.lease.authority_epoch,
        in_scope: true,
    }];
    assert_eq!(
        audit_duplicate_authority(&claims, "integration-audit", Origin::ValidationQa)
            .unwrap()
            .verdict,
        Verdict::Pass
    );
}
