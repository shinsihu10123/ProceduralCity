#![forbid(unsafe_code)]
//! Frozen WP-015 / S1.09.01..S1.09.10 conservative multi-rate coupling boundary.
//!
//! This crate owns coupling contracts and exchanged integrated quantities only.
//! Source-domain state remains domain-owned. All mutation material produced here
//! is pre-commit `CandidateOnly`; canonical commit is outside WP-015.

use gaonn_scheduler_core::Wp010Acceptance;
use gaonn_world_time_core::{WorldTimeState, Wp004Acceptance};
use std::collections::{BTreeMap, BTreeSet};

pub const SCHEMA_VERSION: u32 = 1;
pub const OWNER: &str = "domain26.multi_rate_coupling";
pub const MEMBER_IDS: [&str; 10] = [
    "S1.09.01", "S1.09.02", "S1.09.03", "S1.09.04", "S1.09.05", "S1.09.06", "S1.09.07", "S1.09.08",
    "S1.09.09", "S1.09.10",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteOrigin {
    CouplingRuntime,
    DomainOwner,
    Derived,
    Observer,
    Renderer,
    Analytics,
    Ui,
    Ai,
    Worker,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Disposition {
    CandidateOnly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum CouplingClass {
    Cc0,
    Cc1,
    Cc2,
    Cc3,
    Cc4,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProcessRate {
    Fast,
    Slow,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProcessPhase {
    Requested,
    InProgress,
    Partial,
    Complete,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RollbackClass {
    Rb0SolverReject,
    Rb1Window,
    Rb2Closure,
    Rb3TransactionAbort,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdmissionReceipt {
    pub work_package: &'static str,
    pub hard_predecessors: [&'static str; 2],
    pub wp004_digest64: u64,
    pub wp010_digest64: u64,
}

pub fn admit_wp015(
    wp004: &Wp004Acceptance,
    wp010: &Wp010Acceptance,
) -> Result<AdmissionReceipt, CouplingError> {
    if wp004.work_package != "WP-004"
        || wp004.member_ids != gaonn_world_time_core::MEMBER_IDS
        || !wp004.closed
        || wp004.evidence_digest64 == 0
        || wp004.predecessor_digest64 == 0
    {
        return Err(CouplingError::InvalidPredecessor("WP-004"));
    }
    if wp010.work_package != "WP-010"
        || wp010.member_ids != gaonn_scheduler_core::MEMBER_IDS
        || !wp010.closed
        || wp010.evidence_digest64 == 0
        || wp010.snapshot_digest64 == 0
        || wp010.predecessor_digest64 == 0
    {
        return Err(CouplingError::InvalidPredecessor("WP-010"));
    }
    Ok(AdmissionReceipt {
        work_package: "WP-015",
        hard_predecessors: ["WP-004", "WP-010"],
        wp004_digest64: fnv1a64(format!("{wp004:?}").as_bytes()),
        wp010_digest64: fnv1a64(format!("{wp010:?}").as_bytes()),
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CouplingWindow {
    pub stable_id: String,
    pub version: u32,
    pub owner: String,
    pub class: CouplingClass,
    pub start: WorldTimeState,
    pub end: WorldTimeState,
    pub validity_horizon_tick: i128,
    pub causal_parent: String,
    pub disposition: Disposition,
}

impl CouplingWindow {
    pub fn validate(&self) -> Result<(), CouplingError> {
        required(&self.stable_id, "window.stable_id")?;
        required(&self.owner, "window.owner")?;
        required(&self.causal_parent, "window.causal_parent")?;
        check_version(self.version)?;
        if self.owner != OWNER {
            return Err(CouplingError::WrongOwner(self.owner.clone()));
        }
        self.start
            .validate()
            .map_err(|_| CouplingError::InvalidWorldTime)?;
        self.end
            .validate()
            .map_err(|_| CouplingError::InvalidWorldTime)?;
        if self.start.epoch.id != self.end.epoch.id
            || self.start.epoch.unit != self.end.epoch.unit
            || self.start.epoch.frame != self.end.epoch.frame
        {
            return Err(CouplingError::WorldTimeBoundaryMismatch);
        }
        if self.end.tick <= self.start.tick {
            return Err(CouplingError::InvalidWindowBounds);
        }
        if self.validity_horizon_tick < self.start.tick
            || self.validity_horizon_tick > self.end.tick
        {
            return Err(CouplingError::InvalidValidityHorizon);
        }
        Ok(())
    }

    pub fn digest64(&self) -> Result<u64, CouplingError> {
        self.validate()?;
        Ok(fnv1a64(format!("{self:?}").as_bytes()))
    }
}

pub fn validate_window_contract(
    window: &CouplingWindow,
    origin: WriteOrigin,
) -> Result<u64, CouplingError> {
    validate_coupling_writer(origin)?;
    window.validate()?;
    window.digest64()
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClassificationHandoff {
    pub work_id: &'static str,
    pub process_id: String,
    pub process_version: u32,
    pub source_domain_owner: String,
    pub receiver_domain_owner: String,
    pub rate: ProcessRate,
    pub window_id: String,
    pub window_version: u32,
    pub causal_parent: String,
    pub interface_writes_domain_state: bool,
    pub disposition: Disposition,
}

pub fn classify_process(
    window: &CouplingWindow,
    process_id: &str,
    process_version: u32,
    source_domain_owner: &str,
    receiver_domain_owner: &str,
    rate: ProcessRate,
    causal_parent: &str,
) -> Result<ClassificationHandoff, CouplingError> {
    window.validate()?;
    required(process_id, "classification.process_id")?;
    required(source_domain_owner, "classification.source_domain_owner")?;
    required(
        receiver_domain_owner,
        "classification.receiver_domain_owner",
    )?;
    required(causal_parent, "classification.causal_parent")?;
    check_version(process_version)?;
    if source_domain_owner == receiver_domain_owner {
        return Err(CouplingError::InvalidInterfaceBoundary);
    }
    Ok(ClassificationHandoff {
        work_id: "S1.09.02",
        process_id: process_id.to_owned(),
        process_version,
        source_domain_owner: source_domain_owner.to_owned(),
        receiver_domain_owner: receiver_domain_owner.to_owned(),
        rate,
        window_id: window.stable_id.clone(),
        window_version: window.version,
        causal_parent: causal_parent.to_owned(),
        interface_writes_domain_state: false,
        disposition: Disposition::CandidateOnly,
    })
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct TypedFluxPacket {
    pub stable_id: String,
    pub version: u32,
    pub owner: String,
    pub source_domain_owner: String,
    pub target_domain_owner: String,
    pub quantity: String,
    pub unit: String,
    pub frame: String,
    pub integrated_amount: i128,
    pub window_id: String,
    pub window_version: u32,
    pub causal_parent: String,
    pub disposition: Disposition,
}

impl TypedFluxPacket {
    pub fn validate_against(
        &self,
        window: &CouplingWindow,
        classification: &ClassificationHandoff,
    ) -> Result<(), CouplingError> {
        window.validate()?;
        required(&self.stable_id, "packet.stable_id")?;
        required(&self.owner, "packet.owner")?;
        required(&self.source_domain_owner, "packet.source_domain_owner")?;
        required(&self.target_domain_owner, "packet.target_domain_owner")?;
        required(&self.quantity, "packet.quantity")?;
        required(&self.unit, "packet.unit")?;
        required(&self.frame, "packet.frame")?;
        required(&self.causal_parent, "packet.causal_parent")?;
        check_version(self.version)?;
        if self.owner != OWNER {
            return Err(CouplingError::WrongOwner(self.owner.clone()));
        }
        if self.window_id != window.stable_id || self.window_version != window.version {
            return Err(CouplingError::ReferenceMismatch("S1.09.01 window"));
        }
        if classification.window_id != window.stable_id
            || classification.window_version != window.version
            || classification.source_domain_owner != self.source_domain_owner
            || classification.receiver_domain_owner != self.target_domain_owner
            || classification.interface_writes_domain_state
        {
            return Err(CouplingError::ReferenceMismatch("S1.09.02 classification"));
        }
        if self.source_domain_owner == self.target_domain_owner {
            return Err(CouplingError::InvalidInterfaceBoundary);
        }
        Ok(())
    }

    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{self:?}").as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct RecomputeReference {
    pub stable_id: String,
    pub version: u32,
    pub causal_parent: String,
    pub source_digest64: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BoundaryStateSnapshot {
    pub work_id: &'static str,
    pub schema_version: u32,
    pub snapshot_id: String,
    pub commit_marker: String,
    pub causal_cut: String,
    pub recovery_position: String,
    pub replay_reference: String,
    pub committed_pre_state_digest64: u64,
    pub recompute_refs: Vec<RecomputeReference>,
    pub event_order: Vec<String>,
}

#[derive(Debug)]
pub struct BoundarySnapshotInput<'a> {
    pub snapshot_id: &'a str,
    pub commit_marker: &'a str,
    pub causal_cut: &'a str,
    pub recovery_position: &'a str,
    pub replay_reference: &'a str,
    pub committed_pre_state_digest64: u64,
    pub recompute_refs: Vec<RecomputeReference>,
    pub event_order: Vec<String>,
}

impl BoundaryStateSnapshot {
    pub fn new(input: BoundarySnapshotInput<'_>) -> Result<Self, CouplingError> {
        let BoundarySnapshotInput {
            snapshot_id,
            commit_marker,
            causal_cut,
            recovery_position,
            replay_reference,
            committed_pre_state_digest64,
            mut recompute_refs,
            event_order,
        } = input;
        required(snapshot_id, "snapshot.id")?;
        required(commit_marker, "snapshot.commit_marker")?;
        required(causal_cut, "snapshot.causal_cut")?;
        required(recovery_position, "snapshot.recovery_position")?;
        required(replay_reference, "snapshot.replay_reference")?;
        if committed_pre_state_digest64 == 0 {
            return Err(CouplingError::MissingEvidence("committed pre-state"));
        }
        recompute_refs.sort();
        let snapshot = Self {
            work_id: "S1.09.04",
            schema_version: SCHEMA_VERSION,
            snapshot_id: snapshot_id.to_owned(),
            commit_marker: commit_marker.to_owned(),
            causal_cut: causal_cut.to_owned(),
            recovery_position: recovery_position.to_owned(),
            replay_reference: replay_reference.to_owned(),
            committed_pre_state_digest64,
            recompute_refs,
            event_order,
        };
        snapshot.validate()?;
        Ok(snapshot)
    }

    pub fn validate(&self) -> Result<(), CouplingError> {
        if self.schema_version != SCHEMA_VERSION {
            return Err(CouplingError::StaleVersion {
                expected: SCHEMA_VERSION,
                found: self.schema_version,
            });
        }
        required(&self.snapshot_id, "snapshot.id")?;
        required(&self.commit_marker, "snapshot.commit_marker")?;
        required(&self.causal_cut, "snapshot.causal_cut")?;
        required(&self.recovery_position, "snapshot.recovery_position")?;
        required(&self.replay_reference, "snapshot.replay_reference")?;
        if self.committed_pre_state_digest64 == 0 {
            return Err(CouplingError::MissingEvidence("committed pre-state"));
        }
        let mut ids = BTreeSet::new();
        for reference in &self.recompute_refs {
            required(&reference.stable_id, "recompute.stable_id")?;
            required(&reference.causal_parent, "recompute.causal_parent")?;
            check_version(reference.version)?;
            if reference.source_digest64 == 0 {
                return Err(CouplingError::MissingEvidence("recompute source"));
            }
            if !ids.insert((&reference.stable_id, reference.version)) {
                return Err(CouplingError::DuplicateStableId(
                    reference.stable_id.clone(),
                ));
            }
        }
        Ok(())
    }

    pub fn restore(&self) -> Result<Self, CouplingError> {
        self.validate()?;
        Ok(self.clone())
    }

    pub fn digest64(&self) -> Result<u64, CouplingError> {
        self.validate()?;
        Ok(fnv1a64(format!("{self:?}").as_bytes()))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FluxAccumulator {
    pub work_id: &'static str,
    pub window_id: String,
    pub window_version: u32,
    pub quantity: String,
    pub unit: String,
    pub frame: String,
    pub source_domain_owner: String,
    pub target_domain_owner: String,
    pub integrated_amount: i128,
    pub packet_ids: Vec<String>,
    pub evidence_digest64: u64,
    pub disposition: Disposition,
}

pub fn accumulate_flux(
    window: &CouplingWindow,
    classification: &ClassificationHandoff,
    packets: &[TypedFluxPacket],
) -> Result<FluxAccumulator, CouplingError> {
    if packets.is_empty() {
        return Err(CouplingError::MissingField("flux packets"));
    }
    let first = &packets[0];
    first.validate_against(window, classification)?;
    let mut amount = 0_i128;
    let mut by_id = BTreeMap::new();
    for packet in packets {
        packet.validate_against(window, classification)?;
        if packet.quantity != first.quantity
            || packet.unit != first.unit
            || packet.frame != first.frame
            || packet.source_domain_owner != first.source_domain_owner
            || packet.target_domain_owner != first.target_domain_owner
        {
            return Err(CouplingError::TypedFluxMismatch);
        }
        if by_id
            .insert(packet.stable_id.clone(), packet.digest64())
            .is_some()
        {
            return Err(CouplingError::DuplicateStableId(packet.stable_id.clone()));
        }
        amount = amount
            .checked_add(packet.integrated_amount)
            .ok_or(CouplingError::ArithmeticOverflow)?;
    }
    let packet_ids = by_id.keys().cloned().collect::<Vec<_>>();
    let evidence_digest64 = fnv1a64(format!("{by_id:?}").as_bytes());
    Ok(FluxAccumulator {
        work_id: "S1.09.05",
        window_id: window.stable_id.clone(),
        window_version: window.version,
        quantity: first.quantity.clone(),
        unit: first.unit.clone(),
        frame: first.frame.clone(),
        source_domain_owner: first.source_domain_owner.clone(),
        target_domain_owner: first.target_domain_owner.clone(),
        integrated_amount: amount,
        packet_ids,
        evidence_digest64,
        disposition: Disposition::CandidateOnly,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConservativeExchangeCandidate {
    pub work_id: &'static str,
    pub window_id: String,
    pub window_version: u32,
    pub quantity: String,
    pub unit: String,
    pub frame: String,
    pub source_domain_owner: String,
    pub target_domain_owner: String,
    pub source_delta: i128,
    pub target_delta: i128,
    pub residual: i128,
    pub accumulator_digest64: u64,
    pub causal_parent: String,
    pub canonical_commit_performed: bool,
    pub disposition: Disposition,
}

pub fn build_conservative_exchange(
    accumulator: &FluxAccumulator,
    causal_parent: &str,
    origin: WriteOrigin,
) -> Result<ConservativeExchangeCandidate, CouplingError> {
    validate_coupling_writer(origin)?;
    required(causal_parent, "exchange.causal_parent")?;
    if accumulator.evidence_digest64 == 0 {
        return Err(CouplingError::MissingEvidence("flux accumulator"));
    }
    let source_delta = accumulator
        .integrated_amount
        .checked_neg()
        .ok_or(CouplingError::ArithmeticOverflow)?;
    let target_delta = accumulator.integrated_amount;
    let residual = source_delta
        .checked_add(target_delta)
        .ok_or(CouplingError::ArithmeticOverflow)?;
    if residual != 0 {
        return Err(CouplingError::ConservationFailure);
    }
    Ok(ConservativeExchangeCandidate {
        work_id: "S1.09.06",
        window_id: accumulator.window_id.clone(),
        window_version: accumulator.window_version,
        quantity: accumulator.quantity.clone(),
        unit: accumulator.unit.clone(),
        frame: accumulator.frame.clone(),
        source_domain_owner: accumulator.source_domain_owner.clone(),
        target_domain_owner: accumulator.target_domain_owner.clone(),
        source_delta,
        target_delta,
        residual,
        accumulator_digest64: accumulator.evidence_digest64,
        causal_parent: causal_parent.to_owned(),
        canonical_commit_performed: false,
        disposition: Disposition::CandidateOnly,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EventLocalization {
    pub work_id: &'static str,
    pub event_id: String,
    pub window_id: String,
    pub phase: ProcessPhase,
    pub bracket_start_tick: i128,
    pub bracket_end_tick: i128,
    pub localized_tick: Option<i128>,
    pub causal_parent: String,
    pub eligible_for_sync: bool,
    pub disposition: Disposition,
}

pub fn localize_event(
    window: &CouplingWindow,
    event_id: &str,
    phase: ProcessPhase,
    bracket_start_tick: i128,
    bracket_end_tick: i128,
    localized_tick: Option<i128>,
    causal_parent: &str,
) -> Result<EventLocalization, CouplingError> {
    window.validate()?;
    required(event_id, "event.id")?;
    required(causal_parent, "event.causal_parent")?;
    if bracket_start_tick < window.start.tick
        || bracket_end_tick > window.end.tick
        || bracket_end_tick < bracket_start_tick
    {
        return Err(CouplingError::EventOutsideWindow);
    }
    let eligible_for_sync = match phase {
        ProcessPhase::Complete => {
            let tick = localized_tick.ok_or(CouplingError::MissingLocalizedEvent)?;
            if tick < bracket_start_tick || tick > bracket_end_tick {
                return Err(CouplingError::EventOutsideWindow);
            }
            true
        }
        ProcessPhase::Requested | ProcessPhase::InProgress | ProcessPhase::Partial => {
            if localized_tick.is_some() {
                return Err(CouplingError::PrematureCompletionEvidence);
            }
            false
        }
        ProcessPhase::Failed => false,
    };
    Ok(EventLocalization {
        work_id: "S1.09.07",
        event_id: event_id.to_owned(),
        window_id: window.stable_id.clone(),
        phase,
        bracket_start_tick,
        bracket_end_tick,
        localized_tick,
        causal_parent: causal_parent.to_owned(),
        eligible_for_sync,
        disposition: Disposition::CandidateOnly,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SynchronizationPoint {
    pub work_id: &'static str,
    pub window_id: String,
    pub phase: ProcessPhase,
    pub synchronized_time: Option<WorldTimeState>,
    pub participant_ids: Vec<String>,
    pub localization_digest64: u64,
    pub causal_parent: String,
    pub eligible_for_precommit: bool,
    pub canonical_commit_performed: bool,
    pub disposition: Disposition,
}

pub fn synchronize(
    window: &CouplingWindow,
    phase: ProcessPhase,
    participant_frontiers: &[(String, WorldTimeState)],
    localizations: &[EventLocalization],
    causal_parent: &str,
) -> Result<SynchronizationPoint, CouplingError> {
    window.validate()?;
    required(causal_parent, "sync.causal_parent")?;
    if participant_frontiers.len() < 2 {
        return Err(CouplingError::MissingField("sync.participants"));
    }
    let mut participant_ids = BTreeSet::new();
    for (id, time) in participant_frontiers {
        required(id, "sync.participant_id")?;
        time.validate()
            .map_err(|_| CouplingError::InvalidWorldTime)?;
        if !participant_ids.insert(id.clone()) {
            return Err(CouplingError::DuplicateStableId(id.clone()));
        }
    }
    let first_time = &participant_frontiers[0].1;
    let all_same_time = participant_frontiers.iter().all(|(_, time)| {
        time.epoch.id == first_time.epoch.id
            && time.tick == first_time.tick
            && time.microstep == first_time.microstep
    });
    let all_localized = localizations.iter().all(|event| {
        event.window_id == window.stable_id
            && event.phase == ProcessPhase::Complete
            && event.eligible_for_sync
    });
    let eligible_for_precommit = match phase {
        ProcessPhase::Complete => {
            if !all_same_time || !all_localized {
                return Err(CouplingError::SynchronizationIncomplete);
            }
            if first_time.tick < window.start.tick || first_time.tick > window.end.tick {
                return Err(CouplingError::EventOutsideWindow);
            }
            true
        }
        ProcessPhase::Requested | ProcessPhase::InProgress | ProcessPhase::Partial => false,
        ProcessPhase::Failed => false,
    };
    let localization_digest64 = fnv1a64(format!("{localizations:?}").as_bytes());
    Ok(SynchronizationPoint {
        work_id: "S1.09.08",
        window_id: window.stable_id.clone(),
        phase,
        synchronized_time: if eligible_for_precommit {
            Some(first_time.clone())
        } else {
            None
        },
        participant_ids: participant_ids.into_iter().collect(),
        localization_digest64,
        causal_parent: causal_parent.to_owned(),
        eligible_for_precommit,
        canonical_commit_performed: false,
        disposition: Disposition::CandidateOnly,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RollbackCandidate {
    pub work_id: &'static str,
    pub class: RollbackClass,
    pub window_id: String,
    pub window_start_tick: i128,
    pub synchronized_tick: i128,
    pub committed_frontier_tick: i128,
    pub target_tick: i128,
    pub causal_parent: String,
    pub canonical_commit_performed: bool,
    pub disposition: Disposition,
}

#[derive(Debug)]
pub struct RollbackRequest<'a> {
    pub window: &'a CouplingWindow,
    pub sync: &'a SynchronizationPoint,
    pub class: RollbackClass,
    pub committed_frontier_tick: i128,
    pub target_tick: i128,
    pub post_commit: bool,
    pub causal_parent: &'a str,
    pub origin: WriteOrigin,
}

pub fn request_precommit_rollback(
    request: RollbackRequest<'_>,
) -> Result<RollbackCandidate, CouplingError> {
    let RollbackRequest {
        window,
        sync,
        class,
        committed_frontier_tick,
        target_tick,
        post_commit,
        causal_parent,
        origin,
    } = request;
    validate_coupling_writer(origin)?;
    window.validate()?;
    required(causal_parent, "rollback.causal_parent")?;
    if post_commit {
        return Err(CouplingError::PostCommitRollbackProhibited);
    }
    if sync.window_id != window.stable_id
        || sync.phase != ProcessPhase::Complete
        || !sync.eligible_for_precommit
        || sync.canonical_commit_performed
    {
        return Err(CouplingError::SynchronizationIncomplete);
    }
    let synchronized_tick = sync
        .synchronized_time
        .as_ref()
        .ok_or(CouplingError::SynchronizationIncomplete)?
        .tick;
    if committed_frontier_tick < window.start.tick
        || committed_frontier_tick > synchronized_tick
        || target_tick < committed_frontier_tick
        || target_tick > synchronized_tick
    {
        return Err(CouplingError::RollbackOutsideHorizon);
    }
    Ok(RollbackCandidate {
        work_id: "S1.09.09",
        class,
        window_id: window.stable_id.clone(),
        window_start_tick: window.start.tick,
        synchronized_tick,
        committed_frontier_tick,
        target_tick,
        causal_parent: causal_parent.to_owned(),
        canonical_commit_performed: false,
        disposition: Disposition::CandidateOnly,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RollbackHorizonReceipt {
    pub work_id: &'static str,
    pub window_id: String,
    pub version: u32,
    pub owner: String,
    pub lower_bound_tick: i128,
    pub upper_bound_tick: i128,
    pub accepted_target_tick: i128,
    pub causal_parent: String,
    pub disposition: Disposition,
}

pub fn validate_rollback_horizon(
    rollback: &RollbackCandidate,
    version: u32,
    owner: &str,
    lower_bound_tick: i128,
    upper_bound_tick: i128,
    causal_parent: &str,
    origin: WriteOrigin,
) -> Result<RollbackHorizonReceipt, CouplingError> {
    validate_coupling_writer(origin)?;
    required(owner, "rollback_horizon.owner")?;
    required(causal_parent, "rollback_horizon.causal_parent")?;
    check_version(version)?;
    if owner != OWNER {
        return Err(CouplingError::WrongOwner(owner.to_owned()));
    }
    if rollback.canonical_commit_performed || rollback.disposition != Disposition::CandidateOnly {
        return Err(CouplingError::PostCommitRollbackProhibited);
    }
    if lower_bound_tick < rollback.committed_frontier_tick
        || upper_bound_tick > rollback.synchronized_tick
        || upper_bound_tick < lower_bound_tick
        || rollback.target_tick < lower_bound_tick
        || rollback.target_tick > upper_bound_tick
    {
        return Err(CouplingError::RollbackOutsideHorizon);
    }
    Ok(RollbackHorizonReceipt {
        work_id: "S1.09.10",
        window_id: rollback.window_id.clone(),
        version,
        owner: owner.to_owned(),
        lower_bound_tick,
        upper_bound_tick,
        accepted_target_tick: rollback.target_tick,
        causal_parent: causal_parent.to_owned(),
        disposition: Disposition::CandidateOnly,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CouplingStateSnapshot {
    pub schema_version: u32,
    pub snapshot_marker: String,
    pub causal_cut: String,
    pub boundary: BoundaryStateSnapshot,
    pub event_order: Vec<String>,
    pub canonical_commit_performed: bool,
}

impl CouplingStateSnapshot {
    pub fn validate(&self) -> Result<(), CouplingError> {
        if self.schema_version != SCHEMA_VERSION {
            return Err(CouplingError::StaleVersion {
                expected: SCHEMA_VERSION,
                found: self.schema_version,
            });
        }
        required(&self.snapshot_marker, "state_snapshot.marker")?;
        required(&self.causal_cut, "state_snapshot.causal_cut")?;
        self.boundary.validate()?;
        if self.canonical_commit_performed {
            return Err(CouplingError::CanonicalCommitOutOfScope);
        }
        Ok(())
    }

    pub fn restore(&self) -> Result<Self, CouplingError> {
        self.validate()?;
        Ok(self.clone())
    }

    pub fn digest64(&self) -> Result<u64, CouplingError> {
        self.validate()?;
        Ok(fnv1a64(format!("{self:?}").as_bytes()))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Wp015Acceptance {
    pub work_package: &'static str,
    pub member_ids: [&'static str; 10],
    pub predecessor_digest64: u64,
    pub member_evidence_digest64: u64,
    pub snapshot_digest64: u64,
    pub replay_digest64: u64,
    pub canonical_commit_performed: bool,
    pub closed: bool,
}

pub fn accept_wp015(
    admission: &AdmissionReceipt,
    passes: &[bool; 10],
    evidence: &[u64; 10],
    snapshot: &CouplingStateSnapshot,
    replay_digest64: u64,
) -> Result<Wp015Acceptance, CouplingError> {
    if admission.work_package != "WP-015"
        || admission.hard_predecessors != ["WP-004", "WP-010"]
        || admission.wp004_digest64 == 0
        || admission.wp010_digest64 == 0
    {
        return Err(CouplingError::InvalidPredecessor("WP-015 admission"));
    }
    if let Some(index) = passes.iter().position(|passed| !*passed) {
        return Err(CouplingError::MissingMemberEvidence(MEMBER_IDS[index]));
    }
    if let Some(index) = evidence.iter().position(|digest| *digest == 0) {
        return Err(CouplingError::MissingMemberEvidence(MEMBER_IDS[index]));
    }
    snapshot.validate()?;
    let expected_order = MEMBER_IDS
        .iter()
        .map(|id| (*id).to_owned())
        .collect::<Vec<_>>();
    if snapshot.event_order != expected_order {
        return Err(CouplingError::ReferenceMismatch("WP-015 event order"));
    }
    let snapshot_digest64 = snapshot.digest64()?;
    if replay_digest64 == 0 || replay_digest64 != snapshot_digest64 {
        return Err(CouplingError::ReplayDigestMismatch);
    }
    Ok(Wp015Acceptance {
        work_package: "WP-015",
        member_ids: MEMBER_IDS,
        predecessor_digest64: fnv1a64(format!("{admission:?}").as_bytes()),
        member_evidence_digest64: fnv1a64(format!("{passes:?}|{evidence:?}").as_bytes()),
        snapshot_digest64,
        replay_digest64,
        canonical_commit_performed: false,
        closed: true,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CouplingError {
    InvalidPredecessor(&'static str),
    MissingField(&'static str),
    MissingEvidence(&'static str),
    MissingMemberEvidence(&'static str),
    WrongOwner(String),
    UnauthorizedWrite(WriteOrigin),
    StaleVersion { expected: u32, found: u32 },
    InvalidWorldTime,
    WorldTimeBoundaryMismatch,
    InvalidWindowBounds,
    InvalidValidityHorizon,
    InvalidInterfaceBoundary,
    ReferenceMismatch(&'static str),
    TypedFluxMismatch,
    DuplicateStableId(String),
    ArithmeticOverflow,
    ConservationFailure,
    EventOutsideWindow,
    MissingLocalizedEvent,
    PrematureCompletionEvidence,
    SynchronizationIncomplete,
    PostCommitRollbackProhibited,
    RollbackOutsideHorizon,
    CanonicalCommitOutOfScope,
    ReplayDigestMismatch,
}

fn validate_coupling_writer(origin: WriteOrigin) -> Result<(), CouplingError> {
    if origin != WriteOrigin::CouplingRuntime {
        return Err(CouplingError::UnauthorizedWrite(origin));
    }
    Ok(())
}

fn check_version(version: u32) -> Result<(), CouplingError> {
    if version != SCHEMA_VERSION {
        return Err(CouplingError::StaleVersion {
            expected: SCHEMA_VERSION,
            found: version,
        });
    }
    Ok(())
}

fn required(value: &str, field: &'static str) -> Result<(), CouplingError> {
    if value.trim().is_empty() {
        return Err(CouplingError::MissingField(field));
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
