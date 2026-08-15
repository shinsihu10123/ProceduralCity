//! Frozen L3 `S1.01.05 Authority Conflict Detection`.
//!
//! Conflict detection is read-only. It decides whether a prospective write is compatible with the
//! current Canonical Authority mapping, but never mutates Canonical State or social/political
//! authority.

use std::fmt;

use crate::authority::{AuthorityReference, AuthorityRegistry, AuthorityRegistryError};
use crate::boundary::StateLayer;
use crate::write_authority::WriteAuthorityReceipt;

pub const S1_01_05_CONFLICT_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WriteScope {
    WholeFact,
    Field(String),
}

impl WriteScope {
    fn overlaps(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::WholeFact, _) | (_, Self::WholeFact) => true,
            (Self::Field(left), Self::Field(right)) => left == right,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IntentAccess {
    ReadOnly,
    CanonicalWrite,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CompetingWriteIntent {
    pub state_key: String,
    pub owner: String,
    pub writer: String,
    pub authority_epoch: u64,
    pub base_version: u32,
    pub authority: AuthorityReference,
    pub layer: StateLayer,
    pub access: IntentAccess,
    pub scope: WriteScope,
    pub component_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConflictInput {
    pub schema_version: Option<u32>,
    pub state_key: Option<String>,
    pub registered_owner: Option<String>,
    pub registered_writer: Option<String>,
    pub authority_epoch: Option<u64>,
    pub candidate_owner: Option<String>,
    pub candidate_writer: Option<String>,
    pub base_version: Option<u32>,
    pub authority: Option<AuthorityReference>,
    pub candidate_layer: Option<StateLayer>,
    pub candidate_access: Option<IntentAccess>,
    pub candidate_scope: Option<WriteScope>,
    pub candidate_component: Option<String>,
    pub competing_write_intents: Option<Vec<CompetingWriteIntent>>,
    pub source_hash: Option<String>,
    pub run_identity: Option<String>,
    pub causal_parent: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConflictKind {
    None,
    DuplicateOwner,
    WrongWriter,
    StaleAuthorityEpoch,
    StaleBaseVersion,
    NonCanonicalWriterClaim(StateLayer),
    OverlappingWriteScope { competing_component: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthorityConflictResult {
    pub work_id: &'static str,
    pub schema_version: u32,
    pub state_key: String,
    pub registered_owner: String,
    pub registered_writer: String,
    pub candidate_owner: String,
    pub candidate_writer: String,
    pub authority_epoch: u64,
    pub candidate_epoch: u64,
    pub base_version: u32,
    pub conflict: ConflictKind,
    pub block_commit: bool,
    pub commit_block_reason: Option<String>,
    pub source_hash: String,
    pub run_identity: String,
    pub causal_parent: String,
    pub pre_state_digest: u64,
}

impl AuthorityConflictResult {
    pub fn evidence_digest64(&self) -> u64 {
        let encoded = format!(
            "{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{:?}|{}|{:?}|{}|{}|{}|{}",
            self.work_id,
            self.schema_version,
            self.state_key,
            self.registered_owner,
            self.registered_writer,
            self.candidate_owner,
            self.candidate_writer,
            self.authority_epoch,
            self.candidate_epoch,
            self.base_version,
            self.conflict,
            self.block_commit,
            self.commit_block_reason,
            self.source_hash,
            self.run_identity,
            self.causal_parent,
            self.pre_state_digest
        );
        fnv1a64(encoded.as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConflictInputError {
    MissingField(&'static str),
    EmptyField(&'static str),
    UnsupportedSchemaVersion { expected: u32, found: u32 },
    Authority(AuthorityRegistryError),
    UpstreamReceiptMismatch(&'static str),
}

impl fmt::Display for ConflictInputError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingField(field) => write!(f, "missing conflict input: {field}"),
            Self::EmptyField(field) => write!(f, "empty conflict input: {field}"),
            Self::UnsupportedSchemaVersion { expected, found } => write!(
                f,
                "unsupported conflict schema version: expected={expected}, found={found}"
            ),
            Self::Authority(error) => write!(f, "authority lookup failed: {error}"),
            Self::UpstreamReceiptMismatch(field) => {
                write!(f, "S1.01.04 receipt mismatch at {field}")
            }
        }
    }
}

impl std::error::Error for ConflictInputError {}

impl From<AuthorityRegistryError> for ConflictInputError {
    fn from(value: AuthorityRegistryError) -> Self {
        Self::Authority(value)
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct AuthorityConflictDetector;

impl AuthorityConflictDetector {
    pub fn detect(
        &self,
        registry: &AuthorityRegistry,
        upstream: &WriteAuthorityReceipt,
        input: &ConflictInput,
    ) -> Result<AuthorityConflictResult, ConflictInputError> {
        let schema_version = input
            .schema_version
            .ok_or(ConflictInputError::MissingField("schema_version"))?;
        if schema_version != S1_01_05_CONFLICT_VERSION {
            return Err(ConflictInputError::UnsupportedSchemaVersion {
                expected: S1_01_05_CONFLICT_VERSION,
                found: schema_version,
            });
        }

        let state_key = required_text(input.state_key.as_deref(), "state_key")?;
        let registered_owner =
            required_text(input.registered_owner.as_deref(), "registered_owner")?;
        let registered_writer =
            required_text(input.registered_writer.as_deref(), "registered_writer")?;
        let candidate_owner = required_text(input.candidate_owner.as_deref(), "candidate_owner")?;
        let candidate_writer =
            required_text(input.candidate_writer.as_deref(), "candidate_writer")?;
        let candidate_epoch = input
            .authority_epoch
            .ok_or(ConflictInputError::MissingField("authority_epoch"))?;
        let base_version = input
            .base_version
            .ok_or(ConflictInputError::MissingField("base_version"))?;
        let authority_ref = input
            .authority
            .as_ref()
            .ok_or(ConflictInputError::MissingField("authority"))?;
        let candidate_layer = input
            .candidate_layer
            .ok_or(ConflictInputError::MissingField("candidate_layer"))?;
        let candidate_access = input
            .candidate_access
            .ok_or(ConflictInputError::MissingField("candidate_access"))?;
        let candidate_scope = input
            .candidate_scope
            .as_ref()
            .ok_or(ConflictInputError::MissingField("candidate_scope"))?;
        let candidate_component =
            required_text(input.candidate_component.as_deref(), "candidate_component")?;
        let competing = input
            .competing_write_intents
            .as_ref()
            .ok_or(ConflictInputError::MissingField("competing_write_intents"))?;
        let source_hash = required_text(input.source_hash.as_deref(), "source_hash")?;
        let run_identity = required_text(input.run_identity.as_deref(), "run_identity")?;
        let causal_parent = required_text(input.causal_parent.as_deref(), "causal_parent")?;

        let authority = registry.resolve_active(authority_ref)?;
        let pre_state_digest = registry.snapshot().evidence_digest64();

        verify_upstream(
            upstream,
            state_key,
            authority_ref,
            authority.owner.as_str(),
            authority.allowed_writer.as_str(),
        )?;
        if registered_owner != authority.owner {
            return Err(ConflictInputError::UpstreamReceiptMismatch(
                "registered_owner",
            ));
        }
        if registered_writer != authority.allowed_writer {
            return Err(ConflictInputError::UpstreamReceiptMismatch(
                "registered_writer",
            ));
        }

        let conflict = if candidate_access == IntentAccess::ReadOnly {
            ConflictKind::None
        } else if candidate_layer != StateLayer::Canonical {
            ConflictKind::NonCanonicalWriterClaim(candidate_layer)
        } else if candidate_owner != authority.owner {
            ConflictKind::DuplicateOwner
        } else if candidate_writer != authority.allowed_writer {
            ConflictKind::WrongWriter
        } else if candidate_epoch != authority.authority_epoch {
            ConflictKind::StaleAuthorityEpoch
        } else if base_version != authority_ref.version {
            ConflictKind::StaleBaseVersion
        } else if let Some(other) = competing.iter().find(|other| {
            other.access == IntentAccess::CanonicalWrite
                && other.layer == StateLayer::Canonical
                && other.state_key == state_key
                && other.component_id != candidate_component
                && other.scope.overlaps(candidate_scope)
        }) {
            ConflictKind::OverlappingWriteScope {
                competing_component: other.component_id.clone(),
            }
        } else {
            ConflictKind::None
        };

        let block_commit = conflict != ConflictKind::None;
        let commit_block_reason = block_commit.then(|| conflict_reason(&conflict));

        Ok(AuthorityConflictResult {
            work_id: "S1.01.05",
            schema_version,
            state_key: state_key.to_owned(),
            registered_owner: authority.owner.clone(),
            registered_writer: authority.allowed_writer.clone(),
            candidate_owner: candidate_owner.to_owned(),
            candidate_writer: candidate_writer.to_owned(),
            authority_epoch: authority.authority_epoch,
            candidate_epoch,
            base_version,
            conflict,
            block_commit,
            commit_block_reason,
            source_hash: source_hash.to_owned(),
            run_identity: run_identity.to_owned(),
            causal_parent: causal_parent.to_owned(),
            pre_state_digest,
        })
    }
}

fn verify_upstream(
    upstream: &WriteAuthorityReceipt,
    state_key: &str,
    authority: &AuthorityReference,
    owner: &str,
    writer: &str,
) -> Result<(), ConflictInputError> {
    if upstream.fact_key != state_key {
        return Err(ConflictInputError::UpstreamReceiptMismatch("fact_key"));
    }
    if upstream.authority != *authority {
        return Err(ConflictInputError::UpstreamReceiptMismatch("authority"));
    }
    if upstream.owner != owner {
        return Err(ConflictInputError::UpstreamReceiptMismatch("owner"));
    }
    if upstream.writer != writer {
        return Err(ConflictInputError::UpstreamReceiptMismatch("writer"));
    }
    Ok(())
}

fn required_text<'a>(
    value: Option<&'a str>,
    field: &'static str,
) -> Result<&'a str, ConflictInputError> {
    let value = value.ok_or(ConflictInputError::MissingField(field))?;
    if value.trim().is_empty() {
        return Err(ConflictInputError::EmptyField(field));
    }
    Ok(value)
}

fn conflict_reason(conflict: &ConflictKind) -> String {
    match conflict {
        ConflictKind::None => "none".to_owned(),
        ConflictKind::DuplicateOwner => "duplicate canonical owner".to_owned(),
        ConflictKind::WrongWriter => "candidate writer differs from registered writer".to_owned(),
        ConflictKind::StaleAuthorityEpoch => "candidate authority epoch is stale".to_owned(),
        ConflictKind::StaleBaseVersion => "candidate base version is stale".to_owned(),
        ConflictKind::NonCanonicalWriterClaim(layer) => {
            format!("non-canonical layer attempted canonical writer claim: {layer:?}")
        }
        ConflictKind::OverlappingWriteScope {
            competing_component,
        } => format!("overlapping canonical write scope with component {competing_component}"),
    }
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
