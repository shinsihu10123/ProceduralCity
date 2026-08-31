import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sourcePath = resolve(process.argv[2] || '');
const outputPath = resolve(process.argv[3] || '');
assert.ok(process.argv[2], 'Source B6 diagnostic script path is required');
assert.ok(process.argv[3], 'Output compatibility script path is required');
assert.notEqual(sourcePath, outputPath, 'Diagnostic compatibility view must be written to a separate runtime path');

const signedStockReplacements = [
  ["Math.max(0, world.accounting.gl.naturalBalance(firm.id, 'inventory'))", "world.accounting.gl.naturalBalance(firm.id, 'inventory')"],
  ["Math.max(0, world.accounting.gl.naturalBalance(firm.id, 'input_inventory'))", "world.accounting.gl.naturalBalance(firm.id, 'input_inventory')"],
  ["Math.max(0, world.accounting.gl.naturalBalance(firm.id, 'wages_payable'))", "world.accounting.gl.naturalBalance(firm.id, 'wages_payable')"],
  ["Math.max(0, world.accounting.gl.naturalBalance(household.id, 'wage_receivable'))", "world.accounting.gl.naturalBalance(household.id, 'wage_receivable')"]
];
const scenarioAxisReplacement = [
  'const expectedProductivity = tag.baseProductivity * tag.productivityFactor;',
  'const expectedProductivity = tag.baseProductivity * tag.productivityFactor * finite(firm.__r4CuD3dB6S3ExpectedProductivityFactor, 1);'
];

let source = readFileSync(sourcePath, 'utf8');
let signedStockCount = 0;
for (const [from, to] of signedStockReplacements) {
  const occurrences = source.split(from).length - 1;
  assert.equal(occurrences, 2, `Expected exactly two signed-stock replacements for ${from}; got ${occurrences}`);
  source = source.replaceAll(from, to);
  signedStockCount += occurrences;
}

const [axisFrom, axisTo] = scenarioAxisReplacement;
const scenarioAxisCount = source.split(axisFrom).length - 1;
assert.equal(scenarioAxisCount, 1, `Expected one scenario-aware terminal-axis replacement; got ${scenarioAxisCount}`);
source = source.replace(axisFrom, axisTo);

assert.equal(signedStockCount, 8, 'B6 signed-stock compatibility replacement count changed');
writeFileSync(outputPath, source, 'utf8');
console.log('WP_RV08_R4_CU_D3D_B6_DIAGNOSTIC_VIEW', JSON.stringify({
  signedStockReplacements: signedStockCount,
  scenarioAxisReplacements: scenarioAxisCount,
  sourcePath,
  outputPath
}));
