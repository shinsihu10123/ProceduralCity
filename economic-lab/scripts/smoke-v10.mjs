import assert from 'node:assert/strict';
import { EconomicWorld } from '../src/core/world-v10.js';

function assertAccounting(world, label) {
  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${label} health failed: ${health.failures.join(', ')}`);
  for (const country of world.countries) {
    const report = world.accountingReport(country.id);
    assert.ok(report.settlement.ok, `${label}:${country.id} settlement failed`);
    assert.ok(report.general.ok, `${label}:${country.id} SFC failed`);
    assert.ok(report.fiscal.accountingOk, `${label}:${country.id} fiscal failed`);
    assert.ok(report.monetary.accountingOk, `${label}:${country.id} monetary failed`);
    assert.ok(report.assetMarket.accountingOk, `${label}:${country.id} asset market failed`);
    assert.ok(report.international.accountingOk, `${label}:${country.id} international failed`);
  }
  assert.ok(world.globalInternationalReport().ok, `${label} global international accounting failed`);
}

function macroDigest(world) {
  return world.countries.map(country => ({
    id: country.id,
    gdp: country.macro.gdp,
    priceIndex: country.macro.priceIndex,
    unemployment: country.macro.unemployment,
    publicDebt: country.macro.publicDebt,
    policyRate: country.macro.policyRate,
    exchangeRate: country.macro.exchangeRate,
    netForeignAssetsWXU: country.macro.netForeignAssetsWXU,
    cognitiveCausalUpdates: country.macro.cognitiveCausalUpdates,
    cognitiveHypothesisTests: country.macro.cognitiveHypothesisTests
  }));
}

const baseline = new EconomicWorld('ECON-V10-BASE', {
  scaleProfile: 'baseline',
  healthCheckInterval: 0
});
assert.equal(baseline.version, '0.10');
assert.equal(baseline.initialPopulation.households, 2110);
assert.equal(baseline.initialPopulation.firms, 170);
assert.equal(baseline.countries.length, 4);
baseline.step(2);
assertAccounting(baseline, 'baseline');
assert.ok(Number.isFinite(baseline.runtime.meanStepMs));
assert.ok(baseline.runtime.measuredMonths === 2);

const x2 = new EconomicWorld('ECON-V10-SCALE-X2', {
  scaleProfile: 'x2',
  healthCheckInterval: 0
});
assert.equal(x2.initialPopulation.households, baseline.initialPopulation.households * 2);
assert.equal(x2.initialPopulation.firms, baseline.initialPopulation.firms * 2);
assert.ok(x2.initialPopulation.cognitiveAgents > baseline.initialPopulation.cognitiveAgents);
x2.step(1);
assertAccounting(x2, 'x2');
assert.ok(x2.scaleReport().runtime.lastStepMs >= 0);

// Same seed + same scale must stay identical. Runtime timing is intentionally excluded.
const deterministicA = new EconomicWorld('ECON-V10-DETERMINISM', {
  scaleProfile: 'compact',
  healthCheckInterval: 0
});
const deterministicB = new EconomicWorld('ECON-V10-DETERMINISM', {
  scaleProfile: 'compact',
  healthCheckInterval: 0
});
for (let month = 0; month < 6; month++) {
  deterministicA.step(1);
  deterministicB.step(1);
  assert.deepEqual(macroDigest(deterministicA), macroDigest(deterministicB));
}
assert.deepEqual(
  deterministicA.countries[0].firms[0].cognition.causalModel,
  deterministicB.countries[0].firms[0].cognition.causalModel
);
assert.deepEqual(
  deterministicA.countries[0].households[0].cognition.social,
  deterministicB.countries[0].households[0].cognition.social
);

// Counterfactual gate: histories must be identical before the intervention and diverge only after it.
const control = new EconomicWorld('ECON-V10-COUNTERFACTUAL', {
  scaleProfile: 'compact',
  healthCheckInterval: 0
});
const shock = new EconomicWorld('ECON-V10-COUNTERFACTUAL', {
  scaleProfile: 'compact',
  healthCheckInterval: 0,
  experimentSchedule: [{
    id: 'ast-productivity-loss',
    month: 4,
    countryId: 'AST',
    kind: 'productivity_shock',
    factor: 0.72
  }]
});

for (let month = 1; month <= 3; month++) {
  control.step(1);
  shock.step(1);
  assert.deepEqual(macroDigest(control), macroDigest(shock), `control and shock diverged before month 4 at month ${month}`);
}

const controlProductivityBefore = control.countries[0].firms
  .filter(f => f.active !== false)
  .reduce((sum, firm) => sum + firm.productivity, 0);
const shockProductivityBefore = shock.countries[0].firms
  .filter(f => f.active !== false)
  .reduce((sum, firm) => sum + firm.productivity, 0);
assert.equal(controlProductivityBefore, shockProductivityBefore);

for (let month = 4; month <= 12; month++) {
  control.step(1);
  shock.step(1);
}

const exp = shock.experimentReport();
assert.equal(exp.scheduled, 1);
assert.equal(exp.pending, 0);
assert.equal(exp.applied, 1);
const controlAST = control.countries.find(country => country.id === 'AST');
const shockAST = shock.countries.find(country => country.id === 'AST');
const controlProductivityAfter = controlAST.firms.filter(f => f.active !== false).reduce((sum, firm) => sum + firm.productivity, 0);
const shockProductivityAfter = shockAST.firms.filter(f => f.active !== false).reduce((sum, firm) => sum + firm.productivity, 0);
assert.ok(shockProductivityAfter < controlProductivityAfter, 'productivity intervention must change the treated economy');
assert.notDeepEqual(macroDigest(control), macroDigest(shock), 'treated world must diverge after the intervention');
assertAccounting(control, 'control');
assertAccounting(shock, 'shock');

// Long-run gate uses a compact population so CI can cover many months without hiding memory/accounting drift.
const longRun = new EconomicWorld('ECON-V10-LONG-RUN', {
  scaleProfile: 'compact',
  healthCheckInterval: 12,
  healthRecordLimit: 120
});
longRun.step(48);
assertAccounting(longRun, 'long-run');
const health = longRun.health.summary();
assert.ok(health.ok, 'long-run health monitor must remain clean');
assert.ok(health.checkedMonths >= 4);
assert.ok(Number.isFinite(health.meanStepMs));

const emergence = longRun.emergenceReport();
assert.equal(emergence.month, 48);
assert.equal(emergence.countries.length, 4);
assert.ok(Number.isFinite(emergence.crossCountryGrowthCorrelation));
assert.ok(Number.isFinite(emergence.meanGrowthVolatility));
assert.ok(Number.isFinite(emergence.meanInflationVolatility));
for (const country of emergence.countries) {
  assert.equal(country.observations, 49);
  for (const value of Object.values(country)) {
    if (typeof value === 'number') assert.ok(Number.isFinite(value), `${country.countryId} emergence metric must be finite`);
  }
}

const snapshot = longRun.snapshot();
assert.equal(snapshot.version, '0.10');
assert.equal(snapshot.scale.profile.id, 'compact');
assert.ok(snapshot.health.ok);
assert.equal(snapshot.emergence.month, 48);

console.log('Economic Lab v0.10 scale, counterfactual and long-run gate PASS');
