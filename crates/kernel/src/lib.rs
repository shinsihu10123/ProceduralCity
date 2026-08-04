#![forbid(unsafe_code)]

mod climate;
mod depression;
mod global_hydrology;
mod hydrology;
mod hydrology_boundary;
mod river_network;
mod season;
mod space;
mod terrain;
#[allow(clippy::similar_names)]
mod terrain_analysis;
mod time;

pub use climate::{
    ClimateClass, ClimateConfig, ClimateError, ClimateGenerator, ClimateSample,
    DEFAULT_BASE_PRECIPITATION_MM_PER_YEAR, DEFAULT_EQUATOR_TEMPERATURE_MILLIC,
    DEFAULT_LAPSE_RATE_MILLIC_PER_KM, DEFAULT_OROGRAPHIC_SAMPLE_DISTANCE_MM,
    DEFAULT_POLE_DISTANCE_MM, DEFAULT_POLE_TEMPERATURE_MILLIC,
};
pub use depression::{DepressionError, DepressionFill};
pub use global_hydrology::{
    GlobalDrainageTerminal, GlobalHydrologyError, GlobalHydrologyField, GlobalHydrologyInput,
    GlobalHydrologyNode, GlobalHydrologyNodeKey,
};
pub use hydrology::{
    DrainageTerminal, HydrologyError, HydrologyField, HydrologyNode,
    DEFAULT_RIVER_ACCUMULATION_THRESHOLD,
};
pub use hydrology_boundary::{
    ChunkBoundarySide, CrossChunkBoundary, CrossChunkError, CrossChunkFlowLink,
};
pub use river_network::{
    RiverJunction, RiverJunctionKind, RiverNetwork, RiverNetworkError, RiverReach,
    DEFAULT_RIVER_NETWORK_THRESHOLD,
};
pub use season::{
    SeasonConfig, SeasonError, SeasonGenerator, SeasonPhase, SeasonSample,
    DEFAULT_MAX_LAND_TEMPERATURE_SWING_MILLIC, DEFAULT_MAX_OCEAN_TEMPERATURE_SWING_MILLIC,
    DEFAULT_PRECIPITATION_SWING_PERMILLE, DEFAULT_YEAR_LENGTH_DAYS,
};
pub use space::{
    CellCoord, CellLocalPosition, RegionCoord, SpaceError, SpatialGrid, WorldBounds, WorldPosition,
    DEFAULT_CELL_SIZE_MM, DEFAULT_REGION_EDGE_CELLS, MILLIMETERS_PER_METER,
};
pub use terrain::{
    TerrainClass, TerrainConfig, TerrainError, TerrainGenerator, TerrainSample,
    DEFAULT_AMPLITUDE_MM, DEFAULT_BASE_WAVELENGTH_MM, DEFAULT_OCTAVES, DEFAULT_SEA_LEVEL_MM,
    TERRAIN_ANALYSIS_STEP_MM,
};
pub use terrain_analysis::{
    FlowDirection, TerrainAnalysisError, TerrainChunk, TerrainChunkCoord, TerrainChunkSpec,
    TerrainQualityReport, DEFAULT_TERRAIN_CHUNK_EDGE_CELLS, DEFAULT_TERRAIN_SAMPLE_SPACING_MM,
    MAX_TERRAIN_CHUNK_EDGE_CELLS,
};
pub use time::{
    DurationTicks, Tick, TickDuration, TimeError, TimeSaveStateV1, TimeScale, TimeService,
    UpdateCadence, WorldTime, TIME_SAVE_SCHEMA_V1,
};

use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SimulationCheckpoint {
    time: TimeSaveStateV1,
    world_seed: u64,
    running: bool,
}

impl SimulationCheckpoint {
    #[must_use]
    pub const fn new(tick: u64, world_seed: u64, running: bool) -> Self {
        Self {
            time: TimeSaveStateV1::new(tick, TickDuration::BASELINE.as_nanos()),
            world_seed,
            running,
        }
    }

    #[must_use]
    pub const fn with_time(time: TimeSaveStateV1, world_seed: u64, running: bool) -> Self {
        Self {
            time,
            world_seed,
            running,
        }
    }

    #[must_use]
    pub const fn tick(self) -> Tick {
        Tick::new(self.time.current_tick)
    }

    #[must_use]
    pub const fn time(self) -> TimeSaveStateV1 {
        self.time
    }

    #[must_use]
    pub const fn world_seed(self) -> u64 {
        self.world_seed
    }

    #[must_use]
    pub const fn is_running(self) -> bool {
        self.running
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimulationError {
    Paused,
    TickOverflow,
    Time(TimeError),
}

impl fmt::Display for SimulationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Paused => formatter.write_str("the simulation is paused"),
            Self::TickOverflow => formatter.write_str("the authoritative tick overflowed"),
            Self::Time(error) => error.fmt(formatter),
        }
    }
}

impl std::error::Error for SimulationError {}

impl From<TimeError> for SimulationError {
    fn from(error: TimeError) -> Self {
        match error {
            TimeError::Paused => Self::Paused,
            TimeError::TickOverflow => Self::TickOverflow,
            other => Self::Time(other),
        }
    }
}

#[derive(Debug, Clone)]
pub struct SimulationHost {
    time: TimeService,
    world_seed: u64,
}

impl SimulationHost {
    #[must_use]
    pub const fn new(world_seed: u64) -> Self {
        Self {
            time: TimeService::new(TickDuration::BASELINE),
            world_seed,
        }
    }

    /// Restores a host from a validated simulation checkpoint.
    ///
    /// # Panics
    ///
    /// Panics when the checkpoint contains an unsupported time schema or an
    /// invalid zero tick duration. Checkpoints created by this crate are valid.
    #[must_use]
    pub fn restore(checkpoint: SimulationCheckpoint) -> Self {
        let mut time = TimeService::restore(checkpoint.time)
            .expect("SimulationCheckpoint always contains valid time state");
        if checkpoint.running {
            time.start();
        }
        Self {
            time,
            world_seed: checkpoint.world_seed,
        }
    }

    pub const fn start(&mut self) {
        self.time.start();
    }

    pub const fn pause(&mut self) {
        self.time.pause();
    }

    #[must_use]
    pub const fn tick(&self) -> Tick {
        self.time.current_tick()
    }

    #[must_use]
    pub const fn world_time(&self) -> WorldTime {
        self.time.world_time()
    }

    #[must_use]
    pub const fn time_service(&self) -> &TimeService {
        &self.time
    }

    #[must_use]
    pub const fn world_seed(&self) -> u64 {
        self.world_seed
    }

    #[must_use]
    pub const fn is_running(&self) -> bool {
        self.time.is_running()
    }

    /// Captures a checkpoint at the current committed tick boundary.
    ///
    /// # Panics
    ///
    /// Panics when called while a tick transaction is incomplete.
    #[must_use]
    pub fn checkpoint(&self) -> SimulationCheckpoint {
        let time = self
            .time
            .save_state()
            .expect("checkpoint requested at a tick boundary");
        SimulationCheckpoint::with_time(time, self.world_seed, self.is_running())
    }

    /// Advances exactly one authoritative fixed tick.
    ///
    /// # Errors
    ///
    /// Returns [`SimulationError::Paused`] while paused,
    /// [`SimulationError::TickOverflow`] when the tick counter is exhausted,
    /// or [`SimulationError::Time`] for another time transaction failure.
    pub fn step(&mut self) -> Result<Tick, SimulationError> {
        self.time.advance_one_tick().map_err(Into::into)
    }

    #[must_use]
    pub fn deterministic_digest(&self) -> u64 {
        let mut hash = 0xcbf2_9ce4_8422_2325_u64;
        for byte in self
            .world_seed
            .to_le_bytes()
            .into_iter()
            .chain(self.tick().value().to_le_bytes())
            .chain([u8::from(self.is_running())])
        {
            hash ^= u64::from(byte);
            hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
        }
        hash
    }
}

#[cfg(test)]
mod tests {
    use super::{SimulationCheckpoint, SimulationError, SimulationHost, Tick};

    #[test]
    fn fixed_tick_progresses_one_step_at_a_time() {
        let mut host = SimulationHost::new(42);
        host.start();
        assert_eq!(host.step(), Ok(Tick::new(1)));
        assert_eq!(host.step(), Ok(Tick::new(2)));
    }

    #[test]
    fn paused_host_rejects_state_progression() {
        let mut host = SimulationHost::new(42);
        assert_eq!(host.step(), Err(SimulationError::Paused));
        assert_eq!(host.tick(), Tick::ZERO);
    }

    #[test]
    fn identical_seed_and_steps_produce_identical_digest() {
        let mut left = SimulationHost::new(7);
        let mut right = SimulationHost::new(7);
        left.start();
        right.start();
        for _ in 0..10_000 {
            left.step().expect("left host should advance");
            right.step().expect("right host should advance");
        }
        assert_eq!(left.deterministic_digest(), right.deterministic_digest());
    }

    #[test]
    fn checkpoint_restore_preserves_digest_and_progression() {
        let mut uninterrupted = SimulationHost::new(42);
        uninterrupted.start();
        for _ in 0..20_000 {
            uninterrupted
                .step()
                .expect("uninterrupted host should advance");
        }

        let mut first_half = SimulationHost::new(42);
        first_half.start();
        for _ in 0..10_000 {
            first_half.step().expect("first half should advance");
        }

        let mut restored = SimulationHost::restore(first_half.checkpoint());
        for _ in 0..10_000 {
            restored.step().expect("restored host should advance");
        }

        assert_eq!(restored.tick(), uninterrupted.tick());
        assert_eq!(
            restored.deterministic_digest(),
            uninterrupted.deterministic_digest()
        );
    }

    #[test]
    fn explicit_checkpoint_parts_restore_lifecycle() {
        let restored = SimulationHost::restore(SimulationCheckpoint::new(5, 9, false));
        assert_eq!(restored.tick(), Tick::new(5));
        assert_eq!(restored.world_seed(), 9);
        assert!(!restored.is_running());
    }
}
