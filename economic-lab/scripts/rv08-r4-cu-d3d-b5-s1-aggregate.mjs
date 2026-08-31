import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const contractPath = resolve('economic-lab/diagnostics/reality-validation/r4-cu-d3d-b5-shadow-repair-family-contract.json');
const contractText = readFileSync(contractPath, 'utf8');
const contract = JSON.parse(contractText);
const resultsDir = resolve(process.env.RESULTS_DIR || 'economic-lab/performance-results/b5-s1-input');
const outputJson = resolve(process.env.OUTPUT_JSON || 'economic-lab/performance-results/r4-cu-d3d-b5-s1-aggregate.json');
const EPS = 1e-12;
const IMPROVEMENT_EPS = 1e-9;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = (values) => values.reduce((total, value) => total + finite(value), 0);
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

function walk(directory) {
  const files = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function bandLogDistance(value, band) {
  const number = finite(value, Number.NaN);
  const low = finite(band?.[0], Number.NaN);
  const high = finite(band?.[1], Number.NaN);
  if (!(number > 0) || !(low > 0) || !(high >= low)) return Math.log(low / EPS);
  if (number < low) return Math.log(low / number);
  if (number > high) return Math.log(number / high);
  return 0;
}

function safeRatio(numerator, denominator) {
  const n = finite(numerator, Number.NaN);
  const d = finite(denominator, Number.NaN);
  if (!Number.isFinite(n) || !Number.isFinite(d)) return null;
  if (Math.abs(d) <= EPS) return n <= EPS ? 1 : Number.MAX_SAFE_INTEGER;
  return n / d;
}

function candidateKey(candidateId, seed) {
  return `${candidateId}@@${seed}`;
}

assert.equal(contract.front, 'R4-CU-D3D-B5-S1', 'B5 Stage-1 contract front mismatch');
assert.equal(contract.canonicalMutationAuthorized, false, 'Canonical mutation must remain locked');
assert.equal(contract.directParameterCalibrationAuthorized, false, 'Direct calibration must remain locked');
assert.ok(existsSync(resultsDir), `B5 result directory is missing: ${resultsDir}`);

const candidateIds = new Set(contract.candidates.map((candidate) => candidate.id));
const stage1Seeds = new Set(contract.stage1Execution.seeds.map((row) => row.seed));
const expectedPairs = new Set(
  contract.candidates.flatMap((candidate) =>
    contract.stage1Execution.seeds.map((row) => candidateKey(candidate.id, row.seed)))
);

const sourceFiles = walk(resultsDir)
  .filter((path) => basename(path).startsWith('r4-cu-d3d-b5-s1-'))
  .filter((path) => path.endsWith('.json'))
  .filter((path) => !basename(path).includes('aggregate'))
  .sort();

const records = [];
for (const path of sourceFiles) {
  const text = readFileSync(path, 'utf8');
  const result = JSON.parse(text);
  const key = candidateKey(result.candidate?.id, result.seed);
  records.push({
    key,
    path: path.replace(`${resolve('.')}/`, ''),
    sha256: sha256(text),
    result
  });
}

const duplicates = [];
const byPair = new Map();
for (const record of records) {
  if (byPair.has(record.key)) duplicates.push(record.key);
  else byPair.set(record.key, record);
}

const missingPairs = [...expectedPairs].filter((key) => !byPair.has(key)).sort();
const unexpectedPairs = [...byPair.keys()].filter((key) => !expectedPairs.has(key)).sort();
const controlBySeed = new Map();
for (const seedSpec of contract.stage1Execution.seeds) {
  const control = byPair.get(candidateKey('CTRL', seedSpec.seed));
  if (control) controlBySeed.set(seedSpec.seed, control.result);
}

const labourBand = contract.empiricalShadowScoringBands.labourIncomeShare;
const consumptionBand = contract.empiricalShadowScoringBands.realizedConsumptionShare;
const candidates = [];

for (const candidateSpec of contract.candidates.filter((candidate) => candidate.kind !== 'CONTROL')) {
  const seedComparisons = [];
  for (const seedSpec of contract.stage1Execution.seeds) {
    const candidateRecord = byPair.get(candidateKey(candidateSpec.id, seedSpec.seed));
    const control = controlBySeed.get(seedSpec.seed);
    if (!candidateRecord || !control) continue;
    const result = candidateRecord.result;

    const labourMedian = finite(result.summary?.employeeCompensationShareOfPositiveGva?.median, Number.NaN);
    const controlLabourMedian = finite(control.summary?.employeeCompensationShareOfPositiveGva?.median, Number.NaN);
    const consumptionMedian = finite(result.summary?.realizedConsumptionShareOfCashDisposableIncome?.median, Number.NaN);
    const controlConsumptionMedian = finite(control.summary?.realizedConsumptionShareOfCashDisposableIncome?.median, Number.NaN);
    const labourDistance = bandLogDistance(labourMedian, labourBand);
    const controlLabourDistance = bandLogDistance(controlLabourMedian, labourBand);
    const consumptionDistance = bandLogDistance(consumptionMedian, consumptionBand);
    const controlConsumptionDistance = bandLogDistance(controlConsumptionMedian, consumptionBand);
    const activeFirmRatio = safeRatio(result.summary?.activeFirms?.median, control.summary?.activeFirms?.median);
    const finalActiveFirmRatio = safeRatio(result.summary?.finalActiveFirms, control.summary?.finalActiveFirms);
    const purchasingPowerRatio = safeRatio(
      result.summary?.nominalPurchasingPowerProxy?.median,
      control.summary?.nominalPurchasingPowerProxy?.median
    );
    const inputShortageRatio = safeRatio(
      result.summary?.totalInputShortageUnits,
      control.summary?.totalInputShortageUnits
    );
    const integrityPassed = result.gates?.ok === true;
    const labourImproved = labourDistance + IMPROVEMENT_EPS < controlLabourDistance;
    const consumptionImproved = consumptionDistance + IMPROVEMENT_EPS < controlConsumptionDistance;
    const firmRetentionPassed = Number.isFinite(activeFirmRatio) &&
      activeFirmRatio >= contract.stage1Eligibility.minimumMedianActiveFirmRatioVsControl;
    const purchasingPowerPassed = Number.isFinite(purchasingPowerRatio) &&
      purchasingPowerRatio >= contract.stage1Eligibility.minimumMedianPurchasingPowerRatioVsControl;
    const noForbiddenMutationPassed =
      result.gates?.protectedNominalSurfaceExact === true &&
      result.gates?.desiredBudgetMutationBlocked === true &&
      result.gates?.priceAndWageMutationBlocked === true &&
      result.gates?.inputCoefficientMutationBlocked === true &&
      result.gates?.financialAndMarketRuleMutationsBlocked === true;
    const eligibleOnSeed = integrityPassed && labourImproved && consumptionImproved &&
      firmRetentionPassed && purchasingPowerPassed && noForbiddenMutationPassed;

    seedComparisons.push({
      case: seedSpec.case,
      seed: seedSpec.seed,
      sourceFile: candidateRecord.path,
      sourceSha256: candidateRecord.sha256,
      integrityPassed,
      labour: {
        modelMedian: labourMedian,
        controlMedian: controlLabourMedian,
        distance: labourDistance,
        controlDistance: controlLabourDistance,
        improved: labourImproved
      },
      consumption: {
        modelMedian: consumptionMedian,
        controlMedian: controlConsumptionMedian,
        distance: consumptionDistance,
        controlDistance: controlConsumptionDistance,
        improved: consumptionImproved
      },
      safety: {
        activeFirmRatio,
        finalActiveFirmRatio,
        minimumActiveFirmRatio: contract.stage1Eligibility.minimumMedianActiveFirmRatioVsControl,
        firmRetentionPassed,
        purchasingPowerRatio,
        minimumPurchasingPowerRatio: contract.stage1Eligibility.minimumMedianPurchasingPowerRatioVsControl,
        purchasingPowerPassed,
        inputShortageRatio,
        nonPositiveGvaShare: finite(result.summary?.nonPositiveGvaShare),
        goodsFulfillmentMedian: finite(result.summary?.goodsFulfillmentRate?.median),
        payrollSettlementMedian: finite(result.summary?.payrollSettlementRate?.median),
        totalExits: finite(result.summary?.totalExits),
        totalEntries: finite(result.summary?.totalEntries),
        wageArrearsMedian: finite(result.summary?.wageArrears?.median)
      },
      noForbiddenMutationPassed,
      twoAxisDistance: labourDistance + consumptionDistance,
      eligibleOnSeed
    });
  }

  const complete = seedComparisons.length === contract.stage1Execution.seeds.length;
  const eligible = complete && seedComparisons.every((row) => row.eligibleOnSeed);
  const worstSeedTwoAxisDistance = complete
    ? Math.max(...seedComparisons.map((row) => row.twoAxisDistance))
    : Number.MAX_SAFE_INTEGER;
  const totalCountryMonths = sum(seedComparisons.map((row) =>
    byPair.get(candidateKey(candidateSpec.id, row.seed))?.result?.summary?.countryMonths));
  const totalNonPositiveGva = sum(seedComparisons.map((row) =>
    byPair.get(candidateKey(candidateSpec.id, row.seed))?.result?.summary?.nonPositiveGvaCountryMonths));
  const pooledNonPositiveGvaShare = totalCountryMonths > 0 ? totalNonPositiveGva / totalCountryMonths : 1;
  const minimumActiveFirmRatio = complete ? Math.min(...seedComparisons.map((row) => finite(row.safety.activeFirmRatio))) : 0;
  const minimumPurchasingPowerRatio = complete ? Math.min(...seedComparisons.map((row) => finite(row.safety.purchasingPowerRatio))) : 0;
  const maximumInputShortageRatio = complete
    ? Math.max(...seedComparisons.map((row) => finite(row.safety.inputShortageRatio, Number.MAX_SAFE_INTEGER)))
    : Number.MAX_SAFE_INTEGER;

  candidates.push({
    candidate: candidateSpec,
    complete,
    eligible,
    status: eligible ? 'PARETO_ELIGIBLE' : 'NOT_ELIGIBLE',
    worstSeedTwoAxisDistance,
    pooledNonPositiveGvaShare,
    minimumActiveFirmRatio,
    minimumPurchasingPowerRatio,
    maximumInputShortageRatio,
    seedComparisons
  });
}

candidates.sort((a, b) =>
  a.worstSeedTwoAxisDistance - b.worstSeedTwoAxisDistance ||
  a.pooledNonPositiveGvaShare - b.pooledNonPositiveGvaShare ||
  b.minimumActiveFirmRatio - a.minimumActiveFirmRatio ||
  a.maximumInputShortageRatio - b.maximumInputShortageRatio ||
  a.candidate.id.localeCompare(b.candidate.id)
);

const eligibleCandidates = candidates.filter((candidate) => candidate.eligible);
const finalists = [];
const usedValueScales = new Set();
for (const candidate of eligibleCandidates) {
  if (finalists.length >= contract.stage1Eligibility.maximumFinalists) break;
  const valueScale = candidate.candidate.valueScale;
  if (usedValueScales.has(valueScale)) continue;
  finalists.push(candidate);
  usedValueScales.add(valueScale);
}

const integrityGates = {
  contractFrontCorrect: contract.front === 'R4-CU-D3D-B5-S1',
  canonicalMutationLocked: contract.canonicalMutationAuthorized === false,
  directCalibrationLocked: contract.directParameterCalibrationAuthorized === false,
  candidateCountFrozen: contract.candidates.length === 16,
  seedCountFrozen: contract.stage1Execution.seeds.length === 2,
  expectedMatrixJobCountFrozen:
    contract.stage1Execution.matrixJobs === contract.candidates.length * contract.stage1Execution.seeds.length,
  exactSourceFileCount: sourceFiles.length === expectedPairs.size,
  uniqueCandidateSeedPairs: duplicates.length === 0,
  noMissingPairs: missingPairs.length === 0,
  noUnexpectedPairs: unexpectedPairs.length === 0,
  onlyPreregisteredCandidates: records.every((record) => candidateIds.has(record.result.candidate?.id)),
  onlyOriginalStage1Seeds: records.every((record) => stage1Seeds.has(record.result.seed)),
  controlsPresentForEverySeed: controlBySeed.size === contract.stage1Execution.seeds.length,
  allPerJobIntegrityGatesPassed: records.every((record) => record.result.gates?.ok === true),
  allExactReplayPassed: records.every((record) =>
    record.result.gates?.exactCanonicalReplay === true && record.result.gates?.exactDiagnosticReplay === true),
  allAccountingHealthy: records.every((record) => record.result.gates?.hardAccountingHealthy === true),
  allProtectedSurfacesExact: records.every((record) => record.result.gates?.protectedNominalSurfaceExact === true),
  allSourceHashesRetained: records.every((record) => /^[a-f0-9]{64}$/.test(record.sha256)),
  heldoutSeedsNotUsed: records.every((record) => !contract.stage1Execution.heldoutSeedsReserved.includes(record.result.seed)),
  eligibilityUsesBothOriginalSeeds: candidates.every((candidate) =>
    candidate.seedComparisons.length === contract.stage1Execution.seeds.length),
  finalistDiversityRuleApplied: finalists.length === new Set(finalists.map((row) => row.candidate.valueScale)).size,
  maximumFinalistsRespected: finalists.length <= contract.stage1Eligibility.maximumFinalists,
  failedCasesRetained: candidates.length === contract.candidates.filter((candidate) => candidate.kind !== 'CONTROL').length
};
integrityGates.ok = Object.values(integrityGates).every(Boolean);

const decision = eligibleCandidates.length
  ? {
      status: 'ADVANCE_TO_B5_STAGE2_HELDOUT_REPLICATION',
      familySufficient: true,
      eligibleCandidateCount: eligibleCandidates.length,
      finalists: finalists.map((row) => row.candidate.id),
      finalistDiversityRule: 'at most one finalist per valueScale',
      canonicalMutationAuthorized: false,
      nextFront: contract.nextFrontIfEligible
    }
  : {
      status: contract.stage1Eligibility.noEligibleDecision,
      familySufficient: false,
      eligibleCandidateCount: 0,
      finalists: [],
      canonicalMutationAuthorized: false,
      nextFront: contract.nextFrontIfNone
    };

const controlSummaries = contract.stage1Execution.seeds.map((seedSpec) => {
  const record = byPair.get(candidateKey('CTRL', seedSpec.seed));
  return {
    case: seedSpec.case,
    seed: seedSpec.seed,
    sourceFile: record?.path || null,
    sourceSha256: record?.sha256 || null,
    summary: record?.result?.summary || null
  };
});

const result = {
  schemaVersion: 'r4-cu-d3d-b5-s1-aggregate-v0.1',
  front: 'R4-CU-D3D-B5-S1',
  generatedAt: new Date().toISOString(),
  contract: {
    path: 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b5-shadow-repair-family-contract.json',
    sha256: sha256(contractText)
  },
  sourceInventory: {
    resultsDir: resultsDir.replace(`${resolve('.')}/`, ''),
    expectedPairs: expectedPairs.size,
    sourceFiles: sourceFiles.length,
    duplicates,
    missingPairs,
    unexpectedPairs
  },
  integrityGates,
  decision,
  empiricalShadowScoringBands: contract.empiricalShadowScoringBands,
  controls: controlSummaries,
  finalists,
  eligibleCandidates,
  candidates
};

console.log('WP_RV08_R4_CU_D3D_B5_S1_AGGREGATE_GATES', JSON.stringify(integrityGates));
console.log('WP_RV08_R4_CU_D3D_B5_S1_DECISION', JSON.stringify(decision));
console.log('WP_RV08_R4_CU_D3D_B5_S1_RANKING', JSON.stringify(candidates.map((row) => ({
  candidateId: row.candidate.id,
  status: row.status,
  worstSeedTwoAxisDistance: row.worstSeedTwoAxisDistance,
  pooledNonPositiveGvaShare: row.pooledNonPositiveGvaShare,
  minimumActiveFirmRatio: row.minimumActiveFirmRatio,
  minimumPurchasingPowerRatio: row.minimumPurchasingPowerRatio,
  maximumInputShortageRatio: row.maximumInputShortageRatio,
  failedSeedRules: row.seedComparisons.flatMap((seedRow) => {
    const failures = [];
    if (!seedRow.integrityPassed) failures.push('integrity');
    if (!seedRow.labour.improved) failures.push('labour-distance');
    if (!seedRow.consumption.improved) failures.push('consumption-distance');
    if (!seedRow.safety.firmRetentionPassed) failures.push('firm-retention');
    if (!seedRow.safety.purchasingPowerPassed) failures.push('purchasing-power');
    if (!seedRow.noForbiddenMutationPassed) failures.push('forbidden-mutation');
    return failures.map((failure) => `${seedRow.case}:${failure}`);
  })
}))));

mkdirSync(dirname(outputJson), { recursive: true });
writeFileSync(outputJson, JSON.stringify(result, null, 2));
console.log('WP_RV08_R4_CU_D3D_B5_S1_AGGREGATE_OUTPUT', outputJson);
assert.equal(integrityGates.ok, true, 'R4-CU-D3D-B5 Stage-1 aggregate integrity gate failed');
