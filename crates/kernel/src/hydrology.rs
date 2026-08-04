use std::fmt;

use crate::{FlowDirection, TerrainChunk, TerrainSample};

/// Minimum upstream sample count used by the default river-candidate query.
pub const DEFAULT_RIVER_ACCUMULATION_THRESHOLD: u64 = 32;

/// Classification of a terminal drainage location inside the analysed chunk.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DrainageTerminal {
    /// Flow leaves the sampled chunk through its shared border.
    BoundaryOutlet,
    /// Flow terminates at a local minimum or flat cell.
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
    /// Builds a chunk-local hydrology field from materialized terrain samples.
    ///
    /// Every sample contributes one unit of runoff. Flow is routed to the
    /// strictly lowest D8 neighbour. Border samples that drain outward are
    /// treated as boundary outlets. Flats and local minima remain sinks; sink
    /// filling and cross-chunk basin reconciliation are intentionally deferred
    /// to the next hydrology refinement.
    ///
    /// # Errors
    ///
    /// Returns [`HydrologyError::InvalidChunkLayout`] when the chunk sample
    /// count does not match its declared square dimensions,
    /// [`HydrologyError::AccumulationOverflow`] if runoff accumulation exceeds
    /// `u64`, or [`HydrologyError::BasinOverflow`] if more than `u32::MAX`
    /// drainage basins are encountered.
    pub fn analyse(chunk: &TerrainChunk) -> Result<Self, HydrologyError> {
        let edge = usize::try_from(chunk.spec().edge_samples())
            .map_err(|_| HydrologyError::InvalidChunkLayout)?;
        let expected = edge
            .checked_mul(edge)
            .ok_or(HydrologyError::InvalidChunkLayout)?;
        if chunk.samples().len() != expected {
            return Err(HydrologyError::InvalidChunkLayout);
        }

        let mut downstream = vec![None; expected];
        let mut directions = vec![FlowDirection::Sink; expected];
        for index in 0..expected {
            let (direction, target) = select_downstream(chunk.samples(), edge, index);
            directions[index] = direction;
            downstream[index] = target;
        }

        let mut order: Vec<usize> = (0..expected).collect();
        order.sort_unstable_by(|left, right| {
            chunk.samples()[*right]
                .height_mm()
                .cmp(&chunk.samples()[*left].height_mm())
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
                match downstream[current] {
                    Some(next) => current = next,
                    None => {
                        let terminal = terminal_for(edge, current, directions[current]);
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

fn select_downstream(
    samples: &[TerrainSample],
    edge: usize,
    index: usize,
) -> (FlowDirection, Option<usize>) {
    let x = index % edge;
    let z = index / edge;
    let center_height = samples[index].height_mm();
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
    let mut best_direction = FlowDirection::Sink;
    let mut best_target = None;
    let mut best_height = center_height;

    for direction in directions {
        let (offset_x, offset_z) = direction.unit_offset();
        let Some(neighbour_x) = x.checked_add_signed(isize::from(offset_x)) else {
            continue;
        };
        let Some(neighbour_z) = z.checked_add_signed(isize::from(offset_z)) else {
            continue;
        };
        if neighbour_x >= edge || neighbour_z >= edge {
            continue;
        }
        let target = neighbour_z * edge + neighbour_x;
        let height = samples[target].height_mm();
        if height < best_height {
            best_height = height;
            best_direction = direction;
            best_target = Some(target);
        }
    }
    (best_direction, best_target)
}

fn terminal_for(edge: usize, index: usize, direction: FlowDirection) -> DrainageTerminal {
    let x = index % edge;
    let z = index / edge;
    if direction == FlowDirection::Sink && (x == 0 || z == 0 || x + 1 == edge || z + 1 == edge) {
        DrainageTerminal::BoundaryOutlet
    } else {
        DrainageTerminal::Sink
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HydrologyError {
    InvalidChunkLayout,
    AccumulationOverflow,
    BasinOverflow,
}

impl fmt::Display for HydrologyError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidChunkLayout => "terrain chunk samples do not match the declared layout",
            Self::AccumulationOverflow => "hydrology accumulation overflowed u64",
            Self::BasinOverflow => "hydrology basin count overflowed u32",
        })
    }
}

impl std::error::Error for HydrologyError {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{TerrainChunkCoord, TerrainChunkSpec, TerrainConfig, TerrainGenerator};

    fn analysed_field() -> HydrologyField {
        let generator = TerrainGenerator::new(42, TerrainConfig::default());
        let spec = TerrainChunkSpec::new(16, 4_000).expect("valid chunk spec");
        let chunk = TerrainChunk::generate(generator, TerrainChunkCoord::new(-1, 2), spec)
            .expect("chunk should generate");
        HydrologyField::analyse(&chunk).expect("hydrology should analyse")
    }

    #[test]
    fn hydrology_is_deterministic() {
        assert_eq!(analysed_field(), analysed_field());
    }

    #[test]
    fn every_sample_belongs_to_one_basin() {
        let field = analysed_field();
        assert_eq!(field.nodes().len(), 17 * 17);
        assert!(field.basin_count() > 0);
        assert!(field
            .nodes()
            .iter()
            .all(|node| node.basin_id() < field.basin_count()));
    }

    #[test]
    fn accumulation_conserves_local_runoff() {
        let field = analysed_field();
        assert!(field.nodes().iter().all(|node| node.accumulation() >= 1));
        assert!(field
            .nodes()
            .iter()
            .any(|node| node.accumulation() > 1));
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
    fn node_lookup_is_bounded() {
        let field = analysed_field();
        assert!(field.node_at(0, 0).is_some());
        assert!(field.node_at(field.edge_samples(), 0).is_none());
    }
}
