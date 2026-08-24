import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';

const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const months = Math.max(1, Math.round(Number(process.env.DIAG_MONTHS || 6)));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;

// Explicit diagnostic fixture only. These numbers are NOT empirical calibration targets.
const diagnosticProfile = Object.freeze({
  id: 'R4-CD-M1-DIAGNOSTIC-FIXTURE-v1',
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

function canonicalDigest(world) {
  const h = createHash('sha256');
  h.update(JSON.stringify({ month: world.month, rng: world.rng }));
  for (const country of world.countries) {
    h.update(JSON.stringify(country));
    h.update(JSON.stringify(world.accountingReport(country.id)));
  }
  for (const entry of world.ledger.entries) h.update(JSON.stringify(entry));
  return h.digest('hex');
}

function canonicalSummary(world) {
  return world.countries.map(country => ({
    countryId: country.id,
    households: country.households.length,
    activeFirms: country.firms.filter(f => f.active !== false).length,
    unemployment: Number(country.macro?.unemployment || 0),
    gdp: Number(country.macro?.gdp || 0),
    wageArrears: Number(country.macro?.wageArrears || 0),
    firmEntries: Number(country.macro?.firmEntries || 0),
    firmExits: Number(country.macro?.firmExits || 0),
    outstandingLoans: Number(country.macro?.outstandingLoans || 0)
  }));
}

function hardGates(world) {
  const health = world.forceHealthCheck();
  const ledgerOk = world.countries.every(country => world.ledger.verifyCountry(country.id)?.ok === true);
  const accountingOk = world.countries.every(country => world.accounting.verifyCountry(country, world.ledger, world.month)?.ok !== false);
  return { healthOk: health.ok === true, ledgerOk, accountingOk };
}

function run(shadowEnabled) {
  const world = new EconomicWorld(seed, {
    scaleProfile: 'baseline',
    healthCheckInterval: 0,
    enableShadowPersonLayer: shadowEnabled,
    shadowDemographyProfile: shadowEnabled ? diagnosticProfile : undefined
  });

  const initialShadow = shadowEnabled ? world.shadowPersonReport() : null;
  for (let i = 0; i < months; i += 1) world.stepMonth();
  const finalShadow = shadowEnabled ? world.shadowPersonReport() : null;
  const gates = hardGates(world);
  const digest = canonicalDigest(world);

  return {
    shadowEnabled,
    digest,
    canonicalSummary: canonicalSummary(world),
    gates,
    initialShadow,
    finalShadow
  };
}

const control = run(false);
const shadow = run(true);

const exactReplay = control.digest === shadow.digest;
const canonicalSummaryExact = JSON.stringify(control.canonicalSummary) === JSON.stringify(shadow.canonicalSummary);
const shadowValidationOk = shadow.finalShadow?.validation?.ok === true;
const profileGeneratedMultiplePersonHouseholds = shadow.finalShadow?.countries?.some(row => Number(row.personsPerHousehold) > 1) === true;
const allHardGates = Object.values(control.gates).every(Boolean) && Object.values(shadow.gates).every(Boolean);

const gates = {
  exactReplay,
  canonicalSummaryExact,
  shadowValidationOk,
  profileGeneratedMultiplePersonHouseholds,
  allHardGates
};
gates.ok = Object.values(gates).every(Boolean);

assert.equal(exactReplay, true, `${seed}: shadow layer changed canonical state digest`);
assert.equal(canonicalSummaryExact, true, `${seed}: shadow layer changed canonical macro/entry/exit summary`);
assert.equal(shadowValidationOk, true, `${seed}: shadow schema validation failed`);
assert.equal(profileGeneratedMultiplePersonHouseholds, true, `${seed}: shadow fixture did not exercise household size > 1`);
assert.equal(allHardGates, true, `${seed}: health/ledger/accounting hard gate failed`);

const result = {
  workPackage: 'WP-RV08-R4-CD-M1',
  title: 'Shadow Person/Household exact-replay non-interference gate',
  generatedAt: new Date().toISOString(),
  seed,
  months,
  fixture: diagnosticProfile,
  gates,
  control: {
    digest: control.digest,
    canonicalSummary: control.canonicalSummary,
    hardGates: control.gates
  },
  shadow: {
    digest: shadow.digest,
    canonicalSummary: shadow.canonicalSummary,
    hardGates: shadow.gates,
    initialReport: shadow.initialShadow,
    finalReport: shadow.finalShadow
  }
};

console.log('WP_RV08_R4_CD_M1_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CD_M1_SHADOW_TOTALS', JSON.stringify(shadow.finalShadow?.totals || {}));
console.log('WP_RV08_R4_CD_M1_CONTROL_DIGEST', control.digest);
console.log('WP_RV08_R4_CD_M1_SHADOW_DIGEST', shadow.digest);

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CD_M1_OUTPUT', outputJson);
}
