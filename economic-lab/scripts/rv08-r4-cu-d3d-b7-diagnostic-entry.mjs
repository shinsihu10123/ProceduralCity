import assert from 'node:assert/strict';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const runnerPath = resolve(ROOT, 'economic-lab/scripts/rv08-r4-cu-d3d-b7-diagnostic-runner.mjs');
const target = process.argv[2];
assert.ok(target, 'Usage: node rv08-r4-cu-d3d-b7-diagnostic-entry.mjs <signed-b6-runtime-script>');

const source = readFileSync(runnerPath, 'utf8');
const needle = '    assert.ok(state, \\`${countryId}/${month}: goods observer has no active B7 replay\\`);';
const replacement = '    assert.ok(state, \\`\\${countryId}/\\${month}: goods observer has no active B7 replay\\`);';
const first = source.indexOf(needle);
assert.notEqual(first, -1, 'B7 entry compatibility anchor missing');
assert.equal(source.indexOf(needle, first + needle.length), -1, 'B7 entry compatibility anchor duplicated');
const patched = source.slice(0, first) + replacement + source.slice(first + needle.length);
const runtimePath = resolve(dirname(runnerPath), `rv08-r4-cu-d3d-b7-diagnostic-runner.runtime-${process.pid}-${Date.now()}.mjs`);
writeFileSync(runtimePath, patched);

console.log('WP_RV08_R4_CU_D3D_B7_ENTRY_VIEW', JSON.stringify({
  replacementCount: 1,
  templateInterpolationEscaped: true,
  canonicalSourceMutationAuthorized: false
}));

try {
  await import(pathToFileURL(runtimePath).href);
} finally {
  try {
    unlinkSync(runtimePath);
  } catch {
    // Runtime compatibility files are removed best-effort after isolated execution.
  }
}
