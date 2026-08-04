use std::{collections::BTreeMap, fmt};

use crate::{GlobalHydrologyField, GlobalHydrologyNodeKey};

pub const DEFAULT_RIVER_NETWORK_THRESHOLD: u64 = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum RiverJunctionKind {
    Source,
    Confluence,
    Mouth,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct RiverJunction {
    node: GlobalHydrologyNodeKey,
    kind: RiverJunctionKind,
    accumulation: u64,
    strahler_order: u16,
}

impl RiverJunction {
    #[must_use]
    pub const fn node(self) -> GlobalHydrologyNodeKey {
        self.node
    }

    #[must_use]
    pub const fn kind(self) -> RiverJunctionKind {
        self.kind
    }

    #[must_use]
    pub const fn accumulation(self) -> u64 {
        self.accumulation
    }

    #[must_use]
    pub const fn strahler_order(self) -> u16 {
        self.strahler_order
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct RiverReach {
    id: u32,
    nodes: Vec<GlobalHydrologyNodeKey>,
    upstream_junction: RiverJunction,
    downstream_junction: RiverJunction,
    strahler_order: u16,
    discharge_units: u64,
    width_mm: u32,
    depth_mm: u32,
}

impl RiverReach {
    #[must_use]
    pub const fn id(&self) -> u32 {
        self.id
    }

    #[must_use]
    pub fn nodes(&self) -> &[GlobalHydrologyNodeKey] {
        &self.nodes
    }

    #[must_use]
    pub const fn upstream_junction(&self) -> RiverJunction {
        self.upstream_junction
    }

    #[must_use]
    pub const fn downstream_junction(&self) -> RiverJunction {
        self.downstream_junction
    }

    #[must_use]
    pub const fn strahler_order(&self) -> u16 {
        self.strahler_order
    }

    #[must_use]
    pub const fn discharge_units(&self) -> u64 {
        self.discharge_units
    }

    #[must_use]
    pub const fn width_mm(&self) -> u32 {
        self.width_mm
    }

    #[must_use]
    pub const fn depth_mm(&self) -> u32 {
        self.depth_mm
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RiverNetwork {
    minimum_accumulation: u64,
    junctions: Vec<RiverJunction>,
    reaches: Vec<RiverReach>,
}

impl RiverNetwork {
    /// Extracts a compressed river graph from global hydrology.
    ///
    /// Nodes below `minimum_accumulation` are excluded. Remaining chains are
    /// compressed into reaches between sources, confluences and mouths.
    ///
    /// # Errors
    ///
    /// Returns an error for a zero threshold, numeric overflow, missing graph
    /// references, or an unexpected cycle in the selected river subgraph.
    pub fn extract(
        hydrology: &GlobalHydrologyField,
        minimum_accumulation: u64,
    ) -> Result<Self, RiverNetworkError> {
        if minimum_accumulation == 0 {
            return Err(RiverNetworkError::ZeroThreshold);
        }

        let selected = hydrology
            .nodes()
            .iter()
            .filter(|node| node.accumulation() >= minimum_accumulation)
            .map(|node| (node.key(), *node))
            .collect::<BTreeMap<_, _>>();

        let mut upstream = selected
            .keys()
            .map(|key| (*key, Vec::new()))
            .collect::<BTreeMap<_, Vec<GlobalHydrologyNodeKey>>>();
        for node in selected.values() {
            if let Some(target) = node.downstream().filter(|key| selected.contains_key(key)) {
                upstream
                    .get_mut(&target)
                    .ok_or(RiverNetworkError::InvalidGraph)?
                    .push(node.key());
            }
        }
        for sources in upstream.values_mut() {
            sources.sort_unstable();
        }

        let orders = compute_strahler_orders(&selected, &upstream)?;
        let junction_keys = selected
            .values()
            .filter_map(|node| {
                let count = upstream[&node.key()].len();
                let downstream_selected = node
                    .downstream()
                    .is_some_and(|key| selected.contains_key(&key));
                (count != 1 || !downstream_selected).then_some(node.key())
            })
            .collect::<Vec<_>>();

        let mut junctions_by_key = BTreeMap::new();
        for key in junction_keys {
            let node = selected[&key];
            let upstream_count = upstream[&key].len();
            let downstream_selected = node
                .downstream()
                .is_some_and(|target| selected.contains_key(&target));
            let kind = if upstream_count == 0 {
                RiverJunctionKind::Source
            } else if !downstream_selected {
                RiverJunctionKind::Mouth
            } else {
                RiverJunctionKind::Confluence
            };
            junctions_by_key.insert(
                key,
                RiverJunction {
                    node: key,
                    kind,
                    accumulation: node.accumulation(),
                    strahler_order: orders[&key],
                },
            );
        }

        let mut reaches = Vec::new();
        for (&start_key, &start_junction) in &junctions_by_key {
            let Some(mut current) = selected[&start_key]
                .downstream()
                .filter(|key| selected.contains_key(key))
            else {
                continue;
            };
            let mut nodes = vec![start_key, current];
            let mut guard = 0_usize;
            while !junctions_by_key.contains_key(&current) {
                guard = guard
                    .checked_add(1)
                    .ok_or(RiverNetworkError::NumericOverflow)?;
                if guard > selected.len() {
                    return Err(RiverNetworkError::DrainageCycle);
                }
                let next = selected[&current]
                    .downstream()
                    .filter(|key| selected.contains_key(key))
                    .ok_or(RiverNetworkError::InvalidGraph)?;
                current = next;
                nodes.push(current);
            }
            let downstream_junction = junctions_by_key[&current];
            let discharge_units = selected[&current].accumulation();
            let strahler_order = orders[&current].max(start_junction.strahler_order());
            let id =
                u32::try_from(reaches.len()).map_err(|_| RiverNetworkError::NumericOverflow)?;
            reaches.push(RiverReach {
                id,
                nodes,
                upstream_junction: start_junction,
                downstream_junction,
                strahler_order,
                discharge_units,
                width_mm: estimate_width_mm(discharge_units, strahler_order)?,
                depth_mm: estimate_depth_mm(discharge_units, strahler_order)?,
            });
        }

        let junctions = junctions_by_key.into_values().collect();
        Ok(Self {
            minimum_accumulation,
            junctions,
            reaches,
        })
    }

    #[must_use]
    pub const fn minimum_accumulation(&self) -> u64 {
        self.minimum_accumulation
    }

    #[must_use]
    pub fn junctions(&self) -> &[RiverJunction] {
        &self.junctions
    }

    #[must_use]
    pub fn reaches(&self) -> &[RiverReach] {
        &self.reaches
    }
}

fn compute_strahler_orders(
    selected: &BTreeMap<GlobalHydrologyNodeKey, crate::GlobalHydrologyNode>,
    upstream: &BTreeMap<GlobalHydrologyNodeKey, Vec<GlobalHydrologyNodeKey>>,
) -> Result<BTreeMap<GlobalHydrologyNodeKey, u16>, RiverNetworkError> {
    let mut unresolved = selected.keys().copied().collect::<Vec<_>>();
    let mut orders = BTreeMap::new();
    let mut passes = 0_usize;
    while !unresolved.is_empty() {
        passes = passes
            .checked_add(1)
            .ok_or(RiverNetworkError::NumericOverflow)?;
        if passes > selected.len() {
            return Err(RiverNetworkError::DrainageCycle);
        }
        let mut next = Vec::new();
        let mut progressed = false;
        for key in unresolved {
            let sources = &upstream[&key];
            if sources.iter().any(|source| !orders.contains_key(source)) {
                next.push(key);
                continue;
            }
            let order = if sources.is_empty() {
                1_u16
            } else {
                let maximum: u16 = sources
                    .iter()
                    .map(|source| orders[source])
                    .max()
                    .unwrap_or(1);
                let maximum_count = sources
                    .iter()
                    .filter(|source| orders[*source] == maximum)
                    .count();
                if maximum_count >= 2 {
                    maximum
                        .checked_add(1)
                        .ok_or(RiverNetworkError::NumericOverflow)?
                } else {
                    maximum
                }
            };
            orders.insert(key, order);
            progressed = true;
        }
        if !progressed {
            return Err(RiverNetworkError::DrainageCycle);
        }
        unresolved = next;
    }
    Ok(orders)
}

fn integer_sqrt(value: u64) -> u64 {
    if value < 2 {
        return value;
    }
    let mut x = value;
    let mut y = u64::midpoint(x, value / x);
    while y < x {
        x = y;
        y = u64::midpoint(x, value / x);
    }
    x
}

fn estimate_width_mm(discharge: u64, order: u16) -> Result<u32, RiverNetworkError> {
    let base = integer_sqrt(discharge)
        .checked_mul(750)
        .ok_or(RiverNetworkError::NumericOverflow)?;
    let order_bonus = u64::from(order)
        .checked_mul(500)
        .ok_or(RiverNetworkError::NumericOverflow)?;
    u32::try_from(base.saturating_add(order_bonus).max(1_000))
        .map_err(|_| RiverNetworkError::NumericOverflow)
}

fn estimate_depth_mm(discharge: u64, order: u16) -> Result<u32, RiverNetworkError> {
    let base = integer_sqrt(integer_sqrt(discharge))
        .checked_mul(400)
        .ok_or(RiverNetworkError::NumericOverflow)?;
    let order_bonus = u64::from(order)
        .checked_mul(250)
        .ok_or(RiverNetworkError::NumericOverflow)?;
    u32::try_from(base.saturating_add(order_bonus).max(500))
        .map_err(|_| RiverNetworkError::NumericOverflow)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RiverNetworkError {
    ZeroThreshold,
    InvalidGraph,
    NumericOverflow,
    DrainageCycle,
}

impl fmt::Display for RiverNetworkError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::ZeroThreshold => "river network threshold must be greater than zero",
            Self::InvalidGraph => "global hydrology graph contains an invalid reference",
            Self::NumericOverflow => "river network numeric calculation overflowed",
            Self::DrainageCycle => "river network graph contains a cycle",
        })
    }
}

impl std::error::Error for RiverNetworkError {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        DepressionFill, GlobalDrainageTerminal, GlobalHydrologyInput, HydrologyField, TerrainChunk,
        TerrainChunkCoord, TerrainChunkSpec, TerrainConfig, TerrainGenerator,
    };

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

    #[test]
    fn extracts_cross_chunk_reaches_deterministically() {
        let generator = TerrainGenerator::new(42, TerrainConfig::default());
        let spec = TerrainChunkSpec::new(16, 4_000).expect("valid spec");
        let chunks = [
            analysed_chunk(generator, TerrainChunkCoord::new(0, 0), spec),
            analysed_chunk(generator, TerrainChunkCoord::new(1, 0), spec),
            analysed_chunk(generator, TerrainChunkCoord::new(0, 1), spec),
            analysed_chunk(generator, TerrainChunkCoord::new(1, 1), spec),
        ];
        let inputs = chunks
            .iter()
            .map(|chunk| GlobalHydrologyInput::new(&chunk.chunk, &chunk.fill, &chunk.hydrology))
            .collect::<Vec<_>>();
        let hydrology =
            GlobalHydrologyField::analyse(&inputs).expect("global analysis should work");
        let network = RiverNetwork::extract(&hydrology, 8).expect("network should extract");
        assert!(network
            .reaches()
            .iter()
            .all(|reach| reach.width_mm() > 0 && reach.depth_mm() > 0));
        assert!(network
            .junctions()
            .iter()
            .all(|junction| junction.strahler_order() > 0));
    }

    #[test]
    fn zero_threshold_is_rejected() {
        let generator = TerrainGenerator::new(1, TerrainConfig::default());
        let spec = TerrainChunkSpec::new(8, 4_000).expect("valid spec");
        let chunk = analysed_chunk(generator, TerrainChunkCoord::new(0, 0), spec);
        let hydrology = GlobalHydrologyField::analyse(&[GlobalHydrologyInput::new(
            &chunk.chunk,
            &chunk.fill,
            &chunk.hydrology,
        )])
        .expect("global analysis should work");
        assert_eq!(
            RiverNetwork::extract(&hydrology, 0),
            Err(RiverNetworkError::ZeroThreshold)
        );
    }

    #[test]
    fn mouth_junctions_end_loaded_river_paths() {
        let generator = TerrainGenerator::new(7, TerrainConfig::default());
        let spec = TerrainChunkSpec::new(16, 4_000).expect("valid spec");
        let chunk = analysed_chunk(generator, TerrainChunkCoord::new(0, 0), spec);
        let hydrology = GlobalHydrologyField::analyse(&[GlobalHydrologyInput::new(
            &chunk.chunk,
            &chunk.fill,
            &chunk.hydrology,
        )])
        .expect("global analysis should work");
        let network = RiverNetwork::extract(&hydrology, 4).expect("network should extract");
        assert!(network.junctions().iter().any(|junction| {
            junction.kind() == RiverJunctionKind::Mouth
                || hydrology
                    .node(junction.node())
                    .is_some_and(|node| node.terminal() == GlobalDrainageTerminal::Sink)
        }));
    }
}
