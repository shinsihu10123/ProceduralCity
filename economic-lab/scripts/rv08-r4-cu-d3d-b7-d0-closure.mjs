import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const CONTRACT_PATH = resolve(
  ROOT,
  'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b7-d0-sequenced-mixed-causal-contract.json'
);
const gatePath = resolve(
  process.argv[2] ||
    process.env.GATE_JSON ||
    'economic-lab/diagnostics/reality-validation/evidence/r4-cu-d3d-b7-d0-preregistration-gate.json'
);
const outputPath = resolve(
  process.argv[3] ||
    process.env.OUTPUT_MD ||
    'economic-lab/diagnostics/reality-validation/WP-RV08_R4_CU_D3D_B7_D0_CLOSURE_v0.1.md'
);
const sourceRunId = process.env.SOURCE_RUN_ID || process.env.GITHUB_RUN_ID || 'UNKNOWN';
const sourceHeadSha = process.env.SOURCE_HEAD_SHA || process.env.GITHUB_SHA || 'UNKNOWN';
const sourceRunUrl =
  process.env.SOURCE_RUN_URL ||
  (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && sourceRunId !== 'UNKNOWN'
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${sourceRunId}`
    : 'UNKNOWN');
const generatedAt = new Date().toISOString();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const contractText = readFileSync(CONTRACT_PATH, 'utf8');
const contract = JSON.parse(contractText);
const gateText = readFileSync(gatePath, 'utf8');
const gate = JSON.parse(gateText);

assert.equal(contract.schemaVersion, '1.0');
assert.equal(contract.front, 'R4-CU-D3D-B7-D0');
assert.equal(contract.status, 'FROZEN_BEFORE_SEQUENCED_CHILD_EXECUTION');
assert.equal(gate.schemaVersion, 'r4-cu-d3d-b7-d0-preregistration-gate-v0.1');
assert.equal(gate.front, contract.front);
assert.equal(gate.status, 'PASS_FROZEN_SEQUENCED_MIXED_CAUSAL_PREREGISTRATION');
assert.equal(gate.gates?.ok, true);
assert.equal(gate.sourceB7?.decision, 'MIXED');
assert.equal(
  gate.nextAuthorizedFront,
  'R4-CU-D3D-B7-D1 supplier-topology and reachable-inventory causal isolation'
);
assert.equal(contract.canonicalMutationAuthorized, false);
assert.equal(contract.directParameterCalibrationAuthorized, false);
assert.equal(contract.candidateRetuningAuthorized, false);
assert.equal(gate.interpretation?.causalConclusionReached, false);
assert.equal(gate.interpretation?.canonicalMutationAuthorized, false);

const gateRows = Object.entries(gate.gates || {})
  .filter(([key]) => key !== 'ok')
  .map(([key, value]) => `| ${key} | ${value === true ? 'PASS' : 'FAIL'} |`)
  .join('\n');
const sequenceRows = gate.frozenSequence
  .map((entry) => `| ${entry.order} | ${entry.front} | ${entry.name} |`)
  .join('\n');
const dominant = gate.dominantMechanisms.map((label) => `\`${label}\``).join(', ');

const markdown = `# WP-RV08 R4-CU-D3D-B7-D0 Closure v0.1

## Decision

**SEQUENCED MIXED CAUSAL PREREGISTRATION PASSED / NEXT FRONT R4-CU-D3D-B7-D1 / NO CAUSAL MECHANISM YET CONFIRMED / B6 RETUNING PROHIBITED / CANONICAL MUTATION NOT AUTHORIZED**

## Authoritative D0 gate execution

- Workflow run ID: \`${sourceRunId}\`
- Workflow head SHA: \`${sourceHeadSha}\`
- Workflow URL: \`${sourceRunUrl}\`
- Closure generated at: \`${generatedAt}\`
- Contract SHA-256: \`${sha256(contractText)}\`
- Gate receipt SHA-256: \`${sha256(gateText)}\`
- Gate status: \`${gate.status}\`
- Gate result: \`${gate.gates.ok ? 'PASS' : 'FAIL'}\`

## Frozen dependency

- B7 closure commit: \`${contract.sourceB7.closureCommit}\`
- B7 workflow run: \`${contract.sourceB7.workflowRunId}\`
- B7 workflow head: \`${contract.sourceB7.workflowHeadSha}\`
- B7 artifact: \`${contract.sourceB7.aggregateArtifactId}\`
- B7 artifact digest: \`${contract.sourceB7.aggregateArtifactDigest}\`
- B7 aggregate SHA-256: \`${contract.sourceB7.aggregateJsonSha256}\`
- B7 decision: \`${contract.sourceB7.decision}\`
- B7 route: \`${contract.sourceB7.routing}\`
- B6-S3 decision: \`${contract.sourceStage3.decision}\`

## Frozen mixed finding

- Dominant failed-primary mechanisms: ${dominant}
- Failed-primary panels: \`${contract.authoritativeB7Finding.failedPrimaryPanels}\`
- Supplier-topology prevalence: \`18/24\` primary versus \`12/24\` control
- Value-transformation prevalence: \`20/24\` primary versus \`23/24\` control

These findings determine execution order only. They are not causal conclusions and do not authorize a parameter or rule change.

## Frozen execution sequence

| Order | Front | Purpose |
|---:|---|---|
${sequenceRows}

D1 must close before D6 begins. D6 must cover both the exact observed cell and the D1 topology-neutral cell. D0-R1 cannot run until both child closures exist.

## Authorized next front

\`${gate.nextAuthorizedFront}\`

D1 must first create a separate frozen child contract. No reachability intervention is authorized directly by this closure outside a disposable, noncanonical diagnostic clone governed by that child contract.

## Technical gates

| Gate | Result |
|---|---:|
${gateRows}

## Interpretation lock

- Causal conclusion reached: **NO**
- Candidate retuning authorized: **NO**
- Direct parameter calibration authorized: **NO**
- Canonical mutation authorized: **NO**
- B6-S3 decision reversal authorized: **NO**
- B7 decision reversal authorized: **NO**

A later D1, D6 or D0-R1 result may classify a mechanism. It still cannot mutate canonical state. Any proposed model change requires a new mechanism-specific preregistration and separate safety review.
`;

writeFileSync(outputPath, markdown);
console.log(
  'WP_RV08_R4_CU_D3D_B7_D0_CLOSURE',
  JSON.stringify({
    status: gate.status,
    gatePassed: gate.gates.ok,
    nextAuthorizedFront: gate.nextAuthorizedFront,
    contractSha256: sha256(contractText),
    gateReceiptSha256: sha256(gateText),
    outputPath
  })
);
