#![forbid(unsafe_code)]

use std::collections::HashSet;

use artificial_world_kernel::{
    DepressionFill, GlobalHydrologyField, GlobalHydrologyInput, HydrologyField, RiverNetwork,
    TerrainChunk, TerrainChunkCoord, TerrainChunkSpec, TerrainClass, TerrainConfig,
    TerrainGenerator,
};

const QUALITY_SEEDS: [u64; 8] = [1, 7, 42, 99, 2026, 65_537, 1_000_003, u64::MAX - 1];
const CHUNK_EDGE_CELLS: u32 = 24;
const SAMPLE_SPACING_MM: u32 = 8_000;
const RIVER_THRESHOLD: u64 = 12;

struct AnalysedChunk {
    chunk: TerrainChunk,
    fill: DepressionFill,
    hydrology: HydrologyField,
}

fn analysed_chunks(seed: u64) -> Vec<AnalysedChunk> {
    let generator = TerrainGenerator::new(seed, TerrainConfig::default());
    let spec = TerrainChunkSpec::new(CHUNK_EDGE_CELLS, SAMPLE_SPACING_MM)
        .expect("quality-test chunk specification must be valid");
    [
        TerrainChunkCoord::new(0, 0),
        TerrainChunkCoord::new(1, 0),
        TerrainChunkCoord::new(0, 1),
        TerrainChunkCoord::new(1, 1),
    ]
    .into_iter()
    .map(|coord| {
        let chunk = TerrainChunk::generate(generator, coord, spec)
            .expect("quality-test terrain chunk must generate");
        let fill =
            DepressionFill::analyse(&chunk).expect("quality-test depression fill must succeed");
        let hydrology = HydrologyField::analyse_with_fill(&chunk, &fill)
            .expect("quality-test hydrology must succeed");
        AnalysedChunk {
            chunk,
            fill,
            hydrology,
        }
    })
    .collect()
}

fn global_hydrology(chunks: &[AnalysedChunk], reverse: bool) -> GlobalHydrologyField {
    let iterator: Box<dyn Iterator<Item = &AnalysedChunk>> = if reverse {
        Box::new(chunks.iter().rev())
    } else {
        Box::new(chunks.iter())
    };
    let inputs = iterator
        .map(|chunk| GlobalHydrologyInput::new(&chunk.chunk, &chunk.fill, &chunk.hydrology))
        .collect::<Vec<_>>();
    GlobalHydrologyField::analyse(&inputs).expect("quality-test global hydrology must succeed")
}

#[test]
fn multi_seed_terrain_quality_contract_holds() {
    let mut aggregate_submerged = 0_u64;
    let mut aggregate_samples = 0_u64;
    let mut observed_classes = HashSet::new();

    for seed in QUALITY_SEEDS {
        let chunks = analysed_chunks(seed);
        let mut minimum_height = i32::MAX;
        let mut maximum_height = i32::MIN;
        let mut seed_submerged = 0_u64;
        let mut seed_samples = 0_u64;

        for analysed in &chunks {
            assert_eq!(analysed.hydrology.sink_count(), 0);
            for sample in analysed.chunk.samples() {
                minimum_height = minimum_height.min(sample.height_mm());
                maximum_height = maximum_height.max(sample.height_mm());
                seed_samples += 1;
                if sample.is_submerged() {
                    seed_submerged += 1;
                }
                observed_classes.insert(sample.class());
            }
        }

        let elevation_span = i64::from(maximum_height) - i64::from(minimum_height);
        assert!(
            elevation_span >= 10_000,
            "seed {seed} produced an implausibly flat {elevation_span} mm span"
        );

        let forward = global_hydrology(&chunks, false);
        let reverse = global_hydrology(&chunks, true);
        assert_eq!(forward.nodes(), reverse.nodes());
        assert_eq!(forward.basin_count(), reverse.basin_count());

        let network = RiverNetwork::extract(&forward, RIVER_THRESHOLD)
            .expect("quality-test river network must extract");
        assert!(
            !network.reaches().is_empty(),
            "seed {seed} produced no river reaches at threshold {RIVER_THRESHOLD}"
        );
        assert!(network.reaches().iter().all(|reach| {
            reach.width_mm() >= 1_000 && reach.depth_mm() >= 500 && reach.strahler_order() >= 1
        }));

        aggregate_submerged += seed_submerged;
        aggregate_samples += seed_samples;
    }

    let submerged_per_mille = aggregate_submerged * 1_000 / aggregate_samples;
    assert!(
        (50..=950).contains(&submerged_per_mille),
        "aggregate submerged ratio {submerged_per_mille}‰ is outside the quality envelope"
    );
    assert!(
        observed_classes.len() >= 4,
        "only {} terrain classes were observed across quality seeds",
        observed_classes.len()
    );
    assert!(observed_classes.contains(&TerrainClass::Plain));
    assert!(
        observed_classes.contains(&TerrainClass::ShallowOcean)
            || observed_classes.contains(&TerrainClass::DeepOcean)
    );
}

#[test]
fn quality_seed_results_are_repeatable() {
    for seed in QUALITY_SEEDS {
        let first = analysed_chunks(seed);
        let second = analysed_chunks(seed);
        for (left, right) in first.iter().zip(&second) {
            assert_eq!(left.chunk.samples(), right.chunk.samples());
            assert_eq!(
                left.fill.filled_heights_mm(),
                right.fill.filled_heights_mm()
            );
            assert_eq!(left.hydrology.nodes(), right.hydrology.nodes());
        }
    }
}

#[test]
fn distant_windows_do_not_repeat_exactly() {
    let generator = TerrainGenerator::new(42, TerrainConfig::default());
    let spec =
        TerrainChunkSpec::new(32, 16_000).expect("pattern-test chunk specification must be valid");
    let coordinates = [
        TerrainChunkCoord::new(0, 0),
        TerrainChunkCoord::new(97, 31),
        TerrainChunkCoord::new(-43, 88),
        TerrainChunkCoord::new(211, -157),
    ];
    let windows = coordinates
        .into_iter()
        .map(|coord| {
            TerrainChunk::generate(generator, coord, spec)
                .expect("pattern-test chunk must generate")
                .samples()
                .iter()
                .map(|sample| sample.height_mm())
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();

    for left in 0..windows.len() {
        for right in (left + 1)..windows.len() {
            assert_ne!(
                windows[left], windows[right],
                "distant terrain windows {left} and {right} repeated exactly"
            );
        }
    }
}
