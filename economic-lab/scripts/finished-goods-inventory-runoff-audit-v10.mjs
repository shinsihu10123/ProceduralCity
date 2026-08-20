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

function installAudit(world) {
  world.__rv07P34 = {
    opening: new Map(),
    produced: new Map(),
    closing: new Map()
  };

  const beginMonth = world.supply.beginMonth.bind(world.supply);
  world.supply.beginMonth = country => {
    const out = beginMonth(country);
    const rows = new Map();
    for (const f of country.firms.filter(x => x.active !== false)) {
      rows.set(f.id, {
        firmId: f.id,
        industryId: f.industryId,
        openingInventory: finite(f.inventory)
      });
    }
    world.__rv07P34.opening.set(`${world.month}|${country.id}`, rows);
    return out;
  };

  const produce = world.supply.produce.bind(world.supply);
  world.supply.produce = (country, month, metrics) => {
    const out = produce(country, month, metrics);
    world.__rv07P34.produced.set(
      `${month}|${country.id}`,
      new Map(country.firms.filter(x => x.active !== false).map(f => [f.id, finite(f.output)]))
    );
    return out;
  };

  const finalize = world.supply.finalizeMetrics.bind(world.supply);
  world.supply.finalizeMetrics = (country, metrics) => {
    world.__rv07P34.closing.set(
      `${world.month}|${country.id}`,
      new Map(country.firms.filter(x => x.active !== false).map(f => [f.id, {
        sales: finite(f.sales),
        closingInventory: finite(f.inventory),
        revenue: finite(f.revenue),
        consumerSales: finite(f.consumerSales),
        b2bSales: finite(f.b2bSales),
        capitalSales: finite(f.capitalSales)
      }]))
    );
    return finalize(country, metrics);
  };
}

function runWorld(scaleProfile, seed, horizon, audited, captureFingerprint = false) {
  const world = createWorld(scaleProfile, seed);
  if (audited) installAudit(world);
  const rows = [];

  for (let i = 0; i < horizon; i++) {
    world.stepMonth();
    if (!audited) continue;

    for (const country of world.countries) {
      const key = `${world.month}|${country.id}`;
      const opening = world.__rv07P34.opening.get(key) || new Map();
      const produced = world.__rv07P34.produced.get(key) || new Map();
      const closing = world.__rv07P34.closing.get(key) || new Map();
      assert.ok(opening.size > 0, `${key}: opening snapshot missing`);

      for (const [firmId, a] of opening) {
        const output = produced.get(firmId);
        const z = closing.get(firmId);
        assert.ok(output !== undefined, `${key}/${firmId}: output snapshot missing`);
        assert.ok(z, `${key}/${firmId}: closing snapshot missing`);
        const stockResidual = a.openingInventory + output - z.sales - z.closingInventory;
        rows.push({
          scaleProfile,
          seed,
          month: world.month,
          countryId: country.id,
          firmId,
          industryId: a.industryId,
          openingInventory: a.openingInventory,
          output,
          sales: z.sales,
          closingInventory: z.closingInventory,
          revenue: z.revenue,
          consumerSales: z.consumerSales,
          b2bSales: z.b2bSales,
          capitalSales: z.capitalSales,
          netStockDrawdown: Math.max(0, z.sales - output),
          netStockAccumulation: Math.max(0, output - z.sales),
          salesToOutput: ratio(z.sales, output),
          drawdownShareOfSales: ratio(Math.max(0, z.sales - output), z.sales),
          salesAboveOutput: z.sales > output + TOL,
          nearZeroClosingStock: z.closingInventory <= 1e-6,
          stockResidual,
          gdpResidual: gdpResidual(country.macro),
          ledgerOk: world.ledger.verifyCountry(country.id)?.ok === true
        });
      }
    }
  }

  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${scaleProfile}/${seed}: health failed`);
  return {
    rows,
    health,
    fingerprint: captureFingerprint ? fingerprint(world) : null
  };
}

const nonInterference = [];
for (const scaleProfile of scales) {
  const seed = `ECON-RV07-P34-NI-${scaleProfile}`;
  const h = Math.min(3, months);
  const a = runWorld(scaleProfile, seed, h, false, true).fingerprint;
  const b = runWorld(scaleProfile, seed, h, true, true).fingerprint;
  const exact = JSON.stringify(a) === JSON.stringify(b);
  assert.ok(exact, `${scaleProfile}: observer interference`);
  nonInterference.push({ scaleProfile, exact });
}

const runs = [];
for (const scaleProfile of scales) {
  for (const seed of seeds) runs.push(runWorld(scaleProfile, seed, months, true, false));
}
const rows = runs.flatMap(r => r.rows);

const windows = [
  { id: 'M1-3', from: 1, to: Math.min(3, months) },
  { id: 'M4-6', from: 4, to: Math.min(6, months) },
  { id: 'M7-9', from: 7, to: Math.min(9, months) },
  { id: 'M10-12', from: 10, to: months },
  { id: 'FULL', from: 1, to: months }
].filter(w => w.from <= w.to);

function aggregate(rs) {
  return {
    firmMonths: rs.length,
    meanOpeningInventory: mean(rs.map(r => r.openingInventory)),
    meanOutput: mean(rs.map(r => r.output)),
    meanSales: mean(rs.map(r => r.sales)),
    meanClosingInventory: mean(rs.map(r => r.closingInventory)),
    aggregateSalesToOutput: ratio(sum(rs.map(r => r.sales)), sum(rs.map(r => r.output))),
    aggregateDrawdownShareOfSales: ratio(sum(rs.map(r => r.netStockDrawdown)), sum(rs.map(r => r.sales))),
    meanNetStockDrawdown: mean(rs.map(r => r.netStockDrawdown)),
    meanNetStockAccumulation: mean(rs.map(r => r.netStockAccumulation)),
    salesAboveOutputShare: ratio(rs.filter(r => r.salesAboveOutput).length, rs.length),
    nearZeroClosingStockShare: ratio(rs.filter(r => r.nearZeroClosingStock).length, rs.length),
    meanRevenue: mean(rs.map(r => r.revenue))
  };
}

const industrySummary = [];
for (const scaleProfile of scales) {
  for (const w of windows) {
    for (const industryId of ['RESOURCE', 'MATERIALS', 'CAPITAL', 'CONSUMER']) {
      industrySummary.push({
        scaleProfile,
        window: w.id,
        industryId,
        ...aggregate(rows.filter(r =>
          r.scaleProfile === scaleProfile &&
          r.month >= w.from && r.month <= w.to &&
          r.industryId === industryId
        ))
      });
    }
  }
}

const maxStockResidual = Math.max(0, ...rows.map(r => Math.abs(r.stockResidual)));
const maxGdpResidual = Math.max(0, ...rows.map(r => Math.abs(r.gdpResidual)));
const gates = {
  observerNonInterferenceExact: nonInterference.every(x => x.exact),
  allHealthy: runs.every(r => r.health?.ok === true),
  rowsPresent: rows.length > 0,
  stockIdentityReconciled: maxStockResidual < TOL,
  ledgerCountriesOk: rows.every(r => r.ledgerOk),
  gdpIdentityReconciled: maxGdpResidual < TOL,
  finiteRows: rows.every(r =>
    Number.isFinite(r.openingInventory) &&
    Number.isFinite(r.output) &&
    Number.isFinite(r.sales) &&
    Number.isFinite(r.closingInventory)
  )
};
gates.ok = Object.values(gates).every(Boolean);
assert.ok(gates.ok, `WP-RV07-P34 gates failed: ${JSON.stringify(gates)}`);

console.table(industrySummary.filter(x => x.scaleProfile === 'baseline').map(x => ({
  window: x.window,
  industry: x.industryId,
  opening: +x.meanOpeningInventory.toFixed(2),
  output: +x.meanOutput.toFixed(2),
  sales: +x.meanSales.toFixed(2),
  closing: +x.meanClosingInventory.toFixed(2),
  salesOutput: +x.aggregateSalesToOutput.toFixed(3),
  drawdownShare: +x.aggregateDrawdownShareOfSales.toFixed(3),
  drawdownCases: +x.salesAboveOutputShare.toFixed(3),
  nearZero: +x.nearZeroClosingStockShare.toFixed(3)
})));
console.log('WP_RV07_P34_GATES', JSON.stringify(gates));

const payload = {
  workPackage: 'WP-RV07-P34',
  title: 'Finished-goods inventory runoff / sales-sustainability audit',
  generatedAt: new Date().toISOString(),
  configuration: { scales, seeds, months },
  nonInterference,
  gates,
  reconciliation: { maxStockResidual, maxGdpResidual },
  industrySummary,
  rows
};

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(payload, null, 2));
  console.log('WP_RV07_P34_OUTPUT', outputJson);
}
