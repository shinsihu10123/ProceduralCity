use gaonn_creation_boundary_core::{
    CommittedEntityCreationBoundary, CommittedEntityCreationRequest,
    CommittedEntityCreationValidation,
};
use gaonn_cross_reference_core::{
    CrossReferenceIntegrityContract, CrossReferenceIntegrityRejection,
    CrossReferenceIntegrityRequest, CrossReferenceState, CrossReferenceSubject,
    CrossReferenceTransition, ReferenceTargetSnapshot, S1_02_07_OWNER, S1_02_07_SCHEMA_VERSION,
};
use gaonn_identity_core::namespace_versioning::{
    NamespaceVersioningOutcome, NamespaceVersioningProcessor, NamespaceVersioningRequest,
};
use gaonn_identity_core::{
    IdentityDisposition, IdentityOperationPhase, IdentityOrigin, StableIdentityOutcome,
    StableIdentityProcessor, StableIdentityRequest,
};
use gaonn_lifecycle_core::{
    PersistentLifecycleOutcome, PersistentLifecycleProcessor, PersistentLifecycleRequest,
};
use gaonn_retention_core::{
    TombstoneRetentionArtifact, TombstoneRetentionProcessor, TombstoneRetentionRequest,
};
use gaonn_retirement_state_core::{
    TerminalStateProcessor, TerminalStateRepresentation, TerminalStateRequest,
};
use gaonn_world_core::acceptance::{
    AcceptanceRecord, AcceptanceVerdict, MemberReviewResult, S1_01_08_ACCEPTANCE_SCHEMA_VERSION,
};
use gaonn_world_core::{CanonicalCandidate, CanonicalStateContract, ValidationReceipt};

fn root_fixture() -> ValidationReceipt {
    CanonicalStateContract
        .validate(&CanonicalCandidate::valid_fixture())
        .expect("frozen root fixture must pass")
}

fn wp001_fixture(root: &ValidationReceipt) -> AcceptanceRecord {
    let member_results = [
        "S1.01.01",
        "S1.01.02",
        "S1.01.03",
        "S1.01.04",
        "S1.01.05",
        "S1.01.06",
        "S1.01.07",
    ]
    .into_iter()
    .map(|work_id| MemberReviewResult {
        work_id: work_id.to_owned(),
        verdict: AcceptanceVerdict::Pass,
        evidence_hash: Some(format!("evidence-{work_id}")),
    })
    .collect();

    AcceptanceRecord {
        work_id: "S1.01.08",
        work_package: "WP-001",
        schema_version: S1_01_08_ACCEPTANCE_SCHEMA_VERSION,
        verdict: AcceptanceVerdict::Pass,
        downstream_blocked: false,
        run_identity: "wp001-closed-run".to_owned(),
        source_version: 1,
        source_hash: "wp001-frozen-source".to_owned(),
        root_fact_key: root.fact_key.clone(),
        root_contract_version: root.contract_version,
        root_owner: root.owner.clone(),
        root_causal_parent: root.causal_parent.clone(),
        audit_evidence_digest: Some(0x1010_0107),
        pre_state_digest: 0x1010_0108,
        post_state_digest: 0x1010_0108,
        causal_parent: "S1.01.07:validated".to_owned(),
        operands: ["Canonical", "Authority", "Registry"],
        member_results,
        issues: Vec::new(),
        required_output: "Implemented + validated L3 set S1.01.01…S1.01.08; evidence and acceptance record.",
    }
}

fn stable_fixture(root: &ValidationReceipt) -> StableIdentityOutcome {
    let wp001 = wp001_fixture(root);
    StableIdentityProcessor
        .evaluate(&StableIdentityRequest::valid_fixture(), root, &wp001)
        .expect("S1.02.01 fixture must pass")
}

fn namespace_fixture(root: &ValidationReceipt) -> NamespaceVersioningOutcome {
    let stable = stable_fixture(root);
    NamespaceVersioningProcessor
        .evaluate(
            &NamespaceVersioningRequest::valid_fixture(&stable),
            root,
            &stable,
        )
        .expect("S1.02.02 fixture must pass")
}

fn lifecycle_fixture(root: &ValidationReceipt) -> PersistentLifecycleOutcome {
    let namespace = namespace_fixture(root);
    PersistentLifecycleProcessor
        .evaluate(
            &PersistentLifecycleRequest::valid_fixture(&namespace),
            root,
            &namespace,
        )
        .expect("S1.02.03 fixture must pass")
}

fn creation_fixture(root: &ValidationReceipt) -> CommittedEntityCreationValidation {
    let lifecycle = lifecycle_fixture(root);
    CommittedEntityCreationBoundary
        .validate(
            &CommittedEntityCreationRequest::valid_fixture(&lifecycle),
            root,
            &lifecycle,
        )
        .expect("S1.02.04 fixture must pass")
}

fn terminal_fixture(root: &ValidationReceipt) -> TerminalStateRepresentation {
    let creation = creation_fixture(root);
    TerminalStateProcessor
        .evaluate(
            &TerminalStateRequest::valid_fixture(&creation),
            root,
            &creation,
        )
        .expect("S1.02.05 fixture must pass")
}

fn retention_fixture(root: &ValidationReceipt) -> TombstoneRetentionArtifact {
    let namespace = namespace_fixture(root);
    let terminal = terminal_fixture(root);
    TombstoneRetentionProcessor
        .evaluate(
            &TombstoneRetentionRequest::valid_fixture(&namespace, &terminal),
            root,
            &namespace,
            &terminal,
        )
        .expect("S1.02.06 fixture must pass")
}

#[test]
fn behavior_normal_valid_cross_reference_returns_versioned_candidate_only_validation() {
    let root = root_fixture();
    let predecessor = retention_fixture(&root);
    let target = ReferenceTargetSnapshot::fixture();
    let request = CrossReferenceIntegrityRequest::valid_fixture(&predecessor, &target);

    let result = CrossReferenceIntegrityContract
        .validate(&request, &root, &predecessor, &target)
        .expect("valid S1.02.07 input must pass");

    assert_eq!(result.work_id, "S1.02.07");
    assert_eq!(result.work_package, "WP-002");
    assert_eq!(result.schema_version, S1_02_07_SCHEMA_VERSION);
    assert_eq!(result.owner, S1_02_07_OWNER);
    assert_eq!(result.source_stable_id, predecessor.stable_id);
    assert_eq!(result.target_stable_id, target.stable_id);
    assert_eq!(result.disposition, IdentityDisposition::CandidateOnly);
    assert_eq!(
        result.operands,
        ["Cross-Reference", "Integrity", "Stable", "Entity", "ID"]
    );
}

#[test]
fn function_specific_normal_requires_exact_target_and_source_authorized_transition() {
    let root = root_fixture();
    let predecessor = retention_fixture(&root);
    let target = ReferenceTargetSnapshot::fixture();
    let mut request = CrossReferenceIntegrityRequest::valid_fixture(&predecessor, &target);
    let transition = CrossReferenceTransition {
        from: CrossReferenceState::Active,
        to: CrossReferenceState::Ended,
    };
    request.current_state = Some(transition.from);
    request.target_state = Some(transition.to);
    request.allowed_transitions = vec![transition];

    let result = CrossReferenceIntegrityContract
        .validate(&request, &root, &predecessor, &target)
        .expect("source-authorized transition must pass");

    assert_eq!(result.validated_transition, transition);
    assert_eq!(result.target_entity_version, target.entity_version);
    assert_eq!(result.target_lifecycle_lineage, target.lifecycle_lineage);
    assert_eq!(result.target_evidence_digest, target.evidence_digest64());
}

#[test]
fn behavior_failure_missing_stale_and_wrong_owner_inputs_reject_without_success_result() {
    let root = root_fixture();
    let predecessor = retention_fixture(&root);
    let target = ReferenceTargetSnapshot::fixture();

    let mut missing = CrossReferenceIntegrityRequest::valid_fixture(&predecessor, &target);
    missing.reference_id = None;
    assert!(matches!(
        CrossReferenceIntegrityContract.validate(&missing, &root, &predecessor, &target),
        Err(CrossReferenceIntegrityRejection::MissingField("reference_id"))
    ));

    let mut stale = CrossReferenceIntegrityRequest::valid_fixture(&predecessor, &target);
    stale.schema_version = Some(S1_02_07_SCHEMA_VERSION + 1);
    assert!(matches!(
        CrossReferenceIntegrityContract.validate(&stale, &root, &predecessor, &target),
        Err(CrossReferenceIntegrityRejection::StaleSchemaVersion { .. })
    ));

    let mut wrong_owner = CrossReferenceIntegrityRequest::valid_fixture(&predecessor, &target);
    wrong_owner.owner = Some("wrong.owner".to_owned());
    wrong_owner.writer = Some("wrong.owner".to_owned());
    assert!(matches!(
        CrossReferenceIntegrityContract.validate(&wrong_owner, &root, &predecessor, &target),
        Err(CrossReferenceIntegrityRejection::WrongOwner { .. })
    ));
}

#[test]
fn function_specific_failure_dangling_digest_mismatch_and_prohibited_transition_are_rejected() {
    let root = root_fixture();
    let predecessor = retention_fixture(&root);
    let target = ReferenceTargetSnapshot::fixture();

    let mut dangling_target = target.clone();
    dangling_target.retained = false;
    let dangling_request =
        CrossReferenceIntegrityRequest::valid_fixture(&predecessor, &dangling_target);
    assert!(matches!(
        CrossReferenceIntegrityContract.validate(
            &dangling_request,
            &root,
            &predecessor,
            &dangling_target,
        ),
        Err(CrossReferenceIntegrityRejection::TargetNotRetained)
    ));

    let mut digest_mismatch = CrossReferenceIntegrityRequest::valid_fixture(&predecessor, &target);
    digest_mismatch.target_evidence_digest = Some(target.evidence_digest64() ^ 1);
    assert!(matches!(
        CrossReferenceIntegrityContract.validate(
            &digest_mismatch,
            &root,
            &predecessor,
            &target,
        ),
        Err(CrossReferenceIntegrityRejection::TargetDigestMismatch { .. })
    ));

    let mut prohibited = CrossReferenceIntegrityRequest::valid_fixture(&predecessor, &target);
    prohibited.allowed_transitions.clear();
    assert!(matches!(
        CrossReferenceIntegrityContract.validate(&prohibited, &root, &predecessor, &target),
        Err(CrossReferenceIntegrityRejection::ProhibitedTransition(_))
    ));
}

#[test]
fn boundary_projection_and_similar_named_state_are_excluded_and_observation_hint_is_read_only() {
    let root = root_fixture();
    let predecessor = retention_fixture(&root);
    let target = ReferenceTargetSnapshot::fixture();

    for subject in [
        CrossReferenceSubject::ProjectionOnly,
        CrossReferenceSubject::SimilarNamedOutOfScopeState,
    ] {
        let mut request = CrossReferenceIntegrityRequest::valid_fixture(&predecessor, &target);
        request.subject = Some(subject);
        assert!(matches!(
            CrossReferenceIntegrityContract.validate(&request, &root, &predecessor, &target),
            Err(CrossReferenceIntegrityRejection::OutOfScopeSubject(found)) if found == subject
        ));
    }

    let request_a = CrossReferenceIntegrityRequest::valid_fixture(&predecessor, &target);
    let mut request_b = request_a.clone();
    request_b.observation_hint = Some("renderer-completely-different-value".to_owned());
    let result_a = CrossReferenceIntegrityContract
        .validate(&request_a, &root, &predecessor, &target)
        .expect("authoritative input must pass");
    let result_b = CrossReferenceIntegrityContract
        .validate(&request_b, &root, &predecessor, &target)
        .expect("observation hint must remain read-only");
    assert_eq!(result_a, result_b);
    assert_eq!(result_a.evidence_digest64(), result_b.evidence_digest64());
}

#[test]
fn authority_only_pa003_owner_and_owning_resolver_path_is_accepted() {
    let root = root_fixture();
    let predecessor = retention_fixture(&root);
    let target = ReferenceTargetSnapshot::fixture();

    let mut wrong_writer = CrossReferenceIntegrityRequest::valid_fixture(&predecessor, &target);
    wrong_writer.writer = Some("other.writer".to_owned());
    assert!(matches!(
        CrossReferenceIntegrityContract.validate(&wrong_writer, &root, &predecessor, &target),
        Err(CrossReferenceIntegrityRejection::WrongWriter { .. })
    ));

    for origin in [
        IdentityOrigin::Derived,
        IdentityOrigin::Observer,
        IdentityOrigin::Renderer,
        IdentityOrigin::Analytics,
    ] {
        let mut request = CrossReferenceIntegrityRequest::valid_fixture(&predecessor, &target);
        request.origin = Some(origin);
        assert!(matches!(
            CrossReferenceIntegrityContract.validate(&request, &root, &predecessor, &target),
            Err(CrossReferenceIntegrityRejection::UnauthorizedOrigin(found)) if found == origin
        ));
    }
}

#[test]
fn contract_preserves_frozen_root_predecessor_target_and_causal_references() {
    let root = root_fixture();
    let predecessor = retention_fixture(&root);
    let target = ReferenceTargetSnapshot::fixture();
    let request = CrossReferenceIntegrityRequest::valid_fixture(&predecessor, &target);

    let result = CrossReferenceIntegrityContract
        .validate(&request, &root, &predecessor, &target)
        .expect("contract fixture must pass");
    assert_eq!(result.root_fact_key, root.fact_key);
    assert_eq!(result.root_contract_version, root.contract_version);
    assert_eq!(result.root_owner, root.owner);
    assert_eq!(result.root_causal_parent, root.causal_parent);
    assert_eq!(result.predecessor_work_id, "S1.02.06");
    assert_eq!(
        result.predecessor_evidence_digest,
        predecessor.evidence_digest64()
    );
    assert_eq!(result.target_evidence_digest, target.evidence_digest64());

    let mut missing_required = request.clone();
    missing_required.target_lifecycle_lineage = None;
    assert!(matches!(
        CrossReferenceIntegrityContract.validate(
            &missing_required,
            &root,
            &predecessor,
            &target,
        ),
        Err(CrossReferenceIntegrityRejection::MissingField(
            "target_lifecycle_lineage"
        ))
    ));
}

#[test]
fn integration_root_through_s1_02_06_to_cross_reference_has_no_shortcut_and_propagates_failure() {
    let root = root_fixture();
    let predecessor = retention_fixture(&root);
    let target = ReferenceTargetSnapshot::fixture();
    let request = CrossReferenceIntegrityRequest::valid_fixture(&predecessor, &target);

    assert!(
        CrossReferenceIntegrityContract
            .validate(&request, &root, &predecessor, &target)
            .is_ok()
    );

    let mut incomplete_predecessor = predecessor.clone();
    incomplete_predecessor.phase = IdentityOperationPhase::Partial;
    let bad_request =
        CrossReferenceIntegrityRequest::valid_fixture(&incomplete_predecessor, &target);
    assert!(matches!(
        CrossReferenceIntegrityContract.validate(
            &bad_request,
            &root,
            &incomplete_predecessor,
            &target,
        ),
        Err(CrossReferenceIntegrityRejection::InvalidPredecessor(
            "predecessor incomplete"
        ))
    ));
}

#[test]
fn persistence_and_replay_preserve_id_version_pending_causal_target_and_digest() {
    let root = root_fixture();
    let predecessor = retention_fixture(&root);
    let target = ReferenceTargetSnapshot::fixture();
    let request = CrossReferenceIntegrityRequest::valid_fixture(&predecessor, &target);

    let first = CrossReferenceIntegrityContract
        .validate(&request, &root, &predecessor, &target)
        .expect("first replay input must pass");
    let restored = gaonn_cross_reference_core::CrossReferenceIntegrityValidation::restore(
        first.snapshot(),
    )
    .expect("valid snapshot must restore");
    let replayed = CrossReferenceIntegrityContract
        .validate(&request, &root, &predecessor, &target)
        .expect("identical replay must pass");

    assert_eq!(first, restored);
    assert_eq!(first, replayed);
    assert_eq!(first.evidence_digest64(), restored.evidence_digest64());
    assert_eq!(first.evidence_digest64(), replayed.evidence_digest64());

    let mut corrupt = first.snapshot();
    corrupt.validation.operands = ["Cross-Reference", "Integrity", "Stable", "Entity", "BROKEN"];
    assert!(matches!(
        gaonn_cross_reference_core::CrossReferenceIntegrityValidation::restore(corrupt),
        Err(CrossReferenceIntegrityRejection::CorruptSnapshot(
            "frozen operands changed"
        ))
    ));
}
