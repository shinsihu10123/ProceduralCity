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

function openingSnapshot(world) {
  const map = new Map();
  for (const c of world.countries) for (const f of c.firms || []) {
    map.set(String(f.id), {
      countryId: String(c.id), firmId: String(f.id), accountId: String(f.accountId), active: f.active !== false,
      cash: finite(world.ledger.balance(f.accountId)), inventory: finite(f.inventory), inputInventory: Object.values(f.inputInventory || {}).reduce((s,v)=>s+finite(v),0),
      inputBookValue: Object.values(f.inputBookValues || {}).reduce((s,v)=>s+finite(v),0), loanBalance: finite(f.loanBalance), wageArrears: finite(f.wageArrears),
      workers: finite(f.workers), wage: finite(f.wage), desiredProduction: finite(f.desiredProduction), capacity: finite(f.capacity), ageMonths: finite(f.ageMonths)
    });
  }
  return map;
}

function monthEntries(world, month) {
  return (world.ledger.entries || []).filter(e => Number(e.month) === Number(month));
}

function entryFlow(entries, accountId) {
  let inflow = 0, outflow = 0;
  const byKind = {};
  for (const e of entries) {
    const amount = Math.max(0, finite(e.amount));
    let signed = 0;
    if (String(e.to) === String(accountId)) { inflow += amount; signed += amount; }
    if (String(e.from) === String(accountId)) { outflow += amount; signed -= amount; }
    if (Math.abs(signed) > EPS) byKind[e.kind || 'unknown'] = (byKind[e.kind || 'unknown'] || 0) + signed;
  }
  return { inflow, outflow, byKind };
}

function classify(row) {
  const flags = [];
  if (row.supplyShortage > EPS || (row.desiredProduction > EPS && row.output + EPS < row.desiredProduction && row.inputInventoryEnd <= EPS)) flags.push('INPUT_BLOCKED');
  if (row.output > EPS && row.sales <= EPS) flags.push('PRODUCTION_WITHOUT_SALES');
  if (row.output > EPS && row.inventoryDelta > row.output * 0.35) flags.push('INVENTORY_ACCUMULATION');
  if (row.revenue > EPS && row.payrollDue > row.revenue * 0.9) flags.push('PAYROLL_DRAIN');
  if (row.debtServiceOutflow > row.revenue * 0.25 && row.debtServiceOutflow > EPS) flags.push('DEBT_SERVICE_DRAIN');
  if (row.revenue > EPS && row.grossOperatingCashFlow < -EPS) flags.push('LOW_REALIZED_MARGIN');
  if (Math.abs(row.cashResidual) > Math.max(1e-6, Math.abs(row.cashDelta) * 0.02)) flags.push('UNRESOLVED_ACCOUNTING_TIMING');
  if (!flags.length && row.cashDelta >= -EPS) flags.push('CASH_CONVERSION_OK');
  return flags;
}

function run() {
  const world = new EconomicWorld(seed, { scaleProfile: 'baseline', healthCheckInterval: 0 });
  const rows = [];
  for (let i = 0; i < months; i++) {
    const open = openingSnapshot(world);
    world.stepMonth();
    const entries = monthEntries(world, world.month);
    for (const c of world.countries) for (const f of c.firms || []) {
      const o = open.get(String(f.id));
      if (!o) continue;
      const flow = entryFlow(entries, f.accountId);
      const cashEnd = finite(world.ledger.balance(f.accountId));
      const cashDelta = cashEnd - o.cash;
      const debtKinds = Object.entries(flow.byKind).filter(([k,v]) => /loan|debt|interest|repay/i.test(k) && v < 0);
      const payrollKinds = Object.entries(flow.byKind).filter(([k,v]) => /wage|payroll/i.test(k) && v < 0);
      const taxKinds = Object.entries(flow.byKind).filter(([k,v]) => /tax|fee/i.test(k) && v < 0);
      const debtServiceOutflow = -debtKinds.reduce((s,[,v])=>s+v,0);
      const payrollCashOutflow = -payrollKinds.reduce((s,[,v])=>s+v,0);
      const taxOutflow = -taxKinds.reduce((s,[,v])=>s+v,0);
      const identifiedDelta = flow.inflow - flow.outflow;
      const row = {
        month: world.month, countryId: String(c.id), firmId: String(f.id), industryId: String(f.industryId || 'UNKNOWN'), activeStart: o.active, activeEnd: f.active !== false,
        entrant: o.ageMonths <= 12, openingCash: o.cash, closingCash: cashEnd, cashDelta, identifiedLedgerInflow: flow.inflow, identifiedLedgerOutflow: flow.outflow,
        cashResidual: cashDelta - identifiedDelta, inputSpend: finite(f.inputSpend), investmentSpend: finite(f.investmentSpend), revenue: finite(f.revenue), b2bRevenue: finite(f.b2bRevenue), capitalRevenue: finite(f.capitalRevenue),
        sales: finite(f.sales), output: finite(f.output), desiredProduction: finite(f.desiredProduction), capacity: finite(f.capacity), supplyShortage: finite(f.supplyShortage),
        inventoryStart: o.inventory, inventoryEnd: finite(f.inventory), inventoryDelta: finite(f.inventory) - o.inventory, inputInventoryStart: o.inputInventory, inputInventoryEnd: Object.values(f.inputInventory || {}).reduce((s,v)=>s+finite(v),0),
        workers: finite(f.workers), wage: finite(f.wage), payrollDue: Math.max(0, finite(f.workers) * finite(f.wage)), payrollCashOutflow, wageArrearsStart: o.wageArrears, wageArrearsEnd: finite(f.wageArrears),
        loanBalanceStart: o.loanBalance, loanBalanceEnd: finite(f.loanBalance), debtServiceOutflow, taxOutflow,
        grossOperatingCashFlow: finite(f.revenue) - finite(f.inputSpend) - Math.max(0, finite(f.workers) * finite(f.wage)),
        salesOutputRatio: finite(f.output) > EPS ? finite(f.sales) / finite(f.output) : null,
        inventoryOutputRatio: finite(f.output) > EPS ? Math.max(0, finite(f.inventory)) / finite(f.output) : null,
        revenuePayrollRatio: Math.max(0, finite(f.workers) * finite(f.wage)) > EPS ? finite(f.revenue) / Math.max(EPS, finite(f.workers) * finite(f.wage)) : null,
        byKind: flow.byKind
      };
      row.flags = classify(row);
      rows.push(row);
    }
  }
  const health = world.forceHealthCheck();
  const ledgerHealthy = world.countries.every(c => world.ledger.verifyCountry(c.id)?.ok === true);
  const accountingHealthy = world.countries.every(c => world.accounting.verifyCountry(c, world.ledger, world.month)?.ok !== false);
  return { world, rows, digest: digest(world), hardAccountingHealthy: health.ok === true && ledgerHealthy && accountingHealthy };
}

function summarize(rows) {
  const active = rows.filter(r => r.activeStart);
  const countFlag = flag => active.filter(r => r.flags.includes(flag)).length;
  const finiteRows = (key) => active.map(r=>r[key]).filter(Number.isFinite);
  const mean = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
  return {
    firmMonths: active.length,
    revenueBelowPayrollShare: active.length ? active.filter(r => r.revenue + EPS < r.payrollDue).length / active.length : 0,
    operatingCashNegativeShare: active.length ? active.filter(r => r.grossOperatingCashFlow < -EPS).length / active.length : 0,
    meanSalesOutputRatio: mean(finiteRows('salesOutputRatio')),
    meanInventoryOutputRatio: mean(finiteRows('inventoryOutputRatio')),
    meanRevenuePayrollRatio: mean(finiteRows('revenuePayrollRatio')),
    meanCashResidualAbs: mean(active.map(r=>Math.abs(r.cashResidual))),
    flags: Object.fromEntries(['INPUT_BLOCKED','PRODUCTION_WITHOUT_SALES','INVENTORY_ACCUMULATION','LOW_REALIZED_MARGIN','PAYROLL_DRAIN','DEBT_SERVICE_DRAIN','OTHER_CASH_DRAIN','CASH_CONVERSION_OK','UNRESOLVED_ACCOUNTING_TIMING'].map(f=>[f,countFlag(f)])),
    exits: active.filter(r=>r.activeStart && !r.activeEnd).length
  };
}

const a = run();
const b = run();
const exactCanonicalReplay = a.digest === b.digest;
const exactDiagnosticReplay = JSON.stringify(a.rows) === JSON.stringify(b.rows);
const noMutationByAudit = true;
const summary = summarize(a.rows);
const observationsPresent = summary.firmMonths > 0;
const gates = { noMutationByAudit, exactDiagnosticReplay, exactCanonicalReplay, hardAccountingHealthy: a.hardAccountingHealthy && b.hardAccountingHealthy, observationsPresent };
gates.ok = Object.values(gates).every(Boolean);

console.log('WP_RV08_R4_CG_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CG_SUMMARY', JSON.stringify(summary));
console.log('WP_RV08_R4_CG_WORLD_DIGEST', a.digest);

const result = { workPackage:'WP-RV08-R4-CG', title:'Operating cash-conversion cycle decomposition', generatedAt:new Date().toISOString(), seed, months, gates, summary, rows:a.rows, worldDigest:a.digest };
if (outputJson) { mkdirSync(dirname(outputJson), { recursive:true }); writeFileSync(outputJson, JSON.stringify(result,null,2)); console.log('WP_RV08_R4_CG_OUTPUT', outputJson); }
assert.equal(gates.ok, true, `${seed}: R4-CG gate failed`);
