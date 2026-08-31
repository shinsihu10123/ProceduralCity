import assert from 'node:assert/strict';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const contractPath = resolve('economic-lab/diagnostics/reality-validation/r4-cu-d3d-post-b6-s2-next-stage-bootstrap-contract.json');
const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
const aggregatePath = resolve(process.env.S2_AGGREGATE_JSON || '');
const outputPath = resolve(process.env.ROUTE_SNAPSHOT_JSON || '/tmp/post-b6-s2-route.json');

assert.equal(contract.front, 'R4-CU-D3D-POST-B6-S2-BOOTSTRAP');
assert.equal(contract.status, 'FROZEN_PRE_EXECUTION');
assert.equal(contract.canonicalMutationAuthorized, false);
assert.equal(contract.resultDependentRetuningAuthorized, false);
assert.ok(process.env.S2_AGGREGATE_JSON, 'S2_AGGREGATE_JSON is required');

const aggregate = JSON.parse(readFileSync(aggregatePath, 'utf8'));
assert.equal(aggregate.front, contract.source.requiredFront, `Unexpected S2 front: ${aggregate.front}`);

const technicalPass =
  aggregate.technicalGates?.ok === true ||
  aggregate.gates?.ok === true ||
  aggregate.integrityGates?.ok === true ||
  String(aggregate.status || '').startsWith('PASS_') ||
  String(aggregate.status || '') === 'SUCCESS';
assert.equal(technicalPass, true, 'Authoritative B6-S2 technical aggregate did not pass');

function candidateId(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return null;
  return value.id || value.candidateId || value.candidate?.id || value.candidate?.candidateId || null;
}

function candidateArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(candidateId).filter(Boolean))];
}

const replicated = [
  ...candidateArray(aggregate.replicatedCandidates),
  ...candidateArray(aggregate.passingCandidates),
  ...candidateArray(aggregate.heldoutReplicatedCandidates),
  ...candidateArray(aggregate.finalists)
].filter((id, index, rows) => rows.indexOf(id) === index && id !== contract.s3.controlCandidateId);

const explicitCount = [
  aggregate.replicatedCandidateCount,
  aggregate.passingCandidateCount,
  aggregate.heldoutReplicatedCandidateCount
].map(Number).find(Number.isFinite);
const replicatedCount = explicitCount ?? replicated.length;
const decision = String(aggregate.decision || '').toUpperCase();
const explicitNoReplication =
  decision.includes('NO_REPLICATED') ||
  decision.includes('NO_ELIGIBLE') ||
  decision.includes('HELDOUT_FAIL') ||
  decision.includes('FAMILY_INSUFFICIENT');
const explicitReplication =
  decision.includes('REPLICATED') ||
  decision.includes('PROMOTE') ||
  decision.includes('S3');

let primary = candidateId(aggregate.primaryCandidate) ||
  candidateId(aggregate.selectedPrimaryCandidate) ||
  candidateId(aggregate.primary) ||
  replicated[0] || null;

let route;
if (explicitNoReplication || replicatedCount === 0) {
  route = 'B7';
  primary = null;
} else if (replicatedCount > 0 || explicitReplication) {
  route = 'S3';
  assert.ok(primary, 'B6-S2 indicates replication but no frozen primary candidate is identifiable');
  assert.notEqual(primary, contract.s3.controlCandidateId, 'Control cannot be the S3 primary candidate');
} else {
  throw new Error(`Ambiguous B6-S2 decision: ${aggregate.decision}`);
}

const snapshot = {
  schemaVersion: 'r4-cu-d3d-post-b6-s2-route-v0.1',
  generatedAt: new Date().toISOString(),
  aggregatePath: aggregatePath.replace(`${resolve('.')}/`, ''),
  aggregateFront: aggregate.front,
  aggregateStatus: aggregate.status,
  aggregateDecision: aggregate.decision,
  aggregateRouting: aggregate.routing,
  technicalPass,
  replicatedCandidateCount: replicatedCount,
  replicatedCandidates: replicated,
  route,
  primaryCandidateId: primary,
  controlCandidateId: contract.s3.controlCandidateId,
  longRunSeeds: contract.s3.seeds,
  longRunMonths: contract.s3.months,
  canonicalMutationAuthorized: false,
  resultDependentRetuningAuthorized: false
};

writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));

const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
  const s3Candidates = route === 'S3' ? [contract.s3.controlCandidateId, primary] : [];
  appendFileSync(githubOutput, `route=${route}\n`);
  appendFileSync(githubOutput, `primary=${primary || ''}\n`);
  appendFileSync(githubOutput, `control=${contract.s3.controlCandidateId}\n`);
  appendFileSync(githubOutput, `s3_matrix_json=${JSON.stringify({ candidate: s3Candidates, seed: contract.s3.seeds })}\n`);
  appendFileSync(githubOutput, `b7_matrix_json=${JSON.stringify({ candidate: [contract.b7.candidateId], seed: contract.b7.seeds })}\n`);
  appendFileSync(githubOutput, `months=${route === 'S3' ? contract.s3.months : contract.b7.months}\n`);
}

console.log('WP_RV08_R4_CU_D3D_POST_B6_S2_ROUTE', JSON.stringify(snapshot));
