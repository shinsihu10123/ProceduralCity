use serde::{Deserialize, Serialize};
use std::fmt;

pub const PERFORMANCE_RUN_SCHEMA_VERSION: &str = "performance-run.v1";
pub const STAGE0_BASELINE_BENCHMARK_ID: &str = "stage0-kernel-baseline.v1";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareProfile {
    pub environment: String,
    pub operating_system: String,
    pub architecture: String,
    pub logical_cpu_count: u64,
    pub rustc_version: String,
    pub build_profile: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BenchmarkConfiguration {
    pub world_seed: u64,
    pub warmup_ticks: u64,
    pub measured_ticks_per_sample: u64,
    pub sample_count: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DurationSummary {
    pub sample_count: u64,
    pub minimum_ns: u64,
    pub median_ns: u64,
    pub p95_ns: u64,
    pub maximum_ns: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThroughputSummary {
    pub sample_count: u64,
    pub minimum_ticks_per_second: u64,
    pub median_ticks_per_second: u64,
    pub maximum_ticks_per_second: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceRunManifest {
    pub schema_version: String,
    pub run_id: String,
    pub benchmark_id: String,
    pub code_build_id: String,
    pub created_at_utc: Option<String>,
    pub hardware: HardwareProfile,
    pub configuration: BenchmarkConfiguration,
    pub empty_tick_duration: DurationSummary,
    pub empty_tick_throughput: ThroughputSummary,
    pub snapshot_write_duration: DurationSummary,
    pub save_write_duration: DurationSummary,
    pub save_load_duration: DurationSummary,
    pub snapshot_bytes: u64,
    pub save_bytes: u64,
    pub final_tick: u64,
    pub final_digest: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PerformanceRunValidationError {
    SchemaVersion(String),
    EmptyIdentifier(&'static str),
    InvalidConfiguration,
    InvalidDuration(&'static str),
    InvalidThroughput,
    EmptyArtifact(&'static str),
    FinalTickMismatch { expected: u64, actual: u64 },
    InvalidDigest(String),
}

impl fmt::Display for PerformanceRunValidationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::SchemaVersion(version) => {
                write!(formatter, "unsupported performance schema version: {version}")
            }
            Self::EmptyIdentifier(field) => write!(formatter, "{field} must not be empty"),
            Self::InvalidConfiguration => formatter.write_str(
                "benchmark configuration must contain non-zero measured ticks and samples",
            ),
            Self::InvalidDuration(field) => {
                write!(formatter, "invalid ordered duration summary: {field}")
            }
            Self::InvalidThroughput => {
                formatter.write_str("invalid ordered empty tick throughput summary")
            }
            Self::EmptyArtifact(field) => write!(formatter, "{field} must be larger than zero"),
            Self::FinalTickMismatch { expected, actual } => write!(
                formatter,
                "final tick mismatch: expected={expected}, actual={actual}"
            ),
            Self::InvalidDigest(digest) => {
                write!(formatter, "invalid final deterministic digest: {digest}")
            }
        }
    }
}

impl std::error::Error for PerformanceRunValidationError {}

impl PerformanceRunManifest {
    /// Validates the versioned benchmark result contract.
    ///
    /// # Errors
    ///
    /// Returns [`PerformanceRunValidationError`] when identifiers, sample
    /// counts, ordered summaries, artifact sizes, final tick, or digest are
    /// invalid.
    pub fn validate(&self) -> Result<(), PerformanceRunValidationError> {
        if self.schema_version != PERFORMANCE_RUN_SCHEMA_VERSION {
            return Err(PerformanceRunValidationError::SchemaVersion(
                self.schema_version.clone(),
            ));
        }
        validate_non_empty("runId", &self.run_id)?;
        validate_non_empty("benchmarkId", &self.benchmark_id)?;
        validate_non_empty("codeBuildId", &self.code_build_id)?;
        validate_non_empty("hardware.environment", &self.hardware.environment)?;
        validate_non_empty(
            "hardware.operatingSystem",
            &self.hardware.operating_system,
        )?;
        validate_non_empty("hardware.architecture", &self.hardware.architecture)?;
        validate_non_empty("hardware.rustcVersion", &self.hardware.rustc_version)?;
        validate_non_empty("hardware.buildProfile", &self.hardware.build_profile)?;

        if self.configuration.measured_ticks_per_sample == 0
            || self.configuration.sample_count == 0
            || self.hardware.logical_cpu_count == 0
        {
            return Err(PerformanceRunValidationError::InvalidConfiguration);
        }

        validate_duration(
            "emptyTickDuration",
            self.empty_tick_duration,
            self.configuration.sample_count,
        )?;
        validate_duration(
            "snapshotWriteDuration",
            self.snapshot_write_duration,
            self.configuration.sample_count,
        )?;
        validate_duration(
            "saveWriteDuration",
            self.save_write_duration,
            self.configuration.sample_count,
        )?;
        validate_duration(
            "saveLoadDuration",
            self.save_load_duration,
            self.configuration.sample_count,
        )?;

        let throughput = self.empty_tick_throughput;
        if throughput.sample_count != self.configuration.sample_count
            || throughput.minimum_ticks_per_second == 0
            || throughput.minimum_ticks_per_second > throughput.median_ticks_per_second
            || throughput.median_ticks_per_second > throughput.maximum_ticks_per_second
        {
            return Err(PerformanceRunValidationError::InvalidThroughput);
        }

        if self.snapshot_bytes == 0 {
            return Err(PerformanceRunValidationError::EmptyArtifact(
                "snapshotBytes",
            ));
        }
        if self.save_bytes == 0 {
            return Err(PerformanceRunValidationError::EmptyArtifact("saveBytes"));
        }
        if self.final_tick != self.configuration.measured_ticks_per_sample {
            return Err(PerformanceRunValidationError::FinalTickMismatch {
                expected: self.configuration.measured_ticks_per_sample,
                actual: self.final_tick,
            });
        }
        if self.final_digest.len() != 16
            || !self
                .final_digest
                .bytes()
                .all(|byte| byte.is_ascii_hexdigit())
        {
            return Err(PerformanceRunValidationError::InvalidDigest(
                self.final_digest.clone(),
            ));
        }

        Ok(())
    }
}

fn validate_non_empty(
    field: &'static str,
    value: &str,
) -> Result<(), PerformanceRunValidationError> {
    if value.trim().is_empty() {
        Err(PerformanceRunValidationError::EmptyIdentifier(field))
    } else {
        Ok(())
    }
}

fn validate_duration(
    field: &'static str,
    summary: DurationSummary,
    expected_samples: u64,
) -> Result<(), PerformanceRunValidationError> {
    if summary.sample_count != expected_samples
        || summary.minimum_ns > summary.median_ns
        || summary.median_ns > summary.p95_ns
        || summary.p95_ns > summary.maximum_ns
    {
        Err(PerformanceRunValidationError::InvalidDuration(field))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        BenchmarkConfiguration, DurationSummary, HardwareProfile, PerformanceRunManifest,
        PerformanceRunValidationError, ThroughputSummary, PERFORMANCE_RUN_SCHEMA_VERSION,
        STAGE0_BASELINE_BENCHMARK_ID,
    };

    fn valid_manifest() -> PerformanceRunManifest {
        let duration = DurationSummary {
            sample_count: 3,
            minimum_ns: 10,
            median_ns: 20,
            p95_ns: 30,
            maximum_ns: 30,
        };
        PerformanceRunManifest {
            schema_version: PERFORMANCE_RUN_SCHEMA_VERSION.to_owned(),
            run_id: "test-run".to_owned(),
            benchmark_id: STAGE0_BASELINE_BENCHMARK_ID.to_owned(),
            code_build_id: "test-build".to_owned(),
            created_at_utc: None,
            hardware: HardwareProfile {
                environment: "test".to_owned(),
                operating_system: "linux".to_owned(),
                architecture: "x86_64".to_owned(),
                logical_cpu_count: 2,
                rustc_version: "rustc-test".to_owned(),
                build_profile: "release".to_owned(),
            },
            configuration: BenchmarkConfiguration {
                world_seed: 42,
                warmup_ticks: 100,
                measured_ticks_per_sample: 1_000,
                sample_count: 3,
            },
            empty_tick_duration: duration,
            empty_tick_throughput: ThroughputSummary {
                sample_count: 3,
                minimum_ticks_per_second: 100_000,
                median_ticks_per_second: 120_000,
                maximum_ticks_per_second: 140_000,
            },
            snapshot_write_duration: duration,
            save_write_duration: duration,
            save_load_duration: duration,
            snapshot_bytes: 100,
            save_bytes: 200,
            final_tick: 1_000,
            final_digest: "40885885fe2db25d".to_owned(),
        }
    }

    #[test]
    fn valid_performance_manifest_passes_contract_validation() {
        valid_manifest()
            .validate()
            .expect("valid performance manifest should pass");
    }

    #[test]
    fn unordered_duration_is_rejected() {
        let mut manifest = valid_manifest();
        manifest.empty_tick_duration.median_ns = 5;

        assert!(matches!(
            manifest.validate(),
            Err(PerformanceRunValidationError::InvalidDuration(_))
        ));
    }
}
