use gaonn_multi_rate_coupling_core::*;
use gaonn_scheduler_core::Wp010Acceptance;
use gaonn_world_time_core::{EpochDescriptor, WorldTimeState, Wp004Acceptance};

fn wp004() -> Wp004Acceptance {
    Wp004Acceptance {
        work_package: "WP-004",
        member_ids: gaonn_world_time_core::MEMBER_IDS,
        predecessor_digest64: 11,
        evidence_digest64: 12,
        closed: true,
    }
}

fn wp010() -> Wp010Acceptance {
    Wp010Acceptance {
        work_package: "WP-010",
        member_ids: gaonn_scheduler_core::MEMBER_IDS,
        predecessor_digest64: 21,
        evidence_digest64: 22,
        snapshot_digest64: 23,
        closed: true,
    }
}

fn time(tick: i128, microstep: u64) -> WorldTimeState {
    WorldTimeState {
        epoch: EpochDescriptor {
            id: "epoch:gaonn".to_owned(),
            unit: "ns".to_owned(),
            frame: "absolute".to_owned(),
            version: gaonn_world_time_core::SCHEMA_VERSION,
            owner: gaonn_world_time_core::OWNER.to_owned(),
            causal_parent: "root:time".to_owned(),
        },
        tick,
        microstep,
        version: gaonn_world_time_core::SCHEMA_VERSION,
        owner: gaonn_world_time_core::OWNER.to_owned(),
        causal_parent: "root:time".to_owned(),
    }
}

fn window() -> CouplingWindow {
    CouplingWindow {
        stable_id: "window:1".to_owned(),
        version: SCHEMA_VERSION,
        owner: OWNER.to_owned(),
        class: CouplingClass::Cc2,
        start: time(100, 0),
        end: time(200, 0),
        validity_horizon_tick: 180,
        causal_parent: "WP-004+WP-010".to_owned(),
        disposition: Disposition::CandidateOnly,
    }
}

fn classification() -> ClassificationHandoff {
    classify_process(
        &window(),
        "process:atmosphere-ocean",
        SCHEMA_VERSION,
        "domain5.atmosphere",
        "domain6.ocean",
        ProcessRate::Fast,
        "S1.09.01:window:1",
    )
    .unwrap()
}

fn packet(id: &str, amount: i128) -> TypedFluxPacket {
    TypedFluxPacket {
        stable_id: id.to_owned(),
        version: SCHEMA_VERSION,
        owner: OWNER.to_owned(),
        source_domain_owner: "domain5.atmosphere".to_owned(),
        target_domain_owner: "domain6.ocean".to_owned(),
        quantity: "energy".to_owned(),
        unit: "nanojoule".to_owned(),
        frame: "window-integrated".to_owned(),
        integrated_amount: amount,
        window_id: "window:1".to_owned(),
        window_version: SCHEMA_VERSION,
        causal_parent: "S1.09.02:process:atmosphere-ocean".to_owned(),
        disposition: Disposition::CandidateOnly,
    }
}

fn boundary() -> BoundaryStateSnapshot {
    BoundaryStateSnapshot::new(BoundarySnapshotInput {
        snapshot_id: "snapshot:window:1",
        commit_marker: "committed-cut:99",
        causal_cut: "cut:99",
        recovery_position: "recovery:99",
        replay_reference: "replay:window:1",
        committed_pre_state_digest64: 1001,
        recompute_refs: vec![RecomputeReference {
            stable_id: "packet:a".to_owned(),
            version: SCHEMA_VERSION,
            causal_parent: "S1.09.03".to_owned(),
            source_digest64: 1002,
        }],
        event_order: vec!["S1.09.04".to_owned()],
    })
    .unwrap()
}

fn rollback_request(
    window: &CouplingWindow,
    sync: &SynchronizationPoint,
    class: RollbackClass,
    committed_frontier_tick: i128,
    target_tick: i128,
    post_commit: bool,
    origin: WriteOrigin,
) -> Result<RollbackCandidate, CouplingError> {
    request_precommit_rollback(RollbackRequest {
        window,
        sync,
        class,
        committed_frontier_tick,
        target_tick,
        post_commit,
        causal_parent: "S1.09.08",
        origin,
    })
}

fn complete_sync() -> SynchronizationPoint {
    let w = window();
    let localized = localize_event(
        &w,
        "event:crossing",
        ProcessPhase::Complete,
        140,
        160,
        Some(150),
        "S1.09.06:exchange",
    )
    .unwrap();
    synchronize(
        &w,
        ProcessPhase::Complete,
        &[
            ("fast".to_owned(), time(160, 0)),
            ("slow".to_owned(), time(160, 0)),
        ],
        &[localized],
        "S1.09.07:event:crossing",
    )
    .unwrap()
}

#[test]
fn admission_requires_exact_wp004_and_wp010_pass_evidence() {
    let receipt = admit_wp015(&wp004(), &wp010()).unwrap();
    assert_eq!(receipt.hard_predecessors, ["WP-004", "WP-010"]);
    let mut stale = wp010();
    stale.snapshot_digest64 = 0;
    assert_eq!(
        admit_wp015(&wp004(), &stale),
        Err(CouplingError::InvalidPredecessor("WP-010"))
    );
}

#[test]
fn s1_09_01_window_contract_uses_absolute_worldtime_without_fixed_global_tick() {
    let w = window();
    assert_ne!(
        validate_window_contract(&w, WriteOrigin::CouplingRuntime).unwrap(),
        0
    );
    let mut invalid = w;
    invalid.validity_horizon_tick = 250;
    assert_eq!(
        validate_window_contract(&invalid, WriteOrigin::CouplingRuntime),
        Err(CouplingError::InvalidValidityHorizon)
    );
}

#[test]
fn s1_09_01_read_only_origins_cannot_write_coupling_contract() {
    let w = window();
    for origin in [
        WriteOrigin::Derived,
        WriteOrigin::Observer,
        WriteOrigin::Renderer,
        WriteOrigin::Analytics,
        WriteOrigin::Ui,
        WriteOrigin::Ai,
        WriteOrigin::Worker,
        WriteOrigin::DomainOwner,
    ] {
        assert_eq!(
            validate_window_contract(&w, origin),
            Err(CouplingError::UnauthorizedWrite(origin))
        );
    }
}

#[test]
fn s1_09_02_interface_preserves_domain_ownership_and_does_not_reverse_write() {
    let handoff = classification();
    assert_eq!(handoff.rate, ProcessRate::Fast);
    assert!(!handoff.interface_writes_domain_state);
    assert_eq!(handoff.disposition, Disposition::CandidateOnly);
    assert_eq!(
        classify_process(
            &window(),
            "process:self",
            SCHEMA_VERSION,
            "domain5.atmosphere",
            "domain5.atmosphere",
            ProcessRate::Slow,
            "S1.09.01"
        ),
        Err(CouplingError::InvalidInterfaceBoundary)
    );
}

#[test]
fn s1_09_03_typed_flux_packet_enforces_unit_frame_version_and_authority_link() {
    let w = window();
    let c = classification();
    let p = packet("packet:a", 40);
    p.validate_against(&w, &c).unwrap();
    let mut wrong = p;
    wrong.target_domain_owner = "domain7.soil".to_owned();
    assert_eq!(
        wrong.validate_against(&w, &c),
        Err(CouplingError::ReferenceMismatch("S1.09.02 classification"))
    );
}

#[test]
fn s1_09_04_snapshot_is_committed_cut_only_and_restore_is_digest_stable() {
    let snapshot = boundary();
    let digest = snapshot.digest64().unwrap();
    let restored = snapshot.restore().unwrap();
    assert_eq!(restored.digest64().unwrap(), digest);
    assert_eq!(restored.recompute_refs.len(), 1);
    let mut corrupt = restored;
    corrupt.commit_marker.clear();
    assert_eq!(
        corrupt.restore(),
        Err(CouplingError::MissingField("snapshot.commit_marker"))
    );
}

#[test]
fn s1_09_05_substep_accumulation_is_exact_order_independent_and_typed() {
    let w = window();
    let c = classification();
    let a = accumulate_flux(&w, &c, &[packet("packet:b", 30), packet("packet:a", 20)]).unwrap();
    let b = accumulate_flux(&w, &c, &[packet("packet:a", 20), packet("packet:b", 30)]).unwrap();
    assert_eq!(a.integrated_amount, 50);
    assert_eq!(a.packet_ids, b.packet_ids);
    assert_eq!(a.evidence_digest64, b.evidence_digest64);
    let mut wrong_unit = packet("packet:c", 1);
    wrong_unit.unit = "joule".to_owned();
    assert_eq!(
        accumulate_flux(&w, &c, &[packet("packet:a", 1), wrong_unit]),
        Err(CouplingError::TypedFluxMismatch)
    );
}

#[test]
fn s1_09_05_accumulation_overflow_fails_closed() {
    let w = window();
    let c = classification();
    assert_eq!(
        accumulate_flux(
            &w,
            &c,
            &[packet("packet:a", i128::MAX), packet("packet:b", 1)]
        ),
        Err(CouplingError::ArithmeticOverflow)
    );
}

#[test]
fn s1_09_06_exchange_is_conservative_candidate_only_and_never_domain_commit() {
    let w = window();
    let c = classification();
    let accumulator =
        accumulate_flux(&w, &c, &[packet("packet:a", 25), packet("packet:b", 75)]).unwrap();
    let exchange = build_conservative_exchange(
        &accumulator,
        "S1.09.05:accumulator",
        WriteOrigin::CouplingRuntime,
    )
    .unwrap();
    assert_eq!(exchange.source_delta, -100);
    assert_eq!(exchange.target_delta, 100);
    assert_eq!(exchange.residual, 0);
    assert!(!exchange.canonical_commit_performed);
    assert_eq!(exchange.disposition, Disposition::CandidateOnly);
}

#[test]
fn s1_09_07_event_localization_keeps_phase_semantics_and_cannot_skip_crossing() {
    let w = window();
    let partial = localize_event(
        &w,
        "event:crossing",
        ProcessPhase::Partial,
        140,
        160,
        None,
        "S1.09.06",
    )
    .unwrap();
    assert!(!partial.eligible_for_sync);
    assert_eq!(
        localize_event(
            &w,
            "event:crossing",
            ProcessPhase::Complete,
            140,
            160,
            Some(170),
            "S1.09.06"
        ),
        Err(CouplingError::EventOutsideWindow)
    );
}

#[test]
fn s1_09_08_synchronization_requires_exact_causal_frontier_and_completed_events() {
    let w = window();
    let localized = localize_event(
        &w,
        "event:crossing",
        ProcessPhase::Complete,
        140,
        160,
        Some(150),
        "S1.09.06",
    )
    .unwrap();
    let sync = synchronize(
        &w,
        ProcessPhase::Complete,
        &[
            ("fast".to_owned(), time(160, 0)),
            ("slow".to_owned(), time(160, 0)),
        ],
        std::slice::from_ref(&localized),
        "S1.09.07",
    )
    .unwrap();
    assert!(sync.eligible_for_precommit);
    assert!(!sync.canonical_commit_performed);
    assert_eq!(
        synchronize(
            &w,
            ProcessPhase::Complete,
            &[
                ("fast".to_owned(), time(160, 0)),
                ("slow".to_owned(), time(161, 0))
            ],
            &[localized],
            "S1.09.07"
        ),
        Err(CouplingError::SynchronizationIncomplete)
    );
}

#[test]
fn s1_09_09_rollback_is_bounded_precommit_only_for_all_frozen_classes() {
    let w = window();
    let sync = complete_sync();
    for class in [
        RollbackClass::Rb0SolverReject,
        RollbackClass::Rb1Window,
        RollbackClass::Rb2Closure,
        RollbackClass::Rb3TransactionAbort,
    ] {
        let rollback = rollback_request(
            &w,
            &sync,
            class,
            110,
            130,
            false,
            WriteOrigin::CouplingRuntime,
        )
        .unwrap();
        assert!(!rollback.canonical_commit_performed);
    }
    assert_eq!(
        rollback_request(
            &w,
            &sync,
            RollbackClass::Rb1Window,
            110,
            130,
            true,
            WriteOrigin::CouplingRuntime,
        ),
        Err(CouplingError::PostCommitRollbackProhibited)
    );
}

#[test]
fn s1_09_10_horizon_contract_rejects_out_of_bound_wrong_owner_and_reverse_write() {
    let w = window();
    let sync = complete_sync();
    let rollback = rollback_request(
        &w,
        &sync,
        RollbackClass::Rb1Window,
        110,
        130,
        false,
        WriteOrigin::CouplingRuntime,
    )
    .unwrap();
    let receipt = validate_rollback_horizon(
        &rollback,
        SCHEMA_VERSION,
        OWNER,
        110,
        160,
        "S1.09.09",
        WriteOrigin::CouplingRuntime,
    )
    .unwrap();
    assert_eq!(receipt.accepted_target_tick, 130);
    assert_eq!(
        validate_rollback_horizon(
            &rollback,
            SCHEMA_VERSION,
            "domain5.atmosphere",
            110,
            160,
            "S1.09.09",
            WriteOrigin::CouplingRuntime,
        ),
        Err(CouplingError::WrongOwner("domain5.atmosphere".to_owned()))
    );
    assert_eq!(
        validate_rollback_horizon(
            &rollback,
            SCHEMA_VERSION,
            OWNER,
            110,
            160,
            "S1.09.09",
            WriteOrigin::Observer,
        ),
        Err(CouplingError::UnauthorizedWrite(WriteOrigin::Observer))
    );
}

#[test]
fn persistence_restore_and_replay_preserve_committed_cut_identity_and_event_order() {
    let snapshot = CouplingStateSnapshot {
        schema_version: SCHEMA_VERSION,
        snapshot_marker: "snapshot:wp015".to_owned(),
        causal_cut: "cut:99".to_owned(),
        boundary: boundary(),
        event_order: MEMBER_IDS.iter().map(|id| (*id).to_owned()).collect(),
        canonical_commit_performed: false,
    };
    let digest = snapshot.digest64().unwrap();
    let restored = snapshot.restore().unwrap();
    assert_eq!(restored.digest64().unwrap(), digest);
    assert_eq!(restored.event_order, snapshot.event_order);
}

#[test]
fn wp015_acceptance_requires_all_members_and_exact_replay_digest() {
    let admission = admit_wp015(&wp004(), &wp010()).unwrap();
    let snapshot = CouplingStateSnapshot {
        schema_version: SCHEMA_VERSION,
        snapshot_marker: "snapshot:wp015".to_owned(),
        causal_cut: "cut:99".to_owned(),
        boundary: boundary(),
        event_order: MEMBER_IDS.iter().map(|id| (*id).to_owned()).collect(),
        canonical_commit_performed: false,
    };
    let digest = snapshot.digest64().unwrap();
    let acceptance = accept_wp015(&admission, &[true; 10], &[1; 10], &snapshot, digest).unwrap();
    assert!(acceptance.closed);
    assert!(!acceptance.canonical_commit_performed);
    let mut passes = [true; 10];
    passes[6] = false;
    assert_eq!(
        accept_wp015(&admission, &passes, &[1; 10], &snapshot, digest),
        Err(CouplingError::MissingMemberEvidence("S1.09.07"))
    );
    assert_eq!(
        accept_wp015(&admission, &[true; 10], &[1; 10], &snapshot, digest + 1),
        Err(CouplingError::ReplayDigestMismatch)
    );
}

#[test]
fn integration_s1_09_01_through_s1_09_10_has_no_shortcut_or_canonical_commit() {
    let admission = admit_wp015(&wp004(), &wp010()).unwrap();
    let w = window();
    validate_window_contract(&w, WriteOrigin::CouplingRuntime).unwrap();
    let c = classification();
    let packets = [packet("packet:a", 40), packet("packet:b", 60)];
    for p in &packets {
        p.validate_against(&w, &c).unwrap();
    }
    let boundary = BoundaryStateSnapshot::new(BoundarySnapshotInput {
        snapshot_id: "snapshot:integration",
        commit_marker: "committed-cut:99",
        causal_cut: "cut:99",
        recovery_position: "recovery:99",
        replay_reference: "replay:integration",
        committed_pre_state_digest64: 333,
        recompute_refs: packets
            .iter()
            .map(|p| RecomputeReference {
                stable_id: p.stable_id.clone(),
                version: p.version,
                causal_parent: p.causal_parent.clone(),
                source_digest64: p.digest64(),
            })
            .collect(),
        event_order: vec!["S1.09.04".to_owned()],
    })
    .unwrap();
    let accumulator = accumulate_flux(&w, &c, &packets).unwrap();
    let exchange =
        build_conservative_exchange(&accumulator, "S1.09.05", WriteOrigin::CouplingRuntime)
            .unwrap();
    assert!(!exchange.canonical_commit_performed);
    let localized = localize_event(
        &w,
        "event:integration",
        ProcessPhase::Complete,
        145,
        155,
        Some(150),
        "S1.09.06",
    )
    .unwrap();
    let sync = synchronize(
        &w,
        ProcessPhase::Complete,
        &[
            ("fast".to_owned(), time(160, 0)),
            ("slow".to_owned(), time(160, 0)),
        ],
        &[localized],
        "S1.09.07",
    )
    .unwrap();
    let rollback = rollback_request(
        &w,
        &sync,
        RollbackClass::Rb1Window,
        110,
        130,
        false,
        WriteOrigin::CouplingRuntime,
    )
    .unwrap();
    validate_rollback_horizon(
        &rollback,
        SCHEMA_VERSION,
        OWNER,
        110,
        160,
        "S1.09.09",
        WriteOrigin::CouplingRuntime,
    )
    .unwrap();
    let snapshot = CouplingStateSnapshot {
        schema_version: SCHEMA_VERSION,
        snapshot_marker: "snapshot:wp015:integration".to_owned(),
        causal_cut: "cut:99".to_owned(),
        boundary,
        event_order: MEMBER_IDS.iter().map(|id| (*id).to_owned()).collect(),
        canonical_commit_performed: false,
    };
    let digest = snapshot.digest64().unwrap();
    let acceptance = accept_wp015(&admission, &[true; 10], &[1; 10], &snapshot, digest).unwrap();
    assert!(acceptance.closed);
    assert!(!acceptance.canonical_commit_performed);
}
