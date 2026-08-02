import {
  chaikin,
  clamp,
  clamp01,
  createRandom,
  distance2,
  fbm,
  gaussian2,
  hashString,
  pointSegmentDistance,
  polylineLength,
  resamplePolyline,
  samplePolyline,
  smoothstep,
} from './core.js';

export const REGION_SIZE = 2400;
export const REGION_HALF = REGION_SIZE * 0.5;
export const WATER_LEVEL = 5.6;
export const TERRAIN_RESOLUTION = 160;

export const ROAD_STANDARDS = Object.freeze({
  track: { width: 4.2, shoulder: 1.1, lanes: 1, speed: 20 },
  local: { width: 6.8, shoulder: 1.6, lanes: 2, speed: 30 },
  collector: { width: 11.4, shoulder: 2.2, lanes: 2, speed: 50 },
  arterial: { width: 18.6, shoulder: 3.0, lanes: 4, speed: 70 },
  boulevard: { width: 23.5, shoulder: 3.8, lanes: 4, speed: 60 },
});

export function riverCenterX(z) {
  return -305 + z * 0.105 + Math.sin(z / 285) * 92 + Math.sin(z / 93) * 23;
}

export function riverHalfWidth(z) {
  return 27 + (Math.sin(z / 170) + 1) * 5.5;
}

export function riverDistance(x, z) {
  return Math.abs(x - riverCenterX(z));
}

export function terrainHeight(x, z, seed = 0) {
  const macro = fbm((x + 1800) / 820, (z - 600) / 820, seed + 11, 5) * 14;
  const detail = fbm((x - 300) / 245, (z + 950) / 245, seed + 173, 4) * 3.8;
  const eastRidge = gaussian2(x, z, 1020, 480, 390, 720) * 105;
  const northRidge = gaussian2(x, z, 420, 1160, 840, 260) * 47;
  const westMass = gaussian2(x, z, -1070, -240, 330, 910) * 88;
  const saddle = gaussian2(x, z, 160, -130, 540, 460) * -9;
  let height = 27 + macro + detail + eastRidge + northRidge + westMass + saddle;

  const distance = riverDistance(x, z);
  const valley = smoothstep(360, 28, distance);
  const riverFloor = 2.1 + Math.min(distance, 95) * 0.105 + Math.sin(z / 210) * 0.55;
  height = height * (1 - valley) + riverFloor * valley;

  const floodplain = smoothstep(240, 55, distance) * (1 - smoothstep(55, 25, distance));
  height -= floodplain * 3.2;
  return height;
}

export function terrainSlope(x, z, seed = 0) {
  const step = 5;
  const dx = terrainHeight(x + step, z, seed) - terrainHeight(x - step, z, seed);
  const dz = terrainHeight(x, z + step, seed) - terrainHeight(x, z - step, seed);
  return Math.atan(Math.hypot(dx, dz) / (step * 2)) * 180 / Math.PI;
}

export function isWater(x, z, seed = 0) {
  return riverDistance(x, z) < riverHalfWidth(z) && terrainHeight(x, z, seed) < WATER_LEVEL;
}

export function terrainSurface(x, z, seed = 0) {
  return Math.max(terrainHeight(x, z, seed), isWater(x, z, seed) ? WATER_LEVEL : -Infinity);
}

export function classifyGround(x, z, seed = 0) {
  const height = terrainHeight(x, z, seed);
  const slope = terrainSlope(x, z, seed);
  const wetness = clamp01(1 - riverDistance(x, z) / 280);
  if (isWater(x, z, seed)) return 'water';
  if (slope > 25 || height > 94) return 'rock';
  if (wetness > 0.55) return 'riparian';
  if (height > 68) return 'upland';
  return 'grassland';
}

class MinHeap {
  constructor() { this.items = []; }
  get length() { return this.items.length; }
  push(item) {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.items[parent].priority <= item.priority) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }
  pop() {
    const root = this.items[0];
    const end = this.items.pop();
    if (this.items.length && end) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.items.length) break;
        const child = right < this.items.length && this.items[right].priority < this.items[left].priority ? right : left;
        if (this.items[child].priority >= end.priority) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = end;
    }
    return root;
  }
}

function simplifyPath(points, tolerance = 22) {
  if (points.length <= 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  let index = -1;
  let maxDistance = 0;
  for (let cursor = 1; cursor < points.length - 1; cursor += 1) {
    const distance = pointSegmentDistance(points[cursor], first, last).distance;
    if (distance > maxDistance) {
      maxDistance = distance;
      index = cursor;
    }
  }
  if (maxDistance <= tolerance || index < 0) return [first, last];
  return [
    ...simplifyPath(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplifyPath(points.slice(index), tolerance),
  ];
}

function routeBetween(start, end, seed, options = {}) {
  const spacing = options.gridSpacing || 42;
  const gridSize = Math.round(REGION_SIZE / spacing) + 1;
  const cellSpacing = REGION_SIZE / (gridSize - 1);
  const toGrid = (point) => ({
    x: clamp(Math.round((point.x + REGION_HALF) / cellSpacing), 0, gridSize - 1),
    z: clamp(Math.round((point.z + REGION_HALF) / cellSpacing), 0, gridSize - 1),
  });
  const toWorld = (x, z) => ({ x: x * cellSpacing - REGION_HALF, z: z * cellSpacing - REGION_HALF });
  const startCell = toGrid(start);
  const endCell = toGrid(end);
  const indexOf = (x, z) => z * gridSize + x;
  const count = gridSize * gridSize;
  const score = new Float64Array(count);
  score.fill(Infinity);
  const previous = new Int32Array(count);
  previous.fill(-1);
  const visited = new Uint8Array(count);
  const open = new MinHeap();
  const startIndex = indexOf(startCell.x, startCell.z);
  const endIndex = indexOf(endCell.x, endCell.z);
  score[startIndex] = 0;
  open.push({ index: startIndex, x: startCell.x, z: startCell.z, priority: 0 });
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

  while (open.length) {
    const current = open.pop();
    if (visited[current.index]) continue;
    visited[current.index] = 1;
    if (current.index === endIndex) break;
    const world = toWorld(current.x, current.z);
    const currentHeight = terrainHeight(world.x, world.z, seed);
    for (const [dx, dz] of neighbors) {
      const nx = current.x + dx;
      const nz = current.z + dz;
      if (nx < 1 || nz < 1 || nx >= gridSize - 1 || nz >= gridSize - 1) continue;
      const nextIndex = indexOf(nx, nz);
      if (visited[nextIndex]) continue;
      const next = toWorld(nx, nz);
      const nextHeight = terrainHeight(next.x, next.z, seed);
      const step = Math.hypot(dx, dz) * cellSpacing;
      const grade = Math.abs(nextHeight - currentHeight) / step;
      const water = isWater(next.x, next.z, seed);
      if (water && !options.allowBridge) continue;
      const steepPenalty = 1 + Math.pow(grade * 11, 2.2) * (options.class === 'track' ? 0.7 : 1.6);
      const floodPenalty = smoothstep(260, 45, riverDistance(next.x, next.z)) * (water ? 0 : 1.2);
      const bridgePenalty = water ? 8.5 : 0;
      const edgePenalty = smoothstep(REGION_HALF, REGION_HALF - 100, Math.max(Math.abs(next.x), Math.abs(next.z))) * 5;
      const candidate = score[current.index] + step * (steepPenalty + floodPenalty + bridgePenalty + edgePenalty);
      if (candidate >= score[nextIndex]) continue;
      score[nextIndex] = candidate;
      previous[nextIndex] = current.index;
      const heuristic = Math.hypot(nx - endCell.x, nz - endCell.z) * cellSpacing;
      open.push({ index: nextIndex, x: nx, z: nz, priority: candidate + heuristic });
    }
  }

  if (previous[endIndex] < 0) return [start, end];
  const reversed = [];
  let cursor = endIndex;
  while (cursor >= 0) {
    reversed.push(toWorld(cursor % gridSize, Math.floor(cursor / gridSize)));
    if (cursor === startIndex) break;
    cursor = previous[cursor];
  }
  reversed.reverse();
  reversed[0] = { ...start };
  reversed[reversed.length - 1] = { ...end };
  const simplified = simplifyPath(reversed, options.class === 'arterial' ? 30 : 21);
  const rounded = chaikin(simplified, 2);
  return resamplePolyline(rounded, options.class === 'track' ? 18 : 14);
}

const HUBS = Object.freeze({
  village: { x: 80, z: 90 },
  northFarm: { x: 42, z: 690 },
  eastFarm: { x: 540, z: 320 },
  mill: { x: -150, z: 250 },
  southGate: { x: 165, z: -520 },
  station: { x: 305, z: -620 },
  industry: { x: 765, z: -630 },
  eastHill: { x: 735, z: 310 },
  westTown: { x: -650, z: 60 },
  westNorth: { x: -650, z: 570 },
  civic: { x: 185, z: -40 },
  southDistrict: { x: 470, z: -210 },
  northDistrict: { x: 385, z: 520 },
});

const ROAD_BLUEPRINTS = Object.freeze([
  { id: 'old-road', name: '옛길', from: 'southGate', to: 'northFarm', class: 'local', triggerPopulation: 0, publicCost: 0 },
  { id: 'farm-lane', name: '들녘길', from: 'village', to: 'eastFarm', class: 'track', triggerPopulation: 0, publicCost: 0 },
  { id: 'mill-lane', name: '물방앗간길', from: 'village', to: 'mill', class: 'track', triggerPopulation: 0, publicCost: 0 },
  { id: 'station-road', name: '역전로', from: 'village', to: 'station', class: 'collector', triggerPopulation: 150, publicCost: 1.4 },
  { id: 'east-collector', name: '동부순환로', from: 'station', to: 'eastHill', class: 'collector', triggerPopulation: 520, publicCost: 2.8 },
  { id: 'bridge-avenue', name: '강서대로', from: 'westTown', to: 'civic', class: 'arterial', triggerPopulation: 950, publicCost: 6.8, allowBridge: true },
  { id: 'industry-road', name: '산업로', from: 'station', to: 'industry', class: 'arterial', triggerPopulation: 1450, publicCost: 5.4 },
  { id: 'north-collector', name: '북부로', from: 'civic', to: 'northDistrict', class: 'collector', triggerPopulation: 2100, publicCost: 3.2 },
  { id: 'south-boulevard', name: '남부대로', from: 'civic', to: 'southDistrict', class: 'boulevard', triggerPopulation: 3300, publicCost: 7.4 },
  { id: 'west-river-road', name: '서안로', from: 'westTown', to: 'westNorth', class: 'collector', triggerPopulation: 4300, publicCost: 4.5 },
  { id: 'north-link', name: '북부연결로', from: 'northDistrict', to: 'eastHill', class: 'collector', triggerPopulation: 6100, publicCost: 4.3 },
  { id: 'second-bridge', name: '북강교로', from: 'westNorth', to: 'northDistrict', class: 'arterial', triggerPopulation: 8500, publicCost: 9.2, allowBridge: true },
]);

function addNeighborhoodRoads(roads, seed) {
  const districts = [
    { id: 'village', center: HUBS.village, triggerPopulation: 80, radius: 180, count: 3 },
    { id: 'station', center: HUBS.station, triggerPopulation: 700, radius: 230, count: 4 },
    { id: 'east', center: HUBS.eastHill, triggerPopulation: 1800, radius: 250, count: 5 },
    { id: 'south', center: HUBS.southDistrict, triggerPopulation: 3100, radius: 285, count: 5 },
    { id: 'north', center: HUBS.northDistrict, triggerPopulation: 5200, radius: 300, count: 6 },
    { id: 'west', center: HUBS.westTown, triggerPopulation: 4800, radius: 235, count: 4 },
  ];
  const random = createRandom(seed + 4049);
  for (const district of districts) {
    for (let index = 0; index < district.count; index += 1) {
      const angle = (index / district.count) * Math.PI * 2 + random() * 0.34;
      const radius = district.radius * (0.72 + random() * 0.28);
      const end = {
        x: district.center.x + Math.cos(angle) * radius,
        z: district.center.z + Math.sin(angle) * radius,
      };
      if (riverDistance(end.x, end.z) < 72 || terrainSlope(end.x, end.z, seed) > 18) continue;
      const id = `${district.id}-local-${index + 1}`;
      const points = routeBetween(district.center, end, seed, { class: 'local', allowBridge: false, gridSpacing: 34 });
      roads.push({
        id,
        name: `${district.id} 생활가로 ${index + 1}`,
        class: 'local',
        triggerPopulation: district.triggerPopulation + index * Math.max(60, district.triggerPopulation * 0.08),
        publicCost: 0.55 + polylineLength(points) / 480,
        points,
        length: polylineLength(points),
        bridge: false,
        openYear: Infinity,
      });
    }
  }
}

function finishRoadHeights(road, seed) {
  const waterIndices = [];
  road.points.forEach((point, index) => {
    if (isWater(point.x, point.z, seed)) waterIndices.push(index);
  });
  const bridge = waterIndices.length > 0;
  const firstWater = bridge ? waterIndices[0] : -1;
  const lastWater = bridge ? waterIndices[waterIndices.length - 1] : -1;
  road.points = road.points.map((point, index) => {
    const previous = road.points[Math.max(0, index - 1)];
    const next = road.points[Math.min(road.points.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const tangentLength = Math.hypot(dx, dz) || 1;
    const nx = -dz / tangentLength;
    const nz = dx / tangentLength;
    const standard = ROAD_STANDARDS[road.class];
    const crossOffset = standard.width * 0.5 + standard.shoulder;
    const ground = Math.max(
      terrainHeight(point.x, point.z, seed),
      terrainHeight(point.x + nx * crossOffset, point.z + nz * crossOffset, seed),
      terrainHeight(point.x - nx * crossOffset, point.z - nz * crossOffset, seed),
    );
    if (!bridge) return { ...point, y: ground + 0.62, bridge: false };
    const approachStart = Math.max(0, firstWater - 7);
    const approachEnd = Math.min(road.points.length - 1, lastWater + 7);
    if (index < approachStart || index > approachEnd) return { ...point, y: ground + 0.62, bridge: false };
    const rampIn = smoothstep(approachStart, firstWater + 1, index);
    const rampOut = 1 - smoothstep(lastWater - 1, approachEnd, index);
    const bridgeWeight = Math.min(rampIn, rampOut);
    const deck = WATER_LEVEL + 7.2;
    return { ...point, y: Math.max(ground + 0.62, ground * (1 - bridgeWeight) + deck * bridgeWeight), bridge: bridgeWeight > 0.08 };
  });
  road.bridge = bridge;
  road.length = polylineLength(road.points);
  return road;
}

function generateRoads(seed) {
  const roads = ROAD_BLUEPRINTS.map((blueprint) => {
    const points = routeBetween(HUBS[blueprint.from], HUBS[blueprint.to], seed, {
      class: blueprint.class,
      allowBridge: Boolean(blueprint.allowBridge),
    });
    return finishRoadHeights({ ...blueprint, points, openYear: Infinity }, seed);
  });
  addNeighborhoodRoads(roads, seed);
  for (const road of roads) finishRoadHeights(road, seed);
  return roads;
}

function nearestHub(point) {
  let winner = 'village';
  let best = Infinity;
  for (const [name, hub] of Object.entries(HUBS)) {
    const distance = distance2(point, hub);
    if (distance < best) { best = distance; winner = name; }
  }
  return { id: winner, distance: best };
}

function generateSites(roads, seed) {
  const random = createRandom(seed + 8137);
  const sites = [];
  const bins = new Map();
  const binSize = 48;
  const keyFor = (x, z) => `${Math.floor((x + REGION_HALF) / binSize)}:${Math.floor((z + REGION_HALF) / binSize)}`;
  function collides(candidate, radius) {
    const bx = Math.floor((candidate.x + REGION_HALF) / binSize);
    const bz = Math.floor((candidate.z + REGION_HALF) / binSize);
    for (let dz = -2; dz <= 2; dz += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        for (const site of bins.get(`${bx + dx}:${bz + dz}`) || []) {
          if (distance2(candidate, site) < (radius + site.radius) * 0.68 + 2) return true;
        }
      }
    }
    return false;
  }
  function reserve(site) {
    const key = keyFor(site.x, site.z);
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key).push(site);
  }

  const classOrder = { track: 0, local: 1, collector: 2, arterial: 3, boulevard: 4 };
  const orderedRoads = [...roads].sort((a, b) => classOrder[a.class] - classOrder[b.class]);
  for (const road of orderedRoads) {
    const standard = ROAD_STANDARDS[road.class];
    const directAccess = road.class === 'arterial' || road.class === 'boulevard' ? 0.36 : 1;
    const spacing = road.class === 'track' ? 52 : road.class === 'local' ? 38 : road.class === 'collector' ? 46 : 62;
    for (let distanceAlong = spacing * 0.75; distanceAlong < road.length - spacing * 0.6; distanceAlong += spacing * (0.88 + random() * 0.28)) {
      if (random() > directAccess) continue;
      const sample = samplePolyline(road.points, distanceAlong);
      if (!sample) continue;
      for (const side of [-1, 1]) {
        if (random() < 0.08) continue;
        const lotWidth = spacing * (0.72 + random() * 0.34);
        const lotDepth = road.class === 'track' ? 38 + random() * 18 : road.class === 'local' ? 34 + random() * 14 : 43 + random() * 21;
        const offset = standard.width * 0.5 + standard.shoulder + lotDepth * 0.5 + 4.5;
        const normal = { x: -sample.tangent.z * side, z: sample.tangent.x * side };
        const candidate = {
          x: sample.x + normal.x * offset,
          z: sample.z + normal.z * offset,
        };
        if (Math.abs(candidate.x) > REGION_HALF - 55 || Math.abs(candidate.z) > REGION_HALF - 55) continue;
        const waterDistance = riverDistance(candidate.x, candidate.z);
        const slope = terrainSlope(candidate.x, candidate.z, seed);
        if (waterDistance < riverHalfWidth(candidate.z) + 42 || isWater(candidate.x, candidate.z, seed) || slope > 13.8) continue;
        const radius = Math.hypot(lotWidth, lotDepth) * 0.38;
        if (collides(candidate, radius)) continue;
        const hub = nearestHub(candidate);
        const centerDistance = distance2(candidate, HUBS.civic);
        const site = {
          id: `site-${sites.length + 1}`,
          x: candidate.x,
          y: terrainHeight(candidate.x, candidate.z, seed),
          z: candidate.z,
          rotation: Math.atan2(sample.tangent.z, sample.tangent.x),
          tangent: sample.tangent,
          normal,
          roadId: road.id,
          roadClass: road.class,
          roadTriggerPopulation: road.triggerPopulation,
          lotWidth,
          lotDepth,
          lotArea: lotWidth * lotDepth,
          radius,
          slope,
          waterDistance,
          district: hub.id,
          hubDistance: hub.distance,
          centerDistance,
          suitability: clamp01(0.92 - slope / 25 - Math.max(0, 90 - waterDistance) / 170 - centerDistance / 6000 + random() * 0.08),
          occupied: false,
        };
        sites.push(site);
        reserve(site);
      }
    }
  }
  return sites;
}

function generateRiver(seed) {
  const points = [];
  const count = 180;
  for (let index = 0; index <= count; index += 1) {
    const z = -REGION_HALF - 80 + (REGION_SIZE + 160) * index / count;
    const x = riverCenterX(z);
    points.push({ x, y: WATER_LEVEL, z, halfWidth: riverHalfWidth(z) });
  }
  return points;
}

function generateTerrainSamples(seed, resolution = TERRAIN_RESOLUTION) {
  const size = resolution + 1;
  const heights = new Float32Array(size * size);
  const ground = new Uint8Array(size * size);
  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      const wx = x / resolution * REGION_SIZE - REGION_HALF;
      const wz = z / resolution * REGION_SIZE - REGION_HALF;
      const index = z * size + x;
      heights[index] = terrainHeight(wx, wz, seed);
      ground[index] = ['water', 'grassland', 'riparian', 'upland', 'rock'].indexOf(classifyGround(wx, wz, seed));
    }
  }
  return { resolution, heights, ground };
}

export function createSpatialPlan(input = {}) {
  const seedText = String(input.seed || 'new-horizon');
  const seed = hashString(`${seedText}:v3-spatial`);
  const roads = generateRoads(seed);
  const sites = generateSites(roads, seed);
  const terrain = generateTerrainSamples(seed, input.terrainResolution || TERRAIN_RESOLUTION);
  const river = generateRiver(seed);
  return {
    version: '3.0.0-clean-spatial-core',
    seed: seedText,
    seedValue: seed,
    regionSize: REGION_SIZE,
    waterLevel: WATER_LEVEL,
    hubs: structuredClone(HUBS),
    roads,
    sites,
    river,
    terrain,
    heightAt: (x, z) => terrainHeight(x, z, seed),
    slopeAt: (x, z) => terrainSlope(x, z, seed),
    isWaterAt: (x, z) => isWater(x, z, seed),
    diagnostics: {
      roads: roads.length,
      sites: sites.length,
      bridges: roads.filter((road) => road.bridge).length,
      roadLengthKm: roads.reduce((sum, road) => sum + road.length, 0) / 1000,
      maximumSiteSlope: Math.max(...sites.map((site) => site.slope)),
    },
  };
}
