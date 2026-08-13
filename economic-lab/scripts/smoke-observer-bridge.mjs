import assert from 'node:assert/strict';
import { EconomicWorld } from '../src/core/world-v10.js';
import { buildObserverSnapshot, OBSERVER_SCHEMA } from '../src/observer/visualization-bridge.js';

function assertFiniteObject(value, path = 'root') {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} must be finite`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) assertFiniteObject(child, `${path}.${key}`);
}

function verifyObserver(observer, expectedMonth) {
  assert.equal(observer.schema, OBSERVER_SCHEMA);
  assert.equal(observer.sourceVersion, '0.10');
  assert.equal(observer.month, expectedMonth);
  assert.equal(observer.layout.kind, 'abstract-four-country-v1');
  assert.equal(observer.layout.semanticGeography, false);
  assert.equal(observer.countries.length, 4);

  const ids = observer.countries.map(country => country.id);
  assert.deepEqual(ids, ['AST', 'BRN', 'CYR', 'DRN']);
  assert.equal(new Set(observer.countries.map(country => `${country.position.x}:${country.position.z}`)).size, 4);

  for (const country of observer.countries) {
    assert.ok(country.populationProxy > 0, `${country.id} population proxy`);
    assert.ok(country.firms.active > 0, `${country.id} active firms`);
    assert.ok(country.macro.gdp >= 0, `${country.id} GDP`);
    assert.ok(country.visual.economyScale >= 0 && country.visual.economyScale <= 1);
    assert.ok(country.visual.firmScale >= 0 && country.visual.firmScale <= 1);
    assert.ok(country.visual.industryScale >= 0 && country.visual.industryScale <= 1);
    assert.ok(country.visual.tradeActivity >= 0 && country.visual.tradeActivity <= 1);
    assert.ok(country.visual.unemployment >= 0 && country.visual.unemployment <= 1);
    assert.ok(country.visual.externalStress >= 0 && country.visual.externalStress <= 1);
    assert.ok(country.visual.crisisShare >= 0 && country.visual.crisisShare <= 1);
    assert.equal(Object.keys(country.industry.sectors).length, 4);
  }

  for (const flow of observer.flows.trade) {
    assert.notEqual(flow.from, flow.to);
    assert.ok(ids.includes(flow.from));
    assert.ok(ids.includes(flow.to));
    assert.ok(flow.worldValueWXU >= 0);
    assert.ok(flow.transactions > 0);
  }

  for (const exposure of observer.flows.foreignFunding) {
    assert.notEqual(exposure.from, exposure.to);
    assert.ok(ids.includes(exposure.from));
    assert.ok(ids.includes(exposure.to));
    assert.ok(exposure.outstandingWXU >= 0);
  }

  assert.ok(Object.isFrozen(observer));
  assert.ok(Object.isFrozen(observer.countries));
  assert.ok(Object.isFrozen(observer.countries[0]));
  assert.ok(Object.isFrozen(observer.countries[0].visual));
  assert.throws(() => {
    observer.countries[0].macro.gdp = -1;
  }, TypeError);

  assertFiniteObject(observer);
}

const seed = 'OBSERVER-3D-A1';
const world = new EconomicWorld(seed, { healthCheckInterval: 0 });
const month0Before = world.month;
const observer0 = buildObserverSnapshot(world);
assert.equal(world.month, month0Before, 'bridge must not advance the simulation');
verifyObserver(observer0, 0);

world.step(1);
const month1Before = world.month;
const observer1 = buildObserverSnapshot(world);
assert.equal(world.month, month1Before, 'bridge must remain read-only after stepping');
verifyObserver(observer1, 1);
assert.notDeepEqual(observer1.countries.map(c => c.macro.gdp), observer0.countries.map(c => c.macro.gdp));

const repeated = buildObserverSnapshot(world);
assert.deepEqual(repeated, observer1, 'same world state must produce the same observer snapshot');

const secondWorld = new EconomicWorld(seed, { healthCheckInterval: 0 });
secondWorld.step(1);
const deterministic = buildObserverSnapshot(secondWorld);
assert.deepEqual(deterministic, observer1, 'same seed and month must produce deterministic visual state');

const rawSnapshot = world.snapshot();
const fromSnapshot = buildObserverSnapshot(rawSnapshot);
assert.deepEqual(fromSnapshot, observer1, 'bridge must accept an existing world snapshot without semantic drift');

console.log('Economic Lab 3D Observer A1 data bridge smoke test passed.');
