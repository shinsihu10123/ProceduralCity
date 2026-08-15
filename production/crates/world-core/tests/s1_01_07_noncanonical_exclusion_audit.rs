use gaonn_world_core::authority::{
    AuthorityRecordId, AuthorityRegistration, AuthorityRegistry,
};
use gaonn_world_core::exclusion_audit::{
    AuditAttempt, AuditDisposition, AuditError, AuditLayer, AuditOperation, AuditRequest,
    FirstFailureLocation, NonCanonicalStateExclusionAuditor, ViolationKind,
};
use gaonn_world_core::manifest::{AuthorityMappingManifest, ManifestRequest};
use gaonn_world_core::{CanonicalCandidate, CanonicalStateContract, ValidationReceipt};

struct Fixture {
    root: ValidationReceipt,
    registry: AuthorityRegistry,
    manifest: AuthorityMappingManifest,
}

fn fixture() -> Fixture {
    let root = CanonicalStateContract
        .validate(&CanonicalCandidate::valid_fixture())
        .expect("S1.01.01 must pass");
    let mut registry = AuthorityRegistry::new();
    registry
        .register(AuthorityRegistration {
            id: AuthorityRecordId::new("canonical.domain01", "planet-mass"),
            fact_key: root.fact_key.clone(),
            owner: root.owner.clone(),
            allowed_writer: root.writer.clone(),
            authority_epoch: 7,
            source_contract: root.clone(),
        })
        .expect("S1.01.02 must pass");
    let (manifest, _) = AuthorityMappingManifest::create(&registry, &ManifestRequest::valid_fixture())
        .expect("S1.01.06 must pass");

    Fixture {
        root,
        registry,
        manifest,
    }
}

fn attempt(fixture: &Fixture, layer: AuditLayer, operation: AuditOperation) -> AuditAttempt {
    let authority = fixture
        .registry
        .reference_for_fact("objective.planet.mass")
        .unwrap();
    AuditAttempt {
        attempt_id: format!("attempt-{layer:?}-{operation:?}"),
        fact_key: "objective.planet.mass".to_owned(),
        layer,
        operation,
        actor_owner: "domain01.celestial_frame".to_owned(),
        actor_writer: "domain01.celestial_frame".to_owned(),
        authority: Some(authority),
        source_version: 11,
        provenance: format!("source:{layer:?}"),
        lineage_digest: 0xA11D_0007,
        evidence_hash: format!("evidence:{layer:?}:{operation:?}"),
    }
}

fn run(
    fixture: &Fixture,
    attempts: &[AuditAttempt],
) -> Result<gaonn_world_core::exclusion_audit::NonCanonicalAuditEvidence, AuditError> {
    NonCanonicalStateExclusionAuditor.audit(
        &fixture.root,
        &fixture.registry,
        &fixture.manifest,
        &AuditRequest::valid_fixture(fixture.manifest.manifest_version()),
        attempts,
    )
}

#[test]
fn behavior_normal_allows_read_only_noncanonical_use_and_registered_canonical_owner_path() {
    let fixture = fixture();
    let attempts = vec![
        attempt(&fixture, AuditLayer::DerivedCache, AuditOperation::ReadOnly),
        attempt(
            &fixture,
            AuditLayer::ObservationSnapshot,
            AuditOperation::ReadOnly,
        ),
        attempt(
            &fixture,
            AuditLayer::Canonical,
            AuditOperation::DirectCanonicalCommit,
        ),
    ];

    let evidence = run(&fixture, &attempts).unwrap();
    assert!(evidence.violations.is_empty());
    assert_eq!(
        evidence.attempt_results[0].disposition,
        AuditDisposition::AllowedReadOnly
    );
    assert_eq!(
        evidence.attempt_results[2].disposition,
        AuditDisposition::AllowedCanonicalOwnerPath
    );
    assert_eq!(evidence.pre_state_digest, evidence.post_state_digest);
}

#[test]
fn behavior_failure_missing_required_evidence_blocks_without_changing_prestate() {
    let fixture = fixture();
    let registry_digest = fixture.registry.snapshot().evidence_digest64();
    let manifest_digest = fixture.manifest.evidence_digest64();
    let mut request = AuditRequest::valid_fixture(fixture.manifest.manifest_version());
    request.source_hash = None;

    assert_eq!(
        NonCanonicalStateExclusionAuditor.audit(
            &fixture.root,
            &fixture.registry,
            &fixture.manifest,
            &request,
            &[],
        ),
        Err(AuditError::MissingField("source_hash"))
    );
    assert_eq!(fixture.registry.snapshot().evidence_digest64(), registry_digest);
    assert_eq!(fixture.manifest.evidence_digest64(), manifest_digest);
}

#[test]
fn boundary_does_not_treat_out_of_scope_state_as_a_noncanonical_exclusion_violation() {
    let fixture = fixture();
    let mut outside = attempt(
        &fixture,
        AuditLayer::OutOfScope,
        AuditOperation::DirectCanonicalCommit,
    );
    outside.attempt_id = "other-subsystem-same-title".to_owned();
    outside.fact_key = "other.subsystem.same-name".to_owned();
    outside.authority = None;

    let derived = attempt(
        &fixture,
        AuditLayer::DerivedCache,
        AuditOperation::DirectCanonicalCommit,
    );
    let evidence = run(&fixture, &[outside, derived]).unwrap();

    assert_eq!(
        evidence.attempt_results[0].disposition,
        AuditDisposition::OutOfScope
    );
    assert_eq!(evidence.violations.len(), 1);
    assert_eq!(
        evidence.violations[0].violation,
        ViolationKind::DerivedCacheDirectCommit
    );
}

#[test]
fn authority_blocks_wrong_owner_and_noncanonical_writer_claims_but_keeps_read_paths_allowed() {
    let fixture = fixture();
    let mut wrong_owner = attempt(
        &fixture,
        AuditLayer::Canonical,
        AuditOperation::DirectCanonicalCommit,
    );
    wrong_owner.actor_owner = "component.shadow-owner".to_owned();
    wrong_owner.actor_writer = "component.shadow-owner".to_owned();

    let observer_writer = attempt(
        &fixture,
        AuditLayer::ObservationSnapshot,
        AuditOperation::RegisterCanonicalWriter,
    );
    let analytics_write = attempt(
        &fixture,
        AuditLayer::AnalyticsResult,
        AuditOperation::DuplicateCanonicalWrite,
    );
    let renderer_read = attempt(&fixture, AuditLayer::RenderBuffer, AuditOperation::ReadOnly);

    let evidence = run(
        &fixture,
        &[wrong_owner, observer_writer, analytics_write, renderer_read],
    )
    .unwrap();

    assert_eq!(evidence.violations.len(), 3);
    assert!(evidence.violations.iter().any(|record| {
        record.violation == ViolationKind::WrongOwnerCanonicalWrite
    }));
    assert!(evidence.violations.iter().any(|record| {
        record.violation == ViolationKind::ObservationSnapshotWriterRegistration
    }));
    assert!(evidence.violations.iter().any(|record| {
        record.violation == ViolationKind::AnalyticsCanonicalWrite
    }));
    assert_eq!(
        evidence.attempt_results[3].disposition,
        AuditDisposition::AllowedReadOnly
    );
    assert_eq!(evidence.pre_state_digest, evidence.post_state_digest);
}

#[test]
fn contract_preserves_root_id_version_owner_causal_parent_and_frozen_operands() {
    let fixture = fixture();
    let evidence = run(
        &fixture,
        &[attempt(
            &fixture,
            AuditLayer::DerivedCache,
            AuditOperation::ReadOnly,
        )],
    )
    .unwrap();

    assert_eq!(evidence.work_id, "S1.01.07");
    assert_eq!(evidence.root_fact_key, fixture.root.fact_key);
    assert_eq!(evidence.root_contract_version, fixture.root.contract_version);
    assert_eq!(evidence.root_owner, fixture.root.owner);
    assert_eq!(evidence.root_causal_parent, fixture.root.causal_parent);
    assert_eq!(
        evidence.operands,
        [
            "Non-Canonical",
            "Exclusion",
            "Canonical",
            "Authority",
            "Registry"
        ]
    );
    assert_eq!(
        evidence.causal_parent,
        "S1.01.06:authority-mapping-manifest"
    );

    let mut request = AuditRequest::valid_fixture(fixture.manifest.manifest_version());
    request.causal_parent = None;
    assert_eq!(
        NonCanonicalStateExclusionAuditor.audit(
            &fixture.root,
            &fixture.registry,
            &fixture.manifest,
            &request,
            &[],
        ),
        Err(AuditError::MissingField("causal_parent"))
    );
}

#[test]
fn integration_acceptance_detects_three_required_bypasses_with_first_failure_and_reproduction() {
    let fixture = fixture();
    let control = attempt(&fixture, AuditLayer::DerivedCache, AuditOperation::ReadOnly);
    let derived_commit = attempt(
        &fixture,
        AuditLayer::DerivedCache,
        AuditOperation::DirectCanonicalCommit,
    );
    let observation_writer = attempt(
        &fixture,
        AuditLayer::ObservationSnapshot,
        AuditOperation::RegisterCanonicalWriter,
    );
    let render_restore = attempt(
        &fixture,
        AuditLayer::RenderBuffer,
        AuditOperation::RestoreAsCanonical,
    );

    let evidence = run(
        &fixture,
        &[control, derived_commit, observation_writer, render_restore],
    )
    .unwrap();

    assert_eq!(evidence.violations.len(), 3);
    assert_eq!(
        evidence.violations[0].violation,
        ViolationKind::DerivedCacheDirectCommit
    );
    assert_eq!(
        evidence.violations[0].first_failure_location,
        FirstFailureLocation::CanonicalCommitPath
    );
    assert_eq!(
        evidence.violations[1].violation,
        ViolationKind::ObservationSnapshotWriterRegistration
    );
    assert_eq!(
        evidence.violations[1].first_failure_location,
        FirstFailureLocation::AuthorityRegistry
    );
    assert_eq!(
        evidence.violations[2].violation,
        ViolationKind::RenderBufferRestorePromotion
    );
    assert_eq!(
        evidence.violations[2].first_failure_location,
        FirstFailureLocation::PersistenceRestoreBoundary
    );
    assert!(
        evidence
            .violations
            .iter()
            .all(|record| !record.reproduction_steps.is_empty())
    );
    assert_eq!(evidence.pre_state_digest, evidence.post_state_digest);
}

#[test]
fn persistence_evidence_snapshot_restore_preserves_source_version_provenance_lineage_and_hash() {
    let fixture = fixture();
    let evidence = run(
        &fixture,
        &[attempt(
            &fixture,
            AuditLayer::DerivedCache,
            AuditOperation::DirectCanonicalCommit,
        )],
    )
    .unwrap();
    let digest = evidence.evidence_digest64();
    let restored =
        gaonn_world_core::exclusion_audit::NonCanonicalAuditEvidence::restore(evidence.snapshot())
            .unwrap();

    assert_eq!(restored.evidence_digest64(), digest);
    assert_eq!(restored.attempt_results[0].source_version, 11);
    assert_eq!(restored.attempt_results[0].provenance, "source:DerivedCache");
    assert_eq!(restored.attempt_results[0].lineage_digest, 0xA11D_0007);
    assert_eq!(
        restored.attempt_results[0].evidence_hash,
        "evidence:DerivedCache:DirectCanonicalCommit"
    );
}

fn replay_fixture() -> gaonn_world_core::exclusion_audit::NonCanonicalAuditEvidence {
    let fixture = fixture();
    run(
        &fixture,
        &[
            attempt(&fixture, AuditLayer::DerivedCache, AuditOperation::ReadOnly),
            attempt(
                &fixture,
                AuditLayer::ObservationSnapshot,
                AuditOperation::RegisterCanonicalWriter,
            ),
        ],
    )
    .unwrap()
}

#[test]
fn replay_same_snapshot_event_schema_source_hash_and_causal_reference_is_deterministic() {
    let first = replay_fixture();
    let second = replay_fixture();
    assert_eq!(first, second);
    assert_eq!(first.evidence_digest64(), second.evidence_digest64());
}
