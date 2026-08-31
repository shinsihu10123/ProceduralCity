import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const CONTRACT_PATH = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b6-s3-long-horizon-stress-contract.json');
const inputPath = resolve(process.argv[2] || process.env.INPUT_JSON || '');
const outputPath = resolve(process.argv[3] || process.env.OUTPUT_JSON || inputPath);
const scenarioId = (process.env.S3_SCENARIO_ID || '').trim();
const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
const sourceText = readFileSync(inputPath, 'utf8');
const source = JSON.parse(sourceText);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

assert.equal(contract.schemaVersion, '1.0');
assert.equal(contract.front, 'R4-CU-D3D-B6-S3');
assert.equal(contract.status, 'FROZEN_BEFORE_LONG_HORIZON_STRESS_EXECUTION');
assert.equal(contract.canonicalMutationAuthorized, false);
assert.equal(contract.directParameterCalibrationAuthorized, false);
assert.equal(source.front, 'R4-CU-D3D-B6-S1');
assert.equal(source.schemaVersion, 'r4-cu-d3d-b6-s1-shadow-screen-v0.1');
assert.equal(source.gates?.ok, true, 'Source B6 engine and S3 scenario gate failed');
assert.ok(scenarioId, 'S3_SCENARIO_ID is required');

const validationSeeds = contract.execution.validationSeeds.map((entry) => entry.seed);
const candidateIds = contract.candidatePanel.map((entry) => entry.id);
const scenario = contract.execution.scenarios.find((entry) => entry.id === scenarioId);
assert.ok(validationSeeds.includes(source.seed), `Unauthorized S3 validation seed ${source.seed}`);
assert.ok(candidateIds.includes(source.candidate?.id), `Unauthorized S3 candidate ${source.candidate?.id}`);
assert.ok(scenario, `Unauthorized S3 scenario ${scenarioId}`);
assert.equal(source.months, contract.execution.months);
assert.equal(source.s3ScenarioValidation?.scenarioId, scenario.id);
assert.deepEqual(source.s3ScenarioValidation?.schedule, scenario.schedule);

const rowsHash = sha256(JSON.stringify(source.rows));
const summaryHash = sha256(JSON.stringify(source.summary));
const digestPairHash = sha256(JSON.stringify({ worldDigest: source.worldDigest, replayDigest: source.replayDigest }));
const sourceEngineGatesHash = sha256(JSON.stringify(source.gates));
const scenarioValidationHash = sha256(JSON.stringify(source.s3ScenarioValidation));

const gates = {
  s3ProtocolExact: contract.front === 'R4-CU-D3D-B6-S3' && contract.status === 'FROZEN_BEFORE_LONG_HORIZON_STRESS_EXECUTION',
  validationSeedAuthorized: validationSeeds.includes(source.seed),
  frozenCandidateAuthorized: candidateIds.includes(source.candidate.id),
  frozenScenarioAuthorized: Boolean(scenario),
  frozenHorizonExact: source.months === contract.execution.months,
  sourceEngineGateOk: source.gates.ok === true,
  sourceExactCanonicalReplay: source.gates.exactCanonicalReplay === true,
  sourceExactDiagnosticReplay: source.gates.exactDiagnosticReplay === true,
  sourceHardAccountingHealthy: source.gates.hardAccountingHealthy === true,
  sourceCompleteCountryMonthPanel: source.gates.completeCountryMonthPanel === true,
  sourceNoCanonicalMutation: source.gates.noCanonicalMutation === true,
  sourceScenarioScheduleExact: source.gates.s3ScenarioEventsAppliedExactly === true,
  sourceScenarioEventReplayExact: source.gates.s3ScenarioEventReplayExact === true,
  sourceScenarioIdentityExact: source.s3ScenarioValidation.scenarioId === scenario.id && source.s3ScenarioValidation.scheduleSha256 === sha256(JSON.stringify(scenario.schedule)),
  sourcePayloadHashesProduced: [rowsHash, summaryHash, digestPairHash, sourceEngineGatesHash, scenarioValidationHash].every((hash) => hash.length === 64),
  directParameterCalibrationLocked: contract.directParameterCalibrationAuthorized === false,
  canonicalMutationLocked: contract.canonicalMutationAuthorized === false
};
gates.ok = Object.values(gates).every(Boolean);

const result = {
  ...source,
  schemaVersion: 'r4-cu-d3d-b6-s3-long-horizon-stress-result-v0.1',
  front: 'R4-CU-D3D-B6-S3',
  phase: 'FROZEN_LONG_HORIZON_STRESS_VALIDATION',
  scenario: structuredClone(scenario),
  status: gates.ok ? 'PASS_AS_LONG_HORIZON_STRESS_JOB' : 'FAIL_S3_ENVELOPE_GATE',
  gates,
  sourceEngine: {
    front: source.front,
    schemaVersion: source.schemaVersion,
    status: source.status,
    seedCompatibilityGateName: 'originalSeedOnly',
    seedCompatibilityInterpretation: 'The read-only S3 compatibility view points the frozen S1 seed slot at the two S3 validation seeds and extends the frozen horizon to 36 months.',
    scenarioCompatibilityInterpretation: 'The same preregistered ExperimentSystem schedule is installed before month one in each paired world.',
    gates: source.gates,
    scenarioValidation: source.s3ScenarioValidation,
    payloadHashes: {
      rowsSha256: rowsHash,
      summarySha256: summaryHash,
      digestPairSha256: digestPairHash,
      gatesSha256: sourceEngineGatesHash,
      scenarioValidationSha256: scenarioValidationHash,
      sourceJsonSha256: sha256(sourceText)
    }
  },
  longHorizonStressProtocol: {
    path: 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b6-s3-long-horizon-stress-contract.json',
    sourceStage2ClosureCommit: contract.sourceStage2.closureCommit,
    sourceStage2RunId: contract.sourceStage2.workflowRunId,
    candidateRole: contract.candidatePanel.find((entry) => entry.id === source.candidate.id)?.role,
    scenarioRole: scenario.role,
    windows: contract.execution.windows,
    canonicalMutationAuthorized: false,
    directParameterCalibrationAuthorized: false
  },
  interpretation: {
    ...source.interpretation,
    role: 'FROZEN_LONG_HORIZON_STRESS_CAUSAL_VALIDATION_JOB',
    empiricalBands: 'EXTERNAL_VALIDATION_ONLY',
    stressMagnitudesAreCalibrationRecommendations: false,
    directParameterRecommendation: false,
    desiredConsumptionMappingAuthorized: false,
    canonicalMutationAuthorized: false
  }
};

writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log('WP_RV08_R4_CU_D3D_B6_S3_RELABEL_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CU_D3D_B6_S3_RELABEL', JSON.stringify({ candidateId: source.candidate.id, seed: source.seed, scenarioId, rowsHash, summaryHash, outputPath }));
assert.equal(gates.ok, true, `${source.candidate.id}/${source.seed}/${scenarioId}: B6-S3 relabel gate failed`);
