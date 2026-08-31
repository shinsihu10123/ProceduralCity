import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = process.cwd();
const CONTRACT_PATH = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b7-demand-inventory-topology-contract.json');
const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
const inputRoot = resolve(process.env.INPUT_ROOT || '.');
const outputJson = resolve(process.env.OUTPUT_JSON || 'economic-lab/performance-results/r4-cu-d3d-b7-aggregate.json');
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

function jobKey(candidateId, seed, scenarioId) {
  return `${candidateId}@@${seed}@@${scenarioId}`;
}

function rowCondition(row, label, thresholds) {
  const shortageRate = finite(row.procurement?.shortageRate);
  const topologyShare = finite(row.procurement?.topologyShareOfShortage);
  const cashShare = finite(row.procurement?.cashShareOfShortage);
  const searchShare = finite(row.procurement?.searchExecutionShareOfShortage);
  const salesToPlan = finite(row.closing?.salesToPlanRatio, 1);
  const inventoryAboveTarget = finite(row.closing?.inventoryAboveTargetRatio);
  const goodsUnmetShare = finite(row.goods?.unmetShare);
  const unmetWithInventory = finite(row.goods?.unmetWithEndingInventory);
  const unmetBudget = finite(row.goods?.unmetBudget);
  const nonPositiveGva = row.closing?.nonPositiveGva === true || finite(row.closing?.gvaBasicProduction) <= EPS;
  const belowCostRevenueShare = finite(row.closing?.belowCostRevenueShare);

  if (label === 'INPUT_SUPPLIER_TOPOLOGY_BINDING') {
    return shortageRate >= thresholds.minimumInputShortageRateForBindingClassification &&
      topologyShare >= thresholds.dominantAttributedShortageShare;
  }
  if (label === 'INPUT_CASH_BUDGET_BINDING') {
    return shortageRate >= thresholds.minimumInputShortageRateForBindingClassification &&
      cashShare >= thresholds.dominantAttributedShortageShare;
  }
  if (label === 'INPUT_SEARCH_EXECUTION_BINDING') {
    return shortageRate >= thresholds.minimumInputShortageRateForBindingClassification &&
      searchShare >= thresholds.dominantAttributedShortageShare;
  }
  if (label === 'DEMAND_INVENTORY_MISMATCH') {
    return salesToPlan <= thresholds.lowSalesToPlanRatio &&
      inventoryAboveTarget >= thresholds.highInventoryAboveTargetRatio &&
      shortageRate <= thresholds.maximumInputShortageRateForDemandInventoryClassification;
  }
  if (label === 'GOODS_MARKET_MATCHING_BINDING') {
    return goodsUnmetShare >= thresholds.highGoodsUnmetShare &&
      unmetBudget > EPS && unmetWithInventory / unmetBudget >= thresholds.minimumUnmetBudgetWithInventoryShare;
  }
  if (label === 'VALUE_TRANSFORMATION_BINDING') {
    return nonPositiveGva || belowCostRevenueShare >= thresholds.highBelowCostRevenueShare;
  }
  return false;
}

function sustainedCountries(rows, label, thresholds) {
  const byCountry = new Map();
  for (const row of rows) {
    if (!byCountry.has(row.countryId)) byCountry.set(row.countryId, []);
    byCountry.get(row.countryId).push(row);
  }
  const sustained = [];
  for (const [countryId, countryRows] of byCountry) {
    const sorted = countryRows.slice().sort((a, b) => a.month - b.month);
    let run = 0;
    let previousMonth = null;
    let onsetMonth = null;
    for (const row of sorted) {
      const active = rowCondition(row, label, thresholds);
      if (active && previousMonth !== null && row.month === previousMonth + 1) run += 1;
      else run = active ? 1 : 0;
      previousMonth = row.month;
      if (run >= thresholds.sustainedOnsetMonths) {
        onsetMonth = row.month - thresholds.sustainedOnsetMonths + 1;
        break;
      }
    }
    if (onsetMonth !== null) sustained.push({ countryId, onsetMonth });
  }
  return { countryCount: byCountry.size, sustained };
}

function summarizeWindow(rows, thresholds, labels) {
  const plannedInputNeedUnits = sum(rows.map((row) => row.procurement?.plannedInputNeedUnits));
  const inputShortageUnits = sum(rows.map((row) => row.procurement?.inputShortageUnits));
  const topologyAttributedShortageUnits = sum(rows.map((row) => row.procurement?.topologyAttributedShortageUnits));
  const cashAttributedShortageUnits = sum(rows.map((row) => row.procurement?.cashAttributedShortageUnits));
  const searchExecutionAttributedShortageUnits = sum(rows.map((row) => row.procurement?.searchExecutionAttributedShortageUnits));
  const plannedProductionUnits = sum(rows.map((row) => row.plan?.desiredProductionUnits));
  const salesUnits = sum(rows.map((row) => row.closing?.salesUnits));
  const targetInventoryUnits = sum(rows.map((row) => row.closing?.targetInventoryUnits));
  const inventoryAboveTargetUnits = sum(rows.map((row) => row.closing?.inventoryAboveTargetUnits));
  const goodsDesiredBudget = sum(rows.map((row) => row.goods?.desiredBudget));
  const goodsUnmetBudget = sum(rows.map((row) => row.goods?.unmetBudget));
  const goodsUnmetWithEndingInventory = sum(rows.map((row) => row.goods?.unmetWithEndingInventory));
  const salesRevenueBook = sum(rows.map((row) => row.closing?.salesRevenueBook));
  const salesRevenueAtOrBelowBookCost = sum(rows.map((row) => row.closing?.salesRevenueAtOrBelowBookCost));
  const metrics = {
    rows: rows.length,
    countries: new Set(rows.map((row) => row.countryId)).size,
    plannedInputNeedUnits,
    inputShortageUnits,
    inputShortageRate: safeRatio(inputShortageUnits, plannedInputNeedUnits, 0),
    topologyAttributedShortageUnits,
    cashAttributedShortageUnits,
    searchExecutionAttributedShortageUnits,
    topologyShareOfShortage: safeRatio(topologyAttributedShortageUnits, inputShortageUnits, 0),
    cashShareOfShortage: safeRatio(cashAttributedShortageUnits, inputShortageUnits, 0),
    searchExecutionShareOfShortage: safeRatio(searchExecutionAttributedShortageUnits, inputShortageUnits, 0),
    plannedProductionUnits,
    salesUnits,
    salesToPlanRatio: safeRatio(salesUnits, plannedProductionUnits, 1),
    targetInventoryUnits,
    inventoryAboveTargetUnits,
    inventoryAboveTargetRatio: safeRatio(inventoryAboveTargetUnits, targetInventoryUnits, 0),
    goodsDesiredBudget,
    goodsUnmetBudget,
    goodsUnmetShare: safeRatio(goodsUnmetBudget, goodsDesiredBudget, 0),
    goodsUnmetWithEndingInventory,
    unmetBudgetWithInventoryShare: safeRatio(goodsUnmetWithEndingInventory, goodsUnmetBudget, 0),
    nonPositiveGvaCountryMonthShare: safeRatio(rows.filter((row) => row.closing?.nonPositiveGva === true || finite(row.closing?.gvaBasicProduction) <= EPS).length, rows.length, 0),
    salesRevenueBook,
    salesRevenueAtOrBelowBookCost,
    belowCostRevenueShare: safeRatio(salesRevenueAtOrBelowBookCost, salesRevenueBook, 0)
  };

  const aggregateThresholds = {
    INPUT_SUPPLIER_TOPOLOGY_BINDING:
      metrics.inputShortageRate >= thresholds.minimumInputShortageRateForBindingClassification &&
      metrics.topologyShareOfShortage >= thresholds.dominantAttributedShortageShare,
    INPUT_CASH_BUDGET_BINDING:
      metrics.inputShortageRate >= thresholds.minimumInputShortageRateForBindingClassification &&
      metrics.cashShareOfShortage >= thresholds.dominantAttributedShortageShare,
    INPUT_SEARCH_EXECUTION_BINDING:
      metrics.inputShortageRate >= thresholds.minimumInputShortageRateForBindingClassification &&
      metrics.searchExecutionShareOfShortage >= thresholds.dominantAttributedShortageShare,
    DEMAND_INVENTORY_MISMATCH:
      metrics.salesToPlanRatio <= thresholds.lowSalesToPlanRatio &&
      metrics.inventoryAboveTargetRatio >= thresholds.highInventoryAboveTargetRatio &&
      metrics.inputShortageRate <= thresholds.maximumInputShortageRateForDemandInventoryClassification,
    GOODS_MARKET_MATCHING_BINDING:
      metrics.goodsUnmetShare >= thresholds.highGoodsUnmetShare &&
      metrics.unmetBudgetWithInventoryShare >= thresholds.minimumUnmetBudgetWithInventoryShare,
    VALUE_TRANSFORMATION_BINDING:
      metrics.nonPositiveGvaCountryMonthShare >= thresholds.highNonPositiveGvaCountryMonthShare ||
      metrics.belowCostRevenueShare >= thresholds.highBelowCostRevenueShare
  };

  const mechanisms = {};
  for (const label of labels) {
    const rowMatches = rows.filter((row) => rowCondition(row, label, thresholds)).length;
    const sustained = sustainedCountries(rows, label, thresholds);
    mechanisms[label] = {
      aggregateThresholdMet: aggregateThresholds[label] === true,
      matchingRows: rowMatches,
      rowFrequency: safeRatio(rowMatches, rows.length, 0),
      sustainedCountryCount: sustained.sustained.length,
      sustainedCountryFrequency: safeRatio(sustained.sustained.length, sustained.countryCount, 0),
      sustainedOnsets: sustained.sustained,
      qualified: aggregateThresholds[label] === true && sustained.sustained.length > 0
    };
  }

  return { metrics, mechanisms, qualifiedLabels: labels.filter((label) => mechanisms[label].qualified) };
}

assert.equal(contract.schemaVersion, '1.0');
assert.equal(contract.front, 'R4-CU-D3D-B7');
assert.equal(contract.status, 'FROZEN_BEFORE_DIAGNOSTIC_EXECUTION');
assert.equal(contract.sourceStage3.decision, 'LONG_HORIZON_OR_STRESS_VALIDATION_FAILED_NO_RETUNING');
assert.equal(contract.canonicalMutationAuthorized, false);
assert.equal(contract.directParameterCalibrationAuthorized, false);
assert.ok(statSync(inputRoot).isDirectory(), `Missing B7 input root ${inputRoot}`);

const candidateIds = contract.candidatePanel.map((entry) => entry.id);
const controlId = contract.candidatePanel.find((entry) => entry.control === true)?.id;
const primaryId = contract.sourceStage3.primaryCandidateId;
const seeds = contract.execution.validationSeeds.map((entry) => entry.seed);
const scenarios = contract.execution.scenarios;
const scenarioIds = scenarios.map((entry) => entry.id);
const windows = contract.execution.windows;
const thresholds = contract.diagnosticThresholds;
const labels = contract.mechanismLabels;
const expectedJobs = contract.execution.candidateSeedScenarioJobs;
const expectedKeys = candidateIds.flatMap((candidateId) => seeds.flatMap((seed) => scenarioIds.map((scenarioId) => jobKey(candidateId, seed, scenarioId))));

const files = walk(inputRoot)
  .filter((path) => /r4-cu-d3d-b7-.*\.json$/i.test(path))
  .filter((path) => !path.endsWith('aggregate.json'));
const records = [];
for (const file of files) {
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  if (parsed.front === contract.front && parsed.schemaVersion === 'r4-cu-d3d-b7-demand-inventory-topology-diagnostic-v0.1') {
    records.push({ ...parsed, __file: file });
  }
}

const observedKeys = records.map((entry) => jobKey(entry.candidate?.id, entry.seed, entry.scenario?.id));
const duplicateKeys = observedKeys.filter((entry, index) => observedKeys.indexOf(entry) !== index);
const recordMap = new Map(records.map((entry) => [jobKey(entry.candidate.id, entry.seed, entry.scenario.id), entry]));
const missingKeys = expectedKeys.filter((entry) => !recordMap.has(entry));
const unexpectedKeys = observedKeys.filter((entry) => !expectedKeys.includes(entry));

const panelEvaluations = [];
for (const record of records) {
  const scenario = scenarios.find((entry) => entry.id === record.scenario.id);
  const windowEvaluations = windows.map((window) => {
    const rows = record.diagnostics.rows.filter((row) => row.month >= window.startMonth && row.month <= window.endMonth);
    const expectedRows = (window.endMonth - window.startMonth + 1) * record.diagnostics.expectedCountries.length;
    const summary = summarizeWindow(rows, thresholds, labels);
    return {
      window,
      rowCount: rows.length,
      expectedRows,
      complete: rows.length === expectedRows,
      ...summary
    };
  });
  panelEvaluations.push({
    candidateId: record.candidate.id,
    control: record.candidate.control === true,
    seed: record.seed,
    scenario: { id: scenario.id, role: scenario.role },
    windows: windowEvaluations
  });
}

const candidatePrevalence = {};
for (const candidateId of candidateIds) {
  const panels = panelEvaluations
    .filter((panel) => panel.candidateId === candidateId)
    .flatMap((panel) => panel.windows);
  const labelPrevalence = {};
  for (const label of labels) {
    const qualified = panels.filter((panel) => panel.mechanisms[label]?.qualified === true).length;
    labelPrevalence[label] = {
      qualifiedPanels: qualified,
      totalPanels: panels.length,
      prevalence: safeRatio(qualified, panels.length, 0),
      dominant: safeRatio(qualified, panels.length, 0) >= thresholds.dominantPanelFrequency
    };
  }
  candidatePrevalence[candidateId] = labelPrevalence;
}

const dominantPrimaryLabels = labels.filter((label) => candidatePrevalence[primaryId]?.[label]?.dominant === true);
const decision = dominantPrimaryLabels.length === 1 ? dominantPrimaryLabels[0] : 'MIXED';
const routing = contract.routing[decision];
const mechanismComparison = labels.map((label) => ({
  label,
  primary: candidatePrevalence[primaryId][label],
  control: candidatePrevalence[controlId][label],
  prevalenceDelta: candidatePrevalence[primaryId][label].prevalence - candidatePrevalence[controlId][label].prevalence
}));

const technicalGates = {
  contractExact: contract.front === 'R4-CU-D3D-B7' && contract.status === 'FROZEN_BEFORE_DIAGNOSTIC_EXECUTION',
  sourceStage3FailureFrozen: contract.sourceStage3.decision === 'LONG_HORIZON_OR_STRESS_VALIDATION_FAILED_NO_RETUNING',
  candidatePanelExact: JSON.stringify(candidateIds) === JSON.stringify(['V1_M1_C42', 'V24_M16_C42']),
  validationSeedPanelExact: JSON.stringify(seeds) === JSON.stringify(['ECON-RV08-LONG-G', 'ECON-RV08-LONG-H']),
  scenarioPanelExact: scenarioIds.length === 3 && new Set(scenarioIds).size === 3,
  windowPanelExact: JSON.stringify(windows.map((entry) => entry.id)) === JSON.stringify(['FULL_36', 'PRE_SHOCK_12', 'TRANSITION_12', 'TERMINAL_12']),
  expectedJobCount: expectedJobs === candidateIds.length * seeds.length * scenarios.length,
  completeResultCount: records.length === expectedJobs,
  noDuplicateJobs: duplicateKeys.length === 0,
  noMissingJobs: missingKeys.length === 0,
  noUnexpectedJobs: unexpectedKeys.length === 0,
  allDiagnosticEnvelopesPassed: records.every((entry) => entry.gates?.ok === true),
  allSourceEngineIntegrityPassed: records.every((entry) => entry.gates?.sourceEngineIntegrityPassed === true),
  allExactReplayPassed: records.every((entry) => entry.gates?.exactCanonicalReplayPassed === true && entry.gates?.exactDiagnosticReplayPassed === true && entry.gates?.observerReplayExact === true),
  allAccountingHealthy: records.every((entry) => entry.gates?.hardAccountingHealthy === true),
  allProtectedSurfacesExact: records.every((entry) => entry.gates?.protectedSurfaceExact === true),
  allScenarioSchedulesExact: records.every((entry) => entry.gates?.scenarioScheduleExact === true),
  allRowsHashesValid: records.every((entry) => entry.diagnostics?.rowsSha256 === sha256(JSON.stringify(entry.diagnostics?.rows || []))),
  allCountryMonthPanelsComplete: records.every((entry) => entry.diagnostics?.rows?.length === entry.diagnostics?.expectedRows && entry.diagnostics?.expectedMonths === contract.execution.months),
  allWindowPanelsComplete: panelEvaluations.every((panel) => panel.windows.every((window) => window.complete)),
  allAttributionsReconcile: records.every((entry) => entry.gates?.shortageAttributionReconciles === true),
  allGvaApproachesReconcile: records.every((entry) => entry.gates?.gvaApproachesReconcile === true),
  failedPrimaryOnlyUsedAsDiagnosticProbe: records.filter((entry) => entry.candidate?.id === primaryId).every((entry) => entry.interpretation?.candidateRetuningAuthorized === false && entry.interpretation?.sourceStage3DecisionReversed === false),
  diagnosticThresholdsFrozen: thresholds.role === 'DIAGNOSTIC_CLASSIFICATION_ONLY_NOT_CALIBRATION',
  routingResolved: typeof routing === 'string' && routing.length > 0,
  canonicalMutationLocked: contract.canonicalMutationAuthorized === false && contract.directParameterCalibrationAuthorized === false && records.every((entry) => entry.interpretation?.canonicalMutationAuthorized === false)
};
technicalGates.ok = Object.values(technicalGates).every(Boolean);
assert.equal(technicalGates.ok, true, `B7 technical aggregation failed: ${JSON.stringify(technicalGates)}`);

const result = {
  schemaVersion: 'r4-cu-d3d-b7-aggregate-v0.1',
  front: contract.front,
  generatedAt: new Date().toISOString(),
  status: 'PASS_TECHNICAL_B7_DIAGNOSTIC_AGGREGATION',
  decision,
  routing,
  technicalGates,
  sourceStage3: contract.sourceStage3,
  expected: {
    candidates: candidateIds.length,
    seeds: seeds.length,
    scenarios: scenarios.length,
    windows: windows.length,
    jobs: expectedJobs,
    primaryPanels: seeds.length * scenarios.length * windows.length
  },
  observed: { jobs: records.length, duplicateKeys, missingKeys, unexpectedKeys },
  controlCandidate: contract.candidatePanel.find((entry) => entry.id === controlId),
  diagnosticPrimary: contract.candidatePanel.find((entry) => entry.id === primaryId),
  thresholds,
  dominantPrimaryLabels,
  candidatePrevalence,
  mechanismComparison,
  panelEvaluations,
  interpretation: {
    purpose: 'CROSS_PANEL_MECHANISM_CLASSIFICATION_ONLY',
    sourceStage3FailureReversed: false,
    candidateRetuningAuthorized: false,
    thresholdRelaxationAuthorized: false,
    canonicalMutationAuthorized: false,
    directParameterCalibrationAuthorized: false,
    decisionRule: 'A single mechanism routes to D1-D6 only when it qualifies in at least half of the failed-primary seed-scenario-window panels; zero or multiple dominant mechanisms route to MIXED/D0.'
  }
};

mkdirSync(dirname(outputJson), { recursive: true });
writeFileSync(outputJson, JSON.stringify(result, null, 2));

if (outputMd) {
  const mechanismRows = mechanismComparison.map((entry) =>
    `| ${entry.label} | ${entry.primary.qualifiedPanels}/${entry.primary.totalPanels} | ${fmt(entry.primary.prevalence)} | ${entry.control.qualifiedPanels}/${entry.control.totalPanels} | ${fmt(entry.control.prevalence)} | ${fmt(entry.prevalenceDelta)} | ${entry.primary.dominant ? 'YES' : 'NO'} |`
  ).join('\n');
  const panelRows = panelEvaluations.flatMap((panel) => panel.windows.map((window) =>
    `| ${panel.candidateId} | ${panel.seed} | ${panel.scenario.id} | ${window.window.id} | ${window.qualifiedLabels.join(', ') || 'NONE'} | ${fmt(window.metrics.inputShortageRate)} | ${fmt(window.metrics.salesToPlanRatio)} | ${fmt(window.metrics.inventoryAboveTargetRatio)} | ${fmt(window.metrics.goodsUnmetShare)} | ${fmt(window.metrics.nonPositiveGvaCountryMonthShare)} | ${fmt(window.metrics.belowCostRevenueShare)} |`
  )).join('\n');
  const gateRows = Object.entries(technicalGates).filter(([key]) => key !== 'ok').map(([key, value]) => `| ${key} | ${value ? 'PASS' : 'FAIL'} |`).join('\n');
  const markdown = `# R4-CU-D3D-B7 Demand–Inventory Topology Diagnosis\n\n## Decision\n\n**${decision}**\n\n- Dependency-safe route: \`${routing}\`\n- Dominant failed-primary mechanisms: ${dominantPrimaryLabels.map((label) => `\`${label}\``).join(', ') || 'none; routed as MIXED'}\n- Observed jobs: ${records.length}/${expectedJobs}\n- Failed-primary panels: ${candidatePrevalence[primaryId][labels[0]].totalPanels}\n- Canonical mutation authorized: **NO**\n\n## Mechanism prevalence\n\n| Mechanism | Primary panels | Primary prevalence | Control panels | Control prevalence | Delta | Primary dominant |\n|---|---:|---:|---:|---:|---:|---:|\n${mechanismRows}\n\n## Candidate × seed × scenario × window\n\n| Candidate | Seed | Scenario | Window | Qualified mechanisms | Input shortage rate | Sales/plan | Inventory above target | Goods unmet share | Nonpositive GVA share | Below-cost revenue share |\n|---|---|---|---|---|---:|---:|---:|---:|---:|---:|\n${panelRows}\n\n## Technical gates\n\n| Gate | Result |\n|---|---:|\n${gateRows}\n\n## Interpretation boundary\n\nThis result classifies recurring mechanisms behind the frozen B6-S3 failure. It does not retune \`V24_M16_C42\`, does not reverse the S3 decision, and does not authorize any canonical parameter or source mutation.\n`;
  mkdirSync(dirname(outputMd), { recursive: true });
  writeFileSync(outputMd, markdown);
}

console.log('WP_RV08_R4_CU_D3D_B7_AGGREGATE', JSON.stringify({
  status: result.status,
  decision,
  routing,
  jobs: records.length,
  dominantPrimaryLabels,
  technicalGateOk: technicalGates.ok,
  outputJson,
  outputMd
}));
