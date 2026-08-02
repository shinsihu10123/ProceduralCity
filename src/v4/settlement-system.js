import { clamp, clamp01, createRandom, hashString, weightedChoice } from '../v3/core.js';
import { BUILDING_ARCHETYPES } from '../v3/simulation.js';

const MONTHS_PER_YEAR = 12;

const ROAD_WEIGHT = Object.freeze({ track: 0.30, local: 0.55, collector: 0.86, arterial: 1.14, boulevard: 1.28 });

const PUBLIC_RULES = Object.freeze([
  { archetype: 'school', threshold: 380, perPeople: 1700 },
  { archetype: 'station', threshold: 760, perPeople: Infinity },
  { archetype: 'clinic', threshold: 1250, perPeople: 3300 },
  { archetype: 'utility', threshold: 1450, perPeople: 2400 },
  { archetype: 'hospital', threshold: 5600, perPeople: 8200 },
]);

function totalCohorts(cohorts) {
  return cohorts.children + cohorts.youth + cohorts.working + cohorts.seniors;
}

function stageFor(population) {
  if (population < 120) return { id: 'hamlet', label: '개척 취락' };
  if (population < 650) return { id: 'village', label: '마을' };
  if (population < 2600) return { id: 'town', label: '소도시' };
  if (population < 8500) return { id: 'regional', label: '지역 중심지' };
  if (population < 25000) return { id: 'city', label: '도시' };
  return { id: 'metropolitan', label: '광역 중심지' };
}

function cloneRoads(spatial) {
  return spatial.roads.map((road) => ({
    ...road,
    points: road.points.map((point) => ({ ...point })),
    openMonth: road.triggerPopulation <= 0 ? 0 : Infinity,
    openYear: road.triggerPopulation <= 0 ? 0 : Infinity,
    condition: road.triggerPopulation <= 0 ? 0.78 : 0.96,
    capacityIndex: ROAD_WEIGHT[road.class] || 0.5,
  }));
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
    preferredDistricts: industrial
      ? ['industry', 'station', 'southDistrict']
      : transport
        ? ['station']
        : highDensity
          ? ['civic', 'station', 'southDistrict', 'northDistrict', 'westTown']
          : ['village', 'eastFarm', 'northFarm', 'mill'],
    allowedDistricts: transport
      ? ['station']
      : industrial
        ? ['industry', 'station', 'southDistrict']
        : tower
          ? ['civic', 'station', 'southDistrict', 'northDistrict', 'westTown']
          : null,
  };
}

function chooseHousingArchetype(population, landPressure, random) {
  if (population < 120) return weightedChoice(random, [{ value: 'cottage', weight: 0.58 }, { value: 'farmhouse', weight: 0.42 }]);
  if (population < 700) return weightedChoice(random, [{ value: 'rowhouse', weight: 0.60 }, { value: 'cottage', weight: 0.20 }, { value: 'shopHouse', weight: 0.20 }]);
  if (population < 2800) return weightedChoice(random, [{ value: 'apartmentLow', weight: 0.55 }, { value: 'rowhouse', weight: 0.20 }, { value: 'shopHouse', weight: 0.25 }]);
  if (population < 8500 || landPressure < 0.62) return weightedChoice(random, [{ value: 'apartmentMid', weight: 0.48 }, { value: 'apartmentLow', weight: 0.22 }, { value: 'mixedMid', weight: 0.30 }]);
  return weightedChoice(random, [{ value: 'residentialTower', weight: 0.48 }, { value: 'apartmentMid', weight: 0.22 }, { value: 'mixedTower', weight: 0.30 }]);
}

function chooseEmploymentArchetype(population, serviceShare, random) {
  if (population < 240) return weightedChoice(random, [{ value: 'workshop', weight: 0.66 }, { value: 'market', weight: 0.34 }]);
  if (population < 1200) return weightedChoice(random, [{ value: 'market', weight: 0.46 }, { value: 'workshop', weight: 0.30 }, { value: 'factory', weight: 0.24 }]);
  if (population < 4500) return weightedChoice(random, [{ value: 'factory', weight: 0.31 }, { value: 'office', weight: serviceShare }, { value: 'mixedMid', weight: 0.38 }]);
  return weightedChoice(random, [{ value: 'officeTower', weight: serviceShare }, { value: 'mixedTower', weight: 0.42 }, { value: 'office', weight: 0.25 }]);
}

function siteScore(site, request, random) {
  let score = site.suitability * 2.4 - site.slope * 0.027 + random() * 0.14;
  if (request.preferredDistricts?.includes(site.district)) score += 1.45;
  if (request.program === 'employment') score += ['collector', 'arterial', 'boulevard'].includes(site.roadClass) ? 0.68 : 0;
  if (request.program === 'housing') {
    score += ['local', 'track'].includes(site.roadClass) ? 0.40 : 0;
    score -= Math.max(0, 105 - site.waterDistance) / 125;
  }
  if (request.program === 'civic') score += 1 - clamp01(site.centerDistance / 850);
  if (request.program === 'transport') score += site.district === 'station' ? 3.2 : -1.2;
  if (request.program === 'utility') score += site.district === 'industry' ? 2.2 : site.centerDistance / 1300;
  if (request.highDensity) {
    score += 1.2 - clamp01(site.centerDistance / 940);
    if (site.lotArea > 2100) score += 0.46;
  }
  return score;
}

function makeBuilding(archetypeId, site, month, random, serial, source = 'private') {
  const archetype = BUILDING_ARCHETYPES[archetypeId];
  const floors = Math.round(archetype.floors[0] + random() * (archetype.floors[1] - archetype.floors[0]));
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
  const durationMonths = Math.max(3, Math.round(archetype.duration * MONTHS_PER_YEAR * (0.86 + random() * 0.28)));
  return {
    id: `building-${site.id}-${serial}`,
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
    constructionStartMonth: month,
    builtMonth: month + durationMonths,
    removedMonth: Infinity,
    constructionStart: month / MONTHS_PER_YEAR,
    builtYear: (month + durationMonths) / MONTHS_PER_YEAR,
    removeYear: Infinity,
    cost: archetype.cost,
    palette: Math.floor(random() * 5),
    variant: Math.floor(random() * 4),
  };
}

function activeAt(building, month) {
  return building.builtMonth <= month && building.removedMonth > month;
}

function pipelineAt(building, month) {
  return building.constructionStartMonth <= month && building.builtMonth > month && building.removedMonth > month;
}

export class SettlementSystem {
  constructor({ seed = 'new-horizon', spatial, hostCountryId = 0 } = {}) {
    if (!spatial) throw new Error('SettlementSystem requires a spatial plan');
    this.version = '4.0.0-stock-flow-settlement';
    this.seed = String(seed);
    this.spatial = spatial;
    this.hostCountryId = hostCountryId;
    this.random = createRandom(hashString(`${this.seed}:v4-settlement`));
    this.roads = cloneRoads(spatial);
    this.roadsById = new Map(this.roads.map((road) => [road.id, road]));
    this.sites = spatial.sites.map((site) => ({ ...site, currentBuildingId: null }));
    this.buildings = [];
    this.events = [];
    this.buildingSerial = 0;
    this.buildingRevision = 0;
    this.state = {
      cohorts: { children: 9, youth: 6, working: 25, seniors: 2 },
      households: 14,
      firms: 5,
      firmConfidence: 0.58,
      governmentCashM: 1.45,
      governmentDebtM: 0,
      taxRate: 0.125,
      environmentStock: 0.93,
      roadCondition: 0.78,
      waterReserve: 0.91,
      gridReserve: 0.18,
      inequality: 0.31,
      previousStage: 'hamlet',
      consecutiveHousingStress: 0,
      lastMetrics: null,
      lastFlows: { births: 0, deaths: 0, inMigration: 0, outMigration: 0, netChange: 0 },
    };
    this.addInitialSettlement();
    this.events.push({ month: 0, year: 0, type: 'milestone', scope: 'settlement', title: '정착지 설립', detail: '42명 · 14가구 · 5개 사업체' });
  }

  addInitialSettlement() {
    const initial = [
      'farmhouse', 'farmhouse', 'farmhouse', 'farmhouse', 'farmhouse',
      'cottage', 'cottage', 'cottage', 'cottage', 'cottage', 'cottage',
      'workshop', 'workshop', 'market', 'townHall',
    ];
    for (const archetypeId of initial) {
      const building = this.scheduleBuilding(archetypeId, 0, archetypeId === 'townHall' ? 'public' : 'founder', false);
      if (!building) throw new Error(`Unable to place initial ${archetypeId}`);
      building.constructionStartMonth = -1;
      building.builtMonth = 0;
      building.constructionStart = -1 / MONTHS_PER_YEAR;
      building.builtYear = 0;
    }
    this.buildingRevision += 1;
  }

  chooseVacantSite(archetypeId) {
    const request = requestFor(archetypeId);
    let winner = null;
    let best = -Infinity;
    for (const site of this.sites) {
      if (site.currentBuildingId) continue;
      const road = this.roadsById.get(site.roadId);
      if (!road || !Number.isFinite(road.openMonth)) continue;
      if (request.minimumArea && site.lotArea < request.minimumArea) continue;
      if (request.allowedDistricts && !request.allowedDistricts.includes(site.district)) continue;
      const score = siteScore(site, request, this.random);
      if (score > best) {
        best = score;
        winner = site;
      }
    }
    return winner;
  }

  chooseRedevelopmentSite(archetypeId, month) {
    const request = requestFor(archetypeId);
    const candidates = [];
    for (const site of this.sites) {
      if (!site.currentBuildingId) continue;
      const building = this.buildings.find((entry) => entry.id === site.currentBuildingId);
      if (!building || building.removedMonth <= month || !activeAt(building, month)) continue;
      if (building.source === 'public' || ['utility', 'station'].includes(building.archetype)) continue;
      const ageYears = (month - building.builtMonth) / MONTHS_PER_YEAR;
      if (ageYears < 42) continue;
      if (request.minimumArea && site.lotArea < request.minimumArea) continue;
      if (request.allowedDistricts && !request.allowedDistricts.includes(site.district)) continue;
      const capacityGain = (BUILDING_ARCHETYPES[archetypeId].housing + BUILDING_ARCHETYPES[archetypeId].jobs)
        - (building.housing + building.jobs);
      if (capacityGain <= 2 && ageYears < 75) continue;
      const score = siteScore(site, request, this.random) + ageYears / 80 + Math.max(0, capacityGain) / 120;
      candidates.push({ site, building, score });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  }

  scheduleBuilding(archetypeId, month, source = 'private', allowRedevelopment = true) {
    let site = this.chooseVacantSite(archetypeId);
    let replaced = null;
    if (!site && allowRedevelopment) {
      const candidate = this.chooseRedevelopmentSite(archetypeId, month);
      site = candidate?.site || null;
      replaced = candidate?.building || null;
    }
    if (!site) return null;
    const building = makeBuilding(archetypeId, site, month, this.random, ++this.buildingSerial, source);
    if (replaced) {
      replaced.removedMonth = month;
      replaced.removeYear = month / MONTHS_PER_YEAR;
      building.replaces = replaced.id;
    }
    site.currentBuildingId = building.id;
    this.buildings.push(building);
    this.buildingRevision += 1;
    return building;
  }

  capacities(month) {
    return this.buildings.filter((building) => activeAt(building, month)).reduce((result, building) => {
      result.housing += building.housing;
      result.jobs += building.jobs;
      result.service += building.service;
      result.buildings += 1;
      result.byProgram[building.program] = (result.byProgram[building.program] || 0) + 1;
      result.byArchetype[building.archetype] = (result.byArchetype[building.archetype] || 0) + 1;
      return result;
    }, { housing: 0, jobs: 0, service: 0, buildings: 0, byProgram: {}, byArchetype: {} });
  }

  pipeline(month) {
    return this.buildings.filter((building) => pipelineAt(building, month)).reduce((result, building) => {
      result.housing += building.housing;
      result.jobs += building.jobs;
      result.service += building.service;
      result.buildings += 1;
      return result;
    }, { housing: 0, jobs: 0, service: 0, buildings: 0 });
  }

  measure(month, host = {}) {
    const population = totalCohorts(this.state.cohorts);
    const householdSize = clamp(3.10 - Math.log1p(Math.max(1, population)) * 0.025 - month / 12000, 2.18, 3.10);
    const households = population / householdSize;
    const capacity = this.capacities(month);
    const openRoads = this.roads.filter((road) => road.openMonth <= month);
    const roadLengthKm = openRoads.reduce((sum, road) => sum + road.length, 0) / 1000;
    const weightedRoads = openRoads.reduce((sum, road) => sum + road.length * road.capacityIndex * road.condition, 0);
    const accessibility = clamp01(0.13 + weightedRoads / 14200 + (capacity.byProgram.transport || 0) * 0.15);
    const laborForce = this.state.cohorts.youth * 0.52 + this.state.cohorts.working * 0.83 + this.state.cohorts.seniors * 0.10;
    const externalDemand = clamp(0.84 + (host.realGrowth || 0) * 3.2 + (host.tradeAccess ?? 0.55) * 0.20 - (host.conflictIntensity || 0) * 0.30, 0.55, 1.18);
    const utilizedJobs = capacity.jobs * externalDemand * clamp(0.84 + this.state.firmConfidence * 0.24, 0.70, 1.12);
    const employed = Math.min(laborForce, utilizedJobs);
    const unemploymentRate = clamp01(1 - employed / Math.max(1, laborForce));
    const housingVacancy = clamp((capacity.housing - households) / Math.max(1, capacity.housing), -0.65, 0.55);
    const serviceCoverage = clamp01(0.48 + capacity.service / Math.max(150, population) * 0.34 + (capacity.byProgram.civic || 0) * 0.022 + (host.publicServices || 0.55) * 0.16);
    const utilityDemand = population / 4400 + (capacity.byProgram.employment || 0) * 0.009 + (capacity.byProgram.mixed || 0) * 0.006;
    const utilitySupply = 0.70 + (capacity.byProgram.utility || 0) * 0.40 + (host.energySecurity || 0.72) * 0.24;
    const utilityReliability = clamp(utilitySupply / Math.max(0.72, utilityDemand), 0.38, 0.998);
    const waterReliability = clamp(this.state.waterReserve * 0.80 + serviceCoverage * 0.18 - Math.max(0, population / 38000) * 0.08, 0.35, 0.99);
    const congestion = clamp01((employed * 0.62 + population * 0.18) / Math.max(50, weightedRoads * 0.045));
    const baseProductivity = Math.max(22000, host.gdpPerCapita || 32000);
    const productivity = baseProductivity * (0.72 + accessibility * 0.32 + serviceCoverage * 0.10)
      * (0.86 + utilityReliability * 0.14) * (1 - congestion * 0.08);
    const gdpM = employed * productivity / 1_000_000;
    const rentIndex = clamp(0.82 + Math.max(0, -housingVacancy) * 2.2 + (0.09 - housingVacancy) * 0.54 + accessibility * 0.18, 0.62, 3.8);
    const landPressure = clamp01((rentIndex - 0.85) / 2.15 + (1 - this.sites.filter((site) => !site.currentBuildingId).length / this.sites.length) * 0.35);
    const industrialShare = (capacity.byProgram.employment || 0) / Math.max(1, capacity.buildings);
    const airQuality = clamp(this.state.environmentStock - industrialShare * 0.18 - congestion * 0.15 - (1 - utilityReliability) * 0.22 + 0.08, 0.28, 0.97);
    const homelessnessRate = clamp01(Math.max(0, -housingVacancy) * 0.55);
    const approval = clamp01(0.50 + (serviceCoverage - 0.60) * 0.34 + (utilityReliability - 0.78) * 0.28
      - unemploymentRate * 0.42 - homelessnessRate * 0.48 - congestion * 0.13
      - this.state.governmentDebtM / Math.max(4, gdpM * 1.5) * 0.09 - this.state.inequality * 0.08);
    return {
      month,
      year: month / MONTHS_PER_YEAR,
      population,
      households,
      householdSize,
      capacity,
      roadLengthKm,
      openRoads: openRoads.length,
      accessibility,
      laborForce,
      employed,
      unemploymentRate,
      housingVacancy,
      serviceCoverage,
      utilityReliability,
      waterReliability,
      congestion,
      productivity,
      gdpM,
      rentIndex,
      landPressure,
      airQuality,
      homelessnessRate,
      approval,
      stage: stageFor(population),
      underConstruction: this.buildings.filter((building) => pipelineAt(building, month)).length,
    };
  }

  stepDemography(month, metrics, host) {
    const cohorts = this.state.cohorts;
    const population = metrics.population;
    const fertility = clamp(0.0128 + (host.fertilitySupport || 0) * 0.0018 - metrics.rentIndex * 0.00055
      + metrics.serviceCoverage * 0.0014, 0.006, 0.020);
    const births = population * fertility / MONTHS_PER_YEAR;
    const healthPenalty = (1 - metrics.serviceCoverage) * 0.42 + (1 - metrics.airQuality) * 0.25 + (host.healthShock || 0);
    const conflictPenalty = host.conflictIntensity || 0;
    const childDeaths = cohorts.children * (0.0018 + healthPenalty * 0.004) / MONTHS_PER_YEAR;
    const youthDeaths = cohorts.youth * (0.0010 + healthPenalty * 0.002 + conflictPenalty * 0.001) / MONTHS_PER_YEAR;
    const workingDeaths = cohorts.working * (0.0031 + healthPenalty * 0.004 + conflictPenalty * 0.002) / MONTHS_PER_YEAR;
    const seniorDeaths = cohorts.seniors * (0.043 + healthPenalty * 0.026) / MONTHS_PER_YEAR;
    const deaths = childDeaths + youthDeaths + workingDeaths + seniorDeaths;
    const ageChild = cohorts.children / (15 * MONTHS_PER_YEAR);
    const ageYouth = cohorts.youth / (10 * MONTHS_PER_YEAR);
    const ageWorking = cohorts.working / (40 * MONTHS_PER_YEAR);

    const jobPull = clamp((metrics.capacity.jobs - metrics.laborForce) / Math.max(12, metrics.laborForce), -0.45, 0.45);
    const housingPull = clamp((metrics.capacity.housing - metrics.households) / Math.max(8, metrics.households), -0.55, 0.40);
    const wagePull = clamp((metrics.productivity / Math.max(18000, host.gdpPerCapita || 32000)) - 0.85, -0.35, 0.45);
    const attraction = clamp01(0.40 + jobPull * 1.20 + housingPull * 1.10 + wagePull * 0.38
      + (metrics.serviceCoverage - 0.58) * 0.50 + (host.netMigrationRate || 0) * 45 - (host.conflictIntensity || 0) * 0.50);
    const migrationPool = 0.18 + Math.pow(Math.max(1, population), 0.61) * 0.075 + metrics.accessibility * 0.80;
    const housingGate = clamp(0.74 + (metrics.housingVacancy + 0.02) * 2.1, 0.18, 1);
    const inMigration = migrationPool * attraction * housingGate;
    const outMigration = population * (0.00045 + metrics.unemploymentRate * 0.0038 + metrics.homelessnessRate * 0.0042
      + (1 - metrics.utilityReliability) * 0.0018 + (host.conflictIntensity || 0) * 0.0025);
    const netMigration = inMigration - outMigration;

    cohorts.children = Math.max(0, cohorts.children + births - childDeaths - ageChild + netMigration * 0.16);
    cohorts.youth = Math.max(0, cohorts.youth + ageChild - youthDeaths - ageYouth + netMigration * 0.21);
    cohorts.working = Math.max(0, cohorts.working + ageYouth - workingDeaths - ageWorking + netMigration * 0.59);
    cohorts.seniors = Math.max(0, cohorts.seniors + ageWorking - seniorDeaths + netMigration * 0.04);

    const netChange = births - deaths + netMigration;
    this.state.lastFlows = { births, deaths, inMigration, outMigration, netChange };
    this.state.households = totalCohorts(cohorts) / metrics.householdSize;
    return this.state.lastFlows;
  }

  updateFirms(metrics, host) {
    const demand = clamp(0.48 + metrics.accessibility * 0.22 + (1 - metrics.unemploymentRate) * 0.24
      + (host.realGrowth || 0) * 2.2 - (host.inflation || 0.02) * 0.45, 0.08, 0.98);
    const entries = Math.max(0, metrics.population * 0.000035 * demand * this.random());
    const exits = this.state.firms * (0.0012 + Math.max(0, -host.realGrowth || 0) * 0.025 + metrics.rentIndex * 0.00035);
    this.state.firms = Math.max(1, this.state.firms + entries - exits);
    this.state.firmConfidence = clamp(this.state.firmConfidence * 0.94 + demand * 0.06 + (this.random() - 0.5) * 0.018, 0.12, 0.91);
  }

  updatePublicAccounts(metrics, host) {
    const monthlyOutputM = metrics.gdpM / MONTHS_PER_YEAR;
    const taxRevenue = monthlyOutputM * this.state.taxRate;
    const transfers = metrics.population * (0.000018 + metrics.unemploymentRate * 0.000025);
    const services = metrics.population * 0.000030 * (0.62 + metrics.serviceCoverage * 0.55);
    const roadMaintenance = metrics.roadLengthKm * 0.00072 * (1.15 - this.state.roadCondition * 0.45);
    const interest = this.state.governmentDebtM * clamp(host.interestRate || 0.04, 0.005, 0.18) / MONTHS_PER_YEAR;
    const operatingCost = transfers + services + roadMaintenance + interest;
    this.state.governmentCashM += taxRevenue - operatingCost;
    if (this.state.governmentCashM < 0) {
      this.state.governmentDebtM += -this.state.governmentCashM;
      this.state.governmentCashM = 0;
    }
    const debtPayment = Math.min(this.state.governmentCashM * 0.04, this.state.governmentDebtM * 0.012);
    this.state.governmentCashM -= debtPayment;
    this.state.governmentDebtM = Math.max(0, this.state.governmentDebtM - debtPayment);
    const maintenanceEffort = roadMaintenance / Math.max(0.001, metrics.roadLengthKm * 0.00072);
    this.state.roadCondition = clamp(this.state.roadCondition - 0.0011 - metrics.congestion * 0.0009 + maintenanceEffort * 0.0011, 0.32, 0.98);
    for (const road of this.roads) if (road.openMonth <= metrics.month) road.condition = this.state.roadCondition;
  }

  updateUtilitiesAndEnvironment(metrics, host) {
    const drought = host.climateHazard || 0;
    this.state.waterReserve = clamp(this.state.waterReserve + 0.0035 * (metrics.waterReliability - 0.72) - drought * 0.004
      - metrics.population / 6_000_000, 0.20, 0.99);
    this.state.gridReserve = clamp(metrics.utilityReliability - 0.78, -0.25, 0.32);
    const pollution = (1 - metrics.airQuality) * 0.0014 + metrics.congestion * 0.0007;
    const restoration = metrics.serviceCoverage * 0.00055 + (host.renewableShare || 0.25) * 0.00045;
    this.state.environmentStock = clamp(this.state.environmentStock - pollution + restoration - drought * 0.0007, 0.28, 0.96);
    this.state.inequality = clamp(this.state.inequality + metrics.unemploymentRate * 0.0008 + metrics.homelessnessRate * 0.0012
      - metrics.serviceCoverage * 0.00035 - this.state.taxRate * 0.0004, 0.20, 0.62);
  }

  maybeOpenRoad(month, metrics) {
    const candidates = this.roads.filter((road) => !Number.isFinite(road.openMonth) && (
      metrics.population >= road.triggerPopulation
      || (metrics.population >= road.triggerPopulation * 0.58 && (metrics.housingVacancy < 0.01 || metrics.congestion > 0.82))
    )).sort((a, b) => a.triggerPopulation - b.triggerPopulation || a.publicCost - b.publicCost);
    const road = candidates[0];
    if (!road) return false;
    const debtRoom = Math.max(0, metrics.gdpM * 1.05 - this.state.governmentDebtM);
    const financingRoom = this.state.governmentCashM + debtRoom;
    if (financingRoom < road.publicCost) return false;
    const cash = Math.min(this.state.governmentCashM * 0.48, road.publicCost);
    this.state.governmentCashM -= cash;
    this.state.governmentDebtM += road.publicCost - cash;
    road.openMonth = month;
    road.openYear = month / MONTHS_PER_YEAR;
    road.condition = 0.97;
    this.events.push({ month, year: month / MONTHS_PER_YEAR, type: 'road', scope: 'settlement', title: `${road.name} 개통`, detail: `${road.class} · ${(road.length / 1000).toFixed(1)} km · 수요 기반 투자` });
    return true;
  }

  maybeSchedulePublic(month, metrics) {
    for (const rule of PUBLIC_RULES) {
      if (metrics.population < rule.threshold) continue;
      const existing = this.buildings.filter((building) => building.archetype === rule.archetype && building.removedMonth > month).length;
      const target = Number.isFinite(rule.perPeople) ? Math.max(1, Math.ceil(metrics.population / rule.perPeople)) : 1;
      if (existing >= target) continue;
      const archetype = BUILDING_ARCHETYPES[rule.archetype];
      const debtRoom = Math.max(0, metrics.gdpM * 1.10 - this.state.governmentDebtM);
      if (this.state.governmentCashM + debtRoom < archetype.cost * 0.72) continue;
      const building = this.scheduleBuilding(rule.archetype, month, 'public');
      if (!building) continue;
      const cash = Math.min(this.state.governmentCashM * 0.40, archetype.cost);
      this.state.governmentCashM -= cash;
      this.state.governmentDebtM += archetype.cost - cash;
      this.events.push({ month, year: month / MONTHS_PER_YEAR, type: 'public', scope: 'settlement', title: `${archetype.label} 착공`, detail: `${(building.builtMonth / MONTHS_PER_YEAR).toFixed(1)}년 완공 예정` });
      return true;
    }
    return false;
  }

  maybeSchedulePrivate(month, metrics, host) {
    const pipeline = this.pipeline(month);
    const housingNeed = metrics.households * 1.10 - metrics.capacity.housing - pipeline.housing;
    const jobNeed = metrics.laborForce * 0.94 - metrics.capacity.jobs - pipeline.jobs;
    const housingStress = metrics.housingVacancy < 0.045 || housingNeed > 0;
    const jobStress = metrics.unemploymentRate < 0.045 || jobNeed > 0;
    if (!housingStress && !jobStress && !(metrics.landPressure > 0.72 && this.random() < 0.12)) return false;
    const serviceShare = clamp(0.22 + (host.serviceShare || 0.52) * 0.62, 0.28, 0.72);
    const archetypeId = housingNeed > Math.max(1.5, jobNeed * 0.60)
      ? chooseHousingArchetype(metrics.population, metrics.landPressure, this.random)
      : chooseEmploymentArchetype(metrics.population, serviceShare, this.random);
    const archetype = BUILDING_ARCHETYPES[archetypeId];
    const incomeYield = archetype.housing * metrics.rentIndex * 0.082 + archetype.jobs * metrics.productivity / 1_000_000 * 0.055;
    const interest = clamp(host.interestRate || 0.04, 0.005, 0.18);
    const riskPremium = 0.025 + metrics.landPressure * 0.018 + Math.max(0, host.inflation || 0) * 0.18;
    const expectedReturn = incomeYield / Math.max(0.1, archetype.cost);
    if (expectedReturn < interest + riskPremium && housingNeed <= 0 && jobNeed <= 0) return false;
    const building = this.scheduleBuilding(archetypeId, month, 'private', metrics.landPressure > 0.55);
    if (!building) return false;
    const action = building.replaces ? '재개발 착공' : '착공';
    if (building.cost >= 7 || building.replaces || metrics.population < 180) {
      this.events.push({ month, year: month / MONTHS_PER_YEAR, type: 'development', scope: 'settlement', title: `${archetype.label} ${action}`, detail: `${building.district} · ${building.floors}층 · 시장수요 반영` });
    }
    return true;
  }

  planDevelopment(month, metrics, host) {
    this.maybeOpenRoad(month, metrics);
    const slots = clamp(1 + Math.floor(metrics.population / 3200), 1, 5);
    let used = 0;
    if (this.maybeSchedulePublic(month, metrics)) used += 1;
    while (used < slots && this.maybeSchedulePrivate(month, metrics, host)) used += 1;
  }

  step(month, host = {}) {
    let metrics = this.measure(month - 1, host);
    const flows = this.stepDemography(month, metrics, host);
    this.updateFirms(metrics, host);
    metrics = this.measure(month, host);
    this.updatePublicAccounts(metrics, host);
    this.updateUtilitiesAndEnvironment(metrics, host);
    if (month % 6 === 0) this.planDevelopment(month, metrics, host);
    metrics = this.measure(month, host);
    metrics.flows = flows;
    this.state.lastMetrics = metrics;
    const stage = metrics.stage;
    if (stage.id !== this.state.previousStage) {
      this.events.push({ month, year: month / MONTHS_PER_YEAR, type: 'milestone', scope: 'settlement', title: `${stage.label} 단계 진입`, detail: `인구 ${Math.round(metrics.population).toLocaleString('ko-KR')}명` });
      this.state.previousStage = stage.id;
    }
    return metrics;
  }

  snapshot(month, host = {}) {
    const metrics = this.state.lastMetrics?.month === month ? this.state.lastMetrics : this.measure(month, host);
    return {
      month,
      year: month / MONTHS_PER_YEAR,
      stage: metrics.stage,
      population: Math.round(metrics.population),
      cohorts: { ...this.state.cohorts },
      households: Math.round(metrics.households),
      firms: Math.round(this.state.firms),
      laborForce: Math.round(metrics.laborForce),
      employed: Math.round(metrics.employed),
      unemploymentRate: metrics.unemploymentRate,
      housingUnits: Math.round(metrics.capacity.housing),
      housingVacancy: metrics.housingVacancy,
      jobsCapacity: Math.round(metrics.capacity.jobs),
      buildings: metrics.capacity.buildings,
      roads: metrics.openRoads,
      roadLengthKm: metrics.roadLengthKm,
      roadCondition: this.state.roadCondition,
      gdpM: metrics.gdpM,
      productivity: metrics.productivity,
      rentIndex: metrics.rentIndex,
      accessibility: metrics.accessibility,
      congestion: metrics.congestion,
      serviceCoverage: metrics.serviceCoverage,
      utilityReliability: metrics.utilityReliability,
      waterReliability: metrics.waterReliability,
      airQuality: metrics.airQuality,
      inequality: this.state.inequality,
      homelessnessRate: metrics.homelessnessRate,
      publicDebtM: this.state.governmentDebtM,
      publicCashM: this.state.governmentCashM,
      approval: metrics.approval,
      flows: { ...this.state.lastFlows },
      underConstruction: metrics.underConstruction,
      buildingRevision: this.buildingRevision,
    };
  }

  visibleState(month, snapshot) {
    const year = month / MONTHS_PER_YEAR;
    return {
      month,
      year,
      snapshot,
      roads: this.roads.filter((road) => road.openMonth <= month),
      buildings: this.buildings.filter((building) => building.constructionStartMonth <= month && building.removedMonth > month),
      completedBuildings: this.buildings.filter((building) => activeAt(building, month)),
      constructionSites: this.buildings.filter((building) => pipelineAt(building, month)),
      recentEvents: this.events.filter((event) => event.month <= month).slice(-5),
    };
  }
}

export { MONTHS_PER_YEAR, stageFor as settlementStageFor };
