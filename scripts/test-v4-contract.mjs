import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const exists = (path) => access(new URL(path, root));

const [index, engine, main] = await Promise.all([
  read('index.html'),
  read('src/v4/world-simulation.js'),
  read('src/v4/main.js'),
]);

assert.match(index, /src\/v4\/main\.js/);
assert.match(index, /src\/v4\/app\.css/);
assert.match(index, /vendor\/three\.module\.min\.js/);
assert.match(index, /id="live-button"/);
assert.match(index, /id="country-select"/);
assert.match(index, /id="relation-list"/);
assert.doesNotMatch(index, /max="120"/);
assert.doesNotMatch(index, /https?:\/\//, 'runtime must remain offline and CDN-independent');
assert.doesNotMatch(engine, /SIMULATION_YEARS/);
assert.match(engine, /advanceMonths\(count = 1\)/);
assert.match(engine, /solveTrade\(\)/);
assert.match(engine, /solveMigration\(\)/);
assert.match(main, /monthsPerSecond/);

await Promise.all([
  exists('src/v4/world-simulation.js'),
  exists('src/v4/settlement-system.js'),
  exists('src/v4/macro-view.js'),
  exists('src/v4/main.js'),
  exists('src/v4/app.css'),
  exists('vendor/three.module.min.js'),
  exists('vendor/addons/controls/OrbitControls.js'),
]);

console.log('v4 contract: unbounded generated history, observable country interactions, offline Three.js runtime');
