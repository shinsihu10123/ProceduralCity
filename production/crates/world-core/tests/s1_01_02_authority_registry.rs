use gaonn_world_core::authority::{
    AuthorityLifecycle, AuthorityRecordId, AuthorityRegistration, AuthorityRegistry,
    AuthorityRegistryError, ReadOnlyRole,
};
use gaonn_world_core::{CanonicalCandidate, CanonicalStateContract, StateClass, ValidationReceipt};

fn source_receipt() -> ValidationReceipt {
    CanonicalStateContract
        .validate(&CanonicalCandidate::valid_fixture())
        .expect("S1.01.01 fixture must pass before S1.01.02")
}

fn registration(local_id: &str) -> AuthorityRegistration {
    let source = source_receipt();
    AuthorityRegistration {
        id: AuthorityRecordId::new("canonical.domain01", local_id),
        fact_key: source.fact_key.clone(),
        owner: source.owner.clone(),
        allowed_writer: source.writer.clone(),
        authority_epoch: 1,
        source_contract: source,
    }
}

fn registry_with_record() -> (
    AuthorityRegistry,
    gaonn_world_core::authority::AuthorityReference,
) {
    let mut registry = AuthorityRegistry::new();
    let reference = registry
        .register(registration("planet-mass"))
        .expect("valid authority registration must pass");
    (registry, reference)
}

#[test]
fn behavior_normal_registers_one_owner_and_resolves_exact_version() {
    let (registry, reference) = registry_with_record();
    let resolved = registry
        .resolve_active(&reference)
        .expect("active exact reference must resolve");

    assert_eq!(resolved.fact_key, "objective.planet.mass");
    assert_eq!(resolved.owner, "domain01.celestial_frame");
    assert_eq!(resolved.allowed_writer, resolved.owner);
    assert_eq!(resolved.authority_epoch, 1);
    assert_eq!(resolved.version, 1);
    assert_eq!(resolved.lifecycle, AuthorityLifecycle::Active);
    assert_eq!(
        registry.reference_for_fact(&resolved.fact_key).unwrap(),
        reference
    );
}

#[test]
fn behavior_failure_rejects_duplicate_dangling_stale_and_wrong_owner_without_mutation() {
    let (mut registry, reference) = registry_with_record();
    let baseline = registry.snapshot();

    let mut duplicate = registration("other-id");
    duplicate.owner = "domain99.shadow".to_owned();
    duplicate.allowed_writer = duplicate.owner.clone();
    duplicate.source_contract.owner = duplicate.owner.clone();
    duplicate.source_contract.writer = duplicate.allowed_writer.clone();
    assert!(matches!(
        registry.register(duplicate),
        Err(AuthorityRegistryError::DuplicateFactOwner { .. })
            | Err(AuthorityRegistryError::NamespaceOwnerConflict { .. })
    ));
    assert_eq!(registry.snapshot(), baseline);

    let dangling = gaonn_world_core::authority::AuthorityReference {
        id: AuthorityRecordId::new("canonical.domain01", "missing"),
        version: 1,
    };
    assert!(matches!(
        registry.resolve(&dangling),
        Err(AuthorityRegistryError::DanglingReference(_))
    ));
    assert_eq!(registry.snapshot(), baseline);

    let stale = gaonn_world_core::authority::AuthorityReference {
        id: reference.id.clone(),
        version: reference.version + 1,
    };
    assert!(matches!(
        registry.resolve(&stale),
        Err(AuthorityRegistryError::StaleReference { .. })
    ));
    assert_eq!(registry.snapshot(), baseline);

    assert!(matches!(
        registry.update_epoch(&reference, "domain99.shadow", 2, "wrong-owner-event"),
        Err(AuthorityRegistryError::WrongOwner { .. })
    ));
    assert_eq!(registry.snapshot(), baseline);
}

#[test]
fn boundary_distinguishes_active_inactive_tombstone_and_never_reuses_retired_id() {
    let (mut registry, active_ref) = registry_with_record();
    assert_eq!(
        registry.resolve_active(&active_ref).unwrap().lifecycle,
        AuthorityLifecycle::Active
    );

    let inactive_ref = registry
        .retire(&active_ref, "domain01.celestial_frame", 2, "retire-event")
        .expect("active authority may retire through owner");
    assert_eq!(
        registry.resolve(&inactive_ref).unwrap().lifecycle,
        AuthorityLifecycle::Inactive
    );
    assert_eq!(
        registry.resolve_active(&inactive_ref),
        Err(AuthorityRegistryError::ReferenceNotActive(
            AuthorityLifecycle::Inactive
        ))
    );

    let tombstone_ref = registry
        .tombstone(
            &inactive_ref,
            "domain01.celestial_frame",
            3,
            "tombstone-event",
        )
        .expect("inactive authority may become tombstone");
    assert_eq!(
        registry.resolve(&tombstone_ref).unwrap().lifecycle,
        AuthorityLifecycle::Tombstone
    );

    let snapshot = registry.snapshot();
    assert!(matches!(
        registry.register(registration("planet-mass")),
        Err(AuthorityRegistryError::RetiredIdentityReuse(_))
    ));
    assert_eq!(registry.snapshot(), snapshot);
}

#[test]
fn authority_rejects_noncanonical_owner_and_records_observer_layers_as_read_only() {
    let mut registry = AuthorityRegistry::new();
    let mut derived_registration = registration("derived-owner");
    derived_registration.source_contract.state_class = StateClass::Derived;
    assert_eq!(
        registry.register(derived_registration),
        Err(AuthorityRegistryError::NonCanonicalOwnerState {
            state_class: StateClass::Derived
        })
    );

    let reference = registry
        .register(registration("planet-mass"))
        .expect("canonical owner must register");
    for role in [
        ReadOnlyRole::Derived,
        ReadOnlyRole::Observer,
        ReadOnlyRole::Renderer,
        ReadOnlyRole::Analytics,
    ] {
        registry
            .register_read_only_role("objective.planet.mass", role)
            .unwrap();
    }

    assert_eq!(
        registry.read_only_roles("objective.planet.mass").unwrap(),
        vec![
            ReadOnlyRole::Derived,
            ReadOnlyRole::Observer,
            ReadOnlyRole::Renderer,
            ReadOnlyRole::Analytics,
        ]
    );
    assert_eq!(
        registry.resolve_active(&reference).unwrap().owner,
        "domain01.celestial_frame"
    );
}

#[test]
fn contract_consumes_s1_01_01_identity_version_owner_and_causal_parent_without_repair() {
    let mut registry = AuthorityRegistry::new();
    let mut invalid = registration("mismatch");
    invalid.fact_key = "objective.planet.radius".to_owned();
    let before = registry.snapshot();

    assert!(matches!(
        registry.register(invalid),
        Err(AuthorityRegistryError::SourceFactMismatch { .. })
    ));
    assert_eq!(registry.snapshot(), before);

    let valid = registration("planet-mass");
    let expected_parent = valid.source_contract.causal_parent.clone();
    let reference = registry.register(valid).unwrap();
    let record = registry.resolve(&reference).unwrap();
    assert_eq!(record.causal_parent, expected_parent);
}

#[test]
fn integration_runs_frozen_root_contract_to_authority_registry_without_shortcut() {
    let root_candidate = CanonicalCandidate::valid_fixture();
    let contract_receipt = CanonicalStateContract
        .validate(&root_candidate)
        .expect("S1.01.01 success path");

    let mut registry = AuthorityRegistry::new();
    let reference = registry
        .register(AuthorityRegistration {
            id: AuthorityRecordId::new("canonical.domain01", "planet-mass"),
            fact_key: contract_receipt.fact_key.clone(),
            owner: contract_receipt.owner.clone(),
            allowed_writer: contract_receipt.writer.clone(),
            authority_epoch: 1,
            source_contract: contract_receipt.clone(),
        })
        .expect("S1.01.02 success path");

    let output = registry.resolve_active(&reference).unwrap();
    assert_eq!(output.fact_key, contract_receipt.fact_key);
    assert_eq!(output.owner, contract_receipt.owner);
    assert_eq!(output.causal_parent, contract_receipt.causal_parent);
    assert_eq!(registry.lineage().len(), 1);
}

#[test]
fn persistence_snapshot_restore_preserves_id_version_lifecycle_access_lineage_and_digest() {
    let (mut registry, reference) = registry_with_record();
    registry
        .register_read_only_role("objective.planet.mass", ReadOnlyRole::Observer)
        .unwrap();
    let updated = registry
        .update_epoch(
            &reference,
            "domain01.celestial_frame",
            2,
            "authority-epoch-2",
        )
        .unwrap();
    assert_eq!(updated.version, 2);

    let snapshot = registry.snapshot();
    let digest = snapshot.evidence_digest64();
    let restored = AuthorityRegistry::restore(snapshot.clone()).expect("snapshot must restore");

    assert_eq!(restored.snapshot(), snapshot);
    assert_eq!(restored.snapshot().evidence_digest64(), digest);
    assert_eq!(restored.resolve_active(&updated).unwrap().version, 2);
}

fn replay_fixture() -> AuthorityRegistry {
    let (mut registry, reference) = registry_with_record();
    registry
        .register_read_only_role("objective.planet.mass", ReadOnlyRole::Renderer)
        .unwrap();
    let updated = registry
        .update_epoch(&reference, "domain01.celestial_frame", 2, "replay-event-2")
        .unwrap();
    registry
        .retire(&updated, "domain01.celestial_frame", 3, "replay-event-3")
        .unwrap();
    registry
}

#[test]
fn replay_same_input_produces_same_reference_lineage_order_and_digest() {
    let first = replay_fixture();
    let second = replay_fixture();

    assert_eq!(first.snapshot(), second.snapshot());
    assert_eq!(first.lineage(), second.lineage());
    assert_eq!(
        first.snapshot().evidence_digest64(),
        second.snapshot().evidence_digest64()
    );
}
