#![forbid(unsafe_code)]

use std::fmt;

/// Monotonic authoritative simulation time.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct Tick(u64);

impl Tick {
    pub const ZERO: Self = Self(0);

    #[must_use]
    pub const fn value(self) -> u64 {
        self.0
    }
}

/// Failures caused by invalid kernel lifecycle operations.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimulationError {
    Paused,
    TickOverflow,
}

impl fmt::Display for SimulationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Paused => formatter.write_str("the simulation is paused"),
            Self::TickOverflow => formatter.write_str("the authoritative tick overflowed"),
        }
    }
}

impl std::error::Error for SimulationError {}

/// Minimal fixed-tick host used to validate the Stage 0 execution path.
#[derive(Debug, Clone)]
pub struct SimulationHost {
    tick: Tick,
    world_seed: u64,
    running: bool,
}

impl SimulationHost {
    #[must_use]
    pub const fn new(world_seed: u64) -> Self {
        Self {
            tick: Tick::ZERO,
            world_seed,
            running: false,
        }
    }

    pub const fn start(&mut self) {
        self.running = true;
    }

    pub const fn pause(&mut self) {
        self.running = false;
    }

    #[must_use]
    pub const fn tick(&self) -> Tick {
        self.tick
    }

    #[must_use]
    pub const fn is_running(&self) -> bool {
        self.running
    }

    /// Advances exactly one authoritative fixed tick.
    ///
    /// No rendering frame time is accepted here by design.
    ///
    /// # Errors
    ///
    /// Returns [`SimulationError::Paused`] when the host is not running and
    /// [`SimulationError::TickOverflow`] when the authoritative counter cannot
    /// advance without overflowing.
    pub fn step(&mut self) -> Result<Tick, SimulationError> {
        if !self.running {
            return Err(SimulationError::Paused);
        }

        let next = self
            .tick
            .value()
            .checked_add(1)
            .ok_or(SimulationError::TickOverflow)?;
        self.tick = Tick(next);
        Ok(self.tick)
    }

    /// Stable digest for early determinism tests.
    #[must_use]
    pub fn deterministic_digest(&self) -> u64 {
        let mut hash = 0xcbf2_9ce4_8422_2325_u64;
        for byte in self
            .world_seed
            .to_le_bytes()
            .into_iter()
            .chain(self.tick.value().to_le_bytes())
            .chain([u8::from(self.running)])
        {
            hash ^= u64::from(byte);
            hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
        }
        hash
    }
}

#[cfg(test)]
mod tests {
    use super::{SimulationError, SimulationHost, Tick};

    #[test]
    fn fixed_tick_progresses_one_step_at_a_time() {
        let mut host = SimulationHost::new(42);
        host.start();

        assert_eq!(host.step(), Ok(Tick(1)));
        assert_eq!(host.step(), Ok(Tick(2)));
        assert_eq!(host.tick(), Tick(2));
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
    fn different_seed_changes_digest() {
        let left = SimulationHost::new(1);
        let right = SimulationHost::new(2);

        assert_ne!(left.deterministic_digest(), right.deterministic_digest());
    }
}
