import assert from 'node:assert/strict';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const runnerPath = resolve(ROOT, 'economic-lab/scripts/rv08-r4-cu-d3d-b7-diagnostic-runner.mjs');
const target = process.argv[2];
assert.ok(target, 'Usage: node rv08-r4-cu-d3d-b7-diagnostic-entry.mjs <signed-b6-runtime-script>');

function replaceExactlyOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  assert.notEqual(first, -1, `B7 entry compatibility anchor missing: ${label}`);
  assert.equal(source.indexOf(needle, first + needle.length), -1, `B7 entry compatibility anchor duplicated: ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

let patched = readFileSync(runnerPath, 'utf8');
patched = replaceExactlyOnce(
  patched,
  '    assert.ok(state, \\`${countryId}/${month}: goods observer has no active B7 replay\\`);',
  '    assert.ok(state, \\`\\${countryId}/\\${month}: goods observer has no active B7 replay\\`);',
  'template-interpolation-escape'
);

patched = replaceExactlyOnce(
  patched,
`  const observation = observer.finish(source);
  const scenario = contract.execution.scenarios.find((entry) => entry.id === scenarioId);`,
`  const observation = observer.finish(source);
  const signedGvaByKey = new Map((source.rows || []).map((row) => [String(row.countryId) + '@@' + String(row.month), row]));
  for (const row of observation.rows) {
    const signed = signedGvaByKey.get(String(row.countryId) + '@@' + String(row.month));
    assert.ok(signed, 'B7 signed-stock source row missing for ' + row.countryId + '/' + row.month);
    const signedProduction = Number(signed.gvaBasicProduction);
    const signedIncome = Number(signed.gvaBasicIncome);
    const signedResidual = Number(signed.gvaApproachResidual);
    assert.ok([signedProduction, signedIncome, signedResidual].every(Number.isFinite),
      'B7 signed-stock GVA source fields are non-finite for ' + row.countryId + '/' + row.month);
    row.closing = {
      ...row.closing,
      gvaBasicProduction: signedProduction,
      gvaBasicIncome: signedIncome,
      gvaApproachResidual: signedResidual,
      nonPositiveGva: signedProduction <= 1e-9
    };
    row.gvaBridge = {
      source: 'B6_SIGNED_STOCK_VALIDATED_RECONSTRUCTION',
      sourceGvaBasicProduction: signedProduction,
      sourceGvaBasicIncome: signedIncome,
      sourceGvaApproachResidual: signedResidual,
      canonicalSourceMutationAuthorized: false
    };
  }
  observation.rowsSha256 = sha256(JSON.stringify(observation.rows));
  const aggregateGva = observation.rows.reduce((total, row) => total + Number(row.closing?.gvaBasicProduction || 0), 0);
  const aggregateLabour = observation.rows.reduce((total, row) => total + Number(row.closing?.labourCompensationAccrued || 0), 0);
  observation.summary = {
    ...observation.summary,
    gvaBasicProduction: aggregateGva,
    labourCompensationAccrued: aggregateLabour,
    labourShareOfPositiveAggregateGva: aggregateGva > 1e-9 ? aggregateLabour / aggregateGva : null,
    nonPositiveGvaCountryMonthShare: observation.rows.length
      ? observation.rows.filter((row) => row.closing?.nonPositiveGva === true).length / observation.rows.length
      : 0,
    gvaBridgeSource: 'B6_SIGNED_STOCK_VALIDATED_RECONSTRUCTION'
  };
  const scenario = contract.execution.scenarios.find((entry) => entry.id === scenarioId);`,
  'signed-stock-gva-bridge'
);

const runtimePath = resolve(dirname(runnerPath), `rv08-r4-cu-d3d-b7-diagnostic-runner.runtime-${process.pid}-${Date.now()}.mjs`);
writeFileSync(runtimePath, patched);

console.log('WP_RV08_R4_CU_D3D_B7_ENTRY_VIEW', JSON.stringify({
  replacementCount: 2,
  templateInterpolationEscaped: true,
  signedStockGvaBridgeInstalled: true,
  bridgeSource: 'B6_SIGNED_STOCK_VALIDATED_RECONSTRUCTION',
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
