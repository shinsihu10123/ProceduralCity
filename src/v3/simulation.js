import { clamp, clamp01, createRandom, distance2, hashString, weightedChoice } from './core.js';
import { createSpatialPlan } from './spatial.js';

export const SIMULATION_YEARS = 120;

export const BUILDING_ARCHETYPES = Object.freeze({
  farmhouse: { label: '농가주택', program: 'housing', housing: 2, jobs: 1, floors: [1, 2], height: 3.2, coverage: 0.48, cost: 0.10, duration: 1, style: 'farmhouse' },
  cottage: { label: '단독주택', program: 'housing', housing: 1, jobs: 0, floors: [2, 2], height: 3.05, coverage: 0.46, cost: 0.14, duration: 1, style: 'cottage' },
  rowhouse: { label: '연립주택', program: 'housing', housing: 8, jobs: 1, floors: [3, 4], height: 3.15, coverage: 0.58, cost: 0.68, duration: 2, style: 'rowhouse' },
  apartmentLow: { label: '저층 공동주택', program: 'housing', housing: 28, jobs: 2, floors: [5, 7], height: 3.15, coverage: 0.46, cost: 2.5, duration: 2, style: 'apartment' },
  apartmentMid: { label: '중층 공동주택', program: 'housing', housing: 82, jobs: 4, floors: [9, 13], height: 3.2, coverage: 0.39, cost: 7.8, duration: 3, style: 'apartment' },
  residentialTower: { label: '주거 타워', program: 'housing', housing: 220, jobs: 10, floors: [20, 31], height: 3.25, coverage: 0.31, cost: 24, duration: 4, style: 'residentialTower' },
  workshop: { label: '공방', program: 'employment', housing: 0, jobs: 8, floors: [1, 2], height: 4.0, coverage: 0.60, cost: 0.24, duration: 1, style: 'workshop' },
  market: { label: '시장·상점', program: 'employment', housing: 0, jobs: 18, floors: [2, 3], height: 3.8, coverage: 0.64, cost: 0.95, duration: 1, style: 'shop' },
  factory: { label: '도시형 공장', program: 'employment', housing: 0, jobs: 58, floors: [1, 2], height: 5.4, coverage: 0.70, cost: 4.8, duration: 3, style: 'industrial' },
  office: { label: '업무동', program: 'employment', housing: 0, jobs: 115, floors: [8, 14], height: 3.65, coverage: 0.54, cost: 13.5, duration: 3, style: 'office' },
  officeTower: { label: '업무 타워', program: 'employment', housing: 0, jobs: 360, floors: [21, 34], height: 3.7, coverage: 0.38, cost: 39, duration: 5, style: 'officeTower' },
  shopHouse: { label: '상가주택', program: 'mixed', housing: 5, jobs: 10, floors: [3, 4], height: 3.35, coverage: 0.63, cost: 0.9, duration: 2, style: 'shopHouse' },
  mixedMid: { label: '중층 복합시설', program: 'mixed', housing: 48, jobs: 45, floors: [8, 12], height: 3.45, coverage: 0.52, cost: 10.5, duration: 3, style: 'mixedMid' },
  mixedTower: { label: '고층 복합시설', program: 'mixed', housing: 150, jobs: 180, floors: [18, 29], height: 3.55, coverage: 0.40, cost: 31, duration: 5, style: 'mixedTower' },
  townHall: { label: '읍사무소', program: 'civic', housing: 0, jobs: 8, service: 90, floors: [2, 3], height: 3.9, coverage: 0.48, cost: 1.5, duration: 2, style: 'civic' },
  school: { label: '학교', program: 'civic', housing: 0, jobs: 32, service: 900, floors: [3, 4], height: 3.8, coverage: 0.55, cost: 6.0, duration: 3, style: 'school' },
  clinic: { label: '보건소', program: 'civic', housing: 0, jobs: 24, service: 1900, floors: [3, 5], height: 3.7, coverage: 0.50, cost: 5.2, duration: 3, style: 'clinic' },
  hospital: { label: '종합병원', program: 'civic', housing: 0, jobs: 185, service: 8500, floors: [7, 11], height: 3.8, coverage: 0.50, cost: 29, duration: 5, style: 'hospital' },
  station: { label: '철도역', program: 'transport', housing: 0, jobs: 18, service: 2600, floors: [2, 3], height: 4.6, coverage: 0.58, cost: 8.5, duration: 3, style: 'station' },
  utility: { label: '기반시설', program: 'utility', housing: 0, jobs: 14, service: 3200, floors: [1, 2], height: 5.0, coverage: 0.64, cost: 7.0, duration: 3, style: 'utility' },
});

function stageFor(population) {
  if (population < 120) return { id: 'hamlet', label: '개척 취락' };
  if (population < 650) return { id: 'village', label: '마을' };
  if (population < 2600) return { id: 'town', label: '소도시' };
  if (population < 8500) return { id: 'regional', label: '지역 중심지' };
  return { id: 'mature', label: '성숙 도시' };
}

function cloneRoads(spatial) {
  return spatial.roads.map((road) => ({ ...road, points: road.points.map((point) => ({ ...point })), openYear: road.triggerPopulation <= 0 ? 0 : Infinity }));
}

function siteScore(site, request, random) {
  let score = site.suitability * 2.2 - site.slope * 0.025 + random() * 0.18;
  if (request.preferredDistricts?.includes(site.district)) score += 1.5;
  if (request.program === 'employment') {
    score += site.roadClass === 'collector' ? 0.55 : site.roadClass === 'arterial' || site.roadClass === 'boulevard' ? 0.82 : 0;
  }
  if (request.program === 'housing') {
    score += site.roadClass === 'local' || site.roadClass === 'track' ? 0.46 : 0;
    score -= Math.max(0, 120 - site.waterDistance) / 130;
  }
  if (request.program === 'civic') score += 1 - clamp01(site.centerDistance / 850);
  if (request.program === 'transport') score += site.district === 'station' ? 3 : -1;
  if (request.program === 'utility') score += site.district === 'industry' ? 2 : site.centerDistance / 1200;
  if (request.highDensity) {
    score += 1 - clamp01(site.centerDistance / 950);
    score += site.lotArea > 2100 ? 0.5 : 0;
  }
  return score;
}

function chooseSite(sites, roadsById, request, year, random) {
  let winner = null;
  let best = -Infinity;
  for (const site of sites) {
    if (site.occupied) continue;
    const road = roadsById.get(site.roadId);
    if (!road || road.openYear > year) continue;
    if (request.minimumArea && site.lotArea < request.minimumArea) continue;
    if (request.allowedDistricts && !request.allowedDistricts.includes(site.district)) continue;
    const score = siteScore(site, request, random);
    if (score > best) { best = score; winner = site; }
  }
  if (winner) winner.occupied = true;
  return winner;
}

function makeBuilding(archetypeId, site, year, random, source = 'private') {
  const archetype = BUILDING_ARCHETYPES[archetypeId];
  const floors = Math.round(archetype.floors[0] + random() * (archetype.floors[1] - archetype.floors[0]));
  const duration = archetype.duration;
  const coverage = clamp(archetype.coverage * (0.88 + random() * 0.18), 0.28, 0.75);
  const targetArea = site.lotArea * coverage;
  const aspect = clamp(site.lotWidth / Math.max(site.lotDepth, 1), 0.55, 1.65);
  const sizeLimits = {
    farmhouse: [14, 11], cottage: [13, 11], workshop: [20, 15], market: [24, 18],
    shopHouse: [22, 17], rowhouse: [30, 18],
  }[archetypeId];
  let width = clamp(Math.sqrt(targetArea * aspect), 8, site.lotWidth * 0.88);
  let depth = clamp(targetArea / Math.max(width, 1), 7, site.lotDepth * 0.82);
  if (sizeLimits) {
    width = Math.min(width, sizeLimits[0]);
    depth = Math.min(depth, sizeLimits[1]);
  }
  return {
    id: `building-${site.id}`,
    archetype: archetypeId,
    label: archetype.label,
    style: archetype.style,
    source,
    program: archetype.program,
    siteId: site.id,
    roadId: site.roadId,
    district: site.district,
    x: site.x,
    y: site.y,
    z: site.z,
    rotation: site.rotation,
    width,
    depth,
    floors,
    floorHeight: archetype.height,
    height: floors * archetype.height,
    housing: archetype.housing,
    jobs: archetype.jobs,
    service: archetype.service || 0,
    constructionStart: year,
    builtYear: year + duration,
    cost: archetype.cost,
    palette: Math.floor(random() * 5),
    variant: Math.floor(random() * 4),
  };
}

function capacities(buildings, year) {
  const completed = buildings.filter((building) => building.builtYear <= year);
  return completed.reduce((result, building) => {
    result.housing += building.housing;
    result.jobs += building.jobs;
    result.service += building.service;
    result.byProgram[building.program] = (result.byProgram[building.program] || 0) + 1;
    return result;
  }, { housing: 0, jobs: 0, service: 0, byProgram: {}, buildings: completed.length });
}

function pipelineCapacity(buildings, year, yearsAhead, field) {
  return buildings.filter((building) => building.builtYear > year && building.builtYear <= year + yearsAhead).reduce((sum, building) => sum + building[field], 0);
}

function chooseHousingArchetype(population, random) {
  if (population < 115) return weightedChoice(random, [{ value: 'cottage', weight: 0.58 }, { value: 'farmhouse', weight: 0.42 }]);
  if (population < 650) return weightedChoice(random, [{ value: 'rowhouse', weight: 0.68 }, { value: 'cottage', weight: 0.18 }, { value: 'shopHouse', weight: 0.14 }]);
  if (population < 2400) return weightedChoice(random, [{ value: 'apartmentLow', weight: 0.60 }, { value: 'rowhouse', weight: 0.23 }, { value: 'shopHouse', weight: 0.17 }]);
  if (population < 4000) return weightedChoice(random, [{ value: 'apartmentMid', weight: 0.53 }, { value: 'apartmentLow', weight: 0.19 }, { value: 'mixedMid', weight: 0.28 }]);
  return weightedChoice(random, [{ value: 'residentialTower', weight: 0.56 }, { value: 'apartmentMid', weight: 0.20 }, { value: 'mixedTower', weight: 0.24 }]);
}

function chooseEmploymentArchetype(population, random) {
  if (population < 220) return weightedChoice(random, [{ value: 'workshop', weight: 0.68 }, { value: 'market', weight: 0.32 }]);
  if (population < 1100) return weightedChoice(random, [{ value: 'market', weight: 0.46 }, { value: 'workshop', weight: 0.31 }, { value: 'factory', weight: 0.23 }]);
  if (population < 4200) return weightedChoice(random, [{ value: 'factory', weight: 0.35 }, { value: 'office', weight: 0.31 }, { value: 'mixedMid', weight: 0.34 }]);
  if (population < 4500) return weightedChoice(random, [{ value: 'office', weight: 0.38 }, { value: 'factory', weight: 0.22 }, { value: 'mixedMid', weight: 0.40 }]);
  return weightedChoice(random, [{ value: 'officeTower', weight: 0.44 }, { value: 'mixedTower', weight: 0.39 }, { value: 'office', weight: 0.17 }]);
}

function requestFor(archetypeId) {
  const archetype = BUILDING_ARCHETYPES[archetypeId];
  const industrial = archetypeId === 'factory' || archetypeId === 'utility';
  const transport = archetypeId === 'station';
  const tower = ['residentialTower', 'officeTower', 'mixedTower'].includes(archetypeId);
  const highDensity = ['apartmentMid', 'residentialTower', 'office', 'officeTower', 'mixedMid', 'mixedTower', 'hospital'].includes(archetypeId);
  return {
    program: archetype.program,
    minimumArea: archetypeId === 'utility' ? 1000 : highDensity ? 1450 : industrial ? 1800 : 0,
    highDensity,
    preferredDistricts: industrial ? ['industry', 'station'] : transport ? ['station'] : highDensity ? ['civic', 'station', 'southDistrict', 'northDistrict'] : ['village', 'eastFarm', 'northFarm'],
    allowedDistricts: transport
      ? ['station']
      : industrial
        ? ['industry', 'station', 'southDistrict']
        : tower
          ? ['civic', 'station', 'southDistrict', 'northDistrict']
          : null,
  };
}

function scheduleBuilding(context, archetypeId, year, source = 'private') {
  const { sites, roadsById, buildings, random } = context;
  const site = chooseSite(sites, roadsById, requestFor(archetypeId), year, random);
  if (!site) return null;
  const building = makeBuilding(archetypeId, site, year, random, source);
  buildings.push(building);
  return building;
}

function addInitialSettlement(context) {
  const initial = [
    'farmhouse', 'farmhouse', 'farmhouse', 'farmhouse', 'farmhouse',
    'cottage', 'cottage', 'cottage', 'cottage', 'cottage', 'cottage',
    'workshop', 'workshop', 'market', 'townHall',
  ];
  for (const archetype of initial) {
    const building = scheduleBuilding(context, archetype, 0, archetype === 'townHall' ? 'public' : 'founder');
    if (!building) throw new Error(`Unable to place initial ${archetype}`);
    building.builtYear = 0;
    building.constructionStart = -1;
  }
}

function maybeOpenRoads(context, state, year, metrics, events) {
  const candidates = context.roads
    .filter((road) => road.openYear === Infinity && (
      state.population >= road.triggerPopulation
      || (state.population >= road.triggerPopulation * 0.52 && (metrics.housingVacancy < 0.035 || metrics.jobUtilization > 0.94))
      || (state.population >= road.triggerPopulation * 0.24 && metrics.housingVacancy < -0.10)
    ))
    .sort((a, b) => a.triggerPopulation - b.triggerPopulation || a.publicCost - b.publicCost);
  let opened = 0;
  for (const road of candidates) {
    const financingRoom = state.governmentCash + Math.max(0, state.debtLimit - state.governmentDebt);
    if (financingRoom < road.publicCost || opened >= Math.max(1, Math.floor(state.population / 4500) + 1)) continue;
    const cashContribution = Math.min(state.governmentCash * 0.55, road.publicCost);
    state.governmentCash -= cashContribution;
    state.governmentDebt += road.publicCost - cashContribution;
    road.openYear = year;
    opened += 1;
    events.push({ year, type: 'road', title: `${road.name} 개통`, detail: `${road.class} · ${(road.length / 1000).toFixed(1)} km` });
  }
}

function maybeSchedulePublicServices(context, state, year, metrics, events, projectSlots) {
  const candidates = [
    { archetype: 'school', population: 420, target: (population) => Math.max(1, Math.ceil(population / 1800)) },
    { archetype: 'station', population: 850, target: () => 1 },
    { archetype: 'clinic', population: 1450, target: (population) => Math.max(1, Math.ceil(population / 3600)) },
    { archetype: 'utility', population: 1500, target: (population) => Math.max(1, Math.ceil(population / 2200)) },
    { archetype: 'hospital', population: 6200, target: (population) => Math.max(1, Math.ceil(population / 9000)) },
  ];
  let used = 0;
  for (const candidate of candidates) {
    if (used >= projectSlots || state.population < candidate.population) continue;
    const existing = context.buildings.filter((building) => building.archetype === candidate.archetype).length;
    if (existing >= candidate.target(state.population)) continue;
    const archetype = BUILDING_ARCHETYPES[candidate.archetype];
    const financingRoom = state.governmentCash + Math.max(0, state.debtLimit - state.governmentDebt);
    if (financingRoom < archetype.cost * 0.65) continue;
    const building = scheduleBuilding(context, candidate.archetype, year, 'public');
    if (!building) continue;
    const cashContribution = Math.min(state.governmentCash * 0.45, archetype.cost);
    state.governmentCash -= cashContribution;
    state.governmentDebt += archetype.cost - cashContribution;
    used += 1;
    events.push({ year, type: 'public', title: `${archetype.label} 착공`, detail: `${building.builtYear}년 완공 예정` });
  }
  return used;
}

function schedulePrivateDevelopment(context, state, year, metrics, slots, events) {
  let used = 0;
  const householdTarget = state.households * 1.18;
  let futureHousing = metrics.housing + pipelineCapacity(context.buildings, year, 5, 'housing');
  const laborTarget = state.population * state.laborParticipation * (1.04 + metrics.marketAccess * 0.12);
  let futureJobs = metrics.jobs + pipelineCapacity(context.buildings, year, 5, 'jobs');
  let guard = 0;
  while (used < slots && guard++ < slots * 3) {
    const housingShortage = householdTarget - futureHousing;
    const jobShortage = laborTarget - futureJobs;
    let archetypeId;
    if (housingShortage > Math.max(1.2, jobShortage * 0.55)) archetypeId = chooseHousingArchetype(state.population, context.random);
    else if (jobShortage > 1.5) archetypeId = chooseEmploymentArchetype(state.population, context.random);
    else if (metrics.occupancy > 0.94 && context.random() < 0.42) archetypeId = chooseHousingArchetype(state.population, context.random);
    else if (metrics.jobUtilization > 0.91 && context.random() < 0.55) archetypeId = chooseEmploymentArchetype(state.population, context.random);
    else break;
    const archetype = BUILDING_ARCHETYPES[archetypeId];
    const expectedYield = (archetype.housing * metrics.rentIndex * 0.085 + archetype.jobs * metrics.productivity * 0.000013) / Math.max(archetype.cost, 0.1);
    const hurdle = 0.055 + state.interestRate + metrics.constructionPressure * 0.018;
    if (expectedYield < hurdle && housingShortage <= 0 && jobShortage <= 0) break;
    const building = scheduleBuilding(context, archetypeId, year, 'private');
    if (!building) continue;
    futureHousing += building.housing;
    futureJobs += building.jobs;
    used += 1;
    if (building.cost > 9 || year < 8) events.push({ year, type: 'development', title: `${archetype.label} 착공`, detail: `${building.district} · ${building.floors}층` });
  }
  return used;
}

function createSnapshot(state, metrics, capacitiesNow, roads, buildings, year, flows) {
  const stage = stageFor(state.population);
  return {
    year,
    stage,
    population: Math.round(state.population),
    households: Math.round(state.households),
    laborForce: Math.round(metrics.laborForce),
    employed: Math.round(metrics.employed),
    unemploymentRate: metrics.unemploymentRate,
    housingUnits: Math.round(capacitiesNow.housing),
    housingVacancy: metrics.housingVacancy,
    jobsCapacity: Math.round(capacitiesNow.jobs),
    buildings: capacitiesNow.buildings,
    roads: roads.filter((road) => road.openYear <= year).length,
    roadLengthKm: roads.filter((road) => road.openYear <= year).reduce((sum, road) => sum + road.length, 0) / 1000,
    gdpM: metrics.gdpM,
    productivity: metrics.productivity,
    rentIndex: metrics.rentIndex,
    marketAccess: metrics.marketAccess,
    serviceCoverage: metrics.serviceCoverage,
    utilityReliability: metrics.utilityReliability,
    airQuality: metrics.airQuality,
    publicDebtM: state.governmentDebt,
    publicCashM: state.governmentCash,
    approval: metrics.approval,
    flows,
    underConstruction: buildings.filter((building) => building.constructionStart <= year && building.builtYear > year).length,
  };
}

export function createSettlementSimulation(input = {}) {
  const seedText = String(input.seed || 'new-horizon');
  const spatial = input.spatial || createSpatialPlan({ seed: seedText });
  const random = createRandom(hashString(`${seedText}:v3-simulation`));
  const roads = cloneRoads(spatial);
  const roadsById = new Map(roads.map((road) => [road.id, road]));
  const sites = spatial.sites.map((site) => ({ ...site, occupied: false }));
  const buildings = [];
  const context = { spatial, roads, roadsById, sites, buildings, random };
  addInitialSettlement(context);

  const events = [{ year: 0, type: 'milestone', title: '정착지 설립', detail: '42명 · 14가구' }];
  const snapshots = [];
  const state = {
    population: 42,
    households: 14,
    laborParticipation: 0.525,
    governmentCash: 1.45,
    governmentDebt: 0,
    debtLimit: 2.8,
    interestRate: 0.035,
    environment: 0.93,
    previousStage: 'hamlet',
  };

  for (let year = 0; year <= (input.years || SIMULATION_YEARS); year += 1) {
    const current = capacities(buildings, year);
    const laborForce = state.population * state.laborParticipation;
    const employed = Math.min(current.jobs, laborForce * 0.985);
    const unemploymentRate = clamp01(1 - employed / Math.max(1, laborForce));
    const housingVacancy = clamp((current.housing - state.households) / Math.max(1, current.housing), -0.5, 0.45);
    const openRoads = roads.filter((road) => road.openYear <= year);
    const weightedRoads = openRoads.reduce((sum, road) => sum + road.length * ({ track: 0.35, local: 0.55, collector: 0.88, arterial: 1.15, boulevard: 1.22 }[road.class] || 0.5), 0);
    const marketAccess = clamp01(0.15 + weightedRoads / 12500 + (current.byProgram.transport || 0) * 0.18);
    const educationBoost = (current.byProgram.civic || 0) * 0.018;
    const productivity = 38_000 * (1 + marketAccess * 0.58 + educationBoost + Math.log1p(state.population) * 0.035);
    const gdpM = employed * productivity / 1_000_000;
    const serviceCoverage = clamp01(0.58 + current.service / Math.max(170, state.population) * 0.34 + (current.byProgram.civic || 0) * 0.018);
    const utilityDemand = state.population / 4200 + current.byProgram.employment * 0.010;
    const utilitySupply = 0.72 + (current.byProgram.utility || 0) * 0.42 + marketAccess * 0.18;
    const utilityReliability = clamp(utilitySupply / Math.max(0.72, utilityDemand), 0.62, 0.995);
    const constructionPressure = clamp01(buildings.filter((building) => building.constructionStart <= year && building.builtYear > year).length / Math.max(2, 1 + state.population / 900));
    const rentIndex = clamp(1 + Math.max(0, -housingVacancy) * 1.8 + (0.08 - housingVacancy) * 0.65 + marketAccess * 0.16, 0.78, 2.4);
    const industrialShare = (current.byProgram.employment || 0) / Math.max(1, current.buildings);
    const airQuality = clamp(state.environment - industrialShare * 0.24 - (1 - utilityReliability) * 0.28 + 0.08, 0.35, 0.94);
    const approval = clamp01(0.48 + (serviceCoverage - 0.65) * 0.42 + (utilityReliability - 0.8) * 0.35 - unemploymentRate * 0.55 - Math.max(0, -housingVacancy) * 0.35 - state.governmentDebt / Math.max(3, gdpM * 2) * 0.12);
    const occupancy = 1 - Math.max(0, housingVacancy);
    const jobUtilization = employed / Math.max(1, current.jobs);
    const metrics = {
      laborForce, employed, unemploymentRate, housingVacancy, marketAccess, productivity, gdpM,
      serviceCoverage, utilityReliability, constructionPressure, rentIndex, airQuality, approval,
      occupancy, jobUtilization,
    };

    let flows = { births: 0, deaths: 0, inMigration: 0, outMigration: 0, netChange: 0 };
    if (year > 0) {
      const births = state.population * (0.0132 - clamp01(state.population / 18000) * 0.0024);
      const deaths = state.population * (0.0072 + (1 - serviceCoverage) * 0.003 + (1 - airQuality) * 0.0018);
      const jobAttraction = clamp((current.jobs - laborForce) / Math.max(8, laborForce), -0.45, 0.35);
      const housingAttraction = clamp((current.housing - state.households) / Math.max(6, state.households), -0.45, 0.30);
      const attraction = clamp01(0.40 + jobAttraction * 1.65 + housingAttraction * 1.35 + (serviceCoverage - 0.64) * 0.72 + (marketAccess - 0.3) * 0.34);
      const migrationPool = 1.6 + Math.pow(state.population, 0.68) * 0.65 + marketAccess * 8;
      // Employment can create demand, but actual migration is constrained by
      // habitable stock. This prevents people from appearing faster than homes.
      const housingGate = clamp(0.82 + (housingVacancy + 0.02) * 2.0, 0.55, 1);
      const inMigration = migrationPool * attraction * housingGate;
      const outMigration = state.population * (0.007 + unemploymentRate * 0.055 + Math.max(0, -housingVacancy) * 0.043 + (1 - utilityReliability) * 0.018);
      const netChange = births - deaths + inMigration - outMigration;
      state.population = Math.max(18, state.population + netChange);
      const householdSize = clamp(2.95 - year * 0.0034 - Math.log1p(state.population) * 0.018, 2.42, 2.95);
      state.households = state.population / householdSize;
      flows = { births, deaths, inMigration, outMigration, netChange };
    }

    const taxRevenue = gdpM * (0.118 + serviceCoverage * 0.022);
    const operatingCost = gdpM * (0.052 + serviceCoverage * 0.012)
      + state.population * 0.00008
      + openRoads.reduce((sum, road) => sum + road.length, 0) * 0.000009
      + state.governmentDebt * state.interestRate;
    state.governmentCash += taxRevenue - operatingCost;
    if (state.governmentCash < 0) { state.governmentDebt += -state.governmentCash; state.governmentCash = 0; }
    const debtPayment = Math.min(state.governmentCash * 0.14, state.governmentDebt * 0.09);
    state.governmentCash -= debtPayment;
    state.governmentDebt -= debtPayment;
    const reserveTarget = Math.max(1.8, gdpM * 0.16);
    if (state.governmentCash > reserveTarget) {
      const reinvestment = (state.governmentCash - reserveTarget) * 0.45;
      state.governmentCash -= reinvestment;
      state.environment = clamp(state.environment + reinvestment / Math.max(40, gdpM * 90), 0.45, 0.94);
    }
    state.debtLimit = Math.max(5.0, gdpM * 1.15);
    state.environment = clamp01(state.environment - industrialShare * 0.0025 + (current.byProgram.utility || 0) * 0.003 - Math.max(0, 0.86 - utilityReliability) * 0.004);

    if (year < (input.years || SIMULATION_YEARS)) {
      const yearEvents = [];
      maybeOpenRoads(context, state, year, metrics, yearEvents);
      const totalSlots = clamp(4 + Math.floor(state.population / 450), 4, 14);
      const publicUsed = maybeSchedulePublicServices(context, state, year, metrics, yearEvents, Math.max(1, Math.floor(totalSlots * 0.3)));
      schedulePrivateDevelopment(context, state, year, metrics, Math.max(0, totalSlots - publicUsed), yearEvents);
      events.push(...yearEvents);
    }

    const stage = stageFor(state.population);
    if (stage.id !== state.previousStage) {
      events.push({ year, type: 'milestone', title: `${stage.label} 단계 진입`, detail: `인구 ${Math.round(state.population).toLocaleString('ko-KR')}명` });
      state.previousStage = stage.id;
    }
    snapshots.push(createSnapshot(state, metrics, current, roads, buildings, year, flows));
  }

  const simulation = {
    version: '3.0.0-causal-timeline',
    seed: seedText,
    years: input.years || SIMULATION_YEARS,
    spatial,
    roads,
    buildings,
    events,
    snapshots,
    getSnapshot(year) {
      return snapshots[clamp(Math.round(year), 0, snapshots.length - 1)];
    },
    getVisibleState(year) {
      const value = clamp(Number(year) || 0, 0, this.years);
      const snapshot = snapshots[clamp(Math.floor(value), 0, snapshots.length - 1)];
      return {
        year: value,
        snapshot,
        roads: roads.filter((road) => road.openYear <= value),
        buildings: buildings.filter((building) => building.constructionStart <= value),
        completedBuildings: buildings.filter((building) => building.builtYear <= value),
        constructionSites: buildings.filter((building) => building.constructionStart <= value && building.builtYear > value),
        recentEvents: events.filter((event) => event.year <= value).slice(-4),
      };
    },
    diagnostics: {
      buildings: buildings.length,
      sitesUsed: sites.filter((site) => site.occupied).length,
      initial: snapshots[0],
      final: snapshots[snapshots.length - 1],
      milestones: events.filter((event) => event.type === 'milestone').length,
    },
  };
  return simulation;
}
