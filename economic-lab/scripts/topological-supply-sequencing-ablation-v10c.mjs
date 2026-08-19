import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(here, 'topological-supply-sequencing-ablation-v10.mjs');
let source = readFileSync(sourcePath, 'utf8');

// WP-RV07-P8 instrumentation correction v10c.
// Two end-of-month reconciliation checks were invalidated by same-month firm exit:
// evaluateExits() sets desiredProduction=0 and active=false after production, while
// current-month f.output and sectorOutputs still describe production that already occurred.
// Therefore:
//   1) sector-output reconciliation includes all current-month output fields;
//   2) candidate production-bound compliance is snapshotted inside produceFirm(), before
//      any later exit-state mutation, and carried through the diagnostic stage record.
// The topological economic intervention itself is unchanged.

const replacements = [
  {
    from: "const firmOutput = sum((country.firms || []).filter(f => f.active !== false).map(f => Math.max(0, finite(f.output))));",
    to: "const firmOutput = sum((country.firms || []).map(f => Math.max(0, finite(f.output))));"
  },
  {
    from: "  function produceFirm(f, country, month, metrics) {\n    let output = Math.max(0, Math.min(f.desiredProduction, f.capacity));",
    to: "  function produceFirm(f, country, month, metrics) {\n    const productionUpperBound = Math.max(0, Math.min(f.desiredProduction, f.capacity));\n    let output = productionUpperBound;"
  },
  {
    from: "    f.output = Math.max(0, output);\n    f.inventory += f.output;",
    to: "    f.output = Math.max(0, output);\n    metrics.__rv07P8MaxProductionBoundError = Math.max(\n      0,\n      Number(metrics.__rv07P8MaxProductionBoundError || 0),\n      Math.max(0, f.output - productionUpperBound)\n    );\n    f.inventory += f.output;"
  },
  {
    from: "      b2bTransactions: 0\n    };",
    to: "      b2bTransactions: 0,\n      maxProductionBoundError: 0\n    };"
  },
  {
    from: "    stage.inputShortageUnits = metrics.inputShortageUnits;",
    to: "    stage.maxProductionBoundError = Math.max(0, Number(metrics.__rv07P8MaxProductionBoundError || 0));\n    stage.inputShortageUnits = metrics.inputShortageUnits;"
  },
  {
    from: "  const productionBoundErrors = (country.firms || []).filter(f => f.active !== false).map(f => {\n    const bound = Math.max(0, Math.min(finite(f.desiredProduction), finite(f.capacity)));\n    return Math.max(0, finite(f.output) - bound);\n  });",
    to: "  const productionBoundErrors = variant.staged ? [Math.max(0, finite(stage?.maxProductionBoundError))] : [0];"
  }
];

for (const { from, to } of replacements) {
  assert.equal(source.includes(from), true, `WP-RV07-P8 v10c correction anchor missing: ${from}`);
  source = source.replace(from, to);
}

const tempPath = resolve(here, `.rv07p8-v10c-runtime-${process.pid}.mjs`);
writeFileSync(tempPath, source, 'utf8');
try {
  await import(`${pathToFileURL(tempPath).href}?run=${Date.now()}`);
} finally {
  try { unlinkSync(tempPath); } catch {}
}
