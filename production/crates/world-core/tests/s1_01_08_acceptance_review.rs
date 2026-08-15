use gaonn_world_core::acceptance::{
    AcceptanceReviewError, AcceptanceReviewRequest, AcceptanceVerdict, MemberL3Evidence,
    ReviewIssueKind, ReviewOrigin, S101AcceptanceReviewer, TestVerdict,
    S1_01_08_ACCEPTANCE_OWNER, S1_01_08_ACCEPTANCE_SCHEMA_VERSION,
};
use gaonn_world_core::authority::AuthorityRecordId;
use gaonn_world_core::exclusion_audit::{
    NonCanonicalAuditEvidence, S1_01_07_AUDIT_SCHEMA_VERSION,
};
use gaonn_world_core::{CanonicalCandidate, CanonicalStateContract, ValidationReceipt};

const RUN_ID: &str = "wp001-acceptance-run-001";
const SOURCE_VERSION: u32 = 1;

fn root_fixture() -> ValidationReceipt {
    CanonicalStateContract
        .validate(&CanonicalCandidate::valid_fixture())
        .expect("S1.01.01 root contract must pass")
}

fn audit_fixture(root: &ValidationReceipt) -> NonCanonicalAuditEvidence {
    NonCanonicalAuditEvidence {
        work_id: "S1.01.07",
        schema_version: S1_01_07_AUDIT_SCHEMA_VERSION,
        root_fact_key: root.fact_key.clone(),
        root_contract_version: root.contract_version,
        root_owner: root.owner.clone(),
        root_causal_parent: root.causal_parent.clone(),
        manifest_id: AuthorityRecordId::new(
            "world-core.authority-manifest",
            "canonical-authority-mapping",
        ),
        manifest_version: 1,
        source_registry_digest: 0xA101_0001,
        source_manifest_digest: 0xA101_0002,
        pre_state_digest: 0xA101_0003,
        post_state_digest: 0xA101_0003,
        source_hash: "frozen-source-hash-s1.01.07".to_owned(),
        run_identity: RUN_ID.to_owned(),
        causal_parent: "S1.01.06:authority-mapping-manifest".to_owned(),
        operands: [
            "Non-Canonical",
            "Exclusion",
            "Canonical",
            "Authority",
            "Registry",
        ],
        attempt_results: Vec::new(),
        violations: Vec::new(),
    }
}

fn member_fixture(work_id: &str) -> MemberL3Evidence {
    MemberL3Evidence {
        work_id: work_id.to_owned(),
        run_identity: RUN_ID.to_owned(),
        source_version: SOURCE_VERSION,
        implementation_present: true,
        behavior_verdict: TestVerdict::Pass,
        contract_verdict: TestVerdict::Pass,
        declared_pass: true,
        evidence_hash: Some(format!("evidence-hash-{work_id}")),
        owner: "world-core.validation.acceptance".to_owned(),
        causal_parent: format!("{work_id}:validated"),
    }
}

fn member_set() -> Vec<MemberL3Evidence> {
    [
        "S1.01.01",
        "S1.01.02",
        "S1.01.03",
        "S1.01.04",
        "S1.01.05",
        "S1.01.06",
        "S1.01.07",
    ]
    .into_iter()
    .map(member_fixture)
    .collect()
}

fn request_fixture() -> AcceptanceReviewRequest {
    AcceptanceReviewRequest::valid_fixture(RUN_ID)
}

#[test]
fn behavior_normal_complete_same_run_evidence_produces_pass_record() {
    let root = root_fixture();
    let audit = audit_fixture(&root);
    let members = member_set();

    let record = S101AcceptanceReviewer
        .review(&request_fixture(), &root, Some(&audit), &members)
        .expect("complete same-run evidence must be reviewable");

    assert_eq!(record.work_id, "S1.01.08");
    assert_eq!(record.work_package, "WP-001");
    assert_eq!(record.verdict, AcceptanceVerdict::Pass);
    assert!(!record.downstream_blocked);
    assert_eq!(record.member_results.len(), 7);
    assert!(record.issues.is_empty());
    assert_eq!(
        record.required_output,
        "Implemented + validated L3 set S1.01.01…S1.01.08; evidence and acceptance record."
    );
}

#[test]
fn behavior_failure_missing_evidence_blocks_and_failed_test_cannot_be_promoted() {
    let root = root_fixture();
    let audit = audit_fixture(&root);

    let mut missing_hash = member_set();
    missing_hash[2].evidence_hash = None;
    let blocked = S101AcceptanceReviewer
        .review(&request_fixture(), &root, Some(&audit), &missing_hash)
        .expect("missing member evidence must yield an explicit blocked record");
    assert_eq!(blocked.verdict, AcceptanceVerdict::Blocked);
    assert!(blocked.downstream_blocked);
    assert!(blocked.issues.iter().any(|issue| {
        issue.kind == ReviewIssueKind::MissingEvidenceHash
            && issue.work_id.as_deref() == Some("S1.01.03")
    }));

    let mut promoted_failure = member_set();
    promoted_failure[4].behavior_verdict = TestVerdict::Fail;
    promoted_failure[4].declared_pass = true;
    let failed = S101AcceptanceReviewer
        .review(
            &request_fixture(),
            &root,
            Some(&audit),
            &promoted_failure,
        )
        .expect("failed test promotion must yield an explicit fail record");
    assert_eq!(failed.verdict, AcceptanceVerdict::Fail);
    assert!(failed.issues.iter().any(|issue| {
        issue.kind == ReviewIssueKind::FailedTestPromoted
            && issue.work_id.as_deref() == Some("S1.01.05")
    }));
}

#[test]
fn boundary_out_of_scope_pass_cannot_substitute_for_required_member() {
    let root = root_fixture();
    let audit = audit_fixture(&root);
    let mut members = member_set();
    members.retain(|member| member.work_id != "S1.01.04");
    members.push(member_fixture("S1.02.01"));

    let record = S101AcceptanceReviewer
        .review(&request_fixture(), &root, Some(&audit), &members)
        .expect("boundary mismatch must yield an explicit blocked record");

    assert_eq!(record.verdict, AcceptanceVerdict::Blocked);
    assert!(record.downstream_blocked);
    assert!(record.issues.iter().any(|issue| {
        issue.kind == ReviewIssueKind::OutOfScopeSubstitution
            && issue.work_id.as_deref() == Some("S1.01.04")
    }));
}

#[test]
fn authority_only_registered_validation_owner_can_issue_acceptance_record() {
    let root = root_fixture();
    let audit = audit_fixture(&root);
    let members = member_set();
    let pre_digest = audit.evidence_digest64();

    let mut wrong_owner = request_fixture();
    wrong_owner.actor_owner = Some("renderer".to_owned());
    assert!(matches!(
        S101AcceptanceReviewer.review(&wrong_owner, &root, Some(&audit), &members),
        Err(AcceptanceReviewError::WrongReviewOwner { .. })
    ));

    let mut observer = request_fixture();
    observer.origin = Some(ReviewOrigin::Observer);
    assert_eq!(
        S101AcceptanceReviewer.review(&observer, &root, Some(&audit), &members),
        Err(AcceptanceReviewError::UnauthorizedReviewOrigin(
            ReviewOrigin::Observer
        ))
    );

    assert_eq!(audit.evidence_digest64(), pre_digest);
}

#[test]
fn contract_preserves_frozen_root_id_version_owner_and_causal_parent() {
    let root = root_fixture();
    let audit = audit_fixture(&root);
    let record = S101AcceptanceReviewer
        .review(&request_fixture(), &root, Some(&audit), &member_set())
        .unwrap();

    assert_eq!(record.root_fact_key, root.fact_key);
    assert_eq!(record.root_contract_version, root.contract_version);
    assert_eq!(record.root_owner, root.owner);
    assert_eq!(record.root_causal_parent, root.causal_parent);
    assert_eq!(record.run_identity, RUN_ID);
    assert_eq!(record.source_version, SOURCE_VERSION);

    let mut invalid_root = root.clone();
    invalid_root.contract_version += 1;
    assert!(matches!(
        S101AcceptanceReviewer.review(
            &request_fixture(),
            &invalid_root,
            Some(&audit),
            &member_set(),
        ),
        Err(AcceptanceReviewError::UnsupportedRootContractVersion { .. })
    ));
}

#[test]
fn integration_missing_or_mismatched_predecessor_audit_blocks_closure() {
    let root = root_fixture();
    let members = member_set();

    let missing = S101AcceptanceReviewer
        .review(&request_fixture(), &root, None, &members)
        .unwrap();
    assert_eq!(missing.verdict, AcceptanceVerdict::Blocked);
    assert!(missing.issues.iter().any(|issue| {
        issue.kind == ReviewIssueKind::MissingPredecessorAudit
            && issue.work_id.as_deref() == Some("S1.01.07")
    }));

    let mut mismatched = audit_fixture(&root);
    mismatched.run_identity = "other-run".to_owned();
    let record = S101AcceptanceReviewer
        .review(&request_fixture(), &root, Some(&mismatched), &members)
        .unwrap();
    assert_eq!(record.verdict, AcceptanceVerdict::Blocked);
    assert!(record.issues.iter().any(|issue| {
        issue.kind == ReviewIssueKind::InvalidPredecessorAudit
            && issue.work_id.as_deref() == Some("S1.01.07")
    }));
}

#[test]
fn persistence_read_only_acceptance_record_snapshot_preserves_evidence_digest() {
    let root = root_fixture();
    let audit = audit_fixture(&root);
    let record = S101AcceptanceReviewer
        .review(&request_fixture(), &root, Some(&audit), &member_set())
        .unwrap();
    let digest = record.evidence_digest64();

    let restored = gaonn_world_core::acceptance::AcceptanceRecord::restore(record.snapshot())
        .expect("read-only acceptance evidence snapshot must restore");

    assert_eq!(restored, record);
    assert_eq!(restored.evidence_digest64(), digest);
    assert_eq!(restored.pre_state_digest, restored.post_state_digest);
}

#[test]
fn replay_same_snapshot_schema_run_and_source_produces_same_record_order_and_digest() {
    let root = root_fixture();
    let audit = audit_fixture(&root);
    let members = member_set();
    let request = request_fixture();

    let first = S101AcceptanceReviewer
        .review(&request, &root, Some(&audit), &members)
        .unwrap();
    let second = S101AcceptanceReviewer
        .review(&request, &root, Some(&audit), &members)
        .unwrap();

    assert_eq!(first, second);
    assert_eq!(first.evidence_digest64(), second.evidence_digest64());
    assert_eq!(
        first
            .member_results
            .iter()
            .map(|result| result.work_id.as_str())
            .collect::<Vec<_>>(),
        second
            .member_results
            .iter()
            .map(|result| result.work_id.as_str())
            .collect::<Vec<_>>()
    );
}

#[test]
fn frozen_baseline_change_request_blocks_closure_without_reclassifying_failure() {
    let root = root_fixture();
    let audit = audit_fixture(&root);
    let members = member_set();
    let mut request = request_fixture();
    request.architecture_change = true;

    let record = S101AcceptanceReviewer
        .review(&request, &root, Some(&audit), &members)
        .unwrap();

    assert_eq!(record.verdict, AcceptanceVerdict::Blocked);
    assert!(record.downstream_blocked);
    assert!(record
        .issues
        .iter()
        .any(|issue| issue.kind == ReviewIssueKind::BaselineChangeRequested));
    assert_eq!(request.schema_version, Some(S1_01_08_ACCEPTANCE_SCHEMA_VERSION));
    assert_eq!(
        request.actor_owner.as_deref(),
        Some(S1_01_08_ACCEPTANCE_OWNER)
    );
}
