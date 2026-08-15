#![forbid(unsafe_code)]

//! Production world-core contracts.
//!
//! The first implemented contract is Frozen L3 `S1.01.01 Canonical State 의미 계약`.
//! It intentionally validates candidates without mutating world state. Canonical mutation itself
//! remains behind later transaction/commit work packages.

pub mod authority;
pub mod boundary;
pub mod conflict;
pub mod exclusion_audit;
pub mod manifest;
pub mod write_authority;

use std::fmt;

pub const S1_01_01_CONTRACT_VERSION: u32 = 1;
const OPERANDS: [&str; 3] = ["Canonical", "Authority", "Registry"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StateClass {
    ObjectiveWorld,
    AgentState,
    AgentKnowledge,
    EmergentStructure,
    RuntimeHistory,
    Derived,
    Observer,
    Renderer,
    Analytics,
}

impl StateClass {
    pub const fn is_canonical_plane(self) -> bool {
        matches!(
            self,
            Self::ObjectiveWorld
                | Self::AgentState
                | Self::AgentKnowledge
                | Self::EmergentStructure
                | Self::RuntimeHistory
        )
    }

    const fn as_str(self) -> &'static str {
        match self {
            Self::ObjectiveWorld => "objective_world",
            Self::AgentState => "agent_state",
            Self::AgentKnowledge => "agent_knowledge",
            Self::EmergentStructure => "emergent_structure",
            Self::RuntimeHistory => "runtime_history",
            Self::Derived => "derived",
            Self::Observer => "observer",
            Self::Renderer => "renderer",
            Self::Analytics => "analytics",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteOrigin {
    OwningResolver,
    CrossDomainProcess,
    Ui,
    Ai,
    Observer,
    Renderer,
    Analytics,
}

impl WriteOrigin {
    const fn as_str(self) -> &'static str {
        match self {
            Self::OwningResolver => "owning_resolver",
            Self::CrossDomainProcess => "cross_domain_process",
            Self::Ui => "ui",
            Self::Ai => "ai",
            Self::Observer => "observer",
            Self::Renderer => "renderer",
            Self::Analytics => "analytics",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CanonicalCandidate {
    pub fact_key: Option<String>,
    pub version: Option<u32>,
    pub owner: Option<String>,
    pub writer: Option<String>,
    pub state_class: Option<StateClass>,
    pub transition: Option<String>,
    pub causal_parent: Option<String>,
    pub origin: Option<WriteOrigin>,
}

impl CanonicalCandidate {
    pub fn valid_fixture() -> Self {
        Self {
            fact_key: Some("objective.planet.mass".to_owned()),
            version: Some(S1_01_01_CONTRACT_VERSION),
            owner: Some("domain01.celestial_frame".to_owned()),
            writer: Some("domain01.celestial_frame".to_owned()),
            state_class: Some(StateClass::ObjectiveWorld),
            transition: Some("candidate-state-delta".to_owned()),
            causal_parent: Some("frozen-root:what-how-wbs:v1".to_owned()),
            origin: Some(WriteOrigin::OwningResolver),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidationReceipt {
    pub work_id: &'static str,
    pub fact_key: String,
    pub contract_version: u32,
    pub owner: String,
    pub writer: String,
    pub state_class: StateClass,
    pub transition: String,
    pub causal_parent: String,
    pub operands: [&'static str; 3],
}

impl ValidationReceipt {
    pub fn encode_stable(&self) -> String {
        [
            escape(self.work_id),
            escape(&self.fact_key),
            self.contract_version.to_string(),
            escape(&self.owner),
            escape(&self.writer),
            escape(self.state_class.as_str()),
            escape(&self.transition),
            escape(&self.causal_parent),
            escape(self.operands[0]),
            escape(self.operands[1]),
            escape(self.operands[2]),
        ]
        .join("|")
    }

    pub fn decode_stable(encoded: &str) -> Result<Self, PersistenceError> {
        let fields: Vec<&str> = encoded.split('|').collect();
        if fields.len() != 11 {
            return Err(PersistenceError::WrongFieldCount {
                expected: 11,
                found: fields.len(),
            });
        }

        let work_id = unescape(fields[0])?;
        if work_id != "S1.01.01" {
            return Err(PersistenceError::InvalidWorkId(work_id));
        }

        let version = fields[2]
            .parse::<u32>()
            .map_err(|_| PersistenceError::InvalidVersion(fields[2].to_owned()))?;

        let state_class = match unescape(fields[5])?.as_str() {
            "objective_world" => StateClass::ObjectiveWorld,
            "agent_state" => StateClass::AgentState,
            "agent_knowledge" => StateClass::AgentKnowledge,
            "emergent_structure" => StateClass::EmergentStructure,
            "runtime_history" => StateClass::RuntimeHistory,
            "derived" => StateClass::Derived,
            "observer" => StateClass::Observer,
            "renderer" => StateClass::Renderer,
            "analytics" => StateClass::Analytics,
            other => return Err(PersistenceError::InvalidStateClass(other.to_owned())),
        };

        Ok(Self {
            work_id: "S1.01.01",
            fact_key: unescape(fields[1])?,
            contract_version: version,
            owner: unescape(fields[3])?,
            writer: unescape(fields[4])?,
            state_class,
            transition: unescape(fields[6])?,
            causal_parent: unescape(fields[7])?,
            operands: ["Canonical", "Authority", "Registry"],
        })
    }

    /// Deterministic fixture checksum for replay/evidence tests.
    ///
    /// This is deliberately *not* the future PA-043 canonical binary digest algorithm; that choice
    /// remains implementation-deferred to the corresponding persistence work package.
    pub fn evidence_digest64(&self) -> u64 {
        fnv1a64(self.encode_stable().as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RejectionReason {
    MissingField(&'static str),
    EmptyField(&'static str),
    StaleVersion { expected: u32, found: u32 },
    NonCanonicalState { state_class: StateClass },
    WrongOwner { owner: String, writer: String },
    ProhibitedDirectWrite { origin: WriteOrigin },
}

impl fmt::Display for RejectionReason {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingField(field) => write!(f, "missing required field: {field}"),
            Self::EmptyField(field) => write!(f, "required field is empty: {field}"),
            Self::StaleVersion { expected, found } => {
                write!(
                    f,
                    "stale/unsupported version: expected {expected}, found {found}"
                )
            }
            Self::NonCanonicalState { state_class } => write!(
                f,
                "non-canonical state cannot be registered as canonical: {}",
                state_class.as_str()
            ),
            Self::WrongOwner { owner, writer } => {
                write!(f, "wrong-owner write: owner={owner}, writer={writer}")
            }
            Self::ProhibitedDirectWrite { origin } => {
                write!(
                    f,
                    "prohibited reverse/direct canonical write from {}",
                    origin.as_str()
                )
            }
        }
    }
}

impl std::error::Error for RejectionReason {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PersistenceError {
    WrongFieldCount { expected: usize, found: usize },
    InvalidEscape(String),
    InvalidWorkId(String),
    InvalidVersion(String),
    InvalidStateClass(String),
}

impl fmt::Display for PersistenceError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::WrongFieldCount { expected, found } => {
                write!(f, "wrong field count: expected {expected}, found {found}")
            }
            Self::InvalidEscape(value) => write!(f, "invalid escape sequence in {value:?}"),
            Self::InvalidWorkId(value) => write!(f, "invalid work id: {value}"),
            Self::InvalidVersion(value) => write!(f, "invalid version: {value}"),
            Self::InvalidStateClass(value) => write!(f, "invalid state class: {value}"),
        }
    }
}

impl std::error::Error for PersistenceError {}

#[derive(Debug, Clone, Copy, Default)]
pub struct CanonicalStateContract;

impl CanonicalStateContract {
    pub fn validate(
        &self,
        candidate: &CanonicalCandidate,
    ) -> Result<ValidationReceipt, RejectionReason> {
        let fact_key = required_text(candidate.fact_key.as_deref(), "fact_key")?;
        let version = candidate
            .version
            .ok_or(RejectionReason::MissingField("version"))?;
        if version != S1_01_01_CONTRACT_VERSION {
            return Err(RejectionReason::StaleVersion {
                expected: S1_01_01_CONTRACT_VERSION,
                found: version,
            });
        }

        let owner = required_text(candidate.owner.as_deref(), "owner")?;
        let writer = required_text(candidate.writer.as_deref(), "writer")?;
        let state_class = candidate
            .state_class
            .ok_or(RejectionReason::MissingField("state_class"))?;
        let transition = required_text(candidate.transition.as_deref(), "transition")?;
        let causal_parent = required_text(candidate.causal_parent.as_deref(), "causal_parent")?;
        let origin = candidate
            .origin
            .ok_or(RejectionReason::MissingField("origin"))?;

        if !state_class.is_canonical_plane() {
            return Err(RejectionReason::NonCanonicalState { state_class });
        }

        if origin != WriteOrigin::OwningResolver {
            return Err(RejectionReason::ProhibitedDirectWrite { origin });
        }

        if owner != writer {
            return Err(RejectionReason::WrongOwner {
                owner: owner.to_owned(),
                writer: writer.to_owned(),
            });
        }

        Ok(ValidationReceipt {
            work_id: "S1.01.01",
            fact_key: fact_key.to_owned(),
            contract_version: version,
            owner: owner.to_owned(),
            writer: writer.to_owned(),
            state_class,
            transition: transition.to_owned(),
            causal_parent: causal_parent.to_owned(),
            operands: OPERANDS,
        })
    }
}

fn required_text<'a>(
    value: Option<&'a str>,
    field: &'static str,
) -> Result<&'a str, RejectionReason> {
    let value = value.ok_or(RejectionReason::MissingField(field))?;
    if value.trim().is_empty() {
        return Err(RejectionReason::EmptyField(field));
    }
    Ok(value)
}

fn escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'%' => out.push_str("%25"),
            b'|' => out.push_str("%7C"),
            b'\n' => out.push_str("%0A"),
            b'\r' => out.push_str("%0D"),
            _ => out.push(byte as char),
        }
    }
    out
}

fn unescape(value: &str) -> Result<String, PersistenceError> {
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
            return Err(PersistenceError::InvalidEscape(value.to_owned()));
        }
        let code = &value[index + 1..index + 3];
        match code {
            "25" => out.push('%'),
            "7C" => out.push('|'),
            "0A" => out.push('\n'),
            "0D" => out.push('\r'),
            _ => return Err(PersistenceError::InvalidEscape(value.to_owned())),
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
