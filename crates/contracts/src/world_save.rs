use serde::{Deserialize, Serialize};
use std::fmt;

pub const WORLD_SAVE_SCHEMA_VERSION: &str = "world-save.v1";
pub const KERNEL_STATE_SCHEMA_VERSION: &str = "kernel-state.v1";
pub const KERNEL_MODULE_ID: &str = "kernel";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelStateRecord {
    pub schema_version: String,
    pub tick: u64,
    pub world_seed: u64,
    pub running: bool,
    pub deterministic_digest: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleStateManifest {
    pub module_id: String,
    pub module_version: String,
    pub schema_version: String,
    pub state_digest: String,
    pub record_count: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RandomStateManifest {
    pub world_seed: u64,
    pub stream_count: u64,
    pub global_draw_count: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventPosition {
    pub last_event_id: Option<u64>,
    pub event_count: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldSaveManifest {
    pub schema_version: String,
    pub save_id: String,
    pub world_id: String,
    pub created_at_utc: Option<String>,
    pub world_tick: u64,
    pub code_build_id: String,
    pub configuration_hash: String,
    pub module_manifests: Vec<ModuleStateManifest>,
    pub random_state: RandomStateManifest,
    pub event_position: EventPosition,
    pub intervention_count: u64,
    pub kernel_state: KernelStateRecord,
    pub manifest_digest: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WorldSaveValidationError {
    SchemaVersion(String),
    KernelSchemaVersion(String),
    SaveId(String),
    WorldId(String),
    EmptyBuildId,
    InvalidDigest { field: &'static str, value: String },
    TickMismatch { manifest: u64, kernel: u64 },
    SeedMismatch { random_state: u64, kernel: u64 },
    KernelModuleManifest,
    KernelStateDigestMismatch,
    ConfigurationHashMismatch,
    ManifestDigestMismatch { expected: String, actual: String },
}

impl fmt::Display for WorldSaveValidationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::SchemaVersion(version) => {
                write!(
                    formatter,
                    "unsupported world save schema version: {version}"
                )
            }
            Self::KernelSchemaVersion(version) => {
                write!(
                    formatter,
                    "unsupported kernel state schema version: {version}"
                )
            }
            Self::SaveId(save_id) => write!(formatter, "invalid deterministic save id: {save_id}"),
            Self::WorldId(world_id) => {
                write!(formatter, "invalid deterministic world id: {world_id}")
            }
            Self::EmptyBuildId => formatter.write_str("code build id must not be empty"),
            Self::InvalidDigest { field, value } => {
                write!(
                    formatter,
                    "invalid 64-bit hexadecimal digest in {field}: {value}"
                )
            }
            Self::TickMismatch { manifest, kernel } => write!(
                formatter,
                "world tick mismatch: manifest={manifest}, kernel={kernel}"
            ),
            Self::SeedMismatch {
                random_state,
                kernel,
            } => write!(
                formatter,
                "world seed mismatch: random_state={random_state}, kernel={kernel}"
            ),
            Self::KernelModuleManifest => formatter
                .write_str("world save must contain exactly one valid kernel module manifest"),
            Self::KernelStateDigestMismatch => formatter.write_str(
                "kernel module state digest does not match the embedded kernel state digest",
            ),
            Self::ConfigurationHashMismatch => formatter.write_str(
                "configuration hash does not match the current seed-only Stage 0 configuration",
            ),
            Self::ManifestDigestMismatch { expected, actual } => write!(
                formatter,
                "world save manifest digest mismatch: expected={expected}, actual={actual}"
            ),
        }
    }
}

impl std::error::Error for WorldSaveValidationError {}

impl WorldSaveManifest {
    #[must_use]
    pub fn kernel(
        world_tick: u64,
        world_seed: u64,
        running: bool,
        state_digest: String,
        code_build_id: &str,
    ) -> Self {
        let kernel_state = KernelStateRecord {
            schema_version: KERNEL_STATE_SCHEMA_VERSION.to_owned(),
            tick: world_tick,
            world_seed,
            running,
            deterministic_digest: state_digest.clone(),
        };
        let module_manifests = vec![ModuleStateManifest {
            module_id: KERNEL_MODULE_ID.to_owned(),
            module_version: code_build_id.to_owned(),
            schema_version: KERNEL_STATE_SCHEMA_VERSION.to_owned(),
            state_digest,
            record_count: 1,
        }];
        let mut manifest = Self {
            schema_version: WORLD_SAVE_SCHEMA_VERSION.to_owned(),
            save_id: expected_save_id(world_seed, world_tick),
            world_id: expected_world_id(world_seed),
            created_at_utc: None,
            world_tick,
            code_build_id: code_build_id.to_owned(),
            configuration_hash: configuration_hash(world_seed),
            module_manifests,
            random_state: RandomStateManifest {
                world_seed,
                stream_count: 0,
                global_draw_count: 0,
            },
            event_position: EventPosition {
                last_event_id: None,
                event_count: 0,
            },
            intervention_count: 0,
            kernel_state,
            manifest_digest: String::new(),
        };
        manifest.manifest_digest = manifest.calculate_manifest_digest();
        manifest
    }

    /// Validates the structural integrity and canonical manifest digest.
    ///
    /// The embedded kernel deterministic digest is recomputed by the Kernel
    /// during restore, because its algorithm is owned by the Kernel module.
    ///
    /// # Errors
    ///
    /// Returns [`WorldSaveValidationError`] when identifiers, versions,
    /// cross-field invariants, or the canonical manifest digest are invalid.
    pub fn validate(&self) -> Result<(), WorldSaveValidationError> {
        if self.schema_version != WORLD_SAVE_SCHEMA_VERSION {
            return Err(WorldSaveValidationError::SchemaVersion(
                self.schema_version.clone(),
            ));
        }
        if self.kernel_state.schema_version != KERNEL_STATE_SCHEMA_VERSION {
            return Err(WorldSaveValidationError::KernelSchemaVersion(
                self.kernel_state.schema_version.clone(),
            ));
        }
        if self.code_build_id.is_empty() {
            return Err(WorldSaveValidationError::EmptyBuildId);
        }
        if self.save_id != expected_save_id(self.kernel_state.world_seed, self.world_tick) {
            return Err(WorldSaveValidationError::SaveId(self.save_id.clone()));
        }
        if self.world_id != expected_world_id(self.kernel_state.world_seed) {
            return Err(WorldSaveValidationError::WorldId(self.world_id.clone()));
        }
        validate_digest("configurationHash", &self.configuration_hash)?;
        validate_digest(
            "kernelState.deterministicDigest",
            &self.kernel_state.deterministic_digest,
        )?;
        validate_digest("manifestDigest", &self.manifest_digest)?;

        if self.world_tick != self.kernel_state.tick {
            return Err(WorldSaveValidationError::TickMismatch {
                manifest: self.world_tick,
                kernel: self.kernel_state.tick,
            });
        }
        if self.random_state.world_seed != self.kernel_state.world_seed {
            return Err(WorldSaveValidationError::SeedMismatch {
                random_state: self.random_state.world_seed,
                kernel: self.kernel_state.world_seed,
            });
        }
        if self.configuration_hash != configuration_hash(self.kernel_state.world_seed) {
            return Err(WorldSaveValidationError::ConfigurationHashMismatch);
        }

        let [kernel_module] = self.module_manifests.as_slice() else {
            return Err(WorldSaveValidationError::KernelModuleManifest);
        };
        if kernel_module.module_id != KERNEL_MODULE_ID
            || kernel_module.module_version != self.code_build_id
            || kernel_module.schema_version != KERNEL_STATE_SCHEMA_VERSION
            || kernel_module.record_count != 1
        {
            return Err(WorldSaveValidationError::KernelModuleManifest);
        }
        validate_digest(
            "moduleManifests[0].stateDigest",
            &kernel_module.state_digest,
        )?;
        if kernel_module.state_digest != self.kernel_state.deterministic_digest {
            return Err(WorldSaveValidationError::KernelStateDigestMismatch);
        }

        let expected = self.calculate_manifest_digest();
        if self.manifest_digest != expected {
            return Err(WorldSaveValidationError::ManifestDigestMismatch {
                expected,
                actual: self.manifest_digest.clone(),
            });
        }

        Ok(())
    }

    #[must_use]
    pub fn calculate_manifest_digest(&self) -> String {
        let mut hash = FNV_OFFSET_BASIS;
        hash = hash_text(hash, &self.schema_version);
        hash = hash_text(hash, &self.save_id);
        hash = hash_text(hash, &self.world_id);
        hash = hash_optional_text(hash, self.created_at_utc.as_deref());
        hash = hash_u64(hash, self.world_tick);
        hash = hash_text(hash, &self.code_build_id);
        hash = hash_text(hash, &self.configuration_hash);
        hash = hash_u64(hash, self.module_manifests.len() as u64);
        for module in &self.module_manifests {
            hash = hash_text(hash, &module.module_id);
            hash = hash_text(hash, &module.module_version);
            hash = hash_text(hash, &module.schema_version);
            hash = hash_text(hash, &module.state_digest);
            hash = hash_u64(hash, module.record_count);
        }
        hash = hash_u64(hash, self.random_state.world_seed);
        hash = hash_u64(hash, self.random_state.stream_count);
        hash = hash_u64(hash, self.random_state.global_draw_count);
        hash = match self.event_position.last_event_id {
            Some(event_id) => hash_u64(hash_u8(hash, 1), event_id),
            None => hash_u8(hash, 0),
        };
        hash = hash_u64(hash, self.event_position.event_count);
        hash = hash_u64(hash, self.intervention_count);
        hash = hash_text(hash, &self.kernel_state.schema_version);
        hash = hash_u64(hash, self.kernel_state.tick);
        hash = hash_u64(hash, self.kernel_state.world_seed);
        hash = hash_u8(hash, u8::from(self.kernel_state.running));
        hash = hash_text(hash, &self.kernel_state.deterministic_digest);
        format!("{hash:016x}")
    }
}

const FNV_OFFSET_BASIS: u64 = 0xcbf2_9ce4_8422_2325;
const FNV_PRIME: u64 = 0x0000_0100_0000_01b3;

fn expected_world_id(world_seed: u64) -> String {
    format!("world-{world_seed:016x}")
}

fn expected_save_id(world_seed: u64, world_tick: u64) -> String {
    format!("save-{world_seed:016x}-{world_tick:016x}")
}

fn configuration_hash(world_seed: u64) -> String {
    format!("{:016x}", hash_u64(FNV_OFFSET_BASIS, world_seed))
}

fn validate_digest(field: &'static str, value: &str) -> Result<(), WorldSaveValidationError> {
    if value.len() == 16 && value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        Ok(())
    } else {
        Err(WorldSaveValidationError::InvalidDigest {
            field,
            value: value.to_owned(),
        })
    }
}

fn hash_optional_text(mut hash: u64, value: Option<&str>) -> u64 {
    match value {
        Some(text) => {
            hash = hash_u8(hash, 1);
            hash_text(hash, text)
        }
        None => hash_u8(hash, 0),
    }
}

fn hash_text(mut hash: u64, value: &str) -> u64 {
    hash = hash_u64(hash, value.len() as u64);
    hash_bytes(hash, value.as_bytes())
}

fn hash_u64(hash: u64, value: u64) -> u64 {
    hash_bytes(hash, &value.to_le_bytes())
}

fn hash_u8(hash: u64, value: u8) -> u64 {
    hash_bytes(hash, &[value])
}

fn hash_bytes(mut hash: u64, bytes: &[u8]) -> u64 {
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    hash
}

#[cfg(test)]
mod tests {
    use super::{WorldSaveManifest, WorldSaveValidationError};

    #[test]
    fn kernel_world_save_round_trips_through_json() {
        let save =
            WorldSaveManifest::kernel(10_000, 42, true, "40885885fe2db25d".to_owned(), "0.0.1");
        save.validate().expect("world save should be valid");

        let json = serde_json::to_string(&save).expect("world save should serialize");
        let restored: WorldSaveManifest =
            serde_json::from_str(&json).expect("world save should deserialize");

        assert_eq!(restored, save);
        restored.validate().expect("restored save should validate");
    }

    #[test]
    fn tick_mismatch_is_rejected() {
        let mut save =
            WorldSaveManifest::kernel(10_000, 42, true, "40885885fe2db25d".to_owned(), "0.0.1");
        save.kernel_state.tick = 9_999;

        assert!(matches!(
            save.validate(),
            Err(WorldSaveValidationError::TickMismatch { .. })
        ));
    }

    #[test]
    fn manifest_tampering_is_rejected() {
        let mut save =
            WorldSaveManifest::kernel(10_000, 42, true, "40885885fe2db25d".to_owned(), "0.0.1");
        save.intervention_count = 1;

        assert!(matches!(
            save.validate(),
            Err(WorldSaveValidationError::ManifestDigestMismatch { .. })
        ));
    }
}
