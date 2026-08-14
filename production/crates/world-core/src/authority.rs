//! Frozen L3 `S1.01.02 Canonical Authority Registry`.
//!
//! This registry records semantic ownership and versioned references. It does not implement the
//! later Stable Entity ID system from WP-002, physical placement, or canonical commit machinery.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

use crate::{S1_01_01_CONTRACT_VERSION, StateClass, ValidationReceipt};

pub const S1_01_02_REGISTRY_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct AuthorityRecordId {
    pub namespace: String,
    pub local_id: String,
}

impl AuthorityRecordId {
    pub fn new(namespace: impl Into<String>, local_id: impl Into<String>) -> Self {
        Self {
            namespace: namespace.into(),
            local_id: local_id.into(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum AuthorityLifecycle {
    Active,
    Inactive,
    Tombstone,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ReadOnlyRole {
    Derived,
    Observer,
    Renderer,
    Analytics,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthorityReference {
    pub id: AuthorityRecordId,
    pub version: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthorityRecord {
    pub id: AuthorityRecordId,
    pub fact_key: String,
    pub owner: String,
    pub allowed_writer: String,
    pub authority_epoch: u64,
    pub version: u32,
    pub lifecycle: AuthorityLifecycle,
    pub parent_version: Option<u32>,
    pub causal_parent: String,
}

impl AuthorityRecord {
    pub fn reference(&self) -> AuthorityReference {
        AuthorityReference {
            id: self.id.clone(),
            version: self.version,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LineageAction {
    Created,
    Updated,
    Retired,
    Tombstoned,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthorityLineageEntry {
    pub id: AuthorityRecordId,
    pub action: LineageAction,
    pub from_version: Option<u32>,
    pub to_version: u32,
    pub authority_epoch: u64,
    pub causal_parent: String,
}

#[derive(Debug, Clone)]
pub struct AuthorityRegistration {
    pub id: AuthorityRecordId,
    pub fact_key: String,
    pub owner: String,
    pub allowed_writer: String,
    pub authority_epoch: u64,
    pub source_contract: ValidationReceipt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AuthorityRegistryError {
    EmptyIdentityField(&'static str),
    UnsupportedRegistryVersion {
        expected: u32,
        found: u32,
    },
    SourceContractVersionMismatch {
        expected: u32,
        found: u32,
    },
    SourceFactMismatch {
        source: String,
        requested: String,
    },
    SourceOwnerMismatch {
        source: String,
        requested: String,
    },
    SourceWriterMismatch {
        source: String,
        requested: String,
    },
    NonCanonicalOwnerState {
        state_class: StateClass,
    },
    DuplicateIdentity(AuthorityRecordId),
    RetiredIdentityReuse(AuthorityRecordId),
    DuplicateFactOwner {
        fact_key: String,
        existing_owner: String,
        requested_owner: String,
    },
    NamespaceOwnerConflict {
        namespace: String,
        existing_owner: String,
        requested_owner: String,
    },
    WrongOwner {
        expected: String,
        found: String,
    },
    InvalidAuthorityEpoch {
        current: u64,
        requested: u64,
    },
    DanglingReference(AuthorityRecordId),
    StaleReference {
        expected: u32,
        found: u32,
    },
    ReferenceNotActive(AuthorityLifecycle),
    InvalidLifecycleTransition {
        from: AuthorityLifecycle,
        to: AuthorityLifecycle,
    },
    UnknownFact(String),
    SnapshotCorrupt(String),
}

impl fmt::Display for AuthorityRegistryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyIdentityField(field) => write!(f, "empty authority identity field: {field}"),
            Self::UnsupportedRegistryVersion { expected, found } => write!(
                f,
                "unsupported registry version: expected {expected}, found {found}"
            ),
            Self::SourceContractVersionMismatch { expected, found } => write!(
                f,
                "source contract version mismatch: expected {expected}, found {found}"
            ),
            Self::SourceFactMismatch { source, requested } => write!(
                f,
                "source fact mismatch: source={source}, requested={requested}"
            ),
            Self::SourceOwnerMismatch { source, requested } => write!(
                f,
                "source owner mismatch: source={source}, requested={requested}"
            ),
            Self::SourceWriterMismatch { source, requested } => write!(
                f,
                "source writer mismatch: source={source}, requested={requested}"
            ),
            Self::NonCanonicalOwnerState { state_class } => {
                write!(
                    f,
                    "non-canonical state cannot own canonical authority: {state_class:?}"
                )
            }
            Self::DuplicateIdentity(id) => write!(f, "duplicate authority identity: {id:?}"),
            Self::RetiredIdentityReuse(id) => {
                write!(f, "retired authority identity reused: {id:?}")
            }
            Self::DuplicateFactOwner {
                fact_key,
                existing_owner,
                requested_owner,
            } => write!(
                f,
                "fact already has canonical owner: fact={fact_key}, existing={existing_owner}, requested={requested_owner}"
            ),
            Self::NamespaceOwnerConflict {
                namespace,
                existing_owner,
                requested_owner,
            } => write!(
                f,
                "authority namespace owner conflict: namespace={namespace}, existing={existing_owner}, requested={requested_owner}"
            ),
            Self::WrongOwner { expected, found } => {
                write!(
                    f,
                    "wrong authority owner/writer: expected={expected}, found={found}"
                )
            }
            Self::InvalidAuthorityEpoch { current, requested } => write!(
                f,
                "authority epoch must advance: current={current}, requested={requested}"
            ),
            Self::DanglingReference(id) => write!(f, "dangling authority reference: {id:?}"),
            Self::StaleReference { expected, found } => {
                write!(
                    f,
                    "stale authority reference: expected={expected}, found={found}"
                )
            }
            Self::ReferenceNotActive(lifecycle) => {
                write!(f, "authority reference is not active: {lifecycle:?}")
            }
            Self::InvalidLifecycleTransition { from, to } => {
                write!(
                    f,
                    "invalid authority lifecycle transition: {from:?} -> {to:?}"
                )
            }
            Self::UnknownFact(fact_key) => write!(f, "unknown canonical fact: {fact_key}"),
            Self::SnapshotCorrupt(reason) => write!(f, "authority snapshot corrupt: {reason}"),
        }
    }
}

impl std::error::Error for AuthorityRegistryError {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthorityRegistrySnapshot {
    pub registry_version: u32,
    pub records: Vec<AuthorityRecord>,
    pub namespace_owners: Vec<(String, String)>,
    pub read_only_access: Vec<(String, Vec<ReadOnlyRole>)>,
    pub lineage: Vec<AuthorityLineageEntry>,
}

impl AuthorityRegistrySnapshot {
    pub fn evidence_digest64(&self) -> u64 {
        let mut canonical = format!("registry:{}\n", self.registry_version);

        for record in &self.records {
            canonical.push_str(&format!(
                "R|{}|{}|{}|{}|{}|{}|{}|{:?}|{:?}|{}\n",
                record.id.namespace,
                record.id.local_id,
                record.fact_key,
                record.owner,
                record.allowed_writer,
                record.authority_epoch,
                record.version,
                record.lifecycle,
                record.parent_version,
                record.causal_parent
            ));
        }
        for (namespace, owner) in &self.namespace_owners {
            canonical.push_str(&format!("N|{namespace}|{owner}\n"));
        }
        for (fact_key, roles) in &self.read_only_access {
            canonical.push_str(&format!("A|{fact_key}|{roles:?}\n"));
        }
        for entry in &self.lineage {
            canonical.push_str(&format!(
                "L|{}|{}|{:?}|{:?}|{}|{}|{}\n",
                entry.id.namespace,
                entry.id.local_id,
                entry.action,
                entry.from_version,
                entry.to_version,
                entry.authority_epoch,
                entry.causal_parent
            ));
        }

        fnv1a64(canonical.as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthorityRegistry {
    registry_version: u32,
    records: BTreeMap<AuthorityRecordId, AuthorityRecord>,
    fact_index: BTreeMap<String, AuthorityRecordId>,
    namespace_owners: BTreeMap<String, String>,
    read_only_access: BTreeMap<String, BTreeSet<ReadOnlyRole>>,
    lineage: Vec<AuthorityLineageEntry>,
}

impl Default for AuthorityRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl AuthorityRegistry {
    pub fn new() -> Self {
        Self {
            registry_version: S1_01_02_REGISTRY_VERSION,
            records: BTreeMap::new(),
            fact_index: BTreeMap::new(),
            namespace_owners: BTreeMap::new(),
            read_only_access: BTreeMap::new(),
            lineage: Vec::new(),
        }
    }

    pub fn register(
        &mut self,
        registration: AuthorityRegistration,
    ) -> Result<AuthorityReference, AuthorityRegistryError> {
        validate_identity(&registration.id)?;
        validate_non_empty(&registration.fact_key, "fact_key")?;
        validate_non_empty(&registration.owner, "owner")?;
        validate_non_empty(&registration.allowed_writer, "allowed_writer")?;

        if registration.source_contract.contract_version != S1_01_01_CONTRACT_VERSION {
            return Err(AuthorityRegistryError::SourceContractVersionMismatch {
                expected: S1_01_01_CONTRACT_VERSION,
                found: registration.source_contract.contract_version,
            });
        }
        if !registration
            .source_contract
            .state_class
            .is_canonical_plane()
        {
            return Err(AuthorityRegistryError::NonCanonicalOwnerState {
                state_class: registration.source_contract.state_class,
            });
        }
        if registration.source_contract.fact_key != registration.fact_key {
            return Err(AuthorityRegistryError::SourceFactMismatch {
                source: registration.source_contract.fact_key,
                requested: registration.fact_key,
            });
        }
        if registration.source_contract.owner != registration.owner {
            return Err(AuthorityRegistryError::SourceOwnerMismatch {
                source: registration.source_contract.owner,
                requested: registration.owner,
            });
        }
        if registration.source_contract.writer != registration.allowed_writer {
            return Err(AuthorityRegistryError::SourceWriterMismatch {
                source: registration.source_contract.writer,
                requested: registration.allowed_writer,
            });
        }
        if registration.allowed_writer != registration.owner {
            return Err(AuthorityRegistryError::WrongOwner {
                expected: registration.owner,
                found: registration.allowed_writer,
            });
        }

        if let Some(existing_owner) = self.namespace_owners.get(&registration.id.namespace) {
            if existing_owner != &registration.owner {
                return Err(AuthorityRegistryError::NamespaceOwnerConflict {
                    namespace: registration.id.namespace,
                    existing_owner: existing_owner.clone(),
                    requested_owner: registration.owner,
                });
            }
        }

        if let Some(existing) = self.records.get(&registration.id) {
            return if matches!(
                existing.lifecycle,
                AuthorityLifecycle::Inactive | AuthorityLifecycle::Tombstone
            ) {
                Err(AuthorityRegistryError::RetiredIdentityReuse(
                    registration.id,
                ))
            } else {
                Err(AuthorityRegistryError::DuplicateIdentity(registration.id))
            };
        }

        if let Some(existing_id) = self.fact_index.get(&registration.fact_key) {
            let existing = self
                .records
                .get(existing_id)
                .expect("fact index must reference existing authority record");
            return Err(AuthorityRegistryError::DuplicateFactOwner {
                fact_key: registration.fact_key,
                existing_owner: existing.owner.clone(),
                requested_owner: registration.owner,
            });
        }

        let record = AuthorityRecord {
            id: registration.id.clone(),
            fact_key: registration.fact_key.clone(),
            owner: registration.owner.clone(),
            allowed_writer: registration.allowed_writer,
            authority_epoch: registration.authority_epoch,
            version: 1,
            lifecycle: AuthorityLifecycle::Active,
            parent_version: None,
            causal_parent: registration.source_contract.causal_parent.clone(),
        };
        let reference = record.reference();

        self.namespace_owners
            .entry(registration.id.namespace.clone())
            .or_insert(registration.owner);
        self.fact_index
            .insert(registration.fact_key, registration.id.clone());
        self.records.insert(registration.id.clone(), record);
        self.lineage.push(AuthorityLineageEntry {
            id: registration.id,
            action: LineageAction::Created,
            from_version: None,
            to_version: reference.version,
            authority_epoch: registration.authority_epoch,
            causal_parent: registration.source_contract.causal_parent,
        });

        Ok(reference)
    }

    pub fn reference_for_fact(
        &self,
        fact_key: &str,
    ) -> Result<AuthorityReference, AuthorityRegistryError> {
        let id = self
            .fact_index
            .get(fact_key)
            .ok_or_else(|| AuthorityRegistryError::UnknownFact(fact_key.to_owned()))?;
        let record = self
            .records
            .get(id)
            .ok_or_else(|| AuthorityRegistryError::DanglingReference(id.clone()))?;
        Ok(record.reference())
    }

    pub fn resolve(
        &self,
        reference: &AuthorityReference,
    ) -> Result<&AuthorityRecord, AuthorityRegistryError> {
        let record = self
            .records
            .get(&reference.id)
            .ok_or_else(|| AuthorityRegistryError::DanglingReference(reference.id.clone()))?;
        if record.version != reference.version {
            return Err(AuthorityRegistryError::StaleReference {
                expected: record.version,
                found: reference.version,
            });
        }
        Ok(record)
    }

    pub fn resolve_active(
        &self,
        reference: &AuthorityReference,
    ) -> Result<&AuthorityRecord, AuthorityRegistryError> {
        let record = self.resolve(reference)?;
        if record.lifecycle != AuthorityLifecycle::Active {
            return Err(AuthorityRegistryError::ReferenceNotActive(record.lifecycle));
        }
        Ok(record)
    }

    pub fn register_read_only_role(
        &mut self,
        fact_key: &str,
        role: ReadOnlyRole,
    ) -> Result<(), AuthorityRegistryError> {
        if !self.fact_index.contains_key(fact_key) {
            return Err(AuthorityRegistryError::UnknownFact(fact_key.to_owned()));
        }
        self.read_only_access
            .entry(fact_key.to_owned())
            .or_default()
            .insert(role);
        Ok(())
    }

    pub fn read_only_roles(
        &self,
        fact_key: &str,
    ) -> Result<Vec<ReadOnlyRole>, AuthorityRegistryError> {
        if !self.fact_index.contains_key(fact_key) {
            return Err(AuthorityRegistryError::UnknownFact(fact_key.to_owned()));
        }
        Ok(self
            .read_only_access
            .get(fact_key)
            .map(|roles| roles.iter().copied().collect())
            .unwrap_or_default())
    }

    pub fn update_epoch(
        &mut self,
        reference: &AuthorityReference,
        writer: &str,
        new_epoch: u64,
        causal_parent: impl Into<String>,
    ) -> Result<AuthorityReference, AuthorityRegistryError> {
        let current = self.resolve_active(reference)?.clone();
        if current.owner != writer {
            return Err(AuthorityRegistryError::WrongOwner {
                expected: current.owner,
                found: writer.to_owned(),
            });
        }
        if new_epoch <= current.authority_epoch {
            return Err(AuthorityRegistryError::InvalidAuthorityEpoch {
                current: current.authority_epoch,
                requested: new_epoch,
            });
        }

        self.transition_record(
            &current,
            AuthorityLifecycle::Active,
            LineageAction::Updated,
            new_epoch,
            causal_parent.into(),
        )
    }

    pub fn retire(
        &mut self,
        reference: &AuthorityReference,
        writer: &str,
        new_epoch: u64,
        causal_parent: impl Into<String>,
    ) -> Result<AuthorityReference, AuthorityRegistryError> {
        let current = self.resolve_active(reference)?.clone();
        if current.owner != writer {
            return Err(AuthorityRegistryError::WrongOwner {
                expected: current.owner,
                found: writer.to_owned(),
            });
        }
        if new_epoch <= current.authority_epoch {
            return Err(AuthorityRegistryError::InvalidAuthorityEpoch {
                current: current.authority_epoch,
                requested: new_epoch,
            });
        }

        self.transition_record(
            &current,
            AuthorityLifecycle::Inactive,
            LineageAction::Retired,
            new_epoch,
            causal_parent.into(),
        )
    }

    pub fn tombstone(
        &mut self,
        reference: &AuthorityReference,
        writer: &str,
        new_epoch: u64,
        causal_parent: impl Into<String>,
    ) -> Result<AuthorityReference, AuthorityRegistryError> {
        let current = self.resolve(reference)?.clone();
        if current.lifecycle != AuthorityLifecycle::Inactive {
            return Err(AuthorityRegistryError::InvalidLifecycleTransition {
                from: current.lifecycle,
                to: AuthorityLifecycle::Tombstone,
            });
        }
        if current.owner != writer {
            return Err(AuthorityRegistryError::WrongOwner {
                expected: current.owner,
                found: writer.to_owned(),
            });
        }
        if new_epoch <= current.authority_epoch {
            return Err(AuthorityRegistryError::InvalidAuthorityEpoch {
                current: current.authority_epoch,
                requested: new_epoch,
            });
        }

        self.transition_record(
            &current,
            AuthorityLifecycle::Tombstone,
            LineageAction::Tombstoned,
            new_epoch,
            causal_parent.into(),
        )
    }

    pub fn lineage(&self) -> &[AuthorityLineageEntry] {
        &self.lineage
    }

    pub fn snapshot(&self) -> AuthorityRegistrySnapshot {
        AuthorityRegistrySnapshot {
            registry_version: self.registry_version,
            records: self.records.values().cloned().collect(),
            namespace_owners: self
                .namespace_owners
                .iter()
                .map(|(namespace, owner)| (namespace.clone(), owner.clone()))
                .collect(),
            read_only_access: self
                .read_only_access
                .iter()
                .map(|(fact_key, roles)| {
                    (fact_key.clone(), roles.iter().copied().collect::<Vec<_>>())
                })
                .collect(),
            lineage: self.lineage.clone(),
        }
    }

    pub fn restore(snapshot: AuthorityRegistrySnapshot) -> Result<Self, AuthorityRegistryError> {
        if snapshot.registry_version != S1_01_02_REGISTRY_VERSION {
            return Err(AuthorityRegistryError::UnsupportedRegistryVersion {
                expected: S1_01_02_REGISTRY_VERSION,
                found: snapshot.registry_version,
            });
        }

        let mut registry = Self::new();
        registry.registry_version = snapshot.registry_version;

        for (namespace, owner) in snapshot.namespace_owners {
            if registry
                .namespace_owners
                .insert(namespace.clone(), owner)
                .is_some()
            {
                return Err(AuthorityRegistryError::SnapshotCorrupt(format!(
                    "duplicate namespace owner entry: {namespace}"
                )));
            }
        }

        for record in snapshot.records {
            validate_identity(&record.id)?;
            if registry.records.contains_key(&record.id) {
                return Err(AuthorityRegistryError::SnapshotCorrupt(format!(
                    "duplicate authority id: {:?}",
                    record.id
                )));
            }
            if registry.fact_index.contains_key(&record.fact_key) {
                return Err(AuthorityRegistryError::SnapshotCorrupt(format!(
                    "duplicate fact owner: {}",
                    record.fact_key
                )));
            }
            match registry.namespace_owners.get(&record.id.namespace) {
                Some(owner) if owner == &record.owner => {}
                _ => {
                    return Err(AuthorityRegistryError::SnapshotCorrupt(format!(
                        "namespace owner mismatch for {:?}",
                        record.id
                    )));
                }
            }
            registry
                .fact_index
                .insert(record.fact_key.clone(), record.id.clone());
            registry.records.insert(record.id.clone(), record);
        }

        for (fact_key, roles) in snapshot.read_only_access {
            if !registry.fact_index.contains_key(&fact_key) {
                return Err(AuthorityRegistryError::SnapshotCorrupt(format!(
                    "read-only access references unknown fact: {fact_key}"
                )));
            }
            registry
                .read_only_access
                .insert(fact_key, roles.into_iter().collect());
        }

        for entry in &snapshot.lineage {
            if !registry.records.contains_key(&entry.id) {
                return Err(AuthorityRegistryError::SnapshotCorrupt(format!(
                    "lineage references dangling id: {:?}",
                    entry.id
                )));
            }
        }
        registry.lineage = snapshot.lineage;

        Ok(registry)
    }

    fn transition_record(
        &mut self,
        current: &AuthorityRecord,
        lifecycle: AuthorityLifecycle,
        action: LineageAction,
        new_epoch: u64,
        causal_parent: String,
    ) -> Result<AuthorityReference, AuthorityRegistryError> {
        let new_version = current.version.checked_add(1).ok_or_else(|| {
            AuthorityRegistryError::SnapshotCorrupt("authority version overflow".to_owned())
        })?;
        let record = self
            .records
            .get_mut(&current.id)
            .ok_or_else(|| AuthorityRegistryError::DanglingReference(current.id.clone()))?;

        record.parent_version = Some(current.version);
        record.version = new_version;
        record.authority_epoch = new_epoch;
        record.lifecycle = lifecycle;
        record.causal_parent = causal_parent.clone();

        self.lineage.push(AuthorityLineageEntry {
            id: current.id.clone(),
            action,
            from_version: Some(current.version),
            to_version: new_version,
            authority_epoch: new_epoch,
            causal_parent,
        });

        Ok(record.reference())
    }
}

fn validate_identity(id: &AuthorityRecordId) -> Result<(), AuthorityRegistryError> {
    validate_non_empty(&id.namespace, "namespace")?;
    validate_non_empty(&id.local_id, "local_id")?;
    Ok(())
}

fn validate_non_empty(value: &str, field: &'static str) -> Result<(), AuthorityRegistryError> {
    if value.trim().is_empty() {
        return Err(AuthorityRegistryError::EmptyIdentityField(field));
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
