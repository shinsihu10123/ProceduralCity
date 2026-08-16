//! Frozen L3 `S1.02.05 Deactivation / Death / Retirement State`.
//!
//! This crate implements the PA-003 versioned state-representation boundary for deactivation,
//! death, and retirement. It consumes the S1.02.04 committed-entity-creation validation and
//! produces candidate-only state evidence. Canonical mutation remains downstream behind
//! Objective Resolution and the designated PA-003 owner commit path.

use std::fmt;

use gaonn_creation_boundary_core::{
    CommittedEntityCreationValidation, ReferenceIntegrityStatus, S1_02_04_OWNER,
    S1_02_04_SCHEMA_VERSION,
};
use gaonn_identity_core::{IdentityDisposition, IdentityOperationPhase, IdentityOrigin};
use gaonn_lifecycle_core::{LifecycleState, LifecycleTransition};
use gaonn_world_core::ValidationReceipt;

pub const S1_02_05_SCHEMA_VERSION: u32 = 1;
pub const S1_02_05_OWNER: &str = S1_02_04_OWNER;
const OPERANDS: [&str; 5] = ["Deactivation", "Death", "Retirement", "Stable", "Entity"];
const CHANGED_FIELDS: [&str; 4] = [
    "lifecycle_state",
    "terminal_state_kind",
    "world_time_reference",
    "cause_event",
];
const PRESERVED_FIELDS: [&str; 4] = [
    "stable_id",
    "lineage_reference",
    "entity_kind",
    "creation_provenance",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum TerminalStateKind {
    Deactivation,
    Death,
    Retirement,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum StateRecordMutation {
    Create,
    Revise,
    CloseRecord,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum StateRecordStatus {
    Active,
    Closed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum TerminalStateSubject {
    EntityLifecycleState,
    ProjectionOnly,
    SimilarNamedOutOfScopeState,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct WorldTimeReference {
    pub instant: String,
    pub unit: String,
    pub frame: String,
    pub version: u32,
}

impl WorldTimeReference {
    pub fn fixture() -> Self {
        Self {
            instant: "fixture-worldtime-000001".to_owned(),
            unit: "opaque-source-unit".to_owned(),
            frame: "canonical-worldtime-frame".to_owned(),
            version: 1,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PriorStateRecord {
    pub state_record_id: String,
    pub record_version: u32,
    pub stable_id: String,
    pub lineage_reference: String,
    pub status: StateRecordStatus,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TerminalStateRequest {
    pub stable_id: Option<String>,
    pub state_record_id: Option<String>,
    pub record_version: Option<u32>,
    pub mutation: Option<StateRecordMutation>,
    pub prior_record: Option<PriorStateRecord>,
    pub existing_state_record_ids: Vec<String>,
    pub source_creation_schema_version: Option<u32>,
    pub source_creation_evidence_digest: Option<u64>,
    pub current_lifecycle_state: Option<LifecycleState>,
    pub target_lifecycle_state: Option<LifecycleState>,
    pub allowed_transitions: Vec<LifecycleTransition>,
    pub terminal_state_kind: Option<TerminalStateKind>,
    pub world_time: Option<WorldTimeReference>,
    pub cause_event: Option<String>,
    pub lineage_reference: Option<String>,
    pub reference_integrity: Option<ReferenceIntegrityStatus>,
    pub entity_kind: Option<String>,
    pub creation_provenance: Option<String>,
    pub schema_version: Option<u32>,
    pub owner: Option<String>,
    pub writer: Option<String>,
    pub causal_parent: Option<String>,
    pub completion_evidence: Option<String>,
    pub phase: Option<IdentityOperationPhase>,
    pub origin: Option<IdentityOrigin>,
    pub subject: Option<TerminalStateSubject>,
    pub unrelated_state_hint: Option<String>,
}

impl TerminalStateRequest {
    pub fn valid_fixture(predecessor: &CommittedEntityCreationValidation) -> Self {
        let transition = LifecycleTransition {
            from: predecessor.lifecycle_state,
            to: LifecycleState::Inactive,
        };
        Self {
            stable_id: Some(predecessor.stable_id.clone()),
            state_record_id: Some("terminal-state:fixture:0001".to_owned()),
            record_version: Some(1),
            mutation: Some(StateRecordMutation::Create),
            prior_record: None,
            existing_state_record_ids: Vec::new(),
            source_creation_schema_version: Some(predecessor.schema_version),
            source_creation_evidence_digest: Some(predecessor.evidence_digest64()),
            current_lifecycle_state: Some(predecessor.lifecycle_state),
            target_lifecycle_state: Some(transition.to),
            allowed_transitions: vec![transition],
            terminal_state_kind: Some(TerminalStateKind::Deactivation),
            world_time: Some(WorldTimeReference::fixture()),
            cause_event: Some("fixture-source-defined-deactivation-event".to_owned()),
            lineage_reference: Some("identity-lineage:fixture:0001".to_owned()),
            reference_integrity: Some(ReferenceIntegrityStatus::Verified),
            entity_kind: Some(predecessor.entity_kind.clone()),
            creation_provenance: Some(predecessor.creation_provenance.clone()),
            schema_version: Some(S1_02_05_SCHEMA_VERSION),
            owner: Some(S1_02_05_OWNER.to_owned()),
            writer: Some(S1_02_05_OWNER.to_owned()),
            causal_parent: Some("WP-002:S1.02.04:PASS".to_owned()),
            completion_evidence: Some("terminal-state-representation-complete".to_owned()),
            phase: Some(IdentityOperationPhase::Complete),
            origin: Some(IdentityOrigin::OwningResolver),
            subject: Some(TerminalStateSubject::EntityLifecycleState),
            unrelated_state_hint: Some("observer-terminal-looking-value".to_owned()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TerminalStateRepresentation {
    pub work_id: &'static str,
    pub work_package: &'static str,
    pub schema_version: u32,
    pub stable_id: String,
    pub state_record_id: String,
    pub record_version: u32,
    pub mutation: StateRecordMutation,
    pub status: StateRecordStatus,
    pub source_creation_schema_version: u32,
    pub previous_lifecycle_state: LifecycleState,
    pub candidate_lifecycle_state: LifecycleState,
    pub validated_transition: LifecycleTransition,
    pub terminal_state_kind: TerminalStateKind,
    pub world_time: WorldTimeReference,
    pub cause_event: String,
    pub lineage_reference: String,
    pub reference_integrity: ReferenceIntegrityStatus,
    pub entity_kind: String,
    pub creation_provenance: String,
    pub owner: String,
    pub causal_parent: String,
    pub completion_evidence: String,
    pub phase: IdentityOperationPhase,
    pub disposition: IdentityDisposition,
    pub changed_fields: [&'static str; 4],
    pub preserved_fields: [&'static str; 4],
    pub operands: [&'static str; 5],
    pub predecessor_work_id: &'static str,
    pub predecessor_work_package: &'static str,
    pub predecessor_evidence_digest: u64,
    pub root_fact_key: String,
    pub root_contract_version: u32,
    pub root_owner: String,
    pub root_causal_parent: String,
}

impl TerminalStateRepresentation {
    pub fn evidence_digest64(&self) -> u64 {
        let encoded = format!(
            "{}|{}|{}|{}|{}|{}|{:?}|{:?}|{}|{:?}|{:?}|{:?}|{:?}|{}|{}|{}|{}|{}|{:?}|{}|{}|{}|{:?}|{:?}|{:?}|{:?}|{:?}|{}|{}|{}|{}|{}|{}|{}",
            self.work_id,
            self.work_package,
            self.schema_version,
            self.stable_id,
            self.state_record_id,
            self.record_version,
            self.mutation,
            self.status,
            self.source_creation_schema_version,
            self.previous_lifecycle_state,
            self.candidate_lifecycle_state,
            self.validated_transition,
            self.terminal_state_kind,
            self.world_time.instant,
            self.world_time.unit,
            self.world_time.frame,
            self.world_time.version,
            self.cause_event,
            self.reference_integrity,
            self.lineage_reference,
            self.entity_kind,
            self.creation_provenance,
            self.phase,
            self.disposition,
            self.changed_fields,
            self.preserved_fields,
            self.operands,
            self.predecessor_work_id,
            self.predecessor_work_package,
            self.predecessor_evidence_digest,
            self.root_fact_key,
            self.root_contract_version,
            self.root_owner,
            self.root_causal_parent,
        );
        fnv1a64(
            format!(
                "{encoded}|{}|{}",
                self.causal_parent, self.completion_evidence
            )
            .as_bytes(),
        )
    }

    pub fn snapshot(&self) -> TerminalStateSnapshot {
        TerminalStateSnapshot {
            schema_version: self.schema_version,
            representation: self.clone(),
        }
    }

    pub fn restore(snapshot: TerminalStateSnapshot) -> Result<Self, TerminalStateRejection> {
        if snapshot.schema_version != S1_02_05_SCHEMA_VERSION {
            return Err(TerminalStateRejection::UnsupportedSnapshotVersion {
                expected: S1_02_05_SCHEMA_VERSION,
                found: snapshot.schema_version,
            });
        }
        let representation = snapshot.representation;
        if representation.work_id != "S1.02.05" || representation.work_package != "WP-002" {
            return Err(TerminalStateRejection::CorruptSnapshot(
                "wrong work identity",
            ));
        }
        if representation.disposition != IdentityDisposition::CandidateOnly {
            return Err(TerminalStateRejection::CorruptSnapshot(
                "S1.02.05 cannot persist committed reality",
            ));
        }
        if representation.operands != OPERANDS
            || representation.changed_fields != CHANGED_FIELDS
            || representation.preserved_fields != PRESERVED_FIELDS
        {
            return Err(TerminalStateRejection::CorruptSnapshot(
                "frozen representation fields changed",
            ));
        }
        required_snapshot_text(&representation.stable_id, "stable_id")?;
        required_snapshot_text(&representation.state_record_id, "state_record_id")?;
        required_snapshot_text(&representation.lineage_reference, "lineage_reference")?;
        required_snapshot_text(&representation.cause_event, "cause_event")?;
        validate_world_time(&representation.world_time)?;
        Ok(representation)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TerminalStateSnapshot {
    pub schema_version: u32,
    pub representation: TerminalStateRepresentation,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TerminalStateRejection {
    MissingField(&'static str),
    EmptyField(&'static str),
    StaleSchemaVersion {
        expected: u32,
        found: u32,
    },
    StaleCreationSchemaVersion {
        expected: u32,
        found: u32,
    },
    PredecessorDigestMismatch {
        expected: u64,
        found: u64,
    },
    StableIdMismatch {
        expected: String,
        found: String,
    },
    LifecycleStateMismatch {
        expected: LifecycleState,
        found: LifecycleState,
    },
    UnsupportedTransition(LifecycleTransition),
    DuplicateStateRecordId(String),
    InvalidRecordVersion {
        expected: u32,
        found: u32,
    },
    MissingPriorRecord,
    UnexpectedPriorRecord,
    PriorRecordMismatch(&'static str),
    PriorRecordClosed,
    ReferenceIntegrityNotVerified(ReferenceIntegrityStatus),
    InvalidWorldTime(&'static str),
    WrongOwner {
        expected: String,
        found: String,
    },
    WrongWriter {
        expected: String,
        found: String,
    },
    UnauthorizedOrigin(IdentityOrigin),
    IncompletePhase(IdentityOperationPhase),
    OutOfScopeSubject(TerminalStateSubject),
    InvalidPredecessor(&'static str),
    InvalidRoot(&'static str),
    UnsupportedSnapshotVersion {
        expected: u32,
        found: u32,
    },
    CorruptSnapshot(&'static str),
}

impl fmt::Display for TerminalStateRejection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingField(field) => write!(f, "missing terminal-state field: {field}"),
            Self::EmptyField(field) => write!(f, "empty terminal-state field: {field}"),
            Self::StaleSchemaVersion { expected, found } => write!(
                f,
                "unsupported S1.02.05 schema version: expected={expected}, found={found}"
            ),
            Self::StaleCreationSchemaVersion { expected, found } => write!(
                f,
                "stale S1.02.04 reference: expected={expected}, found={found}"
            ),
            Self::PredecessorDigestMismatch { expected, found } => write!(
                f,
                "S1.02.04 evidence digest mismatch: expected={expected}, found={found}"
            ),
            Self::StableIdMismatch { expected, found } => {
                write!(f, "stable ID mismatch: expected={expected}, found={found}")
            }
            Self::LifecycleStateMismatch { expected, found } => write!(
                f,
                "lifecycle state mismatch: expected={expected:?}, found={found:?}"
            ),
            Self::UnsupportedTransition(transition) => write!(
                f,
                "transition is not in the supplied source-defined set: {transition:?}"
            ),
            Self::DuplicateStateRecordId(id) => {
                write!(f, "duplicate terminal-state record ID: {id}")
            }
            Self::InvalidRecordVersion { expected, found } => write!(
                f,
                "invalid terminal-state record version: expected={expected}, found={found}"
            ),
            Self::MissingPriorRecord => write!(f, "revision/close requires prior state record"),
            Self::UnexpectedPriorRecord => write!(f, "create must not supply prior state record"),
            Self::PriorRecordMismatch(field) => write!(f, "prior state record mismatch: {field}"),
            Self::PriorRecordClosed => write!(f, "closed terminal-state record cannot be revised"),
            Self::ReferenceIntegrityNotVerified(status) => {
                write!(f, "reference integrity is not verified: {status:?}")
            }
            Self::InvalidWorldTime(field) => {
                write!(f, "invalid WorldTime reference field: {field}")
            }
            Self::WrongOwner { expected, found } => write!(
                f,
                "wrong PA-003 terminal-state owner: expected={expected}, found={found}"
            ),
            Self::WrongWriter { expected, found } => write!(
                f,
                "wrong PA-003 terminal-state writer: expected={expected}, found={found}"
            ),
            Self::UnauthorizedOrigin(origin) => {
                write!(f, "unauthorized terminal-state origin: {origin:?}")
            }
            Self::IncompletePhase(phase) => {
                write!(f, "terminal-state operation is incomplete: {phase:?}")
            }
            Self::OutOfScopeSubject(subject) => {
                write!(f, "out-of-scope terminal-state subject: {subject:?}")
            }
            Self::InvalidPredecessor(reason) => write!(f, "S1.02.04 predecessor invalid: {reason}"),
            Self::InvalidRoot(field) => write!(f, "frozen root mismatch: {field}"),
            Self::UnsupportedSnapshotVersion { expected, found } => write!(
                f,
                "unsupported terminal-state snapshot version: expected={expected}, found={found}"
            ),
            Self::CorruptSnapshot(reason) => write!(f, "corrupt terminal-state snapshot: {reason}"),
        }
    }
}

impl std::error::Error for TerminalStateRejection {}

#[derive(Debug, Clone, Copy, Default)]
pub struct TerminalStateProcessor;

impl TerminalStateProcessor {
    pub fn evaluate(
        &self,
        request: &TerminalStateRequest,
        root: &ValidationReceipt,
        predecessor: &CommittedEntityCreationValidation,
    ) -> Result<TerminalStateRepresentation, TerminalStateRejection> {
        validate_predecessor(root, predecessor)?;

        let stable_id = required_text(request.stable_id.as_deref(), "stable_id")?;
        if stable_id != predecessor.stable_id {
            return Err(TerminalStateRejection::StableIdMismatch {
                expected: predecessor.stable_id.clone(),
                found: stable_id.to_owned(),
            });
        }

        let state_record_id = required_text(request.state_record_id.as_deref(), "state_record_id")?;
        let record_version = request
            .record_version
            .ok_or(TerminalStateRejection::MissingField("record_version"))?;
        let mutation = request
            .mutation
            .ok_or(TerminalStateRejection::MissingField("mutation"))?;
        validate_record_mutation(
            request,
            state_record_id,
            record_version,
            stable_id,
            mutation,
        )?;

        let source_creation_schema_version =
            request
                .source_creation_schema_version
                .ok_or(TerminalStateRejection::MissingField(
                    "source_creation_schema_version",
                ))?;
        if source_creation_schema_version != predecessor.schema_version {
            return Err(TerminalStateRejection::StaleCreationSchemaVersion {
                expected: predecessor.schema_version,
                found: source_creation_schema_version,
            });
        }

        let source_creation_evidence_digest =
            request
                .source_creation_evidence_digest
                .ok_or(TerminalStateRejection::MissingField(
                    "source_creation_evidence_digest",
                ))?;
        let expected_digest = predecessor.evidence_digest64();
        if source_creation_evidence_digest != expected_digest {
            return Err(TerminalStateRejection::PredecessorDigestMismatch {
                expected: expected_digest,
                found: source_creation_evidence_digest,
            });
        }

        let current_lifecycle_state =
            request
                .current_lifecycle_state
                .ok_or(TerminalStateRejection::MissingField(
                    "current_lifecycle_state",
                ))?;
        if current_lifecycle_state != predecessor.lifecycle_state {
            return Err(TerminalStateRejection::LifecycleStateMismatch {
                expected: predecessor.lifecycle_state,
                found: current_lifecycle_state,
            });
        }
        let target_lifecycle_state =
            request
                .target_lifecycle_state
                .ok_or(TerminalStateRejection::MissingField(
                    "target_lifecycle_state",
                ))?;
        let transition = LifecycleTransition {
            from: current_lifecycle_state,
            to: target_lifecycle_state,
        };
        if !request.allowed_transitions.contains(&transition) {
            return Err(TerminalStateRejection::UnsupportedTransition(transition));
        }

        let terminal_state_kind = request
            .terminal_state_kind
            .ok_or(TerminalStateRejection::MissingField("terminal_state_kind"))?;
        let world_time = request
            .world_time
            .clone()
            .ok_or(TerminalStateRejection::MissingField("world_time"))?;
        validate_world_time(&world_time)?;
        let cause_event = required_text(request.cause_event.as_deref(), "cause_event")?;
        let lineage_reference =
            required_text(request.lineage_reference.as_deref(), "lineage_reference")?;
        if let Some(prior) = request.prior_record.as_ref()
            && prior.lineage_reference != lineage_reference
        {
            return Err(TerminalStateRejection::PriorRecordMismatch(
                "lineage_reference",
            ));
        }

        let reference_integrity = request
            .reference_integrity
            .ok_or(TerminalStateRejection::MissingField("reference_integrity"))?;
        if reference_integrity != ReferenceIntegrityStatus::Verified {
            return Err(TerminalStateRejection::ReferenceIntegrityNotVerified(
                reference_integrity,
            ));
        }
        let entity_kind = required_text(request.entity_kind.as_deref(), "entity_kind")?;
        if entity_kind != predecessor.entity_kind {
            return Err(TerminalStateRejection::InvalidPredecessor(
                "entity_kind continuity",
            ));
        }
        let creation_provenance = required_text(
            request.creation_provenance.as_deref(),
            "creation_provenance",
        )?;
        if creation_provenance != predecessor.creation_provenance {
            return Err(TerminalStateRejection::InvalidPredecessor(
                "creation_provenance continuity",
            ));
        }

        let schema_version = request
            .schema_version
            .ok_or(TerminalStateRejection::MissingField("schema_version"))?;
        if schema_version != S1_02_05_SCHEMA_VERSION {
            return Err(TerminalStateRejection::StaleSchemaVersion {
                expected: S1_02_05_SCHEMA_VERSION,
                found: schema_version,
            });
        }
        let owner = required_text(request.owner.as_deref(), "owner")?;
        if owner != S1_02_05_OWNER {
            return Err(TerminalStateRejection::WrongOwner {
                expected: S1_02_05_OWNER.to_owned(),
                found: owner.to_owned(),
            });
        }
        let writer = required_text(request.writer.as_deref(), "writer")?;
        if writer != S1_02_05_OWNER {
            return Err(TerminalStateRejection::WrongWriter {
                expected: S1_02_05_OWNER.to_owned(),
                found: writer.to_owned(),
            });
        }
        let origin = request
            .origin
            .ok_or(TerminalStateRejection::MissingField("origin"))?;
        if origin != IdentityOrigin::OwningResolver {
            return Err(TerminalStateRejection::UnauthorizedOrigin(origin));
        }
        let phase = request
            .phase
            .ok_or(TerminalStateRejection::MissingField("phase"))?;
        if phase != IdentityOperationPhase::Complete {
            return Err(TerminalStateRejection::IncompletePhase(phase));
        }
        let subject = request
            .subject
            .ok_or(TerminalStateRejection::MissingField("subject"))?;
        if subject != TerminalStateSubject::EntityLifecycleState {
            return Err(TerminalStateRejection::OutOfScopeSubject(subject));
        }
        let causal_parent = required_text(request.causal_parent.as_deref(), "causal_parent")?;
        let completion_evidence = required_text(
            request.completion_evidence.as_deref(),
            "completion_evidence",
        )?;

        Ok(TerminalStateRepresentation {
            work_id: "S1.02.05",
            work_package: "WP-002",
            schema_version,
            stable_id: stable_id.to_owned(),
            state_record_id: state_record_id.to_owned(),
            record_version,
            mutation,
            status: if mutation == StateRecordMutation::CloseRecord {
                StateRecordStatus::Closed
            } else {
                StateRecordStatus::Active
            },
            source_creation_schema_version,
            previous_lifecycle_state: current_lifecycle_state,
            candidate_lifecycle_state: target_lifecycle_state,
            validated_transition: transition,
            terminal_state_kind,
            world_time,
            cause_event: cause_event.to_owned(),
            lineage_reference: lineage_reference.to_owned(),
            reference_integrity,
            entity_kind: entity_kind.to_owned(),
            creation_provenance: creation_provenance.to_owned(),
            owner: owner.to_owned(),
            causal_parent: causal_parent.to_owned(),
            completion_evidence: completion_evidence.to_owned(),
            phase,
            disposition: IdentityDisposition::CandidateOnly,
            changed_fields: CHANGED_FIELDS,
            preserved_fields: PRESERVED_FIELDS,
            operands: OPERANDS,
            predecessor_work_id: predecessor.work_id,
            predecessor_work_package: predecessor.work_package,
            predecessor_evidence_digest: expected_digest,
            root_fact_key: root.fact_key.clone(),
            root_contract_version: root.contract_version,
            root_owner: root.owner.clone(),
            root_causal_parent: root.causal_parent.clone(),
        })
    }
}

fn validate_record_mutation(
    request: &TerminalStateRequest,
    state_record_id: &str,
    record_version: u32,
    stable_id: &str,
    mutation: StateRecordMutation,
) -> Result<(), TerminalStateRejection> {
    match mutation {
        StateRecordMutation::Create => {
            if request.prior_record.is_some() {
                return Err(TerminalStateRejection::UnexpectedPriorRecord);
            }
            if record_version != 1 {
                return Err(TerminalStateRejection::InvalidRecordVersion {
                    expected: 1,
                    found: record_version,
                });
            }
            if request
                .existing_state_record_ids
                .iter()
                .any(|existing| existing == state_record_id)
            {
                return Err(TerminalStateRejection::DuplicateStateRecordId(
                    state_record_id.to_owned(),
                ));
            }
        }
        StateRecordMutation::Revise | StateRecordMutation::CloseRecord => {
            let prior = request
                .prior_record
                .as_ref()
                .ok_or(TerminalStateRejection::MissingPriorRecord)?;
            if prior.status == StateRecordStatus::Closed {
                return Err(TerminalStateRejection::PriorRecordClosed);
            }
            if prior.state_record_id != state_record_id {
                return Err(TerminalStateRejection::PriorRecordMismatch(
                    "state_record_id",
                ));
            }
            if prior.stable_id != stable_id {
                return Err(TerminalStateRejection::PriorRecordMismatch("stable_id"));
            }
            let expected_version = prior.record_version.saturating_add(1);
            if record_version != expected_version {
                return Err(TerminalStateRejection::InvalidRecordVersion {
                    expected: expected_version,
                    found: record_version,
                });
            }
        }
    }
    Ok(())
}

fn validate_predecessor(
    root: &ValidationReceipt,
    predecessor: &CommittedEntityCreationValidation,
) -> Result<(), TerminalStateRejection> {
    if predecessor.work_id != "S1.02.04" || predecessor.work_package != "WP-002" {
        return Err(TerminalStateRejection::InvalidPredecessor(
            "wrong work identity",
        ));
    }
    if predecessor.schema_version != S1_02_04_SCHEMA_VERSION {
        return Err(TerminalStateRejection::InvalidPredecessor(
            "unsupported S1.02.04 schema",
        ));
    }
    if predecessor.owner != S1_02_05_OWNER {
        return Err(TerminalStateRejection::InvalidPredecessor("owner mismatch"));
    }
    if predecessor.phase != IdentityOperationPhase::Complete {
        return Err(TerminalStateRejection::InvalidPredecessor(
            "predecessor incomplete",
        ));
    }
    if predecessor.disposition != IdentityDisposition::CandidateOnly {
        return Err(TerminalStateRejection::InvalidPredecessor(
            "predecessor disposition",
        ));
    }
    if predecessor.reference_integrity != ReferenceIntegrityStatus::Verified {
        return Err(TerminalStateRejection::InvalidPredecessor(
            "reference integrity",
        ));
    }
    if predecessor.root_fact_key != root.fact_key {
        return Err(TerminalStateRejection::InvalidRoot("fact_key"));
    }
    if predecessor.root_contract_version != root.contract_version {
        return Err(TerminalStateRejection::InvalidRoot("contract_version"));
    }
    if predecessor.root_owner != root.owner {
        return Err(TerminalStateRejection::InvalidRoot("owner"));
    }
    if predecessor.root_causal_parent != root.causal_parent {
        return Err(TerminalStateRejection::InvalidRoot("causal_parent"));
    }
    Ok(())
}

fn validate_world_time(world_time: &WorldTimeReference) -> Result<(), TerminalStateRejection> {
    if world_time.instant.trim().is_empty() {
        return Err(TerminalStateRejection::InvalidWorldTime("instant"));
    }
    if world_time.unit.trim().is_empty() {
        return Err(TerminalStateRejection::InvalidWorldTime("unit"));
    }
    if world_time.frame.trim().is_empty() {
        return Err(TerminalStateRejection::InvalidWorldTime("frame"));
    }
    if world_time.version == 0 {
        return Err(TerminalStateRejection::InvalidWorldTime("version"));
    }
    Ok(())
}

fn required_text<'a>(
    value: Option<&'a str>,
    field: &'static str,
) -> Result<&'a str, TerminalStateRejection> {
    let value = value.ok_or(TerminalStateRejection::MissingField(field))?;
    if value.trim().is_empty() {
        return Err(TerminalStateRejection::EmptyField(field));
    }
    Ok(value)
}

fn required_snapshot_text(value: &str, field: &'static str) -> Result<(), TerminalStateRejection> {
    if value.trim().is_empty() {
        return Err(TerminalStateRejection::CorruptSnapshot(field));
    }
    Ok(())
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
