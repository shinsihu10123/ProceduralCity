import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const months = Math.max(24, Number(process.env.DIAG_MONTHS || 36));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const EPS = 1e-8;
const TOL = 1e-7;
const F = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const C = v => structuredClone(v);
const S = a => a.reduce((s, v) => s + F(v), 0);
const M = a => a.length ? S(a) / a.length : 0;
const CL = (x, l, h) => Math.max(l, Math.min(h, F(x)));

const regimes = [
  { id: 'control', cut: 0, floor: 0 },
  { id: 'stress-cut-0p5', cut: 0.005, floor: 0 },
  { id: 'stress-cut-1p0', cut: 0.010, floor: 0 },
  { id: 'stress-cut-2p0-floor80', cut: 0.020, floor: 0.80 }
];

function transformedSeeds() {
  return COUNTRY_SEEDS.map(s => ({ ...s, initialPrice: Math.max(EPS, F(s.initialWage, F(s.initialPrice, 1))) }));
}

function makeWorld(seedText) {
  const old = COUNTRY_SEEDS.map(C);
  COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...transformedSeeds());
  try {
    return new EconomicWorld(seedText, { scaleProfile: 'baseline', healthCheckInterval: 0 });
  } finally {
    COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...old);
  }
}

function supplierMean(country, product) {
  const firms = country.firms.filter(f => f.active !== false && f.product === product && F(f.price) > EPS);
  return firms.length ? M(firms.map(f => f.price)) : 0;
}

function unconstrainedPlan(f) {
  const anchor = Math.max(2, F(f.previousSales), F(f.targetInventory) * 0.42);
  const expected = anchor * (1 + CL(f.beliefs?.demandGrowth || 0, -0.18, 0.22));
  return Math.max(0, expected * 0.72 + Math.max(0, F(f.targetInventory) - F(f.inventory)));
}

function installNormalization(world) {
  const target = new Set(['MATERIALS', 'CONSUMER']);
  const done = new Set();
  world.__btNorm = 0;
  const original = world.supply.planProduction.bind(world.supply);
  world.supply.planProduction = country => {
    const out = original(country);
    if (done.has(country.id)) return out;
    const prices = {
      raw_material: supplierMean(country, 'raw_material'),
      processed_material: supplierMean(country, 'processed_material')
    };
    for (const f of country.firms.filter(x => x.active !== false && target.has(x.industryId))) {
      const inputCost = F(f.inputPerOutput) * (f.inputProduct ? F(prices[f.inputProduct]) : 0);
      const margin = F(f.price) - inputCost;
      const payroll = F(f.wage) * F(f.workers);
      const cap = F(f.capacity);
      const required = margin > EPS && cap > EPS ? payroll / (margin * cap) : Infinity;
      const factor = Number.isFinite(required) ? Math.max(1, required) : 1;
      if (factor > 1 + TOL) {
        f.productivity *= factor;
        f.capacity = cap * factor;
        f.desiredProduction = Math.max(0, Math.min(f.capacity * 1.08, unconstrainedPlan(f)));
        world.__btNorm += 1;
      }
    }
    done.add(country.id);
    return out;
  };
}

function gdpResidual(m) {
  return F(m?.gdp) - (
    F(m?.consumption) + F(m?.grossInvestment) + F(m?.publicInvestment) +
    F(m?.governmentConsumption) + F(m?.inventoryInvestment) + F(m?.netExports)
  );
}

function digest(world) {
  const h = createHash('sha256');
  h.update(JSON.stringify({ month: world.month, rng: world.rng }));
  for (const c of world.countries) {
    h.update(JSON.stringify(c));
    h.update(JSON.stringify(world.accountingReport(c.id)));
  }
  for (const e of world.ledger.entries) h.update(JSON.stringify(e));
  return h.digest('hex');
}

function weightedFirmWage(country) {
  let num = 0, den = 0;
  for (const f of country.firms) {
    if (f.active === false) continue;
    const w = Math.max(0, F(f.workers));
    num += F(f.wage) * w;
    den += w;
  }
  return den > EPS ? num / den : M(country.firms.filter(f => f.active !== false).map(f => F(f.wage)));
}

function meanActivePrice(country) {
  const xs = country.firms.filter(f => f.active !== false && F(f.price) > EPS).map(f => F(f.price));
  return M(xs);
}

function installWagePolicy(world, regime) {
  const anchors = new Map();
  world.__btCuts = 0;
  world.__btCutAmount = 0;
  world.__btStressEligible = 0;
  world.__btFloorHits = 0;

  function anchorFor(f) {
    if (!anchors.has(f.id)) anchors.set(f.id, Math.max(EPS, F(f.wage, 1)));
    return anchors.get(f.id);
  }

  world.__btApply = () => {
    for (const c of world.countries) {
      for (const f of c.firms) {
        if (f.active === false) continue;
        const anchor = anchorFor(f);
        if (regime.cut <= 0 || F(f.workers) <= 0) continue;
        const payroll = Math.max(EPS, F(f.wage) * Math.max(1, F(f.workers)));
        const cash = Math.max(0, F(world.ledger.balance(f.accountId)));
        const arrears = Math.max(0, F(f.wageArrears));
        const noVacancy = F(f.desiredWorkers) <= F(f.workers) + TOL;
        const stressed = arrears > payroll * 0.25 || cash < payroll * 0.75;
        if (!(stressed && noVacancy)) continue;
        world.__btStressEligible += 1;
        const floor = regime.floor > 0 ? anchor * regime.floor : EPS;
        const old = Math.max(EPS, F(f.wage));
        const next = Math.max(floor, old * (1 - regime.cut));
        if (next < old - TOL) {
          f.wage = next;
          world.__btCuts += 1;
          world.__btCutAmount += old - next;
        } else if (regime.floor > 0 && old <= floor + TOL) {
          world.__btFloorHits += 1;
        }
      }
    }
  };
}

function macroRow(world, regime, country) {
  const macro = country.macro || {};
  const nominalWage = weightedFirmWage(country);
  const price = meanActivePrice(country);
  const employed = country.households.filter(h => h.employed).length;
  const laborIncome = S(country.households.map(h => F(h.income)));
  return {
    regime: regime.id,
    seed,
    month: world.month,
    countryId: country.id,
    unemployment: F(macro.unemployment),
    wageArrears: F(macro.wageArrears),
    consumption: F(macro.consumption),
    gdp: F(macro.gdp),
    exits: F(macro.firmExits),
    entries: F(macro.firmEntries),
    resourceOutput: F(macro.resourceOutput),
    materialsOutput: F(macro.materialsOutput),
    consumerOutput: F(macro.consumerGoodsOutput),
    capitalOutput: F(macro.capitalGoodsOutput),
    nominalWage,
    meanPrice: price,
    realWageProxy: price > EPS ? nominalWage / price : 0,
    householdLaborIncome: laborIncome,
    employed,
    activeFirms: country.firms.filter(f => f.active !== false).length,
    firmCash: F(macro.firmCash),
    newCredit: F(macro.newCredit),
    loanDefaults: F(macro.loanDefaults),
    gdpResidual: gdpResidual(macro),
    cuts: world.__btCuts,
    stressEligible: world.__btStressEligible
  };
}

function run(regime, horizon, capture = false) {
  const world = makeWorld(seed);
  for (const c of world.countries) {
    Object.defineProperty(c, '__diagnosticExactLaborRuntime', { value: true, writable: true, configurable: true, enumerable: false });
  }
  installNormalization(world);
  installWagePolicy(world, regime);
  const rows = [];
  let priorCuts = 0;
  let priorEligible = 0;
  for (let i = 0; i < horizon; i++) {
    world.__btApply();
    const monthCuts = world.__btCuts - priorCuts;
    const monthEligible = world.__btStressEligible - priorEligible;
    priorCuts = world.__btCuts;
    priorEligible = world.__btStressEligible;
    world.stepMonth();
    for (const c of world.countries) {
      const r = macroRow(world, regime, c);
      r.monthCuts = monthCuts;
      r.monthStressEligible = monthEligible;
      rows.push(r);
    }
  }
  const health = world.forceHealthCheck();
  const ledgerOk = world.countries.every(c => world.ledger.verifyCountry(c.id)?.ok === true);
  const accountingOk = world.countries.every(c => world.accounting.verifyCountry(c, world.ledger, world.month)?.ok !== false);
  const gdpOk = world.countries.every(c => Math.abs(gdpResidual(c.macro)) < 1e-5);
  assert.ok(health.ok && ledgerOk && accountingOk && gdpOk && world.__btNorm > 0, `${seed}/${regime.id}: hard gate`);
  return {
    regime: regime.id,
    rows,
    health,
    ledgerOk,
    accountingOk,
    gdpOk,
    normalizationCount: world.__btNorm,
    cuts: world.__btCuts,
    stressEligible: world.__btStressEligible,
    floorHits: world.__btFloorHits,
    cumulativeCutAmount: world.__btCutAmount,
    fingerprint: capture ? digest(world) : null
  };
}

function agg(regimeId, rows, runMeta) {
  const rs = rows.filter(r => r.regime === regimeId);
  const terminalMonth = Math.max(...rs.map(r => r.month));
  const terminal = rs.filter(r => r.month === terminalMonth);
  return {
    regime: regimeId,
    observations: rs.length,
    meanUnemployment: M(rs.map(r => r.unemployment)),
    terminalUnemployment: M(terminal.map(r => r.unemployment)),
    meanWageArrears: M(rs.map(r => r.wageArrears)),
    terminalWageArrears: M(terminal.map(r => r.wageArrears)),
    meanConsumption: M(rs.map(r => r.consumption)),
    meanGdp: M(rs.map(r => r.gdp)),
    totalExits: S(rs.map(r => r.exits)),
    meanConsumerOutput: M(rs.map(r => r.consumerOutput)),
    meanMaterialsOutput: M(rs.map(r => r.materialsOutput)),
    meanCapitalOutput: M(rs.map(r => r.capitalOutput)),
    meanNominalWage: M(rs.map(r => r.nominalWage)),
    meanRealWageProxy: M(rs.map(r => r.realWageProxy)),
    meanHouseholdLaborIncome: M(rs.map(r => r.householdLaborIncome)),
    meanEmployed: M(rs.map(r => r.employed)),
    meanActiveFirms: M(rs.map(r => r.activeFirms)),
    meanFirmCash: M(rs.map(r => r.firmCash)),
    totalNewCredit: S(rs.map(r => r.newCredit)),
    totalLoanDefaults: S(rs.map(r => r.loanDefaults)),
    interventionCuts: runMeta.cuts,
    stressEligibleFirmMonths: runMeta.stressEligible,
    interventionRate: runMeta.stressEligible > 0 ? runMeta.cuts / runMeta.stressEligible : 0,
    floorHits: runMeta.floorHits,
    cumulativeCutAmount: runMeta.cumulativeCutAmount
  };
}

// Control-path exactness: the no-op policy must not alter canonical state under the same normalized diagnostic scaffold.
const niH = Math.min(6, months);
const controlA = run(regimes[0], niH, true).fingerprint;
const controlB = run(regimes[0], niH, true).fingerprint;
const deterministicControlExact = controlA === controlB;
assert.ok(deterministicControlExact, 'R4-BT control replay must be exact');

const runs = regimes.map(r => run(r, months, false));
const rows = runs.flatMap(r => r.rows);
const summary = runs.map(r => agg(r.regime, rows, r));
const control = summary.find(x => x.regime === 'control');
const effects = summary.filter(x => x.regime !== 'control').map(x => ({
  regime: x.regime,
  dMeanUnemploymentPp: (x.meanUnemployment - control.meanUnemployment) * 100,
  dTerminalUnemploymentPp: (x.terminalUnemployment - control.terminalUnemployment) * 100,
  dMeanWageArrearsPct: Math.abs(control.meanWageArrears) > EPS ? (x.meanWageArrears / control.meanWageArrears - 1) * 100 : 0,
  dMeanConsumptionPct: Math.abs(control.meanConsumption) > EPS ? (x.meanConsumption / control.meanConsumption - 1) * 100 : 0,
  dMeanGdpPct: Math.abs(control.meanGdp) > EPS ? (x.meanGdp / control.meanGdp - 1) * 100 : 0,
  dConsumerOutputPct: Math.abs(control.meanConsumerOutput) > EPS ? (x.meanConsumerOutput / control.meanConsumerOutput - 1) * 100 : 0,
  dLaborIncomePct: Math.abs(control.meanHouseholdLaborIncome) > EPS ? (x.meanHouseholdLaborIncome / control.meanHouseholdLaborIncome - 1) * 100 : 0,
  dRealWageProxyPct: Math.abs(control.meanRealWageProxy) > EPS ? (x.meanRealWageProxy / control.meanRealWageProxy - 1) * 100 : 0,
  dExits: x.totalExits - control.totalExits
}));

const gates = {
  deterministicControlExact,
  completeCoverage: runs.length === regimes.length && runs.every(r => r.rows.length === months * COUNTRY_SEEDS.length),
  allHealthy: runs.every(r => r.health.ok),
  ledgerCountriesOk: runs.every(r => r.ledgerOk),
  generalAccountingOk: runs.every(r => r.accountingOk),
  gdpIdentityArithmetic: runs.every(r => r.gdpOk),
  normalizationActivated: runs.every(r => r.normalizationCount > 0),
  interventionActivated: runs.filter(r => r.regime !== 'control').every(r => r.cuts > 0),
  finiteRows: rows.every(r => Object.values(r).every(v => typeof v !== 'number' || Number.isFinite(v))),
  finiteSummary: summary.every(r => Object.values(r).every(v => typeof v !== 'number' || Number.isFinite(v))) && effects.every(r => Object.values(r).every(v => typeof v !== 'number' || Number.isFinite(v)))
};
gates.ok = Object.values(gates).every(Boolean);
assert.ok(gates.ok, `${seed}: R4-BT gates ${JSON.stringify(gates)}`);

console.table(summary.map(x => ({
  regime: x.regime,
  u: +x.meanUnemployment.toFixed(4),
  u36: +x.terminalUnemployment.toFixed(4),
  arrears: +x.meanWageArrears.toFixed(0),
  consumption: +x.meanConsumption.toFixed(1),
  gdp: +x.meanGdp.toFixed(1),
  consumer: +x.meanConsumerOutput.toFixed(1),
  laborIncome: +x.meanHouseholdLaborIncome.toFixed(1),
  realWage: +x.meanRealWageProxy.toFixed(3),
  exits: x.totalExits,
  cuts: x.interventionCuts
})));
console.table(effects);
console.log('WP_RV08_R4_BT_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_BT_SUMMARY', JSON.stringify(summary));
console.log('WP_RV08_R4_BT_EFFECTS', JSON.stringify(effects));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify({
    workPackage: 'WP-RV08-R4-BT',
    title: 'Wage flexibility under payroll stress causal ablation',
    generatedAt: new Date().toISOString(),
    configuration: { seed, months, regimes },
    gates,
    summary,
    effects,
    rows
  }, null, 2));
  console.log('WP_RV08_R4_BT_OUTPUT', outputJson);
}
