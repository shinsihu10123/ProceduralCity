import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { EconomicWorld } from '../src/core/world-v10.js';
import { ExperimentSystem } from '../src/research/experiment-system.js';

const ROOT = process.cwd();
const SOURCE_CONTRACT_PATH = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b6-input-output-working-capital-contract.json');
const S3_CONTRACT_PATH = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b6-s3-long-horizon-stress-contract.json');
const target = process.argv[2];
const scenarioId = (process.env.S3_SCENARIO_ID || '').trim();
const outputPath = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;

assert.ok(target, 'Usage: node rv08-r4-cu-d3d-b6-s3-contract-compat-runner.mjs <target-script>');
assert.ok(scenarioId, 'S3_SCENARIO_ID is required');

const originalReadFileSync = fs.readFileSync.bind(fs);
const originalWriteFileSync = fs.writeFileSync.bind(fs);
const originalStepMonth = EconomicWorld.prototype.stepMonth;
const s3Contract = JSON.parse(originalReadFileSync(S3_CONTRACT_PATH, 'utf8'));
const scenario = s3Contract.execution.scenarios.find((entry) => entry.id === scenarioId);
const candidateIds = s3Contract.candidatePanel.map((entry) => entry.id);
const validationSeeds = s3Contract.execution.validationSeeds.map((entry) => entry.seed);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

assert.equal(s3Contract.schemaVersion, '1.0');
assert.equal(s3Contract.front, 'R4-CU-D3D-B6-S3');
assert.equal(s3Contract.status, 'FROZEN_BEFORE_LONG_HORIZON_STRESS_EXECUTION');
assert.equal(s3Contract.canonicalMutationAuthorized, false);
assert.equal(s3Contract.directParameterCalibrationAuthorized, false);
assert.ok(scenario, `Unknown S3 scenario ${scenarioId}`);
assert.deepEqual(candidateIds, ['V1_M1_C42', 'V24_M16_C42']);
assert.equal(s3Contract.sourceStage2.primaryCandidateId, 'V24_M16_C42');
assert.equal(s3Contract.execution.months, 36);
assert.equal(s3Contract.execution.candidateSeedScenarioJobs, 12);

function frozenContractCompatibilityView(source) {
  assert.equal(source.schemaVersion, '1.0');
  assert.equal(source.front, 'R4-CU-D3D-B6-S1');
  assert.equal(source.canonicalMutationAuthorized, false);
  assert.equal(source.directParameterCalibrationAuthorized, false);
  assert.equal(source.candidates?.length, 18);

  const candidates = candidateIds.map((id) => {
    const candidate = source.candidates.find((entry) => entry.id === id);
    assert.ok(candidate, `S3 candidate missing from frozen S1 family: ${id}`);
    return candidate;
  });
  const controlCandidateId = candidates.find((entry) => entry.control === true)?.id;
  const [labourLower, labourUpper] = source.empiricalShadowScoringBands.labourIncomeShare;
  const [consumptionLower, consumptionUpper] = source.empiricalShadowScoringBands.realizedConsumptionShare;
  const view = structuredClone(source);

  view.status = 'FROZEN_PRE_IMPLEMENTATION';
  view.canonicalCalibrationAuthorized = source.directParameterCalibrationAuthorized;
  view.factorial = {
    candidates,
    controlCandidateId,
    axes: {
      V: source.axes.V.grid,
      M: source.axes.M.grid,
      W: source.axes.W.grid
    }
  };
  view.stage1Execution = {
    ...source.stage1Execution,
    originalSeeds: validationSeeds,
    months: s3Contract.execution.months,
    scaleProfile: s3Contract.execution.scaleProfile,
    candidateJobs: candidates.length,
    candidateSeedJobs: s3Contract.execution.candidateSeedScenarioJobs,
    heldoutSeedsReservedForStage2: source.stage1Execution.heldoutSeedsReserved
  };
  view.empiricalExternalBands = {
    labourShare: { admissionInterval: { lower: labourLower, upper: labourUpper } },
    realizedConsumptionShare: { admissionInterval: { lower: consumptionLower, upper: consumptionUpper } }
  };
  view.eligibility = {
    ...source.eligibility,
    strictImprovementEpsilon: s3Contract.eligibility.strictImprovementEpsilon,
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
  view.nextFrontIfAnyFamilyPasses = s3Contract.nextFrontIfPass;
  view.nextFrontIfNoFamilyPasses = s3Contract.nextFrontIfFail;
  return view;
}

const shadowRecords = [];
const recordByWorld = new WeakMap();

function shadowRecord(world) {
  let record = recordByWorld.get(world);
  if (!record) {
    record = { candidateId: world.__r4CuD3dB6Candidate?.id || null, events: [], summary: null };
    recordByWorld.set(world, record);
    shadowRecords.push(record);
  }
  return record;
}

EconomicWorld.prototype.stepMonth = function patchedS3StepMonth(...args) {
  if (this.__r4CuD3dB6S3ScenarioInstalled !== scenario.id) {
    this.experiments = new ExperimentSystem({ schedule: structuredClone(scenario.schedule) });
    Object.defineProperty(this, '__r4CuD3dB6S3ScenarioInstalled', {
      value: scenario.id,
      enumerable: false,
      configurable: true,
      writable: false
    });
  }

  const output = originalStepMonth.apply(this, args);
  if (this.__r4CuD3dB6Candidate) {
    const record = shadowRecord(this);
    record.events.push(...structuredClone(this.lastExperimentEvents || []));
    record.summary = this.experimentReport();
  }
  return output;
};

fs.readFileSync = function patchedReadFileSync(path, options) {
  const resolved = resolve(String(path));
  if (resolved !== SOURCE_CONTRACT_PATH) return originalReadFileSync(path, options);

  const raw = originalReadFileSync(path, options);
  const encoding = typeof options === 'string' ? options : options?.encoding;
  const text = Buffer.isBuffer(raw) ? raw.toString(encoding || 'utf8') : String(raw);
  const view = frozenContractCompatibilityView(JSON.parse(text));
  const serialized = JSON.stringify(view, null, 2);
  return encoding ? serialized : Buffer.from(serialized, 'utf8');
};

fs.writeFileSync = function patchedWriteFileSync(path, data, options) {
  const resolved = resolve(String(path));
  if (!outputPath || resolved !== outputPath) return originalWriteFileSync(path, data, options);

  const encoding = typeof options === 'string' ? options : options?.encoding;
  const text = Buffer.isBuffer(data) ? data.toString(encoding || 'utf8') : String(data);
  const result = JSON.parse(text);
  const countryCount = new Set((result.rows || []).map((row) => row.countryId)).size;
  const expectedEventRows = scenario.schedule.length * countryCount;
  const scheduleById = new Map(scenario.schedule.map((event) => [event.id, event]));
  const scheduleSha256 = sha256(JSON.stringify(scenario.schedule));
  const recordsExactCount = shadowRecords.length === 2;
  const first = shadowRecords[0] || { events: [], summary: null };
  const second = shadowRecords[1] || { events: [], summary: null };
  const eventLogsExact = JSON.stringify(first.events) === JSON.stringify(second.events);

  const eventShapeExact = [first, second].every((record) => {
    if (record.events.length !== expectedEventRows) return false;
    if (!record.events.every((row) => {
      const spec = scheduleById.get(row.id);
      return Boolean(spec) && row.month === spec.month && row.kind === spec.kind;
    })) return false;
    return scenario.schedule.every((spec) => record.events.filter((row) => row.id === spec.id).length === countryCount);
  });
  const summariesExact = [first, second].every((record) =>
    record.summary?.scheduled === scenario.schedule.length &&
    record.summary?.applied === expectedEventRows &&
    record.summary?.pending === 0
  );
  const baselineNoEvents = scenario.schedule.length !== 0 || [first, second].every((record) => record.events.length === 0);
  const shockMonthExact = scenario.schedule.every((event) => event.month === s3Contract.execution.shockMonth);
  const candidateRecordsExact = shadowRecords.every((record) => record.candidateId === result.candidate?.id);

  const scenarioValidation = {
    scenarioId: scenario.id,
    scenarioRole: scenario.role,
    schedule: structuredClone(scenario.schedule),
    scheduleSha256,
    countryCount,
    expectedEventRows,
    firstReplayEventRows: first.events.length,
    secondReplayEventRows: second.events.length,
    recordsExactCount,
    candidateRecordsExact,
    eventLogsExact,
    eventShapeExact,
    summariesExact,
    baselineNoEvents,
    shockMonthExact,
    firstExperimentSummary: first.summary,
    secondExperimentSummary: second.summary
  };

  const { ok: sourceOk, ...sourceGates } = result.gates || {};
  const gates = {
    ...sourceGates,
    sourceEngineGateOk: sourceOk === true,
    s3ContractExact: s3Contract.front === 'R4-CU-D3D-B6-S3' && s3Contract.status === 'FROZEN_BEFORE_LONG_HORIZON_STRESS_EXECUTION',
    s3CandidateAuthorized: candidateIds.includes(result.candidate?.id),
    s3ValidationSeedAuthorized: validationSeeds.includes(result.seed),
    s3FrozenHorizon: result.months === s3Contract.execution.months,
    s3ScenarioRegistered: Boolean(scenario),
    s3ScenarioRecordsExact: recordsExactCount && candidateRecordsExact,
    s3ScenarioScheduleHashProduced: scheduleSha256.length === 64,
    s3ScenarioEventsAppliedExactly: eventShapeExact && summariesExact,
    s3ScenarioEventReplayExact: eventLogsExact,
    s3BaselineNoEvents: baselineNoEvents,
    s3ShockMonthExact: shockMonthExact,
    s3CanonicalMutationLocked: s3Contract.canonicalMutationAuthorized === false && s3Contract.directParameterCalibrationAuthorized === false
  };
  gates.ok = Object.values(gates).every(Boolean);
  assert.equal(gates.ok, true, `${result.candidate?.id}/${result.seed}/${scenario.id}: B6-S3 scenario integrity gate failed`);

  result.gates = gates;
  result.status = 'PASS_AS_CAUSAL_SHADOW_SCREEN_WITH_S3_STRESS_SCHEDULE';
  result.s3ScenarioValidation = scenarioValidation;
  result.interpretation = {
    ...result.interpretation,
    scenarioRole: 'PREREGISTERED_LONG_HORIZON_STRESS_PATH',
    scenarioValuesAreCalibratedParameters: false,
    canonicalMutationAuthorized: false
  };
  return originalWriteFileSync(path, JSON.stringify(result, null, 2), options);
};

syncBuiltinESMExports();

try {
  await import(pathToFileURL(resolve(ROOT, target)).href);
} finally {
  EconomicWorld.prototype.stepMonth = originalStepMonth;
  fs.readFileSync = originalReadFileSync;
  fs.writeFileSync = originalWriteFileSync;
  syncBuiltinESMExports();
}
