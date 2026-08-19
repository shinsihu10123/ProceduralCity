import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const scales = (process.env.DIAG_SCALES || 'compact,baseline').split(',').map(x => x.trim()).filter(Boolean);
const seeds = (process.env.DIAG_SEEDS || 'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x => x.trim()).filter(Boolean);
const months = Math.max(1, Number(process.env.DIAG_MONTHS || 12));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const EPS = 1e-9;

const VARIANTS = Object.freeze([
  Object.freeze({ id: 'frozen-control', kind: 'control', description: 'Unchanged frozen v0.10 economic semantics.' }),
  Object.freeze({
    id: 'price-wage-basis',
    kind: 'candidate',
    description: 'Experimental initialization-only price-unit interpretation: set each country initialPrice monetary basis equal to its existing initialWage basis before world construction. No dynamic coefficient is tuned.'
  })
]);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = values => values.reduce((total, value) => total + finite(value), 0);
const mean = values => values.length ? sum(values) / values.length : 0;
const ratio = (a, b) => Math.abs(finite(b)) > EPS ? finite(a) / finite(b) : 0;
const clone = value => structuredClone(value);

function transformedSeeds(variantId) {
  return COUNTRY_SEEDS.map(seed => {
    if (variantId === 'frozen-control') return { ...seed };
    if (variantId === 'price-wage-basis') {
      const oldPrice = Math.max(EPS, finite(seed.initialPrice, 1));
      const wageBasis = Math.max(EPS, finite(seed.initialWage, oldPrice));
      return {
        ...seed,
        initialPrice: wageBasis,
        __rv07P2: { originalInitialPrice: oldPrice, derivedPriceBasis: wageBasis, impliedMultiplier: wageBasis / oldPrice }
      };
    }
    throw new Error(`unknown variant: ${variantId}`);
  });
}

function createVariantWorld(variantId, scaleProfile, seedText) {
  const originals = COUNTRY_SEEDS.map(seed => clone(seed));
  COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...transformedSeeds(variantId));
  try {
    return new EconomicWorld(seedText, { scaleProfile, healthCheckInterval: 0 });
  } finally {
    COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...originals);
  }
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

function firmSums(country, consumerOnly = false) {
  const firms = (country.firms || []).filter(f => f.active !== false && (!consumerOnly || f.consumerFacing === true));
  const workers = sum(firms.map(f => Math.max(0, finite(f.workers))));
  const payrollObligation = sum(firms.map(f => Math.max(0, finite(f.wage)) * Math.max(0, finite(f.workers))));
  const outputValue = sum(firms.map(f => Math.max(0, finite(f.output)) * Math.max(0, finite(f.price))));
  const revenue = sum(firms.map(f => Math.max(0, finite(f.revenue))));
  const cash = sum(firms.map(f => Math.max(0, finite(f.cash))));
  const wageArrears = sum(firms.map(f => Math.max(0, finite(f.wageArrears))));
  const prices = firms.map(f => Math.max(0, finite(f.price))).filter(x => x > 0);
  const wages = firms.map(f => Math.max(0, finite(f.wage))).filter(x => x > 0);
  return {
    firms: firms.length,
    workers,
    payrollObligation,
    outputValue,
    revenue,
    cash,
    wageArrears,
    meanPrice: mean(prices),
    meanWage: mean(wages),
    payrollToOutputValue: ratio(payrollObligation, outputValue),
    outputValueToPayroll: ratio(outputValue, payrollObligation),
    revenueToPayroll: ratio(revenue, payrollObligation),
    cashRunwayMonths: ratio(cash, payrollObligation)
  };
}

function rowFor(world, variant, scaleProfile, seed, country) {
  const goods = country.lastMarkets?.goods || {};
  const payroll = country.lastMarkets?.payroll || {};
  const credit = country.lastCredit || {};
  const macro = country.macro || {};
  const all = firmSums(country, false);
  const consumer = firmSums(country, true);
  const desiredBudget = finite(goods.desiredBudget);
  const consumption = finite(goods.nominalConsumption ?? macro.consumption);
  const gdpComponents =
    finite(macro.consumption) +
    finite(macro.grossInvestment) +
    finite(macro.publicInvestment) +
    finite(macro.governmentConsumption) +
    finite(macro.netExports) +
    finite(macro.inventoryInvestment);
  return {
    variant: variant.id,
    variantKind: variant.kind,
    scaleProfile,
    seed,
    month: world.month,
    countryId: country.id,
    population: {
      households: country.households?.length || 0,
      employed: (country.households || []).filter(h => h.employed).length,
      activeFirms: (country.firms || []).filter(f => f.active !== false).length
    },
    all,
    consumer,
    goods: {
      desiredBudget,
      consumption,
      unmetBudget: finite(goods.unmetBudget),
      fulfillmentRate: ratio(consumption, desiredBudget)
    },
    payroll: { paid: finite(payroll.payroll), unpaid: finite(payroll.unpaid), payments: finite(payroll.payments) },
    credit: {
      applications: finite(credit.applications),
      approved: finite(credit.approved),
      rejected: finite(credit.rejected),
      approvalRate: ratio(credit.approved, credit.applications),
      newCredit: finite(credit.newCredit),
      defaults: finite(credit.defaults),
      chargeOffs: finite(credit.chargeOffs)
    },
    economy: {
      unemployment: finite(macro.unemployment),
      gdp: finite(macro.gdp),
      consumption: finite(macro.consumption),
      nominalSales: finite(macro.nominalSales),
      firmExits: finite(macro.firmExits),
      firmEntries: finite(macro.firmEntries),
      inventoryInvestment: finite(macro.inventoryInvestment),
      netExports: finite(macro.netExports),
      gdpIdentityResidual: finite(macro.gdp) - gdpComponents
    }
  };
}

function runVariant(variant, scaleProfile, seed, horizon) {
  const world = createVariantWorld(variant.id, scaleProfile, seed);
  const rows = [];
  for (let i = 0; i < horizon; i++) {
    world.stepMonth();
    for (const country of world.countries) rows.push(rowFor(world, variant, scaleProfile, seed, country));
  }
  return { variant: variant.id, scaleProfile, seed, rows, health: world.forceHealthCheck(), fingerprint: stateFingerprint(world), scale: world.scaleReport() };
}

function runFingerprint(variant, scaleProfile, seed, horizon) {
  const world = createVariantWorld(variant.id, scaleProfile, seed);
  for (let i = 0; i < horizon; i++) world.stepMonth();
  return stateFingerprint(world);
}

const determinism = [];
for (const variant of VARIANTS) {
  for (const scaleProfile of scales) {
    const seed = `ECON-RV07-P2-DETERMINISM-${variant.id}-${scaleProfile}`;
    const a = runFingerprint(variant, scaleProfile, seed, Math.min(3, months));
    const b = runFingerprint(variant, scaleProfile, seed, Math.min(3, months));
    const exact = JSON.stringify(a) === JSON.stringify(b);
    assert.ok(exact, `${variant.id}/${scaleProfile}: paired deterministic replay must be exact`);
    determinism.push({ variant: variant.id, scaleProfile, seed, months: Math.min(3, months), exact });
  }
}

const runs = [];
for (const variant of VARIANTS) for (const scaleProfile of scales) for (const seed of seeds) runs.push(runVariant(variant, scaleProfile, seed, months));
const rows = runs.flatMap(run => run.rows);

function aggregate(rs) {
  const applications = sum(rs.map(r => r.credit.applications));
  const approvals = sum(rs.map(r => r.credit.approved));
  return {
    countryMonths: rs.length,
    meanConsumerPayrollToOutputValue: mean(rs.map(r => r.consumer.payrollToOutputValue)),
    meanConsumerOutputValueToPayroll: mean(rs.map(r => r.consumer.outputValueToPayroll)),
    meanConsumerRevenueToPayroll: mean(rs.map(r => r.consumer.revenueToPayroll)),
    meanConsumerCashRunwayMonths: mean(rs.map(r => r.consumer.cashRunwayMonths)),
    meanGoodsFulfillmentRate: mean(rs.map(r => r.goods.fulfillmentRate)),
    meanUnemployment: mean(rs.map(r => r.economy.unemployment)),
    totalFirmExits: sum(rs.map(r => r.economy.firmExits)),
    meanActiveFirms: mean(rs.map(r => r.population.activeFirms)),
    meanConsumerPrice: mean(rs.map(r => r.consumer.meanPrice)),
    meanConsumerWage: mean(rs.map(r => r.consumer.meanWage)),
    totalPayrollPaid: sum(rs.map(r => r.payroll.paid)),
    totalPayrollUnpaid: sum(rs.map(r => r.payroll.unpaid)),
    creditApplications: applications,
    creditApprovals: approvals,
    creditApprovalRate: ratio(approvals, applications),
    totalDefaults: sum(rs.map(r => r.credit.defaults)),
    totalChargeOffs: sum(rs.map(r => r.credit.chargeOffs)),
    meanAbsGdpIdentityResidual: mean(rs.map(r => Math.abs(r.economy.gdpIdentityResidual))),
    maxAbsGdpIdentityResidual: rs.length ? Math.max(...rs.map(r => Math.abs(r.economy.gdpIdentityResidual))) : 0
  };
}

const windows = [
  { id: 'M1-3', from: 1, to: 3 },
  { id: 'M4-6', from: 4, to: 6 },
  { id: 'M7-9', from: 7, to: 9 },
  { id: 'M10-12', from: 10, to: months },
  { id: 'FULL', from: 1, to: months }
].filter(w => w.from <= months);

const aggregates = {};
for (const variant of VARIANTS) {
  aggregates[variant.id] = {};
  for (const scaleProfile of scales) {
    aggregates[variant.id][scaleProfile] = {};
    for (const window of windows) {
      const rs = rows.filter(r => r.variant === variant.id && r.scaleProfile === scaleProfile && r.month >= window.from && r.month <= window.to);
      aggregates[variant.id][scaleProfile][window.id] = aggregate(rs);
    }
  }
}

const candidateVsControl = {};
for (const scaleProfile of scales) {
  const control = aggregates['frozen-control'][scaleProfile]?.FULL || {};
  const candidate = aggregates['price-wage-basis'][scaleProfile]?.FULL || {};
  candidateVsControl[scaleProfile] = {
    consumerPayrollToOutputValueRatio: ratio(candidate.meanConsumerPayrollToOutputValue, control.meanConsumerPayrollToOutputValue),
    goodsFulfillmentDifference: finite(candidate.meanGoodsFulfillmentRate) - finite(control.meanGoodsFulfillmentRate),
    unemploymentDifference: finite(candidate.meanUnemployment) - finite(control.meanUnemployment),
    firmExitDifference: finite(candidate.totalFirmExits) - finite(control.totalFirmExits),
    consumerRevenueToPayrollDifference: finite(candidate.meanConsumerRevenueToPayroll) - finite(control.meanConsumerRevenueToPayroll),
    creditApprovalDifference: finite(candidate.creditApprovalRate) - finite(control.creditApprovalRate)
  };
}

const controlRuns = runs.filter(run => run.variant === 'frozen-control');
const candidateRuns = runs.filter(run => run.variant === 'price-wage-basis');
const report = {
  schemaVersion: 2,
  kind: 'economic-lab-wp-rv07-p2-structural-unit-basis-ablation',
  frozenEconomicBaseline: '698d10749e2897d711e5bcee61913ac34e0650a0',
  correctionFromAttempt: {
    failedRun: '32223740276',
    defect: 'The first P2 diagnostic gate omitted macro.netExports from the expenditure GDP reconstruction. Both frozen control and candidate therefore failed the diagnostic gate even though health passed. v10b restores the same GDP identity used by WP-RV05.'
  },
  variants: VARIANTS,
  scales,
  seeds,
  months,
  methodology: {
    canonicalMechanismChanges: 0,
    canonicalParameterTuning: 0,
    candidateMerged: false,
    candidateType: 'initialization semantic ablation',
    candidateRule: 'For the price-wage-basis variant only, initialPrice is replaced before world construction by the already-existing initialWage monetary basis for that country. This is a derived unit interpretation, not a fitted free coefficient.',
    selectionRule: 'Hard gates cover determinism, health and accounting identities only. Outcome improvements are descriptive and are not used as calibration targets.'
  },
  determinism,
  runs: runs.map(({ fingerprint, ...rest }) => rest),
  aggregates,
  candidateVsControl,
  gates: {
    deterministicReplayExact: determinism.every(x => x.exact),
    controlHealthy: controlRuns.every(run => run.health?.ok),
    candidateHealthy: candidateRuns.every(run => run.health?.ok),
    completeCoverage: rows.length === VARIANTS.length * scales.length * seeds.length * months * 4,
    controlGdpIdentityReconciled: controlRuns.flatMap(run => run.rows).every(r => Math.abs(r.economy.gdpIdentityResidual) <= 1e-6),
    candidateGdpIdentityReconciled: candidateRuns.flatMap(run => run.rows).every(r => Math.abs(r.economy.gdpIdentityResidual) <= 1e-6)
  }
};
report.gates.ok = Object.values(report.gates).every(Boolean);

console.table(VARIANTS.flatMap(variant => scales.map(scaleProfile => {
  const a = aggregates[variant.id][scaleProfile].FULL;
  return {
    variant: variant.id,
    scale: scaleProfile,
    payrollOutput: Number(a.meanConsumerPayrollToOutputValue.toFixed(4)),
    revenuePayroll: Number(a.meanConsumerRevenueToPayroll.toFixed(4)),
    goodsFulfillment: Number(a.meanGoodsFulfillmentRate.toFixed(4)),
    unemployment: Number(a.meanUnemployment.toFixed(4)),
    exits: a.totalFirmExits,
    creditApproval: Number(a.creditApprovalRate.toFixed(4)),
    maxGdpResidual: Number(a.maxAbsGdpIdentityResidual.toExponential(3))
  };
})));
console.log('WP_RV07_P2_COMPARISON', JSON.stringify(candidateVsControl));
console.log('WP_RV07_P2_GATES', JSON.stringify(report.gates));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log('WP_RV07_P2_OUTPUT', outputJson);
}

if (!report.gates.ok) process.exitCode = 1;
