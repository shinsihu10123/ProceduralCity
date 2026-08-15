//! Frozen L3 `S1.02.03 Persistent Lifecycle State Machine`.
//!
//! This crate implements the PA-003 lifecycle transition candidate path. It consumes the
//! S1.02.02 namespace/versioning outcome, validates an explicit current-state/cause/allowed-
//! transition input, and produces causal candidate evidence only. Canonical mutation remains
//! downstream behind Objective Resolution and the designated owner commit path.

use std::fmt;

use gaonn_identity_core::namespace_versioning::{
    NamespaceVersioningOutcome, S1_02_02_OWNER, S1_02_02_SCHEMA_VERSION,
};
use gaonn_identity_core::{IdentityDisposition, IdentityOperationPhase, IdentityOrigin};
use gaonn_world_core::ValidationReceipt;

pub const S1_02_03_SCHEMA_VERSION: u32 = 1;
pub const S1_02_03_OWNER: &str = S1_02_02_OWNER;
const OPERANDS: [&str; 5] = ["Persistent", "Lifecycle", "Machine", "Stable", "Entity"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum LifecycleState {
    Created,
    Active,
    Inactive,
    Terminated,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct LifecycleTransition {
    pub from: LifecycleState,
    pub to: LifecycleState,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PersistentLifecycleRequest {
    pub stable_id: Option<String>,
    pub namespace: Option<String>,
    pub source_namespace_schema_version: Option<u32>,
    pub source_namespace_version: Option<String>,
    pub current_state: Option<LifecycleState>,
    pub target_state: Option<LifecycleState>,
    pub allowed_transitions: Vec<LifecycleTransition>,
    pub cause_event: Option<String>,
    pub lifecycle_lineage: Option<String>,
    pub schema_version: Option<u32>,
    pub owner: Option<String>,
    pub writer: Option<String>,
    pub causal_parent: Option<String>,
    pub completion_evidence: Option<String>,
    pub phase: Option<IdentityOperationPhase>,
    pub origin: Option<IdentityOrigin>,
    pub unrelated_state_hint: Option<String>,
    pub display_name_hint: Option<String>,
}

impl PersistentLifecycleRequest {
    pub fn valid_fixture(namespace: &NamespaceVersioningOutcome) -> Self {
        Self {
            stable_id: Some(namespace.stable_id.clone()),
            namespace: Some(namespace.namespace.clone()),
            source_namespace_schema_version: Some(namespace.schema_version),
            source_namespace_version: Some(namespace.namespace_version.clone()),
            current_state: Some(LifecycleState::Created),
            target_state: Some(LifecycleState::Active),
            allowed_transitions: vec![LifecycleTransition {
                from: LifecycleState::Created,
                to: LifecycleState::Active,
            }],
            cause_event: Some("entity-creation-objective-resolution-passed".to_owned()),
            lifecycle_lineage: Some(namespace.lifecycle_lineage.clone()),
            schema_version: Some(S1_02_03_SCHEMA_VERSION),
            owner: Some(S1_02_03_OWNER.to_owned()),
            writer: Some(S1_02_03_OWNER.to_owned()),
            causal_parent: Some("WP-002:S1.02.02:PASS".to_owned()),
            completion_evidence: Some("persistent-lifecycle-machine-complete".to_owned()),
            phase: Some(IdentityOperationPhase::Complete),
            origin: Some(IdentityOrigin::OwningResolver),
            unrelated_state_hint: Some("renderer-camera-state".to_owned()),
            display_name_hint: Some("non-authoritative-name".to_owned()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PersistentLifecycleOutcome {
    pub work_id: &'static str,
    pub work_package: &'static str,
    pub schema_version: u32,
    pub stable_id: String,
    pub namespace: String,
    pub source_namespace_schema_version: u32,
    pub source_namespace_version: String,
    pub previous_state: LifecycleState,
    pub candidate_state: LifecycleState,
    pub pending_transition: LifecycleTransition,
    pub cause_event: String,
    pub lifecycle_lineage: String,
    pub machine_step: &'static str,
    pub owner: String,
    pub causal_parent: String,
    pub completion_evidence: String,
    pub phase: IdentityOperationPhase,
    pub disposition: IdentityDisposition,
    pub operands: [&'static str; 5],
    pub predecessor_work_id: &'static str,
    pub predecessor_work_package: &'static str,
    pub predecessor_evidence_digest: u64,
    pub root_fact_key: String,
    pub root_contract_version: u32,
    pub root_owner: String,
    pub root_causal_parent: String,
}

impl PersistentLifecycleOutcome {
    pub fn evidence_digest64(&self) -> u64 {
        let encoded = format!(
            "{}|{}|{}|{}|{}|{}|{}|{:?}|{:?}|{:?}|{}|{}|{}|{}|{}|{:?}|{:?}|{:?}|{}|{}|{}|{}|{}|{}|{}",
            self.work_id,
            self.work_package,
            self.schema_version,
            self.stable_id,
            self.namespace,
            self.source_namespace_schema_version,
            self.source_namespace_version,
            self.previous_state,
            self.candidate_state,
            self.pending_transition,
            self.cause_event,
            self.lifecycle_lineage,
            self.machine_step,
            self.owner,
            self.causal_parent,
            self.phase,
            self.disposition,
            self.operands,
            self.predecessor_work_id,
            self.predecessor_work_package,
            self.predecessor_evidence_digest,
            self.root_fact_key,
            self.root_contract_version,
            self.root_owner,
            self.root_causal_parent,
        );
        fnv1a64(format!("{encoded}|{}", self.completion_evidence).as_bytes())
    }

    pub fn snapshot(&self) -> PersistentLifecycleSnapshot {
        PersistentLifecycleSnapshot {
            schema_version: self.schema_version,
            outcome: self.clone(),
        }
    }

    pub fn restore(
        snapshot: PersistentLifecycleSnapshot,
    ) -> Result<Self, PersistentLifecycleRejection> {
        if snapshot.schema_version != S1_02_03_SCHEMA_VERSION {
            return Err(PersistentLifecycleRejection::UnsupportedSnapshotVersion {
                expected: S1_02_03_SCHEMA_VERSION,
                found: snapshot.schema_version,
            });
        }
        let outcome = snapshot.outcome;
        if outcome.work_id != "S1.02.03" || outcome.work_package != "WP-002" {
            return Err(PersistentLifecycleRejection::CorruptSnapshot(
                "wrong work identity",
            ));
        }
        if outcome.disposition != IdentityDisposition::CandidateOnly {
            return Err(PersistentLifecycleRejection::CorruptSnapshot(
                "S1.02.03 cannot persist committed reality",
            ));
        }
        if outcome.operands != OPERANDS {
            return Err(PersistentLifecycleRejection::CorruptSnapshot(
                "frozen operands changed",
            ));
        }
        required_snapshot_text(&outcome.stable_id, "stable_id")?;
        required_snapshot_text(&outcome.namespace, "namespace")?;
        required_snapshot_text(&outcome.cause_event, "cause_event")?;
        required_snapshot_text(&outcome.causal_parent, "causal_parent")?;
        Ok(outcome)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PersistentLifecycleSnapshot {
    pub schema_version: u32,
    pub outcome: PersistentLifecycleOutcome,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PersistentLifecycleRejection {
    MissingField(&'static str),
    EmptyField(&'static str),
    StaleSchemaVersion { expected: u32, found: u32 },
    StaleNamespaceSchemaVersion { expected: u32, found: u32 },
    NamespaceVersionMismatch { expected: String, found: String },
    StableIdMismatch { expected: String, found: String },
    NamespaceMismatch { expected: String, found: String },
    LifecycleLineageMismatch { expected: String, found: String },
    UnsupportedTransition(LifecycleTransition),
    WrongOwner { expected: String, found: String },
    WrongWriter { expected: String, found: String },
    UnauthorizedOrigin(IdentityOrigin),
    IncompletePhase(IdentityOperationPhase),
    InvalidPredecessor(&'static str),
    InvalidRoot(&'static str),
    UnsupportedSnapshotVersion { expected: u32, found: u32 },
    CorruptSnapshot(&'static str),
}

impl fmt::Display for PersistentLifecycleRejection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingField(field) => write!(f, "missing lifecycle field: {field}"),
            Self::EmptyField(field) => write!(f, "empty lifecycle field: {field}"),
            Self::StaleSchemaVersion { expected, found } => write!(
                f,
                "unsupported S1.02.03 schema version: expected={expected}, found={found}"
            ),
            Self::StaleNamespaceSchemaVersion { expected, found } => write!(
                f,
                "stale S1.02.02 schema reference: expected={expected}, found={found}"
            ),
            Self::NamespaceVersionMismatch { expected, found } => write!(
                f,
                "namespace version mismatch: expected={expected}, found={found}"
            ),
            Self::StableIdMismatch { expected, found } => write!(
                f,
                "stable ID changed across S1.02.02→S1.02.03: expected={expected}, found={found}"
            ),
            Self::NamespaceMismatch { expected, found } => write!(
                f,
                "namespace changed across S1.02.02→S1.02.03: expected={expected}, found={found}"
            ),
            Self::LifecycleLineageMismatch { expected, found } => write!(
                f,
                "lifecycle lineage mismatch: expected={expected}, found={found}"
            ),
            Self::UnsupportedTransition(transition) => {
                write!(f, "transition is not in the supplied allowed-transition set: {transition:?}")
            }
            Self::WrongOwner { expected, found } => write!(
                f,
                "wrong PA-003 lifecycle owner: expected={expected}, found={found}"
            ),
            Self::WrongWriter { expected, found } => write!(
                f,
                "wrong PA-003 lifecycle writer: expected={expected}, found={found}"
            ),
            Self::UnauthorizedOrigin(origin) => {
                write!(f, "unauthorized lifecycle origin: {origin:?}")
            }
            Self::IncompletePhase(phase) => {
                write!(f, "lifecycle operation is not complete: {phase:?}")
            }
            Self::InvalidPredecessor(reason) => write!(f, "S1.02.02 predecessor invalid: {reason}"),
            Self::InvalidRoot(field) => write!(f, "frozen root mismatch: {field}"),
            Self::UnsupportedSnapshotVersion { expected, found } => write!(
                f,
                "unsupported lifecycle snapshot version: expected={expected}, found={found}"
            ),
            Self::CorruptSnapshot(reason) => write!(f, "corrupt lifecycle snapshot: {reason}"),
        }
    }
}

impl std::error::Error for PersistentLifecycleRejection {}

#[derive(Debug, Clone, Copy, Default)]
pub struct PersistentLifecycleProcessor;

impl PersistentLifecycleProcessor {
    pub fn evaluate(
        &self,
        request: &PersistentLifecycleRequest,
        root: &ValidationReceipt,
        predecessor: &NamespaceVersioningOutcome,
    ) -> Result<PersistentLifecycleOutcome, PersistentLifecycleRejection> {
        validate_predecessor(root, predecessor)?;

        let stable_id = required_text(request.stable_id.as_deref(), "stable_id")?;
        if stable_id != predecessor.stable_id {
            return Err(PersistentLifecycleRejection::StableIdMismatch {
                expected: predecessor.stable_id.clone(),
                found: stable_id.to_owned(),
            });
        }
        let namespace = required_text(request.namespace.as_deref(), "namespace")?;
        if namespace != predecessor.namespace {
            return Err(PersistentLifecycleRejection::NamespaceMismatch {
                expected: predecessor.namespace.clone(),
                found: namespace.to_owned(),
            });
        }

        let source_namespace_schema_version = request
            .source_namespace_schema_version
            .ok_or(PersistentLifecycleRejection::MissingField(
                "source_namespace_schema_version",
            ))?;
        if source_namespace_schema_version != predecessor.schema_version {
            return Err(PersistentLifecycleRejection::StaleNamespaceSchemaVersion {
                expected: predecessor.schema_version,
                found: source_namespace_schema_version,
            });
        }
        let source_namespace_version = required_text(
            request.source_namespace_version.as_deref(),
            "source_namespace_version",
        )?;
        if source_namespace_version != predecessor.namespace_version {
            return Err(PersistentLifecycleRejection::NamespaceVersionMismatch {
                expected: predecessor.namespace_version.clone(),
                found: source_namespace_version.to_owned(),
            });
        }

        let current_state = request
            .current_state
            .ok_or(PersistentLifecycleRejection::MissingField("current_state"))?;
        let target_state = request
            .target_state
            .ok_or(PersistentLifecycleRejection::MissingField("target_state"))?;
        let pending_transition = LifecycleTransition {
            from: current_state,
            to: target_state,
        };
        if !request.allowed_transitions.contains(&pending_transition) {
            return Err(PersistentLifecycleRejection::UnsupportedTransition(
                pending_transition,
            ));
        }

        let cause_event = required_text(request.cause_event.as_deref(), "cause_event")?;
        let lifecycle_lineage =
            required_text(request.lifecycle_lineage.as_deref(), "lifecycle_lineage")?;
        if lifecycle_lineage != predecessor.lifecycle_lineage {
            return Err(PersistentLifecycleRejection::LifecycleLineageMismatch {
                expected: predecessor.lifecycle_lineage.clone(),
                found: lifecycle_lineage.to_owned(),
            });
        }

        let schema_version = request
            .schema_version
            .ok_or(PersistentLifecycleRejection::MissingField("schema_version"))?;
        if schema_version != S1_02_03_SCHEMA_VERSION {
            return Err(PersistentLifecycleRejection::StaleSchemaVersion {
                expected: S1_02_03_SCHEMA_VERSION,
                found: schema_version,
            });
        }

        let owner = required_text(request.owner.as_deref(), "owner")?;
        if owner != S1_02_03_OWNER {
            return Err(PersistentLifecycleRejection::WrongOwner {
                expected: S1_02_03_OWNER.to_owned(),
                found: owner.to_owned(),
            });
        }
        let writer = required_text(request.writer.as_deref(), "writer")?;
        if writer != S1_02_03_OWNER {
            return Err(PersistentLifecycleRejection::WrongWriter {
                expected: S1_02_03_OWNER.to_owned(),
                found: writer.to_owned(),
            });
        }

        let causal_parent = required_text(request.causal_parent.as_deref(), "causal_parent")?;
        let completion_evidence = required_text(
            request.completion_evidence.as_deref(),
            "completion_evidence",
        )?;
        let phase = request
            .phase
            .ok_or(PersistentLifecycleRejection::MissingField("phase"))?;
        if phase != IdentityOperationPhase::Complete {
            return Err(PersistentLifecycleRejection::IncompletePhase(phase));
        }
        let origin = request
            .origin
            .ok_or(PersistentLifecycleRejection::MissingField("origin"))?;
        if origin != IdentityOrigin::OwningResolver {
            return Err(PersistentLifecycleRejection::UnauthorizedOrigin(origin));
        }

        Ok(PersistentLifecycleOutcome {
            work_id: "S1.02.03",
            work_package: "WP-002",
            schema_version,
            stable_id: stable_id.to_owned(),
            namespace: namespace.to_owned(),
            source_namespace_schema_version,
            source_namespace_version: source_namespace_version.to_owned(),
            previous_state: current_state,
            candidate_state: target_state,
            pending_transition,
            cause_event: cause_event.to_owned(),
            lifecycle_lineage: lifecycle_lineage.to_owned(),
            machine_step: "validate-current-state-cause-and-allowed-transition",
            owner: owner.to_owned(),
            causal_parent: causal_parent.to_owned(),
            completion_evidence: completion_evidence.to_owned(),
            phase,
            disposition: IdentityDisposition::CandidateOnly,
            operands: OPERANDS,
            predecessor_work_id: "S1.02.02",
            predecessor_work_package: "WP-002",
            predecessor_evidence_digest: predecessor.evidence_digest64(),
            root_fact_key: root.fact_key.clone(),
            root_contract_version: root.contract_version,
            root_owner: root.owner.clone(),
            root_causal_parent: root.causal_parent.clone(),
        })
    }
}

fn validate_predecessor(
    root: &ValidationReceipt,
    predecessor: &NamespaceVersioningOutcome,
) -> Result<(), PersistentLifecycleRejection> {
    if predecessor.work_id != "S1.02.02" || predecessor.work_package != "WP-002" {
        return Err(PersistentLifecycleRejection::InvalidPredecessor(
            "wrong work identity",
        ));
    }
    if predecessor.schema_version != S1_02_02_SCHEMA_VERSION {
        return Err(PersistentLifecycleRejection::InvalidPredecessor(
            "unsupported S1.02.02 schema version",
        ));
    }
    if predecessor.owner != S1_02_02_OWNER {
        return Err(PersistentLifecycleRejection::InvalidPredecessor(
            "wrong S1.02.02 owner",
        ));
    }
    if predecessor.disposition != IdentityDisposition::CandidateOnly {
        return Err(PersistentLifecycleRejection::InvalidPredecessor(
            "S1.02.02 output is not candidate-only",
        ));
    }
    if predecessor.phase != IdentityOperationPhase::Complete {
        return Err(PersistentLifecycleRejection::InvalidPredecessor(
            "S1.02.02 is not complete",
        ));
    }
    if predecessor.root_fact_key != root.fact_key {
        return Err(PersistentLifecycleRejection::InvalidRoot("fact_key"));
    }
    if predecessor.root_contract_version != root.contract_version {
        return Err(PersistentLifecycleRejection::InvalidRoot("contract_version"));
    }
    if predecessor.root_owner != root.owner {
        return Err(PersistentLifecycleRejection::InvalidRoot("owner"));
    }
    if predecessor.root_causal_parent != root.causal_parent {
        return Err(PersistentLifecycleRejection::InvalidRoot("causal_parent"));
    }
    Ok(())
}

fn required_text<'a>(
    value: Option<&'a str>,
    field: &'static str,
) -> Result<&'a str, PersistentLifecycleRejection> {
    let value = value.ok_or(PersistentLifecycleRejection::MissingField(field))?;
    if value.trim().is_empty() {
        return Err(PersistentLifecycleRejection::EmptyField(field));
    }
    Ok(value)
}

fn required_snapshot_text(
    value: &str,
    field: &'static str,
) -> Result<(), PersistentLifecycleRejection> {
    if value.trim().is_empty() {
        return Err(PersistentLifecycleRejection::CorruptSnapshot(field));
    }
    Ok(())
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
