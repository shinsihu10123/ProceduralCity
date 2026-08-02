import assert from 'node:assert/strict';
import { createMacroWorld } from '../src/v3/macro-world.js';
import { createSpatialPlan } from '../src/v3/spatial.js';
import { createContinuousWorldSimulation } from '../src/v4/world-simulation.js';

function build(seed = 'new-horizon') {
  return createContinuousWorldSimulation({
    seed,
    macroWorld: createMacroWorld({ seed, size: 96 }),
    spatial: createSpatialPlan({ seed }),
  });
}

const direct = build();
const stepped = build();
direct.advanceMonths(240);
for (let year = 0; year < 20; year += 1) stepped.advanceMonths(12);

assert.equal(direct.version, '4.0.0-continuous-world');
assert.equal(direct.month, 240);
assert.equal(direct.years, 20);
assert.deepEqual(direct.getSnapshotAtMonth(240), stepped.getSnapshotAtMonth(240), 'batch size must not change the generated history');
assert.equal(direct.getSnapshotAtMonth(0).settlement.population, 42);
assert.equal(direct.getSnapshotAtMonth(0).settlement.households, 14);
assert.equal(direct.getSnapshotAtMonth(0).settlement.buildings, 15);
assert.equal(direct.getSnapshotAtMonth(0).settlement.roads, 3);

const simulation = build('long-horizon');
simulation.advanceMonths(3600);
const snapshot = simulation.getSnapshotAtMonth(3600);

assert.equal(simulation.years, 300, 'the engine must advance beyond the removed 120-year limit');
assert.equal(snapshot.month, 3600);
assert.equal(snapshot.countries.length, 12);
assert.equal(snapshot.relations.length, 66);
assert.equal(simulation.annualSnapshots.filter(Boolean).length, 261, 'old history should use adaptive checkpoints');
assert.ok(simulation.recentSnapshots.size <= 361, 'monthly history must stay bounded');

const populationSum = snapshot.countries.reduce((total, country) => total + country.population, 0);
assert.ok(Math.abs(snapshot.world.totalPopulation - populationSum) <= snapshot.countries.length, 'world population must equal country stocks');
const exports = snapshot.countries.reduce((total, country) => total + country.exportsB, 0);
const imports = snapshot.countries.reduce((total, country) => total + country.importsB, 0);
assert.ok(Math.abs(exports - imports) < 1e-7, 'bilateral trade must conserve value');
const relationTrade = snapshot.relations.reduce((total, relation) => total + relation.tradeB, 0);
assert.ok(Math.abs(relationTrade - snapshot.world.tradeB) < 1e-7, 'world trade must equal bilateral flows');
const migrationIn = snapshot.countries.reduce((total, country) => total + country.migrationIn, 0);
const migrationOut = snapshot.countries.reduce((total, country) => total + country.migrationOut, 0);
assert.ok(Math.abs(migrationIn - migrationOut) < 1e-5, 'international migration must conserve people');

for (const country of snapshot.countries) {
  for (const key of ['population', 'gdpB', 'gdpPerCapita', 'unemploymentRate', 'inflation', 'debtRatio', 'foodSecurity', 'energySecurity', 'legitimacy']) {
    assert.ok(Number.isFinite(country[key]), `${country.name}.${key} must be finite`);
  }
  assert.ok(country.population > 0);
  assert.ok(country.gdpB > 0);
  assert.ok(country.unemploymentRate >= 0 && country.unemploymentRate <= 1);
  assert.ok(country.foodSecurity >= 0 && country.foodSecurity <= 1);
  assert.ok(country.energySecurity >= 0 && country.energySecurity <= 1);
}

for (const relation of snapshot.relations) {
  assert.ok(relation.a < relation.b);
  assert.ok(relation.trust >= 0 && relation.trust <= 1);
  assert.ok(relation.tension >= 0 && relation.tension <= 1);
  assert.ok(relation.tradeB >= 0);
  assert.ok(relation.migrationAToB >= 0 && relation.migrationBToA >= 0);
}

for (const key of ['population', 'households', 'firms', 'employed', 'housingUnits', 'buildings', 'roads', 'gdpM']) {
  assert.ok(Number.isFinite(snapshot.settlement[key]), `settlement.${key} must be finite`);
  assert.ok(snapshot.settlement[key] >= 0);
}
assert.ok(snapshot.settlement.population > 42);
assert.ok(snapshot.settlement.buildings > 15);
assert.ok(snapshot.settlement.roads > 3);
assert.ok(simulation.buildings.length >= snapshot.settlement.buildings);
assert.ok(simulation.getRecentEvents(3600, 'world', 4000).some((entry) => ['crisis', 'conflict', 'treaty', 'alliance', 'sanction'].includes(entry.type)), 'countries must create observable interactions');

const olderNonCheckpoint = simulation.getSnapshotAtMonth(261 * 12);
assert.equal(olderNonCheckpoint.month, 260 * 12, 'old scrub positions should resolve to the nearest stored checkpoint');
const visible = simulation.getVisibleState(300);
assert.equal(visible.snapshot.month, 3600);
assert.equal(visible.completedBuildings.length, snapshot.settlement.buildings);

console.log(`v4 continuous: ${simulation.years} years generated, ${snapshot.settlement.population.toLocaleString('en-US')} city residents, ${snapshot.world.totalPopulation.toLocaleString('en-US')} world population`);
