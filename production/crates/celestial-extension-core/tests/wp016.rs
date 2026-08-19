use gaonn_celestial_core::{VersionRef, Wp008Acceptance};
use gaonn_celestial_extension_core::*;

fn wp008() -> Wp008Acceptance {
    Wp008Acceptance {
        work_package: "WP-008",
        member_ids: gaonn_celestial_core::MEMBER_IDS,
        space_predecessor_digest64: 11,
        time_predecessor_digest64: 12,
        evidence_digest64: 13,
        closed: true,
    }
}

fn admission() -> AdmissionReceipt {
    admit_wp016(&wp008(), "WP-008:closure").unwrap()
}

fn frame_ref() -> VersionRef {
    VersionRef {
        stable_id: "frame:earth:1".to_owned(),
        namespace: "celestial.frame".to_owned(),
        version: 1,
        owner: OWNER.to_owned(),
        causal_parent: "S4.01.02".to_owned(),
    }
}

fn axial() -> AxialPrecessionParameters {
    AxialPrecessionParameters {
        stable_id: "axial:earth".to_owned(),
        namespace: "celestial.axial_precession".to_owned(),
        version: 1,
        owner: OWNER.to_owned(),
        celestial_id: "earth".to_owned(),
        frame_ref: frame_ref(),
        axial_tilt_rad: 0.4091,
        precession_phase_rad: 0.25,
        precession_rate_rad_per_tick: 0.000_001,
        reference_tick: 100,
        causal_parent: "WP-008:S4.01.08".to_owned(),
        disposition: Disposition::CandidateOnly,
    }
}

fn policy() -> EphemerisPrecisionPolicy {
    EphemerisPrecisionPolicy {
        stable_id: "policy:earth:ephemeris".to_owned(),
        namespace: "celestial.precision_policy".to_owned(),
        version: 1,
        owner: OWNER.to_owned(),
        axial_ref: axial().reference(),
        horizon_start_tick: 100,
        horizon_end_tick: 1_000_000,
        max_angular_error_rad: 0.001,
        max_position_error: 100.0,
        position_error_unit: "m".to_owned(),
        causal_parent: "S4.01.09".to_owned(),
        disposition: Disposition::CandidateOnly,
    }
}

fn tag() -> CelestialStateVersionTag {
    CelestialStateVersionTag {
        stable_id: "celestial-version:earth".to_owned(),
        namespace: "celestial.version_tag".to_owned(),
        version: 1,
        owner: OWNER.to_owned(),
        celestial_id: "earth".to_owned(),
        frame_ref: frame_ref(),
        source_policy_ref: policy().reference(),
        world_tick: 100,
        state_digest64: 5001,
        predecessor: None,
        lifecycle: Lifecycle::Active,
        causal_parent: "S4.01.10".to_owned(),
    }
}

fn registry() -> VersionTagRegistry {
    let mut registry = VersionTagRegistry::default();
    registry
        .create(&policy(), tag(), WriteOrigin::OwningResolver)
        .unwrap();
    registry
}

fn artifact() -> CelestialDurableArtifact {
    CelestialDurableArtifact::build(
        "committed:S4.01.11",
        "cut:100",
        "recovery:100",
        "replay:earth:100",
        tag(),
        axial(),
        policy(),
        vec![
            "S4.01.09".to_owned(),
            "S4.01.10".to_owned(),
            "S4.01.11".to_owned(),
            "S4.01.12".to_owned(),
        ],
    )
    .unwrap()
}

fn adaptive_state() -> AdaptivePrecisionState {
    AdaptivePrecisionState {
        stable_id: "adaptive:earth".to_owned(),
        version: 1,
        owner: OWNER.to_owned(),
        policy_ref: policy().reference(),
        phase: TriggerPhase::Inactive,
        last_transition_tick: None,
        causal_parent: "S4.01.12".to_owned(),
    }
}

fn illumination(tick: i128) -> IlluminationGeometry {
    derive_illumination_geometry(&IlluminationInput {
        celestial_state_ref: tag().reference(),
        surface_ref: "surface:equator:0".to_owned(),
        world_tick: tick,
        surface_normal_unit: [1.0, 0.0, 0.0],
        sun_direction_unit: [1.0, 0.0, 0.0],
        normal_irradiance_w_m2: 1361.0,
        occluded_by_objective_geometry: false,
        causal_parent: "S4.01.13".to_owned(),
    })
    .unwrap()
}

fn fixture_input() -> FixtureInput {
    FixtureInput {
        fixture_id: "fixture:earth:long-horizon".to_owned(),
        seed: 42,
        ticks: vec![100, 10_000, 100_000, 500_000],
        surface_ref: "surface:equator:0".to_owned(),
        surface_normal_unit: [1.0, 0.0, 0.0],
        sun_direction_unit: [1.0, 0.0, 0.0],
        normal_irradiance_w_m2: 1361.0,
        inject_missing_forcing_at: None,
        causal_parent: "S4.01.16".to_owned(),
    }
}

#[test]
fn admission_requires_exact_closed_wp008_evidence() {
    let receipt = admission();
    assert_eq!(receipt.predecessor, "WP-008");
    let mut failed = wp008();
    failed.closed = false;
    assert_eq!(
        admit_wp016(&failed, "WP-008:closure"),
        Err(ExtensionError::InvalidPredecessor)
    );
}

#[test]
fn s4_01_09_axial_precession_validates_owner_range_and_reference() {
    assert_ne!(
        validate_axial_precession(&admission(), &axial(), WriteOrigin::OwningResolver).unwrap(),
        0
    );
    let mut invalid = axial();
    invalid.axial_tilt_rad = 4.0;
    assert_eq!(
        validate_axial_precession(&admission(), &invalid, WriteOrigin::OwningResolver),
        Err(ExtensionError::InvalidNumeric("axial.axial_tilt_rad"))
    );
    assert_eq!(
        validate_axial_precession(&admission(), &axial(), WriteOrigin::Observer),
        Err(ExtensionError::UnauthorizedWrite(WriteOrigin::Observer))
    );
}

#[test]
fn s4_01_10_precision_policy_uses_explicit_source_tolerances_and_horizon() {
    assert_ne!(
        validate_precision_policy(&axial(), &policy(), WriteOrigin::OwningResolver).unwrap(),
        0
    );
    let mut invalid = policy();
    invalid.horizon_end_tick = 99;
    assert_eq!(
        validate_precision_policy(&axial(), &invalid, WriteOrigin::OwningResolver),
        Err(ExtensionError::InvalidHorizon)
    );
}

#[test]
fn s4_01_11_version_tag_preserves_lineage_and_rejects_reuse_wrong_owner_and_stale_update() {
    let p = policy();
    let mut registry = VersionTagRegistry::default();
    let original = tag();
    let first = registry
        .create(&p, original.clone(), WriteOrigin::OwningResolver)
        .unwrap();
    assert_eq!(first.version, 1);
    assert!(matches!(
        registry.create(&p, original.clone(), WriteOrigin::OwningResolver),
        Err(ExtensionError::DuplicateStableId(_))
    ));
    let mut update = original.clone();
    update.version = 2;
    update.predecessor = Some(original.reference());
    update.state_digest64 = 5002;
    update.causal_parent = "S4.01.11:update".to_owned();
    let second = registry
        .update(&p, update.clone(), WriteOrigin::OwningResolver)
        .unwrap();
    assert_eq!(second.version, 2);
    assert_eq!(
        registry.update(&p, update, WriteOrigin::OwningResolver),
        Err(ExtensionError::StaleOrMismatchedRevision)
    );
    let pre = registry.digest64();
    let mut wrong = original;
    wrong.stable_id = "celestial-version:wrong-owner".to_owned();
    wrong.owner = "domain99.invalid".to_owned();
    assert!(matches!(
        registry.create(&p, wrong, WriteOrigin::OwningResolver),
        Err(ExtensionError::WrongOwner(_))
    ));
    assert_eq!(registry.digest64(), pre);
}

#[test]
fn s4_01_11_retired_id_cannot_be_reused() {
    let p = policy();
    let mut registry = registry();
    registry
        .retire(
            "celestial-version:earth",
            2,
            "S4.01.11:retire",
            WriteOrigin::OwningResolver,
        )
        .unwrap();
    assert!(matches!(
        registry.create(&p, tag(), WriteOrigin::OwningResolver),
        Err(ExtensionError::DuplicateStableId(_))
    ));
}

#[test]
fn s4_01_12_serialization_restore_is_digest_stable_and_corruption_fails_closed() {
    let artifact = artifact();
    artifact.validate().unwrap();
    let restored = artifact.restore().unwrap();
    assert_eq!(restored.0, artifact.tag);
    assert_eq!(restored.1, artifact.axial);
    assert_eq!(restored.2, artifact.policy);
    let mut corrupt = artifact;
    corrupt.artifact_digest64 ^= 1;
    assert_eq!(corrupt.validate(), Err(ExtensionError::CorruptArtifact));
}

#[test]
fn s4_01_13_adaptive_precision_trigger_emits_once_per_boundary_crossing() {
    let mut state = adaptive_state();
    let breach = PrecisionTriggerInput {
        world_tick: 200,
        observed_angular_error_rad: 0.002,
        observed_position_error: 50.0,
        causal_parent: "measurement:200".to_owned(),
    };
    let first = evaluate_precision_trigger(&policy(), &mut state, &breach, WriteOrigin::OwningResolver)
        .unwrap()
        .unwrap();
    assert!(first.activated);
    assert!(evaluate_precision_trigger(&policy(), &mut state, &breach, WriteOrigin::OwningResolver)
        .unwrap()
        .is_none());
    let clear = PrecisionTriggerInput {
        world_tick: 201,
        observed_angular_error_rad: 0.0001,
        observed_position_error: 10.0,
        causal_parent: "measurement:201".to_owned(),
    };
    assert!(!evaluate_precision_trigger(&policy(), &mut state, &clear, WriteOrigin::OwningResolver)
        .unwrap()
        .unwrap()
        .activated);
}

#[test]
fn s4_01_13_wrong_owner_or_out_of_horizon_does_not_mutate_state() {
    let mut state = adaptive_state();
    let pre = state.clone();
    let input = PrecisionTriggerInput {
        world_tick: 1_000_001,
        observed_angular_error_rad: 1.0,
        observed_position_error: 1_000.0,
        causal_parent: "measurement:outside".to_owned(),
    };
    assert_eq!(
        evaluate_precision_trigger(&policy(), &mut state, &input, WriteOrigin::OwningResolver),
        Err(ExtensionError::InvalidHorizon)
    );
    assert_eq!(state, pre);
}

#[test]
fn s4_01_14_illumination_geometry_is_derived_and_handles_shadow_boundary() {
    let lit = illumination(300);
    assert!(!lit.shadowed);
    assert_eq!(lit.direct_irradiance_w_m2, 1361.0);
    let dark = derive_illumination_geometry(&IlluminationInput {
        celestial_state_ref: tag().reference(),
        surface_ref: "surface:night".to_owned(),
        world_tick: 300,
        surface_normal_unit: [-1.0, 0.0, 0.0],
        sun_direction_unit: [1.0, 0.0, 0.0],
        normal_irradiance_w_m2: 1361.0,
        occluded_by_objective_geometry: false,
        causal_parent: "S4.01.13".to_owned(),
    })
    .unwrap();
    assert!(dark.shadowed);
    assert_eq!(dark.direct_irradiance_w_m2, 0.0);
}

#[test]
fn s4_01_15_query_is_read_only_and_preserves_time_location_object_and_provenance() {
    let registry = registry();
    let pre = registry.digest64();
    let tag = registry.get("celestial-version:earth").unwrap();
    let response = query_celestial_forcing(
        tag,
        &axial(),
        &CelestialForcingQuery {
            query_id: "query:1".to_owned(),
            source_tag_ref: tag.reference(),
            world_tick: 300,
            location_ref: "surface:equator:0".to_owned(),
            object_ref: Some("earth".to_owned()),
            causal_parent: "observer:request".to_owned(),
        },
        illumination(300),
    )
    .unwrap();
    assert_eq!(response.world_tick, 300);
    assert_eq!(response.location_ref, "surface:equator:0");
    assert_eq!(response.object_ref.as_deref(), Some("earth"));
    assert_eq!(response.disposition, Disposition::ReadOnlyEvidence);
    assert_eq!(registry.digest64(), pre);
}

#[test]
fn s4_01_15_query_rejects_mixed_read_cut() {
    let tag = tag();
    assert_eq!(
        query_celestial_forcing(
            &tag,
            &axial(),
            &CelestialForcingQuery {
                query_id: "query:mixed".to_owned(),
                source_tag_ref: tag.reference(),
                world_tick: 301,
                location_ref: "surface:equator:0".to_owned(),
                object_ref: None,
                causal_parent: "observer:request".to_owned(),
            },
            illumination(300),
        ),
        Err(ExtensionError::ReadCutMismatch)
    );
}

#[test]
fn s4_01_16_season_audit_detects_three_prohibited_paths_without_false_positive_or_mutation() {
    let registry = registry();
    let pre = registry.digest64();
    let evidence = audit_season_as_causal_forcing(
        &registry,
        &[
            SeasonAuditAttempt {
                work_id: "normal".to_owned(),
                case: SeasonAuditCase::NormalCausalForcing,
                owner: OWNER.to_owned(),
                causal_parent: "S4.01.15".to_owned(),
            },
            SeasonAuditAttempt {
                work_id: "bypass".to_owned(),
                case: SeasonAuditCase::SeasonLabelBypass,
                owner: OWNER.to_owned(),
                causal_parent: "derived:season-label".to_owned(),
            },
            SeasonAuditAttempt {
                work_id: "authority".to_owned(),
                case: SeasonAuditCase::AuthorityIntrusion,
                owner: "observer".to_owned(),
                causal_parent: "observer".to_owned(),
            },
            SeasonAuditAttempt {
                work_id: "duplicate".to_owned(),
                case: SeasonAuditCase::DuplicateCanonicalWrite,
                owner: OWNER.to_owned(),
                causal_parent: "duplicate-writer".to_owned(),
            },
        ],
        "S4.01.15",
    )
    .unwrap();
    assert_eq!(evidence.violations.len(), 3);
    assert_eq!(evidence.normal_false_positives, 0);
    assert_eq!(evidence.pre_digest64, evidence.post_digest64);
    assert_eq!(registry.digest64(), pre);
}

#[test]
fn s4_01_17_long_horizon_fixture_is_repeatable_for_same_seed_and_input() {
    let first = run_long_horizon_fixture(&tag(), &axial(), &policy(), &fixture_input()).unwrap();
    let second = run_long_horizon_fixture(&tag(), &axial(), &policy(), &fixture_input()).unwrap();
    assert_eq!(first, second);
    assert_ne!(first.final_digest64, 0);
    assert!(first.first_failure.is_none());
}

#[test]
fn s4_01_17_fixture_reports_first_injected_failure_without_fabricating_final_digest() {
    let mut input = fixture_input();
    input.inject_missing_forcing_at = Some(2);
    let evidence = run_long_horizon_fixture(&tag(), &axial(), &policy(), &input).unwrap();
    assert_eq!(evidence.first_failure, Some("missing-forcing-output"));
    assert_eq!(evidence.final_digest64, 0);
    assert_eq!(evidence.samples.len(), 2);
}

#[test]
fn wp016_snapshot_restore_preserves_id_version_pending_state_causal_refs_and_event_order() {
    let snapshot = Wp016Snapshot {
        schema_version: SCHEMA_VERSION,
        snapshot_marker: "snapshot:wp016".to_owned(),
        causal_cut: "cut:100".to_owned(),
        durable_artifact: artifact(),
        version_registry: registry(),
        adaptive_state: adaptive_state(),
        event_order: MEMBER_IDS.iter().map(|id| (*id).to_owned()).collect(),
    };
    let digest = snapshot.digest64().unwrap();
    let restored = snapshot.restore().unwrap();
    assert_eq!(restored.digest64().unwrap(), digest);
    assert_eq!(restored.event_order, snapshot.event_order);
    assert_eq!(restored.adaptive_state, snapshot.adaptive_state);
}

#[test]
fn wp016_acceptance_requires_all_nine_members_snapshot_and_successful_fixture() {
    let snapshot = Wp016Snapshot {
        schema_version: SCHEMA_VERSION,
        snapshot_marker: "snapshot:wp016".to_owned(),
        causal_cut: "cut:100".to_owned(),
        durable_artifact: artifact(),
        version_registry: registry(),
        adaptive_state: adaptive_state(),
        event_order: MEMBER_IDS.iter().map(|id| (*id).to_owned()).collect(),
    };
    let digest = snapshot.digest64().unwrap();
    let fixture = run_long_horizon_fixture(&tag(), &axial(), &policy(), &fixture_input()).unwrap();
    let acceptance = accept_wp016(
        &admission(),
        &[true; 9],
        &[1; 9],
        &snapshot,
        digest,
        &fixture,
    )
    .unwrap();
    assert!(acceptance.closed);
    let mut passes = [true; 9];
    passes[4] = false;
    assert_eq!(
        accept_wp016(&admission(), &passes, &[1; 9], &snapshot, digest, &fixture),
        Err(ExtensionError::MissingMemberEvidence("S4.01.13"))
    );
}

#[test]
fn wp016_integration_s4_01_09_through_s4_01_17_has_no_shortcut() {
    let admission = admission();
    validate_axial_precession(&admission, &axial(), WriteOrigin::OwningResolver).unwrap();
    validate_precision_policy(&axial(), &policy(), WriteOrigin::OwningResolver).unwrap();
    let mut registry = VersionTagRegistry::default();
    registry
        .create(&policy(), tag(), WriteOrigin::OwningResolver)
        .unwrap();
    let artifact = artifact();
    artifact.validate().unwrap();
    let mut adaptive = adaptive_state();
    evaluate_precision_trigger(
        &policy(),
        &mut adaptive,
        &PrecisionTriggerInput {
            world_tick: 200,
            observed_angular_error_rad: 0.002,
            observed_position_error: 50.0,
            causal_parent: "measurement:200".to_owned(),
        },
        WriteOrigin::OwningResolver,
    )
    .unwrap();
    let light = illumination(300);
    let tag_ref = registry.get("celestial-version:earth").unwrap().reference();
    query_celestial_forcing(
        registry.get("celestial-version:earth").unwrap(),
        &axial(),
        &CelestialForcingQuery {
            query_id: "integration:query".to_owned(),
            source_tag_ref: tag_ref,
            world_tick: 300,
            location_ref: "surface:equator:0".to_owned(),
            object_ref: Some("earth".to_owned()),
            causal_parent: "S4.01.14".to_owned(),
        },
        light,
    )
    .unwrap();
    let audit = audit_season_as_causal_forcing(
        &registry,
        &[SeasonAuditAttempt {
            work_id: "integration:normal".to_owned(),
            case: SeasonAuditCase::NormalCausalForcing,
            owner: OWNER.to_owned(),
            causal_parent: "S4.01.15".to_owned(),
        }],
        "S4.01.15",
    )
    .unwrap();
    assert!(audit.violations.is_empty());
    let fixture = run_long_horizon_fixture(&tag(), &axial(), &policy(), &fixture_input()).unwrap();
    assert!(fixture.first_failure.is_none());
    assert_ne!(fixture.final_digest64, 0);
}
