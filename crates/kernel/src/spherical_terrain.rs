use crate::{UnitDirectionQ30, DIRECTION_Q30_SCALE};

const INTERPOLATION_SCALE: i64 = 1 << 20;
const DEFAULT_BASE_FREQUENCY: u32 = 3;
const DEFAULT_SPHERICAL_AMPLITUDE_MM: i32 = 6_000_000;
const DEFAULT_SPHERICAL_OCTAVES: u8 = 6;

/// Deterministic terrain height field sampled from a planet-centred unit direction.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SphericalTerrainGenerator {
    world_seed: u64,
    base_frequency: u32,
    amplitude_mm: i32,
    octaves: u8,
}

impl SphericalTerrainGenerator {
    #[must_use]
    pub const fn earth_like(world_seed: u64) -> Self {
        Self {
            world_seed,
            base_frequency: DEFAULT_BASE_FREQUENCY,
            amplitude_mm: DEFAULT_SPHERICAL_AMPLITUDE_MM,
            octaves: DEFAULT_SPHERICAL_OCTAVES,
        }
    }

    #[must_use]
    pub const fn world_seed(self) -> u64 {
        self.world_seed
    }

    /// Returns authoritative elevation in millimetres for one spherical direction.
    #[must_use]
    pub fn height_mm(self, direction: UnitDirectionQ30) -> i32 {
        let mut frequency = self.base_frequency;
        let mut amplitude = i64::from(self.amplitude_mm);
        let mut weighted = 0_i128;
        let mut weight = 0_i128;

        for octave in 0..self.octaves {
            let value = noise3_q20(self.world_seed, octave, direction, frequency);
            weighted += i128::from(value) * i128::from(amplitude);
            weight += i128::from(amplitude);
            frequency = frequency.saturating_mul(2);
            amplitude = (amplitude / 2).max(1);
        }

        let normalized = weighted / weight;
        let height = normalized * i128::from(self.amplitude_mm) / i128::from(INTERPOLATION_SCALE);
        i32::try_from(height).unwrap_or_else(|_| {
            if height.is_negative() {
                i32::MIN
            } else {
                i32::MAX
            }
        })
    }
}

fn noise3_q20(seed: u64, octave: u8, direction: UnitDirectionQ30, frequency: u32) -> i64 {
    let scale = i128::from(DIRECTION_Q30_SCALE);
    let frequency = i128::from(frequency);
    let x = i128::from(direction.x_q30()) * frequency;
    let y = i128::from(direction.y_q30()) * frequency;
    let z = i128::from(direction.z_q30()) * frequency;

    let (x0, xf) = split_coordinate(x, scale);
    let (y0, yf) = split_coordinate(y, scale);
    let (z0, zf) = split_coordinate(z, scale);

    let mut corners = [[[0_i64; 2]; 2]; 2];
    for dz in 0..=1_i64 {
        for dy in 0..=1_i64 {
            for dx in 0..=1_i64 {
                corners[usize::try_from(dz).expect("corner index")]
                    [usize::try_from(dy).expect("corner index")]
                    [usize::try_from(dx).expect("corner index")] =
                    lattice(seed, octave, x0 + dx, y0 + dy, z0 + dz);
            }
        }
    }

    let sx = smooth_q20(xf);
    let sy = smooth_q20(yf);
    let sz = smooth_q20(zf);
    let mut planes = [0_i64; 2];
    for dz in 0..=1_usize {
        let low = lerp_q20(corners[dz][0][0], corners[dz][0][1], sx);
        let high = lerp_q20(corners[dz][1][0], corners[dz][1][1], sx);
        planes[dz] = lerp_q20(low, high, sy);
    }
    lerp_q20(planes[0], planes[1], sz)
}

fn split_coordinate(value: i128, scale: i128) -> (i64, i64) {
    let quotient = value.div_euclid(scale);
    let remainder = value.rem_euclid(scale);
    (
        i64::try_from(quotient).expect("spherical lattice coordinate fits i64"),
        i64::try_from(remainder * i128::from(INTERPOLATION_SCALE) / scale)
            .expect("interpolation fraction fits i64"),
    )
}

fn smooth_q20(value: i64) -> i64 {
    let square = i128::from(value) * i128::from(value) / i128::from(INTERPOLATION_SCALE);
    i64::try_from(
        square * i128::from(3 * INTERPOLATION_SCALE - 2 * value) / i128::from(INTERPOLATION_SCALE),
    )
    .expect("smoothed interpolation remains Q20")
}

fn lerp_q20(left: i64, right: i64, fraction: i64) -> i64 {
    left + i64::try_from(
        i128::from(right - left) * i128::from(fraction) / i128::from(INTERPOLATION_SCALE),
    )
    .expect("interpolation remains i64")
}

fn lattice(seed: u64, octave: u8, x: i64, y: i64, z: i64) -> i64 {
    let mut value = seed
        ^ u64::from(octave).wrapping_mul(0x9e37_79b9_7f4a_7c15)
        ^ x.cast_unsigned().rotate_left(13)
        ^ y.cast_unsigned().rotate_left(31)
        ^ z.cast_unsigned().rotate_left(47);
    value ^= value >> 30;
    value = value.wrapping_mul(0xbf58_476d_1ce4_e5b9);
    value ^= value >> 27;
    value = value.wrapping_mul(0x94d0_49bb_1331_11eb);
    value ^= value >> 31;
    let bytes = value.to_le_bytes();
    let signed = i32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
    i64::from(signed) * INTERPOLATION_SCALE / i64::from(i32::MAX)
}

#[cfg(test)]
mod tests {
    use super::SphericalTerrainGenerator;
    use crate::{CubeFace, PlanetSurfacePosition, DIRECTION_Q30_SCALE};

    #[test]
    fn identical_direction_is_face_independent() {
        let generator = SphericalTerrainGenerator::earth_like(42);
        let positive_x =
            PlanetSurfacePosition::new(CubeFace::PositiveX, -DIRECTION_Q30_SCALE, 0, 0)
                .expect("surface coordinate is valid")
                .unit_direction_q30();
        let positive_z = PlanetSurfacePosition::new(CubeFace::PositiveZ, DIRECTION_Q30_SCALE, 0, 0)
            .expect("surface coordinate is valid")
            .unit_direction_q30();
        assert_eq!(positive_x, positive_z);
        assert_eq!(
            generator.height_mm(positive_x),
            generator.height_mm(positive_z)
        );
    }

    #[test]
    fn seed_changes_the_planet_field() {
        let direction =
            PlanetSurfacePosition::new(CubeFace::PositiveY, 123_456_789, -456_789_123, 0)
                .expect("surface coordinate is valid")
                .unit_direction_q30();
        assert_ne!(
            SphericalTerrainGenerator::earth_like(1).height_mm(direction),
            SphericalTerrainGenerator::earth_like(2).height_mm(direction)
        );
    }

    #[test]
    fn nearby_directions_do_not_jump_to_extreme_opposites() {
        let generator = SphericalTerrainGenerator::earth_like(7);
        let left = PlanetSurfacePosition::new(CubeFace::PositiveZ, 100_000_000, 200_000_000, 0)
            .expect("surface coordinate is valid")
            .unit_direction_q30();
        let right = PlanetSurfacePosition::new(CubeFace::PositiveZ, 100_100_000, 200_000_000, 0)
            .expect("surface coordinate is valid")
            .unit_direction_q30();
        assert!(
            generator
                .height_mm(left)
                .abs_diff(generator.height_mm(right))
                < 500_000
        );
    }
}
