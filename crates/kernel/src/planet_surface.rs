use std::fmt;

use crate::{CubeFace, PlanetError, PlanetSurfacePosition, DIRECTION_Q30_SCALE};

pub const MAX_SURFACE_TILE_LEVEL: u8 = 30;
pub const SURFACE_TILE_LOCAL_SCALE: u32 = 1 << 30;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum SurfaceEdge {
    North,
    East,
    South,
    West,
}

impl SurfaceEdge {
    #[must_use]
    pub const fn opposite(self) -> Self {
        match self {
            Self::North => Self::South,
            Self::East => Self::West,
            Self::South => Self::North,
            Self::West => Self::East,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct FaceEdgeTransform {
    target_face: CubeFace,
    target_edge: SurfaceEdge,
    reversed: bool,
}

impl FaceEdgeTransform {
    #[must_use]
    pub const fn target_face(self) -> CubeFace {
        self.target_face
    }

    #[must_use]
    pub const fn target_edge(self) -> SurfaceEdge {
        self.target_edge
    }

    #[must_use]
    pub const fn is_reversed(self) -> bool {
        self.reversed
    }
}

#[must_use]
pub const fn face_edge_transform(face: CubeFace, edge: SurfaceEdge) -> FaceEdgeTransform {
    use CubeFace::{NegativeX, NegativeY, NegativeZ, PositiveX, PositiveY, PositiveZ};
    use SurfaceEdge::{East, North, South, West};

    let (target_face, target_edge, reversed) = match (face, edge) {
        (PositiveX, North) => (PositiveY, East, false),
        (PositiveX, East) => (NegativeZ, West, false),
        (PositiveX, South) => (NegativeY, East, true),
        (PositiveX, West) => (PositiveZ, East, false),

        (NegativeX, North) => (PositiveY, West, true),
        (NegativeX, East) => (PositiveZ, West, false),
        (NegativeX, South) => (NegativeY, West, false),
        (NegativeX, West) => (NegativeZ, East, false),

        (PositiveY, North) => (NegativeZ, North, true),
        (PositiveY, East) => (PositiveX, North, false),
        (PositiveY, South) => (PositiveZ, North, false),
        (PositiveY, West) => (NegativeX, North, true),

        (NegativeY, North) => (PositiveZ, South, false),
        (NegativeY, East) => (PositiveX, South, true),
        (NegativeY, South) => (NegativeZ, South, true),
        (NegativeY, West) => (NegativeX, South, false),

        (PositiveZ, North) => (PositiveY, South, false),
        (PositiveZ, East) => (PositiveX, West, false),
        (PositiveZ, South) => (NegativeY, North, false),
        (PositiveZ, West) => (NegativeX, East, false),

        (NegativeZ, North) => (PositiveY, North, true),
        (NegativeZ, East) => (NegativeX, West, false),
        (NegativeZ, South) => (NegativeY, South, true),
        (NegativeZ, West) => (PositiveX, East, false),
    };

    FaceEdgeTransform {
        target_face,
        target_edge,
        reversed,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct SurfaceTileLocalPosition {
    u: u32,
    v: u32,
}

impl SurfaceTileLocalPosition {
    /// Creates a normalized position inside one surface tile.
    ///
    /// Both coordinates use the inclusive range `0..=2^30`.
    ///
    /// # Errors
    ///
    /// Returns [`SurfaceTileError::LocalCoordinateOutOfRange`] when either
    /// coordinate exceeds [`SURFACE_TILE_LOCAL_SCALE`].
    pub const fn new(u: u32, v: u32) -> Result<Self, SurfaceTileError> {
        if u > SURFACE_TILE_LOCAL_SCALE || v > SURFACE_TILE_LOCAL_SCALE {
            return Err(SurfaceTileError::LocalCoordinateOutOfRange);
        }
        Ok(Self { u, v })
    }

    #[must_use]
    pub const fn u_q30(self) -> u32 {
        self.u
    }

    #[must_use]
    pub const fn v_q30(self) -> u32 {
        self.v
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct SurfaceTileAddress {
    face: CubeFace,
    level: u8,
    x: u32,
    y: u32,
}

impl SurfaceTileAddress {
    /// Creates a quadtree tile address on one Cube-Sphere face.
    ///
    /// # Errors
    ///
    /// Returns [`SurfaceTileError`] when the level exceeds
    /// [`MAX_SURFACE_TILE_LEVEL`] or either coordinate lies outside the level grid.
    pub const fn new(face: CubeFace, level: u8, x: u32, y: u32) -> Result<Self, SurfaceTileError> {
        if level > MAX_SURFACE_TILE_LEVEL {
            return Err(SurfaceTileError::LevelOutOfRange);
        }
        let edge_tiles = 1_u32 << level;
        if x >= edge_tiles || y >= edge_tiles {
            return Err(SurfaceTileError::CoordinateOutOfRange);
        }
        Ok(Self { face, level, x, y })
    }

    #[must_use]
    pub const fn face(self) -> CubeFace {
        self.face
    }

    #[must_use]
    pub const fn level(self) -> u8 {
        self.level
    }

    #[must_use]
    pub const fn x(self) -> u32 {
        self.x
    }

    #[must_use]
    pub const fn y(self) -> u32 {
        self.y
    }

    #[must_use]
    pub const fn edge_tiles(self) -> u32 {
        1_u32 << self.level
    }

    #[must_use]
    pub const fn neighbour(self, edge: SurfaceEdge) -> Self {
        let edge_tiles = self.edge_tiles();
        let last = edge_tiles - 1;

        match edge {
            SurfaceEdge::North if self.y < last => Self {
                y: self.y + 1,
                ..self
            },
            SurfaceEdge::East if self.x < last => Self {
                x: self.x + 1,
                ..self
            },
            SurfaceEdge::South if self.y > 0 => Self {
                y: self.y - 1,
                ..self
            },
            SurfaceEdge::West if self.x > 0 => Self {
                x: self.x - 1,
                ..self
            },
            _ => self.cross_face(edge),
        }
    }

    /// Maps a normalized tile-local position to the authoritative Cube-Sphere
    /// surface coordinate.
    ///
    /// # Errors
    ///
    /// Returns [`SurfaceTileError`] only when the generated face coordinate
    /// violates the planet surface contract. Valid tile addresses and local
    /// positions always map successfully.
    pub fn surface_position(
        self,
        local: SurfaceTileLocalPosition,
        elevation_mm: i64,
    ) -> Result<PlanetSurfacePosition, SurfaceTileError> {
        let edge_tiles = i128::from(self.edge_tiles());
        let local_scale = i128::from(SURFACE_TILE_LOCAL_SCALE);
        let face_scale = i128::from(DIRECTION_Q30_SCALE);
        let global_u_numerator = i128::from(self.x) * local_scale + i128::from(local.u);
        let global_v_numerator = i128::from(self.y) * local_scale + i128::from(local.v);
        let u_q30 = -face_scale + 2 * global_u_numerator * face_scale / (edge_tiles * local_scale);
        let v_q30 = -face_scale + 2 * global_v_numerator * face_scale / (edge_tiles * local_scale);

        PlanetSurfacePosition::new(
            self.face,
            i64::try_from(u_q30).map_err(|_| SurfaceTileError::CoordinateOutOfRange)?,
            i64::try_from(v_q30).map_err(|_| SurfaceTileError::CoordinateOutOfRange)?,
            elevation_mm,
        )
        .map_err(Into::into)
    }

    #[must_use]
    pub fn edge_midpoint(self, edge: SurfaceEdge) -> PlanetSurfacePosition {
        let midpoint = SURFACE_TILE_LOCAL_SCALE / 2;
        let local = match edge {
            SurfaceEdge::North => SurfaceTileLocalPosition::new(midpoint, SURFACE_TILE_LOCAL_SCALE),
            SurfaceEdge::East => SurfaceTileLocalPosition::new(SURFACE_TILE_LOCAL_SCALE, midpoint),
            SurfaceEdge::South => SurfaceTileLocalPosition::new(midpoint, 0),
            SurfaceEdge::West => SurfaceTileLocalPosition::new(0, midpoint),
        }
        .expect("edge midpoint lies inside tile-local bounds");
        self.surface_position(local, 0)
            .expect("tile edge midpoint maps to Cube-Sphere bounds")
    }

    const fn cross_face(self, edge: SurfaceEdge) -> Self {
        let transform = face_edge_transform(self.face, edge);
        let edge_tiles = self.edge_tiles();
        let last = edge_tiles - 1;
        let source_offset = match edge {
            SurfaceEdge::North | SurfaceEdge::South => self.x,
            SurfaceEdge::East | SurfaceEdge::West => self.y,
        };
        let target_offset = if transform.reversed {
            last - source_offset
        } else {
            source_offset
        };
        let (x, y) = match transform.target_edge {
            SurfaceEdge::North => (target_offset, last),
            SurfaceEdge::East => (last, target_offset),
            SurfaceEdge::South => (target_offset, 0),
            SurfaceEdge::West => (0, target_offset),
        };
        Self {
            face: transform.target_face,
            level: self.level,
            x,
            y,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SurfaceTileError {
    LevelOutOfRange,
    CoordinateOutOfRange,
    LocalCoordinateOutOfRange,
}

impl fmt::Display for SurfaceTileError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::LevelOutOfRange => "surface tile level exceeds the supported quadtree depth",
            Self::CoordinateOutOfRange => "surface tile coordinate lies outside the level grid",
            Self::LocalCoordinateOutOfRange => {
                "surface tile local coordinate exceeds the normalized Q30 bounds"
            }
        })
    }
}

impl std::error::Error for SurfaceTileError {}

impl From<PlanetError> for SurfaceTileError {
    fn from(_: PlanetError) -> Self {
        Self::CoordinateOutOfRange
    }
}

#[cfg(test)]
mod tests {
    use super::{
        face_edge_transform, SurfaceEdge, SurfaceTileAddress, SurfaceTileError,
        SurfaceTileLocalPosition, MAX_SURFACE_TILE_LEVEL, SURFACE_TILE_LOCAL_SCALE,
    };
    use crate::{CubeFace, DIRECTION_Q30_SCALE};

    const FACES: [CubeFace; 6] = [
        CubeFace::PositiveX,
        CubeFace::NegativeX,
        CubeFace::PositiveY,
        CubeFace::NegativeY,
        CubeFace::PositiveZ,
        CubeFace::NegativeZ,
    ];
    const EDGES: [SurfaceEdge; 4] = [
        SurfaceEdge::North,
        SurfaceEdge::East,
        SurfaceEdge::South,
        SurfaceEdge::West,
    ];

    #[test]
    fn all_face_edges_are_reciprocal() {
        for face in FACES {
            for edge in EDGES {
                let forward = face_edge_transform(face, edge);
                let backward = face_edge_transform(forward.target_face(), forward.target_edge());
                assert_eq!(backward.target_face(), face);
                assert_eq!(backward.target_edge(), edge);
                assert_eq!(backward.is_reversed(), forward.is_reversed());
            }
        }
    }

    #[test]
    fn crossing_and_returning_restores_every_boundary_tile() {
        for level in 0..=6 {
            let edge_tiles = 1_u32 << level;
            let last = edge_tiles - 1;
            for face in FACES {
                for edge in EDGES {
                    for offset in 0..edge_tiles {
                        let tile = match edge {
                            SurfaceEdge::North => {
                                SurfaceTileAddress::new(face, level, offset, last)
                            }
                            SurfaceEdge::East => SurfaceTileAddress::new(face, level, last, offset),
                            SurfaceEdge::South => SurfaceTileAddress::new(face, level, offset, 0),
                            SurfaceEdge::West => SurfaceTileAddress::new(face, level, 0, offset),
                        }
                        .expect("boundary tile is valid");
                        let transform = face_edge_transform(face, edge);
                        let adjacent = tile.neighbour(edge);
                        assert_eq!(adjacent.face(), transform.target_face());
                        assert_eq!(adjacent.neighbour(transform.target_edge()), tile);
                    }
                }
            }
        }
    }

    #[test]
    fn shared_edge_midpoints_produce_identical_spherical_directions() {
        let level = 5;
        let edge_tiles = 1_u32 << level;
        let last = edge_tiles - 1;
        for face in FACES {
            for edge in EDGES {
                for offset in 0..edge_tiles {
                    let tile = match edge {
                        SurfaceEdge::North => SurfaceTileAddress::new(face, level, offset, last),
                        SurfaceEdge::East => SurfaceTileAddress::new(face, level, last, offset),
                        SurfaceEdge::South => SurfaceTileAddress::new(face, level, offset, 0),
                        SurfaceEdge::West => SurfaceTileAddress::new(face, level, 0, offset),
                    }
                    .expect("boundary tile is valid");
                    let transform = face_edge_transform(face, edge);
                    let adjacent = tile.neighbour(edge);
                    let source_direction = tile.edge_midpoint(edge).unit_direction_q30();
                    let target_direction = adjacent
                        .edge_midpoint(transform.target_edge())
                        .unit_direction_q30();
                    assert_eq!(source_direction, target_direction);
                }
            }
        }
    }

    #[test]
    fn root_tile_centre_maps_to_face_centre() {
        let tile =
            SurfaceTileAddress::new(CubeFace::PositiveZ, 0, 0, 0).expect("root tile is valid");
        let local = SurfaceTileLocalPosition::new(
            SURFACE_TILE_LOCAL_SCALE / 2,
            SURFACE_TILE_LOCAL_SCALE / 2,
        )
        .expect("tile centre is valid");
        let surface = tile
            .surface_position(local, 0)
            .expect("tile centre maps to surface");
        assert_eq!(surface.u_q30(), 0);
        assert_eq!(surface.v_q30(), 0);
        assert_eq!(surface.unit_direction_q30().z_q30(), DIRECTION_Q30_SCALE);
    }

    #[test]
    fn adjacent_tiles_share_identical_internal_boundaries() {
        let west =
            SurfaceTileAddress::new(CubeFace::PositiveZ, 4, 7, 5).expect("west tile is valid");
        let east = west.neighbour(SurfaceEdge::East);
        let source = west
            .surface_position(
                SurfaceTileLocalPosition::new(
                    SURFACE_TILE_LOCAL_SCALE,
                    SURFACE_TILE_LOCAL_SCALE / 3,
                )
                .expect("source local coordinate is valid"),
                125,
            )
            .expect("source position maps");
        let target = east
            .surface_position(
                SurfaceTileLocalPosition::new(0, SURFACE_TILE_LOCAL_SCALE / 3)
                    .expect("target local coordinate is valid"),
                125,
            )
            .expect("target position maps");
        assert_eq!(source, target);
    }

    #[test]
    fn invalid_tile_addresses_and_local_coordinates_are_rejected() {
        assert_eq!(
            SurfaceTileAddress::new(CubeFace::PositiveX, MAX_SURFACE_TILE_LEVEL + 1, 0, 0),
            Err(SurfaceTileError::LevelOutOfRange)
        );
        assert_eq!(
            SurfaceTileAddress::new(CubeFace::PositiveX, 2, 4, 0),
            Err(SurfaceTileError::CoordinateOutOfRange)
        );
        assert_eq!(
            SurfaceTileLocalPosition::new(SURFACE_TILE_LOCAL_SCALE + 1, 0),
            Err(SurfaceTileError::LocalCoordinateOutOfRange)
        );
    }
}
