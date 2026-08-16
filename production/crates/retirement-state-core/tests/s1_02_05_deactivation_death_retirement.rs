use gaonn_creation_boundary_core::{
    CommittedEntityCreationBoundary, CommittedEntityCreationRequest,
    CommittedEntityCreationValidation, ReferenceIntegrityStatus,
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
use gaonn_retirement_state_core::{
    PriorStateRecord, S1_02_05_OWNER, S1_02_05_SCHEMA_VERSION, StateRecordMutation,
    StateRecordStatus, TerminalStateKind, TerminalStateProcessor, TerminalStateRejection,
    TerminalStateRepresentation, TerminalStateRequest, TerminalStateSubject, WorldTimeReference,
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

fn representation_fixture(
    root: &ValidationReceipt,
    creation: &CommittedEntityCreationValidation,
) -> TerminalStateRepresentation {
    TerminalStateProcessor
        .evaluate(
            &TerminalStateRequest::valid_fixture(creation),
            root,
            creation,
        )
        .expect("S1.02.05 fixture must pass")
}

#[test]
fn behavior_normal_valid_deactivation_state_produces_versioned_candidate_only_representation() {
    let root = root_fixture();
    let creation = creation_fixture(&root);
    let result = representation_fixture(&root, &creation);

    assert_eq!(result.work_id, "S1.02.05");
    assert_eq!(result.work_package, "WP-002");
    assert_eq!(result.schema_version, S1_02_05_SCHEMA_VERSION);
    assert_eq!(result.stable_id, creation.stable_id);
    assert_eq!(result.terminal_state_kind, TerminalStateKind::Deactivation);
    assert_eq!(result.previous_lifecycle_state, creation.lifecycle_state);
    assert_eq!(result.candidate_lifecycle_state, LifecycleState::Inactive);
    assert_eq!(result.owner, S1_02_05_OWNER);
    assert_eq!(result.disposition, IdentityDisposition::CandidateOnly);
    assert_eq!(
        result.operands,
        ["Deactivation", "Death", "Retirement", "Stable", "Entity"]
    );
    assert!(result.preserved_fields.contains(&"stable_id"));
    assert!(result.changed_fields.contains(&"world_time_reference"));
}

#[test]
fn behavior_normal_record_revision_and_close_preserve_identity_and_lineage() {
    let root = root_fixture();
    let creation = creation_fixture(&root);
    let created = representation_fixture(&root, &creation);

    let prior = PriorStateRecord {
        state_record_id: created.state_record_id.clone(),
        record_version: created.record_version,
        stable_id: created.stable_id.clone(),
        lineage_reference: created.lineage_reference.clone(),
        status: created.status,
    };

    let mut revise = TerminalStateRequest::valid_fixture(&creation);
    revise.mutation = Some(StateRecordMutation::Revise);
    revise.record_version = Some(2);
    revise.prior_record = Some(prior.clone());
    revise.state_record_id = Some(prior.state_record_id.clone());
    revise.lineage_reference = Some(prior.lineage_reference.clone());
    revise.world_time = Some(WorldTimeReference {
        instant: "fixture-worldtime-000002".to_owned(),
        ..WorldTimeReference::fixture()
    });
    let revised = TerminalStateProcessor
        .evaluate(&revise, &root, &creation)
        .expect("revision must pass");
    assert_eq!(revised.record_version, 2);
    assert_eq!(revised.stable_id, created.stable_id);
    assert_eq!(revised.lineage_reference, created.lineage_reference);
    assert_eq!(revised.status, StateRecordStatus::Active);

    let mut close = TerminalStateRequest::valid_fixture(&creation);
    close.mutation = Some(StateRecordMutation::CloseRecord);
    close.record_version = Some(3);
    close.prior_record = Some(PriorStateRecord {
        state_record_id: revised.state_record_id.clone(),
        record_version: revised.record_version,
        stable_id: revised.stable_id.clone(),
        lineage_reference: revised.lineage_reference.clone(),
        status: revised.status,
    });
    close.state_record_id = Some(revised.state_record_id.clone());
    close.lineage_reference = Some(revised.lineage_reference.clone());
    let closed = TerminalStateProcessor
        .evaluate(&close, &root, &creation)
        .expect("record close must pass");
    assert_eq!(closed.status, StateRecordStatus::Closed);
    assert_eq!(closed.stable_id, created.stable_id);
    assert_eq!(closed.lineage_reference, created.lineage_reference);
}

#[test]
fn behavior_failure_missing_stale_and_wrong_owner_inputs_reject_without_result() {
    let root = root_fixture();
    let creation = creation_fixture(&root);

    let mut missing = TerminalStateRequest::valid_fixture(&creation);
    missing.cause_event = None;
    assert_eq!(
        TerminalStateProcessor.evaluate(&missing, &root, &creation),
        Err(TerminalStateRejection::MissingField("cause_event"))
    );

    let mut stale = TerminalStateRequest::valid_fixture(&creation);
    stale.source_creation_schema_version = Some(creation.schema_version + 1);
    assert_eq!(
        TerminalStateProcessor.evaluate(&stale, &root, &creation),
        Err(TerminalStateRejection::StaleCreationSchemaVersion {
            expected: creation.schema_version,
            found: creation.schema_version + 1,
        })
    );

    let mut wrong_owner = TerminalStateRequest::valid_fixture(&creation);
    wrong_owner.owner = Some("observer.fake-owner".to_owned());
    assert!(matches!(
        TerminalStateProcessor.evaluate(&wrong_owner, &root, &creation),
        Err(TerminalStateRejection::WrongOwner { .. })
    ));
}

#[test]
fn failure_duplicate_dangling_and_old_record_version_are_rejected() {
    let root = root_fixture();
    let creation = creation_fixture(&root);

    let mut duplicate = TerminalStateRequest::valid_fixture(&creation);
    duplicate
        .existing_state_record_ids
        .push("terminal-state:fixture:0001".to_owned());
    assert!(matches!(
        TerminalStateProcessor.evaluate(&duplicate, &root, &creation),
        Err(TerminalStateRejection::DuplicateStateRecordId(_))
    ));

    let mut dangling = TerminalStateRequest::valid_fixture(&creation);
    dangling.reference_integrity = Some(ReferenceIntegrityStatus::Dangling);
    assert_eq!(
        TerminalStateProcessor.evaluate(&dangling, &root, &creation),
        Err(TerminalStateRejection::ReferenceIntegrityNotVerified(
            ReferenceIntegrityStatus::Dangling
        ))
    );

    let created = representation_fixture(&root, &creation);
    let mut old_version = TerminalStateRequest::valid_fixture(&creation);
    old_version.mutation = Some(StateRecordMutation::Revise);
    old_version.record_version = Some(1);
    old_version.prior_record = Some(PriorStateRecord {
        state_record_id: created.state_record_id.clone(),
        record_version: 1,
        stable_id: created.stable_id.clone(),
        lineage_reference: created.lineage_reference.clone(),
        status: StateRecordStatus::Active,
    });
    assert_eq!(
        TerminalStateProcessor.evaluate(&old_version, &root, &creation),
        Err(TerminalStateRejection::InvalidRecordVersion {
            expected: 2,
            found: 1,
        })
    );
}

#[test]
fn boundary_keeps_state_kind_subject_and_worldtime_frame_distinct() {
    let root = root_fixture();
    let creation = creation_fixture(&root);

    for subject in [
        TerminalStateSubject::ProjectionOnly,
        TerminalStateSubject::SimilarNamedOutOfScopeState,
    ] {
        let mut request = TerminalStateRequest::valid_fixture(&creation);
        request.subject = Some(subject);
        assert_eq!(
            TerminalStateProcessor.evaluate(&request, &root, &creation),
            Err(TerminalStateRejection::OutOfScopeSubject(subject))
        );
    }

    let mut death = TerminalStateRequest::valid_fixture(&creation);
    death.terminal_state_kind = Some(TerminalStateKind::Death);
    death.target_lifecycle_state = Some(LifecycleState::Terminated);
    death.allowed_transitions = vec![LifecycleTransition {
        from: creation.lifecycle_state,
        to: LifecycleState::Terminated,
    }];
    death.world_time = Some(WorldTimeReference {
        frame: "frame-death".to_owned(),
        ..WorldTimeReference::fixture()
    });
    let death_result = TerminalStateProcessor
        .evaluate(&death, &root, &creation)
        .expect("source-supplied death transition must pass");

    let mut retirement = death.clone();
    retirement.terminal_state_kind = Some(TerminalStateKind::Retirement);
    retirement.world_time = Some(WorldTimeReference {
        frame: "frame-retirement".to_owned(),
        ..WorldTimeReference::fixture()
    });
    let retirement_result = TerminalStateProcessor
        .evaluate(&retirement, &root, &creation)
        .expect("source-supplied retirement transition must pass");

    assert_ne!(
        death_result.terminal_state_kind,
        retirement_result.terminal_state_kind
    );
    assert_ne!(
        death_result.world_time.frame,
        retirement_result.world_time.frame
    );
    assert_eq!(death_result.stable_id, retirement_result.stable_id);
}

#[test]
fn authority_wrong_writer_and_projection_origins_cannot_write() {
    let root = root_fixture();
    let creation = creation_fixture(&root);

    let mut wrong_writer = TerminalStateRequest::valid_fixture(&creation);
    wrong_writer.writer = Some("renderer.write-path".to_owned());
    assert!(matches!(
        TerminalStateProcessor.evaluate(&wrong_writer, &root, &creation),
        Err(TerminalStateRejection::WrongWriter { .. })
    ));

    for origin in [
        IdentityOrigin::Derived,
        IdentityOrigin::Observer,
        IdentityOrigin::Renderer,
        IdentityOrigin::Analytics,
    ] {
        let mut request = TerminalStateRequest::valid_fixture(&creation);
        request.origin = Some(origin);
        assert_eq!(
            TerminalStateProcessor.evaluate(&request, &root, &creation),
            Err(TerminalStateRejection::UnauthorizedOrigin(origin))
        );
    }
}

#[test]
fn contract_preserves_root_predecessor_id_version_owner_and_causal_reference() {
    let root = root_fixture();
    let creation = creation_fixture(&root);
    let result = representation_fixture(&root, &creation);

    assert_eq!(result.predecessor_work_id, "S1.02.04");
    assert_eq!(result.predecessor_work_package, "WP-002");
    assert_eq!(
        result.predecessor_evidence_digest,
        creation.evidence_digest64()
    );
    assert_eq!(
        result.source_creation_schema_version,
        creation.schema_version
    );
    assert_eq!(result.root_fact_key, root.fact_key);
    assert_eq!(result.root_contract_version, root.contract_version);
    assert_eq!(result.root_owner, root.owner);
    assert_eq!(result.root_causal_parent, root.causal_parent);
}

#[test]
fn integration_has_no_shortcut_and_predecessor_or_root_failure_propagates() {
    let root = root_fixture();
    let creation = creation_fixture(&root);
    let request = TerminalStateRequest::valid_fixture(&creation);
    assert!(
        TerminalStateProcessor
            .evaluate(&request, &root, &creation)
            .is_ok()
    );

    let mut mismatched_root = root.clone();
    mismatched_root.causal_parent = "other-root".to_owned();
    assert_eq!(
        TerminalStateProcessor.evaluate(&request, &mismatched_root, &creation),
        Err(TerminalStateRejection::InvalidRoot("causal_parent"))
    );

    let mut incomplete_predecessor = creation.clone();
    incomplete_predecessor.phase = IdentityOperationPhase::Partial;
    let incomplete_request = TerminalStateRequest::valid_fixture(&incomplete_predecessor);
    assert_eq!(
        TerminalStateProcessor.evaluate(&incomplete_request, &root, &incomplete_predecessor),
        Err(TerminalStateRejection::InvalidPredecessor(
            "predecessor incomplete"
        ))
    );
}

#[test]
fn persistence_and_replay_preserve_id_version_pending_causal_worldtime_and_digest() {
    let root = root_fixture();
    let creation = creation_fixture(&root);
    let request = TerminalStateRequest::valid_fixture(&creation);
    let first = TerminalStateProcessor
        .evaluate(&request, &root, &creation)
        .expect("first execution must pass");
    let restored =
        TerminalStateRepresentation::restore(first.snapshot()).expect("snapshot restore must pass");
    let replay = TerminalStateProcessor
        .evaluate(&request, &root, &creation)
        .expect("replay must pass");

    assert_eq!(restored, first);
    assert_eq!(replay, first);
    assert_eq!(restored.stable_id, first.stable_id);
    assert_eq!(restored.record_version, first.record_version);
    assert_eq!(restored.validated_transition, first.validated_transition);
    assert_eq!(restored.causal_parent, first.causal_parent);
    assert_eq!(restored.world_time, first.world_time);
    assert_eq!(restored.evidence_digest64(), first.evidence_digest64());
    assert_eq!(replay.evidence_digest64(), first.evidence_digest64());
}
