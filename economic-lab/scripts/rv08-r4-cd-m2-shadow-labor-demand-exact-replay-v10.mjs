import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';

const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const months = Math.max(6, Math.round(Number(process.env.DIAG_MONTHS || 24)));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;

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

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const mean = values => values.length ? values.reduce((sum, value) => sum + finite(value), 0) / values.length : 0;

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

function hardGates(world) {
  const health = world.forceHealthCheck();
  const ledgerOk = world.countries.every(country => world.ledger.verifyCountry(country.id)?.ok === true);
  const accountingOk = world.countries.every(country => world.accounting.verifyCountry(country, world.ledger, world.month)?.ok !== false);
  return { healthOk: health.ok === true, ledgerOk, accountingOk };
}

function canonicalSummary(world) {
  return world.countries.map(country => ({
    countryId: country.id,
    households: country.households.length,
    activeFirms: country.firms.filter(f => f.active !== false).length,
    unemployment: finite(country.macro?.unemployment),
    gdp: finite(country.macro?.gdp),
    wageArrears: finite(country.macro?.wageArrears),
    firmEntries: finite(country.macro?.firmEntries),
    firmExits: finite(country.macro?.firmExits),
    outstandingLoans: finite(country.macro?.outstandingLoans)
  }));
}

function run({ shadow }) {
  const world = new EconomicWorld(seed, {
    scaleProfile: 'baseline',
    healthCheckInterval: 0,
    enableShadowPersonLayer: shadow,
    shadowDemographyProfile: shadow ? diagnosticProfile : undefined,
    enableShadowLaborDemand: shadow
  });

  const monthly = [];
  for (let i = 0; i < months; i += 1) {
    world.stepMonth();
    if (shadow) {
      const report = world.shadowLaborDemandReport();
      for (const country of report.countries) monthly.push({ month: world.month, countryId: country.countryId, ...country.aggregate });
    }
  }

  return {
    digest: canonicalDigest(world),
    canonicalSummary: canonicalSummary(world),
    hardGates: hardGates(world),
    personReport: shadow ? world.shadowPersonReport() : null,
    laborReport: shadow ? world.shadowLaborDemandReport() : null,
    monthly
  };
}

function summarizeMonthly(rows) {
  const countryIds = [...new Set(rows.map(row => row.countryId))];
  return countryIds.map(countryId => {
    const rs = rows.filter(row => row.countryId === countryId);
    const terminal = rs[rs.length - 1] || {};
    return {
      countryId,
      observations: rs.length,
      meanEstablishments: mean(rs.map(row => row.establishments)),
      meanWorkers: mean(rs.map(row => row.workers)),
      meanCanonicalDesiredWorkers: mean(rs.map(row => row.canonicalDesiredWorkers)),
      meanPhysicalLaborNeed: mean(rs.map(row => row.physicalLaborNeed)),
      meanShadowDesiredLaborUnits: mean(rs.map(row => row.shadowDesiredLaborUnits)),
      meanPhysicalAboveCanonicalShare: mean(rs.map(row => row.physicalAboveCanonicalShare)),
      meanCanonicalAboveShadowFinanceableShare: mean(rs.map(row => row.canonicalAboveShadowFinanceableShare)),
      meanRevenueBelowPayrollShare: mean(rs.map(row => row.revenueBelowPayrollShare)),
      meanArrearsPositiveShare: mean(rs.map(row => row.arrearsPositiveShare)),
      meanInputConstrainedShare: mean(rs.map(row => row.inputConstrainedShare)),
      meanWorkingCapitalGapShare: mean(rs.map(row => row.workingCapitalGapShare)),
      meanPhysicalLaborCoverage: mean(rs.filter(row => Number.isFinite(row.physicalLaborCoverage)).map(row => row.physicalLaborCoverage)),
      meanLaborDemandCoverage: mean(rs.filter(row => Number.isFinite(row.laborDemandCoverage)).map(row => row.laborDemandCoverage)),
      terminalEstablishments: terminal.establishments ?? null,
      terminalWorkers: terminal.workers ?? null,
      terminalPhysicalLaborNeed: terminal.physicalLaborNeed ?? null,
      terminalShadowDesiredLaborUnits: terminal.shadowDesiredLaborUnits ?? null
    };
  });
}

const control = run({ shadow: false });
const treatment = run({ shadow: true });

const exactReplay = control.digest === treatment.digest;
const canonicalSummaryExact = JSON.stringify(control.canonicalSummary) === JSON.stringify(treatment.canonicalSummary);
const personValidationOk = treatment.personReport?.validation?.ok === true;
const laborValidationOk = treatment.laborReport?.validation?.ok === true;
const allHardGates = Object.values(control.hardGates).every(Boolean) && Object.values(treatment.hardGates).every(Boolean);
const diagnosticsObserved = treatment.monthly.length > 0 && treatment.monthly.every(row => row.establishments > 0);

const gates = {
  exactReplay,
  canonicalSummaryExact,
  personValidationOk,
  laborValidationOk,
  allHardGates,
  diagnosticsObserved
};
gates.ok = Object.values(gates).every(Boolean);

assert.ok(gates.ok, `${seed}: R4-CD M2 gate failure ${JSON.stringify(gates)}`);

const result = {
  workPackage: 'WP-RV08-R4-CD-M2',
  title: 'Shadow labor demand / establishment feasibility exact replay diagnostic',
  generatedAt: new Date().toISOString(),
  seed,
  months,
  fixture: diagnosticProfile,
  gates,
  control: {
    digest: control.digest,
    canonicalSummary: control.canonicalSummary,
    hardGates: control.hardGates
  },
  treatment: {
    digest: treatment.digest,
    canonicalSummary: treatment.canonicalSummary,
    hardGates: treatment.hardGates,
    personTotals: treatment.personReport?.totals || null,
    finalLaborReport: treatment.laborReport,
    monthlySummary: summarizeMonthly(treatment.monthly)
  }
};

console.log('WP_RV08_R4_CD_M2_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CD_M2_MONTHLY_SUMMARY', JSON.stringify(result.treatment.monthlySummary));
console.log('WP_RV08_R4_CD_M2_CONTROL_DIGEST', control.digest);
console.log('WP_RV08_R4_CD_M2_TREATMENT_DIGEST', treatment.digest);

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CD_M2_OUTPUT', outputJson);
}
