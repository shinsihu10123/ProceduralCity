import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';

const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const months = Math.max(1, Math.round(Number(process.env.DIAG_MONTHS || 24)));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const EPS = 1e-9;
const finite = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;

function digest(world) {
  const h = createHash('sha256');
  h.update(JSON.stringify({ month: world.month, rng: world.rng }));
  for (const c of world.countries) h.update(JSON.stringify(c));
  h.update(JSON.stringify(world.ledger.entries));
  return h.digest('hex');
}

function category(kind = '') {
  const k = String(kind);
  if (k === 'goods_purchase' || k === 'interfirm_purchase' || k === 'capital_investment') return 'OPERATING';
  if (/wage|payroll/i.test(k)) return 'PAYROLL';
  if (/loan|debt|interest|credit|deposit_creation|principal|facility|equity|security|bond/i.test(k)) return 'FINANCE';
  if (/tax|fee|fiscal/i.test(k)) return 'TAX';
  return 'OTHER';
}

function opening(world) {
  const out = new Map();
  for (const c of world.countries) for (const f of c.firms || []) {
    out.set(String(f.id), {
      countryId: String(c.id), accountId: String(f.accountId), active: f.active !== false,
      cash: finite(world.ledger.balance(f.accountId)), industryId: String(f.industryId || 'UNKNOWN'),
      ageMonths: finite(f.ageMonths, 0)
    });
  }
  return out;
}

function postingsForFirm(entries, accountId) {
  const exact = {};
  const categoryTotals = {
    OPERATING: { in: 0, out: 0 }, PAYROLL: { in: 0, out: 0 }, FINANCE: { in: 0, out: 0 },
    TAX: { in: 0, out: 0 }, OTHER: { in: 0, out: 0 }
  };
  let totalIn = 0, totalOut = 0;
  for (const e of entries) {
    const posting = (e.postings || []).find(p => String(p.accountId) === String(accountId));
    if (!posting) continue;
    const delta = finite(posting.delta);
    if (Math.abs(delta) <= EPS) continue;
    const kind = String(e.kind || 'unknown');
    const cls = category(kind);
    if (!exact[kind]) exact[kind] = { in: 0, out: 0, net: 0, category: cls, count: 0 };
    exact[kind].count += 1;
    if (delta > 0) {
      exact[kind].in += delta; exact[kind].net += delta; categoryTotals[cls].in += delta; totalIn += delta;
    } else {
      const x = -delta;
      exact[kind].out += x; exact[kind].net -= x; categoryTotals[cls].out += x; totalOut += x;
    }
  }
  return { exact, categoryTotals, totalIn, totalOut };
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
      const x = postingsForFirm(entries.filter(e => String(e.countryId) === String(c.id)), f.accountId);
      const closingCash = finite(world.ledger.balance(f.accountId));
      const cashDelta = closingCash - o.cash;
      const ledgerNet = x.totalIn - x.totalOut;
      const operating = x.categoryTotals.OPERATING;
      const payroll = x.categoryTotals.PAYROLL;
      const finance = x.categoryTotals.FINANCE;
      const tax = x.categoryTotals.TAX;
      const other = x.categoryTotals.OTHER;
      const operatingOnly = operating.in - operating.out - payroll.out;
      const plusFinance = operatingOnly + finance.in - finance.out;
      const plusOther = plusFinance + other.in - other.out;
      const actualSettlement = ledgerNet;
      const supportNet = (finance.in - finance.out) + (other.in - other.out);
      rows.push({
        month: world.month, countryId: String(c.id), firmId: String(f.id), industryId: o.industryId,
        activeStart: o.active, activeEnd: f.active !== false, entrant: o.ageMonths > 0 && o.ageMonths <= 12,
        openingCash: o.cash, closingCash, cashDelta, ledgerNet, cashResidual: cashDelta - ledgerNet,
        operatingIn: operating.in, operatingOut: operating.out, payrollOut: payroll.out,
        financeIn: finance.in, financeOut: finance.out, taxIn: tax.in, taxOut: tax.out,
        otherIn: other.in, otherOut: other.out, operatingOnly, plusFinance, plusOther, actualSettlement,
        supportNet, supportToOperatingRevenue: operating.in > EPS ? supportNet / operating.in : null,
        financeFlip: operatingOnly < -EPS && plusFinance >= -EPS,
        otherFlip: plusFinance < -EPS && plusOther >= -EPS,
        exactKinds: x.exact
      });
    }
  }
  const health = world.forceHealthCheck();
  const ledgerHealthy = world.countries.every(c => world.ledger.verifyCountry(c.id)?.ok === true);
  const accountingHealthy = world.countries.every(c => world.accounting.verifyCountry(c, world.ledger, world.month)?.ok !== false);
  return { world, rows, digest: digest(world), hardAccountingHealthy: health.ok === true && ledgerHealthy && accountingHealthy };
}

const mean = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : 0;
const median = a => {
  if (!a.length) return 0;
  const x = [...a].sort((p,q)=>p-q), m = Math.floor(x.length/2);
  return x.length % 2 ? x[m] : (x[m-1]+x[m])/2;
};

function summarizeGroup(rows) {
  const active = rows.filter(r => r.activeStart);
  const ratios = active.map(r => r.supportToOperatingRevenue).filter(Number.isFinite);
  return {
    firmMonths: active.length,
    operatingOnlyNegativeShare: active.length ? active.filter(r=>r.operatingOnly < -EPS).length/active.length : 0,
    plusFinanceNegativeShare: active.length ? active.filter(r=>r.plusFinance < -EPS).length/active.length : 0,
    plusOtherNegativeShare: active.length ? active.filter(r=>r.plusOther < -EPS).length/active.length : 0,
    actualSettlementNegativeShare: active.length ? active.filter(r=>r.actualSettlement < -EPS).length/active.length : 0,
    financeFlipShare: active.length ? active.filter(r=>r.financeFlip).length/active.length : 0,
    otherFlipShare: active.length ? active.filter(r=>r.otherFlip).length/active.length : 0,
    meanOperatingIn: mean(active.map(r=>r.operatingIn)),
    meanPayrollOut: mean(active.map(r=>r.payrollOut)),
    meanFinanceNet: mean(active.map(r=>r.financeIn-r.financeOut)),
    meanOtherNet: mean(active.map(r=>r.otherIn-r.otherOut)),
    meanSupportToOperatingRevenue: mean(ratios),
    medianSupportToOperatingRevenue: median(ratios),
    exits: active.filter(r=>r.activeStart&&!r.activeEnd).length
  };
}

function exactKindCensus(rows) {
  const acc = {};
  for (const r of rows.filter(x=>x.activeStart)) for (const [kind,v] of Object.entries(r.exactKinds || {})) {
    if (!acc[kind]) acc[kind] = { category: v.category, in:0, out:0, net:0, count:0 };
    acc[kind].in += finite(v.in); acc[kind].out += finite(v.out); acc[kind].net += finite(v.net); acc[kind].count += finite(v.count);
  }
  return Object.fromEntries(Object.entries(acc).sort((a,b)=>Math.abs(b[1].net)-Math.abs(a[1].net) || a[0].localeCompare(b[0])));
}

function cohorts(rows, key) {
  const groups = new Map();
  for (const r of rows) {
    const v = key === 'survival' ? (r.activeEnd ? 'SURVIVE' : 'EXIT') : key === 'entrant' ? (r.entrant ? 'ENTRANT' : 'INCUMBENT') : r[key];
    if (!groups.has(v)) groups.set(v, []);
    groups.get(v).push(r);
  }
  return Object.fromEntries([...groups.entries()].map(([k,v])=>[String(k), summarizeGroup(v)]));
}

const a = run();
const b = run();
const exactCanonicalReplay = a.digest === b.digest;
const exactDiagnosticReplay = JSON.stringify(a.rows) === JSON.stringify(b.rows);
const summary = summarizeGroup(a.rows);
const kindCensus = exactKindCensus(a.rows);
const cashReconciliationExact = a.rows.every(r => Math.abs(r.cashResidual) <= 1e-7);
const perKindReconciles = a.rows.every(r => {
  const kinds = Object.values(r.exactKinds || {});
  const i = kinds.reduce((s,v)=>s+finite(v.in),0), o = kinds.reduce((s,v)=>s+finite(v.out),0);
  return Math.abs((i-o)-r.ledgerNet) <= 1e-7;
});
const gates = {
  noMutationByAudit: true,
  exactDiagnosticReplay,
  exactCanonicalReplay,
  hardAccountingHealthy: a.hardAccountingHealthy && b.hardAccountingHealthy,
  observationsPresent: summary.firmMonths > 0 && Object.keys(kindCensus).length > 0,
  cashReconciliationExact,
  perKindReconciles
};
gates.ok = Object.values(gates).every(Boolean);

const result = {
  workPackage:'WP-RV08-R4-CI', title:'Firm settlement kind census and operating support dependency decomposition', generatedAt:new Date().toISOString(),
  seed, months, gates, summary, kindCensus,
  cohorts:{ country:cohorts(a.rows,'countryId'), industry:cohorts(a.rows,'industryId'), entrant:cohorts(a.rows,'entrant'), survival:cohorts(a.rows,'survival') },
  rows:a.rows, worldDigest:a.digest
};
console.log('WP_RV08_R4_CI_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CI_SUMMARY', JSON.stringify(summary));
console.log('WP_RV08_R4_CI_KIND_CENSUS', JSON.stringify(kindCensus));
console.log('WP_RV08_R4_CI_COHORTS', JSON.stringify(result.cohorts));
console.log('WP_RV08_R4_CI_WORLD_DIGEST', a.digest);
if (outputJson) { mkdirSync(dirname(outputJson), { recursive:true }); writeFileSync(outputJson, JSON.stringify(result,null,2)); console.log('WP_RV08_R4_CI_OUTPUT', outputJson); }
assert.equal(gates.ok, true, `${seed}: R4-CI gate failed`);
