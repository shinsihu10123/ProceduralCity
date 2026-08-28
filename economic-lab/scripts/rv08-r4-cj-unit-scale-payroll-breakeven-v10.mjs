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
  let operatingIn = 0;
  let payrollOut = 0;
  let totalIn = 0;
  let totalOut = 0;
  for (const e of entries) {
    const posting = (e.postings || []).find(p => String(p.accountId) === String(accountId));
    if (!posting) continue;
    const delta = finite(posting.delta);
    if (Math.abs(delta) <= EPS) continue;
    if (delta > 0) totalIn += delta;
    else totalOut += -delta;
    const kind = String(e.kind || '');
    if ((kind === 'goods_purchase' || kind === 'interfirm_purchase' || kind === 'capital_investment') && delta > 0) operatingIn += delta;
    if (/wage|payroll/i.test(kind) && delta < 0) payrollOut += -delta;
  }
  return { operatingIn, payrollOut, totalIn, totalOut, net: totalIn - totalOut };
}

function safeRatio(a, b) {
  return b > EPS ? a / b : null;
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
      const countryEntries = entries.filter(e => String(e.countryId) === String(c.id));
      const flow = firmFlows(countryEntries, f.accountId);
      const closingCash = finite(world.ledger.balance(f.accountId));
      const cashDelta = closingCash - o.cash;
      const price = Math.max(EPS, finite(f.price, 0));
      const workers = Math.max(0, finite(f.workers, 0));
      const wage = Math.max(0, finite(f.wage, 0));
      const nominalPayroll = workers * wage;
      const sales = Math.max(0, finite(f.sales, 0));
      const output = Math.max(0, finite(f.output, 0));
      const desiredProduction = Math.max(0, finite(f.desiredProduction, 0));
      const inventory = Math.max(0, finite(f.inventory, 0));
      const actualPayrollBreakEvenUnits = flow.payrollOut > EPS ? flow.payrollOut / price : 0;
      const nominalPayrollBreakEvenUnits = nominalPayroll > EPS ? nominalPayroll / price : 0;
      const realizedSalesPerWorker = workers > EPS ? sales / workers : null;
      const flags = [];
      if (flow.payrollOut > EPS && output + EPS < actualPayrollBreakEvenUnits) flags.push('PHYSICAL_OUTPUT_INSUFFICIENT');
      if (flow.payrollOut > EPS && output + EPS >= actualPayrollBreakEvenUnits && sales + EPS < actualPayrollBreakEvenUnits) flags.push('SELL_THROUGH_INSUFFICIENT');
      if (nominalPayrollBreakEvenUnits > Math.max(EPS, desiredProduction, output) * 2) flags.push('NOMINAL_PAYROLL_SCALE_STRESS');
      if (workers > EPS && wage / price > Math.max(EPS, finite(realizedSalesPerWorker, 0)) * 2) flags.push('PRICE_WAGE_SCALE_STRESS');
      if (flow.operatingIn + EPS >= flow.payrollOut && flow.payrollOut > EPS) flags.push('OPERATING_REVENUE_COVERS_PAYROLL');
      if (output <= EPS && sales <= EPS) flags.push('ZERO_OR_NEAR_ZERO_OPERATIONS');
      rows.push({
        month: world.month,
        countryId: String(c.id),
        firmId: String(f.id),
        industryId: o.industryId,
        activeStart: o.active,
        activeEnd: f.active !== false,
        openingCash: o.cash,
        closingCash,
        cashDelta,
        ledgerNet: flow.net,
        cashResidual: cashDelta - flow.net,
        operatingRevenue: flow.operatingIn,
        actualPayrollOut: flow.payrollOut,
        workers,
        wage,
        price,
        nominalPayroll,
        salesUnits: sales,
        outputUnits: output,
        desiredProduction,
        inventoryUnits: inventory,
        actualPayrollBreakEvenUnits,
        nominalPayrollBreakEvenUnits,
        salesCoverageOfActualPayroll: safeRatio(sales, actualPayrollBreakEvenUnits),
        outputCoverageOfActualPayroll: safeRatio(output, actualPayrollBreakEvenUnits),
        salesCoverageOfNominalPayroll: safeRatio(sales, nominalPayrollBreakEvenUnits),
        revenuePayrollRatio: safeRatio(flow.operatingIn, flow.payrollOut),
        revenuePerWorker: safeRatio(flow.operatingIn, workers),
        wageToPriceRatio: wage / price,
        realizedSalesPerWorker,
        flags
      });
    }
  }
  const health = world.forceHealthCheck();
  const ledgerHealthy = world.countries.every(c => world.ledger.verifyCountry(c.id)?.ok === true);
  const accountingHealthy = world.countries.every(c => world.accounting.verifyCountry(c, world.ledger, world.month)?.ok !== false);
  return { world, rows, digest: digest(world), hardAccountingHealthy: health.ok === true && ledgerHealthy && accountingHealthy };
}

const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const median = a => {
  if (!a.length) return 0;
  const x = [...a].sort((p, q) => p - q);
  const m = Math.floor(x.length / 2);
  return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2;
};
const vals = (rows, key) => rows.map(r => r[key]).filter(Number.isFinite);

function summarize(rows) {
  const active = rows.filter(r => r.activeStart);
  const withPayroll = active.filter(r => r.actualPayrollOut > EPS);
  const withWorkers = active.filter(r => r.workers > EPS);
  const ratioVals = (key, source = withPayroll) => source.map(r => r[key]).filter(Number.isFinite);
  const flags = {};
  for (const r of active) for (const flag of r.flags || []) flags[flag] = (flags[flag] || 0) + 1;
  return {
    firmMonths: active.length,
    withPayrollFirmMonths: withPayroll.length,
    meanOperatingRevenue: mean(vals(active, 'operatingRevenue')),
    meanActualPayrollOut: mean(vals(active, 'actualPayrollOut')),
    meanNominalPayroll: mean(vals(active, 'nominalPayroll')),
    meanWorkers: mean(vals(active, 'workers')),
    meanWage: mean(vals(withWorkers, 'wage')),
    meanPrice: mean(vals(active, 'price')),
    meanSalesUnits: mean(vals(active, 'salesUnits')),
    meanOutputUnits: mean(vals(active, 'outputUnits')),
    meanDesiredProduction: mean(vals(active, 'desiredProduction')),
    meanActualPayrollBreakEvenUnits: mean(vals(withPayroll, 'actualPayrollBreakEvenUnits')),
    medianActualPayrollBreakEvenUnits: median(vals(withPayroll, 'actualPayrollBreakEvenUnits')),
    meanNominalPayrollBreakEvenUnits: mean(vals(withWorkers, 'nominalPayrollBreakEvenUnits')),
    medianNominalPayrollBreakEvenUnits: median(vals(withWorkers, 'nominalPayrollBreakEvenUnits')),
    meanSalesCoverageActualPayroll: mean(ratioVals('salesCoverageOfActualPayroll')),
    medianSalesCoverageActualPayroll: median(ratioVals('salesCoverageOfActualPayroll')),
    meanOutputCoverageActualPayroll: mean(ratioVals('outputCoverageOfActualPayroll')),
    medianOutputCoverageActualPayroll: median(ratioVals('outputCoverageOfActualPayroll')),
    meanRevenuePayrollRatio: mean(ratioVals('revenuePayrollRatio')),
    medianRevenuePayrollRatio: median(ratioVals('revenuePayrollRatio')),
    meanWageToPriceRatio: mean(vals(withWorkers, 'wageToPriceRatio')),
    medianWageToPriceRatio: median(vals(withWorkers, 'wageToPriceRatio')),
    flagShares: Object.fromEntries(Object.entries(flags).map(([k, v]) => [k, active.length ? v / active.length : 0])),
    exits: active.filter(r => r.activeStart && !r.activeEnd).length
  };
}

function cohorts(rows, key) {
  const groups = new Map();
  for (const r of rows) {
    const v = r[key];
    if (!groups.has(v)) groups.set(v, []);
    groups.get(v).push(r);
  }
  return Object.fromEntries([...groups.entries()].map(([k, v]) => [String(k), summarize(v)]));
}

const a = run();
const b = run();
const summary = summarize(a.rows);
const gates = {
  noMutationByAudit: true,
  exactDiagnosticReplay: JSON.stringify(a.rows) === JSON.stringify(b.rows),
  exactCanonicalReplay: a.digest === b.digest,
  hardAccountingHealthy: a.hardAccountingHealthy && b.hardAccountingHealthy,
  cashReconciliationExact: a.rows.every(r => Math.abs(r.cashResidual) <= 1e-7),
  finiteBreakEvenValues: a.rows.every(r => Number.isFinite(r.actualPayrollBreakEvenUnits) && r.actualPayrollBreakEvenUnits >= -EPS && Number.isFinite(r.nominalPayrollBreakEvenUnits) && r.nominalPayrollBreakEvenUnits >= -EPS),
  observationsPresent: summary.firmMonths > 0 && summary.withPayrollFirmMonths > 0,
  allCountriesObserved: new Set(a.rows.filter(r => r.activeStart).map(r => r.countryId)).size === 4
};
gates.ok = Object.values(gates).every(Boolean);

const result = {
  workPackage: 'WP-RV08-R4-CJ',
  title: 'Firm unit-scale payroll burden and break-even coherence audit',
  generatedAt: new Date().toISOString(),
  seed,
  months,
  gates,
  summary,
  cohorts: { country: cohorts(a.rows, 'countryId'), industry: cohorts(a.rows, 'industryId') },
  rows: a.rows,
  worldDigest: a.digest
};

console.log('WP_RV08_R4_CJ_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CJ_SUMMARY', JSON.stringify(summary));
console.log('WP_RV08_R4_CJ_COHORTS', JSON.stringify(result.cohorts));
console.log('WP_RV08_R4_CJ_WORLD_DIGEST', a.digest);
if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CJ_OUTPUT', outputJson);
}
assert.equal(gates.ok, true, `${seed}: R4-CJ gate failed`);
