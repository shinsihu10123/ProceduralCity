use std::{fmt, num::NonZeroU32};

use crate::{TerrainClass, TerrainGenerator, TerrainSample};

pub const DEFAULT_TERRAIN_CHUNK_EDGE_CELLS: u32 = 64;
pub const DEFAULT_TERRAIN_SAMPLE_SPACING_MM: u32 = 1_000;
pub const MAX_TERRAIN_CHUNK_EDGE_CELLS: u32 = 1_024;

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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TerrainChunkSpec {
    edge_cells: NonZeroU32,
    sample_spacing_mm: NonZeroU32,
}

impl TerrainChunkSpec {
    /// # Errors
    ///
    /// Returns [`TerrainAnalysisError::InvalidChunkEdge`] for an unsupported
    /// edge and [`TerrainAnalysisError::InvalidSampleSpacing`] for zero spacing.
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

    fn chunk_span_mm(self) -> i64 {
        i64::from(self.edge_cells()) * i64::from(self.sample_spacing_mm())
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TerrainChunk {
    coord: TerrainChunkCoord,
    spec: TerrainChunkSpec,
    origin_x_mm: i64,
    origin_z_mm: i64,
    samples: Vec<TerrainSample>,
}

impl TerrainChunk {
    /// # Errors
    ///
    /// Returns a coordinate or allocation overflow error when the requested
    /// chunk cannot be represented.
    ///
    /// # Panics
    ///
    /// Panics only if [`TerrainGenerator::sample`] violates its fixed-point
    /// invariants.
    pub fn generate(
        generator: TerrainGenerator,
        coord: TerrainChunkCoord,
        spec: TerrainChunkSpec,
    ) -> Result<Self, TerrainAnalysisError> {
        let span = spec.chunk_span_mm();
        let origin_x_mm = coord
            .x
            .checked_mul(span)
            .ok_or(TerrainAnalysisError::CoordinateOverflow)?;
        let origin_z_mm = coord
            .z
            .checked_mul(span)
            .ok_or(TerrainAnalysisError::CoordinateOverflow)?;
        let edge = usize::try_from(spec.edge_samples())
            .map_err(|_| TerrainAnalysisError::AllocationOverflow)?;
        let count = edge
            .checked_mul(edge)
            .ok_or(TerrainAnalysisError::AllocationOverflow)?;
        let mut samples = Vec::with_capacity(count);

        for z in 0..edge {
            let z_mm = sample_coordinate(origin_z_mm, z, spec.sample_spacing_mm())?;
            for x in 0..edge {
                let x_mm = sample_coordinate(origin_x_mm, x, spec.sample_spacing_mm())?;
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
        self.samples
            .get(z.checked_mul(edge)?.checked_add(x)?)
            .copied()
    }
}

fn sample_coordinate(
    origin_mm: i64,
    index: usize,
    spacing_mm: u32,
) -> Result<i64, TerrainAnalysisError> {
    let index = i64::try_from(index).map_err(|_| TerrainAnalysisError::CoordinateOverflow)?;
    let offset = index
        .checked_mul(i64::from(spacing_mm))
        .ok_or(TerrainAnalysisError::CoordinateOverflow)?;
    origin_mm
        .checked_add(offset)
        .ok_or(TerrainAnalysisError::CoordinateOverflow)
}

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

impl FlowDirection {
    #[must_use]
    pub const fn unit_offset(self) -> (i8, i8) {
        match self {
            Self::North => (0, -1),
            Self::NorthEast => (1, -1),
            Self::East => (1, 0),
            Self::SouthEast => (1, 1),
            Self::South => (0, 1),
            Self::SouthWest => (-1, 1),
            Self::West => (-1, 0),
            Self::NorthWest => (-1, -1),
            Self::Sink => (0, 0),
        }
    }
}

impl TerrainGenerator {
    /// # Panics
    ///
    /// Panics only if [`TerrainGenerator::sample`] violates its fixed-point
    /// invariants.
    #[must_use]
    pub fn flow_direction(self, x_mm: i64, z_mm: i64, spacing_mm: NonZeroU32) -> FlowDirection {
        let center = self.sample(x_mm, z_mm).height_mm();
        let spacing = i64::from(spacing_mm.get());
        let directions = [
            FlowDirection::North,
            FlowDirection::NorthEast,
            FlowDirection::East,
            FlowDirection::SouthEast,
            FlowDirection::South,
            FlowDirection::SouthWest,
            FlowDirection::West,
            FlowDirection::NorthWest,
        ];
        let mut best = FlowDirection::Sink;
        let mut best_height = center;

        for direction in directions {
            let (dx, dz) = direction.unit_offset();
            let neighbour = self
                .sample(
                    x_mm.saturating_add(i64::from(dx) * spacing),
                    z_mm.saturating_add(i64::from(dz) * spacing),
                )
                .height_mm();
            if neighbour < best_height {
                best_height = neighbour;
                best = direction;
            }
        }
        best
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TerrainQualityReport {
    sample_count: u64,
    submerged_count: u64,
    minimum_height_mm: i32,
    maximum_height_mm: i32,
    class_counts: [u64; 8],
}

impl TerrainQualityReport {
    /// # Errors
    ///
    /// Returns an invalid-grid or coordinate-overflow error.
    ///
    /// # Panics
    ///
    /// Panics only if [`TerrainGenerator::sample`] violates its fixed-point
    /// invariants.
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

        for z in 0..edge_samples {
            let z_mm = grid_coordinate(origin_z_mm, z, spacing_mm)?;
            for x in 0..edge_samples {
                let x_mm = grid_coordinate(origin_x_mm, x, spacing_mm)?;
                report.observe(generator.sample(x_mm, z_mm));
            }
        }
        Ok(report)
    }

    fn observe(&mut self, sample: TerrainSample) {
        self.sample_count += 1;
        self.submerged_count += u64::from(sample.is_submerged());
        self.minimum_height_mm = self.minimum_height_mm.min(sample.height_mm());
        self.maximum_height_mm = self.maximum_height_mm.max(sample.height_mm());
        self.class_counts[class_index(sample.class())] += 1;
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

fn grid_coordinate(
    origin_mm: i64,
    index: u32,
    spacing_mm: NonZeroU32,
) -> Result<i64, TerrainAnalysisError> {
    let offset = i64::from(index)
        .checked_mul(i64::from(spacing_mm.get()))
        .ok_or(TerrainAnalysisError::CoordinateOverflow)?;
    origin_mm
        .checked_add(offset)
        .ok_or(TerrainAnalysisError::CoordinateOverflow)
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
            assert_eq!(left.sample_at(spec.edge_cells(), z), right.sample_at(0, z));
        }
    }

    #[test]
    fn chunk_origin_supports_negative_coordinates() {
        let generator = TerrainGenerator::new(7, TerrainConfig::default());
        let spec = TerrainChunkSpec::new(4, 250).expect("valid chunk spec");
        let chunk = TerrainChunk::generate(generator, TerrainChunkCoord::new(-2, 3), spec)
            .expect("chunk should generate");
        assert_eq!(chunk.origin_x_mm(), -2_000);
        assert_eq!(chunk.origin_z_mm(), 3_000);
    }

    #[test]
    fn selected_flow_is_strictly_downhill() {
        let generator = TerrainGenerator::new(99, TerrainConfig::default());
        let spacing = NonZeroU32::new(1_000).expect("non-zero spacing");
        let x_mm = 123_000;
        let z_mm = -456_000;
        let direction = generator.flow_direction(x_mm, z_mm, spacing);
        let (dx, dz) = direction.unit_offset();
        let center = generator.sample(x_mm, z_mm).height_mm();
        let target = generator
            .sample(
                x_mm + i64::from(dx) * i64::from(spacing.get()),
                z_mm + i64::from(dz) * i64::from(spacing.get()),
            )
            .height_mm();
        assert!(direction == FlowDirection::Sink || target < center);
    }

    #[test]
    fn quality_report_is_deterministic_and_non_flat() {
        let generator = TerrainGenerator::new(11, TerrainConfig::default());
        let spacing = NonZeroU32::new(250_000).expect("non-zero spacing");
        let left =
            TerrainQualityReport::sample_grid(generator, -2_000_000, -2_000_000, 17, spacing)
                .expect("quality report should generate");
        let right =
            TerrainQualityReport::sample_grid(generator, -2_000_000, -2_000_000, 17, spacing)
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
