//! Frozen L3 `S1.01.03 Canonical / Derived State 경계`.
//!
//! This module keeps canonical state authority separate from values that are recomputable,
//! transient, or observational. It deliberately does not implement canonical mutation or a future
//! cache/storage engine.

use std::collections::BTreeMap;
use std::fmt;

use crate::authority::{AuthorityReference, AuthorityRegistry, AuthorityRegistryError};

pub const S1_01_03_BOUNDARY_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum StateLayer {
    Canonical,
    Derived,
    TransientCache,
    ObservationView,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BoundaryWriteTarget {
    Canonical,
    OwnLayer,
    None,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CanonicalSourceReference {
    pub fact_key: String,
    pub authority: AuthorityReference,
    pub state_version: u64,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BoundaryCandidate {
    pub state_key: Option<String>,
    pub version: Option<u32>,
    pub layer: Option<StateLayer>,
    pub owner: Option<String>,
    pub writer: Option<String>,
    pub write_target: Option<BoundaryWriteTarget>,
    pub source: Option<CanonicalSourceReference>,
    pub causal_parent: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BoundaryResult {
    pub work_id: &'static str,
    pub state_key: String,
    pub version: u32,
    pub layer: StateLayer,
    pub owner: String,
    pub allowed_writer: Option<String>,
    pub source: CanonicalSourceReference,
    pub invalidation_reference: Option<String>,
    pub causal_parent: String,
}

impl BoundaryResult {
    pub fn evidence_digest64(&self) -> u64 {
        let encoded = format!(
            "{}|{}|{}|{:?}|{}|{:?}|{}|{}|{}|{}|{:?}|{}",
            self.work_id,
            self.state_key,
            self.version,
            self.layer,
            self.owner,
            self.allowed_writer,
            self.source.fact_key,
            self.source.authority.id.namespace,
            self.source.authority.id.local_id,
            self.source.authority.version,
            self.source.state_version,
            self.causal_parent
        );
        fnv1a64(encoded.as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BoundaryError {
    MissingField(&'static str),
    EmptyField(&'static str),
    UnsupportedVersion {
        expected: u32,
        found: u32,
    },
    Authority(AuthorityRegistryError),
    CanonicalFactMismatch {
        state_key: String,
        source_fact: String,
    },
    WrongOwner {
        expected: String,
        found: String,
    },
    WrongWriter {
        expected: String,
        found: Option<String>,
    },
    InvalidWriteTarget {
        layer: StateLayer,
        target: BoundaryWriteTarget,
    },
    ReverseCanonicalWrite {
        layer: StateLayer,
    },
    ObservationWriterDeclared(String),
    SourceRegression {
        current: u64,
        requested: u64,
    },
    DerivedNotStale(String),
    UnknownDerivedState(String),
}

impl fmt::Display for BoundaryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingField(field) => write!(f, "missing required boundary field: {field}"),
            Self::EmptyField(field) => write!(f, "empty required boundary field: {field}"),
            Self::UnsupportedVersion { expected, found } => write!(
                f,
                "unsupported boundary version: expected {expected}, found {found}"
            ),
            Self::Authority(error) => write!(f, "authority boundary failure: {error}"),
            Self::CanonicalFactMismatch {
                state_key,
                source_fact,
            } => write!(
                f,
                "canonical state key/source mismatch: state={state_key}, source={source_fact}"
            ),
            Self::WrongOwner { expected, found } => {
                write!(
                    f,
                    "boundary owner mismatch: expected={expected}, found={found}"
                )
            }
            Self::WrongWriter { expected, found } => write!(
                f,
                "boundary writer mismatch: expected={expected}, found={found:?}"
            ),
            Self::InvalidWriteTarget { layer, target } => {
                write!(
                    f,
                    "invalid boundary write target: layer={layer:?}, target={target:?}"
                )
            }
            Self::ReverseCanonicalWrite { layer } => {
                write!(
                    f,
                    "non-canonical reverse write to canonical state: {layer:?}"
                )
            }
            Self::ObservationWriterDeclared(writer) => {
                write!(
                    f,
                    "observation view is read-only; writer declared: {writer}"
                )
            }
            Self::SourceRegression { current, requested } => write!(
                f,
                "canonical source version regressed: current={current}, requested={requested}"
            ),
            Self::DerivedNotStale(key) => write!(f, "derived state is not stale: {key}"),
            Self::UnknownDerivedState(key) => write!(f, "unknown derived state: {key}"),
        }
    }
}

impl std::error::Error for BoundaryError {}

impl From<AuthorityRegistryError> for BoundaryError {
    fn from(value: AuthorityRegistryError) -> Self {
        Self::Authority(value)
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct CanonicalDerivedBoundary;

impl CanonicalDerivedBoundary {
    pub fn validate(
        &self,
        registry: &AuthorityRegistry,
        candidate: &BoundaryCandidate,
    ) -> Result<BoundaryResult, BoundaryError> {
        let state_key = required_text(candidate.state_key.as_deref(), "state_key")?;
        let version = candidate
            .version
            .ok_or(BoundaryError::MissingField("version"))?;
        if version != S1_01_03_BOUNDARY_VERSION {
            return Err(BoundaryError::UnsupportedVersion {
                expected: S1_01_03_BOUNDARY_VERSION,
                found: version,
            });
        }
        let layer = candidate
            .layer
            .ok_or(BoundaryError::MissingField("layer"))?;
        let owner = required_text(candidate.owner.as_deref(), "owner")?;
        let target = candidate
            .write_target
            .ok_or(BoundaryError::MissingField("write_target"))?;
        let source = candidate
            .source
            .as_ref()
            .ok_or(BoundaryError::MissingField("source"))?;
        let causal_parent = required_text(candidate.causal_parent.as_deref(), "causal_parent")?;

        let authority = registry.resolve_active(&source.authority)?;
        if authority.fact_key != source.fact_key {
            return Err(BoundaryError::CanonicalFactMismatch {
                state_key: source.fact_key.clone(),
                source_fact: authority.fact_key.clone(),
            });
        }

        let (allowed_writer, invalidation_reference) = match layer {
            StateLayer::Canonical => {
                if state_key != source.fact_key {
                    return Err(BoundaryError::CanonicalFactMismatch {
                        state_key: state_key.to_owned(),
                        source_fact: source.fact_key.clone(),
                    });
                }
                if owner != authority.owner {
                    return Err(BoundaryError::WrongOwner {
                        expected: authority.owner.clone(),
                        found: owner.to_owned(),
                    });
                }
                let writer = candidate.writer.clone();
                if writer.as_deref() != Some(authority.allowed_writer.as_str()) {
                    return Err(BoundaryError::WrongWriter {
                        expected: authority.allowed_writer.clone(),
                        found: writer,
                    });
                }
                if target != BoundaryWriteTarget::Canonical {
                    return Err(BoundaryError::InvalidWriteTarget { layer, target });
                }
                (Some(authority.allowed_writer.clone()), None)
            }
            StateLayer::Derived | StateLayer::TransientCache => {
                if target == BoundaryWriteTarget::Canonical {
                    return Err(BoundaryError::ReverseCanonicalWrite { layer });
                }
                if target != BoundaryWriteTarget::OwnLayer {
                    return Err(BoundaryError::InvalidWriteTarget { layer, target });
                }
                let writer = required_text(candidate.writer.as_deref(), "writer")?;
                if writer != owner {
                    return Err(BoundaryError::WrongWriter {
                        expected: owner.to_owned(),
                        found: Some(writer.to_owned()),
                    });
                }
                (
                    Some(writer.to_owned()),
                    Some(invalidation_key(state_key, source)),
                )
            }
            StateLayer::ObservationView => {
                if target == BoundaryWriteTarget::Canonical {
                    return Err(BoundaryError::ReverseCanonicalWrite { layer });
                }
                if target != BoundaryWriteTarget::None {
                    return Err(BoundaryError::InvalidWriteTarget { layer, target });
                }
                if let Some(writer) = candidate.writer.as_ref() {
                    return Err(BoundaryError::ObservationWriterDeclared(writer.clone()));
                }
                (None, None)
            }
        };

        Ok(BoundaryResult {
            work_id: "S1.01.03",
            state_key: state_key.to_owned(),
            version,
            layer,
            owner: owner.to_owned(),
            allowed_writer,
            source: source.clone(),
            invalidation_reference,
            causal_parent: causal_parent.to_owned(),
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DerivedStateRecord {
    pub state_key: String,
    pub version: u64,
    pub source: CanonicalSourceReference,
    pub stale: bool,
    pub invalidation_reference: String,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DerivedInvalidationEntry {
    pub state_key: String,
    pub previous_source_version: u64,
    pub observed_source_version: u64,
    pub invalidation_reference: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct DerivedStateSnapshot {
    pub records: Vec<DerivedStateRecord>,
    pub invalidations: Vec<DerivedInvalidationEntry>,
}

impl DerivedStateSnapshot {
    pub fn evidence_digest64(&self) -> u64 {
        let mut encoded = String::new();
        for record in &self.records {
            encoded.push_str(&format!(
                "R|{}|{}|{}|{}|{}|{}|{}|{}|{}\n",
                record.state_key,
                record.version,
                record.source.fact_key,
                record.source.authority.id.namespace,
                record.source.authority.id.local_id,
                record.source.authority.version,
                record.source.state_version,
                record.stale,
                record.invalidation_reference
            ));
        }
        for entry in &self.invalidations {
            encoded.push_str(&format!(
                "I|{}|{}|{}|{}\n",
                entry.state_key,
                entry.previous_source_version,
                entry.observed_source_version,
                entry.invalidation_reference
            ));
        }
        fnv1a64(encoded.as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct DerivedStateCache {
    records: BTreeMap<String, DerivedStateRecord>,
    invalidations: Vec<DerivedInvalidationEntry>,
}

impl DerivedStateCache {
    pub fn register(&mut self, boundary: &BoundaryResult) -> Result<(), BoundaryError> {
        if !matches!(
            boundary.layer,
            StateLayer::Derived | StateLayer::TransientCache
        ) {
            return Err(BoundaryError::InvalidWriteTarget {
                layer: boundary.layer,
                target: BoundaryWriteTarget::OwnLayer,
            });
        }
        let invalidation_reference = boundary
            .invalidation_reference
            .clone()
            .expect("derived/cache boundary result always has invalidation reference");
        self.records.insert(
            boundary.state_key.clone(),
            DerivedStateRecord {
                state_key: boundary.state_key.clone(),
                version: 1,
                source: boundary.source.clone(),
                stale: false,
                invalidation_reference,
                causal_parent: boundary.causal_parent.clone(),
            },
        );
        Ok(())
    }

    pub fn observe_source_change(
        &mut self,
        new_source: &CanonicalSourceReference,
    ) -> Result<usize, BoundaryError> {
        let mut changed = 0;
        for record in self.records.values_mut() {
            if record.source.authority.id != new_source.authority.id {
                continue;
            }
            if new_source.state_version < record.source.state_version {
                return Err(BoundaryError::SourceRegression {
                    current: record.source.state_version,
                    requested: new_source.state_version,
                });
            }
            if new_source.state_version > record.source.state_version {
                record.stale = true;
                self.invalidations.push(DerivedInvalidationEntry {
                    state_key: record.state_key.clone(),
                    previous_source_version: record.source.state_version,
                    observed_source_version: new_source.state_version,
                    invalidation_reference: record.invalidation_reference.clone(),
                });
                changed += 1;
            }
        }
        Ok(changed)
    }

    pub fn recompute(
        &mut self,
        state_key: &str,
        new_source: CanonicalSourceReference,
        causal_parent: impl Into<String>,
    ) -> Result<&DerivedStateRecord, BoundaryError> {
        let record = self
            .records
            .get_mut(state_key)
            .ok_or_else(|| BoundaryError::UnknownDerivedState(state_key.to_owned()))?;
        if !record.stale {
            return Err(BoundaryError::DerivedNotStale(state_key.to_owned()));
        }
        if record.source.authority.id != new_source.authority.id
            || new_source.state_version <= record.source.state_version
        {
            return Err(BoundaryError::SourceRegression {
                current: record.source.state_version,
                requested: new_source.state_version,
            });
        }
        record.version = record.version.saturating_add(1);
        record.source = new_source;
        record.stale = false;
        record.causal_parent = causal_parent.into();
        Ok(record)
    }

    pub fn remove(&mut self, state_key: &str) -> Option<DerivedStateRecord> {
        self.records.remove(state_key)
    }

    pub fn get(&self, state_key: &str) -> Option<&DerivedStateRecord> {
        self.records.get(state_key)
    }

    pub fn snapshot(&self) -> DerivedStateSnapshot {
        DerivedStateSnapshot {
            records: self.records.values().cloned().collect(),
            invalidations: self.invalidations.clone(),
        }
    }

    pub fn restore(snapshot: DerivedStateSnapshot) -> Self {
        Self {
            records: snapshot
                .records
                .into_iter()
                .map(|record| (record.state_key.clone(), record))
                .collect(),
            invalidations: snapshot.invalidations,
        }
    }
}

fn required_text<'a>(
    value: Option<&'a str>,
    field: &'static str,
) -> Result<&'a str, BoundaryError> {
    let value = value.ok_or(BoundaryError::MissingField(field))?;
    if value.trim().is_empty() {
        return Err(BoundaryError::EmptyField(field));
    }
    Ok(value)
}

fn invalidation_key(state_key: &str, source: &CanonicalSourceReference) -> String {
    format!(
        "S1.01.03:{}:{}:{}:{}:{}",
        state_key,
        source.fact_key,
        source.authority.id.namespace,
        source.authority.id.local_id,
        source.state_version
    )
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
