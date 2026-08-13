import assert from 'node:assert/strict';
import { EconomicWorld } from '../src/core/world-v10.js';
import { ensembleDigest, runPairedEnsemble } from '../src/research/ensemble-experiment.js';

const seeds = ['ECON-V10-ENS-A', 'ECON-V10-ENS-B'];
const treatmentSchedule = [{
  id: 'ast-productivity-treatment',
  month: 3,
  countryId: 'AST',
  kind: 'productivity_shock',
  factor: 0.68
}];
const metrics = {
  gdp: country => Number(country.macro?.gdp || 0),
  unemployment: country => Number(country.macro?.unemployment || 0),
  priceIndex: country => Number(country.macro?.priceIndex || 0),
  meanProductivity: country => {
    const firms = country.firms.filter(f => f.active !== false);
    return firms.reduce((sum, firm) => sum + Number(firm.productivity || 0), 0) / Math.max(1, firms.length);
  }
};

const config = {
  WorldClass: EconomicWorld,
  seeds,
  months: 6,
  scaleProfile: 'compact',
  treatmentSchedule,
  metrics,
  healthCheckInterval: 0
};

const result = runPairedEnsemble(config);
assert.equal(result.pairs.length, 2);
assert.equal(result.months, 6);
assert.equal(result.scaleProfile, 'compact');
assert.ok(result.allHealthy, 'all paired worlds must retain accounting and health invariants');

for (const pair of result.pairs) {
  assert.equal(pair.treatmentExperiments.applied, 1, `${pair.seed} treatment must be applied once`);
  assert.equal(pair.treatmentExperiments.pending, 0);
  assert.ok(pair.effect.AST.meanProductivity < 0, `${pair.seed} AST productivity treatment must reduce treated productivity`);
  for (const countryId of Object.keys(pair.effect)) {
    for (const value of Object.values(pair.effect[countryId])) {
      assert.ok(Number.isFinite(value), `${pair.seed}:${countryId} ensemble effect must be finite`);
    }
  }
}

const astProductivity = result.summary.find(row => row.countryId === 'AST' && row.metric === 'meanProductivity');
assert.ok(astProductivity);
assert.equal(astProductivity.n, 2);
assert.ok(astProductivity.meanEffect < 0);
assert.equal(astProductivity.negativeShare, 1);

// Full paired ensemble must be deterministic when the exact seed set and intervention are repeated.
const repeat = runPairedEnsemble(config);
assert.deepEqual(ensembleDigest(result), ensembleDigest(repeat));

console.log('Economic Lab v0.10 paired multi-seed ensemble gate PASS');
