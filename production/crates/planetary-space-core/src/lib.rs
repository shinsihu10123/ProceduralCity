#![forbid(unsafe_code)]
//! Frozen WP-003 / S1.04 Planetary Continuous Space.

use gaonn_world_core::ValidationReceipt;
use std::collections::BTreeMap;

pub const SCHEMA_VERSION: u32 = 1;
pub const OWNER: &str = "domain26.planetary_space";
pub const MEMBER_IDS: [&str; 11] = [
    "S1.04.01", "S1.04.02", "S1.04.03", "S1.04.04", "S1.04.05", "S1.04.06", "S1.04.07", "S1.04.08",
    "S1.04.09", "S1.04.10", "S1.04.11",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Face { PosX, NegX, PosY, NegY, PosZ, NegZ }
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Origin { OwningResolver, Derived, Observer, Renderer }
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerticalClass { Subsurface, Surface, Altitude }
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Position { pub u: f64, pub v: f64, pub height: f64 }
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct CellAddress { pub face: Face, pub level: u8, pub x: u32, pub y: u32 }
#[derive(Debug, Clone, PartialEq)]
pub struct SpatialRecord {
    pub stable_id: String, pub namespace: String, pub version: u32, pub owner: String,
    pub causal_parent: String, pub cell: CellAddress, pub position: Position, pub lineage: String,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SpaceError {
    InvalidPredecessor, StaleVersion, WrongOwner, UnauthorizedWrite, InvalidCell, InvalidPosition,
    DuplicateId, DanglingId, MissingEvidence(&'static str), Serialization,
}

pub fn admit(root: &ValidationReceipt) -> Result<(), SpaceError> {
    if root.work_id != "S1.01.01" || root.contract_version != 1 { return Err(SpaceError::InvalidPredecessor); }
    Ok(())
}
pub fn validate_authority(owner: &str, origin: Origin) -> Result<(), SpaceError> {
    if owner != OWNER { return Err(SpaceError::WrongOwner); }
    if origin != Origin::OwningResolver { return Err(SpaceError::UnauthorizedWrite); }
    Ok(())
}
pub fn validate_cell(c: CellAddress) -> Result<(), SpaceError> {
    if c.level > 30 { return Err(SpaceError::InvalidCell); }
    let n = 1u32.checked_shl(c.level as u32).ok_or(SpaceError::InvalidCell)?;
    if c.x >= n || c.y >= n { return Err(SpaceError::InvalidCell); }
    Ok(())
}
pub fn validate_position(p: Position) -> Result<(), SpaceError> {
    if !p.u.is_finite() || !p.v.is_finite() || !p.height.is_finite() || p.u < 0.0 || p.u > 1.0 || p.v < 0.0 || p.v > 1.0 { return Err(SpaceError::InvalidPosition); }
    Ok(())
}
pub fn vertical_class(height: f64) -> VerticalClass {
    if height < 0.0 { VerticalClass::Subsurface } else if height == 0.0 { VerticalClass::Surface } else { VerticalClass::Altitude }
}

/// S1.04.04: deterministic edge handoff. Interior cells have no cross-face neighbor.
pub fn cross_face_neighbor(c: CellAddress, dx: i8, dy: i8) -> Result<CellAddress, SpaceError> {
    validate_cell(c)?;
    let n = 1u32 << c.level;
    let nx = c.x as i64 + dx as i64;
    let ny = c.y as i64 + dy as i64;
    if nx >= 0 && ny >= 0 && nx < n as i64 && ny < n as i64 {
        return Ok(CellAddress { face: c.face, level: c.level, x: nx as u32, y: ny as u32 });
    }
    if dx.abs() as i16 + dy.abs() as i16 != 1 { return Err(SpaceError::InvalidCell); };
    let (face, x, y) = match (c.face, dx, dy) {
        (Face::PosX, 1, 0) => (Face::NegZ, 0, c.y), (Face::PosX, -1, 0) => (Face::PosZ, n - 1, c.y),
        (Face::NegX, 1, 0) => (Face::PosZ, 0, c.y), (Face::NegX, -1, 0) => (Face::NegZ, n - 1, c.y),
        (Face::PosZ, 1, 0) => (Face::PosX, 0, c.y), (Face::PosZ, -1, 0) => (Face::NegX, n - 1, c.y),
        (Face::NegZ, 1, 0) => (Face::NegX, 0, c.y), (Face::NegZ, -1, 0) => (Face::PosX, n - 1, c.y),
        (Face::PosY, 0, 1) => (Face::NegZ, c.x, 0), (Face::PosY, 0, -1) => (Face::PosZ, c.x, n - 1),
        (Face::NegY, 0, 1) => (Face::PosZ, c.x, 0), (Face::NegY, 0, -1) => (Face::NegZ, c.x, n - 1),
        _ => return Err(SpaceError::InvalidCell),
    };
    Ok(CellAddress { face, level: c.level, x, y })
}

fn face_vector(face: Face, u: f64, v: f64) -> [f64; 3] {
    let a = 2.0 * u - 1.0; let b = 2.0 * v - 1.0;
    match face { Face::PosX => [1.0,b,-a], Face::NegX => [-1.0,b,a], Face::PosY => [a,1.0,-b], Face::NegY => [a,-1.0,b], Face::PosZ => [a,b,1.0], Face::NegZ => [-a,b,-1.0] }
}
fn unit(v: [f64; 3]) -> [f64; 3] {
    let n = (v[0]*v[0] + v[1]*v[1] + v[2]*v[2]).sqrt(); [v[0]/n, v[1]/n, v[2]/n]
}
pub fn geodesic(a: (Face, Position), b: (Face, Position), radius: f64) -> Result<(f64, [f64; 3]), SpaceError> {
    validate_position(a.1)?; validate_position(b.1)?;
    if !radius.is_finite() || radius <= 0.0 { return Err(SpaceError::InvalidPosition); }
    let av = unit(face_vector(a.0,a.1.u,a.1.v)); let bv = unit(face_vector(b.0,b.1.u,b.1.v));
    let dot = (av[0]*bv[0] + av[1]*bv[1] + av[2]*bv[2]).clamp(-1.0,1.0);
    Ok((radius * dot.acos(), [bv[0]-dot*av[0], bv[1]-dot*av[1], bv[2]-dot*av[2]]))
}
pub fn tangent_frame(face: Face, p: Position) -> Result<([f64;3],[f64;3],[f64;3]), SpaceError> {
    validate_position(p)?; let up = unit(face_vector(face,p.u,p.v));
    let seed = if up[2].abs() < 0.9 { [0.0,0.0,1.0] } else { [0.0,1.0,0.0] };
    let east = unit([seed[1]*up[2]-seed[2]*up[1], seed[2]*up[0]-seed[0]*up[2], seed[0]*up[1]-seed[1]*up[0]]);
    let north = [up[1]*east[2]-up[2]*east[1], up[2]*east[0]-up[0]*east[2], up[0]*east[1]-up[1]*east[0]];
    Ok((east,north,up))
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct SpatialIndex { records: BTreeMap<String, SpatialRecord> }
impl SpatialIndex {
    pub fn insert(&mut self, r: SpatialRecord, origin: Origin) -> Result<(), SpaceError> {
        validate_authority(&r.owner,origin)?; validate_cell(r.cell)?; validate_position(r.position)?;
        if r.version != SCHEMA_VERSION { return Err(SpaceError::StaleVersion); }
        if self.records.contains_key(&r.stable_id) { return Err(SpaceError::DuplicateId); }
        self.records.insert(r.stable_id.clone(),r); Ok(())
    }
    pub fn get(&self, id: &str) -> Result<&SpatialRecord, SpaceError> { self.records.get(id).ok_or(SpaceError::DanglingId) }
    pub fn retire(&mut self, id: &str, origin: Origin) -> Result<SpatialRecord, SpaceError> { validate_authority(OWNER,origin)?; self.records.remove(id).ok_or(SpaceError::DanglingId) }
    pub fn digest64(&self) -> u64 { fnv(format!("{:?}",self).as_bytes()) }
}

pub fn serialize(r: &SpatialRecord) -> String {
    format!("{}|{}|{}|{}|{}|{:?}|{}|{}|{}|{}|{}|{}", r.stable_id,r.namespace,r.version,r.owner,r.causal_parent,r.cell.face,r.cell.level,r.cell.x,r.cell.y,r.position.u,r.position.v,r.position.height)
}
pub fn deserialize(s: &str, lineage: &str) -> Result<SpatialRecord, SpaceError> {
    let f: Vec<_> = s.split('|').collect(); if f.len()!=12 { return Err(SpaceError::Serialization); };
    let face = match f[5] { "PosX"=>Face::PosX,"NegX"=>Face::NegX,"PosY"=>Face::PosY,"NegY"=>Face::NegY,"PosZ"=>Face::PosZ,"NegZ"=>Face::NegZ,_=>return Err(SpaceError::Serialization) };
    let r = SpatialRecord { stable_id:f[0].into(),namespace:f[1].into(),version:f[2].parse().map_err(|_|SpaceError::Serialization)?,owner:f[3].into(),causal_parent:f[4].into(),cell:CellAddress{face,level:f[6].parse().map_err(|_|SpaceError::Serialization)?,x:f[7].parse().map_err(|_|SpaceError::Serialization)?,y:f[8].parse().map_err(|_|SpaceError::Serialization)?},position:Position{u:f[9].parse().map_err(|_|SpaceError::Serialization)?,v:f[10].parse().map_err(|_|SpaceError::Serialization)?,height:f[11].parse().map_err(|_|SpaceError::Serialization)?},lineage:lineage.into() };
    validate_cell(r.cell)?; validate_position(r.position)?; Ok(r)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Acceptance { pub work_package: &'static str, pub member_ids: [&'static str;11], pub predecessor_digest: u64, pub evidence_digest: u64, pub closed: bool }
pub fn accept(root: &ValidationReceipt, passes: &[bool;11], evidence: &[u64;11]) -> Result<Acceptance, SpaceError> {
    admit(root)?;
    if let Some(i)=passes.iter().position(|x| !*x) { return Err(SpaceError::MissingEvidence(MEMBER_IDS[i])); }
    if let Some(i)=evidence.iter().position(|x| *x==0) { return Err(SpaceError::MissingEvidence(MEMBER_IDS[i])); }
    Ok(Acceptance { work_package:"WP-003",member_ids:MEMBER_IDS,predecessor_digest:root.evidence_digest64(),evidence_digest:fnv(format!("{:?}{:?}",passes,evidence).as_bytes()),closed:true })
}
fn fnv(bytes: &[u8]) -> u64 { bytes.iter().fold(14695981039346656037u64, |h,b| (h ^ *b as u64).wrapping_mul(1099511628211)) }
