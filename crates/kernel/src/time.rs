use std::{fmt, num::NonZeroU64};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct Tick(u64);

impl Tick {
    pub const ZERO: Self = Self(0);
    #[must_use] pub const fn new(value: u64) -> Self { Self(value) }
    #[must_use] pub const fn value(self) -> u64 { self.0 }
    pub fn checked_next(self) -> Result<Self, TimeError> {
        self.0.checked_add(1).map(Self).ok_or(TimeError::TickOverflow)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct DurationTicks(u64);
impl DurationTicks {
    pub const ZERO: Self = Self(0);
    #[must_use] pub const fn new(value: u64) -> Self { Self(value) }
    #[must_use] pub const fn value(self) -> u64 { self.0 }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TickDuration(NonZeroU64);
impl TickDuration {
    pub const BASELINE: Self = Self(NonZeroU64::new(100_000_000).unwrap());
    pub const fn from_nanos(value: u64) -> Result<Self, TimeError> {
        match NonZeroU64::new(value) { Some(value) => Ok(Self(value)), None => Err(TimeError::InvalidTickDuration) }
    }
    #[must_use] pub const fn as_nanos(self) -> u64 { self.0.get() }
}
impl Default for TickDuration { fn default() -> Self { Self::BASELINE } }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct WorldTime { tick: Tick, elapsed: DurationTicks, tick_duration: TickDuration }
impl WorldTime {
    #[must_use] pub const fn tick(self) -> Tick { self.tick }
    #[must_use] pub const fn elapsed(self) -> DurationTicks { self.elapsed }
    #[must_use] pub const fn tick_duration(self) -> TickDuration { self.tick_duration }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum TimeScale { Paused, Multiplier(NonZeroU64), Unbounded }
impl TimeScale {
    pub const REALTIME: Self = Self::Multiplier(NonZeroU64::new(1).unwrap());
    pub const fn multiplier(value: u64) -> Result<Self, TimeError> {
        match NonZeroU64::new(value) { Some(value) => Ok(Self::Multiplier(value)), None => Err(TimeError::InvalidTimeScale) }
    }
}
impl Default for TimeScale { fn default() -> Self { Self::Paused } }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct UpdateCadence { interval: NonZeroU64, phase_offset: u64 }
impl UpdateCadence {
    pub const fn new(interval: u64, phase_offset: u64) -> Result<Self, TimeError> {
        let Some(interval) = NonZeroU64::new(interval) else { return Err(TimeError::InvalidCadence); };
        if phase_offset >= interval.get() { return Err(TimeError::InvalidCadence); }
        Ok(Self { interval, phase_offset })
    }
    #[must_use] pub const fn interval(self) -> u64 { self.interval.get() }
    #[must_use] pub const fn phase_offset(self) -> u64 { self.phase_offset }
    #[must_use] pub const fn is_due(self, tick: Tick) -> bool { tick.value() % self.interval.get() == self.phase_offset }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TimeSaveStateV1 { pub current_tick: u64, pub tick_duration_nanos: u64 }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimeError {
    Paused, TickOverflow, TickAlreadyInProgress, CommitWithoutActiveTick,
    SaveDuringIncompleteTick, InvalidTickDuration, InvalidTimeScale, InvalidCadence,
}
impl fmt::Display for TimeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Paused => "the simulation is paused",
            Self::TickOverflow => "the authoritative tick overflowed",
            Self::TickAlreadyInProgress => "an authoritative tick is already in progress",
            Self::CommitWithoutActiveTick => "cannot commit without an active tick",
            Self::SaveDuringIncompleteTick => "cannot save during an incomplete tick",
            Self::InvalidTickDuration => "tick duration must be non-zero",
            Self::InvalidTimeScale => "time-scale multiplier must be non-zero",
            Self::InvalidCadence => "update cadence is invalid",
        })
    }
}
impl std::error::Error for TimeError {}

#[derive(Debug, Clone)]
pub struct TimeService {
    current_tick: Tick,
    tick_duration: TickDuration,
    time_scale: TimeScale,
    pending_tick: Option<Tick>,
}
impl TimeService {
    #[must_use] pub const fn new(tick_duration: TickDuration) -> Self {
        Self { current_tick: Tick::ZERO, tick_duration, time_scale: TimeScale::Paused, pending_tick: None }
    }
    pub const fn restore(state: TimeSaveStateV1) -> Result<Self, TimeError> {
        let tick_duration = match TickDuration::from_nanos(state.tick_duration_nanos) { Ok(value) => value, Err(error) => return Err(error) };
        Ok(Self { current_tick: Tick::new(state.current_tick), tick_duration, time_scale: TimeScale::Paused, pending_tick: None })
    }
    #[must_use] pub const fn current_tick(&self) -> Tick { self.current_tick }
    #[must_use] pub const fn tick_duration(&self) -> TickDuration { self.tick_duration }
    #[must_use] pub const fn time_scale(&self) -> TimeScale { self.time_scale }
    #[must_use] pub const fn is_running(&self) -> bool { !matches!(self.time_scale, TimeScale::Paused) }
    #[must_use] pub const fn has_active_tick(&self) -> bool { self.pending_tick.is_some() }
    #[must_use] pub const fn world_time(&self) -> WorldTime {
        WorldTime { tick: self.current_tick, elapsed: DurationTicks::new(self.current_tick.value()), tick_duration: self.tick_duration }
    }
    pub const fn start(&mut self) { self.time_scale = TimeScale::REALTIME; }
    pub const fn pause(&mut self) { self.time_scale = TimeScale::Paused; }
    pub const fn set_time_scale(&mut self, value: TimeScale) { self.time_scale = value; }
    pub fn begin_tick(&mut self) -> Result<Tick, TimeError> {
        if !self.is_running() { return Err(TimeError::Paused); }
        if self.pending_tick.is_some() { return Err(TimeError::TickAlreadyInProgress); }
        let next = self.current_tick.checked_next()?;
        self.pending_tick = Some(next);
        Ok(next)
    }
    pub fn commit_tick(&mut self) -> Result<Tick, TimeError> {
        let next = self.pending_tick.take().ok_or(TimeError::CommitWithoutActiveTick)?;
        self.current_tick = next;
        Ok(next)
    }
    pub fn abort_tick(&mut self) { self.pending_tick = None; }
    pub fn advance_one_tick(&mut self) -> Result<Tick, TimeError> { self.begin_tick()?; self.commit_tick() }
    pub const fn save_state(&self) -> Result<TimeSaveStateV1, TimeError> {
        if self.pending_tick.is_some() { return Err(TimeError::SaveDuringIncompleteTick); }
        Ok(TimeSaveStateV1 { current_tick: self.current_tick.value(), tick_duration_nanos: self.tick_duration.as_nanos() })
    }
}
impl Default for TimeService { fn default() -> Self { Self::new(TickDuration::BASELINE) } }

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn transaction_publishes_only_on_commit() {
        let mut time = TimeService::default(); time.start();
        assert_eq!(time.begin_tick(), Ok(Tick::new(1)));
        assert_eq!(time.current_tick(), Tick::ZERO);
        assert_eq!(time.save_state(), Err(TimeError::SaveDuringIncompleteTick));
        assert_eq!(time.commit_tick(), Ok(Tick::new(1)));
    }
    #[test] fn abort_preserves_boundary() {
        let mut time = TimeService::default(); time.start(); time.begin_tick().unwrap(); time.abort_tick();
        assert_eq!(time.current_tick(), Tick::ZERO);
    }
    #[test] fn cadence_is_phase_stable() {
        let cadence = UpdateCadence::new(10, 3).unwrap();
        assert!(cadence.is_due(Tick::new(3))); assert!(cadence.is_due(Tick::new(13))); assert!(!cadence.is_due(Tick::new(12)));
    }
    #[test] fn scale_does_not_change_tick_semantics() {
        let mut a = TimeService::default(); let mut b = TimeService::default();
        a.set_time_scale(TimeScale::multiplier(1).unwrap()); b.set_time_scale(TimeScale::multiplier(100).unwrap());
        for _ in 0..10_000 { a.advance_one_tick().unwrap(); b.advance_one_tick().unwrap(); }
        assert_eq!(a.world_time(), b.world_time());
    }
    #[test] fn million_tick_soak_has_no_drift() {
        let mut time = TimeService::default(); time.start();
        for _ in 0..1_000_000 { time.advance_one_tick().unwrap(); }
        assert_eq!(time.current_tick(), Tick::new(1_000_000));
    }
}
