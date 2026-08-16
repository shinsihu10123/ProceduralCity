//! Frozen L3 `S1.02.06 Tombstone / Historical Identity Retention`.
//!
//! This crate validates the PA-003 retention boundary for durable historical identity evidence.
//! It consumes the earlier namespace/versioning source and the direct S1.02.05 terminal-state
//! predecessor, but never performs Canonical Commit itself.

use std::fmt;

use gaonn_identity_core::namespace_versioning::{
    NamespaceVersioningOutcome, S1_02_02_SCHEMA_VERSION,
};
use gaonn_identity_core::{IdentityDisposition, IdentityOperationPhase, IdentityOrigin};
use gaonn_retirement_state_core::{
    TerminalStateRepresentation, S1_02_05_OWNER, S1_02_05_SCHEMA_VERSION,
};
use gaonn_world_core::ValidationReceipt;

pub const S1_02_06_SCHEMA_VERSION: u32 = 1;
pub const S1_02_06_OWNER: &str = S1_02_05_OWNER;
const OPERANDS: [&str; 5] = ["Tombstone", "Historical", "Retention", "Stable", "Entity"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CommitMarkerState {
    Pending,
    Committed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum RetentionSegmentStatus {
    Complete,
    Partial,
    Corrupt,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CutReferenceStatus {
    WithinCut,
    OutsideCut,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum RetentionSubject {
    TombstoneHistoricalIdentity,
    ProjectionOnly,
    SimilarNamedOutOfScopeState,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TombstoneRetentionRequest {
    pub stable_id: Option<String>,
    pub namespace: Option<String>,
    pub namespace_version: Option<String>,
    pub lifecycle_lineage: Option<String>,
    pub source_namespace_schema_version: Option<u32>,
    pub source_namespace_evidence_digest: Option<u64>,
    pub source_terminal_schema_version: Option<u32>,
    pub source_terminal_evidence_digest: Option<u64>,
    pub commit_marker: Option<String>,
    pub commit_marker_state: Option<CommitMarkerState>,
    pub causal_cut: Option<String>,
    pub parent_cut: Option<String>,
    pub durable_artifact: Option<String>,
    pub recovery_position: Option<u64>,
    pub replay_reference: Option<String>,
    pub segment_status: Option<RetentionSegmentStatus>,
    pub cut_reference_status: Option<CutReferenceStatus>,
    pub schema_version: Option<u32>,
    pub owner: Option<String>,
    pub writer: Option<String>,
    pub causal_parent: Option<String>,
    pub completion_evidence: Option<String>,
    pub phase: Option<IdentityOperationPhase>,
    pub origin: Option<IdentityOrigin>,
    pub subject: Option<RetentionSubject>,
    pub observation_hint: Option<String>,
}

impl TombstoneRetentionRequest {
    pub fn valid_fixture(
        namespace: &NamespaceVersioningOutcome,
        predecessor: &TerminalStateRepresentation,
    ) -> Self {
        Self {
            stable_id: Some(predecessor.stable_id.clone()),
            namespace: Some(namespace.namespace.clone()),
            namespace_version: Some(namespace.namespace_version.clone()),
            lifecycle_lineage: Some(namespace.lifecycle_lineage.clone()),
            source_namespace_schema_version: Some(namespace.schema_version),
            source_namespace_evidence_digest: Some(namespace.evidence_digest64()),
            source_terminal_schema_version: Some(predecessor.schema_version),
            source_terminal_evidence_digest: Some(predecessor.evidence_digest64()),
            commit_marker: Some("commit-marker:S1.02.05:fixture".to_owned()),
            commit_marker_state: Some(CommitMarkerState::Committed),
            causal_cut: Some("causal-cut:S1.02.05:fixture".to_owned()),
            parent_cut: Some("parent-cut:S1.02.04:fixture".to_owned()),
            durable_artifact: Some("durable-tombstone:fixture:0001".to_owned()),
            recovery_position: Some(1),
            replay_reference: Some("replay:S1.02.06:fixture:0001".to_owned()),
            segment_status: Some(RetentionSegmentStatus::Complete),
            cut_reference_status: Some(CutReferenceStatus::WithinCut),
            schema_version: Some(S1_02_06_SCHEMA_VERSION),
            owner: Some(S1_02_06_OWNER.to_owned()),
            writer: Some(S1_02_06_OWNER.to_owned()),
            causal_parent: Some("WP-002:S1.02.05:PASS".to_owned()),
            completion_evidence: Some("tombstone-retention-boundary-complete".to_owned()),
            phase: Some(IdentityOperationPhase::Complete),
            origin: Some(IdentityOrigin::OwningResolver),
            subject: Some(RetentionSubject::TombstoneHistoricalIdentity),
            observation_hint: Some("observer-retention-looking-value".to_owned()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TombstoneRetentionArtifact {
    pub work_id: &'static str,
    pub work_package: &'static str,
    pub schema_version: u32,
    pub stable_id: String,
    pub namespace: String,
    pub namespace_version: String,
    pub lifecycle_lineage: String,
    pub terminal_lineage_reference: String,
    pub terminal_state_record_id: String,
    pub terminal_state_record_version: u32,
    pub commit_marker: String,
    pub causal_cut: String,
    pub parent_cut: String,
    pub durable_artifact: String,
    pub recovery_position: u64,
    pub replay_reference: String,
    pub segment_status: RetentionSegmentStatus,
    pub cut_reference_status: CutReferenceStatus,
    pub owner: String,
    pub causal_parent: String,
    pub completion_evidence: String,
    pub phase: IdentityOperationPhase,
    pub disposition: IdentityDisposition,
    pub operands: [&'static str; 5],
    pub predecessor_work_id: &'static str,
    pub predecessor_work_package: &'static str,
    pub predecessor_evidence_digest: u64,
    pub namespace_source_work_id: &'static str,
    pub namespace_source_evidence_digest: u64,
    pub root_fact_key: String,
    pub root_contract_version: u32,
    pub root_owner: String,
    pub root_causal_parent: String,
}

impl TombstoneRetentionArtifact {
    pub fn evidence_digest64(&self) -> u64 {
        let encoded = format!(
            "{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{:?}|{:?}|{}|{}|{}|{:?}|{:?}|{:?}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}",
            self.work_id,
            self.work_package,
            self.schema_version,
            self.stable_id,
            self.namespace,
            self.namespace_version,
            self.lifecycle_lineage,
            self.terminal_lineage_reference,
            self.terminal_state_record_id,
            self.terminal_state_record_version,
            self.commit_marker,
            self.causal_cut,
            self.parent_cut,
            self.durable_artifact,
            self.recovery_position,
            self.replay_reference,
            self.segment_status,
            self.cut_reference_status,
            self.owner,
            self.causal_parent,
            self.completion_evidence,
            self.phase,
            self.disposition,
            self.operands,
            self.predecessor_work_id,
            self.predecessor_work_package,
            self.predecessor_evidence_digest,
            self.namespace_source_work_id,
            self.namespace_source_evidence_digest,
            self.root_fact_key,
            self.root_contract_version,
            self.root_owner,
            self.root_causal_parent,
            "S1.02.06-retention",
        );
        fnv1a64(encoded.as_bytes())
    }

    pub fn snapshot(&self) -> TombstoneRetentionSnapshot {
        TombstoneRetentionSnapshot {
            schema_version: self.schema_version,
            artifact: self.clone(),
        }
    }

    pub fn restore(
        snapshot: TombstoneRetentionSnapshot,
    ) -> Result<Self, TombstoneRetentionRejection> {
        if snapshot.schema_version != S1_02_06_SCHEMA_VERSION {
            return Err(TombstoneRetentionRejection::UnsupportedSnapshotVersion {
                expected: S1_02_06_SCHEMA_VERSION,
                found: snapshot.schema_version,
            });
        }
        let artifact = snapshot.artifact;
        if artifact.work_id != "S1.02.06" || artifact.work_package != "WP-002" {
            return Err(TombstoneRetentionRejection::CorruptSnapshot(
                "wrong work identity",
            ));
        }
        if artifact.disposition != IdentityDisposition::CandidateOnly {
            return Err(TombstoneRetentionRejection::CorruptSnapshot(
                "retention evidence cannot persist committed Canonical Reality",
            ));
        }
        if artifact.operands != OPERANDS {
            return Err(TombstoneRetentionRejection::CorruptSnapshot(
                "frozen operands changed",
            ));
        }
        if artifact.segment_status != RetentionSegmentStatus::Complete {
            return Err(TombstoneRetentionRejection::CorruptSnapshot(
                "partial or corrupt segment used as recovery basis",
            ));
        }
        if artifact.cut_reference_status != CutReferenceStatus::WithinCut {
            return Err(TombstoneRetentionRejection::CorruptSnapshot(
                "reference lies outside causal cut",
            ));
        }
        required_snapshot_text(&artifact.stable_id, "stable_id")?;
        required_snapshot_text(&artifact.namespace, "namespace")?;
        required_snapshot_text(&artifact.namespace_version, "namespace_version")?;
        required_snapshot_text(&artifact.lifecycle_lineage, "lifecycle_lineage")?;
        required_snapshot_text(&artifact.commit_marker, "commit_marker")?;
        required_snapshot_text(&artifact.causal_cut, "causal_cut")?;
        required_snapshot_text(&artifact.parent_cut, "parent_cut")?;
        required_snapshot_text(&artifact.durable_artifact, "durable_artifact")?;
        required_snapshot_text(&artifact.replay_reference, "replay_reference")?;
        Ok(artifact)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TombstoneRetentionSnapshot {
    pub schema_version: u32,
    pub artifact: TombstoneRetentionArtifact,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TombstoneRetentionRejection {
    MissingField(&'static str),
    EmptyField(&'static str),
    StaleSchemaVersion { expected: u32, found: u32 },
    StaleNamespaceSchemaVersion { expected: u32, found: u32 },
    StaleTerminalSchemaVersion { expected: u32, found: u32 },
    NamespaceDigestMismatch { expected: u64, found: u64 },
    TerminalDigestMismatch { expected: u64, found: u64 },
    StableIdMismatch { expected: String, found: String },
    NamespaceMismatch { expected: String, found: String },
    NamespaceVersionMismatch { expected: String, found: String },
    LifecycleLineageMismatch { expected: String, found: String },
    CommitMarkerNotCommitted(CommitMarkerState),
    SegmentNotComplete(RetentionSegmentStatus),
    CutOutside(CutReferenceStatus),
    WrongOwner { expected: String, found: String },
    WrongWriter { expected: String, found: String },
    UnauthorizedOrigin(IdentityOrigin),
    IncompletePhase(IdentityOperationPhase),
    OutOfScopeSubject(RetentionSubject),
    InvalidNamespaceSource(&'static str),
    InvalidPredecessor(&'static str),
    InvalidRoot(&'static str),
    UnsupportedSnapshotVersion { expected: u32, found: u32 },
    CorruptSnapshot(&'static str),
}

impl fmt::Display for TombstoneRetentionRejection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingField(field) => write!(f, "missing retention field: {field}"),
            Self::EmptyField(field) => write!(f, "empty retention field: {field}"),
            Self::StaleSchemaVersion { expected, found } => write!(
                f,
                "unsupported S1.02.06 schema version: expected={expected}, found={found}"
            ),
            Self::StaleNamespaceSchemaVersion { expected, found } => write!(
                f,
                "stale S1.02.02 namespace reference: expected={expected}, found={found}"
            ),
            Self::StaleTerminalSchemaVersion { expected, found } => write!(
                f,
                "stale S1.02.05 terminal-state reference: expected={expected}, found={found}"
            ),
            Self::NamespaceDigestMismatch { expected, found } => write!(
                f,
                "S1.02.02 evidence digest mismatch: expected={expected}, found={found}"
            ),
            Self::TerminalDigestMismatch { expected, found } => write!(
                f,
                "S1.02.05 evidence digest mismatch: expected={expected}, found={found}"
            ),
            Self::StableIdMismatch { expected, found } => {
                write!(f, "stable ID mismatch: expected={expected}, found={found}")
            }
            Self::NamespaceMismatch { expected, found } => {
                write!(f, "namespace mismatch: expected={expected}, found={found}")
            }
            Self::NamespaceVersionMismatch { expected, found } => write!(
                f,
                "namespace version mismatch: expected={expected}, found={found}"
            ),
            Self::LifecycleLineageMismatch { expected, found } => write!(
                f,
                "lifecycle lineage mismatch: expected={expected}, found={found}"
            ),
            Self::CommitMarkerNotCommitted(state) => {
                write!(f, "commit marker is not durable: {state:?}")
            }
            Self::SegmentNotComplete(status) => {
                write!(f, "retention segment is not complete: {status:?}")
            }
            Self::CutOutside(status) => {
                write!(f, "retention reference is outside causal cut: {status:?}")
            }
            Self::WrongOwner { expected, found } => write!(
                f,
                "wrong PA-003 retention owner: expected={expected}, found={found}"
            ),
            Self::WrongWriter { expected, found } => write!(
                f,
                "wrong PA-003 retention writer: expected={expected}, found={found}"
            ),
            Self::UnauthorizedOrigin(origin) => {
                write!(f, "unauthorized retention origin: {origin:?}")
            }
            Self::IncompletePhase(phase) => {
                write!(f, "retention operation is incomplete: {phase:?}")
            }
            Self::OutOfScopeSubject(subject) => {
                write!(f, "out-of-scope retention subject: {subject:?}")
            }
            Self::InvalidNamespaceSource(reason) => {
                write!(f, "S1.02.02 namespace source invalid: {reason}")
            }
            Self::InvalidPredecessor(reason) => {
                write!(f, "S1.02.05 predecessor invalid: {reason}")
            }
            Self::InvalidRoot(field) => write!(f, "frozen root mismatch: {field}"),
            Self::UnsupportedSnapshotVersion { expected, found } => write!(
                f,
                "unsupported retention snapshot version: expected={expected}, found={found}"
            ),
            Self::CorruptSnapshot(reason) => {
                write!(f, "corrupt retention snapshot: {reason}")
            }
        }
    }
}

impl std::error::Error for TombstoneRetentionRejection {}

#[derive(Debug, Clone, Copy, Default)]
pub struct TombstoneRetentionProcessor;

impl TombstoneRetentionProcessor {
    pub fn evaluate(
        &self,
        request: &TombstoneRetentionRequest,
        root: &ValidationReceipt,
        namespace: &NamespaceVersioningOutcome,
        predecessor: &TerminalStateRepresentation,
    ) -> Result<TombstoneRetentionArtifact, TombstoneRetentionRejection> {
        validate_sources(root, namespace, predecessor)?;

        let stable_id = required_text(request.stable_id.as_deref(), "stable_id")?;
        if stable_id != predecessor.stable_id || stable_id != namespace.stable_id {
            return Err(TombstoneRetentionRejection::StableIdMismatch {
                expected: predecessor.stable_id.clone(),
                found: stable_id.to_owned(),
            });
        }

        let source_namespace_schema_version = request.source_namespace_schema_version.ok_or(
            TombstoneRetentionRejection::MissingField("source_namespace_schema_version"),
        )?;
        if source_namespace_schema_version != namespace.schema_version {
            return Err(TombstoneRetentionRejection::StaleNamespaceSchemaVersion {
                expected: namespace.schema_version,
                found: source_namespace_schema_version,
            });
        }
        let source_namespace_evidence_digest = request.source_namespace_evidence_digest.ok_or(
            TombstoneRetentionRejection::MissingField("source_namespace_evidence_digest"),
        )?;
        let expected_namespace_digest = namespace.evidence_digest64();
        if source_namespace_evidence_digest != expected_namespace_digest {
            return Err(TombstoneRetentionRejection::NamespaceDigestMismatch {
                expected: expected_namespace_digest,
                found: source_namespace_evidence_digest,
            });
        }

        let source_terminal_schema_version = request.source_terminal_schema_version.ok_or(
            TombstoneRetentionRejection::MissingField("source_terminal_schema_version"),
        )?;
        if source_terminal_schema_version != predecessor.schema_version {
            return Err(TombstoneRetentionRejection::StaleTerminalSchemaVersion {
                expected: predecessor.schema_version,
                found: source_terminal_schema_version,
            });
        }
        let source_terminal_evidence_digest = request.source_terminal_evidence_digest.ok_or(
            TombstoneRetentionRejection::MissingField("source_terminal_evidence_digest"),
        )?;
        let expected_terminal_digest = predecessor.evidence_digest64();
        if source_terminal_evidence_digest != expected_terminal_digest {
            return Err(TombstoneRetentionRejection::TerminalDigestMismatch {
                expected: expected_terminal_digest,
                found: source_terminal_evidence_digest,
            });
        }

        let namespace_value = required_text(request.namespace.as_deref(), "namespace")?;
        if namespace_value != namespace.namespace {
            return Err(TombstoneRetentionRejection::NamespaceMismatch {
                expected: namespace.namespace.clone(),
                found: namespace_value.to_owned(),
            });
        }
        let namespace_version =
            required_text(request.namespace_version.as_deref(), "namespace_version")?;
        if namespace_version != namespace.namespace_version {
            return Err(TombstoneRetentionRejection::NamespaceVersionMismatch {
                expected: namespace.namespace_version.clone(),
                found: namespace_version.to_owned(),
            });
        }
        let lifecycle_lineage =
            required_text(request.lifecycle_lineage.as_deref(), "lifecycle_lineage")?;
        if lifecycle_lineage != namespace.lifecycle_lineage {
            return Err(TombstoneRetentionRejection::LifecycleLineageMismatch {
                expected: namespace.lifecycle_lineage.clone(),
                found: lifecycle_lineage.to_owned(),
            });
        }

        let commit_marker = required_text(request.commit_marker.as_deref(), "commit_marker")?;
        let commit_marker_state = request
            .commit_marker_state
            .ok_or(TombstoneRetentionRejection::MissingField("commit_marker_state"))?;
        if commit_marker_state != CommitMarkerState::Committed {
            return Err(TombstoneRetentionRejection::CommitMarkerNotCommitted(
                commit_marker_state,
            ));
        }
        let causal_cut = required_text(request.causal_cut.as_deref(), "causal_cut")?;
        let parent_cut = required_text(request.parent_cut.as_deref(), "parent_cut")?;
        let durable_artifact =
            required_text(request.durable_artifact.as_deref(), "durable_artifact")?;
        let recovery_position = request
            .recovery_position
            .ok_or(TombstoneRetentionRejection::MissingField("recovery_position"))?;
        let replay_reference =
            required_text(request.replay_reference.as_deref(), "replay_reference")?;

        let segment_status = request
            .segment_status
            .ok_or(TombstoneRetentionRejection::MissingField("segment_status"))?;
        if segment_status != RetentionSegmentStatus::Complete {
            return Err(TombstoneRetentionRejection::SegmentNotComplete(
                segment_status,
            ));
        }
        let cut_reference_status = request.cut_reference_status.ok_or(
            TombstoneRetentionRejection::MissingField("cut_reference_status"),
        )?;
        if cut_reference_status != CutReferenceStatus::WithinCut {
            return Err(TombstoneRetentionRejection::CutOutside(
                cut_reference_status,
            ));
        }

        let schema_version = request
            .schema_version
            .ok_or(TombstoneRetentionRejection::MissingField("schema_version"))?;
        if schema_version != S1_02_06_SCHEMA_VERSION {
            return Err(TombstoneRetentionRejection::StaleSchemaVersion {
                expected: S1_02_06_SCHEMA_VERSION,
                found: schema_version,
            });
        }
        let owner = required_text(request.owner.as_deref(), "owner")?;
        if owner != S1_02_06_OWNER {
            return Err(TombstoneRetentionRejection::WrongOwner {
                expected: S1_02_06_OWNER.to_owned(),
                found: owner.to_owned(),
            });
        }
        let writer = required_text(request.writer.as_deref(), "writer")?;
        if writer != S1_02_06_OWNER {
            return Err(TombstoneRetentionRejection::WrongWriter {
                expected: S1_02_06_OWNER.to_owned(),
                found: writer.to_owned(),
            });
        }
        let origin = request
            .origin
            .ok_or(TombstoneRetentionRejection::MissingField("origin"))?;
        if origin != IdentityOrigin::OwningResolver {
            return Err(TombstoneRetentionRejection::UnauthorizedOrigin(origin));
        }
        let phase = request
            .phase
            .ok_or(TombstoneRetentionRejection::MissingField("phase"))?;
        if phase != IdentityOperationPhase::Complete {
            return Err(TombstoneRetentionRejection::IncompletePhase(phase));
        }
        let subject = request
            .subject
            .ok_or(TombstoneRetentionRejection::MissingField("subject"))?;
        if subject != RetentionSubject::TombstoneHistoricalIdentity {
            return Err(TombstoneRetentionRejection::OutOfScopeSubject(subject));
        }
        let causal_parent = required_text(request.causal_parent.as_deref(), "causal_parent")?;
        let completion_evidence =
            required_text(request.completion_evidence.as_deref(), "completion_evidence")?;

        Ok(TombstoneRetentionArtifact {
            work_id: "S1.02.06",
            work_package: "WP-002",
            schema_version,
            stable_id: stable_id.to_owned(),
            namespace: namespace_value.to_owned(),
            namespace_version: namespace_version.to_owned(),
            lifecycle_lineage: lifecycle_lineage.to_owned(),
            terminal_lineage_reference: predecessor.lineage_reference.clone(),
            terminal_state_record_id: predecessor.state_record_id.clone(),
            terminal_state_record_version: predecessor.record_version,
            commit_marker: commit_marker.to_owned(),
            causal_cut: causal_cut.to_owned(),
            parent_cut: parent_cut.to_owned(),
            durable_artifact: durable_artifact.to_owned(),
            recovery_position,
            replay_reference: replay_reference.to_owned(),
            segment_status,
            cut_reference_status,
            owner: owner.to_owned(),
            causal_parent: causal_parent.to_owned(),
            completion_evidence: completion_evidence.to_owned(),
            phase,
            disposition: IdentityDisposition::CandidateOnly,
            operands: OPERANDS,
            predecessor_work_id: predecessor.work_id,
            predecessor_work_package: predecessor.work_package,
            predecessor_evidence_digest: expected_terminal_digest,
            namespace_source_work_id: namespace.work_id,
            namespace_source_evidence_digest: expected_namespace_digest,
            root_fact_key: root.fact_key.clone(),
            root_contract_version: root.contract_version,
            root_owner: root.owner.clone(),
            root_causal_parent: root.causal_parent.clone(),
        })
    }
}

fn validate_sources(
    root: &ValidationReceipt,
    namespace: &NamespaceVersioningOutcome,
    predecessor: &TerminalStateRepresentation,
) -> Result<(), TombstoneRetentionRejection> {
    if namespace.work_id != "S1.02.02" || namespace.work_package != "WP-002" {
        return Err(TombstoneRetentionRejection::InvalidNamespaceSource(
            "wrong work identity",
        ));
    }
    if namespace.schema_version != S1_02_02_SCHEMA_VERSION {
        return Err(TombstoneRetentionRejection::InvalidNamespaceSource(
            "schema version mismatch",
        ));
    }
    if namespace.phase != IdentityOperationPhase::Complete
        || namespace.disposition != IdentityDisposition::CandidateOnly
    {
        return Err(TombstoneRetentionRejection::InvalidNamespaceSource(
            "source is incomplete or not CandidateOnly",
        ));
    }
    if namespace.owner != S1_02_06_OWNER {
        return Err(TombstoneRetentionRejection::InvalidNamespaceSource(
            "owner mismatch",
        ));
    }

    if predecessor.work_id != "S1.02.05" || predecessor.work_package != "WP-002" {
        return Err(TombstoneRetentionRejection::InvalidPredecessor(
            "wrong work identity",
        ));
    }
    if predecessor.schema_version != S1_02_05_SCHEMA_VERSION {
        return Err(TombstoneRetentionRejection::InvalidPredecessor(
            "schema version mismatch",
        ));
    }
    if predecessor.phase != IdentityOperationPhase::Complete
        || predecessor.disposition != IdentityDisposition::CandidateOnly
    {
        return Err(TombstoneRetentionRejection::InvalidPredecessor(
            "predecessor is incomplete or not CandidateOnly",
        ));
    }
    if predecessor.owner != S1_02_06_OWNER {
        return Err(TombstoneRetentionRejection::InvalidPredecessor(
            "owner mismatch",
        ));
    }
    if predecessor.stable_id != namespace.stable_id {
        return Err(TombstoneRetentionRejection::InvalidPredecessor(
            "stable ID diverged from namespace source",
        ));
    }

    if namespace.root_fact_key != root.fact_key || predecessor.root_fact_key != root.fact_key {
        return Err(TombstoneRetentionRejection::InvalidRoot("fact_key"));
    }
    if namespace.root_contract_version != root.contract_version
        || predecessor.root_contract_version != root.contract_version
    {
        return Err(TombstoneRetentionRejection::InvalidRoot(
            "contract_version",
        ));
    }
    if namespace.root_owner != root.owner || predecessor.root_owner != root.owner {
        return Err(TombstoneRetentionRejection::InvalidRoot("owner"));
    }
    if namespace.root_causal_parent != root.causal_parent
        || predecessor.root_causal_parent != root.causal_parent
    {
        return Err(TombstoneRetentionRejection::InvalidRoot("causal_parent"));
    }
    Ok(())
}

fn required_text<'a>(
    value: Option<&'a str>,
    field: &'static str,
) -> Result<&'a str, TombstoneRetentionRejection> {
    let value = value.ok_or(TombstoneRetentionRejection::MissingField(field))?;
    if value.trim().is_empty() {
        return Err(TombstoneRetentionRejection::EmptyField(field));
    }
    Ok(value)
}

fn required_snapshot_text(
    value: &str,
    field: &'static str,
) -> Result<(), TombstoneRetentionRejection> {
    if value.trim().is_empty() {
        return Err(TombstoneRetentionRejection::CorruptSnapshot(field));
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
