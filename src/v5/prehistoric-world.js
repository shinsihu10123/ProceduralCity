import {
  clamp,
  clamp01,
  createRandom,
  fbm,
  hashString,
  lerp,
} from '../v3/core.js';
import { createMacroWorld, MACRO_BIOMES } from '../v3/macro-world.js';

export const START_CALENDAR_YEAR = -12000;
export const GOODS = Object.freeze(['food', 'timber', 'stone', 'metal', 'craft', 'fuel']);
export const GOOD_LABELS = Object.freeze({
  food: '식량', timber: '목재', stone: '석재', metal: '금속', craft: '수공품', fuel: '연료',
});

const MAX_COMMUNITIES = 96;
const NEIGHBORS_8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
const indexOf = (x, z, size) => z * size + x;

export const TECHNOLOGIES = Object.freeze([
  { id: 'fire', label: '불의 이용', baseline: true },
  { id: 'stoneTools', label: '석기 제작', baseline: true },
  { id: 'foraging', label: '복합 수렵·채집', baseline: true },
  { id: 'woodworking', label: '목재 가공', requires: ['stoneTools'], difficulty: 0.48, resource: 'timber' },
  { id: 'sedentism', label: '반정착 생활', requires: ['foraging'], difficulty: 0.72, environment: 'water' },
  { id: 'agriculture', label: '작물 재배', requires: ['sedentism'], difficulty: 1.02, resource: 'arable' },
  { id: 'pottery', label: '토기', requires: ['sedentism'], difficulty: 0.58, resource: 'stone' },
  { id: 'husbandry', label: '가축 사육', requires: ['agriculture'], difficulty: 0.70, environment: 'grass' },
  { id: 'weaving', label: '직조', requires: ['agriculture'], difficulty: 0.66 },
  { id: 'sailing', label: '연안 항해', requires: ['woodworking', 'pottery'], difficulty: 0.84, environment: 'coast' },
  { id: 'copper', label: '동 제련', requires: ['pottery', 'stoneTools'], difficulty: 0.96, resource: 'copper' },
  { id: 'wheel', label: '바퀴와 수레', requires: ['woodworking', 'agriculture'], difficulty: 0.88 },
  { id: 'bronze', label: '청동 합금', requires: ['copper'], difficulty: 1.10, resources: ['copper', 'tin'] },
  { id: 'masonry', label: '조적 건축', requires: ['pottery', 'agriculture'], difficulty: 0.88, resource: 'stone' },
  { id: 'writing', label: '문자와 기록', requires: ['pottery', 'agriculture'], difficulty: 1.32, polity: true },
  { id: 'statecraft', label: '행정 조직', requires: ['writing'], difficulty: 1.05, polity: true },
  { id: 'iron', label: '철 제련', requires: ['copper', 'pottery'], difficulty: 1.34, resource: 'iron' },
  { id: 'currency', label: '화폐', requires: ['writing'], anyOf: ['bronze', 'iron'], difficulty: 0.96 },
  { id: 'roads', label: '공학 도로', requires: ['wheel', 'statecraft'], difficulty: 1.08 },
  { id: 'paper', label: '종이', requires: ['writing', 'weaving'], difficulty: 1.06, resource: 'timber' },
  { id: 'printing', label: '인쇄', requires: ['paper'], anyOf: ['bronze', 'iron'], difficulty: 1.30 },
  { id: 'gunpowder', label: '화약', requires: ['iron', 'paper'], difficulty: 1.54 },
  { id: 'navigation', label: '원양 항해', requires: ['sailing', 'writing'], difficulty: 1.26 },
  { id: 'steam', label: '증기 동력', requires: ['printing', 'iron'], difficulty: 1.82, resource: 'coal' },
  { id: 'rail', label: '철도', requires: ['steam', 'roads'], difficulty: 1.20 },
  { id: 'electricity', label: '전력망', requires: ['steam', 'copper'], difficulty: 1.54 },
  { id: 'combustion', label: '내연기관', requires: ['steam', 'iron'], difficulty: 1.46, resource: 'oil' },
  { id: 'medicine', label: '공중보건', requires: ['printing', 'statecraft'], difficulty: 1.18 },
  { id: 'telecom', label: '전기 통신', requires: ['electricity', 'copper'], difficulty: 1.28 },
  { id: 'aviation', label: '항공', requires: ['combustion', 'telecom'], difficulty: 1.62 },
  { id: 'computing', label: '계산 기계', requires: ['electricity', 'telecom'], difficulty: 1.82 },
  { id: 'renewables', label: '재생에너지', requires: ['electricity', 'computing'], difficulty: 1.36 },
]);

const TECH_BY_ID = new Map(TECHNOLOGIES.map((technology) => [technology.id, technology]));
const TECH_ORDER = new Map(TECHNOLOGIES.map((technology, index) => [technology.id, index]));

const CULTURE_ROOTS = ['아루', '베라', '카하', '도르', '에누', '하림', '이사', '누마', '소렌', '타바'];
const PLACE_ENDINGS = ['골', '내', '들', '말', '포', '산', '벌', '터', '강', '곶'];
const POLITY_ENDINGS = ['연맹', '국', '왕국', '공화국', '연방', '제국'];

function calendarLabel(calendarYear) {
  return calendarYear < 0 ? `기원전 ${Math.abs(calendarYear).toLocaleString('ko-KR')}년` : `서기 ${calendarYear.toLocaleString('ko-KR')}년`;
}

export function eraFor(knowledge, urbanShare = 0) {
  if ((knowledge.computing || 0) >= 1) return { id: 'information', label: '정보 시대' };
  if ((knowledge.electricity || 0) >= 1) return { id: 'electric', label: '전기 산업 시대' };
  if ((knowledge.steam || 0) >= 1) return { id: 'industrial', label: '산업 시대' };
  if ((knowledge.printing || 0) >= 1) return { id: 'early-modern', label: '근세' };
  if ((knowledge.iron || 0) >= 1) return { id: 'iron', label: '철기 시대' };
  if ((knowledge.bronze || 0) >= 1) return { id: 'bronze', label: '청동기 시대' };
  if ((knowledge.agriculture || 0) >= 1 || urbanShare > 0.05) return { id: 'neolithic', label: '신석기 시대' };
  if ((knowledge.sedentism || 0) >= 1) return { id: 'mesolithic', label: '중석기 시대' };
  return { id: 'paleolithic', label: '후기 구석기 시대' };
}

function polityType(polity, knowledge) {
  if ((knowledge.computing || 0) >= 1) return polity.settlementIds.length > 18 ? '연방국가' : '현대국가';
  if ((knowledge.printing || 0) >= 1) return polity.population > 1_200_000 ? '제국' : '왕국';
  if ((knowledge.statecraft || 0) >= 1) return polity.population > 180_000 ? '왕국' : '도시국가';
  if (polity.population > 12_000) return '초기국가';
  if (polity.population > 3_000) return '복합 추장사회';
  return '추장사회';
}

function settlementType(community, knowledge) {
  if (!community.permanent) return '이동 야영지';
  if (community.population < 180) return '정착 촌락';
  if (community.population < 1_100) return '마을';
  if (community.population < 7_500) return '큰 마을';
  if (community.population < 45_000) return (knowledge.statecraft || 0) >= 1 ? '성곽 도시' : '초기 도시';
  if (community.population < 300_000) return '도시';
  return (knowledge.electricity || 0) >= 1 ? '대도시권' : '거대 도시';
}

function routeMode(knowledge, waterShare, traffic = 0) {
  if (waterShare > 0.34 && (knowledge.sailing || 0) >= 1) return (knowledge.navigation || 0) >= 1 ? 'ocean' : 'coastal';
  if ((knowledge.rail || 0) >= 1 && traffic > 16) return 'rail';
  if ((knowledge.combustion || 0) >= 1 && (knowledge.roads || 0) >= 1) return 'motor-road';
  if ((knowledge.roads || 0) >= 1) return 'paved-road';
  if ((knowledge.wheel || 0) >= 1) return 'cart-track';
  return 'trail';
}

function transportRange(knowledge) {
  if ((knowledge.aviation || 0) >= 1) return 80;
  if ((knowledge.rail || 0) >= 1) return 52;
  if ((knowledge.navigation || 0) >= 1) return 44;
  if ((knowledge.roads || 0) >= 1) return 26;
  if ((knowledge.wheel || 0) >= 1 || (knowledge.sailing || 0) >= 1) return 17;
  if ((knowledge.agriculture || 0) >= 1) return 11;
  return 6;
}

class MinHeap {
  constructor() { this.items = []; }
  push(item) {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].priority <= item.priority) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }
  pop() {
    if (!this.items.length) return null;
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length && last) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.items.length) break;
        let child = left;
        if (right < this.items.length && this.items[right].priority < this.items[left].priority) child = right;
        if (this.items[child].priority >= last.priority) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = last;
    }
    return first;
  }
  get size() { return this.items.length; }
}

function movementCost(world, fromIndex, toIndex, allowWater) {
  const fromElevation = world.fields.elevation[fromIndex];
  const toElevation = world.fields.elevation[toIndex];
  const fromWater = fromElevation <= 0;
  const toWater = toElevation <= 0;
  if ((fromWater || toWater) && !allowWater) return Infinity;
  if (fromWater && toWater) return 0.42;
  if (fromWater !== toWater) return allowWater ? 1.8 : Infinity;
  const slope = Math.abs(toElevation - fromElevation) / Math.max(1, world.cellKm * 1000);
  const biome = MACRO_BIOMES[world.fields.biome[toIndex]];
  const biomeCost = biome === 'alpine' ? 4.2 : biome === 'tropical-forest' ? 2.0 : biome === 'wetland' ? 2.5 : biome === 'desert' ? 1.55 : 1;
  const riverBenefit = world.fields.river[toIndex] > 0.18 ? 0.84 : 1;
  return (1 + slope * 19) * biomeCost * riverBenefit;
}

function leastCostPath(world, start, goal, allowWater = false) {
  if (start === goal) return [start];
  const size = world.size;
  const count = size * size;
  const distance = new Float64Array(count);
  distance.fill(Infinity);
  const previous = new Int32Array(count);
  previous.fill(-1);
  const heap = new MinHeap();
  distance[start] = 0;
  heap.push({ index: start, priority: 0, cost: 0 });
  const gx = goal % size;
  const gz = Math.floor(goal / size);
  let visits = 0;
  while (heap.size && visits < count * 2.5) {
    const current = heap.pop();
    if (!current || current.cost !== distance[current.index]) continue;
    if (current.index === goal) break;
    visits += 1;
    const x = current.index % size;
    const z = Math.floor(current.index / size);
    for (const [dx, dz] of NEIGHBORS_8) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      const next = indexOf(nx, nz, size);
      const cellCost = movementCost(world, current.index, next, allowWater);
      if (!Number.isFinite(cellCost)) continue;
      const step = Math.hypot(dx, dz) * cellCost;
      const nextDistance = distance[current.index] + step;
      if (nextDistance >= distance[next]) continue;
      distance[next] = nextDistance;
      previous[next] = current.index;
      const heuristic = Math.hypot(nx - gx, nz - gz) * (allowWater ? 0.38 : 0.8);
      heap.push({ index: next, priority: nextDistance + heuristic, cost: nextDistance });
    }
  }
  if (previous[goal] < 0) return [start, goal];
  const path = [];
  let cursor = goal;
  while (cursor >= 0) {
    path.push(cursor);
    if (cursor === start) break;
    cursor = previous[cursor];
  }
  path.reverse();
  return path;
}

function pathLengthKm(world, path) {
  let length = 0;
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1];
    const b = path[index];
    const dx = a % world.size - b % world.size;
    const dz = Math.floor(a / world.size) - Math.floor(b / world.size);
    length += Math.hypot(dx, dz) * world.cellKm;
  }
  return length;
}

function buildResourceFields(world, seed) {
  const length = world.size * world.size;
  const resources = {
    arable: new Float32Array(length), game: new Float32Array(length), timber: new Float32Array(length),
    stone: new Float32Array(length), copper: new Float32Array(length), tin: new Float32Array(length),
    iron: new Float32Array(length), coal: new Float32Array(length), oil: new Float32Array(length),
  };
  for (let z = 0; z < world.size; z += 1) {
    for (let x = 0; x < world.size; x += 1) {
      const index = indexOf(x, z, world.size);
      const elevation = world.fields.elevation[index];
      if (elevation <= 0) continue;
      const biome = MACRO_BIOMES[world.fields.biome[index]];
      const slopeProxy = clamp01(Math.abs(fbm(x / 7, z / 7, seed + 31, 3)) * 0.8 + elevation / 5000);
      const wet = clamp01(world.fields.precipitation[index] / 1600);
      const warmth = clamp01((world.fields.temperature[index] + 8) / 36);
      const river = world.fields.river[index];
      resources.arable[index] = clamp01(world.fields.suitability[index] * 0.64 + river * 0.26 + wet * 0.18 - slopeProxy * 0.32);
      resources.game[index] = clamp01(world.fields.suitability[index] * 0.42 + wet * 0.22 + (biome.includes('forest') || biome === 'savanna' ? 0.35 : 0.08));
      resources.timber[index] = clamp01((biome.includes('forest') ? 0.75 : biome === 'savanna' ? 0.34 : 0.08) + wet * 0.22);
      resources.stone[index] = clamp01(0.28 + slopeProxy * 0.62 + Math.abs(fbm(x / 9, z / 9, seed + 79, 4)) * 0.24);
      resources.copper[index] = clamp01((fbm(x / 11, z / 11, seed + 131, 4) - 0.28) * 1.5 + slopeProxy * 0.22);
      resources.tin[index] = clamp01((fbm(x / 15, z / 15, seed + 197, 4) - 0.46) * 2.1 + slopeProxy * 0.15);
      resources.iron[index] = clamp01((fbm(x / 10, z / 10, seed + 251, 4) - 0.15) * 1.35 + slopeProxy * 0.28);
      resources.coal[index] = clamp01((fbm(x / 17, z / 17, seed + 337, 4) - 0.38) * 1.85);
      resources.oil[index] = clamp01((fbm(x / 23, z / 23, seed + 419, 4) - 0.53) * 2.25 + (1 - slopeProxy) * 0.08);
      if (warmth < 0.12) resources.arable[index] *= 0.22;
    }
  }
  return resources;
}

export function createPrimitiveWorld(input = {}) {
  const seed = String(input.seed || 'deep-time');
  const generated = createMacroWorld({ seed: `${seed}:physical`, size: input.size || 128, spanKm: input.spanKm || 2400 });
  const resources = buildResourceFields(generated, hashString(`${seed}:resources`));
  const countryId = new Int16Array(generated.size * generated.size);
  countryId.fill(-1);
  return {
    ...generated,
    version: '5.0.0-unified-physical-world',
    seed,
    fields: { ...generated.fields, resources },
    resources,
    countries: [],
    countryId,
    border: new Uint8Array(countryId.length),
    trade: [],
    settlement: null,
    diagnostics: {
      ...generated.diagnostics,
      countries: 0,
      initialPolities: 0,
      physicalSpanKm: generated.spanKm,
      modelScale: '1 render unit = 100 metres',
    },
  };
}

function knowledgeTemplate() {
  const knowledge = {};
  for (const technology of TECHNOLOGIES) knowledge[technology.id] = technology.baseline ? 1 : 0;
  return knowledge;
}

function communityDistance(left, right) {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

function relationKey(a, b) { return a < b ? `${a}:${b}` : `${b}:${a}`; }
function routeKey(a, b) { return a < b ? `${a}:${b}` : `${b}:${a}`; }

function weightedMean(values, weights) {
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  return values.reduce((sum, value, index) => sum + value * weights[index], 0) / total;
}

export class DeepTimeSimulation {
  constructor({ seed = 'deep-time', world } = {}) {
    this.seed = String(seed);
    this.random = createRandom(hashString(`${this.seed}:v5-deep-time`));
    this.world = world || createPrimitiveWorld({ seed: this.seed });
    this.year = 0;
    this.calendarYear = START_CALENDAR_YEAR;
    this.communities = [];
    this.cultures = [];
    this.polities = [];
    this.routes = [];
    this.routeMap = new Map();
    this.relations = new Map();
    this.wars = [];
    this.battles = [];
    this.flows = [];
    this.events = [];
    this.history = new Map();
    this.nextCommunityId = 0;
    this.nextPolityId = 0;
    this.nextRouteId = 0;
    this.nextWarId = 0;
    this.revision = 0;
    this.climate = { anomaly: -1.15, moisture: 0.94, volatility: 0.12 };
    this.totals = {};
    this.initializeBands();
    this.updateTotals();
    this.latestSnapshot = this.createSnapshot();
    this.recordSnapshot(this.latestSnapshot, true);
  }

  event(type, title, detail, scope = 'world', importance = 0.5) {
    const entry = { year: this.year, calendarYear: this.calendarYear, type, title, detail, scope, importance };
    this.events.push(entry);
    if (this.events.length > 1800) this.events.splice(0, this.events.length - 1800);
    return entry;
  }

  initializeBands() {
    const candidates = [];
    const size = this.world.size;
    for (let z = 3; z < size - 3; z += 1) {
      for (let x = 3; x < size - 3; x += 1) {
        const index = indexOf(x, z, size);
        if (this.world.fields.elevation[index] <= 0) continue;
        const water = Math.max(this.world.fields.river[index], Math.exp(-this.world.fields.distanceToOcean[index] / 2.6));
        const coldPenalty = clamp01((-2 - this.world.fields.temperature[index]) / 20);
        const score = this.world.resources.game[index] * 0.46 + water * 0.28 + this.world.fields.suitability[index] * 0.26 - coldPenalty * 0.35 + this.random() * 0.09;
        if (score > 0.43) candidates.push({ x, z, index, score });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const sites = [];
    for (const candidate of candidates) {
      if (sites.every((site) => Math.hypot(site.x - candidate.x, site.z - candidate.z) > size * 0.075)) sites.push(candidate);
      if (sites.length >= 8) break;
    }
    sites.forEach((site, index) => {
      const culture = {
        id: index,
        name: CULTURE_ROOTS[index % CULTURE_ROOTS.length],
        knowledge: knowledgeTemplate(),
        contact: 0.05,
        cohesion: 0.72 + this.random() * 0.22,
        adopted: 3,
      };
      this.cultures.push(culture);
      this.communities.push(this.createCommunity({
        cultureId: culture.id,
        x: site.x,
        z: site.z,
        population: 34 + Math.floor(this.random() * 49),
        permanent: false,
      }));
    });
    this.event('origin', '인류 집단의 관측 시작', `${this.communities.length}개 수렵·채집 집단이 서로 다른 유역에서 생존을 시작했습니다.`, 'world', 1);
  }

  createCommunity({ cultureId, x, z, population, permanent = false, polityId = null, parentName = null }) {
    const id = this.nextCommunityId++;
    const culture = this.cultures[cultureId];
    const ending = PLACE_ENDINGS[(id * 3 + cultureId) % PLACE_ENDINGS.length];
    return {
      id,
      name: parentName ? `${parentName} 새터` : `${culture.name}${ending}`,
      cultureId,
      polityId,
      x,
      z,
      cell: indexOf(x, z, this.world.size),
      population: Math.max(8, Math.round(population)),
      permanent,
      foundedYear: this.year,
      lastMoveYear: this.year,
      foodCapacity: 120,
      nutrition: 0.92,
      health: 0.76,
      stress: 0.16,
      surplus: 0,
      wealth: 0.1,
      inequality: 0.05,
      buildings: permanent ? 8 : 3,
      fortification: 0,
      output: Object.fromEntries(GOODS.map((good) => [good, 0])),
      stocks: { food: population * 0.38, timber: 3, stone: 2, metal: 0, craft: 1, fuel: 2 },
      type: permanent ? '정착 촌락' : '이동 야영지',
      stage: 'forager',
      localTraffic: 0,
      deaths: 0,
      births: 0,
    };
  }

  culturePopulation(cultureId) {
    return this.communities.filter((community) => community.cultureId === cultureId).reduce((sum, community) => sum + community.population, 0);
  }

  cultureResourceAccess(cultureId, resource) {
    const communities = this.communities.filter((community) => community.cultureId === cultureId);
    if (!communities.length) return 0;
    return Math.max(...communities.map((community) => this.world.resources[resource]?.[community.cell] || 0));
  }

  technologyEligible(culture, technology) {
    if (technology.baseline || culture.knowledge[technology.id] >= 1) return false;
    if ((technology.requires || []).some((id) => (culture.knowledge[id] || 0) < 1)) return false;
    if (technology.anyOf && !technology.anyOf.some((id) => (culture.knowledge[id] || 0) >= 1)) return false;
    if (technology.polity && !this.polities.some((polity) => polity.cultureId === culture.id)) return false;
    return true;
  }

  technologyEnvironment(cultureId, technology) {
    let factor = 0.52;
    const resources = technology.resources || (technology.resource ? [technology.resource] : []);
    if (resources.length) {
      const access = resources.map((resource) => this.cultureResourceAccess(cultureId, resource));
      factor *= 0.28 + access.reduce((product, value) => product * (0.42 + value), 1);
    }
    const communities = this.communities.filter((community) => community.cultureId === cultureId);
    if (technology.environment === 'water') {
      const water = Math.max(0, ...communities.map((community) => Math.max(this.world.fields.river[community.cell], Math.exp(-this.world.fields.distanceToOcean[community.cell] / 2.5))));
      factor *= 0.55 + water;
    }
    if (technology.environment === 'coast') {
      const coast = Math.max(0, ...communities.map((community) => Math.exp(-this.world.fields.distanceToOcean[community.cell] / 1.8)));
      factor *= 0.20 + coast * 1.3;
    }
    if (technology.environment === 'grass') {
      const grass = Math.max(0, ...communities.map((community) => ['grassland', 'savanna'].includes(MACRO_BIOMES[this.world.fields.biome[community.cell]]) ? 1 : 0.25));
      factor *= 0.48 + grass * 0.74;
    }
    return clamp(factor, 0.08, 1.65);
  }

  updateTechnologies() {
    for (const culture of this.cultures) {
      const population = this.culturePopulation(culture.id);
      if (population <= 0) continue;
      const communities = this.communities.filter((community) => community.cultureId === culture.id);
      const surplus = weightedMean(communities.map((community) => community.surplus), communities.map((community) => community.population));
      const urban = communities.some((community) => community.population > 5000) ? 0.35 : 0;
      const literacyBoost = 1 + (culture.knowledge.writing || 0) * 0.45 + (culture.knowledge.printing || 0) * 1.4 + (culture.knowledge.computing || 0) * 4;
      const adoptedBoost = 1 + Math.sqrt(Math.max(0, culture.adopted - 3)) * 0.05;
      const populationFactor = clamp(Math.log10(population + 10) / 4.1, 0.30, 1.55);
      const researchBase = 0.00034 * populationFactor * (0.54 + clamp01(surplus + 0.35)) * (0.70 + culture.contact + urban) * literacyBoost * adoptedBoost;
      const eligible = TECHNOLOGIES.filter((technology) => this.technologyEligible(culture, technology));
      const dilution = Math.max(1, Math.sqrt(eligible.length) * 0.74);
      for (const technology of eligible) {
        const order = TECH_ORDER.get(technology.id) || 0;
        const earlyExperimentation = order <= 7 ? 1.55 : 1;
        const complexityDrag = order <= 7 ? 1 : 1 + (order - 7) * 0.13;
        const environment = this.technologyEnvironment(culture.id, technology);
        const stochastic = 0.72 + this.random() * 0.56;
        culture.knowledge[technology.id] = clamp01((culture.knowledge[technology.id] || 0) + researchBase * environment * stochastic * earlyExperimentation / (technology.difficulty * dilution * complexityDrag));
        if (culture.knowledge[technology.id] >= 1) {
          culture.knowledge[technology.id] = 1;
          culture.adopted += 1;
          this.event('technology', `${culture.name} 문화권 · ${technology.label}`, `환경·잉여·접촉이 축적되어 ${technology.label} 기술이 정착했습니다.`, 'world', 0.82);
        }
      }
    }
    for (const route of this.routes) {
      const left = this.communities.find((community) => community.id === route.a);
      const right = this.communities.find((community) => community.id === route.b);
      if (!left || !right || left.cultureId === right.cultureId) continue;
      const a = this.cultures[left.cultureId];
      const b = this.cultures[right.cultureId];
      const contact = clamp01(route.traffic / 32) * 0.0014;
      a.contact = lerp(a.contact, clamp01(a.contact + contact), 0.22);
      b.contact = lerp(b.contact, clamp01(b.contact + contact), 0.22);
      for (const technology of TECHNOLOGIES) {
        if (a.knowledge[technology.id] >= 1 && b.knowledge[technology.id] < 1) b.knowledge[technology.id] = clamp01(b.knowledge[technology.id] + contact * 0.9);
        if (b.knowledge[technology.id] >= 1 && a.knowledge[technology.id] < 1) a.knowledge[technology.id] = clamp01(a.knowledge[technology.id] + contact * 0.9);
      }
    }
  }

  carryingCapacity(community, knowledge) {
    const cell = community.cell;
    const game = this.world.resources.game[cell];
    const water = Math.max(this.world.fields.river[cell], Math.exp(-this.world.fields.distanceToOcean[cell] / 2.8));
    const arable = this.world.resources.arable[cell];
    const forager = 28 + game * 130 + water * 72;
    if ((knowledge.agriculture || 0) < 1) return forager * (community.permanent ? 1.28 : 1);
    const farmProductivity = 1 + (knowledge.husbandry || 0) * 0.42 + (knowledge.iron || 0) * 0.48 + (knowledge.steam || 0) * 1.15 + (knowledge.computing || 0) * 1.4;
    const urbanNetwork = 1 + Math.log1p(this.routes.filter((route) => route.a === community.id || route.b === community.id).reduce((sum, route) => sum + route.traffic, 0)) * 0.34;
    return forager + (420 + arable * 7200) * farmProductivity * urbanNetwork;
  }

  relocateForager(community) {
    if (this.year - community.lastMoveYear < 2 + Math.floor(this.random() * 4)) return;
    const current = community.cell;
    let best = { index: current, x: community.x, z: community.z, score: -Infinity };
    const radius = 2 + Math.floor(this.random() * 4);
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const x = community.x + dx;
        const z = community.z + dz;
        if (x < 1 || z < 1 || x >= this.world.size - 1 || z >= this.world.size - 1) continue;
        const index = indexOf(x, z, this.world.size);
        if (this.world.fields.elevation[index] <= 0) continue;
        const occupied = this.communities.some((other) => other.id !== community.id && other.cell === index);
        if (occupied) continue;
        const water = Math.max(this.world.fields.river[index], Math.exp(-this.world.fields.distanceToOcean[index] / 2.6));
        const distance = Math.hypot(dx, dz);
        const pressure = this.communities.filter((other) => other.id !== community.id && Math.hypot(other.x - x, other.z - z) < 3).reduce((sum, other) => sum + other.population / 250, 0);
        const score = this.world.resources.game[index] * 0.55 + water * 0.24 + this.world.fields.suitability[index] * 0.22 - distance * 0.025 - pressure * 0.12 + this.random() * 0.08;
        if (score > best.score) best = { index, x, z, score };
      }
    }
    if (best.index !== current) {
      community.cell = best.index;
      community.x = best.x;
      community.z = best.z;
      community.lastMoveYear = this.year;
      if (this.random() < 0.07) this.event('migration', `${community.name} 계절 이동`, '사냥감과 식수 조건을 따라 야영지를 옮겼습니다.', 'community', 0.28);
      this.revision += 1;
    }
  }

  updateCommunities() {
    for (const community of [...this.communities]) {
      const culture = this.cultures[community.cultureId];
      const knowledge = culture.knowledge;
      if (!community.permanent && (knowledge.sedentism || 0) >= 1) {
        const water = Math.max(this.world.fields.river[community.cell], Math.exp(-this.world.fields.distanceToOcean[community.cell] / 2.5));
        if (water + this.world.resources.game[community.cell] > 0.78 && this.random() < 0.055) {
          community.permanent = true;
          community.foundedYear = this.year;
          this.event('settlement', `${community.name} 정착`, '수원과 식량 저장이 안정되어 계절 야영지가 상설 정착지로 전환되었습니다.', 'community', 0.9);
          this.revision += 1;
        }
      }
      const capacity = this.carryingCapacity(community, knowledge);
      community.foodCapacity = capacity;
      const populationPressure = community.population / Math.max(1, capacity);
      const arable = this.world.resources.arable[community.cell];
      const game = this.world.resources.game[community.cell];
      const timber = this.world.resources.timber[community.cell];
      const stone = this.world.resources.stone[community.cell];
      const metalAccess = Math.max(this.world.resources.copper[community.cell], this.world.resources.iron[community.cell]);
      const fuelAccess = Math.max(this.world.resources.coal[community.cell], this.world.resources.oil[community.cell], timber * 0.32);
      const climateYield = clamp(1 + this.climate.moisture * 0.08 - Math.abs(this.climate.anomaly) * 0.035, 0.58, 1.22);
      const agriculture = knowledge.agriculture || 0;
      const foodProductivity = (0.68 + game * 0.54 + agriculture * arable * 1.28 + (knowledge.husbandry || 0) * 0.28 + (knowledge.steam || 0) * 0.58) * climateYield;
      const depletion = clamp(1.14 - populationPressure * 0.36, 0.34, 1.1);
      const foodOutput = community.population * foodProductivity * depletion;
      community.output.food = foodOutput;
      community.output.timber = community.population * timber * (0.035 + (knowledge.woodworking || 0) * 0.045);
      community.output.stone = community.population * stone * (0.018 + (knowledge.masonry || 0) * 0.052);
      community.output.metal = community.population * metalAccess * ((knowledge.copper || 0) * 0.016 + (knowledge.iron || 0) * 0.052 + (knowledge.steam || 0) * 0.035);
      community.output.craft = community.population * (0.012 + (knowledge.pottery || 0) * 0.026 + (knowledge.weaving || 0) * 0.022 + (knowledge.printing || 0) * 0.018);
      community.output.fuel = community.population * fuelAccess * (0.018 + (knowledge.steam || 0) * 0.055 + (knowledge.combustion || 0) * 0.044);
      for (const good of GOODS) community.stocks[good] = Math.max(0, community.stocks[good] + community.output[good]);
      const foodNeed = community.population;
      const consumed = Math.min(foodNeed, community.stocks.food);
      community.stocks.food -= consumed;
      community.nutrition = lerp(community.nutrition, clamp01(consumed / Math.max(1, foodNeed)), 0.42);
      community.surplus = clamp((community.stocks.food / Math.max(1, foodNeed) - 0.28) / 1.8, -0.6, 1.6);
      const densityDisease = clamp01((community.population - 1800) / 35_000) * (knowledge.medicine ? 0.36 : 1);
      const healthTarget = clamp01(0.45 + community.nutrition * 0.43 + (knowledge.medicine || 0) * 0.22 - densityDisease * 0.32);
      community.health = lerp(community.health, healthTarget, 0.18);
      const foragerBirth = community.permanent ? 0.040 : 0.033;
      const demographicTransition = (knowledge.electricity || 0) * 0.006 + (knowledge.computing || 0) * 0.008;
      const birthRate = clamp(foragerBirth + agriculture * 0.003 - demographicTransition - populationPressure * 0.004, 0.011, 0.046);
      const medicineBenefit = (knowledge.medicine || 0) * 0.012 + (knowledge.electricity || 0) * 0.004;
      const famineMortality = Math.pow(1 - community.nutrition, 2) * 0.19;
      const baselineMortality = community.permanent && agriculture ? 0.033 : 0.030;
      const deathRate = clamp(baselineMortality - medicineBenefit + densityDisease * 0.009 + famineMortality + Math.max(0, populationPressure - 1) * 0.048, 0.006, 0.24);
      const births = community.population * birthRate;
      const deaths = community.population * deathRate;
      community.births = births;
      community.deaths = deaths;
      community.population = Math.max(0, community.population + births - deaths);
      community.stress = lerp(community.stress, clamp01((1 - community.nutrition) * 0.72 + Math.max(0, populationPressure - 0.72) * 0.36 + densityDisease * 0.18), 0.25);
      community.wealth = Math.max(0, community.wealth * 0.992 + community.surplus * 0.018 + community.output.craft / Math.max(1, community.population) * 0.09);
      community.inequality = clamp01(community.inequality + (community.permanent ? 0.00025 : -0.00012) + (knowledge.currency || 0) * 0.00018 - (knowledge.statecraft || 0) * 0.00008);
      community.stage = agriculture >= 1 ? ((knowledge.steam || 0) >= 1 ? 'industrial' : 'agrarian') : community.permanent ? 'sedentary-forager' : 'forager';
      community.type = settlementType(community, knowledge);
      const householdSize = agriculture ? 5.1 : 6.2;
      const targetBuildings = community.permanent ? Math.max(5, community.population / householdSize * (1 + Math.log10(community.population + 10) * 0.025)) : Math.max(2, community.population / 18);
      community.buildings = Math.round(lerp(community.buildings, targetBuildings, 0.08));
      community.fortification = clamp01(community.fortification + ((knowledge.statecraft || 0) >= 1 && community.population > 5000 ? 0.0015 : 0) - 0.00015);
      community.localTraffic = Math.log1p(community.population) * (0.35 + (knowledge.wheel || 0) * 0.5 + (knowledge.combustion || 0) * 1.1);
      if (!community.permanent && (community.stress > 0.18 || this.random() < 0.14)) this.relocateForager(community);
      if (community.population < 7) {
        this.event('collapse', `${community.name} 소멸`, '인구 재생산과 식량 확보에 실패하여 집단이 해체되었습니다.', 'community', 0.72);
        this.communities = this.communities.filter((entry) => entry.id !== community.id);
        this.revision += 1;
      }
    }
  }

  findExpansionCell(parent, minRadius, maxRadius) {
    let best = null;
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const angle = this.random() * Math.PI * 2;
      const radius = minRadius + this.random() * (maxRadius - minRadius);
      const x = clamp(Math.round(parent.x + Math.cos(angle) * radius), 1, this.world.size - 2);
      const z = clamp(Math.round(parent.z + Math.sin(angle) * radius), 1, this.world.size - 2);
      const cell = indexOf(x, z, this.world.size);
      if (this.world.fields.elevation[cell] <= 0) continue;
      if (this.communities.some((community) => Math.hypot(community.x - x, community.z - z) < 2.2)) continue;
      const water = Math.max(this.world.fields.river[cell], Math.exp(-this.world.fields.distanceToOcean[cell] / 2.6));
      const score = this.world.resources.arable[cell] * 0.38 + this.world.resources.game[cell] * 0.24 + water * 0.24 + this.world.fields.suitability[cell] * 0.14 - radius * 0.003 + this.random() * 0.06;
      if (!best || score > best.score) best = { x, z, cell, score };
    }
    return best;
  }

  expandCommunities() {
    if (this.communities.length >= MAX_COMMUNITIES) return;
    const mobileBandCount = this.communities.filter((community) => !community.permanent).length;
    for (const parent of [...this.communities]) {
      if (this.communities.length >= MAX_COMMUNITIES) break;
      const knowledge = this.cultures[parent.cultureId].knowledge;
      const foragerSplit = mobileBandCount < 40 && !parent.permanent && parent.population > 108 && parent.stress < 0.5;
      const settledExpansion = parent.permanent && parent.population > Math.max(480, parent.foodCapacity * 0.72) && (knowledge.agriculture || 0) >= 1;
      if (!foragerSplit && !settledExpansion) continue;
      const probability = foragerSplit ? 0.024 : 0.045;
      if (this.random() > probability) continue;
      const target = this.findExpansionCell(parent, foragerSplit ? 3 : 4, foragerSplit ? 8 : 15);
      if (!target) continue;
      const share = foragerSplit ? 0.34 : 0.10 + this.random() * 0.07;
      const population = Math.max(foragerSplit ? 22 : 35, Math.floor(parent.population * share));
      parent.population -= population;
      const child = this.createCommunity({
        cultureId: parent.cultureId,
        x: target.x,
        z: target.z,
        population,
        permanent: settledExpansion,
        polityId: parent.polityId,
        parentName: parent.name,
      });
      this.communities.push(child);
      this.event(foragerSplit ? 'migration' : 'settlement', `${child.name} 형성`, foragerSplit ? '집단 규모가 커지며 새로운 수렵·채집 무리가 분화했습니다.' : '경작지와 수원을 찾아 모촌에서 새로운 정착지가 분기했습니다.', 'community', 0.58);
      this.revision += 1;
    }
  }

  sharedKnowledge(left, right) {
    const a = this.cultures[left.cultureId].knowledge;
    const b = this.cultures[right.cultureId].knowledge;
    const knowledge = {};
    for (const technology of TECHNOLOGIES) knowledge[technology.id] = Math.max(a[technology.id] || 0, b[technology.id] || 0);
    return knowledge;
  }

  buildRoute(left, right) {
    const knowledge = this.sharedKnowledge(left, right);
    const allowWater = (knowledge.sailing || 0) >= 1;
    const path = leastCostPath(this.world, left.cell, right.cell, allowWater);
    const waterCells = path.filter((cell) => this.world.fields.elevation[cell] <= 0).length;
    const waterShare = waterCells / Math.max(1, path.length);
    const route = {
      id: this.nextRouteId++,
      a: left.id,
      b: right.id,
      path,
      distanceKm: pathLengthKm(this.world, path),
      waterShare,
      mode: routeMode(knowledge, waterShare, 0),
      traffic: 0.2,
      freight: 0,
      migrants: 0,
      condition: 0.24,
      establishedYear: this.year,
    };
    this.routes.push(route);
    this.routeMap.set(routeKey(left.id, right.id), route);
    this.event('route', `${left.name}–${right.name} 길 형성`, '반복 이동의 흔적이 지형의 최소비용 경로를 따라 연결망으로 굳어졌습니다.', 'world', 0.42);
    this.revision += 1;
    return route;
  }

  rebuildRoutes() {
    const ids = new Set(this.communities.map((community) => community.id));
    this.routes = this.routes.filter((route) => ids.has(route.a) && ids.has(route.b));
    this.routeMap = new Map(this.routes.map((route) => [routeKey(route.a, route.b), route]));
    const degree = new Map(this.communities.map((community) => [community.id, 0]));
    for (const route of this.routes) {
      degree.set(route.a, (degree.get(route.a) || 0) + 1);
      degree.set(route.b, (degree.get(route.b) || 0) + 1);
    }
    for (const community of this.communities) {
      if ((degree.get(community.id) || 0) >= 4) continue;
      const knowledge = this.cultures[community.cultureId].knowledge;
      const range = transportRange(knowledge);
      const candidates = this.communities
        .filter((other) => other.id !== community.id && !this.routeMap.has(routeKey(community.id, other.id)))
        .map((other) => ({ other, distance: communityDistance(community, other) }))
        .filter((entry) => entry.distance <= range)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);
      for (const candidate of candidates) {
        if ((degree.get(community.id) || 0) >= 4) break;
        if ((degree.get(candidate.other.id) || 0) >= 4) continue;
        const interaction = Math.sqrt(community.population * candidate.other.population) / Math.pow(candidate.distance + 1, 1.15);
        const threshold = community.permanent || candidate.other.permanent ? 5.8 : 10.5;
        if (interaction < threshold && this.random() > 0.08) continue;
        this.buildRoute(community, candidate.other);
        degree.set(community.id, (degree.get(community.id) || 0) + 1);
        degree.set(candidate.other.id, (degree.get(candidate.other.id) || 0) + 1);
      }
    }
  }

  transferGood(route, left, right, good, leftToRight) {
    const exporter = leftToRight ? left : right;
    const importer = leftToRight ? right : left;
    const reserve = good === 'food' ? exporter.population * 0.42 : exporter.population * 0.012;
    const importerReserve = good === 'food' ? importer.population * 0.34 : importer.population * 0.009;
    const surplus = Math.max(0, exporter.stocks[good] - reserve);
    const deficit = Math.max(0, importerReserve - importer.stocks[good]);
    const capacity = (1.5 + route.condition * 8) * (route.mode === 'rail' ? 8 : route.mode === 'motor-road' ? 5 : route.mode === 'ocean' ? 6 : route.mode === 'coastal' ? 3 : 1);
    const amount = Math.min(surplus * 0.18, deficit * 0.72 + importer.population * 0.0008, capacity);
    if (amount <= 0.01) return 0;
    exporter.stocks[good] -= amount;
    importer.stocks[good] += amount * (0.94 - Math.min(0.12, route.distanceKm / 16000));
    exporter.wealth += amount * (good === 'metal' || good === 'craft' ? 0.0024 : 0.0008);
    importer.wealth = Math.max(0, importer.wealth - amount * 0.00045);
    this.flows.push({
      id: `g:${this.year}:${route.id}:${good}:${leftToRight ? 1 : 0}`,
      type: 'logistics',
      good,
      routeId: route.id,
      path: route.path,
      reverse: !leftToRight,
      volume: amount,
      mode: route.mode,
      a: route.a,
      b: route.b,
    });
    return amount;
  }

  settleExchange() {
    this.flows = [];
    for (const route of this.routes) {
      const left = this.communities.find((community) => community.id === route.a);
      const right = this.communities.find((community) => community.id === route.b);
      if (!left || !right) continue;
      let freight = 0;
      for (const good of GOODS) {
        freight += this.transferGood(route, left, right, good, true);
        freight += this.transferGood(route, left, right, good, false);
      }
      const interaction = Math.sqrt(left.population * right.population) / Math.max(1, route.distanceKm * 0.12);
      const travelers = clamp(interaction * (0.12 + route.condition * 0.36), 0.02, 1200);
      const attractivenessLeft = left.nutrition * 0.5 + left.wealth * 0.22 - left.stress * 0.45;
      const attractivenessRight = right.nutrition * 0.5 + right.wealth * 0.22 - right.stress * 0.45;
      const migrationPressure = clamp(attractivenessRight - attractivenessLeft, -0.5, 0.5);
      const migration = Math.min((migrationPressure > 0 ? left.population : right.population) * 0.0025, Math.abs(migrationPressure) * travelers * 0.12);
      if (migration > 0.05) {
        const origin = migrationPressure > 0 ? left : right;
        const destination = migrationPressure > 0 ? right : left;
        origin.population = Math.max(7, origin.population - migration);
        destination.population += migration * 0.97;
        route.migrants = lerp(route.migrants, migration, 0.35);
        this.flows.push({
          id: `m:${this.year}:${route.id}`,
          type: 'migration', routeId: route.id, path: route.path,
          reverse: migrationPressure < 0, volume: migration, mode: route.mode, a: route.a, b: route.b,
        });
      } else route.migrants *= 0.82;
      const knowledge = this.sharedKnowledge(left, right);
      route.freight = lerp(route.freight, freight, 0.34);
      route.traffic = lerp(route.traffic, travelers + freight * 0.8, 0.28);
      route.condition = clamp01(route.condition + Math.log1p(route.traffic) * 0.00042 - 0.0011);
      route.mode = routeMode(knowledge, route.waterShare, route.traffic);
      this.flows.push({
        id: `t:${this.year}:${route.id}`,
        type: 'traffic', routeId: route.id, path: route.path,
        reverse: false, volume: travelers, mode: route.mode, a: route.a, b: route.b,
      });
      if (left.polityId != null && right.polityId != null && left.polityId !== right.polityId) {
        const relation = this.getRelation(left.polityId, right.polityId);
        relation.trade = (relation.trade || 0) + freight;
      }
    }
    this.flows.sort((a, b) => b.volume - a.volume);
    this.flows = this.flows.slice(0, 140);
  }

  formPolity(culture, communities) {
    const capital = [...communities].sort((a, b) => b.population - a.population)[0];
    const id = this.nextPolityId++;
    const hue = (id * 0.173 + 0.08) % 1;
    const color = [0.44 + Math.sin(hue * Math.PI * 2) * 0.16, 0.48 + Math.sin((hue + 0.33) * Math.PI * 2) * 0.14, 0.43 + Math.sin((hue + 0.66) * Math.PI * 2) * 0.15].map((value) => clamp(value, 0.24, 0.72));
    const polity = {
      id,
      name: `${culture.name}${POLITY_ENDINGS[id % 2]}`,
      cultureId: culture.id,
      capitalId: capital.id,
      settlementIds: communities.map((community) => community.id),
      population: 0,
      type: '추장사회',
      color,
      legitimacy: 0.62 + this.random() * 0.23,
      cohesion: 0.66 + this.random() * 0.22,
      treasury: 0,
      military: 0,
      foodSecurity: 0.8,
      foundedYear: this.year,
    };
    communities.forEach((community) => { community.polityId = id; });
    this.polities.push(polity);
    this.event('polity', `${polity.name} 형성`, `${communities.length}개 정착지가 방어·의례·재분배를 공동 관리하기 시작했습니다.`, 'world', 1);
    this.revision += 1;
    return polity;
  }

  updatePolities() {
    for (const culture of this.cultures) {
      const knowledge = culture.knowledge;
      const unclaimed = this.communities.filter((community) => community.cultureId === culture.id && community.permanent && community.polityId == null);
      const population = unclaimed.reduce((sum, community) => sum + community.population, 0);
      if (!this.polities.some((polity) => polity.cultureId === culture.id) && population > 900 && (knowledge.agriculture || 0) >= 1 && unclaimed.length >= 2) {
        this.formPolity(culture, unclaimed);
      }
    }
    for (const community of this.communities) {
      if (community.polityId != null || !community.permanent) continue;
      const candidates = this.polities
        .filter((polity) => polity.cultureId === community.cultureId)
        .map((polity) => {
          const capital = this.communities.find((entry) => entry.id === polity.capitalId);
          return { polity, distance: capital ? communityDistance(community, capital) : Infinity };
        })
        .sort((a, b) => a.distance - b.distance);
      if (candidates[0] && candidates[0].distance < 18 && this.random() < 0.025) {
        community.polityId = candidates[0].polity.id;
        this.event('polity', `${community.name} 편입`, `${candidates[0].polity.name}의 재분배·방어망에 참여했습니다.`, 'world', 0.38);
      }
    }
    const communityIds = new Set(this.communities.map((community) => community.id));
    this.polities = this.polities.filter((polity) => communityIds.has(polity.capitalId));
    for (const polity of this.polities) {
      const settlements = this.communities.filter((community) => community.polityId === polity.id);
      polity.settlementIds = settlements.map((community) => community.id);
      polity.population = settlements.reduce((sum, community) => sum + community.population, 0);
      const culture = this.cultures[polity.cultureId];
      const knowledge = culture.knowledge;
      polity.type = polityType(polity, knowledge);
      const foodSecurity = weightedMean(settlements.map((community) => community.nutrition), settlements.map((community) => community.population));
      polity.foodSecurity = foodSecurity;
      const taxableSurplus = settlements.reduce((sum, community) => sum + Math.max(0, community.surplus) * community.population, 0);
      polity.treasury = Math.max(0, polity.treasury * 0.985 + taxableSurplus * ((knowledge.currency || 0) >= 1 ? 0.008 : 0.002));
      const organization = 1 + (knowledge.statecraft || 0) * 0.7 + (knowledge.writing || 0) * 0.3 + (knowledge.telecom || 0) * 0.6;
      polity.military = polity.population * (0.018 + (1 - foodSecurity) * 0.012) * organization;
      polity.legitimacy = clamp01(polity.legitimacy + (foodSecurity - 0.76) * 0.003 - Math.max(0, settlements.length - 14) * 0.00025);
      polity.cohesion = clamp01(polity.cohesion + (polity.legitimacy - 0.5) * 0.001 - settlements.reduce((max, settlement) => Math.max(max, settlement.stress), 0) * 0.0007);
      const newCapital = [...settlements].sort((a, b) => b.population - a.population)[0];
      if (newCapital && newCapital.population > (this.communities.find((entry) => entry.id === polity.capitalId)?.population || 0) * 1.65) polity.capitalId = newCapital.id;
    }
  }

  getRelation(a, b) {
    const key = relationKey(a, b);
    if (!this.relations.has(key)) {
      this.relations.set(key, {
        key,
        a: Math.min(a, b),
        b: Math.max(a, b),
        trust: 0.42 + this.random() * 0.18,
        tension: 0.14 + this.random() * 0.18,
        rivalry: 0.12 + this.random() * 0.72,
        trade: 0,
        atWar: false,
        status: 'contact',
      });
    }
    return this.relations.get(key);
  }

  polityDistance(a, b) {
    const left = this.communities.filter((community) => community.polityId === a.id);
    const right = this.communities.filter((community) => community.polityId === b.id);
    let best = Infinity;
    for (const l of left) for (const r of right) best = Math.min(best, communityDistance(l, r));
    return best;
  }

  startWar(left, right, relation) {
    const attacker = left.military * (0.8 + this.random() * 0.4) > right.military ? left : right;
    const defender = attacker.id === left.id ? right : left;
    const origin = this.communities.find((community) => community.id === attacker.capitalId);
    const targets = this.communities.filter((community) => community.polityId === defender.id).sort((a, b) => origin && communityDistance(origin, a) - communityDistance(origin, b));
    const target = targets[0];
    if (!origin || !target) return;
    const knowledge = this.cultures[attacker.cultureId].knowledge;
    const path = leastCostPath(this.world, origin.cell, target.cell, (knowledge.sailing || 0) >= 1);
    const distanceKm = pathLengthKm(this.world, path);
    const war = {
      id: this.nextWarId++,
      a: left.id,
      b: right.id,
      attackerId: attacker.id,
      defenderId: defender.id,
      originId: origin.id,
      targetId: target.id,
      path,
      distanceKm,
      progress: 0,
      intensity: 0.34 + this.random() * 0.46,
      startYear: this.year,
      active: true,
    };
    this.wars.push(war);
    relation.atWar = true;
    relation.status = 'war';
    this.event('war', `${attacker.name}–${defender.name} 전쟁`, '접경 압력과 자원 경쟁이 외교적 억제력을 넘어 군사 동원으로 전환되었습니다.', 'world', 1);
  }

  resolveBattle(war) {
    const attacker = this.polities.find((polity) => polity.id === war.attackerId);
    const defender = this.polities.find((polity) => polity.id === war.defenderId);
    const target = this.communities.find((community) => community.id === war.targetId);
    if (!attacker || !defender || !target) { war.active = false; return; }
    const attackerKnowledge = this.cultures[attacker.cultureId].knowledge;
    const defenderKnowledge = this.cultures[defender.cultureId].knowledge;
    const militaryTech = (knowledge) => 1 + (knowledge.bronze || 0) * 0.25 + (knowledge.iron || 0) * 0.45 + (knowledge.gunpowder || 0) * 1.2 + (knowledge.combustion || 0) * 0.5 + (knowledge.aviation || 0) * 0.75;
    const attackPower = attacker.military * militaryTech(attackerKnowledge) * (0.72 + this.random() * 0.56) * war.intensity;
    const defensePower = defender.military * militaryTech(defenderKnowledge) * (0.78 + target.fortification * 0.8 + this.random() * 0.46);
    const attackerLoss = clamp(defensePower / Math.max(1, attackPower + defensePower) * war.intensity * 0.055, 0.004, 0.085);
    const defenderLoss = clamp(attackPower / Math.max(1, attackPower + defensePower) * war.intensity * 0.064, 0.005, 0.11);
    for (const community of this.communities.filter((entry) => entry.polityId === attacker.id)) community.population *= 1 - attackerLoss;
    for (const community of this.communities.filter((entry) => entry.polityId === defender.id)) community.population *= 1 - defenderLoss;
    const attackerWins = attackPower > defensePower;
    if (attackerWins) {
      target.polityId = attacker.id;
      target.stress = clamp01(target.stress + 0.42);
      target.buildings = Math.max(2, Math.round(target.buildings * (0.86 - war.intensity * 0.12)));
    }
    this.battles.push({
      id: `b:${war.id}:${this.year}`,
      year: this.year,
      untilYear: this.year + 8,
      x: target.x,
      z: target.z,
      attackerId: attacker.id,
      defenderId: defender.id,
      intensity: war.intensity,
      attackerWins,
    });
    this.event('battle', `${target.name} 전투`, `${attackerWins ? attacker.name : defender.name}이 우세했습니다. 전투와 보급 붕괴로 양측 인구에 손실이 발생했습니다.`, 'world', 0.94);
    const relation = this.getRelation(attacker.id, defender.id);
    if (this.random() < 0.44 + (this.year - war.startYear) * 0.03) {
      war.active = false;
      relation.atWar = false;
      relation.tension = clamp01(relation.tension * 0.58);
      relation.status = relation.tension > 0.56 ? 'tense' : 'truce';
      this.event('peace', `${attacker.name}–${defender.name} 휴전`, '전쟁 비용과 인구 손실이 누적되어 군사 행동이 중단되었습니다.', 'world', 0.76);
    } else {
      war.progress = 0;
      const nextTargets = this.communities.filter((community) => community.polityId === defender.id);
      const next = nextTargets[Math.floor(this.random() * nextTargets.length)];
      const origin = this.communities.find((community) => community.polityId === attacker.id && community.id === attacker.capitalId) || this.communities.find((community) => community.polityId === attacker.id);
      if (origin && next) {
        war.targetId = next.id;
        war.path = leastCostPath(this.world, origin.cell, next.cell, (attackerKnowledge.sailing || 0) >= 1);
        war.distanceKm = pathLengthKm(this.world, war.path);
      }
    }
    this.revision += 1;
  }

  updateDiplomacyAndWars() {
    for (const relation of this.relations.values()) relation.trade = 0;
    for (const route of this.routes) {
      const left = this.communities.find((community) => community.id === route.a);
      const right = this.communities.find((community) => community.id === route.b);
      if (left?.polityId != null && right?.polityId != null && left.polityId !== right.polityId) this.getRelation(left.polityId, right.polityId).trade += route.freight;
    }
    for (let aIndex = 0; aIndex < this.polities.length; aIndex += 1) {
      for (let bIndex = aIndex + 1; bIndex < this.polities.length; bIndex += 1) {
        const left = this.polities[aIndex];
        const right = this.polities[bIndex];
        const relation = this.getRelation(left.id, right.id);
        const distance = this.polityDistance(left, right);
        const leftKnowledge = this.cultures[left.cultureId].knowledge;
        const rightKnowledge = this.cultures[right.cultureId].knowledge;
        const contactRange = 24 + Math.max(leftKnowledge.roads || 0, rightKnowledge.roads || 0) * 18 + Math.max(leftKnowledge.rail || 0, rightKnowledge.rail || 0) * 30;
        const networkContact = relation.trade > 0.02 ? 0.28 : 0;
        const contact = Math.max(networkContact, clamp01(1 - distance / contactRange));
        const resourceStress = (2 - left.foodSecurity - right.foodSecurity) * 0.42;
        const tradeDependence = clamp01(relation.trade / Math.max(1, Math.sqrt(left.population * right.population) * 0.002));
        const powerRatio = Math.abs(Math.log((left.military + 1) / (right.military + 1)));
        const targetTension = clamp01(0.06 + contact * 0.43 + resourceStress * 0.38 + powerRatio * 0.055 + relation.rivalry * contact * 0.20 - tradeDependence * 0.31 - relation.trust * 0.16);
        relation.tension = lerp(relation.tension, targetTension, 0.055);
        relation.trust = clamp01(relation.trust + tradeDependence * 0.003 - relation.tension * 0.0014 + (relation.atWar ? -0.008 : 0));
        if (!relation.atWar) relation.status = relation.tension > 0.63 ? 'tense' : tradeDependence > 0.16 ? 'trade' : relation.trust > 0.7 ? 'alliance' : 'contact';
        const warChance = Math.max(0, relation.tension - 0.47) * 0.052 * contact * (1 - tradeDependence * 0.62);
        if (!relation.atWar && contact > 0.05 && left.population > 700 && right.population > 700 && this.random() < warChance) this.startWar(left, right, relation);
      }
    }
    for (const war of this.wars.filter((entry) => entry.active)) {
      const attacker = this.polities.find((polity) => polity.id === war.attackerId);
      if (!attacker) { war.active = false; continue; }
      const knowledge = this.cultures[attacker.cultureId].knowledge;
      const annualReachKm = 24 + (knowledge.wheel || 0) * 20 + (knowledge.roads || 0) * 42 + (knowledge.rail || 0) * 180 + (knowledge.combustion || 0) * 120 + (knowledge.aviation || 0) * 340;
      war.progress += annualReachKm / Math.max(annualReachKm, war.distanceKm) * (0.58 + war.intensity * 0.52);
      this.flows.push({
        id: `a:${this.year}:${war.id}`,
        type: 'army', routeId: null, path: war.path, reverse: false,
        volume: attacker.military * war.intensity, mode: (knowledge.combustion || 0) >= 1 ? 'motor-army' : (knowledge.wheel || 0) >= 1 ? 'column' : 'warband',
        progress: clamp01(war.progress), a: war.originId, b: war.targetId,
      });
      if (war.progress >= 1) this.resolveBattle(war);
    }
    this.wars = this.wars.filter((war) => war.active || this.year - war.startYear < 100);
    this.battles = this.battles.filter((battle) => battle.untilYear >= this.year);
  }

  updateClimate() {
    const holoceneTransition = clamp01(this.year / 900);
    const longCycle = Math.sin(this.year / 730) * 0.18 + Math.sin(this.year / 137) * 0.07;
    this.climate.anomaly = lerp(-1.15, 0.12, holoceneTransition) + longCycle;
    this.climate.moisture = clamp(0.94 + Math.sin(this.year / 510) * 0.11 + Math.sin(this.year / 83) * 0.035, 0.62, 1.22);
    this.climate.volatility = clamp(0.10 + Math.abs(Math.sin(this.year / 211)) * 0.18 + Math.max(0, this.climate.anomaly - 0.8) * 0.06, 0.08, 0.48);
    if (this.random() < 0.0015 + this.climate.volatility * 0.0018) {
      const affected = this.communities[Math.floor(this.random() * this.communities.length)];
      if (affected) {
        affected.stocks.food *= 0.58 + this.random() * 0.25;
        affected.stress = clamp01(affected.stress + 0.24);
        this.event('climate', `${affected.name} 기후 충격`, '강수와 기온 변동이 수확·사냥감·식량 저장량을 훼손했습니다.', 'world', 0.64);
      }
    }
  }

  updateTotals() {
    const population = this.communities.reduce((sum, community) => sum + community.population, 0);
    const permanentPopulation = this.communities.filter((community) => community.permanent).reduce((sum, community) => sum + community.population, 0);
    const topCulture = [...this.cultures].sort((a, b) => this.culturePopulation(b.id) - this.culturePopulation(a.id))[0];
    const frontier = topCulture ? eraFor(topCulture.knowledge, permanentPopulation / Math.max(1, population)) : eraFor(knowledgeTemplate());
    const technologyCount = Math.max(3, ...this.cultures.map((culture) => culture.adopted));
    this.totals = {
      population,
      communities: this.communities.length,
      permanentCommunities: this.communities.filter((community) => community.permanent).length,
      polities: this.polities.length,
      activeWars: this.wars.filter((war) => war.active).length,
      routeKm: this.routes.reduce((sum, route) => sum + route.distanceKm, 0),
      freight: this.routes.reduce((sum, route) => sum + route.freight, 0),
      urbanShare: permanentPopulation / Math.max(1, population),
      technologyCount,
      era: frontier,
    };
  }

  stepYear() {
    this.year += 1;
    this.calendarYear = START_CALENDAR_YEAR + this.year;
    this.updateClimate();
    this.updateTechnologies();
    this.updateCommunities();
    this.expandCommunities();
    if (this.year % 5 === 0 || this.revision > 0 && this.year % 2 === 0) this.rebuildRoutes();
    this.settleExchange();
    if (this.year % 5 === 0) this.updatePolities();
    this.updateDiplomacyAndWars();
    this.updateTotals();
    this.latestSnapshot = this.createSnapshot();
    this.recordSnapshot(this.latestSnapshot);
    this.revision = 0;
    return this.latestSnapshot;
  }

  advanceYears(count = 1) {
    const years = Math.max(0, Math.floor(Number(count) || 0));
    for (let index = 0; index < years; index += 1) this.stepYear();
    return this.latestSnapshot;
  }

  createSnapshot() {
    const cultureSnapshots = this.cultures.map((culture) => ({
      id: culture.id,
      name: culture.name,
      population: this.culturePopulation(culture.id),
      knowledge: { ...culture.knowledge },
      adopted: culture.adopted,
      era: eraFor(culture.knowledge),
    }));
    const communities = this.communities.map((community) => ({
      id: community.id,
      name: community.name,
      cultureId: community.cultureId,
      polityId: community.polityId,
      x: community.x,
      z: community.z,
      cell: community.cell,
      population: Math.round(community.population),
      permanent: community.permanent,
      foundedYear: community.foundedYear,
      nutrition: community.nutrition,
      health: community.health,
      stress: community.stress,
      surplus: community.surplus,
      wealth: community.wealth,
      inequality: community.inequality,
      buildings: community.buildings,
      fortification: community.fortification,
      foodCapacity: community.foodCapacity,
      type: community.type,
      stage: community.stage,
      localTraffic: community.localTraffic,
    }));
    const polities = this.polities.map((polity) => {
      const capital = communities.find((community) => community.id === polity.capitalId);
      return {
        ...polity,
        settlementIds: [...polity.settlementIds],
        population: Math.round(polity.population),
        capital: capital ? { id: capital.id, x: capital.x, z: capital.z, name: capital.name } : null,
        era: eraFor(this.cultures[polity.cultureId].knowledge),
      };
    });
    const routes = this.routes.map((route) => ({ ...route, path: route.path }));
    const relations = [...this.relations.values()].map((relation) => ({ ...relation }));
    const flows = this.flows.map((flow) => ({ ...flow, path: flow.path }));
    const battles = this.battles.map((battle) => ({ ...battle }));
    const wars = this.wars.filter((war) => war.active).map((war) => ({ ...war, path: war.path }));
    return {
      version: '5.0.0-deep-time',
      year: this.year,
      calendarYear: this.calendarYear,
      calendarLabel: calendarLabel(this.calendarYear),
      climate: { ...this.climate },
      totals: { ...this.totals },
      cultures: cultureSnapshots,
      communities,
      polities,
      routes,
      relations,
      flows,
      battles,
      wars,
      eventCount: this.events.length,
    };
  }

  shouldStoreYear(year) {
    if (year <= 250) return true;
    if (year <= 2500) return year % 10 === 0;
    if (year <= 10_000) return year % 50 === 0;
    if (year <= 50_000) return year % 100 === 0;
    return year % 500 === 0;
  }

  recordSnapshot(snapshot, force = false) {
    if (force || this.shouldStoreYear(snapshot.year)) this.history.set(snapshot.year, snapshot);
  }

  getSnapshotAtYear(year) {
    const target = clamp(Math.round(Number(year) || 0), 0, this.year);
    if (target === this.year) return this.latestSnapshot;
    if (this.history.has(target)) return this.history.get(target);
    let bestYear = 0;
    for (const stored of this.history.keys()) {
      if (stored <= target && stored >= bestYear) bestYear = stored;
    }
    return this.history.get(bestYear) || this.latestSnapshot;
  }

  getRecentEvents(year = this.year, limit = 7) {
    return this.events.filter((event) => event.year <= year).slice(-limit).reverse();
  }

  getEntity(id, snapshot = this.latestSnapshot) {
    const community = snapshot.communities.find((entry) => entry.id === Number(id));
    if (!community) return null;
    const culture = snapshot.cultures.find((entry) => entry.id === community.cultureId);
    const polity = snapshot.polities.find((entry) => entry.id === community.polityId) || null;
    return { community, culture, polity };
  }

  diagnostics() {
    const numeric = [
      this.totals.population,
      this.totals.routeKm,
      this.totals.freight,
      ...this.communities.flatMap((community) => [community.population, community.nutrition, community.health, community.stress, community.wealth]),
      ...this.polities.flatMap((polity) => [polity.population, polity.legitimacy, polity.cohesion, polity.military]),
    ];
    return {
      year: this.year,
      calendarYear: this.calendarYear,
      finite: numeric.every(Number.isFinite),
      historyCheckpoints: this.history.size,
      communities: this.communities.length,
      polities: this.polities.length,
      routes: this.routes.length,
      activeWars: this.wars.filter((war) => war.active).length,
      battles: this.battles.length,
      flows: this.flows.length,
      technologies: this.totals.technologyCount,
      noPresetCountries: this.world.countries.length === 0,
    };
  }
}

export function createDeepTimeSimulation(input) {
  return new DeepTimeSimulation(input);
}

export { calendarLabel, leastCostPath, TECH_BY_ID, TECH_ORDER };
