import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = process.cwd();
const CONTRACT_PATH = resolve(
  ROOT,
  'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b7-d0-sequenced-mixed-causal-contract.json'
);
const SOURCE_CONTRACT_PATH = resolve(
  ROOT,
  'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b7-demand-inventory-topology-contract.json'
);
const SOURCE_AGGREGATE_PATH = resolve(
  ROOT,
  'economic-lab/diagnostics/reality-validation/evidence/r4-cu-d3d-b7-authoritative-aggregate.json'
);
const SOURCE_CLOSURE_PATH = resolve(
  ROOT,
  'economic-lab/diagnostics/reality-validation/WP-RV08_R4_CU_D3D_B7_CLOSURE_v0.1.md'
);
const PREREGISTRATION_PATH = resolve(
  ROOT,
  'economic-lab/diagnostics/reality-validation/WP-RV08_R4_CU_D3D_B7_D0_SEQUENCED_MIXED_CAUSAL_PREREGISTRATION_v0.1.md'
);
const OUTPUT_PATH = resolve(
  process.env.OUTPUT_JSON ||
    'economic-lab/performance-results/r4-cu-d3d-b7-d0-preregistration-gate.json'
);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const near = (actual, expected, tolerance = 1e-12) =>
  Number.isFinite(Number(actual)) && Math.abs(Number(actual) - Number(expected)) <= tolerance;

const contractText = readFileSync(CONTRACT_PATH, 'utf8');
const contract = JSON.parse(contractText);
const sourceContractText = readFileSync(SOURCE_CONTRACT_PATH, 'utf8');
const sourceContract = JSON.parse(sourceContractText);
const aggregateText = readFileSync(SOURCE_AGGREGATE_PATH, 'utf8');
const aggregate = JSON.parse(aggregateText);
const closureText = readFileSync(SOURCE_CLOSURE_PATH, 'utf8');
const preregistrationText = readFileSync(PREREGISTRATION_PATH, 'utf8');

const expectedMechanisms = [
  {
    label: 'INPUT_SUPPLIER_TOPOLOGY_BINDING',
    primaryQualifiedPanels: 18,
    primaryTotalPanels: 24,
    primaryPrevalence: 0.75,
    controlQualifiedPanels: 12,
    controlTotalPanels: 24,
    controlPrevalence: 0.5,
    primaryControlDelta: 0.25,
    primaryDominant: true
  },
  {
    label: 'INPUT_CASH_BUDGET_BINDING',
    primaryQualifiedPanels: 6,
    primaryTotalPanels: 24,
    primaryPrevalence: 0.25,
    controlQualifiedPanels: 12,
    controlTotalPanels: 24,
    controlPrevalence: 0.5,
    primaryControlDelta: -0.25,
    primaryDominant: false
  },
  {
    label: 'INPUT_SEARCH_EXECUTION_BINDING',
    primaryQualifiedPanels: 0,
    primaryTotalPanels: 24,
    primaryPrevalence: 0,
    controlQualifiedPanels: 0,
    controlTotalPanels: 24,
    controlPrevalence: 0,
    primaryControlDelta: 0,
    primaryDominant: false
  },
  {
    label: 'DEMAND_INVENTORY_MISMATCH',
    primaryQualifiedPanels: 0,
    primaryTotalPanels: 24,
    primaryPrevalence: 0,
    controlQualifiedPanels: 0,
    controlTotalPanels: 24,
    controlPrevalence: 0,
    primaryControlDelta: 0,
    primaryDominant: false
  },
  {
    label: 'GOODS_MARKET_MATCHING_BINDING',
    primaryQualifiedPanels: 0,
    primaryTotalPanels: 24,
    primaryPrevalence: 0,
    controlQualifiedPanels: 0,
    controlTotalPanels: 24,
    controlPrevalence: 0,
    primaryControlDelta: 0,
    primaryDominant: false
  },
  {
    label: 'VALUE_TRANSFORMATION_BINDING',
    primaryQualifiedPanels: 20,
    primaryTotalPanels: 24,
    primaryPrevalence: 20 / 24,
    controlQualifiedPanels: 23,
    controlTotalPanels: 24,
    controlPrevalence: 23 / 24,
    primaryControlDelta: -0.125,
    primaryDominant: true
  }
];

function aggregateMechanism(label) {
  const entry = (aggregate.mechanismComparison || []).find((candidate) => candidate.label === label);
  assert.ok(entry, `Missing B7 aggregate mechanism ${label}`);
  return {
    label: entry.label,
    primaryQualifiedPanels: entry.primary?.qualifiedPanels,
    primaryTotalPanels: entry.primary?.totalPanels,
    primaryPrevalence: entry.primary?.prevalence,
    controlQualifiedPanels: entry.control?.qualifiedPanels,
    controlTotalPanels: entry.control?.totalPanels,
    controlPrevalence: entry.control?.prevalence,
    primaryControlDelta: entry.prevalenceDelta,
    primaryDominant: entry.primary?.dominant
  };
}

function mechanismExact(actual, expected) {
  return (
    actual.label === expected.label &&
    actual.primaryQualifiedPanels === expected.primaryQualifiedPanels &&
    actual.primaryTotalPanels === expected.primaryTotalPanels &&
    near(actual.primaryPrevalence, expected.primaryPrevalence) &&
    actual.controlQualifiedPanels === expected.controlQualifiedPanels &&
    actual.controlTotalPanels === expected.controlTotalPanels &&
    near(actual.controlPrevalence, expected.controlPrevalence) &&
    near(actual.primaryControlDelta, expected.primaryControlDelta) &&
    actual.primaryDominant === expected.primaryDominant
  );
}

const sourceCandidateIds = sourceContract.candidatePanel.map((entry) => entry.id);
const d0CandidateIds = contract.frozenPanel.candidates.map((entry) => entry.id);
const sourceSeeds = sourceContract.execution.validationSeeds.map((entry) => entry.seed);
const d0Seeds = contract.frozenPanel.validationSeeds.map((entry) => entry.seed);
const sourceScenarios = sourceContract.execution.scenarios;
const d0Scenarios = contract.frozenPanel.scenarios;
const sourceWindows = sourceContract.execution.windows;
const d0Windows = contract.frozenPanel.windows;
const contractMechanismMap = new Map(
  contract.authoritativeB7Finding.mechanismComparison.map((entry) => [entry.label, entry])
);

const sourceMechanismEvidenceExact = expectedMechanisms.every((expected) =>
  mechanismExact(aggregateMechanism(expected.label), expected)
);
const contractMechanismEvidenceExact = expectedMechanisms.every((expected) => {
  const actual = contractMechanismMap.get(expected.label);
  return actual && mechanismExact(actual, expected);
});

const gates = {
  contractIdentityExact:
    contract.schemaVersion === '1.0' &&
    contract.front === 'R4-CU-D3D-B7-D0' &&
    contract.status === 'FROZEN_BEFORE_SEQUENCED_CHILD_EXECUTION',
  sourceClosureCommitFrozen:
    contract.sourceB7.closureCommit === '53275393b6906e203640c4db60f00dbd67bd30c8',
  sourceExecutionReceiptExact:
    contract.sourceB7.workflowRunId === 33371200438 &&
    contract.sourceB7.workflowHeadSha === '9bed96f445e87765431235c9ff7908bf73668e07' &&
    contract.sourceB7.aggregateArtifactId === 9750222167 &&
    contract.sourceB7.aggregateArtifactDigest ===
      'sha256:a77cc56408882ecb5318a2c2dd116a3f5772ff520579bee68dd1b3b63ed381b2',
  sourceAggregateHashExact:
    contract.sourceB7.aggregateJsonSha256 === sha256(aggregateText) &&
    sha256(aggregateText) === '8618beb8a8de76f87fc553e008be107b19bb332d6d26f5e60e604f0223ccd03c',
  sourceAggregateTechnicalPass:
    aggregate.schemaVersion === 'r4-cu-d3d-b7-aggregate-v0.1' &&
    aggregate.front === 'R4-CU-D3D-B7' &&
    aggregate.status === 'PASS_TECHNICAL_B7_DIAGNOSTIC_AGGREGATION' &&
    aggregate.technicalGates?.ok === true,
  sourceDecisionAndRouteExact:
    aggregate.decision === 'MIXED' &&
    aggregate.routing === 'R4-CU-D3D-B7-D0 sequenced multi-mechanism causal preregistration' &&
    contract.sourceB7.decision === aggregate.decision &&
    contract.sourceB7.routing === aggregate.routing,
  completeSourcePanel:
    aggregate.observed?.jobs === 12 &&
    aggregate.observed?.duplicateKeys?.length === 0 &&
    aggregate.observed?.missingKeys?.length === 0 &&
    aggregate.observed?.unexpectedKeys?.length === 0,
  dominantMechanismsExact:
    JSON.stringify(aggregate.dominantPrimaryLabels) ===
      JSON.stringify(['INPUT_SUPPLIER_TOPOLOGY_BINDING', 'VALUE_TRANSFORMATION_BINDING']) &&
    JSON.stringify(contract.authoritativeB7Finding.dominantMechanisms) ===
      JSON.stringify(['INPUT_SUPPLIER_TOPOLOGY_BINDING', 'VALUE_TRANSFORMATION_BINDING']),
  sourceMechanismEvidenceExact,
  contractMechanismEvidenceExact,
  sourcePanelInheritedExactly:
    JSON.stringify(d0CandidateIds) === JSON.stringify(sourceCandidateIds) &&
    JSON.stringify(d0Seeds) === JSON.stringify(sourceSeeds) &&
    JSON.stringify(d0Scenarios) === JSON.stringify(sourceScenarios) &&
    JSON.stringify(d0Windows) === JSON.stringify(sourceWindows) &&
    contract.frozenPanel.months === sourceContract.execution.months &&
    contract.frozenPanel.shockMonth === sourceContract.execution.shockMonth &&
    contract.frozenPanel.candidateSeedScenarioJobs ===
      sourceContract.execution.candidateSeedScenarioJobs,
  causalSequenceExact:
    JSON.stringify(contract.sequence.map((entry) => entry.front)) ===
      JSON.stringify(['R4-CU-D3D-B7-D1', 'R4-CU-D3D-B7-D6', 'R4-CU-D3D-B7-D0-R1']) &&
    contract.sequence.every((entry) => entry.childContractRequiredBeforeExecution === true),
  counterfactualCellsExact:
    JSON.stringify(contract.counterfactualCells.map((entry) => entry.id)) ===
      JSON.stringify(['O', 'T', 'O_R', 'T_R']) &&
    contract.counterfactualCells.find((entry) => entry.id === 'O')?.behavioralFeedback === true &&
    contract.counterfactualCells.find((entry) => entry.id === 'T')?.behavioralFeedback === true &&
    contract.counterfactualCells.find((entry) => entry.id === 'O_R')?.behavioralFeedback === false &&
    contract.counterfactualCells.find((entry) => entry.id === 'T_R')?.behavioralFeedback === false,
  diagnosticThresholdsFrozen:
    contract.classificationThresholds.minimumAbsoluteTopologyEffect === 0.1 &&
    contract.classificationThresholds.minimumRelativeTopologyEffect === 0.2 &&
    contract.classificationThresholds.minimumNormalizedValueIndexReduction === 0.2 &&
    contract.classificationThresholds.valueBindingIndex === 1 &&
    contract.classificationThresholds.minimumReplicatedPanelFrequency === 0.5 &&
    contract.classificationThresholds.bothValidationSeedsRequired === true &&
    contract.classificationThresholds.role ===
      'CAUSAL_DIAGNOSTIC_CLASSIFICATION_ONLY_NOT_PARAMETER_CALIBRATION',
  finalLabelSetExact:
    JSON.stringify(contract.finalClassificationRules.map((entry) => entry.label)) ===
      JSON.stringify([
        'TECHNICAL_INDETERMINATE',
        'TOPOLOGY_UPSTREAM_OF_VALUE_TRANSFORMATION',
        'VALUE_TRANSFORMATION_INDEPENDENT_OF_TOPOLOGY',
        'PARALLEL_ADDITIVE_BINDINGS',
        'TOPOLOGY_VALUE_INTERACTION',
        'COMMON_CAUSE_OR_UNRESOLVED'
      ]),
  technicalEvidenceFailClosed:
    contract.technicalEvidenceContract.exactObservedReplayRequired === true &&
    contract.technicalEvidenceContract.exactCounterfactualReplayRequired === true &&
    contract.technicalEvidenceContract.failedJobMayNotBeDropped === true &&
    contract.technicalEvidenceContract.postObservationThresholdMutationAuthorized === false,
  shadowBoundaryLocked:
    contract.shadowInterventionContract.isolatedDisposableCloneOnly === true &&
    contract.shadowInterventionContract.childContractRequiredBeforeAnyIntervention === true &&
    contract.shadowInterventionContract.productionOrCanonicalMutationAuthorized === false &&
    contract.shadowInterventionContract.canonicalSourceMutationAuthorized === false &&
    contract.shadowInterventionContract.candidateValueMutationAuthorized === false &&
    contract.shadowInterventionContract.scenarioMutationAuthorized === false &&
    contract.shadowInterventionContract.resultMayAuthorizeCanonicalMutation === false,
  canonicalAndRetuningLocksExact:
    contract.canonicalMutationAuthorized === false &&
    contract.directParameterCalibrationAuthorized === false &&
    contract.candidateRetuningAuthorized === false &&
    contract.sourceStage3.decisionReversalAuthorized === false,
  closureReceiptTextExact:
    closureText.includes('**MIXED / ROUTE R4-CU-D3D-B7-D0') &&
    closureText.includes('Source workflow run ID: `33371200438`') &&
    closureText.includes('Aggregate artifact ID: `9750222167`') &&
    closureText.includes('Observed jobs: `12/12`'),
  preregistrationTextExact:
    preregistrationText.includes('B7 CLOSED AS `MIXED`') &&
    preregistrationText.includes('EXECUTE D1 BEFORE D6') &&
    preregistrationText.includes('R4-CU-D3D-B7-D1 supplier-topology and reachable-inventory causal isolation') &&
    preregistrationText.includes('CANONICAL MUTATION NOT AUTHORIZED')
};

gates.ok = Object.values(gates).every(Boolean);
assert.equal(gates.ok, true, `R4-CU-D3D-B7-D0 preregistration gate failed: ${JSON.stringify(gates)}`);

const result = {
  schemaVersion: 'r4-cu-d3d-b7-d0-preregistration-gate-v0.1',
  front: contract.front,
  generatedAt: new Date().toISOString(),
  status: 'PASS_FROZEN_SEQUENCED_MIXED_CAUSAL_PREREGISTRATION',
  contract: {
    path: 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b7-d0-sequenced-mixed-causal-contract.json',
    sha256: sha256(contractText)
  },
  sourceB7: {
    closureCommit: contract.sourceB7.closureCommit,
    workflowRunId: contract.sourceB7.workflowRunId,
    workflowHeadSha: contract.sourceB7.workflowHeadSha,
    aggregateArtifactId: contract.sourceB7.aggregateArtifactId,
    aggregateArtifactDigest: contract.sourceB7.aggregateArtifactDigest,
    aggregateJsonSha256: sha256(aggregateText),
    decision: aggregate.decision,
    routing: aggregate.routing
  },
  frozenSequence: contract.sequence.map((entry) => ({
    order: entry.order,
    front: entry.front,
    name: entry.name
  })),
  dominantMechanisms: contract.authoritativeB7Finding.dominantMechanisms,
  gates,
  nextAuthorizedFront: contract.routing.afterPreregistrationPass,
  interpretation: {
    causalConclusionReached: false,
    candidateRetuningAuthorized: false,
    canonicalMutationAuthorized: false,
    directParameterCalibrationAuthorized: false
  }
};

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
console.log('WP_RV08_R4_CU_D3D_B7_D0_GATES', JSON.stringify(gates));
console.log(
  'WP_RV08_R4_CU_D3D_B7_D0_PREREGISTRATION',
  JSON.stringify({
    status: result.status,
    decision: result.sourceB7.decision,
    sequence: result.frozenSequence.map((entry) => entry.front),
    nextAuthorizedFront: result.nextAuthorizedFront,
    output: OUTPUT_PATH
  })
);
