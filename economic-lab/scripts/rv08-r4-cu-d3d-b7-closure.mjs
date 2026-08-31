import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const contractPath = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b7-demand-inventory-topology-contract.json');
const aggregatePath = resolve(process.argv[2] || process.env.AGGREGATE_JSON || '');
const outputPath = resolve(process.argv[3] || process.env.OUTPUT_MD || 'economic-lab/diagnostics/reality-validation/WP-RV08_R4_CU_D3D_B7_CLOSURE_v0.1.md');
const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
const aggregateText = readFileSync(aggregatePath, 'utf8');
const aggregate = JSON.parse(aggregateText);
const sourceRunId = process.env.SOURCE_RUN_ID || 'UNKNOWN';
const sourceHeadSha = process.env.SOURCE_HEAD_SHA || 'UNKNOWN';
const sourceRunUrl = process.env.SOURCE_RUN_URL || 'UNKNOWN';
const artifactId = process.env.SOURCE_ARTIFACT_ID || 'UNKNOWN';
const artifactDigest = process.env.SOURCE_ARTIFACT_DIGEST || 'UNKNOWN';
const generatedAt = new Date().toISOString();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const fmt = (value, digits = 6) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : 'NA';
const bool = (value) => value === true ? 'PASS' : 'FAIL';

assert.equal(contract.front, 'R4-CU-D3D-B7');
assert.equal(contract.status, 'FROZEN_BEFORE_DIAGNOSTIC_EXECUTION');
assert.equal(contract.sourceStage3.decision, 'LONG_HORIZON_OR_STRESS_VALIDATION_FAILED_NO_RETUNING');
assert.equal(aggregate.schemaVersion, 'r4-cu-d3d-b7-aggregate-v0.1');
assert.equal(aggregate.front, contract.front);
assert.equal(aggregate.status, 'PASS_TECHNICAL_B7_DIAGNOSTIC_AGGREGATION');
assert.equal(aggregate.technicalGates?.ok, true, 'Cannot close B7: technical aggregation failed');
assert.equal(aggregate.expected?.jobs, contract.execution.candidateSeedScenarioJobs);
assert.equal(aggregate.observed?.jobs, contract.execution.candidateSeedScenarioJobs);
assert.ok(Object.hasOwn(contract.routing, aggregate.decision), `Unknown B7 decision ${aggregate.decision}`);
assert.equal(aggregate.routing, contract.routing[aggregate.decision]);
assert.equal(aggregate.interpretation?.canonicalMutationAuthorized, false);
assert.equal(aggregate.interpretation?.candidateRetuningAuthorized, false);
assert.equal(contract.canonicalMutationAuthorized, false);
assert.equal(contract.directParameterCalibrationAuthorized, false);

const prevalenceRows = (aggregate.mechanismComparison || []).map((entry) =>
  `| ${entry.label} | ${entry.primary.qualifiedPanels}/${entry.primary.totalPanels} | ${fmt(entry.primary.prevalence)} | ${entry.control.qualifiedPanels}/${entry.control.totalPanels} | ${fmt(entry.control.prevalence)} | ${fmt(entry.prevalenceDelta)} | ${entry.primary.dominant ? 'YES' : 'NO'} |`
).join('\n');

const gateRows = Object.entries(aggregate.technicalGates || {})
  .filter(([key]) => key !== 'ok')
  .map(([key, value]) => `| ${key} | ${bool(value)} |`)
  .join('\n');

const panelRows = (aggregate.panelEvaluations || []).flatMap((panel) =>
  (panel.windows || []).map((window) =>
    `| ${panel.candidateId} | ${panel.seed} | ${panel.scenario?.id || 'UNKNOWN'} | ${window.window?.id || 'UNKNOWN'} | ${(window.qualifiedLabels || []).join(', ') || 'NONE'} | ${fmt(window.metrics?.inputShortageRate)} | ${fmt(window.metrics?.topologyShareOfShortage)} | ${fmt(window.metrics?.cashShareOfShortage)} | ${fmt(window.metrics?.searchExecutionShareOfShortage)} | ${fmt(window.metrics?.salesToPlanRatio)} | ${fmt(window.metrics?.inventoryAboveTargetRatio)} | ${fmt(window.metrics?.goodsUnmetShare)} | ${fmt(window.metrics?.nonPositiveGvaCountryMonthShare)} | ${fmt(window.metrics?.belowCostRevenueShare)} |`
  )
).join('\n');

const dominant = aggregate.dominantPrimaryLabels?.length
  ? aggregate.dominantPrimaryLabels.map((label) => `\`${label}\``).join(', ')
  : 'none';
const mixedExplanation = aggregate.decision === 'MIXED'
  ? 'No single mechanism held exclusive majority status across the failed-primary panel, or more than one mechanism did. The dependency-safe route is therefore the mixed decomposition front.'
  : `Exactly one mechanism crossed the preregistered majority threshold across the failed-primary panels: \`${aggregate.decision}\`.`;

const markdown = `# WP-RV08 R4-CU-D3D-B7 Closure v0.1

## Decision

**${aggregate.decision} / ROUTE ${aggregate.routing} / B6 RETUNING PROHIBITED / CANONICAL MUTATION NOT AUTHORIZED**

## Authoritative execution

- Source workflow run ID: \`${sourceRunId}\`
- Source workflow head SHA: \`${sourceHeadSha}\`
- Source workflow URL: \`${sourceRunUrl}\`
- Aggregate artifact ID: \`${artifactId}\`
- Aggregate artifact digest: \`${artifactDigest}\`
- Aggregate JSON SHA-256: \`${sha256(aggregateText)}\`
- Closure generated at: \`${generatedAt}\`
- Technical status: \`${aggregate.status}\`
- Diagnostic decision: \`${aggregate.decision}\`
- Dependency-safe route: \`${aggregate.routing}\`
- Observed jobs: \`${aggregate.observed?.jobs}/${aggregate.expected?.jobs}\`

## Frozen dependency

- B6-S3 authoritative run: \`${contract.sourceStage3.workflowRunId}\`
- B6-S3 closure commit: \`${contract.sourceStage3.closureCommit}\`
- B6-S3 decision: \`${contract.sourceStage3.decision}\`
- Frozen diagnostic control: \`V1_M1_C42\`
- Frozen failed-primary probe: \`${contract.sourceStage3.primaryCandidateId}\`
- Candidate retuning after S3: prohibited
- S3 decision reversal: prohibited

## Diagnostic panel

- Seeds: ${contract.execution.validationSeeds.map((entry) => `\`${entry.seed}\``).join(', ')}
- Scenarios: ${contract.execution.scenarios.map((entry) => `\`${entry.id}\``).join(', ')}
- Horizon: 36 months
- Windows: ${contract.execution.windows.map((entry) => `\`${entry.id}\` M${entry.startMonth}–M${entry.endMonth}`).join('; ')}
- Jobs: 2 candidates × 2 seeds × 3 scenarios = 12
- Failed-primary seed×scenario×window panels: \`${aggregate.expected?.primaryPanels}\`
- Dominant failed-primary mechanisms: ${dominant}

${mixedExplanation}

## Mechanism prevalence

| Mechanism | Failed-primary panels | Primary prevalence | Control panels | Control prevalence | Primary-control delta | Primary dominant |
|---|---:|---:|---:|---:|---:|---:|
${prevalenceRows}

## Candidate × seed × scenario × window evidence

| Candidate | Seed | Scenario | Window | Qualified mechanisms | Shortage rate | Topology share | Cash share | Search/execution share | Sales/plan | Inventory above target | Goods unmet share | Nonpositive GVA share | Below-cost revenue share |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${panelRows}

## Technical gates

| Gate | Result |
|---|---:|
${gateRows}

## Interpretation

B7 identifies which structural mechanism or combination of mechanisms repeatedly accompanies the frozen B6-S3 failure. It is a read-only diagnosis. The failed primary is retained only as a diagnostic probe and is not rehabilitated, retuned or promoted by this closure.

The next permitted front is \`${aggregate.routing}\`. That front must preserve the B7 classification boundary, operate on a separately preregistered causal surface and continue to block canonical mutation until a mechanism-specific repair survives untouched-seed, long-horizon and stress validation.

## Canonical lock

This closure does **not** authorize:

- changing canonical productivity, input coefficients, prices, wages or procurement rules;
- changing household desired-consumption behavior or goods-market matching rules;
- changing B7 thresholds, labels, seeds, scenarios, windows or the 36-month horizon;
- retuning \`${contract.sourceStage3.primaryCandidateId}\` after observing S3 or B7 evidence;
- suppressing a failed panel or averaging away a recurrent mechanism;
- treating a diagnostic classification threshold as a calibrated economic target;
- reversing the B6-S3 failure decision.
`;

writeFileSync(outputPath, markdown);
console.log('WP_RV08_R4_CU_D3D_B7_CLOSURE', JSON.stringify({
  decision: aggregate.decision,
  routing: aggregate.routing,
  dominantPrimaryLabels: aggregate.dominantPrimaryLabels,
  aggregateSha256: sha256(aggregateText),
  outputPath
}));
