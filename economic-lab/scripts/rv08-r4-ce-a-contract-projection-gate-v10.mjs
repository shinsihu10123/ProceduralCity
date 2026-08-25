import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { PersonEmploymentContractRegistry } from '../src/research/person-employment-contract-registry.js';

const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const months = Math.max(1, Math.round(Number(process.env.DIAG_MONTHS || 12)));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;

// Diagnostic fixture only; not an empirical demographic calibration.
const diagnosticProfile = Object.freeze({
  id: 'R4-CE-A-DIAGNOSTIC-FIXTURE-v1',
  householdSizeDistribution: [
    { size: 1, share: 0.25 },
    { size: 2, share: 0.30 },
    { size: 3, share: 0.25 },
    { size: 4, share: 0.20 }
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

function digest(world) {
  const h = createHash('sha256');
  h.update(JSON.stringify({ month: world.month, rng: world.rng }));
  for (const country of world.countries) {
    h.update(JSON.stringify(country));
    h.update(JSON.stringify(world.accountingReport(country.id)));
  }
  for (const entry of world.ledger.entries) h.update(JSON.stringify(entry));
  return h.digest('hex');
}

function makeWorld() {
  return new EconomicWorld(seed, {
    scaleProfile: 'baseline',
    healthCheckInterval: 0,
    enableShadowPersonLayer: true,
    shadowDemographyProfile: diagnosticProfile,
    enableShadowLaborDemand: true
  });
}

function run() {
  const world = makeWorld();
  const monthly = [];
  for (let i = 0; i <= months; i += 1) {
    if (i > 0) world.stepMonth();
    const registry = new PersonEmploymentContractRegistry({ shadowPersonSystem: world.shadowPersonHousehold });
    registry.project(world.countries, world.month);
    const validation = registry.validate(world.countries);
    assert.equal(validation.ok, true, `${seed}/month${world.month}: contract registry validation failed`);
    monthly.push({ month: world.month, report: registry.report(), validation });
  }
  const health = world.forceHealthCheck();
  const ledgerOk = world.countries.every(country => world.ledger.verifyCountry(country.id)?.ok === true);
  const accountingOk = world.countries.every(country => world.accounting.verifyCountry(country, world.ledger, world.month)?.ok !== false);
  return { world, monthly, health, ledgerOk, accountingOk, digest: digest(world) };
}

const a = run();
const b = run();

const exactWorldReplay = a.digest === b.digest;
const exactProjectionReplay = JSON.stringify(a.monthly) === JSON.stringify(b.monthly);
const allProjectionValid = a.monthly.every(row => row.validation.ok === true) && b.monthly.every(row => row.validation.ok === true);
const hardAccountingHealthy = a.health.ok === true && b.health.ok === true && a.ledgerOk && b.ledgerOk && a.accountingOk && b.accountingOk;
const final = a.monthly[a.monthly.length - 1].report;
const contradictionsObserved = Number(final?.totals?.unresolvedEmployedHouseholds || 0) > 0;
const noSilentRepair = Number(final?.totals?.projectedContracts || 0) + Number(final?.totals?.unresolvedEmployedHouseholds || 0) === Number(final?.totals?.canonicalEmployedHouseholds || 0);
const contractsObserved = Number(final?.totals?.projectedContracts || 0) > 0;

const gates = {
  exactWorldReplay,
  exactProjectionReplay,
  allProjectionValid,
  hardAccountingHealthy,
  contractsObserved,
  contradictionsObserved,
  noSilentRepair
};
gates.ok = Object.values(gates).every(Boolean);

assert.equal(exactWorldReplay, true, `${seed}: world replay changed`);
assert.equal(exactProjectionReplay, true, `${seed}: contract projection is not deterministic`);
assert.equal(allProjectionValid, true, `${seed}: contract validation failed`);
assert.equal(hardAccountingHealthy, true, `${seed}: accounting/health gate failed`);
assert.equal(contractsObserved, true, `${seed}: no projected contracts observed`);
assert.equal(contradictionsObserved, true, `${seed}: fixture failed to expose unresolved legacy employment contradictions`);
assert.equal(noSilentRepair, true, `${seed}: projection silently repaired or dropped legacy employment`);

const result = {
  workPackage: 'WP-RV08-R4-CE-A',
  title: 'Deterministic person employment contract projection gate',
  generatedAt: new Date().toISOString(),
  seed,
  months,
  fixture: diagnosticProfile,
  gates,
  runA: { digest: a.digest, finalReport: final, monthly: a.monthly },
  runB: { digest: b.digest, finalReport: b.monthly[b.monthly.length - 1].report }
};

console.log('WP_RV08_R4_CE_A_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CE_A_TOTALS', JSON.stringify(final.totals));
console.log('WP_RV08_R4_CE_A_WORLD_DIGEST', a.digest);

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CE_A_OUTPUT', outputJson);
}
