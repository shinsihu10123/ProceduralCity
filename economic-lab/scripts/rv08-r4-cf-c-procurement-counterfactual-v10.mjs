import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { ProcurementCounterfactualEnvelope } from '../src/research/procurement-counterfactual-envelope.js';

const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const months = Math.max(1, Math.round(Number(process.env.DIAG_MONTHS || 24)));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;

function digest(world) {
  const h = createHash('sha256');
  h.update(JSON.stringify({ month: world.month, rng: world.rng }));
  for (const c of world.countries) h.update(JSON.stringify(c));
  h.update(JSON.stringify(world.ledger.entries));
  return h.digest('hex');
}

function average(monthly, key) {
  return monthly.reduce((s, m) => s + Number(m.report.totals[key] || 0), 0) / Math.max(1, monthly.length);
}

function run() {
  const world = new EconomicWorld(seed, { scaleProfile:'baseline', healthCheckInterval:0 });
  const audit = new ProcurementCounterfactualEnvelope({ ledger: world.ledger });
  const monthly = [];
  let noMutation = true;
  let exactAuditReplay = true;
  let validationOk = true;
  for (let i = 0; i < months; i += 1) {
    world.stepMonth();
    const before = digest(world);
    const a = audit.report(world.countries, world.month);
    const b = audit.report(world.countries, world.month);
    const after = digest(world);
    noMutation &&= before === after;
    exactAuditReplay &&= JSON.stringify(a) === JSON.stringify(b);
    validationOk &&= a.validation.ok === true;
    monthly.push({ month:world.month, report:a });
  }
  const health = world.forceHealthCheck();
  const ledgerHealthy = world.countries.every(c => world.ledger.verifyCountry(c.id)?.ok === true);
  const accountingHealthy = world.countries.every(c => world.accounting.verifyCountry(c, world.ledger, world.month)?.ok !== false);
  return { world, monthly, noMutation, exactAuditReplay, validationOk, hardAccountingHealthy:health.ok === true && ledgerHealthy && accountingHealthy, digest:digest(world) };
}

const a = run();
const b = run();
const exactCanonicalReplay = a.digest === b.digest;
const exactDiagnosticReplay = JSON.stringify(a.monthly) === JSON.stringify(b.monthly);
const recovery42 = average(a.monthly, 'recovery42PctToFullCash');
const recoverySettlement = average(a.monthly, 'recoveryFullCashToInventoryOnly');
const residualInventory = average(a.monthly, 'residualShortageInventoryOnly');
const final = a.monthly.at(-1).report.totals;
const gates = {
  noMutation: a.noMutation && b.noMutation,
  exactAuditReplay: a.exactAuditReplay && b.exactAuditReplay && exactDiagnosticReplay,
  validationOk: a.validationOk && b.validationOk,
  exactCanonicalReplay,
  hardAccountingHealthy: a.hardAccountingHealthy && b.hardAccountingHealthy,
  buyersObserved: a.monthly.some(m => m.report.totals.buyers > 0),
  counterfactualRecoveryObserved: recovery42 > 0 || recoverySettlement > 0 || residualInventory > 0
};
gates.ok = Object.values(gates).every(Boolean);

const averages = {
  requiredInputUnits: average(a.monthly,'requiredInputUnits'),
  unmetInputUnits: average(a.monthly,'unmetInputUnits'),
  canonical42PctCashEnvelope: average(a.monthly,'canonical42PctCashEnvelope'),
  fullCurrentCashEnvelope: average(a.monthly,'fullCurrentCashEnvelope'),
  inventoryOnlyNoBuyerCashConstraintEnvelope: average(a.monthly,'inventoryOnlyNoBuyerCashConstraintEnvelope'),
  recovery42PctToFullCash: recovery42,
  recoveryFullCashToInventoryOnly: recoverySettlement,
  residualShortage42Pct: average(a.monthly,'residualShortage42Pct'),
  residualShortageFullCash: average(a.monthly,'residualShortageFullCash'),
  residualShortageInventoryOnly: residualInventory
};

console.log('WP_RV08_R4_CF_C_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CF_C_FINAL', JSON.stringify(final));
console.log('WP_RV08_R4_CF_C_AVERAGES', JSON.stringify(averages));
console.log('WP_RV08_R4_CF_C_WORLD_DIGEST', a.digest);

const result = { workPackage:'WP-RV08-R4-CF-C', title:'Procurement counterfactual envelope', generatedAt:new Date().toISOString(), seed, months, gates, averages, final, monthly:a.monthly, worldDigest:a.digest };
if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive:true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CF_C_OUTPUT', outputJson);
}
assert.equal(gates.ok, true, `${seed}: R4-CF-C gate failed`);
