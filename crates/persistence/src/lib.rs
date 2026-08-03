#![forbid(unsafe_code)]

use artificial_world_contracts::{RenderSnapshot, WorldSaveManifest};
use serde::{de::DeserializeOwned, Serialize};
use std::{
    error::Error,
    fmt, fs,
    io::Write,
    path::{Path, PathBuf},
};

#[derive(Debug)]
pub enum PersistenceError {
    Validation(String),
    Serialization(String),
    Deserialization(String),
    Io {
        operation: &'static str,
        path: PathBuf,
        source: std::io::Error,
    },
}

impl fmt::Display for PersistenceError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Validation(message) => {
                write!(formatter, "persistence validation failed: {message}")
            }
            Self::Serialization(message) => {
                write!(formatter, "persistence serialization failed: {message}")
            }
            Self::Deserialization(message) => {
                write!(formatter, "persistence deserialization failed: {message}")
            }
            Self::Io {
                operation,
                path,
                source,
            } => write!(
                formatter,
                "persistence I/O failed during {operation} for {}: {source}",
                path.display()
            ),
        }
    }
}

impl Error for PersistenceError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Io { source, .. } => Some(source),
            Self::Validation(_) | Self::Serialization(_) | Self::Deserialization(_) => None,
        }
    }
}

/// Writes a validated RenderSnapshot using a temporary file and atomic rename.
///
/// # Errors
///
/// Returns [`PersistenceError`] when validation, serialization, directory
/// creation, file synchronization, or rename fails.
pub fn write_render_snapshot(
    path: &Path,
    snapshot: &RenderSnapshot,
) -> Result<(), PersistenceError> {
    snapshot
        .validate()
        .map_err(|error| PersistenceError::Validation(error.to_string()))?;
    write_json_transactional(path, snapshot)
}

/// Writes a validated World Save using a temporary file and atomic rename.
///
/// # Errors
///
/// Returns [`PersistenceError`] when validation, serialization, directory
/// creation, file synchronization, or rename fails.
pub fn write_world_save(path: &Path, save: &WorldSaveManifest) -> Result<(), PersistenceError> {
    save.validate()
        .map_err(|error| PersistenceError::Validation(error.to_string()))?;
    write_json_transactional(path, save)
}

/// Reads and validates a versioned World Save.
///
/// # Errors
///
/// Returns [`PersistenceError`] when the file cannot be read, JSON cannot be
/// decoded, or the save contract is invalid.
pub fn read_world_save(path: &Path) -> Result<WorldSaveManifest, PersistenceError> {
    let save: WorldSaveManifest = read_json(path)?;
    save.validate()
        .map_err(|error| PersistenceError::Validation(error.to_string()))?;
    Ok(save)
}

fn write_json_transactional<T: Serialize>(path: &Path, value: &T) -> Result<(), PersistenceError> {
    ensure_parent_directory(path)?;

    let bytes = serde_json::to_vec_pretty(value)
        .map_err(|error| PersistenceError::Serialization(error.to_string()))?;
    let temporary_path = temporary_path(path);

    let mut file = fs::File::create(&temporary_path).map_err(|source| PersistenceError::Io {
        operation: "create temporary file",
        path: temporary_path.clone(),
        source,
    })?;
    file.write_all(&bytes)
        .map_err(|source| PersistenceError::Io {
            operation: "write temporary file",
            path: temporary_path.clone(),
            source,
        })?;
    file.sync_all().map_err(|source| PersistenceError::Io {
        operation: "synchronize temporary file",
        path: temporary_path.clone(),
        source,
    })?;
    drop(file);

    fs::rename(&temporary_path, path).map_err(|source| PersistenceError::Io {
        operation: "commit transactional file",
        path: path.to_path_buf(),
        source,
    })?;

    Ok(())
}

fn read_json<T: DeserializeOwned>(path: &Path) -> Result<T, PersistenceError> {
    let bytes = fs::read(path).map_err(|source| PersistenceError::Io {
        operation: "read file",
        path: path.to_path_buf(),
        source,
    })?;
    serde_json::from_slice(&bytes)
        .map_err(|error| PersistenceError::Deserialization(error.to_string()))
}

fn ensure_parent_directory(path: &Path) -> Result<(), PersistenceError> {
    let Some(parent) = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    else {
        return Ok(());
    };

    fs::create_dir_all(parent).map_err(|source| PersistenceError::Io {
        operation: "create parent directory",
        path: parent.to_path_buf(),
        source,
    })
}

fn temporary_path(path: &Path) -> PathBuf {
    let mut extension = path
        .extension()
        .map_or_else(String::new, |value| value.to_string_lossy().into_owned());
    if !extension.is_empty() {
        extension.push('.');
    }
    extension.push_str("tmp");
    path.with_extension(extension)
}

#[cfg(test)]
mod tests {
    use super::{read_world_save, write_world_save};
    use artificial_world_contracts::WorldSaveManifest;
    use std::{fs, path::PathBuf, process};

    fn test_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "artificial-world-{name}-{}-{}.json",
            process::id(),
            std::thread::current().name().unwrap_or("unnamed")
        ))
    }

    #[test]
    fn world_save_round_trip_preserves_manifest() {
        let path = test_path("round-trip");
        let save =
            WorldSaveManifest::kernel(10_000, 42, true, "40885885fe2db25d".to_owned(), "0.0.1");

        write_world_save(&path, &save).expect("world save should be written");
        let restored = read_world_save(&path).expect("world save should be restored");

        assert_eq!(restored, save);
        fs::remove_file(path).expect("temporary test save should be removed");
    }
}
