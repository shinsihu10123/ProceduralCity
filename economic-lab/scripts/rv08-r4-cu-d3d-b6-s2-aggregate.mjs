import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const PROTOCOL_PATH = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b6-s2-heldout-replication-contract.json');
const protocol = JSON.parse(readFileSync(PROTOCOL_PATH, 'utf8'));
const inputRoot = resolve(process.env.INPUT_ROOT || '.');
const outputJson = resolve(process.env.OUTPUT_JSON || 'economic-lab/performance-results/r4-cu-d3d-b6-s2-aggregate.json');
const outputMd = process.env.OUTPUT_MD ? resolve(process.env.OUTPUT_MD) : null;
const EPS = 1e-9;

const finiteNumber = (value) => value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null;
const finiteOr = (value, fallback = 0) => finiteNumber(value) ?? fallback;
const sum = (values) => values.reduce((total, value) => total + finiteOr(value), 0);

function walk(path) {
  const output = [];
  for (const name of readdirSync(path)) {
    const full = resolve(path, name);
    if (statSync(full).isDirectory()) output.push(...walk(full));
    else output.push(full);
  }
  return output;
}

function bandDistance(value, band) {
  const numeric = finiteNumber(value);
  if (numeric === null || numeric <= 0) return Number.MAX_VALUE;
  if (numeric < band.lower) return Math.abs(Math.log(numeric / band.lower));
  if (numeric > band.upper) return Math.abs(Math.log(numeric / band.upper));
  return 0;
}

function ratioVs(candidateValue, controlValue) {
  const candidate = finiteNumber(candidateValue);
  const control = finiteNumber(controlValue);
  if (candidate === null || control === null) return Number.MAX_VALUE;
  if (Math.abs(control) > EPS) return candidate / control;
  return Math.abs(candidate) <= EPS ? 1 : Number.MAX_VALUE;
}

function metricVector(result) {
  return {
    labourShareMedian: finiteNumber(result.summary?.employeeCompensationSharePositiveGva?.median),
    consumptionShareMedian: finiteNumber(result.summary?.realizedConsumptionSharePositiveIncome?.median),
    netSavingShareMedian: finiteNumber(result.summary?.netSavingSharePositiveIncome?.median),
    inputShortageMedian: finiteNumber(result.summary?.inputShortageUnits?.median),
    inputShortageTotal: finiteNumber(result.summary?.totalInputShortageUnits),
    plannedInputNeedMedian: finiteNumber(result.summary?.plannedInputNeedUnits?.median),
    purchasedInputUnitsMedian: finiteNumber(result.summary?.purchasedInputUnits?.median),
    procurementBudgetUtilizationMedian: finiteNumber(result.summary?.procurementBudgetUtilization?.median),
    activeFirmsMedian: finiteNumber(result.summary?.activeFirms?.median),
    purchasingPowerMedian: finiteNumber(result.summary?.nominalPurchasingPower?.median),
    nonPositiveGvaShare: finiteNumber(result.summary?.nonPositiveGvaShare),
    inventoryInvestmentShareMedian: finiteNumber(result.summary?.inventoryInvestmentShareOfMacroGdp?.median),
    goodsFulfillmentMedian: finiteNumber(result.summary?.goodsFulfillmentRatio?.median),
    payrollSettlementMedian: finiteNumber(result.summary?.payrollSettlementRatio?.median),
    unemploymentMedian: finiteNumber(result.summary?.unemployment?.median),
    wageArrearsMedian: finiteNumber(result.summary?.wageArrears?.median),
    facilityDraw: finiteNumber(result.summary?.totalFacilityActualDraw),
    facilityTerminalArrearsRatio: finiteNumber(result.summary?.facilityTerminal?.arrearsRatio),
    facilityChargeOffShare: finiteNumber(result.summary?.facilityTerminal?.chargeOffShare),
    facilityDebtMonthsOfSales: finiteNumber(result.summary?.facilityTerminal?.debtMonthsOfFirmSales)
  };
}

function deltaVector(candidateMetrics, controlMetrics) {
  const output = {};
  for (const key of Object.keys(candidateMetrics)) {
    const candidateValue = finiteNumber(candidateMetrics[key]);
    const controlValue = finiteNumber(controlMetrics[key]);
    output[key] = candidateValue === null || controlValue === null ? null : candidateValue - controlValue;
  }
  return output;
}

assert.equal(protocol.front, 'R4-CU-D3D-B6-S2');
assert.equal(protocol.status, 'FROZEN_BEFORE_HELDOUT_EXECUTION');
assert.equal(protocol.canonicalMutationAuthorized, false);
assert.equal(protocol.directParameterCalibrationAuthorized, false);

const files = walk(inputRoot).filter((path) => /r4-cu-d3d-b6-s2-.*\.json$/i.test(path) && !path.endsWith('aggregate.json'));
const results = [];
for (const file of files) {
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  if (parsed.front === protocol.front && parsed.schemaVersion === 'r4-cu-d3d-b6-s2-heldout-result-v0.1') results.push({ ...parsed, __file: file });
}

const candidates = protocol.candidatePanel;
const candidateIds = candidates.map((entry) => entry.id).sort();
const seeds = protocol.execution.heldoutSeeds.map((entry) => entry.seed).sort();
const expectedJobs = protocol.execution.candidateSeedJobs;
const controlId = candidates.find((entry) => entry.role === 'SAME_SEED_CONTROL')?.id;
const keys = results.map((entry) => `${entry.candidate.id}@@${entry.seed}`);
const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index);
const resultMap = new Map(results.map((entry) => [`${entry.candidate.id}@@${entry.seed}`, entry]));
const missingKeys = candidateIds.flatMap((candidateId) => seeds.map((seed) => `${candidateId}@@${seed}`)).filter((key) => !resultMap.has(key));
const unexpectedKeys = keys.filter((key) => {
  const [candidateId, seed] = key.split('@@');
  return !candidateIds.includes(candidateId) || !seeds.includes(seed);
});

const labourBand = protocol.empiricalExternalBands.labourShare;
const consumptionBand = protocol.empiricalExternalBands.realizedConsumptionShare;
const eligibility = protocol.replicationEligibility;
const candidateEvaluations = [];

for (const candidate of candidates.filter((entry) => entry.role === 'FROZEN_STAGE1_FINALIST')) {
  const seedEvaluations = [];
  for (const seed of seeds) {
    const result = resultMap.get(`${candidate.id}@@${seed}`);
    const control = resultMap.get(`${controlId}@@${seed}`);
    if (!result || !control) continue;

    const metrics = metricVector(result);
    const controlMetrics = metricVector(control);
    const labourDistance = bandDistance(metrics.labourShareMedian, labourBand);
    const controlLabourDistance = bandDistance(controlMetrics.labourShareMedian, labourBand);
    const consumptionDistance = bandDistance(metrics.consumptionShareMedian, consumptionBand);
    const controlConsumptionDistance = bandDistance(controlMetrics.consumptionShareMedian, consumptionBand);
    const inputShortageRatio = ratioVs(metrics.inputShortageMedian, controlMetrics.inputShortageMedian);
    const activeFirmRatio = ratioVs(metrics.activeFirmsMedian, controlMetrics.activeFirmsMedian);
    const purchasingPowerRatio = ratioVs(metrics.purchasingPowerMedian, controlMetrics.purchasingPowerMedian);

    const sourceGates = result.sourceEngine?.gates || {};
    const integrityPassed = result.gates?.ok === true && sourceGates.ok === true && sourceGates.exactCanonicalReplay === true && sourceGates.exactDiagnosticReplay === true && sourceGates.hardAccountingHealthy === true;
    const conditions = {
      integrityPassed,
      positiveGvaRowsPresent: finiteOr(result.summary?.positiveGvaRows) > 0,
      positiveIncomeRowsPresent: finiteOr(result.summary?.positiveIncomeRows) > 0,
      labourDistanceStrictlyImproved: labourDistance + eligibility.strictImprovementEpsilon < controlLabourDistance,
      consumptionDistanceStrictlyImproved: consumptionDistance + eligibility.strictImprovementEpsilon < controlConsumptionDistance,
      inputShortageNotWorse: inputShortageRatio <= eligibility.maximumMedianInputShortageRatioVsControl + EPS,
      activeFirmsPreserved: activeFirmRatio + EPS >= eligibility.minimumMedianActiveFirmRatioVsControl,
      purchasingPowerPreserved: purchasingPowerRatio + EPS >= eligibility.minimumMedianPurchasingPowerRatioVsControl,
      c42FacilityAbsent: finiteOr(metrics.facilityDraw) <= EPS
    };

    seedEvaluations.push({
      seed,
      conditions,
      replicatedOnSeed: Object.values(conditions).every(Boolean),
      distances: {
        labour: labourDistance,
        controlLabour: controlLabourDistance,
        consumption: consumptionDistance,
        controlConsumption: controlConsumptionDistance,
        worstHeadline: Math.max(labourDistance, consumptionDistance)
      },
      ratios: { inputShortageRatio, activeFirmRatio, purchasingPowerRatio },
      metrics,
      controlMetrics,
      deltaVsControl: deltaVector(metrics, controlMetrics)
    });
  }

  const replicatedOnBothHeldouts = seedEvaluations.length === seeds.length && seedEvaluations.every((entry) => entry.replicatedOnSeed);
  candidateEvaluations.push({
    candidate,
    seedEvaluations,
    replicatedOnBothHeldouts,
    ranking: {
      worstHeldoutHeadlineDistance: seedEvaluations.length ? Math.max(...seedEvaluations.map((entry) => entry.distances.worstHeadline)) : Number.MAX_VALUE,
      worstHeldoutInputShortageRatio: seedEvaluations.length ? Math.max(...seedEvaluations.map((entry) => entry.ratios.inputShortageRatio)) : Number.MAX_VALUE,
      meanNonPositiveGvaShare: seedEvaluations.length ? sum(seedEvaluations.map((entry) => entry.metrics.nonPositiveGvaShare)) / seedEvaluations.length : Number.MAX_VALUE,
      minimumActiveFirmRatio: seedEvaluations.length ? Math.min(...seedEvaluations.map((entry) => entry.ratios.activeFirmRatio)) : 0
    }
  });
}

const replicatedCandidates = candidateEvaluations
  .filter((entry) => entry.replicatedOnBothHeldouts)
  .sort((a, b) =>
    a.ranking.worstHeldoutHeadlineDistance - b.ranking.worstHeldoutHeadlineDistance ||
    a.ranking.worstHeldoutInputShortageRatio - b.ranking.worstHeldoutInputShortageRatio ||
    a.ranking.meanNonPositiveGvaShare - b.ranking.meanNonPositiveGvaShare ||
    b.ranking.minimumActiveFirmRatio - a.ranking.minimumActiveFirmRatio ||
    a.candidate.id.localeCompare(b.candidate.id)
  );
const primaryCandidate = replicatedCandidates[0] || null;
const controls = seeds.map((seed) => resultMap.get(`${controlId}@@${seed}`)).filter(Boolean);

const technicalGates = {
  protocolExact: protocol.front === 'R4-CU-D3D-B6-S2' && protocol.status === 'FROZEN_BEFORE_HELDOUT_EXECUTION',
  sourceStage1EvidenceFrozen: protocol.sourceStage1.workflowRunId === 33358631295 && protocol.sourceStage1.headSha === '32c4753ee062e62f09789cb7a7492f2c6fdae354',
  frozenCandidatePanelExact: candidateIds.length === 4 && controlId === 'V1_M1_C42' && protocol.sourceStage1.frozenFinalists.length === 3,
  c42OnlyPanel: candidates.every((entry) => entry.W === 'C42'),
  expectedJobCount: expectedJobs === candidateIds.length * seeds.length && expectedJobs === 8,
  completeResultCount: results.length === expectedJobs,
  noDuplicateJobs: duplicateKeys.length === 0,
  noMissingJobs: missingKeys.length === 0,
  noUnexpectedJobs: unexpectedKeys.length === 0,
  allHeldoutEnvelopesPassed: results.every((entry) => entry.gates?.ok === true),
  allSourceEngineIntegrityPassed: results.every((entry) => entry.sourceEngine?.gates?.ok === true),
  allExactReplayPassed: results.every((entry) => entry.sourceEngine?.gates?.exactCanonicalReplay === true && entry.sourceEngine?.gates?.exactDiagnosticReplay === true),
  allAccountingHealthy: results.every((entry) => entry.sourceEngine?.gates?.hardAccountingHealthy === true),
  payloadHashesPresent: results.every((entry) => Object.values(entry.sourceEngine?.payloadHashes || {}).every((value) => typeof value === 'string' && value.length === 64)),
  controlPresentBothSeeds: controls.length === seeds.length,
  controlCanonicalEquivalenceExact: controls.every((entry) => entry.sourceEngine?.gates?.controlCanonicalEquivalence === true),
  allFinalistsEvaluated: candidateEvaluations.length === 3,
  noFacilityDrawInC42Panel: results.every((entry) => finiteOr(entry.summary?.totalFacilityActualDraw) <= EPS),
  postHocRelaxationLocked: eligibility.postHocGateRelaxationAuthorized === false,
  canonicalMutationLocked: protocol.canonicalMutationAuthorized === false && protocol.directParameterCalibrationAuthorized === false
};
technicalGates.ok = Object.values(technicalGates).every(Boolean);

const decision = replicatedCandidates.length ? 'HELDOUT_REPLICATION_CONFIRMED' : 'NO_B6_FINALIST_REPLICATED_NO_RETUNING';
const result = {
  schemaVersion: 'r4-cu-d3d-b6-s2-aggregate-v0.1',
  front: protocol.front,
  generatedAt: new Date().toISOString(),
  status: technicalGates.ok ? 'PASS_TECHNICAL_HELDOUT_AGGREGATION' : 'FAIL_TECHNICAL_HELDOUT_AGGREGATION',
  decision,
  technicalGates,
  expected: { candidates: candidateIds.length, seeds: seeds.length, jobs: expectedJobs },
  observed: { jobs: results.length, duplicateKeys, missingKeys, unexpectedKeys },
  replicatedCandidateCount: replicatedCandidates.length,
  replicatedCandidates: replicatedCandidates.map((entry, rank) => ({ rank: rank + 1, ...entry })),
  primaryCandidate: primaryCandidate ? { candidate: primaryCandidate.candidate, ranking: primaryCandidate.ranking, seedEvaluations: primaryCandidate.seedEvaluations } : null,
  candidateEvaluations,
  controlSummaries: controls.map((entry) => ({ seed: entry.seed, metrics: metricVector(entry), worldDigest: entry.worldDigest, replayDigest: entry.replayDigest })),
  routing: replicatedCandidates.length ? protocol.nextFrontIfReplicated : protocol.nextFrontIfNone,
  interpretation: {
    heldoutReplication: true,
    empiricalBands: 'EXTERNAL_VALIDATION_ONLY',
    causalCounterfactuals: true,
    directParameterRecommendation: false,
    canonicalMutationAuthorized: false,
    heldoutRetuningAuthorized: false
  }
};

console.log('WP_RV08_R4_CU_D3D_B6_S2_AGGREGATE_GATES', JSON.stringify(technicalGates));
console.log('WP_RV08_R4_CU_D3D_B6_S2_DECISION', JSON.stringify({
  decision,
  replicatedCandidateCount: replicatedCandidates.length,
  replicatedCandidates: replicatedCandidates.map((entry) => entry.candidate.id),
  primaryCandidate: primaryCandidate?.candidate.id || null,
  routing: result.routing
}));
writeFileSync(outputJson, JSON.stringify(result, null, 2));
if (outputMd) {
  const lines = [
    '# R4-CU-D3D-B6-S2 Heldout Aggregate Summary',
    '',
    `- Technical status: **${result.status}**`,
    `- Economic decision: **${decision}**`,
    `- Jobs: ${results.length}/${expectedJobs}`,
    `- Replicated candidates: ${replicatedCandidates.map((entry) => entry.candidate.id).join(', ') || 'none'}`,
    `- Primary candidate: ${primaryCandidate?.candidate.id || 'none'}`,
    `- Routing: ${result.routing}`,
    '',
    'This is a frozen heldout causal replication. It does not authorize canonical parameter mutation.'
  ];
  writeFileSync(outputMd, `${lines.join('\n')}\n`);
}
assert.equal(technicalGates.ok, true, 'R4-CU-D3D-B6-S2 aggregate technical gate failed');
