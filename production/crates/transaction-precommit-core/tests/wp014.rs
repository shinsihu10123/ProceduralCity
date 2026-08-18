use gaonn_identity_reuse_audit_core::AuditEvidence;
use gaonn_scheduler_core::{Wp002ClosureProof, Wp010Acceptance};
use gaonn_transaction_precommit_core::*;
use gaonn_world_core::{CanonicalCandidate, CanonicalStateContract, ValidationReceipt};
use gaonn_world_time_core::{accept_wp004, EpochDescriptor, WorldTimeState, Wp004Acceptance};

fn root() -> ValidationReceipt {
    CanonicalStateContract
        .validate(&CanonicalCandidate::valid_fixture())
        .expect("Frozen root fixture must validate")
}

fn wp002() -> Wp002ClosureProof {
    Wp002ClosureProof {
        version: 1,
        member_evidence: [11; 9],
        reuse_audit: AuditEvidence {
            work_id: "S1.02.09",
            checked: 1,
            violations: Vec::new(),
            canonical_mutation: false,
            predecessor_digest: 77,
        },
        causal_parent: "WP-002:CLOSED".to_owned(),
    }
}

fn wp004(root: &ValidationReceipt) -> Wp004Acceptance {
    accept_wp004(root, &[true; 9], &[21; 9]).expect("WP-004 fixture must close")
}

fn wp010(wp002: &Wp002ClosureProof) -> Wp010Acceptance {
    Wp010Acceptance {
        work_package: "WP-010",
        member_ids: gaonn_scheduler_core::MEMBER_IDS,
        predecessor_digest64: wp002.digest64(),
        evidence_digest64: 31,
        snapshot_digest64: 32,
        closed: true,
    }
}

fn world_time(tick: i128, microstep: u64) -> WorldTimeState {
    WorldTimeState {
        epoch: EpochDescriptor {
            id: "world-epoch-1".to_owned(),
            unit: "canonical-tick".to_owned(),
            frame: "absolute-world-time".to_owned(),
            version: 1,
            owner: gaonn_world_time_core::OWNER.to_owned(),
            causal_parent: "WP-004:S1.05".to_owned(),
        },
        tick,
        microstep,
        version: 1,
        owner: gaonn_world_time_core::OWNER.to_owned(),
        causal_parent: "WP-004:S1.05.09".to_owned(),
    }
}

fn transaction(id: &str, tick: i128, microstep: u64) -> CanonicalTransaction {
    CanonicalTransaction {
        stable_id: id.to_owned(),
        namespace: "canonical-transaction".to_owned(),
        version: 1,
        owner: TRANSACTION_OWNER.to_owned(),
        causal_episode: format!("episode:{id}"),
        causal_parent: "WP-014:S1.07.01".to_owned(),
        world_time: world_time(tick, microstep),
        lifecycle: TransactionLifecycle::Active,
        lineage: vec![format!("create:{id}:v1")],
    }
}

fn read_set(tx: &CanonicalTransaction, key: &str, version: u64, owner: &str) -> ReadSet {
    ReadSet {
        transaction_id: tx.stable_id.clone(),
        transaction_version: tx.version,
        owner: tx.owner.clone(),
        causal_parent: tx.causal_parent.clone(),
        entries: vec![ReadVersion {
            state_key: key.to_owned(),
            version,
            state_owner: owner.to_owned(),
            state_digest64: version + 1000,
        }],
    }
}

fn write_set(
    tx: &CanonicalTransaction,
    key: &str,
    version: u64,
    owner: &str,
    semantic_key: &str,
) -> WriteIntentSet {
    WriteIntentSet {
        transaction_id: tx.stable_id.clone(),
        transaction_version: tx.version,
        owner: tx.owner.clone(),
        causal_parent: tx.causal_parent.clone(),
        intents: vec![WriteIntent {
            state_key: key.to_owned(),
            base_version: version,
            target_owner: owner.to_owned(),
            proposed_state_digest64: version + 2000,
            semantic_key: semantic_key.to_owned(),
        }],
    }
}

fn pass_guard(
    tx: &CanonicalTransaction,
    reads: &ReadSet,
    writes: &WriteIntentSet,
) -> GuardEvaluation {
    let read_receipt = validate_read_set(tx, reads).unwrap();
    let write_receipt = validate_write_intents(tx, reads, &read_receipt, writes).unwrap();
    evaluate_guards(
        tx,
        &read_receipt,
        &write_receipt,
        GuardPhase::Complete,
        vec![GuardCheck {
            name: "source-defined-precondition".to_owned(),
            passed: true,
            evidence_digest64: 5001,
        }],
    )
    .unwrap()
}

fn buffer_for(tx: &CanonicalTransaction, key: &str, owner: &str) -> SpeculativeResultBuffer {
    let reads = read_set(tx, key, 7, owner);
    let writes = write_set(tx, key, 7, owner, &format!("semantic:{key}"));
    let guard = pass_guard(tx, &reads, &writes);
    build_speculative_buffer(tx, &reads, &writes, &guard, WriteOrigin::TransactionCoordinator)
        .unwrap()
}

fn admission() -> AdmissionReceipt {
    let root = root();
    let wp002 = wp002();
    let wp004 = wp004(&root);
    let wp010 = wp010(&wp002);
    admit_wp014(&root, &wp002, &wp004, &wp010).unwrap()
}

#[test]
fn admission_requires_all_four_frozen_predecessors() {
    let root = root();
    let wp002 = wp002();
    let wp004 = wp004(&root);
    let wp010 = wp010(&wp002);
    let receipt = admit_wp014(&root, &wp002, &wp004, &wp010).unwrap();
    assert_eq!(
        receipt.hard_predecessors,
        ["WP-001", "WP-002", "WP-004", "WP-010"]
    );

    let mut stale_wp010 = wp010.clone();
    stale_wp010.snapshot_digest64 = 0;
    assert_eq!(
        admit_wp014(&root, &wp002, &wp004, &stale_wp010),
        Err(TransactionError::InvalidPredecessor("WP-010"))
    );

    let mut bad_wp004 = wp004;
    bad_wp004.closed = false;
    assert_eq!(
        admit_wp014(&root, &wp002, &bad_wp004, &wp010),
        Err(TransactionError::InvalidPredecessor("WP-004"))
    );
}

#[test]
fn s1_07_01_identity_create_update_retire_and_reuse_prohibition() {
    let mut registry = TransactionRegistry::default();
    registry
        .create(
            transaction("txn-a", 100, 1),
            WriteOrigin::TransactionCoordinator,
        )
        .unwrap();
    assert_eq!(registry.get("txn-a").unwrap().version, 1);
    registry
        .update(
            "txn-a",
            1,
            "cause:update",
            WriteOrigin::TransactionCoordinator,
        )
        .unwrap();
    assert_eq!(registry.get("txn-a").unwrap().version, 2);
    assert!(registry.get("txn-a").unwrap().lineage.len() >= 2);
    let retired = registry
        .retire(
            "txn-a",
            2,
            "cause:retire",
            WriteOrigin::TransactionCoordinator,
        )
        .unwrap();
    assert_eq!(retired.lifecycle, TransactionLifecycle::Retired);
    assert!(matches!(
        registry.get("txn-a"),
        Err(TransactionError::DanglingReference(_))
    ));
    assert!(matches!(
        registry.create(
            transaction("txn-a", 200, 0),
            WriteOrigin::TransactionCoordinator
        ),
        Err(TransactionError::DuplicateOrReusedId(_))
    ));
}

#[test]
fn s1_07_01_wrong_owner_and_observation_paths_leave_registry_unchanged() {
    let mut registry = TransactionRegistry::default();
    let pre = registry.digest64();
    for origin in [
        WriteOrigin::Worker,
        WriteOrigin::Derived,
        WriteOrigin::Observer,
        WriteOrigin::Renderer,
        WriteOrigin::Analytics,
        WriteOrigin::Ui,
        WriteOrigin::Ai,
    ] {
        assert_eq!(
            registry.create(transaction("txn-a", 100, 0), origin),
            Err(TransactionError::UnauthorizedWrite(origin))
        );
        assert_eq!(registry.digest64(), pre);
    }
    let mut wrong = transaction("txn-wrong", 100, 0);
    wrong.owner = "domain28.observer".to_owned();
    assert!(matches!(
        registry.create(wrong, WriteOrigin::TransactionCoordinator),
        Err(TransactionError::WrongOwner(_))
    ));
    assert_eq!(registry.digest64(), pre);
}

#[test]
fn s1_07_02_read_set_contract_is_versioned_complete_and_unique() {
    let tx = transaction("txn-a", 100, 0);
    let reads = read_set(&tx, "inventory.food", 7, "domain11.inventory");
    let receipt = validate_read_set(&tx, &reads).unwrap();
    assert_eq!(receipt.work_id, "S1.07.02");
    assert_eq!(receipt.disposition, Disposition::CandidateOnly);
    assert_ne!(receipt.read_set_digest64, 0);

    let mut duplicate = reads.clone();
    duplicate.entries.push(duplicate.entries[0].clone());
    assert!(matches!(
        validate_read_set(&tx, &duplicate),
        Err(TransactionError::DuplicateReadKey(_))
    ));

    let mut stale = reads;
    stale.transaction_version = 2;
    assert_eq!(
        validate_read_set(&tx, &stale),
        Err(TransactionError::ReferenceMismatch(
            "transaction identity/version/owner/causal parent"
        ))
    );
}

#[test]
fn s1_07_03_write_intent_requires_exact_immutable_read_basis() {
    let tx = transaction("txn-a", 100, 0);
    let reads = read_set(&tx, "inventory.food", 7, "domain11.inventory");
    let read_receipt = validate_read_set(&tx, &reads).unwrap();
    let writes = write_set(
        &tx,
        "inventory.food",
        7,
        "domain11.inventory",
        "inventory.food",
    );
    let receipt = validate_write_intents(&tx, &reads, &read_receipt, &writes).unwrap();
    assert_eq!(receipt.work_id, "S1.07.03");
    assert_ne!(receipt.write_intent_digest64, 0);

    let mut stale = writes.clone();
    stale.intents[0].base_version = 6;
    assert_eq!(
        validate_write_intents(&tx, &reads, &read_receipt, &stale),
        Err(TransactionError::ReferenceMismatch(
            "write-intent immutable pre-state basis"
        ))
    );

    let unrelated = write_set(
        &tx,
        "agent.energy",
        7,
        "domain14.agent_body",
        "agent.energy",
    );
    assert!(matches!(
        validate_write_intents(&tx, &reads, &read_receipt, &unrelated),
        Err(TransactionError::MissingReadBasis(_))
    ));
}

#[test]
fn s1_07_04_guard_phases_do_not_treat_start_as_completion() {
    let tx = transaction("txn-a", 100, 0);
    let reads = read_set(&tx, "inventory.food", 7, "domain11.inventory");
    let writes = write_set(
        &tx,
        "inventory.food",
        7,
        "domain11.inventory",
        "inventory.food",
    );
    let rr = validate_read_set(&tx, &reads).unwrap();
    let wr = validate_write_intents(&tx, &reads, &rr, &writes).unwrap();
    for phase in [
        GuardPhase::Requested,
        GuardPhase::InProgress,
        GuardPhase::Partial,
    ] {
        let result = evaluate_guards(
            &tx,
            &rr,
            &wr,
            phase,
            vec![GuardCheck {
                name: "precondition".to_owned(),
                passed: true,
                evidence_digest64: 1,
            }],
        )
        .unwrap();
        assert_eq!(result.verdict, Verdict::Blocked);
    }
}

#[test]
fn s1_07_04_complete_failed_condition_is_explicit_fail() {
    let tx = transaction("txn-a", 100, 0);
    let reads = read_set(&tx, "inventory.food", 7, "domain11.inventory");
    let writes = write_set(
        &tx,
        "inventory.food",
        7,
        "domain11.inventory",
        "inventory.food",
    );
    let rr = validate_read_set(&tx, &reads).unwrap();
    let wr = validate_write_intents(&tx, &reads, &rr, &writes).unwrap();
    let result = evaluate_guards(
        &tx,
        &rr,
        &wr,
        GuardPhase::Complete,
        vec![GuardCheck {
            name: "precondition".to_owned(),
            passed: false,
            evidence_digest64: 1,
        }],
    )
    .unwrap();
    assert_eq!(result.verdict, Verdict::Fail);
}

#[test]
fn s1_07_05_speculative_buffer_is_candidate_only_and_never_commits() {
    let tx = transaction("txn-a", 100, 0);
    let reads = read_set(&tx, "inventory.food", 7, "domain11.inventory");
    let writes = write_set(
        &tx,
        "inventory.food",
        7,
        "domain11.inventory",
        "inventory.food",
    );
    let guard = pass_guard(&tx, &reads, &writes);
    let buffer = build_speculative_buffer(
        &tx,
        &reads,
        &writes,
        &guard,
        WriteOrigin::TransactionCoordinator,
    )
    .unwrap();
    assert_eq!(buffer.work_id, "S1.07.05");
    assert_eq!(buffer.disposition, Disposition::CandidateOnly);
    assert!(!buffer.canonical_commit_performed);
    assert_eq!(buffer.deltas[0].base_version, 7);
}

#[test]
fn s1_07_05_observer_renderer_worker_cannot_create_speculative_write_path() {
    let tx = transaction("txn-a", 100, 0);
    let reads = read_set(&tx, "inventory.food", 7, "domain11.inventory");
    let writes = write_set(
        &tx,
        "inventory.food",
        7,
        "domain11.inventory",
        "inventory.food",
    );
    let guard = pass_guard(&tx, &reads, &writes);
    for origin in [
        WriteOrigin::Worker,
        WriteOrigin::Observer,
        WriteOrigin::Renderer,
        WriteOrigin::Analytics,
        WriteOrigin::Derived,
    ] {
        assert_eq!(
            build_speculative_buffer(&tx, &reads, &writes, &guard, origin),
            Err(TransactionError::UnauthorizedWrite(origin))
        );
    }
}

#[test]
fn s1_07_06_write_conflict_detection_is_read_only_and_precise() {
    let tx_a = transaction("txn-a", 100, 0);
    let tx_b = transaction("txn-b", 100, 1);
    let a = buffer_for(&tx_a, "inventory.food", "domain11.inventory");
    let b = buffer_for(&tx_b, "inventory.food", "domain11.inventory");
    let source_digest = a.digest64() ^ b.digest64();
    let report = detect_write_conflicts(&[a.clone(), b.clone()]).unwrap();
    assert_eq!(report.work_id, "S1.07.06");
    assert_eq!(report.conflicts.len(), 1);
    assert_eq!(report.pre_digest64, report.post_digest64);
    assert_eq!(source_digest, a.digest64() ^ b.digest64());

    let c = buffer_for(&tx_b, "agent.energy", "domain14.agent_body");
    let clean = detect_write_conflicts(&[a, c]).unwrap();
    assert!(clean.pass());
}

#[test]
fn s1_07_07_resolution_order_ignores_input_and_worker_completion_order() {
    let tx_a = transaction("txn-a", 100, 2);
    let tx_b = transaction("txn-b", 100, 1);
    let a = buffer_for(&tx_a, "inventory.food", "domain11.inventory");
    let b = buffer_for(&tx_b, "agent.energy", "domain14.agent_body");
    let report = detect_write_conflicts(&[a, b]).unwrap();
    assert!(report.pass());

    let input_a = ResolutionInput {
        transaction_id: tx_a.stable_id.clone(),
        world_time: tx_a.world_time.clone(),
        semantic_key: "z-food".to_owned(),
        causal_parent: tx_a.causal_parent.clone(),
        worker_hint: Some("worker-99".to_owned()),
    };
    let input_b = ResolutionInput {
        transaction_id: tx_b.stable_id.clone(),
        world_time: tx_b.world_time.clone(),
        semantic_key: "a-energy".to_owned(),
        causal_parent: tx_b.causal_parent.clone(),
        worker_hint: Some("worker-1".to_owned()),
    };
    let first = deterministic_resolution_order(&report, vec![input_a.clone(), input_b.clone()])
        .unwrap();
    let mut second_a = input_a;
    second_a.worker_hint = Some("worker-1".to_owned());
    let mut second_b = input_b;
    second_b.worker_hint = Some("worker-99".to_owned());
    let second = deterministic_resolution_order(&report, vec![second_b, second_a]).unwrap();
    assert_eq!(first.ordered_transaction_ids, second.ordered_transaction_ids);
    assert_eq!(first.ordering_keys, second.ordering_keys);
    assert_eq!(first.digest64(), second.digest64());
    assert_eq!(first.ordered_transaction_ids, vec!["txn-b", "txn-a"]);
}

#[test]
fn s1_07_08_precommit_hook_preserves_source_defined_invariants_and_conservation() {
    let tx = transaction("txn-a", 100, 0);
    let buffer = buffer_for(&tx, "inventory.food", "domain11.inventory");
    let report = detect_write_conflicts(std::slice::from_ref(&buffer)).unwrap();
    let resolution = deterministic_resolution_order(
        &report,
        vec![ResolutionInput {
            transaction_id: tx.stable_id.clone(),
            world_time: tx.world_time.clone(),
            semantic_key: "inventory.food".to_owned(),
            causal_parent: tx.causal_parent.clone(),
            worker_hint: None,
        }],
    )
    .unwrap();
    let handoff = precommit_invariant_hook(
        &resolution,
        std::slice::from_ref(&buffer),
        &[InvariantCondition {
            name: "inventory-nonnegative".to_owned(),
            passed: true,
            evidence_digest64: 7001,
        }],
        &[ConservationCheck {
            quantity: "food-mass".to_owned(),
            before: 100,
            proposed_delta: -5,
            after: 95,
            evidence_digest64: 7002,
        }],
        "S1.07.08:precommit",
    )
    .unwrap();
    assert!(handoff.eligible_for_future_atomic_commit);
    assert!(!handoff.canonical_commit_performed);
    assert_eq!(handoff.disposition, Disposition::CandidateOnly);
    assert_eq!(buffer.canonical_commit_performed, false);
}

#[test]
fn s1_07_08_failed_invariant_or_conservation_produces_no_commit_handoff() {
    let tx = transaction("txn-a", 100, 0);
    let buffer = buffer_for(&tx, "inventory.food", "domain11.inventory");
    let report = detect_write_conflicts(std::slice::from_ref(&buffer)).unwrap();
    let resolution = deterministic_resolution_order(
        &report,
        vec![ResolutionInput {
            transaction_id: tx.stable_id.clone(),
            world_time: tx.world_time.clone(),
            semantic_key: "inventory.food".to_owned(),
            causal_parent: tx.causal_parent.clone(),
            worker_hint: None,
        }],
    )
    .unwrap();
    let pre = buffer.digest64();
    assert!(matches!(
        precommit_invariant_hook(
            &resolution,
            std::slice::from_ref(&buffer),
            &[InvariantCondition {
                name: "nonnegative".to_owned(),
                passed: false,
                evidence_digest64: 1,
            }],
            &[],
            "S1.07.08:precommit"
        ),
        Err(TransactionError::InvariantFailure(_))
    ));
    assert!(matches!(
        precommit_invariant_hook(
            &resolution,
            std::slice::from_ref(&buffer),
            &[],
            &[ConservationCheck {
                quantity: "mass".to_owned(),
                before: 100,
                proposed_delta: -5,
                after: 96,
                evidence_digest64: 1,
            }],
            "S1.07.08:precommit"
        ),
        Err(TransactionError::ConservationFailure(_))
    ));
    assert_eq!(pre, buffer.digest64());
}

#[test]
fn persistence_restore_and_replay_preserve_pending_candidate_state_and_event_order() {
    let tx = transaction("txn-a", 100, 0);
    let mut registry = TransactionRegistry::default();
    registry
        .create(tx.clone(), WriteOrigin::TransactionCoordinator)
        .unwrap();
    let buffer = buffer_for(&tx, "inventory.food", "domain11.inventory");
    let snapshot = TransactionSnapshot::new(
        "snapshot:wp014:1",
        "causal-cut:100:0",
        registry.clone(),
        vec![buffer.clone()],
        MEMBER_IDS.iter().map(|id| (*id).to_owned()).collect(),
    )
    .unwrap();
    let digest = snapshot.digest64().unwrap();
    let (restored_registry, restored_buffers, restored_order) = snapshot.restore().unwrap();
    assert_eq!(restored_registry, registry);
    assert_eq!(restored_buffers, vec![buffer]);
    assert_eq!(restored_order, MEMBER_IDS);
    assert_eq!(snapshot.digest64().unwrap(), digest);
}

#[test]
fn corrupt_snapshot_is_rejected_before_restore() {
    let snapshot = TransactionSnapshot::new(
        "snapshot:wp014:1",
        "causal-cut:100:0",
        TransactionRegistry::default(),
        Vec::new(),
        Vec::new(),
    )
    .unwrap();
    let mut corrupt = snapshot;
    corrupt.evidence_hash64 ^= 1;
    assert_eq!(corrupt.restore(), Err(TransactionError::CorruptSnapshot));
}

#[test]
fn wp014_acceptance_requires_all_eight_members_snapshot_and_precommit_evidence() {
    let admission = admission();
    let tx = transaction("txn-a", 100, 0);
    let mut registry = TransactionRegistry::default();
    registry
        .create(tx.clone(), WriteOrigin::TransactionCoordinator)
        .unwrap();
    let buffer = buffer_for(&tx, "inventory.food", "domain11.inventory");
    let report = detect_write_conflicts(std::slice::from_ref(&buffer)).unwrap();
    let resolution = deterministic_resolution_order(
        &report,
        vec![ResolutionInput {
            transaction_id: tx.stable_id.clone(),
            world_time: tx.world_time.clone(),
            semantic_key: "inventory.food".to_owned(),
            causal_parent: tx.causal_parent.clone(),
            worker_hint: None,
        }],
    )
    .unwrap();
    let handoff = precommit_invariant_hook(
        &resolution,
        std::slice::from_ref(&buffer),
        &[InvariantCondition {
            name: "valid".to_owned(),
            passed: true,
            evidence_digest64: 1,
        }],
        &[],
        "S1.07.08:precommit",
    )
    .unwrap();
    let snapshot = TransactionSnapshot::new(
        "snapshot:wp014:accept",
        "causal-cut:100:0",
        registry,
        vec![buffer],
        MEMBER_IDS.iter().map(|id| (*id).to_owned()).collect(),
    )
    .unwrap();
    let accepted = accept_wp014(&admission, &[true; 8], &[81; 8], &snapshot, &handoff)
        .unwrap();
    assert!(accepted.closed);
    assert_eq!(accepted.member_ids, MEMBER_IDS);
    assert_ne!(accepted.snapshot_digest64, 0);
    assert_ne!(accepted.precommit_handoff_digest64, 0);

    let mut missing = [true; 8];
    missing[6] = false;
    assert_eq!(
        accept_wp014(&admission, &missing, &[81; 8], &snapshot, &handoff),
        Err(TransactionError::MissingMemberEvidence("S1.07.07"))
    );
}

#[test]
fn integration_s1_07_01_through_s1_07_08_has_no_commit_shortcut() {
    let _admission = admission();
    let tx = transaction("txn-integration", 400, 3);
    let mut registry = TransactionRegistry::default();
    registry
        .create(tx.clone(), WriteOrigin::TransactionCoordinator)
        .unwrap();
    let reads = read_set(&tx, "inventory.food", 9, "domain11.inventory");
    let read_receipt = validate_read_set(&tx, &reads).unwrap();
    let writes = write_set(
        &tx,
        "inventory.food",
        9,
        "domain11.inventory",
        "inventory.food",
    );
    let write_receipt = validate_write_intents(&tx, &reads, &read_receipt, &writes).unwrap();
    let guard = evaluate_guards(
        &tx,
        &read_receipt,
        &write_receipt,
        GuardPhase::Complete,
        vec![GuardCheck {
            name: "guard".to_owned(),
            passed: true,
            evidence_digest64: 901,
        }],
    )
    .unwrap();
    let buffer = build_speculative_buffer(
        &tx,
        &reads,
        &writes,
        &guard,
        WriteOrigin::TransactionCoordinator,
    )
    .unwrap();
    let report = detect_write_conflicts(std::slice::from_ref(&buffer)).unwrap();
    let resolution = deterministic_resolution_order(
        &report,
        vec![ResolutionInput {
            transaction_id: tx.stable_id.clone(),
            world_time: tx.world_time.clone(),
            semantic_key: "inventory.food".to_owned(),
            causal_parent: tx.causal_parent.clone(),
            worker_hint: Some("non-causal-worker-hint".to_owned()),
        }],
    )
    .unwrap();
    let handoff = precommit_invariant_hook(
        &resolution,
        &[buffer],
        &[InvariantCondition {
            name: "guard-remains-valid".to_owned(),
            passed: true,
            evidence_digest64: 902,
        }],
        &[ConservationCheck {
            quantity: "food-mass".to_owned(),
            before: 100,
            proposed_delta: 0,
            after: 100,
            evidence_digest64: 903,
        }],
        "S1.07.08:integration",
    )
    .unwrap();
    assert_eq!(handoff.work_id, "S1.07.08");
    assert_eq!(handoff.ordered_transaction_ids, vec![tx.stable_id]);
    assert!(handoff.eligible_for_future_atomic_commit);
    assert!(!handoff.canonical_commit_performed);
    assert_eq!(registry.get("txn-integration").unwrap().version, 1);
}
