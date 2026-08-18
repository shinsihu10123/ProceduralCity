import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';

const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const months = Math.max(12, Number(process.env.EMERGENCE_MONTHS || 24));
const scaleProfile = process.env.EMERGENCE_SCALE || 'compact';
const seeds = ['ECON-V10-EMERGE-A', 'ECON-V10-EMERGE-B', 'ECON-V10-EMERGE-C'];

function assertFiniteDeep(value, path = 'root') {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} must be finite`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFiniteDeep(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) assertFiniteDeep(child, `${path}.${key}`);
  }
}

function emergenceVector(report) {
  const values = [];
  for (const country of report.countries || []) {
    values.push(
      Number(country.gdpGrowthMean || 0),
      Number(country.gdpGrowthVolatility || 0),
      Number(country.gdpGrowthPersistence || 0),
      Number(country.gdpMaxDrawdown || 0),
      Number(country.inflationMean || 0),
      Number(country.inflationVolatility || 0),
      Number(country.unemploymentMean || 0),
      Number(country.unemploymentVolatility || 0),
      Number(country.unemploymentPersistence || 0),
      Number(country.totalFirmExits || 0)
    );
  }
  values.push(Number(report.crossCountryGrowthCorrelation || 0));
  return values;
}

function l1Distance(a, b) {
  let total = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) total += Math.abs(Number(a[i] || 0) - Number(b[i] || 0));
  return total;
}

function run(seed) {
  const world = new EconomicWorld(seed, { scaleProfile, healthCheckInterval: 0 });
  world.step(months);
  const health = world.forceHealthCheck();
  const emergence = world.emergenceReport();
  assert.ok(health.ok, `${seed}: long-run health must pass`);
  assertFiniteDeep(emergence, `${seed}.emergence`);
  assert.equal(emergence.month, months, `${seed}: emergence report month mismatch`);
  assert.equal(emergence.countries.length, 4, `${seed}: four-country emergence report required`);
  for (const country of emergence.countries) {
    assert.ok(country.observations >= months, `${seed}:${country.countryId}: insufficient observations`);
    const dynamicMagnitude =
      Math.abs(country.gdpGrowthVolatility) +
      Math.abs(country.inflationVolatility) +
      Math.abs(country.unemploymentVolatility);
    assert.ok(dynamicMagnitude > 1e-12, `${seed}:${country.countryId}: macro path is degenerate/static`);
  }
  return {
    seed,
    health,
    emergence,
    vector: emergenceVector(emergence)
  };
}

const runs = seeds.map(run);
const repeat = run(seeds[0]);
assert.deepStrictEqual(repeat.emergence, runs[0].emergence, 'same seed must reproduce the exact emergence report');

const seedDistances = [];
for (let i = 0; i < runs.length; i++) {
  for (let j = i + 1; j < runs.length; j++) {
    const distance = l1Distance(runs[i].vector, runs[j].vector);
    assert.ok(distance > 1e-10, `${runs[i].seed} and ${runs[j].seed} must not collapse to the same macro path`);
    seedDistances.push({ a: runs[i].seed, b: runs[j].seed, l1Distance: distance });
  }
}

const report = {
  schemaVersion: 1,
  kind: 'economic-lab-v10-emergence-ensemble',
  generatedAt: new Date().toISOString(),
  node: process.version,
  scaleProfile,
  months,
  seeds,
  runs: runs.map(({ seed, health, emergence }) => ({ seed, health, emergence })),
  seedDistances,
  gates: {
    healthy: true,
    finite: true,
    nonDegenerateMacroDynamics: true,
    deterministicSameSeed: true,
    distinctAcrossSeeds: true
  }
};

console.table(runs.flatMap(runRow => runRow.emergence.countries.map(country => ({
  seed: runRow.seed,
  country: country.countryId,
  growthVol: country.gdpGrowthVolatility,
  inflationVol: country.inflationVolatility,
  unemploymentVol: country.unemploymentVolatility,
  recessionMonths: country.recessionMonths,
  firmExits: country.totalFirmExits
}))));
console.table(seedDistances);
console.log(JSON.stringify(report, null, 2));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`EMERGENCE_ENSEMBLE_JSON ${outputJson}`);
}

console.log('Economic Lab v0.10 emergence ensemble gate PASS');
