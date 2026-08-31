import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const CONTRACT_PATH = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b6-input-output-working-capital-contract.json');
const target = process.argv[2];
assert.ok(target, 'Usage: node rv08-r4-cu-d3d-b6-contract-compat-runner.mjs <target-script>');

const originalReadFileSync = fs.readFileSync.bind(fs);

function frozenContractCompatibilityView(source) {
  assert.equal(source.schemaVersion, '1.0');
  assert.equal(source.front, 'R4-CU-D3D-B6-S1');
  assert.equal(source.canonicalMutationAuthorized, false);
  assert.equal(source.directParameterCalibrationAuthorized, false);
  assert.equal(source.candidates?.length, 18);
  assert.equal(source.stage1Execution?.candidateSeedJobs, 36);
  assert.equal(source.stage1Execution?.seeds?.length, 2);
  assert.equal(source.candidates.filter((entry) => entry.control === true).length, 1);

  const view = structuredClone(source);
  const controlCandidateId = source.candidates.find((entry) => entry.control === true).id;
  const originalSeeds = source.stage1Execution.seeds.map((entry) => entry.seed);
  const [labourLower, labourUpper] = source.empiricalShadowScoringBands.labourIncomeShare;
  const [consumptionLower, consumptionUpper] = source.empiricalShadowScoringBands.realizedConsumptionShare;

  // Structural aliases only. The frozen source JSON is never written or mutated.
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
    originalSeeds,
    candidateJobs: source.candidates.length,
    heldoutSeedsReservedForStage2: source.stage1Execution.heldoutSeedsReserved
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

  // Diagnostic-only compatibility: use the already-implemented B6 core EPS.
  // This does not alter any candidate, empirical band, eligibility threshold, or canonical state.
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

  // The B6 accounting identities are stock-flow bridges, so opening and closing GL
  // balances must retain their natural sign. Positive clipping hides a debit-balance
  // wage payable created when the model routes inherited worker arrears through a new
  // employer. Removing the clipping changes diagnostics only; it does not alter world
  // state, settlement, policy, prices, wages, technology or candidate values.
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
  const view = frozenContractCompatibilityView(JSON.parse(text));
  const serialized = JSON.stringify(view, null, 2);
  return encoding ? serialized : Buffer.from(serialized, 'utf8');
};

syncBuiltinESMExports();

const resolvedTarget = resolve(ROOT, target);
const rawTarget = originalReadFileSync(resolvedTarget, 'utf8');
const sourceView = signedStockReconstructionView(rawTarget, resolvedTarget);
const runtimeTarget = sourceView.replacements > 0
  ? `${resolvedTarget}.compat-${process.pid}.mjs`
  : resolvedTarget;

if (sourceView.replacements > 0) {
  fs.writeFileSync(runtimeTarget, sourceView.source, 'utf8');
  console.log('WP_RV08_R4_CU_D3D_B6_SIGNED_STOCK_VIEW', JSON.stringify({ replacements: sourceView.replacements, target }));
}

try {
  await import(pathToFileURL(runtimeTarget).href);
} finally {
  if (sourceView.replacements > 0 && fs.existsSync(runtimeTarget)) fs.unlinkSync(runtimeTarget);
  fs.readFileSync = originalReadFileSync;
  syncBuiltinESMExports();
}
