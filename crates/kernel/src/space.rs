use std::{fmt, num::NonZeroU32};

pub const MILLIMETERS_PER_METER: i64 = 1_000;
pub const DEFAULT_CELL_SIZE_MM: u32 = 1_000;
pub const DEFAULT_REGION_EDGE_CELLS: u32 = 64;

/// Authoritative continuous-world position in integer millimetres.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct WorldPosition {
    x_mm: i64,
    y_mm: i64,
    z_mm: i64,
}

impl WorldPosition {
    #[must_use]
    pub const fn from_millimetres(x_mm: i64, y_mm: i64, z_mm: i64) -> Self {
        Self { x_mm, y_mm, z_mm }
    }

    #[must_use]
    pub const fn x_mm(self) -> i64 {
        self.x_mm
    }

    #[must_use]
    pub const fn y_mm(self) -> i64 {
        self.y_mm
    }

    #[must_use]
    pub const fn z_mm(self) -> i64 {
        self.z_mm
    }

    /// Computes exact squared distance in square millimetres.
    ///
    /// # Errors
    ///
    /// Returns [`SpaceError::DistanceOverflow`] when the exact squared distance
    /// does not fit in `u128`.
    pub fn distance_squared(self, other: Self) -> Result<u128, SpaceError> {
        let dx = self.x_mm.abs_diff(other.x_mm);
        let dy = self.y_mm.abs_diff(other.y_mm);
        let dz = self.z_mm.abs_diff(other.z_mm);
        square(dx)
            .and_then(|value| value.checked_add(square(dy)?))
            .and_then(|value| value.checked_add(square(dz)?))
            .ok_or(SpaceError::DistanceOverflow)
    }
}

fn square(value: u64) -> Option<u128> {
    let value = u128::from(value);
    value.checked_mul(value)
}

/// Deterministic integer cell coordinate.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct CellCoord {
    x: i64,
    y: i64,
    z: i64,
}

impl CellCoord {
    #[must_use]
    pub const fn new(x: i64, y: i64, z: i64) -> Self {
        Self { x, y, z }
    }

    #[must_use]
    pub const fn x(self) -> i64 {
        self.x
    }

    #[must_use]
    pub const fn y(self) -> i64 {
        self.y
    }

    #[must_use]
    pub const fn z(self) -> i64 {
        self.z
    }
}

/// Coarser deterministic streaming and simulation partition.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct RegionCoord {
    x: i64,
    y: i64,
    z: i64,
}

impl RegionCoord {
    #[must_use]
    pub const fn new(x: i64, y: i64, z: i64) -> Self {
        Self { x, y, z }
    }

    #[must_use]
    pub const fn x(self) -> i64 {
        self.x
    }

    #[must_use]
    pub const fn y(self) -> i64 {
        self.y
    }

    #[must_use]
    pub const fn z(self) -> i64 {
        self.z
    }
}

/// Position local to a cell, always in `[0, cell_size_mm)` on every axis.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub struct CellLocalPosition {
    x_mm: u32,
    y_mm: u32,
    z_mm: u32,
}

impl CellLocalPosition {
    #[must_use]
    pub const fn x_mm(self) -> u32 {
        self.x_mm
    }

    #[must_use]
    pub const fn y_mm(self) -> u32 {
        self.y_mm
    }

    #[must_use]
    pub const fn z_mm(self) -> u32 {
        self.z_mm
    }
}

/// Stable spatial partition contract shared by simulation and persistence.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SpatialGrid {
    cell_size_mm: NonZeroU32,
    region_edge_cells: NonZeroU32,
}

impl SpatialGrid {
    /// Creates a deterministic grid specification.
    ///
    /// # Errors
    ///
    /// Returns [`SpaceError::InvalidCellSize`] when `cell_size_mm` is zero and
    /// [`SpaceError::InvalidRegionSize`] when `region_edge_cells` is zero.
    pub const fn new(cell_size_mm: u32, region_edge_cells: u32) -> Result<Self, SpaceError> {
        let Some(cell_size_mm) = NonZeroU32::new(cell_size_mm) else {
            return Err(SpaceError::InvalidCellSize);
        };
        let Some(region_edge_cells) = NonZeroU32::new(region_edge_cells) else {
            return Err(SpaceError::InvalidRegionSize);
        };
        Ok(Self {
            cell_size_mm,
            region_edge_cells,
        })
    }

    #[must_use]
    pub const fn cell_size_mm(self) -> u32 {
        self.cell_size_mm.get()
    }

    #[must_use]
    pub const fn region_edge_cells(self) -> u32 {
        self.region_edge_cells.get()
    }

    #[must_use]
    pub fn cell_of(self, position: WorldPosition) -> CellCoord {
        let size = i64::from(self.cell_size_mm.get());
        CellCoord::new(
            position.x_mm.div_euclid(size),
            position.y_mm.div_euclid(size),
            position.z_mm.div_euclid(size),
        )
    }

    #[must_use]
    pub fn local_in_cell(self, position: WorldPosition) -> CellLocalPosition {
        let size = i64::from(self.cell_size_mm.get());
        CellLocalPosition {
            x_mm: u32::try_from(position.x_mm.rem_euclid(size))
                .expect("cell remainder always fits u32"),
            y_mm: u32::try_from(position.y_mm.rem_euclid(size))
                .expect("cell remainder always fits u32"),
            z_mm: u32::try_from(position.z_mm.rem_euclid(size))
                .expect("cell remainder always fits u32"),
        }
    }

    #[must_use]
    pub fn region_of_cell(self, cell: CellCoord) -> RegionCoord {
        let edge = i64::from(self.region_edge_cells.get());
        RegionCoord::new(
            cell.x.div_euclid(edge),
            cell.y.div_euclid(edge),
            cell.z.div_euclid(edge),
        )
    }

    #[must_use]
    pub fn region_of(self, position: WorldPosition) -> RegionCoord {
        self.region_of_cell(self.cell_of(position))
    }
}

impl Default for SpatialGrid {
    fn default() -> Self {
        Self::new(DEFAULT_CELL_SIZE_MM, DEFAULT_REGION_EDGE_CELLS)
            .expect("default grid constants are non-zero")
    }
}

/// Half-open axis-aligned world-space bounds: `min <= point < max`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct WorldBounds {
    min: WorldPosition,
    max_exclusive: WorldPosition,
}

impl WorldBounds {
    /// Creates half-open bounds.
    ///
    /// # Errors
    ///
    /// Returns [`SpaceError::InvalidBounds`] unless every minimum component is
    /// strictly smaller than its corresponding maximum component.
    pub const fn new(min: WorldPosition, max_exclusive: WorldPosition) -> Result<Self, SpaceError> {
        if min.x_mm >= max_exclusive.x_mm
            || min.y_mm >= max_exclusive.y_mm
            || min.z_mm >= max_exclusive.z_mm
        {
            return Err(SpaceError::InvalidBounds);
        }
        Ok(Self { min, max_exclusive })
    }

    #[must_use]
    pub const fn min(self) -> WorldPosition {
        self.min
    }

    #[must_use]
    pub const fn max_exclusive(self) -> WorldPosition {
        self.max_exclusive
    }

    #[must_use]
    pub const fn contains(self, point: WorldPosition) -> bool {
        point.x_mm >= self.min.x_mm
            && point.y_mm >= self.min.y_mm
            && point.z_mm >= self.min.z_mm
            && point.x_mm < self.max_exclusive.x_mm
            && point.y_mm < self.max_exclusive.y_mm
            && point.z_mm < self.max_exclusive.z_mm
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpaceError {
    InvalidCellSize,
    InvalidRegionSize,
    InvalidBounds,
    DistanceOverflow,
}

impl fmt::Display for SpaceError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidCellSize => "cell size must be non-zero",
            Self::InvalidRegionSize => "region edge must contain at least one cell",
            Self::InvalidBounds => "world bounds must have positive extent on every axis",
            Self::DistanceOverflow => "squared world-space distance overflowed u128",
        })
    }
}

impl std::error::Error for SpaceError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn negative_positions_use_euclidean_partitioning() {
        let grid = SpatialGrid::default();
        let position = WorldPosition::from_millimetres(-1, -1_001, 999);
        assert_eq!(grid.cell_of(position), CellCoord::new(-1, -2, 0));
        assert_eq!(
            grid.local_in_cell(position),
            CellLocalPosition {
                x_mm: 999,
                y_mm: 999,
                z_mm: 999,
            }
        );
    }

    #[test]
    fn cell_boundaries_are_stable() {
        let grid = SpatialGrid::default();
        assert_eq!(
            grid.cell_of(WorldPosition::from_millimetres(999, 0, 0)),
            CellCoord::new(0, 0, 0)
        );
        assert_eq!(
            grid.cell_of(WorldPosition::from_millimetres(1_000, 0, 0)),
            CellCoord::new(1, 0, 0)
        );
    }

    #[test]
    fn regions_partition_cells_on_negative_edges() {
        let grid = SpatialGrid::default();
        assert_eq!(
            grid.region_of_cell(CellCoord::new(-1, -64, -65)),
            RegionCoord::new(-1, -1, -2)
        );
    }

    #[test]
    fn bounds_are_half_open() {
        let bounds = WorldBounds::new(
            WorldPosition::from_millimetres(-10, -10, -10),
            WorldPosition::from_millimetres(10, 10, 10),
        )
        .expect("bounds should be valid");
        assert!(bounds.contains(WorldPosition::from_millimetres(-10, 0, 0)));
        assert!(!bounds.contains(WorldPosition::from_millimetres(10, 0, 0)));
    }

    #[test]
    fn squared_distance_is_exact() {
        let left = WorldPosition::from_millimetres(0, 0, 0);
        let right = WorldPosition::from_millimetres(3, 4, 12);
        assert_eq!(left.distance_squared(right), Ok(169));
    }

    #[test]
    fn grid_rejects_zero_dimensions() {
        assert_eq!(SpatialGrid::new(0, 64), Err(SpaceError::InvalidCellSize));
        assert_eq!(
            SpatialGrid::new(1_000, 0),
            Err(SpaceError::InvalidRegionSize)
        );
    }
}
