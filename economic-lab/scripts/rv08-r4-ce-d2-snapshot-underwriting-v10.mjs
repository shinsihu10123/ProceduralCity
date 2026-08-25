import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import {
  buildFirmWorkingCapitalApplicationSnapshot,
  evaluateUnderwritingSnapshot
} from '../src/research/snapshot-underwriting-evaluator.js';

const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const months = Math.max(1, Math.round(Number(process.env.DIAG_MONTHS || 12)));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;

function hashJson(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function ledgerDigest(world) {
  return hashJson(world.ledger.entries);
}

function signalsFor(country) {
  const prev = country.previousMacro || country.macro || {};
  const history = country.history || [];
  const prev2 = history.length > 1 ? history[history.length - 2] : prev;
  const inflation = prev2?.priceIndex ? Number(prev.priceIndex || 0) / Number(prev2.priceIndex || 1) - 1 : 0;
  const wageGrowth = prev2?.avgWage ? Number(prev.avgWage || 0) / Number(prev2.avgWage || 1) - 1 : 0;
  const demandGrowth = prev2?.nominalSales ? Number(prev.nominalSales || 0) / Number(prev2.nominalSales || 1) - 1 : 0;
  return {
    inflation: Number.isFinite(inflation) ? inflation : 0,
    wageGrowth: Number.isFinite(wageGrowth) ? wageGrowth : 0,
    demandGrowth: Number.isFinite(demandGrowth) ? demandGrowth : 0,
    unemployment: Number(prev?.unemployment || 0)
  };
}

const world = new EconomicWorld(seed, { scaleProfile: 'baseline', healthCheckInterval: 0 });
for (let i = 0; i < months; i += 1) world.stepMonth();

const before = {
  rngState: world.rng.state,
  ledgerEntries: world.ledger.entries.length,
  ledgerDigest: ledgerDigest(world),
  countries: Object.fromEntries(world.countries.map(country => [country.id, {
    bankDigest: hashJson(country.banks),
    loanDigest: hashJson(country.loans),
    firmDigest: hashJson(country.firms),
    householdDigest: hashJson(country.households),
    depositBalances: country.households.concat(country.firms).map(entity => [entity.accountId, world.ledger.balance(entity.accountId)])
  }]))
};

const countries = [];
let totalEvaluated = 0;
let totalApproved = 0;
let totalRequested = 0;
let totalAdmissible = 0;
let deterministicReplay = true;

for (const country of world.countries) {
  const bank = country.banks[0];
  const bankStatement = world.accounting.entityStatement(bank.id, world.month).balanceSheet;
  const signals = signalsFor(country);
  const rows = [];

  for (const firm of country.firms) {
    if (firm.active === false) continue;
    const application = buildFirmWorkingCapitalApplicationSnapshot({
      firm,
      cash: world.ledger.balance(firm.accountId)
    });
    if (!application?.applicationEligible) continue;

    const args = {
      bank,
      application,
      bankStatement,
      signals,
      rngState: before.rngState
    };
    const first = evaluateUnderwritingSnapshot(args);
    const second = evaluateUnderwritingSnapshot(args);
    const exactReplay = JSON.stringify(first) === JSON.stringify(second);
    deterministicReplay &&= exactReplay;

    rows.push({
      firmId: String(firm.id),
      sectorId: String(firm.industryId || 'UNKNOWN'),
      requestedAmount: first.requestedAmount,
      approved: first.approved,
      admissibleAmount: first.admissibleAmount,
      capitalCapacity: first.capitalCapacity,
      annualRate: first.annualRate,
      estimatedDefaultProbability: first.estimatedDefaultProbability,
      paymentBurden: first.paymentBurden,
      rejectionReason: first.rejectionReason,
      exactReplay,
      application: {
        payrollNeed: application.payrollNeed,
        inputNeed: application.inputNeed,
        workingCapitalTarget: application.workingCapitalTarget,
        shortfall: application.shortfall,
        expansionNeed: application.expansionNeed,
        termMonths: application.termMonths,
        termSource: application.termSource
      }
    });
    totalEvaluated += 1;
    totalApproved += first.approved ? 1 : 0;
    totalRequested += first.requestedAmount;
    totalAdmissible += first.admissibleAmount;
  }

  countries.push({
    countryId: country.id,
    evaluatedApplications: rows.length,
    approvedApplications: rows.filter(row => row.approved).length,
    approvalRate: rows.length ? rows.filter(row => row.approved).length / rows.length : 0,
    requestedAmount: rows.reduce((sum, row) => sum + row.requestedAmount, 0),
    admissibleAmount: rows.reduce((sum, row) => sum + row.admissibleAmount, 0),
    rejectionReasons: rows.reduce((acc, row) => {
      const key = row.approved ? 'APPROVED' : row.rejectionReason || 'UNSPECIFIED_REJECTION';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    rows
  });
}

const after = {
  rngState: world.rng.state,
  ledgerEntries: world.ledger.entries.length,
  ledgerDigest: ledgerDigest(world),
  countries: Object.fromEntries(world.countries.map(country => [country.id, {
    bankDigest: hashJson(country.banks),
    loanDigest: hashJson(country.loans),
    firmDigest: hashJson(country.firms),
    householdDigest: hashJson(country.households),
    depositBalances: country.households.concat(country.firms).map(entity => [entity.accountId, world.ledger.balance(entity.accountId)])
  }]))
};

const noLiveMutation = JSON.stringify(before) === JSON.stringify(after);
const admissibleWithinRequested = countries.every(country => country.rows.every(row => row.admissibleAmount <= row.requestedAmount + 1e-8));
const approvedPositive = countries.every(country => country.rows.every(row => !row.approved || row.admissibleAmount > 0));
const health = world.forceHealthCheck();
const ledgerHealthy = world.countries.every(country => world.ledger.verifyCountry(country.id)?.ok === true);
const accountingHealthy = world.countries.every(country => world.accounting.verifyCountry(country, world.ledger, world.month)?.ok !== false);
const hardAccountingHealthy = health.ok === true && ledgerHealthy && accountingHealthy;
const applicationsObserved = totalEvaluated > 0;

const gates = {
  noLiveMutation,
  deterministicReplay,
  admissibleWithinRequested,
  approvedPositive,
  applicationsObserved,
  hardAccountingHealthy
};
gates.ok = Object.values(gates).every(Boolean);

const totals = {
  evaluatedApplications: totalEvaluated,
  approvedApplications: totalApproved,
  approvalRate: totalEvaluated ? totalApproved / totalEvaluated : 0,
  requestedAmount: totalRequested,
  admissibleAmount: totalAdmissible,
  admissibleToRequestedRatio: totalRequested ? totalAdmissible / totalRequested : 0
};

console.log('WP_RV08_R4_CE_D2_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CE_D2_TOTALS', JSON.stringify(totals));
console.log('WP_RV08_R4_CE_D2_COUNTRIES', JSON.stringify(countries.map(c => ({
  countryId: c.countryId,
  evaluatedApplications: c.evaluatedApplications,
  approvedApplications: c.approvedApplications,
  approvalRate: c.approvalRate,
  requestedAmount: c.requestedAmount,
  admissibleAmount: c.admissibleAmount,
  rejectionReasons: c.rejectionReasons
}))));

const result = {
  workPackage: 'WP-RV08-R4-CE-D2',
  title: 'Pure isolated-snapshot underwriting evaluator gate',
  generatedAt: new Date().toISOString(),
  seed,
  months,
  mode: 'ISOLATED_SNAPSHOT_UNDERWRITING',
  gates,
  totals,
  countries,
  before,
  after
};

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CE_D2_OUTPUT', outputJson);
}

assert.equal(noLiveMutation, true, `${seed}: live world mutated by snapshot underwriting`);
assert.equal(deterministicReplay, true, `${seed}: snapshot underwriting replay is not deterministic`);
assert.equal(admissibleWithinRequested, true, `${seed}: admissible amount exceeded requested amount`);
assert.equal(approvedPositive, true, `${seed}: approved application had zero admissible amount`);
assert.equal(applicationsObserved, true, `${seed}: no firm applications observed`);
assert.equal(hardAccountingHealthy, true, `${seed}: accounting/ledger health failed`);
