use gaonn_world_core::authority::{
    AuthorityLifecycle, AuthorityRecordId, AuthorityRegistration, AuthorityRegistry,
    AuthorityRegistryError, LineageAction,
};
use gaonn_world_core::manifest::{
    AuthorityMappingManifest, ManifestError, ManifestRequest, ManifestWriteOrigin, MigrationDecision,
    AUTHORITY_MANIFEST_OWNER, S1_01_06_MANIFEST_SCHEMA_VERSION,
};
use gaonn_world_core::{CanonicalCandidate, CanonicalStateContract};

fn registry_fixture() -> AuthorityRegistry {
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
            source_contract: root,
        })
        .expect("S1.01.02 must pass");
    registry
}

fn request() -> ManifestRequest {
    ManifestRequest::valid_fixture()
}

#[test]
fn behavior_normal_create_lookup_and_exact_version_resolution_survive_manifest_refresh() {
    let mut registry = registry_fixture();
    let (mut manifest, receipt) = AuthorityMappingManifest::create(&registry, &request()).unwrap();
    assert_eq!(receipt.work_id, "S1.01.06");
    assert_eq!(receipt.manifest_version, 1);
    assert_eq!(receipt.migration, MigrationDecision::Initial);

    let before = manifest.entry("objective.planet.mass").unwrap().clone();
    assert_eq!(before.authority.version, 1);
    assert_eq!(before.lifecycle, AuthorityLifecycle::Active);
    assert_eq!(before.owner, "domain01.celestial_frame");

    let updated = registry
        .update_epoch(
            &before.authority,
            "domain01.celestial_frame",
            8,
            "S1.01.06:test-epoch-update",
        )
        .unwrap();
    let refresh = manifest.replace_from_registry(&registry, &request()).unwrap();
    assert_eq!(refresh.migration, MigrationDecision::ForwardCompatible);

    let after = manifest.entry("objective.planet.mass").unwrap();
    assert_eq!(after.authority.id, before.authority.id);
    assert_eq!(after.authority, updated);
    assert_eq!(after.parent_version, Some(1));
    assert_eq!(after.authority_epoch, 8);
    registry.resolve(&after.authority).unwrap();
}

#[test]
fn behavior_failure_missing_stale_duplicate_and_dangling_inputs_are_rejected_without_partial_result() {
    let registry = registry_fixture();

    let mut missing = request();
    missing.source_hash = None;
    assert_eq!(
        AuthorityMappingManifest::create(&registry, &missing),
        Err(ManifestError::MissingField("source_hash"))
    );

    let mut old_schema = request();
    old_schema.schema_version = Some(S1_01_06_MANIFEST_SCHEMA_VERSION + 1);
    assert_eq!(
        AuthorityMappingManifest::create(&registry, &old_schema),
        Err(ManifestError::UnsupportedSchemaVersion {
            expected: S1_01_06_MANIFEST_SCHEMA_VERSION,
            found: S1_01_06_MANIFEST_SCHEMA_VERSION + 1,
        })
    );

    let (manifest, _) = AuthorityMappingManifest::create(&registry, &request()).unwrap();
    let mut stale = manifest.snapshot();
    stale.entries[0].authority.version = 99;
    assert_eq!(
        AuthorityMappingManifest::load(stale, &registry),
        Err(ManifestError::Registry(AuthorityRegistryError::StaleReference {
            expected: 1,
            found: 99,
        }))
    );

    let mut dangling = manifest.snapshot();
    dangling.entries[0].authority.id.local_id = "missing-authority".to_owned();
    assert!(matches!(
        AuthorityMappingManifest::load(dangling, &registry),
        Err(ManifestError::Registry(
            AuthorityRegistryError::DanglingReference(_)
        ))
    ));

    let mut duplicate = manifest.snapshot();
    let mut duplicate_entry = duplicate.entries[0].clone();
    duplicate_entry.authority.id.local_id = "duplicate-fact-mapping".to_owned();
    duplicate.entries.push(duplicate_entry);
    assert_eq!(
        AuthorityMappingManifest::restore(duplicate),
        Err(ManifestError::DuplicateFactMapping(
            "objective.planet.mass".to_owned()
        ))
    );
}

#[test]
fn boundary_preserves_stable_identity_across_active_inactive_and_tombstone_lifecycle() {
    let mut registry = registry_fixture();
    let (mut manifest, _) = AuthorityMappingManifest::create(&registry, &request()).unwrap();
    let stable_id = manifest
        .entry("objective.planet.mass")
        .unwrap()
        .authority
        .id
        .clone();

    let active_v1 = registry.reference_for_fact("objective.planet.mass").unwrap();
    let inactive_v2 = registry
        .retire(
            &active_v1,
            "domain01.celestial_frame",
            8,
            "S1.01.06:test-retire",
        )
        .unwrap();
    manifest.replace_from_registry(&registry, &request()).unwrap();
    let retired = manifest.entry("objective.planet.mass").unwrap();
    assert_eq!(retired.authority.id, stable_id);
    assert_eq!(retired.authority, inactive_v2);
    assert_eq!(retired.lifecycle, AuthorityLifecycle::Inactive);

    let tombstone_v3 = registry
        .tombstone(
            &inactive_v2,
            "domain01.celestial_frame",
            9,
            "S1.01.06:test-tombstone",
        )
        .unwrap();
    manifest.replace_from_registry(&registry, &request()).unwrap();
    let tombstoned = manifest.entry("objective.planet.mass").unwrap();
    assert_eq!(tombstoned.authority.id, stable_id);
    assert_eq!(tombstoned.authority, tombstone_v3);
    assert_eq!(tombstoned.lifecycle, AuthorityLifecycle::Tombstone);

    let root = CanonicalStateContract
        .validate(&CanonicalCandidate::valid_fixture())
        .unwrap();
    assert_eq!(
        registry.register(AuthorityRegistration {
            id: stable_id,
            fact_key: root.fact_key.clone(),
            owner: root.owner.clone(),
            allowed_writer: root.writer.clone(),
            authority_epoch: 10,
            source_contract: root,
        }),
        Err(AuthorityRegistryError::RetiredIdentityReuse(
            AuthorityRecordId::new("canonical.domain01", "planet-mass")
        ))
    );
}

#[test]
fn authority_only_registered_manifest_owner_can_write_and_projection_layers_remain_read_only() {
    let registry = registry_fixture();
    let (manifest, _) = AuthorityMappingManifest::create(&registry, &request()).unwrap();
    assert!(manifest.entry("objective.planet.mass").is_some());

    let mut wrong_owner_manifest = manifest.clone();
    let pre_digest = wrong_owner_manifest.evidence_digest64();
    let mut wrong_owner = request();
    wrong_owner.actor_owner = Some("observer.layer".to_owned());
    assert_eq!(
        wrong_owner_manifest.replace_from_registry(&registry, &wrong_owner),
        Err(ManifestError::WrongManifestOwner {
            expected: AUTHORITY_MANIFEST_OWNER.to_owned(),
            found: "observer.layer".to_owned(),
        })
    );
    assert_eq!(wrong_owner_manifest.evidence_digest64(), pre_digest);

    for origin in [
        ManifestWriteOrigin::Derived,
        ManifestWriteOrigin::Observer,
        ManifestWriteOrigin::Renderer,
        ManifestWriteOrigin::Analytics,
    ] {
        let mut candidate = manifest.clone();
        let pre_digest = candidate.evidence_digest64();
        let mut prohibited = request();
        prohibited.origin = Some(origin);
        assert_eq!(
            candidate.replace_from_registry(&registry, &prohibited),
            Err(ManifestError::ProhibitedWriteOrigin(origin))
        );
        assert_eq!(candidate.evidence_digest64(), pre_digest);
    }
}

#[test]
fn contract_preserves_versioned_authority_canonical_registry_operands_and_causal_parent() {
    let registry = registry_fixture();
    let (manifest, receipt) = AuthorityMappingManifest::create(&registry, &request()).unwrap();
    let registry_reference = registry.reference_for_fact("objective.planet.mass").unwrap();
    let mapped = manifest.entry("objective.planet.mass").unwrap();

    assert_eq!(receipt.operands, ["Versioned", "Authority", "Canonical", "Registry"]);
    assert_eq!(receipt.causal_parent, "S1.01.05:authority-conflict");
    assert_eq!(mapped.authority, registry_reference);
    assert_eq!(mapped.owner, "domain01.celestial_frame");
    assert_eq!(mapped.allowed_writer, "domain01.celestial_frame");
    assert_eq!(mapped.authority_epoch, 7);
    assert_eq!(manifest.manifest_lineage()[0].causal_parent, receipt.causal_parent);
}

#[test]
fn integration_atomic_refresh_advances_lineage_and_failed_candidate_keeps_previous_manifest() {
    let mut registry = registry_fixture();
    let (mut manifest, _) = AuthorityMappingManifest::create(&registry, &request()).unwrap();
    let v1 = registry.reference_for_fact("objective.planet.mass").unwrap();
    registry
        .update_epoch(
            &v1,
            "domain01.celestial_frame",
            8,
            "S1.01.06:integration-update",
        )
        .unwrap();

    let receipt = manifest.replace_from_registry(&registry, &request()).unwrap();
    assert_eq!(receipt.manifest_version, 2);
    assert_eq!(receipt.migration, MigrationDecision::ForwardCompatible);
    assert!(manifest.authority_lineage().iter().any(|entry| {
        entry.action == LineageAction::Updated
            && entry.from_version == Some(1)
            && entry.to_version == 2
    }));

    let pre_failure_digest = manifest.evidence_digest64();
    let mut corrupt = registry.snapshot();
    let mut duplicate = corrupt.records[0].clone();
    duplicate.id.local_id = "duplicate-fact".to_owned();
    corrupt.records.push(duplicate);

    assert!(matches!(
        manifest.replace_from_registry_snapshot(corrupt, &request()),
        Err(ManifestError::Registry(
            AuthorityRegistryError::SnapshotCorrupt(_)
        ))
    ));
    assert_eq!(manifest.evidence_digest64(), pre_failure_digest);
    assert_eq!(manifest.manifest_version(), 2);
}

#[test]
fn persistence_snapshot_restore_and_registry_load_preserve_identity_version_lineage_and_digest() {
    let mut registry = registry_fixture();
    let (mut manifest, _) = AuthorityMappingManifest::create(&registry, &request()).unwrap();
    let v1 = registry.reference_for_fact("objective.planet.mass").unwrap();
    registry
        .update_epoch(
            &v1,
            "domain01.celestial_frame",
            8,
            "S1.01.06:persistence-update",
        )
        .unwrap();
    manifest.replace_from_registry(&registry, &request()).unwrap();

    let snapshot = manifest.snapshot();
    let digest = snapshot.evidence_digest64();
    let restored = AuthorityMappingManifest::restore(snapshot.clone()).unwrap();
    assert_eq!(restored.evidence_digest64(), digest);
    assert_eq!(restored.snapshot(), snapshot);

    let loaded = AuthorityMappingManifest::load(snapshot, &registry).unwrap();
    assert_eq!(loaded.evidence_digest64(), digest);
    assert_eq!(
        loaded.entry("objective.planet.mass").unwrap().authority.version,
        2
    );
}

fn replay_fixture() -> (u64, gaonn_world_core::manifest::ManifestUpdateReceipt) {
    let registry = registry_fixture();
    let (manifest, receipt) = AuthorityMappingManifest::create(&registry, &request()).unwrap();
    (manifest.evidence_digest64(), receipt)
}

#[test]
fn replay_same_snapshot_event_schema_source_hash_and_causal_reference_is_deterministic() {
    assert_eq!(replay_fixture(), replay_fixture());
}
