import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';

const scales = (process.env.DIAG_SCALES || 'compact,baseline').split(',').map(x => x.trim()).filter(Boolean);
const seeds = (process.env.DIAG_SEEDS || 'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x => x.trim()).filter(Boolean);
const months = Math.max(1, Number(process.env.DIAG_MONTHS || 3));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const EPS = 1e-9;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = values => values.reduce((total, value) => total + finite(value), 0);
const mean = values => values.length ? sum(values) / values.length : 0;
const ratio = (a, b) => Math.abs(finite(b)) > EPS ? finite(a) / finite(b) : 0;

function sectorSnapshot(world, country, predicate = () => true) {
  const firms = (country.firms || []).filter(f => f.active !== false && predicate(f));
  return {
    firms: firms.length,
    workers: sum(firms.map(f => Math.max(0, finite(f.workers)))),
    payrollObligation: sum(firms.map(f => Math.max(0, finite(f.wage)) * Math.max(0, finite(f.workers)))),
    outputUnits: sum(firms.map(f => Math.max(0, finite(f.output)))),
    outputValueAtCurrentPrice: sum(firms.map(f => Math.max(0, finite(f.output)) * Math.max(0, finite(f.price)))),
    capacityUnits: sum(firms.map(f => Math.max(0, finite(f.capacity)))),
    inventoryValue: sum(firms.map(f => Math.max(0, finite(f.inventory)) * Math.max(0, finite(f.price)))),
    revenue: sum(firms.map(f => Math.max(0, finite(f.revenue)))),
    cash: sum(firms.map(f => Math.max(0, finite(world.ledger.balance(f.accountId))))),
    safeCash: sum(firms.map(f => Math.max(0, finite(f.safeCash))))
  };
}

function fullSnapshot(world, country) {
  return {
    all: sectorSnapshot(world, country),
    consumer: sectorSnapshot(world, country, f => f.consumerFacing === true),
    nonConsumer: sectorSnapshot(world, country, f => f.consumerFacing !== true)
  };
}

function fingerprint(world) {
  return {
    month: world.month,
    rng: structuredClone(world.rng),
    countries: structuredClone(world.countries),
    ledgerEntries: structuredClone(world.ledger.entries),
    accounting: world.countries.map(country => ({ id: country.id, report: world.accountingReport(country.id) }))
  };
}

function installProductionObserver(world, events) {
  const original = world.supply.produce.bind(world.supply);
  world.supply.produce = (country, month, metrics) => {
    const before = fullSnapshot(world, country);
    const result = original(country, month, metrics);
    const after = fullSnapshot(world, country);
    events.push({ month, countryId: country.id, before, after });
    return result;
  };
}

function payrollBySector(world, country, month) {
  const firmById = new Map((country.firms || []).map(f => [f.id, f]));
  const entries = world.ledger.entriesFor({ month, countryId: country.id, kind: 'wage' });
  let all = 0;
  let consumer = 0;
  let nonConsumer = 0;
  for (const entry of entries) {
    const amount = Math.max(0, finite(entry.amount));
    all += amount;
    const firm = firmById.get(entry.meta?.firmId);
    if (firm?.consumerFacing === true) consumer += amount;
    else nonConsumer += amount;
  }
  return { all, consumer, nonConsumer, entries: entries.length };
}

function runObserved(scaleProfile, seed, horizon, collect = true) {
  const world = new EconomicWorld(seed, { scaleProfile, healthCheckInterval: 0 });
  const productionEvents = [];
  installProductionObserver(world, productionEvents);
  const rows = [];
  let maxPayrollReconciliationError = 0;

  for (let i = 0; i < horizon; i++) {
    world.stepMonth();
    if (!collect) continue;

    for (const country of world.countries) {
      const production = productionEvents.find(event => event.month === world.month && event.countryId === country.id);
      assert.ok(production, `${scaleProfile}/${seed}/${country.id}/M${world.month}: production boundary required`);
      const paid = payrollBySector(world, country, world.month);
      const lastPayroll = finite(country.lastMarkets?.payroll?.payroll);
      const payrollError = paid.all - lastPayroll;
      maxPayrollReconciliationError = Math.max(maxPayrollReconciliationError, Math.abs(payrollError));

      const terminal = fullSnapshot(world, country);
      const consumer = production.after.consumer;
      const total = production.after.all;

      rows.push({
        scaleProfile,
        seed,
        month: world.month,
        countryId: country.id,
        population: {
          households: country.households.length,
          employed: country.households.filter(h => h.employed).length,
          activeFirms: country.firms.filter(f => f.active !== false).length
        },
        production,
        paidPayroll: paid,
        terminal,
        ratios: {
          consumerPayrollObligationToOutputValue: ratio(consumer.payrollObligation, consumer.outputValueAtCurrentPrice),
          consumerOutputValueToPayrollObligation: ratio(consumer.outputValueAtCurrentPrice, consumer.payrollObligation),
          consumerPaidPayrollToOutputValue: ratio(paid.consumer, consumer.outputValueAtCurrentPrice),
          consumerRevenueToPaidPayroll: ratio(terminal.consumer.revenue, paid.consumer),
          consumerRevenueToPayrollObligation: ratio(terminal.consumer.revenue, consumer.payrollObligation),
          consumerCashRunwayMonthsAtObligation: ratio(production.before.consumer.cash, consumer.payrollObligation),
          allPayrollObligationToGrossOutputValue: ratio(total.payrollObligation, total.outputValueAtCurrentPrice),
          allGrossOutputValueToPayrollObligation: ratio(total.outputValueAtCurrentPrice, total.payrollObligation),
          allPaidPayrollToGrossOutputValue: ratio(paid.all, total.outputValueAtCurrentPrice),
          allRevenueToPaidPayroll: ratio(terminal.all.revenue, paid.all),
          allCashRunwayMonthsAtObligation: ratio(production.before.all.cash, total.payrollObligation),
          consumerOutputValuePerWorker: ratio(consumer.outputValueAtCurrentPrice, consumer.workers),
          consumerPayrollObligationPerWorker: ratio(consumer.payrollObligation, consumer.workers),
          allOutputValuePerWorker: ratio(total.outputValueAtCurrentPrice, total.workers),
          allPayrollObligationPerWorker: ratio(total.payrollObligation, total.workers)
        },
        economy: {
          unemployment: finite(country.macro?.unemployment),
          consumption: finite(country.macro?.consumption),
          nominalSales: finite(country.macro?.nominalSales),
          firmExits: finite(country.macro?.firmExits)
        },
        reconciliation: { payrollError }
      });
    }
  }

  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${scaleProfile}/${seed}: health gate must pass`);
  if (!collect) return { fingerprint: fingerprint(world) };
  assert.equal(rows.length, horizon * world.countries.length, `${scaleProfile}/${seed}: complete country-month coverage required`);
  assert.ok(maxPayrollReconciliationError <= 1e-6, `${scaleProfile}/${seed}: wage ledger must reconcile to lastMarkets.payroll`);
  return {
    scaleProfile,
    seed,
    health,
    rows,
    reconciliation: { maxPayrollReconciliationError },
    scale: world.scaleReport()
  };
}

function runPlain(scaleProfile, seed, horizon) {
  const world = new EconomicWorld(seed, { scaleProfile, healthCheckInterval: 0 });
  for (let i = 0; i < horizon; i++) world.stepMonth();
  return fingerprint(world);
}

for (const scaleProfile of scales) {
  const seed = `ECON-RV07-P1-NONINTERFERENCE-${scaleProfile}`;
  const control = runPlain(scaleProfile, seed, 1);
  const observed = runObserved(scaleProfile, seed, 1, false).fingerprint;
  assert.deepStrictEqual(observed, control, `WP-RV07-P1 observer must be exactly non-interfering at ${scaleProfile}`);
}

const runs = [];
for (const scaleProfile of scales) for (const seed of seeds) runs.push(runObserved(scaleProfile, seed, months, true));
const rows = runs.flatMap(run => run.rows);

function aggregate(rs) {
  return {
    countryMonths: rs.length,
    meanConsumerPayrollToOutputValue: mean(rs.map(r => r.ratios.consumerPayrollObligationToOutputValue)),
    minConsumerPayrollToOutputValue: rs.length ? Math.min(...rs.map(r => r.ratios.consumerPayrollObligationToOutputValue)) : 0,
    maxConsumerPayrollToOutputValue: rs.length ? Math.max(...rs.map(r => r.ratios.consumerPayrollObligationToOutputValue)) : 0,
    meanConsumerPaidPayrollToOutputValue: mean(rs.map(r => r.ratios.consumerPaidPayrollToOutputValue)),
    meanConsumerRevenueToPaidPayroll: mean(rs.map(r => r.ratios.consumerRevenueToPaidPayroll)),
    meanConsumerRevenueToPayrollObligation: mean(rs.map(r => r.ratios.consumerRevenueToPayrollObligation)),
    meanConsumerCashRunwayMonths: mean(rs.map(r => r.ratios.consumerCashRunwayMonthsAtObligation)),
    meanAllPayrollToGrossOutputValue: mean(rs.map(r => r.ratios.allPayrollObligationToGrossOutputValue)),
    meanAllPaidPayrollToGrossOutputValue: mean(rs.map(r => r.ratios.allPaidPayrollToGrossOutputValue)),
    meanAllRevenueToPaidPayroll: mean(rs.map(r => r.ratios.allRevenueToPaidPayroll)),
    meanAllCashRunwayMonths: mean(rs.map(r => r.ratios.allCashRunwayMonthsAtObligation)),
    meanConsumerOutputValuePerWorker: mean(rs.map(r => r.ratios.consumerOutputValuePerWorker)),
    meanConsumerPayrollObligationPerWorker: mean(rs.map(r => r.ratios.consumerPayrollObligationPerWorker)),
    meanAllOutputValuePerWorker: mean(rs.map(r => r.ratios.allOutputValuePerWorker)),
    meanAllPayrollObligationPerWorker: mean(rs.map(r => r.ratios.allPayrollObligationPerWorker)),
    meanUnemployment: mean(rs.map(r => r.economy.unemployment))
  };
}

const report = {
  schemaVersion: 1,
  kind: 'economic-lab-wp-rv07-p1-unit-economics-audit',
  frozenEconomicBaseline: '698d10749e2897d711e5bcee61913ac34e0650a0',
  scales,
  seeds,
  months,
  methodology: {
    mechanismChanges: 0,
    parameterTuning: 0,
    purpose: 'Directly test whether contractual wage/payroll purchasing-power scale is coherent with physical output valued at the frozen model prices.',
    caution: 'Gross output value is an internal unit-coherence diagnostic, not an empirical value-added calibration target.'
  },
  runs,
  aggregates: {
    byScale: Object.fromEntries(scales.map(scale => [scale, aggregate(rows.filter(r => r.scaleProfile === scale))])),
    month1ByScale: Object.fromEntries(scales.map(scale => [scale, aggregate(rows.filter(r => r.scaleProfile === scale && r.month === 1))]))
  },
  gates: {
    observerNonInterferenceExact: true,
    allHealthy: runs.every(run => run.health.ok),
    completeCoverage: rows.length === scales.length * seeds.length * months * 4,
    payrollLedgerReconciled: runs.every(run => run.reconciliation.maxPayrollReconciliationError <= 1e-6)
  }
};
report.gates.ok = Object.values(report.gates).every(Boolean);
assert.ok(report.gates.ok, 'WP-RV07-P1 hard gates must pass');

console.table(Object.entries(report.aggregates.byScale).map(([scale, x]) => ({
  scale,
  consumerPayrollOutput: Number(x.meanConsumerPayrollToOutputValue.toFixed(3)),
  consumerPaidPayrollOutput: Number(x.meanConsumerPaidPayrollToOutputValue.toFixed(3)),
  consumerRevenuePaidPayroll: Number(x.meanConsumerRevenueToPaidPayroll.toFixed(4)),
  consumerCashRunway: Number(x.meanConsumerCashRunwayMonths.toFixed(3)),
  allPayrollGrossOutput: Number(x.meanAllPayrollToGrossOutputValue.toFixed(3)),
  allRevenuePaidPayroll: Number(x.meanAllRevenueToPaidPayroll.toFixed(4)),
  unemployment: Number(x.meanUnemployment.toFixed(4))
})));
console.log('WP_RV07_P1_GATES', JSON.stringify(report.gates));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(report, null, 2));
  console.log(`WP_RV07_P1_OUTPUT ${outputJson}`);
}
