use std::{fmt, num::NonZeroU32};

use crate::{TerrainClass, TerrainGenerator, TerrainSample};

pub const DEFAULT_TERRAIN_CHUNK_EDGE_CELLS: u32 = 64;
pub const DEFAULT_TERRAIN_SAMPLE_SPACING_MM: u32 = 1_000;
pub const MAX_TERRAIN_CHUNK_EDGE_CELLS: u32 = 1_024;

/// Horizontal coordinate of a deterministic terrain chunk.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct TerrainChunkCoord {
    x: i64,
    z: i64,
}

impl TerrainChunkCoord {
    #[must_use]
    pub const fn new(x: i64, z: i64) -> Self {
        Self { x, z }
    }

    #[must_use]
    pub const fn x(self) -> i64 {
        self.x
    }

    #[must_use]
    pub const fn z(self) -> i64 {
        self.z
    }
}

/// Sampling contract for one square terrain chunk.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TerrainChunkSpec {
    edge_cells: NonZeroU32,
    sample_spacing_mm: NonZeroU32,
}

impl TerrainChunkSpec {
    /// Creates a chunk sampling specification.
    ///
    /// # Errors
    ///
    /// Returns [`TerrainAnalysisError::InvalidChunkEdge`] when `edge_cells` is
    /// zero or exceeds [`MAX_TERRAIN_CHUNK_EDGE_CELLS`], and
    /// [`TerrainAnalysisError::InvalidSampleSpacing`] when spacing is zero.
    pub const fn new(
        edge_cells: u32,
        sample_spacing_mm: u32,
    ) -> Result<Self, TerrainAnalysisError> {
        let Some(edge_cells) = NonZeroU32::new(edge_cells) else {
            return Err(TerrainAnalysisError::InvalidChunkEdge);
        };
        if edge_cells.get() > MAX_TERRAIN_CHUNK_EDGE_CELLS {
            return Err(TerrainAnalysisError::InvalidChunkEdge);
        }
        let Some(sample_spacing_mm) = NonZeroU32::new(sample_spacing_mm) else {
            return Err(TerrainAnalysisError::InvalidSampleSpacing);
        };
        Ok(Self {
            edge_cells,
            sample_spacing_mm,
        })
    }

    #[must_use]
    pub const fn edge_cells(self) -> u32 {
        self.edge_cells.get()
    }

    #[must_use]
    pub const fn sample_spacing_mm(self) -> u32 {
        self.sample_spacing_mm.get()
    }

    #[must_use]
    pub const fn edge_samples(self) -> u32 {
        self.edge_cells.get() + 1
    }
}

impl Default for TerrainChunkSpec {
    fn default() -> Self {
        Self::new(
            DEFAULT_TERRAIN_CHUNK_EDGE_CELLS,
            DEFAULT_TERRAIN_SAMPLE_SPACING_MM,
        )
        .expect("default terrain chunk constants are valid")
    }
}

/// Materialized terrain samples for a square chunk, including shared borders.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TerrainChunk {
    coord: TerrainChunkCoord,
    spec: TerrainChunkSpec,
    origin_x_mm: i64,
    origin_z_mm: i64,
    samples: Vec<TerrainSample>,
}

impl TerrainChunk {
    /// Generates a deterministic chunk from world-coordinate samples.
    ///
    /// # Errors
    ///
    /// Returns [`TerrainAnalysisError::CoordinateOverflow`] when the chunk
    /// origin or a sample coordinate cannot be represented as `i64`, and
    /// [`TerrainAnalysisError::AllocationOverflow`] when the sample count
    /// cannot be represented as `usize`.
    ///
    /// # Panics
    ///
    /// Panics only if [`TerrainGenerator::sample`] violates its documented
    /// fixed-point invariants.
    pub fn generate(
        generator: TerrainGenerator,
        coord: TerrainChunkCoord,
        spec: TerrainChunkSpec,
    ) -> Result<Self, TerrainAnalysisError> {
        let chunk_span = i64::from(spec.edge_cells())
            .checked_mul(i64::from(spec.sample_spacing_mm()))
            .ok_or(TerrainAnalysisError::CoordinateOverflow)?;
        let origin_x_mm = coord
            .x
            .checked_mul(chunk_span)
            .ok_or(TerrainAnalysisError::CoordinateOverflow)?;
        let origin_z_mm = coord
            .z
            .checked_mul(chunk_span)
            .ok_or(TerrainAnalysisError::CoordinateOverflow)?;
        let edge_samples = usize::try_from(spec.edge_samples())
            .map_err(|_| TerrainAnalysisError::AllocationOverflow)?;
        let sample_count = edge_samples
            .checked_mul(edge_samples)
            .ok_or(TerrainAnalysisError::AllocationOverflow)?;
        let mut samples = Vec::with_capacity(sample_count);

        for z_index in 0..edge_samples {
            let z_offset = i64::try_from(z_index)
                .map_err(|_| TerrainAnalysisError::CoordinateOverflow)?
                .checked_mul(i64::from(spec.sample_spacing_mm()))
                .ok_or(TerrainAnalysisError::CoordinateOverflow)?;
            let z_mm = origin_z_mm
                .checked_add(z_offset)
                .ok_or(TerrainAnalysisError::CoordinateOverflow)?;
            for x_index in 0..edge_samples {
                let x_offset = i64::try_from(x_index)
                    .map_err(|_| TerrainAnalysisError::CoordinateOverflow)?
                    .checked_mul(i64::from(spec.sample_spacing_mm()))
                    .ok_or(TerrainAnalysisError::CoordinateOverflow)?;
                let x_mm = origin_x_mm
                    .checked_add(x_offset)
                    .ok_or(TerrainAnalysisError::CoordinateOverflow)?;
                samples.push(generator.sample(x_mm, z_mm));
            }
        }

        Ok(Self {
            coord,
            spec,
            origin_x_mm,
            origin_z_mm,
            samples,
        })
    }

    #[must_use]
    pub const fn coord(&self) -> TerrainChunkCoord {
        self.coord
    }

    #[must_use]
    pub const fn spec(&self) -> TerrainChunkSpec {
        self.spec
    }

    #[must_use]
    pub const fn origin_x_mm(&self) -> i64 {
        self.origin_x_mm
    }

    #[must_use]
    pub const fn origin_z_mm(&self) -> i64 {
        self.origin_z_mm
    }

    #[must_use]
    pub fn samples(&self) -> &[TerrainSample] {
        &self.samples
    }

    #[must_use]
    pub fn sample_at(&self, x_index: u32, z_index: u32) -> Option<TerrainSample> {
        if x_index >= self.spec.edge_samples() || z_index >= self.spec.edge_samples() {
            return None;
        }
        let edge = usize::try_from(self.spec.edge_samples()).ok()?;
        let x = usize::try_from(x_index).ok()?;
        let z = usize::try_from(z_index).ok()?;
        self.samples.get(z.checked_mul(edge)?.checked_add(x)?).copied()
    }
}

/// Eight-neighbour drainage direction, or a local sink when no neighbour is lower.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum FlowDirection {
    North,
    NorthEast,
    East,
    SouthEast,
    South,
    SouthWest,
    West,
    NorthWest,
    Sink,
}

impl TerrainGenerator {
    /// Returns the steepest deterministic descent among eight neighbours.
    ///
    /// Equal-height neighbours do not drain. Equal drops are resolved by the
    /// fixed clockwise order beginning at north.
    ///
    /// # Panics
    ///
    /// Panics only if [`TerrainGenerator::sample`] violates its documented
    /// fixed-point invariants.
    #[must_use]
    pub fn flow_direction(self, x_mm: i64, z_mm: i64, spacing_mm: NonZeroU32) -> FlowDirection {
        let center = self.sample(x_mm, z_mm).height_mm();
        let spacing = i64::from(spacing_mm.get());
        let neighbours = [
            (FlowDirection::North, 0_i64, -spacing),
            (FlowDirection::NorthEast, spacing, -spacing),
            (FlowDirection::East, spacing, 0),
            (FlowDirection::SouthEast, spacing, spacing),
            (FlowDirection::South, 0, spacing),
            (FlowDirection::SouthWest, -spacing, spacing),
            (FlowDirection::West, -spacing, 0),
            (FlowDirection::NorthWest, -spacing, -spacing),
        ];
        let mut best = FlowDirection::Sink;
        let mut best_height = center;

        for (direction, dx, dz) in neighbours {
            let neighbour = self
                .sample(x_mm.saturating_add(dx), z_mm.saturating_add(dz))
                .height_mm();
            if neighbour < best_height {
                best_height = neighbour;
                best = direction;
            }
        }
        best
    }
}

/// Aggregate statistics for deterministic terrain-quality checks.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TerrainQualityReport {
    sample_count: u64,
    submerged_count: u64,
    minimum_height_mm: i32,
    maximum_height_mm: i32,
    class_counts: [u64; 8],
}

impl TerrainQualityReport {
    /// Samples a square lattice for reproducible statistical validation.
    ///
    /// # Errors
    ///
    /// Returns [`TerrainAnalysisError::InvalidQualityGrid`] when `edge_samples`
    /// is zero and [`TerrainAnalysisError::CoordinateOverflow`] when a sample
    /// coordinate cannot be represented as `i64`.
    ///
    /// # Panics
    ///
    /// Panics only if [`TerrainGenerator::sample`] violates its documented
    /// fixed-point invariants.
    pub fn sample_grid(
        generator: TerrainGenerator,
        origin_x_mm: i64,
        origin_z_mm: i64,
        edge_samples: u32,
        spacing_mm: NonZeroU32,
    ) -> Result<Self, TerrainAnalysisError> {
        if edge_samples == 0 {
            return Err(TerrainAnalysisError::InvalidQualityGrid);
        }
        let mut report = Self {
            sample_count: 0,
            submerged_count: 0,
            minimum_height_mm: i32::MAX,
            maximum_height_mm: i32::MIN,
            class_counts: [0; 8],
        };
        let spacing = i64::from(spacing_mm.get());

        for z in 0..edge_samples {
            let z_mm = origin_z_mm
                .checked_add(i64::from(z).checked_mul(spacing).ok_or(
                    TerrainAnalysisError::CoordinateOverflow,
                )?)
                .ok_or(TerrainAnalysisError::CoordinateOverflow)?;
            for x in 0..edge_samples {
                let x_mm = origin_x_mm
                    .checked_add(i64::from(x).checked_mul(spacing).ok_or(
                        TerrainAnalysisError::CoordinateOverflow,
                    )?)
                    .ok_or(TerrainAnalysisError::CoordinateOverflow)?;
                let sample = generator.sample(x_mm, z_mm);
                report.sample_count += 1;
                report.submerged_count += u64::from(sample.is_submerged());
                report.minimum_height_mm = report.minimum_height_mm.min(sample.height_mm());
                report.maximum_height_mm = report.maximum_height_mm.max(sample.height_mm());
                report.class_counts[class_index(sample.class())] += 1;
            }
        }
        Ok(report)
    }

    #[must_use]
    pub const fn sample_count(self) -> u64 {
        self.sample_count
    }

    #[must_use]
    pub const fn submerged_count(self) -> u64 {
        self.submerged_count
    }

    #[must_use]
    pub const fn minimum_height_mm(self) -> i32 {
        self.minimum_height_mm
    }

    #[must_use]
    pub const fn maximum_height_mm(self) -> i32 {
        self.maximum_height_mm
    }

    #[must_use]
    pub const fn class_counts(self) -> [u64; 8] {
        self.class_counts
    }
}

const fn class_index(class: TerrainClass) -> usize {
    match class {
        TerrainClass::DeepOcean => 0,
        TerrainClass::ShallowOcean => 1,
        TerrainClass::Coast => 2,
        TerrainClass::Plain => 3,
        TerrainClass::Hill => 4,
        TerrainClass::Mountain => 5,
        TerrainClass::HighMountain => 6,
        TerrainClass::Cliff => 7,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TerrainAnalysisError {
    InvalidChunkEdge,
    InvalidSampleSpacing,
    InvalidQualityGrid,
    CoordinateOverflow,
    AllocationOverflow,
}

impl fmt::Display for TerrainAnalysisError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidChunkEdge => "terrain chunk edge must be in 1..=1024 cells",
            Self::InvalidSampleSpacing => "terrain sample spacing must be non-zero",
            Self::InvalidQualityGrid => "terrain quality grid must contain at least one sample",
            Self::CoordinateOverflow => "terrain sample coordinate overflowed i64",
            Self::AllocationOverflow => "terrain chunk sample allocation overflowed usize",
        })
    }
}

impl std::error::Error for TerrainAnalysisError {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::TerrainConfig;

    #[test]
    fn adjacent_chunks_share_identical_border_samples() {
        let generator = TerrainGenerator::new(42, TerrainConfig::default());
        let spec = TerrainChunkSpec::new(8, 1_000).expect("valid chunk spec");
        let left = TerrainChunk::generate(generator, TerrainChunkCoord::new(-1, 0), spec)
            .expect("left chunk should generate");
        let right = TerrainChunk::generate(generator, TerrainChunkCoord::new(0, 0), spec)
            .expect("right chunk should generate");

        for z in 0..spec.edge_samples() {
            assert_eq!(
                left.sample_at(spec.edge_cells(), z),
                right.sample_at(0, z)
            );
        }
    }

    #[test]
    fn chunk_origin_uses_euclidean_world_layout() {
        let generator = TerrainGenerator::new(7, TerrainConfig::default());
        let spec = TerrainChunkSpec::new(4, 250).expect("valid chunk spec");
        let chunk = TerrainChunk::generate(generator, TerrainChunkCoord::new(-2, 3), spec)
            .expect("chunk should generate");
        assert_eq!(chunk.origin_x_mm(), -2_000);
        assert_eq!(chunk.origin_z_mm(), 3_000);
    }

    #[test]
    fn flow_never_selects_a_higher_neighbour() {
        let generator = TerrainGenerator::new(99, TerrainConfig::default());
        let spacing = NonZeroU32::new(1_000).expect("non-zero spacing");
        let direction = generator.flow_direction(123_000, -456_000, spacing);
        assert!(matches!(
            direction,
            FlowDirection::North
                | FlowDirection::NorthEast
                | FlowDirection::East
                | FlowDirection::SouthEast
                | FlowDirection::South
                | FlowDirection::SouthWest
                | FlowDirection::West
                | FlowDirection::NorthWest
                | FlowDirection::Sink
        ));
    }

    #[test]
    fn quality_report_is_deterministic_and_non_flat() {
        let generator = TerrainGenerator::new(11, TerrainConfig::default());
        let spacing = NonZeroU32::new(250_000).expect("non-zero spacing");
        let left = TerrainQualityReport::sample_grid(generator, -2_000_000, -2_000_000, 17, spacing)
            .expect("quality report should generate");
        let right = TerrainQualityReport::sample_grid(generator, -2_000_000, -2_000_000, 17, spacing)
            .expect("quality report should generate");
        assert_eq!(left, right);
        assert_eq!(left.sample_count(), 289);
        assert!(left.minimum_height_mm() < left.maximum_height_mm());
        assert_eq!(left.class_counts().into_iter().sum::<u64>(), 289);
    }

    #[test]
    fn invalid_chunk_specs_are_rejected() {
        assert_eq!(
            TerrainChunkSpec::new(0, 1_000),
            Err(TerrainAnalysisError::InvalidChunkEdge)
        );
        assert_eq!(
            TerrainChunkSpec::new(MAX_TERRAIN_CHUNK_EDGE_CELLS + 1, 1_000),
            Err(TerrainAnalysisError::InvalidChunkEdge)
        );
        assert_eq!(
            TerrainChunkSpec::new(1, 0),
            Err(TerrainAnalysisError::InvalidSampleSpacing)
        );
    }
}
