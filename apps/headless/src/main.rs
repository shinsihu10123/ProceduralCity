#![forbid(unsafe_code)]

use artificial_world_contracts::{RenderSnapshot, WorldSaveManifest};
use artificial_world_kernel::{SimulationCheckpoint, SimulationHost};
use artificial_world_persistence::{read_world_save, write_render_snapshot, write_world_save};
use serde_json::json;
use std::{env, path::PathBuf, process::ExitCode};

fn parse_optional_u64_flag(arguments: &[String], name: &str) -> Result<Option<u64>, String> {
    let Some(index) = arguments.iter().position(|argument| argument == name) else {
        return Ok(None);
    };

    let raw_value = arguments
        .get(index + 1)
        .ok_or_else(|| format!("missing value after {name}"))?;
    let value = raw_value
        .parse::<u64>()
        .map_err(|error| format!("invalid value for {name}: {raw_value} ({error})"))?;
    Ok(Some(value))
}

fn parse_u64_flag(arguments: &[String], name: &str, default: u64) -> Result<u64, String> {
    Ok(parse_optional_u64_flag(arguments, name)?.unwrap_or(default))
}

fn parse_path_flag(arguments: &[String], name: &str) -> Result<Option<PathBuf>, String> {
    let Some(index) = arguments.iter().position(|argument| argument == name) else {
        return Ok(None);
    };

    let raw_value = arguments
        .get(index + 1)
        .ok_or_else(|| format!("missing value after {name}"))?;

    Ok(Some(PathBuf::from(raw_value)))
}

fn restore_host(path: &std::path::Path) -> Result<SimulationHost, String> {
    let save = read_world_save(path)
        .map_err(|error| format!("failed to load world save {}: {error}", path.display()))?;
    let state = &save.kernel_state;
    let host = SimulationHost::restore(SimulationCheckpoint::new(
        state.tick,
        state.world_seed,
        state.running,
    ));
    let restored_digest = format!("{:016x}", host.deterministic_digest());

    if restored_digest != state.deterministic_digest {
        return Err(format!(
            "restored kernel digest mismatch: saved={}, restored={restored_digest}",
            state.deterministic_digest
        ));
    }

    Ok(host)
}

fn run() -> Result<(), String> {
    let arguments: Vec<String> = env::args().skip(1).collect();
    let ticks = parse_u64_flag(&arguments, "--ticks", 1_000)?;
    let seed = parse_optional_u64_flag(&arguments, "--seed")?;
    let load_path = parse_path_flag(&arguments, "--load")?;
    let save_output = parse_path_flag(&arguments, "--save-output")?;
    let snapshot_output = parse_path_flag(&arguments, "--snapshot-output")?;

    if load_path.is_some() && seed.is_some() {
        return Err(
            "--seed cannot be combined with --load; the save owns the world seed".to_owned(),
        );
    }

    let loaded = load_path.is_some();
    let mut host = if let Some(path) = load_path.as_deref() {
        restore_host(path)?
    } else {
        let mut host = SimulationHost::new(seed.unwrap_or(1));
        host.start();
        host
    };
    let start_tick = host.tick().value();

    for _ in 0..ticks {
        host.step().map_err(|error| error.to_string())?;
    }

    let digest = format!("{:016x}", host.deterministic_digest());
    let snapshot = RenderSnapshot::kernel(host.tick().value(), host.world_seed(), digest.clone());

    if let Some(path) = snapshot_output.as_deref() {
        write_render_snapshot(path, &snapshot)
            .map_err(|error| format!("failed to write RenderSnapshot: {error}"))?;
    }

    if let Some(path) = save_output.as_deref() {
        let save = WorldSaveManifest::kernel(
            host.tick().value(),
            host.world_seed(),
            host.is_running(),
            digest.clone(),
            env!("CARGO_PKG_VERSION"),
        );
        write_world_save(path, &save)
            .map_err(|error| format!("failed to write World Save: {error}"))?;
    }

    let summary = json!({
        "loaded": loaded,
        "startTick": start_tick,
        "tick": host.tick().value(),
        "seed": host.world_seed(),
        "digest": digest,
        "snapshotWritten": snapshot_output.is_some(),
        "saveWritten": save_output.is_some(),
    });
    println!(
        "{}",
        serde_json::to_string(&summary)
            .map_err(|error| format!("failed to serialize run summary: {error}"))?
    );

    Ok(())
}

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("headless runner failed: {error}");
            ExitCode::FAILURE
        }
    }
}
