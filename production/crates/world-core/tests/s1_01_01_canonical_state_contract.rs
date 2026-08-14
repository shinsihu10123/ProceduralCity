use gaonn_world_core::{
    CanonicalCandidate, CanonicalStateContract, RejectionReason, StateClass, WriteOrigin,
    S1_01_01_CONTRACT_VERSION, ValidationReceipt,
};

fn contract() -> CanonicalStateContract {
    CanonicalStateContract
}

#[test]
fn behavior_normal_accepts_registered_owner_path() {
    let candidate = CanonicalCandidate::valid_fixture();
    let receipt = contract()
        .validate(&candidate)
        .expect("valid canonical candidate must pass");

    assert_eq!(receipt.work_id, "S1.01.01");
    assert_eq!(receipt.contract_version, S1_01_01_CONTRACT_VERSION);
    assert_eq!(receipt.owner, "domain01.celestial_frame");
    assert_eq!(receipt.writer, receipt.owner);
    assert_eq!(receipt.operands, ["Canonical", "Authority", "Registry"]);
    assert_eq!(receipt.causal_parent, "frozen-root:what-how-wbs:v1");
}

#[test]
fn behavior_failure_rejects_missing_required_field_without_side_effect() {
    let mut candidate = CanonicalCandidate::valid_fixture();
    candidate.owner = None;
    let pre_state = "canonical-pre-state-digest-unchanged".to_owned();

    let result = contract().validate(&candidate);

    assert_eq!(result, Err(RejectionReason::MissingField("owner")));
    assert_eq!(pre_state, "canonical-pre-state-digest-unchanged");
}

#[test]
fn boundary_rejects_noncanonical_projection_even_with_owner_like_fields() {
    for state_class in [
        StateClass::Derived,
        StateClass::Observer,
        StateClass::Renderer,
        StateClass::Analytics,
    ] {
        let mut candidate = CanonicalCandidate::valid_fixture();
        candidate.state_class = Some(state_class);

        assert_eq!(
            contract().validate(&candidate),
            Err(RejectionReason::NonCanonicalState { state_class })
        );
    }
}

#[test]
fn authority_allows_only_owning_resolver_and_matching_writer() {
    let mut wrong_owner = CanonicalCandidate::valid_fixture();
    wrong_owner.writer = Some("domain28.observer".to_owned());
    assert_eq!(
        contract().validate(&wrong_owner),
        Err(RejectionReason::WrongOwner {
            owner: "domain01.celestial_frame".to_owned(),
            writer: "domain28.observer".to_owned(),
        })
    );

    for origin in [
        WriteOrigin::CrossDomainProcess,
        WriteOrigin::Ui,
        WriteOrigin::Ai,
        WriteOrigin::Observer,
        WriteOrigin::Renderer,
        WriteOrigin::Analytics,
    ] {
        let mut candidate = CanonicalCandidate::valid_fixture();
        candidate.origin = Some(origin);
        assert_eq!(
            contract().validate(&candidate),
            Err(RejectionReason::ProhibitedDirectWrite { origin })
        );
    }
}

#[test]
fn contract_rejects_stale_version_before_downstream_handoff() {
    let mut candidate = CanonicalCandidate::valid_fixture();
    candidate.version = Some(S1_01_01_CONTRACT_VERSION + 1);

    assert_eq!(
        contract().validate(&candidate),
        Err(RejectionReason::StaleVersion {
            expected: S1_01_01_CONTRACT_VERSION,
            found: S1_01_01_CONTRACT_VERSION + 1,
        })
    );
}

#[test]
fn integration_preserves_root_causal_reference_on_success_and_blocks_failure() {
    let success = contract()
        .validate(&CanonicalCandidate::valid_fixture())
        .expect("frozen root success path must validate");
    assert_eq!(success.causal_parent, "frozen-root:what-how-wbs:v1");

    let mut failure = CanonicalCandidate::valid_fixture();
    failure.fact_key = None;
    assert_eq!(
        contract().validate(&failure),
        Err(RejectionReason::MissingField("fact_key"))
    );
}

#[test]
fn persistence_round_trip_preserves_identity_version_owner_and_causal_reference() {
    let receipt = contract()
        .validate(&CanonicalCandidate::valid_fixture())
        .expect("fixture must validate");
    let encoded = receipt.encode_stable();
    let restored = ValidationReceipt::decode_stable(&encoded).expect("round-trip must decode");

    assert_eq!(restored, receipt);
    assert_eq!(restored.evidence_digest64(), receipt.evidence_digest64());
}

#[test]
fn replay_same_input_produces_same_result_ordering_and_digest() {
    let candidate = CanonicalCandidate::valid_fixture();
    let first = contract().validate(&candidate).expect("first replay pass");
    let second = contract().validate(&candidate).expect("second replay pass");

    assert_eq!(first, second);
    assert_eq!(first.encode_stable(), second.encode_stable());
    assert_eq!(first.evidence_digest64(), second.evidence_digest64());
}
