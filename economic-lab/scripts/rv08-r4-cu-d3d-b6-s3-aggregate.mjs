import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = process.cwd();
const CONTRACT_PATH = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b6-s3-long-horizon-stress-contract.json');
const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
const inputRoot = resolve(process.env.INPUT_ROOT || '.');
const outputJson = resolve(process.env.OUTPUT_JSON || 'economic-lab/performance-results/r4-cu-d3d-b6-s3-aggregate.json');
const outputMd = process.env.OUTPUT_MD ? resolve(process.env.OUTPUT_MD) : null;
const EPS = 1e-9;
const LARGE = Number.MAX_SAFE_INTEGER;

const finiteNumber = (value) => value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null;
const finiteOr = (value, fallback = 0) => finiteNumber(value) ?? fallback;
const sum = (values) => values.reduce((total, value) => total + finiteOr(value), 0);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function walk(path) {
  const output = [];
  for (const name of readdirSync(path)) {
    const full = resolve(path, name);
    if (statSync(full).isDirectory()) output.push(...walk(full));
    else output.push(full);
  }
  return output;
}

function percentile(values, probability) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function bandDistance(value, band) {
  const numeric = finiteNumber(value);
  const low = finiteNumber(band?.[0]);
  const high = finiteNumber(band?.[1]);
  if (numeric === null || numeric <= 0 || low === null || high === null || low <= 0 || high < low) return LARGE;
  if (numeric < low) return Math.log(low / numeric);
  if (numeric > high) return Math.log(numeric / high);
  return 0;
}

function ratioVs(candidateValue, controlValue) {
  const candidate = finiteNumber(candidateValue);
  const control = finiteNumber(controlValue);
  if (candidate === null || control === null) return LARGE;
  if (Math.abs(control) > EPS) return candidate / control;
  return Math.abs(candidate) <= EPS ? 1 : LARGE;
}

function windowMetrics(result, window) {
  const rows = (result.rows || []).filter((row) => row.month >= window.startMonth && row.month <= window.endMonth);
  const positiveGva = rows.filter((row) => finiteOr(row.gvaBasicProduction) > EPS && finiteNumber(row.employeeCompensationShareOfGva) !== null);
  const positiveIncome = rows.filter((row) => finiteOr(row.cashDisposableIncome) > EPS && finiteNumber(row.realizedConsumptionShareOfCashDisposableIncome) !== null);
  const numeric = (field, source = rows) => source.map((row) => finiteNumber(row[field])).filter(Number.isFinite);
  return {
    rowCount: rows.length,
    expectedRowCount: (window.endMonth - window.startMonth + 1) * new Set(rows.map((row) => row.countryId)).size,
    positiveGvaRows: positiveGva.length,
    positiveIncomeRows: positiveIncome.length,
    nonPositiveGvaShare: rows.length ? rows.filter((row) => finiteOr(row.gvaBasicProduction) <= EPS).length / rows.length : null,
    labourShareMedian: percentile(numeric('employeeCompensationShareOfGva', positiveGva), 0.5),
    consumptionShareMedian: percentile(numeric('realizedConsumptionShareOfCashDisposableIncome', positiveIncome), 0.5),
    inputShortageMedian: percentile(numeric('inputShortageUnits'), 0.5),
    totalInputShortageUnits: sum(numeric('inputShortageUnits')),
    activeFirmsMedian: percentile(numeric('activeFirms'), 0.5),
    purchasingPowerMedian: percentile(numeric('nominalPurchasingPower'), 0.5),
    goodsFulfillmentMedian: percentile(numeric('goodsFulfillmentRatio'), 0.5),
    payrollSettlementMedian: percentile(numeric('payrollSettlementRatio'), 0.5),
    unemploymentMedian: percentile(numeric('unemployment'), 0.5),
    wageArrearsMedian: percentile(numeric('wageArrears'), 0.5)
  };
}

function key(candidateId, seed, scenarioId) {
  return `${candidateId}@@${seed}@@${scenarioId}`;
}

function payloadHashesValid(result) {
  const hashes = result.sourceEngine?.payloadHashes || {};
  return hashes.rowsSha256 === sha256(JSON.stringify(result.rows)) &&
    hashes.summarySha256 === sha256(JSON.stringify(result.summary)) &&
    hashes.digestPairSha256 === sha256(JSON.stringify({ worldDigest: result.worldDigest, replayDigest: result.replayDigest })) &&
    hashes.gatesSha256 === sha256(JSON.stringify(result.sourceEngine?.gates)) &&
    hashes.scenarioValidationSha256 === sha256(JSON.stringify(result.sourceEngine?.scenarioValidation));
}

assert.equal(contract.schemaVersion, '1.0');
assert.equal(contract.front, 'R4-CU-D3D-B6-S3');
assert.equal(contract.status, 'FROZEN_BEFORE_LONG_HORIZON_STRESS_EXECUTION');
assert.equal(contract.canonicalMutationAuthorized, false);
assert.equal(contract.directParameterCalibrationAuthorized, false);
assert.ok(statSync(inputRoot).isDirectory(), `Missing S3 input root ${inputRoot}`);

const candidateIds = contract.candidatePanel.map((entry) => entry.id);
const controlId = contract.candidatePanel.find((entry) => entry.control === true)?.id;
const primaryId = contract.sourceStage2.primaryCandidateId;
const seeds = contract.execution.validationSeeds.map((entry) => entry.seed);
const scenarios = contract.execution.scenarios;
const scenarioIds = scenarios.map((entry) => entry.id);
const windows = contract.execution.windows;
const expectedJobs = contract.execution.candidateSeedScenarioJobs;
const expectedKeys = candidateIds.flatMap((candidateId) => seeds.flatMap((seed) => scenarioIds.map((scenarioId) => key(candidateId, seed, scenarioId))));

const files = walk(inputRoot)
  .filter((path) => /r4-cu-d3d-b6-s3-.*\.json$/i.test(path))
  .filter((path) => !path.endsWith('aggregate.json'));
const records = [];
for (const file of files) {
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  if (parsed.front === contract.front && parsed.schemaVersion === 'r4-cu-d3d-b6-s3-long-horizon-stress-result-v0.1') {
    records.push({ ...parsed, __file: file });
  }
}

const observedKeys = records.map((entry) => key(entry.candidate?.id, entry.seed, entry.scenario?.id));
const duplicateKeys = observedKeys.filter((entry, index) => observedKeys.indexOf(entry) !== index);
const recordMap = new Map(records.map((entry) => [key(entry.candidate.id, entry.seed, entry.scenario.id), entry]));
const missingKeys = expectedKeys.filter((entry) => !recordMap.has(entry));
const unexpectedKeys = observedKeys.filter((entry) => !expectedKeys.includes(entry));
const labourBand = contract.empiricalShadowScoringBands.labourIncomeShare;
const consumptionBand = contract.empiricalShadowScoringBands.realizedConsumptionShare;
const eligibility = contract.eligibility;

const panelEvaluations = [];
for (const seed of seeds) {
  for (const scenario of scenarios) {
    const primary = recordMap.get(key(primaryId, seed, scenario.id));
    const control = recordMap.get(key(controlId, seed, scenario.id));
    if (!primary || !control) continue;

    const integrityPassed = [primary, control].every((result) =>
      result.gates?.ok === true &&
      result.gates?.sourceExactCanonicalReplay === true &&
      result.gates?.sourceExactDiagnosticReplay === true &&
      result.gates?.sourceHardAccountingHealthy === true &&
      result.sourceEngine?.gates?.protectedSurfaceExact === true &&
      result.sourceEngine?.gates?.s3ScenarioEventsAppliedExactly === true &&
      result.sourceEngine?.gates?.s3ScenarioEventReplayExact === true
    );
    const scenarioIdentityPassed = [primary, control].every((result) =>
      result.scenario?.id === scenario.id &&
      JSON.stringify(result.scenario?.schedule) === JSON.stringify(scenario.schedule) &&
      result.sourceEngine?.scenarioValidation?.scheduleSha256 === sha256(JSON.stringify(scenario.schedule))
    );

    const windowEvaluations = windows.map((window) => {
      const metrics = windowMetrics(primary, window);
      const controlMetrics = windowMetrics(control, window);
      const labourDistance = bandDistance(metrics.labourShareMedian, labourBand);
      const controlLabourDistance = bandDistance(controlMetrics.labourShareMedian, labourBand);
      const consumptionDistance = bandDistance(metrics.consumptionShareMedian, consumptionBand);
      const controlConsumptionDistance = bandDistance(controlMetrics.consumptionShareMedian, consumptionBand);
      const inputShortageRatio = ratioVs(metrics.inputShortageMedian, controlMetrics.inputShortageMedian);
      const activeFirmRatio = ratioVs(metrics.activeFirmsMedian, controlMetrics.activeFirmsMedian);
      const purchasingPowerRatio = ratioVs(metrics.purchasingPowerMedian, controlMetrics.purchasingPowerMedian);
      const conditions = {
        integrityPassed,
        scenarioIdentityPassed,
        completeWindowPanel: metrics.rowCount === metrics.expectedRowCount && controlMetrics.rowCount === controlMetrics.expectedRowCount,
        positiveGvaRowsPresent: metrics.positiveGvaRows > 0 && controlMetrics.positiveGvaRows > 0,
        positiveIncomeRowsPresent: metrics.positiveIncomeRows > 0 && controlMetrics.positiveIncomeRows > 0,
        labourDistanceStrictlyImproved: labourDistance + eligibility.strictImprovementEpsilon < controlLabourDistance,
        consumptionDistanceStrictlyImproved: consumptionDistance + eligibility.strictImprovementEpsilon < controlConsumptionDistance,
        inputShortageNotWorse: inputShortageRatio <= eligibility.maximumMedianInputShortageRatioVsControl + EPS,
        activeFirmsPreserved: activeFirmRatio + EPS >= eligibility.minimumMedianActiveFirmRatioVsControl,
        purchasingPowerPreserved: purchasingPowerRatio + EPS >= eligibility.minimumMedianPurchasingPowerRatioVsControl
      };
      return {
        window,
        conditions,
        passed: Object.values(conditions).every(Boolean),
        distances: {
          labour: labourDistance,
          controlLabour: controlLabourDistance,
          consumption: consumptionDistance,
          controlConsumption: controlConsumptionDistance,
          combined: labourDistance + consumptionDistance,
          controlCombined: controlLabourDistance + controlConsumptionDistance
        },
        ratios: { inputShortageRatio, activeFirmRatio, purchasingPowerRatio },
        metrics,
        controlMetrics
      };
    });

    panelEvaluations.push({
      seed,
      scenario,
      integrityPassed,
      scenarioIdentityPassed,
      windowEvaluations,
      passed: windowEvaluations.length === windows.length && windowEvaluations.every((entry) => entry.passed)
    });
  }
}

const allPanelsPassed = panelEvaluations.length === seeds.length * scenarios.length && panelEvaluations.every((entry) => entry.passed);
const technicalGates = {
  contractExact: contract.front === 'R4-CU-D3D-B6-S3' && contract.status === 'FROZEN_BEFORE_LONG_HORIZON_STRESS_EXECUTION',
  sourceStage2PrimaryFrozen: primaryId === 'V24_M16_C42' && contract.sourceStage2.primarySelectionRetuningAuthorized === false,
  candidatePanelExact: JSON.stringify(candidateIds) === JSON.stringify(['V1_M1_C42', 'V24_M16_C42']),
  validationSeedPanelExact: seeds.length === 2 && new Set(seeds).size === 2,
  scenarioPanelExact: scenarioIds.length === 3 && new Set(scenarioIds).size === 3,
  frozenHorizonAndWindowsExact: contract.execution.months === 36 && windows.some((entry) => entry.id === 'FULL_36' && entry.startMonth === 1 && entry.endMonth === 36) && windows.some((entry) => entry.id === 'TERMINAL_12' && entry.startMonth === 25 && entry.endMonth === 36),
  expectedJobCount: expectedJobs === candidateIds.length * seeds.length * scenarios.length,
  completeResultCount: records.length === expectedJobs,
  noDuplicateJobs: duplicateKeys.length === 0,
  noMissingJobs: missingKeys.length === 0,
  noUnexpectedJobs: unexpectedKeys.length === 0,
  allS3EnvelopesPassed: records.every((entry) => entry.gates?.ok === true),
  allSourceEngineIntegrityPassed: records.every((entry) => entry.sourceEngine?.gates?.ok === true),
  allExactReplayPassed: records.every((entry) => entry.sourceEngine?.gates?.exactCanonicalReplay === true && entry.sourceEngine?.gates?.exactDiagnosticReplay === true),
  allAccountingHealthy: records.every((entry) => entry.sourceEngine?.gates?.hardAccountingHealthy === true),
  allScenarioSchedulesAppliedExactly: records.every((entry) => entry.sourceEngine?.gates?.s3ScenarioEventsAppliedExactly === true && entry.sourceEngine?.gates?.s3ScenarioEventReplayExact === true),
  allPayloadHashesValid: records.every(payloadHashesValid),
  allRowsCoverFrozenHorizon: records.every((entry) => entry.months === 36 && entry.rows?.length === 36 * 4),
  controlPresentEveryPanel: seeds.every((seed) => scenarios.every((scenario) => recordMap.has(key(controlId, seed, scenario.id)))),
  primaryPresentEveryPanel: seeds.every((seed) => scenarios.every((scenario) => recordMap.has(key(primaryId, seed, scenario.id)))),
  noFacilityDrawInC42Panel: records.every((entry) => finiteOr(entry.summary?.totalFacilityActualDraw) <= EPS),
  allPanelsEvaluated: panelEvaluations.length === seeds.length * scenarios.length,
  postHocRelaxationLocked: contract.ranking.postHocGateRelaxationAuthorized === false && contract.stressApplicationContract.postExecutionScenarioMutationAuthorized === false,
  canonicalMutationLocked: contract.canonicalMutationAuthorized === false && contract.directParameterCalibrationAuthorized === false
};
technicalGates.ok = Object.values(technicalGates).every(Boolean);

const decision = allPanelsPassed
  ? 'LONG_HORIZON_STRESS_VALIDATION_CONFIRMED'
  : 'LONG_HORIZON_OR_STRESS_VALIDATION_FAILED_NO_RETUNING';
const routing = allPanelsPassed ? contract.nextFrontIfPass : contract.nextFrontIfFail;
const worstWindowCombinedDistance = Math.max(...panelEvaluations.flatMap((panel) => panel.windowEvaluations.map((entry) => entry.distances.combined)), 0);
const worstWindowInputShortageRatio = Math.max(...panelEvaluations.flatMap((panel) => panel.windowEvaluations.map((entry) => entry.ratios.inputShortageRatio)), 0);
const minimumWindowActiveFirmRatio = Math.min(...panelEvaluations.flatMap((panel) => panel.windowEvaluations.map((entry) => entry.ratios.activeFirmRatio)), LARGE);
const minimumWindowPurchasingPowerRatio = Math.min(...panelEvaluations.flatMap((panel) => panel.windowEvaluations.map((entry) => entry.ratios.purchasingPowerRatio)), LARGE);

const result = {
  schemaVersion: 'r4-cu-d3d-b6-s3-aggregate-v0.1',
  front: contract.front,
  generatedAt: new Date().toISOString(),
  status: technicalGates.ok ? 'PASS_TECHNICAL_LONG_HORIZON_STRESS_AGGREGATION' : 'FAIL_TECHNICAL_LONG_HORIZON_STRESS_AGGREGATION',
  decision,
  routing,
  technicalGates,
  sourceStage2: contract.sourceStage2,
  expected: { candidates: candidateIds.length, seeds: seeds.length, scenarios: scenarios.length, windows: windows.length, jobs: expectedJobs },
  observed: { jobs: records.length, duplicateKeys, missingKeys, unexpectedKeys },
  primaryCandidate: contract.candidatePanel.find((entry) => entry.id === primaryId),
  allPanelsPassed,
  panelEvaluations,
  worstCase: {
    combinedHeadlineDistance: worstWindowCombinedDistance,
    inputShortageRatio: worstWindowInputShortageRatio,
    minimumActiveFirmRatio: minimumWindowActiveFirmRatio,
    minimumPurchasingPowerRatio: minimumWindowPurchasingPowerRatio
  },
  interpretation: {
    role: 'LONG_HORIZON_AND_STRESS_CAUSAL_VALIDATION_ONLY',
    empiricalBands: 'EXTERNAL_VALIDATION_ONLY',
    stressMagnitudesAreCalibrationRecommendations: false,
    directParameterRecommendation: false,
    canonicalMutationAuthorized: false,
    noRetuningAllowed: true
  }
};

mkdirSync(dirname(outputJson), { recursive: true });
writeFileSync(outputJson, JSON.stringify(result, null, 2));

if (outputMd) {
  const panelRows = panelEvaluations.flatMap((panel) => panel.windowEvaluations.map((entry) =>
    `| ${panel.seed} | ${panel.scenario.id} | ${entry.window.id} | ${entry.passed ? 'PASS' : 'FAIL'} | ${finiteOr(entry.metrics.labourShareMedian).toFixed(6)} | ${finiteOr(entry.controlMetrics.labourShareMedian).toFixed(6)} | ${finiteOr(entry.metrics.consumptionShareMedian).toFixed(6)} | ${finiteOr(entry.controlMetrics.consumptionShareMedian).toFixed(6)} | ${finiteOr(entry.ratios.inputShortageRatio, LARGE).toFixed(6)} | ${finiteOr(entry.ratios.activeFirmRatio, LARGE).toFixed(6)} | ${finiteOr(entry.ratios.purchasingPowerRatio, LARGE).toFixed(6)} |`
  )).join('\n');
  const markdown = `# R4-CU-D3D-B6-S3 Long-Horizon and Stress Aggregate\n\n- Decision: **${decision}**\n- Primary: \`${primaryId}\`\n- Technical gates: **${technicalGates.ok ? 'PASS' : 'FAIL'}**\n- Jobs: ${records.length}/${expectedJobs}\n- Routing: \`${routing}\`\n\n| Seed | Scenario | Window | Result | Labour share | Control labour | Consumption share | Control consumption | Shortage ratio | Active-firm ratio | Purchasing-power ratio |\n|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|\n${panelRows}\n\nStress magnitudes and empirical bands are validation devices, not direct canonical parameter recommendations.\n`;
  mkdirSync(dirname(outputMd), { recursive: true });
  writeFileSync(outputMd, markdown);
}

console.log('WP_RV08_R4_CU_D3D_B6_S3_AGGREGATE_GATES', JSON.stringify(technicalGates));
console.log('WP_RV08_R4_CU_D3D_B6_S3_DECISION', JSON.stringify({ decision, allPanelsPassed, routing, worstCase: result.worstCase }));
assert.equal(technicalGates.ok, true, 'B6-S3 technical aggregation failed');
