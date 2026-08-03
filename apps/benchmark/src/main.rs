#![forbid(unsafe_code)]

use artificial_world_contracts::{
    BenchmarkConfiguration, DurationSummary, HardwareProfile, PerformanceRunManifest,
    RenderSnapshot, ThroughputSummary, WorldSaveManifest, PERFORMANCE_RUN_SCHEMA_VERSION,
    STAGE0_BASELINE_BENCHMARK_ID,
};
use artificial_world_kernel::SimulationHost;
use artificial_world_persistence::{
    read_world_save, write_performance_run, write_render_snapshot, write_world_save,
};
use std::{
    env, fs,
    hint::black_box,
    io::ErrorKind,
    path::{Path, PathBuf},
    process::ExitCode,
    time::{Duration, Instant},
};

const DEFAULT_SEED: u64 = 42;
const DEFAULT_WARMUP_TICKS: u64 = 1_000_000;
const DEFAULT_MEASURED_TICKS: u64 = 10_000_000;
const DEFAULT_SAMPLE_COUNT: u64 = 7;

fn parse_u64_flag(arguments: &[String], name: &str, default: u64) -> Result<u64, String> {
    let Some(index) = arguments.iter().position(|argument| argument == name) else {
        return Ok(default);
    };
    let raw_value = arguments
        .get(index + 1)
        .ok_or_else(|| format!("missing value after {name}"))?;
    raw_value
        .parse::<u64>()
        .map_err(|error| format!("invalid value for {name}: {raw_value} ({error})"))
}

fn parse_string_flag(arguments: &[String], name: &str) -> Result<Option<String>, String> {
    let Some(index) = arguments.iter().position(|argument| argument == name) else {
        return Ok(None);
    };
    let value = arguments
        .get(index + 1)
        .ok_or_else(|| format!("missing value after {name}"))?;
    Ok(Some(value.clone()))
}

fn parse_path_flag(arguments: &[String], name: &str, default: &str) -> Result<PathBuf, String> {
    Ok(PathBuf::from(
        parse_string_flag(arguments, name)?.unwrap_or_else(|| default.to_owned()),
    ))
}

fn duration_ns(duration: Duration) -> u64 {
    u64::try_from(duration.as_nanos()).unwrap_or(u64::MAX)
}

fn summarize_durations(mut samples: Vec<u64>) -> DurationSummary {
    samples.sort_unstable();
    let count = samples.len();
    let median_index = count / 2;
    let p95_index = (count * 95).div_ceil(100).saturating_sub(1).min(count - 1);
    DurationSummary {
        sample_count: u64::try_from(count).unwrap_or(u64::MAX),
        minimum_ns: samples[0],
        median_ns: samples[median_index],
        p95_ns: samples[p95_index],
        maximum_ns: samples[count - 1],
    }
}

fn summarize_throughput(mut samples: Vec<u64>) -> ThroughputSummary {
    samples.sort_unstable();
    let count = samples.len();
    ThroughputSummary {
        sample_count: u64::try_from(count).unwrap_or(u64::MAX),
        minimum_ticks_per_second: samples[0],
        median_ticks_per_second: samples[count / 2],
        maximum_ticks_per_second: samples[count - 1],
    }
}

fn ticks_per_second(ticks: u64, elapsed_ns: u64) -> u64 {
    if elapsed_ns == 0 {
        return u64::MAX;
    }
    let value = u128::from(ticks)
        .saturating_mul(1_000_000_000)
        .checked_div(u128::from(elapsed_ns))
        .unwrap_or(0);
    u64::try_from(value).unwrap_or(u64::MAX)
}

fn execute_ticks(seed: u64, ticks: u64) -> Result<(u64, String), String> {
    let mut host = SimulationHost::new(seed);
    host.start();
    let started = Instant::now();
    for _ in 0..ticks {
        let tick = host.step().map_err(|error| error.to_string())?;
        black_box(tick);
    }
    let elapsed = duration_ns(started.elapsed());
    Ok((elapsed, format!("{:016x}", host.deterministic_digest())))
}

fn warm_up(seed: u64, ticks: u64) -> Result<(), String> {
    let mut host = SimulationHost::new(seed);
    host.start();
    for _ in 0..ticks {
        let tick = host.step().map_err(|error| error.to_string())?;
        black_box(tick);
    }
    black_box(host.deterministic_digest());
    Ok(())
}

fn remove_if_exists(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("failed to remove {}: {error}", path.display())),
    }
}

fn file_size(path: &Path) -> Result<u64, String> {
    fs::metadata(path)
        .map(|metadata| metadata.len())
        .map_err(|error| format!("failed to read metadata for {}: {error}", path.display()))
}

fn environment_name() -> String {
    if let Ok(value) = env::var("BENCHMARK_ENVIRONMENT") {
        return value;
    }
    if env::var_os("GITHUB_ACTIONS").is_some() {
        "github-actions".to_owned()
    } else if env::var_os("CODESPACES").is_some() {
        "github-codespaces".to_owned()
    } else {
        "local".to_owned()
    }
}

fn code_build_id(argument: Option<String>) -> String {
    argument
        .or_else(|| env::var("GITHUB_SHA").ok())
        .unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_owned())
}

fn run_id(argument: Option<String>) -> String {
    if let Some(value) = argument {
        return value;
    }
    match (env::var("GITHUB_RUN_ID"), env::var("GITHUB_RUN_ATTEMPT")) {
        (Ok(run), Ok(attempt)) => format!("github-{run}-{attempt}"),
        _ => "local-stage0-baseline".to_owned(),
    }
}

fn hardware_profile() -> HardwareProfile {
    let logical_cpu_count = std::thread::available_parallelism()
        .map(|count| u64::try_from(count.get()).unwrap_or(u64::MAX))
        .unwrap_or(1);
    HardwareProfile {
        environment: environment_name(),
        operating_system: env::consts::OS.to_owned(),
        architecture: env::consts::ARCH.to_owned(),
        logical_cpu_count,
        rustc_version: env::var("RUSTC_VERSION").unwrap_or_else(|_| "unknown".to_owned()),
        build_profile: if cfg!(debug_assertions) {
            "debug".to_owned()
        } else {
            "release".to_owned()
        },
    }
}

fn run() -> Result<(), String> {
    let arguments: Vec<String> = env::args().skip(1).collect();
    let output = parse_path_flag(
        &arguments,
        "--output",
        "target/benchmark/performance-run.json",
    )?;
    let seed = parse_u64_flag(&arguments, "--seed", DEFAULT_SEED)?;
    let warmup_ticks = parse_u64_flag(&arguments, "--warmup-ticks", DEFAULT_WARMUP_TICKS)?;
    let measured_ticks = parse_u64_flag(
        &arguments,
        "--measured-ticks",
        DEFAULT_MEASURED_TICKS,
    )?;
    let sample_count = parse_u64_flag(&arguments, "--samples", DEFAULT_SAMPLE_COUNT)?;
    if measured_ticks == 0 || sample_count == 0 {
        return Err("--measured-ticks and --samples must be greater than zero".to_owned());
    }
    let sample_count_usize = usize::try_from(sample_count)
        .map_err(|_| "--samples is too large for this platform".to_owned())?;

    warm_up(seed, warmup_ticks)?;

    let mut tick_durations = Vec::with_capacity(sample_count_usize);
    let mut tick_throughputs = Vec::with_capacity(sample_count_usize);
    let mut final_digest: Option<String> = None;
    for _ in 0..sample_count_usize {
        let (elapsed_ns, digest) = execute_ticks(seed, measured_ticks)?;
        if let Some(expected) = final_digest.as_deref() {
            if expected != digest {
                return Err(format!(
                    "benchmark determinism failure: expected={expected}, actual={digest}"
                ));
            }
        } else {
            final_digest = Some(digest);
        }
        tick_durations.push(elapsed_ns);
        tick_throughputs.push(ticks_per_second(measured_ticks, elapsed_ns));
    }
    let final_digest = final_digest.ok_or_else(|| "no benchmark samples executed".to_owned())?;

    let snapshot = RenderSnapshot::kernel(measured_ticks, seed, final_digest.clone());
    let save = WorldSaveManifest::kernel(
        measured_ticks,
        seed,
        true,
        final_digest.clone(),
        env!("CARGO_PKG_VERSION"),
    );

    let parent = output
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let sample_directory = parent.join("samples");
    fs::create_dir_all(&sample_directory).map_err(|error| {
        format!(
            "failed to create benchmark sample directory {}: {error}",
            sample_directory.display()
        )
    })?;

    let mut snapshot_write_durations = Vec::with_capacity(sample_count_usize);
    let mut save_write_durations = Vec::with_capacity(sample_count_usize);
    let mut save_load_durations = Vec::with_capacity(sample_count_usize);
    let mut snapshot_bytes = None;
    let mut save_bytes = None;

    for index in 0..sample_count_usize {
        let snapshot_path = sample_directory.join(format!("render-snapshot-{index}.json"));
        let save_path = sample_directory.join(format!("world-save-{index}.json"));

        let started = Instant::now();
        write_render_snapshot(&snapshot_path, &snapshot).map_err(|error| error.to_string())?;
        snapshot_write_durations.push(duration_ns(started.elapsed()));
        let current_snapshot_bytes = file_size(&snapshot_path)?;
        if snapshot_bytes.replace(current_snapshot_bytes).is_some_and(|previous| {
            previous != current_snapshot_bytes
        }) {
            return Err("snapshot byte size changed between identical samples".to_owned());
        }

        let started = Instant::now();
        write_world_save(&save_path, &save).map_err(|error| error.to_string())?;
        save_write_durations.push(duration_ns(started.elapsed()));
        let current_save_bytes = file_size(&save_path)?;
        if save_bytes
            .replace(current_save_bytes)
            .is_some_and(|previous| previous != current_save_bytes)
        {
            return Err("world save byte size changed between identical samples".to_owned());
        }

        let started = Instant::now();
        let restored = read_world_save(&save_path).map_err(|error| error.to_string())?;
        save_load_durations.push(duration_ns(started.elapsed()));
        if restored != save {
            return Err("loaded world save differs from the written manifest".to_owned());
        }

        remove_if_exists(&snapshot_path)?;
        remove_if_exists(&save_path)?;
    }
    fs::remove_dir(&sample_directory).map_err(|error| {
        format!(
            "failed to remove benchmark sample directory {}: {error}",
            sample_directory.display()
        )
    })?;

    let artifact_directory = parent.join("artifacts");
    fs::create_dir_all(&artifact_directory).map_err(|error| {
        format!(
            "failed to create benchmark artifact directory {}: {error}",
            artifact_directory.display()
        )
    })?;
    let snapshot_path = artifact_directory.join("render-snapshot.json");
    let save_path = artifact_directory.join("world-save.json");
    remove_if_exists(&snapshot_path)?;
    remove_if_exists(&save_path)?;
    write_render_snapshot(&snapshot_path, &snapshot).map_err(|error| error.to_string())?;
    write_world_save(&save_path, &save).map_err(|error| error.to_string())?;

    let manifest = PerformanceRunManifest {
        schema_version: PERFORMANCE_RUN_SCHEMA_VERSION.to_owned(),
        run_id: run_id(parse_string_flag(&arguments, "--run-id")?),
        benchmark_id: STAGE0_BASELINE_BENCHMARK_ID.to_owned(),
        code_build_id: code_build_id(parse_string_flag(&arguments, "--build-id")?),
        created_at_utc: env::var("BENCHMARK_CREATED_AT_UTC").ok(),
        hardware: hardware_profile(),
        configuration: BenchmarkConfiguration {
            world_seed: seed,
            warmup_ticks,
            measured_ticks_per_sample: measured_ticks,
            sample_count,
        },
        empty_tick_duration: summarize_durations(tick_durations),
        empty_tick_throughput: summarize_throughput(tick_throughputs),
        snapshot_write_duration: summarize_durations(snapshot_write_durations),
        save_write_duration: summarize_durations(save_write_durations),
        save_load_duration: summarize_durations(save_load_durations),
        snapshot_bytes: snapshot_bytes
            .ok_or_else(|| "snapshot size was not measured".to_owned())?,
        save_bytes: save_bytes.ok_or_else(|| "save size was not measured".to_owned())?,
        final_tick: measured_ticks,
        final_digest,
    };
    manifest
        .validate()
        .map_err(|error| format!("performance manifest validation failed: {error}"))?;
    remove_if_exists(&output)?;
    write_performance_run(&output, &manifest).map_err(|error| error.to_string())?;

    let summary = serde_json::json!({
        "schemaVersion": manifest.schema_version,
        "benchmarkId": manifest.benchmark_id,
        "environment": manifest.hardware.environment,
        "buildProfile": manifest.hardware.build_profile,
        "measuredTicksPerSample": measured_ticks,
        "samples": sample_count,
        "medianTicksPerSecond": manifest.empty_tick_throughput.median_ticks_per_second,
        "p95TickDurationNs": manifest.empty_tick_duration.p95_ns,
        "medianSnapshotWriteNs": manifest.snapshot_write_duration.median_ns,
        "medianSaveWriteNs": manifest.save_write_duration.median_ns,
        "medianSaveLoadNs": manifest.save_load_duration.median_ns,
        "snapshotBytes": manifest.snapshot_bytes,
        "saveBytes": manifest.save_bytes,
        "digest": manifest.final_digest,
        "output": output,
    });
    println!("{summary}");
    Ok(())
}

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("benchmark runner failed: {error}");
            ExitCode::FAILURE
        }
    }
}
