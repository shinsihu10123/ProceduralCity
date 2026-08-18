use gaonn_identity_reuse_audit_core::AuditEvidence;
use gaonn_scheduler_core::*;
use gaonn_world_time_core::{EpochDescriptor, OWNER as TIME_OWNER, WorldTimeState};
use std::collections::BTreeSet;

fn predecessor() -> Wp002ClosureProof {
    Wp002ClosureProof {
        version: 1,
        member_evidence: [11, 12, 13, 14, 15, 16, 17, 18, 19],
        reuse_audit: AuditEvidence {
            work_id: "S1.02.09",
            checked: 2,
            violations: vec![],
            canonical_mutation: false,
            predecessor_digest: 99,
        },
        causal_parent: "WP-002:CLOSED".to_owned(),
    }
}

fn world_time(tick: i128, microstep: u64) -> WorldTimeState {
    WorldTimeState {
        epoch: EpochDescriptor {
            id: "world-epoch-0".to_owned(),
            unit: "ns".to_owned(),
            frame: "absolute".to_owned(),
            version: 1,
            owner: TIME_OWNER.to_owned(),
            causal_parent: "WP-004:CLOSED".to_owned(),
        },
        tick,
        microstep,
        version: 1,
        owner: TIME_OWNER.to_owned(),
        causal_parent: "time:fixture".to_owned(),
    }
}

fn record(
    id: &str,
    tick: i128,
    microstep: u64,
    priority: i32,
    dependencies: &[&str],
    status: ScheduleStatus,
) -> SchedulableRecord {
    SchedulableRecord {
        stable_id: id.to_owned(),
        namespace: "scheduler.event".to_owned(),
        version: 1,
        owner: OWNER.to_owned(),
        causal_parent: format!("cause:{id}"),
        kind: SchedulableKind::Event,
        deadline: world_time(tick, microstep),
        key: SchedulingKey {
            deadline_tick: tick,
            microstep,
            semantic_priority: priority,
            stable_id: id.to_owned(),
            version: 1,
        },
        dependency_tokens: dependencies
            .iter()
            .map(|value| (*value).to_owned())
            .collect(),
        status,
    }
}

fn receipt(record: &SchedulableRecord) -> ContractReceipt {
    validate_contract(
        record,
        "schedule",
        &BTreeSet::from(["schedule".to_owned()]),
        WriteOrigin::RuntimeAuthority,
    )
    .unwrap()
}

#[test]
fn admission_requires_complete_wp002_pass_evidence() {
    let proof = predecessor();
    let admitted = admit(&proof).unwrap();
    assert_eq!(admitted.predecessor, "WP-002");
    assert_ne!(admitted.predecessor_digest64, 0);

    let mut missing = proof.clone();
    missing.member_evidence[4] = 0;
    assert_eq!(admit(&missing), Err(SchedulerError::InvalidPredecessor));

    let mut failed_audit = proof;
    failed_audit.reuse_audit.canonical_mutation = true;
    assert_eq!(
        admit(&failed_audit),
        Err(SchedulerError::InvalidPredecessor)
    );
}

#[test]
fn s1_06_01_contract_validates_owner_version_transition_and_read_only_origins() {
    let item = record("event-a", 10, 0, 2, &[], ScheduleStatus::Pending);
    let allowed = BTreeSet::from(["schedule".to_owned()]);
    let result =
        validate_contract(&item, "schedule", &allowed, WriteOrigin::RuntimeAuthority).unwrap();
    assert_eq!(result.work_id, "S1.06.01");
    assert_eq!(result.disposition, Disposition::CandidateOnly);

    assert_eq!(
        validate_contract(&item, "schedule", &allowed, WriteOrigin::Observer),
        Err(SchedulerError::UnauthorizedWrite(WriteOrigin::Observer))
    );
    assert!(matches!(
        validate_contract(
            &item,
            "invented-transition",
            &allowed,
            WriteOrigin::RuntimeAuthority
        ),
        Err(SchedulerError::UnsupportedTransition(_))
    ));
}

#[test]
fn s1_06_02_deadline_representation_preserves_identity_owner_and_causal_parent() {
    let item = record("event-b", 21, 3, 7, &[], ScheduleStatus::Pending);
    let representation = represent_deadline(&receipt(&item), &item).unwrap();
    assert_eq!(representation.work_id, "S1.06.02");
    assert_eq!(representation.stable_id, item.stable_id);
    assert_eq!(representation.version, item.version);
    assert_eq!(representation.owner, OWNER);
    assert_eq!(representation.deadline_tick, 21);
    assert_eq!(representation.microstep, 3);
}

#[test]
fn s1_06_03_deterministic_key_is_semantic_and_input_order_independent() {
    let a = record("event-a", 30, 0, 1, &[], ScheduleStatus::Pending);
    let b = record("event-b", 30, 0, 2, &[], ScheduleStatus::Pending);
    assert_eq!(deterministic_key(&receipt(&a), &a).unwrap(), a.key);
    let bucket1 = SameTimeBucket::collect(vec![b.clone(), a.clone()]).unwrap();
    let bucket2 = SameTimeBucket::collect(vec![a, b]).unwrap();
    let ids1: Vec<_> = bucket1
        .ordered
        .iter()
        .map(|item| item.stable_id.clone())
        .collect();
    let ids2: Vec<_> = bucket2
        .ordered
        .iter()
        .map(|item| item.stable_id.clone())
        .collect();
    assert_eq!(ids1, ids2);
}

#[test]
fn s1_06_04_same_time_bucket_rejects_mixed_time_and_duplicate_keys() {
    let a = record("a", 40, 0, 1, &[], ScheduleStatus::Pending);
    let b = record("b", 40, 0, 2, &[], ScheduleStatus::Pending);
    let bucket = SameTimeBucket::collect(vec![b, a]).unwrap();
    assert_eq!(bucket.tick, 40);
    assert_eq!(bucket.ordered[0].stable_id, "a");

    let c = record("c", 41, 0, 3, &[], ScheduleStatus::Pending);
    assert_eq!(
        SameTimeBucket::collect(vec![bucket.ordered[0].clone(), c]),
        Err(SchedulerError::NotSameTime)
    );

    let duplicate = bucket.ordered[0].clone();
    assert!(matches!(
        SameTimeBucket::collect(vec![bucket.ordered[0].clone(), duplicate]),
        Err(SchedulerError::DuplicateSchedulingKey) | Err(SchedulerError::DuplicateStableId(_))
    ));
}

#[test]
fn s1_06_05_same_time_resolution_tracks_dependency_and_resource_rejections() {
    let a = record("a", 50, 0, 1, &["dep-ok"], ScheduleStatus::Pending);
    let b = record("b", 50, 0, 2, &[], ScheduleStatus::Pending);
    let c = record("c", 50, 0, 3, &["missing"], ScheduleStatus::Pending);
    let bucket = SameTimeBucket::collect(vec![c.clone(), b.clone(), a.clone()]).unwrap();
    let candidates = vec![
        ResolutionCandidate {
            record: c,
            required_resources: BTreeSet::from(["resource-c".to_owned()]),
        },
        ResolutionCandidate {
            record: b,
            required_resources: BTreeSet::from(["shared".to_owned()]),
        },
        ResolutionCandidate {
            record: a,
            required_resources: BTreeSet::from(["shared".to_owned()]),
        },
    ];
    let result =
        resolve_same_time(&bucket, candidates, &BTreeSet::from(["dep-ok".to_owned()])).unwrap();
    assert_eq!(result.selected, vec!["a"]);
    assert_eq!(result.rejected.len(), 2);
    assert_eq!(result.rejected[0].reason, "resource-conflict");
    assert_eq!(result.rejected[1].reason, "dependency-unmet");
}

#[test]
fn s1_06_06_future_event_queue_orders_and_blocks_without_partial_write() {
    let mut queue = FutureEventQueue::default();
    let ready = record("ready", 60, 0, 1, &[], ScheduleStatus::Pending);
    let blocked = record("blocked", 60, 0, 2, &["dep"], ScheduleStatus::Pending);
    let future = record("future", 70, 0, 1, &[], ScheduleStatus::Pending);
    queue
        .insert(ready.clone(), WriteOrigin::RuntimeAuthority)
        .unwrap();
    queue
        .insert(blocked, WriteOrigin::RuntimeAuthority)
        .unwrap();
    queue.insert(future, WriteOrigin::RuntimeAuthority).unwrap();
    let pre = queue.digest64();
    assert!(matches!(
        queue.insert(ready, WriteOrigin::RuntimeAuthority),
        Err(SchedulerError::DuplicateStableId(_))
    ));
    assert_eq!(queue.digest64(), pre);

    let plan = queue.plan(&world_time(60, 0), &BTreeSet::new(), 1).unwrap();
    assert_eq!(plan[0].status, ScheduleStatus::Ready);
    assert_eq!(plan[1].status, ScheduleStatus::Blocked);
    assert_eq!(plan[2].status, ScheduleStatus::Waiting);
}

#[test]
fn s1_06_07_inactive_process_wake_sleep_distinguishes_ready_sleep_blocked_and_expired() {
    let deps = BTreeSet::from(["dep".to_owned()]);
    let ready = record("ready", 80, 0, 1, &["dep"], ScheduleStatus::Sleeping);
    assert_eq!(
        schedule_inactive(&ready, &world_time(80, 0), &deps)
            .unwrap()
            .status,
        ScheduleStatus::Ready
    );
    let future = record("future", 90, 0, 1, &[], ScheduleStatus::Sleeping);
    assert_eq!(
        schedule_inactive(&future, &world_time(80, 0), &deps)
            .unwrap()
            .status,
        ScheduleStatus::Sleeping
    );
    let unmet = record("unmet", 90, 0, 1, &["missing"], ScheduleStatus::Sleeping);
    assert_eq!(
        schedule_inactive(&unmet, &world_time(80, 0), &deps)
            .unwrap()
            .status,
        ScheduleStatus::Blocked
    );
    let expired = record("expired", 70, 0, 1, &[], ScheduleStatus::Sleeping);
    assert_eq!(
        schedule_inactive(&expired, &world_time(80, 0), &deps)
            .unwrap()
            .status,
        ScheduleStatus::Blocked
    );
}

#[test]
fn s1_06_08_scheduler_admission_preserves_pass_version_and_block_reason() {
    let item = record("admit", 100, 0, 1, &[], ScheduleStatus::Pending);
    let contract = receipt(&item);
    let allowed = scheduler_admission(&contract, &item, true, 1, None).unwrap();
    assert!(allowed.allowed);
    assert_eq!(allowed.source_version, 1);

    let blocked = scheduler_admission(&contract, &item, false, 1, None).unwrap();
    assert!(!blocked.allowed);
    assert_eq!(blocked.blocking_reason, Some("predecessor-not-pass"));

    assert_eq!(
        scheduler_admission(&contract, &item, true, 2, None),
        Err(SchedulerError::StaleVersion {
            expected: 1,
            found: 2
        })
    );
}

#[test]
fn s1_06_09_budget_handoff_transfers_source_reference_without_inventing_policy() {
    let item = record("budget", 110, 2, 3, &[], ScheduleStatus::Pending);
    let admission = scheduler_admission(&receipt(&item), &item, true, 1, None).unwrap();
    let budget = SchedulerBudget {
        schema_version: 1,
        owner: OWNER.to_owned(),
        causal_parent: "budget-source:profile-7".to_owned(),
        available_work_slots: 4,
        budget_profile_ref: "budget-profile-7".to_owned(),
    };
    let handoff = budget_handoff(&admission, &budget, WriteOrigin::RuntimeAuthority).unwrap();
    assert_eq!(handoff.work_id, "S1.06.09");
    assert_eq!(handoff.source_stable_id, "budget");
    assert_eq!(handoff.available_work_slots, 4);
    assert_eq!(handoff.budget_profile_ref, "budget-profile-7");
}

#[test]
fn s1_06_10_render_frame_time_coupling_audit_is_read_only_and_precise() {
    let mut queue = FutureEventQueue::default();
    queue
        .insert(
            record("audit", 120, 0, 1, &[], ScheduleStatus::Pending),
            WriteOrigin::RuntimeAuthority,
        )
        .unwrap();
    let clean = audit_frame_time_coupling(
        &queue,
        &[FrameTimeCouplingAttempt {
            work_id: "clean".to_owned(),
            render_frame_time_controls_deadline: false,
            visibility_controls_wake_or_pause: false,
            observer_value_changes_order: false,
            renderer_writes_scheduler_state: false,
        }],
        "cause:audit",
    )
    .unwrap();
    assert!(clean.pass());

    let violation = audit_frame_time_coupling(
        &queue,
        &[FrameTimeCouplingAttempt {
            work_id: "bad-render-coupling".to_owned(),
            render_frame_time_controls_deadline: true,
            visibility_controls_wake_or_pause: false,
            observer_value_changes_order: false,
            renderer_writes_scheduler_state: false,
        }],
        "cause:audit",
    )
    .unwrap();
    assert!(!violation.pass());
    assert_eq!(violation.pre_digest64, violation.post_digest64);
    assert_eq!(
        violation.violations[0].first_failure,
        "render-frame-time-controls-deadline"
    );
}

#[test]
fn authority_wrong_origin_never_mutates_future_queue() {
    let mut queue = FutureEventQueue::default();
    let pre = queue.digest64();
    assert_eq!(
        queue.insert(
            record("observer", 130, 0, 1, &[], ScheduleStatus::Pending),
            WriteOrigin::Observer
        ),
        Err(SchedulerError::UnauthorizedWrite(WriteOrigin::Observer))
    );
    assert_eq!(queue.digest64(), pre);
}

#[test]
fn persistence_restore_and_replay_preserve_pending_state_identity_and_digest() {
    let mut queue = FutureEventQueue::default();
    queue
        .insert(
            record("persist-a", 140, 0, 1, &[], ScheduleStatus::Pending),
            WriteOrigin::RuntimeAuthority,
        )
        .unwrap();
    queue
        .insert(
            record("persist-b", 150, 1, 1, &["dep"], ScheduleStatus::Sleeping),
            WriteOrigin::RuntimeAuthority,
        )
        .unwrap();
    let snapshot = SchedulerSnapshot {
        schema_version: 1,
        commit_marker: "commit:wp010".to_owned(),
        causal_cut: "cut:140".to_owned(),
        queue: queue.clone(),
    };
    let digest = snapshot.digest64().unwrap();
    let restored = snapshot.restore().unwrap();
    assert_eq!(restored, queue);
    assert_eq!(restored.digest64(), queue.digest64());
    assert_eq!(snapshot.digest64().unwrap(), digest);
    assert_eq!(
        restored.get("persist-b").unwrap().status,
        ScheduleStatus::Sleeping
    );
}

#[test]
fn wp010_integration_and_acceptance_require_all_ten_members_and_snapshot_evidence() {
    let proof = predecessor();
    let item = record("integration", 160, 0, 1, &[], ScheduleStatus::Pending);
    let contract = receipt(&item);
    let deadline = represent_deadline(&contract, &item).unwrap();
    assert_eq!(deadline.stable_id, item.stable_id);
    let key = deterministic_key(&contract, &item).unwrap();
    assert_eq!(key, item.key);
    let bucket = SameTimeBucket::collect(vec![item.clone()]).unwrap();
    let resolution = resolve_same_time(
        &bucket,
        vec![ResolutionCandidate {
            record: item.clone(),
            required_resources: BTreeSet::new(),
        }],
        &BTreeSet::new(),
    )
    .unwrap();
    assert_eq!(resolution.selected, vec!["integration"]);

    let mut queue = FutureEventQueue::default();
    queue
        .insert(item.clone(), WriteOrigin::RuntimeAuthority)
        .unwrap();
    let plan = queue
        .plan(&world_time(160, 0), &BTreeSet::new(), 1)
        .unwrap();
    queue
        .apply_plan(&plan, WriteOrigin::RuntimeAuthority)
        .unwrap();
    assert_eq!(
        queue.get("integration").unwrap().status,
        ScheduleStatus::Ready
    );
    let admission = scheduler_admission(&contract, &item, true, 1, None).unwrap();
    let handoff = budget_handoff(
        &admission,
        &SchedulerBudget {
            schema_version: 1,
            owner: OWNER.to_owned(),
            causal_parent: "budget:integration".to_owned(),
            available_work_slots: 1,
            budget_profile_ref: "profile:integration".to_owned(),
        },
        WriteOrigin::RuntimeAuthority,
    )
    .unwrap();
    assert_eq!(handoff.source_stable_id, item.stable_id);
    let audit = audit_frame_time_coupling(&queue, &[], "audit:integration").unwrap();
    assert!(audit.pass());

    let snapshot = SchedulerSnapshot {
        schema_version: 1,
        commit_marker: "commit:integration".to_owned(),
        causal_cut: "cut:integration".to_owned(),
        queue,
    };
    let acceptance =
        accept_wp(&proof, &[true; 10], &[1; 10], snapshot.digest64().unwrap()).unwrap();
    assert!(acceptance.closed);
    assert_eq!(acceptance.member_ids, MEMBER_IDS);

    let mut missing = [true; 10];
    missing[4] = false;
    assert_eq!(
        accept_wp(&proof, &missing, &[1; 10], 1),
        Err(SchedulerError::MissingEvidence("S1.06.05"))
    );
    assert_eq!(
        accept_wp(&proof, &[true; 10], &[1; 10], 0),
        Err(SchedulerError::MissingSnapshotEvidence)
    );
}
