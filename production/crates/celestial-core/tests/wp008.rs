use gaonn_celestial_core::*;
use gaonn_planetary_space_core::Acceptance as SpaceAcceptance;
use gaonn_world_time_core::{EpochDescriptor, WorldTimeState, Wp004Acceptance};
use std::collections::BTreeSet;

fn space_acceptance() -> SpaceAcceptance {
    SpaceAcceptance {
        work_package: "WP-003",
        member_ids: gaonn_planetary_space_core::MEMBER_IDS,
        predecessor_digest: 11,
        evidence_digest: 33,
        closed: true,
    }
}

fn time_acceptance() -> Wp004Acceptance {
    Wp004Acceptance {
        work_package: "WP-004",
        member_ids: gaonn_world_time_core::MEMBER_IDS,
        predecessor_digest64: 22,
        evidence_digest64: 44,
        closed: true,
    }
}

fn admission() -> Wp008Admission {
    admit(&space_acceptance(), &time_acceptance()).unwrap()
}

fn world_time(tick: i128) -> WorldTimeState {
    WorldTimeState {
        epoch: EpochDescriptor {
            id: "world-epoch-0".into(),
            unit: "tick".into(),
            frame: "absolute".into(),
            version: 1,
            owner: gaonn_world_time_core::OWNER.into(),
            causal_parent: "WP-004:closed".into(),
        },
        tick,
        microstep: 0,
        version: 1,
        owner: gaonn_world_time_core::OWNER.into(),
        causal_parent: "event:time".into(),
    }
}

fn receipt(celestial_id: &str, tick: i128) -> ContractReceipt {
    let input = ContractInput {
        celestial_id: celestial_id.into(),
        frame_id: "earth-reference-frame".into(),
        source_version: 1,
        owner: OWNER.into(),
        causal_parent: "frozen-root:pa057".into(),
        world_time: world_time(tick),
        transition: "represent".into(),
        allowed_transitions: BTreeSet::from(["represent".into(), "revise".into()]),
        origin: WriteOrigin::OwningResolver,
    };
    validate_contract(&admission(), &input).unwrap()
}

fn identity(id: &str, namespace: &str) -> StateIdentity {
    StateIdentity {
        stable_id: id.into(),
        namespace: namespace.into(),
        version: 1,
        owner: OWNER.into(),
        causal_parent: "event:create".into(),
        predecessor: None,
        status: RecordStatus::Active,
    }
}

fn frame_record(tick: i128) -> FrameRecord {
    FrameRecord {
        identity: identity("frame-1", "celestial.frame"),
        celestial_id: "earth".into(),
        origin: [0.0, 0.0, 0.0],
        x_axis: [1.0, 0.0, 0.0],
        y_axis: [0.0, 1.0, 0.0],
        z_axis: [0.0, 0.0, 1.0],
        reference_epoch_id: "world-epoch-0".into(),
        reference_tick: tick,
    }
}

fn frame_registry(tick: i128) -> (FrameRegistry, FrameRecord) {
    let mut registry = FrameRegistry::default();
    let frame = frame_record(tick);
    registry
        .create(&receipt("earth", tick), frame.clone(), WriteOrigin::OwningResolver)
        .unwrap();
    (registry, frame)
}

fn rotation(frame: &FrameRecord, tick: i128) -> RotationState {
    RotationState {
        identity: identity("rotation-1", "celestial.rotation"),
        frame_ref: frame.identity.reference(),
        celestial_id: "earth".into(),
        axis_unit: [0.0, 0.0, 1.0],
        phase_rad: 0.25,
        angular_velocity_rad_per_tick: 0.000_072_921_15,
        reference_epoch_id: "world-epoch-0".into(),
        reference_tick: tick,
    }
}

fn orbit(frame: &FrameRecord, tick: i128) -> OrbitalState {
    OrbitalState {
        identity: identity("orbit-1", "celestial.orbit"),
        frame_ref: frame.identity.reference(),
        celestial_id: "earth".into(),
        position: [149_597_870_700.0, 0.0, 0.0],
        position_unit: "m".into(),
        velocity: [0.0, 29_780.0, 0.0],
        velocity_unit: "m/s".into(),
        reference_epoch_id: "world-epoch-0".into(),
        reference_tick: tick,
    }
}

fn lunar(frame: &FrameRecord, tick: i128) -> LunarState {
    LunarState {
        identity: identity("lunar-1", "celestial.lunar"),
        frame_ref: frame.identity.reference(),
        celestial_id: "moon".into(),
        position: [384_400_000.0, 0.0, 0.0],
        position_unit: "m".into(),
        velocity: [0.0, 1_022.0, 0.0],
        velocity_unit: "m/s".into(),
        reference_epoch_id: "world-epoch-0".into(),
        reference_tick: tick,
    }
}

fn anchor() -> AstronomicalEpochAnchor {
    AstronomicalEpochAnchor {
        stable_id: "astro-anchor-1".into(),
        version: 1,
        owner: OWNER.into(),
        world_epoch_id: "world-epoch-0".into(),
        world_tick_at_anchor: 1_000,
        astronomical_tick_at_anchor: 2_000_000,
        astronomical_unit: "tick".into(),
        causal_parent: "event:anchor".into(),
    }
}

#[test]
fn admission_requires_both_hard_predecessors_closed_with_evidence() {
    assert_eq!(admission().space_evidence_digest64, 33);
    let mut broken = space_acceptance();
    broken.closed = false;
    assert_eq!(admit(&broken, &time_acceptance()), Err(CelestialError::InvalidPredecessor));
    let mut stale = time_acceptance();
    stale.evidence_digest64 = 0;
    assert_eq!(admit(&space_acceptance(), &stale), Err(CelestialError::InvalidPredecessor));
}

#[test]
fn s4_01_01_contract_is_candidate_only_and_rejects_missing_wrong_owner_and_transition() {
    let ok = receipt("earth", 1_234);
    assert_eq!(ok.work_id, "S4.01.01");
    assert_eq!(ok.disposition, CandidateDisposition::CandidateOnly);
    assert_eq!(ok.operands, ["Celestial", "Frame"]);

    let mut input = ContractInput {
        celestial_id: "earth".into(), frame_id: "frame".into(), source_version: 1,
        owner: "observer".into(), causal_parent: "cause".into(), world_time: world_time(1),
        transition: "represent".into(), allowed_transitions: BTreeSet::from(["represent".into()]),
        origin: WriteOrigin::OwningResolver,
    };
    assert!(matches!(validate_contract(&admission(), &input), Err(CelestialError::WrongOwner(_))));
    input.owner = OWNER.into();
    input.transition = "invented".into();
    assert!(matches!(validate_contract(&admission(), &input), Err(CelestialError::ProhibitedTransition(_))));
}

#[test]
fn s4_01_02_reference_frame_has_versioned_create_read_update_retire_boundary() {
    let tick = 5;
    let mut registry = FrameRegistry::default();
    let first = frame_record(tick);
    let first_ref = registry.create(&receipt("earth", tick), first.clone(), WriteOrigin::OwningResolver).unwrap();
    assert_eq!(registry.get("frame-1").unwrap(), &first);
    assert!(matches!(registry.create(&receipt("earth", tick), first.clone(), WriteOrigin::OwningResolver), Err(CelestialError::DuplicateStableId(_))));

    let mut second = first.clone();
    second.identity.version = 2;
    second.identity.predecessor = Some(first_ref);
    second.identity.causal_parent = "event:update".into();
    second.reference_tick = 6;
    let second_ref = registry.update(&receipt("earth", tick), second, WriteOrigin::OwningResolver).unwrap();
    assert_eq!(second_ref.version, 2);
    let retired = registry.retire("frame-1", 3, "event:retire", WriteOrigin::OwningResolver).unwrap();
    assert_eq!(retired.version, 3);
    assert!(matches!(registry.get("frame-1"), Err(CelestialError::RetiredRecord(_))));
}

#[test]
fn s4_01_03_rotation_state_preserves_frame_time_owner_and_rejects_invalid_axis() {
    let tick = 9;
    let (_, frame) = frame_registry(tick);
    let state = rotation(&frame, tick);
    assert_eq!(validate_rotation(&receipt("earth", tick), &frame, &state, WriteOrigin::OwningResolver), Ok(()));
    let mut invalid = state.clone(); invalid.axis_unit = [0.0, 0.0, 2.0];
    assert!(matches!(validate_rotation(&receipt("earth", tick), &frame, &invalid, WriteOrigin::OwningResolver), Err(CelestialError::InvalidNumeric(_))));
}

#[test]
fn s4_01_04_orbital_state_is_versioned_unit_explicit_and_same_cut() {
    let tick = 10;
    let (_, frame) = frame_registry(tick);
    let state = orbit(&frame, tick);
    assert_eq!(validate_orbit(&receipt("earth", tick), &frame, &state, WriteOrigin::OwningResolver), Ok(()));
    let mut invalid = state.clone(); invalid.position_unit.clear();
    assert_eq!(validate_orbit(&receipt("earth", tick), &frame, &invalid, WriteOrigin::OwningResolver), Err(CelestialError::MissingField("orbit.position_unit")));
}

#[test]
fn s4_01_05_solar_forcing_emits_domain1_port_without_downstream_response() {
    let tick = 12;
    let (_, frame) = frame_registry(tick);
    let forcing = solar_forcing(&orbit(&frame, tick), [-1.0, 0.0, 0.0], 1361.0, "event:solar").unwrap();
    assert_eq!(forcing.sun_direction_unit, [-1.0, 0.0, 0.0]);
    assert_eq!(forcing.normal_irradiance_w_m2, 1361.0);
    assert_eq!(forcing.disposition, CandidateDisposition::CandidateOnly);
    assert!(matches!(solar_forcing(&orbit(&frame, tick), [0.0; 3], 1361.0, "event:solar"), Err(CelestialError::InvalidNumeric(_))));
}

#[test]
fn s4_01_06_lunar_state_keeps_reference_frame_and_time_cut() {
    let tick = 14;
    let (_, frame) = frame_registry(tick);
    let moon = lunar(&frame, tick);
    assert_eq!(validate_lunar(&receipt("moon", tick), &frame, &moon, WriteOrigin::OwningResolver), Ok(()));
    let mut wrong = moon.clone(); wrong.reference_epoch_id = "other-epoch".into();
    assert_eq!(validate_lunar(&receipt("moon", tick), &frame, &wrong, WriteOrigin::OwningResolver), Err(CelestialError::ReferenceMismatch("lunar epoch")));
}

#[test]
fn s4_01_07_tidal_interface_preserves_source_version_owner_cut_and_rejects_partial_handoff() {
    let tick = 16;
    let (_, frame) = frame_registry(tick);
    let moon = lunar(&frame, tick);
    let handoff = tidal_forcing_handoff(&moon, "surface-cell-1", [1.0, 0.0, 0.0], 2.0, "m2/s2", "event:tide").unwrap();
    assert_eq!(validate_tidal_handoff(&handoff, &moon), Ok(()));
    assert!((handoff.tidal_potential - 2.0).abs() < 1.0e-12);
    let mut partial = handoff.clone(); partial.target_location_ref.clear();
    assert_eq!(validate_tidal_handoff(&partial, &moon), Err(CelestialError::MissingField("tidal.target_location_ref")));
}

#[test]
fn s4_01_08_continuous_astronomical_time_mapping_is_exact_and_calendar_free() {
    let mapped = map_astronomical_time(&world_time(1_250), &anchor(), "event:map").unwrap();
    assert_eq!(mapped.astronomical_tick, 2_000_250);
    assert_eq!(mapped.astronomical_unit, "tick");
    let replay = map_astronomical_time(&world_time(1_250), &anchor(), "event:map").unwrap();
    assert_eq!(mapped, replay);
}

#[test]
fn authority_boundary_blocks_observer_renderer_and_analytics_without_frame_mutation() {
    let tick = 20;
    let mut registry = FrameRegistry::default();
    let before = registry.digest64();
    for origin in [WriteOrigin::Observer, WriteOrigin::Renderer, WriteOrigin::Analytics, WriteOrigin::Derived] {
        assert!(matches!(registry.create(&receipt("earth", tick), frame_record(tick), origin), Err(CelestialError::UnauthorizedWrite(_))));
        assert_eq!(registry.digest64(), before);
    }
}

fn full_state(tick: i128) -> Wp008State {
    let (registry, frame) = frame_registry(tick);
    let rotation = rotation(&frame, tick);
    validate_rotation(&receipt("earth", tick), &frame, &rotation, WriteOrigin::OwningResolver).unwrap();
    let orbit = orbit(&frame, tick);
    validate_orbit(&receipt("earth", tick), &frame, &orbit, WriteOrigin::OwningResolver).unwrap();
    let solar = solar_forcing(&orbit, [-1.0, 0.0, 0.0], 1361.0, "event:solar").unwrap();
    let lunar = lunar(&frame, tick);
    validate_lunar(&receipt("moon", tick), &frame, &lunar, WriteOrigin::OwningResolver).unwrap();
    let tidal = tidal_forcing_handoff(&lunar, "surface-cell-1", [1.0, 0.0, 0.0], 2.0, "m2/s2", "event:tide").unwrap();
    let mut a = anchor(); a.world_tick_at_anchor = tick; a.astronomical_tick_at_anchor = 10_000;
    let astronomical_mapping = map_astronomical_time(&world_time(tick), &a, "event:map").unwrap();
    Wp008State { frame_registry: registry, rotation, orbit, solar, lunar, tidal, astronomical_mapping }
}

#[test]
fn persistence_restore_and_replay_preserve_identity_cut_digest_and_event_order_material() {
    let snapshot = CelestialSnapshot { schema_version: 1, commit_marker: "committed".into(), causal_cut: "cut:42".into(), state: full_state(42) };
    let digest = snapshot.digest64().unwrap();
    let restored = snapshot.restore().unwrap();
    let replay = CelestialSnapshot { state: restored, ..snapshot.clone() };
    assert_eq!(snapshot, replay);
    assert_eq!(digest, replay.digest64().unwrap());
}

#[test]
fn wp008_acceptance_requires_all_eight_members_predecessors_and_snapshot_evidence() {
    let admission = admission();
    let passes = [true; 8];
    let evidence = [11_u64, 12, 13, 14, 15, 16, 17, 18];
    let closed = accept_wp(&admission, &passes, &evidence, 99).unwrap();
    assert!(closed.closed);
    assert_eq!(closed.member_ids, MEMBER_IDS);
    let mut missing = passes; missing[6] = false;
    assert_eq!(accept_wp(&admission, &missing, &evidence, 99), Err(CelestialError::MissingEvidence("S4.01.07")));
    assert_eq!(accept_wp(&admission, &passes, &evidence, 0), Err(CelestialError::MissingSnapshotEvidence));
}

#[test]
fn wp008_integration_traces_wp003_wp004_through_s4_01_01_to_s4_01_08_without_shortcut() {
    let admission = admit(&space_acceptance(), &time_acceptance()).unwrap();
    let contract = receipt("earth", 100);
    assert_eq!(contract.disposition, CandidateDisposition::CandidateOnly);
    let state = full_state(100);
    let snapshot = CelestialSnapshot { schema_version: 1, commit_marker: "committed".into(), causal_cut: "cut:100".into(), state };
    let digest = snapshot.digest64().unwrap();
    let acceptance = accept_wp(&admission, &[true; 8], &[1, 2, 3, 4, 5, 6, 7, 8], digest).unwrap();
    assert_eq!(acceptance.work_package, "WP-008");
    assert_eq!(acceptance.space_predecessor_digest64, 33);
    assert_eq!(acceptance.time_predecessor_digest64, 44);
    assert!(acceptance.evidence_digest64 != 0);
}
