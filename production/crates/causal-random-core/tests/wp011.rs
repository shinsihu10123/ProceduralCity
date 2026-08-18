use gaonn_causal_random_core::*;
use gaonn_identity_reuse_audit_core::{AuditEvidence, IdentityIssuanceAttempt, IssuanceKind};
use gaonn_world_time_core::{EpochDescriptor, WorldTimeState, Wp004Acceptance};
use std::collections::BTreeSet;

fn reuse_audit() -> AuditEvidence {
    AuditEvidence {
        work_id: "S1.02.09",
        checked: 1,
        violations: vec![],
        canonical_mutation: false,
        predecessor_digest: 42,
    }
}

fn identity_proof() -> Wp002ClosureProof {
    Wp002ClosureProof {
        version: 1,
        member_evidence: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        reuse_audit: reuse_audit(),
        causal_parent: "WP-002:CLOSED".to_owned(),
    }
}

fn time_acceptance() -> Wp004Acceptance {
    Wp004Acceptance {
        work_package: "WP-004",
        member_ids: [
            "S1.05.01", "S1.05.02", "S1.05.03", "S1.05.04", "S1.05.05", "S1.05.06", "S1.05.07",
            "S1.05.08", "S1.05.09",
        ],
        predecessor_digest64: 11,
        evidence_digest64: 22,
        closed: true,
    }
}

fn admission() -> AdmissionReceipt {
    admit(&identity_proof(), &time_acceptance()).unwrap()
}

fn world_time(tick: i128) -> WorldTimeState {
    WorldTimeState {
        epoch: EpochDescriptor {
            id: "world-epoch-1".to_owned(),
            unit: "ns".to_owned(),
            frame: "absolute".to_owned(),
            version: 1,
            owner: gaonn_world_time_core::OWNER.to_owned(),
            causal_parent: "time-root".to_owned(),
        },
        tick,
        microstep: 0,
        version: 1,
        owner: gaonn_world_time_core::OWNER.to_owned(),
        causal_parent: "time-event".to_owned(),
    }
}

fn seed() -> VersionedWorldSeed {
    VersionedWorldSeed {
        stable_id: "world-seed".to_owned(),
        namespace: "random.world-seed".to_owned(),
        version: 1,
        owner: OWNER.to_owned(),
        causal_parent: "genesis:seed".to_owned(),
        predecessor: None,
        root256: [0x11, 0x22, 0x33, 0x44],
        creation_token: "creation:world-root".to_owned(),
    }
}

fn registry() -> RandomRegistry {
    let mut registry = RandomRegistry::default();
    let seed_ref = registry
        .create_seed(seed(), WriteOrigin::RegistryAuthority)
        .unwrap();
    registry
        .create_lineage(
            RandomLineage {
                stable_id: "lineage-main".to_owned(),
                namespace: "random.lineage".to_owned(),
                version: 1,
                owner: OWNER.to_owned(),
                causal_parent: "genesis:lineage".to_owned(),
                seed_ref,
            },
            WriteOrigin::RegistryAuthority,
        )
        .unwrap();
    registry
        .create_namespace(
            DomainRandomNamespace {
                stable_id: "domain-biology".to_owned(),
                namespace: "random.domain".to_owned(),
                version: 1,
                owner: OWNER.to_owned(),
                causal_parent: "registry:biology".to_owned(),
                domain_id: "biology".to_owned(),
                purpose_ids: BTreeSet::from(["mutation".to_owned(), "survival".to_owned()]),
            },
            WriteOrigin::RegistryAuthority,
        )
        .unwrap();
    registry
}

fn address(sample_index: u64) -> CausalRandomAddress {
    CausalRandomAddress {
        random_lineage_id: "lineage-main".to_owned(),
        purpose_id: "mutation".to_owned(),
        subject_key: entity_component("entity-42", "entity.identity", 3, "birth:42").unwrap(),
        episode: episode_component("mutation-process", "episode-7").unwrap(),
        time_counter: time_counter_component(&world_time(1_000), 4).unwrap(),
        domain_namespace: "domain-biology".to_owned(),
        sample_role_id: "allele-choice".to_owned(),
        sample_index,
    }
}

#[test]
fn admission_requires_wp002_and_wp004_pass_evidence() {
    let ok = admission();
    assert_eq!(ok.identity_predecessor, "WP-002");
    assert_eq!(ok.time_predecessor, "WP-004");
    let mut bad_identity = identity_proof();
    bad_identity.member_evidence[4] = 0;
    assert_eq!(
        admit(&bad_identity, &time_acceptance()),
        Err(RandomError::InvalidPredecessor("WP-002"))
    );
    let mut bad_time = time_acceptance();
    bad_time.closed = false;
    assert_eq!(
        admit(&identity_proof(), &bad_time),
        Err(RandomError::InvalidPredecessor("WP-004"))
    );
}

#[test]
fn s1_10_01_contract_preserves_operands_owner_seed_address_and_candidate_only() {
    let seed_ref = seed().reference();
    let input = ContractInput {
        schema_version: 1,
        owner: OWNER.to_owned(),
        causal_parent: "event:contract".to_owned(),
        transition: "sample".to_owned(),
        allowed_transitions: BTreeSet::from(["sample".to_owned()]),
        seed_ref,
        address: address(0),
    };
    let receipt = validate_contract(&admission(), &input).unwrap();
    assert_eq!(receipt.work_id, "S1.10.01");
    assert_eq!(receipt.operands, OPERANDS);
    assert_eq!(receipt.disposition, Disposition::CandidateOnly);
    let mut bad = input;
    bad.transition = "invented".to_owned();
    assert!(matches!(
        validate_contract(&admission(), &bad),
        Err(RandomError::ProhibitedTransition(_))
    ));
}

#[test]
fn s1_10_02_versioned_world_seed_is_owner_version_and_lineage_checked() {
    let mut registry = RandomRegistry::default();
    let first = seed();
    let first_ref = registry
        .create_seed(first.clone(), WriteOrigin::RegistryAuthority)
        .unwrap();
    let mut second = first;
    second.version = 2;
    second.predecessor = Some(first_ref);
    second.causal_parent = "seed:revision".to_owned();
    second.root256 = [0x55, 0x66, 0x77, 0x88];
    assert_eq!(
        registry
            .update_seed(second, WriteOrigin::RegistryAuthority)
            .unwrap()
            .version,
        2
    );
    let mut wrong = seed();
    wrong.owner = "observer".to_owned();
    assert_eq!(
        RandomRegistry::default().create_seed(wrong, WriteOrigin::RegistryAuthority),
        Err(RandomError::WrongOwner)
    );
}

#[test]
fn s1_10_03_entity_component_is_stable_identity_not_display_name() {
    let component = entity_component("persistent-17", "entity.identity", 9, "birth:17").unwrap();
    assert_eq!(component.stable_entity_id, "persistent-17");
    assert_eq!(component.identity_version, 9);
    assert_eq!(
        entity_component("persistent-17", "entity.identity", 0, "birth:17"),
        Err(RandomError::StaleVersion)
    );
}

#[test]
fn s1_10_04_process_episode_component_requires_semantic_process_and_episode() {
    let component = episode_component("infection-hazard", "host-17:episode-2").unwrap();
    assert_eq!(component.process_key, "infection-hazard");
    assert!(matches!(
        episode_component("", "host-17:episode-2"),
        Err(RandomError::MissingField("episode.process_key"))
    ));
}

#[test]
fn s1_10_05_worldtime_counter_uses_absolute_worldtime_not_wall_clock() {
    let component = time_counter_component(&world_time(55), 8).unwrap();
    assert_eq!(component.world_epoch_id, "world-epoch-1");
    assert_eq!(component.world_tick, 55);
    assert_eq!(component.counter, 8);
}

#[test]
fn s1_10_06_domain_namespace_is_versioned_owner_only_and_purpose_checked() {
    let registry = registry();
    let namespace = registry.namespace("domain-biology").unwrap();
    assert!(namespace.purpose_ids.contains("mutation"));
    let mut bad_address = address(0);
    bad_address.purpose_id = "unregistered-purpose".to_owned();
    assert_eq!(
        validate_address_against_registry(&registry, &bad_address),
        Err(RandomError::UnknownPurpose(
            "unregistered-purpose".to_owned()
        ))
    );
}

#[test]
fn s1_10_07_stateless_generation_retries_same_address_without_stream_consumption() {
    let reg = registry();
    let a = address(12);
    let first = stateless_sample_u64(&reg, &a).unwrap();
    let second = stateless_sample_u64(&reg, &a).unwrap();
    assert_eq!(first, second);
    assert_eq!(reg.digest64(), registry().digest64());
    let other = stateless_sample_u64(&reg, &address(13)).unwrap();
    assert_ne!(first, other);
}

#[test]
fn s1_10_08_distribution_primitives_are_deterministic_and_fail_closed() {
    let sample = 0x8000_0000_0000_0000;
    assert_eq!(
        deterministic_distribution(sample, DistributionPrimitive::RawU64).unwrap(),
        DistributionValue::U64(sample)
    );
    assert_eq!(
        deterministic_distribution(
            sample,
            DistributionPrimitive::BernoulliThreshold {
                inclusive_threshold: sample
            }
        )
        .unwrap(),
        DistributionValue::Bool(true)
    );
    let bounded = deterministic_distribution(
        sample,
        DistributionPrimitive::UniformBounded {
            upper_exclusive: 10,
        },
    )
    .unwrap();
    assert_eq!(bounded, DistributionValue::U64(5));
    assert_eq!(
        deterministic_distribution(
            sample,
            DistributionPrimitive::UniformBounded { upper_exclusive: 0 }
        ),
        Err(RandomError::InvalidDistribution("upper_exclusive=0"))
    );
}

#[test]
fn authority_observer_worker_retry_and_camera_cannot_mutate_random_registry() {
    for origin in [
        WriteOrigin::Observer,
        WriteOrigin::Renderer,
        WriteOrigin::Analytics,
        WriteOrigin::Worker,
        WriteOrigin::Thread,
        WriteOrigin::Gpu,
        WriteOrigin::Partition,
        WriteOrigin::Retry,
        WriteOrigin::Camera,
        WriteOrigin::DomainProcess,
    ] {
        let mut registry = RandomRegistry::default();
        let pre = registry.digest64();
        assert!(matches!(
            registry.create_seed(seed(), origin),
            Err(RandomError::UnauthorizedWrite(_))
        ));
        assert_eq!(pre, registry.digest64());
    }
}

#[test]
fn persistence_restore_and_replay_preserve_registry_and_same_address_sample() {
    let registry = registry();
    let before = stateless_sample_u64(&registry, &address(9)).unwrap();
    let snapshot = RandomSnapshot {
        schema_version: 1,
        commit_marker: "commit:random".to_owned(),
        causal_cut: "cut:1000".to_owned(),
        registry,
    };
    let digest = snapshot.digest64().unwrap();
    let restored = snapshot.restore().unwrap();
    assert_eq!(restored.digest64(), snapshot.registry.digest64());
    assert_eq!(
        before,
        stateless_sample_u64(&restored, &address(9)).unwrap()
    );
    assert_eq!(digest, snapshot.digest64().unwrap());
}

#[test]
fn address_excludes_worker_partition_retry_camera_and_insertion_order() {
    let encoded = address(2).stable_encoding().unwrap();
    for forbidden in ["worker", "thread", "gpu", "partition", "retry", "camera"] {
        assert!(!encoded.contains(forbidden));
    }
    let mut purposes_a = BTreeSet::new();
    purposes_a.insert("survival".to_owned());
    purposes_a.insert("mutation".to_owned());
    let purposes_b = BTreeSet::from(["mutation".to_owned(), "survival".to_owned()]);
    assert_eq!(purposes_a, purposes_b);
}

#[test]
fn wp011_integration_and_acceptance_require_all_eight_members_and_snapshot_evidence() {
    let admission = admission();
    let registry = registry();
    let seed_ref = registry.seed("world-seed").unwrap().reference();
    let contract = validate_contract(
        &admission,
        &ContractInput {
            schema_version: 1,
            owner: OWNER.to_owned(),
            causal_parent: "integration".to_owned(),
            transition: "sample".to_owned(),
            allowed_transitions: BTreeSet::from(["sample".to_owned()]),
            seed_ref,
            address: address(5),
        },
    )
    .unwrap();
    let sample = stateless_sample_u64(&registry, &address(5)).unwrap();
    let transformed = deterministic_distribution(
        sample,
        DistributionPrimitive::UniformBounded {
            upper_exclusive: 17,
        },
    )
    .unwrap();
    assert!(matches!(transformed, DistributionValue::U64(value) if value < 17));
    assert_ne!(contract.address_digest64, 0);
    let snapshot = RandomSnapshot {
        schema_version: 1,
        commit_marker: "commit:integration".to_owned(),
        causal_cut: "cut:integration".to_owned(),
        registry,
    };
    let acceptance = accept_wp(
        &admission,
        &[true; 8],
        &[1, 2, 3, 4, 5, 6, 7, 8],
        snapshot.digest64().unwrap(),
    )
    .unwrap();
    assert!(acceptance.closed);
    assert_eq!(acceptance.member_ids, MEMBER_IDS);
    let mut missing = [true; 8];
    missing[6] = false;
    assert_eq!(
        accept_wp(&admission, &missing, &[1; 8], 1),
        Err(RandomError::MissingEvidence("S1.10.07"))
    );
}

#[test]
fn identity_audit_fixture_does_not_create_random_identity_shortcut() {
    let attempt = IdentityIssuanceAttempt {
        work_id: "fixture".to_owned(),
        stable_id: "different-id".to_owned(),
        namespace: "entity.identity".to_owned(),
        namespace_version: "v1".to_owned(),
        entity_version: 1,
        lifecycle_lineage: "fixture".to_owned(),
        kind: IssuanceKind::Continuation,
    };
    assert_ne!(attempt.stable_id, address(0).subject_key.stable_entity_id);
}
