#![forbid(unsafe_code)]
//! Frozen WP-014 / S1.07.01..S1.07.08 transaction pre-commit boundary.
//!
//! This crate stops before S1.07.09 Atomic Canonical Commit. It builds and validates
//! causally closed transaction material from immutable pre-state, but every output
//! remains CandidateOnly. Canonical mutation belongs to a later Frozen WP.

use gaonn_scheduler_core::{Wp002ClosureProof, Wp010Acceptance};
use gaonn_world_core::ValidationReceipt;
use gaonn_world_time_core::{WorldTimeState, Wp004Acceptance};
use std::collections::{BTreeMap, BTreeSet};

pub const SCHEMA_VERSION: u32 = 1;
pub const TRANSACTION_OWNER: &str = "domain26.transaction_coordinator";
pub const MEMBER_IDS: [&str; 8] = [
    "S1.07.01", "S1.07.02", "S1.07.03", "S1.07.04", "S1.07.05", "S1.07.06", "S1.07.07", "S1.07.08",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteOrigin {
    TransactionCoordinator,
    StateOwner,
    Worker,
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
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verdict {
    Pass,
    Fail,
    Blocked,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransactionLifecycle {
    Active,
    Retired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GuardPhase {
    Requested,
    InProgress,
    Partial,
    Complete,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdmissionReceipt {
    pub work_package: &'static str,
    pub hard_predecessors: [&'static str; 4],
    pub root_digest64: u64,
    pub wp002_digest64: u64,
    pub wp004_digest64: u64,
    pub wp010_digest64: u64,
    pub causal_parent: String,
}

pub fn admit_wp014(
    root: &ValidationReceipt,
    wp002: &Wp002ClosureProof,
    wp004: &Wp004Acceptance,
    wp010: &Wp010Acceptance,
) -> Result<AdmissionReceipt, TransactionError> {
    let root_digest64 = root.evidence_digest64();
    if root.work_id != "S1.01.01"
        || root.contract_version != SCHEMA_VERSION
        || root_digest64 == 0
        || root.causal_parent.trim().is_empty()
    {
        return Err(TransactionError::InvalidPredecessor("WP-001"));
    }
    if wp002.version != SCHEMA_VERSION
        || wp002.member_evidence.contains(&0)
        || !wp002.reuse_audit.pass()
        || wp002.causal_parent.trim().is_empty()
    {
        return Err(TransactionError::InvalidPredecessor("WP-002"));
    }
    if wp004.work_package != "WP-004"
        || !wp004.closed
        || wp004.member_ids != gaonn_world_time_core::MEMBER_IDS
        || wp004.evidence_digest64 == 0
        || wp004.predecessor_digest64 != root_digest64
    {
        return Err(TransactionError::InvalidPredecessor("WP-004"));
    }
    if wp010.work_package != "WP-010"
        || !wp010.closed
        || wp010.member_ids != gaonn_scheduler_core::MEMBER_IDS
        || wp010.evidence_digest64 == 0
        || wp010.snapshot_digest64 == 0
        || wp010.predecessor_digest64 != wp002.digest64()
    {
        return Err(TransactionError::InvalidPredecessor("WP-010"));
    }
    Ok(AdmissionReceipt {
        work_package: "WP-014",
        hard_predecessors: ["WP-001", "WP-002", "WP-004", "WP-010"],
        root_digest64,
        wp002_digest64: wp002.digest64(),
        wp004_digest64: wp004.evidence_digest64,
        wp010_digest64: wp010.evidence_digest64,
        causal_parent: root.causal_parent.clone(),
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CanonicalTransaction {
    pub stable_id: String,
    pub namespace: String,
    pub version: u32,
    pub owner: String,
    pub causal_episode: String,
    pub causal_parent: String,
    pub world_time: WorldTimeState,
    pub lifecycle: TransactionLifecycle,
    pub lineage: Vec<String>,
}

impl CanonicalTransaction {
    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{self:?}").as_bytes())
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TransactionRegistry {
    active: BTreeMap<String, CanonicalTransaction>,
    retired_ids: BTreeSet<String>,
}

impl TransactionRegistry {
    pub fn create(
        &mut self,
        transaction: CanonicalTransaction,
        origin: WriteOrigin,
    ) -> Result<(), TransactionError> {
        validate_transaction(&transaction)?;
        validate_coordinator(origin)?;
        if self.active.contains_key(&transaction.stable_id)
            || self.retired_ids.contains(&transaction.stable_id)
        {
            return Err(TransactionError::DuplicateOrReusedId(transaction.stable_id));
        }
        self.active
            .insert(transaction.stable_id.clone(), transaction);
        Ok(())
    }

    pub fn get(&self, stable_id: &str) -> Result<&CanonicalTransaction, TransactionError> {
        self.active
            .get(stable_id)
            .ok_or_else(|| TransactionError::DanglingReference(stable_id.to_owned()))
    }

    pub fn update(
        &mut self,
        stable_id: &str,
        expected_version: u32,
        causal_parent: &str,
        origin: WriteOrigin,
    ) -> Result<(), TransactionError> {
        validate_coordinator(origin)?;
        required(causal_parent, "transaction.causal_parent")?;
        let current = self.get(stable_id)?.clone();
        if current.version != expected_version {
            return Err(TransactionError::StaleVersion {
                expected: current.version,
                found: expected_version,
            });
        }
        let next_version = current
            .version
            .checked_add(1)
            .ok_or(TransactionError::VersionOverflow)?;
        let mut next = current;
        next.version = next_version;
        next.causal_parent = causal_parent.to_owned();
        next.lineage
            .push(format!("update:{expected_version}->{next_version}"));
        self.active.insert(stable_id.to_owned(), next);
        Ok(())
    }

    pub fn retire(
        &mut self,
        stable_id: &str,
        expected_version: u32,
        causal_parent: &str,
        origin: WriteOrigin,
    ) -> Result<CanonicalTransaction, TransactionError> {
        validate_coordinator(origin)?;
        required(causal_parent, "retire.causal_parent")?;
        let current = self.get(stable_id)?;
        if current.version != expected_version {
            return Err(TransactionError::StaleVersion {
                expected: current.version,
                found: expected_version,
            });
        }
        let mut retired = self
            .active
            .remove(stable_id)
            .ok_or_else(|| TransactionError::DanglingReference(stable_id.to_owned()))?;
        retired.lifecycle = TransactionLifecycle::Retired;
        retired.causal_parent = causal_parent.to_owned();
        retired.lineage.push(format!("retire:{expected_version}"));
        self.retired_ids.insert(stable_id.to_owned());
        Ok(retired)
    }

    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{self:?}").as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct ReadVersion {
    pub state_key: String,
    pub version: u64,
    pub state_owner: String,
    pub state_digest64: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReadSet {
    pub transaction_id: String,
    pub transaction_version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub entries: Vec<ReadVersion>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReadSetReceipt {
    pub work_id: &'static str,
    pub transaction_id: String,
    pub transaction_version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub read_set_digest64: u64,
    pub disposition: Disposition,
}

pub fn validate_read_set(
    transaction: &CanonicalTransaction,
    read_set: &ReadSet,
) -> Result<ReadSetReceipt, TransactionError> {
    validate_transaction(transaction)?;
    validate_transaction_link(
        transaction,
        &read_set.transaction_id,
        read_set.transaction_version,
        &read_set.owner,
        &read_set.causal_parent,
    )?;
    if read_set.entries.is_empty() {
        return Err(TransactionError::MissingField("read_set.entries"));
    }
    let mut keys = BTreeSet::new();
    for entry in &read_set.entries {
        required(&entry.state_key, "read_set.state_key")?;
        required(&entry.state_owner, "read_set.state_owner")?;
        if entry.version == 0 || entry.state_digest64 == 0 {
            return Err(TransactionError::InvalidReadVersion(
                entry.state_key.clone(),
            ));
        }
        if !keys.insert(entry.state_key.clone()) {
            return Err(TransactionError::DuplicateReadKey(entry.state_key.clone()));
        }
    }
    Ok(ReadSetReceipt {
        work_id: "S1.07.02",
        transaction_id: transaction.stable_id.clone(),
        transaction_version: transaction.version,
        owner: transaction.owner.clone(),
        causal_parent: transaction.causal_parent.clone(),
        read_set_digest64: fnv1a64(format!("{:?}", read_set.entries).as_bytes()),
        disposition: Disposition::CandidateOnly,
    })
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct WriteIntent {
    pub state_key: String,
    pub base_version: u64,
    pub target_owner: String,
    pub proposed_state_digest64: u64,
    pub semantic_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WriteIntentSet {
    pub transaction_id: String,
    pub transaction_version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub intents: Vec<WriteIntent>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WriteIntentReceipt {
    pub work_id: &'static str,
    pub transaction_id: String,
    pub transaction_version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub read_set_digest64: u64,
    pub write_intent_digest64: u64,
    pub disposition: Disposition,
}

pub fn validate_write_intents(
    transaction: &CanonicalTransaction,
    read_set: &ReadSet,
    read_receipt: &ReadSetReceipt,
    write_set: &WriteIntentSet,
) -> Result<WriteIntentReceipt, TransactionError> {
    let fresh_receipt = validate_read_set(transaction, read_set)?;
    if &fresh_receipt != read_receipt {
        return Err(TransactionError::ReferenceMismatch(
            "S1.07.02 read-set receipt",
        ));
    }
    validate_transaction_link(
        transaction,
        &write_set.transaction_id,
        write_set.transaction_version,
        &write_set.owner,
        &write_set.causal_parent,
    )?;
    if write_set.intents.is_empty() {
        return Err(TransactionError::MissingField("write_set.intents"));
    }
    let read_by_key: BTreeMap<_, _> = read_set
        .entries
        .iter()
        .map(|entry| (entry.state_key.as_str(), entry))
        .collect();
    let mut write_keys = BTreeSet::new();
    for intent in &write_set.intents {
        required(&intent.state_key, "write_intent.state_key")?;
        required(&intent.target_owner, "write_intent.target_owner")?;
        required(&intent.semantic_key, "write_intent.semantic_key")?;
        if intent.proposed_state_digest64 == 0 {
            return Err(TransactionError::MissingEvidence(
                "write_intent.proposed_state",
            ));
        }
        if !write_keys.insert(intent.state_key.clone()) {
            return Err(TransactionError::DuplicateWriteKey(
                intent.state_key.clone(),
            ));
        }
        let source = read_by_key
            .get(intent.state_key.as_str())
            .ok_or_else(|| TransactionError::MissingReadBasis(intent.state_key.clone()))?;
        if source.version != intent.base_version || source.state_owner != intent.target_owner {
            return Err(TransactionError::ReferenceMismatch(
                "write-intent immutable pre-state basis",
            ));
        }
    }
    Ok(WriteIntentReceipt {
        work_id: "S1.07.03",
        transaction_id: transaction.stable_id.clone(),
        transaction_version: transaction.version,
        owner: transaction.owner.clone(),
        causal_parent: transaction.causal_parent.clone(),
        read_set_digest64: read_receipt.read_set_digest64,
        write_intent_digest64: fnv1a64(format!("{:?}", write_set.intents).as_bytes()),
        disposition: Disposition::CandidateOnly,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GuardCheck {
    pub name: String,
    pub passed: bool,
    pub evidence_digest64: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GuardEvaluation {
    pub work_id: &'static str,
    pub transaction_id: String,
    pub transaction_version: u32,
    pub phase: GuardPhase,
    pub verdict: Verdict,
    pub checks: Vec<GuardCheck>,
    pub causal_parent: String,
    pub read_set_digest64: u64,
    pub write_intent_digest64: u64,
    pub disposition: Disposition,
}

impl GuardEvaluation {
    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{self:?}").as_bytes())
    }
}

pub fn evaluate_guards(
    transaction: &CanonicalTransaction,
    read_receipt: &ReadSetReceipt,
    write_receipt: &WriteIntentReceipt,
    phase: GuardPhase,
    checks: Vec<GuardCheck>,
) -> Result<GuardEvaluation, TransactionError> {
    validate_receipt_links(transaction, read_receipt, write_receipt)?;
    if checks.is_empty() {
        return Err(TransactionError::MissingField("guard.checks"));
    }
    for check in &checks {
        required(&check.name, "guard.name")?;
        if check.evidence_digest64 == 0 {
            return Err(TransactionError::MissingEvidence("guard.evidence"));
        }
    }
    let verdict = match phase {
        GuardPhase::Complete if checks.iter().all(|check| check.passed) => Verdict::Pass,
        GuardPhase::Complete | GuardPhase::Failed => Verdict::Fail,
        GuardPhase::Requested | GuardPhase::InProgress | GuardPhase::Partial => Verdict::Blocked,
    };
    Ok(GuardEvaluation {
        work_id: "S1.07.04",
        transaction_id: transaction.stable_id.clone(),
        transaction_version: transaction.version,
        phase,
        verdict,
        checks,
        causal_parent: transaction.causal_parent.clone(),
        read_set_digest64: read_receipt.read_set_digest64,
        write_intent_digest64: write_receipt.write_intent_digest64,
        disposition: Disposition::CandidateOnly,
    })
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct SpeculativeDelta {
    pub state_key: String,
    pub base_version: u64,
    pub target_owner: String,
    pub proposed_state_digest64: u64,
    pub semantic_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpeculativeResultBuffer {
    pub work_id: &'static str,
    pub transaction_id: String,
    pub transaction_version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub guard_digest64: u64,
    pub immutable_pre_state_digest64: u64,
    pub deltas: Vec<SpeculativeDelta>,
    pub disposition: Disposition,
    pub canonical_commit_performed: bool,
}

impl SpeculativeResultBuffer {
    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{self:?}").as_bytes())
    }
}

pub fn build_speculative_buffer(
    transaction: &CanonicalTransaction,
    read_set: &ReadSet,
    write_set: &WriteIntentSet,
    guard: &GuardEvaluation,
    origin: WriteOrigin,
) -> Result<SpeculativeResultBuffer, TransactionError> {
    validate_coordinator(origin)?;
    if guard.verdict != Verdict::Pass || guard.phase != GuardPhase::Complete {
        return Err(TransactionError::GuardNotSatisfied);
    }
    validate_transaction_link(
        transaction,
        &write_set.transaction_id,
        write_set.transaction_version,
        &write_set.owner,
        &write_set.causal_parent,
    )?;
    if guard.transaction_id != transaction.stable_id
        || guard.transaction_version != transaction.version
    {
        return Err(TransactionError::ReferenceMismatch("S1.07.04 guard"));
    }
    let immutable_pre_state_digest64 = fnv1a64(format!("{:?}", read_set.entries).as_bytes());
    let deltas = write_set
        .intents
        .iter()
        .map(|intent| SpeculativeDelta {
            state_key: intent.state_key.clone(),
            base_version: intent.base_version,
            target_owner: intent.target_owner.clone(),
            proposed_state_digest64: intent.proposed_state_digest64,
            semantic_key: intent.semantic_key.clone(),
        })
        .collect();
    Ok(SpeculativeResultBuffer {
        work_id: "S1.07.05",
        transaction_id: transaction.stable_id.clone(),
        transaction_version: transaction.version,
        owner: transaction.owner.clone(),
        causal_parent: transaction.causal_parent.clone(),
        guard_digest64: guard.digest64(),
        immutable_pre_state_digest64,
        deltas,
        disposition: Disposition::CandidateOnly,
        canonical_commit_performed: false,
    })
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct WriteConflict {
    pub state_key: String,
    pub base_version: u64,
    pub left_transaction: String,
    pub right_transaction: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConflictReport {
    pub work_id: &'static str,
    pub conflicts: Vec<WriteConflict>,
    pub inspected_transactions: Vec<String>,
    pub pre_digest64: u64,
    pub post_digest64: u64,
    pub disposition: Disposition,
}

impl ConflictReport {
    pub fn pass(&self) -> bool {
        self.conflicts.is_empty() && self.pre_digest64 == self.post_digest64
    }

    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{self:?}").as_bytes())
    }
}

pub fn detect_write_conflicts(
    buffers: &[SpeculativeResultBuffer],
) -> Result<ConflictReport, TransactionError> {
    if buffers.is_empty() {
        return Err(TransactionError::MissingField("conflict.buffers"));
    }
    let pre_digest64 = fnv1a64(format!("{buffers:?}").as_bytes());
    let mut claims: BTreeMap<(String, u64), Vec<String>> = BTreeMap::new();
    let mut inspected_transactions = Vec::new();
    for buffer in buffers {
        validate_buffer(buffer)?;
        inspected_transactions.push(buffer.transaction_id.clone());
        for delta in &buffer.deltas {
            claims
                .entry((delta.state_key.clone(), delta.base_version))
                .or_default()
                .push(buffer.transaction_id.clone());
        }
    }
    inspected_transactions.sort();
    inspected_transactions.dedup();
    let mut conflicts = Vec::new();
    for ((state_key, base_version), mut transactions) in claims {
        transactions.sort();
        transactions.dedup();
        for left in 0..transactions.len() {
            for right in (left + 1)..transactions.len() {
                conflicts.push(WriteConflict {
                    state_key: state_key.clone(),
                    base_version,
                    left_transaction: transactions[left].clone(),
                    right_transaction: transactions[right].clone(),
                });
            }
        }
    }
    let post_digest64 = fnv1a64(format!("{buffers:?}").as_bytes());
    Ok(ConflictReport {
        work_id: "S1.07.06",
        conflicts,
        inspected_transactions,
        pre_digest64,
        post_digest64,
        disposition: Disposition::CandidateOnly,
    })
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct ResolutionKey {
    pub world_tick: i128,
    pub microstep: u64,
    pub semantic_key: String,
    pub transaction_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolutionInput {
    pub transaction_id: String,
    pub world_time: WorldTimeState,
    pub semantic_key: String,
    pub causal_parent: String,
    pub worker_hint: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeterministicResolution {
    pub work_id: &'static str,
    pub ordered_transaction_ids: Vec<String>,
    pub ordering_keys: Vec<ResolutionKey>,
    pub causal_parents: Vec<String>,
    pub disposition: Disposition,
}

impl DeterministicResolution {
    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{self:?}").as_bytes())
    }
}

pub fn deterministic_resolution_order(
    report: &ConflictReport,
    mut inputs: Vec<ResolutionInput>,
) -> Result<DeterministicResolution, TransactionError> {
    if !report.pass() {
        return Err(TransactionError::WriteConflict);
    }
    if inputs.is_empty() {
        return Err(TransactionError::MissingField("resolution.inputs"));
    }
    let expected: BTreeSet<_> = report.inspected_transactions.iter().cloned().collect();
    let actual: BTreeSet<_> = inputs
        .iter()
        .map(|input| input.transaction_id.clone())
        .collect();
    if expected != actual {
        return Err(TransactionError::ReferenceMismatch(
            "conflict-report/resolution transaction set",
        ));
    }
    for input in &inputs {
        input
            .world_time
            .validate()
            .map_err(|_| TransactionError::InvalidWorldTime)?;
        required(&input.transaction_id, "resolution.transaction_id")?;
        required(&input.semantic_key, "resolution.semantic_key")?;
        required(&input.causal_parent, "resolution.causal_parent")?;
    }
    inputs.sort_by(|left, right| {
        ResolutionKey {
            world_tick: left.world_time.tick,
            microstep: left.world_time.microstep,
            semantic_key: left.semantic_key.clone(),
            transaction_id: left.transaction_id.clone(),
        }
        .cmp(&ResolutionKey {
            world_tick: right.world_time.tick,
            microstep: right.world_time.microstep,
            semantic_key: right.semantic_key.clone(),
            transaction_id: right.transaction_id.clone(),
        })
    });
    let ordering_keys = inputs
        .iter()
        .map(|input| ResolutionKey {
            world_tick: input.world_time.tick,
            microstep: input.world_time.microstep,
            semantic_key: input.semantic_key.clone(),
            transaction_id: input.transaction_id.clone(),
        })
        .collect();
    Ok(DeterministicResolution {
        work_id: "S1.07.07",
        ordered_transaction_ids: inputs
            .iter()
            .map(|input| input.transaction_id.clone())
            .collect(),
        ordering_keys,
        causal_parents: inputs
            .iter()
            .map(|input| input.causal_parent.clone())
            .collect(),
        disposition: Disposition::CandidateOnly,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvariantCondition {
    pub name: String,
    pub passed: bool,
    pub evidence_digest64: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConservationCheck {
    pub quantity: String,
    pub before: i128,
    pub proposed_delta: i128,
    pub after: i128,
    pub evidence_digest64: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreCommitHandoff {
    pub work_id: &'static str,
    pub ordered_transaction_ids: Vec<String>,
    pub invariant_evidence_digest64: u64,
    pub source_buffer_digest64: u64,
    pub causal_parent: String,
    pub eligible_for_future_atomic_commit: bool,
    pub canonical_commit_performed: bool,
    pub disposition: Disposition,
}

impl PreCommitHandoff {
    pub fn digest64(&self) -> u64 {
        fnv1a64(format!("{self:?}").as_bytes())
    }
}

pub fn precommit_invariant_hook(
    resolution: &DeterministicResolution,
    buffers: &[SpeculativeResultBuffer],
    conditions: &[InvariantCondition],
    conservation: &[ConservationCheck],
    causal_parent: &str,
) -> Result<PreCommitHandoff, TransactionError> {
    required(causal_parent, "precommit.causal_parent")?;
    if conditions.is_empty() && conservation.is_empty() {
        return Err(TransactionError::MissingField("precommit.invariants"));
    }
    let expected: BTreeSet<_> = resolution.ordered_transaction_ids.iter().cloned().collect();
    let actual: BTreeSet<_> = buffers
        .iter()
        .map(|buffer| buffer.transaction_id.clone())
        .collect();
    if expected != actual {
        return Err(TransactionError::ReferenceMismatch(
            "resolution/precommit buffer set",
        ));
    }
    for condition in conditions {
        required(&condition.name, "invariant.name")?;
        if condition.evidence_digest64 == 0 {
            return Err(TransactionError::MissingEvidence("invariant.evidence"));
        }
        if !condition.passed {
            return Err(TransactionError::InvariantFailure(condition.name.clone()));
        }
    }
    for check in conservation {
        required(&check.quantity, "conservation.quantity")?;
        if check.evidence_digest64 == 0 {
            return Err(TransactionError::MissingEvidence("conservation.evidence"));
        }
        let expected_after = check
            .before
            .checked_add(check.proposed_delta)
            .ok_or(TransactionError::ArithmeticOverflow)?;
        if expected_after != check.after {
            return Err(TransactionError::ConservationFailure(
                check.quantity.clone(),
            ));
        }
    }
    let invariant_evidence_digest64 =
        fnv1a64(format!("conditions={conditions:?}|conservation={conservation:?}").as_bytes());
    let source_buffer_digest64 = fnv1a64(format!("{buffers:?}").as_bytes());
    Ok(PreCommitHandoff {
        work_id: "S1.07.08",
        ordered_transaction_ids: resolution.ordered_transaction_ids.clone(),
        invariant_evidence_digest64,
        source_buffer_digest64,
        causal_parent: causal_parent.to_owned(),
        eligible_for_future_atomic_commit: true,
        canonical_commit_performed: false,
        disposition: Disposition::CandidateOnly,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TransactionSnapshot {
    pub schema_version: u32,
    pub snapshot_marker: String,
    pub causal_cut: String,
    pub registry: TransactionRegistry,
    pub speculative_buffers: Vec<SpeculativeResultBuffer>,
    pub event_order: Vec<String>,
    pub evidence_hash64: u64,
}

impl TransactionSnapshot {
    pub fn new(
        snapshot_marker: &str,
        causal_cut: &str,
        registry: TransactionRegistry,
        speculative_buffers: Vec<SpeculativeResultBuffer>,
        event_order: Vec<String>,
    ) -> Result<Self, TransactionError> {
        required(snapshot_marker, "snapshot.marker")?;
        required(causal_cut, "snapshot.causal_cut")?;
        let mut snapshot = Self {
            schema_version: SCHEMA_VERSION,
            snapshot_marker: snapshot_marker.to_owned(),
            causal_cut: causal_cut.to_owned(),
            registry,
            speculative_buffers,
            event_order,
            evidence_hash64: 0,
        };
        snapshot.evidence_hash64 = snapshot.material_digest64();
        Ok(snapshot)
    }

    pub fn validate(&self) -> Result<(), TransactionError> {
        if self.schema_version != SCHEMA_VERSION {
            return Err(TransactionError::StaleVersion {
                expected: SCHEMA_VERSION,
                found: self.schema_version,
            });
        }
        required(&self.snapshot_marker, "snapshot.marker")?;
        required(&self.causal_cut, "snapshot.causal_cut")?;
        for transaction in self.registry.active.values() {
            validate_transaction(transaction)?;
        }
        for buffer in &self.speculative_buffers {
            validate_buffer(buffer)?;
        }
        if self.evidence_hash64 == 0 || self.evidence_hash64 != self.material_digest64() {
            return Err(TransactionError::CorruptSnapshot);
        }
        Ok(())
    }

    pub fn restore(
        &self,
    ) -> Result<
        (
            TransactionRegistry,
            Vec<SpeculativeResultBuffer>,
            Vec<String>,
        ),
        TransactionError,
    > {
        self.validate()?;
        Ok((
            self.registry.clone(),
            self.speculative_buffers.clone(),
            self.event_order.clone(),
        ))
    }

    pub fn digest64(&self) -> Result<u64, TransactionError> {
        self.validate()?;
        Ok(fnv1a64(format!("{self:?}").as_bytes()))
    }

    fn material_digest64(&self) -> u64 {
        fnv1a64(
            format!(
                "{}|{}|{}|{:?}|{:?}|{:?}",
                self.schema_version,
                self.snapshot_marker,
                self.causal_cut,
                self.registry,
                self.speculative_buffers,
                self.event_order
            )
            .as_bytes(),
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Wp014Acceptance {
    pub work_package: &'static str,
    pub member_ids: [&'static str; 8],
    pub predecessor_digest64: u64,
    pub member_evidence_digest64: u64,
    pub snapshot_digest64: u64,
    pub precommit_handoff_digest64: u64,
    pub closed: bool,
}

pub fn accept_wp014(
    admission: &AdmissionReceipt,
    passes: &[bool; 8],
    evidence: &[u64; 8],
    snapshot: &TransactionSnapshot,
    handoff: &PreCommitHandoff,
) -> Result<Wp014Acceptance, TransactionError> {
    if admission.work_package != "WP-014"
        || admission.hard_predecessors != ["WP-001", "WP-002", "WP-004", "WP-010"]
    {
        return Err(TransactionError::InvalidPredecessor("WP-014 admission"));
    }
    if let Some(index) = passes.iter().position(|passed| !*passed) {
        return Err(TransactionError::MissingMemberEvidence(MEMBER_IDS[index]));
    }
    if let Some(index) = evidence.iter().position(|digest| *digest == 0) {
        return Err(TransactionError::MissingMemberEvidence(MEMBER_IDS[index]));
    }
    if handoff.work_id != "S1.07.08"
        || !handoff.eligible_for_future_atomic_commit
        || handoff.canonical_commit_performed
        || handoff.disposition != Disposition::CandidateOnly
    {
        return Err(TransactionError::InvalidPreCommitHandoff);
    }
    let snapshot_digest64 = snapshot.digest64()?;
    Ok(Wp014Acceptance {
        work_package: "WP-014",
        member_ids: MEMBER_IDS,
        predecessor_digest64: fnv1a64(format!("{admission:?}").as_bytes()),
        member_evidence_digest64: fnv1a64(format!("{passes:?}|{evidence:?}").as_bytes()),
        snapshot_digest64,
        precommit_handoff_digest64: handoff.digest64(),
        closed: true,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TransactionError {
    InvalidPredecessor(&'static str),
    MissingField(&'static str),
    MissingEvidence(&'static str),
    MissingMemberEvidence(&'static str),
    WrongOwner(String),
    UnauthorizedWrite(WriteOrigin),
    StaleVersion { expected: u32, found: u32 },
    VersionOverflow,
    DuplicateOrReusedId(String),
    DanglingReference(String),
    DuplicateReadKey(String),
    DuplicateWriteKey(String),
    InvalidReadVersion(String),
    MissingReadBasis(String),
    ReferenceMismatch(&'static str),
    GuardNotSatisfied,
    WriteConflict,
    InvalidWorldTime,
    InvariantFailure(String),
    ConservationFailure(String),
    ArithmeticOverflow,
    CorruptSnapshot,
    InvalidPreCommitHandoff,
}

fn validate_transaction(transaction: &CanonicalTransaction) -> Result<(), TransactionError> {
    required(&transaction.stable_id, "transaction.stable_id")?;
    required(&transaction.namespace, "transaction.namespace")?;
    required(&transaction.owner, "transaction.owner")?;
    required(&transaction.causal_episode, "transaction.causal_episode")?;
    required(&transaction.causal_parent, "transaction.causal_parent")?;
    if transaction.owner != TRANSACTION_OWNER {
        return Err(TransactionError::WrongOwner(transaction.owner.clone()));
    }
    if transaction.version == 0 {
        return Err(TransactionError::StaleVersion {
            expected: SCHEMA_VERSION,
            found: transaction.version,
        });
    }
    if transaction.lifecycle != TransactionLifecycle::Active {
        return Err(TransactionError::DanglingReference(
            transaction.stable_id.clone(),
        ));
    }
    if transaction.lineage.is_empty() {
        return Err(TransactionError::MissingField("transaction.lineage"));
    }
    transaction
        .world_time
        .validate()
        .map_err(|_| TransactionError::InvalidWorldTime)?;
    Ok(())
}

fn validate_transaction_link(
    transaction: &CanonicalTransaction,
    transaction_id: &str,
    transaction_version: u32,
    owner: &str,
    causal_parent: &str,
) -> Result<(), TransactionError> {
    if transaction_id != transaction.stable_id
        || transaction_version != transaction.version
        || owner != transaction.owner
        || causal_parent != transaction.causal_parent
    {
        return Err(TransactionError::ReferenceMismatch(
            "transaction identity/version/owner/causal parent",
        ));
    }
    Ok(())
}

fn validate_receipt_links(
    transaction: &CanonicalTransaction,
    read_receipt: &ReadSetReceipt,
    write_receipt: &WriteIntentReceipt,
) -> Result<(), TransactionError> {
    if read_receipt.work_id != "S1.07.02"
        || write_receipt.work_id != "S1.07.03"
        || read_receipt.transaction_id != transaction.stable_id
        || write_receipt.transaction_id != transaction.stable_id
        || read_receipt.transaction_version != transaction.version
        || write_receipt.transaction_version != transaction.version
        || read_receipt.owner != transaction.owner
        || write_receipt.owner != transaction.owner
        || read_receipt.causal_parent != transaction.causal_parent
        || write_receipt.causal_parent != transaction.causal_parent
        || write_receipt.read_set_digest64 != read_receipt.read_set_digest64
    {
        return Err(TransactionError::ReferenceMismatch("S1.07.02 -> S1.07.03"));
    }
    Ok(())
}

fn validate_buffer(buffer: &SpeculativeResultBuffer) -> Result<(), TransactionError> {
    required(&buffer.transaction_id, "buffer.transaction_id")?;
    required(&buffer.owner, "buffer.owner")?;
    required(&buffer.causal_parent, "buffer.causal_parent")?;
    if buffer.work_id != "S1.07.05"
        || buffer.owner != TRANSACTION_OWNER
        || buffer.transaction_version == 0
        || buffer.guard_digest64 == 0
        || buffer.immutable_pre_state_digest64 == 0
        || buffer.deltas.is_empty()
        || buffer.canonical_commit_performed
        || buffer.disposition != Disposition::CandidateOnly
    {
        return Err(TransactionError::InvalidPreCommitHandoff);
    }
    Ok(())
}

fn validate_coordinator(origin: WriteOrigin) -> Result<(), TransactionError> {
    if origin != WriteOrigin::TransactionCoordinator {
        return Err(TransactionError::UnauthorizedWrite(origin));
    }
    Ok(())
}

fn required(value: &str, field: &'static str) -> Result<(), TransactionError> {
    if value.trim().is_empty() {
        Err(TransactionError::MissingField(field))
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
