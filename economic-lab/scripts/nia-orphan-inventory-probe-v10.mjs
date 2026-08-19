import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';

const scaleProfile = process.env.DIAG_SCALE || 'baseline';
const months = Math.max(1, Number(process.env.DIAG_MONTHS || 12));
const seedText = process.env.DIAG_SEEDS || 'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C';
const seeds = seedText.split(',').map(seed => seed.trim()).filter(Boolean);
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const EPS = 1e-8;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = values => values.reduce((total, value) => total + finite(value), 0);
const ratio = (a, b) => Math.abs(finite(b)) > EPS ? finite(a) / finite(b) : 0;
const mean = values => values.length ? sum(values) / values.length : 0;

function countryProbe(world, country) {
  const gl = world.accounting.gl;
  const result = {
    finishedBook: 0,
    physicalFinishedUnits: 0,
    consumerFinishedBook: 0,
    consumerPhysicalUnits: 0,
    bookWithoutPhysicalUnits: 0,
    consumerBookWithoutPhysicalUnits: 0,
    nonConsumerBookWithoutPhysicalUnits: 0,
    activeBookWithoutPhysicalUnits: 0,
    inactiveBookWithoutPhysicalUnits: 0,
    firmsWithBookWithoutPhysicalUnits: 0,
    consumerFirmsWithBookWithoutPhysicalUnits: 0,
    productionLaborCapitalization: 0,
    zeroOutputLaborCapitalization: 0,
    consumerZeroOutputLaborCapitalization: 0,
    nonConsumerZeroOutputLaborCapitalization: 0,
    zeroOutputLaborJournals: 0
  };

  for (const firm of country.firms || []) {
    if (!gl.entities.has(firm.id)) continue;
    const book = Math.max(0, finite(gl.naturalBalance(firm.id, 'inventory')));
    const units = Math.max(0, finite(firm.inventory));
    result.finishedBook += book;
    result.physicalFinishedUnits += units;
    if (firm.consumerFacing === true) {
      result.consumerFinishedBook += book;
      result.consumerPhysicalUnits += units;
    }
    if (book > EPS && units <= EPS) {
      result.bookWithoutPhysicalUnits += book;
      result.firmsWithBookWithoutPhysicalUnits += 1;
      if (firm.consumerFacing === true) {
        result.consumerBookWithoutPhysicalUnits += book;
        result.consumerFirmsWithBookWithoutPhysicalUnits += 1;
      } else result.nonConsumerBookWithoutPhysicalUnits += book;
      if (firm.active === false) result.inactiveBookWithoutPhysicalUnits += book;
      else result.activeBookWithoutPhysicalUnits += book;
    }

    const entity = gl.entities.get(firm.id);
    for (const journal of entity.journals || []) {
      if (Number(journal.month) !== Number(world.month) || journal.kind !== 'production_labor_accrual') continue;
      const debit = sum((journal.lines || [])
        .filter(line => line.account === 'inventory')
        .map(line => line.debit));
      result.productionLaborCapitalization += debit;
      if (finite(journal.meta?.output) <= EPS) {
        result.zeroOutputLaborCapitalization += debit;
        result.zeroOutputLaborJournals += 1;
        if (firm.consumerFacing === true) result.consumerZeroOutputLaborCapitalization += debit;
        else result.nonConsumerZeroOutputLaborCapitalization += debit;
      }
    }
  }

  return {
    ...result,
    bookWithoutPhysicalShareOfFinishedBook: ratio(result.bookWithoutPhysicalUnits, result.finishedBook),
    consumerBookWithoutPhysicalShare: ratio(result.consumerBookWithoutPhysicalUnits, result.consumerFinishedBook),
    zeroOutputLaborCapitalizationShare: ratio(result.zeroOutputLaborCapitalization, result.productionLaborCapitalization),
    consumerZeroOutputShareOfZeroOutput: ratio(result.consumerZeroOutputLaborCapitalization, result.zeroOutputLaborCapitalization)
  };
}

function runSeed(seed) {
  const world = new EconomicWorld(seed, { scaleProfile, healthCheckInterval: 0 });
  const rows = [];
  for (let i = 0; i < months; i++) {
    world.stepMonth();
    for (const country of world.countries || []) {
      const probe = countryProbe(world, country);
      rows.push({
        seed,
        month: world.month,
        countryId: country.id,
        unemployment: finite(country.macro?.unemployment),
        gdp: finite(country.macro?.gdp),
        inventoryInvestment: finite(country.macro?.inventoryInvestment),
        probe
      });
    }
  }
  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${seed}: health gate must pass`);
  assert.equal(rows.length, months * world.countries.length, `${seed}: complete country-month coverage required`);
  return { seed, health, rows };
}

function summarize(rows) {
  const laborCap = sum(rows.map(row => row.probe.productionLaborCapitalization));
  const zeroCap = sum(rows.map(row => row.probe.zeroOutputLaborCapitalization));
  const consumerZeroCap = sum(rows.map(row => row.probe.consumerZeroOutputLaborCapitalization));
  return {
    countryMonths: rows.length,
    rowsWithBookWithoutPhysicalUnits: rows.filter(row => row.probe.bookWithoutPhysicalUnits > EPS).length,
    rowsWithConsumerBookWithoutPhysicalUnits: rows.filter(row => row.probe.consumerBookWithoutPhysicalUnits > EPS).length,
    totalProductionLaborCapitalization: laborCap,
    totalZeroOutputLaborCapitalization: zeroCap,
    zeroOutputLaborCapitalizationShare: ratio(zeroCap, laborCap),
    consumerZeroOutputLaborCapitalization: consumerZeroCap,
    consumerShareOfZeroOutputLaborCapitalization: ratio(consumerZeroCap, zeroCap),
    meanBookWithoutPhysicalShareOfFinishedBook: mean(rows.map(row => row.probe.bookWithoutPhysicalShareOfFinishedBook)),
    meanConsumerBookWithoutPhysicalShare: mean(rows.map(row => row.probe.consumerBookWithoutPhysicalShare)),
    totalBookWithoutPhysicalUnitsObserved: sum(rows.map(row => row.probe.bookWithoutPhysicalUnits)),
    totalConsumerBookWithoutPhysicalUnitsObserved: sum(rows.map(row => row.probe.consumerBookWithoutPhysicalUnits))
  };
}

const runs = seeds.map(runSeed);
const rows = runs.flatMap(run => run.rows);
const terminalRows = rows.filter(row => row.month === months);
const report = {
  schemaVersion: 1,
  kind: 'economic-lab-wp-rv05-book-physical-inventory-probe',
  frozenEconomicBaseline: '698d10749e2897d711e5bcee61913ac34e0650a0',
  scaleProfile,
  months,
  seeds,
  methodology: {
    mechanismChanges: 0,
    parameterTuning: 0,
    definition: 'bookWithoutPhysicalUnits is a positive finished-goods GL inventory balance on a firm whose operational physical finished-goods inventory is <= 1e-8 at the end of the same month.',
    caution: 'This is a stock-representation diagnostic. It does not by itself prescribe the correct write-off, production-cost or bankruptcy treatment.'
  },
  runs,
  full: summarize(rows),
  terminal: {
    summary: summarize(terminalRows),
    rows: terminalRows
  },
  gates: {
    allHealthy: runs.every(run => run.health.ok),
    completeCountryMonthCoverage: rows.length === seeds.length * months * 4,
    finite: rows.every(row => Object.values(row.probe).every(value => Number.isFinite(Number(value))))
  }
};
report.gates.ok = Object.values(report.gates).every(Boolean);
assert.ok(report.gates.ok, 'WP-RV05 book/physical inventory probe gates must pass');

console.table(terminalRows.map(row => ({
  seed: row.seed,
  country: row.countryId,
  finishedBook: Number(row.probe.finishedBook.toFixed(2)),
  physicalUnits: Number(row.probe.physicalFinishedUnits.toFixed(4)),
  consumerBook: Number(row.probe.consumerFinishedBook.toFixed(2)),
  consumerUnits: Number(row.probe.consumerPhysicalUnits.toFixed(8)),
  bookWithoutUnits: Number(row.probe.bookWithoutPhysicalUnits.toFixed(2)),
  consumerBookWithoutUnits: Number(row.probe.consumerBookWithoutPhysicalUnits.toFixed(2)),
  zeroOutputLaborCap: Number(row.probe.zeroOutputLaborCapitalization.toFixed(2))
})));
console.log('WP_RV05_ORPHAN_GATES', JSON.stringify(report.gates));
console.log('WP_RV05_ORPHAN_FULL', JSON.stringify(report.full));
console.log('WP_RV05_ORPHAN_TERMINAL', JSON.stringify(report.terminal.summary));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`WP_RV05_ORPHAN_JSON ${outputJson}`);
}

console.log('Economic Lab WP-RV05 book/physical inventory probe PASS');
