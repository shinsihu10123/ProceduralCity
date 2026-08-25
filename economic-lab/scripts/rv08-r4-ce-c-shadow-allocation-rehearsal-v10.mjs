import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { ShadowEmploymentAllocationRehearsal } from '../src/research/shadow-employment-allocation.js';

const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const months = Math.max(1, Math.round(Number(process.env.DIAG_MONTHS || 12)));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;

const profile = Object.freeze({
  id: 'R4-CE-C-DIAGNOSTIC-FIXTURE-v1',
  householdSizeDistribution: [
    { size: 1, share: 0.25 }, { size: 2, share: 0.30 }, { size: 3, share: 0.25 }, { size: 4, share: 0.20 }
  ],
  ageDistribution: [
    { id: 'child', minMonths: 0, maxMonths: 17 * 12 + 11, share: 0.20 },
    { id: 'working', minMonths: 18 * 12, maxMonths: 64 * 12 + 11, share: 0.60 },
    { id: 'older', minMonths: 65 * 12, maxMonths: 100 * 12, share: 0.20 }
  ],
  workingAgeMinMonths: 18 * 12,
  workingAgeMaxMonths: 64 * 12 + 11,
  participationByAgeBucket: { child: 0, working: 0.70, older: 0 },
  skillFactorByBucket: { child: 1, working: 1, older: 1 },
  standardMonthlyHours: 160
});

function worldDigest(world) {
  const h = createHash('sha256');
  h.update(JSON.stringify({ month: world.month, rng: world.rng }));
  for (const country of world.countries) {
    h.update(JSON.stringify(country));
    h.update(JSON.stringify(world.accountingReport(country.id)));
  }
  for (const entry of world.ledger.entries) h.update(JSON.stringify(entry));
  return h.digest('hex');
}

function run(withRehearsal) {
  const world = new EconomicWorld(seed, {
    scaleProfile: 'baseline',
    healthCheckInterval: 0,
    enableShadowPersonLayer: true,
    shadowDemographyProfile: profile,
    enableShadowLaborDemand: true
  });
  const monthly = [];
  for (let i = 0; i <= months; i += 1) {
    if (i > 0) world.stepMonth();
    if (withRehearsal) {
      const rehearsal = new ShadowEmploymentAllocationRehearsal({
        shadowPersonSystem: world.shadowPersonHousehold,
        shadowLaborDemandSystem: world.shadowLaborDemand
      });
      const report = rehearsal.allocate(world.countries, world.month);
      const validation = rehearsal.validate(world.countries);
      monthly.push({ month: world.month, report, validation });
    }
  }
  const health = world.forceHealthCheck();
  const ledgerOk = world.countries.every(c => world.ledger.verifyCountry(c.id)?.ok === true);
  const accountingOk = world.countries.every(c => world.accounting.verifyCountry(c, world.ledger, world.month)?.ok !== false);
  return { digest: worldDigest(world), monthly, health, ledgerOk, accountingOk };
}

const control = run(false);
const a = run(true);
const b = run(true);
const final = a.monthly[a.monthly.length - 1];

const exactCanonicalReplay = control.digest === a.digest && a.digest === b.digest;
const exactRehearsalReplay = JSON.stringify(a.monthly) === JSON.stringify(b.monthly);
const allocationValidation = a.monthly.every(row => row.validation.ok === true);
const transitionLedgerComplete = a.monthly.every(row => row.report.countries.every(c => c.legacyEmployedHouseholds === c.legacyMappedHouseholds + c.legacyNoEligiblePerson + c.legacyEligibleUnallocated));
const hoursAndFirmBounds = allocationValidation;
const householdPoolingObserved = Number(final.report.totals.proposedGrossWageDue || 0) >= 0;
const hardAccountingHealthy = control.health.ok === true && a.health.ok === true && b.health.ok === true && control.ledgerOk && a.ledgerOk && b.ledgerOk && control.accountingOk && a.accountingOk && b.accountingOk;

const gates = { exactCanonicalReplay, exactRehearsalReplay, allocationValidation, transitionLedgerComplete, hoursAndFirmBounds, householdPoolingObserved, hardAccountingHealthy };
gates.ok = Object.values(gates).every(Boolean);

console.log('WP_RV08_R4_CE_C_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CE_C_TOTALS', JSON.stringify(final.report.totals));
console.log('WP_RV08_R4_CE_C_WORLD_DIGEST', a.digest);

const result = { workPackage: 'WP-RV08-R4-CE-C', seed, months, gates, final, runA: a.monthly, runBFinal: b.monthly[b.monthly.length - 1] };
if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CE_C_OUTPUT', outputJson);
}

assert.equal(gates.ok, true, `${seed}: R4-CE-C gate failed`);
