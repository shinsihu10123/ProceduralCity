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

const VARIANTS = Object.freeze([
  Object.freeze({ id: 'unit-basis-control', censorCorrection: false }),
  Object.freeze({ id: 'unit-basis-stockout-censor-hold', censorCorrection: true })
]);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = values => values.reduce((total, value) => total + finite(value), 0);
const mean = values => values.length ? sum(values) / values.length : 0;
const ratio = (a, b) => Math.abs(finite(b)) > EPS ? finite(a) / finite(b) : 0;
const clone = value => structuredClone(value);

function transformedSeeds() {
  return COUNTRY_SEEDS.map(seed => ({
    ...seed,
    initialPrice: Math.max(EPS, finite(seed.initialWage, finite(seed.initialPrice, 1))),
    __rv07P9: {
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

function stateFingerprint(world) {
  return {
    month: world.month,
    rng: clone(world.rng),
    countries: clone(world.countries),
    ledgerEntries: clone(world.ledger.entries),
    accounting: world.countries.map(country => ({ id: country.id, report: world.accountingReport(country.id) }))
  };
}

function capturePriorPreviousSales(world) {
  const prior = new Map();
  for (const country of world.countries) {
    for (const firm of country.firms) {
      prior.set(`${country.id}|${firm.id}`, Math.max(0, finite(firm.previousSales)));
    }
  }
  return prior;
}

function applyOrAuditStockoutCensorHold(world, prior, enabled) {
  const byCountry = new Map();
  for (const country of world.countries) {
    const record = {
      activeFirms: 0,
      endingStockoutPositiveSalesCases: 0,
      downwardCensoredCases: 0,
      correctedCases: 0,
      totalPreviousSalesLift: 0,
      maxPreviousSalesLift: 0,
      ruleViolations: 0,
      corrections: []
    };

    for (const firm of country.firms) {
      if (firm.active === false) continue;
      record.activeFirms += 1;
      const key = `${country.id}|${firm.id}`;
      if (!prior.has(key)) continue;

      const priorPreviousSales = Math.max(0, finite(prior.get(key)));
      const canonicalPreviousSales = Math.max(0, finite(firm.previousSales));
      const actualSales = Math.max(0, finite(firm.sales));
      const endingInventory = Math.max(0, finite(firm.inventory));
      const stockout = endingInventory <= EPS;
      const positiveSales = actualSales > EPS;
      const censoredDownward = stockout && positiveSales && priorPreviousSales > canonicalPreviousSales + EPS;

      if (stockout && positiveSales) record.endingStockoutPositiveSalesCases += 1;
      if (!censoredDownward) continue;
      record.downwardCensoredCases += 1;

      const correctedPreviousSales = Math.max(priorPreviousSales, canonicalPreviousSales);
      const lift = correctedPreviousSales - canonicalPreviousSales;
      if (
        !stockout ||
        !positiveSales ||
        correctedPreviousSales + EPS < canonicalPreviousSales ||
        Math.abs(correctedPreviousSales - Math.max(priorPreviousSales, canonicalPreviousSales)) > 1e-9
      ) record.ruleViolations += 1;

      if (enabled && lift > EPS) {
        firm.previousSales = correctedPreviousSales;
        record.correctedCases += 1;
        record.totalPreviousSalesLift += lift;
        record.maxPreviousSalesLift = Math.max(record.maxPreviousSalesLift, lift);
        record.corrections.push({
          firmId: firm.id,
          industryId: firm.industryId,
          priorPreviousSales,
          actualSales,
          canonicalPreviousSales,
          correctedPreviousSales,
          lift,
          endingInventory
        });
      }
    }
    byCountry.set(country.id, record);
  }
  return byCountry;
}

function planShares(country) {
  const active = country.firms.filter(f => f.active !== false);
  const counts = {};
  for (const f of active) {
    const selected = f.currentPlan?.selected || f.currentPlan?.name || f.lastTrace?.selected || 'UNKNOWN';
    counts[selected] = (counts[selected] || 0) + 1;
  }
  const total = Math.max(1, active.length);
  return {
    expansion: ratio(counts['확장'] || 0, total),
    defense: ratio(counts['방어'] || 0, total),
    cashPreservation: ratio(counts['현금 보존'] || 0, total),
    priceCompetition: ratio(counts['가격 경쟁'] || 0, total),
    maintain: ratio(counts['유지'] || 0, total),
    unknown: ratio(counts.UNKNOWN || 0, total)
  };
}

function rowFor(world, variant, scaleProfile, seed, country, correction) {
  const macro = country.macro || {};
  const goods = country.lastMarkets?.goods || {};
  const industry = country.lastIndustry || {};
  const active = country.firms.filter(f => f.active !== false);
  const consumer = active.filter(f => f.consumerFacing);
  return {
    variant: variant.id,
    scaleProfile,
    seed,
    month: world.month,
    countryId: country.id,
    economy: {
      unemployment: finite(macro.unemployment),
      firmExits: finite(macro.firmExits),
      activeFirms: finite(macro.activeFirms),
      wageArrears: finite(macro.wageArrears),
      goodsFulfillmentRate: ratio(finite(goods.nominalConsumption ?? macro.consumption), finite(goods.desiredBudget)),
      inputShortageUnits: finite(industry.inputShortageUnits ?? macro.inputShortageUnits),
      consumerOutput: finite(industry.sectorOutputs?.CONSUMER),
      nominalSales: finite(macro.nominalSales),
      gdp: finite(macro.gdp),
      gdpIdentityResidual: gdpResidual(macro)
    },
    firmState: {
      meanPreviousSalesActive: mean(active.map(f => Math.max(0, finite(f.previousSales)))),
      meanDesiredProductionActive: mean(active.map(f => Math.max(0, finite(f.desiredProduction)))),
      meanWorkersActive: mean(active.map(f => Math.max(0, finite(f.workers)))),
      meanDemandBeliefActive: mean(active.map(f => finite(f.beliefs?.demandGrowth))),
      meanConsumerPreviousSales: mean(consumer.map(f => Math.max(0, finite(f.previousSales)))),
      planShares: planShares(country)
    },
    censorAudit: correction,
    ledger: world.ledger.verifyCountry(country.id)
  };
}

function runVariant(variant, scaleProfile, seed, horizon, collect = true) {
  const world = createUnitBasisWorld(scaleProfile, seed);
  const rows = [];
  const corrections = [];

  for (let i = 0; i < horizon; i++) {
    const prior = capturePriorPreviousSales(world);
    world.stepMonth();
    const byCountry = applyOrAuditStockoutCensorHold(world, prior, variant.censorCorrection);
    for (const [countryId, record] of byCountry.entries()) {
      corrections.push({ month: world.month, countryId, ...clone(record) });
    }
    if (collect) {
      for (const country of world.countries) {
        rows.push(rowFor(world, variant, scaleProfile, seed, country, byCountry.get(country.id)));
      }
    }
  }

  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${variant.id}/${scaleProfile}/${seed}: health gate failed`);
  return { variant: variant.id, scaleProfile, seed, rows, corrections, health, fingerprint: stateFingerprint(world) };
}

const determinism = [];
for (const variant of VARIANTS) {
  for (const scaleProfile of scales) {
    const seed = `ECON-RV07-P9-DETERMINISM-${variant.id}-${scaleProfile}`;
    const horizon = Math.min(3, months);
    const a = runVariant(variant, scaleProfile, seed, horizon, false).fingerprint;
    const b = runVariant(variant, scaleProfile, seed, horizon, false).fingerprint;
    const exact = JSON.stringify(a) === JSON.stringify(b);
    assert.ok(exact, `${variant.id}/${scaleProfile}: deterministic replay must be exact`);
    determinism.push({ variant: variant.id, scaleProfile, exact });
  }
}

const runs = [];
for (const variant of VARIANTS) {
  for (const scaleProfile of scales) {
    for (const seed of seeds) runs.push(runVariant(variant, scaleProfile, seed, months, true));
  }
}
const rows = runs.flatMap(run => run.rows);

const windows = [
  { id: 'M1-3', from: 1, to: Math.min(3, months) },
  { id: 'M4-6', from: 4, to: Math.min(6, months) },
  { id: 'M7-9', from: 7, to: Math.min(9, months) },
  { id: 'M10-12', from: 10, to: months },
  { id: 'FULL', from: 1, to: months }
].filter(w => w.from <= months && w.to >= w.from);

function aggregate(rs) {
  return {
    countryMonths: rs.length,
    meanUnemployment: mean(rs.map(r => r.economy.unemployment)),
    totalFirmExits: sum(rs.map(r => r.economy.firmExits)),
    meanWageArrears: mean(rs.map(r => r.economy.wageArrears)),
    meanGoodsFulfillmentRate: mean(rs.map(r => r.economy.goodsFulfillmentRate)),
    meanInputShortageUnits: mean(rs.map(r => r.economy.inputShortageUnits)),
    meanConsumerOutput: mean(rs.map(r => r.economy.consumerOutput)),
    meanNominalSales: mean(rs.map(r => r.economy.nominalSales)),
    meanGdp: mean(rs.map(r => r.economy.gdp)),
    meanPreviousSalesActive: mean(rs.map(r => r.firmState.meanPreviousSalesActive)),
    meanDesiredProductionActive: mean(rs.map(r => r.firmState.meanDesiredProductionActive)),
    meanDemandBeliefActive: mean(rs.map(r => r.firmState.meanDemandBeliefActive)),
    meanDefenseShare: mean(rs.map(r => r.firmState.planShares.defense)),
    meanCashPreservationShare: mean(rs.map(r => r.firmState.planShares.cashPreservation)),
    stockoutPositiveSalesCases: sum(rs.map(r => r.censorAudit?.endingStockoutPositiveSalesCases || 0)),
    downwardCensoredCases: sum(rs.map(r => r.censorAudit?.downwardCensoredCases || 0)),
    correctedCases: sum(rs.map(r => r.censorAudit?.correctedCases || 0)),
    totalPreviousSalesLift: sum(rs.map(r => r.censorAudit?.totalPreviousSalesLift || 0)),
    maxAbsGdpResidual: Math.max(0, ...rs.map(r => Math.abs(r.economy.gdpIdentityResidual)))
  };
}

const summary = [];
for (const variant of VARIANTS) {
  for (const scaleProfile of scales) {
    for (const window of windows) {
      const selected = rows.filter(r => r.variant === variant.id && r.scaleProfile === scaleProfile && r.month >= window.from && r.month <= window.to);
      summary.push({ variant: variant.id, scaleProfile, window: window.id, ...aggregate(selected) });
    }
  }
}

const comparisons = {};
for (const scaleProfile of scales) {
  comparisons[scaleProfile] = {};
  for (const window of windows) {
    const control = summary.find(x => x.variant === 'unit-basis-control' && x.scaleProfile === scaleProfile && x.window === window.id);
    const candidate = summary.find(x => x.variant === 'unit-basis-stockout-censor-hold' && x.scaleProfile === scaleProfile && x.window === window.id);
    comparisons[scaleProfile][window.id] = {
      unemploymentDifference: candidate.meanUnemployment - control.meanUnemployment,
      firmExitDifference: candidate.totalFirmExits - control.totalFirmExits,
      wageArrearsDifference: candidate.meanWageArrears - control.meanWageArrears,
      goodsFulfillmentDifference: candidate.meanGoodsFulfillmentRate - control.meanGoodsFulfillmentRate,
      inputShortageDifference: candidate.meanInputShortageUnits - control.meanInputShortageUnits,
      consumerOutputRatio: ratio(candidate.meanConsumerOutput, control.meanConsumerOutput),
      nominalSalesRatio: ratio(candidate.meanNominalSales, control.meanNominalSales),
      previousSalesRatio: ratio(candidate.meanPreviousSalesActive, control.meanPreviousSalesActive),
      desiredProductionRatio: ratio(candidate.meanDesiredProductionActive, control.meanDesiredProductionActive),
      demandBeliefDifference: candidate.meanDemandBeliefActive - control.meanDemandBeliefActive,
      defenseShareDifference: candidate.meanDefenseShare - control.meanDefenseShare,
      cashPreservationShareDifference: candidate.meanCashPreservationShare - control.meanCashPreservationShare,
      gdpDifference: candidate.meanGdp - control.meanGdp,
      correctedCases: candidate.correctedCases,
      totalPreviousSalesLift: candidate.totalPreviousSalesLift
    };
  }
}

const candidateRows = rows.filter(r => r.variant === 'unit-basis-stockout-censor-hold');
const controlRows = rows.filter(r => r.variant === 'unit-basis-control');
const maxGdpResidual = Math.max(0, ...rows.map(r => Math.abs(r.economy.gdpIdentityResidual)));
const firstMonthParity = scales.every(scaleProfile => seeds.every(seed => {
  const control = controlRows.filter(r => r.scaleProfile === scaleProfile && r.seed === seed && r.month === 1).map(r => ({ countryId: r.countryId, economy: r.economy }));
  const candidate = candidateRows.filter(r => r.scaleProfile === scaleProfile && r.seed === seed && r.month === 1).map(r => ({ countryId: r.countryId, economy: r.economy }));
  return JSON.stringify(control) === JSON.stringify(candidate);
}));

const gates = {
  deterministicReplayExact: determinism.every(x => x.exact),
  allHealthy: runs.every(run => run.health?.ok === true),
  completeCoverage: rows.length === VARIANTS.length * scales.length * seeds.length * months * 4,
  firstMonthOutcomeParity: firstMonthParity,
  controlNeverMutatesPreviousSales: controlRows.every(r => (r.censorAudit?.correctedCases || 0) === 0 && (r.censorAudit?.totalPreviousSalesLift || 0) === 0),
  correctionRuleValid: candidateRows.every(r => (r.censorAudit?.ruleViolations || 0) === 0),
  correctionOnlyOnDiagnosedCensoring: candidateRows.every(r => (r.censorAudit?.correctedCases || 0) <= (r.censorAudit?.downwardCensoredCases || 0)),
  ledgerCountriesOk: rows.every(r => r.ledger?.ok === true),
  gdpIdentityReconciled: maxGdpResidual < 1e-7,
  finiteRows: rows.every(r =>
    Number.isFinite(r.economy.unemployment) &&
    Number.isFinite(r.economy.inputShortageUnits) &&
    Number.isFinite(r.economy.gdp) &&
    Number.isFinite(r.firmState.meanPreviousSalesActive)
  )
};
gates.ok = Object.values(gates).every(Boolean);

const compactTable = summary.filter(x => x.window === 'FULL').map(x => ({
  variant: x.variant,
  scale: x.scaleProfile,
  unemployment: Number(x.meanUnemployment.toFixed(4)),
  exits: x.totalFirmExits,
  wageArrears: Number(x.meanWageArrears.toFixed(1)),
  goodsFulfillment: Number(x.meanGoodsFulfillmentRate.toFixed(4)),
  inputShortage: Number(x.meanInputShortageUnits.toFixed(3)),
  consumerOutput: Number(x.meanConsumerOutput.toFixed(3)),
  previousSales: Number(x.meanPreviousSalesActive.toFixed(3)),
  censoredCases: x.downwardCensoredCases,
  correctedCases: x.correctedCases,
  maxGdpResidual: Number(x.maxAbsGdpResidual.toExponential(3))
}));

const payload = {
  workPackage: 'WP-RV07-P9',
  generatedAt: new Date().toISOString(),
  hypothesis: 'H-S4: replacing a stockout-censored downward sales observation with a parameter-free carry-forward lower bound materially changes the residual collapse path.',
  intervention: {
    canonicalChanges: 0,
    parameterTuning: 0,
    unitBasisCandidate: 'initialPrice := existing initialWage before world construction',
    rule: 'After the canonical month closes, if an active firm ends with inventory <= EPS, positive current sales, and canonical previousSales below its prior-month previousSales, set next-month previousSales to max(prior previousSales, canonical previousSales).',
    note: 'This is a diagnostic lower-bound censor correction, not an empirical demand estimator and not a production repair.'
  },
  matrix: { scales, seeds, months },
  determinism,
  summary,
  comparisons,
  gates,
  reconciliation: { maxGdpResidual },
  rows
};

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(payload, null, 2));
}

console.table(compactTable);
console.log('WP_RV07_P9_COMPARISON', JSON.stringify(comparisons));
console.log('WP_RV07_P9_GATES', JSON.stringify(gates));
console.log('WP_RV07_P9_RECONCILIATION', JSON.stringify({ maxGdpResidual }));
if (outputJson) console.log('WP_RV07_P9_OUTPUT', outputJson);

assert.ok(gates.ok, `WP-RV07-P9 hard gates failed: ${JSON.stringify(gates)}`);
