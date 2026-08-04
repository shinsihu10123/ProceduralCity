use std::{collections::VecDeque, fmt};

use crate::{DepressionFill, FlowDirection, TerrainChunk};

/// Minimum upstream sample count used by the default river-candidate query.
pub const DEFAULT_RIVER_ACCUMULATION_THRESHOLD: u64 = 32;

/// Classification of a terminal drainage location inside the analysed chunk.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DrainageTerminal {
    /// Flow leaves the sampled chunk through its shared border.
    BoundaryOutlet,
    /// Flow terminates at an unresolved local minimum.
    Sink,
}

/// One hydrological node for a sampled terrain vertex.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct HydrologyNode {
    flow_direction: FlowDirection,
    accumulation: u64,
    basin_id: u32,
    terminal: DrainageTerminal,
}

impl HydrologyNode {
    #[must_use]
    pub const fn flow_direction(self) -> FlowDirection {
        self.flow_direction
    }

    #[must_use]
    pub const fn accumulation(self) -> u64 {
        self.accumulation
    }

    #[must_use]
    pub const fn basin_id(self) -> u32 {
        self.basin_id
    }

    #[must_use]
    pub const fn terminal(self) -> DrainageTerminal {
        self.terminal
    }
}

/// Deterministic D8 flow field and derived drainage information for one chunk.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HydrologyField {
    edge_samples: u32,
    nodes: Vec<HydrologyNode>,
    basin_count: u32,
    sink_count: u32,
}

impl HydrologyField {
    /// Builds a chunk-local hydrology field from the original terrain heights.
    ///
    /// This compatibility path does not remove depressions. Prefer
    /// [`Self::analyse_with_fill`] when a [`DepressionFill`] is available.
    ///
    /// # Errors
    ///
    /// Returns a [`HydrologyError`] when the chunk layout is invalid or a
    /// derived counter overflows.
    ///
    /// # Panics
    ///
    /// Panics only if the internal basin-assignment invariant is violated.
    pub fn analyse(chunk: &TerrainChunk) -> Result<Self, HydrologyError> {
        let heights: Vec<i32> = chunk
            .samples()
            .iter()
            .map(|sample| sample.height_mm())
            .collect();
        Self::analyse_heights(chunk, &heights)
    }

    /// Builds hydrology from a Priority-Flood corrected elevation surface.
    ///
    /// Strictly lower neighbours are preferred. Equal-height flat cells route
    /// toward a deterministic distance field seeded by boundary outlets and
    /// cells adjacent to lower terrain. This makes flat routing acyclic without
    /// modifying the original terrain samples.
    ///
    /// # Errors
    ///
    /// Returns [`HydrologyError::FillLayoutMismatch`] when the fill and chunk
    /// dimensions differ, or another [`HydrologyError`] when a derived counter
    /// overflows.
    ///
    /// # Panics
    ///
    /// Panics only if the internal basin-assignment invariant is violated.
    pub fn analyse_with_fill(
        chunk: &TerrainChunk,
        fill: &DepressionFill,
    ) -> Result<Self, HydrologyError> {
        if fill.edge_samples() != chunk.spec().edge_samples() {
            return Err(HydrologyError::FillLayoutMismatch);
        }
        Self::analyse_heights(chunk, fill.filled_heights_mm())
    }

    fn analyse_heights(chunk: &TerrainChunk, heights: &[i32]) -> Result<Self, HydrologyError> {
        let edge = usize::try_from(chunk.spec().edge_samples())
            .map_err(|_| HydrologyError::InvalidChunkLayout)?;
        let expected = edge
            .checked_mul(edge)
            .ok_or(HydrologyError::InvalidChunkLayout)?;
        if chunk.samples().len() != expected || heights.len() != expected {
            return Err(HydrologyError::InvalidChunkLayout);
        }

        let flat_distance = flat_distances(heights, edge)?;
        let mut downstream = vec![None; expected];
        let mut directions = vec![FlowDirection::Sink; expected];
        for index in 0..expected {
            let (direction, target) = select_downstream(heights, &flat_distance, edge, index);
            directions[index] = direction;
            downstream[index] = target;
        }

        let mut order: Vec<usize> = (0..expected).collect();
        order.sort_unstable_by(|left, right| {
            heights[*right]
                .cmp(&heights[*left])
                .then_with(|| flat_distance[*right].cmp(&flat_distance[*left]))
                .then_with(|| left.cmp(right))
        });

        let mut accumulation = vec![1_u64; expected];
        for index in order {
            if let Some(target) = downstream[index] {
                accumulation[target] = accumulation[target]
                    .checked_add(accumulation[index])
                    .ok_or(HydrologyError::AccumulationOverflow)?;
            }
        }

        let mut basin_ids = vec![None; expected];
        let mut terminals = vec![DrainageTerminal::Sink; expected];
        let mut basin_count = 0_u32;
        let mut sink_count = 0_u32;

        for start in 0..expected {
            if basin_ids[start].is_some() {
                continue;
            }
            let mut path = Vec::new();
            let mut current = start;
            loop {
                if let Some(existing) = basin_ids[current] {
                    let terminal = terminals[current];
                    for node in path {
                        basin_ids[node] = Some(existing);
                        terminals[node] = terminal;
                    }
                    break;
                }

                path.push(current);
                if let Some(next) = downstream[current] {
                    current = next;
                } else {
                    let terminal = terminal_for(edge, current);
                    basin_count = basin_count
                        .checked_add(1)
                        .ok_or(HydrologyError::BasinOverflow)?;
                    if terminal == DrainageTerminal::Sink {
                        sink_count = sink_count
                            .checked_add(1)
                            .ok_or(HydrologyError::BasinOverflow)?;
                    }
                    let basin_id = basin_count - 1;
                    for node in path {
                        basin_ids[node] = Some(basin_id);
                        terminals[node] = terminal;
                    }
                    break;
                }
            }
        }

        let nodes = (0..expected)
            .map(|index| HydrologyNode {
                flow_direction: directions[index],
                accumulation: accumulation[index],
                basin_id: basin_ids[index].expect("every drainage path receives a basin id"),
                terminal: terminals[index],
            })
            .collect();

        Ok(Self {
            edge_samples: chunk.spec().edge_samples(),
            nodes,
            basin_count,
            sink_count,
        })
    }

    #[must_use]
    pub const fn edge_samples(&self) -> u32 {
        self.edge_samples
    }

    #[must_use]
    pub const fn basin_count(&self) -> u32 {
        self.basin_count
    }

    #[must_use]
    pub const fn sink_count(&self) -> u32 {
        self.sink_count
    }

    #[must_use]
    pub fn nodes(&self) -> &[HydrologyNode] {
        &self.nodes
    }

    #[must_use]
    pub fn node_at(&self, x_index: u32, z_index: u32) -> Option<HydrologyNode> {
        if x_index >= self.edge_samples || z_index >= self.edge_samples {
            return None;
        }
        let edge = usize::try_from(self.edge_samples).ok()?;
        let index = usize::try_from(z_index)
            .ok()?
            .checked_mul(edge)?
            .checked_add(usize::try_from(x_index).ok()?)?;
        self.nodes.get(index).copied()
    }

    /// Returns row-major sample indices whose accumulated runoff meets the
    /// supplied threshold.
    #[must_use]
    pub fn river_candidates(&self, minimum_accumulation: u64) -> Vec<usize> {
        self.nodes
            .iter()
            .enumerate()
            .filter_map(|(index, node)| {
                (node.accumulation >= minimum_accumulation).then_some(index)
            })
            .collect()
    }
}

fn flat_distances(heights: &[i32], edge: usize) -> Result<Vec<u32>, HydrologyError> {
    let mut distances = vec![u32::MAX; heights.len()];
    let mut queue = VecDeque::new();

    for index in 0..heights.len() {
        if is_boundary(edge, index) || has_lower_neighbour(heights, edge, index) {
            distances[index] = 0;
            queue.push_back(index);
        }
    }

    while let Some(index) = queue.pop_front() {
        let next_distance = distances[index]
            .checked_add(1)
            .ok_or(HydrologyError::FlatDistanceOverflow)?;
        for (_, neighbour) in neighbours_with_directions(edge, index) {
            if heights[neighbour] == heights[index] && distances[neighbour] == u32::MAX {
                distances[neighbour] = next_distance;
                queue.push_back(neighbour);
            }
        }
    }

    Ok(distances)
}

fn has_lower_neighbour(heights: &[i32], edge: usize, index: usize) -> bool {
    neighbours_with_directions(edge, index)
        .any(|(_, neighbour)| heights[neighbour] < heights[index])
}

fn select_downstream(
    heights: &[i32],
    flat_distance: &[u32],
    edge: usize,
    index: usize,
) -> (FlowDirection, Option<usize>) {
    let center_height = heights[index];
    let center_distance = flat_distance[index];
    let mut best_lower: Option<(i32, FlowDirection, usize)> = None;
    let mut best_flat: Option<(u32, FlowDirection, usize)> = None;

    for (direction, target) in neighbours_with_directions(edge, index) {
        let target_height = heights[target];
        if target_height < center_height {
            if best_lower.is_none_or(|(best_height, _, _)| target_height < best_height) {
                best_lower = Some((target_height, direction, target));
            }
        } else if target_height == center_height && flat_distance[target] < center_distance {
            let target_distance = flat_distance[target];
            if best_flat.is_none_or(|(best_distance, _, _)| target_distance < best_distance) {
                best_flat = Some((target_distance, direction, target));
            }
        }
    }

    if let Some((_, direction, target)) = best_lower {
        (direction, Some(target))
    } else if let Some((_, direction, target)) = best_flat {
        (direction, Some(target))
    } else {
        (FlowDirection::Sink, None)
    }
}

fn neighbours_with_directions(
    edge: usize,
    index: usize,
) -> impl Iterator<Item = (FlowDirection, usize)> {
    let x = index % edge;
    let z = index / edge;
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
    directions.into_iter().filter_map(move |direction| {
        let (offset_x, offset_z) = direction.unit_offset();
        let neighbour_x = x.checked_add_signed(isize::from(offset_x))?;
        let neighbour_z = z.checked_add_signed(isize::from(offset_z))?;
        if neighbour_x >= edge || neighbour_z >= edge {
            return None;
        }
        Some((direction, neighbour_z * edge + neighbour_x))
    })
}

fn is_boundary(edge: usize, index: usize) -> bool {
    let x = index % edge;
    let z = index / edge;
    x == 0 || z == 0 || x + 1 == edge || z + 1 == edge
}

fn terminal_for(edge: usize, index: usize) -> DrainageTerminal {
    if is_boundary(edge, index) {
        DrainageTerminal::BoundaryOutlet
    } else {
        DrainageTerminal::Sink
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HydrologyError {
    InvalidChunkLayout,
    FillLayoutMismatch,
    AccumulationOverflow,
    BasinOverflow,
    FlatDistanceOverflow,
}

impl fmt::Display for HydrologyError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidChunkLayout => "terrain chunk samples do not match the declared layout",
            Self::FillLayoutMismatch => "depression fill dimensions do not match the terrain chunk",
            Self::AccumulationOverflow => "hydrology accumulation overflowed u64",
            Self::BasinOverflow => "hydrology basin count overflowed u32",
            Self::FlatDistanceOverflow => "flat drainage distance overflowed u32",
        })
    }
}

impl std::error::Error for HydrologyError {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        DepressionFill, TerrainChunkCoord, TerrainChunkSpec, TerrainConfig, TerrainGenerator,
    };

    fn generated_chunk() -> TerrainChunk {
        let generator = TerrainGenerator::new(42, TerrainConfig::default());
        let spec = TerrainChunkSpec::new(32, 2_000).expect("valid chunk spec");
        TerrainChunk::generate(generator, TerrainChunkCoord::new(-1, 2), spec)
            .expect("chunk should generate")
    }

    fn analysed_field() -> HydrologyField {
        let chunk = generated_chunk();
        let fill = DepressionFill::analyse(&chunk).expect("priority flood should complete");
        HydrologyField::analyse_with_fill(&chunk, &fill).expect("hydrology should analyse")
    }

    #[test]
    fn filled_hydrology_is_deterministic() {
        assert_eq!(analysed_field(), analysed_field());
    }

    #[test]
    fn every_sample_belongs_to_one_basin() {
        let field = analysed_field();
        assert_eq!(field.nodes().len(), 33 * 33);
        assert!(field.basin_count() > 0);
        assert!(field
            .nodes()
            .iter()
            .all(|node| node.basin_id() < field.basin_count()));
    }

    #[test]
    fn filled_surface_does_not_leave_internal_sinks() {
        assert_eq!(analysed_field().sink_count(), 0);
    }

    #[test]
    fn accumulation_conserves_local_runoff() {
        let field = analysed_field();
        assert!(field.nodes().iter().all(|node| node.accumulation() >= 1));
        assert!(field.nodes().iter().any(|node| node.accumulation() > 1));
    }

    #[test]
    fn river_candidates_respect_threshold() {
        let field = analysed_field();
        let candidates = field.river_candidates(8);
        assert!(candidates
            .iter()
            .all(|index| field.nodes()[*index].accumulation() >= 8));
    }

    #[test]
    fn legacy_analysis_remains_available() {
        let chunk = generated_chunk();
        assert!(HydrologyField::analyse(&chunk).is_ok());
    }

    #[test]
    fn node_lookup_is_bounded() {
        let field = analysed_field();
        assert!(field.node_at(0, 0).is_some());
        assert!(field.node_at(field.edge_samples(), 0).is_none());
    }
}
