use gaonn_validation_core::*;
use gaonn_world_core::{CanonicalCandidate, CanonicalStateContract};
use std::collections::BTreeSet;

fn root() -> gaonn_world_core::ValidationReceipt {
    CanonicalStateContract
        .validate(&CanonicalCandidate::valid_fixture())
        .unwrap()
}

fn identity(
    stable_id: &str,
    namespace: &str,
    version: u32,
    predecessor: Option<VersionRef>,
    status: RecordStatus,
) -> RecordIdentity {
    RecordIdentity {
        stable_id: stable_id.to_owned(),
        namespace: namespace.to_owned(),
        version,
        owner: OWNER.to_owned(),
        causal_parent: format!("cause:{stable_id}:{version}"),
        predecessor,
        status,
    }
}

fn schema_record(
    stable_id: &str,
    namespace: &str,
    version: u32,
    predecessor: Option<VersionRef>,
    status: RecordStatus,
) -> EvidenceSchemaRecord {
    EvidenceSchemaRecord {
        identity: identity(stable_id, namespace, version, predecessor, status),
        source_hash: "source-sha256:abc".to_owned(),
        build_identity: "build:fixture-1".to_owned(),
        run_identity: "run:seed-17".to_owned(),
        test_log_ref: "log:wp005".to_owned(),
        adjudication_ref: "judge:domain27".to_owned(),
    }
}

fn create_schema(registry: &mut ValidationRegistry) -> VersionRef {
    registry
        .create_schema(
            schema_record("schema-1", "validation.schema.1", 1, None, RecordStatus::Active),
            WriteOrigin::OwningResolver,
        )
        .unwrap()
}

fn tier_record(
    tier: ValidationTier,
    schema_ref: VersionRef,
    version: u32,
    predecessor: Option<VersionRef>,
    status: RecordStatus,
) -> TierRegistryRecord {
    TierRegistryRecord {
        identity: identity(
            &format!("{}-record", tier.code().to_lowercase()),
            &format!("validation.{}", tier.code().to_lowercase()),
            version,
            predecessor,
            status,
        ),
        tier,
        evidence_schema_ref: schema_ref,
        target_state_ref: "source-domain:state:42".to_owned(),
    }
}

fn exercise_tier(tier: ValidationTier) {
    let mut registry = ValidationRegistry::default();
    let schema_ref = create_schema(&mut registry);
    let first = tier_record(tier, schema_ref.clone(), 1, None, RecordStatus::Active);
    let first_ref = registry
        .create_tier(first, WriteOrigin::OwningResolver)
        .unwrap();
    assert_eq!(
        registry.tier(tier, &first_ref.stable_id).unwrap().tier,
        tier
    );

    let encoded = registry.encode_stable();
    let mut restored = ValidationRegistry::decode_stable(&encoded).unwrap();
    assert_eq!(restored.encode_stable(), encoded);
    assert_eq!(restored.digest64(), registry.digest64());

    let revised = tier_record(
        tier,
        schema_ref,
        2,
        Some(first_ref.clone()),
        RecordStatus::Active,
    );
    let second_ref = restored
        .update_tier(revised, WriteOrigin::OwningResolver)
        .unwrap();
    assert_eq!(second_ref.version, 2);
    let retired_ref = restored
        .retire_tier(
            tier,
            &second_ref.stable_id,
            3,
            "cause:retire",
            WriteOrigin::OwningResolver,
        )
        .unwrap();
    assert_eq!(retired_ref.version, 3);
    assert!(matches!(
        restored.tier(tier, &second_ref.stable_id),
        Err(ValidationError::RetiredRecord(_))
    ));
}

fn tiers(values: &[ValidationTier]) -> BTreeSet<ValidationTier> {
    values.iter().copied().collect()
}

fn decision_request(
    outcome: ValidationOutcome,
    required_tiers: BTreeSet<ValidationTier>,
    covered_tiers: BTreeSet<ValidationTier>,
) -> OutcomeRequest {
    OutcomeRequest {
        stable_id: "decision-1".to_owned(),
        namespace: "validation.decision.1".to_owned(),
        version: 1,
        owner: OWNER.to_owned(),
        causal_parent: "cause:validation-run".to_owned(),
        origin: WriteOrigin::OwningResolver,
        target_state_ref: "source-domain:state:42".to_owned(),
        evidence_schema_ref: VersionRef {
            stable_id: "schema-1".to_owned(),
            namespace: "validation.schema.1".to_owned(),
            version: 1,
            owner: OWNER.to_owned(),
            causal_parent: "cause:schema".to_owned(),
        },
        required_tiers,
        covered_tiers,
        requested_outcome: outcome,
        failure_basis: None,
        coverage_gap: None,
    }
}

fn provenance() -> EvidenceProvenance {
    EvidenceProvenance {
        identity: identity(
            "provenance-1",
            "validation.provenance.1",
            1,
            None,
            RecordStatus::Active,
        ),
        source_hash: "sha256:source".to_owned(),
        build_identity: "build:1".to_owned(),
        run_identity: "run:1".to_owned(),
        test_log_ref: "log:1".to_owned(),
        adjudication_ref: "judgment:1".to_owned(),
        source_event_ref: "event:1".to_owned(),
        actor_ref: "actor:validation-runner".to_owned(),
        artifact_ref: "artifact:evidence".to_owned(),
        transform_steps: vec![
            "collect".to_owned(),
            "compare-registry".to_owned(),
            "record-outcome".to_owned(),
        ],
    }
}

#[test]
fn admission_requires_wp001_pass_contract() {
    assert_eq!(admit(&root()), Ok(()));
    let mut invalid = root();
    invalid.contract_version = 2;
    assert_eq!(admit(&invalid), Err(ValidationError::InvalidPredecessor));
}

#[test]
fn s3_06_01_validation_evidence_schema_has_versioned_crud_and_replay() {
    let mut registry = ValidationRegistry::default();
    let first_ref = create_schema(&mut registry);
    assert_eq!(registry.schema("schema-1").unwrap().identity.version, 1);

    let duplicate = schema_record(
        "schema-2",
        "validation.schema.1",
        1,
        None,
        RecordStatus::Active,
    );
    let before = registry.digest64();
    assert!(matches!(
        registry.create_schema(duplicate, WriteOrigin::OwningResolver),
        Err(ValidationError::DuplicateNamespace(_))
    ));
    assert_eq!(registry.digest64(), before);

    let second = schema_record(
        "schema-1",
        "validation.schema.1",
        2,
        Some(first_ref),
        RecordStatus::Active,
    );
    let second_ref = registry
        .update_schema(second, WriteOrigin::OwningResolver)
        .unwrap();
    assert_eq!(second_ref.version, 2);

    let encoded = registry.encode_stable();
    let restored = ValidationRegistry::decode_stable(&encoded).unwrap();
    assert_eq!(restored.encode_stable(), encoded);
    assert_eq!(restored.digest64(), registry.digest64());

    registry
        .retire_schema(
            "schema-1",
            3,
            "cause:retire-schema",
            WriteOrigin::OwningResolver,
        )
        .unwrap();
    assert!(matches!(
        registry.schema("schema-1"),
        Err(ValidationError::RetiredRecord(_))
    ));
}

#[test]
fn s3_06_02_vt0_semantic_integrity_registry() {
    exercise_tier(ValidationTier::VT0Semantic);
    assert_eq!(
        validate_tolerance_policy(ValidationTier::VT0Semantic, &TolerancePolicy::Exact),
        Ok(())
    );
}

#[test]
fn s3_06_03_vt1_deterministic_integrity_registry() {
    exercise_tier(ValidationTier::VT1Deterministic);
}

#[test]
fn s3_06_04_vt2_conservation_integrity_registry() {
    exercise_tier(ValidationTier::VT2Conservation);
}

#[test]
fn s3_06_05_vt3_numerical_integrity_registry() {
    exercise_tier(ValidationTier::VT3Numerical);
}

#[test]
fn s3_06_06_vt4_cross_lod_integrity_registry() {
    exercise_tier(ValidationTier::VT4CrossLod);
}

#[test]
fn s3_06_07_vt5_empirical_statistical_integrity_registry() {
    exercise_tier(ValidationTier::VT5EmpiricalStatistical);
}

#[test]
fn s3_06_08_vt6_observation_integrity_registry_is_not_observer_write_authority() {
    exercise_tier(ValidationTier::VT6Observation);
    let mut registry = ValidationRegistry::default();
    let mut schema = schema_record(
        "observer-schema",
        "validation.schema.observer",
        1,
        None,
        RecordStatus::Active,
    );
    let before = registry.digest64();
    assert_eq!(
        registry.create_schema(schema.clone(), WriteOrigin::Observer),
        Err(ValidationError::UnauthorizedWrite)
    );
    assert_eq!(registry.digest64(), before);
    schema.identity.owner = "domain28.observer".to_owned();
    assert_eq!(
        registry.create_schema(schema, WriteOrigin::OwningResolver),
        Err(ValidationError::WrongOwner)
    );
}

#[test]
fn s3_06_09_validation_outcome_pass_requires_complete_declared_coverage() {
    let required = tiers(&[
        ValidationTier::VT0Semantic,
        ValidationTier::VT1Deterministic,
        ValidationTier::VT2Conservation,
    ]);
    let decision = decide(decision_request(
        ValidationOutcome::Pass,
        required.clone(),
        required.clone(),
    ))
    .unwrap();
    assert_eq!(decision.outcome, ValidationOutcome::Pass);

    let incomplete = tiers(&[
        ValidationTier::VT0Semantic,
        ValidationTier::VT1Deterministic,
    ]);
    assert_eq!(
        decide(decision_request(
            ValidationOutcome::Pass,
            required,
            incomplete,
        )),
        Err(ValidationError::PassWithCoverageGap)
    );
}

#[test]
fn s3_06_10_validation_outcome_fail_requires_explicit_failure_evidence() {
    let required = tiers(&[ValidationTier::VT0Semantic]);
    let request = decision_request(
        ValidationOutcome::Fail,
        required.clone(),
        required.clone(),
    );
    assert_eq!(decide(request), Err(ValidationError::FailWithoutBasis));

    let mut request = decision_request(ValidationOutcome::Fail, required.clone(), required);
    request.failure_basis = Some("known invariant violation at event:17".to_owned());
    assert_eq!(decide(request).unwrap().outcome, ValidationOutcome::Fail);
}

#[test]
fn s3_06_11_coverage_insufficient_is_distinct_and_cannot_be_silent_pass() {
    let required = tiers(&[
        ValidationTier::VT0Semantic,
        ValidationTier::VT4CrossLod,
    ]);
    let covered = tiers(&[ValidationTier::VT0Semantic]);
    let mut request = decision_request(
        ValidationOutcome::CoverageInsufficient,
        required.clone(),
        covered,
    );
    request.coverage_gap = Some("paired cross-LOD evidence absent".to_owned());
    let decision = decide(request).unwrap();
    assert_eq!(decision.outcome, ValidationOutcome::CoverageInsufficient);

    assert_eq!(
        decide(decision_request(
            ValidationOutcome::Pass,
            required,
            tiers(&[ValidationTier::VT0Semantic]),
        )),
        Err(ValidationError::PassWithCoverageGap)
    );
}

#[test]
fn s3_06_12_evidence_provenance_preserves_source_build_run_and_transform_lineage() {
    let provenance = provenance();
    validate_provenance(&provenance, WriteOrigin::OwningResolver).unwrap();
    let first_digest = provenance_digest64(&provenance);
    let second_digest = provenance_digest64(&provenance.clone());
    assert_eq!(first_digest, second_digest);

    let mut missing = provenance.clone();
    missing.test_log_ref.clear();
    assert_eq!(
        validate_provenance(&missing, WriteOrigin::OwningResolver),
        Err(ValidationError::EmptyField("test_log_ref"))
    );
    assert_eq!(
        validate_provenance(&provenance, WriteOrigin::Renderer),
        Err(ValidationError::UnauthorizedWrite)
    );
}

#[test]
fn s3_06_13_tolerance_acceptance_is_context_specific_and_vt0_is_zero_tolerance() {
    let contextual = TolerancePolicy::Contextual {
        quantity_key: "temperature".to_owned(),
        model_profile: "atmosphere-profile-v1".to_owned(),
        fidelity_profile: "fidelity:high".to_owned(),
        unit: "mK".to_owned(),
        lower_bound: -25,
        upper_bound: 25,
        uncertainty_ref: "uncertainty:measurement-v1".to_owned(),
    };
    assert_eq!(
        validate_tolerance_policy(ValidationTier::VT0Semantic, &contextual),
        Err(ValidationError::SemanticToleranceMustBeExact)
    );
    assert_eq!(
        validate_tolerance_policy(ValidationTier::VT3Numerical, &contextual),
        Ok(())
    );

    let required = tiers(&[ValidationTier::VT3Numerical]);
    let decision = decide(decision_request(
        ValidationOutcome::Pass,
        required.clone(),
        required,
    ))
    .unwrap();
    let provenance = provenance();
    let acceptance = make_acceptance_record(
        identity(
            "acceptance-1",
            "validation.acceptance.1",
            1,
            None,
            RecordStatus::Active,
        ),
        "source-domain:state:42".to_owned(),
        ValidationTier::VT3Numerical,
        contextual,
        &decision,
        &provenance,
        WriteOrigin::OwningResolver,
    )
    .unwrap();
    assert_eq!(acceptance.outcome, ValidationOutcome::Pass);
    assert_eq!(acceptance.decision_ref.stable_id, "decision-1");
    assert_eq!(acceptance.provenance_ref.stable_id, "provenance-1");
}

#[test]
fn authority_dangling_and_stale_reference_fail_without_partial_registry_mutation() {
    let mut registry = ValidationRegistry::default();
    let schema_ref = create_schema(&mut registry);
    let before = registry.digest64();

    let mut dangling = tier_record(
        ValidationTier::VT2Conservation,
        schema_ref,
        1,
        None,
        RecordStatus::Active,
    );
    dangling.evidence_schema_ref.stable_id = "missing-schema".to_owned();
    assert!(matches!(
        registry.create_tier(dangling, WriteOrigin::OwningResolver),
        Err(ValidationError::DanglingReference(_))
    ));
    assert_eq!(registry.digest64(), before);

    let first = tier_record(
        ValidationTier::VT2Conservation,
        registry.schema("schema-1").unwrap().identity.reference(),
        1,
        None,
        RecordStatus::Active,
    );
    let first_ref = registry
        .create_tier(first, WriteOrigin::OwningResolver)
        .unwrap();
    let before_stale = registry.digest64();
    let stale = tier_record(
        ValidationTier::VT2Conservation,
        registry.schema("schema-1").unwrap().identity.reference(),
        3,
        Some(first_ref),
        RecordStatus::Active,
    );
    assert_eq!(
        registry.update_tier(stale, WriteOrigin::OwningResolver),
        Err(ValidationError::StaleVersion {
            expected: 2,
            found: 3
        })
    );
    assert_eq!(registry.digest64(), before_stale);
}

#[test]
fn wp005_integration_requires_all_13_members_and_keeps_wp017_outside_closure() {
    let mut registry = ValidationRegistry::default();
    let schema_ref = create_schema(&mut registry);
    for tier in ValidationTier::ALL {
        registry
            .create_tier(
                tier_record(tier, schema_ref.clone(), 1, None, RecordStatus::Active),
                WriteOrigin::OwningResolver,
            )
            .unwrap();
    }

    let passes = [true; 13];
    let evidence = [1_u64; 13];
    let acceptance = accept_wp(&root(), &passes, &evidence, registry.digest64()).unwrap();
    assert!(acceptance.closed);
    assert_eq!(acceptance.work_package, "WP-005");
    assert_eq!(acceptance.member_ids, MEMBER_IDS);

    let mut missing_pass = passes;
    missing_pass[10] = false;
    assert_eq!(
        accept_wp(&root(), &missing_pass, &evidence, registry.digest64()),
        Err(ValidationError::MissingEvidence("S3.06.11"))
    );
    let mut missing_evidence = evidence;
    missing_evidence[12] = 0;
    assert_eq!(
        accept_wp(&root(), &passes, &missing_evidence, registry.digest64()),
        Err(ValidationError::MissingEvidence("S3.06.13"))
    );
    assert!(!MEMBER_IDS.contains(&"S3.06.16"));
}

#[test]
fn decision_replay_digest_is_deterministic_and_source_domain_truth_is_only_referenced() {
    let required = ValidationTier::ALL.into_iter().collect::<BTreeSet<_>>();
    let a = decide(decision_request(
        ValidationOutcome::Pass,
        required.clone(),
        required.clone(),
    ))
    .unwrap();
    let b = decide(decision_request(
        ValidationOutcome::Pass,
        required.clone(),
        required,
    ))
    .unwrap();
    assert_eq!(a, b);
    assert_eq!(decision_digest64(&a), decision_digest64(&b));
    assert_eq!(a.target_state_ref, "source-domain:state:42");
}
