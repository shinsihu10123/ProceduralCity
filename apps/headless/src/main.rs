#![forbid(unsafe_code)]

use artificial_world_kernel::SimulationHost;
use std::{env, process::ExitCode};

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

fn run() -> Result<(), String> {
    let arguments: Vec<String> = env::args().skip(1).collect();
    let ticks = parse_u64_flag(&arguments, "--ticks", 1_000)?;
    let seed = parse_u64_flag(&arguments, "--seed", 1)?;

    let mut host = SimulationHost::new(seed);
    host.start();

    for _ in 0..ticks {
        host.step().map_err(|error| error.to_string())?;
    }

    println!(
        "{{\"tick\":{},\"seed\":{seed},\"digest\":\"{:016x}\"}}",
        host.tick().value(),
        host.deterministic_digest()
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
