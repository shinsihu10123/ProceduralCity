import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const PROTOCOL_PATH = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b6-s2-heldout-replication-contract.json');
const inputPath = resolve(process.argv[2] || process.env.INPUT_JSON || '');
const outputPath = resolve(process.argv[3] || process.env.OUTPUT_JSON || inputPath);
const protocol = JSON.parse(readFileSync(PROTOCOL_PATH, 'utf8'));
const sourceText = readFileSync(inputPath, 'utf8');
const source = JSON.parse(sourceText);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

assert.equal(protocol.front, 'R4-CU-D3D-B6-S2');
assert.equal(protocol.status, 'FROZEN_BEFORE_HELDOUT_EXECUTION');
assert.equal(protocol.canonicalMutationAuthorized, false);
assert.equal(protocol.directParameterCalibrationAuthorized, false);
assert.equal(source.front, 'R4-CU-D3D-B6-S1');
assert.equal(source.schemaVersion, 'r4-cu-d3d-b6-s1-shadow-screen-v0.1');
assert.equal(source.gates?.ok, true, 'Source B6-S1 engine gate failed');

const heldoutSeeds = protocol.execution.heldoutSeeds.map((entry) => entry.seed);
const candidateIds = protocol.candidatePanel.map((entry) => entry.id);
assert.ok(heldoutSeeds.includes(source.seed), `Unauthorized heldout seed ${source.seed}`);
assert.ok(candidateIds.includes(source.candidate?.id), `Unauthorized heldout candidate ${source.candidate?.id}`);

const rowsHash = sha256(JSON.stringify(source.rows));
const summaryHash = sha256(JSON.stringify(source.summary));
const digestPairHash = sha256(JSON.stringify({ worldDigest: source.worldDigest, replayDigest: source.replayDigest }));
const sourceEngineGatesHash = sha256(JSON.stringify(source.gates));

const gates = {
  s2ProtocolExact: protocol.schemaVersion === '1.0' && protocol.front === 'R4-CU-D3D-B6-S2' && protocol.status === 'FROZEN_BEFORE_HELDOUT_EXECUTION',
  heldoutSeedAuthorized: heldoutSeeds.includes(source.seed),
  frozenCandidateAuthorized: candidateIds.includes(source.candidate.id),
  sourceEngineGateOk: source.gates.ok === true,
  sourceExactCanonicalReplay: source.gates.exactCanonicalReplay === true,
  sourceExactDiagnosticReplay: source.gates.exactDiagnosticReplay === true,
  sourceHardAccountingHealthy: source.gates.hardAccountingHealthy === true,
  sourceCompleteCountryMonthPanel: source.gates.completeCountryMonthPanel === true,
  sourceNoCanonicalMutation: source.gates.noCanonicalMutation === true,
  sourcePayloadHashesProduced: [rowsHash, summaryHash, digestPairHash, sourceEngineGatesHash].every((hash) => hash.length === 64),
  directParameterCalibrationLocked: protocol.directParameterCalibrationAuthorized === false,
  canonicalMutationLocked: protocol.canonicalMutationAuthorized === false
};
gates.ok = Object.values(gates).every(Boolean);

const result = {
  ...source,
  schemaVersion: 'r4-cu-d3d-b6-s2-heldout-result-v0.1',
  front: 'R4-CU-D3D-B6-S2',
  phase: 'FROZEN_HELDOUT_REPLICATION',
  status: gates.ok ? 'PASS_AS_HELDOUT_CAUSAL_REPLICATION_JOB' : 'FAIL_HELDOUT_ENVELOPE_GATE',
  gates,
  sourceEngine: {
    front: source.front,
    schemaVersion: source.schemaVersion,
    status: source.status,
    seedCompatibilityGateName: 'originalSeedOnly',
    seedCompatibilityInterpretation: 'The read-only S2 compatibility view points the frozen S1 seed slot at the two previously reserved heldout seeds.',
    gates: source.gates,
    payloadHashes: {
      rowsSha256: rowsHash,
      summarySha256: summaryHash,
      digestPairSha256: digestPairHash,
      gatesSha256: sourceEngineGatesHash,
      sourceJsonSha256: sha256(sourceText)
    }
  },
  heldoutProtocol: {
    path: 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b6-s2-heldout-replication-contract.json',
    sourceStage1RunId: protocol.sourceStage1.workflowRunId,
    sourceStage1HeadSha: protocol.sourceStage1.headSha,
    candidateRole: protocol.candidatePanel.find((entry) => entry.id === source.candidate.id)?.role,
    canonicalMutationAuthorized: false,
    directParameterCalibrationAuthorized: false
  },
  interpretation: {
    ...source.interpretation,
    role: 'FROZEN_HELDOUT_CAUSAL_REPLICATION_JOB',
    empiricalBands: 'EXTERNAL_VALIDATION_ONLY',
    directParameterRecommendation: false,
    desiredConsumptionMappingAuthorized: false,
    canonicalMutationAuthorized: false
  }
};

writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log('WP_RV08_R4_CU_D3D_B6_S2_RELABEL_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CU_D3D_B6_S2_RELABEL', JSON.stringify({ candidateId: source.candidate.id, seed: source.seed, rowsHash, summaryHash, outputPath }));
assert.equal(gates.ok, true, `${source.candidate.id}/${source.seed}: B6-S2 relabel gate failed`);
