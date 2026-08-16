use gaonn_creation_boundary_core::{
    CommittedEntityCreationBoundary, CommittedEntityCreationRequest,
    CommittedEntityCreationValidation,
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
    CommitMarkerState, CutReferenceStatus, RetentionSegmentStatus, RetentionSubject,
    S1_02_06_OWNER, S1_02_06_SCHEMA_VERSION, TombstoneRetentionArtifact,
    TombstoneRetentionProcessor, TombstoneRetentionRejection, TombstoneRetentionRequest,
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

fn retention_fixture(
    root: &ValidationReceipt,
) -> (
    NamespaceVersioningOutcome,
    TerminalStateRepresentation,
    TombstoneRetentionArtifact,
) {
    let namespace = namespace_fixture(root);
    let terminal = terminal_fixture(root);
    let artifact = TombstoneRetentionProcessor
        .evaluate(
            &TombstoneRetentionRequest::valid_fixture(&namespace, &terminal),
            root,
            &namespace,
            &terminal,
        )
        .expect("S1.02.06 fixture must pass");
    (namespace, terminal, artifact)
}

#[test]
fn behavior_normal_valid_retention_records_durable_recovery_boundary_candidate_only() {
    let root = root_fixture();
    let namespace = namespace_fixture(&root);
    let terminal = terminal_fixture(&root);
    let result = TombstoneRetentionProcessor
        .evaluate(
            &TombstoneRetentionRequest::valid_fixture(&namespace, &terminal),
            &root,
            &namespace,
            &terminal,
        )
        .expect("valid S1.02.06 input must pass");

    assert_eq!(result.work_id, "S1.02.06");
    assert_eq!(result.work_package, "WP-002");
    assert_eq!(result.schema_version, S1_02_06_SCHEMA_VERSION);
    assert_eq!(result.stable_id, terminal.stable_id);
    assert_eq!(result.namespace, namespace.namespace);
    assert_eq!(result.namespace_version, namespace.namespace_version);
    assert_eq!(result.lifecycle_lineage, namespace.lifecycle_lineage);
    assert_eq!(result.owner, S1_02_06_OWNER);
    assert_eq!(result.disposition, IdentityDisposition::CandidateOnly);
    assert_eq!(
        result.operands,
        ["Tombstone", "Historical", "Retention", "Stable", "Entity"]
    );
}

#[test]
fn function_specific_normal_save_restore_and_replay_preserve_id_order_and_digest() {
    let root = root_fixture();
    let namespace = namespace_fixture(&root);
    let terminal = terminal_fixture(&root);
    let request = TombstoneRetentionRequest::valid_fixture(&namespace, &terminal);

    let first = TombstoneRetentionProcessor
        .evaluate(&request, &root, &namespace, &terminal)
        .expect("first retention execution must pass");
    let restored =
        TombstoneRetentionArtifact::restore(first.snapshot()).expect("restore must pass");
    let replay = TombstoneRetentionProcessor
        .evaluate(&request, &root, &namespace, &terminal)
        .expect("replay must pass");

    assert_eq!(first.stable_id, restored.stable_id);
    assert_eq!(first.commit_marker, restored.commit_marker);
    assert_eq!(first.causal_cut, restored.causal_cut);
    assert_eq!(first.parent_cut, restored.parent_cut);
    assert_eq!(first.replay_reference, restored.replay_reference);
    assert_eq!(first.evidence_digest64(), restored.evidence_digest64());
    assert_eq!(first, replay);
    assert_eq!(first.evidence_digest64(), replay.evidence_digest64());
}

#[test]
fn behavior_failure_missing_wrong_owner_and_pending_commit_do_not_produce_result() {
    let root = root_fixture();
    let namespace = namespace_fixture(&root);
    let terminal = terminal_fixture(&root);

    let mut missing = TombstoneRetentionRequest::valid_fixture(&namespace, &terminal);
    missing.durable_artifact = None;
    assert_eq!(
        TombstoneRetentionProcessor.evaluate(&missing, &root, &namespace, &terminal),
        Err(TombstoneRetentionRejection::MissingField(
            "durable_artifact"
        ))
    );

    let mut wrong_owner = TombstoneRetentionRequest::valid_fixture(&namespace, &terminal);
    wrong_owner.owner = Some("observer.owner".to_owned());
    assert!(matches!(
        TombstoneRetentionProcessor.evaluate(&wrong_owner, &root, &namespace, &terminal),
        Err(TombstoneRetentionRejection::WrongOwner { .. })
    ));

    let mut pending = TombstoneRetentionRequest::valid_fixture(&namespace, &terminal);
    pending.commit_marker_state = Some(CommitMarkerState::Pending);
    assert_eq!(
        TombstoneRetentionProcessor.evaluate(&pending, &root, &namespace, &terminal),
        Err(TombstoneRetentionRejection::CommitMarkerNotCommitted(
            CommitMarkerState::Pending
        ))
    );
}

#[test]
fn function_specific_failure_partial_corrupt_stale_and_outside_cut_are_rejected() {
    let root = root_fixture();
    let namespace = namespace_fixture(&root);
    let terminal = terminal_fixture(&root);

    for status in [
        RetentionSegmentStatus::Partial,
        RetentionSegmentStatus::Corrupt,
    ] {
        let mut request = TombstoneRetentionRequest::valid_fixture(&namespace, &terminal);
        request.segment_status = Some(status);
        assert_eq!(
            TombstoneRetentionProcessor.evaluate(&request, &root, &namespace, &terminal),
            Err(TombstoneRetentionRejection::SegmentNotComplete(status))
        );
    }

    let mut stale = TombstoneRetentionRequest::valid_fixture(&namespace, &terminal);
    stale.source_terminal_schema_version = Some(terminal.schema_version + 1);
    assert!(matches!(
        TombstoneRetentionProcessor.evaluate(&stale, &root, &namespace, &terminal),
        Err(TombstoneRetentionRejection::StaleTerminalSchemaVersion { .. })
    ));

    let mut outside = TombstoneRetentionRequest::valid_fixture(&namespace, &terminal);
    outside.cut_reference_status = Some(CutReferenceStatus::OutsideCut);
    assert_eq!(
        TombstoneRetentionProcessor.evaluate(&outside, &root, &namespace, &terminal),
        Err(TombstoneRetentionRejection::CutOutside(
            CutReferenceStatus::OutsideCut
        ))
    );
}

#[test]
fn boundary_distinguishes_durable_identity_retention_from_projection_and_pending_state() {
    let root = root_fixture();
    let namespace = namespace_fixture(&root);
    let terminal = terminal_fixture(&root);

    for subject in [
        RetentionSubject::ProjectionOnly,
        RetentionSubject::SimilarNamedOutOfScopeState,
    ] {
        let mut request = TombstoneRetentionRequest::valid_fixture(&namespace, &terminal);
        request.subject = Some(subject);
        assert_eq!(
            TombstoneRetentionProcessor.evaluate(&request, &root, &namespace, &terminal),
            Err(TombstoneRetentionRejection::OutOfScopeSubject(subject))
        );
    }

    let mut first = TombstoneRetentionRequest::valid_fixture(&namespace, &terminal);
    let mut second = first.clone();
    first.observation_hint = Some("camera-a".to_owned());
    second.observation_hint = Some("camera-b".to_owned());

    let a = TombstoneRetentionProcessor
        .evaluate(&first, &root, &namespace, &terminal)
        .expect("observer hint must not affect canonical-boundary evidence");
    let b = TombstoneRetentionProcessor
        .evaluate(&second, &root, &namespace, &terminal)
        .expect("observer hint must remain non-authoritative");
    assert_eq!(a, b);
}

#[test]
fn authority_wrong_writer_and_read_only_projection_origins_are_blocked() {
    let root = root_fixture();
    let namespace = namespace_fixture(&root);
    let terminal = terminal_fixture(&root);

    let mut wrong_writer = TombstoneRetentionRequest::valid_fixture(&namespace, &terminal);
    wrong_writer.writer = Some("other.writer".to_owned());
    assert!(matches!(
        TombstoneRetentionProcessor.evaluate(&wrong_writer, &root, &namespace, &terminal),
        Err(TombstoneRetentionRejection::WrongWriter { .. })
    ));

    for origin in [
        IdentityOrigin::Derived,
        IdentityOrigin::Observer,
        IdentityOrigin::Renderer,
        IdentityOrigin::Analytics,
    ] {
        let mut request = TombstoneRetentionRequest::valid_fixture(&namespace, &terminal);
        request.origin = Some(origin);
        assert_eq!(
            TombstoneRetentionProcessor.evaluate(&request, &root, &namespace, &terminal),
            Err(TombstoneRetentionRejection::UnauthorizedOrigin(origin))
        );
    }
}

#[test]
fn contract_preserves_root_namespace_predecessor_id_version_owner_and_causal_references() {
    let root = root_fixture();
    let namespace = namespace_fixture(&root);
    let terminal = terminal_fixture(&root);
    let result = TombstoneRetentionProcessor
        .evaluate(
            &TombstoneRetentionRequest::valid_fixture(&namespace, &terminal),
            &root,
            &namespace,
            &terminal,
        )
        .expect("contract fixture must pass");

    assert_eq!(result.predecessor_work_id, "S1.02.05");
    assert_eq!(result.predecessor_work_package, "WP-002");
    assert_eq!(
        result.predecessor_evidence_digest,
        terminal.evidence_digest64()
    );
    assert_eq!(result.namespace_source_work_id, "S1.02.02");
    assert_eq!(
        result.namespace_source_evidence_digest,
        namespace.evidence_digest64()
    );
    assert_eq!(result.root_fact_key, root.fact_key);
    assert_eq!(result.root_contract_version, root.contract_version);
    assert_eq!(result.root_owner, root.owner);
    assert_eq!(result.root_causal_parent, root.causal_parent);
}

#[test]
fn integration_has_no_shortcut_and_source_or_predecessor_failure_propagates() {
    let root = root_fixture();
    let namespace = namespace_fixture(&root);
    let terminal = terminal_fixture(&root);
    let request = TombstoneRetentionRequest::valid_fixture(&namespace, &terminal);

    assert!(
        TombstoneRetentionProcessor
            .evaluate(&request, &root, &namespace, &terminal)
            .is_ok()
    );

    let mut bad_namespace = namespace.clone();
    bad_namespace.phase = IdentityOperationPhase::Partial;
    assert!(matches!(
        TombstoneRetentionProcessor.evaluate(&request, &root, &bad_namespace, &terminal),
        Err(TombstoneRetentionRejection::InvalidNamespaceSource(_))
    ));

    let mut bad_terminal = terminal.clone();
    bad_terminal.phase = IdentityOperationPhase::InProgress;
    assert!(matches!(
        TombstoneRetentionProcessor.evaluate(&request, &root, &namespace, &bad_terminal),
        Err(TombstoneRetentionRejection::InvalidPredecessor(_))
    ));

    let mut bad_root = root.clone();
    bad_root.causal_parent = "other-root".to_owned();
    assert_eq!(
        TombstoneRetentionProcessor.evaluate(&request, &bad_root, &namespace, &terminal),
        Err(TombstoneRetentionRejection::InvalidRoot("causal_parent"))
    );
}

#[test]
fn persistence_rejects_corrupt_snapshot_and_replay_keeps_recovery_position_and_lineage() {
    let root = root_fixture();
    let (_, _, artifact) = retention_fixture(&root);

    let mut corrupt = artifact.snapshot();
    corrupt.artifact.segment_status = RetentionSegmentStatus::Corrupt;
    assert_eq!(
        TombstoneRetentionArtifact::restore(corrupt),
        Err(TombstoneRetentionRejection::CorruptSnapshot(
            "partial or corrupt segment used as recovery basis"
        ))
    );

    let restored =
        TombstoneRetentionArtifact::restore(artifact.snapshot()).expect("valid restore must pass");
    assert_eq!(artifact.recovery_position, restored.recovery_position);
    assert_eq!(artifact.lifecycle_lineage, restored.lifecycle_lineage);
    assert_eq!(
        artifact.terminal_lineage_reference,
        restored.terminal_lineage_reference
    );
    assert_eq!(artifact.evidence_digest64(), restored.evidence_digest64());
}
