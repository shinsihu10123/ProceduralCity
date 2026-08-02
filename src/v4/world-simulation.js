import { clamp, clamp01, createRandom, hashString } from '../v3/core.js';
import { SettlementSystem, MONTHS_PER_YEAR } from './settlement-system.js';

export const TRADED_GOODS = Object.freeze(['food', 'energy', 'materials', 'manufactures']);
export const ALL_GOODS = Object.freeze([...TRADED_GOODS, 'services']);

const GOOD_LABELS = Object.freeze({ food: '식량', energy: '에너지', materials: '원자재', manufactures: '제조품', services: '서비스' });
const COHORT_KEYS = Object.freeze(['children', 'youth', 'working', 'seniors']);

const sum = (values) => values.reduce((total, value) => total + value, 0);
const pairKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;

function cohortTotal(cohorts) {
  return COHORT_KEYS.reduce((total, key) => total + cohorts[key], 0);
}

function normalizeShares(shares) {
  const total = sum(Object.values(shares));
  return Object.fromEntries(Object.entries(shares).map(([key, value]) => [key, value / Math.max(0.0001, total)]));
}

function borderPairs(world) {
  const pairs = new Set();
  const size = world.size;
  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = z * size + x;
      const id = world.countryId[index];
      if (id < 0) continue;
      if (x + 1 < size) {
        const east = world.countryId[index + 1];
        if (east >= 0 && east !== id) pairs.add(pairKey(id, east));
      }
      if (z + 1 < size) {
        const south = world.countryId[index + size];
        if (south >= 0 && south !== id) pairs.add(pairKey(id, south));
      }
    }
  }
  return pairs;
}

function aggregateGeography(world) {
  const result = world.countries.map(() => ({
    cells: 0, suitability: 0, temperature: 0, precipitation: 0, river: 0, coast: 0,
    elevation: 0, uplift: 0, arid: 0, lowland: 0,
  }));
  for (let index = 0; index < world.countryId.length; index += 1) {
    const id = world.countryId[index];
    if (id < 0 || world.fields.elevation[index] <= 0) continue;
    const target = result[id];
    target.cells += 1;
    target.suitability += world.fields.suitability[index];
    target.temperature += world.fields.temperature[index];
    target.precipitation += world.fields.precipitation[index];
    target.river += world.fields.river[index];
    target.coast += world.fields.distanceToOcean[index] <= 2 ? 1 : 0;
    target.elevation += Math.max(0, world.fields.elevation[index]);
    target.uplift += world.fields.uplift[index];
    target.arid += world.fields.precipitation[index] < 380 ? 1 : 0;
    target.lowland += world.fields.elevation[index] < 100 ? 1 : 0;
  }
  return result.map((entry) => {
    const cells = Math.max(1, entry.cells);
    const suitability = entry.suitability / cells;
    const precipitation = entry.precipitation / cells;
    const coastShare = entry.coast / cells;
    const riverShare = entry.river / cells;
    const aridShare = entry.arid / cells;
    const lowlandShare = entry.lowland / cells;
    const elevation = entry.elevation / cells;
    const uplift = entry.uplift / cells;
    const arablePotential = clamp01(suitability * 0.62 + (1 - Math.abs(precipitation - 920) / 1500) * 0.25 + riverShare * 0.25);
    const renewablePotential = clamp01(coastShare * 0.34 + riverShare * 0.72 + aridShare * 0.28 + elevation / 4200 * 0.25 + 0.18);
    const mineralPotential = clamp01(uplift * 0.65 + elevation / 3200 * 0.34 + 0.18);
    const climateExposure = clamp01(coastShare * 0.34 + lowlandShare * 0.28 + aridShare * 0.30 + Math.abs(entry.temperature / cells - 16) / 42);
    return {
      ...entry,
      suitability,
      precipitation,
      coastShare,
      riverShare,
      aridShare,
      lowlandShare,
      elevation,
      uplift,
      arablePotential,
      renewablePotential,
      mineralPotential,
      climateExposure,
    };
  });
}

function governmentType(institution, openness, random) {
  if (institution > 0.73 && openness > 0.50) return random() < 0.55 ? '의회공화국' : '대통령공화국';
  if (institution > 0.58) return random() < 0.62 ? '혼합공화국' : '입헌연방';
  return random() < 0.52 ? '집권위원회' : '중앙집권국';
}

function createCountry(base, geography, random) {
  const development = clamp01((base.gdpPerCapita - 6500) / 43000);
  const childShare = clamp(0.30 - development * 0.115 + (random() - 0.5) * 0.025, 0.15, 0.31);
  const youthShare = clamp(0.15 + (random() - 0.5) * 0.018, 0.12, 0.18);
  const seniorShare = clamp(0.065 + development * 0.105 + (random() - 0.5) * 0.018, 0.05, 0.21);
  const workingShare = 1 - childShare - youthShare - seniorShare;
  const population = base.population;
  const laborForce = population * (youthShare * 0.45 + workingShare * 0.80 + seniorShare * 0.08);
  const unemployment = 0.032 + (1 - base.institution) * 0.045 + random() * 0.028;
  const employed = laborForce * (1 - unemployment);
  const gdpB = base.gdp / 1_000_000_000;
  // These are supply-use value shares rather than employment shares. Food,
  // energy and materials therefore include processing and distribution so
  // that the world balance can clear without manufacturing value appearing
  // out of nowhere.
  const agriculture = clamp(0.075 + geography.arablePotential * 0.085 - development * 0.022, 0.055, 0.17);
  const energy = clamp(0.060 + geography.renewablePotential * 0.045 + random() * 0.022, 0.055, 0.13);
  const materials = clamp(0.085 + geography.mineralPotential * 0.075 + random() * 0.022, 0.075, 0.18);
  const manufactures = clamp(0.215 + development * 0.045 + base.openness * 0.028 + random() * 0.028, 0.20, 0.32);
  const services = Math.max(0.30, 1 - agriculture - energy - materials - manufactures);
  const sectorShares = normalizeShares({ food: agriculture, energy, materials, manufactures, services });
  const govType = governmentType(base.institution, base.openness, random);
  const democratic = ['의회공화국', '대통령공화국', '혼합공화국', '입헌연방'].includes(govType);
  const technology = 0.68 + base.institution * 0.36 + development * 0.22;
  const infrastructure = clamp(0.40 + development * 0.34 + base.institution * 0.18 + random() * 0.08, 0.35, 0.94);
  const carryingCapacity = Math.max(population * 1.08, base.areaKm2 * (24 + geography.arablePotential * 58 + geography.coastShare * 16) * (0.82 + technology * 0.28));
  const electionInterval = democratic ? Math.round(48 + random() * 24) : Math.round(108 + random() * 96);
  const country = {
    id: base.id,
    name: base.name,
    color: [...base.color],
    capital: { ...base.capital },
    areaKm2: base.areaKm2,
    geography,
    population,
    cohorts: {
      children: population * childShare,
      youth: population * youthShare,
      working: population * workingShare,
      seniors: population * seniorShare,
    },
    carryingCapacity,
    fertilityRate: clamp(0.022 - development * 0.011 + (random() - 0.5) * 0.0025, 0.008, 0.024),
    laborForce,
    employed,
    unemploymentRate: unemployment,
    baseEmployment: employed,
    gdpB,
    previousGdpB: gdpB,
    baselineGdpB: gdpB,
    gdpPerCapita: base.gdpPerCapita,
    realGrowth: 0,
    capitalB: gdpB * (2.25 + development * 1.15),
    baseCapitalB: gdpB * (2.25 + development * 1.15),
    technology,
    baseTechnology: technology,
    humanCapital: clamp(0.46 + development * 0.40 + base.institution * 0.12, 0.42, 0.95),
    infrastructure,
    baseInfrastructure: infrastructure,
    institution: base.institution,
    openness: base.openness,
    sectorShares,
    prices: Object.fromEntries(ALL_GOODS.map((good) => [good, 1])),
    priceLevel: 1,
    currencyRebases: 0,
    inventory: Object.fromEntries(ALL_GOODS.map((good) => [good, 0])),
    output: Object.fromEntries(ALL_GOODS.map((good) => [good, 0])),
    demand: Object.fromEntries(ALL_GOODS.map((good) => [good, 0])),
    consumption: Object.fromEntries(ALL_GOODS.map((good) => [good, 0])),
    inflation: 0.02,
    exportsB: 0,
    importsB: 0,
    tradeBalanceB: 0,
    tradeAccess: base.openness,
    governmentType: govType,
    governmentCashB: gdpB * (0.045 + random() * 0.035),
    governmentDebtB: gdpB * (0.22 + random() * 0.43),
    taxRate: 0.19 + base.institution * 0.11 + random() * 0.035,
    socialSpendingShare: 0.11 + development * 0.055,
    publicInvestmentShare: 0.035 + (1 - infrastructure) * 0.030,
    defenseShare: 0.020 + random() * 0.030,
    adaptationShare: 0.008 + geography.climateExposure * 0.017,
    interestRate: 0.035,
    legitimacy: clamp(0.48 + base.institution * 0.31 + random() * 0.12, 0.40, 0.88),
    publicServices: clamp(0.42 + development * 0.34 + base.institution * 0.18, 0.38, 0.94),
    inequality: clamp(0.28 + (1 - base.institution) * 0.18 + random() * 0.07, 0.24, 0.55),
    regimeAgeMonths: Math.round(random() * 180),
    nextElectionMonth: electionInterval,
    electionInterval,
    renewableShare: clamp(0.10 + geography.renewablePotential * 0.32 + development * 0.12, 0.10, 0.62),
    energyIntensity: clamp(1.14 - development * 0.34 + random() * 0.10, 0.70, 1.24),
    fossilReserves: gdpB * (0.55 + geography.mineralPotential * 2.8 + random()),
    mineralReserves: gdpB * (0.45 + geography.mineralPotential * 3.2 + random()),
    foodSecurity: 0.86,
    energySecurity: 0.84,
    materialSecurity: 0.82,
    emissionsGt: 0,
    climateHazard: 0,
    healthShock: 0,
    disasterDeaths: 0,
    conflictIntensity: 0,
    migrationIn: 0,
    migrationOut: 0,
    netMigrationRate: 0,
    lastPopulationFlows: { births: 0, deaths: 0, immigration: 0, emigration: 0, netChange: 0 },
  };
  return country;
}

function createRelations(countries, world, borders, random) {
  const relations = [];
  for (let a = 0; a < countries.length; a += 1) {
    for (let b = a + 1; b < countries.length; b += 1) {
      const left = countries[a];
      const right = countries[b];
      const distanceCells = Math.hypot(left.capital.x - right.capital.x, left.capital.z - right.capital.z);
      const distanceKm = distanceCells * world.cellKm;
      const border = borders.has(pairKey(a, b));
      const institutionalAffinity = 1 - Math.abs(left.institution - right.institution);
      const tradeAffinity = (left.openness + right.openness) * 0.5;
      const trust = clamp(0.30 + institutionalAffinity * 0.24 + tradeAffinity * 0.18 + (random() - 0.5) * 0.20, 0.16, 0.82);
      const resourceRivalry = Math.abs(left.geography.mineralPotential - right.geography.mineralPotential) * 0.20
        + (left.geography.aridShare + right.geography.aridShare) * 0.08;
      const tension = clamp(0.18 + (border ? 0.16 : 0) + resourceRivalry + (random() - 0.5) * 0.22 - trust * 0.10, 0.06, 0.78);
      let treaty = 'none';
      if (trust > 0.67 && tension < 0.34 && random() < 0.38) treaty = 'trade';
      if (trust > 0.76 && tension < 0.25 && random() < 0.12) treaty = 'alliance';
      relations.push({
        id: pairKey(a, b), a, b, distanceKm, border, trust, tension, tariff: clamp(0.035 + (1 - tradeAffinity) * 0.14 + random() * 0.05, 0.02, 0.24),
        treaty, sanctions: 0, conflictIntensity: 0, conflictMonths: 0, tradeB: 0, aToB: 0, bToA: 0,
        migrationAToB: 0, migrationBToA: 0, goods: {}, directionalGoods: {}, status: treaty === 'alliance' ? 'alliance' : treaty === 'trade' ? 'trade' : 'neutral',
      });
    }
  }
  return relations;
}

function relationStatus(relation) {
  if (relation.conflictIntensity > 0.05) return 'conflict';
  if (relation.sanctions > 0.18) return 'sanctions';
  if (relation.treaty === 'alliance') return 'alliance';
  if (relation.treaty === 'trade') return 'trade';
  if (relation.tension > 0.68) return 'tense';
  return 'neutral';
}

function event(month, type, title, detail, extra = {}) {
  return { month, year: month / MONTHS_PER_YEAR, type, scope: 'world', title, detail, ...extra };
}

export class ContinuousWorldSimulation {
  constructor({ seed = 'new-horizon', macroWorld, spatial } = {}) {
    if (!macroWorld || !spatial) throw new Error('ContinuousWorldSimulation requires macroWorld and spatial');
    this.version = '4.0.0-continuous-world';
    this.seed = String(seed);
    this.macroWorld = macroWorld;
    this.spatial = spatial;
    this.random = createRandom(hashString(`${this.seed}:v4-world-engine`));
    this.month = 0;
    this.events = [];
    this.world = {
      month: 0,
      atmosphericCarbonIndex: 1,
      temperatureAnomalyC: 0.72,
      seaLevelIndex: 0,
      frontierTechnology: 1.28,
      policyRate: 0.028,
      globalPrices: Object.fromEntries(ALL_GOODS.map((good) => [good, 1])),
      emissionsGt: 0,
      totalPopulation: 0,
      totalGdpB: 0,
      tradeB: 0,
      conflictCount: 0,
    };
    const geography = aggregateGeography(macroWorld);
    this.countries = macroWorld.countries.map((country, index) => createCountry(country, geography[index], this.random));
    this.relations = createRelations(this.countries, macroWorld, borderPairs(macroWorld), this.random);
    this.relationByKey = new Map(this.relations.map((relation) => [relation.id, relation]));
    this.tradeFlows = [];
    this.migrationFlows = [];
    this.settlement = new SettlementSystem({ seed: this.seed, spatial, hostCountryId: macroWorld.settlement.countryId });
    this.roads = this.settlement.roads;
    this.buildings = this.settlement.buildings;
    this.annualSnapshots = [];
    this.recentSnapshots = new Map();
    this.initializeBalances();
    this.recordSnapshot(this.createSnapshot());
    this.events.push(event(0, 'world', '세계 장부 개시', `${this.countries.length}개국이 서로 다른 자원·제도·인구구조로 출발`));
  }

  get years() {
    return this.month / MONTHS_PER_YEAR;
  }

  get buildingRevision() {
    return this.settlement.buildingRevision;
  }

  initializeBalances() {
    for (const country of this.countries) this.produce(country, true);
    this.solveTrade();
    this.settleGoodsAndPrices(true);
    this.updateWorldTotals();
    const host = this.hostInfluence();
    this.settlement.state.lastMetrics = this.settlement.measure(0, host);
  }

  triggerClimateHazards() {
    const warmingRisk = clamp01((this.world.temperatureAnomalyC - 0.65) / 2.8);
    for (const country of this.countries) {
      country.climateHazard *= 0.86;
      country.healthShock *= 0.80;
      country.disasterDeaths = 0;
      const probability = 0.0011 + country.geography.climateExposure * (0.0018 + warmingRisk * 0.0065);
      if (this.random() >= probability) continue;
      const exposure = country.geography.climateExposure;
      const severity = clamp(0.12 + this.random() * 0.48 + warmingRisk * 0.28, 0.08, 0.88);
      const types = [
        { name: '홍수', weight: country.geography.lowlandShare + country.geography.riverShare * 1.8 },
        { name: '가뭄', weight: country.geography.aridShare * 1.6 + 0.12 },
        { name: '폭염', weight: warmingRisk + Math.max(0, country.geography.temperature - 18) / 25 + 0.08 },
        { name: '폭풍', weight: country.geography.coastShare * 1.7 + 0.09 },
      ];
      const totalWeight = sum(types.map((item) => Math.max(0.01, item.weight)));
      let cursor = this.random() * totalWeight;
      let selected = types[0];
      for (const item of types) {
        cursor -= Math.max(0.01, item.weight);
        if (cursor <= 0) { selected = item; break; }
      }
      country.climateHazard = Math.max(country.climateHazard, severity);
      country.healthShock = Math.max(country.healthShock, severity * 0.08);
      const damageB = country.capitalB * severity * exposure * 0.0018;
      country.capitalB = Math.max(country.baseCapitalB * 0.35, country.capitalB - damageB);
      country.disasterDeaths = country.population * severity * exposure * 0.000008;
      this.events.push(event(this.month, 'climate', `${country.name} ${selected.name}`, `자본 피해 ${damageB.toFixed(1)}B · 위험도 ${Math.round(severity * 100)}%`, { countryId: country.id }));
    }
  }

  produce(country, initialize = false) {
    const population = cohortTotal(country.cohorts);
    country.population = population;
    country.laborForce = country.cohorts.youth * 0.45 + country.cohorts.working * 0.80 + country.cohorts.seniors * 0.08;
    const capitalCapacity = country.baseEmployment * Math.pow(Math.max(0.25, country.capitalB / country.baseCapitalB), 0.66)
      * Math.pow(Math.max(0.35, country.infrastructure / country.baseInfrastructure), 0.24);
    const demandCycle = clamp(0.92 + country.tradeBalanceB / Math.max(1, country.gdpB) * 0.8
      - Math.max(0, country.inflation - 0.04) * 0.6 - country.conflictIntensity * 0.34 + (this.random() - 0.5) * 0.018, 0.60, 1.10);
    const targetEmployment = Math.min(country.laborForce * 0.988, capitalCapacity * demandCycle);
    country.employed = initialize ? country.employed : country.employed * 0.72 + targetEmployment * 0.28;
    country.unemploymentRate = clamp01(1 - country.employed / Math.max(1, country.laborForce));
    const capitalPerWorker = country.capitalB / Math.max(0.001, country.employed / 1_000_000);
    const baseCapitalPerWorker = country.baseCapitalB / Math.max(0.001, country.baseEmployment / 1_000_000);
    const productivityFactor = Math.pow(country.technology / country.baseTechnology, 0.62)
      * Math.pow(Math.max(0.32, capitalPerWorker / baseCapitalPerWorker), 0.27)
      * (0.78 + country.humanCapital * 0.22)
      * (0.76 + country.infrastructure * 0.24);
    const resourceStress = Math.max(0, 1 - country.foodSecurity) * 0.10 + Math.max(0, 1 - country.energySecurity) * 0.16;
    const climateLoss = country.climateHazard * country.geography.climateExposure * (1 - country.adaptationShare * 6) * 0.16;
    const conflictLoss = country.conflictIntensity * 0.32;
    const outputFactor = clamp(productivityFactor * (1 - resourceStress - climateLoss - conflictLoss), 0.28, 3.8);
    const gdpPerWorkerBase = country.baselineGdpB * 1_000_000_000 / Math.max(1, country.baseEmployment);
    const nextGdpB = country.employed * gdpPerWorkerBase * outputFactor / 1_000_000_000;
    country.previousGdpB = country.gdpB;
    country.gdpB = initialize ? country.gdpB : country.gdpB * 0.55 + nextGdpB * 0.45;
    country.realGrowth = initialize ? 0 : clamp((country.gdpB / Math.max(0.001, country.previousGdpB) - 1) * MONTHS_PER_YEAR, -0.24, 0.28);
    country.gdpPerCapita = country.gdpB * 1_000_000_000 / Math.max(1, population);

    const modifiers = {
      food: 0.74 + country.geography.arablePotential * 0.62 - country.climateHazard * 0.28,
      energy: 0.72 + country.geography.renewablePotential * 0.34 + Math.min(0.32, country.fossilReserves / Math.max(1, country.gdpB) * 0.04),
      materials: 0.72 + country.geography.mineralPotential * 0.54 + Math.min(0.25, country.mineralReserves / Math.max(1, country.gdpB) * 0.035),
      manufactures: 0.72 + country.infrastructure * 0.25 + country.humanCapital * 0.18,
      services: 0.78 + country.humanCapital * 0.24 + country.institution * 0.14,
    };
    const weightedShares = normalizeShares(Object.fromEntries(ALL_GOODS.map((good) => [
      good,
      country.sectorShares[good] * Math.max(0.20, modifiers[good]) * Math.pow(clamp(country.prices[good], 0.45, 4), 0.34),
    ])));
    const monthlyGdp = country.gdpB / MONTHS_PER_YEAR;
    for (const good of ALL_GOODS) country.output[good] = monthlyGdp * weightedShares[good];

    const poorAdjustment = clamp(33000 / Math.max(9000, country.gdpPerCapita), 0.62, 1.55);
    const desiredDemandShares = {
      food: 0.13 * poorAdjustment,
      energy: 0.10 * country.energyIntensity,
      materials: 0.12 + country.publicInvestmentShare * 0.8,
      manufactures: 0.24 + (1 - poorAdjustment) * 0.025,
      services: 0.41 + country.socialSpendingShare * 0.20,
    };
    const demandShares = normalizeShares(Object.fromEntries(ALL_GOODS.map((good) => [
      good,
      desiredDemandShares[good] * Math.pow(clamp(country.prices[good], 0.45, 4), -0.26),
    ])));
    for (const good of ALL_GOODS) country.demand[good] = monthlyGdp * demandShares[good];
    if (initialize) for (const good of ALL_GOODS) country.inventory[good] = country.output[good] * (good === 'food' || good === 'energy' ? 1.9 : 1.1);
  }

  bilateralTradeWeight(exporter, importer, relation) {
    const distance = Math.exp(-relation.distanceKm / 1850);
    const diplomacy = (0.28 + relation.trust * 0.90) * (1 - relation.tension * 0.28);
    const policy = Math.pow(1 - clamp(relation.tariff, 0, 0.8), 3.8) * (1 - relation.sanctions * 0.88);
    const security = 1 - relation.conflictIntensity * 0.985;
    const openness = 0.25 + (exporter.openness + importer.openness) * 0.48;
    const treaty = relation.treaty === 'alliance' ? 1.34 : relation.treaty === 'trade' ? 1.20 : 1;
    return Math.max(0.00001, distance * diplomacy * policy * security * openness * treaty);
  }

  solveTrade() {
    for (const country of this.countries) {
      country.exportsB = 0;
      country.importsB = 0;
    }
    for (const relation of this.relations) {
      relation.tradeB = 0;
      relation.aToB = 0;
      relation.bToA = 0;
      relation.goods = {};
      relation.directionalGoods = {};
    }
    for (const good of TRADED_GOODS) {
      const exportRemaining = this.countries.map((country) => Math.max(0, country.output[good] - country.demand[good] * 0.72)
        + country.output[good] * country.openness * 0.11 + country.inventory[good] * 0.025);
      const importRemaining = this.countries.map((country) => Math.max(0, country.demand[good] - country.output[good] - country.inventory[good] * 0.035)
        + country.demand[good] * country.openness * 0.085);
      for (let round = 0; round < 4; round += 1) {
        for (let importerId = 0; importerId < this.countries.length; importerId += 1) {
          const needed = importRemaining[importerId];
          if (needed <= 0.000001) continue;
          const importer = this.countries[importerId];
          const candidates = [];
          let weightTotal = 0;
          for (let exporterId = 0; exporterId < this.countries.length; exporterId += 1) {
            if (exporterId === importerId || exportRemaining[exporterId] <= 0.000001) continue;
            const relation = this.relationByKey.get(pairKey(exporterId, importerId));
            const weight = exportRemaining[exporterId] * this.bilateralTradeWeight(this.countries[exporterId], importer, relation);
            if (weight <= 0) continue;
            candidates.push({ exporterId, relation, weight });
            weightTotal += weight;
          }
          if (weightTotal <= 0) continue;
          for (const candidate of candidates) {
            const allocation = Math.min(exportRemaining[candidate.exporterId], needed * candidate.weight / weightTotal);
            if (allocation <= 0) continue;
            exportRemaining[candidate.exporterId] -= allocation;
            importRemaining[importerId] -= allocation;
            const exporter = this.countries[candidate.exporterId];
            exporter.exportsB += allocation;
            importer.importsB += allocation;
            const relation = candidate.relation;
            relation.tradeB += allocation;
            relation.goods[good] = (relation.goods[good] || 0) + allocation;
            if (!relation.directionalGoods[good]) relation.directionalGoods[good] = { aToB: 0, bToA: 0 };
            if (candidate.exporterId === relation.a) {
              relation.aToB += allocation;
              relation.directionalGoods[good].aToB += allocation;
            } else {
              relation.bToA += allocation;
              relation.directionalGoods[good].bToA += allocation;
            }
          }
        }
      }
    }
    for (const country of this.countries) country.tradeBalanceB = country.exportsB - country.importsB;
    this.tradeFlows = this.relations.filter((relation) => relation.tradeB > 0.00001).map((relation) => ({
      a: relation.a, b: relation.b, valueB: relation.tradeB, aToB: relation.aToB, bToA: relation.bToA, goods: { ...relation.goods },
    }));
  }

  settleGoodsAndPrices(initialize = false) {
    const imports = this.countries.map(() => Object.fromEntries(TRADED_GOODS.map((good) => [good, 0])));
    const exports = this.countries.map(() => Object.fromEntries(TRADED_GOODS.map((good) => [good, 0])));
    for (const relation of this.relations) {
      for (const good of TRADED_GOODS) {
        const direction = relation.directionalGoods[good];
        if (!direction) continue;
        const aToB = direction.aToB;
        const bToA = direction.bToA;
        exports[relation.a][good] += aToB;
        imports[relation.b][good] += aToB;
        exports[relation.b][good] += bToA;
        imports[relation.a][good] += bToA;
      }
    }
    for (const country of this.countries) {
      let weightedInflation = 0;
      for (const good of ALL_GOODS) {
        const imported = imports[country.id][good] || 0;
        const exported = exports[country.id][good] || 0;
        const available = country.output[good] + imported + country.inventory[good] - exported;
        const consumed = Math.min(country.demand[good], Math.max(0, available));
        const shortage = clamp01((country.demand[good] - consumed) / Math.max(0.0001, country.demand[good]));
        country.consumption[good] = consumed;
        country.inventory[good] = clamp(available - consumed, 0, country.output[good] * (good === 'food' || good === 'energy' ? 5.5 : 3.5));
        const inventoryTarget = country.output[good] * (good === 'food' || good === 'energy' ? 1.6 : 0.9);
        const inventoryGap = clamp((inventoryTarget - country.inventory[good]) / Math.max(0.0001, inventoryTarget), -1, 1);
        const priceChange = initialize ? 0 : clamp(shortage * 0.028 + inventoryGap * 0.0035 + (this.world.globalPrices[good] - country.prices[good]) * 0.009, -0.014, 0.040);
        country.prices[good] = clamp(country.prices[good] * (1 + priceChange), 0.45, 4.0);
        weightedInflation += priceChange * ({ food: 0.22, energy: 0.12, materials: 0.09, manufactures: 0.25, services: 0.32 }[good]);
        if (good === 'food') country.foodSecurity = clamp01(1 - shortage * 0.85 + Math.min(0.20, country.inventory[good] / Math.max(0.001, inventoryTarget) * 0.12));
        if (good === 'energy') country.energySecurity = clamp01(1 - shortage * 0.92 + country.renewableShare * 0.12);
        if (good === 'materials') country.materialSecurity = clamp01(1 - shortage * 0.90 + country.geography.mineralPotential * 0.09);
      }
      const relativeCpiChange = clamp(weightedInflation, -0.012, 0.030);
      const nominalCpiChange = clamp(relativeCpiChange + 0.0017, -0.010, 0.032);
      country.priceLevel *= 1 + nominalCpiChange;
      if (country.priceLevel > 10_000) {
        country.priceLevel /= 1000;
        country.currencyRebases += 1;
      } else if (country.priceLevel < 0.01) {
        country.priceLevel *= 100;
        country.currencyRebases -= 1;
      }
      for (const good of ALL_GOODS) country.prices[good] = clamp(country.prices[good] / (1 + relativeCpiChange), 0.28, 3.4);
      country.inflation = initialize ? 0.02 : clamp(country.inflation * 0.82 + nominalCpiChange * MONTHS_PER_YEAR * 0.18, -0.03, 0.34);
      country.tradeAccess = clamp01(country.openness * 0.58 + country.exportsB / Math.max(0.001, country.gdpB / MONTHS_PER_YEAR) * 0.42);
    }
    for (const good of ALL_GOODS) {
      const weighted = sum(this.countries.map((country) => country.prices[good] * country.demand[good]));
      const demand = sum(this.countries.map((country) => country.demand[good]));
      this.world.globalPrices[good] = weighted / Math.max(0.0001, demand);
    }
  }

  updateRelations() {
    for (const relation of this.relations) {
      const left = this.countries[relation.a];
      const right = this.countries[relation.b];
      const tradeInterdependence = relation.tradeB / Math.max(0.01, (left.gdpB + right.gdpB) / MONTHS_PER_YEAR);
      const powerRatio = Math.abs(Math.log(Math.max(0.01, left.gdpB) / Math.max(0.01, right.gdpB)));
      const resourceRivalry = relation.border * (left.geography.aridShare + right.geography.aridShare) * (1 - (left.foodSecurity + right.foodSecurity) * 0.5);
      relation.trust = clamp(relation.trust + tradeInterdependence * 0.006 + (relation.treaty !== 'none' ? 0.0007 : 0)
        - relation.tension * 0.00045 - relation.sanctions * 0.0012 + (this.random() - 0.5) * 0.0018, 0.02, 0.98);
      relation.tension = clamp(relation.tension + resourceRivalry * 0.0025 + powerRatio * (relation.border ? 0.00012 : 0.00003)
        - tradeInterdependence * 0.0035 - relation.trust * 0.00035 + (this.random() - 0.5) * 0.0022, 0.01, 0.99);
      relation.sanctions = Math.max(0, relation.sanctions - 0.0022);

      if (relation.border && relation.conflictIntensity === 0 && this.random() < 0.00072) {
        const shock = 0.17 + this.random() * 0.27;
        relation.tension = clamp(relation.tension + shock, 0, 0.99);
        relation.trust = clamp(relation.trust - shock * 0.30, 0, 1);
        this.events.push(event(this.month, 'crisis', `${left.name}–${right.name} 국경위기`, '영유권·수자원 갈등으로 외교 긴장 급등', { countries: [left.id, right.id] }));
      }

      if (relation.conflictIntensity > 0) {
        relation.conflictMonths += 1;
        relation.conflictIntensity = clamp(relation.conflictIntensity + (this.random() - 0.47) * 0.018, 0.10, 0.92);
        relation.tension = clamp(relation.tension + 0.002, 0, 1);
        relation.trust = clamp(relation.trust - 0.0035, 0, 1);
        const peaceChance = relation.conflictMonths > 10 ? 0.004 + relation.conflictMonths * 0.00032 + (1 - relation.conflictIntensity) * 0.006 : 0;
        if (this.random() < peaceChance) {
          relation.conflictIntensity = 0;
          relation.conflictMonths = 0;
          relation.tension = clamp(relation.tension * 0.68, 0.18, 0.72);
          relation.sanctions = Math.max(relation.sanctions, 0.18);
          this.events.push(event(this.month, 'peace', `${left.name}–${right.name} 휴전`, '피로·재정압박과 중재로 무력충돌 종료', { countries: [left.id, right.id] }));
        }
      } else {
        if (relation.trust > 0.72 && relation.tension < 0.30 && relation.treaty === 'none' && this.random() < 0.0022) {
          relation.treaty = 'trade';
          relation.tariff = Math.max(0.015, relation.tariff * 0.62);
          this.events.push(event(this.month, 'treaty', `${left.name}–${right.name} 통상협정`, '관세 인하와 시장접근 확대', { countries: [left.id, right.id] }));
        } else if (relation.trust > 0.82 && relation.tension < 0.23 && relation.treaty === 'trade' && this.random() < 0.0008) {
          relation.treaty = 'alliance';
          this.events.push(event(this.month, 'alliance', `${left.name}–${right.name} 동맹`, '안보·재난대응 상호지원 합의', { countries: [left.id, right.id] }));
        }
        if (relation.tension > 0.75 && this.random() < 0.0025) {
          relation.sanctions = clamp(relation.sanctions + 0.18 + this.random() * 0.24, 0, 0.88);
          relation.tariff = clamp(relation.tariff + 0.035, 0, 0.48);
          this.events.push(event(this.month, 'sanction', `${left.name}–${right.name} 제재`, '긴장 고조로 금융·상품 교역 제한', { countries: [left.id, right.id] }));
        }
        const conflictChance = relation.border && relation.tension > 0.79
          ? 0.0018 + (relation.tension - 0.79) * 0.035 + resourceRivalry * 0.008
          : 0;
        if (this.random() < conflictChance) {
          relation.conflictIntensity = 0.22 + this.random() * 0.24;
          relation.conflictMonths = 1;
          relation.treaty = 'none';
          relation.sanctions = Math.max(relation.sanctions, 0.48);
          this.events.push(event(this.month, 'conflict', `${left.name}–${right.name} 무력충돌`, '국경 긴장과 자원압박이 임계점을 넘음', { countries: [left.id, right.id] }));
        }
      }
      relation.status = relationStatus(relation);
    }
    for (const country of this.countries) {
      country.conflictIntensity = Math.max(0, ...this.relations.filter((relation) => relation.a === country.id || relation.b === country.id).map((relation) => relation.conflictIntensity));
    }
  }

  solveMigration() {
    for (const country of this.countries) {
      country.migrationIn = 0;
      country.migrationOut = 0;
    }
    this.migrationFlows = [];
    for (const relation of this.relations) {
      const left = this.countries[relation.a];
      const right = this.countries[relation.b];
      const leftScore = Math.log(Math.max(1000, left.gdpPerCapita)) + left.publicServices * 0.72 - left.unemploymentRate * 1.7
        - left.conflictIntensity * 1.8 - left.climateHazard * 0.34;
      const rightScore = Math.log(Math.max(1000, right.gdpPerCapita)) + right.publicServices * 0.72 - right.unemploymentRate * 1.7
        - right.conflictIntensity * 1.8 - right.climateHazard * 0.34;
      const mobility = (0.20 + (left.openness + right.openness) * 0.40) * (0.25 + relation.trust * 0.75)
        * (1 - relation.sanctions * 0.68) * (relation.treaty === 'alliance' ? 1.35 : relation.treaty === 'trade' ? 1.18 : 1);
      const base = Math.min(left.population, right.population) * 0.00000115 * mobility;
      const net = Math.tanh((rightScore - leftScore) * 0.85) * base * 1.6;
      const conflictLeft = left.conflictIntensity * left.population * 0.0000045;
      const conflictRight = right.conflictIntensity * right.population * 0.0000045;
      const aToB = Math.max(0, base + Math.max(0, net) + conflictLeft - conflictRight * 0.25);
      const bToA = Math.max(0, base + Math.max(0, -net) + conflictRight - conflictLeft * 0.25);
      relation.migrationAToB = aToB;
      relation.migrationBToA = bToA;
      left.migrationOut += aToB;
      right.migrationIn += aToB;
      right.migrationOut += bToA;
      left.migrationIn += bToA;
      this.migrationFlows.push({ a: relation.a, b: relation.b, aToB, bToA, total: aToB + bToA });
    }
    for (const country of this.countries) country.netMigrationRate = (country.migrationIn - country.migrationOut) / Math.max(1, country.population);
  }

  updateDemography(country) {
    const cohorts = country.cohorts;
    const population = cohortTotal(cohorts);
    const capacityStress = clamp01((population - country.carryingCapacity) / Math.max(1, country.carryingCapacity * 0.35));
    const fertility = clamp(country.fertilityRate * (0.78 + country.foodSecurity * 0.22) * (1 - capacityStress * 0.28)
      * (1 - Math.max(0, country.inflation - 0.06) * 0.5), 0.004, 0.028);
    const births = population * fertility / MONTHS_PER_YEAR;
    const health = clamp01(country.publicServices * 0.55 + country.foodSecurity * 0.24 + country.energySecurity * 0.12 - country.healthShock);
    const childDeaths = cohorts.children * (0.0015 + (1 - health) * 0.006 + country.conflictIntensity * 0.0015) / MONTHS_PER_YEAR;
    const youthDeaths = cohorts.youth * (0.0009 + (1 - health) * 0.0025 + country.conflictIntensity * 0.0020) / MONTHS_PER_YEAR;
    const workingDeaths = cohorts.working * (0.0029 + (1 - health) * 0.0045 + country.conflictIntensity * 0.0028) / MONTHS_PER_YEAR;
    const seniorDeaths = cohorts.seniors * (0.041 + (1 - health) * 0.032) / MONTHS_PER_YEAR;
    const deaths = childDeaths + youthDeaths + workingDeaths + seniorDeaths + country.disasterDeaths;
    const ageChild = cohorts.children / (15 * MONTHS_PER_YEAR);
    const ageYouth = cohorts.youth / (10 * MONTHS_PER_YEAR);
    const ageWorking = cohorts.working / (40 * MONTHS_PER_YEAR);
    const netMigration = country.migrationIn - country.migrationOut;
    cohorts.children = Math.max(0, cohorts.children + births - childDeaths - ageChild + netMigration * 0.15);
    cohorts.youth = Math.max(0, cohorts.youth + ageChild - youthDeaths - ageYouth + netMigration * 0.22);
    cohorts.working = Math.max(0, cohorts.working + ageYouth - workingDeaths - ageWorking + netMigration * 0.59);
    cohorts.seniors = Math.max(0, cohorts.seniors + ageWorking - seniorDeaths - country.disasterDeaths + netMigration * 0.04);
    country.population = cohortTotal(cohorts);
    country.lastPopulationFlows = { births, deaths, immigration: country.migrationIn, emigration: country.migrationOut, netChange: births - deaths + netMigration };
  }

  updateGovernmentAndCapital(country) {
    const monthlyGdp = country.gdpB / MONTHS_PER_YEAR;
    const revenue = monthlyGdp * country.taxRate;
    const social = monthlyGdp * country.socialSpendingShare;
    const publicInvestment = monthlyGdp * country.publicInvestmentShare;
    const defense = monthlyGdp * country.defenseShare * (1 + country.conflictIntensity * 2.8);
    const adaptation = monthlyGdp * country.adaptationShare;
    const debtRatio = country.governmentDebtB / Math.max(0.01, country.gdpB);
    country.interestRate = clamp(this.world.policyRate + country.inflation * 0.28 + Math.max(0, debtRatio - 0.55) * 0.065
      + country.conflictIntensity * 0.035 + (1 - country.institution) * 0.012, 0.004, 0.24);
    const interest = country.governmentDebtB * country.interestRate / MONTHS_PER_YEAR;
    const expenditure = social + publicInvestment + defense + adaptation + interest;
    country.governmentCashB += revenue - expenditure;
    if (country.governmentCashB < 0) {
      country.governmentDebtB += -country.governmentCashB;
      country.governmentCashB = 0;
    }
    const reserveTarget = monthlyGdp * 0.55;
    if (country.governmentCashB > reserveTarget) {
      const repayment = Math.min((country.governmentCashB - reserveTarget) * 0.28, country.governmentDebtB * 0.012);
      country.governmentCashB -= repayment;
      country.governmentDebtB -= repayment;
    }
    if (debtRatio > 1.15) {
      country.taxRate = clamp(country.taxRate + 0.00035, 0.12, 0.42);
      country.publicInvestmentShare = clamp(country.publicInvestmentShare - 0.00018, 0.012, 0.10);
      country.legitimacy = clamp01(country.legitimacy - 0.0012);
    }

    const privateInvestment = monthlyGdp * clamp(0.17 + country.legitimacy * 0.07 - country.interestRate * 0.42
      - country.conflictIntensity * 0.11, 0.055, 0.25);
    const depreciation = country.capitalB * (0.038 + country.climateHazard * 0.010) / MONTHS_PER_YEAR;
    country.capitalB = Math.max(country.baseCapitalB * 0.32, country.capitalB + privateInvestment + publicInvestment * 0.62 - depreciation);
    const infrastructureGain = publicInvestment / Math.max(0.1, country.gdpB) * country.institution * 0.035;
    country.infrastructure = clamp(country.infrastructure + infrastructureGain - 0.00022 - country.climateHazard * 0.00035, 0.22, 0.99);
    country.publicServices = clamp(country.publicServices + social / Math.max(0.1, country.gdpB) * country.institution * 0.028
      - 0.00018 - country.conflictIntensity * 0.0008, 0.22, 0.99);
    const researchShare = clamp(0.012 + country.humanCapital * 0.018 + country.institution * 0.010, 0.012, 0.042);
    const catchup = Math.max(0, this.world.frontierTechnology - country.technology) * country.institution * 0.00072;
    country.technology = clamp(country.technology + country.technology * researchShare * country.institution * 0.0015 + catchup, 0.38, 8.0);
    country.humanCapital = clamp(country.humanCapital + social / Math.max(0.1, country.gdpB) * 0.004 - 0.00005, 0.30, 0.99);
    const renewableInvestment = country.prices.energy > 1.08 ? 0.00065 : 0.00028;
    country.renewableShare = clamp(country.renewableShare + renewableInvestment * country.geography.renewablePotential * country.institution
      - 0.00005, 0.06, 0.96);
    country.energyIntensity = clamp(country.energyIntensity - country.technology * 0.000055 + (this.random() - 0.5) * 0.00008, 0.38, 1.45);
    country.fossilReserves = Math.max(0, country.fossilReserves - country.output.energy * (1 - country.renewableShare) * 0.13);
    country.mineralReserves = Math.max(0, country.mineralReserves - country.output.materials * 0.10);

    const welfare = (1 - country.unemploymentRate) * 0.22 + country.publicServices * 0.23 + country.foodSecurity * 0.12
      + country.energySecurity * 0.08 - Math.max(0, country.inflation - 0.025) * 0.55 - country.inequality * 0.10
      - country.conflictIntensity * 0.22;
    country.legitimacy = clamp(country.legitimacy * 0.988 + clamp01(welfare) * 0.012 + (this.random() - 0.5) * 0.003, 0.08, 0.96);
    country.inequality = clamp(country.inequality + country.unemploymentRate * 0.00038 - country.socialSpendingShare * 0.00085
      + country.realGrowth * -0.0005, 0.20, 0.68);
    country.regimeAgeMonths += 1;
    this.updatePolitics(country);
  }

  updatePolitics(country) {
    if (this.month >= country.nextElectionMonth) {
      const democratic = ['의회공화국', '대통령공화국', '혼합공화국', '입헌연방'].includes(country.governmentType);
      const reform = (this.random() - 0.5) * 0.022;
      country.taxRate = clamp(country.taxRate + reform, 0.15, 0.39);
      country.socialSpendingShare = clamp(country.socialSpendingShare + (this.random() - 0.5) * 0.018, 0.07, 0.23);
      country.publicInvestmentShare = clamp(country.publicInvestmentShare + (this.random() - 0.5) * 0.012, 0.018, 0.10);
      country.openness = clamp(country.openness + (this.random() - 0.5) * 0.035, 0.12, 0.96);
      country.nextElectionMonth = this.month + country.electionInterval + Math.round((this.random() - 0.5) * 12);
      const title = democratic ? `${country.name} 총선` : `${country.name} 지도부 교체`;
      this.events.push(event(this.month, 'politics', title, Math.abs(reform) > 0.010 ? '재정·산업정책 방향 전환' : '기존 정책연합 유지', { countryId: country.id }));
    }
    if (country.legitimacy < 0.22 && this.random() < 0.0035) {
      const previous = country.governmentType;
      country.governmentType = governmentType(country.institution, country.openness, this.random);
      country.legitimacy = 0.42 + this.random() * 0.12;
      country.regimeAgeMonths = 0;
      country.nextElectionMonth = this.month + Math.round(36 + this.random() * 72);
      this.events.push(event(this.month, 'regime', `${country.name} 정권 전환`, `${previous} → ${country.governmentType}`, { countryId: country.id }));
    }
  }

  updateClimate() {
    const emissions = sum(this.countries.map((country) => {
      country.emissionsGt = country.gdpB * 0.0034 * country.energyIntensity * (1 - country.renewableShare * 0.78);
      return country.emissionsGt;
    }));
    this.world.emissionsGt = emissions;
    const monthlyNet = emissions / MONTHS_PER_YEAR - 1.15;
    this.world.atmosphericCarbonIndex = clamp(this.world.atmosphericCarbonIndex + monthlyNet / 12500, 0.72, 3.6);
    const equilibriumTemperature = 0.68 + Math.log(this.world.atmosphericCarbonIndex) / Math.log(2) * 2.65;
    this.world.temperatureAnomalyC += (equilibriumTemperature - this.world.temperatureAnomalyC) / 260;
    this.world.seaLevelIndex = clamp(this.world.seaLevelIndex + Math.max(0, this.world.temperatureAnomalyC - 0.55) * 0.000035, 0, 2.5);
    this.world.frontierTechnology = clamp(this.world.frontierTechnology * (1 + 0.008 / MONTHS_PER_YEAR), 1.0, 8.0);
    const inflation = sum(this.countries.map((country) => country.inflation * country.gdpB)) / Math.max(1, sum(this.countries.map((country) => country.gdpB)));
    this.world.policyRate = clamp(this.world.policyRate + (inflation - 0.025) * 0.012 - (this.world.policyRate - 0.028) * 0.035, 0.002, 0.18);
  }

  updateWorldTotals() {
    this.world.month = this.month;
    this.world.totalPopulation = sum(this.countries.map((country) => country.population));
    this.world.totalGdpB = sum(this.countries.map((country) => country.gdpB));
    this.world.tradeB = sum(this.relations.map((relation) => relation.tradeB));
    this.world.conflictCount = this.relations.filter((relation) => relation.conflictIntensity > 0.05).length;
  }

  hostInfluence() {
    const host = this.countries[this.settlement.hostCountryId];
    return {
      id: host.id,
      name: host.name,
      gdpPerCapita: host.gdpPerCapita,
      realGrowth: host.realGrowth,
      inflation: host.inflation,
      interestRate: host.interestRate,
      publicServices: host.publicServices,
      energySecurity: host.energySecurity,
      foodSecurity: host.foodSecurity,
      renewableShare: host.renewableShare,
      tradeAccess: host.tradeAccess,
      netMigrationRate: host.netMigrationRate,
      conflictIntensity: host.conflictIntensity,
      climateHazard: host.climateHazard,
      healthShock: host.healthShock,
      fertilitySupport: host.socialSpendingShare - 0.12,
      serviceShare: host.sectorShares.services,
    };
  }

  stepMonth() {
    this.month += 1;
    this.triggerClimateHazards();
    for (const country of this.countries) this.produce(country);
    this.solveTrade();
    this.settleGoodsAndPrices();
    this.updateRelations();
    this.solveMigration();
    for (const country of this.countries) this.updateDemography(country);
    for (const country of this.countries) this.updateGovernmentAndCapital(country);
    this.updateClimate();
    this.updateWorldTotals();
    this.settlement.step(this.month, this.hostInfluence());
    const snapshot = this.createSnapshot();
    this.recordSnapshot(snapshot);
    return snapshot;
  }

  advanceMonths(count = 1) {
    const wholeMonths = Math.max(0, Math.floor(Number(count) || 0));
    let snapshot = this.getSnapshotAtMonth(this.month);
    for (let index = 0; index < wholeMonths; index += 1) snapshot = this.stepMonth();
    return snapshot;
  }

  countrySnapshot(country) {
    return {
      id: country.id,
      name: country.name,
      color: [...country.color],
      population: Math.round(country.population),
      cohorts: { ...country.cohorts },
      gdpB: country.gdpB,
      gdpPerCapita: country.gdpPerCapita,
      realGrowth: country.realGrowth,
      inflation: country.inflation,
      priceLevel: country.priceLevel,
      currencyRebases: country.currencyRebases,
      laborForce: Math.round(country.laborForce),
      employed: Math.round(country.employed),
      unemploymentRate: country.unemploymentRate,
      exportsB: country.exportsB,
      importsB: country.importsB,
      tradeBalanceB: country.tradeBalanceB,
      tradeAccess: country.tradeAccess,
      governmentType: country.governmentType,
      debtRatio: country.governmentDebtB / Math.max(0.01, country.gdpB),
      taxRate: country.taxRate,
      interestRate: country.interestRate,
      legitimacy: country.legitimacy,
      publicServices: country.publicServices,
      inequality: country.inequality,
      foodSecurity: country.foodSecurity,
      energySecurity: country.energySecurity,
      materialSecurity: country.materialSecurity,
      renewableShare: country.renewableShare,
      technology: country.technology,
      infrastructure: country.infrastructure,
      institution: country.institution,
      openness: country.openness,
      emissionsGt: country.emissionsGt,
      climateHazard: country.climateHazard,
      conflictIntensity: country.conflictIntensity,
      migrationIn: country.migrationIn,
      migrationOut: country.migrationOut,
      netMigrationRate: country.netMigrationRate,
      prices: { ...country.prices },
      populationFlows: { ...country.lastPopulationFlows },
    };
  }

  relationSnapshot(relation) {
    return {
      id: relation.id,
      a: relation.a,
      b: relation.b,
      distanceKm: relation.distanceKm,
      border: relation.border,
      trust: relation.trust,
      tension: relation.tension,
      tariff: relation.tariff,
      treaty: relation.treaty,
      sanctions: relation.sanctions,
      conflictIntensity: relation.conflictIntensity,
      tradeB: relation.tradeB,
      aToB: relation.aToB,
      bToA: relation.bToA,
      goods: { ...relation.goods },
      migrationAToB: relation.migrationAToB,
      migrationBToA: relation.migrationBToA,
      status: relationStatus(relation),
    };
  }

  createSnapshot() {
    const host = this.hostInfluence();
    return {
      month: this.month,
      year: this.month / MONTHS_PER_YEAR,
      world: {
        totalPopulation: Math.round(this.world.totalPopulation),
        totalGdpB: this.world.totalGdpB,
        tradeB: this.world.tradeB,
        emissionsGt: this.world.emissionsGt,
        temperatureAnomalyC: this.world.temperatureAnomalyC,
        atmosphericCarbonIndex: this.world.atmosphericCarbonIndex,
        seaLevelIndex: this.world.seaLevelIndex,
        policyRate: this.world.policyRate,
        conflictCount: this.world.conflictCount,
        globalPrices: { ...this.world.globalPrices },
      },
      countries: this.countries.map((country) => this.countrySnapshot(country)),
      relations: this.relations.map((relation) => this.relationSnapshot(relation)),
      settlement: this.settlement.snapshot(this.month, host),
      eventCount: this.events.length + this.settlement.events.length,
    };
  }

  recordSnapshot(snapshot) {
    this.recentSnapshots.set(snapshot.month, snapshot);
    if (snapshot.month % MONTHS_PER_YEAR === 0) {
      const year = snapshot.month / MONTHS_PER_YEAR;
      const interval = year < 250 ? 1 : year < 1000 ? 5 : year < 5000 ? 10 : 50;
      if (year % interval === 0) this.annualSnapshots[year] = snapshot;
    }
    const keepFrom = this.month - 360;
    for (const month of this.recentSnapshots.keys()) if (month < keepFrom) this.recentSnapshots.delete(month);
  }

  getSnapshotAtMonth(month) {
    const value = clamp(Math.round(Number(month) || 0), 0, this.month);
    if (this.recentSnapshots.has(value)) return this.recentSnapshots.get(value);
    let year = Math.floor(value / MONTHS_PER_YEAR);
    while (year > 0 && !this.annualSnapshots[year]) year -= 1;
    return this.annualSnapshots[year] || this.annualSnapshots[0];
  }

  getSnapshot(year) {
    return this.getSnapshotAtMonth((Number(year) || 0) * MONTHS_PER_YEAR);
  }

  getVisibleState(year) {
    const month = clamp(Math.round((Number(year) || 0) * MONTHS_PER_YEAR), 0, this.month);
    const snapshot = this.getSnapshotAtMonth(month);
    return this.settlement.visibleState(month, snapshot.settlement);
  }

  getRecentEvents(month = this.month, scope = 'all', limit = 6) {
    const worldEvents = scope === 'settlement' ? [] : this.events;
    const settlementEvents = scope === 'world' ? [] : this.settlement.events;
    return [...worldEvents, ...settlementEvents]
      .filter((entry) => entry.month <= month)
      .sort((a, b) => a.month - b.month)
      .slice(-limit)
      .reverse();
  }

  getCountryInteractions(countryId, month = this.month) {
    const snapshot = this.getSnapshotAtMonth(month);
    return snapshot.relations.filter((relation) => relation.a === countryId || relation.b === countryId)
      .map((relation) => ({
        ...relation,
        partnerId: relation.a === countryId ? relation.b : relation.a,
        partner: snapshot.countries[relation.a === countryId ? relation.b : relation.a],
        exportsB: relation.a === countryId ? relation.aToB : relation.bToA,
        importsB: relation.a === countryId ? relation.bToA : relation.aToB,
        migrationOut: relation.a === countryId ? relation.migrationAToB : relation.migrationBToA,
        migrationIn: relation.a === countryId ? relation.migrationBToA : relation.migrationAToB,
      }))
      .sort((a, b) => (b.tradeB + b.conflictIntensity * 10) - (a.tradeB + a.conflictIntensity * 10));
  }

  diagnostics() {
    const snapshot = this.getSnapshotAtMonth(this.month);
    return {
      version: this.version,
      month: this.month,
      yearsGenerated: this.years,
      countries: this.countries.length,
      relations: this.relations.length,
      activeTradeLinks: snapshot.relations.filter((relation) => relation.tradeB > 0.001).length,
      conflicts: snapshot.world.conflictCount,
      annualCheckpoints: this.annualSnapshots.filter(Boolean).length,
      recentMonthlyCheckpoints: this.recentSnapshots.size,
      buildings: this.buildings.length,
      roadsOpen: snapshot.settlement.roads,
    };
  }
}

export function createContinuousWorldSimulation(input) {
  return new ContinuousWorldSimulation(input);
}

export { GOOD_LABELS };
