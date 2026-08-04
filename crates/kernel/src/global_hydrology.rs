use std::{
    collections::{BTreeMap, BTreeSet},
    fmt,
};

use crate::{
    CrossChunkBoundary, CrossChunkError, DepressionFill, DrainageTerminal, FlowDirection,
    HydrologyField, TerrainChunk, TerrainChunkCoord, TerrainChunkSpec,
};

/// Borrowed terrain and hydrology data for one loaded chunk.
#[derive(Debug, Clone, Copy)]
pub struct GlobalHydrologyInput<'a> {
    chunk: &'a TerrainChunk,
    fill: &'a DepressionFill,
    hydrology: &'a HydrologyField,
}

impl<'a> GlobalHydrologyInput<'a> {
    #[must_use]
    pub const fn new(
        chunk: &'a TerrainChunk,
        fill: &'a DepressionFill,
        hydrology: &'a HydrologyField,
    ) -> Self {
        Self {
            chunk,
            fill,
            hydrology,
        }
    }

    #[must_use]
    pub const fn chunk(self) -> &'a TerrainChunk {
        self.chunk
    }
}

/// Stable identity of one sampled vertex in the loaded hydrology graph.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct GlobalHydrologyNodeKey {
    chunk: TerrainChunkCoord,
    sample_index: usize,
}

impl GlobalHydrologyNodeKey {
    #[must_use]
    pub const fn new(chunk: TerrainChunkCoord, sample_index: usize) -> Self {
        Self {
            chunk,
            sample_index,
        }
    }

    #[must_use]
    pub const fn chunk(self) -> TerrainChunkCoord {
        self.chunk
    }

    #[must_use]
    pub const fn sample_index(self) -> usize {
        self.sample_index
    }
}

/// Terminal classification relative to the currently loaded chunk set.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum GlobalDrainageTerminal {
    /// Flow reaches the outer boundary of the loaded chunk set.
    LoadedBoundaryOutlet,
    /// Flow terminates without a downstream node.
    Sink,
}

/// One globally reconciled hydrology node.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct GlobalHydrologyNode {
    key: GlobalHydrologyNodeKey,
    downstream: Option<GlobalHydrologyNodeKey>,
    accumulation: u64,
    basin_id: u32,
    terminal: GlobalDrainageTerminal,
}

impl GlobalHydrologyNode {
    #[must_use]
    pub const fn key(self) -> GlobalHydrologyNodeKey {
        self.key
    }

    #[must_use]
    pub const fn downstream(self) -> Option<GlobalHydrologyNodeKey> {
        self.downstream
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
    pub const fn terminal(self) -> GlobalDrainageTerminal {
        self.terminal
    }
}

/// Reconciled drainage graph for a finite set of loaded terrain chunks.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GlobalHydrologyField {
    spec: TerrainChunkSpec,
    nodes: Vec<GlobalHydrologyNode>,
    basin_count: u32,
}

impl GlobalHydrologyField {
    /// Builds a deterministic global drainage graph from loaded chunks.
    ///
    /// Local D8 routing is combined with strictly descending cross-chunk links.
    /// Accumulation is recomputed from one unit of runoff per represented node,
    /// so results do not depend on chunk insertion or pair-analysis order.
    ///
    /// # Errors
    ///
    /// Returns an error for an empty input, duplicate coordinates, mismatched
    /// chunk specifications or layouts, invalid cross-chunk boundaries,
    /// accumulation or basin overflows, or an unexpected drainage cycle.
    pub fn analyse(inputs: &[GlobalHydrologyInput<'_>]) -> Result<Self, GlobalHydrologyError> {
        if inputs.is_empty() {
            return Err(GlobalHydrologyError::EmptyInput);
        }

        let mut chunks = BTreeMap::new();
        for input in inputs {
            validate_input(*input)?;
            if chunks.insert(input.chunk.coord(), *input).is_some() {
                return Err(GlobalHydrologyError::DuplicateChunkCoordinate);
            }
        }
        let spec = chunks
            .first_key_value()
            .map(|(_, input)| input.chunk.spec())
            .ok_or(GlobalHydrologyError::EmptyInput)?;
        if chunks.values().any(|input| input.chunk.spec() != spec) {
            return Err(GlobalHydrologyError::MismatchedSpecification);
        }

        let edge = usize::try_from(spec.edge_samples())
            .map_err(|_| GlobalHydrologyError::InvalidLayout)?;
        let sample_count = edge
            .checked_mul(edge)
            .ok_or(GlobalHydrologyError::InvalidLayout)?;
        let mut cross_targets = BTreeMap::new();

        for (coord, input) in &chunks {
            for neighbour_coord in [
                TerrainChunkCoord::new(coord.x().saturating_add(1), coord.z()),
                TerrainChunkCoord::new(coord.x(), coord.z().saturating_add(1)),
            ] {
                let Some(neighbour) = chunks.get(&neighbour_coord) else {
                    continue;
                };
                let boundary = CrossChunkBoundary::analyse(
                    input.chunk,
                    input.fill,
                    input.hydrology,
                    neighbour.chunk,
                    neighbour.fill,
                    neighbour.hydrology,
                )?;
                for link in boundary.links() {
                    let source = GlobalHydrologyNodeKey::new(
                        link.source_chunk(),
                        link.source_sample_index(),
                    );
                    let destination = GlobalHydrologyNodeKey::new(
                        link.destination_chunk(),
                        link.destination_sample_index(),
                    );
                    let destination_input = chunks
                        .get(&destination.chunk())
                        .ok_or(GlobalHydrologyError::InvalidLayout)?;
                    let candidate = (
                        destination_input.fill.filled_heights_mm()[destination.sample_index()],
                        destination,
                    );
                    cross_targets
                        .entry(source)
                        .and_modify(|current| {
                            if candidate < *current {
                                *current = candidate;
                            }
                        })
                        .or_insert(candidate);
                }
            }
        }

        let mut downstream = BTreeMap::new();
        let mut terminal_hint = BTreeMap::new();
        for (coord, input) in &chunks {
            for index in 0..sample_count {
                let key = GlobalHydrologyNodeKey::new(*coord, index);
                let local = input.hydrology.nodes()[index];
                let local_target = local_downstream(edge, index, local.flow_direction())
                    .map(|target| GlobalHydrologyNodeKey::new(*coord, target));
                let target = local_target.or_else(|| cross_targets.get(&key).map(|(_, key)| *key));
                downstream.insert(key, target);
                let terminal = match local.terminal() {
                    DrainageTerminal::BoundaryOutlet => {
                        GlobalDrainageTerminal::LoadedBoundaryOutlet
                    }
                    DrainageTerminal::Sink => GlobalDrainageTerminal::Sink,
                };
                terminal_hint.insert(key, terminal);
            }
        }

        let mut indegree = downstream
            .keys()
            .map(|key| (*key, 0_u32))
            .collect::<BTreeMap<_, _>>();
        for target in downstream.values().flatten() {
            let degree = indegree
                .get_mut(target)
                .ok_or(GlobalHydrologyError::InvalidLayout)?;
            *degree = degree
                .checked_add(1)
                .ok_or(GlobalHydrologyError::IndegreeOverflow)?;
        }
        let mut ready = indegree
            .iter()
            .filter_map(|(key, degree)| (*degree == 0).then_some(*key))
            .collect::<BTreeSet<_>>();
        let mut accumulation = downstream
            .keys()
            .map(|key| (*key, 1_u64))
            .collect::<BTreeMap<_, _>>();
        let mut processed = 0_usize;

        while let Some(key) = ready.pop_first() {
            processed += 1;
            let Some(target) = downstream[&key] else {
                continue;
            };
            let contribution = accumulation[&key];
            let target_accumulation = accumulation
                .get_mut(&target)
                .ok_or(GlobalHydrologyError::InvalidLayout)?;
            *target_accumulation = target_accumulation
                .checked_add(contribution)
                .ok_or(GlobalHydrologyError::AccumulationOverflow)?;
            let degree = indegree
                .get_mut(&target)
                .ok_or(GlobalHydrologyError::InvalidLayout)?;
            *degree -= 1;
            if *degree == 0 {
                ready.insert(target);
            }
        }
        if processed != downstream.len() {
            return Err(GlobalHydrologyError::DrainageCycle);
        }

        let mut terminal_keys = downstream
            .iter()
            .filter_map(|(key, target)| target.is_none().then_some(*key))
            .collect::<Vec<_>>();
        terminal_keys.sort_unstable();
        let mut terminal_basins = BTreeMap::new();
        for (index, key) in terminal_keys.into_iter().enumerate() {
            let basin_id = u32::try_from(index).map_err(|_| GlobalHydrologyError::BasinOverflow)?;
            terminal_basins.insert(key, basin_id);
        }
        let basin_count = u32::try_from(terminal_basins.len())
            .map_err(|_| GlobalHydrologyError::BasinOverflow)?;

        let mut basin_ids = BTreeMap::new();
        let mut terminals = BTreeMap::new();
        for start in downstream.keys().copied() {
            if basin_ids.contains_key(&start) {
                continue;
            }
            let mut path = Vec::new();
            let mut current = start;
            loop {
                if let Some(existing) = basin_ids.get(&current).copied() {
                    let terminal = terminals[&current];
                    for key in path {
                        basin_ids.insert(key, existing);
                        terminals.insert(key, terminal);
                    }
                    break;
                }
                path.push(current);
                if let Some(next) = downstream[&current] {
                    current = next;
                    continue;
                }
                let basin_id = terminal_basins[&current];
                let terminal = terminal_hint[&current];
                for key in path {
                    basin_ids.insert(key, basin_id);
                    terminals.insert(key, terminal);
                }
                break;
            }
        }

        let nodes = downstream
            .iter()
            .map(|(key, target)| GlobalHydrologyNode {
                key: *key,
                downstream: *target,
                accumulation: accumulation[key],
                basin_id: basin_ids[key],
                terminal: terminals[key],
            })
            .collect();

        Ok(Self {
            spec,
            nodes,
            basin_count,
        })
    }

    #[must_use]
    pub const fn spec(&self) -> TerrainChunkSpec {
        self.spec
    }

    #[must_use]
    pub fn nodes(&self) -> &[GlobalHydrologyNode] {
        &self.nodes
    }

    #[must_use]
    pub const fn basin_count(&self) -> u32 {
        self.basin_count
    }

    #[must_use]
    pub fn node(&self, key: GlobalHydrologyNodeKey) -> Option<GlobalHydrologyNode> {
        self.nodes
            .binary_search_by_key(&key, |node| node.key())
            .ok()
            .map(|index| self.nodes[index])
    }

    #[must_use]
    pub fn river_candidates(&self, minimum_accumulation: u64) -> Vec<GlobalHydrologyNodeKey> {
        self.nodes
            .iter()
            .filter_map(|node| (node.accumulation() >= minimum_accumulation).then_some(node.key()))
            .collect()
    }
}

fn validate_input(input: GlobalHydrologyInput<'_>) -> Result<(), GlobalHydrologyError> {
    let edge = usize::try_from(input.chunk.spec().edge_samples())
        .map_err(|_| GlobalHydrologyError::InvalidLayout)?;
    let count = edge
        .checked_mul(edge)
        .ok_or(GlobalHydrologyError::InvalidLayout)?;
    if input.chunk.samples().len() != count
        || input.fill.filled_heights_mm().len() != count
        || input.hydrology.nodes().len() != count
        || input.fill.edge_samples() != input.chunk.spec().edge_samples()
        || input.hydrology.edge_samples() != input.chunk.spec().edge_samples()
    {
        return Err(GlobalHydrologyError::InvalidLayout);
    }
    Ok(())
}

fn local_downstream(edge: usize, index: usize, direction: FlowDirection) -> Option<usize> {
    if direction == FlowDirection::Sink {
        return None;
    }
    let x = index % edge;
    let z = index / edge;
    let (offset_x, offset_z) = direction.unit_offset();
    let target_x = x.checked_add_signed(isize::from(offset_x))?;
    let target_z = z.checked_add_signed(isize::from(offset_z))?;
    (target_x < edge && target_z < edge).then_some(target_z * edge + target_x)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GlobalHydrologyError {
    EmptyInput,
    DuplicateChunkCoordinate,
    MismatchedSpecification,
    InvalidLayout,
    IndegreeOverflow,
    AccumulationOverflow,
    BasinOverflow,
    DrainageCycle,
    CrossChunk(CrossChunkError),
}

impl fmt::Display for GlobalHydrologyError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyInput => formatter.write_str("global hydrology requires at least one chunk"),
            Self::DuplicateChunkCoordinate => {
                formatter.write_str("global hydrology received duplicate chunk coordinates")
            }
            Self::MismatchedSpecification => {
                formatter.write_str("global hydrology chunks use different specifications")
            }
            Self::InvalidLayout => formatter.write_str("global hydrology input layout is invalid"),
            Self::IndegreeOverflow => {
                formatter.write_str("global hydrology indegree overflowed u32")
            }
            Self::AccumulationOverflow => {
                formatter.write_str("global hydrology accumulation overflowed u64")
            }
            Self::BasinOverflow => {
                formatter.write_str("global hydrology basin count overflowed u32")
            }
            Self::DrainageCycle => formatter.write_str("global hydrology graph contains a cycle"),
            Self::CrossChunk(error) => error.fmt(formatter),
        }
    }
}

impl std::error::Error for GlobalHydrologyError {}

impl From<CrossChunkError> for GlobalHydrologyError {
    fn from(error: CrossChunkError) -> Self {
        Self::CrossChunk(error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{TerrainConfig, TerrainGenerator};

    struct AnalysedChunk {
        chunk: TerrainChunk,
        fill: DepressionFill,
        hydrology: HydrologyField,
    }

    fn analysed_chunk(
        generator: TerrainGenerator,
        coord: TerrainChunkCoord,
        spec: TerrainChunkSpec,
    ) -> AnalysedChunk {
        let chunk = TerrainChunk::generate(generator, coord, spec).expect("chunk should generate");
        let fill = DepressionFill::analyse(&chunk).expect("fill should analyse");
        let hydrology =
            HydrologyField::analyse_with_fill(&chunk, &fill).expect("hydrology should analyse");
        AnalysedChunk {
            chunk,
            fill,
            hydrology,
        }
    }

    fn input(chunk: &AnalysedChunk) -> GlobalHydrologyInput<'_> {
        GlobalHydrologyInput::new(&chunk.chunk, &chunk.fill, &chunk.hydrology)
    }

    #[test]
    fn input_order_does_not_change_global_result() {
        let generator = TerrainGenerator::new(42, TerrainConfig::default());
        let spec = TerrainChunkSpec::new(16, 4_000).expect("valid spec");
        let chunks = [
            analysed_chunk(generator, TerrainChunkCoord::new(0, 0), spec),
            analysed_chunk(generator, TerrainChunkCoord::new(1, 0), spec),
            analysed_chunk(generator, TerrainChunkCoord::new(0, 1), spec),
            analysed_chunk(generator, TerrainChunkCoord::new(1, 1), spec),
        ];
        let forward = GlobalHydrologyField::analyse(&[
            input(&chunks[0]),
            input(&chunks[1]),
            input(&chunks[2]),
            input(&chunks[3]),
        ])
        .expect("global hydrology should analyse");
        let reverse = GlobalHydrologyField::analyse(&[
            input(&chunks[3]),
            input(&chunks[2]),
            input(&chunks[1]),
            input(&chunks[0]),
        ])
        .expect("global hydrology should analyse");
        assert_eq!(forward, reverse);
    }

    #[test]
    fn every_node_has_one_global_basin() {
        let generator = TerrainGenerator::new(7, TerrainConfig::default());
        let spec = TerrainChunkSpec::new(8, 8_000).expect("valid spec");
        let left = analysed_chunk(generator, TerrainChunkCoord::new(-1, 0), spec);
        let right = analysed_chunk(generator, TerrainChunkCoord::new(0, 0), spec);
        let field = GlobalHydrologyField::analyse(&[input(&left), input(&right)])
            .expect("global hydrology should analyse");
        assert_eq!(field.nodes().len(), 2 * 9 * 9);
        assert!(field.basin_count() > 0);
        assert!(field
            .nodes()
            .iter()
            .all(|node| node.basin_id() < field.basin_count()));
    }

    #[test]
    fn duplicate_chunk_coordinates_are_rejected() {
        let generator = TerrainGenerator::new(9, TerrainConfig::default());
        let spec = TerrainChunkSpec::new(8, 4_000).expect("valid spec");
        let chunk = analysed_chunk(generator, TerrainChunkCoord::new(0, 0), spec);
        assert_eq!(
            GlobalHydrologyField::analyse(&[input(&chunk), input(&chunk)]),
            Err(GlobalHydrologyError::DuplicateChunkCoordinate)
        );
    }
}
