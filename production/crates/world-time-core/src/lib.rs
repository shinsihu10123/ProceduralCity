#![forbid(unsafe_code)]
//! Frozen WP-004 / S1.05 Absolute WorldTime implementation boundary.

use gaonn_world_core::ValidationReceipt;
use std::cmp::Ordering;
use std::fmt;

pub const SCHEMA_VERSION: u32 = 1;
pub const OWNER: &str = "domain26.world_time_runtime";
pub const MEMBER_IDS: [&str; 9] = [
    "S1.05.01",
    "S1.05.02",
    "S1.05.03",
    "S1.05.04",
    "S1.05.05",
    "S1.05.06",
    "S1.05.07",
    "S1.05.08",
    "S1.05.09",
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EpochDescriptor {
    pub id: String,
    pub unit: String,
    pub frame: String,
    pub version: u32,
    pub owner: String,
    pub causal_parent: String,
}

impl EpochDescriptor {
    pub fn validate(&self) -> Result<(), TimeError> {
        required_text(&self.id, "epoch.id")?;
        required_text(&self.unit, "epoch.unit")?;
        required_text(&self.frame, "epoch.frame")?;
        required_text(&self.owner, "epoch.owner")?;
        required_text(&self.causal_parent, "epoch.causal_parent")?;
        if self.version != SCHEMA_VERSION {
            return Err(TimeError::StaleVersion {
                expected: SCHEMA_VERSION,
                found: self.version,
            });
        }
        if self.owner != OWNER {
            return Err(TimeError::WrongOwner {
                expected: OWNER.to_owned(),
                found: self.owner.clone(),
            });
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorldTimeState {
    pub epoch: EpochDescriptor,
    pub tick: i128,
    pub microstep: u64,
    pub version: u32,
    pub owner: String,
    pub causal_parent: String,
}

impl WorldTimeState {
    pub fn validate(&self) -> Result<(), TimeError> {
        self.epoch.validate()?;
        required_text(&self.owner, "world_time.owner")?;
        required_text(&self.causal_parent, "world_time.causal_parent")?;
        if self.version != SCHEMA_VERSION {
            return Err(TimeError::StaleVersion {
                expected: SCHEMA_VERSION,
                found: self.version,
            });
        }
        if self.owner != OWNER {
            return Err(TimeError::WrongOwner {
                expected: OWNER.to_owned(),
                found: self.owner.clone(),
            });
        }
        Ok(())
    }

    pub fn instant_key(&self) -> InstantKey {
        InstantKey {
            epoch_id: self.epoch.id.clone(),
            tick: self.tick,
        }
    }

    pub fn causal_key(&self) -> CausalTimeKey {
        CausalTimeKey {
            epoch_id: self.epoch.id.clone(),
            tick: self.tick,
            microstep: self.microstep,
        }
    }

    pub fn digest64(&self) -> u64 {
        fnv1a64(encode_state(self).as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstantKey {
    pub epoch_id: String,
    pub tick: i128,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CausalTimeKey {
    pub epoch_id: String,
    pub tick: i128,
    pub microstep: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Duration {
    ticks: i128,
}

impl Duration {
    pub fn from_ticks(ticks: i128) -> Result<Self, TimeError> {
        if ticks < 0 {
            return Err(TimeError::NegativeDuration(ticks));
        }
        Ok(Self { ticks })
    }

    pub const fn ticks(self) -> i128 {
        self.ticks
    }

    pub fn checked_add(self, other: Self) -> Result<Self, TimeError> {
        let ticks = self
            .ticks
            .checked_add(other.ticks)
            .ok_or(TimeError::ArithmeticOverflow)?;
        Ok(Self { ticks })
    }

    pub fn checked_sub(self, other: Self) -> Result<Self, TimeError> {
        let ticks = self
            .ticks
            .checked_sub(other.ticks)
            .ok_or(TimeError::ArithmeticOverflow)?;
        if ticks < 0 {
            return Err(TimeError::NegativeDuration(ticks));
        }
        Ok(Self { ticks })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DerivedCalendarView {
    pub source: InstantKey,
    pub label: String,
    pub provenance: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TimeSnapshot {
    pub schema_version: u32,
    pub commit_marker: String,
    pub causal_cut: String,
    pub recovery_position: String,
    pub replay_reference: String,
    pub state: WorldTimeState,
}

impl TimeSnapshot {
    pub fn validate(&self) -> Result<(), TimeError> {
        if self.schema_version != SCHEMA_VERSION {
            return Err(TimeError::StaleVersion {
                expected: SCHEMA_VERSION,
                found: self.schema_version,
            });
        }
        required_text(&self.commit_marker, "snapshot.commit_marker")?;
        required_text(&self.causal_cut, "snapshot.causal_cut")?;
        required_text(&self.recovery_position, "snapshot.recovery_position")?;
        required_text(&self.replay_reference, "snapshot.replay_reference")?;
        self.state.validate()
    }

    pub fn encode_stable(&self) -> Result<String, TimeError> {
        self.validate()?;
        Ok([
            self.schema_version.to_string(),
            escape(&self.commit_marker),
            escape(&self.causal_cut),
            escape(&self.recovery_position),
            escape(&self.replay_reference),
            escape(&encode_state(&self.state)),
        ]
        .join("|"))
    }

    pub fn decode_stable(encoded: &str) -> Result<Self, TimeError> {
        let fields: Vec<&str> = encoded.split('|').collect();
        if fields.len() != 6 {
            return Err(TimeError::WrongFieldCount {
                expected: 6,
                found: fields.len(),
            });
        }
        let schema_version = fields[0]
            .parse::<u32>()
            .map_err(|_| TimeError::Serialization("invalid snapshot schema version".to_owned()))?;
        let snapshot = Self {
            schema_version,
            commit_marker: unescape(fields[1])?,
            causal_cut: unescape(fields[2])?,
            recovery_position: unescape(fields[3])?,
            replay_reference: unescape(fields[4])?,
            state: decode_state(&unescape(fields[5])?)?,
        };
        snapshot.validate()?;
        Ok(snapshot)
    }

    pub fn digest64(&self) -> Result<u64, TimeError> {
        Ok(fnv1a64(self.encode_stable()?.as_bytes()))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PrecisionFixtureEvidence {
    pub start: InstantKey,
    pub step_ticks: i128,
    pub samples: u64,
    pub iterative_end: InstantKey,
    pub direct_end: InstantKey,
    pub exact_match: bool,
    pub digest64: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AuditOutcome {
    Pass,
    Violation { field: &'static str },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReversalAuditEvidence {
    pub work_id: &'static str,
    pub outcome: AuditOutcome,
    pub pre_digest64: u64,
    pub post_digest64: u64,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Wp004Acceptance {
    pub work_package: &'static str,
    pub member_ids: [&'static str; 9],
    pub predecessor_digest64: u64,
    pub evidence_digest64: u64,
    pub closed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TimeError {
    InvalidPredecessor,
    MissingField(&'static str),
    EmptyField(&'static str),
    StaleVersion { expected: u32, found: u32 },
    WrongOwner { expected: String, found: String },
    UnauthorizedWrite(WriteOrigin),
    EpochMismatch { left: String, right: String },
    UnitMismatch { left: String, right: String },
    FrameMismatch { left: String, right: String },
    TimeReversal { current: i128, proposed: i128 },
    CausalOrderRegression { current: u64, proposed: u64 },
    NegativeDuration(i128),
    ArithmeticOverflow,
    WrongFieldCount { expected: usize, found: usize },
    Serialization(String),
    MissingEvidence(&'static str),
}

impl fmt::Display for TimeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidPredecessor => write!(f, "invalid WP-001 predecessor receipt"),
            Self::MissingField(field) => write!(f, "missing required field: {field}"),
            Self::EmptyField(field) => write!(f, "required field is empty: {field}"),
            Self::StaleVersion { expected, found } => {
                write!(f, "stale version: expected {expected}, found {found}")
            }
            Self::WrongOwner { expected, found } => {
                write!(f, "wrong owner: expected {expected}, found {found}")
            }
            Self::UnauthorizedWrite(origin) => write!(f, "unauthorized time write from {origin:?}"),
            Self::EpochMismatch { left, right } => {
                write!(f, "epoch mismatch: {left} versus {right}")
            }
            Self::UnitMismatch { left, right } => write!(f, "unit mismatch: {left} versus {right}"),
            Self::FrameMismatch { left, right } => {
                write!(f, "frame mismatch: {left} versus {right}")
            }
            Self::TimeReversal { current, proposed } => {
                write!(f, "canonical time reversal: current={current}, proposed={proposed}")
            }
            Self::CausalOrderRegression { current, proposed } => {
                write!(f, "same-time causal order regression: current={current}, proposed={proposed}")
            }
            Self::NegativeDuration(value) => write!(f, "negative duration: {value}"),
            Self::ArithmeticOverflow => write!(f, "time arithmetic overflow"),
            Self::WrongFieldCount { expected, found } => {
                write!(f, "wrong field count: expected {expected}, found {found}")
            }
            Self::Serialization(reason) => write!(f, "serialization error: {reason}"),
            Self::MissingEvidence(work_id) => write!(f, "missing PASS/evidence for {work_id}"),
        }
    }
}

impl std::error::Error for TimeError {}

pub fn admit(root: &ValidationReceipt) -> Result<(), TimeError> {
    if root.work_id != "S1.01.01"
        || root.contract_version != 1
        || root.operands != ["Canonical", "Authority", "Registry"]
    {
        return Err(TimeError::InvalidPredecessor);
    }
    Ok(())
}

pub fn validate_write_authority(origin: WriteOrigin) -> Result<(), TimeError> {
    if origin != WriteOrigin::RuntimeAuthority {
        return Err(TimeError::UnauthorizedWrite(origin));
    }
    Ok(())
}

pub fn compare_instant(left: &WorldTimeState, right: &WorldTimeState) -> Result<Ordering, TimeError> {
    validate_compatible(left, right)?;
    Ok(left.tick.cmp(&right.tick))
}

pub fn same_time(left: &WorldTimeState, right: &WorldTimeState) -> Result<bool, TimeError> {
    Ok(compare_instant(left, right)? == Ordering::Equal)
}

pub fn advance_to(
    current: &WorldTimeState,
    proposed_tick: i128,
    proposed_microstep: u64,
    causal_parent: &str,
    origin: WriteOrigin,
) -> Result<WorldTimeState, TimeError> {
    current.validate()?;
    validate_write_authority(origin)?;
    required_text(causal_parent, "advance.causal_parent")?;
    if proposed_tick < current.tick {
        return Err(TimeError::TimeReversal {
            current: current.tick,
            proposed: proposed_tick,
        });
    }
    if proposed_tick == current.tick && proposed_microstep < current.microstep {
        return Err(TimeError::CausalOrderRegression {
            current: current.microstep,
            proposed: proposed_microstep,
        });
    }
    let mut next = current.clone();
    next.tick = proposed_tick;
    next.microstep = proposed_microstep;
    next.causal_parent = causal_parent.to_owned();
    Ok(next)
}

pub fn advance_by(
    current: &WorldTimeState,
    duration: Duration,
    causal_parent: &str,
    origin: WriteOrigin,
) -> Result<WorldTimeState, TimeError> {
    let proposed_tick = current
        .tick
        .checked_add(duration.ticks())
        .ok_or(TimeError::ArithmeticOverflow)?;
    advance_to(current, proposed_tick, 0, causal_parent, origin)
}

pub fn elapsed_between(
    earlier: &WorldTimeState,
    later: &WorldTimeState,
) -> Result<Duration, TimeError> {
    validate_compatible(earlier, later)?;
    let ticks = later
        .tick
        .checked_sub(earlier.tick)
        .ok_or(TimeError::ArithmeticOverflow)?;
    Duration::from_ticks(ticks)
}

pub fn derive_calendar_view(
    source: &WorldTimeState,
    label: &str,
    provenance: &str,
) -> Result<DerivedCalendarView, TimeError> {
    source.validate()?;
    required_text(label, "calendar.label")?;
    required_text(provenance, "calendar.provenance")?;
    Ok(DerivedCalendarView {
        source: source.instant_key(),
        label: label.to_owned(),
        provenance: provenance.to_owned(),
    })
}

pub fn long_horizon_precision_fixture(
    start: &WorldTimeState,
    step: Duration,
    samples: u64,
) -> Result<PrecisionFixtureEvidence, TimeError> {
    start.validate()?;
    let mut iterative_tick = start.tick;
    for _ in 0..samples {
        iterative_tick = iterative_tick
            .checked_add(step.ticks())
            .ok_or(TimeError::ArithmeticOverflow)?;
    }
    let direct_delta = step
        .ticks()
        .checked_mul(i128::from(samples))
        .ok_or(TimeError::ArithmeticOverflow)?;
    let direct_tick = start
        .tick
        .checked_add(direct_delta)
        .ok_or(TimeError::ArithmeticOverflow)?;
    let iterative_end = InstantKey {
        epoch_id: start.epoch.id.clone(),
        tick: iterative_tick,
    };
    let direct_end = InstantKey {
        epoch_id: start.epoch.id.clone(),
        tick: direct_tick,
    };
    let exact_match = iterative_end == direct_end;
    let digest_material = format!(
        "{}|{}|{}|{}|{}|{}",
        start.epoch.id,
        start.tick,
        step.ticks(),
        samples,
        iterative_tick,
        direct_tick
    );
    Ok(PrecisionFixtureEvidence {
        start: start.instant_key(),
        step_ticks: step.ticks(),
        samples,
        iterative_end,
        direct_end,
        exact_match,
        digest64: fnv1a64(digest_material.as_bytes()),
    })
}

pub fn audit_time_reversal(
    pre: &WorldTimeState,
    post: &WorldTimeState,
) -> Result<ReversalAuditEvidence, TimeError> {
    pre.validate()?;
    post.validate()?;
    validate_compatible(pre, post)?;
    let outcome = if post.tick < pre.tick {
        AuditOutcome::Violation { field: "tick" }
    } else if post.tick == pre.tick && post.microstep < pre.microstep {
        AuditOutcome::Violation { field: "microstep" }
    } else {
        AuditOutcome::Pass
    };
    Ok(ReversalAuditEvidence {
        work_id: "S1.05.09",
        outcome,
        pre_digest64: pre.digest64(),
        post_digest64: post.digest64(),
        causal_parent: post.causal_parent.clone(),
    })
}

pub fn accept_wp004(
    root: &ValidationReceipt,
    passes: &[bool; 9],
    evidence: &[u64; 9],
) -> Result<Wp004Acceptance, TimeError> {
    admit(root)?;
    if let Some(index) = passes.iter().position(|passed| !*passed) {
        return Err(TimeError::MissingEvidence(MEMBER_IDS[index]));
    }
    if let Some(index) = evidence.iter().position(|digest| *digest == 0) {
        return Err(TimeError::MissingEvidence(MEMBER_IDS[index]));
    }
    let evidence_material = format!("{passes:?}|{evidence:?}");
    Ok(Wp004Acceptance {
        work_package: "WP-004",
        member_ids: MEMBER_IDS,
        predecessor_digest64: root.evidence_digest64(),
        evidence_digest64: fnv1a64(evidence_material.as_bytes()),
        closed: true,
    })
}

fn validate_compatible(left: &WorldTimeState, right: &WorldTimeState) -> Result<(), TimeError> {
    left.validate()?;
    right.validate()?;
    if left.epoch.id != right.epoch.id {
        return Err(TimeError::EpochMismatch {
            left: left.epoch.id.clone(),
            right: right.epoch.id.clone(),
        });
    }
    if left.epoch.unit != right.epoch.unit {
        return Err(TimeError::UnitMismatch {
            left: left.epoch.unit.clone(),
            right: right.epoch.unit.clone(),
        });
    }
    if left.epoch.frame != right.epoch.frame {
        return Err(TimeError::FrameMismatch {
            left: left.epoch.frame.clone(),
            right: right.epoch.frame.clone(),
        });
    }
    Ok(())
}

fn encode_state(state: &WorldTimeState) -> String {
    [
        state.version.to_string(),
        escape(&state.owner),
        escape(&state.causal_parent),
        escape(&state.epoch.id),
        escape(&state.epoch.unit),
        escape(&state.epoch.frame),
        state.epoch.version.to_string(),
        escape(&state.epoch.owner),
        escape(&state.epoch.causal_parent),
        state.tick.to_string(),
        state.microstep.to_string(),
    ]
    .join(";")
}

fn decode_state(encoded: &str) -> Result<WorldTimeState, TimeError> {
    let fields: Vec<&str> = encoded.split(';').collect();
    if fields.len() != 11 {
        return Err(TimeError::WrongFieldCount {
            expected: 11,
            found: fields.len(),
        });
    }
    let state = WorldTimeState {
        version: parse_u32(fields[0], "world time version")?,
        owner: unescape(fields[1])?,
        causal_parent: unescape(fields[2])?,
        epoch: EpochDescriptor {
            id: unescape(fields[3])?,
            unit: unescape(fields[4])?,
            frame: unescape(fields[5])?,
            version: parse_u32(fields[6], "epoch version")?,
            owner: unescape(fields[7])?,
            causal_parent: unescape(fields[8])?,
        },
        tick: fields[9]
            .parse::<i128>()
            .map_err(|_| TimeError::Serialization("invalid world time tick".to_owned()))?,
        microstep: fields[10]
            .parse::<u64>()
            .map_err(|_| TimeError::Serialization("invalid world time microstep".to_owned()))?,
    };
    state.validate()?;
    Ok(state)
}

fn parse_u32(value: &str, field: &str) -> Result<u32, TimeError> {
    value
        .parse::<u32>()
        .map_err(|_| TimeError::Serialization(format!("invalid {field}")))
}

fn required_text(value: &str, field: &'static str) -> Result<(), TimeError> {
    if value.is_empty() {
        return Err(TimeError::EmptyField(field));
    }
    Ok(())
}

fn escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'%' => out.push_str("%25"),
            b'|' => out.push_str("%7C"),
            b';' => out.push_str("%3B"),
            b'\n' => out.push_str("%0A"),
            b'\r' => out.push_str("%0D"),
            _ => out.push(byte as char),
        }
    }
    out
}

fn unescape(value: &str) -> Result<String, TimeError> {
    let bytes = value.as_bytes();
    let mut out = String::with_capacity(value.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] != b'%' {
            out.push(bytes[index] as char);
            index += 1;
            continue;
        }
        if index + 2 >= bytes.len() {
            return Err(TimeError::Serialization("invalid escape sequence".to_owned()));
        }
        let code = &value[index + 1..index + 3];
        match code {
            "25" => out.push('%'),
            "7C" => out.push('|'),
            "3B" => out.push(';'),
            "0A" => out.push('\n'),
            "0D" => out.push('\r'),
            _ => return Err(TimeError::Serialization("invalid escape sequence".to_owned())),
        }
        index += 3;
    }
    Ok(out)
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
