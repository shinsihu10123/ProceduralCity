import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = process.cwd();
const CONTRACT_PATH = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b7-d1-supplier-topology-causal-contract.json');
const contractText = readFileSync(CONTRACT_PATH, 'utf8');
const contract = JSON.parse(contractText);
const inputRoot = resolve(process.env.INPUT_ROOT || '.');
const outputJson = resolve(process.env.OUTPUT_JSON || 'economic-lab/performance-results/r4-cu-d3d-b7-d1-aggregate.json');
const outputMd = process.env.OUTPUT_MD ? resolve(process.env.OUTPUT_MD) : null;
const EPS = 1e-9;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = (values) => values.reduce((total, value) => total + finite(value), 0);
const safeRatio = (numerator, denominator, fallback = 0) => Math.abs(finite(denominator)) > EPS ? finite(numerator) / finite(denominator) : fallback;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const fmt = (value, digits = 6) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : 'NA';

function walk(path) {
  const output = [];
  for (const name of readdirSync(path)) {
    const full = resolve(path, name);
    if (statSync(full).isDirectory()) output.push(...walk(full));
    else output.push(full);
  }
  return output;
}

function cellKey(candidateId, seed, scenarioId, cellId) {
  return `${candidateId}@@${seed}@@${scenarioId}@@${cellId}`;
}

function panelKey(candidateId, seed, scenarioId, windowId) {
  return `${candidateId}@@${seed}@@${scenarioId}@@${windowId}`;
}

function windowMetrics(record, window) {
  const rows = (record?.diagnostics?.rows || []).filter(
    (row) => row.month >= window.startMonth && row.month <= window.endMonth
  );
  const countryCount = record?.diagnostics?.expectedCountries?.length || 0;
  const expectedRows = (window.endMonth - window.startMonth + 1) * countryCount;
  const plannedInputNeedUnits = sum(rows.map((row) => row.procurement?.plannedInputNeedUnits));
  const purchasedInputUnits = sum(rows.map((row) => row.procurement?.purchasedInputUnits));
  const inputShortageUnits = sum(rows.map((row) => row.procurement?.inputShortageUnits));
  const topologyAttributedShortageUnits = sum(rows.map((row) => row.procurement?.topologyAttributedShortageUnits));
  const cashAttributedShortageUnits = sum(rows.map((row) => row.procurement?.cashAttributedShortageUnits));
  const searchExecutionAttributedShortageUnits = sum(
    rows.map((row) => row.procurement?.searchExecutionAttributedShortageUnits)
  );
  const activeFirmExposure = sum(rows.map((row) => row.closing?.activeFirms));
  const nominalPurchasingPower = sum(rows.map((row) => row.sourceMacro?.nominalPurchasingPower));
  const salesRevenueBook = sum(rows.map((row) => row.closing?.salesRevenueBook));
  const salesRevenueAtOrBelowBookCost = sum(
    rows.map((row) => row.closing?.salesRevenueAtOrBelowBookCost)
  );
  const nonPositiveGvaCountryMonthShare = safeRatio(
    rows.filter((row) => row.closing?.nonPositiveGva === true || finite(row.closing?.gvaBasicProduction) <= EPS).length,
    rows.length,
    0
  );
  const belowCostRevenueShare = safeRatio(salesRevenueAtOrBelowBookCost, salesRevenueBook, 0);
  const normalizedValuePathologyIndex = Math.max(
    safeRatio(nonPositiveGvaCountryMonthShare, 0.25, 0),
    safeRatio(belowCostRevenueShare, 0.5, 0)
  );
  return {
    rowCount: rows.length,
    expectedRows,
    complete: rows.length === expectedRows && expectedRows > 0,
    plannedInputNeedUnits,
    purchasedInputUnits,
    inputShortageUnits,
    inputShortageRate: safeRatio(inputShortageUnits, plannedInputNeedUnits, 0),
    topologyAttributedShortageUnits,
    cashAttributedShortageUnits,
    searchExecutionAttributedShortageUnits,
    topologyShareOfShortage: safeRatio(topologyAttributedShortageUnits, inputShortageUnits, 0),
    cashShareOfShortage: safeRatio(cashAttributedShortageUnits, inputShortageUnits, 0),
    searchExecutionResidualShare: safeRatio(searchExecutionAttributedShortageUnits, inputShortageUnits, 0),
    activeFirmExposure,
    nominalPurchasingPower,
    nonPositiveGvaCountryMonthShare,
    salesRevenueBook,
    salesRevenueAtOrBelowBookCost,
    belowCostRevenueShare,
    normalizedValuePathologyIndex
  };
}

assert.equal(contract.schemaVersion, '1.0');
assert.equal(contract.front, 'R4-CU-D3D-B7-D1');
assert.equal(contract.status, 'FROZEN_BEFORE_TOPOLOGY_COUNTERFACTUAL_EXECUTION');
assert.equal(contract.sourceD0.decision, 'SEQUENCED_MIXED_CAUSAL_PREREGISTRATION_PASSED');
assert.equal(contract.canonicalMutationAuthorized, false);
assert.equal(contract.candidateRetuningAuthorized, false);
assert.ok(statSync(inputRoot).isDirectory(), `Missing D1 input root ${inputRoot}`);

const candidates = contract.frozenPanel.candidates;
const candidateIds = candidates.map((entry) => entry.id);
const controlId = candidates.find((entry) => entry.control === true)?.id;
const primaryId = candidates.find((entry) => entry.control !== true)?.id;
const seeds = contract.frozenPanel.validationSeeds.map((entry) => entry.seed);
const scenarios = contract.frozenPanel.scenarios;
const scenarioIds = scenarios.map((entry) => entry.id);
const windows = contract.frozenPanel.windows;
const cellIds = contract.cells.map((entry) => entry.id);
const thresholds = contract.classificationThresholds;
const expectedCellCount = contract.frozenPanel.jobs * contract.frozenPanel.cellsPerJob;
const expectedKeys = candidateIds.flatMap((candidateId) =>
  seeds.flatMap((seed) =>
    scenarioIds.flatMap((scenarioId) => cellIds.map((cellId) => cellKey(candidateId, seed, scenarioId, cellId)))
  )
);

const files = walk(inputRoot).filter((path) => path.endsWith('.json'));
const records = [];
const invalidJsonFiles = [];
for (const file of files) {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    if (parsed.front === contract.front && parsed.schemaVersion === 'r4-cu-d3d-b7-d1-cell-result-v0.1') {
      records.push({ ...parsed, __file: file });
    }
  } catch (error) {
    invalidJsonFiles.push({ file, message: error.message });
  }
}

const observedKeys = records.map((entry) =>
  cellKey(entry.candidate?.id, entry.seed, entry.scenario?.id, entry.cell?.id)
);
const duplicateKeys = observedKeys.filter((entry, index) => observedKeys.indexOf(entry) !== index);
const recordMap = new Map(records.map((entry) => [
  cellKey(entry.candidate?.id, entry.seed, entry.scenario?.id, entry.cell?.id),
  entry
]));
const missingKeys = expectedKeys.filter((entry) => !recordMap.has(entry));
const unexpectedKeys = observedKeys.filter((entry) => !expectedKeys.includes(entry));

const pairEvaluations = [];
for (const candidateId of candidateIds) {
  for (const seed of seeds) {
    for (const scenario of scenarios) {
      const observed = recordMap.get(cellKey(candidateId, seed, scenario.id, 'O')) || null;
      const topology = recordMap.get(cellKey(candidateId, seed, scenario.id, 'T')) || null;
      const initialIdentityExact = Boolean(
        observed?.initialPanelIdentity?.sha256 &&
        topology?.initialPanelIdentity?.sha256 &&
        observed.initialPanelIdentity.sha256 === topology.initialPanelIdentity.sha256
      );
      const windowEvaluations = windows.map((window) => {
        const O = windowMetrics(observed, window);
        const T = windowMetrics(topology, window);
        const absoluteTopologyEffect = O.inputShortageRate - T.inputShortageRate;
        const relativeTopologyEffect = safeRatio(
          absoluteTopologyEffect,
          Math.max(O.inputShortageRate, EPS),
          0
        );
        const valueEffectOfTopology = O.normalizedValuePathologyIndex - T.normalizedValuePathologyIndex;
        const activeFirmRatio = safeRatio(T.activeFirmExposure, O.activeFirmExposure, 0);
        const purchasingPowerRatio = safeRatio(T.nominalPurchasingPower, O.nominalPurchasingPower, 0);
        const effectThresholdsPassed =
          absoluteTopologyEffect + EPS >= thresholds.minimumAbsoluteTopologyEffect &&
          relativeTopologyEffect + EPS >= thresholds.minimumRelativeTopologyEffect;
        const searchResidualPassed =
          T.searchExecutionResidualShare <= thresholds.maximumSearchExecutionResidualShareT + EPS;
        const activeFirmPreserved = activeFirmRatio + EPS >= thresholds.minimumActiveFirmRatio;
        const purchasingPowerPreserved = purchasingPowerRatio + EPS >= thresholds.minimumPurchasingPowerRatio;
        const valueReductionPassed =
          valueEffectOfTopology + EPS >= thresholds.minimumNormalizedValueIndexReduction;
        return {
          window,
          complete: O.complete && T.complete,
          initialIdentityExact,
          O,
          T,
          estimands: {
            absoluteTopologyEffect,
            relativeTopologyEffect,
            searchExecutionResidualShareT: T.searchExecutionResidualShare,
            valueEffectOfTopology,
            activeFirmRatio,
            purchasingPowerRatio
          },
          conditions: {
            effectThresholdsPassed,
            searchResidualPassed,
            activeFirmPreserved,
            purchasingPowerPreserved,
            valueReductionPassed,
            oppositeSign: absoluteTopologyEffect < -EPS
          }
        };
      });
      pairEvaluations.push({
        candidateId,
        control: candidateId === controlId,
        seed,
        scenario: { id: scenario.id, role: scenario.role },
        cellsPresent: Boolean(observed && topology),
        initialIdentityExact,
        windows: windowEvaluations
      });
    }
  }
}

const allPanels = pairEvaluations.flatMap((pair) =>
  pair.windows.map((window) => ({
    candidateId: pair.candidateId,
    control: pair.control,
    seed: pair.seed,
    scenario: pair.scenario,
    ...window
  }))
);
const panelMap = new Map(allPanels.map((panel) => [
  panelKey(panel.candidateId, panel.seed, panel.scenario.id, panel.window.id),
  panel
]));
const primaryPanels = allPanels.filter((panel) => panel.candidateId === primaryId);
const controlPanels = allPanels.filter((panel) => panel.candidateId === controlId);

const pairedContrasts = primaryPanels.map((primary) => {
  const control = panelMap.get(panelKey(controlId, primary.seed, primary.scenario.id, primary.window.id));
  const candidateSpecificDifferential = control
    ? primary.estimands.absoluteTopologyEffect - control.estimands.absoluteTopologyEffect
    : null;
  return {
    seed: primary.seed,
    scenario: primary.scenario,
    window: primary.window,
    primaryAbsoluteTopologyEffect: primary.estimands.absoluteTopologyEffect,
    controlAbsoluteTopologyEffect: control?.estimands.absoluteTopologyEffect ?? null,
    candidateSpecificDifferential,
    thresholdPassed:
      Number.isFinite(candidateSpecificDifferential) &&
      candidateSpecificDifferential + EPS >= thresholds.minimumCandidateSpecificDifferential
  };
});

const primaryEffectPanels = primaryPanels.filter((panel) => panel.conditions.effectThresholdsPassed).length;
const controlEffectPanels = controlPanels.filter((panel) => panel.conditions.effectThresholdsPassed).length;
const primaryEffectFrequency = safeRatio(primaryEffectPanels, primaryPanels.length, 0);
const controlEffectFrequency = safeRatio(controlEffectPanels, controlPanels.length, 0);
const primaryOppositeSignPanels = primaryPanels.filter((panel) => panel.conditions.oppositeSign).length;
const primaryOppositeSignFrequency = safeRatio(primaryOppositeSignPanels, primaryPanels.length, 0);
const bothSeedsRepresented = seeds.every((seed) =>
  primaryPanels.some((panel) => panel.seed === seed && panel.conditions.effectThresholdsPassed)
);
const allPrimarySearchResidualsPassed = primaryPanels.every((panel) => panel.conditions.searchResidualPassed);
const allPrimaryActiveFirmGatesPassed = primaryPanels.every((panel) => panel.conditions.activeFirmPreserved);
const allPrimaryPurchasingPowerGatesPassed = primaryPanels.every(
  (panel) => panel.conditions.purchasingPowerPreserved
);
const primarySpecificDifferentialPanels = pairedContrasts.filter((entry) => entry.thresholdPassed).length;
const primarySpecificDifferentialFrequency = safeRatio(
  primarySpecificDifferentialPanels,
  pairedContrasts.length,
  0
);
const primaryValueReductionPanels = primaryPanels.filter((panel) => panel.conditions.valueReductionPassed).length;
const primaryValueReductionFrequency = safeRatio(primaryValueReductionPanels, primaryPanels.length, 0);

const recordRowsHashValid = (record) =>
  record?.diagnostics?.rowsSha256 === sha256(JSON.stringify(record?.diagnostics?.rows || []));
const interventionRowsHashValid = (record) =>
  record.cell?.id !== 'T' ||
  record?.intervention?.rowsSha256 === sha256(JSON.stringify(record?.intervention?.rows || []));

const technicalGates = {
  contractExact:
    contract.front === 'R4-CU-D3D-B7-D1' &&
    contract.status === 'FROZEN_BEFORE_TOPOLOGY_COUNTERFACTUAL_EXECUTION',
  sourceD0Passed: contract.sourceD0.decision === 'SEQUENCED_MIXED_CAUSAL_PREREGISTRATION_PASSED',
  candidatePanelExact: JSON.stringify(candidateIds) === JSON.stringify(['V1_M1_C42', 'V24_M16_C42']),
  validationSeedPanelExact: JSON.stringify(seeds) === JSON.stringify(['ECON-RV08-LONG-G', 'ECON-RV08-LONG-H']),
  scenarioPanelExact: scenarioIds.length === 3 && new Set(scenarioIds).size === 3,
  windowPanelExact:
    JSON.stringify(windows.map((entry) => entry.id)) ===
    JSON.stringify(['FULL_36', 'PRE_SHOCK_12', 'TRANSITION_12', 'TERMINAL_12']),
  cellPanelExact: JSON.stringify(cellIds) === JSON.stringify(['O', 'T']),
  expectedJobAndCellCount:
    contract.frozenPanel.jobs === candidateIds.length * seeds.length * scenarioIds.length &&
    expectedCellCount === expectedKeys.length &&
    contract.frozenPanel.totalModelReplayStates === expectedCellCount * 2,
  completeCellResultCount: records.length === expectedCellCount,
  noDuplicateCells: duplicateKeys.length === 0,
  noMissingCells: missingKeys.length === 0,
  noUnexpectedCells: unexpectedKeys.length === 0,
  noInvalidJsonInputs: invalidJsonFiles.length === 0,
  allPairsPresent: pairEvaluations.every((pair) => pair.cellsPresent),
  allCellEnvelopesPassed: records.every((entry) => entry.gates?.ok === true),
  allSourceEngineIntegrityPassed: records.every((entry) => entry.gates?.sourceEngineIntegrityPassed === true),
  allModelAndObserverReplaysExact: records.every((entry) =>
    entry.gates?.exactModelReplayPassed === true &&
    entry.gates?.observerReplayExact === true &&
    entry.gates?.observerReplayStateCountExact === true
  ),
  allTopologyInterventionReplaysExact: records
    .filter((entry) => entry.cell?.id === 'T')
    .every((entry) => entry.gates?.interventionReplayExact === true && entry.gates?.interventionReplayStateCountExact === true),
  allScenarioSchedulesExact: records.every((entry) => entry.gates?.scenarioScheduleExact === true),
  allAccountingHealthy: records.every((entry) => entry.gates?.hardAccountingHealthy === true),
  allProtectedSurfacesExact: records.every((entry) => entry.gates?.protectedSurfaceExact === true),
  allInitialPanelsIdentical: pairEvaluations.every((pair) => pair.initialIdentityExact === true),
  allCountryMonthPanelsComplete: records.every((entry) => entry.gates?.completeCountryMonthPanel === true),
  allWindowPanelsComplete: allPanels.every((panel) => panel.complete === true),
  allDiagnosticRowsHashesValid: records.every(recordRowsHashValid),
  allInterventionRowsHashesValid: records.every(interventionRowsHashValid),
  allBoundaryInvariantsExact: records
    .filter((entry) => entry.cell?.id === 'T')
    .every((entry) => entry.gates?.interventionBoundaryExact === true && entry.gates?.canonicalTwinExcluded === true),
  allConservationIdentitiesExact: records
    .filter((entry) => entry.cell?.id === 'T')
    .every((entry) => entry.gates?.interventionConservationExact === true),
  allShortageAttributionsReconcile: records.every((entry) => entry.gates?.shortageAttributionReconciles === true),
  allGvaApproachesReconcile: records.every((entry) => entry.gates?.gvaApproachesReconcile === true),
  observedCellsRemainUnintervened: records
    .filter((entry) => entry.cell?.id === 'O')
    .every((entry) => entry.gates?.observedCellHasNoIntervention === true && entry.intervention === null),
  topologyCellsUseFrozenIntervention: records
    .filter((entry) => entry.cell?.id === 'T')
    .every((entry) =>
      entry.gates?.topologyCellInterventionPresent === true &&
      entry.gates?.interventionConfigHashValid === true &&
      entry.gates?.frozenSellerCostRuleExact === true &&
      entry.intervention?.interventionId === contract.intervention.id
    ),
  failedJobsNotDropped: records.length === expectedCellCount && missingKeys.length === 0,
  thresholdsFrozen:
    thresholds.role === 'CAUSAL_DIAGNOSTIC_CLASSIFICATION_ONLY_NOT_PARAMETER_CALIBRATION',
  canonicalMutationLocked:
    contract.canonicalMutationAuthorized === false &&
    contract.directParameterCalibrationAuthorized === false &&
    contract.candidateRetuningAuthorized === false &&
    records.every((entry) => entry.interpretation?.canonicalMutationAuthorized === false)
};
technicalGates.ok = Object.values(technicalGates).every(Boolean);

const causalConditions = {
  minimumReplicatedPanelFrequency:
    primaryEffectFrequency + EPS >= thresholds.minimumReplicatedPanelFrequency,
  maximumOppositeSignPanelFrequency:
    primaryOppositeSignFrequency <= thresholds.maximumOppositeSignPanelFrequency + EPS,
  bothValidationSeedsRequired: !thresholds.bothValidationSeedsRequired || bothSeedsRepresented,
  maximumSearchExecutionResidualShareT: allPrimarySearchResidualsPassed,
  minimumActiveFirmRatio: allPrimaryActiveFirmGatesPassed,
  minimumPurchasingPowerRatio: allPrimaryPurchasingPowerGatesPassed
};
const causalRulePassed = Object.values(causalConditions).every(Boolean);
const decision = !technicalGates.ok
  ? 'TOPOLOGY_INDETERMINATE'
  : causalRulePassed
    ? 'TOPOLOGY_CAUSAL'
    : 'TOPOLOGY_NONCAUSAL';

let detailLabel = null;
if (decision === 'TOPOLOGY_CAUSAL') {
  if (primarySpecificDifferentialFrequency + EPS >= thresholds.minimumReplicatedPanelFrequency) {
    detailLabel = 'PRIMARY_SPECIFIC_TOPOLOGY_EFFECT';
  } else if (controlEffectFrequency + EPS >= thresholds.minimumReplicatedPanelFrequency) {
    detailLabel = 'COMMON_TOPOLOGY_EFFECT';
  }
} else if (decision === 'TOPOLOGY_NONCAUSAL') {
  detailLabel = 'NO_REPLICATED_TOPOLOGY_EFFECT';
}

const routing = technicalGates.ok
  ? contract.routing.afterTechnicalPass
  : contract.routing.afterTechnicalFailure;
const effectSummary = {
  primary: {
    qualifyingPanels: primaryEffectPanels,
    totalPanels: primaryPanels.length,
    replicatedPanelFrequency: primaryEffectFrequency,
    oppositeSignPanels: primaryOppositeSignPanels,
    oppositeSignPanelFrequency: primaryOppositeSignFrequency,
    bothSeedsRepresented,
    allSearchResidualsPassed: allPrimarySearchResidualsPassed,
    allActiveFirmGatesPassed: allPrimaryActiveFirmGatesPassed,
    allPurchasingPowerGatesPassed: allPrimaryPurchasingPowerGatesPassed,
    valueReductionPanels: primaryValueReductionPanels,
    valueReductionFrequency: primaryValueReductionFrequency
  },
  control: {
    qualifyingPanels: controlEffectPanels,
    totalPanels: controlPanels.length,
    replicatedPanelFrequency: controlEffectFrequency
  },
  candidateSpecific: {
    qualifyingPanels: primarySpecificDifferentialPanels,
    totalPanels: pairedContrasts.length,
    replicatedPanelFrequency: primarySpecificDifferentialFrequency
  }
};

const result = {
  schemaVersion: 'r4-cu-d3d-b7-d1-aggregate-v0.1',
  front: contract.front,
  generatedAt: new Date().toISOString(),
  status: technicalGates.ok
    ? 'PASS_TECHNICAL_D1_CAUSAL_AGGREGATION'
    : 'FAIL_TECHNICAL_D1_CAUSAL_AGGREGATION',
  decision,
  detailLabel,
  routing,
  technicalGates,
  causalConditions,
  causalRulePassed: technicalGates.ok && causalRulePassed,
  contract: {
    path: 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b7-d1-supplier-topology-causal-contract.json',
    sha256: sha256(contractText)
  },
  sourceD0: contract.sourceD0,
  sourceB7: contract.sourceB7,
  expected: {
    jobs: contract.frozenPanel.jobs,
    cells: expectedCellCount,
    modelReplayStates: contract.frozenPanel.totalModelReplayStates,
    panelsPerCandidate: seeds.length * scenarios.length * windows.length
  },
  observed: {
    cellResults: records.length,
    duplicateKeys,
    missingKeys,
    unexpectedKeys,
    invalidJsonFiles
  },
  thresholds,
  effectSummary,
  pairedContrasts,
  pairEvaluations,
  interpretation: {
    purpose: 'SUPPLIER_TOPOLOGY_CAUSAL_ISOLATION_ONLY',
    observedCellRemainsCanonicalPath: true,
    topologyCellIsDisposableCounterfactual: true,
    valueSentinelIsDownstreamEvidenceOnly: true,
    candidateRetuningAuthorized: false,
    thresholdRelaxationAuthorized: false,
    canonicalMutationAuthorized: false,
    nextFrontAfterTechnicalPass: 'R4-CU-D3D-B7-D6 over both O and T traces'
  }
};

mkdirSync(dirname(outputJson), { recursive: true });
writeFileSync(outputJson, JSON.stringify(result, null, 2));

if (outputMd) {
  const gateRows = Object.entries(technicalGates)
    .filter(([key]) => key !== 'ok')
    .map(([key, value]) => `| ${key} | ${value ? 'PASS' : 'FAIL'} |`)
    .join('\n');
  const conditionRows = Object.entries(causalConditions)
    .map(([key, value]) => `| ${key} | ${value ? 'PASS' : 'FAIL'} |`)
    .join('\n');
  const panelRows = allPanels.map((panel) =>
    `| ${panel.candidateId} | ${panel.seed} | ${panel.scenario.id} | ${panel.window.id} | ${fmt(panel.O.inputShortageRate)} | ${fmt(panel.T.inputShortageRate)} | ${fmt(panel.estimands.absoluteTopologyEffect)} | ${fmt(panel.estimands.relativeTopologyEffect)} | ${fmt(panel.estimands.searchExecutionResidualShareT, 9)} | ${fmt(panel.estimands.activeFirmRatio)} | ${fmt(panel.estimands.purchasingPowerRatio)} | ${fmt(panel.estimands.valueEffectOfTopology)} | ${panel.conditions.effectThresholdsPassed ? 'YES' : 'NO'} |`
  ).join('\n');
  const markdown = `# R4-CU-D3D-B7-D1 Supplier Topology Causal Isolation\n\n## Decision\n\n**${decision}${detailLabel ? ` / ${detailLabel}` : ''}**\n\n- Technical status: \`${result.status}\`\n- Primary qualifying panels: ${primaryEffectPanels}/${primaryPanels.length} (${fmt(primaryEffectFrequency)})\n- Control qualifying panels: ${controlEffectPanels}/${controlPanels.length} (${fmt(controlEffectFrequency)})\n- Primary-specific differential panels: ${primarySpecificDifferentialPanels}/${pairedContrasts.length} (${fmt(primarySpecificDifferentialFrequency)})\n- Primary opposite-sign panels: ${primaryOppositeSignPanels}/${primaryPanels.length} (${fmt(primaryOppositeSignFrequency)})\n- Value-index reduction panels: ${primaryValueReductionPanels}/${primaryPanels.length} (${fmt(primaryValueReductionFrequency)})\n- Routing: \`${routing}\`\n- Canonical mutation authorized: **NO**\n\n## Causal classification conditions\n\n| Condition | Result |\n|---|---:|\n${conditionRows}\n\n## Candidate × seed × scenario × window estimands\n\n| Candidate | Seed | Scenario | Window | O shortage | T shortage | Absolute effect | Relative effect | T search residual | Active-firm ratio | Purchasing-power ratio | Value-index effect | Effect thresholds |\n|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n${panelRows}\n\n## Technical gates\n\n| Gate | Result |\n|---|---:|\n${gateRows}\n\n## Interpretation boundary\n\nCell T is a disposable exhaustive compatible-supplier traversal. This result neither changes the canonical procurement rule nor authorizes candidate retuning. After a technical pass, D6 must evaluate the value-transformation path over both O and T traces before any later policy or production proposal.\n`;
  mkdirSync(dirname(outputMd), { recursive: true });
  writeFileSync(outputMd, markdown);
}

console.log('WP_RV08_R4_CU_D3D_B7_D1_AGGREGATE', JSON.stringify({
  status: result.status,
  decision,
  detailLabel,
  technicalGateOk: technicalGates.ok,
  causalRulePassed: result.causalRulePassed,
  primaryEffectFrequency,
  controlEffectFrequency,
  primarySpecificDifferentialFrequency,
  routing,
  outputJson,
  outputMd
}));

if (!technicalGates.ok) process.exitCode = 1;
