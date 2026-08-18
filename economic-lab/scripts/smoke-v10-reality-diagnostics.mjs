import assert from 'node:assert/strict';
import { EconomicWorld } from '../src/core/world-v10.js';
import { setLaborMarketDiagnosticObserver } from '../src/markets/labor-market.js';
import { setGoodsMarketDiagnosticObserver } from '../src/markets/goods-market.js';
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
  const goodsEvents = [];
  setLaborMarketDiagnosticObserver(null);
  setGoodsMarketDiagnosticObserver(null);

  if (diagnostics) {
    recorder = new RealityDiagnosticRecorder(world);
    setLaborMarketDiagnosticObserver(event => recorder.recordLaborMarket(event));
    setGoodsMarketDiagnosticObserver(event => goodsEvents.push(structuredClone(event)));
  }

  try {
    for (let month = 0; month < months; month++) {
      world.stepMonth();
      if (recorder) recorder.captureMonth(world);
    }
  } finally {
    setLaborMarketDiagnosticObserver(null);
    setGoodsMarketDiagnosticObserver(null);
  }

  return {
    world,
    fingerprint: economicFingerprint(world),
    diagnostics: recorder?.report() || null,
    goodsEvents
  };
}

function verifyScope({ seed, scaleProfile, months }) {
  const control = run({ seed, scaleProfile, months, diagnostics: false });
  const observed = run({ seed, scaleProfile, months, diagnostics: true });

  assert.deepStrictEqual(
    observed.fingerprint,
    control.fingerprint,
    `${scaleProfile}: diagnostic observers must not change RNG, economic state, cognition, accounting, or emergence outputs`
  );

  const report = observed.diagnostics;
  assert.ok(report, `${scaleProfile}: diagnostic report required`);
  assert.ok(report.gates.ok, `${scaleProfile}: diagnostic reconciliation gates must pass`);
  assert.equal(report.records.length, months * 4, `${scaleProfile}: every country-month must be captured`);
  assert.equal(observed.goodsEvents.length, months * 4, `${scaleProfile}: every country-month goods clearing must be observed`);
  assert.ok(report.records.some(row => row.labor.scanAttempts > 0), `${scaleProfile}: labor scan instrumentation must be active`);
  assert.ok(report.records.every(row => Number.isFinite(row.banking.creditStress)), `${scaleProfile}: actual monetary credit stress must be observed`);
  assert.ok(observed.goodsEvents.some(event => event.result.desiredBudget > 0), `${scaleProfile}: goods desired-budget instrumentation must be active`);

  for (const event of observed.goodsEvents) {
    assert.ok(Number.isFinite(event.diagnostics.initialInventoryUnits), `${scaleProfile}:${event.countryId}: goods initial inventory must be finite`);
    assert.ok(Number.isFinite(event.diagnostics.initialInventoryValue), `${scaleProfile}:${event.countryId}: goods initial inventory value must be finite`);
    assert.ok(Number.isFinite(event.diagnostics.endInventoryUnits), `${scaleProfile}:${event.countryId}: goods end inventory must be finite`);
    assert.ok(event.diagnostics.initialEligibleSellers >= event.diagnostics.endEligibleSellers, `${scaleProfile}:${event.countryId}: household clearing cannot create eligible sellers`);
    assert.ok(event.diagnostics.initialInventoryUnits + 1e-9 >= event.diagnostics.endInventoryUnits, `${scaleProfile}:${event.countryId}: household clearing cannot create inventory`);
    assert.ok(Math.abs(event.result.desiredBudget - event.result.nominalConsumption - event.result.unmetBudget) <= 1e-6, `${scaleProfile}:${event.countryId}: goods budget identity`);
  }

  for (const row of report.records) {
    assert.equal(row.labor.stockFlowError, 0, `${scaleProfile}:${row.countryId}: labor stock-flow identity`);
    assert.ok(Math.abs(row.macro.gdpIdentityResidual) <= 1e-6, `${scaleProfile}:${row.countryId}: GDP identity residual`);
  }

  return {
    scaleProfile,
    months,
    records: report.records.length,
    goodsEvents: observed.goodsEvents.length,
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
