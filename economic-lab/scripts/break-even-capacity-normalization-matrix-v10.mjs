import assert from 'node:assert/strict';
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
const finite = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
const sum = a => a.reduce((s, v) => s + finite(v), 0);
const mean = a => a.length ? sum(a) / a.length : 0;
const ratio = (a, b) => Math.abs(finite(b)) > EPS ? finite(a) / finite(b) : 0;
const clone = v => structuredClone(v);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, finite(x)));

const variantTargets = {
  'unit-basis-control': [],
  'unit-basis-resource-capacity': ['RESOURCE'],
  'unit-basis-materials-capacity': ['MATERIALS'],
  'unit-basis-consumer-capacity': ['CONSUMER'],
  'unit-basis-capital-capacity': ['CAPITAL'],
  'unit-basis-upstream-capacity': ['RESOURCE', 'MATERIALS'],
  'unit-basis-noncapital-capacity': ['RESOURCE', 'MATERIALS', 'CONSUMER']
};
const variants = Object.keys(variantTargets);

function transformedSeeds() {
  return COUNTRY_SEEDS.map(seed => ({
    ...seed,
    initialPrice: Math.max(EPS, finite(seed.initialWage, finite(seed.initialPrice, 1)))
  }));
}

function createWorld(scaleProfile, seedText) {
  const original = COUNTRY_SEEDS.map(clone);
  COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...transformedSeeds());
  try {
    return new EconomicWorld(seedText, { scaleProfile, healthCheckInterval: 0 });
  } finally {
    COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...original);
  }
}

function gdpResidual(m) {
  return finite(m?.gdp) - (
    finite(m?.consumption) +
    finite(m?.grossInvestment) +
    finite(m?.publicInvestment) +
    finite(m?.governmentConsumption) +
    finite(m?.inventoryInvestment) +
    finite(m?.netExports)
  );
}

function fingerprint(world) {
  return {
    month: world.month,
    rng: clone(world.rng),
    countries: clone(world.countries),
    ledgerEntries: clone(world.ledger.entries),
    accounting: world.countries.map(c => ({ id: c.id, report: world.accountingReport(c.id) }))
  };
}

function supplierMean(country, product) {
  const firms = country.firms.filter(f => f.active !== false && f.product === product && finite(f.price) > EPS);
  return firms.length ? mean(firms.map(f => f.price)) : 0;
}

function unconstrainedPlan(f) {
  const demandAnchor = Math.max(2, finite(f.previousSales), finite(f.targetInventory) * 0.42);
  const expectedDemand = demandAnchor * (1 + clamp(f.beliefs?.demandGrowth || 0, -0.18, 0.22));
  const replenishment = Math.max(0, finite(f.targetInventory) - finite(f.inventory));
  return Math.max(0, expectedDemand * 0.72 + replenishment);
}

function installCapacityNormalization(world, variant) {
  const targets = new Set(variantTargets[variant]);
  world.__rv07P35 = { applications: 0, checks: [] };
  if (!targets.size) return;

  const plan = world.supply.planProduction.bind(world.supply);
  world.supply.planProduction = country => {
    const out = plan(country);
    const upstreamPrices = {
      raw_material: supplierMean(country, 'raw_material'),
      processed_material: supplierMean(country, 'processed_material')
    };

    for (const f of country.firms.filter(x => x.active !== false)) {
      const targeted = targets.has(f.industryId);
      const canonicalCapacity = finite(f.capacity);
      const canonicalDesired = finite(f.desiredProduction);
      const upstreamPrice = f.inputProduct ? finite(upstreamPrices[f.inputProduct]) : 0;
      const inputCostPerUnit = finite(f.inputPerOutput) * upstreamPrice;
      const unitLaborMargin = finite(f.price) - inputCostPerUnit;
      const payroll = finite(f.wage) * finite(f.workers);
      const breakEvenCapacity = unitLaborMargin > EPS ? payroll / unitLaborMargin : Infinity;
      const uPlan = unconstrainedPlan(f);
      let applied = false;

      if (targeted && Number.isFinite(breakEvenCapacity) && breakEvenCapacity > canonicalCapacity + TOL) {
        f.capacity = breakEvenCapacity;
        f.desiredProduction = Math.max(0, Math.min(f.capacity * 1.08, uPlan));
        world.__rv07P35.applications += 1;
        applied = true;
      }

      world.__rv07P35.checks.push({
        month: world.month,
        countryId: country.id,
        firmId: f.id,
        industryId: f.industryId,
        targeted,
        applied,
        canonicalCapacity,
        finalCapacity: finite(f.capacity),
        canonicalDesired,
        finalDesired: finite(f.desiredProduction),
        unconstrainedPlan: uPlan,
        payroll,
        price: finite(f.price),
        upstreamPrice,
        inputCostPerUnit,
        unitLaborMargin,
        breakEvenCapacity: Number.isFinite(breakEvenCapacity) ? breakEvenCapacity : null,
        infeasibleAtCurrentPrice: unitLaborMargin <= EPS
      });
    }
    return out;
  };
}

function runVariant(variant, scaleProfile, seed, horizon, captureFingerprint = false) {
  const world = createWorld(scaleProfile, seed);
  installCapacityNormalization(world, variant);
  const rows = [];

  for (let i = 0; i < horizon; i++) {
    world.stepMonth();
    for (const c of world.countries) {
      rows.push({
        variant,
        scaleProfile,
        seed,
        month: world.month,
        countryId: c.id,
        unemployment: finite(c.macro?.unemployment),
        exits: finite(c.macro?.firmExits),
        wageArrears: finite(c.macro?.wageArrears),
        goodsFulfillment: 1 - finite(c.macro?.unmetDemandRatio),
        inputShortage: finite(c.macro?.inputShortageUnits),
        resourceOutput: finite(c.macro?.resourceOutput),
        materialsOutput: finite(c.macro?.materialsOutput),
        capitalOutput: finite(c.macro?.capitalGoodsOutput),
        consumerOutput: finite(c.macro?.consumerGoodsOutput),
        priceIndex: finite(c.macro?.priceIndex),
        nominalSales: finite(c.macro?.nominalSales),
        firmCash: finite(c.macro?.firmCash),
        wageBill: finite(c.macro?.wageBill),
        gdp: finite(c.macro?.gdp),
        gdpResidual: gdpResidual(c.macro),
        ledgerOk: world.ledger.verifyCountry(c.id)?.ok === true
      });
    }
  }

  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${variant}/${scaleProfile}/${seed}: health failed`);
  return {
    variant,
    scaleProfile,
    seed,
    rows,
    checks: world.__rv07P35?.checks || [],
    applications: world.__rv07P35?.applications || 0,
    health,
    fingerprint: captureFingerprint ? fingerprint(world) : null
  };
}

const determinism = [];
for (const variant of variants) {
  for (const scaleProfile of scales) {
    const seed = `ECON-RV07-P35-DET-${variant}-${scaleProfile}`;
    const h = Math.min(3, months);
    const a = runVariant(variant, scaleProfile, seed, h, true).fingerprint;
    const b = runVariant(variant, scaleProfile, seed, h, true).fingerprint;
    const exact = JSON.stringify(a) === JSON.stringify(b);
    assert.ok(exact, `${variant}/${scaleProfile}: nondeterministic`);
    determinism.push({ variant, scaleProfile, exact });
  }
}

const runs = [];
for (const variant of variants) {
  for (const scaleProfile of scales) {
    for (const seed of seeds) runs.push(runVariant(variant, scaleProfile, seed, months, false));
  }
}

const rows = runs.flatMap(r => r.rows);
const checks = runs.flatMap(r => r.checks.map(x => ({
  ...x,
  variant: r.variant,
  scaleProfile: r.scaleProfile,
  seed: r.seed
})));

const windows = [
  { id: 'M1-3', from: 1, to: Math.min(3, months) },
  { id: 'M4-6', from: 4, to: Math.min(6, months) },
  { id: 'M7-9', from: 7, to: Math.min(9, months) },
  { id: 'M10-12', from: 10, to: months },
  { id: 'FULL', from: 1, to: months }
].filter(w => w.from <= w.to);

function aggregate(rs) {
  return {
    countryMonths: rs.length,
    meanUnemployment: mean(rs.map(r => r.unemployment)),
    totalExits: sum(rs.map(r => r.exits)),
    meanWageArrears: mean(rs.map(r => r.wageArrears)),
    meanGoodsFulfillment: mean(rs.map(r => r.goodsFulfillment)),
    meanInputShortage: mean(rs.map(r => r.inputShortage)),
    meanResourceOutput: mean(rs.map(r => r.resourceOutput)),
    meanMaterialsOutput: mean(rs.map(r => r.materialsOutput)),
    meanCapitalOutput: mean(rs.map(r => r.capitalOutput)),
    meanConsumerOutput: mean(rs.map(r => r.consumerOutput)),
    meanPriceIndex: mean(rs.map(r => r.priceIndex)),
    meanNominalSales: mean(rs.map(r => r.nominalSales)),
    meanFirmCash: mean(rs.map(r => r.firmCash)),
    meanWageBill: mean(rs.map(r => r.wageBill)),
    meanGdp: mean(rs.map(r => r.gdp))
  };
}

const summary = [];
for (const variant of variants) {
  for (const scaleProfile of scales) {
    for (const w of windows) {
      summary.push({
        variant,
        scaleProfile,
        window: w.id,
        ...aggregate(rows.filter(r =>
          r.variant === variant &&
          r.scaleProfile === scaleProfile &&
          r.month >= w.from && r.month <= w.to
        ))
      });
    }
  }
}

const comparison = {};
for (const scaleProfile of scales) {
  comparison[scaleProfile] = {};
  for (const variant of variants.filter(v => v !== 'unit-basis-control')) {
    comparison[scaleProfile][variant] = {};
    for (const w of windows) {
      const c = summary.find(x => x.variant === 'unit-basis-control' && x.scaleProfile === scaleProfile && x.window === w.id);
      const a = summary.find(x => x.variant === variant && x.scaleProfile === scaleProfile && x.window === w.id);
      comparison[scaleProfile][variant][w.id] = {
        unemploymentDifference: a.meanUnemployment - c.meanUnemployment,
        exitDifference: a.totalExits - c.totalExits,
        wageArrearsDifference: a.meanWageArrears - c.meanWageArrears,
        goodsFulfillmentDifference: a.meanGoodsFulfillment - c.meanGoodsFulfillment,
        inputShortageDifference: a.meanInputShortage - c.meanInputShortage,
        resourceOutputRatio: ratio(a.meanResourceOutput, c.meanResourceOutput),
        materialsOutputRatio: ratio(a.meanMaterialsOutput, c.meanMaterialsOutput),
        consumerOutputRatio: ratio(a.meanConsumerOutput, c.meanConsumerOutput),
        priceIndexRatio: ratio(a.meanPriceIndex, c.meanPriceIndex),
        firmCashDifference: a.meanFirmCash - c.meanFirmCash,
        wageBillDifference: a.meanWageBill - c.meanWageBill,
        gdpDifference: a.meanGdp - c.meanGdp
      };
    }
  }
}

const nonControlRuns = runs.filter(r => r.variant !== 'unit-basis-control');
const nonTargetDirectChange = checks.some(x => !x.targeted && Math.abs(x.finalCapacity - x.canonicalCapacity) > TOL);
const appliedChecks = checks.filter(x => x.applied);
const maxCapacityFloorError = Math.max(0, ...appliedChecks.map(x => Math.max(0, finite(x.breakEvenCapacity) - x.finalCapacity)));
const maxDesiredReplanError = Math.max(0, ...appliedChecks.map(x => Math.abs(x.finalDesired - Math.min(x.finalCapacity * 1.08, x.unconstrainedPlan))));
const maxGdpResidual = Math.max(0, ...rows.map(r => Math.abs(r.gdpResidual)));

const gates = {
  deterministicReplayExact: determinism.every(x => x.exact),
  allHealthy: runs.every(r => r.health?.ok === true),
  completeCoverage: rows.length === variants.length * scales.length * seeds.length * months * 4,
  everyNonControlVariantActivated: variants.filter(v => v !== 'unit-basis-control').every(v =>
    nonControlRuns.filter(r => r.variant === v).reduce((s, r) => s + r.applications, 0) > 0
  ),
  nonTargetSectorsNeverDirectlyChanged: !nonTargetDirectChange,
  breakEvenCapacityFloorSatisfied: maxCapacityFloorError < TOL,
  desiredProductionReplanExact: maxDesiredReplanError < TOL,
  ledgerCountriesOk: rows.every(r => r.ledgerOk),
  gdpIdentityReconciled: maxGdpResidual < TOL,
  finiteRows: rows.every(r => Number.isFinite(r.unemployment) && Number.isFinite(r.consumerOutput))
};
gates.ok = Object.values(gates).every(Boolean);
assert.ok(gates.ok, `WP-RV07-P35 gates failed: ${JSON.stringify(gates)}`);

console.table(summary.filter(x => x.window === 'FULL').map(x => ({
  variant: x.variant,
  scale: x.scaleProfile,
  u: +x.meanUnemployment.toFixed(4),
  exits: x.totalExits,
  arrears: +x.meanWageArrears.toFixed(1),
  fulfill: +x.meanGoodsFulfillment.toFixed(4),
  shortage: +x.meanInputShortage.toFixed(2),
  resource: +x.meanResourceOutput.toFixed(1),
  materials: +x.meanMaterialsOutput.toFixed(1),
  consumer: +x.meanConsumerOutput.toFixed(1),
  cash: +x.meanFirmCash.toFixed(1),
  wageBill: +x.meanWageBill.toFixed(1)
})));
console.log('WP_RV07_P35_COMPARISON', JSON.stringify(comparison));
console.log('WP_RV07_P35_GATES', JSON.stringify(gates));

const payload = {
  workPackage: 'WP-RV07-P35',
  title: 'Break-even physical-capacity normalization causal matrix',
  generatedAt: new Date().toISOString(),
  configuration: { variants, variantTargets, scales, seeds, months },
  determinism,
  gates,
  reconciliation: { maxCapacityFloorError, maxDesiredReplanError, maxGdpResidual },
  applications: runs.map(r => ({
    variant: r.variant,
    scaleProfile: r.scaleProfile,
    seed: r.seed,
    applications: r.applications
  })),
  infeasibleChecks: checks.filter(x => x.targeted && x.infeasibleAtCurrentPrice).length,
  summary,
  comparison,
  rows
};

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(payload, null, 2));
  console.log('WP_RV07_P35_OUTPUT', outputJson);
}
