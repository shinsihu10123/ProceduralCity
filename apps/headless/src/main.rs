#![forbid(unsafe_code)]

use artificial_world_contracts::RenderSnapshot;
use artificial_world_kernel::SimulationHost;
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::ExitCode,
};

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

fn parse_path_flag(arguments: &[String], name: &str) -> Result<Option<PathBuf>, String> {
    let Some(index) = arguments.iter().position(|argument| argument == name) else {
        return Ok(None);
    };

    let raw_value = arguments
        .get(index + 1)
        .ok_or_else(|| format!("missing value after {name}"))?;

    Ok(Some(PathBuf::from(raw_value)))
}

fn write_snapshot(path: &Path, snapshot: &RenderSnapshot) -> Result<(), String> {
    snapshot
        .validate()
        .map_err(|error| format!("snapshot validation failed: {error}"))?;

    if let Some(parent) = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }

    let temporary_path = path.with_extension("json.tmp");
    let json = serde_json::to_vec_pretty(snapshot)
        .map_err(|error| format!("failed to serialize snapshot: {error}"))?;

    fs::write(&temporary_path, json).map_err(|error| {
        format!(
            "failed to write temporary snapshot {}: {error}",
            temporary_path.display()
        )
    })?;
    fs::rename(&temporary_path, path)
        .map_err(|error| format!("failed to commit snapshot {}: {error}", path.display()))?;

    Ok(())
}

fn run() -> Result<(), String> {
    let arguments: Vec<String> = env::args().skip(1).collect();
    let ticks = parse_u64_flag(&arguments, "--ticks", 1_000)?;
    let seed = parse_u64_flag(&arguments, "--seed", 1)?;
    let snapshot_output = parse_path_flag(&arguments, "--snapshot-output")?;

    let mut host = SimulationHost::new(seed);
    host.start();

    for _ in 0..ticks {
        host.step().map_err(|error| error.to_string())?;
    }

    let digest = format!("{:016x}", host.deterministic_digest());
    let snapshot = RenderSnapshot::kernel(host.tick().value(), seed, digest.clone());

    if let Some(path) = snapshot_output.as_deref() {
        write_snapshot(path, &snapshot)?;
    }

    println!(
        "{{\"tick\":{},\"seed\":{seed},\"digest\":\"{digest}\",\"snapshotWritten\":{}}}",
        host.tick().value(),
        snapshot_output.is_some()
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
