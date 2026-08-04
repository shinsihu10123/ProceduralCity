use std::fmt;

use crate::{
    PlanetSurfacePosition, SurfaceTileAddress, SurfaceTileError, SurfaceTileLocalPosition,
    TerrainChunk, TerrainChunkSpec, SURFACE_TILE_LOCAL_SCALE,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct TerrainSampleIndex {
    x: u32,
    z: u32,
}

impl TerrainSampleIndex {
    #[must_use]
    pub const fn new(x: u32, z: u32) -> Self {
        Self { x, z }
    }

    #[must_use]
    pub const fn x(self) -> u32 {
        self.x
    }

    #[must_use]
    pub const fn z(self) -> u32 {
        self.z
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TerrainChunkSurfaceAdapter {
    tile: SurfaceTileAddress,
    spec: TerrainChunkSpec,
}

impl TerrainChunkSurfaceAdapter {
    #[must_use]
    pub const fn new(tile: SurfaceTileAddress, spec: TerrainChunkSpec) -> Self {
        Self { tile, spec }
    }

    #[must_use]
    pub const fn tile(self) -> SurfaceTileAddress {
        self.tile
    }

    #[must_use]
    pub const fn spec(self) -> TerrainChunkSpec {
        self.spec
    }

    /// Converts one terrain sample index to normalized tile-local coordinates.
    ///
    /// # Errors
    ///
    /// Returns [`TerrainSurfaceError::SampleIndexOutOfRange`] when either index
    /// lies outside `0..=edge_cells`.
    pub fn local_position(
        self,
        index: TerrainSampleIndex,
    ) -> Result<SurfaceTileLocalPosition, TerrainSurfaceError> {
        let edge_cells = self.spec.edge_cells();
        if index.x > edge_cells || index.z > edge_cells {
            return Err(TerrainSurfaceError::SampleIndexOutOfRange);
        }
        let local_x = u64::from(index.x) * u64::from(SURFACE_TILE_LOCAL_SCALE)
            / u64::from(edge_cells);
        let local_z = u64::from(index.z) * u64::from(SURFACE_TILE_LOCAL_SCALE)
            / u64::from(edge_cells);
        SurfaceTileLocalPosition::new(
            u32::try_from(local_x).map_err(|_| TerrainSurfaceError::CoordinateOverflow)?,
            u32::try_from(local_z).map_err(|_| TerrainSurfaceError::CoordinateOverflow)?,
        )
        .map_err(Into::into)
    }

    /// Maps an explicit terrain sample elevation to the planet surface.
    ///
    /// # Errors
    ///
    /// Returns [`TerrainSurfaceError`] for an invalid sample index or an
    /// unexpected Cube-Sphere coordinate failure.
    pub fn surface_position(
        self,
        index: TerrainSampleIndex,
        elevation_mm: i64,
    ) -> Result<PlanetSurfacePosition, TerrainSurfaceError> {
        let local = self.local_position(index)?;
        self.tile
            .surface_position(local, elevation_mm)
            .map_err(Into::into)
    }

    /// Maps one sample from the supplied terrain chunk to the planet surface.
    ///
    /// # Errors
    ///
    /// Returns [`TerrainSurfaceError::ChunkSpecMismatch`] when the chunk uses a
    /// different sample grid, or [`TerrainSurfaceError::SampleIndexOutOfRange`]
    /// when the requested sample does not exist.
    pub fn terrain_sample_position(
        self,
        chunk: &TerrainChunk,
        index: TerrainSampleIndex,
    ) -> Result<PlanetSurfacePosition, TerrainSurfaceError> {
        if chunk.spec() != self.spec {
            return Err(TerrainSurfaceError::ChunkSpecMismatch);
        }
        let sample = chunk
            .sample_at(index.x, index.z)
            .ok_or(TerrainSurfaceError::SampleIndexOutOfRange)?;
        self.surface_position(index, i64::from(sample.height_mm()))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TerrainSurfaceError {
    ChunkSpecMismatch,
    SampleIndexOutOfRange,
    CoordinateOverflow,
    SurfaceTile(SurfaceTileError),
}

impl fmt::Display for TerrainSurfaceError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ChunkSpecMismatch => formatter.write_str(
                "terrain chunk specification does not match the surface adapter",
            ),
            Self::SampleIndexOutOfRange => {
                formatter.write_str("terrain sample index lies outside the chunk grid")
            }
            Self::CoordinateOverflow => {
                formatter.write_str("terrain sample coordinate conversion overflowed")
            }
            Self::SurfaceTile(error) => error.fmt(formatter),
        }
    }
}

impl std::error::Error for TerrainSurfaceError {}

impl From<SurfaceTileError> for TerrainSurfaceError {
    fn from(error: SurfaceTileError) -> Self {
        Self::SurfaceTile(error)
    }
}

#[cfg(test)]
mod tests {
    use super::{TerrainChunkSurfaceAdapter, TerrainSampleIndex, TerrainSurfaceError};
    use crate::{
        CubeFace, SurfaceEdge, SurfaceTileAddress, TerrainChunk, TerrainChunkCoord,
        TerrainChunkSpec, TerrainConfig, TerrainGenerator,
    };

    fn spec() -> TerrainChunkSpec {
        TerrainChunkSpec::new(32, 1_000).expect("test specification is valid")
    }

    #[test]
    fn sample_grid_corners_map_to_tile_corners() {
        let tile = SurfaceTileAddress::new(CubeFace::PositiveZ, 4, 7, 5)
            .expect("test tile is valid");
        let adapter = TerrainChunkSurfaceAdapter::new(tile, spec());
        let edge = spec().edge_cells();

        let southwest = adapter
            .local_position(TerrainSampleIndex::new(0, 0))
            .expect("southwest sample maps");
        let northeast = adapter
            .local_position(TerrainSampleIndex::new(edge, edge))
            .expect("northeast sample maps");

        assert_eq!(southwest.u_q30(), 0);
        assert_eq!(southwest.v_q30(), 0);
        assert_eq!(northeast.u_q30(), crate::SURFACE_TILE_LOCAL_SCALE);
        assert_eq!(northeast.v_q30(), crate::SURFACE_TILE_LOCAL_SCALE);
    }

    #[test]
    fn adjacent_tiles_share_every_boundary_sample() {
        let west_tile = SurfaceTileAddress::new(CubeFace::PositiveZ, 5, 14, 11)
            .expect("west tile is valid");
        let east_tile = west_tile.neighbour(SurfaceEdge::East);
        let west = TerrainChunkSurfaceAdapter::new(west_tile, spec());
        let east = TerrainChunkSurfaceAdapter::new(east_tile, spec());
        let edge = spec().edge_cells();

        for offset in 0..=edge {
            let source = west
                .surface_position(TerrainSampleIndex::new(edge, offset), 0)
                .expect("west boundary maps");
            let target = east
                .surface_position(TerrainSampleIndex::new(0, offset), 0)
                .expect("east boundary maps");
            assert_eq!(source, target);
        }
    }

    #[test]
    fn cube_face_boundary_samples_share_spherical_positions() {
        let level = 5;
        let last = (1_u32 << level) - 1;
        let source_tile = SurfaceTileAddress::new(CubeFace::PositiveZ, level, last, 9)
            .expect("source tile is valid");
        let target_tile = source_tile.neighbour(SurfaceEdge::East);
        let source = TerrainChunkSurfaceAdapter::new(source_tile, spec());
        let target = TerrainChunkSurfaceAdapter::new(target_tile, spec());
        let edge = spec().edge_cells();

        for offset in 0..=edge {
            let source_direction = source
                .surface_position(TerrainSampleIndex::new(edge, offset), 0)
                .expect("source boundary maps")
                .unit_direction_q30();
            let target_direction = target
                .surface_position(TerrainSampleIndex::new(0, offset), 0)
                .expect("target boundary maps")
                .unit_direction_q30();
            assert_eq!(source_direction, target_direction);
        }
    }

    #[test]
    fn generated_terrain_sample_uses_its_authoritative_elevation() {
        let generator = TerrainGenerator::new(42, TerrainConfig::default());
        let chunk = TerrainChunk::generate(generator, TerrainChunkCoord::new(0, 0), spec())
            .expect("terrain chunk generates");
        let tile = SurfaceTileAddress::new(CubeFace::PositiveZ, 5, 16, 16)
            .expect("test tile is valid");
        let adapter = TerrainChunkSurfaceAdapter::new(tile, spec());
        let index = TerrainSampleIndex::new(7, 11);
        let position = adapter
            .terrain_sample_position(&chunk, index)
            .expect("terrain sample maps");
        let sample = chunk.sample_at(7, 11).expect("sample exists");

        assert_eq!(position.elevation_mm(), i64::from(sample.height_mm()));
    }

    #[test]
    fn invalid_indices_and_specs_are_rejected() {
        let tile = SurfaceTileAddress::new(CubeFace::PositiveZ, 1, 0, 0)
            .expect("test tile is valid");
        let adapter = TerrainChunkSurfaceAdapter::new(tile, spec());
        assert_eq!(
            adapter.local_position(TerrainSampleIndex::new(spec().edge_cells() + 1, 0)),
            Err(TerrainSurfaceError::SampleIndexOutOfRange)
        );

        let other_spec = TerrainChunkSpec::new(16, 1_000).expect("other spec is valid");
        let generator = TerrainGenerator::new(7, TerrainConfig::default());
        let chunk = TerrainChunk::generate(generator, TerrainChunkCoord::new(0, 0), other_spec)
            .expect("terrain chunk generates");
        assert_eq!(
            adapter.terrain_sample_position(&chunk, TerrainSampleIndex::new(0, 0)),
            Err(TerrainSurfaceError::ChunkSpecMismatch)
        );
    }
}
