import { COUNTRY_SEEDS } from '../config/countries.js';
import { RNG, hashSeed, clamp } from './rng.js';
import { householdDecision, firmDecision, updateForecastError } from '../ai/reasoning.js';

function makeHousehold(country, i, rng) {
  const employed = rng.next() > 0.075;
  const wage = country.initialWage * clamp(rng.normal(1, 0.18), 0.45, 1.8);
  return {
    id: `${country.id}-H-${String(i + 1).padStart(4, '0')}`,
    countryId: country.id,
    wealth: Math.max(20, country.householdWealth * clamp(rng.normal(1, 0.55), 0.08, 3.5)),
    income: employed ? wage : wage * 0.16,
    wage,
    employed,
    employerId: null,
    consumption: 0,
    savings: 0,
    riskAversion: rng.range(0.15, 0.95),
    optimism: rng.range(-0.6, 0.6),
    biasInflation: rng.normal(0, 0.01),
    beliefs: { inflation: 0.02, jobRisk: 0.08, incomeGrowth: 0 },
    learning: {},
    lastTrace: null
  };
}

function makeFirm(country, i, rng) {
  const workers = rng.int(5, 26);
  return {
    id: `${country.id}-F-${String(i + 1).padStart(3, '0')}`,
    countryId: country.id,
    price: country.initialPrice * clamp(rng.normal(1, 0.06), 0.78, 1.25),
    wage: country.initialWage * clamp(rng.normal(1, 0.08), 0.78, 1.28),
    workers,
    desiredWorkers: workers,
    productivity: country.productivity * clamp(rng.normal(1, 0.09), 0.65, 1.35),
    output: 0,
    sales: 0,
    inventory: rng.range(18, 65),
    targetInventory: rng.range(28, 52),
    cash: country.firmCash * clamp(rng.normal(1, 0.25), 0.4, 1.8),
    safeCash: country.firmCash * 0.65,
    demandBias: rng.normal(0, 0.018),
    riskAversion: rng.range(0.10, 0.90),
    competitionSensitivity: rng.range(0.15, 0.95),
    beliefs: { demandGrowth: 0.01, costGrowth: 0.02 },
    learning: {},
    lastTrace: null,
    previousSales: 1
  };
}

function macroFrom(country) {
  const households = country.households;
  const firms = country.firms;
  const employed = households.filter(h => h.employed).length;
  const consumption = households.reduce((s, h) => s + h.consumption, 0);
  const output = firms.reduce((s, f) => s + f.output * f.price, 0);
  const sales = firms.reduce((s, f) => s + f.sales * f.price, 0);
  const wages = firms.reduce((s, f) => s + f.wage * f.workers, 0);
  const priceWeight = firms.reduce((s, f) => s + Math.max(1, f.sales), 0);
  const priceIndex = firms.reduce((s, f) => s + f.price * Math.max(1, f.sales), 0) / Math.max(1, priceWeight);
  const avgWage = firms.reduce((s, f) => s + f.wage * f.workers, 0) / Math.max(1, firms.reduce((s, f) => s + f.workers, 0));
  const inventory = firms.reduce((s, f) => s + f.inventory, 0);
  const firmCash = firms.reduce((s, f) => s + f.cash, 0);
  const householdWealth = households.reduce((s, h) => s + h.wealth, 0);
  return {
    gdp: output,
    nominalSales: sales,
    consumption,
    wageBill: wages,
    unemployment: 1 - employed / Math.max(1, households.length),
    priceIndex,
    avgWage,
    inventory,
    firmCash,
    householdWealth
  };
}

export class EconomicWorld {
  constructor(seedText = 'ECON-4-001') {
    this.seedText = seedText;
    this.rng = new RNG(hashSeed(seedText));
    this.month = 0;
    this.countries = COUNTRY_SEEDS.map(seed => this.createCountry(seed));
    for (const country of this.countries) {
      country.macro = macroFrom(country);
      country.previousMacro = { ...country.macro };
      country.history = [{ month: 0, ...country.macro }];
    }
    this.relinkEmployment();
  }

  createCountry(seed) {
    const local = new RNG(hashSeed(`${this.seedText}:${seed.id}`));
    return {
      ...seed,
      households: Array.from({ length: seed.households }, (_, i) => makeHousehold(seed, i, local)),
      firms: Array.from({ length: seed.firms }, (_, i) => makeFirm(seed, i, local)),
      macro: null,
      previousMacro: null,
      history: []
    };
  }

  relinkEmployment() {
    for (const country of this.countries) {
      const jobs = country.firms.flatMap(f => Array.from({ length: f.workers }, () => f.id));
      let cursor = 0;
      for (const h of country.households) {
        if (h.employed && cursor < jobs.length) h.employerId = jobs[cursor++];
        else { h.employed = false; h.employerId = null; }
      }
    }
  }

  step(months = 1) {
    for (let k = 0; k < months; k++) this.stepMonth();
  }

  stepMonth() {
    this.month += 1;
    for (const country of this.countries) this.stepCountry(country);
  }

  stepCountry(country) {
    const prev = country.previousMacro;
    const prev2 = country.history.length > 1 ? country.history[country.history.length - 2] : prev;
    const inflation = prev2.priceIndex ? prev.priceIndex / prev2.priceIndex - 1 : 0;
    const wageGrowth = prev2.avgWage ? prev.avgWage / prev2.avgWage - 1 : 0;
    const demandGrowth = prev2.nominalSales ? prev.nominalSales / prev2.nominalSales - 1 : 0;
    const signals = { inflation, wageGrowth, demandGrowth, unemployment: prev.unemployment };

    for (const f of country.firms) {
      const decision = firmDecision(f, signals, this.rng);
      f.lastTrace = decision.trace;
      f.price = Math.max(0.08, f.price * (1 + clamp(decision.priceChange, -0.08, 0.10)));
      f.desiredWorkers = Math.max(1, Math.round(f.workers * (1 + clamp(decision.hiringChange, -0.10, 0.12))));
      const labor = Math.max(1, f.workers);
      const capitalEffect = 0.78 + country.capitalDepth * 0.34;
      const humanEffect = 0.82 + country.humanCapital * 0.30;
      const resourceEffect = 0.90 + country.resourceBase * 0.14;
      f.output = labor * f.productivity * capitalEffect * humanEffect * resourceEffect * (1 + clamp(decision.productionChange, -0.12, 0.15));
      f.inventory += f.output;
    }

    const totalIncome = country.households.reduce((s, h) => s + h.income, 0);
    const avgPrice = country.firms.reduce((s, f) => s + f.price, 0) / Math.max(1, country.firms.length);
    let consumptionBudget = 0;
    for (const h of country.households) {
      const decision = householdDecision(h, signals, this.rng);
      h.lastTrace = decision.trace;
      const disposable = Math.max(0, h.income + h.wealth * 0.004);
      h.consumption = disposable * decision.consumeShare;
      h.savings = disposable - h.consumption;
      h.wealth = Math.max(0, h.wealth + h.savings);
      consumptionBudget += h.consumption;
    }

    const demandUnits = consumptionBudget / Math.max(0.05, avgPrice);
    const attractiveness = country.firms.map(f => Math.max(0.01, (1 / f.price) * (0.65 + f.productivity * 0.35)));
    const attrSum = attractiveness.reduce((a, b) => a + b, 0);
    for (let i = 0; i < country.firms.length; i++) {
      const f = country.firms[i];
      const share = attractiveness[i] / Math.max(1e-9, attrSum);
      const desiredSales = demandUnits * share * (0.88 + country.demandLevel * 0.12);
      f.sales = Math.min(f.inventory, desiredSales);
      f.inventory -= f.sales;
      const revenue = f.sales * f.price;
      const payroll = f.workers * f.wage;
      const nonLaborCost = f.output * 0.12 / Math.max(0.25, country.resourceBase);
      f.cash += revenue - payroll - nonLaborCost;
      const actualGrowth = f.previousSales > 0 ? f.sales / f.previousSales - 1 : 0;
      updateForecastError(f, f.beliefs.demandGrowth, actualGrowth, 'demandForecast');
      f.previousSales = Math.max(0.01, f.sales);
    }

    this.clearLaborMarket(country);
    this.payHouseholds(country);

    country.previousMacro = country.macro;
    country.macro = macroFrom(country);
    country.history.push({ month: this.month, ...country.macro });
    if (country.history.length > 240) country.history.shift();
  }

  clearLaborMarket(country) {
    const households = country.households;
    const firms = country.firms;
    const employedByFirm = new Map(firms.map(f => [f.id, []]));
    for (const h of households) if (h.employed && h.employerId && employedByFirm.has(h.employerId)) employedByFirm.get(h.employerId).push(h);

    for (const f of firms) {
      const staff = employedByFirm.get(f.id);
      while (staff.length > f.desiredWorkers) {
        const h = staff.pop();
        h.employed = false;
        h.employerId = null;
      }
      f.workers = staff.length;
    }

    const unemployed = households.filter(h => !h.employed);
    let cursor = 0;
    for (const f of firms) {
      while (f.workers < f.desiredWorkers && cursor < unemployed.length) {
        const h = unemployed[cursor++];
        h.employed = true;
        h.employerId = f.id;
        h.wage = f.wage;
        f.workers += 1;
      }
    }
  }

  payHouseholds(country) {
    const firmMap = new Map(country.firms.map(f => [f.id, f]));
    for (const h of country.households) {
      if (h.employed && h.employerId && firmMap.has(h.employerId)) {
        const f = firmMap.get(h.employerId);
        h.wage = f.wage;
        h.income = f.wage;
      } else {
        h.income = Math.max(8, h.wage * 0.16);
      }
    }
  }

  snapshot() {
    return {
      month: this.month,
      countries: this.countries.map(c => ({
        id: c.id,
        name: c.name,
        macro: { ...c.macro },
        households: c.households.length,
        firms: c.firms.length,
        sampleHousehold: c.households[0],
        sampleFirm: c.firms[0],
        history: c.history.slice()
      }))
    };
  }
}
