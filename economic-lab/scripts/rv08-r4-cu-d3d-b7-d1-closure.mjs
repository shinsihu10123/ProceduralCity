import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const CONTRACT_PATH = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b7-d1-supplier-topology-causal-contract.json');
const aggregatePath = resolve(process.argv[2] || process.env.AGGREGATE_JSON || '');
const outputPath = resolve(
  process.argv[3] ||
  process.env.OUTPUT_MD ||
  'economic-lab/diagnostics/reality-validation/WP-RV08_R4_CU_D3D_B7_D1_CLOSURE_v0.1.md'
);
const contractText = readFileSync(CONTRACT_PATH, 'utf8');
const contract = JSON.parse(contractText);
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

assert.equal(contract.schemaVersion, '1.0');
assert.equal(contract.front, 'R4-CU-D3D-B7-D1');
assert.equal(contract.status, 'FROZEN_BEFORE_TOPOLOGY_COUNTERFACTUAL_EXECUTION');
assert.equal(aggregate.schemaVersion, 'r4-cu-d3d-b7-d1-aggregate-v0.1');
assert.equal(aggregate.front, contract.front);
assert.ok(
  ['TOPOLOGY_CAUSAL', 'TOPOLOGY_NONCAUSAL', 'TOPOLOGY_INDETERMINATE'].includes(aggregate.decision),
  `Unknown D1 decision ${aggregate.decision}`
);
assert.equal(aggregate.interpretation?.canonicalMutationAuthorized, false);
assert.equal(contract.canonicalMutationAuthorized, false);
assert.equal(contract.candidateRetuningAuthorized, false);

const technicalPassed = aggregate.technicalGates?.ok === true;
const decisionLine = aggregate.decision === 'TOPOLOGY_CAUSAL'
  ? `TOPOLOGY CAUSAL${aggregate.detailLabel ? ` / ${aggregate.detailLabel}` : ''} / PROCEED TO D6 OVER O AND T TRACES / CANONICAL MUTATION NOT AUTHORIZED`
  : aggregate.decision === 'TOPOLOGY_NONCAUSAL'
    ? 'TOPOLOGY NONCAUSAL / PROCEED TO D6 OVER O AND T TRACES / CANONICAL MUTATION NOT AUTHORIZED'
    : 'TOPOLOGY INDETERMINATE / REPAIR ONLY D1 DIAGNOSTIC INTERFACE UNDER THE SAME FROZEN CONTRACT / CANONICAL MUTATION NOT AUTHORIZED';

const gateRows = Object.entries(aggregate.technicalGates || {})
  .filter(([key]) => key !== 'ok')
  .map(([key, value]) => `| ${key} | ${bool(value)} |`)
  .join('\n');
const conditionRows = Object.entries(aggregate.causalConditions || {})
  .map(([key, value]) => `| ${key} | ${bool(value)} |`)
  .join('\n');
const panelRows = (aggregate.pairEvaluations || []).flatMap((pair) =>
  (pair.windows || []).map((window) => {
    const e = window.estimands || {};
    return `| ${pair.candidateId} | ${pair.seed} | ${pair.scenario?.id || 'UNKNOWN'} | ${window.window?.id || 'UNKNOWN'} | ${fmt(window.O?.inputShortageRate)} | ${fmt(window.T?.inputShortageRate)} | ${fmt(e.absoluteTopologyEffect)} | ${fmt(e.relativeTopologyEffect)} | ${fmt(e.searchExecutionResidualShareT, 9)} | ${fmt(e.activeFirmRatio)} | ${fmt(e.purchasingPowerRatio)} | ${fmt(e.valueEffectOfTopology)} | ${window.conditions?.effectThresholdsPassed ? 'YES' : 'NO'} |`;
  })
).join('\n');
const contrastRows = (aggregate.pairedContrasts || []).map((entry) =>
  `| ${entry.seed} | ${entry.scenario?.id || 'UNKNOWN'} | ${entry.window?.id || 'UNKNOWN'} | ${fmt(entry.primaryAbsoluteTopologyEffect)} | ${fmt(entry.controlAbsoluteTopologyEffect)} | ${fmt(entry.candidateSpecificDifferential)} | ${entry.thresholdPassed ? 'YES' : 'NO'} |`
).join('\n');

const primary = aggregate.effectSummary?.primary || {};
const control = aggregate.effectSummary?.control || {};
const differential = aggregate.effectSummary?.candidateSpecific || {};
const markdown = `# WP-RV08 R4-CU-D3D-B7-D1 Closure v0.1

## Decision

**${decisionLine}**

## Authoritative execution

- Source workflow run ID: \`${sourceRunId}\`
- Source workflow head SHA: \`${sourceHeadSha}\`
- Source workflow URL: \`${sourceRunUrl}\`
- Aggregate artifact ID: \`${artifactId}\`
- Aggregate artifact digest: \`${artifactDigest}\`
- D1 contract SHA-256: \`${sha256(contractText)}\`
- Aggregate JSON SHA-256: \`${sha256(aggregateText)}\`
- Closure generated at: \`${generatedAt}\`
- Technical status: \`${aggregate.status}\`
- Technical gates passed: **${technicalPassed ? 'YES' : 'NO'}**
- Causal decision: \`${aggregate.decision}\`
- Detail label: \`${aggregate.detailLabel || 'NONE'}\`
- Routing: \`${aggregate.routing}\`

## Frozen dependency

- D0 closure commit: \`${contract.sourceD0.closureCommit}\`
- D0 workflow run: \`${contract.sourceD0.workflowRunId}\`
- D0 decision: \`${contract.sourceD0.decision}\`
- B7 closure commit: \`${contract.sourceB7.closureCommit}\`
- B7 diagnostic decision: \`${contract.sourceB7.decision}\`
- B7 primary topology prevalence: ${fmt(contract.sourceB7.primaryPrevalence)}
- B7 control topology prevalence: ${fmt(contract.sourceB7.controlPrevalence)}
- Candidate retuning: prohibited

## Frozen execution panel

- Candidates: ${contract.frozenPanel.candidates.map((entry) => `\`${entry.id}\``).join(', ')}
- Seeds: ${contract.frozenPanel.validationSeeds.map((entry) => `\`${entry.seed}\``).join(', ')}
- Scenarios: ${contract.frozenPanel.scenarios.map((entry) => `\`${entry.id}\``).join(', ')}
- Horizon: ${contract.frozenPanel.months} months
- Cells: \`O\` exact observed path, \`T\` exhaustive topology-neutral shadow
- Jobs: ${contract.frozenPanel.jobs}
- Cell results: ${aggregate.observed?.cellResults}/${aggregate.expected?.cells}
- Exact model replay states: ${aggregate.expected?.modelReplayStates}

## Effect summary

| Surface | Qualifying panels | Total panels | Frequency |
|---|---:|---:|---:|
| Failed-primary topology effect | ${primary.qualifyingPanels ?? 'NA'} | ${primary.totalPanels ?? 'NA'} | ${fmt(primary.replicatedPanelFrequency)} |
| Control topology effect | ${control.qualifyingPanels ?? 'NA'} | ${control.totalPanels ?? 'NA'} | ${fmt(control.replicatedPanelFrequency)} |
| Primary-specific differential | ${differential.qualifyingPanels ?? 'NA'} | ${differential.totalPanels ?? 'NA'} | ${fmt(differential.replicatedPanelFrequency)} |
| Failed-primary value-index reduction | ${primary.valueReductionPanels ?? 'NA'} | ${primary.totalPanels ?? 'NA'} | ${fmt(primary.valueReductionFrequency)} |

- Failed-primary opposite-sign frequency: ${fmt(primary.oppositeSignPanelFrequency)}
- Both seeds represented among qualifying topology panels: **${primary.bothSeedsRepresented ? 'YES' : 'NO'}**
- All T search-residual gates passed: **${primary.allSearchResidualsPassed ? 'YES' : 'NO'}**
- All active-firm preservation gates passed: **${primary.allActiveFirmGatesPassed ? 'YES' : 'NO'}**
- All purchasing-power preservation gates passed: **${primary.allPurchasingPowerGatesPassed ? 'YES' : 'NO'}**

## Causal classification conditions

| Condition | Result |
|---|---:|
${conditionRows}

## O versus T estimands

| Candidate | Seed | Scenario | Window | O shortage | T shortage | Absolute effect | Relative effect | T search residual | Active-firm ratio | Purchasing-power ratio | Value-index effect | Effect thresholds |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${panelRows}

## Primary-minus-control contrasts

| Seed | Scenario | Window | Primary effect | Control effect | Differential | 0.05 threshold |
|---|---|---|---:|---:|---:|---:|
${contrastRows}

## Technical gates

| Gate | Result |
|---|---:|
${gateRows}

## Interpretation

D1 changes only supplier traversal inside disposable T-cell replays. It does not inject stock or cash, alter the 42% procurement budget, change prices or candidate axes, or mutate the canonical supply-chain source. A causal label means exhaustive compatible-supplier reachability materially reduces frozen input shortages under the preregistered rule; it is not a production policy recommendation.

${technicalPassed
  ? 'The required next front is R4-CU-D3D-B7-D6 over both O and T traces. D6 must determine whether value-transformation pathology is upstream, downstream or independent of the measured topology effect.'
  : 'No economic interpretation is authorized. Only the failing D1 diagnostic interface may be repaired under the same contract, cells, seeds, scenarios, horizon and thresholds.'}

## Canonical lock

This closure does **not** authorize changing canonical procurement, suppliers, prices, wages, inventories, cash, input coefficients, candidate values, demand, accounting, settlement, banks, taxes, entry, exit, seeds, scenarios, horizon or classification thresholds.
`;

writeFileSync(outputPath, markdown);
console.log('WP_RV08_R4_CU_D3D_B7_D1_CLOSURE', JSON.stringify({
  decision: aggregate.decision,
  detailLabel: aggregate.detailLabel,
  technicalPassed,
  aggregateSha256: sha256(aggregateText),
  contractSha256: sha256(contractText),
  routing: aggregate.routing,
  outputPath
}));
