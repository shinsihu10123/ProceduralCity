import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { PersonEmploymentContractRegistry } from '../src/research/person-employment-contract-registry.js';
import { PersonWageAttributionAudit } from '../src/research/person-wage-attribution-audit.js';

const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const months = Math.max(1, Math.round(Number(process.env.DIAG_MONTHS || 12)));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;

const diagnosticProfile = Object.freeze({
  id: 'R4-CE-B-DIAGNOSTIC-FIXTURE-v1',
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

function run() {
  const world = new EconomicWorld(seed, {
    scaleProfile: 'baseline',
    healthCheckInterval: 0,
    enableShadowPersonLayer: true,
    shadowDemographyProfile: diagnosticProfile
  });
  const monthly = [];
  for (let i = 0; i <= months; i += 1) {
    if (i > 0) world.stepMonth();
    const registry = new PersonEmploymentContractRegistry({ shadowPersonSystem: world.shadowPersonHousehold });
    registry.project(world.countries, world.month);
    const registryValidation = registry.validate(world.countries);
    const audit = new PersonWageAttributionAudit({ accounting: world.accounting });
    const report = audit.report(world.countries, registry, world.month);
    monthly.push({ month: world.month, registryValidation, report });
  }
  const health = world.forceHealthCheck();
  const ledgerOk = world.countries.every(c => world.ledger.verifyCountry(c.id)?.ok === true);
  const accountingOk = world.countries.every(c => world.accounting.verifyCountry(c, world.ledger, world.month)?.ok !== false);
  return { world, monthly, health, ledgerOk, accountingOk, digest: digest(world) };
}

const a = run();
const b = run();
const finalA = a.monthly[a.monthly.length - 1].report;
const exactWorldReplay = a.digest === b.digest;
const exactAuditReplay = JSON.stringify(a.monthly) === JSON.stringify(b.monthly);
const registryValid = a.monthly.every(row => row.registryValidation.ok === true);
const wageAttributionIdentities = a.monthly.every(row => row.report.gates.ok === true);
const hardAccountingHealthy = a.health.ok === true && b.health.ok === true && a.ledgerOk && b.ledgerOk && a.accountingOk && b.accountingOk;
const unresolvedAttributionVisible = Number(finalA.totals.unresolvedEmploymentContradictions) > 0;
const glWageClaimsObserved = Number(finalA.totals.householdWageReceivable) > 0 || Number(finalA.totals.firmWagesPayable) > 0;
const firstWageIdentityFailure = a.monthly.find(row => row.report.gates.ok !== true) || null;

const gates = {
  exactWorldReplay,
  exactAuditReplay,
  registryValid,
  wageAttributionIdentities,
  hardAccountingHealthy,
  unresolvedAttributionVisible,
  glWageClaimsObserved
};
gates.ok = Object.values(gates).every(Boolean);

console.log('WP_RV08_R4_CE_B_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CE_B_TOTALS', JSON.stringify(finalA.totals));
if (firstWageIdentityFailure) console.log('WP_RV08_R4_CE_B_FIRST_FAILURE', JSON.stringify(firstWageIdentityFailure));
console.log('WP_RV08_R4_CE_B_WORLD_DIGEST', a.digest);

const result = {
  workPackage: 'WP-RV08-R4-CE-B-PREFLIGHT',
  title: 'Person-attributed wage accounting preflight without canonical mutation',
  generatedAt: new Date().toISOString(),
  seed,
  months,
  fixture: diagnosticProfile,
  gates,
  firstWageIdentityFailure,
  runA: { digest: a.digest, monthly: a.monthly, final: finalA },
  runB: { digest: b.digest, final: b.monthly[b.monthly.length - 1].report }
};

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CE_B_OUTPUT', outputJson);
}

assert.equal(exactWorldReplay, true, `${seed}: world replay changed`);
assert.equal(exactAuditReplay, true, `${seed}: wage audit replay changed`);
assert.equal(registryValid, true, `${seed}: contract registry validation failed`);
assert.equal(wageAttributionIdentities, true, `${seed}: wage attribution identity failed`);
assert.equal(hardAccountingHealthy, true, `${seed}: canonical accounting/health gate failed`);
assert.equal(unresolvedAttributionVisible, true, `${seed}: unresolved attribution not visible`);
assert.equal(glWageClaimsObserved, true, `${seed}: wage claim balances not observed`);
