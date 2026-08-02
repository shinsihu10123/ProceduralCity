import assert from 'node:assert/strict';
import { createSettlementSimulation } from '../src/v3/simulation.js';
import { createSpatialPlan } from '../src/v3/spatial.js';

function build(seed = 'new-horizon') {
  const spatial = createSpatialPlan({ seed });
  return createSettlementSimulation({ seed, spatial });
}

const simulation = build();
const repeated = build();
const initial = simulation.getSnapshot(0);
const final = simulation.getSnapshot(120);

assert.equal(simulation.version, '3.0.0-causal-timeline');
assert.equal(simulation.snapshots.length, 121);
assert.equal(simulation.years, 120);
assert.deepEqual(simulation.snapshots, repeated.snapshots, 'timeline must be deterministic for one seed');
assert.deepEqual(
  { population: initial.population, households: initial.households, buildings: initial.buildings, roads: initial.roads },
  { population: 42, households: 14, buildings: 15, roads: 3 },
);

assert.equal(final.stage.id, 'mature');
assert.ok(final.population >= 8_500 && final.population <= 15_000);
assert.ok(final.buildings >= 150);
assert.equal(final.roads, 39);
assert.ok(final.roadLengthKm > 14 && final.roadLengthKm < 15);
assert.ok(final.housingUnits > final.households, 'mature city should retain housing headroom');
assert.ok(final.housingVacancy >= 0 && final.housingVacancy < 0.2);
assert.ok(final.jobsCapacity >= final.employed);
assert.ok(final.unemploymentRate >= 0 && final.unemploymentRate < 0.15);
assert.ok(final.gdpM > initial.gdpM * 100);
assert.ok(final.serviceCoverage >= 0.9);
assert.ok(final.utilityReliability >= 0.9);
assert.ok(final.airQuality >= 0.5);

for (let year = 0; year < simulation.snapshots.length; year += 1) {
  const snapshot = simulation.snapshots[year];
  for (const key of ['population', 'households', 'laborForce', 'employed', 'housingUnits', 'jobsCapacity', 'buildings', 'roads', 'gdpM']) {
    assert.ok(Number.isFinite(snapshot[key]), `${key} is not finite at year ${year}`);
    assert.ok(snapshot[key] >= 0, `${key} is negative at year ${year}`);
  }
  assert.ok(snapshot.unemploymentRate >= 0 && snapshot.unemploymentRate <= 1);
  assert.ok(snapshot.serviceCoverage >= 0 && snapshot.serviceCoverage <= 1);
  assert.ok(snapshot.utilityReliability >= 0 && snapshot.utilityReliability <= 1);
  if (year > 0) {
    const previous = simulation.snapshots[year - 1];
    assert.ok(snapshot.buildings >= previous.buildings, `building stock fell at year ${year}`);
    assert.ok(snapshot.roads >= previous.roads, `road stock fell at year ${year}`);
    assert.ok(Math.abs((snapshot.population - previous.population) - snapshot.flows.netChange) < 1.6, `population flow mismatch at year ${year}`);
  }
}

const archetypes = new Set(simulation.buildings.map((building) => building.archetype));
const programs = new Set(simulation.buildings.map((building) => building.program));
assert.ok(archetypes.size >= 16, 'architectural mix is too narrow');
for (const program of ['housing', 'employment', 'mixed', 'civic', 'transport', 'utility']) assert.ok(programs.has(program));
for (const building of simulation.buildings) {
  assert.ok(building.width > 0 && building.depth > 0 && building.height > 0);
  assert.ok(building.constructionStart <= building.builtYear);
  assert.ok(simulation.roads.some((road) => road.id === building.roadId));
}

const beginning = simulation.getVisibleState(0);
const middle = simulation.getVisibleState(60);
const ending = simulation.getVisibleState(120);
assert.equal(beginning.completedBuildings.length, 15);
assert.ok(middle.completedBuildings.length > beginning.completedBuildings.length);
assert.equal(ending.completedBuildings.length, final.buildings);
assert.equal(ending.roads.length, 39);
assert.ok(simulation.events.some((event) => event.type === 'milestone' && event.title.includes('성숙')));

console.log(`v3 simulation: 42 → ${final.population.toLocaleString('en-US')} people, ${final.buildings} buildings, ${final.roads} roads`);
