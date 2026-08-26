import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { InputLiquidityDecompositionAudit } from '../src/research/input-liquidity-decomposition-audit.js';

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

function aggregateMonthly(monthly) {
  const n = Math.max(1, monthly.length);
  const keys = ['requiredInputUnits','unmetBeforeProcurement','canonicalBudgetCeiling','fullCashCeiling','supplierInventoryCeiling','shortageFromSupplierScarcity','additionalShortageFrom42PctCap','observedSupplyShortage'];
  return Object.fromEntries(keys.map(key => [key, monthly.reduce((s, m) => s + Number(m.report.totals[key] || 0), 0) / n]));
}

function run() {
  const world = new EconomicWorld(seed, { scaleProfile: 'baseline', healthCheckInterval: 0 });
  const audit = new InputLiquidityDecompositionAudit({ ledger: world.ledger });
  const monthly = [];
  let noMutation = true;
  let exactReplay = true;

  for (let m = 0; m < months; m += 1) {
    world.stepMonth();
    const before = digest(world);
    const first = audit.report(world.countries, world.month);
    const second = audit.report(world.countries, world.month);
    const after = digest(world);
    noMutation &&= before === after;
    exactReplay &&= JSON.stringify(first) === JSON.stringify(second);
    monthly.push({ month: world.month, report: first });
  }

  const health = world.forceHealthCheck();
  const ledgerHealthy = world.countries.every(c => world.ledger.verifyCountry(c.id)?.ok === true);
  const accountingHealthy = world.countries.every(c => world.accounting.verifyCountry(c, world.ledger, world.month)?.ok !== false);
  return { world, monthly, noMutation, exactReplay, hardAccountingHealthy: health.ok === true && ledgerHealthy && accountingHealthy, digest: digest(world) };
}

const a = run();
const b = run();
const exactCanonicalReplay = a.digest === b.digest;
const exactDiagnosticReplay = JSON.stringify(a.monthly) === JSON.stringify(b.monthly);
const averages = aggregateMonthly(a.monthly);
const final = a.monthly.at(-1).report.totals;
const buyersObserved = a.monthly.some(m => m.report.totals.buyers > 0);
const shortagesObserved = a.monthly.some(m => m.report.totals.unmetBeforeProcurement > 0 || m.report.totals.observedSupplyShortage > 0);
const decompositionObserved = a.monthly.some(m => m.report.totals.shortageFromSupplierScarcity > 0 || m.report.totals.additionalShortageFrom42PctCap > 0 || m.report.totals.constraintCounts.SEARCH_OR_TIMING_OR_OTHER > 0);

const gates = {
  noMutation: a.noMutation && b.noMutation,
  exactAuditReplay: a.exactReplay && b.exactReplay && exactDiagnosticReplay,
  exactCanonicalReplay,
  hardAccountingHealthy: a.hardAccountingHealthy && b.hardAccountingHealthy,
  buyersObserved,
  shortagesObserved,
  decompositionObserved
};
gates.ok = Object.values(gates).every(Boolean);

console.log('WP_RV08_R4_CF_B_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CF_B_FINAL', JSON.stringify(final));
console.log('WP_RV08_R4_CF_B_AVERAGES', JSON.stringify(averages));
console.log('WP_RV08_R4_CF_B_WORLD_DIGEST', a.digest);

const result = { workPackage:'WP-RV08-R4-CF-B', title:'Input liquidity decomposition audit', generatedAt:new Date().toISOString(), seed, months, gates, averages, final, monthly:a.monthly, worldDigest:a.digest };
if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CF_B_OUTPUT', outputJson);
}

assert.equal(gates.ok, true, `${seed}: R4-CF-B gate failed`);
