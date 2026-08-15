use gaonn_identity_core::namespace_versioning::{
    NamespaceVersioningOutcome, NamespaceVersioningProcessor, NamespaceVersioningRequest,
};
use gaonn_identity_core::{
    IdentityDisposition, IdentityOperationPhase, IdentityOrigin, StableIdentityOutcome,
    StableIdentityProcessor, StableIdentityRequest,
};
use gaonn_lifecycle_core::{
    LifecycleState, LifecycleTransition, PersistentLifecycleOutcome, PersistentLifecycleProcessor,
    PersistentLifecycleRejection, PersistentLifecycleRequest, S1_02_03_OWNER,
    S1_02_03_SCHEMA_VERSION,
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
        "S1.01.01", "S1.01.02", "S1.01.03", "S1.01.04", "S1.01.05", "S1.01.06",
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

#[test]
fn behavior_normal_valid_cause_state_and_allowed_transition_produce_candidate_only_outcome() {
    let root = root_fixture();
    let predecessor = namespace_fixture(&root);
    let request = PersistentLifecycleRequest::valid_fixture(&predecessor);
    let outcome = PersistentLifecycleProcessor
        .evaluate(&request, &root, &predecessor)
        .expect("valid lifecycle request must pass");

    assert_eq!(outcome.work_id, "S1.02.03");
    assert_eq!(outcome.work_package, "WP-002");
    assert_eq!(outcome.schema_version, S1_02_03_SCHEMA_VERSION);
    assert_eq!(outcome.stable_id, predecessor.stable_id);
    assert_eq!(outcome.previous_state, LifecycleState::Created);
    assert_eq!(outcome.candidate_state, LifecycleState::Active);
    assert_eq!(outcome.owner, S1_02_03_OWNER);
    assert_eq!(outcome.disposition, IdentityDisposition::CandidateOnly);
    assert_eq!(
        outcome.operands,
        ["Persistent", "Lifecycle", "Machine", "Stable", "Entity"]
    );
    assert!(!outcome.cause_event.is_empty());
    assert!(!outcome.completion_evidence.is_empty());
}

#[test]
fn behavior_failure_missing_cause_stale_reference_and_unsupported_transition_reject_without_result() {
    let root = root_fixture();
    let predecessor = namespace_fixture(&root);

    let mut missing = PersistentLifecycleRequest::valid_fixture(&predecessor);
    missing.cause_event = None;
    assert_eq!(
        PersistentLifecycleProcessor.evaluate(&missing, &root, &predecessor),
        Err(PersistentLifecycleRejection::MissingField("cause_event"))
    );

    let mut stale = PersistentLifecycleRequest::valid_fixture(&predecessor);
    stale.source_namespace_schema_version = Some(predecessor.schema_version + 1);
    assert!(matches!(
        PersistentLifecycleProcessor.evaluate(&stale, &root, &predecessor),
        Err(PersistentLifecycleRejection::StaleNamespaceSchemaVersion { .. })
    ));

    let mut unsupported = PersistentLifecycleRequest::valid_fixture(&predecessor);
    unsupported.target_state = Some(LifecycleState::Terminated);
    assert_eq!(
        PersistentLifecycleProcessor.evaluate(&unsupported, &root, &predecessor),
        Err(PersistentLifecycleRejection::UnsupportedTransition(
            LifecycleTransition {
                from: LifecycleState::Created,
                to: LifecycleState::Terminated,
            }
        ))
    );
}

#[test]
fn boundary_requested_progress_partial_and_failed_are_not_completion() {
    let root = root_fixture();
    let predecessor = namespace_fixture(&root);
    for phase in [
        IdentityOperationPhase::Requested,
        IdentityOperationPhase::InProgress,
        IdentityOperationPhase::Partial,
        IdentityOperationPhase::Failed,
    ] {
        let mut request = PersistentLifecycleRequest::valid_fixture(&predecessor);
        request.phase = Some(phase);
        assert_eq!(
            PersistentLifecycleProcessor.evaluate(&request, &root, &predecessor),
            Err(PersistentLifecycleRejection::IncompletePhase(phase))
        );
    }
}

#[test]
fn boundary_projection_and_unrelated_state_do_not_define_lifecycle_outcome() {
    let root = root_fixture();
    let predecessor = namespace_fixture(&root);
    let baseline = PersistentLifecycleProcessor
        .evaluate(
            &PersistentLifecycleRequest::valid_fixture(&predecessor),
            &root,
            &predecessor,
        )
        .unwrap();

    let mut projection = PersistentLifecycleRequest::valid_fixture(&predecessor);
    projection.unrelated_state_hint = Some("analytics-derived-value".to_owned());
    projection.display_name_hint = Some("different display name".to_owned());
    let projected = PersistentLifecycleProcessor
        .evaluate(&projection, &root, &predecessor)
        .unwrap();

    assert_eq!(baseline, projected);
}

#[test]
fn authority_only_registered_owner_and_owning_resolver_are_accepted() {
    let root = root_fixture();
    let predecessor = namespace_fixture(&root);

    let mut wrong_owner = PersistentLifecycleRequest::valid_fixture(&predecessor);
    wrong_owner.owner = Some("renderer".to_owned());
    assert!(matches!(
        PersistentLifecycleProcessor.evaluate(&wrong_owner, &root, &predecessor),
        Err(PersistentLifecycleRejection::WrongOwner { .. })
    ));

    let mut wrong_writer = PersistentLifecycleRequest::valid_fixture(&predecessor);
    wrong_writer.writer = Some("observer".to_owned());
    assert!(matches!(
        PersistentLifecycleProcessor.evaluate(&wrong_writer, &root, &predecessor),
        Err(PersistentLifecycleRejection::WrongWriter { .. })
    ));

    for origin in [
        IdentityOrigin::Derived,
        IdentityOrigin::Observer,
        IdentityOrigin::Renderer,
        IdentityOrigin::Analytics,
    ] {
        let mut request = PersistentLifecycleRequest::valid_fixture(&predecessor);
        request.origin = Some(origin);
        assert_eq!(
            PersistentLifecycleProcessor.evaluate(&request, &root, &predecessor),
            Err(PersistentLifecycleRejection::UnauthorizedOrigin(origin))
        );
    }
}

#[test]
fn contract_preserves_frozen_root_and_s1_02_02_predecessor_references() {
    let root = root_fixture();
    let predecessor = namespace_fixture(&root);
    let outcome = PersistentLifecycleProcessor
        .evaluate(
            &PersistentLifecycleRequest::valid_fixture(&predecessor),
            &root,
            &predecessor,
        )
        .unwrap();

    assert_eq!(outcome.predecessor_work_id, "S1.02.02");
    assert_eq!(outcome.predecessor_work_package, "WP-002");
    assert_eq!(
        outcome.predecessor_evidence_digest,
        predecessor.evidence_digest64()
    );
    assert_eq!(outcome.root_fact_key, root.fact_key);
    assert_eq!(outcome.root_contract_version, root.contract_version);
    assert_eq!(outcome.root_owner, root.owner);
    assert_eq!(outcome.root_causal_parent, root.causal_parent);
}

#[test]
fn integration_root_to_namespace_to_lifecycle_has_no_shortcut_and_propagates_predecessor_failure() {
    let root = root_fixture();
    let predecessor = namespace_fixture(&root);
    let request = PersistentLifecycleRequest::valid_fixture(&predecessor);
    assert!(PersistentLifecycleProcessor
        .evaluate(&request, &root, &predecessor)
        .is_ok());

    let mut mismatched_root = root.clone();
    mismatched_root.causal_parent = "other-root".to_owned();
    assert_eq!(
        PersistentLifecycleProcessor.evaluate(&request, &mismatched_root, &predecessor),
        Err(PersistentLifecycleRejection::InvalidRoot("causal_parent"))
    );

    let mut incomplete = predecessor.clone();
    incomplete.phase = IdentityOperationPhase::Partial;
    assert_eq!(
        PersistentLifecycleProcessor.evaluate(&request, &root, &incomplete),
        Err(PersistentLifecycleRejection::InvalidPredecessor(
            "S1.02.02 is not complete"
        ))
    );
}

#[test]
fn persistence_snapshot_restore_preserves_id_version_pending_transition_causal_and_digest() {
    let root = root_fixture();
    let predecessor = namespace_fixture(&root);
    let outcome = PersistentLifecycleProcessor
        .evaluate(
            &PersistentLifecycleRequest::valid_fixture(&predecessor),
            &root,
            &predecessor,
        )
        .unwrap();
    let digest = outcome.evidence_digest64();
    let restored = PersistentLifecycleOutcome::restore(outcome.snapshot())
        .expect("S1.02.03 snapshot must restore");

    assert_eq!(restored, outcome);
    assert_eq!(restored.evidence_digest64(), digest);
    assert_eq!(restored.stable_id, outcome.stable_id);
    assert_eq!(
        restored.source_namespace_schema_version,
        outcome.source_namespace_schema_version
    );
    assert_eq!(restored.pending_transition, outcome.pending_transition);
    assert_eq!(restored.causal_parent, outcome.causal_parent);
}

#[test]
fn replay_same_snapshot_event_outcome_and_schema_produces_same_result_order_and_digest() {
    let root = root_fixture();
    let predecessor = namespace_fixture(&root);
    let request = PersistentLifecycleRequest::valid_fixture(&predecessor);

    let first = PersistentLifecycleProcessor
        .evaluate(&request, &root, &predecessor)
        .unwrap();
    let second = PersistentLifecycleProcessor
        .evaluate(&request, &root, &predecessor)
        .unwrap();

    assert_eq!(first, second);
    assert_eq!(first.evidence_digest64(), second.evidence_digest64());
    assert_eq!(first.operands, second.operands);
    assert_eq!(first.pending_transition, second.pending_transition);
}
