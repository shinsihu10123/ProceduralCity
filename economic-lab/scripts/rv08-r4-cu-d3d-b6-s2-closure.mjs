import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const protocolPath = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b6-s2-heldout-replication-contract.json');
const aggregatePath = resolve(process.argv[2] || process.env.AGGREGATE_JSON || '');
const outputPath = resolve(process.argv[3] || process.env.OUTPUT_MD || 'economic-lab/diagnostics/reality-validation/WP-RV08_R4_CU_D3D_B6_S2_CLOSURE_v0.1.md');
const protocol = JSON.parse(readFileSync(protocolPath, 'utf8'));
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

assert.equal(protocol.front, 'R4-CU-D3D-B6-S2');
assert.equal(protocol.status, 'FROZEN_BEFORE_HELDOUT_EXECUTION');
assert.equal(aggregate.schemaVersion, 'r4-cu-d3d-b6-s2-aggregate-v0.1');
assert.equal(aggregate.front, protocol.front);
assert.equal(aggregate.technicalGates?.ok, true, 'Cannot close B6-S2: technical aggregation failed');
assert.equal(aggregate.expected?.jobs, protocol.execution.candidateSeedJobs);
assert.equal(aggregate.observed?.jobs, protocol.execution.candidateSeedJobs);
assert.equal(aggregate.interpretation?.canonicalMutationAuthorized, false);
assert.equal(protocol.canonicalMutationAuthorized, false);
assert.equal(protocol.directParameterCalibrationAuthorized, false);

const replicated = (aggregate.replicatedCandidates || []).map((entry) => entry.candidate?.id).filter(Boolean);
const primary = aggregate.primaryCandidate?.candidate?.id || null;
const decisionLine = aggregate.decision === 'HELDOUT_REPLICATION_CONFIRMED'
  ? `HELDOUT REPLICATION CONFIRMED / ${replicated.length} REPLICATED CANDIDATE(S) / PRIMARY ${primary || 'NONE'} / CANONICAL MUTATION NOT AUTHORIZED`
  : 'NO B6 FINALIST REPLICATED / NO RETUNING / ROUTE TO B7 / CANONICAL MUTATION NOT AUTHORIZED';

const rows = [];
for (const candidateEvaluation of aggregate.candidateEvaluations || []) {
  for (const seedEvaluation of candidateEvaluation.seedEvaluations || []) {
    const conditions = seedEvaluation.conditions || {};
    rows.push([
      candidateEvaluation.candidate?.id || 'UNKNOWN',
      seedEvaluation.seed || 'UNKNOWN',
      seedEvaluation.replicatedOnSeed ? 'PASS' : 'FAIL',
      fmt(seedEvaluation.metrics?.labourShareMedian),
      fmt(seedEvaluation.controlMetrics?.labourShareMedian),
      fmt(seedEvaluation.metrics?.consumptionShareMedian),
      fmt(seedEvaluation.controlMetrics?.consumptionShareMedian),
      fmt(seedEvaluation.ratios?.inputShortageRatio),
      fmt(seedEvaluation.ratios?.activeFirmRatio),
      fmt(seedEvaluation.ratios?.purchasingPowerRatio),
      bool(conditions.integrityPassed),
      bool(conditions.labourDistanceStrictlyImproved),
      bool(conditions.consumptionDistanceStrictlyImproved),
      bool(conditions.inputShortageNotWorse),
      bool(conditions.activeFirmsPreserved),
      bool(conditions.purchasingPowerPreserved)
    ]);
  }
}

const gateRows = Object.entries(aggregate.technicalGates || {})
  .filter(([key]) => key !== 'ok')
  .map(([key, value]) => `| ${key} | ${bool(value)} |`)
  .join('\n');

const candidateRows = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
const primaryDetails = aggregate.primaryCandidate
  ? [
      `- Primary replicated candidate: \`${primary}\``,
      `- Worst-heldout headline distance: ${fmt(aggregate.primaryCandidate.ranking?.worstHeldoutHeadlineDistance)}`,
      `- Worst-heldout input-shortage ratio vs control: ${fmt(aggregate.primaryCandidate.ranking?.worstHeldoutInputShortageRatio)}`,
      `- Mean nonpositive-GVA share: ${fmt(aggregate.primaryCandidate.ranking?.meanNonPositiveGvaShare)}`,
      `- Minimum active-firm ratio vs control: ${fmt(aggregate.primaryCandidate.ranking?.minimumActiveFirmRatio)}`
    ].join('\n')
  : '- Primary replicated candidate: none';

const markdown = `# WP-RV08 R4-CU-D3D-B6-S2 Closure v0.1

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

## Frozen heldout panel

- Control: \`V1_M1_C42\`
- Stage-1 finalists: \`V1_M16_C42\`, \`V1_M4_C42\`, \`V24_M16_C42\`
- Heldout seeds: \`ECON-RV08-HOLDOUT-E\`, \`ECON-RV08-HOLDOUT-F\`
- Horizon: 12 months
- Candidate retuning after heldout observation: prohibited
- Threshold relaxation after heldout observation: prohibited

## Heldout replication result

- Replicated candidates: ${replicated.length ? replicated.map((id) => `\`${id}\``).join(', ') : 'none'}
- Replicated candidate count: \`${aggregate.replicatedCandidateCount}\`
${primaryDetails}
- Dependency-safe routing: \`${aggregate.routing}\`

## Candidate × heldout-seed evidence

| Candidate | Seed | Replicated | Labour share | Control labour share | Consumption share | Control consumption share | Input shortage ratio | Active-firm ratio | Purchasing-power ratio | Integrity | Labour improvement | Consumption improvement | Shortage gate | Firm gate | Purchasing-power gate |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${candidateRows}

The empirical labour-share and realized-consumption bands remain external validation bands. They are not direct values for canonical wages, prices, productivity, material coefficients or household demand parameters.

## Technical gates

| Gate | Result |
|---|---:|
${gateRows}

## Interpretation

The heldout result answers only whether one or more preregistered B6 causal families reproduce on untouched seeds under the same 12-month measurement and eligibility surface. It does not identify a fully calibrated economy, and it does not authorize canonical mutation.

${aggregate.decision === 'HELDOUT_REPLICATION_CONFIRMED'
  ? `The next permitted front is \`${protocol.nextFrontIfReplicated}\`. Only the preregistered primary candidate may advance, and its values remain frozen during long-horizon and stress validation.`
  : `No B6 finalist satisfied all frozen gates on both heldout seeds. The next permitted front is \`${protocol.nextFrontIfNone}\`. B6 grid retuning is prohibited.`}

## Canonical lock

This closure does **not** authorize:

- changing canonical wages, prices, productivity, material coefficients or procurement rules;
- changing household desired-consumption behavior;
- adding, replacing or tuning a heldout candidate;
- changing the heldout seeds or 12-month horizon;
- relaxing eligibility or ranking rules;
- converting an external empirical band into a direct parameter target.
`;

writeFileSync(outputPath, markdown);
console.log('WP_RV08_R4_CU_D3D_B6_S2_CLOSURE', JSON.stringify({
  decision: aggregate.decision,
  replicatedCandidates: replicated,
  primaryCandidate: primary,
  routing: aggregate.routing,
  aggregateSha256: sha256(aggregateText),
  outputPath
}));
