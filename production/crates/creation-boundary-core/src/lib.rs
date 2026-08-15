//! Frozen L3 `S1.02.04 Committed Entity Creation Boundary`.
//!
//! This crate implements the PA-003 creation-boundary contract. It validates whether the
//! S1.02.03 lifecycle candidate is eligible to cross the committed-entity-creation boundary.
//! A successful result is validation evidence only; it does not perform Canonical Commit.

use std::fmt;

use gaonn_identity_core::{IdentityDisposition, IdentityOperationPhase, IdentityOrigin};
use gaonn_lifecycle_core::{
    LifecycleState, LifecycleTransition, PersistentLifecycleOutcome, S1_02_03_OWNER,
    S1_02_03_SCHEMA_VERSION,
};
use gaonn_world_core::ValidationReceipt;

pub const S1_02_04_SCHEMA_VERSION: u32 = 1;
pub const S1_02_04_OWNER: &str = S1_02_03_OWNER;
const OPERANDS: [&str; 5] = ["Committed", "Entity", "Creation", "Stable", "ID"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReferenceIntegrityStatus {
    Verified,
    Unverified,
    Dangling,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CreationBoundarySubject {
    CommittedEntityCreation,
    ProjectionOnly,
    SimilarNamedOutOfScopeState,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommittedEntityCreationRequest {
    pub stable_id: Option<String>,
    pub source_lifecycle_schema_version: Option<u32>,
    pub source_lifecycle_evidence_digest: Option<u64>,
    pub lifecycle_state: Option<LifecycleState>,
    pub allowed_creation_transition: Option<LifecycleTransition>,
    pub reference_integrity: Option<ReferenceIntegrityStatus>,
    pub reference_integrity_evidence: Option<String>,
    pub entity_kind: Option<String>,
    pub creation_provenance: Option<String>,
    pub schema_version: Option<u32>,
    pub owner: Option<String>,
    pub writer: Option<String>,
    pub causal_parent: Option<String>,
    pub completion_evidence: Option<String>,
    pub phase: Option<IdentityOperationPhase>,
    pub origin: Option<IdentityOrigin>,
    pub boundary_subject: Option<CreationBoundarySubject>,
    pub display_name_hint: Option<String>,
    pub renderer_hint: Option<String>,
}

impl CommittedEntityCreationRequest {
    pub fn valid_fixture(predecessor: &PersistentLifecycleOutcome) -> Self {
        Self {
            stable_id: Some(predecessor.stable_id.clone()),
            source_lifecycle_schema_version: Some(predecessor.schema_version),
            source_lifecycle_evidence_digest: Some(predecessor.evidence_digest64()),
            lifecycle_state: Some(predecessor.candidate_state),
            allowed_creation_transition: Some(predecessor.pending_transition),
            reference_integrity: Some(ReferenceIntegrityStatus::Verified),
            reference_integrity_evidence: Some("entity-refs:verified".to_owned()),
            entity_kind: Some("persistent-entity".to_owned()),
            creation_provenance: Some("creation-candidate:S1.02.03".to_owned()),
            schema_version: Some(S1_02_04_SCHEMA_VERSION),
            owner: Some(S1_02_04_OWNER.to_owned()),
            writer: Some(S1_02_04_OWNER.to_owned()),
            causal_parent: Some("WP-002:S1.02.03:PASS".to_owned()),
            completion_evidence: Some("committed-entity-creation-boundary-valid".to_owned()),
            phase: Some(IdentityOperationPhase::Complete),
            origin: Some(IdentityOrigin::OwningResolver),
            boundary_subject: Some(CreationBoundarySubject::CommittedEntityCreation),
            display_name_hint: Some("non-authoritative-name".to_owned()),
            renderer_hint: Some("camera-visible".to_owned()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommittedEntityCreationValidation {
    pub work_id: &'static str,
    pub work_package: &'static str,
    pub schema_version: u32,
    pub stable_id: String,
    pub source_lifecycle_schema_version: u32,
    pub lifecycle_state: LifecycleState,
    pub validated_transition: LifecycleTransition,
    pub reference_integrity: ReferenceIntegrityStatus,
    pub reference_integrity_evidence: String,
    pub entity_kind: String,
    pub creation_provenance: String,
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

impl CommittedEntityCreationValidation {
    pub fn evidence_digest64(&self) -> u64 {
        let encoded = format!(
            "{}|{}|{}|{}|{}|{:?}|{:?}|{:?}|{}|{}|{}|{}|{}|{}|{:?}|{:?}|{:?}|{}|{}|{}|{}|{}|{}|{}",
            self.work_id,
            self.work_package,
            self.schema_version,
            self.stable_id,
            self.source_lifecycle_schema_version,
            self.lifecycle_state,
            self.validated_transition,
            self.reference_integrity,
            self.reference_integrity_evidence,
            self.entity_kind,
            self.creation_provenance,
            self.owner,
            self.causal_parent,
            self.completion_evidence,
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
        fnv1a64(encoded.as_bytes())
    }

    pub fn snapshot(&self) -> CommittedEntityCreationSnapshot {
        CommittedEntityCreationSnapshot {
            schema_version: self.schema_version,
            validation: self.clone(),
        }
    }

    pub fn restore(
        snapshot: CommittedEntityCreationSnapshot,
    ) -> Result<Self, CommittedEntityCreationRejection> {
        if snapshot.schema_version != S1_02_04_SCHEMA_VERSION {
            return Err(
                CommittedEntityCreationRejection::UnsupportedSnapshotVersion {
                    expected: S1_02_04_SCHEMA_VERSION,
                    found: snapshot.schema_version,
                },
            );
        }
        let validation = snapshot.validation;
        if validation.work_id != "S1.02.04" || validation.work_package != "WP-002" {
            return Err(CommittedEntityCreationRejection::CorruptSnapshot(
                "wrong work identity",
            ));
        }
        if validation.disposition != IdentityDisposition::CandidateOnly {
            return Err(CommittedEntityCreationRejection::CorruptSnapshot(
                "boundary validation cannot persist committed reality",
            ));
        }
        if validation.operands != OPERANDS {
            return Err(CommittedEntityCreationRejection::CorruptSnapshot(
                "frozen operands changed",
            ));
        }
        if validation.reference_integrity != ReferenceIntegrityStatus::Verified {
            return Err(CommittedEntityCreationRejection::CorruptSnapshot(
                "reference integrity is not verified",
            ));
        }
        required_snapshot_text(&validation.stable_id, "stable_id")?;
        required_snapshot_text(
            &validation.reference_integrity_evidence,
            "reference_integrity_evidence",
        )?;
        required_snapshot_text(&validation.causal_parent, "causal_parent")?;
        Ok(validation)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommittedEntityCreationSnapshot {
    pub schema_version: u32,
    pub validation: CommittedEntityCreationValidation,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommittedEntityCreationRejection {
    MissingField(&'static str),
    EmptyField(&'static str),
    StaleSchemaVersion {
        expected: u32,
        found: u32,
    },
    StaleLifecycleSchemaVersion {
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
    TransitionMismatch {
        expected: LifecycleTransition,
        found: LifecycleTransition,
    },
    ReferenceIntegrityNotVerified(ReferenceIntegrityStatus),
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
    OutOfScopeBoundary(CreationBoundarySubject),
    InvalidPredecessor(&'static str),
    InvalidRoot(&'static str),
    UnsupportedSnapshotVersion {
        expected: u32,
        found: u32,
    },
    CorruptSnapshot(&'static str),
}

impl fmt::Display for CommittedEntityCreationRejection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingField(field) => write!(f, "missing creation-boundary field: {field}"),
            Self::EmptyField(field) => write!(f, "empty creation-boundary field: {field}"),
            Self::StaleSchemaVersion { expected, found } => write!(
                f,
                "unsupported S1.02.04 schema version: expected={expected}, found={found}"
            ),
            Self::StaleLifecycleSchemaVersion { expected, found } => write!(
                f,
                "stale S1.02.03 lifecycle reference: expected={expected}, found={found}"
            ),
            Self::PredecessorDigestMismatch { expected, found } => write!(
                f,
                "S1.02.03 evidence digest mismatch: expected={expected}, found={found}"
            ),
            Self::StableIdMismatch { expected, found } => {
                write!(f, "stable ID mismatch: expected={expected}, found={found}")
            }
            Self::LifecycleStateMismatch { expected, found } => write!(
                f,
                "lifecycle state mismatch: expected={expected:?}, found={found:?}"
            ),
            Self::TransitionMismatch { expected, found } => write!(
                f,
                "creation transition mismatch: expected={expected:?}, found={found:?}"
            ),
            Self::ReferenceIntegrityNotVerified(status) => {
                write!(f, "reference integrity is not verified: {status:?}")
            }
            Self::WrongOwner { expected, found } => write!(
                f,
                "wrong PA-003 creation-boundary owner: expected={expected}, found={found}"
            ),
            Self::WrongWriter { expected, found } => write!(
                f,
                "wrong PA-003 creation-boundary writer: expected={expected}, found={found}"
            ),
            Self::UnauthorizedOrigin(origin) => {
                write!(f, "unauthorized creation-boundary origin: {origin:?}")
            }
            Self::IncompletePhase(phase) => {
                write!(f, "creation-boundary validation is incomplete: {phase:?}")
            }
            Self::OutOfScopeBoundary(subject) => {
                write!(f, "out-of-scope creation-boundary subject: {subject:?}")
            }
            Self::InvalidPredecessor(reason) => {
                write!(f, "S1.02.03 predecessor invalid: {reason}")
            }
            Self::InvalidRoot(field) => write!(f, "frozen root mismatch: {field}"),
            Self::UnsupportedSnapshotVersion { expected, found } => write!(
                f,
                "unsupported creation-boundary snapshot version: expected={expected}, found={found}"
            ),
            Self::CorruptSnapshot(reason) => {
                write!(f, "corrupt creation-boundary snapshot: {reason}")
            }
        }
    }
}

impl std::error::Error for CommittedEntityCreationRejection {}

#[derive(Debug, Clone, Copy, Default)]
pub struct CommittedEntityCreationBoundary;

impl CommittedEntityCreationBoundary {
    pub fn validate(
        &self,
        request: &CommittedEntityCreationRequest,
        root: &ValidationReceipt,
        predecessor: &PersistentLifecycleOutcome,
    ) -> Result<CommittedEntityCreationValidation, CommittedEntityCreationRejection> {
        validate_predecessor(root, predecessor)?;

        let stable_id = required_text(request.stable_id.as_deref(), "stable_id")?;
        if stable_id != predecessor.stable_id {
            return Err(CommittedEntityCreationRejection::StableIdMismatch {
                expected: predecessor.stable_id.clone(),
                found: stable_id.to_owned(),
            });
        }

        let source_lifecycle_schema_version = request.source_lifecycle_schema_version.ok_or(
            CommittedEntityCreationRejection::MissingField("source_lifecycle_schema_version"),
        )?;
        if source_lifecycle_schema_version != predecessor.schema_version {
            return Err(
                CommittedEntityCreationRejection::StaleLifecycleSchemaVersion {
                    expected: predecessor.schema_version,
                    found: source_lifecycle_schema_version,
                },
            );
        }

        let source_lifecycle_evidence_digest = request.source_lifecycle_evidence_digest.ok_or(
            CommittedEntityCreationRejection::MissingField("source_lifecycle_evidence_digest"),
        )?;
        let expected_digest = predecessor.evidence_digest64();
        if source_lifecycle_evidence_digest != expected_digest {
            return Err(
                CommittedEntityCreationRejection::PredecessorDigestMismatch {
                    expected: expected_digest,
                    found: source_lifecycle_evidence_digest,
                },
            );
        }

        let lifecycle_state =
            request
                .lifecycle_state
                .ok_or(CommittedEntityCreationRejection::MissingField(
                    "lifecycle_state",
                ))?;
        if lifecycle_state != predecessor.candidate_state {
            return Err(CommittedEntityCreationRejection::LifecycleStateMismatch {
                expected: predecessor.candidate_state,
                found: lifecycle_state,
            });
        }

        let validated_transition = request.allowed_creation_transition.ok_or(
            CommittedEntityCreationRejection::MissingField("allowed_creation_transition"),
        )?;
        if validated_transition != predecessor.pending_transition {
            return Err(CommittedEntityCreationRejection::TransitionMismatch {
                expected: predecessor.pending_transition,
                found: validated_transition,
            });
        }

        let reference_integrity =
            request
                .reference_integrity
                .ok_or(CommittedEntityCreationRejection::MissingField(
                    "reference_integrity",
                ))?;
        if reference_integrity != ReferenceIntegrityStatus::Verified {
            return Err(
                CommittedEntityCreationRejection::ReferenceIntegrityNotVerified(
                    reference_integrity,
                ),
            );
        }
        let reference_integrity_evidence = required_text(
            request.reference_integrity_evidence.as_deref(),
            "reference_integrity_evidence",
        )?;
        let entity_kind = required_text(request.entity_kind.as_deref(), "entity_kind")?;
        let creation_provenance = required_text(
            request.creation_provenance.as_deref(),
            "creation_provenance",
        )?;

        let schema_version =
            request
                .schema_version
                .ok_or(CommittedEntityCreationRejection::MissingField(
                    "schema_version",
                ))?;
        if schema_version != S1_02_04_SCHEMA_VERSION {
            return Err(CommittedEntityCreationRejection::StaleSchemaVersion {
                expected: S1_02_04_SCHEMA_VERSION,
                found: schema_version,
            });
        }

        let owner = required_text(request.owner.as_deref(), "owner")?;
        if owner != S1_02_04_OWNER {
            return Err(CommittedEntityCreationRejection::WrongOwner {
                expected: S1_02_04_OWNER.to_owned(),
                found: owner.to_owned(),
            });
        }
        let writer = required_text(request.writer.as_deref(), "writer")?;
        if writer != S1_02_04_OWNER {
            return Err(CommittedEntityCreationRejection::WrongWriter {
                expected: S1_02_04_OWNER.to_owned(),
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
            .ok_or(CommittedEntityCreationRejection::MissingField("phase"))?;
        if phase != IdentityOperationPhase::Complete {
            return Err(CommittedEntityCreationRejection::IncompletePhase(phase));
        }
        let origin = request
            .origin
            .ok_or(CommittedEntityCreationRejection::MissingField("origin"))?;
        if origin != IdentityOrigin::OwningResolver {
            return Err(CommittedEntityCreationRejection::UnauthorizedOrigin(origin));
        }
        let boundary_subject =
            request
                .boundary_subject
                .ok_or(CommittedEntityCreationRejection::MissingField(
                    "boundary_subject",
                ))?;
        if boundary_subject != CreationBoundarySubject::CommittedEntityCreation {
            return Err(CommittedEntityCreationRejection::OutOfScopeBoundary(
                boundary_subject,
            ));
        }

        Ok(CommittedEntityCreationValidation {
            work_id: "S1.02.04",
            work_package: "WP-002",
            schema_version,
            stable_id: stable_id.to_owned(),
            source_lifecycle_schema_version,
            lifecycle_state,
            validated_transition,
            reference_integrity,
            reference_integrity_evidence: reference_integrity_evidence.to_owned(),
            entity_kind: entity_kind.to_owned(),
            creation_provenance: creation_provenance.to_owned(),
            owner: owner.to_owned(),
            causal_parent: causal_parent.to_owned(),
            completion_evidence: completion_evidence.to_owned(),
            phase,
            disposition: IdentityDisposition::CandidateOnly,
            operands: OPERANDS,
            predecessor_work_id: "S1.02.03",
            predecessor_work_package: "WP-002",
            predecessor_evidence_digest: expected_digest,
            root_fact_key: root.fact_key.clone(),
            root_contract_version: root.contract_version,
            root_owner: root.owner.clone(),
            root_causal_parent: root.causal_parent.clone(),
        })
    }
}

fn validate_predecessor(
    root: &ValidationReceipt,
    predecessor: &PersistentLifecycleOutcome,
) -> Result<(), CommittedEntityCreationRejection> {
    if predecessor.work_id != "S1.02.03" || predecessor.work_package != "WP-002" {
        return Err(CommittedEntityCreationRejection::InvalidPredecessor(
            "wrong work identity",
        ));
    }
    if predecessor.schema_version != S1_02_03_SCHEMA_VERSION {
        return Err(CommittedEntityCreationRejection::InvalidPredecessor(
            "unsupported S1.02.03 schema version",
        ));
    }
    if predecessor.owner != S1_02_03_OWNER {
        return Err(CommittedEntityCreationRejection::InvalidPredecessor(
            "wrong S1.02.03 owner",
        ));
    }
    if predecessor.disposition != IdentityDisposition::CandidateOnly {
        return Err(CommittedEntityCreationRejection::InvalidPredecessor(
            "S1.02.03 output is not candidate-only",
        ));
    }
    if predecessor.phase != IdentityOperationPhase::Complete {
        return Err(CommittedEntityCreationRejection::InvalidPredecessor(
            "S1.02.03 is not complete",
        ));
    }
    if predecessor.root_fact_key != root.fact_key {
        return Err(CommittedEntityCreationRejection::InvalidRoot("fact_key"));
    }
    if predecessor.root_contract_version != root.contract_version {
        return Err(CommittedEntityCreationRejection::InvalidRoot(
            "contract_version",
        ));
    }
    if predecessor.root_owner != root.owner {
        return Err(CommittedEntityCreationRejection::InvalidRoot("owner"));
    }
    if predecessor.root_causal_parent != root.causal_parent {
        return Err(CommittedEntityCreationRejection::InvalidRoot(
            "causal_parent",
        ));
    }
    Ok(())
}

fn required_text<'a>(
    value: Option<&'a str>,
    field: &'static str,
) -> Result<&'a str, CommittedEntityCreationRejection> {
    let value = value.ok_or(CommittedEntityCreationRejection::MissingField(field))?;
    if value.trim().is_empty() {
        return Err(CommittedEntityCreationRejection::EmptyField(field));
    }
    Ok(value)
}

fn required_snapshot_text(
    value: &str,
    field: &'static str,
) -> Result<(), CommittedEntityCreationRejection> {
    if value.trim().is_empty() {
        return Err(CommittedEntityCreationRejection::CorruptSnapshot(field));
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
