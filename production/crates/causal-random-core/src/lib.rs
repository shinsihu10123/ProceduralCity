#![forbid(unsafe_code)]
//! Frozen WP-011 / S1.10.01..S1.10.08 causal randomness boundary.
//!
//! Canonical randomness is addressed by semantic causal identity, not by mutable
//! stream position. Registry authority owns random lineage/profile identity;
//! domain processes own the meaning and use of samples.

use gaonn_identity_reuse_audit_core::AuditEvidence;
use gaonn_world_time_core::{WorldTimeState, Wp004Acceptance};
use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

pub const SCHEMA_VERSION: u32 = 1;
pub const OWNER: &str = "domain26.random_lineage_profile_registry";
pub const MEMBER_IDS: [&str; 8] = [
    "S1.10.01", "S1.10.02", "S1.10.03", "S1.10.04", "S1.10.05", "S1.10.06", "S1.10.07", "S1.10.08",
];
pub const OPERANDS: [&str; 5] = ["Causal", "Random", "Address", "Versioned", "World"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteOrigin {
    RegistryAuthority,
    DomainProcess,
    Derived,
    Observer,
    Renderer,
    Analytics,
    Worker,
    Thread,
    Gpu,
    Partition,
    Retry,
    Camera,
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
    pub identity_predecessor: &'static str,
    pub time_predecessor: &'static str,
    pub identity_digest64: u64,
    pub time_digest64: u64,
    pub causal_parent: String,
}

pub fn admit(
    identity: &Wp002ClosureProof,
    time: &Wp004Acceptance,
) -> Result<AdmissionReceipt, RandomError> {
    if identity.version != SCHEMA_VERSION
        || identity.member_evidence.contains(&0)
        || identity.reuse_audit.work_id != "S1.02.09"
        || !identity.reuse_audit.pass()
        || identity.causal_parent.trim().is_empty()
    {
        return Err(RandomError::InvalidPredecessor("WP-002"));
    }
    if time.work_package != "WP-004"
        || !time.closed
        || time.evidence_digest64 == 0
        || time.member_ids
            != [
                "S1.05.01", "S1.05.02", "S1.05.03", "S1.05.04", "S1.05.05", "S1.05.06", "S1.05.07",
                "S1.05.08", "S1.05.09",
            ]
    {
        return Err(RandomError::InvalidPredecessor("WP-004"));
    }
    Ok(AdmissionReceipt {
        work_package: "WP-011",
        identity_predecessor: "WP-002",
        time_predecessor: "WP-004",
        identity_digest64: identity.digest64(),
        time_digest64: time.evidence_digest64,
        causal_parent: format!(
            "{}|WP-004:{}",
            identity.causal_parent, time.evidence_digest64
        ),
    })
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct VersionRef {
    pub stable_id: String,
    pub namespace: String,
    pub version: u32,
    pub owner: String,
    pub causal_parent: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VersionedWorldSeed {
    pub stable_id: String,
    pub namespace: String,
    pub version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub predecessor: Option<VersionRef>,
    pub root256: [u64; 4],
    pub creation_token: String,
}

impl VersionedWorldSeed {
    pub fn reference(&self) -> VersionRef {
        VersionRef {
            stable_id: self.stable_id.clone(),
            namespace: self.namespace.clone(),
            version: self.version,
            owner: self.owner.clone(),
            causal_parent: self.causal_parent.clone(),
        }
    }

    pub fn validate(&self) -> Result<(), RandomError> {
        required(&self.stable_id, "seed.stable_id")?;
        required(&self.namespace, "seed.namespace")?;
        required(&self.owner, "seed.owner")?;
        required(&self.causal_parent, "seed.causal_parent")?;
        required(&self.creation_token, "seed.creation_token")?;
        if self.version == 0 {
            return Err(RandomError::StaleVersion);
        }
        validate_owner(&self.owner)?;
        if self.root256 == [0; 4] {
            return Err(RandomError::InvalidSeed);
        }
        match (&self.predecessor, self.version) {
            (None, 1) => {}
            (Some(previous), version) if version == previous.version + 1 => {
                if previous.stable_id != self.stable_id
                    || previous.namespace != self.namespace
                    || previous.owner != self.owner
                {
                    return Err(RandomError::ReferenceMismatch("seed.predecessor"));
                }
            }
            _ => return Err(RandomError::StaleVersion),
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RandomLineage {
    pub stable_id: String,
    pub namespace: String,
    pub version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub seed_ref: VersionRef,
}

impl RandomLineage {
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
pub struct DomainRandomNamespace {
    pub stable_id: String,
    pub namespace: String,
    pub version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub domain_id: String,
    pub purpose_ids: BTreeSet<String>,
}

impl DomainRandomNamespace {
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
pub struct EntityAddressComponent {
    pub stable_entity_id: String,
    pub identity_namespace: String,
    pub identity_version: u32,
    pub lifecycle_lineage: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EpisodeAddressComponent {
    pub process_key: String,
    pub episode_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TimeCounterAddressComponent {
    pub world_epoch_id: String,
    pub world_tick: i128,
    pub counter: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CausalRandomAddress {
    pub random_lineage_id: String,
    pub purpose_id: String,
    pub subject_key: EntityAddressComponent,
    pub episode: EpisodeAddressComponent,
    pub time_counter: TimeCounterAddressComponent,
    pub domain_namespace: String,
    pub sample_role_id: String,
    pub sample_index: u64,
}

impl CausalRandomAddress {
    pub fn validate(&self) -> Result<(), RandomError> {
        required(&self.random_lineage_id, "address.random_lineage_id")?;
        required(&self.purpose_id, "address.purpose_id")?;
        required(
            &self.subject_key.stable_entity_id,
            "address.stable_entity_id",
        )?;
        required(
            &self.subject_key.identity_namespace,
            "address.identity_namespace",
        )?;
        if self.subject_key.identity_version == 0 {
            return Err(RandomError::StaleVersion);
        }
        required(
            &self.subject_key.lifecycle_lineage,
            "address.lifecycle_lineage",
        )?;
        required(&self.episode.process_key, "address.process_key")?;
        required(&self.episode.episode_key, "address.episode_key")?;
        required(&self.time_counter.world_epoch_id, "address.world_epoch_id")?;
        required(&self.domain_namespace, "address.domain_namespace")?;
        required(&self.sample_role_id, "address.sample_role_id")?;
        Ok(())
    }

    pub fn stable_encoding(&self) -> Result<String, RandomError> {
        self.validate()?;
        Ok([
            escape(&self.random_lineage_id),
            escape(&self.purpose_id),
            escape(&self.subject_key.stable_entity_id),
            escape(&self.subject_key.identity_namespace),
            self.subject_key.identity_version.to_string(),
            escape(&self.subject_key.lifecycle_lineage),
            escape(&self.episode.process_key),
            escape(&self.episode.episode_key),
            escape(&self.time_counter.world_epoch_id),
            self.time_counter.world_tick.to_string(),
            self.time_counter.counter.to_string(),
            escape(&self.domain_namespace),
            escape(&self.sample_role_id),
            self.sample_index.to_string(),
        ]
        .join("|"))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContractInput {
    pub schema_version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub transition: String,
    pub allowed_transitions: BTreeSet<String>,
    pub seed_ref: VersionRef,
    pub address: CausalRandomAddress,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContractReceipt {
    pub work_id: &'static str,
    pub operands: [&'static str; 5],
    pub schema_version: u32,
    pub owner: String,
    pub causal_parent: String,
    pub seed_ref: VersionRef,
    pub address_digest64: u64,
    pub disposition: Disposition,
}

pub fn validate_contract(
    admission: &AdmissionReceipt,
    input: &ContractInput,
) -> Result<ContractReceipt, RandomError> {
    if admission.work_package != "WP-011" {
        return Err(RandomError::InvalidPredecessor("admission"));
    }
    if input.schema_version != SCHEMA_VERSION {
        return Err(RandomError::StaleVersion);
    }
    validate_owner(&input.owner)?;
    required(&input.causal_parent, "contract.causal_parent")?;
    required(&input.transition, "contract.transition")?;
    if !input.allowed_transitions.contains(&input.transition) {
        return Err(RandomError::ProhibitedTransition(input.transition.clone()));
    }
    input.address.validate()?;
    if input.seed_ref.owner != OWNER || input.seed_ref.version == 0 {
        return Err(RandomError::ReferenceMismatch("contract.seed_ref"));
    }
    Ok(ContractReceipt {
        work_id: "S1.10.01",
        operands: OPERANDS,
        schema_version: input.schema_version,
        owner: input.owner.clone(),
        causal_parent: input.causal_parent.clone(),
        seed_ref: input.seed_ref.clone(),
        address_digest64: fnv1a64(input.address.stable_encoding()?.as_bytes()),
        disposition: Disposition::CandidateOnly,
    })
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RandomRegistry {
    seeds: BTreeMap<(String, u32), VersionedWorldSeed>,
    lineages: BTreeMap<String, RandomLineage>,
    namespaces: BTreeMap<String, DomainRandomNamespace>,
}

impl RandomRegistry {
    pub fn create_seed(
        &mut self,
        seed: VersionedWorldSeed,
        origin: WriteOrigin,
    ) -> Result<VersionRef, RandomError> {
        validate_registry_write(origin)?;
        seed.validate()?;
        if self
            .seeds
            .keys()
            .any(|(stable_id, _)| stable_id == &seed.stable_id)
        {
            return Err(RandomError::DuplicateStableId(seed.stable_id));
        }
        let reference = seed.reference();
        self.seeds
            .insert((seed.stable_id.clone(), seed.version), seed);
        Ok(reference)
    }

    pub fn update_seed(
        &mut self,
        seed: VersionedWorldSeed,
        origin: WriteOrigin,
    ) -> Result<VersionRef, RandomError> {
        validate_registry_write(origin)?;
        seed.validate()?;
        let previous = self.seed(&seed.stable_id)?;
        if seed.predecessor.as_ref() != Some(&previous.reference()) {
            return Err(RandomError::ReferenceMismatch("seed.predecessor"));
        }
        let key = (seed.stable_id.clone(), seed.version);
        if self.seeds.contains_key(&key) {
            return Err(RandomError::DuplicateStableId(format!(
                "{}@{}",
                seed.stable_id, seed.version
            )));
        }
        let reference = seed.reference();
        self.seeds.insert(key, seed);
        Ok(reference)
    }

    pub fn seed(&self, stable_id: &str) -> Result<&VersionedWorldSeed, RandomError> {
        self.seeds
            .values()
            .filter(|seed| seed.stable_id == stable_id)
            .max_by_key(|seed| seed.version)
            .ok_or_else(|| RandomError::DanglingReference(stable_id.to_owned()))
    }

    pub fn seed_by_ref(&self, reference: &VersionRef) -> Result<&VersionedWorldSeed, RandomError> {
        let key = (reference.stable_id.clone(), reference.version);
        let seed = self.seeds.get(&key).ok_or_else(|| {
            RandomError::DanglingReference(format!("{}@{}", reference.stable_id, reference.version))
        })?;
        if seed.reference() != *reference {
            return Err(RandomError::ReferenceMismatch("seed.reference"));
        }
        Ok(seed)
    }

    pub fn create_lineage(
        &mut self,
        lineage: RandomLineage,
        origin: WriteOrigin,
    ) -> Result<VersionRef, RandomError> {
        validate_registry_write(origin)?;
        validate_lineage(&lineage, self)?;
        if self.lineages.contains_key(&lineage.stable_id) {
            return Err(RandomError::DuplicateStableId(lineage.stable_id));
        }
        let reference = lineage.reference();
        self.lineages.insert(lineage.stable_id.clone(), lineage);
        Ok(reference)
    }

    pub fn create_namespace(
        &mut self,
        namespace: DomainRandomNamespace,
        origin: WriteOrigin,
    ) -> Result<VersionRef, RandomError> {
        validate_registry_write(origin)?;
        validate_namespace(&namespace)?;
        if self.namespaces.contains_key(&namespace.stable_id) {
            return Err(RandomError::DuplicateStableId(namespace.stable_id));
        }
        let reference = namespace.reference();
        self.namespaces
            .insert(namespace.stable_id.clone(), namespace);
        Ok(reference)
    }

    pub fn lineage(&self, stable_id: &str) -> Result<&RandomLineage, RandomError> {
        self.lineages
            .get(stable_id)
            .ok_or_else(|| RandomError::DanglingReference(stable_id.to_owned()))
    }

    pub fn namespace(&self, stable_id: &str) -> Result<&DomainRandomNamespace, RandomError> {
        self.namespaces
            .get(stable_id)
            .ok_or_else(|| RandomError::DanglingReference(stable_id.to_owned()))
    }

    pub fn digest64(&self) -> u64 {
        fnv1a64(self.stable_encoding().as_bytes())
    }

    fn stable_encoding(&self) -> String {
        format!("{:?}|{:?}|{:?}", self.seeds, self.lineages, self.namespaces)
    }
}

pub fn entity_component(
    stable_entity_id: &str,
    identity_namespace: &str,
    identity_version: u32,
    lifecycle_lineage: &str,
) -> Result<EntityAddressComponent, RandomError> {
    let component = EntityAddressComponent {
        stable_entity_id: stable_entity_id.to_owned(),
        identity_namespace: identity_namespace.to_owned(),
        identity_version,
        lifecycle_lineage: lifecycle_lineage.to_owned(),
    };
    required(&component.stable_entity_id, "entity.stable_id")?;
    required(&component.identity_namespace, "entity.namespace")?;
    required(&component.lifecycle_lineage, "entity.lifecycle_lineage")?;
    if component.identity_version == 0 {
        return Err(RandomError::StaleVersion);
    }
    Ok(component)
}

pub fn episode_component(
    process_key: &str,
    episode_key: &str,
) -> Result<EpisodeAddressComponent, RandomError> {
    required(process_key, "episode.process_key")?;
    required(episode_key, "episode.episode_key")?;
    Ok(EpisodeAddressComponent {
        process_key: process_key.to_owned(),
        episode_key: episode_key.to_owned(),
    })
}

pub fn time_counter_component(
    world_time: &WorldTimeState,
    counter: u64,
) -> Result<TimeCounterAddressComponent, RandomError> {
    world_time
        .validate()
        .map_err(|_| RandomError::InvalidWorldTime)?;
    Ok(TimeCounterAddressComponent {
        world_epoch_id: world_time.epoch.id.clone(),
        world_tick: world_time.tick,
        counter,
    })
}

pub fn validate_address_against_registry(
    registry: &RandomRegistry,
    address: &CausalRandomAddress,
) -> Result<(), RandomError> {
    address.validate()?;
    let lineage = registry.lineage(&address.random_lineage_id)?;
    let namespace = registry.namespace(&address.domain_namespace)?;
    if !namespace.purpose_ids.contains(&address.purpose_id) {
        return Err(RandomError::UnknownPurpose(address.purpose_id.clone()));
    }
    if lineage.owner != OWNER || namespace.owner != OWNER {
        return Err(RandomError::WrongOwner);
    }
    Ok(())
}

/// S1.10.07: pure stateless sample. No mutable stream position exists.
pub fn stateless_sample_u64(
    registry: &RandomRegistry,
    address: &CausalRandomAddress,
) -> Result<u64, RandomError> {
    validate_address_against_registry(registry, address)?;
    let lineage = registry.lineage(&address.random_lineage_id)?;
    let seed = registry.seed_by_ref(&lineage.seed_ref)?;
    let encoded = address.stable_encoding()?;
    let mut state = seed.root256;
    for (index, chunk) in encoded.as_bytes().chunks(8).enumerate() {
        let mut word = 0_u64;
        for (offset, byte) in chunk.iter().enumerate() {
            word |= u64::from(*byte) << (offset * 8);
        }
        let lane = index & 3;
        state[lane] = mix64(state[lane] ^ word ^ (index as u64).wrapping_mul(0x9e3779b97f4a7c15));
    }
    Ok(mix64(
        state[0] ^ state[1].rotate_left(13) ^ state[2].rotate_left(29) ^ state[3].rotate_left(47),
    ))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DistributionPrimitive {
    RawU64,
    BernoulliThreshold { inclusive_threshold: u64 },
    UniformBounded { upper_exclusive: u64 },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DistributionValue {
    U64(u64),
    Bool(bool),
}

/// S1.10.08: deterministic transforms over one stateless sample.
pub fn deterministic_distribution(
    sample: u64,
    primitive: DistributionPrimitive,
) -> Result<DistributionValue, RandomError> {
    match primitive {
        DistributionPrimitive::RawU64 => Ok(DistributionValue::U64(sample)),
        DistributionPrimitive::BernoulliThreshold {
            inclusive_threshold,
        } => Ok(DistributionValue::Bool(sample <= inclusive_threshold)),
        DistributionPrimitive::UniformBounded { upper_exclusive } => {
            if upper_exclusive == 0 {
                return Err(RandomError::InvalidDistribution("upper_exclusive=0"));
            }
            let value = ((u128::from(sample) * u128::from(upper_exclusive)) >> 64) as u64;
            Ok(DistributionValue::U64(value))
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RandomSnapshot {
    pub schema_version: u32,
    pub commit_marker: String,
    pub causal_cut: String,
    pub registry: RandomRegistry,
}

impl RandomSnapshot {
    pub fn validate(&self) -> Result<(), RandomError> {
        if self.schema_version != SCHEMA_VERSION {
            return Err(RandomError::StaleVersion);
        }
        required(&self.commit_marker, "snapshot.commit_marker")?;
        required(&self.causal_cut, "snapshot.causal_cut")?;
        for seed in self.registry.seeds.values() {
            seed.validate()?;
        }
        for lineage in self.registry.lineages.values() {
            validate_lineage(lineage, &self.registry)?;
        }
        for namespace in self.registry.namespaces.values() {
            validate_namespace(namespace)?;
        }
        Ok(())
    }

    pub fn restore(&self) -> Result<RandomRegistry, RandomError> {
        self.validate()?;
        Ok(self.registry.clone())
    }

    pub fn digest64(&self) -> Result<u64, RandomError> {
        self.validate()?;
        Ok(fnv1a64(
            format!(
                "{}|{}|{}|{}",
                self.schema_version,
                escape(&self.commit_marker),
                escape(&self.causal_cut),
                self.registry.stable_encoding()
            )
            .as_bytes(),
        ))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Wp011Acceptance {
    pub work_package: &'static str,
    pub member_ids: [&'static str; 8],
    pub identity_predecessor_digest64: u64,
    pub time_predecessor_digest64: u64,
    pub evidence_digest64: u64,
    pub snapshot_digest64: u64,
    pub closed: bool,
}

pub fn accept_wp(
    admission: &AdmissionReceipt,
    passes: &[bool; 8],
    evidence: &[u64; 8],
    snapshot_digest64: u64,
) -> Result<Wp011Acceptance, RandomError> {
    if admission.work_package != "WP-011" {
        return Err(RandomError::InvalidPredecessor("admission"));
    }
    if let Some(index) = passes.iter().position(|pass| !*pass) {
        return Err(RandomError::MissingEvidence(MEMBER_IDS[index]));
    }
    if let Some(index) = evidence.iter().position(|digest| *digest == 0) {
        return Err(RandomError::MissingEvidence(MEMBER_IDS[index]));
    }
    if snapshot_digest64 == 0 {
        return Err(RandomError::MissingEvidence("snapshot/replay"));
    }
    Ok(Wp011Acceptance {
        work_package: "WP-011",
        member_ids: MEMBER_IDS,
        identity_predecessor_digest64: admission.identity_digest64,
        time_predecessor_digest64: admission.time_digest64,
        evidence_digest64: fnv1a64(format!("{:?}|{:?}", passes, evidence).as_bytes()),
        snapshot_digest64,
        closed: true,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RandomError {
    InvalidPredecessor(&'static str),
    MissingField(&'static str),
    StaleVersion,
    WrongOwner,
    UnauthorizedWrite(WriteOrigin),
    InvalidSeed,
    InvalidWorldTime,
    DuplicateStableId(String),
    DanglingReference(String),
    ReferenceMismatch(&'static str),
    UnknownPurpose(String),
    ProhibitedTransition(String),
    InvalidDistribution(&'static str),
    MissingEvidence(&'static str),
}

impl fmt::Display for RandomError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidPredecessor(value) => write!(f, "invalid predecessor: {value}"),
            Self::MissingField(value) => write!(f, "missing required field: {value}"),
            Self::StaleVersion => write!(f, "stale or invalid version"),
            Self::WrongOwner => write!(f, "wrong PA-056 canonical owner"),
            Self::UnauthorizedWrite(origin) => {
                write!(f, "unauthorized registry write from {origin:?}")
            }
            Self::InvalidSeed => write!(f, "invalid WorldRandomRoot256"),
            Self::InvalidWorldTime => write!(f, "invalid WP-004 WorldTime"),
            Self::DuplicateStableId(value) => write!(f, "duplicate stable ID: {value}"),
            Self::DanglingReference(value) => write!(f, "dangling reference: {value}"),
            Self::ReferenceMismatch(value) => write!(f, "reference mismatch: {value}"),
            Self::UnknownPurpose(value) => write!(f, "unknown random purpose: {value}"),
            Self::ProhibitedTransition(value) => write!(f, "prohibited transition: {value}"),
            Self::InvalidDistribution(value) => write!(f, "invalid distribution: {value}"),
            Self::MissingEvidence(value) => write!(f, "missing PASS/evidence: {value}"),
        }
    }
}

impl std::error::Error for RandomError {}

fn validate_owner(owner: &str) -> Result<(), RandomError> {
    required(owner, "owner")?;
    if owner != OWNER {
        return Err(RandomError::WrongOwner);
    }
    Ok(())
}

fn validate_registry_write(origin: WriteOrigin) -> Result<(), RandomError> {
    if origin != WriteOrigin::RegistryAuthority {
        return Err(RandomError::UnauthorizedWrite(origin));
    }
    Ok(())
}

fn validate_lineage(lineage: &RandomLineage, registry: &RandomRegistry) -> Result<(), RandomError> {
    required(&lineage.stable_id, "lineage.stable_id")?;
    required(&lineage.namespace, "lineage.namespace")?;
    required(&lineage.owner, "lineage.owner")?;
    required(&lineage.causal_parent, "lineage.causal_parent")?;
    if lineage.version == 0 {
        return Err(RandomError::StaleVersion);
    }
    validate_owner(&lineage.owner)?;
    registry.seed_by_ref(&lineage.seed_ref)?;
    Ok(())
}

fn validate_namespace(namespace: &DomainRandomNamespace) -> Result<(), RandomError> {
    required(&namespace.stable_id, "namespace.stable_id")?;
    required(&namespace.namespace, "namespace.namespace")?;
    required(&namespace.owner, "namespace.owner")?;
    required(&namespace.causal_parent, "namespace.causal_parent")?;
    required(&namespace.domain_id, "namespace.domain_id")?;
    if namespace.version == 0 {
        return Err(RandomError::StaleVersion);
    }
    validate_owner(&namespace.owner)?;
    if namespace.purpose_ids.is_empty()
        || namespace
            .purpose_ids
            .iter()
            .any(|value| value.trim().is_empty())
    {
        return Err(RandomError::MissingField("namespace.purpose_ids"));
    }
    Ok(())
}

fn required(value: &str, field: &'static str) -> Result<(), RandomError> {
    if value.trim().is_empty() {
        Err(RandomError::MissingField(field))
    } else {
        Ok(())
    }
}

fn escape(value: &str) -> String {
    value
        .replace('%', "%25")
        .replace('|', "%7C")
        .replace('\n', "%0A")
        .replace('\r', "%0D")
}

fn mix64(mut value: u64) -> u64 {
    value ^= value >> 30;
    value = value.wrapping_mul(0xbf58476d1ce4e5b9);
    value ^= value >> 27;
    value = value.wrapping_mul(0x94d049bb133111eb);
    value ^ (value >> 31)
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf29ce484222325_u64, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
    })
}
