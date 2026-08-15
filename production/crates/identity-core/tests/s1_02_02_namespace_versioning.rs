use gaonn_identity_core::namespace_versioning::{
    NamespaceVersioningOutcome, NamespaceVersioningProcessor, NamespaceVersioningRejection,
    NamespaceVersioningRequest, S1_02_02_OWNER, S1_02_02_SCHEMA_VERSION,
};
use gaonn_identity_core::{
    IdentityDisposition, IdentityOperationPhase, IdentityOrigin, StableIdentityOutcome,
    StableIdentityProcessor, StableIdentityRequest,
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
        "S1.01.01", "S1.01.02", "S1.01.03", "S1.01.04", "S1.01.05", "S1.01.06", "S1.01.07",
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

fn stable_identity_fixture(root: &ValidationReceipt) -> StableIdentityOutcome {
    let predecessor = wp001_fixture(root);
    StableIdentityProcessor
        .evaluate(&StableIdentityRequest::valid_fixture(), root, &predecessor)
        .expect("S1.02.01 predecessor fixture must pass")
}

fn evaluate(
    request: &NamespaceVersioningRequest,
) -> Result<NamespaceVersioningOutcome, NamespaceVersioningRejection> {
    let root = root_fixture();
    let stable = stable_identity_fixture(&root);
    NamespaceVersioningProcessor.evaluate(request, &root, &stable)
}

#[test]
fn behavior_normal_valid_namespace_versioning_produces_candidate_only_causal_outcome() {
    let root = root_fixture();
    let stable = stable_identity_fixture(&root);
    let request = NamespaceVersioningRequest::valid_fixture(&stable);
    let outcome = NamespaceVersioningProcessor
        .evaluate(&request, &root, &stable)
        .expect("valid S1.02.02 input must pass");

    assert_eq!(outcome.work_id, "S1.02.02");
    assert_eq!(outcome.work_package, "WP-002");
    assert_eq!(outcome.schema_version, S1_02_02_SCHEMA_VERSION);
    assert_eq!(outcome.stable_id, stable.stable_id);
    assert_eq!(outcome.namespace, stable.namespace);
    assert_eq!(outcome.owner, S1_02_02_OWNER);
    assert_eq!(outcome.phase, IdentityOperationPhase::Complete);
    assert_eq!(outcome.disposition, IdentityDisposition::CandidateOnly);
    assert_eq!(
        outcome.operands,
        ["Namespace", "Versioning", "Stable", "Entity", "ID"]
    );
    assert!(!outcome.issuance_scope.is_empty());
    assert!(!outcome.collision_prevention_rule.is_empty());
    assert!(!outcome.version_lineage.is_empty());
}

#[test]
fn behavior_failure_missing_evidence_stale_reference_and_unsupported_schema_reject() {
    let root = root_fixture();
    let stable = stable_identity_fixture(&root);

    let mut missing = NamespaceVersioningRequest::valid_fixture(&stable);
    missing.collision_prevention_rule = None;
    assert_eq!(
        NamespaceVersioningProcessor.evaluate(&missing, &root, &stable),
        Err(NamespaceVersioningRejection::MissingField(
            "collision_prevention_rule"
        ))
    );

    let mut stale = NamespaceVersioningRequest::valid_fixture(&stable);
    stale.source_identity_version = Some(stable.schema_version + 1);
    assert!(matches!(
        NamespaceVersioningProcessor.evaluate(&stale, &root, &stable),
        Err(NamespaceVersioningRejection::StaleIdentityVersion { .. })
    ));

    let mut unsupported = NamespaceVersioningRequest::valid_fixture(&stable);
    unsupported.schema_version = Some(S1_02_02_SCHEMA_VERSION + 1);
    assert!(matches!(
        NamespaceVersioningProcessor.evaluate(&unsupported, &root, &stable),
        Err(NamespaceVersioningRejection::StaleSchemaVersion { .. })
    ));
}

#[test]
fn boundary_requested_progress_partial_and_failed_are_not_completion() {
    let root = root_fixture();
    let stable = stable_identity_fixture(&root);
    for phase in [
        IdentityOperationPhase::Requested,
        IdentityOperationPhase::InProgress,
        IdentityOperationPhase::Partial,
        IdentityOperationPhase::Failed,
    ] {
        let mut request = NamespaceVersioningRequest::valid_fixture(&stable);
        request.phase = Some(phase);
        assert_eq!(
            NamespaceVersioningProcessor.evaluate(&request, &root, &stable),
            Err(NamespaceVersioningRejection::IncompletePhase(phase))
        );
    }
}

#[test]
fn boundary_stable_id_namespace_and_projection_hints_do_not_cross_authority_boundary() {
    let root = root_fixture();
    let stable = stable_identity_fixture(&root);
    let baseline = NamespaceVersioningProcessor
        .evaluate(
            &NamespaceVersioningRequest::valid_fixture(&stable),
            &root,
            &stable,
        )
        .unwrap();

    let mut projection_only = NamespaceVersioningRequest::valid_fixture(&stable);
    projection_only.display_name_hint = Some("different name".to_owned());
    projection_only.placement_hint = Some("cold-partition-99".to_owned());
    let projected = NamespaceVersioningProcessor
        .evaluate(&projection_only, &root, &stable)
        .unwrap();
    assert_eq!(baseline, projected);

    let mut wrong_id = NamespaceVersioningRequest::valid_fixture(&stable);
    wrong_id.stable_id = Some("entity:human:other".to_owned());
    assert!(matches!(
        NamespaceVersioningProcessor.evaluate(&wrong_id, &root, &stable),
        Err(NamespaceVersioningRejection::StableIdMismatch { .. })
    ));

    let mut wrong_namespace = NamespaceVersioningRequest::valid_fixture(&stable);
    wrong_namespace.namespace = Some("renderer".to_owned());
    assert!(matches!(
        NamespaceVersioningProcessor.evaluate(&wrong_namespace, &root, &stable),
        Err(NamespaceVersioningRejection::NamespaceMismatch { .. })
    ));
}

#[test]
fn authority_only_registered_owner_and_owning_resolver_are_accepted() {
    let root = root_fixture();
    let stable = stable_identity_fixture(&root);

    let mut wrong_writer = NamespaceVersioningRequest::valid_fixture(&stable);
    wrong_writer.writer = Some("renderer".to_owned());
    assert!(matches!(
        NamespaceVersioningProcessor.evaluate(&wrong_writer, &root, &stable),
        Err(NamespaceVersioningRejection::WrongWriter { .. })
    ));

    for origin in [
        IdentityOrigin::Derived,
        IdentityOrigin::Observer,
        IdentityOrigin::Renderer,
        IdentityOrigin::Analytics,
    ] {
        let mut request = NamespaceVersioningRequest::valid_fixture(&stable);
        request.origin = Some(origin);
        assert_eq!(
            NamespaceVersioningProcessor.evaluate(&request, &root, &stable),
            Err(NamespaceVersioningRejection::UnauthorizedOrigin(origin))
        );
    }
}

#[test]
fn contract_preserves_root_and_s1_02_01_predecessor_references() {
    let root = root_fixture();
    let stable = stable_identity_fixture(&root);
    let request = NamespaceVersioningRequest::valid_fixture(&stable);
    let outcome = NamespaceVersioningProcessor
        .evaluate(&request, &root, &stable)
        .unwrap();

    assert_eq!(outcome.predecessor_work_id, "S1.02.01");
    assert_eq!(outcome.predecessor_work_package, "WP-002");
    assert_eq!(
        outcome.predecessor_evidence_digest,
        stable.evidence_digest64()
    );
    assert_eq!(outcome.root_fact_key, root.fact_key);
    assert_eq!(outcome.root_contract_version, root.contract_version);
    assert_eq!(outcome.root_owner, root.owner);
    assert_eq!(outcome.root_causal_parent, root.causal_parent);
}

#[test]
fn integration_root_to_s1_02_01_to_s1_02_02_has_no_shortcut_and_propagates_failure() {
    let root = root_fixture();
    let stable = stable_identity_fixture(&root);
    let request = NamespaceVersioningRequest::valid_fixture(&stable);
    assert!(
        NamespaceVersioningProcessor
            .evaluate(&request, &root, &stable)
            .is_ok()
    );

    let mut mismatched_root = root.clone();
    mismatched_root.causal_parent = "different-root".to_owned();
    assert_eq!(
        NamespaceVersioningProcessor.evaluate(&request, &mismatched_root, &stable),
        Err(NamespaceVersioningRejection::InvalidRoot("causal_parent"))
    );

    let mut incomplete = stable.clone();
    incomplete.phase = IdentityOperationPhase::Partial;
    assert_eq!(
        NamespaceVersioningProcessor.evaluate(&request, &root, &incomplete),
        Err(NamespaceVersioningRejection::InvalidPredecessor(
            "S1.02.01 is not complete"
        ))
    );
}

#[test]
fn persistence_snapshot_restore_preserves_id_version_pending_causal_and_digest() {
    let root = root_fixture();
    let stable = stable_identity_fixture(&root);
    let outcome = NamespaceVersioningProcessor
        .evaluate(
            &NamespaceVersioningRequest::valid_fixture(&stable),
            &root,
            &stable,
        )
        .unwrap();
    let digest = outcome.evidence_digest64();
    let restored = NamespaceVersioningOutcome::restore(outcome.snapshot())
        .expect("S1.02.02 snapshot must restore");

    assert_eq!(restored, outcome);
    assert_eq!(restored.evidence_digest64(), digest);
    assert_eq!(restored.stable_id, outcome.stable_id);
    assert_eq!(restored.namespace_version, outcome.namespace_version);
    assert_eq!(restored.phase, outcome.phase);
    assert_eq!(restored.causal_parent, outcome.causal_parent);
}

#[test]
fn replay_same_snapshot_schema_event_and_predecessor_produces_same_outcome_and_digest() {
    let root = root_fixture();
    let stable = stable_identity_fixture(&root);
    let request = NamespaceVersioningRequest::valid_fixture(&stable);

    let first = NamespaceVersioningProcessor
        .evaluate(&request, &root, &stable)
        .unwrap();
    let second = NamespaceVersioningProcessor
        .evaluate(&request, &root, &stable)
        .unwrap();

    assert_eq!(first, second);
    assert_eq!(first.evidence_digest64(), second.evidence_digest64());
    assert_eq!(first.operands, second.operands);
}
