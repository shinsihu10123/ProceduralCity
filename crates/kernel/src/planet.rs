use std::{fmt, num::NonZeroU64};

pub const DIRECTION_Q30_SCALE: i64 = 1 << 30;
pub const EARTH_MEAN_RADIUS_MM: u64 = 6_371_008_800_000;
pub const EARTH_AXIAL_TILT_MILLIDEGREES: u32 = 23_439;
pub const EARTH_SIDEREAL_ROTATION_MILLISECONDS: u64 = 86_164_091;
pub const EARTH_SIDEREAL_ORBIT_MILLISECONDS: u64 = 31_558_149_764;
pub const EARTH_STANDARD_GRAVITY_MICROMETERS_PER_SECOND_SQUARED: u32 = 9_806_650;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct PlanetConfig {
    mean_radius_mm: NonZeroU64,
    axial_tilt_millidegrees: u32,
    rotation_period_milliseconds: NonZeroU64,
    orbital_period_milliseconds: NonZeroU64,
    surface_gravity_micrometers_per_second_squared: u32,
}

impl PlanetConfig {
    /// Creates a spherical planet configuration.
    ///
    /// # Errors
    ///
    /// Returns [`PlanetError`] when the radius, rotation period, orbital
    /// period, or gravity is zero, or when axial tilt exceeds 90 degrees.
    pub const fn new(
        mean_radius_mm: u64,
        axial_tilt_millidegrees: u32,
        rotation_period_milliseconds: u64,
        orbital_period_milliseconds: u64,
        surface_gravity_micrometers_per_second_squared: u32,
    ) -> Result<Self, PlanetError> {
        let Some(mean_radius_mm) = NonZeroU64::new(mean_radius_mm) else {
            return Err(PlanetError::InvalidRadius);
        };
        if axial_tilt_millidegrees > 90_000 {
            return Err(PlanetError::InvalidAxialTilt);
        }
        let Some(rotation_period_milliseconds) = NonZeroU64::new(rotation_period_milliseconds)
        else {
            return Err(PlanetError::InvalidRotationPeriod);
        };
        let Some(orbital_period_milliseconds) = NonZeroU64::new(orbital_period_milliseconds) else {
            return Err(PlanetError::InvalidOrbitalPeriod);
        };
        if surface_gravity_micrometers_per_second_squared == 0 {
            return Err(PlanetError::InvalidGravity);
        }
        Ok(Self {
            mean_radius_mm,
            axial_tilt_millidegrees,
            rotation_period_milliseconds,
            orbital_period_milliseconds,
            surface_gravity_micrometers_per_second_squared,
        })
    }

    #[must_use]
    pub const fn mean_radius_mm(self) -> u64 {
        self.mean_radius_mm.get()
    }

    #[must_use]
    pub const fn axial_tilt_millidegrees(self) -> u32 {
        self.axial_tilt_millidegrees
    }

    #[must_use]
    pub const fn rotation_period_milliseconds(self) -> u64 {
        self.rotation_period_milliseconds.get()
    }

    #[must_use]
    pub const fn orbital_period_milliseconds(self) -> u64 {
        self.orbital_period_milliseconds.get()
    }

    #[must_use]
    pub const fn surface_gravity_micrometers_per_second_squared(self) -> u32 {
        self.surface_gravity_micrometers_per_second_squared
    }
}

impl Default for PlanetConfig {
    fn default() -> Self {
        Self::new(
            EARTH_MEAN_RADIUS_MM,
            EARTH_AXIAL_TILT_MILLIDEGREES,
            EARTH_SIDEREAL_ROTATION_MILLISECONDS,
            EARTH_SIDEREAL_ORBIT_MILLISECONDS,
            EARTH_STANDARD_GRAVITY_MICROMETERS_PER_SECOND_SQUARED,
        )
        .expect("Earth-like planet constants are valid")
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum CubeFace {
    PositiveX,
    NegativeX,
    PositiveY,
    NegativeY,
    PositiveZ,
    NegativeZ,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct PlanetSurfacePosition {
    face: CubeFace,
    u_q30: i64,
    v_q30: i64,
    elevation_mm: i64,
}

impl PlanetSurfacePosition {
    /// Creates a Cube-Sphere surface coordinate.
    ///
    /// `u_q30` and `v_q30` use the inclusive range `[-2^30, 2^30]`.
    ///
    /// # Errors
    ///
    /// Returns [`PlanetError::SurfaceCoordinateOutOfRange`] when either face
    /// coordinate lies outside the documented range.
    pub const fn new(
        face: CubeFace,
        u_q30: i64,
        v_q30: i64,
        elevation_mm: i64,
    ) -> Result<Self, PlanetError> {
        if u_q30 < -DIRECTION_Q30_SCALE
            || u_q30 > DIRECTION_Q30_SCALE
            || v_q30 < -DIRECTION_Q30_SCALE
            || v_q30 > DIRECTION_Q30_SCALE
        {
            return Err(PlanetError::SurfaceCoordinateOutOfRange);
        }
        Ok(Self {
            face,
            u_q30,
            v_q30,
            elevation_mm,
        })
    }

    #[must_use]
    pub const fn face(self) -> CubeFace {
        self.face
    }

    #[must_use]
    pub const fn u_q30(self) -> i64 {
        self.u_q30
    }

    #[must_use]
    pub const fn v_q30(self) -> i64 {
        self.v_q30
    }

    #[must_use]
    pub const fn elevation_mm(self) -> i64 {
        self.elevation_mm
    }

    #[must_use]
    pub fn unit_direction_q30(self) -> UnitDirectionQ30 {
        let scale = i128::from(DIRECTION_Q30_SCALE);
        let face_u = i128::from(self.u_q30);
        let face_v = i128::from(self.v_q30);
        let (cube_x, cube_y, cube_z) = match self.face {
            CubeFace::PositiveX => (scale, face_v, -face_u),
            CubeFace::NegativeX => (-scale, face_v, face_u),
            CubeFace::PositiveY => (face_u, scale, -face_v),
            CubeFace::NegativeY => (face_u, -scale, face_v),
            CubeFace::PositiveZ => (face_u, face_v, scale),
            CubeFace::NegativeZ => (-face_u, face_v, -scale),
        };
        normalize_q30(cube_x, cube_y, cube_z)
    }

    /// Converts the surface coordinate to a planet-centred Cartesian position.
    ///
    /// # Errors
    ///
    /// Returns [`PlanetError::ElevationBelowCentre`] when elevation would put
    /// the point at or below the planet centre, or [`PlanetError::CoordinateOverflow`]
    /// when the radial distance does not fit the signed coordinate contract.
    pub fn cartesian_mm(
        self,
        config: PlanetConfig,
    ) -> Result<PlanetCartesianPosition, PlanetError> {
        let radius = i128::from(config.mean_radius_mm()) + i128::from(self.elevation_mm);
        if radius <= 0 {
            return Err(PlanetError::ElevationBelowCentre);
        }
        if radius > i128::from(i64::MAX) {
            return Err(PlanetError::CoordinateOverflow);
        }
        let direction = self.unit_direction_q30();
        let scale = i128::from(DIRECTION_Q30_SCALE);
        let project = |component: i64| -> Result<i64, PlanetError> {
            i64::try_from(i128::from(component) * radius / scale)
                .map_err(|_| PlanetError::CoordinateOverflow)
        };
        Ok(PlanetCartesianPosition {
            x: project(direction.x_q30())?,
            y: project(direction.y_q30())?,
            z: project(direction.z_q30())?,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct UnitDirectionQ30 {
    x: i64,
    y: i64,
    z: i64,
}

impl UnitDirectionQ30 {
    #[must_use]
    pub const fn x_q30(self) -> i64 {
        self.x
    }

    #[must_use]
    pub const fn y_q30(self) -> i64 {
        self.y
    }

    #[must_use]
    pub const fn z_q30(self) -> i64 {
        self.z
    }

    /// Returns sine of geocentric latitude in Q30 form.
    #[must_use]
    pub const fn sin_latitude_q30(self) -> i64 {
        self.y
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct PlanetCartesianPosition {
    x: i64,
    y: i64,
    z: i64,
}

impl PlanetCartesianPosition {
    #[must_use]
    pub const fn x_mm(self) -> i64 {
        self.x
    }

    #[must_use]
    pub const fn y_mm(self) -> i64 {
        self.y
    }

    #[must_use]
    pub const fn z_mm(self) -> i64 {
        self.z
    }
}

fn normalize_q30(cube_x: i128, cube_y: i128, cube_z: i128) -> UnitDirectionQ30 {
    let squared = u128::try_from(cube_x * cube_x + cube_y * cube_y + cube_z * cube_z)
        .expect("cube-face direction squared length is positive");
    let length = integer_sqrt(squared);
    let scale = i128::from(DIRECTION_Q30_SCALE);
    let length = i128::try_from(length).expect("direction length fits i128");
    let convert = |value: i128| -> i64 {
        i64::try_from(value * scale / length).expect("normalised Q30 direction fits i64")
    };
    UnitDirectionQ30 {
        x: convert(cube_x),
        y: convert(cube_y),
        z: convert(cube_z),
    }
}

fn integer_sqrt(value: u128) -> u128 {
    if value < 2 {
        return value;
    }
    let mut low = 1_u128;
    let mut high = value / 2 + 1;
    while low <= high {
        let middle = low.midpoint(high);
        if middle <= value / middle {
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    high
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlanetError {
    InvalidRadius,
    InvalidAxialTilt,
    InvalidRotationPeriod,
    InvalidOrbitalPeriod,
    InvalidGravity,
    SurfaceCoordinateOutOfRange,
    ElevationBelowCentre,
    CoordinateOverflow,
}

impl fmt::Display for PlanetError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidRadius => "planet radius must be positive",
            Self::InvalidAxialTilt => "axial tilt must not exceed 90 degrees",
            Self::InvalidRotationPeriod => "rotation period must be positive",
            Self::InvalidOrbitalPeriod => "orbital period must be positive",
            Self::InvalidGravity => "surface gravity must be positive",
            Self::SurfaceCoordinateOutOfRange => {
                "Cube-Sphere coordinates must remain in Q30 face bounds"
            }
            Self::ElevationBelowCentre => {
                "surface elevation places the point at or below the planet centre"
            }
            Self::CoordinateOverflow => {
                "planet Cartesian coordinate exceeds the signed integer contract"
            }
        })
    }
}

impl std::error::Error for PlanetError {}

#[cfg(test)]
mod tests {
    use super::{
        CubeFace, PlanetConfig, PlanetSurfacePosition, DIRECTION_Q30_SCALE,
        EARTH_AXIAL_TILT_MILLIDEGREES, EARTH_MEAN_RADIUS_MM,
    };

    #[test]
    fn defaults_are_earth_like() {
        let config = PlanetConfig::default();
        assert_eq!(config.mean_radius_mm(), EARTH_MEAN_RADIUS_MM);
        assert_eq!(
            config.axial_tilt_millidegrees(),
            EARTH_AXIAL_TILT_MILLIDEGREES
        );
    }

    #[test]
    fn face_centres_map_to_cardinal_axes() {
        let positive_x = PlanetSurfacePosition::new(CubeFace::PositiveX, 0, 0, 0)
            .expect("face centre is valid")
            .unit_direction_q30();
        assert_eq!(positive_x.x_q30(), DIRECTION_Q30_SCALE);
        assert_eq!(positive_x.y_q30(), 0);
        assert_eq!(positive_x.z_q30(), 0);
    }

    #[test]
    fn shared_cube_edges_produce_identical_directions() {
        let positive_x = PlanetSurfacePosition::new(CubeFace::PositiveX, DIRECTION_Q30_SCALE, 0, 0)
            .expect("edge coordinate is valid")
            .unit_direction_q30();
        let negative_z =
            PlanetSurfacePosition::new(CubeFace::NegativeZ, -DIRECTION_Q30_SCALE, 0, 0)
                .expect("matching edge coordinate is valid")
                .unit_direction_q30();
        assert_eq!(positive_x, negative_z);
    }

    #[test]
    fn hemisphere_sign_comes_from_spherical_direction() {
        let north = PlanetSurfacePosition::new(CubeFace::PositiveY, 0, 0, 0)
            .expect("north pole is valid")
            .unit_direction_q30();
        let south = PlanetSurfacePosition::new(CubeFace::NegativeY, 0, 0, 0)
            .expect("south pole is valid")
            .unit_direction_q30();
        assert!(north.sin_latitude_q30() > 0);
        assert!(south.sin_latitude_q30() < 0);
    }

    #[test]
    fn cartesian_surface_radius_matches_planet_radius() {
        let config = PlanetConfig::default();
        let point = PlanetSurfacePosition::new(CubeFace::PositiveZ, 0, 0, 0)
            .expect("surface coordinate is valid")
            .cartesian_mm(config)
            .expect("Earth-like radius fits Cartesian coordinates");
        assert_eq!(point.x_mm(), 0);
        assert_eq!(point.y_mm(), 0);
        assert_eq!(
            point.z_mm(),
            i64::try_from(config.mean_radius_mm()).unwrap()
        );
    }

    #[test]
    fn invalid_face_coordinates_are_rejected() {
        assert!(
            PlanetSurfacePosition::new(CubeFace::PositiveX, DIRECTION_Q30_SCALE + 1, 0, 0,)
                .is_err()
        );
    }
}
