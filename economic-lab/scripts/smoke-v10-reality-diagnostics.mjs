import assert from 'node:assert/strict';
import { EconomicWorld } from '../src/core/world-v10.js';
import { setLaborMarketDiagnosticObserver } from '../src/markets/labor-market.js';
import { RealityDiagnosticRecorder } from '../src/research/reality-diagnostics.js';

function economicFingerprint(world) {
  return {
    month: world.month,
    rng: structuredClone(world.rng),
    countries: structuredClone(world.countries),
    experiments: world.experimentReport(),
    emergence: world.emergenceReport(),
    accounting: Object.fromEntries(world.countries.map(country => [
      country.id,
      world.accountingReport(country.id)
    ]))
  };
}

function run({ seed, scaleProfile, months, diagnostics }) {
  const world = new EconomicWorld(seed, { scaleProfile, healthCheckInterval: 0 });
  let recorder = null;
  setLaborMarketDiagnosticObserver(null);

  if (diagnostics) {
    recorder = new RealityDiagnosticRecorder(world);
    setLaborMarketDiagnosticObserver(event => recorder.recordLaborMarket(event));
  }

  try {
    for (let month = 0; month < months; month++) {
      world.stepMonth();
      if (recorder) recorder.captureMonth(world);
    }
  } finally {
    setLaborMarketDiagnosticObserver(null);
  }

  return {
    world,
    fingerprint: economicFingerprint(world),
    diagnostics: recorder?.report() || null
  };
}

function verifyScope({ seed, scaleProfile, months }) {
  const control = run({ seed, scaleProfile, months, diagnostics: false });
  const observed = run({ seed, scaleProfile, months, diagnostics: true });

  assert.deepStrictEqual(
    observed.fingerprint,
    control.fingerprint,
    `${scaleProfile}: diagnostic observer must not change RNG, economic state, cognition, accounting, or emergence outputs`
  );

  const report = observed.diagnostics;
  assert.ok(report, `${scaleProfile}: diagnostic report required`);
  assert.ok(report.gates.ok, `${scaleProfile}: diagnostic reconciliation gates must pass`);
  assert.equal(report.records.length, months * 4, `${scaleProfile}: every country-month must be captured`);
  assert.ok(report.records.some(row => row.labor.scanAttempts > 0), `${scaleProfile}: labor scan instrumentation must be active`);
  assert.ok(report.records.every(row => Number.isFinite(row.banking.creditStress)), `${scaleProfile}: actual monetary credit stress must be observed`);

  for (const row of report.records) {
    assert.equal(row.labor.stockFlowError, 0, `${scaleProfile}:${row.countryId}: labor stock-flow identity`);
    assert.ok(Math.abs(row.macro.gdpIdentityResidual) <= 1e-6, `${scaleProfile}:${row.countryId}: GDP identity residual`);
  }

  return {
    scaleProfile,
    months,
    records: report.records.length,
    exits: report.exitEvents.length,
    loanTransitions: report.loanTransitions.length,
    maxLaborFlowError: report.gates.maxLaborFlowError,
    maxGdpIdentityResidual: report.gates.maxGdpIdentityResidual,
    maxFirmExitReconciliationError: report.gates.maxFirmExitReconciliationError
  };
}

const scopes = [
  {
    seed: 'ECON-RV01-NONINTERFERENCE-COMPACT',
    scaleProfile: 'compact',
    months: Math.max(1, Number(process.env.RV01_COMPACT_MONTHS || 12))
  },
  {
    seed: 'ECON-RV01-NONINTERFERENCE-BASELINE',
    scaleProfile: 'baseline',
    months: Math.max(1, Number(process.env.RV01_BASELINE_MONTHS || 12))
  }
];

const summaries = scopes.map(verifyScope);
console.table(summaries);
console.log('Economic Lab WP-RV01 reality-diagnostics non-interference gate PASS');
