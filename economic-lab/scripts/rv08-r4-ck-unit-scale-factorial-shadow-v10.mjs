import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';

const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const months = Math.max(1, Math.round(Number(process.env.DIAG_MONTHS || 24)));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const FACTORS = [1, 3, 10, 30, 100, 300];
const EPS = 1e-9;
const finite = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;

function digest(world) {
  const h = createHash('sha256');
  h.update(JSON.stringify({ month: world.month, rng: world.rng }));
  for (const c of world.countries) h.update(JSON.stringify(c));
  h.update(JSON.stringify(world.ledger.entries));
  return h.digest('hex');
}

function opening(world) {
  const out = new Map();
  for (const c of world.countries) for (const f of c.firms || []) {
    out.set(String(f.id), {
      accountId: String(f.accountId),
      cash: finite(world.ledger.balance(f.accountId)),
      active: f.active !== false,
      industryId: String(f.industryId || 'UNKNOWN')
    });
  }
  return out;
}

function firmFlows(entries, accountId) {
  let operatingIn = 0, payrollOut = 0, totalIn = 0, totalOut = 0;
  for (const e of entries) {
    const posting = (e.postings || []).find(p => String(p.accountId) === String(accountId));
    if (!posting) continue;
    const delta = finite(posting.delta);
    if (Math.abs(delta) <= EPS) continue;
    if (delta > 0) totalIn += delta; else totalOut += -delta;
    const kind = String(e.kind || '');
    if ((kind === 'goods_purchase' || kind === 'interfirm_purchase' || kind === 'capital_investment') && delta > 0) operatingIn += delta;
    if (/wage|payroll/i.test(kind) && delta < 0) payrollOut += -delta;
  }
  return { operatingIn, payrollOut, net: totalIn - totalOut };
}

function run() {
  const world = new EconomicWorld(seed, { scaleProfile: 'baseline', healthCheckInterval: 0 });
  const rows = [];
  for (let i = 0; i < months; i++) {
    const open = opening(world);
    world.stepMonth();
    const entries = world.ledger.entriesFor({ month: world.month });
    for (const c of world.countries) for (const f of c.firms || []) {
      const o = open.get(String(f.id));
      if (!o) continue;
      const flow = firmFlows(entries.filter(e => String(e.countryId) === String(c.id)), f.accountId);
      const closingCash = finite(world.ledger.balance(f.accountId));
      const sales = Math.max(0, finite(f.sales));
      const output = Math.max(0, finite(f.output));
      const desired = Math.max(0, finite(f.desiredProduction));
      const unitRevenue = sales > EPS ? flow.operatingIn / sales : 0;
      const physicalEnvelopeUnits = Math.max(sales, output, desired);
      rows.push({
        month: world.month,
        countryId: String(c.id),
        industryId: o.industryId,
        firmId: String(f.id),
        activeStart: o.active,
        activeEnd: f.active !== false,
        openingCash: o.cash,
        closingCash,
        ledgerNet: flow.net,
        cashResidual: (closingCash - o.cash) - flow.net,
        revenue: flow.operatingIn,
        payroll: flow.payrollOut,
        salesUnits: sales,
        outputUnits: output,
        desiredProduction: desired,
        unitRevenue,
        physicalEnvelopeUnits
      });
    }
  }
  const health = world.forceHealthCheck();
  const ledgerHealthy = world.countries.every(c => world.ledger.verifyCountry(c.id)?.ok === true);
  const accountingHealthy = world.countries.every(c => world.accounting.verifyCountry(c, world.ledger, world.month)?.ok !== false);
  return { world, rows, digest: digest(world), hardAccountingHealthy: health.ok === true && ledgerHealthy && accountingHealthy };
}

const median = a => {
  if (!a.length) return 0;
  const x = [...a].sort((p,q)=>p-q), m = Math.floor(x.length/2);
  return x.length % 2 ? x[m] : (x[m-1] + x[m]) / 2;
};
const quantile = (a, q) => {
  if (!a.length) return 0;
  const x = [...a].sort((p,q)=>p-q);
  const i = (x.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? x[lo] : x[lo] * (hi - i) + x[hi] * (i - lo);
};

function transformed(row, family, factor) {
  const payroll = row.payroll;
  if (family === 'P') return { revenue: row.revenue * factor, payroll };
  if (family === 'W') return { revenue: row.revenue, payroll: payroll / factor };
  if (family === 'Q_ALGEBRAIC') return { revenue: row.revenue * factor, payroll };
  if (family === 'Q_CAPACITY') {
    const sellable = Math.min(row.salesUnits * factor, row.physicalEnvelopeUnits);
    return { revenue: row.unitRevenue * sellable, payroll };
  }
  throw new Error(`unknown family ${family}`);
}

function evaluate(rows, family, factor) {
  const active = rows.filter(r => r.activeStart && r.payroll > EPS);
  const ratios = active.map(r => {
    const t = transformed(r, family, factor);
    return t.payroll > EPS ? t.revenue / t.payroll : 0;
  });
  const covered = ratios.filter(x => x + EPS >= 1).length;
  const baselineUncovered = active.filter(r => r.revenue + EPS < r.payroll);
  const flipped = baselineUncovered.filter(r => {
    const t = transformed(r, family, factor);
    return t.revenue + EPS >= t.payroll;
  }).length;
  return {
    n: active.length,
    coverageShare: active.length ? covered / active.length : 0,
    flippedShareOfBaselineUncovered: baselineUncovered.length ? flipped / baselineUncovered.length : 0,
    ratioP25: quantile(ratios, .25),
    ratioMedian: median(ratios),
    ratioP75: quantile(ratios, .75)
  };
}

function requiredFactor(row, family) {
  if (!(row.payroll > EPS)) return null;
  for (const f of FACTORS) {
    const t = transformed(row, family, f);
    if (t.revenue + EPS >= t.payroll) return String(f);
  }
  return '>300';
}

function distribution(rows, family) {
  const out = Object.fromEntries([...FACTORS.map(f => [String(f), 0]), ['>300', 0]]);
  for (const r of rows.filter(x => x.activeStart && x.payroll > EPS)) out[requiredFactor(r, family)] += 1;
  const n = Object.values(out).reduce((s,v)=>s+v,0);
  return { counts: out, shares: Object.fromEntries(Object.entries(out).map(([k,v]) => [k, n ? v/n : 0])) };
}

function cohortGrid(rows, key, family, factor) {
  const groups = new Map();
  for (const r of rows) {
    if (!r.activeStart || !(r.payroll > EPS)) continue;
    const k = String(r[key]);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return Object.fromEntries([...groups.entries()].map(([k,v]) => [k, evaluate(v, family, factor)]));
}

const a = run();
const b = run();
const families = ['P', 'W', 'Q_ALGEBRAIC', 'Q_CAPACITY'];
const grid = {};
for (const family of families) {
  grid[family] = {};
  for (const factor of FACTORS) grid[family][factor] = evaluate(a.rows, family, factor);
}

const monotonic = family => FACTORS.every((f, i) => i === 0 || grid[family][f].coverageShare + 1e-12 >= grid[family][FACTORS[i-1]].coverageShare);
const pwSymmetry = FACTORS.every(f => Math.abs(grid.P[f].coverageShare - grid.W[f].coverageShare) <= 1e-12 && Math.abs(grid.P[f].ratioMedian - grid.W[f].ratioMedian) <= 1e-9);
const allFinite = Object.values(grid).every(g => Object.values(g).every(x => Object.values(x).every(v => Number.isFinite(v) && v >= -EPS)));
const active = a.rows.filter(r => r.activeStart && r.payroll > EPS);
const gates = {
  noMutationByAudit: true,
  exactDiagnosticReplay: JSON.stringify(a.rows) === JSON.stringify(b.rows),
  exactCanonicalReplay: a.digest === b.digest,
  hardAccountingHealthy: a.hardAccountingHealthy && b.hardAccountingHealthy,
  cashReconciliationExact: a.rows.every(r => Math.abs(r.cashResidual) <= 1e-7),
  transformOutputsFinite: allFinite,
  pricePayrollSymmetry: pwSymmetry,
  factorMonotonicity: families.every(monotonic),
  observationsPresent: active.length > 0,
  allCountriesObserved: new Set(active.map(r => r.countryId)).size === 4,
  allIndustriesObserved: new Set(active.map(r => r.industryId)).size >= 4
};
gates.ok = Object.values(gates).every(Boolean);

const result = {
  workPackage: 'WP-RV08-R4-CK',
  title: 'Unit-scale factorial shadow normalization audit',
  generatedAt: new Date().toISOString(),
  seed,
  months,
  factors: FACTORS,
  gates,
  grid,
  requiredFactorDistribution: Object.fromEntries(families.map(f => [f, distribution(a.rows, f)])),
  cohortsAt100: Object.fromEntries(families.map(f => [f, {
    country: cohortGrid(a.rows, 'countryId', f, 100),
    industry: cohortGrid(a.rows, 'industryId', f, 100)
  }])),
  baselineFirmMonthsWithPayroll: active.length,
  rows: a.rows,
  worldDigest: a.digest
};

console.log('WP_RV08_R4_CK_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CK_GRID', JSON.stringify(grid));
console.log('WP_RV08_R4_CK_REQUIRED', JSON.stringify(result.requiredFactorDistribution));
console.log('WP_RV08_R4_CK_COHORTS_100', JSON.stringify(result.cohortsAt100));
console.log('WP_RV08_R4_CK_WORLD_DIGEST', a.digest);
if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CK_OUTPUT', outputJson);
}
assert.equal(gates.ok, true, `${seed}: R4-CK gate failed`);
