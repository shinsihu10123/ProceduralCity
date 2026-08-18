#![forbid(unsafe_code)]
//! Frozen WP-010 / S1.06 Hierarchical Causal Scheduler boundary.
//!
//! The scheduler orders already-defined domain work. It does not invent domain
//! priority, truth, or canonical outcomes. Render/frame-time and observation
//! inputs are explicitly non-causal.

use gaonn_identity_reuse_audit_core::AuditEvidence;
use gaonn_world_time_core::WorldTimeState;
use std::collections::{BTreeMap, BTreeSet};

pub const SCHEMA_VERSION: u32 = 1;
pub const OWNER: &str = "domain26.causal_scheduler";
pub const MEMBER_IDS: [&str; 10] = [
    "S1.06.01", "S1.06.02", "S1.06.03", "S1.06.04", "S1.06.05", "S1.06.06", "S1.06.07", "S1.06.08",
    "S1.06.09", "S1.06.10",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteOrigin {
    RuntimeAuthority,
    Derived,
    Observer,
    Renderer,
    Analytics,
    Ui,
    Ai,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SchedulableKind {
    Event,
    Process,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScheduleStatus {
    Pending,
    Sleeping,
    Ready,
    Waiting,
    Blocked,
    Completed,
    Retired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Disposition {
    CandidateOnly,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Wp002ClosureProof {
    pub version: u32,
    pub member_evidence: [u64; 9],
    pub reuse_audit: AuditEvidence,
    pub causal_parent: String,
}

impl Wp002ClosureProof {
    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{:?}", self).as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdmissionReceipt {
    pub work_package: &'static str,
    pub predecessor: &'static str,
    pub predecessor_version: u32,
    pub predecessor_digest64: u64,
    pub causal_parent: String,
}

pub fn admit(proof: &Wp002ClosureProof) -> Result<AdmissionReceipt, SchedulerError> {
    if proof.version != SCHEMA_VERSION
        || proof.member_evidence.contains(&0)
        || proof.reuse_audit.work_id != "S1.02.09"
        || !proof.reuse_audit.pass()
        || proof.causal_parent.trim().is_empty()
    {
        return Err(SchedulerError::InvalidPredecessor);
    }
    Ok(AdmissionReceipt {
        work_package: "WP-010",
        predecessor: "WP-002",
        predecessor_version: proof.version,
        predecessor_digest64: proof.digest64(),
        causal_parent: proof.causal_parent.clone(),
    })
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct SchedulingKey {
    pub deadline_tick: i128,
    pub microstep: u64,
    pub semantic_priority: i32,
    pub stable_id: String,
    pub version: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SchedulableRecord {
    pub stable_id: String,
    pub namespace: String,
    pub version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub kind: SchedulableKind,
    pub deadline: WorldTimeState,
    pub key: SchedulingKey,
    pub dependency_tokens: BTreeSet<String>,
    pub status: ScheduleStatus,
}

impl SchedulableRecord {
    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{:?}", self).as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContractReceipt {
    pub work_id: &'static str,
    pub stable_id: String,
    pub version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub operands: [&'static str; 4],
    pub disposition: Disposition,
}

pub fn validate_contract(
    record: &SchedulableRecord,
    transition: &str,
    allowed_transitions: &BTreeSet<String>,
    origin: WriteOrigin,
) -> Result<ContractReceipt, SchedulerError> {
    validate_record(record)?;
    validate_write(origin)?;
    required(transition, "transition")?;
    if !allowed_transitions.contains(transition) {
        return Err(SchedulerError::UnsupportedTransition(transition.to_owned()));
    }
    Ok(ContractReceipt {
        work_id: "S1.06.01",
        stable_id: record.stable_id.clone(),
        version: record.version,
        owner: record.owner.clone(),
        causal_parent: record.causal_parent.clone(),
        operands: ["Schedulable", "Event", "Causal", "Deadline"],
        disposition: Disposition::CandidateOnly,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CausalDeadlineRepresentation {
    pub work_id: &'static str,
    pub stable_id: String,
    pub version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub world_epoch_id: String,
    pub deadline_tick: i128,
    pub microstep: u64,
    pub changed_fields: [&'static str; 2],
    pub preserved_fields: [&'static str; 4],
}

pub fn represent_deadline(
    receipt: &ContractReceipt,
    record: &SchedulableRecord,
) -> Result<CausalDeadlineRepresentation, SchedulerError> {
    validate_record(record)?;
    validate_receipt(receipt, record)?;
    Ok(CausalDeadlineRepresentation {
        work_id: "S1.06.02",
        stable_id: record.stable_id.clone(),
        version: record.version,
        owner: record.owner.clone(),
        causal_parent: record.causal_parent.clone(),
        world_epoch_id: record.deadline.epoch.id.clone(),
        deadline_tick: record.deadline.tick,
        microstep: record.key.microstep,
        changed_fields: ["deadline_tick", "microstep"],
        preserved_fields: ["stable_id", "version", "owner", "causal_parent"],
    })
}

pub fn deterministic_key(
    receipt: &ContractReceipt,
    record: &SchedulableRecord,
) -> Result<SchedulingKey, SchedulerError> {
    validate_record(record)?;
    validate_receipt(receipt, record)?;
    Ok(record.key.clone())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SameTimeBucket {
    pub work_id: &'static str,
    pub epoch_id: String,
    pub tick: i128,
    pub ordered: Vec<SchedulableRecord>,
    pub causal_parent: String,
}

impl SameTimeBucket {
    pub fn collect(mut records: Vec<SchedulableRecord>) -> Result<Self, SchedulerError> {
        let first = records.first().ok_or(SchedulerError::EmptyBucket)?;
        validate_record(first)?;
        let epoch_id = first.deadline.epoch.id.clone();
        let tick = first.deadline.tick;
        let causal_parent = first.causal_parent.clone();
        for record in &records {
            validate_record(record)?;
            if record.deadline.epoch.id != epoch_id || record.deadline.tick != tick {
                return Err(SchedulerError::NotSameTime);
            }
        }
        records.sort_by(|left, right| left.key.cmp(&right.key));
        ensure_unique_keys(&records)?;
        Ok(Self {
            work_id: "S1.06.04",
            epoch_id,
            tick,
            ordered: records,
            causal_parent,
        })
    }

    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{:?}", self).as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolutionCandidate {
    pub record: SchedulableRecord,
    pub required_resources: BTreeSet<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RejectedCandidate {
    pub stable_id: String,
    pub reason: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolutionResult {
    pub work_id: &'static str,
    pub selected: Vec<String>,
    pub rejected: Vec<RejectedCandidate>,
    pub deterministic_order: Vec<String>,
    pub used_resources: BTreeSet<String>,
    pub causal_parent: String,
}

pub fn resolve_same_time(
    bucket: &SameTimeBucket,
    candidates: Vec<ResolutionCandidate>,
    available_dependencies: &BTreeSet<String>,
) -> Result<ResolutionResult, SchedulerError> {
    let bucket_ids: BTreeSet<_> = bucket
        .ordered
        .iter()
        .map(|record| record.stable_id.clone())
        .collect();
    let mut candidates = candidates;
    candidates.sort_by(|left, right| left.record.key.cmp(&right.record.key));
    let mut selected = Vec::new();
    let mut rejected = Vec::new();
    let mut order = Vec::new();
    let mut used_resources = BTreeSet::new();

    for candidate in candidates {
        validate_record(&candidate.record)?;
        if !bucket_ids.contains(&candidate.record.stable_id) {
            return Err(SchedulerError::OutOfBucket(candidate.record.stable_id));
        }
        order.push(candidate.record.stable_id.clone());
        if !candidate
            .record
            .dependency_tokens
            .is_subset(available_dependencies)
        {
            rejected.push(RejectedCandidate {
                stable_id: candidate.record.stable_id,
                reason: "dependency-unmet",
            });
            continue;
        }
        if candidate
            .required_resources
            .iter()
            .any(|resource| used_resources.contains(resource))
        {
            rejected.push(RejectedCandidate {
                stable_id: candidate.record.stable_id,
                reason: "resource-conflict",
            });
            continue;
        }
        used_resources.extend(candidate.required_resources);
        selected.push(candidate.record.stable_id);
    }

    Ok(ResolutionResult {
        work_id: "S1.06.05",
        selected,
        rejected,
        deterministic_order: order,
        used_resources,
        causal_parent: bucket.causal_parent.clone(),
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScheduleRecord {
    pub stable_id: String,
    pub source_version: u32,
    pub status: ScheduleStatus,
    pub next_execution_tick: Option<i128>,
    pub ordering_key: SchedulingKey,
    pub reason: Option<&'static str>,
    pub causal_parent: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct FutureEventQueue {
    records: BTreeMap<SchedulingKey, SchedulableRecord>,
    ids: BTreeSet<String>,
}

impl FutureEventQueue {
    pub fn insert(
        &mut self,
        record: SchedulableRecord,
        origin: WriteOrigin,
    ) -> Result<(), SchedulerError> {
        validate_write(origin)?;
        validate_record(&record)?;
        if self.ids.contains(&record.stable_id) {
            return Err(SchedulerError::DuplicateStableId(record.stable_id));
        }
        if self.records.contains_key(&record.key) {
            return Err(SchedulerError::DuplicateSchedulingKey);
        }
        self.ids.insert(record.stable_id.clone());
        self.records.insert(record.key.clone(), record);
        Ok(())
    }

    pub fn get(&self, stable_id: &str) -> Result<&SchedulableRecord, SchedulerError> {
        self.records
            .values()
            .find(|record| record.stable_id == stable_id)
            .ok_or_else(|| SchedulerError::DanglingReference(stable_id.to_owned()))
    }

    pub fn plan(
        &self,
        now: &WorldTimeState,
        available_dependencies: &BTreeSet<String>,
        max_ready: usize,
    ) -> Result<Vec<ScheduleRecord>, SchedulerError> {
        now.validate()
            .map_err(|_| SchedulerError::InvalidWorldTime)?;
        let mut ready_used = 0usize;
        let mut output = Vec::with_capacity(self.records.len());
        for record in self.records.values() {
            validate_record(record)?;
            ensure_same_epoch(&record.deadline, now)?;
            let (status, next_execution_tick, reason) = if record.deadline.tick < now.tick {
                (ScheduleStatus::Blocked, None, Some("deadline-expired"))
            } else if !record.dependency_tokens.is_subset(available_dependencies) {
                (
                    ScheduleStatus::Blocked,
                    Some(record.deadline.tick),
                    Some("dependency-unmet"),
                )
            } else if record.deadline.tick > now.tick {
                (
                    ScheduleStatus::Waiting,
                    Some(record.deadline.tick),
                    Some("future-wake"),
                )
            } else if ready_used < max_ready {
                ready_used += 1;
                (ScheduleStatus::Ready, Some(now.tick), None)
            } else {
                (
                    ScheduleStatus::Waiting,
                    Some(now.tick),
                    Some("budget-handoff-required"),
                )
            };
            output.push(ScheduleRecord {
                stable_id: record.stable_id.clone(),
                source_version: record.version,
                status,
                next_execution_tick,
                ordering_key: record.key.clone(),
                reason,
                causal_parent: record.causal_parent.clone(),
            });
        }
        Ok(output)
    }

    pub fn apply_plan(
        &mut self,
        plan: &[ScheduleRecord],
        origin: WriteOrigin,
    ) -> Result<(), SchedulerError> {
        validate_write(origin)?;
        for item in plan {
            let record = self.get(&item.stable_id)?;
            if record.version != item.source_version || record.key != item.ordering_key {
                return Err(SchedulerError::StaleVersion {
                    expected: record.version,
                    found: item.source_version,
                });
            }
        }
        for item in plan {
            if let Some(record) = self
                .records
                .values_mut()
                .find(|record| record.stable_id == item.stable_id)
            {
                record.status = item.status;
            }
        }
        Ok(())
    }

    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{:?}", self).as_bytes())
    }
}

pub fn schedule_inactive(
    record: &SchedulableRecord,
    now: &WorldTimeState,
    available_dependencies: &BTreeSet<String>,
) -> Result<ScheduleRecord, SchedulerError> {
    validate_record(record)?;
    ensure_same_epoch(&record.deadline, now)?;
    let (status, next_execution_tick, reason) = if record.deadline.tick < now.tick {
        (ScheduleStatus::Blocked, None, Some("deadline-expired"))
    } else if !record.dependency_tokens.is_subset(available_dependencies) {
        (
            ScheduleStatus::Blocked,
            Some(record.deadline.tick),
            Some("dependency-unmet"),
        )
    } else if record.deadline.tick == now.tick {
        (ScheduleStatus::Ready, Some(now.tick), None)
    } else {
        (
            ScheduleStatus::Sleeping,
            Some(record.deadline.tick),
            Some("sleep-until-wake"),
        )
    };
    Ok(ScheduleRecord {
        stable_id: record.stable_id.clone(),
        source_version: record.version,
        status,
        next_execution_tick,
        ordering_key: record.key.clone(),
        reason,
        causal_parent: record.causal_parent.clone(),
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SchedulerAdmission {
    pub work_id: &'static str,
    pub stable_id: String,
    pub source_version: u32,
    pub allowed: bool,
    pub blocking_reason: Option<&'static str>,
    pub key: SchedulingKey,
    pub causal_parent: String,
}

pub fn scheduler_admission(
    receipt: &ContractReceipt,
    record: &SchedulableRecord,
    predecessor_pass: bool,
    input_version: u32,
    blocking_reason: Option<&'static str>,
) -> Result<SchedulerAdmission, SchedulerError> {
    validate_receipt(receipt, record)?;
    if input_version != record.version {
        return Err(SchedulerError::StaleVersion {
            expected: record.version,
            found: input_version,
        });
    }
    let allowed = predecessor_pass && blocking_reason.is_none();
    Ok(SchedulerAdmission {
        work_id: "S1.06.08",
        stable_id: record.stable_id.clone(),
        source_version: record.version,
        allowed,
        blocking_reason: if predecessor_pass {
            blocking_reason
        } else {
            Some("predecessor-not-pass")
        },
        key: record.key.clone(),
        causal_parent: record.causal_parent.clone(),
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SchedulerBudget {
    pub schema_version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub available_work_slots: usize,
    pub budget_profile_ref: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SchedulerBudgetHandoff {
    pub work_id: &'static str,
    pub schema_version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub source_stable_id: String,
    pub source_version: u32,
    pub deadline_tick: i128,
    pub scheduling_key: SchedulingKey,
    pub available_work_slots: usize,
    pub budget_profile_ref: String,
}

pub fn budget_handoff(
    admission: &SchedulerAdmission,
    budget: &SchedulerBudget,
    origin: WriteOrigin,
) -> Result<SchedulerBudgetHandoff, SchedulerError> {
    validate_write(origin)?;
    if !admission.allowed {
        return Err(SchedulerError::AdmissionBlocked);
    }
    if budget.schema_version != SCHEMA_VERSION {
        return Err(SchedulerError::StaleVersion {
            expected: SCHEMA_VERSION,
            found: budget.schema_version,
        });
    }
    if budget.owner != OWNER {
        return Err(SchedulerError::WrongOwner(budget.owner.clone()));
    }
    required(&budget.causal_parent, "budget.causal_parent")?;
    required(&budget.budget_profile_ref, "budget.budget_profile_ref")?;
    Ok(SchedulerBudgetHandoff {
        work_id: "S1.06.09",
        schema_version: budget.schema_version,
        owner: budget.owner.clone(),
        causal_parent: budget.causal_parent.clone(),
        source_stable_id: admission.stable_id.clone(),
        source_version: admission.source_version,
        deadline_tick: admission.key.deadline_tick,
        scheduling_key: admission.key.clone(),
        available_work_slots: budget.available_work_slots,
        budget_profile_ref: budget.budget_profile_ref.clone(),
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FrameTimeCouplingAttempt {
    pub work_id: String,
    pub render_frame_time_controls_deadline: bool,
    pub visibility_controls_wake_or_pause: bool,
    pub observer_value_changes_order: bool,
    pub renderer_writes_scheduler_state: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CouplingViolation {
    pub work_id: String,
    pub first_failure: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CouplingAuditEvidence {
    pub work_id: &'static str,
    pub operands: [&'static str; 5],
    pub violations: Vec<CouplingViolation>,
    pub pre_digest64: u64,
    pub post_digest64: u64,
    pub reproduction: String,
    pub causal_parent: String,
}

impl CouplingAuditEvidence {
    pub fn pass(&self) -> bool {
        self.violations.is_empty() && self.pre_digest64 == self.post_digest64
    }
}

pub fn audit_frame_time_coupling(
    queue: &FutureEventQueue,
    attempts: &[FrameTimeCouplingAttempt],
    causal_parent: &str,
) -> Result<CouplingAuditEvidence, SchedulerError> {
    required(causal_parent, "audit.causal_parent")?;
    let pre = queue.digest64();
    let mut violations = Vec::new();
    for attempt in attempts {
        let failure = if attempt.render_frame_time_controls_deadline {
            Some("render-frame-time-controls-deadline")
        } else if attempt.visibility_controls_wake_or_pause {
            Some("visibility-controls-scheduler")
        } else if attempt.observer_value_changes_order {
            Some("observer-controls-order")
        } else if attempt.renderer_writes_scheduler_state {
            Some("renderer-write")
        } else {
            None
        };
        if let Some(first_failure) = failure {
            violations.push(CouplingViolation {
                work_id: attempt.work_id.clone(),
                first_failure,
            });
        }
    }
    Ok(CouplingAuditEvidence {
        work_id: "S1.06.10",
        operands: ["Render", "Frame-Time", "Coupling", "Schedulable", "Event"],
        violations,
        pre_digest64: pre,
        post_digest64: queue.digest64(),
        reproduction:
            "replay identical queue; toggle only render/frame-time/observer coupling attempt"
                .to_owned(),
        causal_parent: causal_parent.to_owned(),
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SchedulerSnapshot {
    pub schema_version: u32,
    pub commit_marker: String,
    pub causal_cut: String,
    pub queue: FutureEventQueue,
}

impl SchedulerSnapshot {
    pub fn validate(&self) -> Result<(), SchedulerError> {
        if self.schema_version != SCHEMA_VERSION {
            return Err(SchedulerError::StaleVersion {
                expected: SCHEMA_VERSION,
                found: self.schema_version,
            });
        }
        required(&self.commit_marker, "snapshot.commit_marker")?;
        required(&self.causal_cut, "snapshot.causal_cut")?;
        for record in self.queue.records.values() {
            validate_record(record)?;
        }
        Ok(())
    }

    pub fn restore(&self) -> Result<FutureEventQueue, SchedulerError> {
        self.validate()?;
        Ok(self.queue.clone())
    }

    pub fn digest64(&self) -> Result<u64, SchedulerError> {
        self.validate()?;
        Ok(fnv1a64(format!("{:?}", self).as_bytes()))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Wp010Acceptance {
    pub work_package: &'static str,
    pub member_ids: [&'static str; 10],
    pub predecessor_digest64: u64,
    pub evidence_digest64: u64,
    pub snapshot_digest64: u64,
    pub closed: bool,
}

pub fn accept_wp(
    proof: &Wp002ClosureProof,
    passes: &[bool; 10],
    evidence: &[u64; 10],
    snapshot_digest64: u64,
) -> Result<Wp010Acceptance, SchedulerError> {
    let admission = admit(proof)?;
    if let Some(index) = passes.iter().position(|passed| !*passed) {
        return Err(SchedulerError::MissingEvidence(MEMBER_IDS[index]));
    }
    if let Some(index) = evidence.iter().position(|digest| *digest == 0) {
        return Err(SchedulerError::MissingEvidence(MEMBER_IDS[index]));
    }
    if snapshot_digest64 == 0 {
        return Err(SchedulerError::MissingSnapshotEvidence);
    }
    Ok(Wp010Acceptance {
        work_package: "WP-010",
        member_ids: MEMBER_IDS,
        predecessor_digest64: admission.predecessor_digest64,
        evidence_digest64: fnv1a64(format!("{:?}{:?}", passes, evidence).as_bytes()),
        snapshot_digest64,
        closed: true,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SchedulerError {
    InvalidPredecessor,
    MissingField(&'static str),
    WrongOwner(String),
    UnauthorizedWrite(WriteOrigin),
    StaleVersion { expected: u32, found: u32 },
    InvalidWorldTime,
    WorldTimeEpochMismatch,
    ReferenceMismatch(&'static str),
    UnsupportedTransition(String),
    DuplicateStableId(String),
    DuplicateSchedulingKey,
    DanglingReference(String),
    EmptyBucket,
    NotSameTime,
    OutOfBucket(String),
    AdmissionBlocked,
    MissingEvidence(&'static str),
    MissingSnapshotEvidence,
}

fn validate_record(record: &SchedulableRecord) -> Result<(), SchedulerError> {
    required(&record.stable_id, "stable_id")?;
    required(&record.namespace, "namespace")?;
    required(&record.owner, "owner")?;
    required(&record.causal_parent, "causal_parent")?;
    if record.owner != OWNER {
        return Err(SchedulerError::WrongOwner(record.owner.clone()));
    }
    if record.version == 0 {
        return Err(SchedulerError::StaleVersion {
            expected: 1,
            found: 0,
        });
    }
    record
        .deadline
        .validate()
        .map_err(|_| SchedulerError::InvalidWorldTime)?;
    if record.key.stable_id != record.stable_id
        || record.key.version != record.version
        || record.key.deadline_tick != record.deadline.tick
        || record.key.microstep != record.deadline.microstep
    {
        return Err(SchedulerError::ReferenceMismatch(
            "deterministic scheduling key",
        ));
    }
    Ok(())
}

fn validate_receipt(
    receipt: &ContractReceipt,
    record: &SchedulableRecord,
) -> Result<(), SchedulerError> {
    if receipt.work_id != "S1.06.01"
        || receipt.stable_id != record.stable_id
        || receipt.version != record.version
        || receipt.owner != record.owner
        || receipt.causal_parent != record.causal_parent
    {
        return Err(SchedulerError::ReferenceMismatch(
            "S1.06.01 contract receipt",
        ));
    }
    Ok(())
}

fn validate_write(origin: WriteOrigin) -> Result<(), SchedulerError> {
    if origin != WriteOrigin::RuntimeAuthority {
        return Err(SchedulerError::UnauthorizedWrite(origin));
    }
    Ok(())
}

fn ensure_same_epoch(left: &WorldTimeState, right: &WorldTimeState) -> Result<(), SchedulerError> {
    left.validate()
        .map_err(|_| SchedulerError::InvalidWorldTime)?;
    right
        .validate()
        .map_err(|_| SchedulerError::InvalidWorldTime)?;
    if left.epoch.id != right.epoch.id {
        return Err(SchedulerError::WorldTimeEpochMismatch);
    }
    Ok(())
}

fn ensure_unique_keys(records: &[SchedulableRecord]) -> Result<(), SchedulerError> {
    let mut keys = BTreeSet::new();
    let mut ids = BTreeSet::new();
    for record in records {
        if !keys.insert(record.key.clone()) {
            return Err(SchedulerError::DuplicateSchedulingKey);
        }
        if !ids.insert(record.stable_id.clone()) {
            return Err(SchedulerError::DuplicateStableId(record.stable_id.clone()));
        }
    }
    Ok(())
}

fn required(value: &str, field: &'static str) -> Result<(), SchedulerError> {
    if value.trim().is_empty() {
        Err(SchedulerError::MissingField(field))
    } else {
        Ok(())
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
