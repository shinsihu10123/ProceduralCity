use gaonn_world_core::authority::{
    AuthorityRecordId, AuthorityRegistration, AuthorityRegistry, ReadOnlyRole,
};
use gaonn_world_core::boundary::{
    BoundaryCandidate, BoundaryError, BoundaryWriteTarget, CanonicalDerivedBoundary,
    CanonicalSourceReference, DerivedStateCache, S1_01_03_BOUNDARY_VERSION, StateLayer,
};
use gaonn_world_core::{CanonicalCandidate, CanonicalStateContract};

fn registry_fixture() -> (
    AuthorityRegistry,
    gaonn_world_core::authority::AuthorityReference,
) {
    let receipt = CanonicalStateContract
        .validate(&CanonicalCandidate::valid_fixture())
        .expect("S1.01.01 fixture must pass");
    let mut registry = AuthorityRegistry::new();
    let reference = registry
        .register(AuthorityRegistration {
            id: AuthorityRecordId::new("canonical.domain01", "planet-mass"),
            fact_key: receipt.fact_key.clone(),
            owner: receipt.owner.clone(),
            allowed_writer: receipt.writer.clone(),
            authority_epoch: 1,
            source_contract: receipt,
        })
        .expect("S1.01.02 fixture must pass");
    registry
        .register_read_only_role("objective.planet.mass", ReadOnlyRole::Derived)
        .unwrap();
    registry
        .register_read_only_role("objective.planet.mass", ReadOnlyRole::Observer)
        .unwrap();
    (registry, reference)
}

fn source(
    reference: &gaonn_world_core::authority::AuthorityReference,
    state_version: u64,
) -> CanonicalSourceReference {
    CanonicalSourceReference {
        fact_key: "objective.planet.mass".to_owned(),
        authority: reference.clone(),
        state_version,
        causal_parent: format!("canonical-state-version-{state_version}"),
    }
}

fn canonical_candidate(
    reference: &gaonn_world_core::authority::AuthorityReference,
) -> BoundaryCandidate {
    BoundaryCandidate {
        state_key: Some("objective.planet.mass".to_owned()),
        version: Some(S1_01_03_BOUNDARY_VERSION),
        layer: Some(StateLayer::Canonical),
        owner: Some("domain01.celestial_frame".to_owned()),
        writer: Some("domain01.celestial_frame".to_owned()),
        write_target: Some(BoundaryWriteTarget::Canonical),
        source: Some(source(reference, 1)),
        causal_parent: Some("S1.01.02:authority-registry".to_owned()),
    }
}

fn derived_candidate(
    reference: &gaonn_world_core::authority::AuthorityReference,
) -> BoundaryCandidate {
    BoundaryCandidate {
        state_key: Some("derived.planet.mass_display".to_owned()),
        version: Some(S1_01_03_BOUNDARY_VERSION),
        layer: Some(StateLayer::Derived),
        owner: Some("derived.metrics".to_owned()),
        writer: Some("derived.metrics".to_owned()),
        write_target: Some(BoundaryWriteTarget::OwnLayer),
        source: Some(source(reference, 1)),
        causal_parent: Some("S1.01.02:authority-registry".to_owned()),
    }
}

#[test]
fn behavior_normal_classifies_canonical_and_derived_without_sharing_authority() {
    let (registry, reference) = registry_fixture();
    let boundary = CanonicalDerivedBoundary;

    let canonical = boundary
        .validate(&registry, &canonical_candidate(&reference))
        .expect("canonical owner path must pass");
    let derived = boundary
        .validate(&registry, &derived_candidate(&reference))
        .expect("derived local path must pass");

    assert_eq!(canonical.layer, StateLayer::Canonical);
    assert_eq!(
        canonical.allowed_writer.as_deref(),
        Some("domain01.celestial_frame")
    );
    assert_eq!(derived.layer, StateLayer::Derived);
    assert_eq!(derived.allowed_writer.as_deref(), Some("derived.metrics"));
    assert_ne!(derived.owner, canonical.owner);
    assert!(derived.invalidation_reference.is_some());
    assert_eq!(derived.source.authority, canonical.source.authority);
}

#[test]
fn behavior_failure_rejects_missing_stale_owner_and_reverse_write_without_prestate_change() {
    let (registry, reference) = registry_fixture();
    let boundary = CanonicalDerivedBoundary;
    let pre_digest = registry.snapshot().evidence_digest64();

    let mut missing = canonical_candidate(&reference);
    missing.owner = None;
    assert_eq!(
        boundary.validate(&registry, &missing),
        Err(BoundaryError::MissingField("owner"))
    );

    let mut wrong_owner = canonical_candidate(&reference);
    wrong_owner.owner = Some("derived.metrics".to_owned());
    assert!(matches!(
        boundary.validate(&registry, &wrong_owner),
        Err(BoundaryError::WrongOwner { .. })
    ));

    let mut reverse = derived_candidate(&reference);
    reverse.write_target = Some(BoundaryWriteTarget::Canonical);
    assert_eq!(
        boundary.validate(&registry, &reverse),
        Err(BoundaryError::ReverseCanonicalWrite {
            layer: StateLayer::Derived
        })
    );

    assert_eq!(registry.snapshot().evidence_digest64(), pre_digest);
}

#[test]
fn boundary_keeps_derived_transient_cache_and_observation_view_distinct() {
    let (registry, reference) = registry_fixture();
    let boundary = CanonicalDerivedBoundary;

    let derived = boundary
        .validate(&registry, &derived_candidate(&reference))
        .unwrap();

    let mut cache_candidate = derived_candidate(&reference);
    cache_candidate.state_key = Some("cache.planet.mass_display".to_owned());
    cache_candidate.layer = Some(StateLayer::TransientCache);
    cache_candidate.owner = Some("cache.metrics".to_owned());
    cache_candidate.writer = Some("cache.metrics".to_owned());
    let cache = boundary.validate(&registry, &cache_candidate).unwrap();

    let observation_candidate = BoundaryCandidate {
        state_key: Some("observation.planet.mass".to_owned()),
        version: Some(S1_01_03_BOUNDARY_VERSION),
        layer: Some(StateLayer::ObservationView),
        owner: Some("observer.read_model".to_owned()),
        writer: None,
        write_target: Some(BoundaryWriteTarget::None),
        source: Some(source(&reference, 1)),
        causal_parent: Some("S1.01.02:authority-registry".to_owned()),
    };
    let observation = boundary
        .validate(&registry, &observation_candidate)
        .unwrap();

    assert_eq!(derived.layer, StateLayer::Derived);
    assert_eq!(cache.layer, StateLayer::TransientCache);
    assert_eq!(observation.layer, StateLayer::ObservationView);
    assert!(derived.allowed_writer.is_some());
    assert!(cache.allowed_writer.is_some());
    assert!(observation.allowed_writer.is_none());
}

#[test]
fn authority_wrong_owner_and_observer_or_renderer_style_reverse_writes_are_blocked() {
    let (registry, reference) = registry_fixture();
    let boundary = CanonicalDerivedBoundary;
    let pre_digest = registry.snapshot().evidence_digest64();

    let mut canonical = canonical_candidate(&reference);
    canonical.writer = Some("observer.read_model".to_owned());
    assert!(matches!(
        boundary.validate(&registry, &canonical),
        Err(BoundaryError::WrongWriter { .. })
    ));

    let observation = BoundaryCandidate {
        state_key: Some("observation.planet.mass".to_owned()),
        version: Some(S1_01_03_BOUNDARY_VERSION),
        layer: Some(StateLayer::ObservationView),
        owner: Some("renderer.projection".to_owned()),
        writer: Some("renderer.projection".to_owned()),
        write_target: Some(BoundaryWriteTarget::Canonical),
        source: Some(source(&reference, 1)),
        causal_parent: Some("S1.01.02:authority-registry".to_owned()),
    };
    assert_eq!(
        boundary.validate(&registry, &observation),
        Err(BoundaryError::ReverseCanonicalWrite {
            layer: StateLayer::ObservationView
        })
    );

    assert_eq!(registry.snapshot().evidence_digest64(), pre_digest);
}

#[test]
fn contract_preserves_authority_id_version_owner_dependency_and_causal_reference() {
    let (registry, reference) = registry_fixture();
    let result = CanonicalDerivedBoundary
        .validate(&registry, &derived_candidate(&reference))
        .unwrap();

    assert_eq!(result.work_id, "S1.01.03");
    assert_eq!(result.version, S1_01_03_BOUNDARY_VERSION);
    assert_eq!(result.source.authority, reference);
    assert_eq!(result.source.state_version, 1);
    assert_eq!(result.causal_parent, "S1.01.02:authority-registry");
    assert_eq!(
        registry
            .resolve_active(&result.source.authority)
            .unwrap()
            .owner,
        "domain01.celestial_frame"
    );
}

#[test]
fn integration_canonical_source_change_invalidates_then_recomputes_derived_only() {
    let (registry, reference) = registry_fixture();
    let canonical_digest_before = registry.snapshot().evidence_digest64();
    let result = CanonicalDerivedBoundary
        .validate(&registry, &derived_candidate(&reference))
        .unwrap();
    let mut cache = DerivedStateCache::default();
    cache.register(&result).unwrap();

    let changed_source = source(&reference, 2);
    assert_eq!(cache.observe_source_change(&changed_source).unwrap(), 1);
    assert!(cache.get("derived.planet.mass_display").unwrap().stale);

    let recomputed = cache
        .recompute(
            "derived.planet.mass_display",
            changed_source,
            "derived-recompute-after-canonical-v2",
        )
        .unwrap();
    assert_eq!(recomputed.version, 2);
    assert_eq!(recomputed.source.state_version, 2);
    assert!(!recomputed.stale);

    let _removed = cache.remove("derived.planet.mass_display").unwrap();
    assert_eq!(
        registry.snapshot().evidence_digest64(),
        canonical_digest_before,
        "derived recompute/delete must not alter canonical authority pre-state"
    );
}

#[test]
fn persistence_snapshot_restore_preserves_dependency_version_invalidation_and_digest() {
    let (registry, reference) = registry_fixture();
    let result = CanonicalDerivedBoundary
        .validate(&registry, &derived_candidate(&reference))
        .unwrap();
    let mut cache = DerivedStateCache::default();
    cache.register(&result).unwrap();
    cache.observe_source_change(&source(&reference, 2)).unwrap();

    let snapshot = cache.snapshot();
    let digest = snapshot.evidence_digest64();
    let restored = DerivedStateCache::restore(snapshot.clone());

    assert_eq!(restored.snapshot(), snapshot);
    assert_eq!(restored.snapshot().evidence_digest64(), digest);
    assert_eq!(
        restored
            .get("derived.planet.mass_display")
            .unwrap()
            .source
            .state_version,
        1
    );
    assert!(restored.get("derived.planet.mass_display").unwrap().stale);
}

fn replay_fixture() -> (u64, gaonn_world_core::boundary::DerivedStateSnapshot) {
    let (registry, reference) = registry_fixture();
    let result = CanonicalDerivedBoundary
        .validate(&registry, &derived_candidate(&reference))
        .unwrap();
    let mut cache = DerivedStateCache::default();
    cache.register(&result).unwrap();
    cache.observe_source_change(&source(&reference, 2)).unwrap();
    cache
        .recompute(
            "derived.planet.mass_display",
            source(&reference, 2),
            "replay-recompute",
        )
        .unwrap();
    let snapshot = cache.snapshot();
    (snapshot.evidence_digest64(), snapshot)
}

#[test]
fn replay_same_snapshot_and_source_change_produces_same_result_order_and_digest() {
    let first = replay_fixture();
    let second = replay_fixture();

    assert_eq!(first.1, second.1);
    assert_eq!(first.0, second.0);
}
