//! Frozen L3 S1.02.08 Snapshot / Reload Identity Continuity.
use gaonn_cross_reference_core::{CrossReferenceIntegrityValidation, S1_02_07_OWNER};
use gaonn_identity_core::{IdentityDisposition, IdentityOperationPhase, IdentityOrigin};

pub const S1_02_08_SCHEMA_VERSION: u32 = 1;
pub const S1_02_08_OWNER: &str = S1_02_07_OWNER;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeBundle {
    pub committed_causal_cut: String,
    pub partition_state: String,
    pub scheduler_state: String,
    pub pending_state: String,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContinuityRequest {
    pub schema_version: u32,
    pub owner: String,
    pub writer: String,
    pub origin: IdentityOrigin,
    pub phase: IdentityOperationPhase,
    pub snapshot_id: String,
    pub reload_id: String,
    pub stable_id: String,
    pub namespace: String,
    pub namespace_version: String,
    pub entity_version: u32,
    pub lifecycle_lineage: String,
    pub causal_parent: String,
    pub bundle: RuntimeBundle,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContinuityEvidence {
    pub work_id: &'static str,
    pub stable_id: String,
    pub namespace: String,
    pub namespace_version: String,
    pub entity_version: u32,
    pub lifecycle_lineage: String,
    pub snapshot_id: String,
    pub reload_id: String,
    pub committed_causal_cut: String,
    pub partition_state: String,
    pub scheduler_state: String,
    pub pending_state: String,
    pub causal_parent: String,
    pub predecessor_digest: u64,
    pub disposition: IdentityDisposition,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ContinuityError {
    InvalidPredecessor,
    Missing(&'static str),
    StaleVersion,
    WrongOwner,
    WrongWriter,
    UnauthorizedOrigin,
    Incomplete,
    IdentityMismatch(&'static str),
}

pub fn validate(
    req: &ContinuityRequest,
    pred: &CrossReferenceIntegrityValidation,
) -> Result<ContinuityEvidence, ContinuityError> {
    if pred.work_id != "S1.02.07"
        || pred.work_package != "WP-002"
        || pred.disposition != IdentityDisposition::CandidateOnly
    {
        return Err(ContinuityError::InvalidPredecessor);
    }
    if req.schema_version != S1_02_08_SCHEMA_VERSION {
        return Err(ContinuityError::StaleVersion);
    }
    for (v, n) in [
        (&req.snapshot_id, "snapshot_id"),
        (&req.reload_id, "reload_id"),
        (&req.causal_parent, "causal_parent"),
        (&req.bundle.committed_causal_cut, "committed_causal_cut"),
        (&req.bundle.partition_state, "partition_state"),
        (&req.bundle.scheduler_state, "scheduler_state"),
        (&req.bundle.pending_state, "pending_state"),
    ] {
        if v.trim().is_empty() {
            return Err(ContinuityError::Missing(n));
        }
    }
    if req.owner != S1_02_08_OWNER {
        return Err(ContinuityError::WrongOwner);
    }
    if req.writer != req.owner {
        return Err(ContinuityError::WrongWriter);
    }
    if req.origin != IdentityOrigin::OwningResolver {
        return Err(ContinuityError::UnauthorizedOrigin);
    }
    if req.phase != IdentityOperationPhase::Complete {
        return Err(ContinuityError::Incomplete);
    }
    if req.stable_id != pred.target_stable_id {
        return Err(ContinuityError::IdentityMismatch("stable_id"));
    }
    if req.namespace != pred.target_namespace {
        return Err(ContinuityError::IdentityMismatch("namespace"));
    }
    if req.namespace_version != pred.target_namespace_version {
        return Err(ContinuityError::IdentityMismatch("namespace_version"));
    }
    if req.entity_version != pred.target_entity_version {
        return Err(ContinuityError::IdentityMismatch("entity_version"));
    }
    if req.lifecycle_lineage != pred.target_lifecycle_lineage {
        return Err(ContinuityError::IdentityMismatch("lifecycle_lineage"));
    }
    Ok(ContinuityEvidence {
        work_id: "S1.02.08",
        stable_id: req.stable_id.clone(),
        namespace: req.namespace.clone(),
        namespace_version: req.namespace_version.clone(),
        entity_version: req.entity_version,
        lifecycle_lineage: req.lifecycle_lineage.clone(),
        snapshot_id: req.snapshot_id.clone(),
        reload_id: req.reload_id.clone(),
        committed_causal_cut: req.bundle.committed_causal_cut.clone(),
        partition_state: req.bundle.partition_state.clone(),
        scheduler_state: req.bundle.scheduler_state.clone(),
        pending_state: req.bundle.pending_state.clone(),
        causal_parent: req.causal_parent.clone(),
        predecessor_digest: pred.evidence_digest64(),
        disposition: IdentityDisposition::CandidateOnly,
    })
}
impl ContinuityEvidence {
    pub fn digest64(&self) -> u64 {
        let s = format!("{:?}", self);
        s.bytes().fold(14695981039346656037u64, |h, b| {
            (h ^ b as u64).wrapping_mul(1099511628211)
        })
    }
    pub fn reload(&self) -> Result<Self, ContinuityError> {
        if self.stable_id.is_empty() || self.committed_causal_cut.is_empty() {
            Err(ContinuityError::Missing("persisted_identity"))
        } else {
            Ok(self.clone())
        }
    }
}
