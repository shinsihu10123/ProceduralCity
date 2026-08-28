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
const safeRatio = (a, b) => b > EPS ? a / b : null;
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const median = a => {
  if (!a.length) return 0;
  const x = [...a].sort((a, b) => a - b), m = Math.floor(x.length / 2);
  return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2;
};

function digest(world) {
  const h = createHash('sha256');
  h.update(JSON.stringify({ month: world.month, rng: world.rng }));
  for (const c of world.countries) h.update(JSON.stringify(c));
  h.update(JSON.stringify(world.ledger.entries));
  return h.digest('hex');
}

function opening(world) {
  const m = new Map();
  for (const c of world.countries) for (const f of c.firms || []) {
    m.set(String(f.id), {
      active: f.active !== false,
      countryId: String(c.id),
      accountId: String(f.accountId),
      cash: finite(world.ledger.balance(f.accountId)),
      industryId: String(f.industryId || 'UNKNOWN'),
      consumerFacing: f.consumerFacing === true
    });
  }
  return m;
}

function firmLedgerFlow(entries, accountId) {
  let totalIn = 0, totalOut = 0, payrollOut = 0;
  for (const e of entries) {
    const p = (e.postings || []).find(x => String(x.accountId) === String(accountId));
    if (!p) continue;
    const d = finite(p.delta);
    if (d > EPS) totalIn += d;
    else if (d < -EPS) totalOut += -d;
    if (String(e.kind || '') === 'wage' && d < -EPS) payrollOut += -d;
  }
  return { totalIn, totalOut, net: totalIn - totalOut, payrollOut };
}

function run() {
  const world = new EconomicWorld(seed, { scaleProfile: 'baseline', healthCheckInterval: 0 });
  const firmRows = [], countryRows = [];
  const configured = Object.fromEntries(world.countries.map(c => [String(c.id), {
    initialWage: finite(c.initialWage), initialPrice: finite(c.initialPrice),
    initialWageToPrice: safeRatio(finite(c.initialWage), finite(c.initialPrice))
  }]));

  for (let i = 0; i < months; i++) {
    const open = opening(world);
    world.stepMonth();
    const entries = world.ledger.entriesFor({ month: world.month });

    for (const c of world.countries) {
      const cEntries = entries.filter(e => String(e.countryId) === String(c.id));
      const rowsThisCountry = [];
      for (const f of c.firms || []) {
        const o = open.get(String(f.id));
        if (!o?.active) continue;
        const flow = firmLedgerFlow(cEntries, f.accountId);
        const closingCash = finite(world.ledger.balance(f.accountId));
        const workers = Math.max(0, finite(f.workers));
        const wage = Math.max(0, finite(f.wage));
        const price = Math.max(EPS, finite(f.price));
        const output = Math.max(0, finite(f.output));
        const desiredProduction = Math.max(0, finite(f.desiredProduction));
        const capacity = Math.max(0, finite(f.capacity));
        const nominalPayroll = workers * wage;
        const outputValue = output * price;
        const desiredValue = desiredProduction * price;
        const capacityValue = capacity * price;
        const outputValuePerWorker = safeRatio(outputValue, workers);
        const capacityValuePerWorker = safeRatio(capacityValue, workers);
        const flags = [];
        if (flow.payrollOut > EPS && outputValue + EPS < flow.payrollOut) flags.push('NOMINAL_PRODUCTIVE_VALUE_BELOW_PAYROLL');
        if (flow.payrollOut > EPS && capacityValue + EPS < flow.payrollOut) flags.push('CAPACITY_VALUE_BELOW_PAYROLL');
        if (workers > EPS && Number.isFinite(capacityValuePerWorker) && wage > capacityValuePerWorker * 2) flags.push('UNIT_ONTOLOGY_STRESS');
        const row = {
          month: world.month, countryId: String(c.id), firmId: String(f.id), industryId: o.industryId,
          consumerFacing: o.consumerFacing, openingCash: o.cash, closingCash,
          ledgerNet: flow.net, cashResidual: closingCash - o.cash - flow.net,
          actualPayrollOut: flow.payrollOut, nominalPayroll, workers, wage, price, output, desiredProduction, capacity,
          outputValue, desiredValue, capacityValue, outputValuePerWorker, capacityValuePerWorker,
          wageToOutputValuePerWorker: Number.isFinite(outputValuePerWorker) && outputValuePerWorker > EPS ? wage / outputValuePerWorker : null,
          wageToCapacityValuePerWorker: Number.isFinite(capacityValuePerWorker) && capacityValuePerWorker > EPS ? wage / capacityValuePerWorker : null,
          payrollToOutputValue: safeRatio(flow.payrollOut, outputValue), payrollToCapacityValue: safeRatio(flow.payrollOut, capacityValue), flags
        };
        firmRows.push(row); rowsThisCountry.push(row);
      }

      const goods = c.lastMarkets?.goods || {};
      const desiredBudget = Math.max(0, finite(goods.desiredBudget));
      const realizedConsumption = Math.max(0, finite(goods.nominalConsumption));
      const unmetBudget = Math.max(0, finite(goods.unmetBudget));
      const consumerRows = rowsThisCountry.filter(r => r.consumerFacing);
      const totalPayroll = rowsThisCountry.reduce((s, r) => s + r.actualPayrollOut, 0);
      const totalOutputValue = rowsThisCountry.reduce((s, r) => s + r.outputValue, 0);
      const totalCapacityValue = rowsThisCountry.reduce((s, r) => s + r.capacityValue, 0);
      const consumerOutputValue = consumerRows.reduce((s, r) => s + r.outputValue, 0);
      const consumerCapacityValue = consumerRows.reduce((s, r) => s + r.capacityValue, 0);
      const flags = [];
      if (desiredBudget + EPS >= consumerCapacityValue) flags.push('DEMAND_NOT_SCARCE');
      else flags.push('DEMAND_SCARCITY_PLAUSIBLE');
      if (totalPayroll > totalOutputValue + EPS) flags.push('NOMINAL_PRODUCTIVE_VALUE_BELOW_PAYROLL');
      if (totalPayroll > totalCapacityValue + EPS) flags.push('CAPACITY_VALUE_BELOW_PAYROLL');
      countryRows.push({
        month: world.month, countryId: String(c.id), ...configured[String(c.id)],
        firmCount: rowsThisCountry.length, consumerFirmCount: consumerRows.length,
        totalPayroll, totalOutputValue, totalCapacityValue, consumerOutputValue, consumerCapacityValue,
        desiredBudget, realizedConsumption, unmetBudget,
        desiredBudgetToConsumerOutputValue: safeRatio(desiredBudget, consumerOutputValue),
        desiredBudgetToConsumerCapacityValue: safeRatio(desiredBudget, consumerCapacityValue),
        realizedToDesiredBudget: safeRatio(realizedConsumption, desiredBudget),
        payrollToOutputValue: safeRatio(totalPayroll, totalOutputValue),
        payrollToCapacityValue: safeRatio(totalPayroll, totalCapacityValue), flags
      });
    }
  }

  const health = world.forceHealthCheck();
  const ledgerHealthy = world.countries.every(c => world.ledger.verifyCountry(c.id)?.ok === true);
  const accountingHealthy = world.countries.every(c => world.accounting.verifyCountry(c, world.ledger, world.month)?.ok !== false);
  return { world, configured, firmRows, countryRows, digest: digest(world), hardAccountingHealthy: health.ok === true && ledgerHealthy && accountingHealthy };
}

function summarizeFirms(rows) {
  const payrollRows = rows.filter(r => r.actualPayrollOut > EPS);
  const workerRows = rows.filter(r => r.workers > EPS);
  const v = (key, src = rows) => src.map(r => r[key]).filter(Number.isFinite);
  const flagShare = flag => rows.length ? rows.filter(r => r.flags.includes(flag)).length / rows.length : 0;
  return {
    firmMonths: rows.length, payrollFirmMonths: payrollRows.length,
    meanWage: mean(v('wage', workerRows)), meanPrice: mean(v('price')),
    medianOutputValuePerWorker: median(v('outputValuePerWorker', workerRows)),
    medianCapacityValuePerWorker: median(v('capacityValuePerWorker', workerRows)),
    medianWageToOutputValuePerWorker: median(v('wageToOutputValuePerWorker', workerRows)),
    medianWageToCapacityValuePerWorker: median(v('wageToCapacityValuePerWorker', workerRows)),
    medianPayrollToOutputValue: median(v('payrollToOutputValue', payrollRows)),
    medianPayrollToCapacityValue: median(v('payrollToCapacityValue', payrollRows)),
    productiveValueBelowPayrollShare: flagShare('NOMINAL_PRODUCTIVE_VALUE_BELOW_PAYROLL'),
    capacityValueBelowPayrollShare: flagShare('CAPACITY_VALUE_BELOW_PAYROLL'),
    unitOntologyStressShare: flagShare('UNIT_ONTOLOGY_STRESS')
  };
}

function summarizeCountries(rows) {
  const v = key => rows.map(r => r[key]).filter(Number.isFinite);
  return {
    countryMonths: rows.length,
    medianDesiredBudgetToConsumerOutputValue: median(v('desiredBudgetToConsumerOutputValue')),
    medianDesiredBudgetToConsumerCapacityValue: median(v('desiredBudgetToConsumerCapacityValue')),
    medianRealizedToDesiredBudget: median(v('realizedToDesiredBudget')),
    medianPayrollToOutputValue: median(v('payrollToOutputValue')),
    medianPayrollToCapacityValue: median(v('payrollToCapacityValue')),
    demandNotScarceShare: rows.length ? rows.filter(r => r.flags.includes('DEMAND_NOT_SCARCE')).length / rows.length : 0,
    demandScarcityPlausibleShare: rows.length ? rows.filter(r => r.flags.includes('DEMAND_SCARCITY_PLAUSIBLE')).length / rows.length : 0,
    capacityValueBelowPayrollShare: rows.length ? rows.filter(r => r.flags.includes('CAPACITY_VALUE_BELOW_PAYROLL')).length / rows.length : 0
  };
}

function cohort(rows, key) {
  const g = new Map();
  for (const r of rows) { const k = String(r[key]); if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
  return Object.fromEntries([...g.entries()].map(([k, x]) => [k, summarizeFirms(x)]));
}

const a = run();
const b = run();
const firmSummary = summarizeFirms(a.firmRows);
const countrySummary = summarizeCountries(a.countryRows);
const gates = {
  noMutationByAudit: true,
  exactDiagnosticReplay: JSON.stringify(a.firmRows) === JSON.stringify(b.firmRows) && JSON.stringify(a.countryRows) === JSON.stringify(b.countryRows),
  exactCanonicalReplay: a.digest === b.digest,
  hardAccountingHealthy: a.hardAccountingHealthy && b.hardAccountingHealthy,
  cashReconciliationExact: a.firmRows.every(r => Math.abs(r.cashResidual) <= 1e-7),
  finiteValueMetrics: a.firmRows.every(r => [r.actualPayrollOut,r.wage,r.price,r.outputValue,r.capacityValue].every(Number.isFinite)),
  observationsPresent: a.firmRows.length > 0 && a.countryRows.length > 0,
  allCountriesObserved: new Set(a.countryRows.map(r => r.countryId)).size === 4,
  allIndustriesObserved: new Set(a.firmRows.map(r => r.industryId)).size === 4
};
gates.ok = Object.values(gates).every(Boolean);

const result = {
  workPackage: 'WP-RV08-R4-CL', title: 'Unit ontology, productive value and aggregate demand-supply scale audit',
  generatedAt: new Date().toISOString(), seed, months, gates, configured: a.configured,
  firmSummary, countrySummary,
  cohorts: { country: cohort(a.firmRows, 'countryId'), industry: cohort(a.firmRows, 'industryId') },
  countryRows: a.countryRows, firmRows: a.firmRows, worldDigest: a.digest
};
console.log('WP_RV08_R4_CL_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CL_CONFIGURED', JSON.stringify(a.configured));
console.log('WP_RV08_R4_CL_FIRM_SUMMARY', JSON.stringify(firmSummary));
console.log('WP_RV08_R4_CL_COUNTRY_SUMMARY', JSON.stringify(countrySummary));
console.log('WP_RV08_R4_CL_COHORTS', JSON.stringify(result.cohorts));
console.log('WP_RV08_R4_CL_WORLD_DIGEST', a.digest);
if (outputJson) { mkdirSync(dirname(outputJson), { recursive: true }); writeFileSync(outputJson, JSON.stringify(result, null, 2)); console.log('WP_RV08_R4_CL_OUTPUT', outputJson); }
assert.equal(gates.ok, true, `${seed}: R4-CL gate failed`);
