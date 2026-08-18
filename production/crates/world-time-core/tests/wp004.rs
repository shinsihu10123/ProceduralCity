use gaonn_world_core::{CanonicalCandidate, CanonicalStateContract};
use gaonn_world_time_core::*;

fn root() -> gaonn_world_core::ValidationReceipt {
    CanonicalStateContract
        .validate(&CanonicalCandidate::valid_fixture())
        .unwrap()
}

fn epoch() -> EpochDescriptor {
    EpochDescriptor {
        id: "epoch-genesis".to_owned(),
        unit: "canonical-subsecond".to_owned(),
        frame: "absolute-world-time".to_owned(),
        version: SCHEMA_VERSION,
        owner: OWNER.to_owned(),
        causal_parent: "S1.01.08:PASS".to_owned(),
    }
}

fn state(tick: i128, microstep: u64) -> WorldTimeState {
    WorldTimeState {
        epoch: epoch(),
        tick,
        microstep,
        version: SCHEMA_VERSION,
        owner: OWNER.to_owned(),
        causal_parent: "S1.05.01:fixture".to_owned(),
    }
}

#[test]
fn s1_05_01_absolute_worldtime_contract_requires_valid_predecessor_and_owner() {
    assert_eq!(admit(&root()), Ok(()));
    assert_eq!(state(0, 0).validate(), Ok(()));

    let mut wrong_owner = state(0, 0);
    wrong_owner.owner = "observer".to_owned();
    assert!(matches!(
        wrong_owner.validate(),
        Err(TimeError::WrongOwner { .. })
    ));
}

#[test]
fn s1_05_02_epoch_unit_representation_rejects_stale_missing_and_incompatible_values() {
    let mut stale = state(0, 0);
    stale.epoch.version = SCHEMA_VERSION + 1;
    assert!(matches!(
        stale.validate(),
        Err(TimeError::StaleVersion { .. })
    ));

    let mut missing = state(0, 0);
    missing.epoch.unit.clear();
    assert_eq!(missing.validate(), Err(TimeError::EmptyField("epoch.unit")));

    let left = state(10, 0);
    let mut right = state(10, 0);
    right.epoch.frame = "derived-calendar".to_owned();
    assert!(matches!(
        same_time(&left, &right),
        Err(TimeError::FrameMismatch { .. })
    ));
}

#[test]
fn s1_05_03_monotonic_time_accepts_forward_and_same_time_order_but_rejects_reversal() {
    let current = state(100, 5);
    let forward = advance_to(
        &current,
        101,
        0,
        "event:forward",
        WriteOrigin::RuntimeAuthority,
    )
    .unwrap();
    assert_eq!(forward.tick, 101);

    let same_time = advance_to(
        &current,
        100,
        6,
        "event:same-time",
        WriteOrigin::RuntimeAuthority,
    )
    .unwrap();
    assert_eq!(same_time.microstep, 6);

    assert_eq!(
        advance_to(
            &current,
            99,
            0,
            "event:reverse",
            WriteOrigin::RuntimeAuthority
        ),
        Err(TimeError::TimeReversal {
            current: 100,
            proposed: 99
        })
    );
    assert_eq!(
        advance_to(
            &current,
            100,
            4,
            "event:order-regression",
            WriteOrigin::RuntimeAuthority
        ),
        Err(TimeError::CausalOrderRegression {
            current: 5,
            proposed: 4
        })
    );
}

#[test]
fn s1_05_03_wrong_writer_origins_leave_canonical_state_unchanged() {
    let current = state(100, 0);
    let before = current.digest64();
    for origin in [
        WriteOrigin::Derived,
        WriteOrigin::Observer,
        WriteOrigin::Renderer,
        WriteOrigin::Analytics,
        WriteOrigin::Ui,
        WriteOrigin::Ai,
    ] {
        assert!(matches!(
            advance_to(&current, 101, 0, "unauthorized", origin),
            Err(TimeError::UnauthorizedWrite(_))
        ));
        assert_eq!(current.digest64(), before);
    }
}

#[test]
fn s1_05_04_duration_arithmetic_is_checked_exact_and_nonnegative() {
    let a = Duration::from_ticks(40).unwrap();
    let b = Duration::from_ticks(2).unwrap();
    assert_eq!(a.checked_add(b).unwrap().ticks(), 42);
    assert_eq!(a.checked_sub(b).unwrap().ticks(), 38);
    assert_eq!(Duration::from_ticks(-1), Err(TimeError::NegativeDuration(-1)));
    assert_eq!(
        Duration::from_ticks(i128::MAX)
            .unwrap()
            .checked_add(Duration::from_ticks(1).unwrap()),
        Err(TimeError::ArithmeticOverflow)
    );

    let earlier = state(100, 0);
    let later = state(142, 0);
    assert_eq!(elapsed_between(&earlier, &later).unwrap().ticks(), 42);
    assert_eq!(
        elapsed_between(&later, &earlier),
        Err(TimeError::NegativeDuration(-42))
    );
}

#[test]
fn s1_05_05_same_time_equality_is_absolute_and_separate_from_microstep_order() {
    let left = state(500, 1);
    let right = state(500, 99);
    assert!(same_time(&left, &right).unwrap());
    assert_eq!(left.instant_key(), right.instant_key());
    assert_ne!(left.causal_key(), right.causal_key());

    let later = state(501, 0);
    assert!(!same_time(&left, &later).unwrap());
}

#[test]
fn s1_05_06_calendar_human_date_is_read_only_derived_view() {
    let canonical = state(123_456, 7);
    let before = canonical.digest64();
    let view = derive_calendar_view(&canonical, "derived-date-A", "calendar-profile:v1").unwrap();
    let other_view =
        derive_calendar_view(&canonical, "derived-date-B", "calendar-profile:v2").unwrap();

    assert_eq!(view.source, canonical.instant_key());
    assert_eq!(other_view.source, canonical.instant_key());
    assert_ne!(view.label, other_view.label);
    assert_eq!(canonical.digest64(), before);
}

#[test]
fn s1_05_07_worldtime_serialization_round_trip_preserves_replay_boundary() {
    let snapshot = TimeSnapshot {
        schema_version: SCHEMA_VERSION,
        commit_marker: "commit:42".to_owned(),
        causal_cut: "cut:42".to_owned(),
        recovery_position: "journal:segment-7:offset-11".to_owned(),
        replay_reference: "replay:fixture-A".to_owned(),
        state: state(9_876_543_210, 12),
    };
    let encoded = snapshot.encode_stable().unwrap();
    let restored = TimeSnapshot::decode_stable(&encoded).unwrap();
    assert_eq!(restored, snapshot);
    assert_eq!(restored.encode_stable().unwrap(), encoded);
    assert_eq!(restored.digest64().unwrap(), snapshot.digest64().unwrap());
}

#[test]
fn s1_05_07_serialization_fails_closed_on_missing_boundary_or_stale_schema() {
    let mut snapshot = TimeSnapshot {
        schema_version: SCHEMA_VERSION,
        commit_marker: "commit:1".to_owned(),
        causal_cut: "cut:1".to_owned(),
        recovery_position: "recovery:1".to_owned(),
        replay_reference: "replay:1".to_owned(),
        state: state(1, 0),
    };
    snapshot.commit_marker.clear();
    assert_eq!(
        snapshot.encode_stable(),
        Err(TimeError::EmptyField("snapshot.commit_marker"))
    );

    snapshot.commit_marker = "commit:1".to_owned();
    snapshot.schema_version += 1;
    assert!(matches!(
        snapshot.encode_stable(),
        Err(TimeError::StaleVersion { .. })
    ));
}

#[test]
fn s1_05_08_long_horizon_precision_has_no_accumulation_drift() {
    let start = state(1_000_000_000_000_000_000, 0);
    let step = Duration::from_ticks(86_400_000_000_000).unwrap();
    let evidence = long_horizon_precision_fixture(&start, step, 10_000).unwrap();
    assert!(evidence.exact_match);
    assert_eq!(evidence.iterative_end, evidence.direct_end);
    assert_ne!(evidence.digest64, 0);
}

#[test]
fn s1_05_08_long_horizon_precision_reports_overflow_instead_of_wrapping() {
    let start = state(i128::MAX - 1, 0);
    let step = Duration::from_ticks(2).unwrap();
    assert_eq!(
        long_horizon_precision_fixture(&start, step, 2),
        Err(TimeError::ArithmeticOverflow)
    );
}

#[test]
fn s1_05_09_reversal_audit_is_read_only_detects_violation_and_avoids_false_positive() {
    let pre = state(1_000, 10);
    let normal = state(1_001, 0);
    let reversed = state(999, 0);
    let order_regression = state(1_000, 9);
    let pre_digest = pre.digest64();

    assert_eq!(audit_time_reversal(&pre, &normal).unwrap().outcome, AuditOutcome::Pass);
    assert_eq!(
        audit_time_reversal(&pre, &reversed).unwrap().outcome,
        AuditOutcome::Violation { field: "tick" }
    );
    assert_eq!(
        audit_time_reversal(&pre, &order_regression).unwrap().outcome,
        AuditOutcome::Violation { field: "microstep" }
    );
    assert_eq!(pre.digest64(), pre_digest);
}

#[test]
fn wp004_acceptance_requires_all_nine_member_passes_and_evidence() {
    let passes = [true; 9];
    let evidence = [1_u64; 9];
    let acceptance = accept_wp004(&root(), &passes, &evidence).unwrap();
    assert!(acceptance.closed);
    assert_eq!(acceptance.member_ids, MEMBER_IDS);
    assert_eq!(acceptance.work_package, "WP-004");

    let mut missing_pass = passes;
    missing_pass[5] = false;
    assert_eq!(
        accept_wp004(&root(), &missing_pass, &evidence),
        Err(TimeError::MissingEvidence("S1.05.06"))
    );

    let mut missing_evidence = evidence;
    missing_evidence[8] = 0;
    assert_eq!(
        accept_wp004(&root(), &passes, &missing_evidence),
        Err(TimeError::MissingEvidence("S1.05.09"))
    );
}
