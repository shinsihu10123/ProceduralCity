use gaonn_world_core::authority::{AuthorityRecordId, AuthorityRegistration, AuthorityRegistry};
use gaonn_world_core::boundary::{
    BoundaryCandidate, BoundaryWriteTarget, CanonicalDerivedBoundary, CanonicalSourceReference,
    StateLayer, S1_01_03_BOUNDARY_VERSION,
};
use gaonn_world_core::write_authority::{
    CanonicalWriteAuthorityRule, WriteAuthorityDeclaration, WriteAuthorityError,
    WriteInterfaceBinding, WriteInterfaceCatalog, S1_01_04_DECLARATION_VERSION,
};
use gaonn_world_core::{CanonicalCandidate, CanonicalStateContract};

struct Fixture {
    registry: AuthorityRegistry,
    authority: gaonn_world_core::authority::AuthorityReference,
    boundary: gaonn_world_core::boundary::BoundaryResult,
    interfaces: WriteInterfaceCatalog,
}

fn fixture() -> Fixture {
    let receipt = CanonicalStateContract
        .validate(&CanonicalCandidate::valid_fixture())
        .expect("S1.01.01 fixture must pass");
    let mut registry = AuthorityRegistry::new();
    let authority = registry
        .register(AuthorityRegistration {
            id: AuthorityRecordId::new("canonical.domain01", "planet-mass"),
            fact_key: receipt.fact_key.clone(),
            owner: receipt.owner.clone(),
            allowed_writer: receipt.writer.clone(),
            authority_epoch: 7,
            source_contract: receipt,
        })
        .expect("S1.01.02 fixture must pass");

    let source = CanonicalSourceReference {
        fact_key: "objective.planet.mass".to_owned(),
        authority: authority.clone(),
        state_version: 11,
        causal_parent: "canonical-v11".to_owned(),
    };
    let boundary = CanonicalDerivedBoundary
        .validate(
            &registry,
            &BoundaryCandidate {
                state_key: Some("objective.planet.mass".to_owned()),
                version: Some(S1_01_03_BOUNDARY_VERSION),
                layer: Some(StateLayer::Canonical),
                owner: Some("domain01.celestial_frame".to_owned()),
                writer: Some("domain01.celestial_frame".to_owned()),
                write_target: Some(BoundaryWriteTarget::Canonical),
                source: Some(source),
                causal_parent: Some("S1.01.02:authority-registry".to_owned()),
            },
        )
        .expect("S1.01.03 canonical boundary must pass");

    let mut interfaces = WriteInterfaceCatalog::default();
    interfaces
        .register(WriteInterfaceBinding {
            interface_id: "world-core.celestial.write-mass".to_owned(),
            authority_id: authority.id.clone(),
            owner: "domain01.celestial_frame".to_owned(),
            writer: "domain01.celestial_frame".to_owned(),
            version: 3,
        })
        .expect("registered write interface fixture");

    Fixture {
        registry,
        authority,
        boundary,
        interfaces,
    }
}

fn declaration(fixture: &Fixture) -> WriteAuthorityDeclaration {
    WriteAuthorityDeclaration {
        declaration_version: Some(S1_01_04_DECLARATION_VERSION),
        fact_key: Some("objective.planet.mass".to_owned()),
        authority: Some(fixture.authority.clone()),
        owner: Some("domain01.celestial_frame".to_owned()),
        writer: Some("domain01.celestial_frame".to_owned()),
        interface_id: Some("world-core.celestial.write-mass".to_owned()),
        interface_version: Some(3),
        authority_epoch: Some(7),
        source_boundary: Some(fixture.boundary.clone()),
        causal_parent: Some("S1.01.03:canonical-boundary".to_owned()),
    }
}

#[test]
fn behavior_normal_allows_registered_owner_version_epoch_and_interface() {
    let fixture = fixture();
    let receipt = CanonicalWriteAuthorityRule
        .declare(
            &fixture.registry,
            &fixture.interfaces,
            &declaration(&fixture),
        )
        .expect("valid declaration must pass");

    assert_eq!(receipt.work_id, "S1.01.04");
    assert_eq!(receipt.authority, fixture.authority);
    assert_eq!(receipt.authority_epoch, 7);
    assert_eq!(receipt.interface_version, 3);
    assert_eq!(
        receipt.operands,
        ["Canonical", "Write", "Authority", "선언", "Registry"]
    );
}

#[test]
fn behavior_failure_rejects_missing_field_stale_epoch_and_unknown_interface_without_mutation() {
    let fixture = fixture();
    let authority_digest = fixture.registry.snapshot().evidence_digest64();
    let interface_digest = fixture.interfaces.snapshot().evidence_digest64();

    let mut missing = declaration(&fixture);
    missing.owner = None;
    assert_eq!(
        CanonicalWriteAuthorityRule.declare(
            &fixture.registry,
            &fixture.interfaces,
            &missing,
        ),
        Err(WriteAuthorityError::MissingField("owner"))
    );

    let mut stale = declaration(&fixture);
    stale.authority_epoch = Some(6);
    assert_eq!(
        CanonicalWriteAuthorityRule.declare(&fixture.registry, &fixture.interfaces, &stale),
        Err(WriteAuthorityError::StaleAuthorityEpoch {
            expected: 7,
            found: 6
        })
    );

    let mut unknown = declaration(&fixture);
    unknown.interface_id = Some("unregistered.interface".to_owned());
    assert_eq!(
        CanonicalWriteAuthorityRule.declare(
            &fixture.registry,
            &fixture.interfaces,
            &unknown,
        ),
        Err(WriteAuthorityError::UnknownInterface(
            "unregistered.interface".to_owned()
        ))
    );

    assert_eq!(fixture.registry.snapshot().evidence_digest64(), authority_digest);
    assert_eq!(
        fixture.interfaces.snapshot().evidence_digest64(),
        interface_digest
    );
}

#[test]
fn boundary_rejects_derived_and_observation_like_sources_even_with_similar_names() {
    let fixture = fixture();
    for layer in [
        StateLayer::Derived,
        StateLayer::TransientCache,
        StateLayer::ObservationView,
    ] {
        let mut candidate = declaration(&fixture);
        candidate.source_boundary.as_mut().unwrap().layer = layer;

        assert_eq!(
            CanonicalWriteAuthorityRule.declare(
                &fixture.registry,
                &fixture.interfaces,
                &candidate,
            ),
            Err(WriteAuthorityError::NonCanonicalSourceLayer(layer))
        );
    }
}

#[test]
fn authority_wrong_owner_writer_or_interface_binding_is_rejected_before_commit() {
    let fixture = fixture();
    let pre_digest = fixture.registry.snapshot().evidence_digest64();

    let mut wrong_owner = declaration(&fixture);
    wrong_owner.owner = Some("observer.read_model".to_owned());
    assert!(matches!(
        CanonicalWriteAuthorityRule.declare(
            &fixture.registry,
            &fixture.interfaces,
            &wrong_owner,
        ),
        Err(WriteAuthorityError::WrongOwner { .. })
    ));

    let mut wrong_writer = declaration(&fixture);
    wrong_writer.writer = Some("renderer.projection".to_owned());
    assert!(matches!(
        CanonicalWriteAuthorityRule.declare(
            &fixture.registry,
            &fixture.interfaces,
            &wrong_writer,
        ),
        Err(WriteAuthorityError::WrongWriter { .. })
    ));

    let mut wrong_interfaces = WriteInterfaceCatalog::default();
    wrong_interfaces
        .register(WriteInterfaceBinding {
            interface_id: "world-core.celestial.write-mass".to_owned(),
            authority_id: AuthorityRecordId::new("canonical.domain99", "other"),
            owner: "domain01.celestial_frame".to_owned(),
            writer: "domain01.celestial_frame".to_owned(),
            version: 3,
        })
        .unwrap();
    assert_eq!(
        CanonicalWriteAuthorityRule.declare(
            &fixture.registry,
            &wrong_interfaces,
            &declaration(&fixture),
        ),
        Err(WriteAuthorityError::InterfaceAuthorityMismatch)
    );

    assert_eq!(fixture.registry.snapshot().evidence_digest64(), pre_digest);
}

#[test]
fn contract_consumes_exact_boundary_authority_version_owner_and_causal_parent() {
    let fixture = fixture();
    let receipt = CanonicalWriteAuthorityRule
        .declare(
            &fixture.registry,
            &fixture.interfaces,
            &declaration(&fixture),
        )
        .unwrap();

    assert_eq!(receipt.authority, fixture.boundary.source.authority);
    assert_eq!(receipt.fact_key, fixture.boundary.state_key);
    assert_eq!(receipt.owner, fixture.boundary.owner);
    assert_eq!(
        receipt.writer,
        fixture.boundary.allowed_writer.clone().unwrap()
    );
    assert_eq!(receipt.causal_parent, "S1.01.03:canonical-boundary");
}

#[test]
fn integration_root_to_boundary_to_write_declaration_has_no_shortcut_or_partial_result() {
    let fixture = fixture();
    let authority_digest = fixture.registry.snapshot().evidence_digest64();

    let receipt = CanonicalWriteAuthorityRule
        .declare(
            &fixture.registry,
            &fixture.interfaces,
            &declaration(&fixture),
        )
        .expect("full predecessor chain must pass");
    assert_eq!(receipt.authority, fixture.authority);

    let mut invalid = declaration(&fixture);
    invalid.authority = None;
    assert_eq!(
        CanonicalWriteAuthorityRule.declare(
            &fixture.registry,
            &fixture.interfaces,
            &invalid,
        ),
        Err(WriteAuthorityError::MissingField("authority"))
    );
    assert_eq!(fixture.registry.snapshot().evidence_digest64(), authority_digest);
}

#[test]
fn persistence_catalog_restore_preserves_interface_identity_version_and_evidence_digest() {
    let fixture = fixture();
    let snapshot = fixture.interfaces.snapshot();
    let digest = snapshot.evidence_digest64();
    let restored = WriteInterfaceCatalog::restore(snapshot.clone()).unwrap();

    assert_eq!(restored.snapshot(), snapshot);
    assert_eq!(restored.snapshot().evidence_digest64(), digest);
    assert_eq!(
        restored
            .get("world-core.celestial.write-mass")
            .unwrap()
            .version,
        3
    );
}

fn replay_fixture() -> (u64, u64) {
    let fixture = fixture();
    let receipt = CanonicalWriteAuthorityRule
        .declare(
            &fixture.registry,
            &fixture.interfaces,
            &declaration(&fixture),
        )
        .unwrap();
    (
        receipt.evidence_digest64(),
        fixture.interfaces.snapshot().evidence_digest64(),
    )
}

#[test]
fn replay_same_snapshot_event_and_schema_produce_same_receipt_and_digest() {
    assert_eq!(replay_fixture(), replay_fixture());
}
