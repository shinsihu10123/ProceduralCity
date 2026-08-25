import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { WorkingCapitalLaborEnvelope } from '../src/research/working-capital-labor-envelope.js';

const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const months = Math.max(1, Math.round(Number(process.env.DIAG_MONTHS || 24)));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;

function hashJson(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function worldDigest(world) {
  return hashJson({
    month: world.month,
    rngState: world.rng.state,
    countries: world.countries,
    ledgerEntries: world.ledger.entries
  });
}

function compact(report) {
  const t = report.totals;
  return {
    establishments: t.establishments,
    physicalLaborNeed: t.physicalLaborNeed,
    cashOnlyFinanceableLabor: t.cashOnlyFinanceableLabor,
    admissibleCreditFinanceableLabor: t.admissibleCreditFinanceableLabor,
    fullFinanceableLabor: t.fullFinanceableLabor,
    canonicalDesiredWorkers: t.canonicalDesiredWorkers,
    currentWorkers: t.currentWorkers,
    creditRequested: t.creditRequested,
    creditAdmissible: t.creditAdmissible,
    approvedApplications: t.approvedApplications,
    eligibleApplications: t.eligibleApplications,
    bindingCounts: t.bindingCounts
  };
}

const control = new EconomicWorld(seed, { scaleProfile: 'baseline', healthCheckInterval: 0 });
const observed = new EconomicWorld(seed, { scaleProfile: 'baseline', healthCheckInterval: 0 });
const envelope = new WorkingCapitalLaborEnvelope({
  ledger: observed.ledger,
  accounting: observed.accounting,
  rng: observed.rng
});

const monthly = [];
let noEnvelopeMutation = true;
let exactEnvelopeReplay = true;
let validationOk = true;
let exactCanonicalReplayEachMonth = true;

for (let i = 0; i < months; i += 1) {
  control.stepMonth();
  observed.stepMonth();
  const before = worldDigest(observed);
  const first = envelope.refresh(observed.countries, observed.month);
  const afterFirst = worldDigest(observed);
  const second = envelope.refresh(observed.countries, observed.month);
  const afterSecond = worldDigest(observed);
  noEnvelopeMutation &&= before === afterFirst && before === afterSecond;
  exactEnvelopeReplay &&= JSON.stringify(first) === JSON.stringify(second);
  validationOk &&= first.validation.ok === true;
  exactCanonicalReplayEachMonth &&= worldDigest(control) === worldDigest(observed);
  monthly.push({ month: observed.month, totals: compact(first), validation: first.validation });
}

const finalControlDigest = worldDigest(control);
const finalObservedDigest = worldDigest(observed);
const exactCanonicalReplay = finalControlDigest === finalObservedDigest && exactCanonicalReplayEachMonth;
const health = observed.forceHealthCheck();
const ledgerHealthy = observed.countries.every(country => observed.ledger.verifyCountry(country.id)?.ok === true);
const accountingHealthy = observed.countries.every(country => observed.accounting.verifyCountry(country, observed.ledger, observed.month)?.ok !== false);
const hardAccountingHealthy = health.ok === true && ledgerHealthy && accountingHealthy;

const final = monthly[monthly.length - 1]?.totals || {};
const creditObserved = monthly.some(row => Number(row.totals.creditRequested || 0) > 0);
const financeableObserved = monthly.some(row => Number(row.totals.fullFinanceableLabor || 0) > 0);
const boundsHold = monthly.every(row => {
  const t = row.totals;
  return Number(t.fullFinanceableLabor || 0) <= Number(t.admissibleCreditFinanceableLabor || 0) + 1e-6;
});

const gates = {
  noEnvelopeMutation,
  exactEnvelopeReplay,
  validationOk,
  exactCanonicalReplay,
  hardAccountingHealthy,
  creditObserved,
  financeableObserved,
  boundsHold
};
gates.ok = Object.values(gates).every(Boolean);

const averages = monthly.reduce((acc, row) => {
  for (const key of ['physicalLaborNeed','cashOnlyFinanceableLabor','admissibleCreditFinanceableLabor','fullFinanceableLabor','canonicalDesiredWorkers','currentWorkers','creditRequested','creditAdmissible','approvedApplications','eligibleApplications']) {
    acc[key] = (acc[key] || 0) + Number(row.totals[key] || 0) / monthly.length;
  }
  return acc;
}, {});

console.log('WP_RV08_R4_CE_D4_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CE_D4_FINAL', JSON.stringify(final));
console.log('WP_RV08_R4_CE_D4_AVERAGES', JSON.stringify(averages));
console.log('WP_RV08_R4_CE_D4_WORLD_DIGEST', finalObservedDigest);

const result = {
  workPackage: 'WP-RV08-R4-CE-D4',
  title: 'Working-capital-aware labor demand envelope multi-seed gate',
  generatedAt: new Date().toISOString(),
  seed,
  months,
  gates,
  averages,
  final,
  monthly,
  finalControlDigest,
  finalObservedDigest
};

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CE_D4_OUTPUT', outputJson);
}

assert.equal(noEnvelopeMutation, true, `${seed}: envelope mutated live world`);
assert.equal(exactEnvelopeReplay, true, `${seed}: envelope replay nondeterministic`);
assert.equal(validationOk, true, `${seed}: envelope validation failed`);
assert.equal(exactCanonicalReplay, true, `${seed}: observed world diverged from control`);
assert.equal(hardAccountingHealthy, true, `${seed}: accounting/ledger health failed`);
assert.equal(creditObserved, true, `${seed}: no working-capital credit demand observed`);
assert.equal(financeableObserved, true, `${seed}: no financeable labor observed`);
assert.equal(boundsHold, true, `${seed}: full financeable labor exceeded financial bound`);
