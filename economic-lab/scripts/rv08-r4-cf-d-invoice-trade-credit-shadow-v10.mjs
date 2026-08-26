import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { InvoiceTradeCreditShadowContract } from '../src/research/invoice-trade-credit-shadow-contract.js';

const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const months = Math.max(1, Math.round(Number(process.env.DIAG_MONTHS || 24)));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;

function digest(world) {
  const h = createHash('sha256');
  h.update(JSON.stringify({ month: world.month, rng: world.rng }));
  for (const country of world.countries) h.update(JSON.stringify(country));
  h.update(JSON.stringify(world.ledger.entries));
  return h.digest('hex');
}

function aggregateMonthly(monthly) {
  const n = Math.max(1, monthly.length);
  const keys = [
    'd0FullCashEnvelope','d1Net30Envelope','d2Net60Envelope','d3InventoryOnlyEnvelope',
    'd1IncrementalFinancedUnits','d2IncrementalFinancedUnits','d1BuyerPayable','d2BuyerPayable',
    'd1ResidualShortage','d2ResidualShortage','d3ResidualShortage','fullCashToInventoryRecoveryPotential'
  ];
  const averages = Object.fromEntries(keys.map(key => [
    key,
    monthly.reduce((s, m) => s + Number(m.report.totals[key] || 0), 0) / n
  ]));
  const potential = averages.fullCashToInventoryRecoveryPotential;
  averages.d1RecoveryShareOfPotential = potential > 1e-9 ? averages.d1IncrementalFinancedUnits / potential : 0;
  averages.d2RecoveryShareOfPotential = potential > 1e-9 ? averages.d2IncrementalFinancedUnits / potential : 0;
  return averages;
}

function run() {
  const world = new EconomicWorld(seed, { scaleProfile: 'baseline', healthCheckInterval: 0 });
  const audit = new InvoiceTradeCreditShadowContract({ ledger: world.ledger });
  const monthly = [];
  let noMutation = true;
  let exactShadowReplay = true;
  let physicalOrderingOk = true;
  let apArConservationOk = true;
  let noNegativeExposure = true;

  for (let m = 0; m < months; m += 1) {
    world.stepMonth();
    const before = digest(world);
    const first = audit.report(world.countries, world.month);
    const second = audit.report(world.countries, world.month);
    const after = digest(world);

    noMutation &&= before === after;
    exactShadowReplay &&= JSON.stringify(first) === JSON.stringify(second);
    physicalOrderingOk &&= first.validation.ok === true;
    apArConservationOk &&= Math.abs(first.totals.d1BuyerPayable - first.totals.d1SellerReceivable) <= 1e-7;
    apArConservationOk &&= Math.abs(first.totals.d2BuyerPayable - first.totals.d2SellerReceivable) <= 1e-7;
    noNegativeExposure &&= first.countries.every(c => c.rows.every(r =>
      r.d1BuyerPayable >= -1e-9 && r.d1SellerReceivable >= -1e-9 && r.d2BuyerPayable >= -1e-9 && r.d2SellerReceivable >= -1e-9
    ));
    monthly.push({ month: world.month, report: first });
  }

  const health = world.forceHealthCheck();
  const ledgerHealthy = world.countries.every(c => world.ledger.verifyCountry(c.id)?.ok === true);
  const accountingHealthy = world.countries.every(c => world.accounting.verifyCountry(c, world.ledger, world.month)?.ok !== false);
  return {
    world,
    monthly,
    noMutation,
    exactShadowReplay,
    physicalOrderingOk,
    apArConservationOk,
    noNegativeExposure,
    hardAccountingHealthy: health.ok === true && ledgerHealthy && accountingHealthy,
    digest: digest(world)
  };
}

const a = run();
const b = run();
const exactCanonicalReplay = a.digest === b.digest;
const exactDiagnosticReplay = JSON.stringify(a.monthly) === JSON.stringify(b.monthly);
const averages = aggregateMonthly(a.monthly);
const final = a.monthly.at(-1).report.totals;
const creditRecoveryObserved = a.monthly.some(m => m.report.totals.d1IncrementalFinancedUnits > 1e-9 || m.report.totals.d2IncrementalFinancedUnits > 1e-9);
const buyersObserved = a.monthly.some(m => m.report.totals.buyers > 0);
const exposuresObserved = a.monthly.some(m => m.report.totals.d1BuyerPayable > 1e-9 || m.report.totals.d2BuyerPayable > 1e-9);

const gates = {
  noMutation: a.noMutation && b.noMutation,
  exactShadowReplay: a.exactShadowReplay && b.exactShadowReplay && exactDiagnosticReplay,
  exactCanonicalReplay,
  hardAccountingHealthy: a.hardAccountingHealthy && b.hardAccountingHealthy,
  physicalOrderingOk: a.physicalOrderingOk && b.physicalOrderingOk,
  apArConservationOk: a.apArConservationOk && b.apArConservationOk,
  noNegativeExposure: a.noNegativeExposure && b.noNegativeExposure,
  buyersObserved,
  exposuresObserved,
  creditRecoveryObserved
};
gates.ok = Object.values(gates).every(Boolean);

console.log('WP_RV08_R4_CF_D_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CF_D_FINAL', JSON.stringify(final));
console.log('WP_RV08_R4_CF_D_AVERAGES', JSON.stringify(averages));
console.log('WP_RV08_R4_CF_D_WORLD_DIGEST', a.digest);

const result = {
  workPackage: 'WP-RV08-R4-CF-D',
  title: 'Invoice / trade-credit shadow contract',
  generatedAt: new Date().toISOString(),
  seed,
  months,
  gates,
  averages,
  final,
  monthly: a.monthly,
  worldDigest: a.digest
};

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CF_D_OUTPUT', outputJson);
}

assert.equal(gates.ok, true, `${seed}: R4-CF-D gate failed`);
