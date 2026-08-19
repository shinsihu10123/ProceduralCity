import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(here, 'firm-exit-diagnosis-v10.mjs');
const tempPath = resolve(here, `.firm-exit-diagnosis-safe-${process.pid}.mjs`);
let source = readFileSync(sourcePath, 'utf8');

const runsNeedle = "const runs = seeds.map(seed => runObserved(seed, months, true));\nconst windows = runs.flatMap(run => run.exitWindows);";
const runsReplacement = "const runs = seeds.map(seed => runObserved(seed, months, true));\nconst windows = runs.flatMap(run => run.exitWindows);\n// Full economic fingerprints are used only for the exact non-interference assertion above.\n// They contain complete cognitive/world state and are intentionally excluded from the serialized evidence report.\nfor (const run of runs) delete run.fingerprint;";

const logNeedle = "console.log(JSON.stringify(report, null, 2));";
const logReplacement = "console.log(JSON.stringify({ schemaVersion: report.schemaVersion, kind: report.kind, combined: report.combined, gates: report.gates }, null, 2));";

if (!source.includes(runsNeedle)) throw new Error('WP-RV04 safe runner: run-report patch point not found');
if (!source.includes(logNeedle)) throw new Error('WP-RV04 safe runner: console patch point not found');
source = source.replace(runsNeedle, runsReplacement).replace(logNeedle, logReplacement);

writeFileSync(tempPath, source, 'utf8');
let result;
try {
  result = spawnSync(process.execPath, [tempPath], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
  });
} finally {
  try { unlinkSync(tempPath); } catch {}
}

if (result.error) throw result.error;
process.exit(result.status ?? 1);
