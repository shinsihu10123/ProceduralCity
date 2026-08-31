import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const contractPath = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b6-s3-long-horizon-stress-contract.json');
const aggregatePath = resolve(process.argv[2] || process.env.AGGREGATE_JSON || '');
const outputPath = resolve(process.argv[3] || process.env.OUTPUT_MD || 'economic-lab/diagnostics/reality-validation/WP-RV08_R4_CU_D3D_B6_S3_CLOSURE_v0.1.md');
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

assert.equal(contract.front, 'R4-CU-D3D-B6-S3');
assert.equal(contract.status, 'FROZEN_BEFORE_LONG_HORIZON_STRESS_EXECUTION');
assert.equal(aggregate.schemaVersion, 'r4-cu-d3d-b6-s3-aggregate-v0.1');
assert.equal(aggregate.front, contract.front);
assert.equal(aggregate.technicalGates?.ok, true, 'Cannot close B6-S3: technical aggregation failed');
assert.equal(aggregate.expected?.jobs, contract.execution.candidateSeedScenarioJobs);
assert.equal(aggregate.observed?.jobs, contract.execution.candidateSeedScenarioJobs);
assert.equal(aggregate.interpretation?.canonicalMutationAuthorized, false);
assert.equal(contract.canonicalMutationAuthorized, false);
assert.equal(contract.directParameterCalibrationAuthorized, false);

const passed = aggregate.decision === 'LONG_HORIZON_STRESS_VALIDATION_CONFIRMED';
const decisionLine = passed
  ? 'LONG-HORIZON AND STRESS VALIDATION CONFIRMED / PRIMARY V24_M16_C42 / ADVANCE TO SEPARATE CANONICAL-CHANGE PREREGISTRATION AND SAFETY REVIEW / CANONICAL MUTATION NOT YET AUTHORIZED'
  : 'LONG-HORIZON OR STRESS VALIDATION FAILED / NO RETUNING / ROUTE TO B7 / CANONICAL MUTATION NOT AUTHORIZED';

const panelRows = (aggregate.panelEvaluations || []).flatMap((panel) =>
  (panel.windowEvaluations || []).map((entry) => {
    const conditions = entry.conditions || {};
    return `| ${panel.seed} | ${panel.scenario?.id || 'UNKNOWN'} | ${entry.window?.id || 'UNKNOWN'} | ${entry.passed ? 'PASS' : 'FAIL'} | ${fmt(entry.metrics?.labourShareMedian)} | ${fmt(entry.controlMetrics?.labourShareMedian)} | ${fmt(entry.metrics?.consumptionShareMedian)} | ${fmt(entry.controlMetrics?.consumptionShareMedian)} | ${fmt(entry.ratios?.inputShortageRatio)} | ${fmt(entry.ratios?.activeFirmRatio)} | ${fmt(entry.ratios?.purchasingPowerRatio)} | ${bool(conditions.labourDistanceStrictlyImproved)} | ${bool(conditions.consumptionDistanceStrictlyImproved)} | ${bool(conditions.inputShortageNotWorse)} | ${bool(conditions.activeFirmsPreserved)} | ${bool(conditions.purchasingPowerPreserved)} |`;
  })
).join('\n');

const gateRows = Object.entries(aggregate.technicalGates || {})
  .filter(([key]) => key !== 'ok')
  .map(([key, value]) => `| ${key} | ${bool(value)} |`)
  .join('\n');

const scenarioRows = contract.execution.scenarios.map((scenario) =>
  `| ${scenario.id} | ${scenario.role} | ${scenario.schedule.length} | ${scenario.schedule.map((event) => `${event.kind}@M${event.month}`).join(', ') || 'none'} |`
).join('\n');

const markdown = `# WP-RV08 R4-CU-D3D-B6-S3 Closure v0.1

## Decision

**${decisionLine}**

## Authoritative execution

- Source workflow run ID: \`${sourceRunId}\`
- Source workflow head SHA: \`${sourceHeadSha}\`
- Source workflow URL: \`${sourceRunUrl}\`
- Aggregate artifact ID: \`${artifactId}\`
- Aggregate artifact digest: \`${artifactDigest}\`
- Aggregate JSON SHA-256: \`${sha256(aggregateText)}\`
- Closure generated at: \`${generatedAt}\`
- Technical status: \`${aggregate.status}\`
- Economic decision: \`${aggregate.decision}\`
- Observed jobs: \`${aggregate.observed?.jobs}/${aggregate.expected?.jobs}\`

## Frozen dependency and primary

- S2 closure commit: \`${contract.sourceStage2.closureCommit}\`
- S2 authoritative run: \`${contract.sourceStage2.workflowRunId}\`
- S2 replicated candidates: ${contract.sourceStage2.replicatedCandidates.map((id) => `\`${id}\``).join(', ')}
- S3 control: \`V1_M1_C42\`
- S3 frozen primary: \`${contract.sourceStage2.primaryCandidateId}\`
- Primary retuning during S3: prohibited

## Frozen validation panel

- Validation seeds: ${contract.execution.validationSeeds.map((entry) => `\`${entry.seed}\``).join(', ')}
- Horizon: 36 months
- Shock month: 13
- Windows: \`FULL_36\` months 1–36; \`TERMINAL_12\` months 25–36
- Jobs: 2 candidates × 2 seeds × 3 scenarios = 12

| Scenario | Role | Scheduled events | Event path |
|---|---|---:|---|
${scenarioRows}

Scenario magnitudes are frozen adverse validation paths. They are not calibrated canonical parameter recommendations.

## Primary validation result

- All seed-scenario-window panels passed: **${aggregate.allPanelsPassed ? 'YES' : 'NO'}**
- Worst-window combined headline distance: ${fmt(aggregate.worstCase?.combinedHeadlineDistance)}
- Worst-window input-shortage ratio vs control: ${fmt(aggregate.worstCase?.inputShortageRatio)}
- Minimum window active-firm ratio vs control: ${fmt(aggregate.worstCase?.minimumActiveFirmRatio)}
- Minimum window purchasing-power ratio vs control: ${fmt(aggregate.worstCase?.minimumPurchasingPowerRatio)}
- Dependency-safe routing: \`${aggregate.routing}\`

## Seed × scenario × window evidence

| Seed | Scenario | Window | Result | Labour share | Control labour | Consumption share | Control consumption | Input shortage ratio | Active-firm ratio | Purchasing-power ratio | Labour improvement | Consumption improvement | Shortage gate | Firm gate | Purchasing-power gate |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${panelRows}

## Technical gates

| Gate | Result |
|---|---:|
${gateRows}

## Interpretation

S3 tests whether the single S2 primary remains directionally superior to canonical control over a longer horizon and under preregistered adverse paths. It does not show that empirical bands have been reached, does not convert scenario magnitudes into calibrated values and does not itself authorize canonical mutation.

${passed
  ? `The next permitted front is \`${contract.nextFrontIfPass}\`. That front must separately preregister the proposed canonical change, migration path, rollback conditions and safety evidence before any production mutation.`
  : `At least one frozen seed-scenario-window panel failed. B6 closes without retuning. The next permitted front is \`${contract.nextFrontIfFail}\`.`}

## Canonical lock

This closure does **not** authorize:

- changing canonical productivity, input coefficients or procurement rules;
- changing prices, wages, household desired budgets, opening balances or taxes;
- changing the S3 primary, validation seeds, scenarios, shock month, horizon or windows;
- suppressing a failed stress panel or averaging it away;
- relaxing an eligibility gate after observing results;
- treating stress magnitudes or external empirical bands as direct canonical targets.
`;

writeFileSync(outputPath, markdown);
console.log('WP_RV08_R4_CU_D3D_B6_S3_CLOSURE', JSON.stringify({
  decision: aggregate.decision,
  primaryCandidate: aggregate.primaryCandidate?.id,
  allPanelsPassed: aggregate.allPanelsPassed,
  routing: aggregate.routing,
  aggregateSha256: sha256(aggregateText),
  outputPath
}));
