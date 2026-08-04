use std::{fmt, num::NonZeroU16};

use crate::{ClimateGenerator, ClimateSample};

pub const DEFAULT_YEAR_LENGTH_DAYS: u16 = 365;
pub const DEFAULT_MAX_LAND_TEMPERATURE_SWING_MILLIC: i32 = 18_000;
pub const DEFAULT_MAX_OCEAN_TEMPERATURE_SWING_MILLIC: i32 = 6_000;
pub const DEFAULT_PRECIPITATION_SWING_PERMILLE: u16 = 250;
const PER_MILLE: i64 = 1_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SeasonConfig {
    year_length_days: NonZeroU16,
    max_land_temperature_swing_millic: i32,
    max_ocean_temperature_swing_millic: i32,
    precipitation_swing_permille: u16,
}

impl SeasonConfig {
    /// Creates a deterministic seasonal-cycle configuration.
    ///
    /// # Errors
    ///
    /// Returns [`SeasonError::InvalidYearLength`] when the year is shorter
    /// than four days, [`SeasonError::InvalidTemperatureSwing`] when a swing is
    /// negative or ocean swing exceeds land swing, or
    /// [`SeasonError::InvalidPrecipitationSwing`] above 1000 permille.
    pub const fn new(
        year_length_days: u16,
        max_land_temperature_swing_millic: i32,
        max_ocean_temperature_swing_millic: i32,
        precipitation_swing_permille: u16,
    ) -> Result<Self, SeasonError> {
        let Some(year_length_days) = NonZeroU16::new(year_length_days) else {
            return Err(SeasonError::InvalidYearLength);
        };
        if year_length_days.get() < 4 {
            return Err(SeasonError::InvalidYearLength);
        }
        if max_land_temperature_swing_millic < 0
            || max_ocean_temperature_swing_millic < 0
            || max_ocean_temperature_swing_millic > max_land_temperature_swing_millic
        {
            return Err(SeasonError::InvalidTemperatureSwing);
        }
        if precipitation_swing_permille > 1_000 {
            return Err(SeasonError::InvalidPrecipitationSwing);
        }
        Ok(Self {
            year_length_days,
            max_land_temperature_swing_millic,
            max_ocean_temperature_swing_millic,
            precipitation_swing_permille,
        })
    }

    #[must_use]
    pub const fn year_length_days(self) -> u16 {
        self.year_length_days.get()
    }

    #[must_use]
    pub const fn max_land_temperature_swing_millic(self) -> i32 {
        self.max_land_temperature_swing_millic
    }

    #[must_use]
    pub const fn max_ocean_temperature_swing_millic(self) -> i32 {
        self.max_ocean_temperature_swing_millic
    }

    #[must_use]
    pub const fn precipitation_swing_permille(self) -> u16 {
        self.precipitation_swing_permille
    }
}

impl Default for SeasonConfig {
    fn default() -> Self {
        Self::new(
            DEFAULT_YEAR_LENGTH_DAYS,
            DEFAULT_MAX_LAND_TEMPERATURE_SWING_MILLIC,
            DEFAULT_MAX_OCEAN_TEMPERATURE_SWING_MILLIC,
            DEFAULT_PRECIPITATION_SWING_PERMILLE,
        )
        .expect("default season constants are valid")
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SeasonPhase {
    Spring,
    Summer,
    Autumn,
    Winter,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SeasonSample {
    day_of_year: u16,
    phase_permille: u16,
    season: SeasonPhase,
    daylight_permille: u16,
    temperature_millic: i32,
    precipitation_mm_per_year_equivalent: u32,
    baseline: ClimateSample,
}

impl SeasonSample {
    #[must_use]
    pub const fn day_of_year(self) -> u16 {
        self.day_of_year
    }

    #[must_use]
    pub const fn phase_permille(self) -> u16 {
        self.phase_permille
    }

    #[must_use]
    pub const fn season(self) -> SeasonPhase {
        self.season
    }

    #[must_use]
    pub const fn daylight_permille(self) -> u16 {
        self.daylight_permille
    }

    #[must_use]
    pub const fn temperature_millic(self) -> i32 {
        self.temperature_millic
    }

    #[must_use]
    pub const fn precipitation_mm_per_year_equivalent(self) -> u32 {
        self.precipitation_mm_per_year_equivalent
    }

    #[must_use]
    pub const fn baseline(self) -> ClimateSample {
        self.baseline
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SeasonGenerator {
    climate: ClimateGenerator,
    config: SeasonConfig,
}

impl SeasonGenerator {
    #[must_use]
    pub const fn new(climate: ClimateGenerator, config: SeasonConfig) -> Self {
        Self { climate, config }
    }

    #[must_use]
    pub const fn climate(self) -> ClimateGenerator {
        self.climate
    }

    #[must_use]
    pub const fn config(self) -> SeasonConfig {
        self.config
    }

    /// Samples seasonal climate for one coordinate and absolute world day.
    #[must_use]
    pub fn sample(self, x_mm: i64, z_mm: i64, world_day: u64) -> SeasonSample {
        let baseline = self.climate.sample(x_mm, z_mm);
        let year = u64::from(self.config.year_length_days.get());
        let day = world_day % year;
        let phase_permille = u16::try_from(day.saturating_mul(1_000) / year)
            .expect("season phase is clamped below 1000");
        let northern_wave = seasonal_wave_permille(phase_permille);
        let hemisphere_wave = if z_mm < self.climate.config().equator_z_mm() {
            -northern_wave
        } else {
            northern_wave
        };
        let latitude = i64::from(baseline.latitude_permille());
        let terrain = self.climate.terrain().sample(x_mm, z_mm);
        let swing = if terrain.is_submerged() {
            self.config.max_ocean_temperature_swing_millic
        } else {
            let continentality = i64::from(terrain.continentality_q20()).clamp(-(1 << 20), 1 << 20);
            let inland_permille = ((continentality + (1 << 20)) * 1_000 / (2 << 20)).clamp(0, 1_000);
            let ocean = i64::from(self.config.max_ocean_temperature_swing_millic);
            let land = i64::from(self.config.max_land_temperature_swing_millic);
            i32::try_from(ocean + (land - ocean) * inland_permille / PER_MILLE)
                .expect("interpolated seasonal swing fits i32")
        };
        let temperature_offset = i64::from(swing) * latitude * i64::from(hemisphere_wave)
            / (PER_MILLE * PER_MILLE);
        let temperature = i64::from(baseline.mean_temperature_millic()) + temperature_offset;
        let precipitation_factor = PER_MILLE
            + i64::from(self.config.precipitation_swing_permille)
                * i64::from(hemisphere_wave)
                / PER_MILLE;
        let precipitation = u64::from(baseline.annual_precipitation_mm())
            .saturating_mul(u64::try_from(precipitation_factor.max(0)).unwrap_or(0))
            / 1_000;
        let daylight = (500 + latitude * i64::from(hemisphere_wave) / 2_000).clamp(0, 1_000);

        SeasonSample {
            day_of_year: u16::try_from(day).expect("day within configured u16 year"),
            phase_permille,
            season: season_phase(phase_permille, z_mm >= self.climate.config().equator_z_mm()),
            daylight_permille: u16::try_from(daylight).expect("clamped daylight fits u16"),
            temperature_millic: i32::try_from(
                temperature.clamp(i64::from(i32::MIN), i64::from(i32::MAX)),
            )
            .expect("clamped temperature fits i32"),
            precipitation_mm_per_year_equivalent: u32::try_from(precipitation.min(u64::from(u32::MAX)))
                .expect("clamped precipitation fits u32"),
            baseline,
        }
    }
}

fn seasonal_wave_permille(phase: u16) -> i16 {
    let phase = i32::from(phase);
    let value = if phase < 250 {
        phase * 4
    } else if phase < 750 {
        2_000 - phase * 4
    } else {
        phase * 4 - 4_000
    };
    i16::try_from(value.clamp(-1_000, 1_000)).expect("clamped seasonal wave fits i16")
}

fn season_phase(phase: u16, northern: bool) -> SeasonPhase {
    let phase = if northern { phase } else { (phase + 500) % 1_000 };
    match phase {
        0..=249 => SeasonPhase::Spring,
        250..=499 => SeasonPhase::Summer,
        500..=749 => SeasonPhase::Autumn,
        _ => SeasonPhase::Winter,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SeasonError {
    InvalidYearLength,
    InvalidTemperatureSwing,
    InvalidPrecipitationSwing,
}

impl fmt::Display for SeasonError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidYearLength => "year length must contain at least four days",
            Self::InvalidTemperatureSwing => "seasonal temperature swings are invalid",
            Self::InvalidPrecipitationSwing => "precipitation swing must not exceed 1000 permille",
        })
    }
}

impl std::error::Error for SeasonError {}

#[cfg(test)]
mod tests {
    use super::{SeasonConfig, SeasonGenerator, SeasonPhase};
    use crate::{ClimateConfig, ClimateGenerator, TerrainConfig, TerrainGenerator};

    fn generator() -> SeasonGenerator {
        SeasonGenerator::new(
            ClimateGenerator::new(
                TerrainGenerator::new(42, TerrainConfig::default()),
                ClimateConfig::default(),
            ),
            SeasonConfig::default(),
        )
    }

    #[test]
    fn repeated_sampling_is_deterministic() {
        let generator = generator();
        assert_eq!(generator.sample(0, 5_000_000_000, 91), generator.sample(0, 5_000_000_000, 91));
    }

    #[test]
    fn hemispheres_have_opposite_seasons() {
        let generator = generator();
        let north = generator.sample(0, 5_000_000_000, 100);
        let south = generator.sample(0, -5_000_000_000, 100);
        assert_eq!(north.season(), SeasonPhase::Summer);
        assert_eq!(south.season(), SeasonPhase::Winter);
    }

    #[test]
    fn summer_is_warmer_and_brighter_than_winter() {
        let generator = generator();
        let summer = generator.sample(0, 5_000_000_000, 91);
        let winter = generator.sample(0, 5_000_000_000, 274);
        assert!(summer.temperature_millic() > winter.temperature_millic());
        assert!(summer.daylight_permille() > winter.daylight_permille());
    }

    #[test]
    fn absolute_days_wrap_at_year_boundary() {
        let generator = generator();
        assert_eq!(generator.sample(0, 0, 0), generator.sample(0, 0, 365));
    }

    #[test]
    fn invalid_configuration_is_rejected() {
        assert!(SeasonConfig::new(0, 18_000, 6_000, 250).is_err());
        assert!(SeasonConfig::new(365, 5_000, 6_000, 250).is_err());
        assert!(SeasonConfig::new(365, 18_000, 6_000, 1_001).is_err());
    }
}
