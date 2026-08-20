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

const variants = [
  { id: 'control', inputMode: 'canonical', deferCredit: false },
  { id: 'provisional-current-input', inputMode: 'provisional', deferCredit: false },
  { id: 'postplan-exact-input', inputMode: 'exact', deferCredit: true }
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

function supplierMean(country, product, fallback = 0) {
  const firms = country.firms.filter(f => f.active !== false && f.product === product && F(f.price) > EPS);
  return firms.length ? M(firms.map(f => f.price)) : fallback;
}

function unconstrainedPlan(f) {
  const anchor = Math.max(2, F(f.previousSales), F(f.targetInventory) * 0.42);
  const expected = anchor * (1 + CL(f.beliefs?.demandGrowth || 0, -0.18, 0.22));
  return Math.max(0, expected * 0.72 + Math.max(0, F(f.targetInventory) - F(f.inventory)));
}

function provisionalDesiredProduction(country, f) {
  const capitalEffect = 0.72 + Math.log1p(Math.max(0, F(f.capitalStock))) * 0.105;
  const humanEffect = 0.82 + F(country.humanCapital) * 0.30;
  const resourceEffect = f.industryId === 'RESOURCE' ? 0.62 + F(country.resourceBase) * 0.62 : 1;
  const planEffect = 1 + CL(f.currentPlan?.productionChange || 0, -0.12, 0.15);
  const capacity = Math.max(0, Math.max(0, F(f.desiredWorkers)) * F(f.productivity) * capitalEffect * humanEffect * resourceEffect * planEffect);
  return Math.max(0, Math.min(capacity * 1.08, unconstrainedPlan(f)));
}

function plannedInputRequirement(country, f, mode) {
  if (!f.inputProduct) return { units: 0, value: 0, plannedProduction: 0, supplierPrice: 0 };
  const plannedProduction = mode === 'exact' ? Math.max(0, F(f.desiredProduction)) : provisionalDesiredProduction(country, f);
  const onHand = Math.max(0, F(f.inputInventory?.[f.inputProduct]));
  const units = Math.max(0, plannedProduction * F(f.inputPerOutput) - onHand);
  const supplierPrice = supplierMean(country, f.inputProduct, Math.max(0.1, F(f.price)));
  return { units, value: units * supplierPrice, plannedProduction, supplierPrice };
}

function installApplicationMode(world, variant) {
  world.__r1ApplicationRows = [];
  world.__r1PlannedInputApplications = 0;
  if (variant.inputMode === 'canonical') return;

  world.banking.buildApplications = country => {
    const apps = [];

    for (const f of country.firms) {
      if (f.active === false) continue;
      const cash = world.ledger.balance(f.accountId);
      const payrollNeed = Math.max(1, F(f.wage) * Math.max(1, F(f.desiredWorkers)));
      const input = plannedInputRequirement(country, f, variant.inputMode);
      const inputNeed = input.value;
      const workingCapitalTarget = Math.max(payrollNeed * 1.8 + inputNeed * 0.6, F(f.safeCash) * 0.72);
      const shortfall = Math.max(0, workingCapitalTarget - cash);
      const expansionNeed = f.currentPlan?.selected === '확장' ? payrollNeed * 0.45 : 0;
      const amount = Math.min(Math.max(shortfall, expansionNeed), F(f.safeCash) * 0.75);
      const eligible = amount > payrollNeed * 0.12;
      if (inputNeed > EPS) world.__r1PlannedInputApplications += 1;
      world.__r1ApplicationRows.push({
        variant: variant.id,
        month: world.month,
        countryId: country.id,
        firmId: f.id,
        industryId: f.industryId,
        inputProduct: f.inputProduct,
        workers: F(f.workers),
        desiredWorkers: F(f.desiredWorkers),
        desiredProduction: F(f.desiredProduction),
        provisionalProduction: input.plannedProduction,
        inputUnitsNeed: input.units,
        inputNeed,
        supplierPrice: input.supplierPrice,
        payrollNeed,
        cash,
        workingCapitalTarget,
        amount,
        eligible
      });
      if (eligible) {
        apps.push({
          borrower: f,
          kind: 'firm',
          amount,
          cash,
          debt: F(f.loanBalance),
          arrears: F(f.wageArrears),
          incomeBase: Math.max(payrollNeed, F(f.revenue, payrollNeed)),
          termMonths: 18 + world.rng.int(0, 19)
        });
      }
    }

    for (const h of country.households) {
      const cash = world.ledger.balance(h.accountId);
      const incomeBase = Math.max(8, F(h.income, F(h.wage) * (h.employed ? 1 : 0.16)));
      const stressTarget = h.employed ? F(h.wage) * 0.65 : F(h.wage) * 1.25;
      const shortfall = Math.max(0, stressTarget - cash);
      if (shortfall > F(h.wage) * 0.18 && F(h.creditMisses) < 5) {
        apps.push({
          borrower: h,
          kind: 'household',
          amount: Math.min(shortfall, F(h.wage) * 1.6),
          cash,
          debt: F(h.loanBalance),
          arrears: F(h.wageArrears),
          incomeBase,
          termMonths: 10 + world.rng.int(0, 15)
        });
      }
    }

    apps.sort((a, b) => b.amount - a.amount);
    return apps.slice(0, Math.max(18, Math.round((country.firms.length + country.households.length) * 0.08)));
  };
}

function installDeferredCredit(world, variant) {
  world.__r1DeferredCreditCalls = 0;
  world.__r1DeferredMetrics = new Map();
  if (!variant.deferCredit) return;

  const originalOriginate = world.banking.originateCredit.bind(world.banking);
  const originalCombine = world.banking.combineMetrics.bind(world.banking);
  const originalPlan = world.supply.planProduction.bind(world.supply);
  const pending = new Map();

  world.banking.originateCredit = (country, month, signals) => {
    pending.set(country.id, { month, signals: C(signals) });
    return world.banking.emptyMetrics();
  };

  world.supply.planProduction = country => {
    const out = originalPlan(country);
    const request = pending.get(country.id);
    if (request) {
      const metrics = originalOriginate(country, request.month, request.signals);
      world.syncBalances(country);
      world.__r1DeferredMetrics.set(`${request.month}|${country.id}`, metrics);
      world.__r1DeferredCreditCalls += 1;
      pending.delete(country.id);
    }
    return out;
  };

  world.banking.combineMetrics = (service, originations, country) => {
    const deferred = world.__r1DeferredMetrics.get(`${world.month}|${country.id}`);
    return originalCombine(service, deferred || originations, country);
  };
}

function installEntrantTracking(world, variantId, scaleProfile, seedText) {
  world.__r1Entrants = new Map();
  world.__r1Lifecycle = [];
  const originalCreate = world.createEntrant.bind(world);
  world.createEntrant = (country, industryId) => {
    const f = originalCreate(country, industryId);
    world.__r1Entrants.set(f.id, {
      firmId: f.id,
      countryId: country.id,
      industryId: f.industryId,
      birthMonth: world.month,
      firstCreditMonth: null,
      firstOutputMonth: null,
      firstRevenueMonth: null,
      reexitMonth: null
    });
    return f;
  };

  world.__r1Capture = () => {
    for (const country of world.countries) {
      const originations = world.ledger.entriesFor({ month: world.month, countryId: country.id, kind: 'bank_loan_origination' });
      const creditByBorrower = new Map();
      for (const e of originations) {
        const id = e.meta?.borrowerId;
        if (id) creditByBorrower.set(id, F(creditByBorrower.get(id)) + F(e.amount));
      }
      for (const f of country.firms.filter(x => world.__r1Entrants.has(x.id))) {
        const meta = world.__r1Entrants.get(f.id);
        const credit = F(creditByBorrower.get(f.id));
        if (credit > EPS && meta.firstCreditMonth === null) meta.firstCreditMonth = world.month;
        if (F(f.output) > EPS && meta.firstOutputMonth === null) meta.firstOutputMonth = world.month;
        if (F(f.revenue) > EPS && meta.firstRevenueMonth === null) meta.firstRevenueMonth = world.month;
        if (f.active === false && meta.reexitMonth === null) meta.reexitMonth = world.month;
        world.__r1Lifecycle.push({
          variant: variantId,
          scaleProfile,
          seed: seedText,
          month: world.month,
          countryId: country.id,
          firmId: f.id,
          industryId: f.industryId,
          birthMonth: meta.birthMonth,
          active: f.active !== false,
          workers: F(f.workers),
          cash: world.ledger.balance(f.accountId),
          credit,
          loanBalance: F(f.loanBalance),
          inputSpend: F(f.inputSpend),
          supplyShortage: F(f.supplyShortage),
          output: F(f.output),
          revenue: F(f.revenue),
          wageArrears: F(f.wageArrears)
        });
      }
    }
  };
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

function row(world, variant, scaleProfile, seedText, country) {
  const macro = country.macro || {};
  return {
    variant: variant.id,
    scaleProfile,
    seed: seedText,
    month: world.month,
    countryId: country.id,
    unemployment: F(macro.unemployment),
    exits: F(macro.firmExits),
    entries: F(macro.firmEntries),
    wageArrears: F(macro.wageArrears),
    goodsFulfillment: 1 - F(macro.unmetDemandRatio),
    inputShortage: F(macro.inputShortageUnits),
    resourceOutput: F(macro.resourceOutput),
    materialsOutput: F(macro.materialsOutput),
    consumerOutput: F(macro.consumerGoodsOutput),
    firmCash: F(macro.firmCash),
    creditApplications: F(macro.creditApplications),
    creditApproved: F(macro.creditApproved),
    newCredit: F(macro.newCredit)
  };
}

function runVariant(variant, scaleProfile, seedText, horizon, observe = true, captureFingerprint = false) {
  const world = makeWorld(scaleProfile, seedText);
  installApplicationMode(world, variant);
  installDeferredCredit(world, variant);
  if (observe) installEntrantTracking(world, variant.id, scaleProfile, seedText);
  const rows = [];
  for (let i = 0; i < horizon; i++) {
    world.stepMonth();
    if (observe) world.__r1Capture();
    for (const country of world.countries) rows.push(row(world, variant, scaleProfile, seedText, country));
  }
  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${variant.id}/${scaleProfile}/${seedText}: health`);
  const ledgerOk = world.countries.every(c => world.ledger.verifyCountry(c.id)?.ok === true);
  const maxGdpResidual = Math.max(0, ...world.countries.map(c => Math.abs(gdpResidual(c.macro))));
  return {
    variant: variant.id,
    scaleProfile,
    seed: seedText,
    rows,
    entrants: observe ? [...world.__r1Entrants.values()].map(C) : [],
    lifecycle: observe ? world.__r1Lifecycle.map(C) : [],
    applicationRows: world.__r1ApplicationRows?.map(C) || [],
    plannedInputApplications: world.__r1PlannedInputApplications || 0,
    deferredCreditCalls: world.__r1DeferredCreditCalls || 0,
    health,
    ledgerOk,
    maxGdpResidual,
    fingerprint: captureFingerprint ? digest(world) : null
  };
}

const niScale = scales[0];
const niSeed = 'ECON-RV08-R1-NI';
const niHorizon = Math.min(5, months);
const niA = runVariant(variants[0], niScale, niSeed, niHorizon, false, true).fingerprint;
const niB = runVariant(variants[0], niScale, niSeed, niHorizon, true, true).fingerprint;
const controlObserverNonInterferenceExact = niA === niB;
assert.ok(controlObserverNonInterferenceExact, 'R1 control observer must not alter economy');

const deterministic = [];
for (const variant of variants) {
  for (const scaleProfile of scales) {
    const seed = `ECON-RV08-R1-DET-${variant.id}-${scaleProfile}`;
    const horizon = Math.min(5, months);
    const a = runVariant(variant, scaleProfile, seed, horizon, true, true).fingerprint;
    const b = runVariant(variant, scaleProfile, seed, horizon, true, true).fingerprint;
    assert.equal(a, b, `${variant.id}/${scaleProfile}: deterministic replay`);
    deterministic.push({ variant: variant.id, scaleProfile, exact: true });
  }
}

const runs = [];
for (const variant of variants) {
  for (const scaleProfile of scales) {
    for (const seed of seeds) runs.push(runVariant(variant, scaleProfile, seed, months, true, false));
  }
}

const rows = runs.flatMap(r => r.rows);
const entrants = runs.flatMap(r => r.entrants.map(x => ({ ...x, variant: r.variant, scaleProfile: r.scaleProfile, seed: r.seed })));
const lifecycle = runs.flatMap(r => r.lifecycle);
const applicationRows = runs.flatMap(r => r.applicationRows.map(x => ({ ...x, scaleProfile: r.scaleProfile, seed: r.seed })));
const windows = [['M1-3', 1, 3], ['M4-6', 4, 6], ['M7-9', 7, 9], ['M10-12', 10, months], ['FULL', 1, months]].filter(x => x[1] <= x[2]);

function aggregate(rs) {
  return {
    observations: rs.length,
    unemployment: M(rs.map(r => r.unemployment)),
    exits: S(rs.map(r => r.exits)),
    entries: S(rs.map(r => r.entries)),
    wageArrears: M(rs.map(r => r.wageArrears)),
    goodsFulfillment: M(rs.map(r => r.goodsFulfillment)),
    inputShortage: M(rs.map(r => r.inputShortage)),
    resourceOutput: M(rs.map(r => r.resourceOutput)),
    materialsOutput: M(rs.map(r => r.materialsOutput)),
    consumerOutput: M(rs.map(r => r.consumerOutput)),
    firmCash: M(rs.map(r => r.firmCash)),
    creditApplications: S(rs.map(r => r.creditApplications)),
    creditApproved: S(rs.map(r => r.creditApproved)),
    newCredit: S(rs.map(r => r.newCredit))
  };
}

const summary = [];
for (const variant of variants) {
  for (const scaleProfile of scales) {
    for (const [window, a, b] of windows) {
      summary.push({
        variant: variant.id,
        scaleProfile,
        window,
        ...aggregate(rows.filter(r => r.variant === variant.id && r.scaleProfile === scaleProfile && r.month >= a && r.month <= b))
      });
    }
  }
}

function entrantSummary(variantId, scaleProfile) {
  const es = entrants.filter(e => e.variant === variantId && e.scaleProfile === scaleProfile);
  const ids = new Set(es.map(e => `${e.seed}|${e.countryId}|${e.firmId}`));
  const ls = lifecycle.filter(x => x.variant === variantId && x.scaleProfile === scaleProfile && ids.has(`${x.seed}|${x.countryId}|${x.firmId}`));
  const ever = predicate => es.length ? es.filter(e => {
    const key = `${e.seed}|${e.countryId}|${e.firmId}`;
    return ls.filter(x => `${x.seed}|${x.countryId}|${x.firmId}` === key).some(predicate);
  }).length / es.length : 0;
  return {
    variant: variantId,
    scaleProfile,
    births: es.length,
    everCreditShare: ever(x => x.credit > EPS),
    everOutputShare: ever(x => x.output > EPS),
    everRevenueShare: ever(x => x.revenue > EPS),
    reexitShare: ever(x => x.active === false)
  };
}

const entrantSummaryRows = [];
for (const variant of variants) for (const scaleProfile of scales) entrantSummaryRows.push(entrantSummary(variant.id, scaleProfile));

const interventionSummary = runs.map(r => ({
  variant: r.variant,
  scaleProfile: r.scaleProfile,
  seed: r.seed,
  plannedInputApplications: r.plannedInputApplications,
  deferredCreditCalls: r.deferredCreditCalls
}));

const gates = {
  controlObserverNonInterferenceExact,
  deterministicReplayExact: deterministic.every(x => x.exact),
  allHealthy: runs.every(r => r.health.ok),
  completeCoverage: runs.length === variants.length * scales.length * seeds.length,
  ledgerCountriesOk: runs.every(r => r.ledgerOk),
  gdpIdentityReconciled: runs.every(r => r.maxGdpResidual <= 1e-7),
  plannedInputInterventionActivated: runs.filter(r => r.variant !== 'control').some(r => r.plannedInputApplications > 0),
  deferredCreditInterventionActivated: runs.filter(r => r.variant === 'postplan-exact-input').every(r => r.deferredCreditCalls > 0),
  finiteRows: rows.every(r => Object.values(r).every(v => typeof v !== 'number' || Number.isFinite(v))),
  entrantLifecycleFinite: lifecycle.every(r => Object.values(r).every(v => typeof v !== 'number' || Number.isFinite(v)))
};
gates.ok = Object.values(gates).every(Boolean);
assert.ok(gates.ok, `RV08-R1 gates ${JSON.stringify(gates)}`);

console.table(summary.filter(x => x.scaleProfile === 'baseline' && x.window === 'FULL').map(x => ({
  variant: x.variant,
  u: +x.unemployment.toFixed(4),
  exits: x.exits,
  arrears: +x.wageArrears.toFixed(0),
  fulfillment: +x.goodsFulfillment.toFixed(3),
  shortage: +x.inputShortage.toFixed(1),
  consumer: +x.consumerOutput.toFixed(1),
  approvals: x.creditApproved,
  credit: +x.newCredit.toFixed(0)
})));
console.table(entrantSummaryRows.filter(x => x.scaleProfile === 'baseline').map(x => ({
  variant: x.variant,
  births: x.births,
  credit: +x.everCreditShare.toFixed(3),
  output: +x.everOutputShare.toFixed(3),
  revenue: +x.everRevenueShare.toFixed(3),
  reexit: +x.reexitShare.toFixed(3)
})));
console.log('WP_RV08_R1_INTERVENTIONS', JSON.stringify(interventionSummary));
console.log('WP_RV08_R1_ENTRANTS', JSON.stringify(entrantSummaryRows));
console.log('WP_RV08_R1_SUMMARY', JSON.stringify(summary));
console.log('WP_RV08_R1_GATES', JSON.stringify(gates));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify({
    workPackage: 'WP-RV08-R1',
    title: 'Current-plan working-capital timing experiment',
    note: 'Experimental structural repair isolation. No underwriting threshold or fitted macro parameter is changed.',
    generatedAt: new Date().toISOString(),
    configuration: { variants, scales, seeds, months },
    gates,
    interventionSummary,
    entrantSummary: entrantSummaryRows,
    summary,
    applicationRows,
    lifecycle
  }, null, 2));
  console.log('WP_RV08_R1_OUTPUT', outputJson);
}
