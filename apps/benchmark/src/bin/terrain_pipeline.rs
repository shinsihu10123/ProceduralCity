#![forbid(unsafe_code)]

use artificial_world_kernel::{
    DepressionFill, GlobalHydrologyField, GlobalHydrologyInput, HydrologyField, RiverNetwork,
    TerrainChunk, TerrainChunkCoord, TerrainChunkSpec, TerrainConfig, TerrainGenerator,
};
use std::{
    hint::black_box,
    mem::size_of,
    process::ExitCode,
    time::{Duration, Instant},
};

const SEED: u64 = 42;
const GRID_EDGE_CHUNKS: i64 = 4;
const CHUNK_EDGE_CELLS: u32 = 32;
const SAMPLE_SPACING_MM: u32 = 4_000;
const RIVER_THRESHOLD: u64 = 16;
const MAX_PIPELINE_DURATION: Duration = Duration::from_secs(30);

struct AnalysedChunk {
    chunk: TerrainChunk,
    fill: DepressionFill,
    hydrology: HydrologyField,
}

fn elapsed_ns(started: Instant) -> u64 {
    u64::try_from(started.elapsed().as_nanos()).unwrap_or(u64::MAX)
}

fn run() -> Result<(), String> {
    let generator = TerrainGenerator::new(SEED, TerrainConfig::default());
    let spec = TerrainChunkSpec::new(CHUNK_EDGE_CELLS, SAMPLE_SPACING_MM)
        .map_err(|error| error.to_string())?;
    let pipeline_started = Instant::now();

    let terrain_started = Instant::now();
    let mut chunks = Vec::new();
    for z in 0..GRID_EDGE_CHUNKS {
        for x in 0..GRID_EDGE_CHUNKS {
            chunks.push(
                TerrainChunk::generate(generator, TerrainChunkCoord::new(x, z), spec)
                    .map_err(|error| error.to_string())?,
            );
        }
    }
    let terrain_ns = elapsed_ns(terrain_started);

    let fill_started = Instant::now();
    let fills = chunks
        .iter()
        .map(DepressionFill::analyse)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    let fill_ns = elapsed_ns(fill_started);

    let hydrology_started = Instant::now();
    let hydrologies = chunks
        .iter()
        .zip(&fills)
        .map(|(chunk, fill)| HydrologyField::analyse_with_fill(chunk, fill))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    let hydrology_ns = elapsed_ns(hydrology_started);

    let analysed = chunks
        .into_iter()
        .zip(fills)
        .zip(hydrologies)
        .map(|((chunk, fill), hydrology)| AnalysedChunk {
            chunk,
            fill,
            hydrology,
        })
        .collect::<Vec<_>>();

    let global_started = Instant::now();
    let inputs = analysed
        .iter()
        .map(|entry| GlobalHydrologyInput::new(&entry.chunk, &entry.fill, &entry.hydrology))
        .collect::<Vec<_>>();
    let global = GlobalHydrologyField::analyse(&inputs).map_err(|error| error.to_string())?;
    let global_ns = elapsed_ns(global_started);

    let river_started = Instant::now();
    let network =
        RiverNetwork::extract(&global, RIVER_THRESHOLD).map_err(|error| error.to_string())?;
    let river_ns = elapsed_ns(river_started);
    let total_duration = pipeline_started.elapsed();

    let chunk_count = u64::try_from(analysed.len()).unwrap_or(u64::MAX);
    let sample_count = analysed.iter().fold(0_u64, |total, entry| {
        total.saturating_add(u64::try_from(entry.chunk.samples().len()).unwrap_or(u64::MAX))
    });
    let estimated_bytes = analysed.iter().fold(0_u64, |total, entry| {
        let samples = entry
            .chunk
            .samples()
            .len()
            .saturating_mul(size_of::<artificial_world_kernel::TerrainSample>());
        let filled = entry
            .fill
            .filled_heights_mm()
            .len()
            .saturating_mul(size_of::<i32>());
        let nodes = entry
            .hydrology
            .nodes()
            .len()
            .saturating_mul(size_of::<artificial_world_kernel::HydrologyNode>());
        total.saturating_add(u64::try_from(samples.saturating_add(filled).saturating_add(nodes)).unwrap_or(u64::MAX))
    });

    if sample_count == 0 || global.nodes().is_empty() || network.reaches().is_empty() {
        return Err("terrain performance run produced an empty pipeline result".to_owned());
    }
    if total_duration > MAX_PIPELINE_DURATION {
        return Err(format!(
            "terrain pipeline exceeded {:?}: {:?}",
            MAX_PIPELINE_DURATION, total_duration
        ));
    }

    black_box(&analysed);
    black_box(&global);
    black_box(&network);

    let total_ns = u64::try_from(total_duration.as_nanos()).unwrap_or(u64::MAX);
    let samples_per_second = if total_ns == 0 {
        u64::MAX
    } else {
        u64::try_from(
            u128::from(sample_count)
                .saturating_mul(1_000_000_000)
                .checked_div(u128::from(total_ns))
                .unwrap_or(0),
        )
        .unwrap_or(u64::MAX)
    };
    let summary = serde_json::json!({
        "benchmarkId": "stage1.3-terrain-pipeline-v1",
        "seed": SEED,
        "chunkCount": chunk_count,
        "sampleCount": sample_count,
        "terrainGenerationNs": terrain_ns,
        "depressionFillNs": fill_ns,
        "chunkHydrologyNs": hydrology_ns,
        "globalHydrologyNs": global_ns,
        "riverNetworkNs": river_ns,
        "totalNs": total_ns,
        "samplesPerSecond": samples_per_second,
        "estimatedWorkingSetBytes": estimated_bytes,
        "globalNodeCount": global.nodes().len(),
        "basinCount": global.basin_count(),
        "riverReachCount": network.reaches().len(),
        "riverJunctionCount": network.junctions().len(),
    });
    println!("{summary}");
    Ok(())
}

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("terrain pipeline benchmark failed: {error}");
            ExitCode::FAILURE
        }
    }
}
