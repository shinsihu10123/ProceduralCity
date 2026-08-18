import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { setLaborMarketDiagnosticObserver } from '../src/markets/labor-market.js';
import { RealityDiagnosticRecorder } from '../src/research/reality-diagnostics.js';

const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const scaleProfile = process.env.DIAG_SCALE || process.argv[2] || 'compact';
const months = Math.max(1, Number(process.env.DIAG_MONTHS || process.argv[3] || 12));
const seedText = process.env.DIAG_SEEDS || process.argv.slice(4).join(',') || 'ECON-RV01-DIAG-A';
const seeds = seedText.split(',').map(seed => seed.trim()).filter(Boolean);

function run(seed) {
  const world = new EconomicWorld(seed, { scaleProfile, healthCheckInterval: 0 });
  const recorder = new RealityDiagnosticRecorder(world);
  setLaborMarketDiagnosticObserver(event => recorder.recordLaborMarket(event));
  try {
    for (let month = 0; month < months; month++) {
      world.stepMonth();
      recorder.captureMonth(world);
    }
  } finally {
    setLaborMarketDiagnosticObserver(null);
  }

  const health = world.forceHealthCheck();
  const diagnostics = recorder.report();
  assert.ok(health.ok, `${seed}: v0.10 health gate must pass`);
  assert.ok(diagnostics.gates.ok, `${seed}: diagnostic reconciliation gates must pass`);
  assert.equal(diagnostics.records.length, months * 4, `${seed}: every country-month must be recorded`);

  return {
    seed,
    health,
    diagnostics,
    emergence: world.emergenceReport(),
    scale: world.scaleReport()
  };
}

const runs = seeds.map(run);
const report = {
  schemaVersion: 1,
  kind: 'economic-lab-reality-diagnostic-suite',
  scaleProfile,
  months,
  seeds,
  runs,
  gates: {
    allHealthy: runs.every(run => run.health.ok),
    allDiagnosticsReconciled: runs.every(run => run.diagnostics.gates.ok),
    completeCountryMonthCoverage: runs.every(run => run.diagnostics.records.length === months * 4)
  }
};
report.gates.ok = Object.values(report.gates).every(Boolean);

console.table(runs.flatMap(run => run.diagnostics.records
  .filter(row => row.month === months)
  .map(row => ({
    seed: run.seed,
    country: row.countryId,
    unemployment: row.macro.unemployment,
    jobFindingRate: row.labor.jobFindingRate,
    separationRate: row.labor.separationRate,
    vacancies: row.labor.vacancies,
    exits: row.firms.newExits,
    creditStress: row.banking.creditStress,
    gdpResidual: row.macro.gdpIdentityResidual
  }))));
console.log(JSON.stringify(report, null, 2));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`REALITY_DIAGNOSTICS_JSON ${outputJson}`);
}

console.log('Economic Lab reality diagnostic suite PASS');
