import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const CONTRACT_PATH = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b6-input-output-working-capital-contract.json');
const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
const inputRoot = resolve(process.env.INPUT_ROOT || '.');
const outputJson = resolve(process.env.OUTPUT_JSON || 'economic-lab/performance-results/r4-cu-d3d-b6-s1-aggregate.json');
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
    facilityDraw: finiteNumber(result.summary?.totalFacilityActualDraw),
    facilityTerminalArrearsRatio: finiteNumber(result.summary?.facilityTerminal?.arrearsRatio),
    facilityChargeOffShare: finiteNumber(result.summary?.facilityTerminal?.chargeOffShare),
    facilityDebtMonthsOfSales: finiteNumber(result.summary?.facilityTerminal?.debtMonthsOfFirmSales)
  };
}

function deltaVector(candidate, baseline) {
  const output = {};
  for (const key of Object.keys(candidate)) {
    const a = finiteNumber(candidate[key]);
    const b = finiteNumber(baseline[key]);
    output[key] = a === null || b === null ? null : a - b;
  }
  return output;
}

const files = walk(inputRoot).filter((path) => /r4-cu-d3d-b6-s1-.*\.json$/i.test(path) && !path.endsWith('aggregate.json'));
const results = [];
for (const file of files) {
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  if (parsed.front === contract.front && parsed.schemaVersion === 'r4-cu-d3d-b6-s1-shadow-screen-v0.1') {
    results.push({ ...parsed, __file: file });
  }
}

const expectedCandidates = contract.factorial.candidates.map((entry) => entry.id).sort();
const expectedSeeds = contract.stage1Execution.originalSeeds.slice().sort();
const expectedJobs = contract.stage1Execution.candidateSeedJobs;
const keys = results.map((entry) => `${entry.candidate.id}@@${entry.seed}`);
const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index);
const resultMap = new Map(results.map((entry) => [`${entry.candidate.id}@@${entry.seed}`, entry]));
const missingKeys = expectedCandidates.flatMap((candidateId) => expectedSeeds.map((seed) => `${candidateId}@@${seed}`)).filter((key) => !resultMap.has(key));
const unexpectedKeys = keys.filter((key) => {
  const [candidateId, seed] = key.split('@@');
  return !expectedCandidates.includes(candidateId) || !expectedSeeds.includes(seed);
});

const labourBand = contract.empiricalExternalBands.labourShare.admissionInterval;
const consumptionBand = contract.empiricalExternalBands.realizedConsumptionShare.admissionInterval;
const eligibility = contract.eligibility;
const controlId = contract.factorial.controlCandidateId;
const candidateEvaluations = [];

for (const candidate of contract.factorial.candidates) {
  if (candidate.control === true) continue;
  const seedEvaluations = [];
  for (const seed of expectedSeeds) {
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
    const integrityPassed = result.gates?.ok === true && result.gates?.exactCanonicalReplay === true && result.gates?.exactDiagnosticReplay === true && result.gates?.hardAccountingHealthy === true;
    const facilitySafety = candidate.W !== 'LINE1' || (
      finiteOr(metrics.facilityDraw) >= eligibility.line1Facility.minimumObservedDraw &&
      finiteOr(metrics.facilityTerminalArrearsRatio, Number.MAX_VALUE) <= eligibility.line1Facility.maximumTerminalArrearsRatio + EPS &&
      finiteOr(metrics.facilityChargeOffShare, Number.MAX_VALUE) <= eligibility.line1Facility.maximumCumulativeChargeOffShareOfOriginations + EPS &&
      finiteOr(metrics.facilityDebtMonthsOfSales, Number.MAX_VALUE) <= eligibility.line1Facility.maximumTerminalDebtMonthsOfFirmSales + EPS
    );
    const conditions = {
      integrityPassed,
      positiveGvaRowsPresent: finiteOr(result.summary?.positiveGvaRows) > 0,
      positiveIncomeRowsPresent: finiteOr(result.summary?.positiveIncomeRows) > 0,
      labourDistanceStrictlyImproved: labourDistance + eligibility.strictImprovementEpsilon < controlLabourDistance,
      consumptionDistanceStrictlyImproved: consumptionDistance + eligibility.strictImprovementEpsilon < controlConsumptionDistance,
      inputShortageNotWorse: inputShortageRatio <= eligibility.maximumMedianInputShortageRatioVsControl + EPS,
      activeFirmsPreserved: activeFirmRatio + EPS >= eligibility.minimumMedianActiveFirmRatioVsControl,
      purchasingPowerPreserved: purchasingPowerRatio + EPS >= eligibility.minimumMedianPurchasingPowerRatioVsControl,
      facilitySafety
    };
    seedEvaluations.push({
      seed,
      conditions,
      eligible: Object.values(conditions).every(Boolean),
      distances: {
        labour: labourDistance,
        controlLabour: controlLabourDistance,
        consumption: consumptionDistance,
        controlConsumption: controlConsumptionDistance,
        worstHeadline: Math.max(labourDistance, consumptionDistance)
      },
      ratios: { inputShortageRatio, activeFirmRatio, purchasingPowerRatio },
      metrics,
      controlMetrics
    });
  }
  const eligibleOnBothSeeds = seedEvaluations.length === expectedSeeds.length && seedEvaluations.every((entry) => entry.eligible);
  candidateEvaluations.push({
    candidate,
    seedEvaluations,
    eligibleOnBothSeeds,
    ranking: {
      worstSeedHeadlineDistance: Math.max(...seedEvaluations.map((entry) => entry.distances.worstHeadline), Number.MAX_VALUE),
      worstSeedInputShortageRatio: Math.max(...seedEvaluations.map((entry) => entry.ratios.inputShortageRatio), Number.MAX_VALUE),
      pooledNonPositiveGvaShare: seedEvaluations.length ? sum(seedEvaluations.map((entry) => entry.metrics.nonPositiveGvaShare)) / seedEvaluations.length : Number.MAX_VALUE,
      minimumActiveFirmRatio: Math.min(...seedEvaluations.map((entry) => entry.ratios.activeFirmRatio), 0),
      maximumFacilityDebtMonths: Math.max(...seedEvaluations.map((entry) => finiteOr(entry.metrics.facilityDebtMonthsOfSales)), 0)
    }
  });
}

const rankedEligible = candidateEvaluations
  .filter((entry) => entry.eligibleOnBothSeeds)
  .sort((a, b) =>
    a.ranking.worstSeedHeadlineDistance - b.ranking.worstSeedHeadlineDistance ||
    a.ranking.worstSeedInputShortageRatio - b.ranking.worstSeedInputShortageRatio ||
    a.ranking.pooledNonPositiveGvaShare - b.ranking.pooledNonPositiveGvaShare ||
    a.ranking.maximumFacilityDebtMonths - b.ranking.maximumFacilityDebtMonths ||
    b.ranking.minimumActiveFirmRatio - a.ranking.minimumActiveFirmRatio ||
    a.candidate.id.localeCompare(b.candidate.id)
  );

const finalists = [];
const usedVM = new Set();
for (const entry of rankedEligible) {
  const key = `V${entry.candidate.V}-M${entry.candidate.M}`;
  if (usedVM.has(key)) continue;
  finalists.push(entry);
  usedVM.add(key);
  if (finalists.length >= eligibility.maximumFinalists) break;
}

const pairedContrasts = [];
for (const seed of expectedSeeds) {
  const byId = new Map(contract.factorial.candidates.map((candidate) => [candidate.id, resultMap.get(`${candidate.id}@@${seed}`)]));
  for (const M of contract.factorial.axes.M) {
    for (const W of contract.factorial.axes.W) {
      const low = byId.get(`V1_M${M}_${W}`);
      const high = byId.get(`V24_M${M}_${W}`);
      if (low && high) pairedContrasts.push({ seed, contrast: 'V24_MINUS_V1', fixed: { M, W }, delta: deltaVector(metricVector(high), metricVector(low)) });
    }
  }
  for (const V of contract.factorial.axes.V) {
    for (const W of contract.factorial.axes.W) {
      const base = byId.get(`V${V}_M1_${W}`);
      for (const M of contract.factorial.axes.M.filter((value) => value !== 1)) {
        const variant = byId.get(`V${V}_M${M}_${W}`);
        if (base && variant) pairedContrasts.push({ seed, contrast: `M${M}_MINUS_M1`, fixed: { V, W }, delta: deltaVector(metricVector(variant), metricVector(base)) });
      }
    }
  }
  for (const V of contract.factorial.axes.V) {
    for (const M of contract.factorial.axes.M) {
      const c42 = byId.get(`V${V}_M${M}_C42`);
      const full = byId.get(`V${V}_M${M}_FULL`);
      const line = byId.get(`V${V}_M${M}_LINE1`);
      if (c42 && full) pairedContrasts.push({ seed, contrast: 'FULL_MINUS_C42', fixed: { V, M }, delta: deltaVector(metricVector(full), metricVector(c42)) });
      if (full && line) pairedContrasts.push({ seed, contrast: 'LINE1_MINUS_FULL', fixed: { V, M }, delta: deltaVector(metricVector(line), metricVector(full)) });
    }
  }
}

const controls = expectedSeeds.map((seed) => resultMap.get(`${controlId}@@${seed}`)).filter(Boolean);
const technicalGates = {
  contractExact: contract.front === 'R4-CU-D3D-B6-S1' && contract.status === 'FROZEN_PRE_IMPLEMENTATION',
  expectedCandidateCount: expectedCandidates.length === contract.stage1Execution.candidateJobs,
  expectedJobCount: expectedJobs === expectedCandidates.length * expectedSeeds.length,
  completeResultCount: results.length === expectedJobs,
  noDuplicateJobs: duplicateKeys.length === 0,
  noMissingJobs: missingKeys.length === 0,
  noUnexpectedJobs: unexpectedKeys.length === 0,
  allJobIntegrityGatesPassed: results.every((entry) => entry.gates?.ok === true),
  allExactReplayPassed: results.every((entry) => entry.gates?.exactCanonicalReplay === true && entry.gates?.exactDiagnosticReplay === true),
  allAccountingHealthy: results.every((entry) => entry.gates?.hardAccountingHealthy === true),
  controlPresentBothSeeds: controls.length === expectedSeeds.length,
  controlCanonicalEquivalenceExact: controls.every((entry) => entry.gates?.controlCanonicalEquivalence === true),
  allCandidatesEvaluated: candidateEvaluations.length === expectedCandidates.length - 1,
  pairedContrastsProduced: pairedContrasts.length > 0,
  heldoutSeedsStillReserved: contract.stage1Execution.heldoutSeedsReservedForStage2.length === 2,
  canonicalMutationLocked: contract.canonicalMutationAuthorized === false && contract.canonicalCalibrationAuthorized === false
};
technicalGates.ok = Object.values(technicalGates).every(Boolean);

const decision = finalists.length
  ? 'ELIGIBLE_CAUSAL_FAMILIES_IDENTIFIED_FOR_B6_S2'
  : 'NO_ELIGIBLE_FAMILY_NO_RETUNING';
const result = {
  schemaVersion: 'r4-cu-d3d-b6-s1-aggregate-v0.1',
  front: contract.front,
  generatedAt: new Date().toISOString(),
  status: technicalGates.ok ? 'PASS_TECHNICAL_AGGREGATION' : 'FAIL_TECHNICAL_AGGREGATION',
  decision,
  technicalGates,
  expected: { candidates: expectedCandidates.length, seeds: expectedSeeds.length, jobs: expectedJobs },
  observed: { jobs: results.length, duplicateKeys, missingKeys, unexpectedKeys },
  finalists: finalists.map((entry, rank) => ({ rank: rank + 1, candidate: entry.candidate, ranking: entry.ranking, seedEvaluations: entry.seedEvaluations })),
  eligibleCandidateCount: rankedEligible.length,
  candidateEvaluations,
  pairedContrasts,
  controlSummaries: controls.map((entry) => ({ seed: entry.seed, metrics: metricVector(entry), worldDigest: entry.worldDigest })),
  routing: finalists.length
    ? contract.nextFrontIfAnyFamilyPasses
    : contract.nextFrontIfNoFamilyPasses,
  interpretation: {
    empiricalBands: 'EXTERNAL_VALIDATION_ONLY',
    causalCounterfactuals: true,
    canonicalMutationAuthorized: false,
    noWinnerRetuningAllowed: true
  }
};

console.log('WP_RV08_R4_CU_D3D_B6_S1_AGGREGATE_GATES', JSON.stringify(technicalGates));
console.log('WP_RV08_R4_CU_D3D_B6_S1_DECISION', JSON.stringify({ decision, eligibleCandidateCount: rankedEligible.length, finalists: result.finalists.map((entry) => entry.candidate.id), routing: result.routing }));
writeFileSync(outputJson, JSON.stringify(result, null, 2));
if (outputMd) {
  const lines = [
    '# R4-CU-D3D-B6-S1 Aggregate Summary',
    '',
    `- Technical status: **${result.status}**`,
    `- Economic decision: **${decision}**`,
    `- Jobs: ${results.length}/${expectedJobs}`,
    `- Eligible candidates: ${rankedEligible.length}`,
    `- Finalists: ${result.finalists.map((entry) => entry.candidate.id).join(', ') || 'none'}`,
    `- Routing: ${result.routing}`,
    '',
    'This summary is a causal shadow screen. It does not authorize canonical parameter mutation.'
  ];
  writeFileSync(outputMd, `${lines.join('\n')}\n`);
}
assert.equal(technicalGates.ok, true, 'R4-CU-D3D-B6-S1 aggregate technical gate failed');
