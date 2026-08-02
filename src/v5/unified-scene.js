import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clamp, clamp01, createRandom, hashString, lerp } from '../v3/core.js';

export const WORLD_UNITS_PER_KM = 10;
export const METRES_PER_WORLD_UNIT = 100;

const BIOME_COLORS = [
  0x315d6b, 0x8a918b, 0x4c6555, 0x506e48, 0x7b8451,
  0xb2975c, 0x8c8950, 0x416a48, 0x858783, 0x4d7062,
];

const FLOW_COLORS = Object.freeze({
  food: 0xd7bd69,
  timber: 0x9c744a,
  stone: 0xa8a39a,
  metal: 0xb5bac1,
  craft: 0xc38a62,
  fuel: 0x5d5650,
  traffic: 0xe5e0d2,
  migration: 0x65aadb,
  army: 0xd74e3f,
});

const ROUTE_STYLES = Object.freeze({
  trail: { width: 0.025, color: 0x75634b, roughness: 1 },
  'cart-track': { width: 0.050, color: 0x796b59, roughness: 0.96 },
  'paved-road': { width: 0.085, color: 0x6b6b67, roughness: 0.92 },
  'motor-road': { width: 0.125, color: 0x55595b, roughness: 0.84 },
  rail: { width: 0.072, color: 0x3e4142, roughness: 0.72, metalness: 0.32 },
  coastal: { width: 0.055, color: 0x78a9b5, roughness: 0.28, transparent: true },
  ocean: { width: 0.070, color: 0x6f9daa, roughness: 0.24, transparent: true },
});

function renderSize(world) { return world.spanKm * WORLD_UNITS_PER_KM; }

export function sampleElevation(world, cellX, cellZ) {
  const x = clamp(cellX, 0, world.size - 1);
  const z = clamp(cellZ, 0, world.size - 1);
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = Math.min(world.size - 1, x0 + 1);
  const z1 = Math.min(world.size - 1, z0 + 1);
  const tx = x - x0;
  const tz = z - z0;
  const top = lerp(world.fields.elevation[z0 * world.size + x0], world.fields.elevation[z0 * world.size + x1], tx);
  const bottom = lerp(world.fields.elevation[z1 * world.size + x0], world.fields.elevation[z1 * world.size + x1], tx);
  return lerp(top, bottom, tz);
}

export function worldPosition(world, cellX, cellZ, extraY = 0) {
  const size = renderSize(world);
  return new THREE.Vector3(
    cellX / (world.size - 1) * size - size * 0.5,
    sampleElevation(world, cellX, cellZ) / METRES_PER_WORLD_UNIT + extraY,
    cellZ / (world.size - 1) * size - size * 0.5,
  );
}

function cellPosition(world, cellIndex, extraY = 0) {
  return worldPosition(world, cellIndex % world.size, Math.floor(cellIndex / world.size), extraY);
}

function createTerrain(world) {
  const size = renderSize(world);
  const segments = world.size - 1;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const gx = clamp(Math.round((x + size * 0.5) / size * segments), 0, segments);
    const gz = clamp(Math.round((z + size * 0.5) / size * segments), 0, segments);
    const cell = gz * world.size + gx;
    const elevation = world.fields.elevation[cell];
    positions.setY(index, elevation / METRES_PER_WORLD_UNIT);
    color.setHex(BIOME_COLORS[world.fields.biome[cell]] || BIOME_COLORS[4]);
    if (elevation > 0) {
      const height = clamp01(elevation / 3600);
      const moisture = clamp01(world.fields.precipitation[cell] / 1900);
      color.offsetHSL(0, moisture * 0.025 - 0.01, height * 0.17 - 0.025);
    } else color.multiplyScalar(0.65);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.0 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'single-continuous-terrain';
  return mesh;
}

function createOcean(world) {
  const size = renderSize(world) * 1.04;
  const geometry = new THREE.PlaneGeometry(size, size);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x376f7d,
    roughness: 0.20,
    metalness: 0.03,
    transmission: 0.06,
    transparent: true,
    opacity: 0.94,
    clearcoat: 0.72,
    clearcoatRoughness: 0.18,
    depthWrite: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0;
  mesh.receiveShadow = true;
  mesh.name = 'single-world-ocean';
  return mesh;
}

function createRivers(world) {
  const positions = [];
  const indices = [];
  let vertex = 0;
  for (let cell = 0; cell < world.fields.river.length; cell += 1) {
    const strength = world.fields.river[cell];
    const next = world.fields.downstream[cell];
    if (strength < 0.14 || next < 0 || world.fields.elevation[next] <= 0) continue;
    const a = cellPosition(world, cell, 0.035);
    const b = cellPosition(world, next, 0.035);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz) || 1;
    const width = 0.035 + strength * 0.72;
    const nx = -dz / length * width;
    const nz = dx / length * width;
    positions.push(
      a.x + nx, a.y, a.z + nz,
      a.x - nx, a.y, a.z - nz,
      b.x + nx, b.y, b.z + nz,
      b.x - nx, b.y, b.z - nz,
    );
    indices.push(vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3);
    vertex += 4;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x5f9eab,
    roughness: 0.25,
    clearcoat: 0.55,
    clearcoatRoughness: 0.2,
    transparent: true,
    opacity: 0.90,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;
  mesh.name = 'hydrologic-river-network';
  return mesh;
}

function createRoofGeometry() {
  const vertices = new Float32Array([
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0, 0.5, -0.5,
    -0.5, 0, 0.5, 0, 0.5, 0.5, 0.5, 0, 0.5,
  ]);
  const indices = [0, 1, 2, 3, 4, 5, 0, 2, 3, 3, 2, 4, 1, 5, 2, 2, 5, 4, 0, 3, 1, 1, 3, 5];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createSky() {
  const geometry = new THREE.SphereGeometry(42000, 24, 12);
  const material = new THREE.MeshBasicMaterial({ color: 0xa9bac0, side: THREE.BackSide, fog: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'atmosphere';
  return mesh;
}

class VegetationLayer {
  constructor(world) {
    this.world = world;
    const random = createRandom(hashString(`${world.seed}:v5-vegetation`));
    const capacity = 4200;
    const crownGeometry = new THREE.ConeGeometry(1, 1, 6);
    const trunkGeometry = new THREE.CylinderGeometry(1, 1, 1, 5);
    const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x3d5f42, roughness: 0.96, vertexColors: true });
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x694d34, roughness: 1 });
    this.crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, capacity);
    this.trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, capacity);
    this.crowns.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.trunks.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    let count = 0;
    for (let attempt = 0; attempt < capacity * 7 && count < capacity; attempt += 1) {
      const x = random() * (world.size - 1);
      const z = random() * (world.size - 1);
      const cellX = clamp(Math.round(x), 0, world.size - 1);
      const cellZ = clamp(Math.round(z), 0, world.size - 1);
      const cell = cellZ * world.size + cellX;
      if (world.fields.elevation[cell] <= 0) continue;
      const timber = world.resources.timber[cell];
      if (random() > timber * 0.86) continue;
      const base = worldPosition(world, x, z, 0);
      const height = 0.085 + random() * 0.17;
      const radius = height * (0.20 + random() * 0.12);
      position.set(base.x, base.y + height * 0.56, base.z);
      scale.set(radius, height * 0.76, radius);
      matrix.compose(position, quaternion.identity(), scale);
      this.crowns.setMatrixAt(count, matrix);
      color.setHSL(0.28 + random() * 0.055, 0.26 + random() * 0.15, 0.27 + random() * 0.11);
      this.crowns.setColorAt(count, color);
      position.y = base.y + height * 0.17;
      scale.set(radius * 0.20, height * 0.34, radius * 0.20);
      matrix.compose(position, quaternion.identity(), scale);
      this.trunks.setMatrixAt(count, matrix);
      count += 1;
    }
    this.crowns.count = count;
    this.trunks.count = count;
    this.crowns.instanceMatrix.needsUpdate = true;
    this.trunks.instanceMatrix.needsUpdate = true;
    if (this.crowns.instanceColor) this.crowns.instanceColor.needsUpdate = true;
    this.group = new THREE.Group();
    this.group.name = 'physical-vegetation';
    this.group.add(this.trunks, this.crowns);
  }

  dispose() {
    for (const mesh of [this.crowns, this.trunks]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}

class SettlementLayer {
  constructor(world) {
    this.world = world;
    this.maxBuildings = 6200;
    this.maxCommunities = 128;
    this.group = new THREE.Group();
    this.group.name = 'all-settlements-one-space';
    const makeMesh = (geometry, material, capacity = this.maxBuildings) => {
      const mesh = new THREE.InstancedMesh(geometry, material, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.count = 0;
      return mesh;
    };
    this.hutWalls = makeMesh(new THREE.CylinderGeometry(1, 1.04, 1, 9), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, vertexColors: true }));
    this.hutRoofs = makeMesh(new THREE.ConeGeometry(1, 1, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, vertexColors: true }));
    this.houseWalls = makeMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, vertexColors: true }));
    this.houseRoofs = makeMesh(createRoofGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, vertexColors: true }));
    this.blocks = makeMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.80, metalness: 0.02, vertexColors: true }));
    this.scaffolds = makeMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xc4aa79, wireframe: true, transparent: true, opacity: 0.55 }), 900);
    this.markers = makeMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x362f20, emissiveIntensity: 0.72, roughness: 0.35, transparent: true, opacity: 0.86, vertexColors: true }), this.maxCommunities);
    this.markers.name = 'settlement-picking-markers';
    this.markerCommunityIds = [];
    this.selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.78, 1, 48),
      new THREE.MeshBasicMaterial({ color: 0xf0d591, transparent: true, opacity: 0.86, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.visible = false;
    this.selectionRing.renderOrder = 10;
    this.group.add(this.hutWalls, this.hutRoofs, this.houseWalls, this.houseRoofs, this.blocks, this.scaffolds, this.markers, this.selectionRing);
    this.snapshot = null;
    this.selectedId = null;
  }

  buildingColor(community, polity, materialType, random) {
    const color = new THREE.Color();
    if (materialType === 'roof') color.setHSL(0.075 + random() * 0.035, 0.30 + random() * 0.13, 0.27 + random() * 0.12);
    else if (materialType === 'modern') color.setHSL(0.56 + random() * 0.035, 0.07 + random() * 0.09, 0.49 + random() * 0.19);
    else color.setHSL(0.085 + random() * 0.04, 0.18 + random() * 0.17, 0.45 + random() * 0.17);
    if (polity && materialType !== 'roof') color.lerp(new THREE.Color().setRGB(...polity.color), 0.08);
    if (!community.permanent) color.offsetHSL(0, 0.04, -0.07);
    return color;
  }

  setSnapshot(snapshot, selectedId = this.selectedId) {
    this.snapshot = snapshot;
    this.selectedId = selectedId;
    const counts = { hut: 0, house: 0, block: 0, scaffold: 0, marker: 0 };
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    this.markerCommunityIds = [];
    for (const community of snapshot.communities) {
      const culture = snapshot.cultures.find((entry) => entry.id === community.cultureId);
      const polity = snapshot.polities.find((entry) => entry.id === community.polityId);
      const knowledge = culture?.knowledge || {};
      const random = createRandom(hashString(`${this.world.seed}:${community.id}:${Math.floor(snapshot.year / 25)}`));
      const density = !community.permanent ? 30 : (knowledge.steam || 0) >= 1 ? 5800 : community.population > 8000 ? 4200 : 1100;
      const radiusKm = Math.sqrt(Math.max(0.02, community.population / density) / Math.PI);
      const radius = clamp(radiusKm * WORLD_UNITS_PER_KM, community.permanent ? 0.26 : 0.16, 105);
      const representative = clamp(Math.round(Math.sqrt(Math.max(1, community.buildings)) * 2.4), 2, 72);
      const centre = worldPosition(this.world, community.x, community.z, 0);
      for (let index = 0; index < representative; index += 1) {
        const angle = random() * Math.PI * 2;
        const distance = Math.sqrt(random()) * radius;
        const localX = Math.cos(angle) * distance + Math.sin(index * 1.7) * radius * 0.06;
        const localZ = Math.sin(angle) * distance + Math.cos(index * 1.3) * radius * 0.06;
        const cellScale = this.world.cellKm * WORLD_UNITS_PER_KM;
        const ground = worldPosition(this.world, community.x + localX / cellScale, community.z + localZ / cellScale, 0.006);
        const rotation = angle + random() * 0.55;
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
        const early = !community.permanent || (knowledge.masonry || 0) < 1;
        const modern = (knowledge.steam || 0) >= 1 && community.population > 4500;
        if (early && counts.hut < this.maxBuildings) {
          const width = 0.045 + random() * 0.045;
          const wallHeight = 0.038 + random() * 0.038;
          position.set(ground.x, ground.y + wallHeight * 0.5, ground.z);
          scale.set(width, wallHeight, width * (0.88 + random() * 0.2));
          matrix.compose(position, quaternion, scale);
          this.hutWalls.setMatrixAt(counts.hut, matrix);
          this.hutWalls.setColorAt(counts.hut, this.buildingColor(community, polity, 'wall', random));
          position.y = ground.y + wallHeight + width * 0.34;
          scale.set(width * 1.24, width * 0.70, width * 1.24);
          matrix.compose(position, quaternion, scale);
          this.hutRoofs.setMatrixAt(counts.hut, matrix);
          this.hutRoofs.setColorAt(counts.hut, this.buildingColor(community, polity, 'roof', random));
          counts.hut += 1;
        } else if (!modern && counts.house < this.maxBuildings) {
          const width = 0.065 + random() * 0.11;
          const depth = width * (0.70 + random() * 0.72);
          const floors = community.population > 8000 ? 1 + Math.floor(random() * 3) : 1 + Math.floor(random() * 2);
          const wallHeight = floors * (0.031 + random() * 0.008);
          position.set(ground.x, ground.y + wallHeight * 0.5, ground.z);
          scale.set(width, wallHeight, depth);
          matrix.compose(position, quaternion, scale);
          this.houseWalls.setMatrixAt(counts.house, matrix);
          this.houseWalls.setColorAt(counts.house, this.buildingColor(community, polity, 'wall', random));
          position.y = ground.y + wallHeight;
          scale.set(width * 1.12, 0.04 + width * 0.18, depth * 1.12);
          matrix.compose(position, quaternion, scale);
          this.houseRoofs.setMatrixAt(counts.house, matrix);
          this.houseRoofs.setColorAt(counts.house, this.buildingColor(community, polity, 'roof', random));
          counts.house += 1;
        } else if (counts.block < this.maxBuildings) {
          const width = 0.09 + random() * 0.24;
          const depth = width * (0.55 + random() * 0.7);
          const height = width * (0.7 + random() * (community.population > 100_000 ? 6.5 : 2.4));
          position.set(ground.x, ground.y + height * 0.5, ground.z);
          scale.set(width, height, depth);
          matrix.compose(position, quaternion, scale);
          this.blocks.setMatrixAt(counts.block, matrix);
          this.blocks.setColorAt(counts.block, this.buildingColor(community, polity, 'modern', random));
          counts.block += 1;
        }
      }
      if (community.permanent && community.surplus > 0.32 && counts.scaffold < 900) {
        const height = 0.10 + random() * 0.18;
        position.set(centre.x + radius * 0.48, centre.y + height * 0.5 + 0.01, centre.z - radius * 0.18);
        scale.set(0.10, height, 0.09);
        matrix.compose(position, quaternion.identity(), scale);
        this.scaffolds.setMatrixAt(counts.scaffold++, matrix);
      }
      if (counts.marker < this.maxCommunities) {
        const markerScale = clamp(1.8 + Math.log10(community.population + 10) * 1.8, 3.2, 13.5);
        position.set(centre.x, centre.y + markerScale * 0.55, centre.z);
        scale.set(markerScale * 0.28, markerScale, markerScale * 0.28);
        matrix.compose(position, quaternion.identity(), scale);
        this.markers.setMatrixAt(counts.marker, matrix);
        const markerColor = polity ? new THREE.Color().setRGB(...polity.color) : new THREE.Color(community.permanent ? 0xd7bd7d : 0xe3a75e);
        this.markers.setColorAt(counts.marker, markerColor);
        this.markerCommunityIds[counts.marker] = community.id;
        counts.marker += 1;
      }
    }
    const assignments = [
      [this.hutWalls, counts.hut], [this.hutRoofs, counts.hut],
      [this.houseWalls, counts.house], [this.houseRoofs, counts.house],
      [this.blocks, counts.block], [this.scaffolds, counts.scaffold], [this.markers, counts.marker],
    ];
    for (const [mesh, count] of assignments) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere?.();
    }
    this.updateSelection();
  }

  updateSelection() {
    const community = this.snapshot?.communities.find((entry) => entry.id === this.selectedId);
    if (!community) {
      this.selectionRing.visible = false;
      return;
    }
    const centre = worldPosition(this.world, community.x, community.z, 0.04);
    const scale = clamp(3.8 + Math.log10(community.population + 10) * 2.2, 5, 18);
    this.selectionRing.visible = true;
    this.selectionRing.position.copy(centre);
    this.selectionRing.scale.setScalar(scale);
  }

  setSelected(id) {
    this.selectedId = id == null ? null : Number(id);
    this.updateSelection();
  }

  pick(raycaster) {
    const hits = raycaster.intersectObject(this.markers, false);
    if (!hits.length || hits[0].instanceId == null) return null;
    return this.markerCommunityIds[hits[0].instanceId] ?? null;
  }

  dispose() {
    for (const mesh of [this.hutWalls, this.hutRoofs, this.houseWalls, this.houseRoofs, this.blocks, this.scaffolds, this.markers]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.selectionRing.geometry.dispose();
    this.selectionRing.material.dispose();
  }
}

function routeCategory(mode) {
  if (mode === 'ocean' || mode === 'coastal') return 'water';
  if (mode === 'rail') return 'rail';
  if (mode === 'motor-road' || mode === 'paved-road') return 'road';
  return 'trail';
}

class RouteLayer {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = 'emergent-transport-network';
    this.signature = '';
  }

  setSnapshot(snapshot) {
    const signature = snapshot.routes.map((route) => `${route.id}:${route.mode}:${Math.round(route.condition * 5)}`).join('|');
    if (signature === this.signature) return;
    this.signature = signature;
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      child.geometry?.dispose();
      child.material?.dispose();
    }
    const buckets = new Map();
    for (const route of snapshot.routes) {
      const category = routeCategory(route.mode);
      if (!buckets.has(category)) buckets.set(category, { positions: [], indices: [], vertex: 0, routes: [] });
      const bucket = buckets.get(category);
      const style = ROUTE_STYLES[route.mode] || ROUTE_STYLES.trail;
      const width = style.width * (0.72 + route.condition * 0.62);
      for (let index = 1; index < route.path.length; index += 1) {
        const a = cellPosition(this.world, route.path[index - 1], category === 'water' ? 0.08 : 0.024);
        const b = cellPosition(this.world, route.path[index], category === 'water' ? 0.08 : 0.024);
        if (category === 'water') { a.y = 0.085; b.y = 0.085; }
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const length = Math.hypot(dx, dz) || 1;
        const nx = -dz / length * width;
        const nz = dx / length * width;
        bucket.positions.push(
          a.x + nx, a.y, a.z + nz,
          a.x - nx, a.y, a.z - nz,
          b.x + nx, b.y, b.z + nz,
          b.x - nx, b.y, b.z - nz,
        );
        bucket.indices.push(bucket.vertex, bucket.vertex + 1, bucket.vertex + 2, bucket.vertex + 2, bucket.vertex + 1, bucket.vertex + 3);
        bucket.vertex += 4;
      }
      bucket.routes.push(route);
    }
    const categoryStyle = {
      trail: ROUTE_STYLES.trail,
      road: ROUTE_STYLES['motor-road'],
      rail: ROUTE_STYLES.rail,
      water: ROUTE_STYLES.ocean,
    };
    for (const [category, bucket] of buckets) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(bucket.positions, 3));
      geometry.setIndex(bucket.indices);
      geometry.computeVertexNormals();
      const style = categoryStyle[category];
      const material = new THREE.MeshStandardMaterial({
        color: style.color,
        roughness: style.roughness,
        metalness: style.metalness || 0,
        transparent: Boolean(style.transparent),
        opacity: style.transparent ? 0.58 : 0.92,
        depthWrite: !style.transparent,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.receiveShadow = true;
      mesh.renderOrder = category === 'water' ? 4 : 3;
      mesh.name = `routes-${category}`;
      this.group.add(mesh);
    }
  }

  dispose() {
    for (const child of this.group.children) {
      child.geometry?.dispose();
      child.material?.dispose();
    }
  }
}

function computeTerritory(world, snapshot) {
  const ownership = new Int16Array(world.size * world.size);
  ownership.fill(-1);
  const polityById = new Map(snapshot.polities.map((polity) => [polity.id, polity]));
  const claimed = snapshot.communities.filter((community) => community.polityId != null && polityById.has(community.polityId));
  if (!claimed.length) return ownership;
  for (let z = 0; z < world.size; z += 1) {
    for (let x = 0; x < world.size; x += 1) {
      const cell = z * world.size + x;
      if (world.fields.elevation[cell] <= 0) continue;
      let best = Infinity;
      let owner = -1;
      for (const community of claimed) {
        const polity = polityById.get(community.polityId);
        const influence = 6 + Math.log10(community.population + 10) * 2.8 + Math.sqrt(polity.settlementIds.length) * 1.6;
        const distance = Math.hypot(x - community.x, z - community.z);
        const cost = distance / influence;
        if (cost < 1.1 && cost < best) { best = cost; owner = community.polityId; }
      }
      ownership[cell] = owner;
    }
  }
  return ownership;
}

class PolityLayer {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = 'emergent-polities';
    this.signature = '';
    this.capitals = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(1, 1.35, 1, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.50, metalness: 0.08, emissive: 0x251f16, emissiveIntensity: 0.35, vertexColors: true }),
      32,
    );
    this.capitals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.capitals.count = 0;
    this.group.add(this.capitals);
    this.boundaries = null;
  }

  setSnapshot(snapshot) {
    const signature = snapshot.polities.map((polity) => `${polity.id}:${polity.capitalId}:${polity.settlementIds.length}`).join('|') + `:${Math.floor(snapshot.year / 20)}`;
    if (signature === this.signature) return;
    this.signature = signature;
    if (this.boundaries) {
      this.group.remove(this.boundaries);
      this.boundaries.geometry.dispose();
      this.boundaries.material.dispose();
    }
    const ownership = computeTerritory(this.world, snapshot);
    const positions = [];
    const colors = [];
    const color = new THREE.Color();
    for (let z = 0; z < this.world.size - 1; z += 1) {
      for (let x = 0; x < this.world.size - 1; x += 1) {
        const cell = z * this.world.size + x;
        const owner = ownership[cell];
        if (owner < 0) continue;
        const east = ownership[cell + 1];
        const south = ownership[cell + this.world.size];
        const polity = snapshot.polities.find((entry) => entry.id === owner);
        if (!polity) continue;
        color.setRGB(...polity.color);
        if (east >= 0 && east !== owner) {
          const a = worldPosition(this.world, x + 0.5, z - 0.5, 0.16);
          const b = worldPosition(this.world, x + 0.5, z + 0.5, 0.16);
          positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
          colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
        }
        if (south >= 0 && south !== owner) {
          const a = worldPosition(this.world, x - 0.5, z + 0.5, 0.16);
          const b = worldPosition(this.world, x + 0.5, z + 0.5, 0.16);
          positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
          colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false });
    this.boundaries = new THREE.LineSegments(geometry, material);
    this.boundaries.renderOrder = 6;
    this.boundaries.name = 'endogenous-country-boundaries';
    this.group.add(this.boundaries);

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    let count = 0;
    for (const polity of snapshot.polities.slice(0, 32)) {
      if (!polity.capital) continue;
      const base = worldPosition(this.world, polity.capital.x, polity.capital.z, 0);
      const height = clamp(5 + Math.log10(polity.population + 10) * 3.2, 9, 28);
      position.set(base.x, base.y + height * 0.5, base.z);
      scale.set(height * 0.18, height, height * 0.18);
      matrix.compose(position, quaternion.identity(), scale);
      this.capitals.setMatrixAt(count, matrix);
      this.capitals.setColorAt(count, new THREE.Color().setRGB(...polity.color));
      count += 1;
    }
    this.capitals.count = count;
    this.capitals.instanceMatrix.needsUpdate = true;
    if (this.capitals.instanceColor) this.capitals.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.boundaries?.geometry.dispose();
    this.boundaries?.material.dispose();
    this.capitals.geometry.dispose();
    this.capitals.material.dispose();
  }
}

function makePathDescriptor(world, cells) {
  const points = cells.map((cell) => cellPosition(world, cell, 0.12));
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) cumulative.push(cumulative[index - 1] + points[index - 1].distanceTo(points[index]));
  return { points, cumulative, length: cumulative[cumulative.length - 1] || 1 };
}

function samplePath(descriptor, progress, position, tangent) {
  const distance = clamp01(progress) * descriptor.length;
  let index = 1;
  while (index < descriptor.cumulative.length && descriptor.cumulative[index] < distance) index += 1;
  index = Math.min(index, descriptor.points.length - 1);
  const a = descriptor.points[Math.max(0, index - 1)];
  const b = descriptor.points[index] || a;
  const start = descriptor.cumulative[Math.max(0, index - 1)] || 0;
  const segment = Math.max(0.0001, (descriptor.cumulative[index] || descriptor.length) - start);
  const t = clamp01((distance - start) / segment);
  position.copy(a).lerp(b, t);
  tangent.copy(b).sub(a).normalize();
}

class FlowLayer {
  constructor(world) {
    this.world = world;
    this.capacity = { logistics: 150, traffic: 140, migration: 70, army: 54 };
    this.group = new THREE.Group();
    this.group.name = 'visible-movement-flows';
    this.meshes = {
      logistics: new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, vertexColors: true }), this.capacity.logistics),
      traffic: new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.06, vertexColors: true }), this.capacity.traffic),
      migration: new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: FLOW_COLORS.migration, roughness: 0.70 }), this.capacity.migration),
      army: new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1.8, 5), new THREE.MeshStandardMaterial({ color: FLOW_COLORS.army, emissive: 0x3b0a06, emissiveIntensity: 0.45, roughness: 0.62 }), this.capacity.army),
    };
    for (const mesh of Object.values(this.meshes)) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.group.add(mesh);
    }
    this.descriptors = { logistics: [], traffic: [], migration: [], army: [] };
    this.position = new THREE.Vector3();
    this.tangent = new THREE.Vector3();
    this.scale = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.matrix = new THREE.Matrix4();
  }

  setSnapshot(snapshot) {
    this.descriptors = { logistics: [], traffic: [], migration: [], army: [] };
    const pathCache = new Map();
    const topFlows = [...snapshot.flows].sort((a, b) => (b.type === 'army' ? b.volume * 4 : b.volume) - (a.type === 'army' ? a.volume * 4 : a.volume));
    for (const flow of topFlows) {
      const type = flow.type;
      if (!this.descriptors[type] || !flow.path?.length) continue;
      const key = `${flow.routeId ?? flow.id}:${flow.path.length}:${flow.path[0]}:${flow.path[flow.path.length - 1]}`;
      if (!pathCache.has(key)) pathCache.set(key, makePathDescriptor(this.world, flow.path));
      const copies = type === 'traffic' ? clamp(Math.round(Math.log1p(flow.volume) * 0.46), 1, 3) : type === 'logistics' ? clamp(Math.round(Math.log1p(flow.volume) * 0.40), 1, 3) : 1;
      for (let copy = 0; copy < copies && this.descriptors[type].length < this.capacity[type]; copy += 1) {
        this.descriptors[type].push({
          ...flow,
          pathDescriptor: pathCache.get(key),
          phase: ((hashString(`${flow.id}:${copy}`) % 997) / 997 + copy / copies) % 1,
        });
      }
    }
    for (const community of snapshot.communities.filter((entry) => entry.localTraffic > 2.8).sort((a, b) => b.localTraffic - a.localTraffic).slice(0, 34)) {
      if (this.descriptors.traffic.length >= this.capacity.traffic) break;
      const centre = worldPosition(this.world, community.x, community.z, 0.06);
      this.descriptors.traffic.push({
        id: `local:${community.id}`,
        type: 'traffic',
        local: true,
        centre,
        radius: clamp(0.36 + Math.log10(community.population + 10) * 0.34, 0.7, 3.4),
        volume: community.localTraffic,
        mode: community.stage === 'industrial' ? 'motor-road' : 'trail',
        phase: (community.id * 0.137) % 1,
      });
    }
    for (const [type, descriptors] of Object.entries(this.descriptors)) {
      const mesh = this.meshes[type];
      mesh.count = descriptors.length;
      descriptors.forEach((descriptor, index) => {
        if (!mesh.setColorAt) return;
        const color = type === 'logistics' ? FLOW_COLORS[descriptor.good] || FLOW_COLORS.craft : FLOW_COLORS[type];
        mesh.setColorAt(index, new THREE.Color(color));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  update(elapsed) {
    for (const [type, descriptors] of Object.entries(this.descriptors)) {
      const mesh = this.meshes[type];
      descriptors.forEach((descriptor, index) => {
        if (descriptor.local) {
          const progress = (descriptor.phase + elapsed * 0.018) % 1;
          const angle = progress * Math.PI * 2;
          this.position.copy(descriptor.centre);
          this.position.x += Math.cos(angle) * descriptor.radius;
          this.position.z += Math.sin(angle) * descriptor.radius;
          this.tangent.set(-Math.sin(angle), 0, Math.cos(angle));
        } else {
          const modeSpeed = descriptor.mode === 'rail' ? 0.050 : descriptor.mode === 'motor-road' ? 0.042 : descriptor.mode === 'ocean' ? 0.026 : descriptor.mode === 'coastal' ? 0.030 : 0.018;
          let progress = descriptor.type === 'army' ? clamp01(descriptor.progress || 0) : (descriptor.phase + elapsed * modeSpeed) % 1;
          if (descriptor.reverse) progress = 1 - progress;
          samplePath(descriptor.pathDescriptor, progress, this.position, this.tangent);
          if (descriptor.mode === 'ocean' || descriptor.mode === 'coastal') this.position.y = 0.13;
        }
        const yaw = Math.atan2(this.tangent.x, this.tangent.z);
        this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        if (type === 'logistics') {
          const vehicle = descriptor.mode === 'rail' ? 0.18 : descriptor.mode === 'motor-road' ? 0.11 : descriptor.mode === 'ocean' ? 0.24 : 0.07;
          this.scale.set(vehicle * 0.72, vehicle * 0.48, vehicle * 1.8);
          this.position.y += vehicle * 0.35;
        } else if (type === 'traffic') {
          const vehicle = descriptor.mode === 'motor-road' || descriptor.mode === 'rail' ? 0.075 : 0.035;
          this.scale.set(vehicle * 0.65, vehicle * 0.45, vehicle * 1.4);
          this.position.y += vehicle * 0.3;
        } else if (type === 'migration') {
          const size = 0.035 + clamp01(Math.log1p(descriptor.volume) / 8) * 0.075;
          this.scale.setScalar(size);
          this.position.y += size;
        } else {
          const size = 0.13 + clamp01(Math.log1p(descriptor.volume) / 12) * 0.22;
          this.scale.set(size, size * 1.3, size);
          this.position.y += size * 0.8;
        }
        this.matrix.compose(this.position, this.quaternion, this.scale);
        mesh.setMatrixAt(index, this.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    for (const mesh of Object.values(this.meshes)) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}

class BattleLayer {
  constructor(world) {
    this.world = world;
    this.capacity = 40;
    this.group = new THREE.Group();
    this.group.name = 'visible-battles';
    this.rings = new THREE.InstancedMesh(
      new THREE.RingGeometry(0.68, 1, 36),
      new THREE.MeshBasicMaterial({ color: 0xf15a43, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }),
      this.capacity,
    );
    this.smoke = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: 0x504c47, roughness: 1, transparent: true, opacity: 0.62, depthWrite: false }),
      this.capacity,
    );
    this.rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rings.frustumCulled = false;
    this.smoke.frustumCulled = false;
    this.group.add(this.rings, this.smoke);
    this.descriptors = [];
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.scale = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  }

  setSnapshot(snapshot) {
    this.descriptors = snapshot.battles.slice(-this.capacity).map((battle) => ({ ...battle, base: worldPosition(this.world, battle.x, battle.z, 0.10) }));
    this.rings.count = this.descriptors.length;
    this.smoke.count = this.descriptors.length;
  }

  update(elapsed) {
    this.descriptors.forEach((battle, index) => {
      const pulse = 3.8 + battle.intensity * 8 + Math.sin(elapsed * 4.2 + index) * 1.4;
      this.position.copy(battle.base);
      this.scale.setScalar(pulse);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.rings.setMatrixAt(index, this.matrix);
      const smokeSize = 1.8 + battle.intensity * 3.4 + Math.sin(elapsed * 1.7 + index) * 0.55;
      this.position.y += 2.5 + smokeSize * 0.8;
      this.position.x += Math.sin(elapsed * 0.7 + index) * 0.8;
      this.scale.set(smokeSize, smokeSize * 1.5, smokeSize);
      this.matrix.compose(this.position, new THREE.Quaternion(), this.scale);
      this.smoke.setMatrixAt(index, this.matrix);
    });
    this.rings.instanceMatrix.needsUpdate = true;
    this.smoke.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const mesh of [this.rings, this.smoke]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}

export class UnifiedWorldScene {
  constructor(canvas, world, options = {}) {
    this.canvas = canvas;
    this.world = world;
    this.options = options;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa9bac0);
    this.scene.fog = new THREE.FogExp2(0xbac1bb, 0.000035);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      logarithmicDepthBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const size = renderSize(world);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.025, Math.max(80000, size * 3.4));
    this.camera.position.set(size * 0.16, size * 0.62, size * 0.72);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.minDistance = 0.45;
    this.controls.maxDistance = size * 1.55;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.zoomToCursor = true;
    this.controls.screenSpacePanning = false;
    this.controls.touches.ONE = THREE.TOUCH.ROTATE;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

    options.onProgress?.(0.10, '단일 물리 공간 지형 생성');
    this.sky = createSky();
    this.terrain = createTerrain(world);
    this.ocean = createOcean(world);
    this.rivers = createRivers(world);
    this.scene.add(this.sky, this.terrain, this.ocean, this.rivers);

    options.onProgress?.(0.34, '생태·정착 표현 계층 생성');
    this.vegetation = new VegetationLayer(world);
    this.settlements = new SettlementLayer(world);
    this.routes = new RouteLayer(world);
    this.polities = new PolityLayer(world);
    this.flows = new FlowLayer(world);
    this.battles = new BattleLayer(world);
    this.scene.add(this.vegetation.group, this.routes.group, this.polities.group, this.settlements.group, this.flows.group, this.battles.group);

    options.onProgress?.(0.72, '대기와 자연광 계산');
    const hemisphere = new THREE.HemisphereLight(0xc9d9df, 0x635c48, 1.75);
    this.sun = new THREE.DirectionalLight(0xffe3b5, 3.7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1536, 1536);
    this.sun.shadow.camera.left = -380;
    this.sun.shadow.camera.right = 380;
    this.sun.shadow.camera.top = 380;
    this.sun.shadow.camera.bottom = -380;
    this.sun.shadow.camera.near = 100;
    this.sun.shadow.camera.far = 3200;
    this.sun.shadow.bias = -0.00008;
    this.sun.shadow.normalBias = 0.25;
    this.scene.add(hemisphere, this.sun, this.sun.target);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.snapshot = null;
    this.selectedId = null;
    this.running = true;
    this.startedAt = performance.now();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement || canvas);
    this.resize();
    this.controls.update();
    options.onProgress?.(1, '단일 세계 준비 완료');
    this.renderer.setAnimationLoop(() => this.render());
  }

  setSnapshot(snapshot, selectedId = this.selectedId) {
    this.snapshot = snapshot;
    this.selectedId = selectedId;
    this.routes.setSnapshot(snapshot);
    this.polities.setSnapshot(snapshot);
    this.settlements.setSnapshot(snapshot, selectedId);
    this.flows.setSnapshot(snapshot);
    this.battles.setSnapshot(snapshot);
  }

  setSelected(id) {
    this.selectedId = id == null ? null : Number(id);
    this.settlements.setSelected(this.selectedId);
  }

  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = (clientX - rect.left) / Math.max(1, rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.settlements.pick(this.raycaster);
  }

  focusCommunity(id, close = false) {
    const community = this.snapshot?.communities.find((entry) => entry.id === Number(id));
    if (!community) return false;
    const target = worldPosition(this.world, community.x, community.z, 0.08);
    const radius = clamp(1.2 + Math.sqrt(community.population) / 95, 1.4, 85);
    const distance = close ? radius * 2.2 : Math.max(24, radius * 5.4);
    this.controls.target.copy(target);
    this.camera.position.set(target.x + distance * 0.82, target.y + distance * 0.62, target.z + distance);
    this.controls.update();
    return true;
  }

  setView(view) {
    const size = renderSize(this.world);
    if (view === 'continent') {
      this.controls.target.set(0, 0, 0);
      this.camera.position.set(size * 0.16, size * 0.62, size * 0.72);
    } else if (view === 'settlement' && this.selectedId != null) {
      this.focusCommunity(this.selectedId, true);
      return;
    } else if (this.selectedId != null) {
      this.focusCommunity(this.selectedId, false);
      return;
    } else {
      this.controls.target.set(0, 0, 0);
      this.camera.position.set(size * 0.10, size * 0.24, size * 0.28);
    }
    this.controls.update();
  }

  resize() {
    const parent = this.canvas.parentElement;
    const width = Math.max(1, parent?.clientWidth || window.innerWidth);
    const height = Math.max(1, parent?.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render() {
    if (!this.running) return;
    const elapsed = (performance.now() - this.startedAt) / 1000;
    this.sky.position.copy(this.camera.position);
    this.flows.update(elapsed);
    this.battles.update(elapsed);
    const target = this.controls.target;
    this.sun.position.set(target.x - 900, target.y + 1350, target.z + 720);
    this.sun.target.position.copy(target);
    const distance = this.camera.position.distanceTo(target);
    const localDetail = distance < 900;
    this.renderer.shadowMap.enabled = localDetail;
    this.settlements.markers.material.opacity = distance > 1600 ? 0.86 : clamp(distance / 1600, 0.08, 0.72);
    this.scene.fog.density = distance > 5000 ? 0.000022 : distance > 800 ? 0.000045 : 0.00008;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  diagnostics() {
    return {
      renderer: this.renderer.info,
      oneScene: true,
      physicalSpanKm: this.world.spanKm,
      metresPerUnit: METRES_PER_WORLD_UNIT,
      renderedCommunities: this.settlements.markers.count,
      renderedFlows: Object.values(this.flows.meshes).reduce((sum, mesh) => sum + mesh.count, 0),
      renderedBattles: this.battles.rings.count,
    };
  }

  dispose() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.vegetation.dispose();
    this.settlements.dispose();
    this.routes.dispose();
    this.polities.dispose();
    this.flows.dispose();
    this.battles.dispose();
    for (const mesh of [this.sky, this.terrain, this.ocean, this.rivers]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.renderer.dispose();
  }
}
