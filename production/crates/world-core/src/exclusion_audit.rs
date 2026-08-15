//! Frozen L3 `S1.01.07 Non-Canonical State Exclusion Audit`.
//!
//! This module is a read-only audit over the Canonical Authority Registry and the versioned
//! Authority Mapping Manifest. It never mutates Canonical State. It compares an allowed control
//! path and explicit bypass attempts against the same pre-state and records reproducible evidence.

use std::fmt;

use crate::authority::{AuthorityRecordId, AuthorityReference, AuthorityRegistry};
use crate::manifest::AuthorityMappingManifest;
use crate::{S1_01_01_CONTRACT_VERSION, ValidationReceipt};

pub const S1_01_07_AUDIT_SCHEMA_VERSION: u32 = 1;
const OPERANDS: [&str; 5] = [
    "Non-Canonical",
    "Exclusion",
    "Canonical",
    "Authority",
    "Registry",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuditLayer {
    Canonical,
    DerivedCache,
    ObservationSnapshot,
    RenderBuffer,
    AnalyticsResult,
    OutOfScope,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuditOperation {
    ReadOnly,
    DirectCanonicalCommit,
    RegisterCanonicalWriter,
    RestoreAsCanonical,
    DuplicateCanonicalWrite,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FirstFailureLocation {
    CanonicalCommitPath,
    AuthorityRegistry,
    PersistenceRestoreBoundary,
    SingleWriterBoundary,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ViolationKind {
    DerivedCacheDirectCommit,
    ObservationSnapshotWriterRegistration,
    RenderBufferRestorePromotion,
    AnalyticsCanonicalWrite,
    GenericNonCanonicalWrite,
    WrongOwnerCanonicalWrite,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AuditDisposition {
    AllowedReadOnly,
    AllowedCanonicalOwnerPath,
    OutOfScope,
    Violation(ViolationKind),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuditRequest {
    pub schema_version: Option<u32>,
    pub manifest_version: Option<u32>,
    pub source_hash: Option<String>,
    pub run_identity: Option<String>,
    pub causal_parent: Option<String>,
}

impl AuditRequest {
    pub fn valid_fixture(manifest_version: u32) -> Self {
        Self {
            schema_version: Some(S1_01_07_AUDIT_SCHEMA_VERSION),
            manifest_version: Some(manifest_version),
            source_hash: Some("frozen-source-hash-s1.01.07".to_owned()),
            run_identity: Some("run-s1.01.07-001".to_owned()),
            causal_parent: Some("S1.01.06:authority-mapping-manifest".to_owned()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuditAttempt {
    pub attempt_id: String,
    pub fact_key: String,
    pub layer: AuditLayer,
    pub operation: AuditOperation,
    pub actor_owner: String,
    pub actor_writer: String,
    pub authority: Option<AuthorityReference>,
    pub source_version: u32,
    pub provenance: String,
    pub lineage_digest: u64,
    pub evidence_hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuditAttemptResult {
    pub attempt_id: String,
    pub fact_key: String,
    pub layer: AuditLayer,
    pub operation: AuditOperation,
    pub authority: Option<AuthorityReference>,
    pub source_version: u32,
    pub provenance: String,
    pub lineage_digest: u64,
    pub evidence_hash: String,
    pub disposition: AuditDisposition,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuditViolationRecord {
    pub attempt_id: String,
    pub violation_work: String,
    pub violation: ViolationKind,
    pub first_failure_location: FirstFailureLocation,
    pub input_summary: String,
    pub reproduction_steps: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NonCanonicalAuditEvidence {
    pub work_id: &'static str,
    pub schema_version: u32,
    pub root_fact_key: String,
    pub root_contract_version: u32,
    pub root_owner: String,
    pub root_causal_parent: String,
    pub manifest_id: AuthorityRecordId,
    pub manifest_version: u32,
    pub source_registry_digest: u64,
    pub source_manifest_digest: u64,
    pub pre_state_digest: u64,
    pub post_state_digest: u64,
    pub source_hash: String,
    pub run_identity: String,
    pub causal_parent: String,
    pub operands: [&'static str; 5],
    pub attempt_results: Vec<AuditAttemptResult>,
    pub violations: Vec<AuditViolationRecord>,
}

impl NonCanonicalAuditEvidence {
    pub fn evidence_digest64(&self) -> u64 {
        let mut encoded = format!(
            "{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{:?}\n",
            self.work_id,
            self.schema_version,
            self.root_fact_key,
            self.root_contract_version,
            self.root_owner,
            self.root_causal_parent,
            self.manifest_id.namespace,
            self.manifest_id.local_id,
            self.manifest_version,
            self.source_registry_digest,
            self.source_manifest_digest,
            self.pre_state_digest,
            self.post_state_digest,
            self.source_hash,
            self.run_identity,
            self.operands
        );
        encoded.push_str(&format!("causal:{}\n", self.causal_parent));
        for result in &self.attempt_results {
            encoded.push_str(&format!(
                "R|{}|{}|{:?}|{:?}|{:?}|{}|{}|{}|{}|{:?}\n",
                result.attempt_id,
                result.fact_key,
                result.layer,
                result.operation,
                result.authority,
                result.source_version,
                result.provenance,
                result.lineage_digest,
                result.evidence_hash,
                result.disposition
            ));
        }
        for violation in &self.violations {
            encoded.push_str(&format!(
                "V|{}|{}|{:?}|{:?}|{}|{:?}\n",
                violation.attempt_id,
                violation.violation_work,
                violation.violation,
                violation.first_failure_location,
                violation.input_summary,
                violation.reproduction_steps
            ));
        }
        fnv1a64(encoded.as_bytes())
    }

    pub fn snapshot(&self) -> AuditEvidenceSnapshot {
        AuditEvidenceSnapshot {
            schema_version: self.schema_version,
            evidence: self.clone(),
        }
    }

    pub fn restore(snapshot: AuditEvidenceSnapshot) -> Result<Self, AuditError> {
        if snapshot.schema_version != S1_01_07_AUDIT_SCHEMA_VERSION {
            return Err(AuditError::UnsupportedSchemaVersion {
                expected: S1_01_07_AUDIT_SCHEMA_VERSION,
                found: snapshot.schema_version,
            });
        }
        if snapshot.evidence.work_id != "S1.01.07" {
            return Err(AuditError::EvidenceCorrupt("wrong work id".to_owned()));
        }
        if snapshot.evidence.pre_state_digest != snapshot.evidence.post_state_digest {
            return Err(AuditError::EvidenceCorrupt(
                "read-only audit changed pre/post digest".to_owned(),
            ));
        }
        if snapshot.evidence.operands != OPERANDS {
            return Err(AuditError::EvidenceCorrupt(
                "frozen audit operands changed".to_owned(),
            ));
        }
        Ok(snapshot.evidence)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuditEvidenceSnapshot {
    pub schema_version: u32,
    pub evidence: NonCanonicalAuditEvidence,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AuditError {
    MissingField(&'static str),
    EmptyField(&'static str),
    UnsupportedSchemaVersion { expected: u32, found: u32 },
    RootContractMismatch(&'static str),
    ManifestVersionMismatch { expected: u32, found: u32 },
    UnknownManifestFact(String),
    MissingAttemptAuthority(String),
    AuthorityReferenceMismatch(String),
    AttemptOwnerMismatch(String),
    AttemptWriterMismatch(String),
    EvidenceCorrupt(String),
}

impl fmt::Display for AuditError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingField(field) => write!(f, "missing audit field: {field}"),
            Self::EmptyField(field) => write!(f, "empty audit field: {field}"),
            Self::UnsupportedSchemaVersion { expected, found } => write!(
                f,
                "unsupported audit schema version: expected={expected}, found={found}"
            ),
            Self::RootContractMismatch(field) => {
                write!(f, "S1.01.01 root contract mismatch at {field}")
            }
            Self::ManifestVersionMismatch { expected, found } => write!(
                f,
                "authority manifest version mismatch: expected={expected}, found={found}"
            ),
            Self::UnknownManifestFact(fact_key) => {
                write!(f, "audit references unknown manifest fact: {fact_key}")
            }
            Self::MissingAttemptAuthority(attempt_id) => {
                write!(f, "audit attempt missing authority reference: {attempt_id}")
            }
            Self::AuthorityReferenceMismatch(attempt_id) => {
                write!(f, "audit attempt authority mismatch: {attempt_id}")
            }
            Self::AttemptOwnerMismatch(attempt_id) => {
                write!(f, "audit attempt owner metadata mismatch: {attempt_id}")
            }
            Self::AttemptWriterMismatch(attempt_id) => {
                write!(f, "audit attempt writer metadata mismatch: {attempt_id}")
            }
            Self::EvidenceCorrupt(reason) => write!(f, "audit evidence corrupt: {reason}"),
        }
    }
}

impl std::error::Error for AuditError {}

#[derive(Debug, Clone, Copy, Default)]
pub struct NonCanonicalStateExclusionAuditor;

impl NonCanonicalStateExclusionAuditor {
    pub fn audit(
        &self,
        root_contract: &ValidationReceipt,
        registry: &AuthorityRegistry,
        manifest: &AuthorityMappingManifest,
        request: &AuditRequest,
        attempts: &[AuditAttempt],
    ) -> Result<NonCanonicalAuditEvidence, AuditError> {
        validate_request(request)?;
        validate_root_contract(root_contract)?;

        let manifest_version = request
            .manifest_version
            .ok_or(AuditError::MissingField("manifest_version"))?;
        if manifest_version != manifest.manifest_version() {
            return Err(AuditError::ManifestVersionMismatch {
                expected: manifest.manifest_version(),
                found: manifest_version,
            });
        }

        let source_hash = required_text(request.source_hash.as_deref(), "source_hash")?;
        let run_identity = required_text(request.run_identity.as_deref(), "run_identity")?;
        let causal_parent = required_text(request.causal_parent.as_deref(), "causal_parent")?;
        let registry_snapshot = registry.snapshot();
        let manifest_snapshot = manifest.snapshot();
        let source_registry_digest = registry_snapshot.evidence_digest64();
        let source_manifest_digest = manifest_snapshot.evidence_digest64();
        let pre_state_digest =
            combined_prestate_digest(source_registry_digest, source_manifest_digest);

        let mut attempt_results = Vec::with_capacity(attempts.len());
        let mut violations = Vec::new();

        for attempt in attempts {
            validate_attempt_text(attempt)?;
            let disposition = if attempt.layer == AuditLayer::OutOfScope {
                AuditDisposition::OutOfScope
            } else {
                let entry = manifest
                    .entry(&attempt.fact_key)
                    .ok_or_else(|| AuditError::UnknownManifestFact(attempt.fact_key.clone()))?;
                let authority = attempt.authority.as_ref().ok_or_else(|| {
                    AuditError::MissingAttemptAuthority(attempt.attempt_id.clone())
                })?;
                if authority != &entry.authority {
                    return Err(AuditError::AuthorityReferenceMismatch(
                        attempt.attempt_id.clone(),
                    ));
                }

                classify_attempt(attempt, entry.owner.as_str(), entry.allowed_writer.as_str())
            };

            if let AuditDisposition::Violation(violation) = &disposition {
                violations.push(AuditViolationRecord {
                    attempt_id: attempt.attempt_id.clone(),
                    violation_work: format!("S1.01.07:{}", attempt.attempt_id),
                    violation: violation.clone(),
                    first_failure_location: first_failure_location(attempt.operation),
                    input_summary: format!(
                        "fact={};layer={:?};operation={:?};owner={};writer={};source_version={};provenance={};lineage_digest={};evidence_hash={}",
                        attempt.fact_key,
                        attempt.layer,
                        attempt.operation,
                        attempt.actor_owner,
                        attempt.actor_writer,
                        attempt.source_version,
                        attempt.provenance,
                        attempt.lineage_digest,
                        attempt.evidence_hash
                    ),
                    reproduction_steps: vec![
                        format!("restore pre-state digest {pre_state_digest}"),
                        format!("submit audit attempt {}", attempt.attempt_id),
                        "verify canonical registry/manifest digest is unchanged".to_owned(),
                    ],
                });
            }

            attempt_results.push(AuditAttemptResult {
                attempt_id: attempt.attempt_id.clone(),
                fact_key: attempt.fact_key.clone(),
                layer: attempt.layer,
                operation: attempt.operation,
                authority: attempt.authority.clone(),
                source_version: attempt.source_version,
                provenance: attempt.provenance.clone(),
                lineage_digest: attempt.lineage_digest,
                evidence_hash: attempt.evidence_hash.clone(),
                disposition,
            });
        }

        let post_registry_digest = registry.snapshot().evidence_digest64();
        let post_manifest_digest = manifest.snapshot().evidence_digest64();
        let post_state_digest =
            combined_prestate_digest(post_registry_digest, post_manifest_digest);
        if pre_state_digest != post_state_digest {
            return Err(AuditError::EvidenceCorrupt(
                "audit mutated canonical source state".to_owned(),
            ));
        }

        Ok(NonCanonicalAuditEvidence {
            work_id: "S1.01.07",
            schema_version: S1_01_07_AUDIT_SCHEMA_VERSION,
            root_fact_key: root_contract.fact_key.clone(),
            root_contract_version: root_contract.contract_version,
            root_owner: root_contract.owner.clone(),
            root_causal_parent: root_contract.causal_parent.clone(),
            manifest_id: manifest_snapshot.manifest_id,
            manifest_version,
            source_registry_digest,
            source_manifest_digest,
            pre_state_digest,
            post_state_digest,
            source_hash: source_hash.to_owned(),
            run_identity: run_identity.to_owned(),
            causal_parent: causal_parent.to_owned(),
            operands: OPERANDS,
            attempt_results,
            violations,
        })
    }
}

fn validate_request(request: &AuditRequest) -> Result<(), AuditError> {
    let schema_version = request
        .schema_version
        .ok_or(AuditError::MissingField("schema_version"))?;
    if schema_version != S1_01_07_AUDIT_SCHEMA_VERSION {
        return Err(AuditError::UnsupportedSchemaVersion {
            expected: S1_01_07_AUDIT_SCHEMA_VERSION,
            found: schema_version,
        });
    }
    required_text(request.source_hash.as_deref(), "source_hash")?;
    required_text(request.run_identity.as_deref(), "run_identity")?;
    required_text(request.causal_parent.as_deref(), "causal_parent")?;
    Ok(())
}

fn validate_root_contract(root: &ValidationReceipt) -> Result<(), AuditError> {
    if root.work_id != "S1.01.01" {
        return Err(AuditError::RootContractMismatch("work_id"));
    }
    if root.contract_version != S1_01_01_CONTRACT_VERSION {
        return Err(AuditError::RootContractMismatch("contract_version"));
    }
    if root.fact_key.trim().is_empty() {
        return Err(AuditError::RootContractMismatch("fact_key"));
    }
    if root.owner.trim().is_empty() {
        return Err(AuditError::RootContractMismatch("owner"));
    }
    if root.causal_parent.trim().is_empty() {
        return Err(AuditError::RootContractMismatch("causal_parent"));
    }
    Ok(())
}

fn validate_attempt_text(attempt: &AuditAttempt) -> Result<(), AuditError> {
    if attempt.attempt_id.trim().is_empty() {
        return Err(AuditError::EmptyField("attempt_id"));
    }
    if attempt.fact_key.trim().is_empty() {
        return Err(AuditError::EmptyField("fact_key"));
    }
    if attempt.actor_owner.trim().is_empty() {
        return Err(AuditError::EmptyField("actor_owner"));
    }
    if attempt.actor_writer.trim().is_empty() {
        return Err(AuditError::EmptyField("actor_writer"));
    }
    if attempt.provenance.trim().is_empty() {
        return Err(AuditError::EmptyField("provenance"));
    }
    if attempt.evidence_hash.trim().is_empty() {
        return Err(AuditError::EmptyField("evidence_hash"));
    }
    Ok(())
}

fn classify_attempt(attempt: &AuditAttempt, owner: &str, writer: &str) -> AuditDisposition {
    if attempt.operation == AuditOperation::ReadOnly {
        return AuditDisposition::AllowedReadOnly;
    }

    match attempt.layer {
        AuditLayer::OutOfScope => AuditDisposition::OutOfScope,
        AuditLayer::Canonical => {
            if attempt.actor_owner == owner && attempt.actor_writer == writer {
                AuditDisposition::AllowedCanonicalOwnerPath
            } else {
                AuditDisposition::Violation(ViolationKind::WrongOwnerCanonicalWrite)
            }
        }
        AuditLayer::DerivedCache
            if matches!(
                attempt.operation,
                AuditOperation::DirectCanonicalCommit | AuditOperation::DuplicateCanonicalWrite
            ) =>
        {
            AuditDisposition::Violation(ViolationKind::DerivedCacheDirectCommit)
        }
        AuditLayer::ObservationSnapshot
            if attempt.operation == AuditOperation::RegisterCanonicalWriter =>
        {
            AuditDisposition::Violation(ViolationKind::ObservationSnapshotWriterRegistration)
        }
        AuditLayer::RenderBuffer if attempt.operation == AuditOperation::RestoreAsCanonical => {
            AuditDisposition::Violation(ViolationKind::RenderBufferRestorePromotion)
        }
        AuditLayer::AnalyticsResult => {
            AuditDisposition::Violation(ViolationKind::AnalyticsCanonicalWrite)
        }
        AuditLayer::DerivedCache | AuditLayer::ObservationSnapshot | AuditLayer::RenderBuffer => {
            AuditDisposition::Violation(ViolationKind::GenericNonCanonicalWrite)
        }
    }
}

fn first_failure_location(operation: AuditOperation) -> FirstFailureLocation {
    match operation {
        AuditOperation::ReadOnly => FirstFailureLocation::CanonicalCommitPath,
        AuditOperation::DirectCanonicalCommit => FirstFailureLocation::CanonicalCommitPath,
        AuditOperation::RegisterCanonicalWriter => FirstFailureLocation::AuthorityRegistry,
        AuditOperation::RestoreAsCanonical => FirstFailureLocation::PersistenceRestoreBoundary,
        AuditOperation::DuplicateCanonicalWrite => FirstFailureLocation::SingleWriterBoundary,
    }
}

fn required_text<'a>(value: Option<&'a str>, field: &'static str) -> Result<&'a str, AuditError> {
    let value = value.ok_or(AuditError::MissingField(field))?;
    if value.trim().is_empty() {
        return Err(AuditError::EmptyField(field));
    }
    Ok(value)
}

fn combined_prestate_digest(registry_digest: u64, manifest_digest: u64) -> u64 {
    fnv1a64(format!("{registry_digest}|{manifest_digest}").as_bytes())
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
