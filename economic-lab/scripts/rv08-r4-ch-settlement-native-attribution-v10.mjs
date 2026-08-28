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
  for (const c of world.countries) for (const f of c.firms || []) out.set(String(f.id), {
    countryId: String(c.id), accountId: String(f.accountId), active: f.active !== false,
    cash: finite(world.ledger.balance(f.accountId)), workers: finite(f.workers), wage: finite(f.wage)
  });
  return out;
}

function classifyKind(kind = '') {
  const k = String(kind);
  if (k === 'goods_purchase') return 'GOODS';
  if (k === 'interfirm_purchase') return 'B2B';
  if (k === 'capital_investment') return 'CAPITAL';
  if (/wage|payroll/i.test(k)) return 'PAYROLL';
  if (/loan|debt|interest|credit/i.test(k)) return 'FINANCE';
  if (/tax|fee/i.test(k)) return 'TAX';
  return 'OTHER';
}

function flows(entries, accountId) {
  const buckets = {
    GOODS:{in:0,out:0}, B2B:{in:0,out:0}, CAPITAL:{in:0,out:0}, PAYROLL:{in:0,out:0},
    FINANCE:{in:0,out:0}, TAX:{in:0,out:0}, OTHER:{in:0,out:0}
  };
  let totalIn = 0, totalOut = 0;
  const kinds = {};
  for (const e of entries) {
    const amount = Math.max(0, finite(e.amount));
    const cls = classifyKind(e.kind);
    if (String(e.to) === String(accountId)) { buckets[cls].in += amount; totalIn += amount; kinds[e.kind || 'unknown'] = (kinds[e.kind || 'unknown'] || 0) + amount; }
    if (String(e.from) === String(accountId)) { buckets[cls].out += amount; totalOut += amount; kinds[e.kind || 'unknown'] = (kinds[e.kind || 'unknown'] || 0) - amount; }
  }
  return { buckets, totalIn, totalOut, kinds };
}

function run() {
  const world = new EconomicWorld(seed, { scaleProfile:'baseline', healthCheckInterval:0 });
  const rows = [];
  for (let i = 0; i < months; i++) {
    const open = opening(world);
    world.stepMonth();
    const entries = (world.ledger.entries || []).filter(e => Number(e.month) === Number(world.month));
    for (const c of world.countries) for (const f of c.firms || []) {
      const o = open.get(String(f.id));
      if (!o) continue;
      const x = flows(entries, f.accountId);
      const closingCash = finite(world.ledger.balance(f.accountId));
      const ledgerOperatingRevenue = x.buckets.GOODS.in + x.buckets.B2B.in + x.buckets.CAPITAL.in;
      const ledgerInputOutflow = x.buckets.B2B.out;
      const ledgerPayrollOutflow = x.buckets.PAYROLL.out;
      const totalLedgerNet = x.totalIn - x.totalOut;
      const cashDelta = closingCash - o.cash;
      const cashReconciliationResidual = cashDelta - totalLedgerNet;
      const fieldRevenue = finite(f.revenue);
      const fieldComponentRevenue = finite(f.consumerRevenue) + finite(f.b2bRevenue) + finite(f.capitalRevenue);
      const fieldPayrollProxy = Math.max(0, finite(f.workers) * finite(f.wage));
      rows.push({
        month: world.month, countryId:String(c.id), firmId:String(f.id), industryId:String(f.industryId || 'UNKNOWN'), activeStart:o.active, activeEnd:f.active !== false,
        openingCash:o.cash, closingCash, cashDelta, totalLedgerIn:x.totalIn, totalLedgerOut:x.totalOut, totalLedgerNet, cashReconciliationResidual,
        ledgerGoodsRevenue:x.buckets.GOODS.in, ledgerB2BRevenue:x.buckets.B2B.in, ledgerCapitalRevenue:x.buckets.CAPITAL.in, ledgerOperatingRevenue,
        ledgerInputOutflow, ledgerPayrollOutflow, ledgerFinanceInflow:x.buckets.FINANCE.in, ledgerFinanceOutflow:x.buckets.FINANCE.out, ledgerTaxOutflow:x.buckets.TAX.out,
        ledgerOtherInflow:x.buckets.OTHER.in, ledgerOtherOutflow:x.buckets.OTHER.out,
        fieldRevenue, fieldComponentRevenue, fieldRevenueGap:ledgerOperatingRevenue-fieldRevenue, fieldComponentGap:fieldRevenue-fieldComponentRevenue,
        fieldPayrollProxy, payrollAttributionGap:ledgerPayrollOutflow-fieldPayrollProxy,
        ledgerOperatingMargin:ledgerOperatingRevenue-ledgerInputOutflow-ledgerPayrollOutflow,
        fieldGrossOperatingMargin:fieldRevenue-finite(f.inputSpend)-fieldPayrollProxy,
        sales:finite(f.sales), consumerSales:finite(f.consumerSales), b2bSales:finite(f.b2bSales), capitalSales:finite(f.capitalSales), output:finite(f.output),
        inventory:finite(f.inventory), workers:finite(f.workers), wage:finite(f.wage), wageArrears:finite(f.wageArrears), inputSpend:finite(f.inputSpend), kinds:x.kinds
      });
    }
  }
  const health = world.forceHealthCheck();
  const ledgerHealthy = world.countries.every(c => world.ledger.verifyCountry(c.id)?.ok === true);
  const accountingHealthy = world.countries.every(c => world.accounting.verifyCountry(c, world.ledger, world.month)?.ok !== false);
  return { world, rows, digest:digest(world), hardAccountingHealthy:health.ok === true && ledgerHealthy && accountingHealthy };
}

function summarize(rows) {
  const active = rows.filter(r => r.activeStart);
  const mean = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
  const finiteVals = (key) => active.map(r=>r[key]).filter(Number.isFinite);
  const ledgerRevenuePositive = active.filter(r=>r.ledgerOperatingRevenue>EPS);
  const payrollPositive = active.filter(r=>r.ledgerPayrollOutflow>EPS);
  const both = active.filter(r=>r.ledgerOperatingRevenue>EPS && r.ledgerPayrollOutflow>EPS);
  return {
    firmMonths:active.length,
    meanLedgerOperatingRevenue:mean(finiteVals('ledgerOperatingRevenue')),
    meanFieldRevenue:mean(finiteVals('fieldRevenue')),
    meanAbsoluteFieldRevenueGap:mean(active.map(r=>Math.abs(r.fieldRevenueGap))),
    meanAbsoluteCashResidual:mean(active.map(r=>Math.abs(r.cashReconciliationResidual))),
    cashResidualAboveToleranceShare:active.length ? active.filter(r=>Math.abs(r.cashReconciliationResidual)>1e-6).length/active.length : 0,
    ledgerRevenuePositiveShare:active.length ? ledgerRevenuePositive.length/active.length : 0,
    payrollPositiveShare:active.length ? payrollPositive.length/active.length : 0,
    ledgerRevenueBelowPayrollShare:active.length ? active.filter(r=>r.ledgerOperatingRevenue+EPS<r.ledgerPayrollOutflow).length/active.length : 0,
    ledgerOperatingMarginNegativeShare:active.length ? active.filter(r=>r.ledgerOperatingMargin<-EPS).length/active.length : 0,
    meanLedgerRevenuePayrollRatio:both.length ? mean(both.map(r=>r.ledgerOperatingRevenue/Math.max(EPS,r.ledgerPayrollOutflow))) : 0,
    meanFieldRevenuePayrollProxyRatio:mean(active.filter(r=>r.fieldPayrollProxy>EPS).map(r=>r.fieldRevenue/Math.max(EPS,r.fieldPayrollProxy))),
    operatingInflowComposition:{
      goods:mean(finiteVals('ledgerGoodsRevenue')), b2b:mean(finiteVals('ledgerB2BRevenue')), capital:mean(finiteVals('ledgerCapitalRevenue'))
    },
    nonOperatingFlows:{
      financeIn:mean(finiteVals('ledgerFinanceInflow')), financeOut:mean(finiteVals('ledgerFinanceOutflow')), taxOut:mean(finiteVals('ledgerTaxOutflow')), otherIn:mean(finiteVals('ledgerOtherInflow')), otherOut:mean(finiteVals('ledgerOtherOutflow'))
    },
    exits:active.filter(r=>r.activeStart&&!r.activeEnd).length
  };
}

const a = run();
const b = run();
const exactCanonicalReplay = a.digest === b.digest;
const exactDiagnosticReplay = JSON.stringify(a.rows) === JSON.stringify(b.rows);
const summary = summarize(a.rows);
const gates = {
  noMutationByAudit:true,
  exactDiagnosticReplay,
  exactCanonicalReplay,
  hardAccountingHealthy:a.hardAccountingHealthy && b.hardAccountingHealthy,
  settlementObservationsPresent:summary.firmMonths>0 && summary.ledgerRevenuePositiveShare>0,
  revenueComponentsFinite:Number.isFinite(summary.meanLedgerOperatingRevenue),
  payrollAttributionFinite:Number.isFinite(summary.payrollPositiveShare)
};
gates.ok = Object.values(gates).every(Boolean);

console.log('WP_RV08_R4_CH_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CH_SUMMARY', JSON.stringify(summary));
console.log('WP_RV08_R4_CH_WORLD_DIGEST', a.digest);

const result = { workPackage:'WP-RV08-R4-CH', title:'Settlement-native revenue payroll timing attribution audit', generatedAt:new Date().toISOString(), seed, months, gates, summary, rows:a.rows, worldDigest:a.digest };
if (outputJson) { mkdirSync(dirname(outputJson), {recursive:true}); writeFileSync(outputJson, JSON.stringify(result,null,2)); console.log('WP_RV08_R4_CH_OUTPUT', outputJson); }
assert.equal(gates.ok, true, `${seed}: R4-CH gate failed`);
