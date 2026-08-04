#[path = "tectonic_boundary.rs"]
mod boundary;
pub use boundary::{PlateBoundaryKind, PlateBoundarySample};

use crate::{CubeFace, PlanetSurfacePosition, UnitDirectionQ30, DIRECTION_Q30_SCALE};

pub const DEFAULT_TECTONIC_PLATE_COUNT: u16 = 24;
pub const MIN_TECTONIC_PLATE_COUNT: u16 = 6;
pub const MAX_TECTONIC_PLATE_COUNT: u16 = 128;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct PlateId(u16);

impl PlateId {
    #[must_use]
    pub const fn new(value: u16) -> Self {
        Self(value)
    }

    #[must_use]
    pub const fn value(self) -> u16 {
        self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PlateType {
    Oceanic,
    Continental,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct PlateMotionQ30 {
    x: i32,
    y: i32,
    z: i32,
    speed_micrometers_per_year: u32,
}

impl PlateMotionQ30 {
    #[must_use]
    pub const fn x_q30(self) -> i32 {
        self.x
    }

    #[must_use]
    pub const fn y_q30(self) -> i32 {
        self.y
    }

    #[must_use]
    pub const fn z_q30(self) -> i32 {
        self.z
    }

    #[must_use]
    pub const fn speed_micrometers_per_year(self) -> u32 {
        self.speed_micrometers_per_year
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TectonicPlate {
    id: PlateId,
    center: UnitDirectionQ30,
    plate_type: PlateType,
    age_millions_of_years: u16,
    density_kg_per_cubic_meter: u16,
    crust_thickness_meters: u32,
    motion: PlateMotionQ30,
}

impl TectonicPlate {
    #[must_use]
    pub const fn id(self) -> PlateId {
        self.id
    }

    #[must_use]
    pub const fn center(self) -> UnitDirectionQ30 {
        self.center
    }

    #[must_use]
    pub const fn plate_type(self) -> PlateType {
        self.plate_type
    }

    #[must_use]
    pub const fn age_millions_of_years(self) -> u16 {
        self.age_millions_of_years
    }

    #[must_use]
    pub const fn density_kg_per_cubic_meter(self) -> u16 {
        self.density_kg_per_cubic_meter
    }

    #[must_use]
    pub const fn crust_thickness_meters(self) -> u32 {
        self.crust_thickness_meters
    }

    #[must_use]
    pub const fn motion(self) -> PlateMotionQ30 {
        self.motion
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlateField {
    world_seed: u64,
    plates: Vec<TectonicPlate>,
}

impl PlateField {
    /// Generates a deterministic global tectonic plate field.
    ///
    /// # Errors
    ///
    /// Returns [`TectonicError::InvalidPlateCount`] when the requested count
    /// lies outside the supported range.
    pub fn generate(world_seed: u64, plate_count: u16) -> Result<Self, TectonicError> {
        if !(MIN_TECTONIC_PLATE_COUNT..=MAX_TECTONIC_PLATE_COUNT).contains(&plate_count) {
            return Err(TectonicError::InvalidPlateCount);
        }

        let plates = (0..plate_count)
            .map(|index| generate_plate(world_seed, index))
            .collect();
        Ok(Self { world_seed, plates })
    }

    /// Generates an Earth-like field using the validated default plate count.
    ///
    /// # Panics
    ///
    /// Panics only if [`DEFAULT_TECTONIC_PLATE_COUNT`] is changed to a value
    /// outside the supported plate-count range.
    #[must_use]
    pub fn earth_like(world_seed: u64) -> Self {
        Self::generate(world_seed, DEFAULT_TECTONIC_PLATE_COUNT)
            .expect("default tectonic plate count is valid")
    }

    #[must_use]
    pub const fn world_seed(&self) -> u64 {
        self.world_seed
    }

    #[must_use]
    pub fn plates(&self) -> &[TectonicPlate] {
        &self.plates
    }

    /// Returns the spherical Voronoi owner for a unit direction.
    ///
    /// # Panics
    ///
    /// Panics only if a `PlateField` is constructed internally with an empty
    /// plate list. Public constructors reject such fields.
    #[must_use]
    pub fn plate_at(&self, direction: UnitDirectionQ30) -> TectonicPlate {
        *self
            .plates
            .iter()
            .max_by_key(|plate| dot_q60(direction, plate.center))
            .expect("validated plate fields are never empty")
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TectonicError {
    InvalidPlateCount,
}

impl core::fmt::Display for TectonicError {
    fn fmt(&self, formatter: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Self::InvalidPlateCount => formatter.write_str("tectonic plate count is invalid"),
        }
    }
}

impl std::error::Error for TectonicError {}

fn generate_plate(world_seed: u64, index: u16) -> TectonicPlate {
    let base = mix64(world_seed ^ u64::from(index).wrapping_mul(0x9e37_79b9_7f4a_7c15));
    let face = match base % 6 {
        0 => CubeFace::PositiveX,
        1 => CubeFace::NegativeX,
        2 => CubeFace::PositiveY,
        3 => CubeFace::NegativeY,
        4 => CubeFace::PositiveZ,
        _ => CubeFace::NegativeZ,
    };
    let u = signed_face_coordinate(mix64(base ^ 0x517c_c1b7_2722_0a95));
    let v = signed_face_coordinate(mix64(base ^ 0x6eed_0e9d_a4d9_4a4f));
    let center = PlanetSurfacePosition::new(face, u, v, 0)
        .expect("generated face coordinates are valid")
        .unit_direction_q30();

    let continental = mix64(base ^ 0xa5a3_58e5_4f1d_92c7) % 100 < 38;
    let plate_type = if continental {
        PlateType::Continental
    } else {
        PlateType::Oceanic
    };
    let age_millions_of_years = if continental {
        500 + u16::try_from(mix64(base ^ 0x33) % 3_501).expect("continental age fits u16")
    } else {
        u16::try_from(5 + mix64(base ^ 0x55) % 196).expect("oceanic age fits u16")
    };
    let density_kg_per_cubic_meter = if continental {
        2_650 + u16::try_from(mix64(base ^ 0x77) % 151).expect("density offset fits u16")
    } else {
        2_950 + u16::try_from(mix64(base ^ 0x99) % 201).expect("density offset fits u16")
    };
    let crust_thickness_meters = if continental {
        25_000 + u32::try_from(mix64(base ^ 0xbb) % 46_001).expect("thickness fits u32")
    } else {
        5_000 + u32::try_from(mix64(base ^ 0xdd) % 6_001).expect("thickness fits u32")
    };

    TectonicPlate {
        id: PlateId::new(index),
        center,
        plate_type,
        age_millions_of_years,
        density_kg_per_cubic_meter,
        crust_thickness_meters,
        motion: generate_motion(base, center),
    }
}

fn generate_motion(seed: u64, center: UnitDirectionQ30) -> PlateMotionQ30 {
    let raw_x = signed_q30(mix64(seed ^ 0x1234));
    let raw_y = signed_q30(mix64(seed ^ 0x5678));
    let raw_z = signed_q30(mix64(seed ^ 0x9abc));
    let center_dot = (i128::from(raw_x) * i128::from(center.x_q30())
        + i128::from(raw_y) * i128::from(center.y_q30())
        + i128::from(raw_z) * i128::from(center.z_q30()))
        / i128::from(DIRECTION_Q30_SCALE);
    let tangent_x = i128::from(raw_x)
        - center_dot * i128::from(center.x_q30()) / i128::from(DIRECTION_Q30_SCALE);
    let tangent_y = i128::from(raw_y)
        - center_dot * i128::from(center.y_q30()) / i128::from(DIRECTION_Q30_SCALE);
    let tangent_z = i128::from(raw_z)
        - center_dot * i128::from(center.z_q30()) / i128::from(DIRECTION_Q30_SCALE);

    PlateMotionQ30 {
        x: clamp_i128_to_i32(tangent_x),
        y: clamp_i128_to_i32(tangent_y),
        z: clamp_i128_to_i32(tangent_z),
        speed_micrometers_per_year: 5_000
            + u32::try_from(mix64(seed ^ 0xdef0) % 95_001).expect("plate speed fits u32"),
    }
}

fn signed_face_coordinate(value: u64) -> i64 {
    let span = u64::try_from(DIRECTION_Q30_SCALE * 2 + 1).expect("Q30 span fits u64");
    i64::try_from(value % span).expect("face coordinate fits i64") - DIRECTION_Q30_SCALE
}

fn signed_q30(value: u64) -> i64 {
    signed_face_coordinate(value)
}

fn dot_q60(left: UnitDirectionQ30, right: UnitDirectionQ30) -> i128 {
    i128::from(left.x_q30()) * i128::from(right.x_q30())
        + i128::from(left.y_q30()) * i128::from(right.y_q30())
        + i128::from(left.z_q30()) * i128::from(right.z_q30())
}

fn clamp_i128_to_i32(value: i128) -> i32 {
    i32::try_from(value).unwrap_or_else(|_| {
        if value.is_negative() {
            i32::MIN
        } else {
            i32::MAX
        }
    })
}

fn mix64(mut value: u64) -> u64 {
    value ^= value >> 30;
    value = value.wrapping_mul(0xbf58_476d_1ce4_e5b9);
    value ^= value >> 27;
    value = value.wrapping_mul(0x94d0_49bb_1331_11eb);
    value ^ (value >> 31)
}

#[cfg(test)]
mod tests {
    use super::{PlateField, PlateType, TectonicError};
    use crate::{CubeFace, PlanetSurfacePosition, DIRECTION_Q30_SCALE};

    #[test]
    fn identical_seed_produces_identical_plates() {
        assert_eq!(PlateField::earth_like(42), PlateField::earth_like(42));
    }

    #[test]
    fn different_seeds_change_the_plate_field() {
        assert_ne!(PlateField::earth_like(1), PlateField::earth_like(2));
    }

    #[test]
    fn face_independent_direction_has_one_plate_owner() {
        let field = PlateField::earth_like(7);
        let from_x = PlanetSurfacePosition::new(CubeFace::PositiveX, -DIRECTION_Q30_SCALE, 0, 0)
            .expect("coordinate is valid")
            .unit_direction_q30();
        let from_z = PlanetSurfacePosition::new(CubeFace::PositiveZ, DIRECTION_Q30_SCALE, 0, 0)
            .expect("coordinate is valid")
            .unit_direction_q30();
        assert_eq!(from_x, from_z);
        assert_eq!(field.plate_at(from_x).id(), field.plate_at(from_z).id());
    }

    #[test]
    fn earth_like_field_contains_both_crust_types() {
        let field = PlateField::earth_like(42);
        assert!(field
            .plates()
            .iter()
            .any(|plate| plate.plate_type() == PlateType::Oceanic));
        assert!(field
            .plates()
            .iter()
            .any(|plate| plate.plate_type() == PlateType::Continental));
    }

    #[test]
    fn invalid_plate_counts_are_rejected() {
        assert_eq!(
            PlateField::generate(1, 0),
            Err(TectonicError::InvalidPlateCount)
        );
        assert_eq!(
            PlateField::generate(1, 129),
            Err(TectonicError::InvalidPlateCount)
        );
    }
}
