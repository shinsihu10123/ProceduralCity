import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const CONTRACT_PATH = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b6-input-output-working-capital-contract.json');
const target = process.argv[2];
assert.ok(target, 'Usage: node rv08-r4-cu-d3d-b6-next-stage-compat-runner.mjs <target-script>');

const originalReadFileSync = fs.readFileSync.bind(fs);
const overrideSeeds = String(process.env.NEXT_STAGE_SEEDS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const overrideMonths = Number(process.env.NEXT_STAGE_MONTHS || 0);

assert.ok(overrideSeeds.length > 0, 'NEXT_STAGE_SEEDS must contain at least one frozen seed');
assert.ok(Number.isInteger(overrideMonths) && overrideMonths > 12, 'NEXT_STAGE_MONTHS must be an integer greater than the B6-S1/S2 horizon');

function frozenContractCompatibilityView(source) {
  assert.equal(source.schemaVersion, '1.0');
  assert.equal(source.front, 'R4-CU-D3D-B6-S1');
  assert.equal(source.canonicalMutationAuthorized, false);
  assert.equal(source.directParameterCalibrationAuthorized, false);
  assert.equal(source.candidates?.length, 18);
  assert.equal(source.stage1Execution?.seeds?.length, 2);
  assert.equal(source.candidates.filter((entry) => entry.control === true).length, 1);

  const view = structuredClone(source);
  const controlCandidateId = source.candidates.find((entry) => entry.control === true).id;
  const [labourLower, labourUpper] = source.empiricalShadowScoringBands.labourIncomeShare;
  const [consumptionLower, consumptionUpper] = source.empiricalShadowScoringBands.realizedConsumptionShare;

  // Structural aliases and horizon/seed bindings only. The frozen source JSON is never written.
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
    originalSeeds: overrideSeeds,
    months: overrideMonths,
    candidateJobs: source.candidates.length,
    candidateSeedJobs: source.candidates.length * overrideSeeds.length,
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
try {
  await import(pathToFileURL(resolve(ROOT, target)).href);
} finally {
  fs.readFileSync = originalReadFileSync;
  syncBuiltinESMExports();
}
