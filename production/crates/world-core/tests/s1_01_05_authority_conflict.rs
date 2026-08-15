use gaonn_world_core::authority::{AuthorityRecordId, AuthorityRegistration, AuthorityRegistry};
use gaonn_world_core::boundary::{
    BoundaryCandidate, BoundaryWriteTarget, CanonicalDerivedBoundary, CanonicalSourceReference,
    S1_01_03_BOUNDARY_VERSION, StateLayer,
};
use gaonn_world_core::conflict::{
    AuthorityConflictDetector, CompetingWriteIntent, ConflictInput, ConflictInputError,
    ConflictKind, IntentAccess, S1_01_05_CONFLICT_VERSION, WriteScope,
};
use gaonn_world_core::write_authority::{
    CanonicalWriteAuthorityRule, S1_01_04_DECLARATION_VERSION, WriteAuthorityDeclaration,
    WriteAuthorityReceipt, WriteInterfaceBinding, WriteInterfaceCatalog,
};
use gaonn_world_core::{CanonicalCandidate, CanonicalStateContract};

struct Fixture {
    registry: AuthorityRegistry,
    receipt: WriteAuthorityReceipt,
}

fn fixture() -> Fixture {
    let root = CanonicalStateContract
        .validate(&CanonicalCandidate::valid_fixture())
        .expect("S1.01.01 must pass");
    let mut registry = AuthorityRegistry::new();
    let authority = registry
        .register(AuthorityRegistration {
            id: AuthorityRecordId::new("canonical.domain01", "planet-mass"),
            fact_key: root.fact_key.clone(),
            owner: root.owner.clone(),
            allowed_writer: root.writer.clone(),
            authority_epoch: 7,
            source_contract: root,
        })
        .expect("S1.01.02 must pass");

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
                source: Some(CanonicalSourceReference {
                    fact_key: "objective.planet.mass".to_owned(),
                    authority: authority.clone(),
                    state_version: 11,
                    causal_parent: "canonical-v11".to_owned(),
                }),
                causal_parent: Some("S1.01.02:authority-registry".to_owned()),
            },
        )
        .expect("S1.01.03 must pass");

    let mut interfaces = WriteInterfaceCatalog::default();
    interfaces
        .register(WriteInterfaceBinding {
            interface_id: "world-core.celestial.write-mass".to_owned(),
            authority_id: authority.id.clone(),
            owner: "domain01.celestial_frame".to_owned(),
            writer: "domain01.celestial_frame".to_owned(),
            version: 3,
        })
        .unwrap();

    let receipt = CanonicalWriteAuthorityRule
        .declare(
            &registry,
            &interfaces,
            &WriteAuthorityDeclaration {
                declaration_version: Some(S1_01_04_DECLARATION_VERSION),
                fact_key: Some("objective.planet.mass".to_owned()),
                authority: Some(authority),
                owner: Some("domain01.celestial_frame".to_owned()),
                writer: Some("domain01.celestial_frame".to_owned()),
                interface_id: Some("world-core.celestial.write-mass".to_owned()),
                interface_version: Some(3),
                authority_epoch: Some(7),
                source_boundary: Some(boundary),
                causal_parent: Some("S1.01.03:canonical-boundary".to_owned()),
            },
        )
        .expect("S1.01.04 must pass");

    Fixture { registry, receipt }
}

fn input(fixture: &Fixture) -> ConflictInput {
    ConflictInput {
        schema_version: Some(S1_01_05_CONFLICT_VERSION),
        state_key: Some("objective.planet.mass".to_owned()),
        registered_owner: Some("domain01.celestial_frame".to_owned()),
        registered_writer: Some("domain01.celestial_frame".to_owned()),
        authority_epoch: Some(7),
        candidate_owner: Some("domain01.celestial_frame".to_owned()),
        candidate_writer: Some("domain01.celestial_frame".to_owned()),
        base_version: Some(fixture.receipt.authority.version),
        authority: Some(fixture.receipt.authority.clone()),
        candidate_layer: Some(StateLayer::Canonical),
        candidate_access: Some(IntentAccess::CanonicalWrite),
        candidate_scope: Some(WriteScope::WholeFact),
        candidate_component: Some("component.celestial".to_owned()),
        competing_write_intents: Some(vec![]),
        source_hash: Some("frozen-source-hash-s1.01.05".to_owned()),
        run_identity: Some("run-s1.01.05-001".to_owned()),
        causal_parent: Some("S1.01.04:write-authority".to_owned()),
    }
}

#[test]
fn behavior_normal_accepts_valid_owner_and_detects_only_real_conflicts() {
    let fixture = fixture();
    let detector = AuthorityConflictDetector;

    let valid = detector
        .detect(&fixture.registry, &fixture.receipt, &input(&fixture))
        .unwrap();
    assert_eq!(valid.conflict, ConflictKind::None);
    assert!(!valid.block_commit);

    let mut wrong_writer = input(&fixture);
    wrong_writer.candidate_writer = Some("component.other".to_owned());
    let wrong = detector
        .detect(&fixture.registry, &fixture.receipt, &wrong_writer)
        .unwrap();
    assert_eq!(wrong.conflict, ConflictKind::WrongWriter);
    assert!(wrong.block_commit);

    let mut stale_epoch = input(&fixture);
    stale_epoch.authority_epoch = Some(6);
    let stale = detector
        .detect(&fixture.registry, &fixture.receipt, &stale_epoch)
        .unwrap();
    assert_eq!(stale.conflict, ConflictKind::StaleAuthorityEpoch);

    let snapshot = fixture.registry.snapshot();
    let restored = AuthorityRegistry::restore(snapshot).unwrap();
    let restored_result = detector
        .detect(&restored, &fixture.receipt, &input(&fixture))
        .unwrap();
    assert_eq!(valid, restored_result);
}

#[test]
fn behavior_failure_missing_evidence_blocks_without_partial_conflict_result_or_state_change() {
    let fixture = fixture();
    let pre_digest = fixture.registry.snapshot().evidence_digest64();
    let mut invalid = input(&fixture);
    invalid.source_hash = None;

    assert_eq!(
        AuthorityConflictDetector.detect(&fixture.registry, &fixture.receipt, &invalid),
        Err(ConflictInputError::MissingField("source_hash"))
    );
    assert_eq!(fixture.registry.snapshot().evidence_digest64(), pre_digest);
}

#[test]
fn boundary_distinguishes_read_access_and_independent_state_keys_from_same_key_conflict() {
    let fixture = fixture();
    let detector = AuthorityConflictDetector;

    let mut read_only = input(&fixture);
    read_only.candidate_access = Some(IntentAccess::ReadOnly);
    read_only.candidate_writer = Some("observer.read-model".to_owned());
    read_only.candidate_layer = Some(StateLayer::ObservationView);
    let read_result = detector
        .detect(&fixture.registry, &fixture.receipt, &read_only)
        .unwrap();
    assert_eq!(read_result.conflict, ConflictKind::None);

    let mut independent = input(&fixture);
    independent.competing_write_intents = Some(vec![CompetingWriteIntent {
        state_key: "objective.planet.radius".to_owned(),
        owner: "domain01.celestial_frame".to_owned(),
        writer: "component.other".to_owned(),
        authority_epoch: 7,
        base_version: fixture.receipt.authority.version,
        authority: fixture.receipt.authority.clone(),
        layer: StateLayer::Canonical,
        access: IntentAccess::CanonicalWrite,
        scope: WriteScope::WholeFact,
        component_id: "component.other".to_owned(),
    }]);
    let independent_result = detector
        .detect(&fixture.registry, &fixture.receipt, &independent)
        .unwrap();
    assert_eq!(independent_result.conflict, ConflictKind::None);
}

#[test]
fn authority_detects_duplicate_owner_and_noncanonical_writer_claim_without_mutating_registry() {
    let fixture = fixture();
    let pre_digest = fixture.registry.snapshot().evidence_digest64();

    let mut duplicate_owner = input(&fixture);
    duplicate_owner.candidate_owner = Some("component.shadow-owner".to_owned());
    let duplicate = AuthorityConflictDetector
        .detect(&fixture.registry, &fixture.receipt, &duplicate_owner)
        .unwrap();
    assert_eq!(duplicate.conflict, ConflictKind::DuplicateOwner);
    assert!(duplicate.block_commit);

    for layer in [
        StateLayer::Derived,
        StateLayer::TransientCache,
        StateLayer::ObservationView,
    ] {
        let mut noncanonical = input(&fixture);
        noncanonical.candidate_layer = Some(layer);
        let result = AuthorityConflictDetector
            .detect(&fixture.registry, &fixture.receipt, &noncanonical)
            .unwrap();
        assert_eq!(
            result.conflict,
            ConflictKind::NonCanonicalWriterClaim(layer)
        );
        assert!(result.block_commit);
    }

    assert_eq!(fixture.registry.snapshot().evidence_digest64(), pre_digest);
}

#[test]
fn contract_requires_exact_s1_01_04_authority_owner_writer_and_causal_reference() {
    let fixture = fixture();
    let result = AuthorityConflictDetector
        .detect(&fixture.registry, &fixture.receipt, &input(&fixture))
        .unwrap();

    assert_eq!(result.work_id, "S1.01.05");
    assert_eq!(result.state_key, fixture.receipt.fact_key);
    assert_eq!(result.registered_owner, fixture.receipt.owner);
    assert_eq!(result.registered_writer, fixture.receipt.writer);
    assert_eq!(result.causal_parent, "S1.01.04:write-authority");

    let mut mismatched_receipt = fixture.receipt.clone();
    mismatched_receipt.writer = "component.other".to_owned();
    assert_eq!(
        AuthorityConflictDetector.detect(&fixture.registry, &mismatched_receipt, &input(&fixture),),
        Err(ConflictInputError::UpstreamReceiptMismatch("writer"))
    );
}

#[test]
fn integration_detects_overlapping_same_fact_write_scope_and_preserves_prestate() {
    let fixture = fixture();
    let pre_digest = fixture.registry.snapshot().evidence_digest64();
    let mut candidate = input(&fixture);
    candidate.candidate_scope = Some(WriteScope::Field("mass".to_owned()));
    candidate.competing_write_intents = Some(vec![CompetingWriteIntent {
        state_key: "objective.planet.mass".to_owned(),
        owner: "domain01.celestial_frame".to_owned(),
        writer: "component.concurrent".to_owned(),
        authority_epoch: 7,
        base_version: fixture.receipt.authority.version,
        authority: fixture.receipt.authority.clone(),
        layer: StateLayer::Canonical,
        access: IntentAccess::CanonicalWrite,
        scope: WriteScope::Field("mass".to_owned()),
        component_id: "component.concurrent".to_owned(),
    }]);

    let result = AuthorityConflictDetector
        .detect(&fixture.registry, &fixture.receipt, &candidate)
        .unwrap();
    assert_eq!(
        result.conflict,
        ConflictKind::OverlappingWriteScope {
            competing_component: "component.concurrent".to_owned()
        }
    );
    assert!(result.block_commit);
    assert!(result.commit_block_reason.is_some());
    assert_eq!(fixture.registry.snapshot().evidence_digest64(), pre_digest);
}

fn replay_fixture() -> (u64, gaonn_world_core::conflict::AuthorityConflictResult) {
    let fixture = fixture();
    let result = AuthorityConflictDetector
        .detect(&fixture.registry, &fixture.receipt, &input(&fixture))
        .unwrap();
    (result.evidence_digest64(), result)
}

#[test]
fn replay_same_snapshot_event_schema_source_hash_and_run_identity_is_deterministic() {
    assert_eq!(replay_fixture(), replay_fixture());
}
