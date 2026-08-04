#![forbid(unsafe_code)]

mod performance;
mod world_save;

pub use performance::{
    BenchmarkConfiguration, DurationSummary, HardwareProfile, PerformanceRunManifest,
    PerformanceRunValidationError, ThroughputSummary, PERFORMANCE_RUN_SCHEMA_VERSION,
    STAGE0_BASELINE_BENCHMARK_ID,
};
pub use world_save::{
    EventPosition, KernelStateRecord, ModuleStateManifest, RandomStateManifest, WorldSaveManifest,
    WorldSaveValidationError, KERNEL_MODULE_ID, KERNEL_STATE_SCHEMA_VERSION,
    WORLD_SAVE_SCHEMA_VERSION,
};

use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fmt};

pub const RENDER_SNAPSHOT_SCHEMA_VERSION: &str = "render-snapshot.v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SnapshotSource {
    Kernel,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LodLevel {
    #[serde(rename = "A")]
    A,
    #[serde(rename = "B")]
    B,
    #[serde(rename = "C")]
    C,
    #[serde(rename = "D")]
    D,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct LodCounts {
    #[serde(rename = "A")]
    pub a: u64,
    #[serde(rename = "B")]
    pub b: u64,
    #[serde(rename = "C")]
    pub c: u64,
    #[serde(rename = "D")]
    pub d: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderRegion {
    pub id: u64,
    pub x: f64,
    pub z: f64,
    pub size: f64,
    pub lod: LodLevel,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RenderEntityKind {
    Agent,
    Object,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderEntity {
    pub id: u64,
    pub kind: RenderEntityKind,
    pub x: f64,
    pub z: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EventSeverity {
    Info,
    Warning,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventMarker {
    pub id: u64,
    pub x: f64,
    pub z: f64,
    pub severity: EventSeverity,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderSnapshot {
    pub schema_version: String,
    pub source: SnapshotSource,
    pub tick: u64,
    pub seed: u64,
    pub digest: String,
    pub lod_counts: LodCounts,
    pub regions: Vec<RenderRegion>,
    pub entities: Vec<RenderEntity>,
    pub events: Vec<EventMarker>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SnapshotValidationError {
    SchemaVersion(String),
    Digest(String),
    DuplicateRegion(u64),
    InvalidRegion(u64),
    DuplicateEntity(u64),
    InvalidEntity(u64),
    DuplicateEvent(u64),
    InvalidEvent(u64),
}

impl fmt::Display for SnapshotValidationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::SchemaVersion(version) => {
                write!(formatter, "unsupported schema version: {version}")
            }
            Self::Digest(digest) => write!(formatter, "invalid deterministic digest: {digest}"),
            Self::DuplicateRegion(id) => write!(formatter, "duplicate region id: {id}"),
            Self::InvalidRegion(id) => write!(formatter, "invalid region geometry: {id}"),
            Self::DuplicateEntity(id) => write!(formatter, "duplicate entity id: {id}"),
            Self::InvalidEntity(id) => write!(formatter, "invalid entity position: {id}"),
            Self::DuplicateEvent(id) => write!(formatter, "duplicate event id: {id}"),
            Self::InvalidEvent(id) => write!(formatter, "invalid event position: {id}"),
        }
    }
}

impl std::error::Error for SnapshotValidationError {}

impl RenderSnapshot {
    #[must_use]
    pub fn kernel(tick: u64, seed: u64, digest: String) -> Self {
        Self {
            schema_version: RENDER_SNAPSHOT_SCHEMA_VERSION.to_owned(),
            source: SnapshotSource::Kernel,
            tick,
            seed,
            digest,
            lod_counts: LodCounts::default(),
            regions: Vec::new(),
            entities: Vec::new(),
            events: Vec::new(),
        }
    }

    /// Validates the versioned read-only snapshot contract.
    ///
    /// # Errors
    ///
    /// Returns [`SnapshotValidationError`] when the schema identifier, digest,
    /// identifiers, or finite spatial values violate the contract.
    pub fn validate(&self) -> Result<(), SnapshotValidationError> {
        self.validate_header()?;
        validate_regions(&self.regions)?;
        validate_entities(&self.entities)?;
        validate_events(&self.events)
    }

    fn validate_header(&self) -> Result<(), SnapshotValidationError> {
        if self.schema_version != RENDER_SNAPSHOT_SCHEMA_VERSION {
            return Err(SnapshotValidationError::SchemaVersion(
                self.schema_version.clone(),
            ));
        }

        if self.digest.len() != 16 || !self.digest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err(SnapshotValidationError::Digest(self.digest.clone()));
        }

        Ok(())
    }
}

fn validate_regions(regions: &[RenderRegion]) -> Result<(), SnapshotValidationError> {
    let mut ids = HashSet::with_capacity(regions.len());
    for region in regions {
        if !ids.insert(region.id) {
            return Err(SnapshotValidationError::DuplicateRegion(region.id));
        }
        if !region.x.is_finite()
            || !region.z.is_finite()
            || !region.size.is_finite()
            || region.size <= 0.0
        {
            return Err(SnapshotValidationError::InvalidRegion(region.id));
        }
    }
    Ok(())
}

fn validate_entities(entities: &[RenderEntity]) -> Result<(), SnapshotValidationError> {
    let mut ids = HashSet::with_capacity(entities.len());
    for entity in entities {
        if !ids.insert(entity.id) {
            return Err(SnapshotValidationError::DuplicateEntity(entity.id));
        }
        if !entity.x.is_finite() || !entity.z.is_finite() || !entity.height.is_finite() {
            return Err(SnapshotValidationError::InvalidEntity(entity.id));
        }
    }
    Ok(())
}

fn validate_events(events: &[EventMarker]) -> Result<(), SnapshotValidationError> {
    let mut ids = HashSet::with_capacity(events.len());
    for event in events {
        if !ids.insert(event.id) {
            return Err(SnapshotValidationError::DuplicateEvent(event.id));
        }
        if !event.x.is_finite() || !event.z.is_finite() {
            return Err(SnapshotValidationError::InvalidEvent(event.id));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{RenderSnapshot, SnapshotValidationError};

    #[test]
    fn kernel_snapshot_round_trips_through_json() {
        let snapshot = RenderSnapshot::kernel(10_000, 42, "40885885fe2db25d".to_owned());
        snapshot.validate().expect("snapshot should be valid");

        let json = serde_json::to_string(&snapshot).expect("snapshot should serialize");
        let restored: RenderSnapshot =
            serde_json::from_str(&json).expect("snapshot should deserialize");

        assert_eq!(restored, snapshot);
    }

    #[test]
    fn invalid_digest_is_rejected() {
        let snapshot = RenderSnapshot::kernel(0, 1, "not-a-digest".to_owned());

        assert!(matches!(
            snapshot.validate(),
            Err(SnapshotValidationError::Digest(_))
        ));
    }
}
