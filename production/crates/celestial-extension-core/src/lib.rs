#![forbid(unsafe_code)]
//! Frozen WP-016 / S4.01.09…S4.01.17 celestial extension boundary.
//!
//! PA-057 remains authoritative: Domain 1 owns canonical celestial state. Derived geometry,
//! query, audit, and fixture paths are read-only. This crate does not make season labels
//! canonical and does not grant Observer/Renderer/Analytics reverse-write authority.

use gaonn_celestial_core::{VersionRef, Wp008Acceptance};
use gaonn_world_time_core::WorldTimeState;
use std::collections::{BTreeMap, BTreeSet};
use std::f64::consts::PI;
use std::fmt;

pub const SCHEMA_VERSION: u32 = 1;
pub const OWNER: &str = "domain01.celestial_world_state";
pub const MEMBER_IDS: [&str; 9] = [
    "S4.01.09", "S4.01.10", "S4.01.11", "S4.01.12", "S4.01.13", "S4.01.14", "S4.01.15", "S4.01.16",
    "S4.01.17",
];

pub type Vector3 = [f64; 3];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteOrigin {
    OwningResolver,
    Derived,
    Observer,
    Renderer,
    Analytics,
    Ui,
    Ai,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Disposition {
    CandidateOnly,
    ReadOnlyEvidence,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Lifecycle {
    Active,
    Retired,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdmissionReceipt {
    pub work_package: &'static str,
    pub predecessor: &'static str,
    pub predecessor_evidence_digest64: u64,
    pub causal_parent: String,
}

pub fn admit_wp016(
    predecessor: &Wp008Acceptance,
    causal_parent: &str,
) -> Result<AdmissionReceipt, ExtensionError> {
    required(causal_parent, "admission.causal_parent")?;
    if predecessor.work_package != "WP-008"
        || !predecessor.closed
        || predecessor.evidence_digest64 == 0
        || predecessor.member_ids != gaonn_celestial_core::MEMBER_IDS
    {
        return Err(ExtensionError::InvalidPredecessor);
    }
    Ok(AdmissionReceipt {
        work_package: "WP-016",
        predecessor: "WP-008",
        predecessor_evidence_digest64: predecessor.evidence_digest64,
        causal_parent: causal_parent.to_owned(),
    })
}

#[derive(Debug, Clone, PartialEq)]
pub struct AxialPrecessionParameters {
    pub stable_id: String,
    pub namespace: String,
    pub version: u32,
    pub owner: String,
    pub celestial_id: String,
    pub frame_ref: VersionRef,
    pub axial_tilt_rad: f64,
    pub precession_phase_rad: f64,
    pub precession_rate_rad_per_tick: f64,
    pub reference_tick: i128,
    pub causal_parent: String,
    pub disposition: Disposition,
}

impl AxialPrecessionParameters {
    pub fn reference(&self) -> VersionRef {
        VersionRef {
            stable_id: self.stable_id.clone(),
            namespace: self.namespace.clone(),
            version: self.version,
            owner: self.owner.clone(),
            causal_parent: self.causal_parent.clone(),
        }
    }

    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{self:?}").as_bytes())
    }
}

/// S4.01.09 — Axial Tilt / Precession Parameterization.
pub fn validate_axial_precession(
    admission: &AdmissionReceipt,
    parameters: &AxialPrecessionParameters,
    origin: WriteOrigin,
) -> Result<u64, ExtensionError> {
    validate_admission(admission)?;
    validate_write(&parameters.owner, origin)?;
    required(&parameters.stable_id, "axial.stable_id")?;
    required(&parameters.namespace, "axial.namespace")?;
    required(&parameters.celestial_id, "axial.celestial_id")?;
    required(&parameters.causal_parent, "axial.causal_parent")?;
    validate_ref(&parameters.frame_ref)?;
    check_version(parameters.version)?;
    finite(parameters.axial_tilt_rad, "axial.axial_tilt_rad")?;
    finite(
        parameters.precession_phase_rad,
        "axial.precession_phase_rad",
    )?;
    finite(
        parameters.precession_rate_rad_per_tick,
        "axial.precession_rate_rad_per_tick",
    )?;
    if !(0.0..=PI).contains(&parameters.axial_tilt_rad) {
        return Err(ExtensionError::InvalidNumeric("axial.axial_tilt_rad"));
    }
    if parameters.disposition != Disposition::CandidateOnly {
        return Err(ExtensionError::InvalidDisposition);
    }
    Ok(parameters.digest64())
}

#[derive(Debug, Clone, PartialEq)]
pub struct EphemerisPrecisionPolicy {
    pub stable_id: String,
    pub namespace: String,
    pub version: u32,
    pub owner: String,
    pub axial_ref: VersionRef,
    pub horizon_start_tick: i128,
    pub horizon_end_tick: i128,
    pub max_angular_error_rad: f64,
    pub max_position_error: f64,
    pub position_error_unit: String,
    pub causal_parent: String,
    pub disposition: Disposition,
}

impl EphemerisPrecisionPolicy {
    pub fn reference(&self) -> VersionRef {
        VersionRef {
            stable_id: self.stable_id.clone(),
            namespace: self.namespace.clone(),
            version: self.version,
            owner: self.owner.clone(),
            causal_parent: self.causal_parent.clone(),
        }
    }

    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{self:?}").as_bytes())
    }
}

/// S4.01.10 — Long-Horizon Ephemeris Precision Policy.
/// Tolerances are explicit source inputs; this function invents no universal epsilon.
pub fn validate_precision_policy(
    axial: &AxialPrecessionParameters,
    policy: &EphemerisPrecisionPolicy,
    origin: WriteOrigin,
) -> Result<u64, ExtensionError> {
    validate_write(&policy.owner, origin)?;
    required(&policy.stable_id, "precision.stable_id")?;
    required(&policy.namespace, "precision.namespace")?;
    required(&policy.position_error_unit, "precision.position_error_unit")?;
    required(&policy.causal_parent, "precision.causal_parent")?;
    check_version(policy.version)?;
    validate_exact_ref(
        &axial.reference(),
        &policy.axial_ref,
        "S4.01.09 axial reference",
    )?;
    if policy.horizon_end_tick < policy.horizon_start_tick {
        return Err(ExtensionError::InvalidHorizon);
    }
    finite(
        policy.max_angular_error_rad,
        "precision.max_angular_error_rad",
    )?;
    finite(policy.max_position_error, "precision.max_position_error")?;
    if policy.max_angular_error_rad < 0.0 || policy.max_position_error < 0.0 {
        return Err(ExtensionError::InvalidNumeric("precision tolerance"));
    }
    if policy.disposition != Disposition::CandidateOnly {
        return Err(ExtensionError::InvalidDisposition);
    }
    Ok(policy.digest64())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CelestialStateVersionTag {
    pub stable_id: String,
    pub namespace: String,
    pub version: u32,
    pub owner: String,
    pub celestial_id: String,
    pub frame_ref: VersionRef,
    pub source_policy_ref: VersionRef,
    pub world_tick: i128,
    pub state_digest64: u64,
    pub predecessor: Option<VersionRef>,
    pub lifecycle: Lifecycle,
    pub causal_parent: String,
}

impl CelestialStateVersionTag {
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

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct VersionTagRegistry {
    records: BTreeMap<String, CelestialStateVersionTag>,
    retired_ids: BTreeSet<String>,
}

impl VersionTagRegistry {
    /// S4.01.11 — Celestial State Version Tag create boundary.
    pub fn create(
        &mut self,
        policy: &EphemerisPrecisionPolicy,
        tag: CelestialStateVersionTag,
        origin: WriteOrigin,
    ) -> Result<VersionRef, ExtensionError> {
        validate_write(&tag.owner, origin)?;
        validate_tag(policy, &tag)?;
        if tag.version != 1 || tag.predecessor.is_some() || tag.lifecycle != Lifecycle::Active {
            return Err(ExtensionError::InvalidInitialVersion(tag.version));
        }
        if self.records.contains_key(&tag.stable_id) || self.retired_ids.contains(&tag.stable_id) {
            return Err(ExtensionError::DuplicateStableId(tag.stable_id));
        }
        let reference = tag.reference();
        self.records.insert(tag.stable_id.clone(), tag);
        Ok(reference)
    }

    pub fn get(&self, stable_id: &str) -> Result<&CelestialStateVersionTag, ExtensionError> {
        let record = self
            .records
            .get(stable_id)
            .ok_or_else(|| ExtensionError::DanglingReference(stable_id.to_owned()))?;
        if record.lifecycle == Lifecycle::Retired {
            return Err(ExtensionError::RetiredRecord(stable_id.to_owned()));
        }
        Ok(record)
    }

    pub fn update(
        &mut self,
        policy: &EphemerisPrecisionPolicy,
        tag: CelestialStateVersionTag,
        origin: WriteOrigin,
    ) -> Result<VersionRef, ExtensionError> {
        validate_write(&tag.owner, origin)?;
        validate_tag(policy, &tag)?;
        let previous = self
            .records
            .get(&tag.stable_id)
            .cloned()
            .ok_or_else(|| ExtensionError::DanglingReference(tag.stable_id.clone()))?;
        if previous.lifecycle != Lifecycle::Active {
            return Err(ExtensionError::RetiredRecord(tag.stable_id));
        }
        if previous.namespace != tag.namespace
            || previous.owner != tag.owner
            || previous.celestial_id != tag.celestial_id
            || tag.version != previous.version + 1
            || tag.predecessor.as_ref() != Some(&previous.reference())
        {
            return Err(ExtensionError::StaleOrMismatchedRevision);
        }
        let reference = tag.reference();
        self.records.insert(tag.stable_id.clone(), tag);
        Ok(reference)
    }

    pub fn retire(
        &mut self,
        stable_id: &str,
        version: u32,
        causal_parent: &str,
        origin: WriteOrigin,
    ) -> Result<VersionRef, ExtensionError> {
        validate_write(OWNER, origin)?;
        required(causal_parent, "tag.retire.causal_parent")?;
        let previous = self
            .records
            .get(stable_id)
            .cloned()
            .ok_or_else(|| ExtensionError::DanglingReference(stable_id.to_owned()))?;
        if previous.lifecycle != Lifecycle::Active {
            return Err(ExtensionError::RetiredRecord(stable_id.to_owned()));
        }
        if version != previous.version + 1 {
            return Err(ExtensionError::StaleVersion {
                expected: previous.version + 1,
                found: version,
            });
        }
        let mut retired = previous.clone();
        retired.version = version;
        retired.predecessor = Some(previous.reference());
        retired.lifecycle = Lifecycle::Retired;
        retired.causal_parent = causal_parent.to_owned();
        let reference = retired.reference();
        self.records.insert(stable_id.to_owned(), retired);
        self.retired_ids.insert(stable_id.to_owned());
        Ok(reference)
    }

    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{self:?}").as_bytes())
    }
}

fn validate_tag(
    policy: &EphemerisPrecisionPolicy,
    tag: &CelestialStateVersionTag,
) -> Result<(), ExtensionError> {
    required(&tag.stable_id, "tag.stable_id")?;
    required(&tag.namespace, "tag.namespace")?;
    required(&tag.celestial_id, "tag.celestial_id")?;
    required(&tag.causal_parent, "tag.causal_parent")?;
    validate_ref(&tag.frame_ref)?;
    validate_exact_ref(
        &policy.reference(),
        &tag.source_policy_ref,
        "S4.01.10 precision policy",
    )?;
    if tag.state_digest64 == 0 {
        return Err(ExtensionError::MissingEvidence("tag.state_digest64"));
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq)]
pub struct CelestialDurableArtifact {
    pub schema_version: u32,
    pub commit_marker: String,
    pub causal_cut: String,
    pub recovery_position: String,
    pub replay_reference: String,
    pub tag: CelestialStateVersionTag,
    pub axial: AxialPrecessionParameters,
    pub policy: EphemerisPrecisionPolicy,
    pub event_order: Vec<String>,
    pub artifact_digest64: u64,
}

#[derive(Debug)]
pub struct CelestialArtifactInput<'a> {
    pub commit_marker: &'a str,
    pub causal_cut: &'a str,
    pub recovery_position: &'a str,
    pub replay_reference: &'a str,
    pub tag: CelestialStateVersionTag,
    pub axial: AxialPrecessionParameters,
    pub policy: EphemerisPrecisionPolicy,
    pub event_order: Vec<String>,
}

impl CelestialDurableArtifact {
    /// S4.01.12 — Celestial State Serialization.
    pub fn build(input: CelestialArtifactInput<'_>) -> Result<Self, ExtensionError> {
        let CelestialArtifactInput {
            commit_marker,
            causal_cut,
            recovery_position,
            replay_reference,
            tag,
            axial,
            policy,
            event_order,
        } = input;
        required(commit_marker, "artifact.commit_marker")?;
        required(causal_cut, "artifact.causal_cut")?;
        required(recovery_position, "artifact.recovery_position")?;
        required(replay_reference, "artifact.replay_reference")?;
        if tag.lifecycle != Lifecycle::Active {
            return Err(ExtensionError::RetiredRecord(tag.stable_id));
        }
        validate_exact_ref(
            &axial.reference(),
            &policy.axial_ref,
            "artifact axial/policy",
        )?;
        validate_exact_ref(
            &policy.reference(),
            &tag.source_policy_ref,
            "artifact policy/tag",
        )?;
        if event_order.is_empty() {
            return Err(ExtensionError::MissingField("artifact.event_order"));
        }
        let material = format!(
            "{}|{}|{}|{}|{:?}|{:?}|{:?}|{:?}",
            SCHEMA_VERSION,
            commit_marker,
            causal_cut,
            recovery_position,
            replay_reference,
            tag,
            axial,
            policy
        );
        let artifact_digest64 = fnv1a64(format!("{material}|{event_order:?}").as_bytes());
        Ok(Self {
            schema_version: SCHEMA_VERSION,
            commit_marker: commit_marker.to_owned(),
            causal_cut: causal_cut.to_owned(),
            recovery_position: recovery_position.to_owned(),
            replay_reference: replay_reference.to_owned(),
            tag,
            axial,
            policy,
            event_order,
            artifact_digest64,
        })
    }

    pub fn validate(&self) -> Result<(), ExtensionError> {
        if self.schema_version != SCHEMA_VERSION {
            return Err(ExtensionError::StaleVersion {
                expected: SCHEMA_VERSION,
                found: self.schema_version,
            });
        }
        required(&self.commit_marker, "artifact.commit_marker")?;
        required(&self.causal_cut, "artifact.causal_cut")?;
        required(&self.recovery_position, "artifact.recovery_position")?;
        required(&self.replay_reference, "artifact.replay_reference")?;
        if self.artifact_digest64 == 0 || self.event_order.is_empty() {
            return Err(ExtensionError::CorruptArtifact);
        }
        let rebuilt = Self::build(CelestialArtifactInput {
            commit_marker: &self.commit_marker,
            causal_cut: &self.causal_cut,
            recovery_position: &self.recovery_position,
            replay_reference: &self.replay_reference,
            tag: self.tag.clone(),
            axial: self.axial.clone(),
            policy: self.policy.clone(),
            event_order: self.event_order.clone(),
        })?;
        if rebuilt.artifact_digest64 != self.artifact_digest64 {
            return Err(ExtensionError::CorruptArtifact);
        }
        Ok(())
    }

    pub fn restore(
        &self,
    ) -> Result<
        (
            CelestialStateVersionTag,
            AxialPrecessionParameters,
            EphemerisPrecisionPolicy,
        ),
        ExtensionError,
    > {
        self.validate()?;
        Ok((self.tag.clone(), self.axial.clone(), self.policy.clone()))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TriggerPhase {
    Inactive,
    Active,
}

#[derive(Debug, Clone, PartialEq)]
pub struct AdaptivePrecisionState {
    pub stable_id: String,
    pub version: u32,
    pub owner: String,
    pub policy_ref: VersionRef,
    pub phase: TriggerPhase,
    pub last_transition_tick: Option<i128>,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PrecisionTriggerInput {
    pub world_tick: i128,
    pub observed_angular_error_rad: f64,
    pub observed_position_error: f64,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PrecisionTriggerEvent {
    pub work_id: &'static str,
    pub state_id: String,
    pub state_version: u32,
    pub world_tick: i128,
    pub activated: bool,
    pub causal_parent: String,
    pub disposition: Disposition,
}

/// S4.01.13 — Adaptive Astronomical Precision Trigger.
/// A transition event is emitted only on a boundary crossing. Persistent breach does not duplicate
/// activation events; thresholds are read from the explicit precision policy.
pub fn evaluate_precision_trigger(
    policy: &EphemerisPrecisionPolicy,
    state: &mut AdaptivePrecisionState,
    input: &PrecisionTriggerInput,
    origin: WriteOrigin,
) -> Result<Option<PrecisionTriggerEvent>, ExtensionError> {
    validate_write(&state.owner, origin)?;
    validate_exact_ref(&policy.reference(), &state.policy_ref, "trigger policy")?;
    required(&state.stable_id, "trigger.stable_id")?;
    required(&state.causal_parent, "trigger.causal_parent")?;
    required(&input.causal_parent, "trigger.input.causal_parent")?;
    check_version(state.version)?;
    finite(
        input.observed_angular_error_rad,
        "trigger.observed_angular_error_rad",
    )?;
    finite(
        input.observed_position_error,
        "trigger.observed_position_error",
    )?;
    if input.world_tick < policy.horizon_start_tick || input.world_tick > policy.horizon_end_tick {
        return Err(ExtensionError::InvalidHorizon);
    }
    let breached = input.observed_angular_error_rad > policy.max_angular_error_rad
        || input.observed_position_error > policy.max_position_error;
    let target = if breached {
        TriggerPhase::Active
    } else {
        TriggerPhase::Inactive
    };
    if target == state.phase {
        return Ok(None);
    }
    state.phase = target;
    state.version = state
        .version
        .checked_add(1)
        .ok_or(ExtensionError::ArithmeticOverflow)?;
    state.last_transition_tick = Some(input.world_tick);
    state.causal_parent = input.causal_parent.clone();
    Ok(Some(PrecisionTriggerEvent {
        work_id: "S4.01.13",
        state_id: state.stable_id.clone(),
        state_version: state.version,
        world_tick: input.world_tick,
        activated: target == TriggerPhase::Active,
        causal_parent: input.causal_parent.clone(),
        disposition: Disposition::CandidateOnly,
    }))
}

#[derive(Debug, Clone, PartialEq)]
pub struct IlluminationInput {
    pub celestial_state_ref: VersionRef,
    pub surface_ref: String,
    pub world_tick: i128,
    pub surface_normal_unit: Vector3,
    pub sun_direction_unit: Vector3,
    pub normal_irradiance_w_m2: f64,
    pub occluded_by_objective_geometry: bool,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct IlluminationGeometry {
    pub work_id: &'static str,
    pub celestial_state_ref: VersionRef,
    pub surface_ref: String,
    pub world_tick: i128,
    pub incidence_cosine: f64,
    pub direct_irradiance_w_m2: f64,
    pub shadowed: bool,
    pub causal_parent: String,
    pub disposition: Disposition,
}

/// S4.01.14 — Planetary Shadow / Illumination Geometry.
pub fn derive_illumination_geometry(
    input: &IlluminationInput,
) -> Result<IlluminationGeometry, ExtensionError> {
    validate_ref(&input.celestial_state_ref)?;
    required(&input.surface_ref, "illumination.surface_ref")?;
    required(&input.causal_parent, "illumination.causal_parent")?;
    finite(
        input.normal_irradiance_w_m2,
        "illumination.normal_irradiance_w_m2",
    )?;
    if input.normal_irradiance_w_m2 < 0.0 {
        return Err(ExtensionError::InvalidNumeric(
            "illumination.normal_irradiance_w_m2",
        ));
    }
    let normal = normalize(input.surface_normal_unit, "illumination.surface_normal")?;
    let sun = normalize(input.sun_direction_unit, "illumination.sun_direction")?;
    let incidence_cosine = dot(normal, sun).clamp(-1.0, 1.0);
    let shadowed = input.occluded_by_objective_geometry || incidence_cosine <= 0.0;
    let direct_irradiance_w_m2 = if shadowed {
        0.0
    } else {
        input.normal_irradiance_w_m2 * incidence_cosine
    };
    Ok(IlluminationGeometry {
        work_id: "S4.01.14",
        celestial_state_ref: input.celestial_state_ref.clone(),
        surface_ref: input.surface_ref.clone(),
        world_tick: input.world_tick,
        incidence_cosine,
        direct_irradiance_w_m2,
        shadowed,
        causal_parent: input.causal_parent.clone(),
        disposition: Disposition::ReadOnlyEvidence,
    })
}

#[derive(Debug, Clone, PartialEq)]
pub struct CelestialForcingQuery {
    pub query_id: String,
    pub source_tag_ref: VersionRef,
    pub world_tick: i128,
    pub location_ref: String,
    pub object_ref: Option<String>,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CelestialForcingResponse {
    pub work_id: &'static str,
    pub query_id: String,
    pub source_tag_ref: VersionRef,
    pub world_tick: i128,
    pub location_ref: String,
    pub object_ref: Option<String>,
    pub axial_tilt_rad: f64,
    pub precession_phase_rad: f64,
    pub illumination: IlluminationGeometry,
    pub source_digest64: u64,
    pub causal_parent: String,
    pub disposition: Disposition,
}

/// S4.01.15 — Celestial Forcing Query Interface. Read-only by construction.
pub fn query_celestial_forcing(
    tag: &CelestialStateVersionTag,
    axial: &AxialPrecessionParameters,
    query: &CelestialForcingQuery,
    illumination: IlluminationGeometry,
) -> Result<CelestialForcingResponse, ExtensionError> {
    required(&query.query_id, "query.query_id")?;
    required(&query.location_ref, "query.location_ref")?;
    required(&query.causal_parent, "query.causal_parent")?;
    validate_exact_ref(&tag.reference(), &query.source_tag_ref, "forcing query tag")?;
    if query.world_tick != illumination.world_tick
        || query.location_ref != illumination.surface_ref
        || illumination.celestial_state_ref != tag.reference()
    {
        return Err(ExtensionError::ReadCutMismatch);
    }
    let source_digest64 = fnv1a64(format!("{tag:?}|{axial:?}|{illumination:?}").as_bytes());
    Ok(CelestialForcingResponse {
        work_id: "S4.01.15",
        query_id: query.query_id.clone(),
        source_tag_ref: tag.reference(),
        world_tick: query.world_tick,
        location_ref: query.location_ref.clone(),
        object_ref: query.object_ref.clone(),
        axial_tilt_rad: axial.axial_tilt_rad,
        precession_phase_rad: axial.precession_phase_rad,
        illumination,
        source_digest64,
        causal_parent: query.causal_parent.clone(),
        disposition: Disposition::ReadOnlyEvidence,
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SeasonAuditCase {
    NormalCausalForcing,
    SeasonLabelBypass,
    AuthorityIntrusion,
    DuplicateCanonicalWrite,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SeasonAuditAttempt {
    pub work_id: String,
    pub case: SeasonAuditCase,
    pub owner: String,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SeasonAuditViolation {
    pub work_id: String,
    pub case: SeasonAuditCase,
    pub first_failure: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SeasonAuditEvidence {
    pub work_id: &'static str,
    pub operands: [&'static str; 3],
    pub violations: Vec<SeasonAuditViolation>,
    pub normal_false_positives: usize,
    pub pre_digest64: u64,
    pub post_digest64: u64,
    pub reproduction: String,
    pub causal_parent: String,
    pub disposition: Disposition,
}

/// S4.01.16 — Season-as-Causal-Forcing Audit.
/// Season labels may describe derived forcing but never substitute for causal celestial state.
pub fn audit_season_as_causal_forcing(
    registry: &VersionTagRegistry,
    attempts: &[SeasonAuditAttempt],
    causal_parent: &str,
) -> Result<SeasonAuditEvidence, ExtensionError> {
    required(causal_parent, "season_audit.causal_parent")?;
    let pre = registry.digest64();
    let mut violations = Vec::new();
    let mut normal_false_positives = 0;
    for attempt in attempts {
        required(&attempt.work_id, "season_audit.work_id")?;
        required(&attempt.causal_parent, "season_audit.attempt.causal_parent")?;
        let failure = match attempt.case {
            SeasonAuditCase::NormalCausalForcing => {
                if attempt.owner != OWNER {
                    normal_false_positives += 1;
                }
                None
            }
            SeasonAuditCase::SeasonLabelBypass => Some("season-label-bypass"),
            SeasonAuditCase::AuthorityIntrusion => Some("authority-intrusion"),
            SeasonAuditCase::DuplicateCanonicalWrite => Some("duplicate-canonical-write"),
        };
        if let Some(first_failure) = failure {
            violations.push(SeasonAuditViolation {
                work_id: attempt.work_id.clone(),
                case: attempt.case,
                first_failure,
            });
        }
    }
    Ok(SeasonAuditEvidence {
        work_id: "S4.01.16",
        operands: ["Season-as-Causal-Forcing", "Celestial", "Frame"],
        violations,
        normal_false_positives,
        pre_digest64: pre,
        post_digest64: registry.digest64(),
        reproduction: "replay identical celestial registry; vary only season-bypass/authority/duplicate-write attempt"
            .to_owned(),
        causal_parent: causal_parent.to_owned(),
        disposition: Disposition::ReadOnlyEvidence,
    })
}

#[derive(Debug, Clone, PartialEq)]
pub struct ConsistencySample {
    pub world_tick: i128,
    pub precession_phase_rad: f64,
    pub illumination_digest64: u64,
    pub forcing_digest64: u64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LongHorizonFixtureEvidence {
    pub work_id: &'static str,
    pub fixture_id: String,
    pub seed: u64,
    pub samples: Vec<ConsistencySample>,
    pub event_order: Vec<String>,
    pub final_digest64: u64,
    pub first_failure: Option<&'static str>,
    pub causal_parent: String,
    pub disposition: Disposition,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FixtureInput {
    pub fixture_id: String,
    pub seed: u64,
    pub ticks: Vec<i128>,
    pub surface_ref: String,
    pub surface_normal_unit: Vector3,
    pub sun_direction_unit: Vector3,
    pub normal_irradiance_w_m2: f64,
    pub inject_missing_forcing_at: Option<usize>,
    pub causal_parent: String,
}

/// S4.01.17 — Long-Horizon Forcing Consistency Fixture.
pub fn run_long_horizon_fixture(
    tag: &CelestialStateVersionTag,
    axial: &AxialPrecessionParameters,
    policy: &EphemerisPrecisionPolicy,
    input: &FixtureInput,
) -> Result<LongHorizonFixtureEvidence, ExtensionError> {
    required(&input.fixture_id, "fixture.fixture_id")?;
    required(&input.surface_ref, "fixture.surface_ref")?;
    required(&input.causal_parent, "fixture.causal_parent")?;
    if input.ticks.is_empty() {
        return Err(ExtensionError::MissingField("fixture.ticks"));
    }
    let mut samples = Vec::with_capacity(input.ticks.len());
    let mut event_order = Vec::with_capacity(input.ticks.len());
    for (index, tick) in input.ticks.iter().copied().enumerate() {
        if tick < policy.horizon_start_tick || tick > policy.horizon_end_tick {
            return Err(ExtensionError::InvalidHorizon);
        }
        if input.inject_missing_forcing_at == Some(index) {
            return Ok(LongHorizonFixtureEvidence {
                work_id: "S4.01.17",
                fixture_id: input.fixture_id.clone(),
                seed: input.seed,
                samples,
                event_order,
                final_digest64: 0,
                first_failure: Some("missing-forcing-output"),
                causal_parent: input.causal_parent.clone(),
                disposition: Disposition::ReadOnlyEvidence,
            });
        }
        let dt = tick
            .checked_sub(axial.reference_tick)
            .ok_or(ExtensionError::ArithmeticOverflow)?;
        let phase = axial.precession_phase_rad + axial.precession_rate_rad_per_tick * dt as f64;
        finite(phase, "fixture.precession_phase")?;
        let illumination = derive_illumination_geometry(&IlluminationInput {
            celestial_state_ref: tag.reference(),
            surface_ref: input.surface_ref.clone(),
            world_tick: tick,
            surface_normal_unit: input.surface_normal_unit,
            sun_direction_unit: input.sun_direction_unit,
            normal_irradiance_w_m2: input.normal_irradiance_w_m2,
            occluded_by_objective_geometry: false,
            causal_parent: "S4.01.14:fixture".to_owned(),
        })?;
        let query = CelestialForcingQuery {
            query_id: format!("{}:{index}", input.fixture_id),
            source_tag_ref: tag.reference(),
            world_tick: tick,
            location_ref: input.surface_ref.clone(),
            object_ref: None,
            causal_parent: "S4.01.15:fixture".to_owned(),
        };
        let response = query_celestial_forcing(tag, axial, &query, illumination.clone())?;
        let illumination_digest64 = fnv1a64(format!("{illumination:?}").as_bytes());
        let forcing_digest64 = fnv1a64(format!("{response:?}|{}", input.seed).as_bytes());
        samples.push(ConsistencySample {
            world_tick: tick,
            precession_phase_rad: phase,
            illumination_digest64,
            forcing_digest64,
        });
        event_order.push(format!("S4.01.17:{index}:{tick}"));
    }
    let final_digest64 = fnv1a64(
        format!(
            "{}|{}|{:?}|{:?}|{}",
            input.fixture_id, input.seed, samples, event_order, input.causal_parent
        )
        .as_bytes(),
    );
    Ok(LongHorizonFixtureEvidence {
        work_id: "S4.01.17",
        fixture_id: input.fixture_id.clone(),
        seed: input.seed,
        samples,
        event_order,
        final_digest64,
        first_failure: None,
        causal_parent: input.causal_parent.clone(),
        disposition: Disposition::ReadOnlyEvidence,
    })
}

#[derive(Debug, Clone, PartialEq)]
pub struct Wp016Snapshot {
    pub schema_version: u32,
    pub snapshot_marker: String,
    pub causal_cut: String,
    pub durable_artifact: CelestialDurableArtifact,
    pub version_registry: VersionTagRegistry,
    pub adaptive_state: AdaptivePrecisionState,
    pub event_order: Vec<String>,
}

impl Wp016Snapshot {
    pub fn validate(&self) -> Result<(), ExtensionError> {
        if self.schema_version != SCHEMA_VERSION {
            return Err(ExtensionError::StaleVersion {
                expected: SCHEMA_VERSION,
                found: self.schema_version,
            });
        }
        required(&self.snapshot_marker, "snapshot.marker")?;
        required(&self.causal_cut, "snapshot.causal_cut")?;
        self.durable_artifact.validate()?;
        if self.event_order.is_empty() || self.adaptive_state.owner != OWNER {
            return Err(ExtensionError::CorruptArtifact);
        }
        Ok(())
    }

    pub fn restore(&self) -> Result<Self, ExtensionError> {
        self.validate()?;
        Ok(self.clone())
    }

    pub fn digest64(&self) -> Result<u64, ExtensionError> {
        self.validate()?;
        Ok(fnv1a64(format!("{self:?}").as_bytes()))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Wp016Acceptance {
    pub work_package: &'static str,
    pub member_ids: [&'static str; 9],
    pub predecessor_digest64: u64,
    pub member_evidence_digest64: u64,
    pub snapshot_digest64: u64,
    pub fixture_digest64: u64,
    pub closed: bool,
}

pub fn accept_wp016(
    admission: &AdmissionReceipt,
    passes: &[bool; 9],
    evidence: &[u64; 9],
    snapshot: &Wp016Snapshot,
    expected_snapshot_digest64: u64,
    fixture: &LongHorizonFixtureEvidence,
) -> Result<Wp016Acceptance, ExtensionError> {
    validate_admission(admission)?;
    if let Some(index) = passes.iter().position(|passed| !*passed) {
        return Err(ExtensionError::MissingMemberEvidence(MEMBER_IDS[index]));
    }
    if let Some(index) = evidence.iter().position(|digest| *digest == 0) {
        return Err(ExtensionError::MissingMemberEvidence(MEMBER_IDS[index]));
    }
    let snapshot_digest64 = snapshot.digest64()?;
    if expected_snapshot_digest64 == 0 || expected_snapshot_digest64 != snapshot_digest64 {
        return Err(ExtensionError::ReplayDigestMismatch);
    }
    if fixture.work_id != "S4.01.17"
        || fixture.first_failure.is_some()
        || fixture.final_digest64 == 0
        || fixture.event_order.is_empty()
    {
        return Err(ExtensionError::FixtureFailure);
    }
    Ok(Wp016Acceptance {
        work_package: "WP-016",
        member_ids: MEMBER_IDS,
        predecessor_digest64: admission.predecessor_evidence_digest64,
        member_evidence_digest64: fnv1a64(format!("{passes:?}|{evidence:?}").as_bytes()),
        snapshot_digest64,
        fixture_digest64: fixture.final_digest64,
        closed: true,
    })
}

pub fn validate_world_time(time: &WorldTimeState) -> Result<(), ExtensionError> {
    time.validate()
        .map_err(|_| ExtensionError::InvalidWorldTime)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExtensionError {
    InvalidPredecessor,
    MissingField(&'static str),
    MissingEvidence(&'static str),
    MissingMemberEvidence(&'static str),
    WrongOwner(String),
    UnauthorizedWrite(WriteOrigin),
    StaleVersion { expected: u32, found: u32 },
    InvalidInitialVersion(u32),
    InvalidNumeric(&'static str),
    InvalidHorizon,
    InvalidDisposition,
    ReferenceMismatch(&'static str),
    DuplicateStableId(String),
    DanglingReference(String),
    RetiredRecord(String),
    StaleOrMismatchedRevision,
    CorruptArtifact,
    ReadCutMismatch,
    ArithmeticOverflow,
    ReplayDigestMismatch,
    FixtureFailure,
    InvalidWorldTime,
}

impl fmt::Display for ExtensionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidPredecessor => write!(f, "invalid WP-008 predecessor evidence"),
            Self::MissingField(field) => write!(f, "missing required field {field}"),
            Self::MissingEvidence(field) => write!(f, "missing evidence {field}"),
            Self::MissingMemberEvidence(work_id) => {
                write!(f, "missing PASS/evidence for {work_id}")
            }
            Self::WrongOwner(owner) => write!(f, "wrong PA-057 owner {owner}"),
            Self::UnauthorizedWrite(origin) => {
                write!(f, "unauthorized celestial write from {origin:?}")
            }
            Self::StaleVersion { expected, found } => {
                write!(f, "stale version: expected {expected}, found {found}")
            }
            Self::InvalidInitialVersion(found) => write!(f, "invalid initial version {found}"),
            Self::InvalidNumeric(field) => write!(f, "invalid numeric field {field}"),
            Self::InvalidHorizon => write!(
                f,
                "invalid long-horizon interval or rollback/precision bound"
            ),
            Self::InvalidDisposition => write!(f, "invalid candidate/read-only disposition"),
            Self::ReferenceMismatch(name) => write!(f, "reference mismatch {name}"),
            Self::DuplicateStableId(id) => write!(f, "duplicate or reused stable ID {id}"),
            Self::DanglingReference(id) => write!(f, "dangling reference {id}"),
            Self::RetiredRecord(id) => write!(f, "retired record {id}"),
            Self::StaleOrMismatchedRevision => {
                write!(f, "stale or mismatched version-tag revision")
            }
            Self::CorruptArtifact => write!(f, "corrupt or partial celestial durable artifact"),
            Self::ReadCutMismatch => write!(f, "forcing query source cut mismatch"),
            Self::ArithmeticOverflow => write!(f, "celestial arithmetic overflow"),
            Self::ReplayDigestMismatch => write!(f, "snapshot/replay digest mismatch"),
            Self::FixtureFailure => write!(f, "long-horizon forcing consistency fixture failed"),
            Self::InvalidWorldTime => write!(f, "invalid WorldTime input"),
        }
    }
}

impl std::error::Error for ExtensionError {}

fn validate_admission(admission: &AdmissionReceipt) -> Result<(), ExtensionError> {
    if admission.work_package != "WP-016"
        || admission.predecessor != "WP-008"
        || admission.predecessor_evidence_digest64 == 0
        || admission.causal_parent.trim().is_empty()
    {
        return Err(ExtensionError::InvalidPredecessor);
    }
    Ok(())
}

fn validate_write(owner: &str, origin: WriteOrigin) -> Result<(), ExtensionError> {
    if owner != OWNER {
        return Err(ExtensionError::WrongOwner(owner.to_owned()));
    }
    if origin != WriteOrigin::OwningResolver {
        return Err(ExtensionError::UnauthorizedWrite(origin));
    }
    Ok(())
}

fn validate_ref(reference: &VersionRef) -> Result<(), ExtensionError> {
    required(&reference.stable_id, "reference.stable_id")?;
    required(&reference.namespace, "reference.namespace")?;
    required(&reference.owner, "reference.owner")?;
    required(&reference.causal_parent, "reference.causal_parent")?;
    if reference.version == 0 {
        return Err(ExtensionError::StaleVersion {
            expected: 1,
            found: 0,
        });
    }
    if reference.owner != OWNER {
        return Err(ExtensionError::WrongOwner(reference.owner.clone()));
    }
    Ok(())
}

fn validate_exact_ref(
    expected: &VersionRef,
    actual: &VersionRef,
    name: &'static str,
) -> Result<(), ExtensionError> {
    validate_ref(expected)?;
    validate_ref(actual)?;
    if expected != actual {
        return Err(ExtensionError::ReferenceMismatch(name));
    }
    Ok(())
}

fn check_version(version: u32) -> Result<(), ExtensionError> {
    if version == 0 {
        return Err(ExtensionError::StaleVersion {
            expected: 1,
            found: 0,
        });
    }
    Ok(())
}

fn required(value: &str, field: &'static str) -> Result<(), ExtensionError> {
    if value.trim().is_empty() {
        Err(ExtensionError::MissingField(field))
    } else {
        Ok(())
    }
}

fn finite(value: f64, field: &'static str) -> Result<(), ExtensionError> {
    if value.is_finite() {
        Ok(())
    } else {
        Err(ExtensionError::InvalidNumeric(field))
    }
}

fn normalize(vector: Vector3, field: &'static str) -> Result<Vector3, ExtensionError> {
    if !vector.iter().all(|value| value.is_finite()) {
        return Err(ExtensionError::InvalidNumeric(field));
    }
    let magnitude2 = dot(vector, vector);
    if !magnitude2.is_finite() || magnitude2 <= 0.0 {
        return Err(ExtensionError::InvalidNumeric(field));
    }
    let magnitude = magnitude2.sqrt();
    Ok([
        vector[0] / magnitude,
        vector[1] / magnitude,
        vector[2] / magnitude,
    ])
}

fn dot(a: Vector3, b: Vector3) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
