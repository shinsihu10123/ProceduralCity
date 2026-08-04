use std::{fmt, num::NonZeroU32};

pub const DEFAULT_BASE_WAVELENGTH_MM: u32 = 256_000;
pub const DEFAULT_AMPLITUDE_MM: i32 = 120_000;
pub const DEFAULT_OCTAVES: u8 = 5;
pub const DEFAULT_SEA_LEVEL_MM: i32 = 0;
const INTERPOLATION_SCALE: i128 = 1 << 20;

/// Configuration for deterministic procedural terrain sampling.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TerrainConfig {
    base_wavelength_mm: NonZeroU32,
    amplitude_mm: i32,
    octaves: u8,
    sea_level_mm: i32,
}

impl TerrainConfig {
    /// Creates a terrain configuration.
    ///
    /// # Errors
    ///
    /// Returns [`TerrainError::InvalidWavelength`] when the base wavelength is
    /// zero, [`TerrainError::InvalidAmplitude`] when the amplitude is not
    /// positive, or [`TerrainError::InvalidOctaves`] unless octaves is in
    /// `1..=16`.
    pub const fn new(
        base_wavelength_mm: u32,
        amplitude_mm: i32,
        octaves: u8,
        sea_level_mm: i32,
    ) -> Result<Self, TerrainError> {
        let Some(base_wavelength_mm) = NonZeroU32::new(base_wavelength_mm) else {
            return Err(TerrainError::InvalidWavelength);
        };
        if amplitude_mm <= 0 {
            return Err(TerrainError::InvalidAmplitude);
        }
        if octaves == 0 || octaves > 16 {
            return Err(TerrainError::InvalidOctaves);
        }
        Ok(Self {
            base_wavelength_mm,
            amplitude_mm,
            octaves,
            sea_level_mm,
        })
    }

    #[must_use]
    pub const fn base_wavelength_mm(self) -> u32 {
        self.base_wavelength_mm.get()
    }

    #[must_use]
    pub const fn amplitude_mm(self) -> i32 {
        self.amplitude_mm
    }

    #[must_use]
    pub const fn octaves(self) -> u8 {
        self.octaves
    }

    #[must_use]
    pub const fn sea_level_mm(self) -> i32 {
        self.sea_level_mm
    }
}

impl Default for TerrainConfig {
    fn default() -> Self {
        Self::new(
            DEFAULT_BASE_WAVELENGTH_MM,
            DEFAULT_AMPLITUDE_MM,
            DEFAULT_OCTAVES,
            DEFAULT_SEA_LEVEL_MM,
        )
        .expect("default terrain constants are valid")
    }
}

/// Deterministic terrain sample at one horizontal world coordinate.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TerrainSample {
    height_mm: i32,
    sea_level_mm: i32,
}

impl TerrainSample {
    #[must_use]
    pub const fn height_mm(self) -> i32 {
        self.height_mm
    }

    #[must_use]
    pub const fn sea_level_mm(self) -> i32 {
        self.sea_level_mm
    }

    #[must_use]
    pub const fn is_submerged(self) -> bool {
        self.height_mm < self.sea_level_mm
    }

    #[must_use]
    pub const fn water_depth_mm(self) -> u32 {
        if self.is_submerged() {
            self.sea_level_mm.abs_diff(self.height_mm)
        } else {
            0
        }
    }
}

/// Stateless, deterministic terrain height-field generator.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TerrainGenerator {
    world_seed: u64,
    config: TerrainConfig,
}

impl TerrainGenerator {
    #[must_use]
    pub const fn new(world_seed: u64, config: TerrainConfig) -> Self {
        Self { world_seed, config }
    }

    #[must_use]
    pub const fn world_seed(self) -> u64 {
        self.world_seed
    }

    #[must_use]
    pub const fn config(self) -> TerrainConfig {
        self.config
    }

    /// Samples terrain at horizontal world coordinates in millimetres.
    ///
    /// The implementation uses only integer arithmetic, so results are stable
    /// across platforms and independent of evaluation order.
    #[must_use]
    pub fn sample(self, x_mm: i64, z_mm: i64) -> TerrainSample {
        let mut wavelength = u64::from(self.config.base_wavelength_mm.get());
        let mut amplitude = i64::from(self.config.amplitude_mm);
        let mut total = 0_i128;
        let mut weight = 0_i128;

        for octave in 0..self.config.octaves {
            let octave_value = value_noise_2d(self.world_seed, octave, x_mm, z_mm, wavelength);
            total += i128::from(octave_value) * i128::from(amplitude);
            weight += i128::from(amplitude);

            wavelength = (wavelength / 2).max(1);
            amplitude = (amplitude / 2).max(1);
        }

        let normalized = total / weight;
        let height = normalized * i128::from(self.config.amplitude_mm) / i128::from(i32::MAX);
        let height_mm = i32::try_from(height).expect("normalized terrain height fits i32");
        TerrainSample {
            height_mm,
            sea_level_mm: self.config.sea_level_mm,
        }
    }
}

fn value_noise_2d(seed: u64, octave: u8, x_mm: i64, z_mm: i64, wavelength: u64) -> i32 {
    let wavelength = i64::try_from(wavelength).expect("wavelength is bounded by u32 input");
    let x0 = x_mm.div_euclid(wavelength);
    let z0 = z_mm.div_euclid(wavelength);
    let x_fraction = fraction_q20(x_mm.rem_euclid(wavelength), wavelength);
    let z_fraction = fraction_q20(z_mm.rem_euclid(wavelength), wavelength);

    let v00 = i128::from(lattice_value(seed, octave, x0, z0));
    let v10 = i128::from(lattice_value(seed, octave, x0 + 1, z0));
    let v01 = i128::from(lattice_value(seed, octave, x0, z0 + 1));
    let v11 = i128::from(lattice_value(seed, octave, x0 + 1, z0 + 1));

    let lower = lerp_q20(v00, v10, smooth_q20(x_fraction));
    let upper = lerp_q20(v01, v11, smooth_q20(x_fraction));
    i32::try_from(lerp_q20(lower, upper, smooth_q20(z_fraction)))
        .expect("interpolation of i32 lattice values remains in i32")
}

fn fraction_q20(remainder: i64, divisor: i64) -> i128 {
    i128::from(remainder) * INTERPOLATION_SCALE / i128::from(divisor)
}

fn smooth_q20(value: i128) -> i128 {
    let squared = value * value / INTERPOLATION_SCALE;
    squared * (3 * INTERPOLATION_SCALE - 2 * value) / INTERPOLATION_SCALE
}

fn lerp_q20(left: i128, right: i128, fraction: i128) -> i128 {
    left + (right - left) * fraction / INTERPOLATION_SCALE
}

fn lattice_value(seed: u64, octave: u8, x: i64, z: i64) -> i32 {
    let mut value = seed
        ^ u64::from(octave).wrapping_mul(0x9e37_79b9_7f4a_7c15)
        ^ u64::from_le_bytes(x.to_le_bytes()).rotate_left(17)
        ^ u64::from_le_bytes(z.to_le_bytes()).rotate_left(41);
    value ^= value >> 30;
    value = value.wrapping_mul(0xbf58_476d_1ce4_e5b9);
    value ^= value >> 27;
    value = value.wrapping_mul(0x94d0_49bb_1331_11eb);
    value ^= value >> 31;
    let upper = u32::try_from(value >> 32).expect("shifted u64 fits u32");
    i32::from_ne_bytes(upper.to_ne_bytes())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TerrainError {
    InvalidWavelength,
    InvalidAmplitude,
    InvalidOctaves,
}

impl fmt::Display for TerrainError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidWavelength => "terrain wavelength must be non-zero",
            Self::InvalidAmplitude => "terrain amplitude must be positive",
            Self::InvalidOctaves => "terrain octaves must be in 1..=16",
        })
    }
}

impl std::error::Error for TerrainError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identical_seed_and_position_are_deterministic() {
        let generator = TerrainGenerator::new(42, TerrainConfig::default());
        assert_eq!(generator.sample(123_456, -987_654), generator.sample(123_456, -987_654));
    }

    #[test]
    fn different_seeds_change_the_height_field() {
        let left = TerrainGenerator::new(1, TerrainConfig::default());
        let right = TerrainGenerator::new(2, TerrainConfig::default());
        let positions = [(0, 0), (12_345, 67_890), (-400_000, 200_000)];
        assert!(positions
            .into_iter()
            .any(|(x, z)| left.sample(x, z) != right.sample(x, z)));
    }

    #[test]
    fn lattice_boundaries_are_continuous() {
        let config = TerrainConfig::new(1_000, 10_000, 1, 0).expect("valid config");
        let generator = TerrainGenerator::new(7, config);
        assert_eq!(generator.sample(1_000, 500), generator.sample(1_000, 500));
        let left = generator.sample(999, 500).height_mm();
        let boundary = generator.sample(1_000, 500).height_mm();
        let right = generator.sample(1_001, 500).height_mm();
        assert!((boundary - left).abs() < 100);
        assert!((right - boundary).abs() < 100);
    }

    #[test]
    fn negative_coordinates_are_supported() {
        let generator = TerrainGenerator::new(99, TerrainConfig::default());
        let sample = generator.sample(-1, -1);
        assert!(sample.height_mm().abs() <= DEFAULT_AMPLITUDE_MM);
    }

    #[test]
    fn submerged_samples_report_depth() {
        let sample = TerrainSample {
            height_mm: -250,
            sea_level_mm: 100,
        };
        assert!(sample.is_submerged());
        assert_eq!(sample.water_depth_mm(), 350);
    }

    #[test]
    fn invalid_configuration_is_rejected() {
        assert_eq!(
            TerrainConfig::new(0, 1, 1, 0),
            Err(TerrainError::InvalidWavelength)
        );
        assert_eq!(
            TerrainConfig::new(1, 0, 1, 0),
            Err(TerrainError::InvalidAmplitude)
        );
        assert_eq!(
            TerrainConfig::new(1, 1, 0, 0),
            Err(TerrainError::InvalidOctaves)
        );
    }
}
