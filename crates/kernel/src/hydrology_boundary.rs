use std::fmt;

use crate::{
    DepressionFill, DrainageTerminal, HydrologyField, TerrainChunk, TerrainChunkCoord,
    TerrainChunkSpec,
};

/// Cardinal side shared by two adjacent terrain chunks.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum ChunkBoundarySide {
    North,
    East,
    South,
    West,
}

impl ChunkBoundarySide {
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

/// One deterministic transfer from a boundary outlet into an adjacent chunk.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct CrossChunkFlowLink {
    source_chunk: TerrainChunkCoord,
    source_side: ChunkBoundarySide,
    source_boundary_offset: u32,
    source_sample_index: usize,
    destination_chunk: TerrainChunkCoord,
    destination_sample_index: usize,
    transferred_accumulation: u64,
}

impl CrossChunkFlowLink {
    #[must_use]
    pub const fn source_chunk(self) -> TerrainChunkCoord {
        self.source_chunk
    }

    #[must_use]
    pub const fn source_side(self) -> ChunkBoundarySide {
        self.source_side
    }

    #[must_use]
    pub const fn source_boundary_offset(self) -> u32 {
        self.source_boundary_offset
    }

    #[must_use]
    pub const fn source_sample_index(self) -> usize {
        self.source_sample_index
    }

    #[must_use]
    pub const fn destination_chunk(self) -> TerrainChunkCoord {
        self.destination_chunk
    }

    #[must_use]
    pub const fn destination_sample_index(self) -> usize {
        self.destination_sample_index
    }

    #[must_use]
    pub const fn transferred_accumulation(self) -> u64 {
        self.transferred_accumulation
    }
}

/// Validated shared boundary and its cross-chunk flow transfers.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CrossChunkBoundary {
    first_chunk: TerrainChunkCoord,
    second_chunk: TerrainChunkCoord,
    first_side: ChunkBoundarySide,
    links: Vec<CrossChunkFlowLink>,
}

impl CrossChunkBoundary {
    /// Analyses a cardinally adjacent pair of chunks.
    ///
    /// Shared boundary samples must have identical original and hydrology-only
    /// filled elevations. A boundary outlet transfers into the adjacent
    /// chunk only when the first interior sample across the boundary is lower
    /// than the shared filled elevation. The same rule is evaluated in both
    /// directions, and links are sorted by their complete deterministic key.
    ///
    /// # Errors
    ///
    /// Returns an error when chunks are not cardinal neighbours, use different
    /// sampling specifications, contain incompatible analysis dimensions, or
    /// disagree on shared boundary elevations.
    pub fn analyse(
        first_chunk: &TerrainChunk,
        first_fill: &DepressionFill,
        first_hydrology: &HydrologyField,
        second_chunk: &TerrainChunk,
        second_fill: &DepressionFill,
        second_hydrology: &HydrologyField,
    ) -> Result<Self, CrossChunkError> {
        let spec = validate_layout(first_chunk, first_fill, first_hydrology)?;
        validate_layout(second_chunk, second_fill, second_hydrology)?;
        if second_chunk.spec() != spec {
            return Err(CrossChunkError::MismatchedSpecification);
        }

        let first_side = adjacency(first_chunk.coord(), second_chunk.coord())
            .ok_or(CrossChunkError::NotCardinalNeighbours)?;
        let edge = usize::try_from(spec.edge_samples())
            .map_err(|_| CrossChunkError::InvalidAnalysisLayout)?;
        let mut links = Vec::new();

        for offset in 0..edge {
            let first_boundary = boundary_index(edge, first_side, offset);
            let second_side = first_side.opposite();
            let second_boundary = boundary_index(edge, second_side, offset);
            if first_chunk.samples()[first_boundary].height_mm()
                != second_chunk.samples()[second_boundary].height_mm()
                || first_fill.filled_heights_mm()[first_boundary]
                    != second_fill.filled_heights_mm()[second_boundary]
            {
                return Err(CrossChunkError::SharedBoundaryMismatch);
            }

            append_link(
                &mut links,
                first_chunk,
                first_fill,
                first_hydrology,
                first_side,
                first_boundary,
                offset,
                second_chunk,
                second_fill,
                second_side,
                second_boundary,
                edge,
            )?;
            append_link(
                &mut links,
                second_chunk,
                second_fill,
                second_hydrology,
                second_side,
                second_boundary,
                offset,
                first_chunk,
                first_fill,
                first_side,
                first_boundary,
                edge,
            )?;
        }

        links.sort_unstable();
        Ok(Self {
            first_chunk: first_chunk.coord(),
            second_chunk: second_chunk.coord(),
            first_side,
            links,
        })
    }

    #[must_use]
    pub const fn first_chunk(&self) -> TerrainChunkCoord {
        self.first_chunk
    }

    #[must_use]
    pub const fn second_chunk(&self) -> TerrainChunkCoord {
        self.second_chunk
    }

    #[must_use]
    pub const fn first_side(&self) -> ChunkBoundarySide {
        self.first_side
    }

    #[must_use]
    pub fn links(&self) -> &[CrossChunkFlowLink] {
        &self.links
    }
}

#[allow(clippy::too_many_arguments)]
fn append_link(
    links: &mut Vec<CrossChunkFlowLink>,
    source_chunk: &TerrainChunk,
    source_fill: &DepressionFill,
    source_hydrology: &HydrologyField,
    source_side: ChunkBoundarySide,
    source_boundary: usize,
    offset: usize,
    destination_chunk: &TerrainChunk,
    destination_fill: &DepressionFill,
    destination_side: ChunkBoundarySide,
    destination_boundary: usize,
    edge: usize,
) -> Result<(), CrossChunkError> {
    let source_node = source_hydrology.nodes()[source_boundary];
    if source_node.terminal() != DrainageTerminal::BoundaryOutlet {
        return Ok(());
    }
    let destination_interior = interior_index(edge, destination_side, offset)
        .ok_or(CrossChunkError::InvalidAnalysisLayout)?;
    if destination_fill.filled_heights_mm()[destination_interior]
        >= source_fill.filled_heights_mm()[source_boundary]
    {
        return Ok(());
    }
    let source_boundary_offset =
        u32::try_from(offset).map_err(|_| CrossChunkError::InvalidAnalysisLayout)?;
    links.push(CrossChunkFlowLink {
        source_chunk: source_chunk.coord(),
        source_side,
        source_boundary_offset,
        source_sample_index: source_boundary,
        destination_chunk: destination_chunk.coord(),
        destination_sample_index: destination_interior,
        transferred_accumulation: source_node.accumulation(),
    });
    let _ = destination_boundary;
    Ok(())
}

fn validate_layout(
    chunk: &TerrainChunk,
    fill: &DepressionFill,
    hydrology: &HydrologyField,
) -> Result<TerrainChunkSpec, CrossChunkError> {
    let edge = usize::try_from(chunk.spec().edge_samples())
        .map_err(|_| CrossChunkError::InvalidAnalysisLayout)?;
    let count = edge
        .checked_mul(edge)
        .ok_or(CrossChunkError::InvalidAnalysisLayout)?;
    if chunk.samples().len() != count
        || fill.filled_heights_mm().len() != count
        || hydrology.nodes().len() != count
        || fill.edge_samples() != chunk.spec().edge_samples()
        || hydrology.edge_samples() != chunk.spec().edge_samples()
    {
        return Err(CrossChunkError::InvalidAnalysisLayout);
    }
    Ok(chunk.spec())
}

fn adjacency(first: TerrainChunkCoord, second: TerrainChunkCoord) -> Option<ChunkBoundarySide> {
    let delta_x = second.x().checked_sub(first.x())?;
    let delta_z = second.z().checked_sub(first.z())?;
    match (delta_x, delta_z) {
        (0, -1) => Some(ChunkBoundarySide::North),
        (1, 0) => Some(ChunkBoundarySide::East),
        (0, 1) => Some(ChunkBoundarySide::South),
        (-1, 0) => Some(ChunkBoundarySide::West),
        _ => None,
    }
}

fn boundary_index(edge: usize, side: ChunkBoundarySide, offset: usize) -> usize {
    match side {
        ChunkBoundarySide::North => offset,
        ChunkBoundarySide::East => offset * edge + edge - 1,
        ChunkBoundarySide::South => (edge - 1) * edge + offset,
        ChunkBoundarySide::West => offset * edge,
    }
}

fn interior_index(edge: usize, side: ChunkBoundarySide, offset: usize) -> Option<usize> {
    if edge < 3 || offset >= edge {
        return None;
    }
    Some(match side {
        ChunkBoundarySide::North => edge + offset,
        ChunkBoundarySide::East => offset * edge + edge - 2,
        ChunkBoundarySide::South => (edge - 2) * edge + offset,
        ChunkBoundarySide::West => offset * edge + 1,
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CrossChunkError {
    NotCardinalNeighbours,
    MismatchedSpecification,
    InvalidAnalysisLayout,
    SharedBoundaryMismatch,
}

impl fmt::Display for CrossChunkError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::NotCardinalNeighbours => "terrain chunks are not cardinal neighbours",
            Self::MismatchedSpecification => "terrain chunks use different sampling specifications",
            Self::InvalidAnalysisLayout => "terrain and hydrology analysis layouts are incompatible",
            Self::SharedBoundaryMismatch => "adjacent chunks disagree on their shared boundary",
        })
    }
}

impl std::error::Error for CrossChunkError {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{TerrainConfig, TerrainGenerator};

    fn analysed_chunk(
        generator: TerrainGenerator,
        coord: TerrainChunkCoord,
        spec: TerrainChunkSpec,
    ) -> (TerrainChunk, DepressionFill, HydrologyField) {
        let chunk = TerrainChunk::generate(generator, coord, spec).expect("chunk should generate");
        let fill = DepressionFill::analyse(&chunk).expect("fill should analyse");
        let hydrology = HydrologyField::analyse_with_fill(&chunk, &fill)
            .expect("hydrology should analyse");
        (chunk, fill, hydrology)
    }

    #[test]
    fn east_west_shared_boundary_is_validated() {
        let generator = TerrainGenerator::new(42, TerrainConfig::default());
        let spec = TerrainChunkSpec::new(16, 4_000).expect("valid spec");
        let left = analysed_chunk(generator, TerrainChunkCoord::new(0, 0), spec);
        let right = analysed_chunk(generator, TerrainChunkCoord::new(1, 0), spec);
        let boundary = CrossChunkBoundary::analyse(
            &left.0, &left.1, &left.2, &right.0, &right.1, &right.2,
        )
        .expect("boundary should analyse");
        assert_eq!(boundary.first_side(), ChunkBoundarySide::East);
        assert!(boundary.links().iter().all(|link| {
            link.source_chunk() == left.0.coord() || link.source_chunk() == right.0.coord()
        }));
    }

    #[test]
    fn reversing_pair_preserves_normalized_links() {
        let generator = TerrainGenerator::new(7, TerrainConfig::default());
        let spec = TerrainChunkSpec::new(16, 4_000).expect("valid spec");
        let north = analysed_chunk(generator, TerrainChunkCoord::new(-1, 2), spec);
        let south = analysed_chunk(generator, TerrainChunkCoord::new(-1, 3), spec);
        let forward = CrossChunkBoundary::analyse(
            &north.0, &north.1, &north.2, &south.0, &south.1, &south.2,
        )
        .expect("forward boundary should analyse");
        let reverse = CrossChunkBoundary::analyse(
            &south.0, &south.1, &south.2, &north.0, &north.1, &north.2,
        )
        .expect("reverse boundary should analyse");
        assert_eq!(forward.links(), reverse.links());
    }

    #[test]
    fn diagonal_chunks_are_rejected() {
        let generator = TerrainGenerator::new(42, TerrainConfig::default());
        let spec = TerrainChunkSpec::new(8, 4_000).expect("valid spec");
        let first = analysed_chunk(generator, TerrainChunkCoord::new(0, 0), spec);
        let second = analysed_chunk(generator, TerrainChunkCoord::new(1, 1), spec);
        assert_eq!(
            CrossChunkBoundary::analyse(
                &first.0, &first.1, &first.2, &second.0, &second.1, &second.2,
            ),
            Err(CrossChunkError::NotCardinalNeighbours)
        );
    }
}
