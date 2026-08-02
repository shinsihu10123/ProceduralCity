import * as THREE from 'three';
import { clamp01 } from './core.js';

const RENDER_SIZE = 2600;
const HALF = RENDER_SIZE * 0.5;
// The map is horizontally compressed by several orders of magnitude, so a
// moderate vertical exaggeration keeps relief legible without turning ranges
// into walls.
const HEIGHT_SCALE = 38;

const BIOME_COLORS = [
  0x315a67, 0x89908a, 0x536b5b, 0x587451, 0x7d8757,
  0xb49a61, 0x8d8b52, 0x47704e, 0x858783, 0x507467,
];

function worldPosition(world, cellX, cellZ, extraY = 0) {
  const x = cellX / (world.size - 1) * RENDER_SIZE - HALF;
  const z = cellZ / (world.size - 1) * RENDER_SIZE - HALF;
  const index = Math.round(cellZ) * world.size + Math.round(cellX);
  const elevation = world.fields.elevation[index] || 0;
  const y = elevation > 0 ? elevation / HEIGHT_SCALE + 1.5 : Math.max(-42, elevation / 72);
  return new THREE.Vector3(x, y + extraY, z);
}

function createRelief(world) {
  const segments = world.size - 1;
  const geometry = new THREE.PlaneGeometry(RENDER_SIZE, RENDER_SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  const countryTint = new THREE.Color();
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const gx = Math.round((x + HALF) / RENDER_SIZE * segments);
    const gz = Math.round((z + HALF) / RENDER_SIZE * segments);
    const cell = gz * world.size + gx;
    const elevation = world.fields.elevation[cell];
    positions.setY(index, elevation > 0 ? elevation / HEIGHT_SCALE + 1.5 : Math.max(-42, elevation / 72));
    color.setHex(BIOME_COLORS[world.fields.biome[cell]] || BIOME_COLORS[4]);
    const country = world.countries[world.countryId[cell]];
    if (country && elevation > 0) {
      countryTint.setRGB(...country.color);
      color.lerp(countryTint, 0.10);
      color.offsetHSL(0, 0, clamp01(elevation / 4200) * 0.09);
    }
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.91, metalness: 0.01 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'macro-relief';
  return mesh;
}

function createOcean() {
  const geometry = new THREE.PlaneGeometry(RENDER_SIZE * 1.08, RENDER_SIZE * 1.08);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x386d7b,
    roughness: 0.22,
    metalness: 0.08,
    transparent: true,
    opacity: 0.92,
    clearcoat: 0.72,
    clearcoatRoughness: 0.16,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0;
  mesh.receiveShadow = true;
  mesh.name = 'macro-ocean';
  return mesh;
}

function createBorders(world) {
  const positions = [];
  const size = world.size;
  for (let z = 0; z < size - 1; z += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const index = z * size + x;
      const id = world.countryId[index];
      if (id < 0) continue;
      const east = world.countryId[index + 1];
      const south = world.countryId[index + size];
      if (east >= 0 && east !== id) {
        const a = worldPosition(world, x + 0.5, z - 0.5, 4.0);
        const b = worldPosition(world, x + 0.5, z + 0.5, 4.0);
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
      if (south >= 0 && south !== id) {
        const a = worldPosition(world, x - 0.5, z + 0.5, 4.0);
        const b = worldPosition(world, x + 0.5, z + 0.5, 4.0);
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color: 0xf2e3c2, transparent: true, opacity: 0.78, depthWrite: false });
  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = 5;
  lines.name = 'country-borders';
  return lines;
}

function createRivers(world) {
  const positions = [];
  for (let index = 0; index < world.fields.river.length; index += 1) {
    if (world.fields.river[index] < 0.16) continue;
    const next = world.fields.downstream[index];
    if (next < 0) continue;
    const x = index % world.size;
    const z = Math.floor(index / world.size);
    const nx = next % world.size;
    const nz = Math.floor(next / world.size);
    const a = worldPosition(world, x, z, 3.0);
    const b = worldPosition(world, nx, nz, 3.0);
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color: 0x72b4c0, transparent: true, opacity: 0.82, depthWrite: false });
  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = 4;
  lines.name = 'macro-rivers';
  return lines;
}

function createTrade(world) {
  const group = new THREE.Group();
  group.name = 'trade-corridors';
  for (const edge of world.trade) {
    const left = world.countries[edge.a];
    const right = world.countries[edge.b];
    const a = worldPosition(world, left.capital.x, left.capital.z, 15);
    const b = worldPosition(world, right.capital.x, right.capital.z, 15);
    const mid = a.clone().lerp(b, 0.5);
    mid.y += 65 + a.distanceTo(b) * 0.035;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
    const material = new THREE.LineBasicMaterial({ color: 0xdabf79, transparent: true, opacity: 0.36, depthWrite: false });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 6;
    group.add(line);
  }
  return group;
}

function createMarkers(world) {
  const geometry = new THREE.CylinderGeometry(0, 8, 22, 8);
  const material = new THREE.MeshStandardMaterial({ color: 0xffe8b0, roughness: 0.42, metalness: 0.34 });
  const capitals = new THREE.InstancedMesh(geometry, material, world.countries.length);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  world.countries.forEach((country, index) => {
    position.copy(worldPosition(world, country.capital.x, country.capital.z, 14));
    matrix.compose(position, quaternion, scale);
    capitals.setMatrixAt(index, matrix);
  });
  capitals.castShadow = true;
  capitals.name = 'country-capitals';

  const settlementPosition = worldPosition(world, world.settlement.x, world.settlement.z, 20);
  const ringMaterial = new THREE.MeshStandardMaterial({ color: 0xdff5cf, emissive: 0x2e4d2a, emissiveIntensity: 0.72, roughness: 0.35 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(16, 2.5, 10, 32), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(settlementPosition);
  ring.name = 'settlement-marker';
  return { capitals, ring };
}

export class MacroWorldLayer {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = 'macro-world';
    this.ocean = createOcean();
    this.relief = createRelief(world);
    this.borders = createBorders(world);
    this.rivers = createRivers(world);
    this.trade = createTrade(world);
    const markers = createMarkers(world);
    this.capitals = markers.capitals;
    this.settlementMarker = markers.ring;
    this.group.add(this.ocean, this.relief, this.rivers, this.borders, this.trade, this.capitals, this.settlementMarker);
  }
  update(elapsed) {
    const scale = 1 + Math.sin(elapsed * 2.1) * 0.08;
    this.settlementMarker.scale.setScalar(scale);
    this.settlementMarker.rotation.z = elapsed * 0.15;
  }
  dispose() {
    this.group.traverse((object) => {
      object.geometry?.dispose();
      object.material?.dispose?.();
    });
  }
}
