import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, clamp01, createRandom, hashString, polylineLength, samplePolyline } from './core.js';
import { REGION_HALF, REGION_SIZE, ROAD_STANDARDS, WATER_LEVEL, riverHalfWidth, terrainHeight, terrainSlope } from './spatial.js';

const tempMatrix = new THREE.Matrix4();
const tempPosition = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempScale = new THREE.Vector3();
const tempEuler = new THREE.Euler();

function colorForGround(code, height, slope, noise) {
  if (code === 0) return new THREE.Color(0x4d7880);
  if (code === 2) return new THREE.Color(0x61795b).offsetHSL(0, 0, noise * 0.035);
  if (code === 3) return new THREE.Color(0x63705a).offsetHSL(0, 0, noise * 0.045);
  if (code === 4) return new THREE.Color(0x777870).offsetHSL(0, 0, noise * 0.055);
  const altitude = clamp01((height - 16) / 90);
  return new THREE.Color(0x758565).lerp(new THREE.Color(0x666e5e), altitude * 0.55 + clamp01(slope / 28) * 0.35).offsetHSL(0, 0, noise * 0.035);
}

export function createTerrainObject(spatial, materials) {
  const resolution = spatial.terrain.resolution;
  const geometry = new THREE.PlaneGeometry(REGION_SIZE, REGION_SIZE, resolution, resolution);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const gx = Math.round((x + REGION_HALF) / REGION_SIZE * resolution);
    const gz = Math.round((z + REGION_HALF) / REGION_SIZE * resolution);
    const sampleIndex = gz * (resolution + 1) + gx;
    const height = spatial.terrain.heights[sampleIndex];
    const code = spatial.terrain.ground[sampleIndex];
    const slope = spatial.slopeAt(x, z);
    positions.setY(index, height);
    color.copy(colorForGround(code, height, slope, Math.sin(x * 0.031 + z * 0.017) * 0.5));
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, materials.terrain);
  mesh.name = 'physical-terrain';
  mesh.receiveShadow = true;
  return mesh;
}

function ribbonGeometry(points, width, yOffset = 0, uvScale = 12) {
  const count = points.length;
  const positions = new Float32Array(count * 2 * 3);
  const uvs = new Float32Array(count * 2 * 2);
  const indices = new Uint32Array((count - 1) * 6);
  let accumulated = 0;
  for (let index = 0; index < count; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(count - 1, index + 1)];
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length;
    const nz = dx / length;
    if (index > 0) accumulated += Math.hypot(points[index].x - points[index - 1].x, points[index].z - points[index - 1].z);
    for (let side = 0; side < 2; side += 1) {
      const sign = side === 0 ? -1 : 1;
      const vertex = (index * 2 + side) * 3;
      positions[vertex] = points[index].x + nx * width * 0.5 * sign;
      positions[vertex + 1] = (points[index].y ?? 0) + yOffset;
      positions[vertex + 2] = points[index].z + nz * width * 0.5 * sign;
      const uv = (index * 2 + side) * 2;
      uvs[uv] = side;
      uvs[uv + 1] = accumulated / uvScale;
    }
    if (index < count - 1) {
      const offset = index * 6;
      const a = index * 2;
      indices[offset] = a;
      indices[offset + 1] = a + 1;
      indices[offset + 2] = a + 2;
      indices[offset + 3] = a + 2;
      indices[offset + 4] = a + 1;
      indices[offset + 5] = a + 3;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function dashedMarkings(road, lateralOffset, width, dash = 4.2, gap = 5.2) {
  const geometries = [];
  const length = polylineLength(road.points);
  for (let distance = gap * 0.5; distance < length - dash; distance += dash + gap) {
    const start = samplePolyline(road.points, distance);
    const end = samplePolyline(road.points, Math.min(length, distance + dash));
    if (!start || !end || start.bridge !== end.bridge) continue;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const segmentLength = Math.hypot(dx, dz);
    if (segmentLength < 0.5) continue;
    const tangent = { x: dx / segmentLength, z: dz / segmentLength };
    const normal = { x: -tangent.z, z: tangent.x };
    const geometry = new THREE.BoxGeometry(width, 0.035, segmentLength);
    geometry.rotateY(Math.atan2(dx, dz));
    geometry.translate(
      (start.x + end.x) * 0.5 + normal.x * lateralOffset,
      (start.y + end.y) * 0.5 + 0.115,
      (start.z + end.z) * 0.5 + normal.z * lateralOffset,
    );
    geometries.push(geometry);
  }
  return geometries.length ? mergeGeometries(geometries, false) : null;
}

function bridgeDetails(road, standard, materials) {
  const group = new THREE.Group();
  const bridgePoints = road.points.filter((point) => point.bridge);
  if (!bridgePoints.length) return group;
  const mergedRails = [];
  const mergedPiers = [];
  for (let index = 1; index < road.points.length; index += 1) {
    const a = road.points[index - 1];
    const b = road.points[index];
    if (!a.bridge && !b.bridge) continue;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.1) continue;
    const tx = dx / length;
    const tz = dz / length;
    const nx = -tz;
    const nz = tx;
    const angle = Math.atan2(dx, dz);
    for (const side of [-1, 1]) {
      const rail = new THREE.BoxGeometry(0.16, 0.72, length);
      rail.rotateY(angle);
      rail.translate((a.x + b.x) * 0.5 + nx * side * (standard.width * 0.5 + 0.7), (a.y + b.y) * 0.5 + 0.58, (a.z + b.z) * 0.5 + nz * side * (standard.width * 0.5 + 0.7));
      mergedRails.push(rail);
    }
  }
  for (let index = 4; index < bridgePoints.length - 3; index += 7) {
    const point = bridgePoints[index];
    const height = Math.max(2, point.y - WATER_LEVEL + 2.6);
    for (const side of [-1, 1]) {
      const pier = new THREE.BoxGeometry(1.3, height, 2.1);
      pier.translate(point.x + side * standard.width * 0.3, WATER_LEVEL - 1.3 + height * 0.5, point.z);
      mergedPiers.push(pier);
    }
  }
  if (mergedRails.length) {
    const mesh = new THREE.Mesh(mergeGeometries(mergedRails, false), materials.rail);
    mesh.castShadow = true;
    group.add(mesh);
  }
  if (mergedPiers.length) {
    const mesh = new THREE.Mesh(mergeGeometries(mergedPiers, false), materials.concreteDark);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

function createRoadObject(road, materials) {
  const standard = ROAD_STANDARDS[road.class];
  const group = new THREE.Group();
  group.name = road.id;
  group.userData.openYear = road.openYear;
  const shoulderGeometry = ribbonGeometry(road.points, standard.width + standard.shoulder * 2, -0.055, 10);
  const shoulder = new THREE.Mesh(shoulderGeometry, road.class === 'track' ? materials.dirt : materials.shoulder);
  shoulder.receiveShadow = true;
  group.add(shoulder);
  const surfaceGeometry = ribbonGeometry(road.points, standard.width, 0.015, road.class === 'track' ? 6 : 13);
  const surface = new THREE.Mesh(surfaceGeometry, road.class === 'track' ? materials.dirt : materials.asphalt);
  surface.receiveShadow = true;
  group.add(surface);

  if (road.class !== 'track' && road.class !== 'local') {
    const centerWidth = road.class === 'local' ? 0.11 : 0.16;
    const center = dashedMarkings(road, 0, centerWidth, road.class === 'local' ? 2.8 : 4.6, road.class === 'local' ? 5.8 : 5.4);
    if (center) group.add(new THREE.Mesh(center, road.class === 'local' ? materials.laneWhite : materials.laneYellow));
    if (standard.lanes >= 4) {
      for (const side of [-1, 1]) {
        const lane = dashedMarkings(road, side * standard.width * 0.25, 0.11, 3.8, 4.8);
        if (lane) group.add(new THREE.Mesh(lane, materials.laneWhite));
      }
    }
  }
  if (road.class === 'collector' || road.class === 'arterial' || road.class === 'boulevard') {
    for (const side of [-1, 1]) {
      const sidewalkPoints = road.points.map((point, index) => {
        const previous = road.points[Math.max(0, index - 1)];
        const next = road.points[Math.min(road.points.length - 1, index + 1)];
        const dx = next.x - previous.x;
        const dz = next.z - previous.z;
        const length = Math.hypot(dx, dz) || 1;
        const offset = standard.width * 0.5 + standard.shoulder * 0.52;
        return { x: point.x - dz / length * offset * side, y: point.y + 0.055, z: point.z + dx / length * offset * side };
      });
      group.add(new THREE.Mesh(ribbonGeometry(sidewalkPoints, standard.shoulder * 0.88, 0, 3), materials.paving));
    }
  }
  group.add(bridgeDetails(road, standard, materials));
  group.traverse((object) => {
    if (object.isMesh) {
      object.receiveShadow = true;
      if (road.bridge) object.castShadow = true;
    }
  });
  return group;
}

export class RoadLayer {
  constructor(roads, materials) {
    this.group = new THREE.Group();
    this.group.name = 'road-network';
    this.objects = roads.map((road) => ({ road, object: createRoadObject(road, materials) }));
    for (const entry of this.objects) this.group.add(entry.object);
  }
  setYear(year) {
    for (const entry of this.objects) entry.object.visible = entry.road.openYear <= year;
  }
  dispose() {
    this.group.traverse((object) => object.geometry?.dispose());
  }
}

export function createRiverObject(spatial, materials) {
  const geometry = ribbonGeometry(spatial.river.map((point) => ({ ...point, y: WATER_LEVEL + 0.03 })), 1, 0, 18);
  const positions = geometry.attributes.position;
  for (let index = 0; index < spatial.river.length; index += 1) {
    const point = spatial.river[index];
    const previous = spatial.river[Math.max(0, index - 1)];
    const next = spatial.river[Math.min(spatial.river.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length;
    const nz = dx / length;
    for (let side = 0; side < 2; side += 1) {
      const sign = side === 0 ? -1 : 1;
      positions.setXYZ(index * 2 + side, point.x + nx * point.halfWidth * sign, WATER_LEVEL + 0.03, point.z + nz * point.halfWidth * sign);
    }
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, materials.water);
  mesh.name = 'river';
  mesh.renderOrder = 2;
  return mesh;
}

function gableGeometry() {
  const vertices = new Float32Array([
    -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0, 0.5, -0.5,
    -0.5, -0.5, 0.5,  0, 0.5, 0.5,  0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, -0.5,
     0.5, -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5,
  ]);
  const indices = [0, 1, 2, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 10, 12, 13, 14, 15, 16, 14, 16, 17];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const prototypes = {
  box: new THREE.BoxGeometry(1, 1, 1),
  gable: gableGeometry(),
  cylinder8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cylinder12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  sphere: new THREE.IcosahedronGeometry(0.5, 1),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
};

function localToWorld(building, x, z) {
  const cosine = Math.cos(building.rotation);
  const sine = Math.sin(building.rotation);
  return { x: building.x + x * cosine - z * sine, z: building.z + x * sine + z * cosine };
}

class DescriptorCollector {
  constructor() { this.buckets = new Map(); }
  add(kind, material, building, localPosition, scale, options = {}) {
    const key = `${kind}:${material}`;
    if (!this.buckets.has(key)) this.buckets.set(key, { kind, material, descriptors: [] });
    const world = localToWorld(building, localPosition.x, localPosition.z);
    this.buckets.get(key).descriptors.push({
      x: world.x,
      y: building.y + localPosition.y,
      z: world.z,
      rotation: -building.rotation + (options.rotation || 0),
      scale: { x: scale.x, y: scale.y, z: scale.z },
      startYear: building.constructionStart,
      builtYear: building.builtYear,
      phaseStart: options.phaseStart || 0,
      constructionOnly: Boolean(options.constructionOnly),
      removeYear: options.removeYear ?? building.removeYear ?? Infinity,
      color: options.color || null,
      castsShadow: options.castsShadow !== false,
      buildingId: building.id,
    });
  }
}

const WALL_MATERIALS = ['plaster', 'brickWarm', 'plasterLight', 'brickRed', 'plasterOchre'];
const ROOF_MATERIALS = ['roofRed', 'roofSlate', 'roofMetal'];

function addWindows(collector, building, width, depth, floors, floorHeight, baseY, options = {}) {
  const startFloor = options.startFloor || 0;
  const bay = options.bay || 3.2;
  const frontBays = Math.max(2, Math.min(9, Math.floor(width / bay)));
  const sideBays = Math.max(1, Math.min(5, Math.floor(depth / bay)));
  const glass = options.dark ? 'glassDark' : 'glass';
  for (let floor = startFloor; floor < floors; floor += 1) {
    const y = baseY + floorHeight * (floor + 0.53);
    const windowHeight = Math.min(2.15, floorHeight * 0.55);
    for (let bayIndex = 0; bayIndex < frontBays; bayIndex += 1) {
      const x = -width * 0.5 + width * (bayIndex + 0.5) / frontBays;
      const windowWidth = Math.min(1.8, width / frontBays * 0.58);
      for (const side of [-1, 1]) {
        collector.add('box', glass, building, { x, y, z: side * (depth * 0.5 + 0.035) }, { x: windowWidth, y: windowHeight, z: 0.10 }, { phaseStart: 0.72, castsShadow: false });
      }
    }
    if (options.sideWindows !== false) {
      for (let bayIndex = 0; bayIndex < sideBays; bayIndex += 1) {
        const z = -depth * 0.5 + depth * (bayIndex + 0.5) / sideBays;
        for (const side of [-1, 1]) {
          collector.add('box', glass, building, { x: side * (width * 0.5 + 0.035), y, z }, { x: 0.10, y: windowHeight, z: Math.min(1.7, depth / sideBays * 0.58) }, { phaseStart: 0.72, castsShadow: false });
        }
      }
    }
  }
}

function addScaffolding(collector, building, width, depth, height) {
  if (building.builtYear <= building.constructionStart) return;
  const xOffset = width * 0.5 + 0.8;
  const zOffset = depth * 0.5 + 0.8;
  for (const x of [-xOffset, xOffset]) {
    for (const z of [-zOffset, zOffset]) {
      collector.add('box', 'scaffolding', building, { x, y: height * 0.5, z }, { x: 0.09, y: height, z: 0.09 }, { constructionOnly: true, castsShadow: false });
    }
  }
  for (let y = 2.5; y < height; y += 3.0) {
    for (const z of [-zOffset, zOffset]) collector.add('box', 'scaffolding', building, { x: 0, y, z }, { x: width + 1.7, y: 0.07, z: 0.07 }, { constructionOnly: true, castsShadow: false });
  }
}

function addLowRise(collector, building) {
  const wall = WALL_MATERIALS[building.palette % WALL_MATERIALS.length];
  const roof = ROOF_MATERIALS[building.palette % 2];
  const wallHeight = building.height;
  collector.add('box', 'stone', building, { x: 0, y: 0.28, z: 0 }, { x: building.width + 0.45, y: 0.56, z: building.depth + 0.45 });
  collector.add('box', wall, building, { x: 0, y: wallHeight * 0.5 + 0.45, z: 0 }, { x: building.width, y: wallHeight, z: building.depth });
  const roofHeight = Math.min(4.2, Math.max(2.2, building.width * 0.20));
  collector.add('gable', roof, building, { x: 0, y: wallHeight + roofHeight * 0.5 + 0.45, z: 0 }, { x: building.width + 1.2, y: roofHeight, z: building.depth + 1.35 }, { phaseStart: 0.74 });
  addWindows(collector, building, building.width, building.depth, building.floors, building.floorHeight, 0.45, { bay: building.style === 'rowhouse' ? 2.7 : 3.4 });
  collector.add('box', 'door', building, { x: -building.width * 0.20, y: 1.45, z: -(building.depth * 0.5 + 0.08) }, { x: 1.15, y: 2.3, z: 0.16 }, { phaseStart: 0.78 });
  collector.add('box', 'roofSlate', building, { x: building.width * 0.28, y: wallHeight + roofHeight + 0.45, z: building.depth * 0.18 }, { x: 0.7, y: 1.8, z: 0.7 }, { phaseStart: 0.7 });
  if (building.style === 'shop' || building.style === 'shopHouse') {
    collector.add('box', 'glassDark', building, { x: building.width * 0.16, y: 1.65, z: -(building.depth * 0.5 + 0.10) }, { x: building.width * 0.52, y: 2.45, z: 0.18 }, { phaseStart: 0.72, castsShadow: false });
    collector.add('box', 'roofMetal', building, { x: building.width * 0.16, y: 2.85, z: -(building.depth * 0.5 + 1.05) }, { x: building.width * 0.58, y: 0.16, z: 2.1 }, { phaseStart: 0.8 });
  }
  addScaffolding(collector, building, building.width, building.depth, wallHeight + roofHeight);
}

function addMidrise(collector, building, options = {}) {
  const wall = options.wall || WALL_MATERIALS[(building.palette + 2) % WALL_MATERIALS.length];
  const podiumFloors = Math.min(2, Math.max(1, Math.floor(building.floors * 0.18)));
  const podiumHeight = podiumFloors * building.floorHeight;
  const towerHeight = building.height - podiumHeight;
  const towerWidth = building.width * (options.office ? 0.80 : 0.76);
  const towerDepth = building.depth * (options.office ? 0.76 : 0.68);
  collector.add('box', 'stone', building, { x: 0, y: 0.3, z: 0 }, { x: building.width + 0.6, y: 0.6, z: building.depth + 0.6 });
  collector.add('box', options.office ? 'glassDark' : wall, building, { x: 0, y: podiumHeight * 0.5 + 0.55, z: 0 }, { x: building.width, y: podiumHeight, z: building.depth });
  collector.add('box', wall, building, { x: 0, y: podiumHeight + towerHeight * 0.5 + 0.55, z: 0 }, { x: towerWidth, y: towerHeight, z: towerDepth });
  addWindows(collector, building, towerWidth, towerDepth, building.floors - podiumFloors, building.floorHeight, podiumHeight + 0.55, { bay: options.office ? 2.55 : 3.1, dark: options.office });
  if (!options.office) {
    for (let floor = podiumFloors + 1; floor < building.floors; floor += 2) {
      const y = floor * building.floorHeight + 0.72;
      for (const side of [-1, 1]) {
        collector.add('box', 'concrete', building, { x: 0, y, z: side * (towerDepth * 0.5 + 0.70) }, { x: towerWidth * 0.82, y: 0.16, z: 1.42 }, { phaseStart: 0.76 });
        collector.add('box', 'glass', building, { x: 0, y: y + 0.58, z: side * (towerDepth * 0.5 + 1.33) }, { x: towerWidth * 0.82, y: 1.05, z: 0.08 }, { phaseStart: 0.82, castsShadow: false });
      }
    }
  }
  collector.add('box', 'concreteDark', building, { x: 0, y: building.height + 1.15, z: 0 }, { x: towerWidth * 0.48, y: 2.1, z: towerDepth * 0.44 }, { phaseStart: 0.78 });
  collector.add('box', 'roofMetal', building, { x: 0, y: building.height + 2.28, z: 0 }, { x: towerWidth * 0.54, y: 0.16, z: towerDepth * 0.50 }, { phaseStart: 0.82 });
  if (building.floors > 8) {
    for (let index = -1; index <= 1; index += 1) {
      collector.add('box', 'solar', building, { x: index * towerWidth * 0.19, y: building.height + 2.48, z: -towerDepth * 0.10 }, { x: towerWidth * 0.16, y: 0.08, z: towerDepth * 0.28 }, { phaseStart: 0.9 });
    }
  }
  addScaffolding(collector, building, building.width, building.depth, building.height + 2.5);
}

function addTower(collector, building, office = false) {
  const podiumHeight = building.floorHeight * 3;
  const towerHeight = building.height - podiumHeight;
  const towerWidth = building.width * 0.64;
  const towerDepth = building.depth * 0.61;
  collector.add('box', 'stone', building, { x: 0, y: 0.36, z: 0 }, { x: building.width + 0.7, y: 0.72, z: building.depth + 0.7 });
  collector.add('box', office ? 'glassDark' : 'concrete', building, { x: 0, y: podiumHeight * 0.5 + 0.65, z: 0 }, { x: building.width, y: podiumHeight, z: building.depth });
  collector.add('box', office ? 'glassDark' : 'plasterLight', building, { x: building.width * 0.08, y: podiumHeight + towerHeight * 0.5 + 0.65, z: 0 }, { x: towerWidth, y: towerHeight, z: towerDepth });
  const facadeMaterial = office ? 'glass' : 'glassDark';
  for (let floor = 3; floor < building.floors; floor += 1) {
    const y = floor * building.floorHeight + building.floorHeight * 0.52 + 0.65;
    for (const side of [-1, 1]) {
      collector.add('box', facadeMaterial, building, { x: building.width * 0.08, y, z: side * (towerDepth * 0.5 + 0.045) }, { x: towerWidth * 0.90, y: building.floorHeight * 0.62, z: 0.11 }, { phaseStart: 0.72, castsShadow: false });
      collector.add('box', facadeMaterial, building, { x: building.width * 0.08 + side * (towerWidth * 0.5 + 0.045), y, z: 0 }, { x: 0.11, y: building.floorHeight * 0.62, z: towerDepth * 0.90 }, { phaseStart: 0.72, castsShadow: false });
    }
    if (!office && floor % 2 === 0) {
      collector.add('box', 'concrete', building, { x: building.width * 0.08, y: y - building.floorHeight * 0.35, z: -(towerDepth * 0.5 + 0.62) }, { x: towerWidth * 0.88, y: 0.14, z: 1.25 }, { phaseStart: 0.78 });
      collector.add('box', 'glass', building, { x: building.width * 0.08, y: y + 0.06, z: -(towerDepth * 0.5 + 1.18) }, { x: towerWidth * 0.88, y: 0.78, z: 0.08 }, { phaseStart: 0.82, castsShadow: false });
    }
  }
  collector.add('box', 'metal', building, { x: building.width * 0.08, y: building.height + 2.0, z: 0 }, { x: towerWidth * 0.54, y: 3.2, z: towerDepth * 0.52 }, { phaseStart: 0.80 });
  collector.add('box', 'roofMetal', building, { x: building.width * 0.08, y: building.height + 3.65, z: 0 }, { x: towerWidth * 0.62, y: 0.18, z: towerDepth * 0.60 }, { phaseStart: 0.86 });
  addScaffolding(collector, building, building.width, building.depth, building.height + 3.8);
}

function addIndustrial(collector, building) {
  const height = Math.max(6.8, building.height);
  collector.add('box', 'concreteDark', building, { x: 0, y: 0.35, z: 0 }, { x: building.width + 0.5, y: 0.7, z: building.depth + 0.5 });
  collector.add('box', 'brickRed', building, { x: 0, y: height * 0.5 + 0.6, z: 0 }, { x: building.width, y: height, z: building.depth });
  collector.add('gable', 'roofMetal', building, { x: 0, y: height + 2.1, z: 0 }, { x: building.width + 1, y: 3.3, z: building.depth + 1 }, { phaseStart: 0.70 });
  for (let index = -1; index <= 1; index += 1) {
    collector.add('box', 'metal', building, { x: index * building.width * 0.26, y: 2.4, z: -(building.depth * 0.5 + 0.08) }, { x: building.width * 0.18, y: 4.0, z: 0.16 }, { phaseStart: 0.78 });
  }
  for (let index = -2; index <= 2; index += 1) collector.add('box', 'glass', building, { x: index * building.width * 0.16, y: height * 0.66, z: building.depth * 0.5 + 0.06 }, { x: building.width * 0.10, y: 1.25, z: 0.12 }, { phaseStart: 0.76, castsShadow: false });
  collector.add('cylinder12', 'metal', building, { x: building.width * 0.27, y: height + 3.7, z: building.depth * 0.19 }, { x: 1.1, y: 6.5, z: 1.1 }, { phaseStart: 0.76 });
  addScaffolding(collector, building, building.width, building.depth, height + 3.6);
}

function addCivic(collector, building) {
  const wall = building.style === 'school' ? 'brickWarm' : building.style === 'hospital' ? 'plasterLight' : 'stone';
  const wingWidth = building.width * 0.34;
  const centerWidth = building.width * 0.30;
  collector.add('box', 'stone', building, { x: 0, y: 0.34, z: 0 }, { x: building.width + 0.7, y: 0.68, z: building.depth + 0.7 });
  for (const side of [-1, 1]) collector.add('box', wall, building, { x: side * building.width * 0.31, y: building.height * 0.44 + 0.7, z: 0 }, { x: wingWidth, y: building.height * 0.88, z: building.depth });
  collector.add('box', wall, building, { x: 0, y: building.height * 0.5 + 0.7, z: building.depth * 0.04 }, { x: centerWidth, y: building.height, z: building.depth * 0.92 });
  addWindows(collector, building, building.width, building.depth, building.floors, building.floorHeight, 0.7, { bay: 3.4, dark: building.style === 'hospital' });
  collector.add('box', 'glassDark', building, { x: 0, y: 2.2, z: -(building.depth * 0.5 + 0.10) }, { x: centerWidth * 0.72, y: 3.0, z: 0.16 }, { phaseStart: 0.72, castsShadow: false });
  collector.add('box', 'roofMetal', building, { x: 0, y: 3.75, z: -(building.depth * 0.5 + 1.6) }, { x: centerWidth * 0.88, y: 0.18, z: 3.2 }, { phaseStart: 0.80 });
  collector.add('box', 'roofSlate', building, { x: 0, y: building.height + 0.84, z: 0 }, { x: building.width + 0.35, y: 0.24, z: building.depth + 0.35 }, { phaseStart: 0.75 });
  addScaffolding(collector, building, building.width, building.depth, building.height + 1);
}

function addStation(collector, building) {
  const height = Math.max(8.5, building.height);
  collector.add('box', 'stone', building, { x: 0, y: 0.35, z: 0 }, { x: building.width + 0.6, y: 0.7, z: building.depth + 0.6 });
  collector.add('box', 'brickWarm', building, { x: 0, y: height * 0.5 + 0.7, z: 0 }, { x: building.width, y: height, z: building.depth * 0.68 });
  collector.add('box', 'glass', building, { x: 0, y: height * 0.54, z: -(building.depth * 0.34 + 0.08) }, { x: building.width * 0.46, y: height * 0.54, z: 0.14 }, { phaseStart: 0.72, castsShadow: false });
  collector.add('gable', 'roofSlate', building, { x: 0, y: height + 2.3, z: 0 }, { x: building.width + 1.1, y: 3.8, z: building.depth * 0.74 }, { phaseStart: 0.73 });
  collector.add('box', 'roofMetal', building, { x: 0, y: 4.4, z: -(building.depth * 0.5 + 4.2) }, { x: building.width * 1.15, y: 0.24, z: 8.5 }, { phaseStart: 0.80 });
  addScaffolding(collector, building, building.width, building.depth, height + 3.8);
}

function collectBuildingDescriptors(buildings) {
  const collector = new DescriptorCollector();
  for (const building of buildings) {
    if (['farmhouse', 'cottage', 'rowhouse', 'workshop', 'shop', 'shopHouse'].includes(building.style)) addLowRise(collector, building);
    else if (building.style === 'industrial' || building.style === 'utility') addIndustrial(collector, building);
    else if (['civic', 'school', 'clinic', 'hospital'].includes(building.style)) addCivic(collector, building);
    else if (building.style === 'station') addStation(collector, building);
    else if (building.style === 'residentialTower' || building.style === 'mixedTower') addTower(collector, building, false);
    else if (building.style === 'officeTower') addTower(collector, building, true);
    else addMidrise(collector, building, { office: building.style === 'office', wall: building.style === 'mixedMid' ? 'brickWarm' : undefined });
  }
  return collector;
}

function applyDescriptorMatrix(descriptor, year, matrix) {
  const started = year >= descriptor.startYear;
  const finished = descriptor.builtYear <= descriptor.startYear ? 1 : clamp01((year - descriptor.startYear) / (descriptor.builtYear - descriptor.startYear));
  const removed = year >= descriptor.removeYear;
  let progress = started && !removed ? clamp01((finished - descriptor.phaseStart) / Math.max(0.001, 1 - descriptor.phaseStart)) : 0;
  if (descriptor.constructionOnly) progress = started && finished < 1 && !removed ? 1 : 0;
  const visibleScale = progress <= 0 ? 0.00001 : progress;
  const height = descriptor.scale.y * visibleScale;
  const bottom = descriptor.y - descriptor.scale.y * 0.5;
  tempPosition.set(descriptor.x, bottom + height * 0.5, descriptor.z);
  tempEuler.set(0, descriptor.rotation, 0);
  tempQuaternion.setFromEuler(tempEuler);
  tempScale.set(descriptor.scale.x * (progress > 0 ? 1 : 0.00001), Math.max(0.00001, height), descriptor.scale.z * (progress > 0 ? 1 : 0.00001));
  matrix.compose(tempPosition, tempQuaternion, tempScale);
}

export class BuildingLayer {
  constructor(buildings, materials) {
    this.group = new THREE.Group();
    this.group.name = 'architectural-buildings';
    this.meshes = [];
    const collector = collectBuildingDescriptors(buildings);
    for (const bucket of collector.buckets.values()) {
      const geometry = prototypes[bucket.kind];
      if (!geometry || !materials[bucket.material] || !bucket.descriptors.length) continue;
      const mesh = new THREE.InstancedMesh(geometry, materials[bucket.material], bucket.descriptors.length);
      mesh.name = `instances-${bucket.kind}-${bucket.material}`;
      mesh.userData.descriptors = bucket.descriptors;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = bucket.material !== 'glass' && bucket.material !== 'glassDark' && bucket.material !== 'scaffolding';
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
  }
  setYear(year) {
    for (const mesh of this.meshes) {
      const descriptors = mesh.userData.descriptors;
      let drawCount = 0;
      for (let index = 0; index < descriptors.length; index += 1) {
        applyDescriptorMatrix(descriptors[index], year, tempMatrix);
        mesh.setMatrixAt(index, tempMatrix);
        if (descriptors[index].startYear <= year) drawCount = index + 1;
      }
      mesh.count = drawCount;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }
  dispose() {
    for (const mesh of this.meshes) mesh.dispose();
  }
}

function distanceToRoads(point, roads) {
  let best = Infinity;
  for (const road of roads) {
    for (let index = 1; index < road.points.length; index += 1) {
      const a = road.points[index - 1];
      const b = road.points[index];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const lengthSq = dx * dx + dz * dz;
      const t = lengthSq ? clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq, 0, 1) : 0;
      best = Math.min(best, Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t)) - ROAD_STANDARDS[road.class].width * 0.5);
    }
  }
  return best;
}

function treeRemovalYear(point, buildings) {
  let year = Infinity;
  for (const building of buildings) {
    const dx = point.x - building.x;
    const dz = point.z - building.z;
    if (Math.hypot(dx, dz) < Math.hypot(building.width, building.depth) * 0.62 + 6) year = Math.min(year, building.constructionStart);
  }
  return year;
}

export class VegetationLayer {
  constructor(spatial, simulation, materials) {
    this.group = new THREE.Group();
    this.group.name = 'vegetation';
    const random = createRandom(hashString(`${simulation.seed}:v3-vegetation`));
    const descriptors = [];
    let attempts = 0;
    while (descriptors.length < 620 && attempts++ < 8000) {
      const x = (random() * 2 - 1) * (REGION_HALF - 35);
      const z = (random() * 2 - 1) * (REGION_HALF - 35);
      const y = terrainHeight(x, z, spatial.seedValue);
      if (y < WATER_LEVEL + 0.7 || terrainSlope(x, z, spatial.seedValue) > 25 || distanceToRoads({ x, z }, simulation.roads) < 8) continue;
      const removeYear = treeRemovalYear({ x, z }, simulation.buildings);
      if (removeYear <= 0) continue;
      const height = 5.5 + random() * 8.5;
      const radius = height * (0.24 + random() * 0.10);
      descriptors.push({
        x, y, z, height, radius, removeYear,
        crownAngle: random() * Math.PI * 2,
        color: new THREE.Color().setHSL(0.27 + random() * 0.05, 0.28 + random() * 0.18, 0.43 + random() * 0.14),
      });
    }
    this.descriptors = descriptors;
    this.trunks = new THREE.InstancedMesh(prototypes.cylinder8, materials.trunk, descriptors.length);
    this.canopies = Array.from({ length: 3 }, () => new THREE.InstancedMesh(prototypes.sphere, materials.canopy, descriptors.length));
    this.trunks.castShadow = true;
    this.canopies.forEach((canopy) => { canopy.castShadow = true; canopy.receiveShadow = true; canopy.frustumCulled = false; });
    this.trunks.receiveShadow = true;
    this.trunks.frustumCulled = false;
    this.canopies.forEach((canopy) => {
      descriptors.forEach((descriptor, index) => canopy.setColorAt(index, descriptor.color));
      canopy.instanceColor.needsUpdate = true;
    });
    this.group.add(this.trunks, ...this.canopies);
  }
  setYear(year) {
    for (let index = 0; index < this.descriptors.length; index += 1) {
      const descriptor = this.descriptors[index];
      const visible = year < descriptor.removeYear ? 1 : 0.00001;
      tempPosition.set(descriptor.x, descriptor.y + descriptor.height * 0.23 * visible, descriptor.z);
      tempQuaternion.identity();
      tempScale.set(descriptor.radius * 0.23 * visible, descriptor.height * 0.46 * visible, descriptor.radius * 0.23 * visible);
      tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
      this.trunks.setMatrixAt(index, tempMatrix);
      const crownCos = Math.cos(descriptor.crownAngle);
      const crownSin = Math.sin(descriptor.crownAngle);
      const lobes = [
        [0, descriptor.height * 0.69, 0, 1.34, 0.66],
        [crownCos * descriptor.radius * 0.38, descriptor.height * 0.65, crownSin * descriptor.radius * 0.38, 0.86, 0.48],
        [-crownSin * descriptor.radius * 0.34, descriptor.height * 0.76, crownCos * descriptor.radius * 0.34, 0.76, 0.43],
      ];
      lobes.forEach(([offsetX, offsetY, offsetZ, radialScale, verticalScale], canopyIndex) => {
        tempPosition.set(descriptor.x + offsetX * visible, descriptor.y + offsetY * visible, descriptor.z + offsetZ * visible);
        tempScale.set(descriptor.radius * radialScale * visible, descriptor.height * verticalScale * visible, descriptor.radius * radialScale * visible);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        this.canopies[canopyIndex].setMatrixAt(index, tempMatrix);
      });
    }
    this.trunks.instanceMatrix.needsUpdate = true;
    this.canopies.forEach((canopy) => { canopy.instanceMatrix.needsUpdate = true; });
  }
  dispose() {
    this.trunks.dispose();
    this.canopies.forEach((canopy) => canopy.dispose());
  }
}
