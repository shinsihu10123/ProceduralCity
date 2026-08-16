//! Frozen L3 `S1.02.07 Cross-Reference Integrity Contract`.
//!
//! This crate defines a versioned PA-003 contract for stable entity cross-references. It consumes
//! the direct S1.02.06 retention predecessor plus a source-provided target identity snapshot,
//! validates integrity and authority, and returns candidate-only validation evidence. It never
//! performs Canonical Commit and does not pre-implement S1.02.08 snapshot/reload continuity.

use std::fmt;

use gaonn_identity_core::{IdentityDisposition, IdentityOperationPhase, IdentityOrigin};
use gaonn_retention_core::{
    CutReferenceStatus, RetentionSegmentStatus, S1_02_06_OWNER, S1_02_06_SCHEMA_VERSION,
    TombstoneRetentionArtifact,
};
use gaonn_world_core::ValidationReceipt;

pub const S1_02_07_SCHEMA_VERSION: u32 = 1;
pub const S1_02_07_OWNER: &str = S1_02_06_OWNER;
const OPERANDS: [&str; 5] = ["Cross-Reference", "Integrity", "Stable", "Entity", "ID"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CrossReferenceState {
    Pending,
    Active,
    Ended,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct CrossReferenceTransition {
    pub from: CrossReferenceState,
    pub to: CrossReferenceState,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ReferenceTargetState {
    Active,
    Inactive,
    Tombstone,
    Retired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CrossReferenceSubject {
    StableEntityReference,
    ProjectionOnly,
    SimilarNamedOutOfScopeState,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReferenceTargetSnapshot {
    pub stable_id: String,
    pub namespace: String,
    pub namespace_version: String,
    pub entity_version: u32,
    pub lifecycle_lineage: String,
    pub owner: String,
    pub retained: bool,
    pub state: ReferenceTargetState,
    pub evidence_reference: String,
}

impl ReferenceTargetSnapshot {
    pub fn fixture() -> Self {
        Self {
            stable_id: "entity:fixture:target:00000002".to_owned(),
            namespace: "entity".to_owned(),
            namespace_version: "namespace-v1".to_owned(),
            entity_version: 1,
            lifecycle_lineage: "lineage:root:entity:target:00000002".to_owned(),
            owner: S1_02_07_OWNER.to_owned(),
            retained: true,
            state: ReferenceTargetState::Active,
            evidence_reference: "PA-003:target-snapshot:fixture:0002".to_owned(),
        }
    }

    pub fn evidence_digest64(&self) -> u64 {
        let encoded = format!(
            "{}|{}|{}|{}|{}|{}|{}|{:?}|{}",
            self.stable_id,
            self.namespace,
            self.namespace_version,
            self.entity_version,
            self.lifecycle_lineage,
            self.owner,
            self.retained,
            self.state,
            self.evidence_reference,
        );
        fnv1a64(encoded.as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CrossReferenceIntegrityRequest {
    pub reference_id: Option<String>,
    pub reference_version: Option<u32>,
    pub source_stable_id: Option<String>,
    pub target_stable_id: Option<String>,
    pub target_namespace: Option<String>,
    pub target_namespace_version: Option<String>,
    pub target_entity_version: Option<u32>,
    pub target_lifecycle_lineage: Option<String>,
    pub target_owner: Option<String>,
    pub target_evidence_digest: Option<u64>,
    pub source_retention_schema_version: Option<u32>,
    pub source_retention_evidence_digest: Option<u64>,
    pub current_state: Option<CrossReferenceState>,
    pub target_state: Option<CrossReferenceState>,
    pub allowed_transitions: Vec<CrossReferenceTransition>,
    pub schema_version: Option<u32>,
    pub owner: Option<String>,
    pub writer: Option<String>,
    pub causal_parent: Option<String>,
    pub completion_evidence: Option<String>,
    pub phase: Option<IdentityOperationPhase>,
    pub origin: Option<IdentityOrigin>,
    pub subject: Option<CrossReferenceSubject>,
    pub observation_hint: Option<String>,
}

impl CrossReferenceIntegrityRequest {
    pub fn valid_fixture(
        predecessor: &TombstoneRetentionArtifact,
        target: &ReferenceTargetSnapshot,
    ) -> Self {
        let transition = CrossReferenceTransition {
            from: CrossReferenceState::Pending,
            to: CrossReferenceState::Active,
        };
        Self {
            reference_id: Some("cross-reference:fixture:0001".to_owned()),
            reference_version: Some(1),
            source_stable_id: Some(predecessor.stable_id.clone()),
            target_stable_id: Some(target.stable_id.clone()),
            target_namespace: Some(target.namespace.clone()),
            target_namespace_version: Some(target.namespace_version.clone()),
            target_entity_version: Some(target.entity_version),
            target_lifecycle_lineage: Some(target.lifecycle_lineage.clone()),
            target_owner: Some(target.owner.clone()),
            target_evidence_digest: Some(target.evidence_digest64()),
            source_retention_schema_version: Some(predecessor.schema_version),
            source_retention_evidence_digest: Some(predecessor.evidence_digest64()),
            current_state: Some(transition.from),
            target_state: Some(transition.to),
            allowed_transitions: vec![transition],
            schema_version: Some(S1_02_07_SCHEMA_VERSION),
            owner: Some(S1_02_07_OWNER.to_owned()),
            writer: Some(S1_02_07_OWNER.to_owned()),
            causal_parent: Some("WP-002:S1.02.06:PASS".to_owned()),
            completion_evidence: Some("cross-reference-integrity-contract-complete".to_owned()),
            phase: Some(IdentityOperationPhase::Complete),
            origin: Some(IdentityOrigin::OwningResolver),
            subject: Some(CrossReferenceSubject::StableEntityReference),
            observation_hint: Some("observer-cross-reference-looking-value".to_owned()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CrossReferenceIntegrityValidation {
    pub work_id: &'static str,
    pub work_package: &'static str,
    pub schema_version: u32,
    pub reference_id: String,
    pub reference_version: u32,
    pub source_stable_id: String,
    pub target_stable_id: String,
    pub target_namespace: String,
    pub target_namespace_version: String,
    pub target_entity_version: u32,
    pub target_lifecycle_lineage: String,
    pub target_state: ReferenceTargetState,
    pub validated_transition: CrossReferenceTransition,
    pub owner: String,
    pub causal_parent: String,
    pub completion_evidence: String,
    pub phase: IdentityOperationPhase,
    pub disposition: IdentityDisposition,
    pub operands: [&'static str; 5],
    pub predecessor_work_id: &'static str,
    pub predecessor_work_package: &'static str,
    pub predecessor_evidence_digest: u64,
    pub target_evidence_digest: u64,
    pub root_fact_key: String,
    pub root_contract_version: u32,
    pub root_owner: String,
    pub root_causal_parent: String,
}

impl CrossReferenceIntegrityValidation {
    pub fn evidence_digest64(&self) -> u64 {
        let encoded = format!(
            "{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{:?}|{:?}|{}|{}|{}|{:?}|{:?}|{:?}|{}|{}|{}|{}|{}|{}|{}|{}",
            self.work_id,
            self.work_package,
            self.schema_version,
            self.reference_id,
            self.reference_version,
            self.source_stable_id,
            self.target_stable_id,
            self.target_namespace,
            self.target_namespace_version,
            self.target_entity_version,
            self.target_lifecycle_lineage,
            self.target_state,
            self.validated_transition,
            self.owner,
            self.causal_parent,
            self.completion_evidence,
            self.phase,
            self.disposition,
            self.operands,
            self.predecessor_work_id,
            self.predecessor_work_package,
            self.predecessor_evidence_digest,
            self.target_evidence_digest,
            self.root_fact_key,
            self.root_contract_version,
            self.root_owner,
            self.root_causal_parent,
        );
        fnv1a64(encoded.as_bytes())
    }

    pub fn snapshot(&self) -> CrossReferenceIntegritySnapshot {
        CrossReferenceIntegritySnapshot {
            schema_version: self.schema_version,
            validation: self.clone(),
        }
    }

    pub fn restore(
        snapshot: CrossReferenceIntegritySnapshot,
    ) -> Result<Self, CrossReferenceIntegrityRejection> {
        if snapshot.schema_version != S1_02_07_SCHEMA_VERSION {
            return Err(
                CrossReferenceIntegrityRejection::UnsupportedSnapshotVersion {
                    expected: S1_02_07_SCHEMA_VERSION,
                    found: snapshot.schema_version,
                },
            );
        }
        let validation = snapshot.validation;
        if validation.work_id != "S1.02.07" || validation.work_package != "WP-002" {
            return Err(CrossReferenceIntegrityRejection::CorruptSnapshot(
                "wrong work identity",
            ));
        }
        if validation.disposition != IdentityDisposition::CandidateOnly {
            return Err(CrossReferenceIntegrityRejection::CorruptSnapshot(
                "contract validation cannot persist committed Canonical Reality",
            ));
        }
        if validation.operands != OPERANDS {
            return Err(CrossReferenceIntegrityRejection::CorruptSnapshot(
                "frozen operands changed",
            ));
        }
        required_snapshot_text(&validation.reference_id, "reference_id")?;
        required_snapshot_text(&validation.source_stable_id, "source_stable_id")?;
        required_snapshot_text(&validation.target_stable_id, "target_stable_id")?;
        required_snapshot_text(&validation.target_namespace, "target_namespace")?;
        required_snapshot_text(
            &validation.target_namespace_version,
            "target_namespace_version",
        )?;
        required_snapshot_text(
            &validation.target_lifecycle_lineage,
            "target_lifecycle_lineage",
        )?;
        required_snapshot_text(&validation.causal_parent, "causal_parent")?;
        Ok(validation)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CrossReferenceIntegritySnapshot {
    pub schema_version: u32,
    pub validation: CrossReferenceIntegrityValidation,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CrossReferenceIntegrityRejection {
    MissingField(&'static str),
    EmptyField(&'static str),
    StaleSchemaVersion { expected: u32, found: u32 },
    StaleRetentionSchemaVersion { expected: u32, found: u32 },
    RetentionDigestMismatch { expected: u64, found: u64 },
    TargetDigestMismatch { expected: u64, found: u64 },
    SourceStableIdMismatch { expected: String, found: String },
    TargetFieldMismatch(&'static str),
    TargetNotRetained,
    WrongTargetOwner { expected: String, found: String },
    ProhibitedTransition(CrossReferenceTransition),
    WrongOwner { expected: String, found: String },
    WrongWriter { expected: String, found: String },
    UnauthorizedOrigin(IdentityOrigin),
    IncompletePhase(IdentityOperationPhase),
    OutOfScopeSubject(CrossReferenceSubject),
    InvalidPredecessor(&'static str),
    InvalidRoot(&'static str),
    UnsupportedSnapshotVersion { expected: u32, found: u32 },
    CorruptSnapshot(&'static str),
}

impl fmt::Display for CrossReferenceIntegrityRejection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingField(field) => write!(f, "missing cross-reference field: {field}"),
            Self::EmptyField(field) => write!(f, "empty cross-reference field: {field}"),
            Self::StaleSchemaVersion { expected, found } => write!(
                f,
                "unsupported S1.02.07 schema version: expected={expected}, found={found}"
            ),
            Self::StaleRetentionSchemaVersion { expected, found } => write!(
                f,
                "stale S1.02.06 retention reference: expected={expected}, found={found}"
            ),
            Self::RetentionDigestMismatch { expected, found } => write!(
                f,
                "S1.02.06 evidence digest mismatch: expected={expected}, found={found}"
            ),
            Self::TargetDigestMismatch { expected, found } => write!(
                f,
                "target identity evidence digest mismatch: expected={expected}, found={found}"
            ),
            Self::SourceStableIdMismatch { expected, found } => write!(
                f,
                "source stable ID mismatch: expected={expected}, found={found}"
            ),
            Self::TargetFieldMismatch(field) => {
                write!(f, "target identity field mismatch: {field}")
            }
            Self::TargetNotRetained => write!(f, "target identity is dangling or not retained"),
            Self::WrongTargetOwner { expected, found } => write!(
                f,
                "wrong PA-003 target owner: expected={expected}, found={found}"
            ),
            Self::ProhibitedTransition(transition) => write!(
                f,
                "cross-reference transition is not source-authorized: {transition:?}"
            ),
            Self::WrongOwner { expected, found } => write!(
                f,
                "wrong PA-003 contract owner: expected={expected}, found={found}"
            ),
            Self::WrongWriter { expected, found } => write!(
                f,
                "wrong PA-003 contract writer: expected={expected}, found={found}"
            ),
            Self::UnauthorizedOrigin(origin) => {
                write!(f, "unauthorized cross-reference origin: {origin:?}")
            }
            Self::IncompletePhase(phase) => {
                write!(
                    f,
                    "cross-reference contract operation is incomplete: {phase:?}"
                )
            }
            Self::OutOfScopeSubject(subject) => {
                write!(f, "out-of-scope cross-reference subject: {subject:?}")
            }
            Self::InvalidPredecessor(reason) => {
                write!(f, "S1.02.06 predecessor invalid: {reason}")
            }
            Self::InvalidRoot(field) => write!(f, "frozen root mismatch: {field}"),
            Self::UnsupportedSnapshotVersion { expected, found } => write!(
                f,
                "unsupported cross-reference snapshot version: expected={expected}, found={found}"
            ),
            Self::CorruptSnapshot(reason) => {
                write!(f, "corrupt cross-reference snapshot: {reason}")
            }
        }
    }
}

impl std::error::Error for CrossReferenceIntegrityRejection {}

#[derive(Debug, Clone, Copy, Default)]
pub struct CrossReferenceIntegrityContract;

impl CrossReferenceIntegrityContract {
    pub fn validate(
        &self,
        request: &CrossReferenceIntegrityRequest,
        root: &ValidationReceipt,
        predecessor: &TombstoneRetentionArtifact,
        target: &ReferenceTargetSnapshot,
    ) -> Result<CrossReferenceIntegrityValidation, CrossReferenceIntegrityRejection> {
        validate_predecessor(root, predecessor)?;
        validate_target(target)?;

        let schema_version =
            request
                .schema_version
                .ok_or(CrossReferenceIntegrityRejection::MissingField(
                    "schema_version",
                ))?;
        if schema_version != S1_02_07_SCHEMA_VERSION {
            return Err(CrossReferenceIntegrityRejection::StaleSchemaVersion {
                expected: S1_02_07_SCHEMA_VERSION,
                found: schema_version,
            });
        }

        let source_retention_schema_version = request.source_retention_schema_version.ok_or(
            CrossReferenceIntegrityRejection::MissingField("source_retention_schema_version"),
        )?;
        if source_retention_schema_version != S1_02_06_SCHEMA_VERSION {
            return Err(
                CrossReferenceIntegrityRejection::StaleRetentionSchemaVersion {
                    expected: S1_02_06_SCHEMA_VERSION,
                    found: source_retention_schema_version,
                },
            );
        }
        let source_retention_evidence_digest = request.source_retention_evidence_digest.ok_or(
            CrossReferenceIntegrityRejection::MissingField("source_retention_evidence_digest"),
        )?;
        let predecessor_digest = predecessor.evidence_digest64();
        if source_retention_evidence_digest != predecessor_digest {
            return Err(CrossReferenceIntegrityRejection::RetentionDigestMismatch {
                expected: predecessor_digest,
                found: source_retention_evidence_digest,
            });
        }

        let target_evidence_digest = request.target_evidence_digest.ok_or(
            CrossReferenceIntegrityRejection::MissingField("target_evidence_digest"),
        )?;
        let actual_target_digest = target.evidence_digest64();
        if target_evidence_digest != actual_target_digest {
            return Err(CrossReferenceIntegrityRejection::TargetDigestMismatch {
                expected: actual_target_digest,
                found: target_evidence_digest,
            });
        }

        let reference_id = required_text(request.reference_id.as_deref(), "reference_id")?;
        let reference_version =
            request
                .reference_version
                .ok_or(CrossReferenceIntegrityRejection::MissingField(
                    "reference_version",
                ))?;
        let source_stable_id =
            required_text(request.source_stable_id.as_deref(), "source_stable_id")?;
        if source_stable_id != predecessor.stable_id {
            return Err(CrossReferenceIntegrityRejection::SourceStableIdMismatch {
                expected: predecessor.stable_id.clone(),
                found: source_stable_id.to_owned(),
            });
        }

        let target_stable_id =
            required_text(request.target_stable_id.as_deref(), "target_stable_id")?;
        let target_namespace =
            required_text(request.target_namespace.as_deref(), "target_namespace")?;
        let target_namespace_version = required_text(
            request.target_namespace_version.as_deref(),
            "target_namespace_version",
        )?;
        let target_entity_version =
            request
                .target_entity_version
                .ok_or(CrossReferenceIntegrityRejection::MissingField(
                    "target_entity_version",
                ))?;
        let target_lifecycle_lineage = required_text(
            request.target_lifecycle_lineage.as_deref(),
            "target_lifecycle_lineage",
        )?;
        let target_owner = required_text(request.target_owner.as_deref(), "target_owner")?;

        if target_stable_id != target.stable_id {
            return Err(CrossReferenceIntegrityRejection::TargetFieldMismatch(
                "stable_id",
            ));
        }
        if target_namespace != target.namespace {
            return Err(CrossReferenceIntegrityRejection::TargetFieldMismatch(
                "namespace",
            ));
        }
        if target_namespace_version != target.namespace_version {
            return Err(CrossReferenceIntegrityRejection::TargetFieldMismatch(
                "namespace_version",
            ));
        }
        if target_entity_version != target.entity_version {
            return Err(CrossReferenceIntegrityRejection::TargetFieldMismatch(
                "entity_version",
            ));
        }
        if target_lifecycle_lineage != target.lifecycle_lineage {
            return Err(CrossReferenceIntegrityRejection::TargetFieldMismatch(
                "lifecycle_lineage",
            ));
        }
        if target_owner != target.owner {
            return Err(CrossReferenceIntegrityRejection::TargetFieldMismatch(
                "owner",
            ));
        }

        let current_state =
            request
                .current_state
                .ok_or(CrossReferenceIntegrityRejection::MissingField(
                    "current_state",
                ))?;
        let next_state =
            request
                .target_state
                .ok_or(CrossReferenceIntegrityRejection::MissingField(
                    "target_state",
                ))?;
        let transition = CrossReferenceTransition {
            from: current_state,
            to: next_state,
        };
        if !request.allowed_transitions.contains(&transition) {
            return Err(CrossReferenceIntegrityRejection::ProhibitedTransition(
                transition,
            ));
        }

        let owner = required_text(request.owner.as_deref(), "owner")?;
        if owner != S1_02_07_OWNER {
            return Err(CrossReferenceIntegrityRejection::WrongOwner {
                expected: S1_02_07_OWNER.to_owned(),
                found: owner.to_owned(),
            });
        }
        let writer = required_text(request.writer.as_deref(), "writer")?;
        if writer != owner {
            return Err(CrossReferenceIntegrityRejection::WrongWriter {
                expected: owner.to_owned(),
                found: writer.to_owned(),
            });
        }
        let origin = request
            .origin
            .ok_or(CrossReferenceIntegrityRejection::MissingField("origin"))?;
        if origin != IdentityOrigin::OwningResolver {
            return Err(CrossReferenceIntegrityRejection::UnauthorizedOrigin(origin));
        }
        let phase = request
            .phase
            .ok_or(CrossReferenceIntegrityRejection::MissingField("phase"))?;
        if phase != IdentityOperationPhase::Complete {
            return Err(CrossReferenceIntegrityRejection::IncompletePhase(phase));
        }
        let subject = request
            .subject
            .ok_or(CrossReferenceIntegrityRejection::MissingField("subject"))?;
        if subject != CrossReferenceSubject::StableEntityReference {
            return Err(CrossReferenceIntegrityRejection::OutOfScopeSubject(subject));
        }
        let causal_parent = required_text(request.causal_parent.as_deref(), "causal_parent")?;
        let completion_evidence = required_text(
            request.completion_evidence.as_deref(),
            "completion_evidence",
        )?;

        Ok(CrossReferenceIntegrityValidation {
            work_id: "S1.02.07",
            work_package: "WP-002",
            schema_version,
            reference_id: reference_id.to_owned(),
            reference_version,
            source_stable_id: source_stable_id.to_owned(),
            target_stable_id: target_stable_id.to_owned(),
            target_namespace: target_namespace.to_owned(),
            target_namespace_version: target_namespace_version.to_owned(),
            target_entity_version,
            target_lifecycle_lineage: target_lifecycle_lineage.to_owned(),
            target_state: target.state,
            validated_transition: transition,
            owner: owner.to_owned(),
            causal_parent: causal_parent.to_owned(),
            completion_evidence: completion_evidence.to_owned(),
            phase,
            disposition: IdentityDisposition::CandidateOnly,
            operands: OPERANDS,
            predecessor_work_id: predecessor.work_id,
            predecessor_work_package: predecessor.work_package,
            predecessor_evidence_digest: predecessor_digest,
            target_evidence_digest: actual_target_digest,
            root_fact_key: root.fact_key.clone(),
            root_contract_version: root.contract_version,
            root_owner: root.owner.clone(),
            root_causal_parent: root.causal_parent.clone(),
        })
    }
}

fn validate_target(
    target: &ReferenceTargetSnapshot,
) -> Result<(), CrossReferenceIntegrityRejection> {
    required_snapshot_text(&target.stable_id, "target.stable_id")?;
    required_snapshot_text(&target.namespace, "target.namespace")?;
    required_snapshot_text(&target.namespace_version, "target.namespace_version")?;
    required_snapshot_text(&target.lifecycle_lineage, "target.lifecycle_lineage")?;
    required_snapshot_text(&target.owner, "target.owner")?;
    required_snapshot_text(&target.evidence_reference, "target.evidence_reference")?;
    if !target.retained {
        return Err(CrossReferenceIntegrityRejection::TargetNotRetained);
    }
    if target.owner != S1_02_07_OWNER {
        return Err(CrossReferenceIntegrityRejection::WrongTargetOwner {
            expected: S1_02_07_OWNER.to_owned(),
            found: target.owner.clone(),
        });
    }
    Ok(())
}

fn validate_predecessor(
    root: &ValidationReceipt,
    predecessor: &TombstoneRetentionArtifact,
) -> Result<(), CrossReferenceIntegrityRejection> {
    if predecessor.work_id != "S1.02.06" || predecessor.work_package != "WP-002" {
        return Err(CrossReferenceIntegrityRejection::InvalidPredecessor(
            "wrong work identity",
        ));
    }
    if predecessor.schema_version != S1_02_06_SCHEMA_VERSION {
        return Err(CrossReferenceIntegrityRejection::InvalidPredecessor(
            "wrong schema version",
        ));
    }
    if predecessor.owner != S1_02_07_OWNER {
        return Err(CrossReferenceIntegrityRejection::InvalidPredecessor(
            "wrong PA-003 owner",
        ));
    }
    if predecessor.phase != IdentityOperationPhase::Complete {
        return Err(CrossReferenceIntegrityRejection::InvalidPredecessor(
            "predecessor incomplete",
        ));
    }
    if predecessor.disposition != IdentityDisposition::CandidateOnly {
        return Err(CrossReferenceIntegrityRejection::InvalidPredecessor(
            "predecessor disposition bypassed candidate boundary",
        ));
    }
    if predecessor.segment_status != RetentionSegmentStatus::Complete {
        return Err(CrossReferenceIntegrityRejection::InvalidPredecessor(
            "predecessor retention segment incomplete",
        ));
    }
    if predecessor.cut_reference_status != CutReferenceStatus::WithinCut {
        return Err(CrossReferenceIntegrityRejection::InvalidPredecessor(
            "predecessor reference outside causal cut",
        ));
    }
    if predecessor.root_fact_key != root.fact_key {
        return Err(CrossReferenceIntegrityRejection::InvalidRoot("fact_key"));
    }
    if predecessor.root_contract_version != root.contract_version {
        return Err(CrossReferenceIntegrityRejection::InvalidRoot(
            "contract_version",
        ));
    }
    if predecessor.root_owner != root.owner {
        return Err(CrossReferenceIntegrityRejection::InvalidRoot("owner"));
    }
    if predecessor.root_causal_parent != root.causal_parent {
        return Err(CrossReferenceIntegrityRejection::InvalidRoot(
            "causal_parent",
        ));
    }
    required_snapshot_text(&predecessor.stable_id, "predecessor.stable_id")?;
    required_snapshot_text(&predecessor.causal_parent, "predecessor.causal_parent")?;
    required_snapshot_text(
        &predecessor.completion_evidence,
        "predecessor.completion_evidence",
    )?;
    Ok(())
}

fn required_text<'a>(
    value: Option<&'a str>,
    field: &'static str,
) -> Result<&'a str, CrossReferenceIntegrityRejection> {
    let value = value.ok_or(CrossReferenceIntegrityRejection::MissingField(field))?;
    if value.trim().is_empty() {
        return Err(CrossReferenceIntegrityRejection::EmptyField(field));
    }
    Ok(value)
}

fn required_snapshot_text(
    value: &str,
    field: &'static str,
) -> Result<(), CrossReferenceIntegrityRejection> {
    if value.trim().is_empty() {
        return Err(CrossReferenceIntegrityRejection::CorruptSnapshot(field));
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
