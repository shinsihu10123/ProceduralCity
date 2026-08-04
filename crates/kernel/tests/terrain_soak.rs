#![forbid(unsafe_code)]

use artificial_world_kernel::{
    DepressionFill, GlobalHydrologyField, GlobalHydrologyInput, HydrologyField, RiverNetwork,
    TerrainChunk, TerrainChunkCoord, TerrainChunkSpec, TerrainConfig, TerrainGenerator,
};

const GRID_EDGE_CHUNKS: i64 = 8;
const CHUNK_EDGE_CELLS: u32 = 16;
const SAMPLE_SPACING_MM: u32 = 8_000;
const RIVER_THRESHOLD: u64 = 16;

struct AnalysedChunk {
    chunk: TerrainChunk,
    fill: DepressionFill,
    hydrology: HydrologyField,
}

#[test]
fn large_multi_chunk_pipeline_is_deterministic_and_connected() {
    let generator = TerrainGenerator::new(2026, TerrainConfig::default());
    let spec = TerrainChunkSpec::new(CHUNK_EDGE_CELLS, SAMPLE_SPACING_MM)
        .expect("soak-test chunk specification must be valid");
    let mut analysed = Vec::new();

    for z in 0..GRID_EDGE_CHUNKS {
        for x in 0..GRID_EDGE_CHUNKS {
            let chunk = TerrainChunk::generate(generator, TerrainChunkCoord::new(x, z), spec)
                .expect("soak-test terrain chunk must generate");
            let fill =
                DepressionFill::analyse(&chunk).expect("soak-test depression filling must succeed");
            let hydrology = HydrologyField::analyse_with_fill(&chunk, &fill)
                .expect("soak-test chunk hydrology must succeed");
            assert_eq!(hydrology.sink_count(), 0);
            analysed.push(AnalysedChunk {
                chunk,
                fill,
                hydrology,
            });
        }
    }

    let forward_inputs = analysed
        .iter()
        .map(|entry| GlobalHydrologyInput::new(&entry.chunk, &entry.fill, &entry.hydrology))
        .collect::<Vec<_>>();
    let reverse_inputs = analysed
        .iter()
        .rev()
        .map(|entry| GlobalHydrologyInput::new(&entry.chunk, &entry.fill, &entry.hydrology))
        .collect::<Vec<_>>();
    let forward = GlobalHydrologyField::analyse(&forward_inputs)
        .expect("forward global hydrology must succeed");
    let reverse = GlobalHydrologyField::analyse(&reverse_inputs)
        .expect("reverse global hydrology must succeed");

    assert_eq!(forward.nodes(), reverse.nodes());
    assert_eq!(forward.basin_count(), reverse.basin_count());
    assert_eq!(
        forward.nodes().len(),
        usize::try_from(GRID_EDGE_CHUNKS * GRID_EDGE_CHUNKS)
            .expect("grid size must fit usize")
            .saturating_mul(
                usize::try_from((CHUNK_EDGE_CELLS + 1) * (CHUNK_EDGE_CELLS + 1))
                    .expect("sample count must fit usize"),
            )
    );

    let network = RiverNetwork::extract(&forward, RIVER_THRESHOLD)
        .expect("soak-test river network must extract");
    assert!(!network.reaches().is_empty());
    assert!(!network.junctions().is_empty());
    assert!(network.reaches().iter().all(|reach| {
        reach.width_mm() >= 1_000 && reach.depth_mm() >= 500 && reach.strahler_order() >= 1
    }));
}
