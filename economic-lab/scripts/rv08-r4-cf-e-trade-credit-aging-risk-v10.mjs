import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { TradeCreditAgingShadowLedger } from '../src/research/trade-credit-aging-shadow-ledger.js';

const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const months = Math.max(2, Math.round(Number(process.env.DIAG_MONTHS || 24)));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;

function digest(world) {
  const h = createHash('sha256');
  h.update(JSON.stringify({ month: world.month, rng: world.rng }));
  for (const country of world.countries) h.update(JSON.stringify(country));
  h.update(JSON.stringify(world.ledger.entries));
  return h.digest('hex');
}

function summarize(monthly) {
  const n = Math.max(1, monthly.length);
  const avg = fn => monthly.reduce((sum, row) => sum + Number(fn(row) || 0), 0) / n;
  return {
    averageNewInvoiceValue: avg(row => row.report.flows.newInvoiceValue),
    averagePaidCapacityAmount: avg(row => row.report.flows.paidCapacityAmount),
    averageOutstandingAPAR: avg(row => row.report.stocks.accountsPayable),
    averageArrearsStock: avg(row => row.report.stocks.arrearsStock),
    averageArrearsRatio: avg(row => row.report.stocks.arrearsRatio),
    averageRetainedRecoveryUnits: avg(row => row.report.procurement.retainedRecoveryUnits),
    averageUnconstrainedRecoveryPotentialUnits: avg(row => row.report.procurement.unconstrainedRecoveryPotentialUnits),
    averageRetainedRecoveryShare: avg(row => row.report.procurement.retainedRecoveryShare),
    maxOutstandingAPAR: Math.max(...monthly.map(row => Number(row.report.stocks.accountsPayable || 0))),
    maxArrearsStock: Math.max(...monthly.map(row => Number(row.report.stocks.arrearsStock || 0))),
    maxArrearsRatio: Math.max(...monthly.map(row => Number(row.report.stocks.arrearsRatio || 0))),
    maxInvoiceAgeMonths: Math.max(...monthly.map(row => Number(row.report.stocks.maxInvoiceAgeMonths || 0))),
    maxPersistentArrearsBuyers: Math.max(...monthly.map(row => Number(row.report.stocks.persistentArrearsBuyers || 0))),
    maxSellersExceedingConservativeCapacity: Math.max(...monthly.map(row => Number(row.report.capacity.sellersExceedingConservativeCapacity || 0))),
    monthsWithPositiveRecovery: monthly.filter(row => row.report.procurement.retainedRecoveryUnits > 1e-9).length,
    monthsWithArrears: monthly.filter(row => row.report.stocks.arrearsStock > 1e-9).length
  };
}

function run() {
  const world = new EconomicWorld(seed, { scaleProfile: 'baseline', healthCheckInterval: 0 });
  const shadowA = new TradeCreditAgingShadowLedger({ ledger: world.ledger });
  const shadowB = new TradeCreditAgingShadowLedger({ ledger: world.ledger });
  const monthly = [];
  let noMutation = true;
  let exactShadowReplay = true;
  let apArConservationOk = true;
  let noNegativeInvoiceBalance = true;
  let stockFlowConservationOk = true;
  let physicalCeilingOk = true;
  let sellerRiskCapacityOk = true;
  let oldestDueFirstOk = true;

  for (let i = 0; i < months; i += 1) {
    world.stepMonth();
    const before = digest(world);
    const first = shadowA.step(world.countries, world.month);
    const middle = digest(world);
    const second = shadowB.step(world.countries, world.month);
    const after = digest(world);

    noMutation &&= before === middle && middle === after;
    exactShadowReplay &&= JSON.stringify(first) === JSON.stringify(second);
    apArConservationOk &&= Math.abs(first.stocks.accountsPayable - first.stocks.accountsReceivable) <= 1e-7;
    noNegativeInvoiceBalance &&= !first.validation.issues.some(issue => issue.type === 'NEGATIVE_OR_NONFINITE_INVOICE');
    stockFlowConservationOk &&= Math.abs(first.flows.stockFlowError) <= 1e-7;
    physicalCeilingOk &&= !first.validation.issues.some(issue => issue.type === 'PHYSICAL_SUPPLIER_INVENTORY_EXCEEDED' || issue.type === 'BUYER_REQUIREMENT_EXCEEDED');
    sellerRiskCapacityOk &&= first.capacity.sellersExceedingConservativeCapacity === 0;
    oldestDueFirstOk &&= !first.validation.issues.some(issue => issue.type === 'OLDEST_DUE_FIRST_VIOLATION');
    monthly.push({ month: world.month, report: first });
  }

  const health = world.forceHealthCheck();
  const ledgerHealthy = world.countries.every(country => world.ledger.verifyCountry(country.id)?.ok === true);
  const accountingHealthy = world.countries.every(country => world.accounting.verifyCountry(country, world.ledger, world.month)?.ok !== false);

  return {
    world,
    monthly,
    noMutation,
    exactShadowReplay,
    apArConservationOk,
    noNegativeInvoiceBalance,
    stockFlowConservationOk,
    physicalCeilingOk,
    sellerRiskCapacityOk,
    oldestDueFirstOk,
    hardAccountingHealthy: health.ok === true && ledgerHealthy && accountingHealthy,
    digest: digest(world)
  };
}

const a = run();
const b = run();
const exactCanonicalReplay = a.digest === b.digest;
const exactDiagnosticReplay = JSON.stringify(a.monthly) === JSON.stringify(b.monthly);
const summary = summarize(a.monthly);
const final = a.monthly.at(-1).report;
const invoicesObserved = a.monthly.some(row => row.report.flows.newInvoiceValue > 1e-9);
const repaymentObserved = a.monthly.some(row => row.report.flows.paidCapacityAmount > 1e-9);
const recoveryObserved = a.monthly.some(row => row.report.procurement.retainedRecoveryUnits > 1e-9);

const gates = {
  noMutation: a.noMutation && b.noMutation,
  exactShadowReplay: a.exactShadowReplay && b.exactShadowReplay && exactDiagnosticReplay,
  exactCanonicalReplay,
  apArConservationOk: a.apArConservationOk && b.apArConservationOk,
  noNegativeInvoiceBalance: a.noNegativeInvoiceBalance && b.noNegativeInvoiceBalance,
  stockFlowConservationOk: a.stockFlowConservationOk && b.stockFlowConservationOk,
  physicalCeilingOk: a.physicalCeilingOk && b.physicalCeilingOk,
  sellerRiskCapacityOk: a.sellerRiskCapacityOk && b.sellerRiskCapacityOk,
  oldestDueFirstOk: a.oldestDueFirstOk && b.oldestDueFirstOk,
  hardAccountingHealthy: a.hardAccountingHealthy && b.hardAccountingHealthy,
  invoicesObserved,
  repaymentObserved,
  recoveryObserved
};
gates.ok = Object.values(gates).every(Boolean);

console.log('WP_RV08_R4_CF_E_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CF_E_SUMMARY', JSON.stringify(summary));
console.log('WP_RV08_R4_CF_E_FINAL_FLOWS', JSON.stringify(final.flows));
console.log('WP_RV08_R4_CF_E_FINAL_STOCKS', JSON.stringify(final.stocks));
console.log('WP_RV08_R4_CF_E_FINAL_CAPACITY', JSON.stringify({
  sellersWithReceivables: final.capacity.sellersWithReceivables,
  sellersExceedingInventoryValueCapacity: final.capacity.sellersExceedingInventoryValueCapacity,
  sellersExceedingSalesScaleCapacity: final.capacity.sellersExceedingSalesScaleCapacity,
  sellersExceedingLiquidityCapacity: final.capacity.sellersExceedingLiquidityCapacity,
  sellersExceedingConservativeCapacity: final.capacity.sellersExceedingConservativeCapacity
}));
console.log('WP_RV08_R4_CF_E_FINAL_PROCUREMENT', JSON.stringify(final.procurement));
console.log('WP_RV08_R4_CF_E_WORLD_DIGEST', a.digest);

const result = {
  workPackage: 'WP-RV08-R4-CF-E',
  title: 'Trade-credit aging, repayment and seller risk-capacity shadow ledger',
  generatedAt: new Date().toISOString(),
  seed,
  months,
  gates,
  summary,
  final,
  monthly: a.monthly,
  worldDigest: a.digest
};

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CF_E_OUTPUT', outputJson);
}

assert.equal(gates.ok, true, `${seed}: R4-CF-E gate failed`);
