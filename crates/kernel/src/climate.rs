use std::{
    fmt,
    num::{NonZeroU32, NonZeroU64},
};

use crate::{TerrainGenerator, TerrainSample};

pub const DEFAULT_POLE_DISTANCE_MM: u64 = 10_000_000_000;
pub const DEFAULT_EQUATOR_TEMPERATURE_MILLIC: i32 = 28_000;
pub const DEFAULT_POLE_TEMPERATURE_MILLIC: i32 = -18_000;
pub const DEFAULT_LAPSE_RATE_MILLIC_PER_KM: u32 = 6_500;
pub const DEFAULT_BASE_PRECIPITATION_MM_PER_YEAR: u32 = 900;
pub const DEFAULT_OROGRAPHIC_SAMPLE_DISTANCE_MM: u32 = 64_000;
const Q20_SCALE: i64 = 1 << 20;
const PER_MILLE: i64 = 1_000;

/// Static baseline-climate configuration.
///
/// Seasonal oscillation is intentionally excluded and belongs to Stage 1.5.
/// Dynamic pressure and wind fields belong to Stage 1.7.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ClimateConfig {
    equator_z_mm: i64,
    pole_distance_mm: NonZeroU64,
    equator_temperature_millic: i32,
    pole_temperature_millic: i32,
    lapse_rate_millic_per_km: u32,
    base_precipitation_mm_per_year: u32,
    orographic_sample_distance_mm: NonZeroU32,
}

impl ClimateConfig {
    /// Creates a baseline-climate configuration.
    ///
    /// # Errors
    ///
    /// Returns [`ClimateError::InvalidPoleDistance`] when `pole_distance_mm`
    /// is zero, [`ClimateError::InvalidTemperatureRange`] when the equator is
    /// colder than the pole, [`ClimateError::InvalidLapseRate`] for rates above
    /// 20 °C/km, [`ClimateError::InvalidPrecipitation`] when the baseline is
    /// zero, or [`ClimateError::InvalidOrographicDistance`] when its sampling
    /// distance is zero.
    pub const fn new(
        equator_z_mm: i64,
        pole_distance_mm: u64,
        equator_temperature_millic: i32,
        pole_temperature_millic: i32,
        lapse_rate_millic_per_km: u32,
        base_precipitation_mm_per_year: u32,
        orographic_sample_distance_mm: u32,
    ) -> Result<Self, ClimateError> {
        let Some(pole_distance_mm) = NonZeroU64::new(pole_distance_mm) else {
            return Err(ClimateError::InvalidPoleDistance);
        };
        if equator_temperature_millic < pole_temperature_millic {
            return Err(ClimateError::InvalidTemperatureRange);
        }
        if lapse_rate_millic_per_km > 20_000 {
            return Err(ClimateError::InvalidLapseRate);
        }
        if base_precipitation_mm_per_year == 0 {
            return Err(ClimateError::InvalidPrecipitation);
        }
        let Some(orographic_sample_distance_mm) = NonZeroU32::new(orographic_sample_distance_mm)
        else {
            return Err(ClimateError::InvalidOrographicDistance);
        };
        Ok(Self {
            equator_z_mm,
            pole_distance_mm,
            equator_temperature_millic,
            pole_temperature_millic,
            lapse_rate_millic_per_km,
            base_precipitation_mm_per_year,
            orographic_sample_distance_mm,
        })
    }

    #[must_use]
    pub const fn equator_z_mm(self) -> i64 {
        self.equator_z_mm
    }

    #[must_use]
    pub const fn pole_distance_mm(self) -> u64 {
        self.pole_distance_mm.get()
    }

    #[must_use]
    pub const fn equator_temperature_millic(self) -> i32 {
        self.equator_temperature_millic
    }

    #[must_use]
    pub const fn pole_temperature_millic(self) -> i32 {
        self.pole_temperature_millic
    }

    #[must_use]
    pub const fn lapse_rate_millic_per_km(self) -> u32 {
        self.lapse_rate_millic_per_km
    }

    #[must_use]
    pub const fn base_precipitation_mm_per_year(self) -> u32 {
        self.base_precipitation_mm_per_year
    }

    #[must_use]
    pub const fn orographic_sample_distance_mm(self) -> u32 {
        self.orographic_sample_distance_mm.get()
    }
}

impl Default for ClimateConfig {
    fn default() -> Self {
        Self::new(
            0,
            DEFAULT_POLE_DISTANCE_MM,
            DEFAULT_EQUATOR_TEMPERATURE_MILLIC,
            DEFAULT_POLE_TEMPERATURE_MILLIC,
            DEFAULT_LAPSE_RATE_MILLIC_PER_KM,
            DEFAULT_BASE_PRECIPITATION_MM_PER_YEAR,
            DEFAULT_OROGRAPHIC_SAMPLE_DISTANCE_MM,
        )
        .expect("default climate constants are valid")
    }
}

/// Broad climate classification derived from static annual means.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ClimateClass {
    Ice,
    Tundra,
    Boreal,
    Temperate,
    Subtropical,
    Tropical,
    Arid,
    Alpine,
}

/// Deterministic annual-mean climate values at one world coordinate.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ClimateSample {
    mean_temperature_millic: i32,
    annual_precipitation_mm: u32,
    relative_humidity_permille: u16,
    aridity_index_permille: u16,
    latitude_permille: u16,
    class: ClimateClass,
}

impl ClimateSample {
    #[must_use]
    pub const fn mean_temperature_millic(self) -> i32 {
        self.mean_temperature_millic
    }

    #[must_use]
    pub const fn annual_precipitation_mm(self) -> u32 {
        self.annual_precipitation_mm
    }

    #[must_use]
    pub const fn relative_humidity_permille(self) -> u16 {
        self.relative_humidity_permille
    }

    #[must_use]
    pub const fn aridity_index_permille(self) -> u16 {
        self.aridity_index_permille
    }

    #[must_use]
    pub const fn latitude_permille(self) -> u16 {
        self.latitude_permille
    }

    #[must_use]
    pub const fn class(self) -> ClimateClass {
        self.class
    }
}

/// Stateless deterministic baseline-climate generator.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ClimateGenerator {
    terrain: TerrainGenerator,
    config: ClimateConfig,
}

impl ClimateGenerator {
    #[must_use]
    pub const fn new(terrain: TerrainGenerator, config: ClimateConfig) -> Self {
        Self { terrain, config }
    }

    #[must_use]
    pub const fn terrain(self) -> TerrainGenerator {
        self.terrain
    }

    #[must_use]
    pub const fn config(self) -> ClimateConfig {
        self.config
    }

    /// Samples static annual-mean climate at a horizontal world coordinate.
    ///
    /// The baseline assumes a west-to-east prevailing moisture path solely to
    /// establish deterministic orographic contrast. Dynamic winds are deferred
    /// to the atmospheric system.
    #[must_use]
    pub fn sample(self, x_mm: i64, z_mm: i64) -> ClimateSample {
        let terrain = self.terrain.sample(x_mm, z_mm);
        let upwind_x =
            x_mm.saturating_sub(i64::from(self.config.orographic_sample_distance_mm.get()));
        let upwind = self.terrain.sample(upwind_x, z_mm);
        let latitude_permille = self.latitude_permille(z_mm);
        let temperature = self.temperature_millic(terrain, latitude_permille);
        let precipitation = self.precipitation_mm(terrain, upwind, latitude_permille);
        let humidity = humidity_permille(terrain, precipitation);
        let aridity = aridity_permille(temperature, precipitation);
        ClimateSample {
            mean_temperature_millic: temperature,
            annual_precipitation_mm: precipitation,
            relative_humidity_permille: humidity,
            aridity_index_permille: aridity,
            latitude_permille,
            class: classify_climate(terrain, temperature, aridity),
        }
    }

    fn latitude_permille(self, z_mm: i64) -> u16 {
        let distance = z_mm.abs_diff(self.config.equator_z_mm);
        let scaled = distance
            .saturating_mul(PER_MILLE as u64)
            .checked_div(self.config.pole_distance_mm.get())
            .unwrap_or(u64::MAX)
            .min(PER_MILLE as u64);
        u16::try_from(scaled).expect("clamped latitude permille fits u16")
    }

    fn temperature_millic(self, terrain: TerrainSample, latitude_permille: u16) -> i32 {
        let equator = i64::from(self.config.equator_temperature_millic);
        let pole = i64::from(self.config.pole_temperature_millic);
        let latitude_drop = (equator - pole) * i64::from(latitude_permille) / PER_MILLE;
        let elevation_mm = i64::from(
            terrain
                .height_mm()
                .saturating_sub(terrain.sea_level_mm())
                .max(0),
        );
        let elevation_drop =
            elevation_mm * i64::from(self.config.lapse_rate_millic_per_km) / 1_000_000;
        let result = equator - latitude_drop - elevation_drop;
        i32::try_from(result.clamp(i64::from(i32::MIN), i64::from(i32::MAX)))
            .expect("clamped temperature fits i32")
    }

    fn precipitation_mm(
        self,
        terrain: TerrainSample,
        upwind: TerrainSample,
        latitude_permille: u16,
    ) -> u32 {
        let continentality = i64::from(terrain.continentality_q20());
        let ocean_influence = ((Q20_SCALE - continentality) * 500 / Q20_SCALE).clamp(0, PER_MILLE);
        let latitude_factor = (PER_MILLE - i64::from(latitude_permille) * 2 / 5).max(300);
        let baseline = i64::from(self.config.base_precipitation_mm_per_year);
        let moisture = baseline / 3 + baseline * ocean_influence * 4 / (3 * PER_MILLE);
        let upwind_difference = i64::from(terrain.height_mm()) - i64::from(upwind.height_mm());
        let orographic = if upwind_difference > 0 {
            (upwind_difference / 250).min(800)
        } else {
            (upwind_difference / 500).max(-500)
        };
        let precipitation = moisture * latitude_factor / PER_MILLE + orographic;
        u32::try_from(precipitation.clamp(1, i64::from(u32::MAX)))
            .expect("clamped precipitation fits u32")
    }
}

fn humidity_permille(terrain: TerrainSample, precipitation_mm: u32) -> u16 {
    if terrain.is_submerged() {
        return 1_000;
    }
    let value = u64::from(precipitation_mm)
        .saturating_mul(1_000)
        .checked_div(1_800)
        .unwrap_or(u64::MAX)
        .clamp(80, 1_000);
    u16::try_from(value).expect("clamped humidity fits u16")
}

fn aridity_permille(temperature_millic: i32, precipitation_mm: u32) -> u16 {
    let thermal_demand = i64::from(temperature_millic)
        .saturating_add(10_000)
        .max(1);
    let potential_evaporation = u64::try_from(thermal_demand / 25 + 200).unwrap_or(u64::MAX);
    let value = u64::from(precipitation_mm)
        .saturating_mul(1_000)
        .checked_div(potential_evaporation.max(1))
        .unwrap_or(u64::MAX)
        .min(2_000);
    u16::try_from(value).expect("clamped aridity index fits u16")
}

fn classify_climate(
    terrain: TerrainSample,
    temperature_millic: i32,
    aridity_permille: u16,
) -> ClimateClass {
    let elevation_above_sea = terrain.height_mm().saturating_sub(terrain.sea_level_mm());
    if elevation_above_sea >= 2_500_000 {
        ClimateClass::Alpine
    } else if temperature_millic <= -10_000 {
        ClimateClass::Ice
    } else if temperature_millic <= 0 {
        ClimateClass::Tundra
    } else if aridity_permille < 500 {
        ClimateClass::Arid
    } else if temperature_millic >= 24_000 {
        ClimateClass::Tropical
    } else if temperature_millic >= 18_000 {
        ClimateClass::Subtropical
    } else if temperature_millic >= 5_000 {
        ClimateClass::Temperate
    } else {
        ClimateClass::Boreal
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClimateError {
    InvalidPoleDistance,
    InvalidTemperatureRange,
    InvalidLapseRate,
    InvalidPrecipitation,
    InvalidOrographicDistance,
}

impl fmt::Display for ClimateError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidPoleDistance => {
                formatter.write_str("pole distance must be positive")
            }
            Self::InvalidTemperatureRange => {
                formatter.write_str("equator temperature must not be below pole temperature")
            }
            Self::InvalidLapseRate => formatter
                .write_str("lapse rate must not exceed 20,000 milli-Celsius per kilometre"),
            Self::InvalidPrecipitation => {
                formatter.write_str("baseline precipitation must be positive")
            }
            Self::InvalidOrographicDistance => {
                formatter.write_str("orographic sampling distance must be positive")
            }
        }
    }
}

impl std::error::Error for ClimateError {}

#[cfg(test)]
mod tests {
    use super::{
        ClimateClass, ClimateConfig, ClimateGenerator, DEFAULT_BASE_PRECIPITATION_MM_PER_YEAR,
        DEFAULT_EQUATOR_TEMPERATURE_MILLIC, DEFAULT_OROGRAPHIC_SAMPLE_DISTANCE_MM,
        DEFAULT_POLE_DISTANCE_MM, DEFAULT_POLE_TEMPERATURE_MILLIC,
    };
    use crate::{TerrainConfig, TerrainGenerator};

    fn terrain() -> TerrainGenerator {
        TerrainGenerator::new(42, TerrainConfig::default())
    }

    fn generator() -> ClimateGenerator {
        ClimateGenerator::new(terrain(), ClimateConfig::default())
    }

    #[test]
    fn identical_seed_and_coordinate_are_deterministic() {
        let generator = generator();
        assert_eq!(
            generator.sample(1_250_000, -750_000),
            generator.sample(1_250_000, -750_000)
        );
    }

    #[test]
    fn polar_baseline_is_colder_than_equator() {
        let generator = generator();
        let equator = generator.sample(0, 0);
        let pole = generator.sample(0, generator.config().pole_distance_mm() as i64);
        assert!(pole.mean_temperature_millic() < equator.mean_temperature_millic());
    }

    #[test]
    fn lapse_rate_cools_land_above_sea_level() {
        let terrain = terrain();
        let coordinate = (-128..=128)
            .map(|x| i64::from(x) * 256_000)
            .find(|x| terrain.sample(*x, 0).height_mm() > 0)
            .expect("test terrain must contain land above sea level");
        let without_lapse = ClimateConfig::new(
            0,
            DEFAULT_POLE_DISTANCE_MM,
            DEFAULT_EQUATOR_TEMPERATURE_MILLIC,
            DEFAULT_POLE_TEMPERATURE_MILLIC,
            0,
            DEFAULT_BASE_PRECIPITATION_MM_PER_YEAR,
            DEFAULT_OROGRAPHIC_SAMPLE_DISTANCE_MM,
        )
        .expect("zero lapse-rate configuration is valid");
        let normal = generator().sample(coordinate, 0);
        let flat = ClimateGenerator::new(terrain, without_lapse).sample(coordinate, 0);
        assert!(normal.mean_temperature_millic() < flat.mean_temperature_millic());
    }

    #[test]
    fn climate_values_stay_in_documented_ranges() {
        let generator = generator();
        for z in [-10_000_000_000_i64, 0, 10_000_000_000] {
            let sample = generator.sample(0, z);
            assert!(sample.annual_precipitation_mm() > 0);
            assert!((80..=1_000).contains(&sample.relative_humidity_permille()));
            assert!(sample.aridity_index_permille() <= 2_000);
            assert!(sample.latitude_permille() <= 1_000);
        }
    }

    #[test]
    fn invalid_configuration_is_rejected() {
        assert!(ClimateConfig::new(0, 0, 28_000, -18_000, 6_500, 900, 64_000).is_err());
        assert!(ClimateConfig::new(0, 1, -20_000, 20_000, 6_500, 900, 64_000).is_err());
        assert!(ClimateConfig::new(0, 1, 28_000, -18_000, 20_001, 900, 64_000).is_err());
        assert!(ClimateConfig::new(0, 1, 28_000, -18_000, 6_500, 0, 64_000).is_err());
        assert!(ClimateConfig::new(0, 1, 28_000, -18_000, 6_500, 900, 0).is_err());
    }

    #[test]
    fn broad_classes_are_reachable() {
        let generator = generator();
        let equator = generator.sample(0, 0);
        let pole = generator.sample(0, 10_000_000_000);
        assert!(matches!(
            equator.class(),
            ClimateClass::Tropical | ClimateClass::Subtropical | ClimateClass::Arid
        ));
        assert!(matches!(
            pole.class(),
            ClimateClass::Ice | ClimateClass::Tundra | ClimateClass::Alpine
        ));
    }
}
