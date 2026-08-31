import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const contractPath = resolve('economic-lab/diagnostics/reality-validation/r4-cu-d3d-b4-empirical-model-gap-contract.json');
const b3SummaryPath = resolve('economic-lab/diagnostics/reality-validation/r4-cu-d3d-b3-authoritative-summary.json');
const b3ScriptPath = resolve('economic-lab/scripts/rv08-r4-cu-d3d-b3-model-side-national-accounts.mjs');
const contractText = readFileSync(contractPath, 'utf8');
const contract = JSON.parse(contractText);
const b3SummaryText = readFileSync(b3SummaryPath, 'utf8');
const b3AuthoritativeSummary = JSON.parse(b3SummaryText);
const outputJson = resolve(process.env.OUTPUT_JSON || 'economic-lab/performance-results/r4-cu-d3d-b4-empirical-model-gap.json');
const outputDir = dirname(outputJson);
const EPS = 1e-9;
mkdirSync(outputDir, { recursive: true });

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = (values) => values.reduce((total, value) => total + finite(value), 0);
const hash = (text) => createHash('sha256').update(text).digest('hex');

function percentile(values, probability) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function statistics(values) {
  const finiteValues = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finiteValues.length) {
    return { count: 0, min: null, p10: null, p25: null, median: null, p75: null, p90: null, max: null, iqr: null, mean: null };
  }
  const p25 = percentile(finiteValues, 0.25);
  const p75 = percentile(finiteValues, 0.75);
  return {
    count: finiteValues.length,
    min: finiteValues[0],
    p10: percentile(finiteValues, 0.10),
    p25,
    median: percentile(finiteValues, 0.50),
    p75,
    p90: percentile(finiteValues, 0.90),
    max: finiteValues.at(-1),
    iqr: p75 - p25,
    mean: sum(finiteValues) / finiteValues.length
  };
}

function medianByCountry(rows, selector, predicate = () => true) {
  const byCountry = new Map();
  for (const row of rows) {
    if (!predicate(row)) continue;
    const value = selector(row);
    if (!Number.isFinite(value)) continue;
    if (!byCountry.has(row.countryId)) byCountry.set(row.countryId, []);
    byCountry.get(row.countryId).push(value);
  }
  return [...byCountry.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([countryId, values]) => ({ countryId, median: percentile(values, 0.5), observations: values.length }));
}

function runB3Source(caseSpec) {
  const sourceOutputPath = resolve(outputDir, `r4-cu-d3d-b4-source-${caseSpec.case}.json`);
  const child = spawnSync(process.execPath, [b3ScriptPath], {
    cwd: resolve('.'),
    env: {
      ...process.env,
      DIAG_SEED: caseSpec.seed,
      DIAG_MONTHS: String(contract.execution.monthsPerSeed),
      OUTPUT_JSON: sourceOutputPath
    },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });

  if (child.status !== 0) {
    process.stderr.write(child.stdout || '');
    process.stderr.write(child.stderr || '');
    throw new Error(`${caseSpec.case}: B3 source reconstruction failed with status ${child.status}`);
  }

  const sourceText = readFileSync(sourceOutputPath, 'utf8');
  const source = JSON.parse(sourceText);
  assert.equal(source.front, 'R4-CU-D3D-B3', `${caseSpec.case}: wrong source front`);
  assert.equal(source.seed, caseSpec.seed, `${caseSpec.case}: seed mismatch`);
  assert.equal(source.months, contract.execution.monthsPerSeed, `${caseSpec.case}: month mismatch`);
  assert.equal(source.gates?.ok, true, `${caseSpec.case}: B3 source gates failed`);
  assert.equal(source.gates?.exactCanonicalReplay, true, `${caseSpec.case}: B3 canonical replay failed`);
  assert.equal(source.gates?.exactDiagnosticReplay, true, `${caseSpec.case}: B3 diagnostic replay failed`);
  assert.equal(source.gates?.hardAccountingHealthy, true, `${caseSpec.case}: B3 accounting health failed`);
  return { source, sourceText, sourceOutputPath };
}

function analyzeCase(caseSpec, sourceBundle) {
  const { source, sourceText, sourceOutputPath } = sourceBundle;
  const rows = source.rows || [];
  const positiveGvaRows = rows.filter((row) => finite(row.production?.gvaBasicPriceProxy) > EPS);
  const nonPositiveGvaRows = rows.filter((row) => finite(row.production?.gvaBasicPriceProxy) <= EPS);
  const positiveDisposableRows = rows.filter((row) => finite(row.household?.cashDisposableHouseholdIncome) > EPS);
  const nonPositiveDisposableRows = rows.filter((row) => finite(row.household?.cashDisposableHouseholdIncome) <= EPS);

  const allLabourShares = rows
    .map((row) => finite(row.labour?.employeeCompensationShareOfGvaBasic, Number.NaN))
    .filter(Number.isFinite);
  const positiveGvaLabourShares = positiveGvaRows
    .map((row) => finite(row.labour?.employeeCompensationShareOfGvaBasic, Number.NaN))
    .filter(Number.isFinite);
  const realizedConsumptionShares = positiveDisposableRows
    .map((row) => finite(row.household?.realizedConsumptionShareOfCashDisposableIncome, Number.NaN))
    .filter(Number.isFinite);
  const netSavingShares = positiveDisposableRows
    .map((row) => finite(row.household?.netSavingShareOfCashDisposableIncome, Number.NaN))
    .filter(Number.isFinite);

  const allLabour = statistics(allLabourShares);
  const labour = statistics(positiveGvaLabourShares);
  const consumption = statistics(realizedConsumptionShares);
  const saving = statistics(netSavingShares);
  const labourCountryMedians = medianByCountry(
    rows,
    (row) => finite(row.labour?.employeeCompensationShareOfGvaBasic, Number.NaN),
    (row) => finite(row.production?.gvaBasicPriceProxy) > EPS
  );
  const consumptionCountryMedians = medianByCountry(
    rows,
    (row) => finite(row.household?.realizedConsumptionShareOfCashDisposableIncome, Number.NaN),
    (row) => finite(row.household?.cashDisposableHouseholdIncome) > EPS
  );

  const labourEnvelope = contract.empiricalEvidence.labourIncomeShare.outerIqrEnvelope;
  const consumptionEnvelope = contract.empiricalEvidence.realizedHouseholdConsumptionShare.outerIqrEnvelope;
  const labourUpper = finite(labourEnvelope[1]);
  const consumptionLower = finite(consumptionEnvelope[0]);

  return {
    case: caseSpec.case,
    seed: caseSpec.seed,
    source: {
      front: source.front,
      status: source.status,
      worldDigest: source.worldDigest,
      outputFile: sourceOutputPath.replace(`${resolve('.')}/`, ''),
      sha256: hash(sourceText),
      exactCanonicalReplay: source.gates.exactCanonicalReplay,
      exactDiagnosticReplay: source.gates.exactDiagnosticReplay,
      hardAccountingHealthy: source.gates.hardAccountingHealthy,
      maxScaledIdentityResidual: source.summary.maxScaledIdentityResidual
    },
    coverage: {
      countryMonths: rows.length,
      positiveGvaCountryMonths: positiveGvaRows.length,
      nonPositiveGvaCountryMonths: nonPositiveGvaRows.length,
      nonPositiveGvaShare: rows.length ? nonPositiveGvaRows.length / rows.length : null,
      positiveDisposableIncomeCountryMonths: positiveDisposableRows.length,
      nonPositiveDisposableIncomeCountryMonths: nonPositiveDisposableRows.length,
      nonPositiveDisposableIncomeShare: rows.length ? nonPositiveDisposableRows.length / rows.length : null
    },
    modelDistributions: {
      allObservationEmployeeCompensationShareOfGva: allLabour,
      positiveGvaEmployeeCompensationShare: labour,
      positiveDisposableIncomeRealizedConsumptionShare: consumption,
      positiveDisposableIncomeNetSavingShare: saving,
      positiveGvaCountryMedians: labourCountryMedians,
      positiveGvaCountryMedianDistribution: statistics(labourCountryMedians.map((row) => row.median)),
      consumptionCountryMedians,
      consumptionCountryMedianDistribution: statistics(consumptionCountryMedians.map((row) => row.median))
    },
    gapMetrics: {
      labourMedianToEmpiricalUpperFactor: labour.median / labourUpper,
      labourP25ToEmpiricalUpperFactor: labour.p25 / labourUpper,
      realizedConsumptionEmpiricalLowerToModelMedianFactor: consumptionLower / Math.max(EPS, consumption.median),
      realizedConsumptionEmpiricalLowerToModelMaximumFactor: consumptionLower / Math.max(EPS, consumption.max),
      netSavingMedianExcessOverAdmittedSavingUpperPercentagePoints:
        (saving.median - (1 - consumptionLower)) * 100
    },
    separationTests: {
      labourPositiveGvaP25AboveEmpiricalUpper: labour.p25 > labourUpper,
      labourEveryCountryMedianAboveEmpiricalUpper: labourCountryMedians.every((row) => row.median > labourUpper),
      realizedConsumptionMaximumBelowEmpiricalLower: consumption.max < consumptionLower,
      realizedConsumptionEveryCountryMedianBelowEmpiricalLower: consumptionCountryMedians.every((row) => row.median < consumptionLower)
    }
  };
}

assert.equal(contract.front, 'R4-CU-D3D-B4', 'B4 contract front mismatch');
assert.equal(contract.canonicalMutationAuthorized, false, 'Canonical mutation must remain locked');
assert.equal(contract.directParameterCalibrationAuthorized, false, 'Direct parameter calibration must remain locked');
assert.equal(contract.execution?.monthsPerSeed, 24, 'B4 horizon must remain frozen at 24 months');
assert.equal(contract.execution?.seeds?.length, 4, 'B4 must retain four frozen seeds');
assert.equal(b3AuthoritativeSummary.front, 'R4-CU-D3D-B3', 'B3 authoritative summary front mismatch');
assert.equal(b3AuthoritativeSummary.globalGates?.allFourSeedsPassed, true, 'B3 authoritative summary is not closed PASS');

const cases = contract.execution.seeds.map((caseSpec) => analyzeCase(caseSpec, runB3Source(caseSpec)));
const labourEnvelope = contract.empiricalEvidence.labourIncomeShare.outerIqrEnvelope;
const consumptionEnvelope = contract.empiricalEvidence.realizedHouseholdConsumptionShare.outerIqrEnvelope;
const modelLabourMedians = cases.map((row) => row.modelDistributions.positiveGvaEmployeeCompensationShare.median);
const modelConsumptionMedians = cases.map((row) => row.modelDistributions.positiveDisposableIncomeRealizedConsumptionShare.median);
const modelConsumptionMaxima = cases.map((row) => row.modelDistributions.positiveDisposableIncomeRealizedConsumptionShare.max);

const aggregate = {
  seeds: cases.length,
  totalCountryMonths: sum(cases.map((row) => row.coverage.countryMonths)),
  positiveGvaCountryMonths: sum(cases.map((row) => row.coverage.positiveGvaCountryMonths)),
  nonPositiveGvaCountryMonths: sum(cases.map((row) => row.coverage.nonPositiveGvaCountryMonths)),
  nonPositiveGvaShare: ratioOrNull(
    sum(cases.map((row) => row.coverage.nonPositiveGvaCountryMonths)),
    sum(cases.map((row) => row.coverage.countryMonths))
  ),
  modelPositiveGvaLabourMedianRangeAcrossSeeds: [Math.min(...modelLabourMedians), Math.max(...modelLabourMedians)],
  empiricalLabourOuterIqrEnvelope: labourEnvelope,
  minimumLabourMedianToEmpiricalUpperFactor: Math.min(...cases.map((row) => row.gapMetrics.labourMedianToEmpiricalUpperFactor)),
  modelRealizedConsumptionMedianRangeAcrossSeeds: [Math.min(...modelConsumptionMedians), Math.max(...modelConsumptionMedians)],
  modelRealizedConsumptionMaximumRangeAcrossSeeds: [Math.min(...modelConsumptionMaxima), Math.max(...modelConsumptionMaxima)],
  empiricalRealizedConsumptionOuterIqrEnvelope: consumptionEnvelope,
  minimumEmpiricalLowerToModelConsumptionMedianFactor: Math.min(...cases.map((row) => row.gapMetrics.realizedConsumptionEmpiricalLowerToModelMedianFactor)),
  minimumEmpiricalLowerToModelConsumptionMaximumFactor: Math.min(...cases.map((row) => row.gapMetrics.realizedConsumptionEmpiricalLowerToModelMaximumFactor))
};

function ratioOrNull(numerator, denominator) {
  return Math.abs(finite(denominator)) > EPS ? finite(numerator) / finite(denominator) : null;
}

const gates = {
  noCanonicalMutation: contract.canonicalMutationAuthorized === false,
  noDirectParameterCalibration: contract.directParameterCalibrationAuthorized === false,
  fourFrozenSeedsExecuted: cases.length === 4,
  allB3SourcesPassed: cases.every((row) => row.source.status === 'PASS_MODEL_SIDE_RECONSTRUCTION_WITH_EXPLICIT_SEMANTIC_GAPS'),
  allB3ExactReplayPassed: cases.every((row) => row.source.exactCanonicalReplay && row.source.exactDiagnosticReplay),
  allB3AccountingHealthy: cases.every((row) => row.source.hardAccountingHealthy),
  sourceHashesRetained: cases.every((row) => /^[a-f0-9]{64}$/.test(row.source.sha256)),
  fullCountryMonthCoverage: cases.every((row) => row.coverage.countryMonths === contract.execution.monthsPerSeed * 4),
  denominatorPathologyRetained: cases.every((row) => row.coverage.nonPositiveGvaCountryMonths >= 0),
  positiveDenominatorSensitivityPublished: cases.every((row) => row.modelDistributions.positiveGvaEmployeeCompensationShare.count > 0),
  severeLabourGapReplicated: cases.every((row) => row.separationTests.labourPositiveGvaP25AboveEmpiricalUpper),
  severeHouseholdFlowGapReplicated: cases.every((row) => row.separationTests.realizedConsumptionMaximumBelowEmpiricalLower),
  everyCountryMedianShowsLabourSeparation: cases.every((row) => row.separationTests.labourEveryCountryMedianAboveEmpiricalUpper),
  everyCountryMedianShowsConsumptionSeparation: cases.every((row) => row.separationTests.realizedConsumptionEveryCountryMedianBelowEmpiricalLower),
  twoIndependentAxesConfirmed: cases.every((row) =>
    row.separationTests.labourPositiveGvaP25AboveEmpiricalUpper &&
    row.separationTests.realizedConsumptionMaximumBelowEmpiricalLower),
  partialSemanticMatchVisible:
    contract.empiricalEvidence.labourIncomeShare.semanticMatch.startsWith('PARTIAL_') &&
    contract.empiricalEvidence.realizedHouseholdConsumptionShare.semanticMatch.startsWith('PARTIAL_'),
  desiredBudgetMappingBlocked:
    contract.empiricalEvidence.realizedHouseholdConsumptionShare.desiredConsumptionBudgetMappingAuthorized === false,
  fictionalCountryClassAssignmentBlocked: contract.execution.fictionalCountryClassAssignmentAuthorized === false,
  shadowScoringOnly: contract.admissionPolicy.directCanonicalTarget === false,
  gapFactorParameterUseBlocked: contract.severeGapCriteria.gapFactorMayNotBeUsedAsParameterMultiplier === true
};
gates.ok = Object.values(gates).every(Boolean);

const decision = gates.ok
  ? {
      status: 'PASS_SEVERE_TWO_AXIS_EMPIRICAL_GAP_CONFIRMED',
      referenceBandsAdmittedForShadowScoringOnly: true,
      directCanonicalTargetsAuthorized: false,
      canonicalMutationAuthorized: false,
      labourAxis: 'MODEL_EMPLOYEE_COMPENSATION_SHARE_FAR_ABOVE_EMPIRICAL_LABOUR_INCOME_SHARE_ENVELOPE',
      householdFlowAxis: 'MODEL_REALIZED_CONSUMPTION_SHARE_FAR_BELOW_EMPIRICAL_REALIZED_CONSUMPTION_ENVELOPE',
      nextFront: contract.nextFront
    }
  : {
      status: 'FAIL_OR_INSUFFICIENT_REPLICATION',
      referenceBandsAdmittedForShadowScoringOnly: false,
      directCanonicalTargetsAuthorized: false,
      canonicalMutationAuthorized: false,
      nextFront: 'REPAIR_B4_MEASUREMENT_OR_REPLICATION'
    };

const result = {
  schemaVersion: 'r4-cu-d3d-b4-empirical-model-gap-v0.1',
  front: 'R4-CU-D3D-B4',
  generatedAt: new Date().toISOString(),
  contract: {
    path: 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b4-empirical-model-gap-contract.json',
    sha256: hash(contractText)
  },
  b3AuthoritativeSummary: {
    path: 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b3-authoritative-summary.json',
    sha256: hash(b3SummaryText),
    runId: b3AuthoritativeSummary.authoritativeEvidence.runId,
    head: b3AuthoritativeSummary.authoritativeEvidence.head
  },
  empiricalEvidence: contract.empiricalEvidence,
  gates,
  decision,
  aggregate,
  cases
};

console.log('WP_RV08_R4_CU_D3D_B4_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CU_D3D_B4_DECISION', JSON.stringify(decision));
console.log('WP_RV08_R4_CU_D3D_B4_AGGREGATE', JSON.stringify(aggregate));
for (const row of cases) {
  console.log('WP_RV08_R4_CU_D3D_B4_CASE', JSON.stringify({
    case: row.case,
    seed: row.seed,
    coverage: row.coverage,
    positiveGvaLabourShare: row.modelDistributions.positiveGvaEmployeeCompensationShare,
    realizedConsumptionShare: row.modelDistributions.positiveDisposableIncomeRealizedConsumptionShare,
    netSavingShare: row.modelDistributions.positiveDisposableIncomeNetSavingShare,
    gapMetrics: row.gapMetrics,
    separationTests: row.separationTests
  }));
}

writeFileSync(outputJson, JSON.stringify(result, null, 2));
console.log('WP_RV08_R4_CU_D3D_B4_OUTPUT', outputJson);
assert.equal(gates.ok, true, 'R4-CU-D3D-B4 gate failed');
