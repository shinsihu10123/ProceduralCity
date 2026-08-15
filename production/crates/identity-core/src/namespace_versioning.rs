//! Frozen L3 `S1.02.02 Identity Namespace / Versioning`.
//!
//! This module extends the PA-003 identity boundary established by S1.02.01. It validates
//! namespace/versioning candidates and records causal evidence without performing Canonical Commit
//! or pre-implementing later lifecycle-state machinery.

use std::fmt;

use gaonn_world_core::ValidationReceipt;

use crate::{
    IdentityDisposition, IdentityOperationPhase, IdentityOrigin, S1_02_01_OWNER,
    S1_02_01_SCHEMA_VERSION, StableIdentityOutcome,
};

pub const S1_02_02_SCHEMA_VERSION: u32 = 1;
pub const S1_02_02_OWNER: &str = S1_02_01_OWNER;
const OPERANDS: [&str; 5] = ["Namespace", "Versioning", "Stable", "Entity", "ID"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NamespaceVersioningRequest {
    pub stable_id: Option<String>,
    pub namespace: Option<String>,
    pub source_identity_version: Option<u32>,
    pub namespace_version: Option<String>,
    pub lifecycle_lineage: Option<String>,
    pub issuance_scope: Option<String>,
    pub collision_prevention_rule: Option<String>,
    pub version_lineage: Option<String>,
    pub schema_version: Option<u32>,
    pub owner: Option<String>,
    pub writer: Option<String>,
    pub causal_parent: Option<String>,
    pub completion_evidence: Option<String>,
    pub phase: Option<IdentityOperationPhase>,
    pub origin: Option<IdentityOrigin>,
    pub display_name_hint: Option<String>,
    pub placement_hint: Option<String>,
}

impl NamespaceVersioningRequest {
    pub fn valid_fixture(stable_identity: &StableIdentityOutcome) -> Self {
        Self {
            stable_id: Some(stable_identity.stable_id.clone()),
            namespace: Some(stable_identity.namespace.clone()),
            source_identity_version: Some(stable_identity.schema_version),
            namespace_version: Some("namespace-v1".to_owned()),
            lifecycle_lineage: Some("lineage:root:entity:human:00000001".to_owned()),
            issuance_scope: Some("persistent-entity-registry".to_owned()),
            collision_prevention_rule: Some("stable-id-namespace-unique".to_owned()),
            version_lineage: Some("namespace-v1<-S1.02.01/v1".to_owned()),
            schema_version: Some(S1_02_02_SCHEMA_VERSION),
            owner: Some(S1_02_02_OWNER.to_owned()),
            writer: Some(S1_02_02_OWNER.to_owned()),
            causal_parent: Some("WP-002:S1.02.01:PASS".to_owned()),
            completion_evidence: Some("identity-namespace-versioning-complete".to_owned()),
            phase: Some(IdentityOperationPhase::Complete),
            origin: Some(IdentityOrigin::OwningResolver),
            display_name_hint: Some("Unrelated Display Name".to_owned()),
            placement_hint: Some("partition-7".to_owned()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NamespaceVersioningOutcome {
    pub work_id: &'static str,
    pub work_package: &'static str,
    pub schema_version: u32,
    pub stable_id: String,
    pub namespace: String,
    pub source_identity_version: u32,
    pub namespace_version: String,
    pub lifecycle_lineage: String,
    pub issuance_scope: String,
    pub collision_prevention_rule: String,
    pub version_lineage: String,
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

impl NamespaceVersioningOutcome {
    pub fn evidence_digest64(&self) -> u64 {
        let encoded = format!(
            "{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{:?}|{:?}|{:?}|{}|{}|{}|{}|{}|{}|{}",
            self.work_id,
            self.work_package,
            self.schema_version,
            self.stable_id,
            self.namespace,
            self.source_identity_version,
            self.namespace_version,
            self.lifecycle_lineage,
            self.issuance_scope,
            self.collision_prevention_rule,
            self.version_lineage,
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

    pub fn snapshot(&self) -> NamespaceVersioningSnapshot {
        NamespaceVersioningSnapshot {
            schema_version: self.schema_version,
            outcome: self.clone(),
        }
    }

    pub fn restore(
        snapshot: NamespaceVersioningSnapshot,
    ) -> Result<Self, NamespaceVersioningRejection> {
        if snapshot.schema_version != S1_02_02_SCHEMA_VERSION {
            return Err(NamespaceVersioningRejection::UnsupportedSnapshotVersion {
                expected: S1_02_02_SCHEMA_VERSION,
                found: snapshot.schema_version,
            });
        }
        let outcome = snapshot.outcome;
        if outcome.work_id != "S1.02.02" || outcome.work_package != "WP-002" {
            return Err(NamespaceVersioningRejection::CorruptSnapshot(
                "wrong work identity",
            ));
        }
        if outcome.disposition != IdentityDisposition::CandidateOnly {
            return Err(NamespaceVersioningRejection::CorruptSnapshot(
                "S1.02.02 cannot persist committed reality",
            ));
        }
        if outcome.operands != OPERANDS {
            return Err(NamespaceVersioningRejection::CorruptSnapshot(
                "frozen operands changed",
            ));
        }
        required_snapshot_text(&outcome.stable_id, "stable_id")?;
        required_snapshot_text(&outcome.namespace, "namespace")?;
        required_snapshot_text(&outcome.namespace_version, "namespace_version")?;
        required_snapshot_text(&outcome.version_lineage, "version_lineage")?;
        required_snapshot_text(&outcome.causal_parent, "causal_parent")?;
        Ok(outcome)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NamespaceVersioningSnapshot {
    pub schema_version: u32,
    pub outcome: NamespaceVersioningOutcome,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NamespaceVersioningRejection {
    MissingField(&'static str),
    EmptyField(&'static str),
    StaleSchemaVersion { expected: u32, found: u32 },
    StaleIdentityVersion { expected: u32, found: u32 },
    StableIdMismatch { expected: String, found: String },
    NamespaceMismatch { expected: String, found: String },
    WrongOwner { expected: String, found: String },
    WrongWriter { expected: String, found: String },
    UnauthorizedOrigin(IdentityOrigin),
    IncompletePhase(IdentityOperationPhase),
    InvalidPredecessor(&'static str),
    InvalidRoot(&'static str),
    UnsupportedSnapshotVersion { expected: u32, found: u32 },
    CorruptSnapshot(&'static str),
}

impl fmt::Display for NamespaceVersioningRejection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingField(field) => write!(f, "missing namespace/versioning field: {field}"),
            Self::EmptyField(field) => write!(f, "empty namespace/versioning field: {field}"),
            Self::StaleSchemaVersion { expected, found } => write!(
                f,
                "unsupported S1.02.02 schema version: expected={expected}, found={found}"
            ),
            Self::StaleIdentityVersion { expected, found } => write!(
                f,
                "stale S1.02.01 identity reference: expected={expected}, found={found}"
            ),
            Self::StableIdMismatch { expected, found } => write!(
                f,
                "stable ID changed across S1.02.01→S1.02.02: expected={expected}, found={found}"
            ),
            Self::NamespaceMismatch { expected, found } => write!(
                f,
                "namespace changed outside predecessor boundary: expected={expected}, found={found}"
            ),
            Self::WrongOwner { expected, found } => write!(
                f,
                "wrong PA-003 namespace/versioning owner: expected={expected}, found={found}"
            ),
            Self::WrongWriter { expected, found } => write!(
                f,
                "wrong PA-003 namespace/versioning writer: expected={expected}, found={found}"
            ),
            Self::UnauthorizedOrigin(origin) => {
                write!(f, "unauthorized namespace/versioning origin: {origin:?}")
            }
            Self::IncompletePhase(phase) => write!(
                f,
                "namespace/versioning operation is not complete: {phase:?}"
            ),
            Self::InvalidPredecessor(reason) => write!(f, "S1.02.01 predecessor invalid: {reason}"),
            Self::InvalidRoot(field) => write!(f, "frozen root mismatch: {field}"),
            Self::UnsupportedSnapshotVersion { expected, found } => write!(
                f,
                "unsupported namespace/versioning snapshot version: expected={expected}, found={found}"
            ),
            Self::CorruptSnapshot(reason) => {
                write!(f, "corrupt namespace/versioning snapshot: {reason}")
            }
        }
    }
}

impl std::error::Error for NamespaceVersioningRejection {}

#[derive(Debug, Clone, Copy, Default)]
pub struct NamespaceVersioningProcessor;

impl NamespaceVersioningProcessor {
    pub fn evaluate(
        &self,
        request: &NamespaceVersioningRequest,
        root: &ValidationReceipt,
        stable_identity: &StableIdentityOutcome,
    ) -> Result<NamespaceVersioningOutcome, NamespaceVersioningRejection> {
        validate_predecessor(root, stable_identity)?;

        let stable_id = required_text(request.stable_id.as_deref(), "stable_id")?;
        if stable_id != stable_identity.stable_id {
            return Err(NamespaceVersioningRejection::StableIdMismatch {
                expected: stable_identity.stable_id.clone(),
                found: stable_id.to_owned(),
            });
        }

        let namespace = required_text(request.namespace.as_deref(), "namespace")?;
        if namespace != stable_identity.namespace {
            return Err(NamespaceVersioningRejection::NamespaceMismatch {
                expected: stable_identity.namespace.clone(),
                found: namespace.to_owned(),
            });
        }

        let source_identity_version =
            request
                .source_identity_version
                .ok_or(NamespaceVersioningRejection::MissingField(
                    "source_identity_version",
                ))?;
        if source_identity_version != stable_identity.schema_version {
            return Err(NamespaceVersioningRejection::StaleIdentityVersion {
                expected: stable_identity.schema_version,
                found: source_identity_version,
            });
        }

        let namespace_version =
            required_text(request.namespace_version.as_deref(), "namespace_version")?;
        let lifecycle_lineage =
            required_text(request.lifecycle_lineage.as_deref(), "lifecycle_lineage")?;
        let issuance_scope = required_text(request.issuance_scope.as_deref(), "issuance_scope")?;
        let collision_prevention_rule = required_text(
            request.collision_prevention_rule.as_deref(),
            "collision_prevention_rule",
        )?;
        let version_lineage = required_text(request.version_lineage.as_deref(), "version_lineage")?;

        let schema_version = request
            .schema_version
            .ok_or(NamespaceVersioningRejection::MissingField("schema_version"))?;
        if schema_version != S1_02_02_SCHEMA_VERSION {
            return Err(NamespaceVersioningRejection::StaleSchemaVersion {
                expected: S1_02_02_SCHEMA_VERSION,
                found: schema_version,
            });
        }

        let owner = required_text(request.owner.as_deref(), "owner")?;
        if owner != S1_02_02_OWNER {
            return Err(NamespaceVersioningRejection::WrongOwner {
                expected: S1_02_02_OWNER.to_owned(),
                found: owner.to_owned(),
            });
        }
        let writer = required_text(request.writer.as_deref(), "writer")?;
        if writer != S1_02_02_OWNER {
            return Err(NamespaceVersioningRejection::WrongWriter {
                expected: S1_02_02_OWNER.to_owned(),
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
            .ok_or(NamespaceVersioningRejection::MissingField("phase"))?;
        if phase != IdentityOperationPhase::Complete {
            return Err(NamespaceVersioningRejection::IncompletePhase(phase));
        }
        let origin = request
            .origin
            .ok_or(NamespaceVersioningRejection::MissingField("origin"))?;
        if origin != IdentityOrigin::OwningResolver {
            return Err(NamespaceVersioningRejection::UnauthorizedOrigin(origin));
        }

        Ok(NamespaceVersioningOutcome {
            work_id: "S1.02.02",
            work_package: "WP-002",
            schema_version,
            stable_id: stable_id.to_owned(),
            namespace: namespace.to_owned(),
            source_identity_version,
            namespace_version: namespace_version.to_owned(),
            lifecycle_lineage: lifecycle_lineage.to_owned(),
            issuance_scope: issuance_scope.to_owned(),
            collision_prevention_rule: collision_prevention_rule.to_owned(),
            version_lineage: version_lineage.to_owned(),
            owner: owner.to_owned(),
            causal_parent: causal_parent.to_owned(),
            completion_evidence: completion_evidence.to_owned(),
            phase,
            disposition: IdentityDisposition::CandidateOnly,
            operands: OPERANDS,
            predecessor_work_id: "S1.02.01",
            predecessor_work_package: "WP-002",
            predecessor_evidence_digest: stable_identity.evidence_digest64(),
            root_fact_key: root.fact_key.clone(),
            root_contract_version: root.contract_version,
            root_owner: root.owner.clone(),
            root_causal_parent: root.causal_parent.clone(),
        })
    }
}

fn validate_predecessor(
    root: &ValidationReceipt,
    stable_identity: &StableIdentityOutcome,
) -> Result<(), NamespaceVersioningRejection> {
    if stable_identity.work_id != "S1.02.01" || stable_identity.work_package != "WP-002" {
        return Err(NamespaceVersioningRejection::InvalidPredecessor(
            "wrong work identity",
        ));
    }
    if stable_identity.schema_version != S1_02_01_SCHEMA_VERSION {
        return Err(NamespaceVersioningRejection::InvalidPredecessor(
            "unsupported S1.02.01 schema version",
        ));
    }
    if stable_identity.owner != S1_02_01_OWNER {
        return Err(NamespaceVersioningRejection::InvalidPredecessor(
            "wrong S1.02.01 owner",
        ));
    }
    if stable_identity.disposition != IdentityDisposition::CandidateOnly {
        return Err(NamespaceVersioningRejection::InvalidPredecessor(
            "S1.02.01 output is not candidate-only",
        ));
    }
    if stable_identity.phase != IdentityOperationPhase::Complete {
        return Err(NamespaceVersioningRejection::InvalidPredecessor(
            "S1.02.01 is not complete",
        ));
    }
    if stable_identity.root_fact_key != root.fact_key {
        return Err(NamespaceVersioningRejection::InvalidRoot("fact_key"));
    }
    if stable_identity.root_contract_version != root.contract_version {
        return Err(NamespaceVersioningRejection::InvalidRoot(
            "contract_version",
        ));
    }
    if stable_identity.root_owner != root.owner {
        return Err(NamespaceVersioningRejection::InvalidRoot("owner"));
    }
    if stable_identity.root_causal_parent != root.causal_parent {
        return Err(NamespaceVersioningRejection::InvalidRoot("causal_parent"));
    }
    Ok(())
}

fn required_text<'a>(
    value: Option<&'a str>,
    field: &'static str,
) -> Result<&'a str, NamespaceVersioningRejection> {
    let value = value.ok_or(NamespaceVersioningRejection::MissingField(field))?;
    if value.trim().is_empty() {
        return Err(NamespaceVersioningRejection::EmptyField(field));
    }
    Ok(value)
}

fn required_snapshot_text(
    value: &str,
    field: &'static str,
) -> Result<(), NamespaceVersioningRejection> {
    if value.trim().is_empty() {
        return Err(NamespaceVersioningRejection::CorruptSnapshot(field));
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
