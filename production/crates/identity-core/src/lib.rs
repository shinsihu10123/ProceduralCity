//! Frozen L3 `S1.02.01 Stable Entity ID 체계`.
//!
//! This module establishes the first PA-003 identity contract without choosing the later
//! namespace/versioning, lifecycle-transition, reuse-audit, or canonical-commit algorithms.
//! It validates a stable identity candidate against the frozen owner/causal boundary and
//! produces candidate-only evidence. Canonical mutation remains downstream.

use std::fmt;

use gaonn_world_core::acceptance::{AcceptanceRecord, AcceptanceVerdict};
use gaonn_world_core::{S1_01_01_CONTRACT_VERSION, ValidationReceipt};

pub const S1_02_01_SCHEMA_VERSION: u32 = 1;
pub const S1_02_01_OWNER: &str = "identity-core.entity-identity-registry";
const OPERANDS: [&str; 5] = ["Stable", "Entity", "ID", "체계", "Namespace"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdentityOperationPhase {
    Requested,
    InProgress,
    Partial,
    Complete,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdentityOrigin {
    OwningResolver,
    Ui,
    Ai,
    Derived,
    Observer,
    Renderer,
    Analytics,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdentityIdSource {
    StableSourceRecord,
    ArrayIndex,
    DisplayName,
    Placement,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdentityDisposition {
    CandidateOnly,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StableIdentityRequest {
    pub stable_id: Option<String>,
    pub namespace: Option<String>,
    pub entity_kind: Option<String>,
    pub creation_provenance: Option<String>,
    pub lifecycle_state: Option<String>,
    pub reference_integrity_evidence: Option<String>,
    pub version: Option<u32>,
    pub owner: Option<String>,
    pub writer: Option<String>,
    pub causal_parent: Option<String>,
    pub completion_evidence: Option<String>,
    pub phase: Option<IdentityOperationPhase>,
    pub origin: Option<IdentityOrigin>,
    pub id_source: Option<IdentityIdSource>,
    pub display_name_hint: Option<String>,
    pub lod_hint: Option<String>,
    pub placement_hint: Option<String>,
}

impl StableIdentityRequest {
    pub fn valid_fixture() -> Self {
        Self {
            stable_id: Some("entity:human:00000001".to_owned()),
            namespace: Some("entity".to_owned()),
            entity_kind: Some("human".to_owned()),
            creation_provenance: Some("genesis:humanity-zero:seed-0001".to_owned()),
            lifecycle_state: Some("active".to_owned()),
            reference_integrity_evidence: Some("refs:verified:fixture".to_owned()),
            version: Some(S1_02_01_SCHEMA_VERSION),
            owner: Some(S1_02_01_OWNER.to_owned()),
            writer: Some(S1_02_01_OWNER.to_owned()),
            causal_parent: Some("WP-001:S1.01.08:PASS".to_owned()),
            completion_evidence: Some("stable-id-validation-complete".to_owned()),
            phase: Some(IdentityOperationPhase::Complete),
            origin: Some(IdentityOrigin::OwningResolver),
            id_source: Some(IdentityIdSource::StableSourceRecord),
            display_name_hint: Some("Example Human".to_owned()),
            lod_hint: Some("individual".to_owned()),
            placement_hint: Some("partition-7".to_owned()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StableIdentityOutcome {
    pub work_id: &'static str,
    pub work_package: &'static str,
    pub schema_version: u32,
    pub stable_id: String,
    pub namespace: String,
    pub entity_kind: String,
    pub creation_provenance: String,
    pub lifecycle_state: String,
    pub reference_integrity_evidence: String,
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

impl StableIdentityOutcome {
    pub fn evidence_digest64(&self) -> u64 {
        let mut encoded = format!(
            "{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{:?}|{:?}|{:?}|{}|{}|{}|{}|{}|{}|{}",
            self.work_id,
            self.work_package,
            self.schema_version,
            self.stable_id,
            self.namespace,
            self.entity_kind,
            self.creation_provenance,
            self.lifecycle_state,
            self.reference_integrity_evidence,
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
        encoded.push('|');
        encoded.push_str(&self.completion_evidence);
        fnv1a64(encoded.as_bytes())
    }

    pub fn snapshot(&self) -> StableIdentitySnapshot {
        StableIdentitySnapshot {
            schema_version: self.schema_version,
            outcome: self.clone(),
        }
    }

    pub fn restore(snapshot: StableIdentitySnapshot) -> Result<Self, IdentityRejection> {
        if snapshot.schema_version != S1_02_01_SCHEMA_VERSION {
            return Err(IdentityRejection::UnsupportedSnapshotVersion {
                expected: S1_02_01_SCHEMA_VERSION,
                found: snapshot.schema_version,
            });
        }
        let outcome = snapshot.outcome;
        if outcome.work_id != "S1.02.01" || outcome.work_package != "WP-002" {
            return Err(IdentityRejection::CorruptSnapshot("wrong work identity"));
        }
        if outcome.disposition != IdentityDisposition::CandidateOnly {
            return Err(IdentityRejection::CorruptSnapshot(
                "S1.02.01 cannot persist a committed-reality result",
            ));
        }
        if outcome.operands != OPERANDS {
            return Err(IdentityRejection::CorruptSnapshot(
                "frozen operands changed",
            ));
        }
        required_snapshot_text(&outcome.stable_id, "stable_id")?;
        required_snapshot_text(&outcome.namespace, "namespace")?;
        required_snapshot_text(&outcome.owner, "owner")?;
        required_snapshot_text(&outcome.causal_parent, "causal_parent")?;
        Ok(outcome)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StableIdentitySnapshot {
    pub schema_version: u32,
    pub outcome: StableIdentityOutcome,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IdentityRejection {
    MissingField(&'static str),
    EmptyField(&'static str),
    StaleVersion { expected: u32, found: u32 },
    WrongOwner { expected: String, found: String },
    WrongWriter { expected: String, found: String },
    UnauthorizedOrigin(IdentityOrigin),
    ForbiddenIdSource(IdentityIdSource),
    IncompletePhase(IdentityOperationPhase),
    InvalidPredecessor(&'static str),
    UnsupportedRootContractVersion { expected: u32, found: u32 },
    InvalidRoot(&'static str),
    UnsupportedSnapshotVersion { expected: u32, found: u32 },
    CorruptSnapshot(&'static str),
}

impl fmt::Display for IdentityRejection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingField(field) => write!(f, "missing stable identity field: {field}"),
            Self::EmptyField(field) => write!(f, "empty stable identity field: {field}"),
            Self::StaleVersion { expected, found } => write!(
                f,
                "unsupported stable identity schema version: expected={expected}, found={found}"
            ),
            Self::WrongOwner { expected, found } => {
                write!(
                    f,
                    "wrong PA-003 identity owner: expected={expected}, found={found}"
                )
            }
            Self::WrongWriter { expected, found } => write!(
                f,
                "wrong PA-003 identity writer: expected={expected}, found={found}"
            ),
            Self::UnauthorizedOrigin(origin) => {
                write!(f, "unauthorized stable identity origin: {origin:?}")
            }
            Self::ForbiddenIdSource(source) => {
                write!(f, "forbidden permanent identity source: {source:?}")
            }
            Self::IncompletePhase(phase) => write!(
                f,
                "stable identity operation is not complete and cannot produce success: {phase:?}"
            ),
            Self::InvalidPredecessor(reason) => {
                write!(f, "WP-001 predecessor is not admissible: {reason}")
            }
            Self::UnsupportedRootContractVersion { expected, found } => write!(
                f,
                "unsupported root contract version: expected={expected}, found={found}"
            ),
            Self::InvalidRoot(field) => write!(f, "invalid frozen root field: {field}"),
            Self::UnsupportedSnapshotVersion { expected, found } => write!(
                f,
                "unsupported stable identity snapshot version: expected={expected}, found={found}"
            ),
            Self::CorruptSnapshot(reason) => {
                write!(f, "corrupt stable identity snapshot: {reason}")
            }
        }
    }
}

impl std::error::Error for IdentityRejection {}

#[derive(Debug, Clone, Copy, Default)]
pub struct StableIdentityProcessor;

impl StableIdentityProcessor {
    pub fn evaluate(
        &self,
        request: &StableIdentityRequest,
        root: &ValidationReceipt,
        wp001_closure: &AcceptanceRecord,
    ) -> Result<StableIdentityOutcome, IdentityRejection> {
        validate_root(root)?;
        validate_predecessor(root, wp001_closure)?;

        let stable_id = required_text(request.stable_id.as_deref(), "stable_id")?;
        let namespace = required_text(request.namespace.as_deref(), "namespace")?;
        let entity_kind = required_text(request.entity_kind.as_deref(), "entity_kind")?;
        let creation_provenance = required_text(
            request.creation_provenance.as_deref(),
            "creation_provenance",
        )?;
        let lifecycle_state = required_text(request.lifecycle_state.as_deref(), "lifecycle_state")?;
        let reference_integrity_evidence = required_text(
            request.reference_integrity_evidence.as_deref(),
            "reference_integrity_evidence",
        )?;
        let version = request
            .version
            .ok_or(IdentityRejection::MissingField("version"))?;
        if version != S1_02_01_SCHEMA_VERSION {
            return Err(IdentityRejection::StaleVersion {
                expected: S1_02_01_SCHEMA_VERSION,
                found: version,
            });
        }

        let owner = required_text(request.owner.as_deref(), "owner")?;
        if owner != S1_02_01_OWNER {
            return Err(IdentityRejection::WrongOwner {
                expected: S1_02_01_OWNER.to_owned(),
                found: owner.to_owned(),
            });
        }

        let writer = required_text(request.writer.as_deref(), "writer")?;
        if writer != S1_02_01_OWNER {
            return Err(IdentityRejection::WrongWriter {
                expected: S1_02_01_OWNER.to_owned(),
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
            .ok_or(IdentityRejection::MissingField("phase"))?;
        if phase != IdentityOperationPhase::Complete {
            return Err(IdentityRejection::IncompletePhase(phase));
        }

        let origin = request
            .origin
            .ok_or(IdentityRejection::MissingField("origin"))?;
        if origin != IdentityOrigin::OwningResolver {
            return Err(IdentityRejection::UnauthorizedOrigin(origin));
        }

        let id_source = request
            .id_source
            .ok_or(IdentityRejection::MissingField("id_source"))?;
        if id_source != IdentityIdSource::StableSourceRecord {
            return Err(IdentityRejection::ForbiddenIdSource(id_source));
        }

        Ok(StableIdentityOutcome {
            work_id: "S1.02.01",
            work_package: "WP-002",
            schema_version: version,
            stable_id: stable_id.to_owned(),
            namespace: namespace.to_owned(),
            entity_kind: entity_kind.to_owned(),
            creation_provenance: creation_provenance.to_owned(),
            lifecycle_state: lifecycle_state.to_owned(),
            reference_integrity_evidence: reference_integrity_evidence.to_owned(),
            owner: owner.to_owned(),
            causal_parent: causal_parent.to_owned(),
            completion_evidence: completion_evidence.to_owned(),
            phase,
            disposition: IdentityDisposition::CandidateOnly,
            operands: OPERANDS,
            predecessor_work_id: "S1.01.08",
            predecessor_work_package: "WP-001",
            predecessor_evidence_digest: wp001_closure.evidence_digest64(),
            root_fact_key: root.fact_key.clone(),
            root_contract_version: root.contract_version,
            root_owner: root.owner.clone(),
            root_causal_parent: root.causal_parent.clone(),
        })
    }
}

fn validate_root(root: &ValidationReceipt) -> Result<(), IdentityRejection> {
    if root.contract_version != S1_01_01_CONTRACT_VERSION {
        return Err(IdentityRejection::UnsupportedRootContractVersion {
            expected: S1_01_01_CONTRACT_VERSION,
            found: root.contract_version,
        });
    }
    if root.fact_key.trim().is_empty() {
        return Err(IdentityRejection::InvalidRoot("fact_key"));
    }
    if root.owner.trim().is_empty() {
        return Err(IdentityRejection::InvalidRoot("owner"));
    }
    if root.causal_parent.trim().is_empty() {
        return Err(IdentityRejection::InvalidRoot("causal_parent"));
    }
    Ok(())
}

fn validate_predecessor(
    root: &ValidationReceipt,
    predecessor: &AcceptanceRecord,
) -> Result<(), IdentityRejection> {
    if predecessor.work_id != "S1.01.08" || predecessor.work_package != "WP-001" {
        return Err(IdentityRejection::InvalidPredecessor("wrong work identity"));
    }
    if predecessor.verdict != AcceptanceVerdict::Pass || predecessor.downstream_blocked {
        return Err(IdentityRejection::InvalidPredecessor(
            "predecessor is not PASS/OPEN for downstream admission",
        ));
    }
    if !predecessor.issues.is_empty() {
        return Err(IdentityRejection::InvalidPredecessor(
            "predecessor PASS record contains unresolved issues",
        ));
    }
    if predecessor.member_results.len() != 7
        || predecessor
            .member_results
            .iter()
            .any(|member| member.verdict != AcceptanceVerdict::Pass)
    {
        return Err(IdentityRejection::InvalidPredecessor(
            "S1.01 member acceptance set is incomplete",
        ));
    }
    if predecessor.root_fact_key != root.fact_key
        || predecessor.root_contract_version != root.contract_version
        || predecessor.root_owner != root.owner
        || predecessor.root_causal_parent != root.causal_parent
    {
        return Err(IdentityRejection::InvalidPredecessor(
            "predecessor root reference does not match current frozen root",
        ));
    }
    if predecessor.pre_state_digest != predecessor.post_state_digest {
        return Err(IdentityRejection::InvalidPredecessor(
            "predecessor acceptance was not read-only",
        ));
    }
    Ok(())
}

fn required_text<'a>(
    value: Option<&'a str>,
    field: &'static str,
) -> Result<&'a str, IdentityRejection> {
    let value = value.ok_or(IdentityRejection::MissingField(field))?;
    if value.trim().is_empty() {
        return Err(IdentityRejection::EmptyField(field));
    }
    Ok(value)
}

fn required_snapshot_text(value: &str, field: &'static str) -> Result<(), IdentityRejection> {
    if value.trim().is_empty() {
        return Err(IdentityRejection::CorruptSnapshot(field));
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
