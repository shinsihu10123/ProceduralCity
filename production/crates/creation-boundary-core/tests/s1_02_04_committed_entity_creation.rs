use gaonn_creation_boundary_core::{
    CommittedEntityCreationBoundary, CommittedEntityCreationRejection,
    CommittedEntityCreationRequest, CommittedEntityCreationValidation, CreationBoundarySubject,
    ReferenceIntegrityStatus, S1_02_04_OWNER, S1_02_04_SCHEMA_VERSION,
};
use gaonn_identity_core::namespace_versioning::{
    NamespaceVersioningOutcome, NamespaceVersioningProcessor, NamespaceVersioningRequest,
};
use gaonn_identity_core::{
    IdentityDisposition, IdentityOperationPhase, IdentityOrigin, StableIdentityOutcome,
    StableIdentityProcessor, StableIdentityRequest,
};
use gaonn_lifecycle_core::{
    LifecycleState, LifecycleTransition, PersistentLifecycleOutcome, PersistentLifecycleProcessor,
    PersistentLifecycleRequest,
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
        required_output:
            "Implemented + validated L3 set S1.01.01…S1.01.08; evidence and acceptance record.",
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

#[test]
fn behavior_normal_valid_creation_boundary_returns_versioned_candidate_only_validation() {
    let root = root_fixture();
    let lifecycle = lifecycle_fixture(&root);
    let request = CommittedEntityCreationRequest::valid_fixture(&lifecycle);
    let result = CommittedEntityCreationBoundary
        .validate(&request, &root, &lifecycle)
        .expect("valid S1.02.04 input must pass");

    assert_eq!(result.work_id, "S1.02.04");
    assert_eq!(result.work_package, "WP-002");
    assert_eq!(result.schema_version, S1_02_04_SCHEMA_VERSION);
    assert_eq!(result.stable_id, lifecycle.stable_id);
    assert_eq!(result.lifecycle_state, lifecycle.candidate_state);
    assert_eq!(result.validated_transition, lifecycle.pending_transition);
    assert_eq!(result.reference_integrity, ReferenceIntegrityStatus::Verified);
    assert_eq!(result.owner, S1_02_04_OWNER);
    assert_eq!(result.disposition, IdentityDisposition::CandidateOnly);
    assert_eq!(
        result.operands,
        ["Committed", "Entity", "Creation", "Stable", "ID"]
    );
}

#[test]
fn behavior_failure_missing_stale_and_wrong_owner_inputs_reject_without_success_result() {
    let root = root_fixture();
    let lifecycle = lifecycle_fixture(&root);

    let mut missing = CommittedEntityCreationRequest::valid_fixture(&lifecycle);
    missing.creation_provenance = None;
    assert_eq!(
        CommittedEntityCreationBoundary.validate(&missing, &root, &lifecycle),
        Err(CommittedEntityCreationRejection::MissingField(
            "creation_provenance"
        ))
    );

    let mut stale = CommittedEntityCreationRequest::valid_fixture(&lifecycle);
    stale.source_lifecycle_schema_version = Some(lifecycle.schema_version + 1);
    assert!(matches!(
        CommittedEntityCreationBoundary.validate(&stale, &root, &lifecycle),
        Err(CommittedEntityCreationRejection::StaleLifecycleSchemaVersion { .. })
    ));

    let mut wrong_owner = CommittedEntityCreationRequest::valid_fixture(&lifecycle);
    wrong_owner.owner = Some("renderer".to_owned());
    assert!(matches!(
        CommittedEntityCreationBoundary.validate(&wrong_owner, &root, &lifecycle),
        Err(CommittedEntityCreationRejection::WrongOwner { .. })
    ));
}

#[test]
fn boundary_scope_excludes_projection_and_similar_named_out_of_scope_state() {
    let root = root_fixture();
    let lifecycle = lifecycle_fixture(&root);

    for subject in [
        CreationBoundarySubject::ProjectionOnly,
        CreationBoundarySubject::SimilarNamedOutOfScopeState,
    ] {
        let mut request = CommittedEntityCreationRequest::valid_fixture(&lifecycle);
        request.boundary_subject = Some(subject);
        assert_eq!(
            CommittedEntityCreationBoundary.validate(&request, &root, &lifecycle),
            Err(CommittedEntityCreationRejection::OutOfScopeBoundary(subject))
        );
    }

    let baseline = CommittedEntityCreationBoundary
        .validate(
            &CommittedEntityCreationRequest::valid_fixture(&lifecycle),
            &root,
            &lifecycle,
        )
        .unwrap();
    let mut projection_hints = CommittedEntityCreationRequest::valid_fixture(&lifecycle);
    projection_hints.display_name_hint = Some("different-name".to_owned());
    projection_hints.renderer_hint = Some("different-camera".to_owned());
    let projected = CommittedEntityCreationBoundary
        .validate(&projection_hints, &root, &lifecycle)
        .unwrap();
    assert_eq!(baseline, projected);
}

#[test]
fn boundary_requested_progress_partial_and_failed_are_not_completion() {
    let root = root_fixture();
    let lifecycle = lifecycle_fixture(&root);

    for phase in [
        IdentityOperationPhase::Requested,
        IdentityOperationPhase::InProgress,
        IdentityOperationPhase::Partial,
        IdentityOperationPhase::Failed,
    ] {
        let mut request = CommittedEntityCreationRequest::valid_fixture(&lifecycle);
        request.phase = Some(phase);
        assert_eq!(
            CommittedEntityCreationBoundary.validate(&request, &root, &lifecycle),
            Err(CommittedEntityCreationRejection::IncompletePhase(phase))
        );
    }
}

#[test]
fn authority_only_registered_owner_and_owning_resolver_are_accepted() {
    let root = root_fixture();
    let lifecycle = lifecycle_fixture(&root);

    let mut wrong_writer = CommittedEntityCreationRequest::valid_fixture(&lifecycle);
    wrong_writer.writer = Some("observer".to_owned());
    assert!(matches!(
        CommittedEntityCreationBoundary.validate(&wrong_writer, &root, &lifecycle),
        Err(CommittedEntityCreationRejection::WrongWriter { .. })
    ));

    for origin in [
        IdentityOrigin::Derived,
        IdentityOrigin::Observer,
        IdentityOrigin::Renderer,
        IdentityOrigin::Analytics,
    ] {
        let mut request = CommittedEntityCreationRequest::valid_fixture(&lifecycle);
        request.origin = Some(origin);
        assert_eq!(
            CommittedEntityCreationBoundary.validate(&request, &root, &lifecycle),
            Err(CommittedEntityCreationRejection::UnauthorizedOrigin(origin))
        );
    }
}

#[test]
fn contract_preserves_root_and_s1_02_03_causal_references() {
    let root = root_fixture();
    let lifecycle = lifecycle_fixture(&root);
    let result = CommittedEntityCreationBoundary
        .validate(
            &CommittedEntityCreationRequest::valid_fixture(&lifecycle),
            &root,
            &lifecycle,
        )
        .unwrap();

    assert_eq!(result.predecessor_work_id, "S1.02.03");
    assert_eq!(result.predecessor_work_package, "WP-002");
    assert_eq!(result.predecessor_evidence_digest, lifecycle.evidence_digest64());
    assert_eq!(result.root_fact_key, root.fact_key);
    assert_eq!(result.root_contract_version, root.contract_version);
    assert_eq!(result.root_owner, root.owner);
    assert_eq!(result.root_causal_parent, root.causal_parent);
}

#[test]
fn integration_root_to_lifecycle_to_creation_boundary_has_no_shortcut_and_propagates_failure() {
    let root = root_fixture();
    let lifecycle = lifecycle_fixture(&root);
    let request = CommittedEntityCreationRequest::valid_fixture(&lifecycle);
    assert!(CommittedEntityCreationBoundary
        .validate(&request, &root, &lifecycle)
        .is_ok());

    let mut mismatched_root = root.clone();
    mismatched_root.causal_parent = "other-root".to_owned();
    assert_eq!(
        CommittedEntityCreationBoundary.validate(&request, &mismatched_root, &lifecycle),
        Err(CommittedEntityCreationRejection::InvalidRoot(
            "causal_parent"
        ))
    );

    let mut incomplete = lifecycle.clone();
    incomplete.phase = IdentityOperationPhase::Partial;
    assert_eq!(
        CommittedEntityCreationBoundary.validate(&request, &root, &incomplete),
        Err(CommittedEntityCreationRejection::InvalidPredecessor(
            "S1.02.03 is not complete"
        ))
    );
}

#[test]
fn reference_integrity_and_transition_must_be_explicitly_valid() {
    let root = root_fixture();
    let lifecycle = lifecycle_fixture(&root);

    for status in [
        ReferenceIntegrityStatus::Unverified,
        ReferenceIntegrityStatus::Dangling,
    ] {
        let mut request = CommittedEntityCreationRequest::valid_fixture(&lifecycle);
        request.reference_integrity = Some(status);
        assert_eq!(
            CommittedEntityCreationBoundary.validate(&request, &root, &lifecycle),
            Err(CommittedEntityCreationRejection::ReferenceIntegrityNotVerified(
                status
            ))
        );
    }

    let mut wrong_transition = CommittedEntityCreationRequest::valid_fixture(&lifecycle);
    wrong_transition.allowed_creation_transition = Some(LifecycleTransition {
        from: LifecycleState::Active,
        to: LifecycleState::Inactive,
    });
    assert!(matches!(
        CommittedEntityCreationBoundary.validate(&wrong_transition, &root, &lifecycle),
        Err(CommittedEntityCreationRejection::TransitionMismatch { .. })
    ));
}

#[test]
fn persistence_and_replay_preserve_id_version_pending_causal_and_digest() {
    let root = root_fixture();
    let lifecycle = lifecycle_fixture(&root);
    let request = CommittedEntityCreationRequest::valid_fixture(&lifecycle);

    let first = CommittedEntityCreationBoundary
        .validate(&request, &root, &lifecycle)
        .unwrap();
    let digest = first.evidence_digest64();
    let restored = CommittedEntityCreationValidation::restore(first.snapshot())
        .expect("S1.02.04 snapshot must restore");
    let replayed = CommittedEntityCreationBoundary
        .validate(&request, &root, &lifecycle)
        .unwrap();

    assert_eq!(restored, first);
    assert_eq!(restored.evidence_digest64(), digest);
    assert_eq!(replayed, first);
    assert_eq!(replayed.evidence_digest64(), digest);
    assert_eq!(replayed.validated_transition, first.validated_transition);
    assert_eq!(replayed.causal_parent, first.causal_parent);
}
