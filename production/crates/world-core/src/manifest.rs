//! Frozen L3 `S1.01.06 Versioned Authority Mapping Manifest`.
//!
//! The manifest is a versioned, read-mostly reference projection of the Canonical Authority
//! Registry. It preserves stable authority identity, exact versions, lifecycle and lineage while
//! keeping Observer/Renderer/Derived layers unable to write Canonical authority.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

use crate::authority::{
    AuthorityLifecycle, AuthorityLineageEntry, AuthorityRecordId, AuthorityReference,
    AuthorityRegistry, AuthorityRegistryError, AuthorityRegistrySnapshot,
};

pub const S1_01_06_MANIFEST_SCHEMA_VERSION: u32 = 1;
pub const AUTHORITY_MANIFEST_NAMESPACE: &str = "world-core.authority-manifest";
pub const AUTHORITY_MANIFEST_LOCAL_ID: &str = "canonical-authority-mapping";
pub const AUTHORITY_MANIFEST_OWNER: &str = "world-core.authority-registry";
const OPERANDS: [&str; 4] = ["Versioned", "Authority", "Canonical", "Registry"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ManifestWriteOrigin {
    AuthorityRegistry,
    Derived,
    Observer,
    Renderer,
    Analytics,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ManifestRequest {
    pub schema_version: Option<u32>,
    pub actor_owner: Option<String>,
    pub origin: Option<ManifestWriteOrigin>,
    pub source_hash: Option<String>,
    pub causal_parent: Option<String>,
}

impl ManifestRequest {
    pub fn valid_fixture() -> Self {
        Self {
            schema_version: Some(S1_01_06_MANIFEST_SCHEMA_VERSION),
            actor_owner: Some(AUTHORITY_MANIFEST_OWNER.to_owned()),
            origin: Some(ManifestWriteOrigin::AuthorityRegistry),
            source_hash: Some("frozen-source-hash-s1.01.06".to_owned()),
            causal_parent: Some("S1.01.05:authority-conflict".to_owned()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthorityMappingEntry {
    pub fact_key: String,
    pub authority: AuthorityReference,
    pub owner: String,
    pub allowed_writer: String,
    pub authority_epoch: u64,
    pub lifecycle: AuthorityLifecycle,
    pub parent_version: Option<u32>,
    pub causal_parent: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ManifestLineageAction {
    Created,
    Updated,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ManifestLineageEntry {
    pub manifest_id: AuthorityRecordId,
    pub action: ManifestLineageAction,
    pub from_version: Option<u32>,
    pub to_version: u32,
    pub source_registry_digest: u64,
    pub source_hash: String,
    pub causal_parent: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MigrationDecision {
    Initial,
    CompatibleNoChange,
    ForwardCompatible,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ManifestUpdateReceipt {
    pub work_id: &'static str,
    pub manifest_id: AuthorityRecordId,
    pub manifest_version: u32,
    pub entry_count: usize,
    pub source_registry_digest: u64,
    pub source_hash: String,
    pub causal_parent: String,
    pub migration: MigrationDecision,
    pub operands: [&'static str; 4],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthorityMappingManifestSnapshot {
    pub schema_version: u32,
    pub manifest_id: AuthorityRecordId,
    pub manifest_owner: String,
    pub manifest_version: u32,
    pub source_registry_digest: u64,
    pub source_hash: String,
    pub causal_parent: String,
    pub entries: Vec<AuthorityMappingEntry>,
    pub authority_lineage: Vec<AuthorityLineageEntry>,
    pub manifest_lineage: Vec<ManifestLineageEntry>,
}

impl AuthorityMappingManifestSnapshot {
    pub fn evidence_digest64(&self) -> u64 {
        let mut canonical = format!(
            "M|{}|{}|{}|{}|{}|{}|{}|{}\n",
            self.schema_version,
            self.manifest_id.namespace,
            self.manifest_id.local_id,
            self.manifest_owner,
            self.manifest_version,
            self.source_registry_digest,
            self.source_hash,
            self.causal_parent
        );
        for entry in &self.entries {
            canonical.push_str(&format!(
                "E|{}|{}|{}|{}|{}|{}|{}|{:?}|{:?}|{}\n",
                entry.fact_key,
                entry.authority.id.namespace,
                entry.authority.id.local_id,
                entry.authority.version,
                entry.owner,
                entry.allowed_writer,
                entry.authority_epoch,
                entry.lifecycle,
                entry.parent_version,
                entry.causal_parent
            ));
        }
        for entry in &self.authority_lineage {
            canonical.push_str(&format!(
                "A|{}|{}|{:?}|{:?}|{}|{}|{}\n",
                entry.id.namespace,
                entry.id.local_id,
                entry.action,
                entry.from_version,
                entry.to_version,
                entry.authority_epoch,
                entry.causal_parent
            ));
        }
        for entry in &self.manifest_lineage {
            canonical.push_str(&format!(
                "L|{}|{}|{:?}|{:?}|{}|{}|{}|{}\n",
                entry.manifest_id.namespace,
                entry.manifest_id.local_id,
                entry.action,
                entry.from_version,
                entry.to_version,
                entry.source_registry_digest,
                entry.source_hash,
                entry.causal_parent
            ));
        }
        fnv1a64(canonical.as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthorityMappingManifest {
    schema_version: u32,
    manifest_id: AuthorityRecordId,
    manifest_owner: String,
    manifest_version: u32,
    source_registry_digest: u64,
    source_hash: String,
    causal_parent: String,
    entries: BTreeMap<String, AuthorityMappingEntry>,
    authority_lineage: Vec<AuthorityLineageEntry>,
    manifest_lineage: Vec<ManifestLineageEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ManifestError {
    MissingField(&'static str),
    EmptyField(&'static str),
    UnsupportedSchemaVersion { expected: u32, found: u32 },
    WrongManifestOwner { expected: String, found: String },
    ProhibitedWriteOrigin(ManifestWriteOrigin),
    DuplicateFactMapping(String),
    DuplicateAuthorityIdentity(AuthorityRecordId),
    ManifestIdentityMismatch,
    ManifestVersionRegressed { current: u32, candidate: u32 },
    MissingPreviousFact(String),
    AuthorityIdentityChanged { fact_key: String },
    AuthorityVersionRegressed {
        fact_key: String,
        current: u32,
        candidate: u32,
    },
    BrokenAuthorityLineage {
        fact_key: String,
        from_version: u32,
        to_version: u32,
    },
    OwnerMismatch { fact_key: String },
    WriterMismatch { fact_key: String },
    EpochMismatch { fact_key: String },
    LifecycleMismatch { fact_key: String },
    SnapshotCorrupt(String),
    Registry(AuthorityRegistryError),
}

impl fmt::Display for ManifestError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingField(field) => write!(f, "missing manifest field: {field}"),
            Self::EmptyField(field) => write!(f, "empty manifest field: {field}"),
            Self::UnsupportedSchemaVersion { expected, found } => write!(
                f,
                "unsupported manifest schema version: expected={expected}, found={found}"
            ),
            Self::WrongManifestOwner { expected, found } => {
                write!(f, "wrong manifest owner: expected={expected}, found={found}")
            }
            Self::ProhibitedWriteOrigin(origin) => {
                write!(f, "prohibited manifest write origin: {origin:?}")
            }
            Self::DuplicateFactMapping(fact_key) => {
                write!(f, "duplicate manifest fact mapping: {fact_key}")
            }
            Self::DuplicateAuthorityIdentity(id) => {
                write!(f, "authority identity mapped more than once: {id:?}")
            }
            Self::ManifestIdentityMismatch => write!(f, "manifest stable identity changed"),
            Self::ManifestVersionRegressed { current, candidate } => write!(
                f,
                "manifest version regressed: current={current}, candidate={candidate}"
            ),
            Self::MissingPreviousFact(fact_key) => {
                write!(f, "replacement manifest lost previous fact: {fact_key}")
            }
            Self::AuthorityIdentityChanged { fact_key } => {
                write!(f, "authority identity changed for existing fact: {fact_key}")
            }
            Self::AuthorityVersionRegressed {
                fact_key,
                current,
                candidate,
            } => write!(
                f,
                "authority version regressed for {fact_key}: current={current}, candidate={candidate}"
            ),
            Self::BrokenAuthorityLineage {
                fact_key,
                from_version,
                to_version,
            } => write!(
                f,
                "broken authority lineage for {fact_key}: {from_version} -> {to_version}"
            ),
            Self::OwnerMismatch { fact_key } => {
                write!(f, "manifest owner mismatch for fact: {fact_key}")
            }
            Self::WriterMismatch { fact_key } => {
                write!(f, "manifest writer mismatch for fact: {fact_key}")
            }
            Self::EpochMismatch { fact_key } => {
                write!(f, "manifest authority epoch mismatch for fact: {fact_key}")
            }
            Self::LifecycleMismatch { fact_key } => {
                write!(f, "manifest lifecycle mismatch for fact: {fact_key}")
            }
            Self::SnapshotCorrupt(reason) => write!(f, "manifest snapshot corrupt: {reason}"),
            Self::Registry(error) => write!(f, "authority registry error: {error}"),
        }
    }
}

impl std::error::Error for ManifestError {}

impl From<AuthorityRegistryError> for ManifestError {
    fn from(value: AuthorityRegistryError) -> Self {
        Self::Registry(value)
    }
}

impl AuthorityMappingManifest {
    pub fn create(
        registry: &AuthorityRegistry,
        request: &ManifestRequest,
    ) -> Result<(Self, ManifestUpdateReceipt), ManifestError> {
        validate_request(request)?;
        let registry_snapshot = registry.snapshot();
        let entries = entries_from_registry_snapshot(&registry_snapshot)?;
        let source_hash = required_text(request.source_hash.as_deref(), "source_hash")?.to_owned();
        let causal_parent =
            required_text(request.causal_parent.as_deref(), "causal_parent")?.to_owned();
        let source_registry_digest = registry_snapshot.evidence_digest64();
        let manifest_id = manifest_id();
        let manifest_lineage = vec![ManifestLineageEntry {
            manifest_id: manifest_id.clone(),
            action: ManifestLineageAction::Created,
            from_version: None,
            to_version: 1,
            source_registry_digest,
            source_hash: source_hash.clone(),
            causal_parent: causal_parent.clone(),
        }];

        let manifest = Self {
            schema_version: S1_01_06_MANIFEST_SCHEMA_VERSION,
            manifest_id: manifest_id.clone(),
            manifest_owner: AUTHORITY_MANIFEST_OWNER.to_owned(),
            manifest_version: 1,
            source_registry_digest,
            source_hash: source_hash.clone(),
            causal_parent: causal_parent.clone(),
            entries,
            authority_lineage: registry_snapshot.lineage,
            manifest_lineage,
        };
        manifest.validate_against_registry(registry)?;

        let receipt = ManifestUpdateReceipt {
            work_id: "S1.01.06",
            manifest_id,
            manifest_version: 1,
            entry_count: manifest.entries.len(),
            source_registry_digest,
            source_hash,
            causal_parent,
            migration: MigrationDecision::Initial,
            operands: OPERANDS,
        };
        Ok((manifest, receipt))
    }

    pub fn entry(&self, fact_key: &str) -> Option<&AuthorityMappingEntry> {
        self.entries.get(fact_key)
    }

    pub fn authority_lineage(&self) -> &[AuthorityLineageEntry] {
        &self.authority_lineage
    }

    pub fn manifest_lineage(&self) -> &[ManifestLineageEntry] {
        &self.manifest_lineage
    }

    pub fn manifest_version(&self) -> u32 {
        self.manifest_version
    }

    pub fn snapshot(&self) -> AuthorityMappingManifestSnapshot {
        AuthorityMappingManifestSnapshot {
            schema_version: self.schema_version,
            manifest_id: self.manifest_id.clone(),
            manifest_owner: self.manifest_owner.clone(),
            manifest_version: self.manifest_version,
            source_registry_digest: self.source_registry_digest,
            source_hash: self.source_hash.clone(),
            causal_parent: self.causal_parent.clone(),
            entries: self.entries.values().cloned().collect(),
            authority_lineage: self.authority_lineage.clone(),
            manifest_lineage: self.manifest_lineage.clone(),
        }
    }

    pub fn evidence_digest64(&self) -> u64 {
        self.snapshot().evidence_digest64()
    }

    pub fn restore(snapshot: AuthorityMappingManifestSnapshot) -> Result<Self, ManifestError> {
        validate_manifest_snapshot_header(&snapshot)?;
        let entries = entries_from_manifest_snapshot(&snapshot.entries)?;
        validate_manifest_lineage(&snapshot)?;

        Ok(Self {
            schema_version: snapshot.schema_version,
            manifest_id: snapshot.manifest_id,
            manifest_owner: snapshot.manifest_owner,
            manifest_version: snapshot.manifest_version,
            source_registry_digest: snapshot.source_registry_digest,
            source_hash: snapshot.source_hash,
            causal_parent: snapshot.causal_parent,
            entries,
            authority_lineage: snapshot.authority_lineage,
            manifest_lineage: snapshot.manifest_lineage,
        })
    }

    pub fn load(
        snapshot: AuthorityMappingManifestSnapshot,
        registry: &AuthorityRegistry,
    ) -> Result<Self, ManifestError> {
        let manifest = Self::restore(snapshot)?;
        manifest.validate_against_registry(registry)?;
        Ok(manifest)
    }

    pub fn replace_from_registry(
        &mut self,
        registry: &AuthorityRegistry,
        request: &ManifestRequest,
    ) -> Result<ManifestUpdateReceipt, ManifestError> {
        self.replace_from_registry_snapshot(registry.snapshot(), request)
    }

    pub fn replace_from_registry_snapshot(
        &mut self,
        registry_snapshot: AuthorityRegistrySnapshot,
        request: &ManifestRequest,
    ) -> Result<ManifestUpdateReceipt, ManifestError> {
        validate_request(request)?;

        // Validate and construct the entire candidate before mutating `self`. This is the atomic
        // boundary required by S1.01.06: a failed partial update cannot change the live manifest.
        let candidate_registry = AuthorityRegistry::restore(registry_snapshot)?;
        let candidate_snapshot = candidate_registry.snapshot();
        let candidate_entries = entries_from_registry_snapshot(&candidate_snapshot)?;
        let migration = validate_migration(
            &self.entries,
            &candidate_entries,
            &candidate_snapshot.lineage,
        )?;
        let next_version = self
            .manifest_version
            .checked_add(1)
            .ok_or_else(|| ManifestError::SnapshotCorrupt("manifest version overflow".to_owned()))?;
        let source_hash = required_text(request.source_hash.as_deref(), "source_hash")?.to_owned();
        let causal_parent =
            required_text(request.causal_parent.as_deref(), "causal_parent")?.to_owned();
        let source_registry_digest = candidate_snapshot.evidence_digest64();

        let lineage_entry = ManifestLineageEntry {
            manifest_id: self.manifest_id.clone(),
            action: ManifestLineageAction::Updated,
            from_version: Some(self.manifest_version),
            to_version: next_version,
            source_registry_digest,
            source_hash: source_hash.clone(),
            causal_parent: causal_parent.clone(),
        };

        self.manifest_version = next_version;
        self.source_registry_digest = source_registry_digest;
        self.source_hash = source_hash.clone();
        self.causal_parent = causal_parent.clone();
        self.entries = candidate_entries;
        self.authority_lineage = candidate_snapshot.lineage;
        self.manifest_lineage.push(lineage_entry);

        Ok(ManifestUpdateReceipt {
            work_id: "S1.01.06",
            manifest_id: self.manifest_id.clone(),
            manifest_version: next_version,
            entry_count: self.entries.len(),
            source_registry_digest,
            source_hash,
            causal_parent,
            migration,
            operands: OPERANDS,
        })
    }

    pub fn validate_against_registry(
        &self,
        registry: &AuthorityRegistry,
    ) -> Result<(), ManifestError> {
        let snapshot = registry.snapshot();
        if snapshot.evidence_digest64() != self.source_registry_digest {
            return Err(ManifestError::SnapshotCorrupt(
                "manifest source registry digest does not match current registry".to_owned(),
            ));
        }

        for entry in self.entries.values() {
            let record = registry.resolve(&entry.authority)?;
            if record.fact_key != entry.fact_key {
                return Err(ManifestError::SnapshotCorrupt(format!(
                    "authority reference resolved to wrong fact: {}",
                    entry.fact_key
                )));
            }
            if record.owner != entry.owner {
                return Err(ManifestError::OwnerMismatch {
                    fact_key: entry.fact_key.clone(),
                });
            }
            if record.allowed_writer != entry.allowed_writer {
                return Err(ManifestError::WriterMismatch {
                    fact_key: entry.fact_key.clone(),
                });
            }
            if record.authority_epoch != entry.authority_epoch {
                return Err(ManifestError::EpochMismatch {
                    fact_key: entry.fact_key.clone(),
                });
            }
            if record.lifecycle != entry.lifecycle {
                return Err(ManifestError::LifecycleMismatch {
                    fact_key: entry.fact_key.clone(),
                });
            }
        }
        Ok(())
    }
}

fn validate_request(request: &ManifestRequest) -> Result<(), ManifestError> {
    let schema_version = request
        .schema_version
        .ok_or(ManifestError::MissingField("schema_version"))?;
    if schema_version != S1_01_06_MANIFEST_SCHEMA_VERSION {
        return Err(ManifestError::UnsupportedSchemaVersion {
            expected: S1_01_06_MANIFEST_SCHEMA_VERSION,
            found: schema_version,
        });
    }
    let actor_owner = required_text(request.actor_owner.as_deref(), "actor_owner")?;
    if actor_owner != AUTHORITY_MANIFEST_OWNER {
        return Err(ManifestError::WrongManifestOwner {
            expected: AUTHORITY_MANIFEST_OWNER.to_owned(),
            found: actor_owner.to_owned(),
        });
    }
    let origin = request
        .origin
        .ok_or(ManifestError::MissingField("origin"))?;
    if origin != ManifestWriteOrigin::AuthorityRegistry {
        return Err(ManifestError::ProhibitedWriteOrigin(origin));
    }
    required_text(request.source_hash.as_deref(), "source_hash")?;
    required_text(request.causal_parent.as_deref(), "causal_parent")?;
    Ok(())
}

fn validate_manifest_snapshot_header(
    snapshot: &AuthorityMappingManifestSnapshot,
) -> Result<(), ManifestError> {
    if snapshot.schema_version != S1_01_06_MANIFEST_SCHEMA_VERSION {
        return Err(ManifestError::UnsupportedSchemaVersion {
            expected: S1_01_06_MANIFEST_SCHEMA_VERSION,
            found: snapshot.schema_version,
        });
    }
    if snapshot.manifest_id != manifest_id() || snapshot.manifest_owner != AUTHORITY_MANIFEST_OWNER {
        return Err(ManifestError::ManifestIdentityMismatch);
    }
    if snapshot.manifest_version == 0 {
        return Err(ManifestError::ManifestVersionRegressed {
            current: 1,
            candidate: 0,
        });
    }
    required_text(Some(&snapshot.source_hash), "source_hash")?;
    required_text(Some(&snapshot.causal_parent), "causal_parent")?;
    Ok(())
}

fn validate_manifest_lineage(
    snapshot: &AuthorityMappingManifestSnapshot,
) -> Result<(), ManifestError> {
    let last = snapshot
        .manifest_lineage
        .last()
        .ok_or_else(|| ManifestError::SnapshotCorrupt("manifest lineage is empty".to_owned()))?;
    if last.manifest_id != snapshot.manifest_id || last.to_version != snapshot.manifest_version {
        return Err(ManifestError::SnapshotCorrupt(
            "manifest lineage does not terminate at current manifest version".to_owned(),
        ));
    }
    if last.source_registry_digest != snapshot.source_registry_digest
        || last.source_hash != snapshot.source_hash
        || last.causal_parent != snapshot.causal_parent
    {
        return Err(ManifestError::SnapshotCorrupt(
            "manifest lineage source metadata mismatch".to_owned(),
        ));
    }
    Ok(())
}

fn entries_from_registry_snapshot(
    snapshot: &AuthorityRegistrySnapshot,
) -> Result<BTreeMap<String, AuthorityMappingEntry>, ManifestError> {
    let mut entries = BTreeMap::new();
    let mut identities = BTreeSet::new();

    for record in &snapshot.records {
        required_text(Some(&record.fact_key), "fact_key")?;
        required_text(Some(&record.id.namespace), "authority_namespace")?;
        required_text(Some(&record.id.local_id), "authority_local_id")?;
        required_text(Some(&record.owner), "owner")?;
        required_text(Some(&record.allowed_writer), "allowed_writer")?;
        required_text(Some(&record.causal_parent), "causal_parent")?;
        if record.version == 0 {
            return Err(ManifestError::SnapshotCorrupt(format!(
                "zero authority version for {}",
                record.fact_key
            )));
        }
        if !identities.insert(record.id.clone()) {
            return Err(ManifestError::DuplicateAuthorityIdentity(record.id.clone()));
        }
        let entry = AuthorityMappingEntry {
            fact_key: record.fact_key.clone(),
            authority: record.reference(),
            owner: record.owner.clone(),
            allowed_writer: record.allowed_writer.clone(),
            authority_epoch: record.authority_epoch,
            lifecycle: record.lifecycle,
            parent_version: record.parent_version,
            causal_parent: record.causal_parent.clone(),
        };
        if entries.insert(record.fact_key.clone(), entry).is_some() {
            return Err(ManifestError::DuplicateFactMapping(record.fact_key.clone()));
        }
    }
    Ok(entries)
}

fn entries_from_manifest_snapshot(
    source: &[AuthorityMappingEntry],
) -> Result<BTreeMap<String, AuthorityMappingEntry>, ManifestError> {
    let mut entries = BTreeMap::new();
    let mut identities = BTreeSet::new();
    for entry in source {
        required_text(Some(&entry.fact_key), "fact_key")?;
        required_text(Some(&entry.authority.id.namespace), "authority_namespace")?;
        required_text(Some(&entry.authority.id.local_id), "authority_local_id")?;
        required_text(Some(&entry.owner), "owner")?;
        required_text(Some(&entry.allowed_writer), "allowed_writer")?;
        required_text(Some(&entry.causal_parent), "causal_parent")?;
        if entry.authority.version == 0 {
            return Err(ManifestError::SnapshotCorrupt(format!(
                "zero authority version for {}",
                entry.fact_key
            )));
        }
        if !identities.insert(entry.authority.id.clone()) {
            return Err(ManifestError::DuplicateAuthorityIdentity(
                entry.authority.id.clone(),
            ));
        }
        if entries
            .insert(entry.fact_key.clone(), entry.clone())
            .is_some()
        {
            return Err(ManifestError::DuplicateFactMapping(entry.fact_key.clone()));
        }
    }
    Ok(entries)
}

fn validate_migration(
    current: &BTreeMap<String, AuthorityMappingEntry>,
    candidate: &BTreeMap<String, AuthorityMappingEntry>,
    lineage: &[AuthorityLineageEntry],
) -> Result<MigrationDecision, ManifestError> {
    let mut changed = false;
    for (fact_key, current_entry) in current {
        let candidate_entry = candidate
            .get(fact_key)
            .ok_or_else(|| ManifestError::MissingPreviousFact(fact_key.clone()))?;
        if candidate_entry.authority.id != current_entry.authority.id {
            return Err(ManifestError::AuthorityIdentityChanged {
                fact_key: fact_key.clone(),
            });
        }
        if candidate_entry.authority.version < current_entry.authority.version {
            return Err(ManifestError::AuthorityVersionRegressed {
                fact_key: fact_key.clone(),
                current: current_entry.authority.version,
                candidate: candidate_entry.authority.version,
            });
        }
        if candidate_entry.authority.version > current_entry.authority.version {
            if !lineage_connects(
                &current_entry.authority.id,
                current_entry.authority.version,
                candidate_entry.authority.version,
                lineage,
            ) {
                return Err(ManifestError::BrokenAuthorityLineage {
                    fact_key: fact_key.clone(),
                    from_version: current_entry.authority.version,
                    to_version: candidate_entry.authority.version,
                });
            }
            changed = true;
        }
        if candidate_entry.owner != current_entry.owner
            || candidate_entry.allowed_writer != current_entry.allowed_writer
        {
            return Err(ManifestError::AuthorityIdentityChanged {
                fact_key: fact_key.clone(),
            });
        }
        if candidate_entry.authority_epoch != current_entry.authority_epoch
            || candidate_entry.lifecycle != current_entry.lifecycle
        {
            changed = true;
        }
    }

    if candidate.len() != current.len() {
        changed = true;
    }

    Ok(if changed {
        MigrationDecision::ForwardCompatible
    } else {
        MigrationDecision::CompatibleNoChange
    })
}

fn lineage_connects(
    id: &AuthorityRecordId,
    from_version: u32,
    to_version: u32,
    lineage: &[AuthorityLineageEntry],
) -> bool {
    if from_version == to_version {
        return true;
    }
    let mut current = from_version;
    for entry in lineage.iter().filter(|entry| &entry.id == id) {
        if entry.from_version == Some(current) && entry.to_version > current {
            current = entry.to_version;
            if current == to_version {
                return true;
            }
        }
    }
    false
}

fn manifest_id() -> AuthorityRecordId {
    AuthorityRecordId::new(AUTHORITY_MANIFEST_NAMESPACE, AUTHORITY_MANIFEST_LOCAL_ID)
}

fn required_text<'a>(
    value: Option<&'a str>,
    field: &'static str,
) -> Result<&'a str, ManifestError> {
    let value = value.ok_or(ManifestError::MissingField(field))?;
    if value.trim().is_empty() {
        return Err(ManifestError::EmptyField(field));
    }
    Ok(value)
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
