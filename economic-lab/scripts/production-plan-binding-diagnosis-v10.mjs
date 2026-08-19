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

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = values => values.reduce((a, b) => a + finite(b), 0);
const mean = values => values.length ? sum(values) / values.length : 0;
const ratio = (a, b) => Math.abs(finite(b)) > EPS ? finite(a) / finite(b) : 0;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, finite(x)));
const clone = value => structuredClone(value);
const near = (a, b, tol = TOL) => Math.abs(finite(a) - finite(b)) <= tol * Math.max(1, Math.abs(finite(a)), Math.abs(finite(b)));

function transformedSeeds() {
  return COUNTRY_SEEDS.map(seed => ({
    ...seed,
    initialPrice: Math.max(EPS, finite(seed.initialWage, finite(seed.initialPrice, 1))),
    __rv07P10: {
      originalInitialPrice: Math.max(EPS, finite(seed.initialPrice, 1)),
      derivedPriceBasis: Math.max(EPS, finite(seed.initialWage, finite(seed.initialPrice, 1)))
    }
  }));
}

function createUnitBasisWorld(scaleProfile, seedText) {
  const originals = COUNTRY_SEEDS.map(seed => clone(seed));
  const replacement = transformedSeeds();
  COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...replacement);
  try {
    return new EconomicWorld(seedText, { scaleProfile, healthCheckInterval: 0 });
  } finally {
    COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...originals);
  }
}

function anchorBranch(previousSales, targetAnchor, floorAnchor, demandAnchor) {
  const winners = [];
  if (near(previousSales, demandAnchor)) winners.push('PREVIOUS_SALES');
  if (near(targetAnchor, demandAnchor)) winners.push('TARGET_INVENTORY');
  if (near(floorAnchor, demandAnchor)) winners.push('FLOOR');
  return winners.length === 1 ? winners[0] : winners.length > 1 ? `TIE:${winners.join('+')}` : 'UNCLASSIFIED';
}

function bindingBranch(capacityCap, unconstrainedPlan, desiredProduction) {
  const capWins = near(capacityCap, desiredProduction);
  const planWins = near(unconstrainedPlan, desiredProduction);
  if (capWins && planWins) return 'TIE';
  if (capWins) return 'CAPACITY_CAP';
  if (planWins) return 'PLAN_DEMAND';
  return 'UNCLASSIFIED';
}

function installPlanAudit(world) {
  world.__rv07P10Plan = new Map();
  const originalPlan = world.supply.planProduction.bind(world.supply);

  world.supply.planProduction = country => {
    const result = originalPlan(country);
    const rows = [];
    for (const f of country.firms) {
      if (f.active === false) continue;

      const capitalEffect = 0.72 + Math.log1p(Math.max(0, finite(f.capitalStock))) * 0.105;
      const humanEffect = 0.82 + finite(country.humanCapital) * 0.30;
      const laborCapacity = Math.max(0, finite(f.workers)) * finite(f.productivity) * capitalEffect * humanEffect;
      const resourceEffect = f.industryId === 'RESOURCE' ? 0.62 + finite(country.resourceBase) * 0.62 : 1;
      const planEffect = 1 + clamp(f.currentPlan?.productionChange || 0, -0.12, 0.15);
      const derivedCapacity = Math.max(0, laborCapacity * resourceEffect * planEffect);

      const previousSales = Math.max(0, finite(f.previousSales));
      const targetAnchor = Math.max(0, finite(f.targetInventory) * 0.42);
      const floorAnchor = 2;
      const demandAnchor = Math.max(floorAnchor, previousSales, targetAnchor);
      const demandGrowthBelief = finite(f.beliefs?.demandGrowth);
      const expectedDemand = demandAnchor * (1 + clamp(demandGrowthBelief, -0.18, 0.22));
      const replenishment = Math.max(0, finite(f.targetInventory) - finite(f.inventory));
      const demandComponent = expectedDemand * 0.72;
      const unconstrainedPlan = Math.max(0, demandComponent + replenishment);
      const capacityCap = Math.max(0, derivedCapacity * 1.08);
      const derivedDesiredProduction = Math.max(0, Math.min(capacityCap, unconstrainedPlan));

      rows.push({
        firmId: f.id,
        industryId: f.industryId,
        inputProduct: f.inputProduct || null,
        workers: finite(f.workers),
        inventory: finite(f.inventory),
        targetInventory: finite(f.targetInventory),
        previousSales,
        targetAnchor,
        floorAnchor,
        demandAnchor,
        anchorBranch: anchorBranch(previousSales, targetAnchor, floorAnchor, demandAnchor),
        demandGrowthBelief,
        expectedDemand,
        demandComponent,
        replenishment,
        unconstrainedPlan,
        capacity: finite(f.capacity),
        derivedCapacity,
        capacityCap,
        desiredProduction: finite(f.desiredProduction),
        derivedDesiredProduction,
        bindingBranch: bindingBranch(capacityCap, unconstrainedPlan, finite(f.desiredProduction)),
        capacityError: finite(f.capacity) - derivedCapacity,
        desiredProductionError: finite(f.desiredProduction) - derivedDesiredProduction
      });
    }
    world.__rv07P10Plan.set(`${world.month}|${country.id}`, rows);
    return result;
  };
}

function stateFingerprint(world) {
  return {
    month: world.month,
    rng: clone(world.rng),
    countries: clone(world.countries),
    ledgerEntries: clone(world.ledger.entries),
    accounting: world.countries.map(country => ({ id: country.id, report: world.accountingReport(country.id) }))
  };
}

function gdpResidual(macro) {
  const reconstructed =
    finite(macro?.consumption) +
    finite(macro?.grossInvestment) +
    finite(macro?.publicInvestment) +
    finite(macro?.governmentConsumption) +
    finite(macro?.inventoryInvestment) +
    finite(macro?.netExports);
  return finite(macro?.gdp) - reconstructed;
}

function runWorld(scaleProfile, seed, horizon, audited) {
  const world = createUnitBasisWorld(scaleProfile, seed);
  if (audited) installPlanAudit(world);
  const firmRows = [];
  const countryRows = [];

  for (let i = 0; i < horizon; i++) {
    world.stepMonth();
    for (const country of world.countries) {
      const plans = audited ? (world.__rv07P10Plan.get(`${world.month}|${country.id}`) || []) : [];
      if (audited) {
        assert.ok(plans.length > 0, `${scaleProfile}/${seed}/${world.month}/${country.id}: missing plan audit rows`);
        for (const p of plans) {
          const f = country.firms.find(x => x.id === p.firmId);
          assert.ok(f, `${scaleProfile}/${seed}/${world.month}/${country.id}/${p.firmId}: firm missing after monthly step`);
          const actualOutput = Math.max(0, finite(f.output));
          const supplyShortage = Math.max(0, finite(f.supplyShortage));
          firmRows.push({
            scaleProfile,
            seed,
            month: world.month,
            countryId: country.id,
            ...p,
            actualOutput,
            supplyShortage,
            outputGap: Math.max(0, p.desiredProduction - actualOutput),
            outputRealization: ratio(actualOutput, p.desiredProduction),
            inputConstrainedLikely: Boolean(p.inputProduct && actualOutput + TOL < p.desiredProduction && supplyShortage > TOL),
            exitedByEndOfMonth: f.active === false
          });
        }
      }
      countryRows.push({
        scaleProfile,
        seed,
        month: world.month,
        countryId: country.id,
        unemployment: finite(country.macro?.unemployment),
        exits: finite(country.macro?.firmExits),
        inputShortageUnits: finite(country.lastIndustry?.inputShortageUnits),
        gdp: finite(country.macro?.gdp),
        gdpIdentityResidual: gdpResidual(country.macro),
        ledgerOk: world.ledger.verifyCountry(country.id)?.ok === true
      });
    }
  }

  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${scaleProfile}/${seed}: health gate failed`);
  return { world, firmRows, countryRows, health, fingerprint: stateFingerprint(world) };
}

// Exact observer non-interference: the wrapper is read-only and must not perturb the world.
const ni = [];
for (const scaleProfile of scales) {
  const seed = `ECON-RV07-P10-NI-${scaleProfile}`;
  const horizon = Math.min(3, months);
  const plain = runWorld(scaleProfile, seed, horizon, false).fingerprint;
  const observed = runWorld(scaleProfile, seed, horizon, true).fingerprint;
  const exact = JSON.stringify(plain) === JSON.stringify(observed);
  assert.ok(exact, `${scaleProfile}: plan observer changed canonical state`);
  ni.push({ scaleProfile, exact });
}

const runs = [];
for (const scaleProfile of scales) {
  for (const seed of seeds) runs.push(runWorld(scaleProfile, seed, months, true));
}
const firmRows = runs.flatMap(x => x.firmRows);
const countryRows = runs.flatMap(x => x.countryRows);

const windows = [
  { id: 'M1-3', from: 1, to: Math.min(3, months) },
  { id: 'M4-6', from: 4, to: Math.min(6, months) },
  { id: 'M7-9', from: 7, to: Math.min(9, months) },
  { id: 'M10-12', from: 10, to: months },
  { id: 'FULL', from: 1, to: months }
].filter(w => w.from <= months && w.to >= w.from);

function classifyCount(rows, key, prefix = null) {
  return rows.filter(r => {
    const v = String(r[key] || '');
    return prefix ? v.startsWith(prefix) : Boolean(v);
  }).length;
}

function aggregatePlans(rows) {
  const n = rows.length;
  const previousAnchor = rows.filter(r => r.anchorBranch === 'PREVIOUS_SALES').length;
  const targetAnchor = rows.filter(r => r.anchorBranch === 'TARGET_INVENTORY').length;
  const floorAnchor = rows.filter(r => r.anchorBranch === 'FLOOR').length;
  const tieAnchor = rows.filter(r => String(r.anchorBranch).startsWith('TIE:')).length;
  const capacityBound = rows.filter(r => r.bindingBranch === 'CAPACITY_CAP').length;
  const planBound = rows.filter(r => r.bindingBranch === 'PLAN_DEMAND').length;
  const bindingTie = rows.filter(r => r.bindingBranch === 'TIE').length;
  return {
    firmMonths: n,
    anchor: {
      previousSales: previousAnchor,
      previousSalesShare: ratio(previousAnchor, n),
      targetInventory: targetAnchor,
      targetInventoryShare: ratio(targetAnchor, n),
      floor: floorAnchor,
      floorShare: ratio(floorAnchor, n),
      ties: tieAnchor,
      tieShare: ratio(tieAnchor, n)
    },
    binding: {
      capacityCap: capacityBound,
      capacityCapShare: ratio(capacityBound, n),
      planDemand: planBound,
      planDemandShare: ratio(planBound, n),
      ties: bindingTie,
      tieShare: ratio(bindingTie, n)
    },
    means: {
      workers: mean(rows.map(r => r.workers)),
      inventory: mean(rows.map(r => r.inventory)),
      targetInventory: mean(rows.map(r => r.targetInventory)),
      previousSales: mean(rows.map(r => r.previousSales)),
      targetAnchor: mean(rows.map(r => r.targetAnchor)),
      demandAnchor: mean(rows.map(r => r.demandAnchor)),
      demandGrowthBelief: mean(rows.map(r => r.demandGrowthBelief)),
      expectedDemand: mean(rows.map(r => r.expectedDemand)),
      demandComponent: mean(rows.map(r => r.demandComponent)),
      replenishment: mean(rows.map(r => r.replenishment)),
      unconstrainedPlan: mean(rows.map(r => r.unconstrainedPlan)),
      capacity: mean(rows.map(r => r.capacity)),
      capacityCap: mean(rows.map(r => r.capacityCap)),
      desiredProduction: mean(rows.map(r => r.desiredProduction)),
      actualOutput: mean(rows.map(r => r.actualOutput)),
      supplyShortage: mean(rows.map(r => r.supplyShortage))
    },
    contribution: {
      replenishmentShareOfUnconstrainedPlan: ratio(sum(rows.map(r => r.replenishment)), sum(rows.map(r => r.unconstrainedPlan))),
      demandComponentShareOfUnconstrainedPlan: ratio(sum(rows.map(r => r.demandComponent)), sum(rows.map(r => r.unconstrainedPlan))),
      desiredToCapacity: ratio(sum(rows.map(r => r.desiredProduction)), sum(rows.map(r => r.capacity))),
      outputToDesired: ratio(sum(rows.map(r => r.actualOutput)), sum(rows.map(r => r.desiredProduction)))
    },
    downstream: {
      inputConstrainedCases: rows.filter(r => r.inputConstrainedLikely).length,
      inputConstrainedShare: ratio(rows.filter(r => r.inputConstrainedLikely).length, n),
      zeroWorkerCases: rows.filter(r => r.workers <= EPS).length,
      zeroWorkerShare: ratio(rows.filter(r => r.workers <= EPS).length, n),
      exitSameMonthCases: rows.filter(r => r.exitedByEndOfMonth).length,
      exitSameMonthShare: ratio(rows.filter(r => r.exitedByEndOfMonth).length, n)
    }
  };
}

const summary = [];
const industrySummary = [];
for (const scaleProfile of scales) {
  for (const window of windows) {
    const selected = firmRows.filter(r => r.scaleProfile === scaleProfile && r.month >= window.from && r.month <= window.to);
    summary.push({ scaleProfile, window: window.id, ...aggregatePlans(selected) });
    for (const industryId of ['RESOURCE', 'MATERIALS', 'CAPITAL', 'CONSUMER']) {
      const sector = selected.filter(r => r.industryId === industryId);
      industrySummary.push({ scaleProfile, window: window.id, industryId, ...aggregatePlans(sector) });
    }
  }
}

const maxCapacityError = Math.max(0, ...firmRows.map(r => Math.abs(r.capacityError)));
const maxDesiredProductionError = Math.max(0, ...firmRows.map(r => Math.abs(r.desiredProductionError)));
const maxGdpResidual = Math.max(0, ...countryRows.map(r => Math.abs(r.gdpIdentityResidual)));
const unclassifiedAnchors = classifyCount(firmRows, 'anchorBranch', 'UNCLASSIFIED');
const unclassifiedBindings = firmRows.filter(r => r.bindingBranch === 'UNCLASSIFIED').length;

const gates = {
  observerNonInterferenceExact: ni.every(x => x.exact),
  allHealthy: runs.every(x => x.health?.ok === true),
  completeCountryCoverage: countryRows.length === scales.length * seeds.length * months * 4,
  planRowsPresent: firmRows.length > 0,
  capacityEquationReconciled: maxCapacityError < TOL,
  desiredProductionEquationReconciled: maxDesiredProductionError < TOL,
  allAnchorsClassified: unclassifiedAnchors === 0,
  allBindingsClassified: unclassifiedBindings === 0,
  ledgerCountriesOk: countryRows.every(r => r.ledgerOk),
  gdpIdentityReconciled: maxGdpResidual < TOL,
  finiteRows: firmRows.every(r => Number.isFinite(r.desiredProduction) && Number.isFinite(r.capacity) && Number.isFinite(r.actualOutput))
};
gates.ok = Object.values(gates).every(Boolean);
assert.ok(gates.ok, `WP-RV07-P10 hard gates failed: ${JSON.stringify(gates)}`);

const compactTable = summary.map(x => ({
  scale: x.scaleProfile,
  window: x.window,
  firms: x.firmMonths,
  prevAnchor: Number(x.anchor.previousSalesShare.toFixed(4)),
  targetAnchor: Number(x.anchor.targetInventoryShare.toFixed(4)),
  capBind: Number(x.binding.capacityCapShare.toFixed(4)),
  planBind: Number(x.binding.planDemandShare.toFixed(4)),
  replShare: Number(x.contribution.replenishmentShareOfUnconstrainedPlan.toFixed(4)),
  outputToDesired: Number(x.contribution.outputToDesired.toFixed(4)),
  inputConstrained: Number(x.downstream.inputConstrainedShare.toFixed(4)),
  workers: Number(x.means.workers.toFixed(2))
}));
console.table(compactTable);
console.log('WP_RV07_P10_GATES', JSON.stringify(gates));
console.log('WP_RV07_P10_RECONCILIATION', JSON.stringify({ maxCapacityError, maxDesiredProductionError, maxGdpResidual }));

const result = {
  workPackage: 'WP-RV07-P10',
  title: 'Production Plan Binding-Term Decomposition',
  generatedAt: new Date().toISOString(),
  configuration: { scales, seeds, months, unitBasis: 'initialPrice := existing initialWage' },
  authority: {
    canonicalMechanismChanges: 0,
    parameterTuning: 0,
    intervention: 'none; read-only plan observer'
  },
  nonInterference: ni,
  gates,
  reconciliation: { maxCapacityError, maxDesiredProductionError, maxGdpResidual, unclassifiedAnchors, unclassifiedBindings },
  summary,
  industrySummary,
  countryRows,
  firmRows
};

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV07_P10_OUTPUT', outputJson);
}
