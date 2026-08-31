import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sourcePath = resolve(process.argv[2] || '');
const outputPath = resolve(process.argv[3] || '');
assert.ok(process.argv[2], 'Source B6 diagnostic script path is required');
assert.ok(process.argv[3], 'Output compatibility script path is required');
assert.notEqual(sourcePath, outputPath, 'Signed-stock view must be written to a separate runtime path');

const replacements = [
  ["Math.max(0, world.accounting.gl.naturalBalance(firm.id, 'inventory'))", "world.accounting.gl.naturalBalance(firm.id, 'inventory')"],
  ["Math.max(0, world.accounting.gl.naturalBalance(firm.id, 'input_inventory'))", "world.accounting.gl.naturalBalance(firm.id, 'input_inventory')"],
  ["Math.max(0, world.accounting.gl.naturalBalance(firm.id, 'wages_payable'))", "world.accounting.gl.naturalBalance(firm.id, 'wages_payable')"],
  ["Math.max(0, world.accounting.gl.naturalBalance(household.id, 'wage_receivable'))", "world.accounting.gl.naturalBalance(household.id, 'wage_receivable')"]
];

let source = readFileSync(sourcePath, 'utf8');
let count = 0;
for (const [from, to] of replacements) {
  const occurrences = source.split(from).length - 1;
  assert.equal(occurrences, 2, `Expected exactly two signed-stock replacements for ${from}; got ${occurrences}`);
  source = source.replaceAll(from, to);
  count += occurrences;
}

assert.equal(count, 8, 'B6 signed-stock compatibility replacement count changed');
writeFileSync(outputPath, source, 'utf8');
console.log('WP_RV08_R4_CU_D3D_B6_SIGNED_STOCK_VIEW', JSON.stringify({ replacements: count, sourcePath, outputPath }));
