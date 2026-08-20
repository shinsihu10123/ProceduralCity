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
const CL = (x, l, h) => Math.max(l, Math.min(h, F(x)));

const scenarios = [
  { id: 'unit-basis-control', sectors: new Set() },
  { id: 'consumer-normalized', sectors: new Set(['CONSUMER']) },
  { id: 'materials-consumer-normalized', sectors: new Set(['MATERIALS', 'CONSUMER']) }
];

function transformedSeeds() {
  return COUNTRY_SEEDS.map(seed => ({ ...seed, initialPrice: Math.max(EPS, F(seed.initialWage, F(seed.initialPrice, 1))) }));
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

function unconstrainedPlan(f) {
  const anchor = Math.max(2, F(f.previousSales), F(f.targetInventory) * 0.42);
  const expected = anchor * (1 + CL(f.beliefs?.demandGrowth || 0, -0.18, 0.22));
  return Math.max(0, expected * 0.72 + Math.max(0, F(f.targetInventory) - F(f.inventory)));
}

function installNormalization(world, scenario) {
  world.__p75NormalizationApps = 0;
  if (!scenario.sectors.size) return;
  const done = new Set();
  const original = world.supply.planProduction.bind(world.supply);
  world.supply.planProduction = country => {
    const out = original(country);
    if (done.has(country.id)) return out;
    const upstream = {
      raw_material: supplierMean(country, 'raw_material'),
      processed_material: supplierMean(country, 'processed_material')
    };
    for (const f of country.firms.filter(x => x.active !== false && scenario.sectors.has(x.industryId))) {
      const inputCost = F(f.inputPerOutput) * (f.inputProduct ? F(upstream[f.inputProduct]) : 0);
      const margin = F(f.price) - inputCost;
      const payroll = F(f.wage) * F(f.workers);
      const baseCapacity = F(f.capacity);
      const requiredFactor = margin > EPS && baseCapacity > EPS ? payroll / (margin * baseCapacity) : Infinity;
      const factor = Number.isFinite(requiredFactor) ? Math.max(1, requiredFactor) : 1;
      if (factor > 1 + TOL) {
        f.productivity *= factor;
        f.capacity = baseCapacity * factor;
        f.desiredProduction = Math.max(0, Math.min(f.capacity * 1.08, unconstrainedPlan(f)));
        world.__p75NormalizationApps += 1;
      }
    }
    done.add(country.id);
    return out;
  };
}

function installEntrantAudit(world, scenarioId, scaleProfile, seedText) {
  world.__p75Entrants = new Map();
  world.__p75CreditStages = [];
  world.__p75Lifecycle = [];

  const originalCreate = world.createEntrant.bind(world);
  world.createEntrant = (country, industryId) => {
    const entrant = originalCreate(country, industryId);
    world.__p75Entrants.set(entrant.id, {
      firmId: entrant.id,
      countryId: country.id,
      industryId: entrant.industryId,
      inputProduct: entrant.inputProduct,
      birthMonth: world.month,
      birthWorkers: F(entrant.workers),
      birthDesiredWorkers: F(entrant.desiredWorkers),
      birthCash: world.ledger.balance(entrant.accountId),
      birthCapitalStock: F(entrant.capitalStock),
      birthInventory: F(entrant.inventory),
      firstCreditMonth: null,
      firstOutputMonth: null,
      firstRevenueMonth: null,
      firstHireMonth: null,
      reexitMonth: null
    });
    return entrant;
  };

  const originalBuild = world.banking.buildApplications.bind(world.banking);
  world.banking.buildApplications = country => {
    const apps = originalBuild(country);
    const queuedFirmIds = new Set(apps.filter(a => a.kind === 'firm').map(a => a.borrower.id));
    const queuedAmounts = new Map(apps.filter(a => a.kind === 'firm').map(a => [a.borrower.id, F(a.amount)]));
    for (const f of country.firms.filter(x => x.active !== false && world.__p75Entrants.has(x.id))) {
      const cash = world.ledger.balance(f.accountId);
      const payrollNeed = Math.max(1, F(f.wage) * Math.max(1, F(f.desiredWorkers)));
      const inputNeed = Math.max(0, F(f.supplyShortage) * Math.max(0.1, F(f.price)));
      const workingCapitalTarget = Math.max(payrollNeed * 1.8 + inputNeed * 0.6, F(f.safeCash) * 0.72);
      const shortfall = Math.max(0, workingCapitalTarget - cash);
      const expansionNeed = f.currentPlan?.selected === '확장' ? payrollNeed * 0.45 : 0;
      const amount = Math.min(Math.max(shortfall, expansionNeed), F(f.safeCash) * 0.75);
      const mechanicallyEligible = amount > payrollNeed * 0.12;
      world.__p75CreditStages.push({
        scenario: scenarioId,
        scaleProfile,
        seed: seedText,
        month: world.month,
        countryId: country.id,
        firmId: f.id,
        industryId: f.industryId,
        ageMonths: world.month - world.__p75Entrants.get(f.id).birthMonth,
        cash,
        workers: F(f.workers),
        desiredWorkers: F(f.desiredWorkers),
        wage: F(f.wage),
        payrollNeed,
        supplyShortageObservedAtCredit: F(f.supplyShortage),
        inputNeedObservedAtCredit: inputNeed,
        workingCapitalTarget,
        computedAmount: amount,
        mechanicallyEligible,
        selectedInActualQueue: queuedFirmIds.has(f.id),
        queuedAmount: F(queuedAmounts.get(f.id))
      });
    }
    return apps;
  };
}

function captureLifecycle(world, scenarioId, scaleProfile, seedText) {
  for (const country of world.countries) {
    const originations = world.ledger.entriesFor({ month: world.month, countryId: country.id, kind: 'bank_loan_origination' });
    const creditByBorrower = new Map();
    for (const e of originations) {
      const borrowerId = e.meta?.borrowerId;
      if (!borrowerId) continue;
      creditByBorrower.set(borrowerId, F(creditByBorrower.get(borrowerId)) + F(e.amount));
    }
    for (const f of country.firms.filter(x => world.__p75Entrants.has(x.id))) {
      const meta = world.__p75Entrants.get(f.id);
      const credit = F(creditByBorrower.get(f.id));
      if (credit > EPS && meta.firstCreditMonth === null) meta.firstCreditMonth = world.month;
      if (F(f.workers) > 0 && meta.firstHireMonth === null) meta.firstHireMonth = world.month;
      if (F(f.output) > EPS && meta.firstOutputMonth === null) meta.firstOutputMonth = world.month;
      if (F(f.revenue) > EPS && meta.firstRevenueMonth === null) meta.firstRevenueMonth = world.month;
      if (f.active === false && meta.reexitMonth === null) meta.reexitMonth = world.month;
      world.__p75Lifecycle.push({
        scenario: scenarioId,
        scaleProfile,
        seed: seedText,
        month: world.month,
        countryId: country.id,
        firmId: f.id,
        industryId: f.industryId,
        inputProduct: f.inputProduct,
        birthMonth: meta.birthMonth,
        ageMonths: world.month - meta.birthMonth,
        active: f.active !== false,
        workers: F(f.workers),
        desiredWorkers: F(f.desiredWorkers),
        cash: world.ledger.balance(f.accountId),
        creditOriginated: credit,
        loanBalance: F(f.loanBalance),
        inputSpend: F(f.inputSpend),
        supplyShortage: F(f.supplyShortage),
        output: F(f.output),
        revenue: F(f.revenue),
        inventory: F(f.inventory),
        capitalStock: F(f.capitalStock),
        wageArrears: F(f.wageArrears)
      });
    }
  }
}

function gdpResidual(m) {
  return F(m?.gdp) - (F(m?.consumption) + F(m?.grossInvestment) + F(m?.publicInvestment) + F(m?.governmentConsumption) + F(m?.inventoryInvestment) + F(m?.netExports));
}

function digest(world) {
  const h = createHash('sha256');
  const put = v => h.update(JSON.stringify(v));
  put({ month: world.month, rng: world.rng });
  for (const c of world.countries) {
    put(c);
    put(world.accountingReport(c.id));
  }
  for (const e of world.ledger.entries) put(e);
  return h.digest('hex');
}

function runScenario(scenario, scaleProfile, seedText, horizon, observe = true, capture = false) {
  const world = makeWorld(scaleProfile, seedText);
  installNormalization(world, scenario);
  if (observe) installEntrantAudit(world, scenario.id, scaleProfile, seedText);
  for (let i = 0; i < horizon; i++) {
    world.stepMonth();
    if (observe) captureLifecycle(world, scenario.id, scaleProfile, seedText);
  }
  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${scenario.id}/${scaleProfile}/${seedText}: health`);
  const ledgerOk = world.countries.every(c => world.ledger.verifyCountry(c.id)?.ok === true);
  const maxGdpResidual = Math.max(0, ...world.countries.map(c => Math.abs(gdpResidual(c.macro))));
  return {
    scenario: scenario.id,
    scaleProfile,
    seed: seedText,
    health,
    ledgerOk,
    maxGdpResidual,
    normalizationApps: world.__p75NormalizationApps || 0,
    entrants: observe ? [...world.__p75Entrants.values()].map(C) : [],
    creditStages: observe ? world.__p75CreditStages.map(C) : [],
    lifecycle: observe ? world.__p75Lifecycle.map(C) : [],
    fingerprint: capture ? digest(world) : null
  };
}

const niScale = scales[0];
const niSeed = 'ECON-RV07-P75-NI';
const niHorizon = Math.min(6, months);
const niA = runScenario(scenarios[0], niScale, niSeed, niHorizon, false, true).fingerprint;
const niB = runScenario(scenarios[0], niScale, niSeed, niHorizon, true, true).fingerprint;
const observerNonInterferenceExact = niA === niB;
assert.ok(observerNonInterferenceExact, 'P75 observer must not alter economy');

const determinism = [];
for (const scenario of scenarios) {
  for (const scaleProfile of scales) {
    const seed = `ECON-RV07-P75-DET-${scenario.id}-${scaleProfile}`;
    const horizon = Math.min(6, months);
    const a = runScenario(scenario, scaleProfile, seed, horizon, true, true).fingerprint;
    const b = runScenario(scenario, scaleProfile, seed, horizon, true, true).fingerprint;
    assert.equal(a, b, `${scenario.id}/${scaleProfile}: deterministic replay`);
    determinism.push({ scenario: scenario.id, scaleProfile, exact: true });
  }
}

const runs = [];
for (const scenario of scenarios) {
  for (const scaleProfile of scales) {
    for (const seed of seeds) runs.push(runScenario(scenario, scaleProfile, seed, months, true, false));
  }
}

const entrants = runs.flatMap(r => r.entrants.map(x => ({ ...x, scenario: r.scenario, scaleProfile: r.scaleProfile, seed: r.seed })));
const creditStages = runs.flatMap(r => r.creditStages);
const lifecycle = runs.flatMap(r => r.lifecycle);
const industries = ['RESOURCE', 'MATERIALS', 'CAPITAL', 'CONSUMER'];

function summarizeEntrants(scenarioId, scaleProfile, industryId) {
  const es = entrants.filter(e => e.scenario === scenarioId && e.scaleProfile === scaleProfile && e.industryId === industryId);
  const ids = new Set(es.map(e => `${e.seed}|${e.countryId}|${e.firmId}`));
  const cs = creditStages.filter(x => x.scenario === scenarioId && x.scaleProfile === scaleProfile && x.industryId === industryId && ids.has(`${x.seed}|${x.countryId}|${x.firmId}`));
  const ls = lifecycle.filter(x => x.scenario === scenarioId && x.scaleProfile === scaleProfile && x.industryId === industryId && ids.has(`${x.seed}|${x.countryId}|${x.firmId}`));
  const firstCreditCycles = cs.filter(x => x.ageMonths === 1);
  const downstreamFirst = firstCreditCycles.filter(x => x.industryId !== 'RESOURCE');
  const downstreamLater = ls.filter(x => x.ageMonths === 1 && x.inputProduct);
  const ever = predicate => es.length ? es.filter(e => {
    const key = `${e.seed}|${e.countryId}|${e.firmId}`;
    return ls.filter(x => `${x.seed}|${x.countryId}|${x.firmId}` === key).some(predicate);
  }).length / es.length : 0;
  return {
    scenario: scenarioId,
    scaleProfile,
    industryId,
    births: es.length,
    birthZeroCashShare: es.length ? es.filter(e => Math.abs(e.birthCash) < TOL).length / es.length : 0,
    creditCycleObservations: cs.length,
    mechanicalEligibilityShare: cs.length ? cs.filter(x => x.mechanicallyEligible).length / cs.length : 0,
    actualQueueShare: cs.length ? cs.filter(x => x.selectedInActualQueue).length / cs.length : 0,
    queueGivenEligibleShare: cs.filter(x => x.mechanicallyEligible).length ? cs.filter(x => x.mechanicallyEligible && x.selectedInActualQueue).length / cs.filter(x => x.mechanicallyEligible).length : 0,
    firstCycleInputNeedZeroShare: downstreamFirst.length ? downstreamFirst.filter(x => Math.abs(x.inputNeedObservedAtCredit) < TOL).length / downstreamFirst.length : 0,
    firstCycleLaterPositiveInputSpendShare: downstreamLater.length ? downstreamLater.filter(x => x.inputSpend > EPS).length / downstreamLater.length : 0,
    firstCycleLaterPositiveShortageShare: downstreamLater.length ? downstreamLater.filter(x => x.supplyShortage > EPS).length / downstreamLater.length : 0,
    everCreditShare: ever(x => x.creditOriginated > EPS),
    everHireShare: ever(x => x.workers > 0),
    everOutputShare: ever(x => x.output > EPS),
    everRevenueShare: ever(x => x.revenue > EPS),
    reexitShare: es.length ? es.filter(e => e.reexitMonth !== null).length / es.length : 0,
    meanCreditWhenPositive: M(ls.filter(x => x.creditOriginated > EPS).map(x => x.creditOriginated)),
    meanFirstCyclePayrollNeed: M(firstCreditCycles.map(x => x.payrollNeed)),
    meanFirstCycleWorkingCapitalTarget: M(firstCreditCycles.map(x => x.workingCapitalTarget))
  };
}

const summary = [];
for (const scenario of scenarios) {
  for (const scaleProfile of scales) {
    for (const industryId of industries) summary.push(summarizeEntrants(scenario.id, scaleProfile, industryId));
  }
}

const maxGdpResidual = Math.max(0, ...runs.map(r => r.maxGdpResidual));
const gates = {
  observerNonInterferenceExact,
  deterministicReplayExact: determinism.every(x => x.exact),
  allHealthy: runs.every(r => r.health?.ok === true),
  completeRunCoverage: runs.length === scenarios.length * scales.length * seeds.length,
  entrantBirthsObserved: entrants.length > 0,
  applicationCaptureExercised: creditStages.length > 0,
  ledgerCountriesOk: runs.every(r => r.ledgerOk),
  gdpIdentityReconciled: maxGdpResidual < TOL,
  finiteLifecycleRows: lifecycle.every(x => [x.cash, x.creditOriginated, x.inputSpend, x.supplyShortage, x.output, x.revenue].every(Number.isFinite))
};
gates.ok = Object.values(gates).every(Boolean);
assert.ok(gates.ok, `WP-RV07-P75 gates failed ${JSON.stringify(gates)}`);

console.table(summary.filter(x => x.scaleProfile === 'baseline').map(x => ({
  scenario: x.scenario,
  industry: x.industryId,
  births: x.births,
  eligible: +x.mechanicalEligibilityShare.toFixed(3),
  queued: +x.actualQueueShare.toFixed(3),
  everCredit: +x.everCreditShare.toFixed(3),
  inputNeedZero: +x.firstCycleInputNeedZeroShare.toFixed(3),
  laterShort: +x.firstCycleLaterPositiveShortageShare.toFixed(3),
  output: +x.everOutputShare.toFixed(3),
  revenue: +x.everRevenueShare.toFixed(3),
  reexit: +x.reexitShare.toFixed(3)
})));
console.log('WP_RV07_P75_SUMMARY', JSON.stringify(summary));
console.log('WP_RV07_P75_GATES', JSON.stringify(gates));

const payload = {
  workPackage: 'WP-RV07-P75',
  title: 'Replacement entrant credit-path and regeneration audit',
  generatedAt: new Date().toISOString(),
  configuration: { scenarios: scenarios.map(x => ({ id: x.id, sectors: [...x.sectors] })), scales, seeds, months },
  gates,
  determinism,
  summary,
  entrants,
  creditStages,
  lifecycle
};
if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(payload, null, 2));
  console.log('WP_RV07_P75_OUTPUT', outputJson);
}
