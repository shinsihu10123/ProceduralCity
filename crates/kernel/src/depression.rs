use std::{cmp::Reverse, collections::BinaryHeap, fmt};

use crate::TerrainChunk;

/// Priority-Flood result for one terrain chunk.
///
/// Original terrain samples remain unchanged. This structure stores a
/// hydrology-only filled elevation surface and the amount each sample was
/// raised to obtain drainage toward the chunk boundary.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DepressionFill {
    edge_samples: u32,
    filled_heights_mm: Vec<i32>,
    fill_depths_mm: Vec<u32>,
    raised_sample_count: u32,
    maximum_fill_depth_mm: u32,
}

impl DepressionFill {
    /// Builds a deterministic Priority-Flood surface from a materialized chunk.
    ///
    /// All boundary samples seed the priority queue. Interior samples are
    /// visited from the lowest available spill elevation. A neighbour below
    /// the current spill elevation is raised to that elevation; otherwise its
    /// original elevation is retained. Queue ties are resolved by row-major
    /// sample index.
    ///
    /// # Errors
    ///
    /// Returns [`DepressionError::InvalidChunkLayout`] when the sample count
    /// does not match the declared square dimensions,
    /// [`DepressionError::FillDepthOverflow`] when a fill depth cannot fit in
    /// `u32`, or [`DepressionError::RaisedCountOverflow`] when the number of
    /// raised samples cannot fit in `u32`.
    pub fn analyse(chunk: &TerrainChunk) -> Result<Self, DepressionError> {
        let edge = usize::try_from(chunk.spec().edge_samples())
            .map_err(|_| DepressionError::InvalidChunkLayout)?;
        let sample_count = edge
            .checked_mul(edge)
            .ok_or(DepressionError::InvalidChunkLayout)?;
        if edge < 2 || chunk.samples().len() != sample_count {
            return Err(DepressionError::InvalidChunkLayout);
        }

        let original: Vec<i32> = chunk
            .samples()
            .iter()
            .map(|sample| sample.height_mm())
            .collect();
        let mut filled = original.clone();
        let mut visited = vec![false; sample_count];
        let mut queue = BinaryHeap::new();

        for index in boundary_indices(edge) {
            if visited[index] {
                continue;
            }
            visited[index] = true;
            queue.push(Reverse((filled[index], index)));
        }

        while let Some(Reverse((spill_height, index))) = queue.pop() {
            for neighbour in neighbours(edge, index) {
                if visited[neighbour] {
                    continue;
                }
                visited[neighbour] = true;
                let hydrology_height = original[neighbour].max(spill_height);
                filled[neighbour] = hydrology_height;
                queue.push(Reverse((hydrology_height, neighbour)));
            }
        }

        let mut fill_depths = Vec::with_capacity(sample_count);
        let mut raised_sample_count = 0_u32;
        let mut maximum_fill_depth_mm = 0_u32;
        for (original_height, filled_height) in original.into_iter().zip(filled.iter().copied()) {
            let depth = filled_height
                .checked_sub(original_height)
                .ok_or(DepressionError::FillDepthOverflow)?;
            let depth = u32::try_from(depth).map_err(|_| DepressionError::FillDepthOverflow)?;
            if depth > 0 {
                raised_sample_count = raised_sample_count
                    .checked_add(1)
                    .ok_or(DepressionError::RaisedCountOverflow)?;
                maximum_fill_depth_mm = maximum_fill_depth_mm.max(depth);
            }
            fill_depths.push(depth);
        }

        Ok(Self {
            edge_samples: chunk.spec().edge_samples(),
            filled_heights_mm: filled,
            fill_depths_mm: fill_depths,
            raised_sample_count,
            maximum_fill_depth_mm,
        })
    }

    #[must_use]
    pub const fn edge_samples(&self) -> u32 {
        self.edge_samples
    }

    #[must_use]
    pub fn filled_heights_mm(&self) -> &[i32] {
        &self.filled_heights_mm
    }

    #[must_use]
    pub fn fill_depths_mm(&self) -> &[u32] {
        &self.fill_depths_mm
    }

    #[must_use]
    pub const fn raised_sample_count(&self) -> u32 {
        self.raised_sample_count
    }

    #[must_use]
    pub const fn maximum_fill_depth_mm(&self) -> u32 {
        self.maximum_fill_depth_mm
    }

    #[must_use]
    pub fn filled_height_at(&self, x_index: u32, z_index: u32) -> Option<i32> {
        self.index_of(x_index, z_index)
            .and_then(|index| self.filled_heights_mm.get(index).copied())
    }

    #[must_use]
    pub fn fill_depth_at(&self, x_index: u32, z_index: u32) -> Option<u32> {
        self.index_of(x_index, z_index)
            .and_then(|index| self.fill_depths_mm.get(index).copied())
    }

    fn index_of(&self, x_index: u32, z_index: u32) -> Option<usize> {
        if x_index >= self.edge_samples || z_index >= self.edge_samples {
            return None;
        }
        let edge = usize::try_from(self.edge_samples).ok()?;
        usize::try_from(z_index)
            .ok()?
            .checked_mul(edge)?
            .checked_add(usize::try_from(x_index).ok()?)
    }
}

fn boundary_indices(edge: usize) -> Vec<usize> {
    let mut indices = Vec::with_capacity(edge.saturating_mul(4));
    for x in 0..edge {
        indices.push(x);
        indices.push((edge - 1) * edge + x);
    }
    for z in 1..edge - 1 {
        indices.push(z * edge);
        indices.push(z * edge + edge - 1);
    }
    indices
}

fn neighbours(edge: usize, index: usize) -> impl Iterator<Item = usize> {
    let x = index % edge;
    let z = index / edge;
    let mut result = [None; 8];
    let mut count = 0;
    for offset_z in -1_isize..=1 {
        for offset_x in -1_isize..=1 {
            if offset_x == 0 && offset_z == 0 {
                continue;
            }
            let Some(neighbour_x) = x.checked_add_signed(offset_x) else {
                continue;
            };
            let Some(neighbour_z) = z.checked_add_signed(offset_z) else {
                continue;
            };
            if neighbour_x >= edge || neighbour_z >= edge {
                continue;
            }
            result[count] = Some(neighbour_z * edge + neighbour_x);
            count += 1;
        }
    }
    result.into_iter().flatten()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DepressionError {
    InvalidChunkLayout,
    FillDepthOverflow,
    RaisedCountOverflow,
}

impl fmt::Display for DepressionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidChunkLayout => "terrain chunk samples do not match the declared layout",
            Self::FillDepthOverflow => "depression fill depth overflowed u32",
            Self::RaisedCountOverflow => "depression raised-sample count overflowed u32",
        })
    }
}

impl std::error::Error for DepressionError {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{TerrainChunkCoord, TerrainChunkSpec, TerrainConfig, TerrainGenerator};

    fn filled_surface() -> DepressionFill {
        let generator = TerrainGenerator::new(42, TerrainConfig::default());
        let spec = TerrainChunkSpec::new(32, 2_000).expect("valid chunk spec");
        let chunk = TerrainChunk::generate(generator, TerrainChunkCoord::new(-2, 1), spec)
            .expect("chunk should generate");
        DepressionFill::analyse(&chunk).expect("priority flood should complete")
    }

    #[test]
    fn priority_flood_is_deterministic() {
        assert_eq!(filled_surface(), filled_surface());
    }

    #[test]
    fn filled_surface_never_lowers_original_terrain() {
        let generator = TerrainGenerator::new(42, TerrainConfig::default());
        let spec = TerrainChunkSpec::new(16, 4_000).expect("valid chunk spec");
        let chunk = TerrainChunk::generate(generator, TerrainChunkCoord::new(0, 0), spec)
            .expect("chunk should generate");
        let fill = DepressionFill::analyse(&chunk).expect("priority flood should complete");
        assert!(chunk
            .samples()
            .iter()
            .zip(fill.filled_heights_mm())
            .all(|(sample, filled)| *filled >= sample.height_mm()));
    }

    #[test]
    fn depth_lookup_matches_summary_bounds() {
        let fill = filled_surface();
        assert!(fill
            .fill_depths_mm()
            .iter()
            .all(|depth| *depth <= fill.maximum_fill_depth_mm()));
        assert_eq!(
            fill.raised_sample_count() as usize,
            fill.fill_depths_mm().iter().filter(|depth| **depth > 0).count()
        );
    }

    #[test]
    fn lookup_rejects_out_of_bounds_indices() {
        let fill = filled_surface();
        assert!(fill.filled_height_at(0, 0).is_some());
        assert!(fill.filled_height_at(fill.edge_samples(), 0).is_none());
    }
}
