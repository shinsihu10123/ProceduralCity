#![forbid(unsafe_code)]
//! Frozen WP-005 / S3.06 Validation Evidence and VT0–VT6 registry boundary.
//!
//! PA-045 keeps validation authority in Domain 27 while scientific truth remains in the
//! source domain. This crate therefore stores evidence, registry references, outcomes,
//! provenance and acceptance context; it does not rewrite source-domain state.

use gaonn_world_core::ValidationReceipt;
use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

pub const SCHEMA_VERSION: u32 = 1;
pub const OWNER: &str = "domain27.validation_registry";
pub const MEMBER_IDS: [&str; 13] = [
    "S3.06.01", "S3.06.02", "S3.06.03", "S3.06.04", "S3.06.05", "S3.06.06", "S3.06.07", "S3.06.08",
    "S3.06.09", "S3.06.10", "S3.06.11", "S3.06.12", "S3.06.13",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteOrigin {
    OwningResolver,
    Derived,
    Observer,
    Renderer,
    Analytics,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ValidationTier {
    VT0Semantic,
    VT1Deterministic,
    VT2Conservation,
    VT3Numerical,
    VT4CrossLod,
    VT5EmpiricalStatistical,
    VT6Observation,
}

impl ValidationTier {
    pub const ALL: [Self; 7] = [
        Self::VT0Semantic,
        Self::VT1Deterministic,
        Self::VT2Conservation,
        Self::VT3Numerical,
        Self::VT4CrossLod,
        Self::VT5EmpiricalStatistical,
        Self::VT6Observation,
    ];

    pub const fn code(self) -> &'static str {
        match self {
            Self::VT0Semantic => "VT0",
            Self::VT1Deterministic => "VT1",
            Self::VT2Conservation => "VT2",
            Self::VT3Numerical => "VT3",
            Self::VT4CrossLod => "VT4",
            Self::VT5EmpiricalStatistical => "VT5",
            Self::VT6Observation => "VT6",
        }
    }

    pub const fn frozen_name(self) -> &'static str {
        match self {
            Self::VT0Semantic => "Semantic Integrity",
            Self::VT1Deterministic => "Deterministic Integrity",
            Self::VT2Conservation => "Conservation Integrity",
            Self::VT3Numerical => "Numerical Integrity",
            Self::VT4CrossLod => "Cross-LOD Integrity",
            Self::VT5EmpiricalStatistical => "Empirical / Statistical Integrity",
            Self::VT6Observation => "Observation Integrity",
        }
    }

    fn parse(code: &str) -> Result<Self, ValidationError> {
        match code {
            "VT0" => Ok(Self::VT0Semantic),
            "VT1" => Ok(Self::VT1Deterministic),
            "VT2" => Ok(Self::VT2Conservation),
            "VT3" => Ok(Self::VT3Numerical),
            "VT4" => Ok(Self::VT4CrossLod),
            "VT5" => Ok(Self::VT5EmpiricalStatistical),
            "VT6" => Ok(Self::VT6Observation),
            other => Err(ValidationError::Serialization(format!(
                "unknown validation tier {other}"
            ))),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecordStatus {
    Active,
    Retired,
}

impl RecordStatus {
    fn code(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Retired => "retired",
        }
    }

    fn parse(value: &str) -> Result<Self, ValidationError> {
        match value {
            "active" => Ok(Self::Active),
            "retired" => Ok(Self::Retired),
            other => Err(ValidationError::Serialization(format!(
                "unknown record status {other}"
            ))),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct VersionRef {
    pub stable_id: String,
    pub namespace: String,
    pub version: u32,
    pub owner: String,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecordIdentity {
    pub stable_id: String,
    pub namespace: String,
    pub version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub predecessor: Option<VersionRef>,
    pub status: RecordStatus,
}

impl RecordIdentity {
    pub fn reference(&self) -> VersionRef {
        VersionRef {
            stable_id: self.stable_id.clone(),
            namespace: self.namespace.clone(),
            version: self.version,
            owner: self.owner.clone(),
            causal_parent: self.causal_parent.clone(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EvidenceSchemaRecord {
    pub identity: RecordIdentity,
    pub source_hash: String,
    pub build_identity: String,
    pub run_identity: String,
    pub test_log_ref: String,
    pub adjudication_ref: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TierRegistryRecord {
    pub identity: RecordIdentity,
    pub tier: ValidationTier,
    pub evidence_schema_ref: VersionRef,
    pub target_state_ref: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ValidationRegistry {
    schemas: BTreeMap<String, EvidenceSchemaRecord>,
    tiers: BTreeMap<(ValidationTier, String), TierRegistryRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ValidationOutcome {
    Pass,
    Fail,
    CoverageInsufficient,
}

impl ValidationOutcome {
    fn code(&self) -> &'static str {
        match self {
            Self::Pass => "PASS",
            Self::Fail => "FAIL",
            Self::CoverageInsufficient => "COVERAGE_INSUFFICIENT",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OutcomeRequest {
    pub stable_id: String,
    pub namespace: String,
    pub version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub origin: WriteOrigin,
    pub target_state_ref: String,
    pub evidence_schema_ref: VersionRef,
    pub required_tiers: BTreeSet<ValidationTier>,
    pub covered_tiers: BTreeSet<ValidationTier>,
    pub requested_outcome: ValidationOutcome,
    pub failure_basis: Option<String>,
    pub coverage_gap: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidationDecision {
    pub identity: RecordIdentity,
    pub target_state_ref: String,
    pub evidence_schema_ref: VersionRef,
    pub required_tiers: BTreeSet<ValidationTier>,
    pub covered_tiers: BTreeSet<ValidationTier>,
    pub outcome: ValidationOutcome,
    pub failure_basis: Option<String>,
    pub coverage_gap: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EvidenceProvenance {
    pub identity: RecordIdentity,
    pub source_hash: String,
    pub build_identity: String,
    pub run_identity: String,
    pub test_log_ref: String,
    pub adjudication_ref: String,
    pub source_event_ref: String,
    pub actor_ref: String,
    pub artifact_ref: String,
    pub transform_steps: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TolerancePolicy {
    Exact,
    Contextual {
        quantity_key: String,
        model_profile: String,
        fidelity_profile: String,
        unit: String,
        lower_bound: i128,
        upper_bound: i128,
        uncertainty_ref: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ToleranceAcceptanceRecord {
    pub identity: RecordIdentity,
    pub target_state_ref: String,
    pub tier: ValidationTier,
    pub policy: TolerancePolicy,
    pub decision_ref: VersionRef,
    pub provenance_ref: VersionRef,
    pub outcome: ValidationOutcome,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Wp005Acceptance {
    pub work_package: &'static str,
    pub member_ids: [&'static str; 13],
    pub predecessor_digest: u64,
    pub registry_digest: u64,
    pub evidence_digest: u64,
    pub closed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ValidationError {
    InvalidPredecessor,
    MissingField(&'static str),
    EmptyField(&'static str),
    WrongOwner,
    UnauthorizedWrite,
    UnsupportedVersion { expected: u32, found: u32 },
    InvalidInitialVersion(u32),
    StaleVersion { expected: u32, found: u32 },
    DuplicateStableId(String),
    DuplicateNamespace(String),
    DanglingReference(String),
    ReferenceMismatch(String),
    RetiredRecord(String),
    WrongTier,
    PassWithCoverageGap,
    FailWithoutBasis,
    CoverageInsufficientWithoutGap,
    SemanticToleranceMustBeExact,
    InvalidToleranceContext(&'static str),
    MissingEvidence(&'static str),
    Serialization(String),
}

impl fmt::Display for ValidationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidPredecessor => write!(f, "WP-001 predecessor receipt is invalid"),
            Self::MissingField(field) => write!(f, "missing required field {field}"),
            Self::EmptyField(field) => write!(f, "required field {field} is empty"),
            Self::WrongOwner => write!(f, "wrong Domain 27 validation owner"),
            Self::UnauthorizedWrite => write!(
                f,
                "read-only or derived origin cannot write validation registry"
            ),
            Self::UnsupportedVersion { expected, found } => {
                write!(
                    f,
                    "unsupported schema version: expected {expected}, found {found}"
                )
            }
            Self::InvalidInitialVersion(version) => {
                write!(f, "initial record version must be 1, found {version}")
            }
            Self::StaleVersion { expected, found } => {
                write!(
                    f,
                    "stale/non-sequential record version: expected {expected}, found {found}"
                )
            }
            Self::DuplicateStableId(value) => write!(f, "duplicate stable ID {value}"),
            Self::DuplicateNamespace(value) => write!(f, "duplicate active namespace {value}"),
            Self::DanglingReference(value) => write!(f, "dangling reference {value}"),
            Self::ReferenceMismatch(value) => write!(f, "reference mismatch {value}"),
            Self::RetiredRecord(value) => write!(f, "record is retired {value}"),
            Self::WrongTier => write!(
                f,
                "registry record is stored under the wrong validation tier"
            ),
            Self::PassWithCoverageGap => write!(
                f,
                "PASS is forbidden when required validation coverage is missing"
            ),
            Self::FailWithoutBasis => write!(f, "FAIL requires explicit failure evidence"),
            Self::CoverageInsufficientWithoutGap => {
                write!(f, "COVERAGE_INSUFFICIENT requires an explicit coverage gap")
            }
            Self::SemanticToleranceMustBeExact => {
                write!(f, "VT0 semantic integrity is zero-tolerance")
            }
            Self::InvalidToleranceContext(field) => {
                write!(f, "invalid contextual tolerance field {field}")
            }
            Self::MissingEvidence(id) => write!(f, "missing member evidence for {id}"),
            Self::Serialization(message) => write!(f, "serialization error: {message}"),
        }
    }
}

impl std::error::Error for ValidationError {}

pub fn admit(root: &ValidationReceipt) -> Result<(), ValidationError> {
    if root.work_id != "S1.01.01" || root.contract_version != 1 {
        return Err(ValidationError::InvalidPredecessor);
    }
    Ok(())
}

fn validate_write(owner: &str, origin: WriteOrigin) -> Result<(), ValidationError> {
    if owner != OWNER {
        return Err(ValidationError::WrongOwner);
    }
    if origin != WriteOrigin::OwningResolver {
        return Err(ValidationError::UnauthorizedWrite);
    }
    Ok(())
}

fn required(value: &str, field: &'static str) -> Result<(), ValidationError> {
    if value.trim().is_empty() {
        return Err(ValidationError::EmptyField(field));
    }
    Ok(())
}

fn validate_identity(identity: &RecordIdentity) -> Result<(), ValidationError> {
    required(&identity.stable_id, "stable_id")?;
    required(&identity.namespace, "namespace")?;
    required(&identity.owner, "owner")?;
    required(&identity.causal_parent, "causal_parent")?;
    if identity.version == 0 {
        return Err(ValidationError::UnsupportedVersion {
            expected: SCHEMA_VERSION,
            found: 0,
        });
    }
    if identity.owner != OWNER {
        return Err(ValidationError::WrongOwner);
    }
    Ok(())
}

fn validate_ref(reference: &VersionRef) -> Result<(), ValidationError> {
    required(&reference.stable_id, "reference.stable_id")?;
    required(&reference.namespace, "reference.namespace")?;
    required(&reference.owner, "reference.owner")?;
    required(&reference.causal_parent, "reference.causal_parent")?;
    if reference.version == 0 {
        return Err(ValidationError::UnsupportedVersion {
            expected: SCHEMA_VERSION,
            found: 0,
        });
    }
    if reference.owner != OWNER {
        return Err(ValidationError::WrongOwner);
    }
    Ok(())
}

fn identity_matches_ref(identity: &RecordIdentity, reference: &VersionRef) -> bool {
    identity.stable_id == reference.stable_id
        && identity.namespace == reference.namespace
        && identity.version == reference.version
        && identity.owner == reference.owner
        && identity.causal_parent == reference.causal_parent
}

impl ValidationRegistry {
    pub fn create_schema(
        &mut self,
        record: EvidenceSchemaRecord,
        origin: WriteOrigin,
    ) -> Result<VersionRef, ValidationError> {
        validate_write(&record.identity.owner, origin)?;
        validate_identity(&record.identity)?;
        validate_schema_payload(&record)?;
        if record.identity.version != 1 {
            return Err(ValidationError::InvalidInitialVersion(
                record.identity.version,
            ));
        }
        if record.identity.predecessor.is_some() {
            return Err(ValidationError::ReferenceMismatch(
                "new schema must not have predecessor".to_owned(),
            ));
        }
        if record.identity.status != RecordStatus::Active {
            return Err(ValidationError::RetiredRecord(record.identity.stable_id));
        }
        if self.schemas.contains_key(&record.identity.stable_id) {
            return Err(ValidationError::DuplicateStableId(
                record.identity.stable_id,
            ));
        }
        if self.schemas.values().any(|existing| {
            existing.identity.status == RecordStatus::Active
                && existing.identity.namespace == record.identity.namespace
        }) {
            return Err(ValidationError::DuplicateNamespace(
                record.identity.namespace,
            ));
        }
        let reference = record.identity.reference();
        self.schemas
            .insert(record.identity.stable_id.clone(), record);
        Ok(reference)
    }

    pub fn update_schema(
        &mut self,
        record: EvidenceSchemaRecord,
        origin: WriteOrigin,
    ) -> Result<VersionRef, ValidationError> {
        validate_write(&record.identity.owner, origin)?;
        validate_identity(&record.identity)?;
        validate_schema_payload(&record)?;
        let previous = self
            .schemas
            .get(&record.identity.stable_id)
            .ok_or_else(|| ValidationError::DanglingReference(record.identity.stable_id.clone()))?;
        validate_revision(&previous.identity, &record.identity)?;
        let reference = record.identity.reference();
        self.schemas
            .insert(record.identity.stable_id.clone(), record);
        Ok(reference)
    }

    pub fn retire_schema(
        &mut self,
        stable_id: &str,
        next_version: u32,
        causal_parent: &str,
        origin: WriteOrigin,
    ) -> Result<VersionRef, ValidationError> {
        validate_write(OWNER, origin)?;
        required(causal_parent, "causal_parent")?;
        let previous = self
            .schemas
            .get(stable_id)
            .cloned()
            .ok_or_else(|| ValidationError::DanglingReference(stable_id.to_owned()))?;
        if previous.identity.status != RecordStatus::Active {
            return Err(ValidationError::RetiredRecord(stable_id.to_owned()));
        }
        if next_version != previous.identity.version + 1 {
            return Err(ValidationError::StaleVersion {
                expected: previous.identity.version + 1,
                found: next_version,
            });
        }
        let identity = RecordIdentity {
            stable_id: previous.identity.stable_id.clone(),
            namespace: previous.identity.namespace.clone(),
            version: next_version,
            owner: OWNER.to_owned(),
            causal_parent: causal_parent.to_owned(),
            predecessor: Some(previous.identity.reference()),
            status: RecordStatus::Retired,
        };
        let retired = EvidenceSchemaRecord {
            identity,
            source_hash: previous.source_hash,
            build_identity: previous.build_identity,
            run_identity: previous.run_identity,
            test_log_ref: previous.test_log_ref,
            adjudication_ref: previous.adjudication_ref,
        };
        let reference = retired.identity.reference();
        self.schemas.insert(stable_id.to_owned(), retired);
        Ok(reference)
    }

    pub fn schema(&self, stable_id: &str) -> Result<&EvidenceSchemaRecord, ValidationError> {
        let record = self
            .schemas
            .get(stable_id)
            .ok_or_else(|| ValidationError::DanglingReference(stable_id.to_owned()))?;
        if record.identity.status != RecordStatus::Active {
            return Err(ValidationError::RetiredRecord(stable_id.to_owned()));
        }
        Ok(record)
    }

    pub fn create_tier(
        &mut self,
        record: TierRegistryRecord,
        origin: WriteOrigin,
    ) -> Result<VersionRef, ValidationError> {
        validate_write(&record.identity.owner, origin)?;
        validate_identity(&record.identity)?;
        validate_ref(&record.evidence_schema_ref)?;
        required(&record.target_state_ref, "target_state_ref")?;
        if record.identity.version != 1 {
            return Err(ValidationError::InvalidInitialVersion(
                record.identity.version,
            ));
        }
        if record.identity.predecessor.is_some() {
            return Err(ValidationError::ReferenceMismatch(
                "new tier registry record must not have predecessor".to_owned(),
            ));
        }
        if record.identity.status != RecordStatus::Active {
            return Err(ValidationError::RetiredRecord(record.identity.stable_id));
        }
        let schema = self.schema(&record.evidence_schema_ref.stable_id)?;
        if !identity_matches_ref(&schema.identity, &record.evidence_schema_ref) {
            return Err(ValidationError::ReferenceMismatch(
                "evidence schema version reference".to_owned(),
            ));
        }
        let key = (record.tier, record.identity.stable_id.clone());
        if self.tiers.contains_key(&key) {
            return Err(ValidationError::DuplicateStableId(
                record.identity.stable_id,
            ));
        }
        if self.tiers.values().any(|existing| {
            existing.identity.status == RecordStatus::Active
                && existing.tier == record.tier
                && existing.identity.namespace == record.identity.namespace
        }) {
            return Err(ValidationError::DuplicateNamespace(
                record.identity.namespace,
            ));
        }
        let reference = record.identity.reference();
        self.tiers.insert(key, record);
        Ok(reference)
    }

    pub fn update_tier(
        &mut self,
        record: TierRegistryRecord,
        origin: WriteOrigin,
    ) -> Result<VersionRef, ValidationError> {
        validate_write(&record.identity.owner, origin)?;
        validate_identity(&record.identity)?;
        validate_ref(&record.evidence_schema_ref)?;
        required(&record.target_state_ref, "target_state_ref")?;
        let key = (record.tier, record.identity.stable_id.clone());
        let previous = self
            .tiers
            .get(&key)
            .ok_or_else(|| ValidationError::DanglingReference(record.identity.stable_id.clone()))?;
        validate_revision(&previous.identity, &record.identity)?;
        let schema = self.schema(&record.evidence_schema_ref.stable_id)?;
        if !identity_matches_ref(&schema.identity, &record.evidence_schema_ref) {
            return Err(ValidationError::ReferenceMismatch(
                "evidence schema version reference".to_owned(),
            ));
        }
        let reference = record.identity.reference();
        self.tiers.insert(key, record);
        Ok(reference)
    }

    pub fn retire_tier(
        &mut self,
        tier: ValidationTier,
        stable_id: &str,
        next_version: u32,
        causal_parent: &str,
        origin: WriteOrigin,
    ) -> Result<VersionRef, ValidationError> {
        validate_write(OWNER, origin)?;
        required(causal_parent, "causal_parent")?;
        let key = (tier, stable_id.to_owned());
        let previous = self
            .tiers
            .get(&key)
            .cloned()
            .ok_or_else(|| ValidationError::DanglingReference(stable_id.to_owned()))?;
        if previous.identity.status != RecordStatus::Active {
            return Err(ValidationError::RetiredRecord(stable_id.to_owned()));
        }
        if next_version != previous.identity.version + 1 {
            return Err(ValidationError::StaleVersion {
                expected: previous.identity.version + 1,
                found: next_version,
            });
        }
        let retired = TierRegistryRecord {
            identity: RecordIdentity {
                stable_id: previous.identity.stable_id.clone(),
                namespace: previous.identity.namespace.clone(),
                version: next_version,
                owner: OWNER.to_owned(),
                causal_parent: causal_parent.to_owned(),
                predecessor: Some(previous.identity.reference()),
                status: RecordStatus::Retired,
            },
            tier,
            evidence_schema_ref: previous.evidence_schema_ref,
            target_state_ref: previous.target_state_ref,
        };
        let reference = retired.identity.reference();
        self.tiers.insert(key, retired);
        Ok(reference)
    }

    pub fn tier(
        &self,
        tier: ValidationTier,
        stable_id: &str,
    ) -> Result<&TierRegistryRecord, ValidationError> {
        let record = self
            .tiers
            .get(&(tier, stable_id.to_owned()))
            .ok_or_else(|| ValidationError::DanglingReference(stable_id.to_owned()))?;
        if record.tier != tier {
            return Err(ValidationError::WrongTier);
        }
        if record.identity.status != RecordStatus::Active {
            return Err(ValidationError::RetiredRecord(stable_id.to_owned()));
        }
        Ok(record)
    }

    pub fn digest64(&self) -> u64 {
        fnv1a64(self.encode_stable().as_bytes())
    }

    pub fn encode_stable(&self) -> String {
        let mut lines = Vec::new();
        for record in self.schemas.values() {
            lines.push(encode_schema(record));
        }
        for record in self.tiers.values() {
            lines.push(encode_tier(record));
        }
        lines.join("\n")
    }

    pub fn decode_stable(encoded: &str) -> Result<Self, ValidationError> {
        let mut registry = Self::default();
        if encoded.is_empty() {
            return Ok(registry);
        }
        for line in encoded.lines() {
            let fields: Vec<&str> = line.split('|').collect();
            let kind = fields
                .first()
                .ok_or_else(|| ValidationError::Serialization("empty record".to_owned()))?;
            match *kind {
                "S" => {
                    let record = decode_schema(&fields)?;
                    let key = record.identity.stable_id.clone();
                    if registry.schemas.insert(key.clone(), record).is_some() {
                        return Err(ValidationError::DuplicateStableId(key));
                    }
                }
                "T" => {
                    let record = decode_tier(&fields)?;
                    let key = (record.tier, record.identity.stable_id.clone());
                    if registry.tiers.insert(key.clone(), record).is_some() {
                        return Err(ValidationError::DuplicateStableId(key.1));
                    }
                }
                other => {
                    return Err(ValidationError::Serialization(format!(
                        "unknown snapshot record {other}"
                    )));
                }
            }
        }
        registry.validate_loaded_references()?;
        Ok(registry)
    }

    fn validate_loaded_references(&self) -> Result<(), ValidationError> {
        for record in self.tiers.values() {
            let schema = self
                .schemas
                .get(&record.evidence_schema_ref.stable_id)
                .ok_or_else(|| {
                    ValidationError::DanglingReference(record.evidence_schema_ref.stable_id.clone())
                })?;
            if !identity_matches_ref(&schema.identity, &record.evidence_schema_ref) {
                return Err(ValidationError::ReferenceMismatch(
                    "snapshot evidence schema reference".to_owned(),
                ));
            }
        }
        Ok(())
    }
}

fn validate_schema_payload(record: &EvidenceSchemaRecord) -> Result<(), ValidationError> {
    required(&record.source_hash, "source_hash")?;
    required(&record.build_identity, "build_identity")?;
    required(&record.run_identity, "run_identity")?;
    required(&record.test_log_ref, "test_log_ref")?;
    required(&record.adjudication_ref, "adjudication_ref")?;
    Ok(())
}

fn validate_revision(
    previous: &RecordIdentity,
    next: &RecordIdentity,
) -> Result<(), ValidationError> {
    if previous.status != RecordStatus::Active {
        return Err(ValidationError::RetiredRecord(previous.stable_id.clone()));
    }
    if previous.stable_id != next.stable_id
        || previous.namespace != next.namespace
        || previous.owner != next.owner
    {
        return Err(ValidationError::ReferenceMismatch(
            "stable identity/namespace/owner changed across revision".to_owned(),
        ));
    }
    if next.version != previous.version + 1 {
        return Err(ValidationError::StaleVersion {
            expected: previous.version + 1,
            found: next.version,
        });
    }
    match next.predecessor.as_ref() {
        Some(reference) if identity_matches_ref(previous, reference) => Ok(()),
        _ => Err(ValidationError::ReferenceMismatch(
            "revision predecessor".to_owned(),
        )),
    }
}

pub fn decide(request: OutcomeRequest) -> Result<ValidationDecision, ValidationError> {
    validate_write(&request.owner, request.origin)?;
    required(&request.stable_id, "stable_id")?;
    required(&request.namespace, "namespace")?;
    required(&request.causal_parent, "causal_parent")?;
    required(&request.target_state_ref, "target_state_ref")?;
    validate_ref(&request.evidence_schema_ref)?;
    if request.version == 0 {
        return Err(ValidationError::UnsupportedVersion {
            expected: SCHEMA_VERSION,
            found: 0,
        });
    }
    let missing: BTreeSet<_> = request
        .required_tiers
        .difference(&request.covered_tiers)
        .copied()
        .collect();
    match request.requested_outcome {
        ValidationOutcome::Pass => {
            if !missing.is_empty()
                || request
                    .coverage_gap
                    .as_deref()
                    .is_some_and(|v| !v.trim().is_empty())
            {
                return Err(ValidationError::PassWithCoverageGap);
            }
        }
        ValidationOutcome::Fail => {
            if request
                .failure_basis
                .as_deref()
                .is_none_or(|value| value.trim().is_empty())
            {
                return Err(ValidationError::FailWithoutBasis);
            }
        }
        ValidationOutcome::CoverageInsufficient => {
            let explicit_gap = request
                .coverage_gap
                .as_deref()
                .is_some_and(|value| !value.trim().is_empty());
            if missing.is_empty() && !explicit_gap {
                return Err(ValidationError::CoverageInsufficientWithoutGap);
            }
        }
    }
    Ok(ValidationDecision {
        identity: RecordIdentity {
            stable_id: request.stable_id,
            namespace: request.namespace,
            version: request.version,
            owner: request.owner,
            causal_parent: request.causal_parent,
            predecessor: None,
            status: RecordStatus::Active,
        },
        target_state_ref: request.target_state_ref,
        evidence_schema_ref: request.evidence_schema_ref,
        required_tiers: request.required_tiers,
        covered_tiers: request.covered_tiers,
        outcome: request.requested_outcome,
        failure_basis: request.failure_basis,
        coverage_gap: request.coverage_gap,
    })
}

pub fn validate_provenance(
    provenance: &EvidenceProvenance,
    origin: WriteOrigin,
) -> Result<(), ValidationError> {
    validate_write(&provenance.identity.owner, origin)?;
    validate_identity(&provenance.identity)?;
    required(&provenance.source_hash, "source_hash")?;
    required(&provenance.build_identity, "build_identity")?;
    required(&provenance.run_identity, "run_identity")?;
    required(&provenance.test_log_ref, "test_log_ref")?;
    required(&provenance.adjudication_ref, "adjudication_ref")?;
    required(&provenance.source_event_ref, "source_event_ref")?;
    required(&provenance.actor_ref, "actor_ref")?;
    required(&provenance.artifact_ref, "artifact_ref")?;
    if provenance.transform_steps.is_empty()
        || provenance
            .transform_steps
            .iter()
            .any(|step| step.trim().is_empty())
    {
        return Err(ValidationError::MissingField("transform_steps"));
    }
    Ok(())
}

pub fn validate_tolerance_policy(
    tier: ValidationTier,
    policy: &TolerancePolicy,
) -> Result<(), ValidationError> {
    if tier == ValidationTier::VT0Semantic && !matches!(policy, TolerancePolicy::Exact) {
        return Err(ValidationError::SemanticToleranceMustBeExact);
    }
    if let TolerancePolicy::Contextual {
        quantity_key,
        model_profile,
        fidelity_profile,
        unit,
        lower_bound,
        upper_bound,
        uncertainty_ref,
    } = policy
    {
        required(quantity_key, "quantity_key")?;
        required(model_profile, "model_profile")?;
        required(fidelity_profile, "fidelity_profile")?;
        required(unit, "unit")?;
        required(uncertainty_ref, "uncertainty_ref")?;
        if lower_bound > upper_bound {
            return Err(ValidationError::InvalidToleranceContext("bounds"));
        }
    }
    Ok(())
}

pub fn make_acceptance_record(
    identity: RecordIdentity,
    target_state_ref: String,
    tier: ValidationTier,
    policy: TolerancePolicy,
    decision: &ValidationDecision,
    provenance: &EvidenceProvenance,
    origin: WriteOrigin,
) -> Result<ToleranceAcceptanceRecord, ValidationError> {
    validate_write(&identity.owner, origin)?;
    validate_identity(&identity)?;
    required(&target_state_ref, "target_state_ref")?;
    validate_tolerance_policy(tier, &policy)?;
    validate_provenance(provenance, WriteOrigin::OwningResolver)?;
    if decision.identity.owner != OWNER || provenance.identity.owner != OWNER {
        return Err(ValidationError::WrongOwner);
    }
    if decision.target_state_ref != target_state_ref {
        return Err(ValidationError::ReferenceMismatch(
            "acceptance target versus decision target".to_owned(),
        ));
    }
    Ok(ToleranceAcceptanceRecord {
        identity,
        target_state_ref,
        tier,
        policy,
        decision_ref: decision.identity.reference(),
        provenance_ref: provenance.identity.reference(),
        outcome: decision.outcome.clone(),
    })
}

pub fn accept_wp(
    root: &ValidationReceipt,
    member_passes: &[bool; 13],
    member_evidence: &[u64; 13],
    registry_digest: u64,
) -> Result<Wp005Acceptance, ValidationError> {
    admit(root)?;
    if registry_digest == 0 {
        return Err(ValidationError::MissingEvidence("registry_digest"));
    }
    if let Some(index) = member_passes.iter().position(|passed| !*passed) {
        return Err(ValidationError::MissingEvidence(MEMBER_IDS[index]));
    }
    if let Some(index) = member_evidence.iter().position(|digest| *digest == 0) {
        return Err(ValidationError::MissingEvidence(MEMBER_IDS[index]));
    }
    let evidence_digest = fnv1a64(format!("{member_passes:?}{member_evidence:?}").as_bytes());
    Ok(Wp005Acceptance {
        work_package: "WP-005",
        member_ids: MEMBER_IDS,
        predecessor_digest: root.evidence_digest64(),
        registry_digest,
        evidence_digest,
        closed: true,
    })
}

pub fn provenance_digest64(provenance: &EvidenceProvenance) -> u64 {
    let mut value = String::new();
    value.push_str(&encode_identity(&provenance.identity));
    for field in [
        &provenance.source_hash,
        &provenance.build_identity,
        &provenance.run_identity,
        &provenance.test_log_ref,
        &provenance.adjudication_ref,
        &provenance.source_event_ref,
        &provenance.actor_ref,
        &provenance.artifact_ref,
    ] {
        value.push('|');
        value.push_str(&escape(field));
    }
    for step in &provenance.transform_steps {
        value.push('|');
        value.push_str(&escape(step));
    }
    fnv1a64(value.as_bytes())
}

pub fn decision_digest64(decision: &ValidationDecision) -> u64 {
    let mut value = encode_identity(&decision.identity);
    value.push('|');
    value.push_str(&escape(&decision.target_state_ref));
    value.push('|');
    value.push_str(&encode_ref(&decision.evidence_schema_ref));
    value.push('|');
    value.push_str(decision.outcome.code());
    for tier in &decision.required_tiers {
        value.push('|');
        value.push_str("R:");
        value.push_str(tier.code());
    }
    for tier in &decision.covered_tiers {
        value.push('|');
        value.push_str("C:");
        value.push_str(tier.code());
    }
    if let Some(reason) = &decision.failure_basis {
        value.push('|');
        value.push_str("F:");
        value.push_str(&escape(reason));
    }
    if let Some(gap) = &decision.coverage_gap {
        value.push('|');
        value.push_str("G:");
        value.push_str(&escape(gap));
    }
    fnv1a64(value.as_bytes())
}

fn encode_schema(record: &EvidenceSchemaRecord) -> String {
    format!(
        "S|{}|{}|{}|{}|{}|{}",
        encode_identity(&record.identity),
        escape(&record.source_hash),
        escape(&record.build_identity),
        escape(&record.run_identity),
        escape(&record.test_log_ref),
        escape(&record.adjudication_ref),
    )
}

fn decode_schema(fields: &[&str]) -> Result<EvidenceSchemaRecord, ValidationError> {
    if fields.len() != 12 {
        return Err(ValidationError::Serialization(format!(
            "schema field count {}",
            fields.len()
        )));
    }
    Ok(EvidenceSchemaRecord {
        identity: decode_identity(&fields[1..7])?,
        source_hash: unescape(fields[7])?,
        build_identity: unescape(fields[8])?,
        run_identity: unescape(fields[9])?,
        test_log_ref: unescape(fields[10])?,
        adjudication_ref: unescape(fields[11])?,
    })
}

fn encode_tier(record: &TierRegistryRecord) -> String {
    format!(
        "T|{}|{}|{}|{}",
        encode_identity(&record.identity),
        record.tier.code(),
        encode_ref(&record.evidence_schema_ref),
        escape(&record.target_state_ref),
    )
}

fn decode_tier(fields: &[&str]) -> Result<TierRegistryRecord, ValidationError> {
    if fields.len() != 10 {
        return Err(ValidationError::Serialization(format!(
            "tier field count {}",
            fields.len()
        )));
    }
    Ok(TierRegistryRecord {
        identity: decode_identity(&fields[1..7])?,
        tier: ValidationTier::parse(fields[7])?,
        evidence_schema_ref: decode_ref_from_string(fields[8])?,
        target_state_ref: unescape(fields[9])?,
    })
}

fn encode_identity(identity: &RecordIdentity) -> String {
    let predecessor = identity
        .predecessor
        .as_ref()
        .map(encode_ref)
        .unwrap_or_else(|| "-".to_owned());
    [
        escape(&identity.stable_id),
        escape(&identity.namespace),
        identity.version.to_string(),
        escape(&identity.owner),
        escape(&identity.causal_parent),
        format!("{};{}", identity.status.code(), escape(&predecessor)),
    ]
    .join("|")
}

fn decode_identity(fields: &[&str]) -> Result<RecordIdentity, ValidationError> {
    if fields.len() != 6 {
        return Err(ValidationError::Serialization(format!(
            "identity field count {}",
            fields.len()
        )));
    }
    let (status, predecessor) = fields[5]
        .split_once(';')
        .ok_or_else(|| ValidationError::Serialization("identity status/predecessor".to_owned()))?;
    let predecessor = unescape(predecessor)?;
    Ok(RecordIdentity {
        stable_id: unescape(fields[0])?,
        namespace: unescape(fields[1])?,
        version: fields[2]
            .parse()
            .map_err(|_| ValidationError::Serialization("identity version".to_owned()))?,
        owner: unescape(fields[3])?,
        causal_parent: unescape(fields[4])?,
        predecessor: if predecessor == "-" {
            None
        } else {
            Some(decode_ref_from_string(&predecessor)?)
        },
        status: RecordStatus::parse(status)?,
    })
}

fn encode_ref(reference: &VersionRef) -> String {
    [
        escape(&reference.stable_id),
        escape(&reference.namespace),
        reference.version.to_string(),
        escape(&reference.owner),
        escape(&reference.causal_parent),
    ]
    .join(";")
}

fn decode_ref(fields: &[&str]) -> Result<VersionRef, ValidationError> {
    if fields.len() != 5 {
        return Err(ValidationError::Serialization(format!(
            "reference field count {}",
            fields.len()
        )));
    }
    Ok(VersionRef {
        stable_id: unescape(fields[0])?,
        namespace: unescape(fields[1])?,
        version: fields[2]
            .parse()
            .map_err(|_| ValidationError::Serialization("reference version".to_owned()))?,
        owner: unescape(fields[3])?,
        causal_parent: unescape(fields[4])?,
    })
}

fn decode_ref_from_string(value: &str) -> Result<VersionRef, ValidationError> {
    let fields: Vec<&str> = value.split(';').collect();
    decode_ref(&fields)
}

fn escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'%' => out.push_str("%25"),
            b'|' => out.push_str("%7C"),
            b';' => out.push_str("%3B"),
            b'\n' => out.push_str("%0A"),
            b'\r' => out.push_str("%0D"),
            _ => out.push(byte as char),
        }
    }
    out
}

fn unescape(value: &str) -> Result<String, ValidationError> {
    let bytes = value.as_bytes();
    let mut out = String::with_capacity(value.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] != b'%' {
            out.push(bytes[index] as char);
            index += 1;
            continue;
        }
        if index + 2 >= bytes.len() {
            return Err(ValidationError::Serialization(
                "truncated escape sequence".to_owned(),
            ));
        }
        match &value[index + 1..index + 3] {
            "25" => out.push('%'),
            "7C" => out.push('|'),
            "3B" => out.push(';'),
            "0A" => out.push('\n'),
            "0D" => out.push('\r'),
            other => {
                return Err(ValidationError::Serialization(format!(
                    "unknown escape {other}"
                )));
            }
        }
        index += 3;
    }
    Ok(out)
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
