import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const exists = (path) => access(new URL(path, root));

const [index, main, engine, scene, css] = await Promise.all([
  read('index.html'),
  read('src/v5/main.js'),
  read('src/v5/prehistoric-world.js'),
  read('src/v5/unified-scene.js'),
  read('src/v5/app.css'),
]);

assert.match(index, /src\/v5\/main\.js/);
assert.match(index, /src\/v5\/app\.css/);
assert.match(index, /vendor\/three\.module\.min\.js/);
assert.match(index, /기원전 12,000년/);
assert.match(index, /물류/);
assert.match(index, /교통/);
assert.match(index, /이주/);
assert.match(index, /군대·전투/);
assert.doesNotMatch(index, /world-button|정착지.*세계|세계.*정착지/, 'there must be no split-map toggle');
assert.doesNotMatch(index, /https?:\/\//, 'runtime must remain offline and CDN-independent');
assert.match(engine, /START_CALENDAR_YEAR = -12000/);
assert.match(engine, /advanceYears\(count = 1\)/);
assert.match(engine, /leastCostPath/);
assert.match(engine, /type: 'logistics'/);
assert.match(engine, /type: 'migration'/);
assert.match(engine, /type: 'army'/);
assert.match(scene, /single-continuous-terrain/);
assert.match(scene, /all-settlements-one-space/);
assert.match(scene, /visible-movement-flows/);
assert.match(scene, /visible-battles/);
assert.match(scene, /oneScene: true/);
assert.doesNotMatch(main, /setMode|macroLayer|mode = 'world'/);
assert.match(main, /yearsPerSecond/);
assert.match(css, /@media \(max-width: 520px\)/);

await Promise.all([
  exists('src/v5/prehistoric-world.js'),
  exists('src/v5/unified-scene.js'),
  exists('src/v5/main.js'),
  exists('src/v5/app.css'),
  exists('vendor/three.module.min.js'),
  exists('vendor/addons/controls/OrbitControls.js'),
]);

console.log('v5 contract: prehistoric origin, one continuous world, visible logistics/traffic/migration/war, offline Three.js runtime');
