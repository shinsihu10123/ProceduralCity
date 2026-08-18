#![forbid(unsafe_code)]
//! Frozen WP-008 / S4.01.01…S4.01.08 celestial-state execution boundary.
//!
//! PA-057 authority is preserved: Domain 1 owns CelestialWorldState. This crate does not grant
//! Observer/Renderer/Analytics authority and does not make calendar or season labels canonical.

use gaonn_planetary_space_core::Acceptance as SpaceAcceptance;
use gaonn_world_time_core::{WorldTimeState, Wp004Acceptance};
use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

pub const SCHEMA_VERSION: u32 = 1;
pub const OWNER: &str = "domain01.celestial_world_state";
pub const MEMBER_IDS: [&str; 8] = [
    "S4.01.01",
    "S4.01.02",
    "S4.01.03",
    "S4.01.04",
    "S4.01.05",
    "S4.01.06",
    "S4.01.07",
    "S4.01.08",
];

pub type Vector3 = [f64; 3];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteOrigin {
    OwningResolver,
    Derived,
    Observer,
    Renderer,
    Analytics,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecordStatus {
    Active,
    Retired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CandidateDisposition {
    CandidateOnly,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VersionRef {
    pub stable_id: String,
    pub namespace: String,
    pub version: u32,
    pub owner: String,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StateIdentity {
    pub stable_id: String,
    pub namespace: String,
    pub version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub predecessor: Option<VersionRef>,
    pub status: RecordStatus,
}

impl StateIdentity {
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
pub struct Wp008Admission {
    pub space_evidence_digest64: u64,
    pub time_evidence_digest64: u64,
}

pub fn admit(
    space: &SpaceAcceptance,
    time: &Wp004Acceptance,
) -> Result<Wp008Admission, CelestialError> {
    if !space.closed
        || space.work_package != "WP-003"
        || space.evidence_digest == 0
        || !time.closed
        || time.work_package != "WP-004"
        || time.evidence_digest64 == 0
    {
        return Err(CelestialError::InvalidPredecessor);
    }
    Ok(Wp008Admission {
        space_evidence_digest64: space.evidence_digest,
        time_evidence_digest64: time.evidence_digest64,
    })
}

#[derive(Debug, Clone, PartialEq)]
pub struct ContractInput {
    pub celestial_id: String,
    pub frame_id: String,
    pub source_version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub world_time: WorldTimeState,
    pub transition: String,
    pub allowed_transitions: BTreeSet<String>,
    pub origin: WriteOrigin,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContractReceipt {
    pub work_id: &'static str,
    pub celestial_id: String,
    pub frame_id: String,
    pub source_version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub world_epoch_id: String,
    pub world_tick: i128,
    pub transition: String,
    pub disposition: CandidateDisposition,
    pub operands: [&'static str; 2],
}

/// S4.01.01 — Celestial State semantic contract.
pub fn validate_contract(
    admission: &Wp008Admission,
    input: &ContractInput,
) -> Result<ContractReceipt, CelestialError> {
    if admission.space_evidence_digest64 == 0 || admission.time_evidence_digest64 == 0 {
        return Err(CelestialError::InvalidPredecessor);
    }
    required(&input.celestial_id, "celestial_id")?;
    required(&input.frame_id, "frame_id")?;
    required(&input.owner, "owner")?;
    required(&input.causal_parent, "causal_parent")?;
    required(&input.transition, "transition")?;
    if input.source_version != SCHEMA_VERSION {
        return Err(CelestialError::StaleVersion {
            expected: SCHEMA_VERSION,
            found: input.source_version,
        });
    }
    validate_write(&input.owner, input.origin)?;
    input
        .world_time
        .validate()
        .map_err(|_| CelestialError::InvalidWorldTime)?;
    if !input.allowed_transitions.contains(&input.transition) {
        return Err(CelestialError::ProhibitedTransition(input.transition.clone()));
    }
    Ok(ContractReceipt {
        work_id: "S4.01.01",
        celestial_id: input.celestial_id.clone(),
        frame_id: input.frame_id.clone(),
        source_version: input.source_version,
        owner: input.owner.clone(),
        causal_parent: input.causal_parent.clone(),
        world_epoch_id: input.world_time.epoch.id.clone(),
        world_tick: input.world_time.tick,
        transition: input.transition.clone(),
        disposition: CandidateDisposition::CandidateOnly,
        operands: ["Celestial", "Frame"],
    })
}

#[derive(Debug, Clone, PartialEq)]
pub struct FrameRecord {
    pub identity: StateIdentity,
    pub celestial_id: String,
    pub origin: Vector3,
    pub x_axis: Vector3,
    pub y_axis: Vector3,
    pub z_axis: Vector3,
    pub reference_epoch_id: String,
    pub reference_tick: i128,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct FrameRegistry {
    records: BTreeMap<String, FrameRecord>,
}

impl FrameRegistry {
    /// S4.01.02 — create boundary for Reference Celestial Frame.
    pub fn create(
        &mut self,
        receipt: &ContractReceipt,
        record: FrameRecord,
        origin: WriteOrigin,
    ) -> Result<VersionRef, CelestialError> {
        validate_write(&record.identity.owner, origin)?;
        validate_receipt_identity(receipt, &record.identity, &record.celestial_id)?;
        if record.identity.version != 1 || record.identity.predecessor.is_some() {
            return Err(CelestialError::InvalidInitialVersion(record.identity.version));
        }
        validate_frame_geometry(&record)?;
        if self.records.contains_key(&record.identity.stable_id) {
            return Err(CelestialError::DuplicateStableId(
                record.identity.stable_id.clone(),
            ));
        }
        let reference = record.identity.reference();
        self.records.insert(record.identity.stable_id.clone(), record);
        Ok(reference)
    }

    pub fn get(&self, stable_id: &str) -> Result<&FrameRecord, CelestialError> {
        let record = self
            .records
            .get(stable_id)
            .ok_or_else(|| CelestialError::DanglingReference(stable_id.to_owned()))?;
        if record.identity.status == RecordStatus::Retired {
            return Err(CelestialError::RetiredRecord(stable_id.to_owned()));
        }
        Ok(record)
    }

    pub fn update(
        &mut self,
        receipt: &ContractReceipt,
        record: FrameRecord,
        origin: WriteOrigin,
    ) -> Result<VersionRef, CelestialError> {
        validate_write(&record.identity.owner, origin)?;
        validate_receipt_identity(receipt, &record.identity, &record.celestial_id)?;
        validate_frame_geometry(&record)?;
        let previous = self
            .records
            .get(&record.identity.stable_id)
            .ok_or_else(|| CelestialError::DanglingReference(record.identity.stable_id.clone()))?;
        validate_revision(&previous.identity, &record.identity)?;
        let reference = record.identity.reference();
        self.records.insert(record.identity.stable_id.clone(), record);
        Ok(reference)
    }

    pub fn retire(
        &mut self,
        stable_id: &str,
        version: u32,
        causal_parent: &str,
        origin: WriteOrigin,
    ) -> Result<VersionRef, CelestialError> {
        validate_write(OWNER, origin)?;
        required(causal_parent, "causal_parent")?;
        let previous = self
            .records
            .get(stable_id)
            .cloned()
            .ok_or_else(|| CelestialError::DanglingReference(stable_id.to_owned()))?;
        if previous.identity.status != RecordStatus::Active {
            return Err(CelestialError::RetiredRecord(stable_id.to_owned()));
        }
        if version != previous.identity.version + 1 {
            return Err(CelestialError::StaleVersion {
                expected: previous.identity.version + 1,
                found: version,
            });
        }
        let mut retired = previous.clone();
        retired.identity.version = version;
        retired.identity.predecessor = Some(previous.identity.reference());
        retired.identity.causal_parent = causal_parent.to_owned();
        retired.identity.status = RecordStatus::Retired;
        let reference = retired.identity.reference();
        self.records.insert(stable_id.to_owned(), retired);
        Ok(reference)
    }

    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{self:?}").as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct RotationState {
    pub identity: StateIdentity,
    pub frame_ref: VersionRef,
    pub celestial_id: String,
    pub axis_unit: Vector3,
    pub phase_rad: f64,
    pub angular_velocity_rad_per_tick: f64,
    pub reference_epoch_id: String,
    pub reference_tick: i128,
}

/// S4.01.03 — Planetary Rotation State representation.
pub fn validate_rotation(
    receipt: &ContractReceipt,
    frame: &FrameRecord,
    state: &RotationState,
    origin: WriteOrigin,
) -> Result<(), CelestialError> {
    validate_write(&state.identity.owner, origin)?;
    validate_receipt_identity(receipt, &state.identity, &state.celestial_id)?;
    validate_reference(&frame.identity, &state.frame_ref)?;
    if frame.celestial_id != state.celestial_id {
        return Err(CelestialError::ReferenceMismatch("rotation celestial/frame"));
    }
    validate_unit_vector(state.axis_unit, "rotation.axis_unit")?;
    finite(state.phase_rad, "rotation.phase_rad")?;
    finite(
        state.angular_velocity_rad_per_tick,
        "rotation.angular_velocity_rad_per_tick",
    )?;
    if state.reference_epoch_id != receipt.world_epoch_id {
        return Err(CelestialError::ReferenceMismatch("rotation epoch"));
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq)]
pub struct OrbitalState {
    pub identity: StateIdentity,
    pub frame_ref: VersionRef,
    pub celestial_id: String,
    pub position: Vector3,
    pub position_unit: String,
    pub velocity: Vector3,
    pub velocity_unit: String,
    pub reference_epoch_id: String,
    pub reference_tick: i128,
}

/// S4.01.04 — Orbital State Representation.
pub fn validate_orbit(
    receipt: &ContractReceipt,
    frame: &FrameRecord,
    state: &OrbitalState,
    origin: WriteOrigin,
) -> Result<(), CelestialError> {
    validate_write(&state.identity.owner, origin)?;
    validate_receipt_identity(receipt, &state.identity, &state.celestial_id)?;
    validate_reference(&frame.identity, &state.frame_ref)?;
    required(&state.position_unit, "orbit.position_unit")?;
    required(&state.velocity_unit, "orbit.velocity_unit")?;
    finite_vector(state.position, "orbit.position")?;
    finite_vector(state.velocity, "orbit.velocity")?;
    if state.reference_epoch_id != receipt.world_epoch_id {
        return Err(CelestialError::ReferenceMismatch("orbit epoch"));
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq)]
pub struct SolarForcing {
    pub source_orbit_ref: VersionRef,
    pub frame_ref: VersionRef,
    pub reference_epoch_id: String,
    pub reference_tick: i128,
    pub sun_direction_unit: Vector3,
    pub normal_irradiance_w_m2: f64,
    pub disposition: CandidateDisposition,
    pub causal_parent: String,
}

/// S4.01.05 — Solar Direction / Irradiance Forcing. This emits the celestial forcing port only;
/// downstream atmosphere/ocean response is deliberately outside Domain 1 authority.
pub fn solar_forcing(
    orbit: &OrbitalState,
    sun_vector_in_frame: Vector3,
    normal_irradiance_w_m2: f64,
    causal_parent: &str,
) -> Result<SolarForcing, CelestialError> {
    required(causal_parent, "solar.causal_parent")?;
    if !normal_irradiance_w_m2.is_finite() || normal_irradiance_w_m2 < 0.0 {
        return Err(CelestialError::InvalidNumeric("solar.normal_irradiance_w_m2"));
    }
    let direction = normalize(sun_vector_in_frame, "solar.sun_vector")?;
    Ok(SolarForcing {
        source_orbit_ref: orbit.identity.reference(),
        frame_ref: orbit.frame_ref.clone(),
        reference_epoch_id: orbit.reference_epoch_id.clone(),
        reference_tick: orbit.reference_tick,
        sun_direction_unit: direction,
        normal_irradiance_w_m2,
        disposition: CandidateDisposition::CandidateOnly,
        causal_parent: causal_parent.to_owned(),
    })
}

#[derive(Debug, Clone, PartialEq)]
pub struct LunarState {
    pub identity: StateIdentity,
    pub frame_ref: VersionRef,
    pub celestial_id: String,
    pub position: Vector3,
    pub position_unit: String,
    pub velocity: Vector3,
    pub velocity_unit: String,
    pub reference_epoch_id: String,
    pub reference_tick: i128,
}

/// S4.01.06 — Lunar State Representation.
pub fn validate_lunar(
    receipt: &ContractReceipt,
    frame: &FrameRecord,
    state: &LunarState,
    origin: WriteOrigin,
) -> Result<(), CelestialError> {
    validate_write(&state.identity.owner, origin)?;
    validate_receipt_identity(receipt, &state.identity, &state.celestial_id)?;
    validate_reference(&frame.identity, &state.frame_ref)?;
    required(&state.position_unit, "lunar.position_unit")?;
    required(&state.velocity_unit, "lunar.velocity_unit")?;
    finite_vector(state.position, "lunar.position")?;
    finite_vector(state.velocity, "lunar.velocity")?;
    if state.reference_epoch_id != receipt.world_epoch_id {
        return Err(CelestialError::ReferenceMismatch("lunar epoch"));
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq)]
pub struct TidalForcingHandoff {
    pub schema_version: u32,
    pub owner: String,
    pub source_lunar_ref: VersionRef,
    pub frame_ref: VersionRef,
    pub target_location_ref: String,
    pub reference_epoch_id: String,
    pub reference_tick: i128,
    pub tidal_potential: f64,
    pub potential_unit: String,
    pub causal_parent: String,
}

/// S4.01.07 — Tidal Forcing Interface. `potential_scale` is source-state input, not a hidden
/// threshold. The quadrupole angular term is deterministic and this function performs no commit.
pub fn tidal_forcing_handoff(
    lunar: &LunarState,
    target_location_ref: &str,
    target_radial_unit: Vector3,
    potential_scale: f64,
    potential_unit: &str,
    causal_parent: &str,
) -> Result<TidalForcingHandoff, CelestialError> {
    required(target_location_ref, "tidal.target_location_ref")?;
    required(potential_unit, "tidal.potential_unit")?;
    required(causal_parent, "tidal.causal_parent")?;
    finite(potential_scale, "tidal.potential_scale")?;
    let location = normalize(target_radial_unit, "tidal.target_radial_unit")?;
    let moon = normalize(lunar.position, "tidal.lunar_direction")?;
    let cosine = dot(location, moon).clamp(-1.0, 1.0);
    let angular_term = (3.0 * cosine * cosine - 1.0) / 2.0;
    Ok(TidalForcingHandoff {
        schema_version: SCHEMA_VERSION,
        owner: OWNER.to_owned(),
        source_lunar_ref: lunar.identity.reference(),
        frame_ref: lunar.frame_ref.clone(),
        target_location_ref: target_location_ref.to_owned(),
        reference_epoch_id: lunar.reference_epoch_id.clone(),
        reference_tick: lunar.reference_tick,
        tidal_potential: potential_scale * angular_term,
        potential_unit: potential_unit.to_owned(),
        causal_parent: causal_parent.to_owned(),
    })
}

pub fn validate_tidal_handoff(
    handoff: &TidalForcingHandoff,
    lunar: &LunarState,
) -> Result<(), CelestialError> {
    if handoff.schema_version != SCHEMA_VERSION {
        return Err(CelestialError::StaleVersion {
            expected: SCHEMA_VERSION,
            found: handoff.schema_version,
        });
    }
    if handoff.owner != OWNER {
        return Err(CelestialError::WrongOwner(handoff.owner.clone()));
    }
    validate_reference(&lunar.identity, &handoff.source_lunar_ref)?;
    if handoff.frame_ref != lunar.frame_ref
        || handoff.reference_epoch_id != lunar.reference_epoch_id
        || handoff.reference_tick != lunar.reference_tick
    {
        return Err(CelestialError::ReferenceMismatch("tidal source cut"));
    }
    required(&handoff.target_location_ref, "tidal.target_location_ref")?;
    required(&handoff.potential_unit, "tidal.potential_unit")?;
    required(&handoff.causal_parent, "tidal.causal_parent")?;
    finite(handoff.tidal_potential, "tidal.tidal_potential")?;
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AstronomicalEpochAnchor {
    pub stable_id: String,
    pub version: u32,
    pub owner: String,
    pub world_epoch_id: String,
    pub world_tick_at_anchor: i128,
    pub astronomical_tick_at_anchor: i128,
    pub astronomical_unit: String,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AstronomicalTimeMapping {
    pub anchor_ref: VersionRef,
    pub world_epoch_id: String,
    pub world_tick: i128,
    pub astronomical_tick: i128,
    pub astronomical_unit: String,
    pub causal_parent: String,
}

impl AstronomicalEpochAnchor {
    pub fn reference(&self) -> VersionRef {
        VersionRef {
            stable_id: self.stable_id.clone(),
            namespace: "celestial.astronomical_epoch_anchor".to_owned(),
            version: self.version,
            owner: self.owner.clone(),
            causal_parent: self.causal_parent.clone(),
        }
    }
}

/// S4.01.08 — Continuous Astronomical Time Mapping. Uses exact integer tick arithmetic rather
/// than calendar labels or floating wall-clock time.
pub fn map_astronomical_time(
    world_time: &WorldTimeState,
    anchor: &AstronomicalEpochAnchor,
    causal_parent: &str,
) -> Result<AstronomicalTimeMapping, CelestialError> {
    world_time
        .validate()
        .map_err(|_| CelestialError::InvalidWorldTime)?;
    validate_anchor(anchor)?;
    required(causal_parent, "astronomical_mapping.causal_parent")?;
    if world_time.epoch.id != anchor.world_epoch_id {
        return Err(CelestialError::ReferenceMismatch("astronomical world epoch"));
    }
    let delta = world_time
        .tick
        .checked_sub(anchor.world_tick_at_anchor)
        .ok_or(CelestialError::ArithmeticOverflow)?;
    let astronomical_tick = anchor
        .astronomical_tick_at_anchor
        .checked_add(delta)
        .ok_or(CelestialError::ArithmeticOverflow)?;
    Ok(AstronomicalTimeMapping {
        anchor_ref: anchor.reference(),
        world_epoch_id: world_time.epoch.id.clone(),
        world_tick: world_time.tick,
        astronomical_tick,
        astronomical_unit: anchor.astronomical_unit.clone(),
        causal_parent: causal_parent.to_owned(),
    })
}

#[derive(Debug, Clone, PartialEq)]
pub struct Wp008State {
    pub frame_registry: FrameRegistry,
    pub rotation: RotationState,
    pub orbit: OrbitalState,
    pub solar: SolarForcing,
    pub lunar: LunarState,
    pub tidal: TidalForcingHandoff,
    pub astronomical_mapping: AstronomicalTimeMapping,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CelestialSnapshot {
    pub schema_version: u32,
    pub commit_marker: String,
    pub causal_cut: String,
    pub state: Wp008State,
}

impl CelestialSnapshot {
    pub fn validate(&self) -> Result<(), CelestialError> {
        if self.schema_version != SCHEMA_VERSION {
            return Err(CelestialError::StaleVersion {
                expected: SCHEMA_VERSION,
                found: self.schema_version,
            });
        }
        required(&self.commit_marker, "snapshot.commit_marker")?;
        required(&self.causal_cut, "snapshot.causal_cut")?;
        validate_tidal_handoff(&self.state.tidal, &self.state.lunar)?;
        if self.state.solar.reference_epoch_id != self.state.astronomical_mapping.world_epoch_id
            || self.state.solar.reference_tick != self.state.astronomical_mapping.world_tick
            || self.state.lunar.reference_epoch_id != self.state.astronomical_mapping.world_epoch_id
            || self.state.lunar.reference_tick != self.state.astronomical_mapping.world_tick
        {
            return Err(CelestialError::ReferenceMismatch("snapshot read cut"));
        }
        Ok(())
    }

    pub fn restore(&self) -> Result<Wp008State, CelestialError> {
        self.validate()?;
        Ok(self.state.clone())
    }

    pub fn digest64(&self) -> Result<u64, CelestialError> {
        self.validate()?;
        Ok(fnv1a64(format!("{self:?}").as_bytes()))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Wp008Acceptance {
    pub work_package: &'static str,
    pub member_ids: [&'static str; 8],
    pub space_predecessor_digest64: u64,
    pub time_predecessor_digest64: u64,
    pub evidence_digest64: u64,
    pub closed: bool,
}

pub fn accept_wp(
    admission: &Wp008Admission,
    passes: &[bool; 8],
    evidence: &[u64; 8],
    snapshot_digest64: u64,
) -> Result<Wp008Acceptance, CelestialError> {
    if admission.space_evidence_digest64 == 0 || admission.time_evidence_digest64 == 0 {
        return Err(CelestialError::InvalidPredecessor);
    }
    if let Some(index) = passes.iter().position(|passed| !*passed) {
        return Err(CelestialError::MissingEvidence(MEMBER_IDS[index]));
    }
    if let Some(index) = evidence.iter().position(|digest| *digest == 0) {
        return Err(CelestialError::MissingEvidence(MEMBER_IDS[index]));
    }
    if snapshot_digest64 == 0 {
        return Err(CelestialError::MissingSnapshotEvidence);
    }
    let material = format!(
        "{:?}|{:?}|{}|{}|{}",
        passes,
        evidence,
        admission.space_evidence_digest64,
        admission.time_evidence_digest64,
        snapshot_digest64
    );
    Ok(Wp008Acceptance {
        work_package: "WP-008",
        member_ids: MEMBER_IDS,
        space_predecessor_digest64: admission.space_evidence_digest64,
        time_predecessor_digest64: admission.time_evidence_digest64,
        evidence_digest64: fnv1a64(material.as_bytes()),
        closed: true,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CelestialError {
    InvalidPredecessor,
    MissingField(&'static str),
    StaleVersion { expected: u32, found: u32 },
    InvalidInitialVersion(u32),
    WrongOwner(String),
    UnauthorizedWrite(WriteOrigin),
    ProhibitedTransition(String),
    InvalidWorldTime,
    InvalidNumeric(&'static str),
    DuplicateStableId(String),
    DanglingReference(String),
    RetiredRecord(String),
    ReferenceMismatch(&'static str),
    ArithmeticOverflow,
    MissingEvidence(&'static str),
    MissingSnapshotEvidence,
}

impl fmt::Display for CelestialError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidPredecessor => write!(f, "WP-003/WP-004 predecessor evidence is invalid"),
            Self::MissingField(field) => write!(f, "missing required field {field}"),
            Self::StaleVersion { expected, found } => {
                write!(f, "stale version: expected {expected}, found {found}")
            }
            Self::InvalidInitialVersion(found) => {
                write!(f, "initial version must be 1, found {found}")
            }
            Self::WrongOwner(owner) => write!(f, "wrong PA-057 owner {owner}"),
            Self::UnauthorizedWrite(origin) => write!(f, "unauthorized celestial write from {origin:?}"),
            Self::ProhibitedTransition(value) => write!(f, "prohibited celestial transition {value}"),
            Self::InvalidWorldTime => write!(f, "invalid WP-004 WorldTime input"),
            Self::InvalidNumeric(field) => write!(f, "invalid numeric field {field}"),
            Self::DuplicateStableId(value) => write!(f, "duplicate stable ID {value}"),
            Self::DanglingReference(value) => write!(f, "dangling reference {value}"),
            Self::RetiredRecord(value) => write!(f, "retired record {value}"),
            Self::ReferenceMismatch(value) => write!(f, "reference mismatch {value}"),
            Self::ArithmeticOverflow => write!(f, "astronomical time arithmetic overflow"),
            Self::MissingEvidence(work_id) => write!(f, "missing PASS/evidence for {work_id}"),
            Self::MissingSnapshotEvidence => write!(f, "missing WP-008 snapshot/replay evidence"),
        }
    }
}

impl std::error::Error for CelestialError {}

fn validate_write(owner: &str, origin: WriteOrigin) -> Result<(), CelestialError> {
    if owner != OWNER {
        return Err(CelestialError::WrongOwner(owner.to_owned()));
    }
    if origin != WriteOrigin::OwningResolver {
        return Err(CelestialError::UnauthorizedWrite(origin));
    }
    Ok(())
}

fn validate_receipt_identity(
    receipt: &ContractReceipt,
    identity: &StateIdentity,
    celestial_id: &str,
) -> Result<(), CelestialError> {
    if receipt.disposition != CandidateDisposition::CandidateOnly
        || receipt.owner != OWNER
        || identity.owner != OWNER
        || receipt.celestial_id != celestial_id
        || identity.status != RecordStatus::Active
    {
        return Err(CelestialError::ReferenceMismatch("contract/state identity"));
    }
    required(&identity.stable_id, "identity.stable_id")?;
    required(&identity.namespace, "identity.namespace")?;
    required(&identity.causal_parent, "identity.causal_parent")?;
    Ok(())
}

fn validate_revision(previous: &StateIdentity, next: &StateIdentity) -> Result<(), CelestialError> {
    if previous.status != RecordStatus::Active {
        return Err(CelestialError::RetiredRecord(previous.stable_id.clone()));
    }
    if previous.stable_id != next.stable_id
        || previous.namespace != next.namespace
        || previous.owner != next.owner
    {
        return Err(CelestialError::ReferenceMismatch("revision identity"));
    }
    if next.version != previous.version + 1 {
        return Err(CelestialError::StaleVersion {
            expected: previous.version + 1,
            found: next.version,
        });
    }
    match &next.predecessor {
        Some(reference) if reference == &previous.reference() => Ok(()),
        _ => Err(CelestialError::ReferenceMismatch("revision predecessor")),
    }
}

fn validate_reference(identity: &StateIdentity, reference: &VersionRef) -> Result<(), CelestialError> {
    if identity.status != RecordStatus::Active || reference != &identity.reference() {
        return Err(CelestialError::ReferenceMismatch("versioned reference"));
    }
    Ok(())
}

fn validate_frame_geometry(frame: &FrameRecord) -> Result<(), CelestialError> {
    required(&frame.celestial_id, "frame.celestial_id")?;
    required(&frame.reference_epoch_id, "frame.reference_epoch_id")?;
    finite_vector(frame.origin, "frame.origin")?;
    validate_unit_vector(frame.x_axis, "frame.x_axis")?;
    validate_unit_vector(frame.y_axis, "frame.y_axis")?;
    validate_unit_vector(frame.z_axis, "frame.z_axis")?;
    let tolerance = 1.0e-12;
    if dot(frame.x_axis, frame.y_axis).abs() > tolerance
        || dot(frame.x_axis, frame.z_axis).abs() > tolerance
        || dot(frame.y_axis, frame.z_axis).abs() > tolerance
    {
        return Err(CelestialError::InvalidNumeric("frame.orthogonality"));
    }
    Ok(())
}

fn validate_anchor(anchor: &AstronomicalEpochAnchor) -> Result<(), CelestialError> {
    required(&anchor.stable_id, "anchor.stable_id")?;
    required(&anchor.world_epoch_id, "anchor.world_epoch_id")?;
    required(&anchor.astronomical_unit, "anchor.astronomical_unit")?;
    required(&anchor.causal_parent, "anchor.causal_parent")?;
    if anchor.version != SCHEMA_VERSION {
        return Err(CelestialError::StaleVersion {
            expected: SCHEMA_VERSION,
            found: anchor.version,
        });
    }
    if anchor.owner != OWNER {
        return Err(CelestialError::WrongOwner(anchor.owner.clone()));
    }
    Ok(())
}

fn required(value: &str, field: &'static str) -> Result<(), CelestialError> {
    if value.trim().is_empty() {
        return Err(CelestialError::MissingField(field));
    }
    Ok(())
}

fn finite(value: f64, field: &'static str) -> Result<(), CelestialError> {
    if !value.is_finite() {
        return Err(CelestialError::InvalidNumeric(field));
    }
    Ok(())
}

fn finite_vector(value: Vector3, field: &'static str) -> Result<(), CelestialError> {
    if value.iter().any(|component| !component.is_finite()) {
        return Err(CelestialError::InvalidNumeric(field));
    }
    Ok(())
}

fn normalize(value: Vector3, field: &'static str) -> Result<Vector3, CelestialError> {
    finite_vector(value, field)?;
    let norm_squared = dot(value, value);
    if !norm_squared.is_finite() || norm_squared <= 0.0 {
        return Err(CelestialError::InvalidNumeric(field));
    }
    let norm = norm_squared.sqrt();
    Ok([value[0] / norm, value[1] / norm, value[2] / norm])
}

fn validate_unit_vector(value: Vector3, field: &'static str) -> Result<(), CelestialError> {
    finite_vector(value, field)?;
    let norm_squared = dot(value, value);
    if (norm_squared - 1.0).abs() > 1.0e-12 {
        return Err(CelestialError::InvalidNumeric(field));
    }
    Ok(())
}

fn dot(left: Vector3, right: Vector3) -> f64 {
    left[0] * right[0] + left[1] * right[1] + left[2] * right[2]
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
