import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const scales = (process.env.DIAG_SCALES || 'compact,baseline').split(',').map(x => x.trim()).filter(Boolean);
const seeds = (process.env.DIAG_SEEDS || 'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x => x.trim()).filter(Boolean);
const months = Math.max(1, Number(process.env.DIAG_MONTHS || 12));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const EPS = 1e-8;
const TOL = 1e-7;
const F = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const C = v => structuredClone(v);
const S = a => a.reduce((s, v) => s + F(v), 0);
const M = a => a.length ? S(a) / a.length : 0;
const R = (a, b) => Math.abs(F(b)) > EPS ? F(a) / F(b) : 0;
const CL = (x, l, h) => Math.max(l, Math.min(h, F(x)));

const bases = ['consumer', 'materials-consumer'];
const modes = [
  { id: 'control', supportFloor: false, viableExitGuard: false, noExitUpperBound: false },
  { id: 'support-labor-floor', supportFloor: true, viableExitGuard: false, noExitUpperBound: false },
  { id: 'viable-exit-guard', supportFloor: false, viableExitGuard: true, noExitUpperBound: false },
  { id: 'support-floor-plus-viable-exit', supportFloor: true, viableExitGuard: true, noExitUpperBound: false },
  { id: 'no-exit-upper-bound', supportFloor: false, viableExitGuard: false, noExitUpperBound: true }
];
const variants = bases.flatMap(base => modes.map(mode => ({ ...mode, base, id: `${base}-${mode.id}` })));

function targetSectors(base) {
  return base === 'consumer' ? new Set(['CONSUMER']) : new Set(['MATERIALS', 'CONSUMER']);
}

function transformedSeeds() {
  return COUNTRY_SEEDS.map(seed => ({
    ...seed,
    initialPrice: Math.max(EPS, F(seed.initialWage, F(seed.initialPrice, 1)))
  }));
}

function makeWorld(scaleProfile, seedText) {
  const original = COUNTRY_SEEDS.map(C);
  COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...transformedSeeds());
  try {
    return new EconomicWorld(seedText, { scaleProfile, healthCheckInterval: 0 });
  } finally {
    COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...original);
  }
}

function supplierMean(country, product) {
  const firms = country.firms.filter(f => f.active !== false && f.product === product && F(f.price) > EPS);
  return firms.length ? M(firms.map(f => f.price)) : 0;
}

function unconstrainedPlan(firm) {
  const anchor = Math.max(2, F(firm.previousSales), F(firm.targetInventory) * 0.42);
  const expected = anchor * (1 + CL(firm.beliefs?.demandGrowth || 0, -0.18, 0.22));
  return Math.max(0, expected * 0.72 + Math.max(0, F(firm.targetInventory) - F(firm.inventory)));
}

function installNormalization(world, base) {
  const targets = targetSectors(base);
  const done = new Set();
  world.__p74NormalizationApps = 0;
  const original = world.supply.planProduction.bind(world.supply);
  world.supply.planProduction = country => {
    const out = original(country);
    if (done.has(country.id)) return out;
    const prices = {
      raw_material: supplierMean(country, 'raw_material'),
      processed_material: supplierMean(country, 'processed_material')
    };
    for (const f of country.firms.filter(x => x.active !== false && targets.has(x.industryId))) {
      const inputCost = F(f.inputPerOutput) * (f.inputProduct ? F(prices[f.inputProduct]) : 0);
      const margin = F(f.price) - inputCost;
      const payroll = F(f.wage) * F(f.workers);
      const baseCapacity = F(f.capacity);
      const requiredFactor = margin > EPS && baseCapacity > EPS ? payroll / (margin * baseCapacity) : Infinity;
      const factor = Number.isFinite(requiredFactor) ? Math.max(1, requiredFactor) : 1;
      if (factor > 1 + TOL) {
        f.productivity *= factor;
        f.capacity = baseCapacity * factor;
        f.desiredProduction = Math.max(0, Math.min(f.capacity * 1.08, unconstrainedPlan(f)));
        world.__p74NormalizationApps += 1;
      }
    }
    done.add(country.id);
    return out;
  };
}

function installPriorStateCapture(world) {
  world.__p74Prior = new Map();
  const original = world.supply.beginMonth.bind(world.supply);
  world.supply.beginMonth = country => {
    for (const f of country.firms) {
      world.__p74Prior.set(`${country.id}|${f.id}`, {
        sales: F(f.sales),
        revenue: F(f.revenue),
        inputSpend: F(f.inputSpend),
        workers: F(f.workers),
        wage: F(f.wage)
      });
    }
    return original(country);
  };
}

function installFinancialSupportFloor(world) {
  world.__p74SupportFloors = 0;
  world.__p74WorkersSaved = 0;
  const original = world.banking.originateCredit.bind(world.banking);
  world.banking.originateCredit = (country, month, signals) => {
    const out = original(country, month, signals);
    const upstreamPrices = {
      raw_material: supplierMean(country, 'raw_material'),
      processed_material: supplierMean(country, 'processed_material')
    };
    for (const f of country.firms.filter(x => x.active !== false)) {
      const prior = world.__p74Prior.get(`${country.id}|${f.id}`) || {};
      const workers = F(f.workers);
      const desired = F(f.desiredWorkers);
      if (!(desired + TOL < workers)) continue;
      const wage = Math.max(EPS, F(f.wage));
      const cash = Math.max(0, world.ledger.balance(f.accountId));
      const inputCost = F(f.inputPerOutput) * (f.inputProduct ? F(upstreamPrices[f.inputProduct]) : 0);
      const margin = Math.max(0, F(f.price) - inputCost);
      const priorContribution = Math.max(0, F(prior.sales)) * margin;
      const priorContributionSupportedWorkers = Math.floor(priorContribution / wage);
      const cashPayrollSupportedWorkers = Math.floor(cash / wage);
      const conservativeSupport = Math.max(
        priorContributionSupportedWorkers,
        Math.min(workers, cashPayrollSupportedWorkers)
      );
      const supportFloor = Math.min(workers, conservativeSupport);
      if (supportFloor > desired + TOL) {
        f.desiredWorkers = supportFloor;
        world.__p74SupportFloors += 1;
        world.__p74WorkersSaved += supportFloor - desired;
      }
    }
    return out;
  };
}

function deactivateFirm(country, firm) {
  firm.active = false;
  firm.desiredWorkers = 0;
  firm.desiredProduction = 0;
  for (const h of country.households) {
    if (h.employerId === firm.id) {
      h.employed = false;
      h.employerId = null;
    }
  }
  firm.workers = 0;
}

function installExitMode(world, variant) {
  world.__p74ExitCandidates = 0;
  world.__p74ViableExitGuards = 0;
  world.__p74UpperBoundSuppressions = 0;
  if (!variant.viableExitGuard && !variant.noExitUpperBound) return;

  world.supply.evaluateExits = country => {
    const exited = [];
    for (const f of country.firms.filter(x => x.active !== false)) {
      const cash = world.ledger.balance(f.accountId);
      const payrollStress = F(f.wageArrears) > Math.max(100, F(f.wage) * Math.max(1, F(f.workers)) * 1.35);
      const creditStress = F(f.creditMisses) >= 5;
      const liquidityFailure = cash < F(f.safeCash) * 0.025 && payrollStress;
      if (liquidityFailure || creditStress) f.distressMonths = F(f.distressMonths) + 1;
      else f.distressMonths = Math.max(0, F(f.distressMonths) - 1);

      if (F(f.distressMonths) < 4) continue;
      world.__p74ExitCandidates += 1;

      if (variant.noExitUpperBound) {
        f.distressMonths = 3;
        world.__p74UpperBoundSuppressions += 1;
        continue;
      }

      const payrollObligation = F(f.wage) * Math.max(0, F(f.workers));
      const realizedOperatingContribution = Math.max(0, F(f.revenue) - F(f.inputSpend));
      const objectivelyViableNow =
        liquidityFailure &&
        !creditStress &&
        payrollObligation > EPS &&
        realizedOperatingContribution + TOL >= payrollObligation;

      if (objectivelyViableNow) {
        f.distressMonths = 3;
        world.__p74ViableExitGuards += 1;
        continue;
      }

      deactivateFirm(country, f);
      exited.push(f.industryId);
    }
    return exited;
  };
}

function gdpResidual(macro) {
  return F(macro?.gdp) - (
    F(macro?.consumption) +
    F(macro?.grossInvestment) +
    F(macro?.publicInvestment) +
    F(macro?.governmentConsumption) +
    F(macro?.inventoryInvestment) +
    F(macro?.netExports)
  );
}

function digest(world) {
  const hash = createHash('sha256');
  const put = value => hash.update(JSON.stringify(value));
  put({ month: world.month, rng: world.rng });
  for (const country of world.countries) {
    put(country);
    put(world.accountingReport(country.id));
  }
  for (const entry of world.ledger.entries) put(entry);
  return hash.digest('hex');
}

function runVariant(variant, scaleProfile, seedText, horizon, capture = false) {
  const world = makeWorld(scaleProfile, seedText);
  installNormalization(world, variant.base);
  installPriorStateCapture(world);
  if (variant.supportFloor) installFinancialSupportFloor(world);
  installExitMode(world, variant);

  const rows = [];
  for (let i = 0; i < horizon; i++) {
    world.stepMonth();
    for (const country of world.countries) {
      const macro = country.macro || {};
      const industry = country.lastIndustry || {};
      const sectors = industry.sectorOutputs || {};
      rows.push({
        variant: variant.id,
        base: variant.base,
        mode: variant.id.slice(variant.base.length + 1),
        supportFloor: variant.supportFloor,
        viableExitGuard: variant.viableExitGuard,
        noExitUpperBound: variant.noExitUpperBound,
        scaleProfile,
        seed: seedText,
        month: world.month,
        countryId: country.id,
        unemployment: F(macro.unemployment),
        exits: F(macro.firmExits),
        entries: F(macro.firmEntries),
        activeFirms: F(macro.activeFirms),
        layoffs: F(macro.layoffs),
        hires: F(macro.hires),
        unfilled: F(macro.unfilledJobs),
        arrears: F(macro.wageArrears),
        fulfillment: 1 - F(macro.unmetDemandRatio),
        shortage: F(macro.inputShortageUnits),
        consumerOutput: F(sectors.CONSUMER, macro.consumerGoodsOutput),
        materialsOutput: F(sectors.MATERIALS, macro.materialsOutput),
        resourceOutput: F(sectors.RESOURCE, macro.resourceOutput),
        firmCash: F(macro.firmCash),
        nominalSales: F(macro.nominalSales),
        gdp: F(macro.gdp),
        gdpResidual: gdpResidual(macro),
        ledgerOk: world.ledger.verifyCountry(country.id)?.ok === true
      });
    }
  }

  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${variant.id}/${scaleProfile}/${seedText}: health`);
  return {
    variant: variant.id,
    scaleProfile,
    seed: seedText,
    rows,
    health,
    normalizationApps: world.__p74NormalizationApps || 0,
    supportFloors: world.__p74SupportFloors || 0,
    workersSaved: world.__p74WorkersSaved || 0,
    exitCandidates: world.__p74ExitCandidates || 0,
    viableExitGuards: world.__p74ViableExitGuards || 0,
    upperBoundSuppressions: world.__p74UpperBoundSuppressions || 0,
    fingerprint: capture ? digest(world) : null
  };
}

const determinism = [];
for (const variant of variants) {
  for (const scaleProfile of scales) {
    const seed = `ECON-RV07-P74-DET-${variant.id}-${scaleProfile}`;
    const horizon = Math.min(3, months);
    const a = runVariant(variant, scaleProfile, seed, horizon, true).fingerprint;
    const b = runVariant(variant, scaleProfile, seed, horizon, true).fingerprint;
    assert.equal(a, b, `${variant.id}/${scaleProfile}: deterministic replay`);
    determinism.push({ variant: variant.id, scaleProfile, exact: true });
  }
}

const runs = [];
for (const variant of variants) {
  for (const scaleProfile of scales) {
    for (const seed of seeds) runs.push(runVariant(variant, scaleProfile, seed, months));
  }
}
const rows = runs.flatMap(run => run.rows);

const windows = [
  ['M1-3', 1, Math.min(3, months)],
  ['M4-6', 4, Math.min(6, months)],
  ['M7-9', 7, Math.min(9, months)],
  ['M10-12', 10, months],
  ['FULL', 1, months]
].filter(x => x[1] <= x[2]);

function aggregate(rs) {
  return {
    countryMonths: rs.length,
    unemployment: M(rs.map(r => r.unemployment)),
    exits: S(rs.map(r => r.exits)),
    entries: S(rs.map(r => r.entries)),
    activeFirms: M(rs.map(r => r.activeFirms)),
    layoffs: S(rs.map(r => r.layoffs)),
    hires: S(rs.map(r => r.hires)),
    unfilled: S(rs.map(r => r.unfilled)),
    arrears: M(rs.map(r => r.arrears)),
    fulfillment: M(rs.map(r => r.fulfillment)),
    shortage: M(rs.map(r => r.shortage)),
    consumerOutput: M(rs.map(r => r.consumerOutput)),
    materialsOutput: M(rs.map(r => r.materialsOutput)),
    resourceOutput: M(rs.map(r => r.resourceOutput)),
    firmCash: M(rs.map(r => r.firmCash)),
    nominalSales: M(rs.map(r => r.nominalSales)),
    gdp: M(rs.map(r => r.gdp))
  };
}

const summary = [];
for (const variant of variants) {
  for (const scaleProfile of scales) {
    for (const [window, from, to] of windows) {
      summary.push({
        variant: variant.id,
        base: variant.base,
        mode: variant.id.slice(variant.base.length + 1),
        scaleProfile,
        window,
        ...aggregate(rows.filter(r => r.variant === variant.id && r.scaleProfile === scaleProfile && r.month >= from && r.month <= to))
      });
    }
  }
}

const comparisons = {};
for (const scaleProfile of scales) {
  comparisons[scaleProfile] = {};
  for (const base of bases) {
    comparisons[scaleProfile][base] = {};
    for (const [window] of windows) {
      const control = summary.find(x => x.scaleProfile === scaleProfile && x.base === base && x.mode === 'control' && x.window === window);
      comparisons[scaleProfile][base][window] = {};
      for (const mode of modes.slice(1)) {
        const candidate = summary.find(x => x.scaleProfile === scaleProfile && x.base === base && x.mode === mode.id && x.window === window);
        comparisons[scaleProfile][base][window][mode.id] = {
          unemploymentDifference: candidate.unemployment - control.unemployment,
          exitDifference: candidate.exits - control.exits,
          arrearsDifference: candidate.arrears - control.arrears,
          fulfillmentDifference: candidate.fulfillment - control.fulfillment,
          shortageDifference: candidate.shortage - control.shortage,
          consumerOutputRatio: R(candidate.consumerOutput, control.consumerOutput),
          firmCashDifference: candidate.firmCash - control.firmCash,
          layoffDifference: candidate.layoffs - control.layoffs
        };
      }
    }
  }
}

const maxGdpResidual = Math.max(0, ...rows.map(r => Math.abs(r.gdpResidual)));
const supportRuns = runs.filter(r => variants.find(v => v.id === r.variant)?.supportFloor);
const exitGuardRuns = runs.filter(r => variants.find(v => v.id === r.variant)?.viableExitGuard);
const upperRuns = runs.filter(r => variants.find(v => v.id === r.variant)?.noExitUpperBound);
const gates = {
  deterministicReplayExact: determinism.every(x => x.exact),
  allHealthy: runs.every(r => r.health?.ok === true),
  completeCoverage: rows.length === variants.length * scales.length * seeds.length * months * 4,
  normalizationActivated: runs.reduce((s, r) => s + r.normalizationApps, 0) > 0,
  supportFloorActivated: supportRuns.reduce((s, r) => s + r.supportFloors, 0) > 0,
  viableExitGuardEvaluated: exitGuardRuns.reduce((s, r) => s + r.exitCandidates, 0) > 0,
  upperBoundActivated: upperRuns.reduce((s, r) => s + r.upperBoundSuppressions, 0) > 0,
  upperBoundReportsZeroExits: rows.filter(r => r.noExitUpperBound).every(r => Math.abs(r.exits) < TOL),
  ledgerCountriesOk: rows.every(r => r.ledgerOk),
  gdpIdentityReconciled: maxGdpResidual < TOL,
  finiteRows: rows.every(r => Number.isFinite(r.unemployment) && Number.isFinite(r.arrears) && Number.isFinite(r.firmCash))
};
gates.ok = Object.values(gates).every(Boolean);

console.table(summary.filter(x => x.scaleProfile === 'baseline' && x.window === 'FULL').map(x => ({
  variant: x.variant,
  u: +x.unemployment.toFixed(4),
  exits: x.exits,
  arrears: +x.arrears.toFixed(0),
  fulfill: +x.fulfillment.toFixed(3),
  shortage: +x.shortage.toFixed(1),
  layoffs: x.layoffs,
  consumer: +x.consumerOutput.toFixed(1),
  cash: +x.firmCash.toFixed(0)
})));
console.log('WP_RV07_P74_INTERVENTIONS', JSON.stringify(runs.map(r => ({
  variant: r.variant,
  scaleProfile: r.scaleProfile,
  seed: r.seed,
  supportFloors: r.supportFloors,
  workersSaved: r.workersSaved,
  exitCandidates: r.exitCandidates,
  viableExitGuards: r.viableExitGuards,
  upperBoundSuppressions: r.upperBoundSuppressions
}))));
console.log('WP_RV07_P74_COMPARISONS', JSON.stringify(comparisons));
console.log('WP_RV07_P74_GATES', JSON.stringify(gates));
assert.ok(gates.ok, `WP-RV07-P74 gates failed ${JSON.stringify(gates)}`);

const payload = {
  workPackage: 'WP-RV07-P74',
  title: 'Solvency-aware propagation guard matrix',
  generatedAt: new Date().toISOString(),
  configuration: { variants, scales, seeds, months },
  gates,
  determinism,
  interventions: runs.map(r => ({
    variant: r.variant,
    scaleProfile: r.scaleProfile,
    seed: r.seed,
    normalizationApps: r.normalizationApps,
    supportFloors: r.supportFloors,
    workersSaved: r.workersSaved,
    exitCandidates: r.exitCandidates,
    viableExitGuards: r.viableExitGuards,
    upperBoundSuppressions: r.upperBoundSuppressions
  })),
  summary,
  comparisons,
  rows
};
if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(payload, null, 2));
  console.log('WP_RV07_P74_OUTPUT', outputJson);
}
