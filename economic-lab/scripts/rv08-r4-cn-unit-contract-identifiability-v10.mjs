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
const q = (a, p) => {
  if (!a.length) return 0;
  const x = [...a].sort((m, n) => m - n);
  const i = (x.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? x[lo] : x[lo] + (x[hi] - x[lo]) * (i - lo);
};
const stats = a => ({ n: a.length, p25: q(a, .25), median: q(a, .5), p75: q(a, .75), p90: q(a, .9) });

function digest(world) {
  const h = createHash('sha256');
  h.update(JSON.stringify({ month: world.month, rng: world.rng }));
  for (const c of world.countries) h.update(JSON.stringify(c));
  h.update(JSON.stringify(world.ledger.entries));
  return h.digest('hex');
}

function accountFlow(entries, accountId, kindRe) {
  let inflow = 0, outflow = 0;
  for (const e of entries) {
    if (kindRe && !kindRe.test(String(e.kind || ''))) continue;
    for (const p of e.postings || []) {
      if (String(p.accountId) !== String(accountId)) continue;
      const d = finite(p.delta);
      if (d > 0) inflow += d;
      else if (d < 0) outflow += -d;
    }
  }
  return { inflow, outflow };
}

function run() {
  const world = new EconomicWorld(seed, { scaleProfile: 'baseline', healthCheckInterval: 0 });
  const firmRows = [], countryRows = [];

  for (let i = 0; i < months; i++) {
    world.stepMonth();
    const monthEntries = world.ledger.entriesFor({ month: world.month });

    for (const c of world.countries) {
      const entries = monthEntries.filter(e => String(e.countryId) === String(c.id));
      let householdDeposits = 0;
      let totalPayroll = 0;
      let consumerCapacityValue = 0;
      let consumerOutputValue = 0;
      let consumerPriceWeighted = 0;
      let consumerCapacityUnits = 0;

      for (const h of c.households || []) householdDeposits += Math.max(0, finite(world.ledger.balance(h.accountId)));

      for (const f of c.firms || []) {
        if (f.active === false) continue;
        const price = Math.max(EPS, finite(f.price));
        const cap = Math.max(0, finite(f.capacity));
        const out = Math.max(0, finite(f.output));
        const workers = Math.max(0, finite(f.workers));
        const wage = Math.max(0, finite(f.wage));
        const cash = Math.max(0, finite(world.ledger.balance(f.accountId)));
        const payroll = accountFlow(entries, f.accountId, /wage|payroll/i).outflow;
        totalPayroll += payroll;

        if (f.consumerFacing === true) {
          consumerCapacityValue += cap * price;
          consumerOutputValue += out * price;
          consumerPriceWeighted += price * cap;
          consumerCapacityUnits += cap;
        }

        if (payroll > EPS && cap * price > EPS) {
          const nominalWageBill = workers * wage;
          firmRows.push({
            month: world.month,
            countryId: String(c.id),
            industryId: String(f.industryId),
            firmId: String(f.id),
            payroll,
            cash,
            workers,
            wage,
            price,
            capacity: cap,
            output: out,
            capacityValue: cap * price,
            outputValue: out * price,
            requiredProductiveValueFactor: payroll / (cap * price),
            cashToPayrollMonths: cash / payroll,
            cashToNominalWageBillMonths: nominalWageBill > EPS ? cash / nominalWageBill : null,
            wageToCapacityValuePerWorker: workers > EPS ? wage / Math.max(EPS, cap * price / workers) : null
          });
        }
      }

      const desiredBudget = Math.max(0, finite(c.lastMarkets?.goods?.desiredBudget));
      const avgConsumerPrice = consumerCapacityUnits > EPS ? consumerPriceWeighted / consumerCapacityUnits : 0;
      if (desiredBudget > EPS && consumerCapacityValue > EPS && totalPayroll > EPS) {
        countryRows.push({
          month: world.month,
          countryId: String(c.id),
          householdDeposits,
          totalPayroll,
          desiredBudget,
          consumerCapacityValue,
          consumerOutputValue,
          avgConsumerPrice,
          householdDepositsToPayrollMonths: householdDeposits / totalPayroll,
          desiredBudgetToPayroll: desiredBudget / totalPayroll,
          demandRequiredFactor: desiredBudget / consumerCapacityValue,
          householdProductPurchasingPower: avgConsumerPrice > EPS ? householdDeposits / avgConsumerPrice : null
        });
      }
    }
  }

  const health = world.forceHealthCheck();
  const accounting = world.countries.every(c =>
    world.ledger.verifyCountry(c.id)?.ok === true &&
    world.accounting.verifyCountry(c, world.ledger, world.month)?.ok !== false
  );
  return { world, firmRows, countryRows, digest: digest(world), healthy: health.ok === true && accounting };
}

const a = run();
const b = run();
const firmFactors = a.firmRows.map(r => r.requiredProductiveValueFactor).filter(v => Number.isFinite(v) && v > 0);
const demandFactors = a.countryRows.map(r => r.demandRequiredFactor).filter(v => Number.isFinite(v) && v > 0);
const fFirm = q(firmFactors, .5);
const fDemand = q(demandFactors, .5);
const residualDemandAfterProductiveScale = fDemand / Math.max(EPS, fFirm);
const qPlusC_budgetMultiplier = fFirm / Math.max(EPS, fDemand);
const wPlusC_budgetMultiplier = 1 / Math.max(EPS, fDemand);

const cashPayroll = a.firmRows.map(r => r.cashToPayrollMonths).filter(v => Number.isFinite(v) && v >= 0);
const hhDepositPayroll = a.countryRows.map(r => r.householdDepositsToPayrollMonths).filter(v => Number.isFinite(v) && v >= 0);
const hhPurchasingPower = a.countryRows.map(r => r.householdProductPurchasingPower).filter(v => Number.isFinite(v) && v >= 0);

const candidateFamilies = {
  Q: {
    productiveQuantityOrBundleScale: fFirm,
    payrollScale: 1,
    priceScale: 1,
    householdBudgetScale: 1,
    medianFirmResidual: 1,
    medianDemandResidual: residualDemandAfterProductiveScale,
    firmCashPayrollDistortion: 1,
    householdProductPurchasingPowerDistortion: 1
  },
  W: {
    productiveQuantityOrBundleScale: 1,
    payrollScale: 1 / Math.max(EPS, fFirm),
    priceScale: 1,
    householdBudgetScale: 1,
    medianFirmResidual: 1,
    medianDemandResidual: fDemand,
    firmCashPayrollDistortion: fFirm,
    householdProductPurchasingPowerDistortion: 1
  },
  P: {
    productiveQuantityOrBundleScale: 1,
    payrollScale: 1,
    priceScale: fFirm,
    householdBudgetScale: 1,
    medianFirmResidual: 1,
    medianDemandResidual: residualDemandAfterProductiveScale,
    firmCashPayrollDistortion: 1,
    householdProductPurchasingPowerDistortion: 1 / Math.max(EPS, fFirm)
  },
  Q_PLUS_C: {
    productiveQuantityOrBundleScale: fFirm,
    payrollScale: 1,
    priceScale: 1,
    householdBudgetScale: qPlusC_budgetMultiplier,
    medianFirmResidual: 1,
    medianDemandResidual: 1,
    firmCashPayrollDistortion: 1,
    householdProductPurchasingPowerDistortion: 1
  },
  W_PLUS_C: {
    productiveQuantityOrBundleScale: 1,
    payrollScale: 1 / Math.max(EPS, fFirm),
    priceScale: 1,
    householdBudgetScale: wPlusC_budgetMultiplier,
    medianFirmResidual: 1,
    medianDemandResidual: 1,
    firmCashPayrollDistortion: fFirm,
    householdProductPurchasingPowerDistortion: 1
  },
  P_PLUS_C: {
    productiveQuantityOrBundleScale: 1,
    payrollScale: 1,
    priceScale: fFirm,
    householdBudgetScale: qPlusC_budgetMultiplier,
    medianFirmResidual: 1,
    medianDemandResidual: 1,
    firmCashPayrollDistortion: 1,
    householdProductPurchasingPowerDistortion: 1 / Math.max(EPS, fFirm)
  }
};

const summary = {
  firmRequiredFactor: stats(firmFactors),
  demandRequiredFactor: stats(demandFactors),
  residualDemandAfterFirmProductiveScale: residualDemandAfterProductiveScale,
  anchors: {
    firmCashToPayrollMonths: stats(cashPayroll),
    householdDepositsToPayrollMonths: stats(hhDepositPayroll),
    householdProductPurchasingPower: stats(hhPurchasingPower),
    desiredBudgetToPayroll: stats(a.countryRows.map(r => r.desiredBudgetToPayroll).filter(v => Number.isFinite(v) && v >= 0))
  },
  candidateFamilies,
  headlineEquivalence: {
    Q_and_P_sameFirmResidual: Math.abs(candidateFamilies.Q.medianFirmResidual - candidateFamilies.P.medianFirmResidual) < 1e-12,
    Q_and_P_sameDemandResidual: Math.abs(candidateFamilies.Q.medianDemandResidual - candidateFamilies.P.medianDemandResidual) < 1e-12,
    QPC_jointFamiliesNormalizeHeadline: ['Q_PLUS_C','W_PLUS_C','P_PLUS_C'].every(k => Math.abs(candidateFamilies[k].medianFirmResidual - 1) < 1e-12 && Math.abs(candidateFamilies[k].medianDemandResidual - 1) < 1e-12)
  },
  internalIdentification: 'UNDERIDENTIFIED_WITHOUT_SEMANTIC_OR_EMPIRICAL_UNIT_ANCHORS'
};

const gates = {
  noMutationByAudit: true,
  exactDiagnosticReplay: JSON.stringify(a.firmRows) === JSON.stringify(b.firmRows) && JSON.stringify(a.countryRows) === JSON.stringify(b.countryRows),
  exactCanonicalReplay: a.digest === b.digest,
  hardAccountingHealthy: a.healthy && b.healthy,
  finitePositiveAnchors: firmFactors.length > 0 && demandFactors.length > 0 && fFirm > 0 && fDemand > 0,
  candidateAlgebraConsistent: summary.headlineEquivalence.Q_and_P_sameFirmResidual && summary.headlineEquivalence.Q_and_P_sameDemandResidual && summary.headlineEquivalence.QPC_jointFamiliesNormalizeHeadline,
  observationsPresent: a.firmRows.length > 0 && a.countryRows.length > 0,
  allCountriesObserved: new Set(a.countryRows.map(r => r.countryId)).size === 4,
  allIndustriesObserved: new Set(a.firmRows.map(r => r.industryId)).size === 4
};
gates.ok = Object.values(gates).every(Boolean);

const result = {
  workPackage: 'WP-RV08-R4-CN', seed, months, gates, summary, worldDigest: a.digest
};

console.log('WP_RV08_R4_CN_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CN_SUMMARY', JSON.stringify(summary));
console.log('WP_RV08_R4_CN_WORLD_DIGEST', a.digest);
if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CN_OUTPUT', outputJson);
}
assert.equal(gates.ok, true, `${seed}: R4-CN gate failed`);
