import assert from 'node:assert/strict';
import { createDeepTimeSimulation, createPrimitiveWorld, START_CALENDAR_YEAR } from '../src/v5/prehistoric-world.js';

function build(seed = 'new-horizon') {
  const world = createPrimitiveWorld({ seed, size: 72, spanKm: 2400 });
  return createDeepTimeSimulation({ seed, world });
}

const initial = build();
assert.equal(initial.calendarYear, START_CALENDAR_YEAR);
assert.equal(initial.communities.length, 8);
assert.equal(initial.polities.length, 0, 'states must not be pre-seeded');
assert.equal(initial.world.countries.length, 0, 'the physical world must not contain preset countries');
assert.ok(initial.communities.every((community) => !community.permanent), 'every initial group must be mobile');
assert.ok(initial.cultures.every((culture) => culture.adopted === 3), 'initial knowledge must be limited to fire, stone tools and foraging');

const direct = build('deterministic-deep-time');
const stepped = build('deterministic-deep-time');
direct.advanceYears(200);
for (let year = 0; year < 200; year += 1) stepped.advanceYears(1);
assert.deepEqual(direct.latestSnapshot, stepped.latestSnapshot, 'batch size must not change the generated history');

const simulation = initial;
const observedFlows = new Set();
for (let year = 0; year < 9000; year += 1) {
  simulation.stepYear();
  simulation.flows.forEach((flow) => observedFlows.add(flow.type));
}

const snapshot = simulation.latestSnapshot;
const diagnostics = simulation.diagnostics();
assert.equal(simulation.year, 9000, 'the simulation must pass the former 120-year ceiling');
assert.equal(simulation.calendarYear, -3000);
assert.ok(snapshot.totals.population > 10_000);
assert.ok(snapshot.totals.permanentCommunities > 0, 'settlements must emerge from mobile bands');
assert.ok(snapshot.polities.length >= 2, 'multiple states must emerge endogenously');
assert.ok(snapshot.routes.length > snapshot.communities.length, 'a connected transport network must emerge');
assert.ok(snapshot.cultures.some((culture) => culture.knowledge.agriculture >= 1), 'agriculture must be adopted through simulation');
assert.ok(snapshot.cultures.some((culture) => culture.knowledge.copper >= 1), 'metallurgy must be able to emerge');
assert.ok(observedFlows.has('logistics'), 'goods movement must be represented as a visible flow');
assert.ok(observedFlows.has('traffic'), 'traffic must be represented as a visible flow');
assert.ok(observedFlows.has('migration'), 'migration must be represented as a visible flow');
assert.ok(observedFlows.has('army'), 'military movement must be represented as a visible flow');
assert.ok(simulation.events.some((event) => event.type === 'war'));
assert.ok(simulation.events.some((event) => event.type === 'battle'));
assert.ok(diagnostics.finite, 'all long-run stocks and rates must remain finite');
assert.ok(diagnostics.historyCheckpoints < 700, 'deep history must use adaptive checkpoints');
assert.equal(simulation.getSnapshotAtYear(251).year, 250, 'scrubbing should resolve to the nearest generated checkpoint');

console.log(`v5 deep time: ${snapshot.calendarLabel}, ${Math.round(snapshot.totals.population).toLocaleString('en-US')} people, ${snapshot.polities.length} emergent states, ${snapshot.routes.length} routes`);
