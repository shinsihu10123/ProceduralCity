import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createMacroWorld } from '../src/v3/macro-world.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const exists = (path) => access(new URL(path, root));

const index = await read('index.html');
assert.match(index, /src\/v3\/main\.js/);
assert.match(index, /src\/v3\/app\.css/);
assert.match(index, /vendor\/three\.module\.min\.js/);
assert.doesNotMatch(index, /src\/(?:main|app|world|simulation)\.js/);
assert.doesNotMatch(index, /https?:\/\//, 'runtime must not depend on third-party CDNs');
assert.match(index, /id="timeline"[^>]+max="120"/);
assert.match(index, /id="start-button"/);
assert.match(index, /id="end-button"/);
assert.match(index, /id="world-button"/);

await Promise.all([
  exists('vendor/three.module.min.js'),
  exists('vendor/three.core.min.js'),
  exists('vendor/addons/controls/OrbitControls.js'),
  exists('vendor/addons/utils/BufferGeometryUtils.js'),
  exists('vendor/addons/geometries/RoundedBoxGeometry.js'),
]);

await Promise.all([
  exists('src/v3/core.js'),
  exists('src/v3/spatial.js'),
  exists('src/v3/simulation.js'),
  exists('src/v3/geometry.js'),
  exists('src/v3/materials.js'),
  exists('src/v3/macro-view.js'),
  exists('src/v3/scene.js'),
  exists('src/v3/main.js'),
  exists('src/v3/app.css'),
]);

const world = createMacroWorld({ seed: 'new-horizon', size: 128 });
const repeated = createMacroWorld({ seed: 'new-horizon', size: 128 });
assert.equal(world.version, '3.0.0-macro-world');
assert.equal(world.size, 128);
assert.equal(world.spanKm, 3600);
assert.equal(world.countries.length, 12);
assert.equal(world.trade.length, 18);
assert.equal(world.fields.elevation.length, 128 * 128);
assert.ok(world.diagnostics.landRatio > 0.35 && world.diagnostics.landRatio < 0.55);
assert.ok(world.diagnostics.riverCells >= 100);
assert.ok(world.settlement.elevationM > 0);
assert.ok(world.settlement.countryId >= 0);
assert.deepEqual(world.diagnostics, repeated.diagnostics);
assert.deepEqual(world.settlement, repeated.settlement);
assert.deepEqual(world.countries.map((country) => country.name), repeated.countries.map((country) => country.name));

console.log(`v3 contract: offline Three.js runtime, ${world.countries.length} countries across ${world.spanKm.toLocaleString('en-US')} km`);
