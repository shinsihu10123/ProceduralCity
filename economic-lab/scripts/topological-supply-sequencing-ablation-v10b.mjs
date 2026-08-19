import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(here, 'topological-supply-sequencing-ablation-v10.mjs');
let source = readFileSync(sourcePath, 'utf8');

// WP-RV07-P8 instrumentation correction:
// sectorOutputs records all firms that produced during the month. A firm may then exit
// later in the same monthly step, so end-of-step active-state filtering incorrectly drops
// that firm's already-produced output from the reconciliation side of the hard gate.
// The economic intervention is unchanged; only the diagnostic reconciliation population
// is corrected to include every firm whose current-month output field is present.
const replacements = [
  {
    from: "const firmOutput = sum((country.firms || []).filter(f => f.active !== false).map(f => Math.max(0, finite(f.output))));",
    to: "const firmOutput = sum((country.firms || []).map(f => Math.max(0, finite(f.output))));"
  },
  {
    from: "const productionBoundErrors = (country.firms || []).filter(f => f.active !== false).map(f => {",
    to: "const productionBoundErrors = (country.firms || []).map(f => {"
  }
];

for (const { from, to } of replacements) {
  assert.equal(source.includes(from), true, `WP-RV07-P8 correction anchor missing: ${from}`);
  source = source.replace(from, to);
}

const tempPath = resolve(here, `.rv07p8-corrected-runtime-${process.pid}.mjs`);
writeFileSync(tempPath, source, 'utf8');
try {
  await import(`${pathToFileURL(tempPath).href}?run=${Date.now()}`);
} finally {
  try { unlinkSync(tempPath); } catch {}
}
