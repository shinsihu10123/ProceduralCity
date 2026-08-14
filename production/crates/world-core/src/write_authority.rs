//! Frozen L3 `S1.01.04 Canonical Write Authority 선언 규칙`.
//!
//! The rule links one declared write interface to the current semantic owner in the Authority
//! Registry. A successful declaration is only a versioned validation receipt; it is not a
//! canonical commit capability by itself.

use std::collections::BTreeMap;
use std::fmt;

use crate::authority::{
    AuthorityRecordId, AuthorityReference, AuthorityRegistry, AuthorityRegistryError,
};
use crate::boundary::{BoundaryResult, StateLayer};

pub const S1_01_04_DECLARATION_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WriteInterfaceBinding {
    pub interface_id: String,
    pub authority_id: AuthorityRecordId,
    pub owner: String,
    pub writer: String,
    pub version: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct WriteInterfaceCatalogSnapshot {
    pub bindings: Vec<WriteInterfaceBinding>,
}

impl WriteInterfaceCatalogSnapshot {
    pub fn evidence_digest64(&self) -> u64 {
        let mut encoded = String::new();
        for binding in &self.bindings {
            encoded.push_str(&format!(
                "{}|{}|{}|{}|{}|{}\n",
                binding.interface_id,
                binding.authority_id.namespace,
                binding.authority_id.local_id,
                binding.owner,
                binding.writer,
                binding.version
            ));
        }
        fnv1a64(encoded.as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct WriteInterfaceCatalog {
    bindings: BTreeMap<String, WriteInterfaceBinding>,
}

impl WriteInterfaceCatalog {
    pub fn register(&mut self, binding: WriteInterfaceBinding) -> Result<(), WriteAuthorityError> {
        required_text(Some(binding.interface_id.as_str()), "interface_id")?;
        required_text(Some(binding.owner.as_str()), "interface_owner")?;
        required_text(Some(binding.writer.as_str()), "interface_writer")?;
        if binding.version == 0 {
            return Err(WriteAuthorityError::UnsupportedInterfaceVersion {
                interface_id: binding.interface_id,
                found: 0,
            });
        }
        if self.bindings.contains_key(&binding.interface_id) {
            return Err(WriteAuthorityError::DuplicateInterface(
                binding.interface_id,
            ));
        }
        self.bindings.insert(binding.interface_id.clone(), binding);
        Ok(())
    }

    pub fn get(&self, interface_id: &str) -> Option<&WriteInterfaceBinding> {
        self.bindings.get(interface_id)
    }

    pub fn snapshot(&self) -> WriteInterfaceCatalogSnapshot {
        WriteInterfaceCatalogSnapshot {
            bindings: self.bindings.values().cloned().collect(),
        }
    }

    pub fn restore(snapshot: WriteInterfaceCatalogSnapshot) -> Result<Self, WriteAuthorityError> {
        let mut catalog = Self::default();
        for binding in snapshot.bindings {
            catalog.register(binding)?;
        }
        Ok(catalog)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WriteAuthorityDeclaration {
    pub declaration_version: Option<u32>,
    pub fact_key: Option<String>,
    pub authority: Option<AuthorityReference>,
    pub owner: Option<String>,
    pub writer: Option<String>,
    pub interface_id: Option<String>,
    pub interface_version: Option<u32>,
    pub authority_epoch: Option<u64>,
    pub source_boundary: Option<BoundaryResult>,
    pub causal_parent: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WriteAuthorityReceipt {
    pub work_id: &'static str,
    pub declaration_version: u32,
    pub fact_key: String,
    pub authority: AuthorityReference,
    pub owner: String,
    pub writer: String,
    pub interface_id: String,
    pub interface_version: u32,
    pub authority_epoch: u64,
    pub causal_parent: String,
    pub operands: [&'static str; 5],
}

impl WriteAuthorityReceipt {
    pub fn evidence_digest64(&self) -> u64 {
        let encoded = format!(
            "{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}",
            self.work_id,
            self.declaration_version,
            self.fact_key,
            self.authority.id.namespace,
            self.authority.id.local_id,
            self.authority.version,
            self.owner,
            self.writer,
            self.interface_id,
            self.interface_version,
            self.authority_epoch,
            self.causal_parent
        );
        fnv1a64(encoded.as_bytes())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WriteAuthorityError {
    MissingField(&'static str),
    EmptyField(&'static str),
    UnsupportedDeclarationVersion { expected: u32, found: u32 },
    UnsupportedInterfaceVersion { interface_id: String, found: u32 },
    DuplicateInterface(String),
    UnknownInterface(String),
    Authority(AuthorityRegistryError),
    NonCanonicalSourceLayer(StateLayer),
    FactMismatch { expected: String, found: String },
    AuthorityReferenceMismatch,
    WrongOwner { expected: String, found: String },
    WrongWriter { expected: String, found: String },
    StaleAuthorityEpoch { expected: u64, found: u64 },
    InterfaceAuthorityMismatch,
    InterfaceOwnerMismatch,
    InterfaceWriterMismatch,
    InterfaceVersionMismatch { expected: u32, found: u32 },
}

impl fmt::Display for WriteAuthorityError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingField(field) => write!(f, "missing write-authority field: {field}"),
            Self::EmptyField(field) => write!(f, "empty write-authority field: {field}"),
            Self::UnsupportedDeclarationVersion { expected, found } => write!(
                f,
                "unsupported declaration version: expected={expected}, found={found}"
            ),
            Self::UnsupportedInterfaceVersion {
                interface_id,
                found,
            } => write!(
                f,
                "unsupported write interface version: interface={interface_id}, found={found}"
            ),
            Self::DuplicateInterface(interface_id) => {
                write!(f, "duplicate write interface: {interface_id}")
            }
            Self::UnknownInterface(interface_id) => {
                write!(f, "unregistered write interface: {interface_id}")
            }
            Self::Authority(error) => write!(f, "authority validation failed: {error}"),
            Self::NonCanonicalSourceLayer(layer) => {
                write!(
                    f,
                    "non-canonical source cannot declare canonical writer: {layer:?}"
                )
            }
            Self::FactMismatch { expected, found } => {
                write!(f, "fact mismatch: expected={expected}, found={found}")
            }
            Self::AuthorityReferenceMismatch => write!(f, "authority reference mismatch"),
            Self::WrongOwner { expected, found } => {
                write!(f, "wrong owner: expected={expected}, found={found}")
            }
            Self::WrongWriter { expected, found } => {
                write!(f, "wrong writer: expected={expected}, found={found}")
            }
            Self::StaleAuthorityEpoch { expected, found } => {
                write!(
                    f,
                    "stale authority epoch: expected={expected}, found={found}"
                )
            }
            Self::InterfaceAuthorityMismatch => write!(f, "write interface authority mismatch"),
            Self::InterfaceOwnerMismatch => write!(f, "write interface owner mismatch"),
            Self::InterfaceWriterMismatch => write!(f, "write interface writer mismatch"),
            Self::InterfaceVersionMismatch { expected, found } => write!(
                f,
                "write interface version mismatch: expected={expected}, found={found}"
            ),
        }
    }
}

impl std::error::Error for WriteAuthorityError {}

impl From<AuthorityRegistryError> for WriteAuthorityError {
    fn from(value: AuthorityRegistryError) -> Self {
        Self::Authority(value)
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct CanonicalWriteAuthorityRule;

impl CanonicalWriteAuthorityRule {
    pub fn declare(
        &self,
        registry: &AuthorityRegistry,
        interfaces: &WriteInterfaceCatalog,
        declaration: &WriteAuthorityDeclaration,
    ) -> Result<WriteAuthorityReceipt, WriteAuthorityError> {
        let declaration_version = declaration
            .declaration_version
            .ok_or(WriteAuthorityError::MissingField("declaration_version"))?;
        if declaration_version != S1_01_04_DECLARATION_VERSION {
            return Err(WriteAuthorityError::UnsupportedDeclarationVersion {
                expected: S1_01_04_DECLARATION_VERSION,
                found: declaration_version,
            });
        }

        let fact_key = required_text(declaration.fact_key.as_deref(), "fact_key")?;
        let authority_ref = declaration
            .authority
            .as_ref()
            .ok_or(WriteAuthorityError::MissingField("authority"))?;
        let owner = required_text(declaration.owner.as_deref(), "owner")?;
        let writer = required_text(declaration.writer.as_deref(), "writer")?;
        let interface_id = required_text(declaration.interface_id.as_deref(), "interface_id")?;
        let interface_version = declaration
            .interface_version
            .ok_or(WriteAuthorityError::MissingField("interface_version"))?;
        let authority_epoch = declaration
            .authority_epoch
            .ok_or(WriteAuthorityError::MissingField("authority_epoch"))?;
        let boundary = declaration
            .source_boundary
            .as_ref()
            .ok_or(WriteAuthorityError::MissingField("source_boundary"))?;
        let causal_parent = required_text(declaration.causal_parent.as_deref(), "causal_parent")?;

        if boundary.layer != StateLayer::Canonical {
            return Err(WriteAuthorityError::NonCanonicalSourceLayer(boundary.layer));
        }
        if boundary.state_key != fact_key {
            return Err(WriteAuthorityError::FactMismatch {
                expected: boundary.state_key.clone(),
                found: fact_key.to_owned(),
            });
        }
        if boundary.source.authority != *authority_ref {
            return Err(WriteAuthorityError::AuthorityReferenceMismatch);
        }

        let authority = registry.resolve_active(authority_ref)?;
        if authority.fact_key != fact_key {
            return Err(WriteAuthorityError::FactMismatch {
                expected: authority.fact_key.clone(),
                found: fact_key.to_owned(),
            });
        }
        if authority.owner != owner {
            return Err(WriteAuthorityError::WrongOwner {
                expected: authority.owner.clone(),
                found: owner.to_owned(),
            });
        }
        if authority.allowed_writer != writer {
            return Err(WriteAuthorityError::WrongWriter {
                expected: authority.allowed_writer.clone(),
                found: writer.to_owned(),
            });
        }
        if authority.authority_epoch != authority_epoch {
            return Err(WriteAuthorityError::StaleAuthorityEpoch {
                expected: authority.authority_epoch,
                found: authority_epoch,
            });
        }
        if boundary.owner != owner || boundary.allowed_writer.as_deref() != Some(writer) {
            return Err(WriteAuthorityError::AuthorityReferenceMismatch);
        }

        let interface = interfaces
            .get(interface_id)
            .ok_or_else(|| WriteAuthorityError::UnknownInterface(interface_id.to_owned()))?;
        if interface.authority_id != authority_ref.id {
            return Err(WriteAuthorityError::InterfaceAuthorityMismatch);
        }
        if interface.owner != owner {
            return Err(WriteAuthorityError::InterfaceOwnerMismatch);
        }
        if interface.writer != writer {
            return Err(WriteAuthorityError::InterfaceWriterMismatch);
        }
        if interface.version != interface_version {
            return Err(WriteAuthorityError::InterfaceVersionMismatch {
                expected: interface.version,
                found: interface_version,
            });
        }

        Ok(WriteAuthorityReceipt {
            work_id: "S1.01.04",
            declaration_version,
            fact_key: fact_key.to_owned(),
            authority: authority_ref.clone(),
            owner: owner.to_owned(),
            writer: writer.to_owned(),
            interface_id: interface_id.to_owned(),
            interface_version,
            authority_epoch,
            causal_parent: causal_parent.to_owned(),
            operands: ["Canonical", "Write", "Authority", "선언", "Registry"],
        })
    }
}

fn required_text<'a>(
    value: Option<&'a str>,
    field: &'static str,
) -> Result<&'a str, WriteAuthorityError> {
    let value = value.ok_or(WriteAuthorityError::MissingField(field))?;
    if value.trim().is_empty() {
        return Err(WriteAuthorityError::EmptyField(field));
    }
    Ok(value)
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
