use gaonn_world_core::acceptance::{
    AcceptanceRecord, AcceptanceVerdict, MemberReviewResult,
    S1_01_08_ACCEPTANCE_SCHEMA_VERSION,
};
use gaonn_identity_core::{
    IdentityDisposition, IdentityIdSource, IdentityOperationPhase, IdentityOrigin,
    IdentityRejection, StableIdentityOutcome, StableIdentityProcessor, StableIdentityRequest,
    S1_02_01_OWNER, S1_02_01_SCHEMA_VERSION,
};
use gaonn_world_core::{CanonicalCandidate, CanonicalStateContract, ValidationReceipt};

fn root_fixture() -> ValidationReceipt {
    CanonicalStateContract
        .validate(&CanonicalCandidate::valid_fixture())
        .expect("frozen root contract fixture must pass")
}

fn predecessor_fixture(root: &ValidationReceipt) -> AcceptanceRecord {
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

fn evaluate(request: &StableIdentityRequest) -> Result<StableIdentityOutcome, IdentityRejection> {
    let root = root_fixture();
    let predecessor = predecessor_fixture(&root);
    StableIdentityProcessor.evaluate(request, &root, &predecessor)
}

#[test]
fn behavior_normal_valid_identity_input_produces_candidate_only_outcome_with_causal_evidence() {
    let request = StableIdentityRequest::valid_fixture();
    let outcome = evaluate(&request).expect("valid stable identity input must pass");

    assert_eq!(outcome.work_id, "S1.02.01");
    assert_eq!(outcome.work_package, "WP-002");
    assert_eq!(outcome.schema_version, S1_02_01_SCHEMA_VERSION);
    assert_eq!(outcome.stable_id, "entity:human:00000001");
    assert_eq!(outcome.namespace, "entity");
    assert_eq!(outcome.owner, S1_02_01_OWNER);
    assert_eq!(outcome.phase, IdentityOperationPhase::Complete);
    assert_eq!(outcome.disposition, IdentityDisposition::CandidateOnly);
    assert_eq!(
        outcome.operands,
        ["Stable", "Entity", "ID", "체계", "Namespace"]
    );
    assert!(!outcome.causal_parent.is_empty());
    assert!(!outcome.completion_evidence.is_empty());
}

#[test]
fn behavior_failure_missing_stale_wrong_owner_and_missing_completion_never_produce_success() {
    let mut missing = StableIdentityRequest::valid_fixture();
    missing.reference_integrity_evidence = None;
    assert_eq!(
        evaluate(&missing),
        Err(IdentityRejection::MissingField(
            "reference_integrity_evidence"
        ))
    );

    let mut stale = StableIdentityRequest::valid_fixture();
    stale.version = Some(S1_02_01_SCHEMA_VERSION + 1);
    assert!(matches!(
        evaluate(&stale),
        Err(IdentityRejection::StaleVersion { .. })
    ));

    let mut wrong_owner = StableIdentityRequest::valid_fixture();
    wrong_owner.owner = Some("renderer".to_owned());
    assert!(matches!(
        evaluate(&wrong_owner),
        Err(IdentityRejection::WrongOwner { .. })
    ));

    let mut no_completion = StableIdentityRequest::valid_fixture();
    no_completion.completion_evidence = None;
    assert_eq!(
        evaluate(&no_completion),
        Err(IdentityRejection::MissingField("completion_evidence"))
    );
}

#[test]
fn boundary_request_progress_partial_and_failed_phases_are_not_completion() {
    for phase in [
        IdentityOperationPhase::Requested,
        IdentityOperationPhase::InProgress,
        IdentityOperationPhase::Partial,
        IdentityOperationPhase::Failed,
    ] {
        let mut request = StableIdentityRequest::valid_fixture();
        request.phase = Some(phase);
        assert_eq!(
            evaluate(&request),
            Err(IdentityRejection::IncompletePhase(phase))
        );
    }
}

#[test]
fn authority_only_pa003_registry_owner_resolver_path_is_accepted() {
    let mut request = StableIdentityRequest::valid_fixture();

    request.writer = Some("analytics".to_owned());
    assert!(matches!(
        evaluate(&request),
        Err(IdentityRejection::WrongWriter { .. })
    ));

    request = StableIdentityRequest::valid_fixture();
    request.origin = Some(IdentityOrigin::Observer);
    assert_eq!(
        evaluate(&request),
        Err(IdentityRejection::UnauthorizedOrigin(
            IdentityOrigin::Observer
        ))
    );

    request = StableIdentityRequest::valid_fixture();
    request.origin = Some(IdentityOrigin::Ai);
    assert_eq!(
        evaluate(&request),
        Err(IdentityRejection::UnauthorizedOrigin(IdentityOrigin::Ai))
    );
}

#[test]
fn boundary_display_name_lod_and_placement_do_not_define_or_change_stable_identity() {
    let first = evaluate(&StableIdentityRequest::valid_fixture()).unwrap();

    let mut changed_projection = StableIdentityRequest::valid_fixture();
    changed_projection.display_name_hint = Some("Completely Different Name".to_owned());
    changed_projection.lod_hint = Some("coarse".to_owned());
    changed_projection.placement_hint = Some("cold-storage-partition-99".to_owned());
    let second = evaluate(&changed_projection).unwrap();

    assert_eq!(first, second);

    for source in [
        IdentityIdSource::ArrayIndex,
        IdentityIdSource::DisplayName,
        IdentityIdSource::Placement,
    ] {
        let mut forbidden = StableIdentityRequest::valid_fixture();
        forbidden.id_source = Some(source);
        assert_eq!(
            evaluate(&forbidden),
            Err(IdentityRejection::ForbiddenIdSource(source))
        );
    }
}

#[test]
fn contract_requires_closed_wp001_and_preserves_root_and_predecessor_references() {
    let root = root_fixture();
    let predecessor = predecessor_fixture(&root);
    let outcome = StableIdentityProcessor
        .evaluate(
            &StableIdentityRequest::valid_fixture(),
            &root,
            &predecessor,
        )
        .unwrap();

    assert_eq!(outcome.predecessor_work_id, "S1.01.08");
    assert_eq!(outcome.predecessor_work_package, "WP-001");
    assert_eq!(
        outcome.predecessor_evidence_digest,
        predecessor.evidence_digest64()
    );
    assert_eq!(outcome.root_fact_key, root.fact_key);
    assert_eq!(outcome.root_contract_version, root.contract_version);
    assert_eq!(outcome.root_owner, root.owner);
    assert_eq!(outcome.root_causal_parent, root.causal_parent);

    let mut blocked = predecessor_fixture(&root);
    blocked.verdict = AcceptanceVerdict::Blocked;
    blocked.downstream_blocked = true;
    assert!(matches!(
        StableIdentityProcessor.evaluate(
            &StableIdentityRequest::valid_fixture(),
            &root,
            &blocked,
        ),
        Err(IdentityRejection::InvalidPredecessor(_))
    ));
}

#[test]
fn integration_predecessor_root_mismatch_blocks_without_shortcut() {
    let root = root_fixture();
    let mut predecessor = predecessor_fixture(&root);
    predecessor.root_causal_parent = "other-root".to_owned();

    assert_eq!(
        StableIdentityProcessor.evaluate(
            &StableIdentityRequest::valid_fixture(),
            &root,
            &predecessor,
        ),
        Err(IdentityRejection::InvalidPredecessor(
            "predecessor root reference does not match current frozen root"
        ))
    );

    let mut incomplete_members = predecessor_fixture(&root);
    incomplete_members.member_results.pop();
    assert_eq!(
        StableIdentityProcessor.evaluate(
            &StableIdentityRequest::valid_fixture(),
            &root,
            &incomplete_members,
        ),
        Err(IdentityRejection::InvalidPredecessor(
            "S1.01 member acceptance set is incomplete"
        ))
    );
}

#[test]
fn persistence_snapshot_restore_preserves_identity_version_owner_causal_lineage_and_digest() {
    let outcome = evaluate(&StableIdentityRequest::valid_fixture()).unwrap();
    let digest = outcome.evidence_digest64();

    let restored = StableIdentityOutcome::restore(outcome.snapshot())
        .expect("stable identity snapshot must restore");

    assert_eq!(restored, outcome);
    assert_eq!(restored.evidence_digest64(), digest);
    assert_eq!(restored.stable_id, outcome.stable_id);
    assert_eq!(restored.schema_version, outcome.schema_version);
    assert_eq!(restored.owner, outcome.owner);
    assert_eq!(restored.causal_parent, outcome.causal_parent);
}

#[test]
fn replay_same_snapshot_root_and_predecessor_produces_same_outcome_and_digest() {
    let root = root_fixture();
    let predecessor = predecessor_fixture(&root);
    let request = StableIdentityRequest::valid_fixture();

    let first = StableIdentityProcessor
        .evaluate(&request, &root, &predecessor)
        .unwrap();
    let second = StableIdentityProcessor
        .evaluate(&request, &root, &predecessor)
        .unwrap();

    assert_eq!(first, second);
    assert_eq!(first.evidence_digest64(), second.evidence_digest64());
}
