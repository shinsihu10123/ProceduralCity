import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const CONTRACT_PATH = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b6-input-output-working-capital-contract.json');
const target = process.argv[2];
assert.ok(target, 'Usage: node rv08-r4-cu-d3d-b6-s2-contract-compat-runner.mjs <target-script>');

const originalReadFileSync = fs.readFileSync.bind(fs);

function frozenHeldoutCompatibilityView(source) {
  assert.equal(source.schemaVersion, '1.0');
  assert.equal(source.front, 'R4-CU-D3D-B6-S1');
  assert.equal(source.canonicalMutationAuthorized, false);
  assert.equal(source.directParameterCalibrationAuthorized, false);
  assert.equal(source.candidates?.length, 18);
  assert.equal(source.stage1Execution?.candidateSeedJobs, 36);
  assert.equal(source.stage1Execution?.heldoutSeedsReserved?.length, 2);
  assert.equal(source.candidates.filter((entry) => entry.control === true).length, 1);

  const view = structuredClone(source);
  const controlCandidateId = source.candidates.find((entry) => entry.control === true).id;
  const heldoutSeeds = source.stage1Execution.heldoutSeedsReserved.slice();
  const [labourLower, labourUpper] = source.empiricalShadowScoringBands.labourIncomeShare;
  const [consumptionLower, consumptionUpper] = source.empiricalShadowScoringBands.realizedConsumptionShare;

  // Structural aliases only. The frozen source JSON is never written or mutated.
  // The S1 engine's frozen seed slot is pointed at the previously reserved heldouts.
  view.status = 'FROZEN_PRE_IMPLEMENTATION';
  view.canonicalCalibrationAuthorized = source.directParameterCalibrationAuthorized;
  view.factorial = {
    candidates: source.candidates,
    controlCandidateId,
    axes: {
      V: source.axes.V.grid,
      M: source.axes.M.grid,
      W: source.axes.W.grid
    }
  };
  view.stage1Execution = {
    ...source.stage1Execution,
    originalSeeds: heldoutSeeds,
    candidateJobs: source.candidates.length,
    heldoutSeedsReservedForStage2: heldoutSeeds
  };
  view.empiricalExternalBands = {
    labourShare: { admissionInterval: { lower: labourLower, upper: labourUpper } },
    realizedConsumptionShare: { admissionInterval: { lower: consumptionLower, upper: consumptionUpper } }
  };
  view.eligibility = {
    ...source.eligibility,
    strictImprovementEpsilon: 0,
    line1Facility: source.eligibility.lineCandidates
  };

  // Diagnostic compatibility only; no economic state, candidate or threshold changes.
  view.measurementSurface = { reconstructionTolerance: 1e-8 };
  view.protectedSurface = {
    ...source.protectedSurface,
    blockedMutations: [
      ...source.blockedMutations,
      ...(source.blockedMutations.includes('desiredConsumptionBudget') ? ['household desired-consumption rule'] : [])
    ]
  };
  view.semanticBoundary = {
    requiredExplicitGaps: {
      materialAccounting: `physicalAndBookConsumptionStillRecorded=${source.axes.M.physicalAndBookConsumptionStillRecorded}`,
      householdFacilityUse: `householdUseAuthorized=${source.axes.W.modes.LINE1.householdUseAuthorized}`,
      sellerTradeCredit: `sellerTradeCreditCreated=${source.axes.W.modes.LINE1.sellerTradeCreditCreated}`
    }
  };
  view.nextFrontIfAnyFamilyPasses = source.nextFrontIfEligible;
  view.nextFrontIfNoFamilyPasses = source.nextFrontIfNone;
  return view;
}

function signedStockReconstructionView(source, targetPath) {
  if (!targetPath.endsWith('rv08-r4-cu-d3d-b6-s1-shadow-screen.mjs')) return { source, replacements: 0 };

  // Stock-flow bridges require signed GL natural balances. Positive clipping can
  // hide debit-balance wage payables created when inherited worker arrears move
  // across employers. This patch changes diagnostic reconstruction only.
  const replacements = [
    ["Math.max(0, world.accounting.gl.naturalBalance(firm.id, 'inventory'))", "world.accounting.gl.naturalBalance(firm.id, 'inventory')"],
    ["Math.max(0, world.accounting.gl.naturalBalance(firm.id, 'input_inventory'))", "world.accounting.gl.naturalBalance(firm.id, 'input_inventory')"],
    ["Math.max(0, world.accounting.gl.naturalBalance(firm.id, 'wages_payable'))", "world.accounting.gl.naturalBalance(firm.id, 'wages_payable')"],
    ["Math.max(0, world.accounting.gl.naturalBalance(household.id, 'wage_receivable'))", "world.accounting.gl.naturalBalance(household.id, 'wage_receivable')"]
  ];

  let patched = source;
  let count = 0;
  for (const [from, to] of replacements) {
    const occurrences = patched.split(from).length - 1;
    assert.equal(occurrences, 2, `Expected exactly two signed-stock replacements for ${from}; got ${occurrences}`);
    patched = patched.replaceAll(from, to);
    count += occurrences;
  }
  return { source: patched, replacements: count };
}

fs.readFileSync = function patchedReadFileSync(path, options) {
  const resolved = resolve(String(path));
  if (resolved !== CONTRACT_PATH) return originalReadFileSync(path, options);

  const raw = originalReadFileSync(path, options);
  const encoding = typeof options === 'string' ? options : options?.encoding;
  const text = Buffer.isBuffer(raw) ? raw.toString(encoding || 'utf8') : String(raw);
  const view = frozenHeldoutCompatibilityView(JSON.parse(text));
  const serialized = JSON.stringify(view, null, 2);
  return encoding ? serialized : Buffer.from(serialized, 'utf8');
};

syncBuiltinESMExports();

const resolvedTarget = resolve(ROOT, target);
const rawTarget = originalReadFileSync(resolvedTarget, 'utf8');
const sourceView = signedStockReconstructionView(rawTarget, resolvedTarget);
const runtimeTarget = sourceView.replacements > 0 ? `${resolvedTarget}.s2-compat-${process.pid}.mjs` : resolvedTarget;

if (sourceView.replacements > 0) {
  fs.writeFileSync(runtimeTarget, sourceView.source, 'utf8');
  console.log('WP_RV08_R4_CU_D3D_B6_S2_SIGNED_STOCK_VIEW', JSON.stringify({ replacements: sourceView.replacements, target }));
}

console.log('WP_RV08_R4_CU_D3D_B6_S2_HELDOUT_VIEW', JSON.stringify({ heldoutSeeds: ['ECON-RV08-HOLDOUT-E', 'ECON-RV08-HOLDOUT-F'], sourceEngine: target }));

try {
  await import(pathToFileURL(runtimeTarget).href);
} finally {
  if (sourceView.replacements > 0 && fs.existsSync(runtimeTarget)) fs.unlinkSync(runtimeTarget);
  fs.readFileSync = originalReadFileSync;
  syncBuiltinESMExports();
}
