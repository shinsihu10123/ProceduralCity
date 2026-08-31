import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const contract = JSON.parse(readFileSync(resolve('economic-lab/diagnostics/reality-validation/r4-cu-d3d-post-b6-s2-next-stage-bootstrap-contract.json'), 'utf8'));
const route = JSON.parse(readFileSync(resolve(process.env.ROUTE_JSON || '/tmp/post-b6-s2-route.json'), 'utf8'));
const resultsRoot = resolve(process.env.RESULTS_ROOT || 'downloaded-next-stage');
const outputJson = resolve(process.env.OUTPUT_JSON || 'economic-lab/performance-results/r4-cu-d3d-post-b6-s2-bootstrap-aggregate.json');
const outputMd = process.env.OUTPUT_MD ? resolve(process.env.OUTPUT_MD) : null;

function walk(directory) {
  const output = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) output.push(...walk(path));
    else output.push(path);
  }
  return output;
}

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const idOf = (result) => result.candidate?.id || result.candidateId || null;
const keyOf = (candidate, seed) => `${candidate}@@${seed}`;

assert.equal(contract.front, 'R4-CU-D3D-POST-B6-S2-BOOTSTRAP');
assert.ok(route.route === 'S3' || route.route === 'B7');
assert.equal(route.canonicalMutationAuthorized, false);

const expectedCandidates = route.route === 'S3'
  ? [contract.s3.controlCandidateId, route.primaryCandidateId]
  : [contract.b7.candidateId];
const expectedSeeds = route.route === 'S3' ? contract.s3.seeds : contract.b7.seeds;
const expectedMonths = route.route === 'S3' ? contract.s3.months : contract.b7.months;
const expectedKeys = new Set(expectedCandidates.flatMap((candidate) => expectedSeeds.map((seed) => keyOf(candidate, seed))));

const files = walk(resultsRoot)
  .filter((path) => path.endsWith('.json'))
  .filter((path) => !basename(path).includes('aggregate'))
  .sort();
const records = [];
for (const path of files) {
  const result = JSON.parse(readFileSync(path, 'utf8'));
  if (result.schemaVersion !== 'r4-cu-d3d-b6-s1-shadow-screen-v0.1') continue;
  const key = keyOf(idOf(result), result.seed);
  if (!expectedKeys.has(key)) continue;
  records.push({ key, path, result });
}

const duplicates = records.map((row) => row.key).filter((key, index, rows) => rows.indexOf(key) !== index);
const byKey = new Map(records.map((row) => [row.key, row]));
const missing = [...expectedKeys].filter((key) => !byKey.has(key));
const unexpected = records.map((row) => row.key).filter((key) => !expectedKeys.has(key));

const requiredGateNames = route.route === 'S3' ? contract.s3.requiredGates : contract.b7.requiredGates;
const gateFailures = [];
for (const record of records) {
  for (const name of requiredGateNames) {
    if (record.result.gates?.[name] !== true) gateFailures.push(`${record.key}:${name}`);
  }
  if (record.result.gates?.ok !== true) gateFailures.push(`${record.key}:ok`);
}

function summary(result) {
  return {
    candidateId: idOf(result),
    seed: result.seed,
    months: result.months,
    rows: result.summary?.rows,
    positiveGvaRows: result.summary?.positiveGvaRows,
    nonPositiveGvaShare: finite(result.summary?.nonPositiveGvaShare),
    labourShareMedian: finite(result.summary?.employeeCompensationSharePositiveGva?.median),
    consumptionShareMedian: finite(result.summary?.realizedConsumptionSharePositiveIncome?.median),
    netSavingShareMedian: finite(result.summary?.netSavingSharePositiveIncome?.median),
    inputShortageMedian: finite(result.summary?.inputShortageUnits?.median),
    totalInputShortageUnits: finite(result.summary?.totalInputShortageUnits),
    activeFirmsMedian: finite(result.summary?.activeFirms?.median),
    purchasingPowerMedian: finite(result.summary?.nominalPurchasingPower?.median),
    goodsFulfillmentMedian: finite(result.summary?.goodsFulfillmentRatio?.median),
    payrollSettlementMedian: finite(result.summary?.payrollSettlementRatio?.median),
    maxAbsoluteReconstructionResidual: finite(result.summary?.maxAbsoluteReconstructionResidual),
    worldDigest: result.worldDigest || result.digest,
    allIntegrityGatesPassed: result.gates?.ok === true
  };
}

const technicalGates = {
  routeResolved: route.route === 'S3' || route.route === 'B7',
  expectedJobCount: expectedKeys.size === (route.route === 'S3' ? contract.s3.candidateSeedJobs : contract.b7.candidateSeedJobs),
  completeResultCount: records.length === expectedKeys.size,
  noDuplicateJobs: duplicates.length === 0,
  noMissingJobs: missing.length === 0,
  noUnexpectedJobs: unexpected.length === 0,
  frozenHorizonExact: records.every((record) => record.result.months === expectedMonths),
  allRequiredIntegrityGatesPassed: gateFailures.length === 0,
  primaryBoundFromS2: route.route === 'B7' || (Boolean(route.primaryCandidateId) && route.primaryCandidateId !== contract.s3.controlCandidateId),
  canonicalMutationLocked: contract.canonicalMutationAuthorized === false && route.canonicalMutationAuthorized === false,
  noEconomicAdmissionAtBootstrap: route.route === 'B7' || contract.s3.economicAdmissionDecisionAuthorized === false
};
technicalGates.ok = Object.values(technicalGates).every(Boolean);

const result = {
  schemaVersion: 'r4-cu-d3d-post-b6-s2-bootstrap-aggregate-v0.1',
  front: route.route === 'S3' ? 'R4-CU-D3D-B6-S3-LONG-HORIZON-BOOTSTRAP' : 'R4-CU-D3D-B7-STRUCTURAL-BASELINE-BOOTSTRAP',
  generatedAt: new Date().toISOString(),
  routeSource: route,
  status: technicalGates.ok
    ? (route.route === 'S3' ? 'S3_LONG_HORIZON_BOOTSTRAP_COMPLETE' : 'B7_STRUCTURAL_BASELINE_BOOTSTRAP_COMPLETE')
    : 'BOOTSTRAP_INTEGRITY_FAIL',
  technicalGates,
  expected: { candidates: expectedCandidates, seeds: expectedSeeds, months: expectedMonths, jobs: expectedKeys.size },
  observed: { jobs: records.length, duplicates, missing, unexpected, gateFailures },
  summaries: records.map((record) => summary(record.result)),
  decisionBoundary: {
    economicPromotionAuthorized: false,
    canonicalMutationAuthorized: false,
    nextRequiredDocument: route.route === 'S3'
      ? 'B6-S3 stress-scenario and persistence-threshold preregistration'
      : 'B7 demand-inventory topology and value-transformation diagnosis preregistration'
  }
};

mkdirSync(dirname(outputJson), { recursive: true });
writeFileSync(outputJson, JSON.stringify(result, null, 2));
if (outputMd) {
  const lines = [
    `# ${result.front} Bootstrap Summary`,
    '',
    `- Status: **${result.status}**`,
    `- Route: **${route.route}**`,
    `- Source B6-S2 decision: \`${route.aggregateDecision}\``,
    `- Primary candidate: \`${route.primaryCandidateId || 'none'}\``,
    `- Jobs: ${records.length}/${expectedKeys.size}`,
    `- Months: ${expectedMonths}`,
    `- Technical gates: ${technicalGates.ok ? 'PASS' : 'FAIL'}`,
    '',
    'This bootstrap makes no economic promotion or canonical-mutation decision.'
  ];
  writeFileSync(outputMd, `${lines.join('\n')}\n`);
}

console.log('WP_RV08_R4_CU_D3D_POST_B6_S2_BOOTSTRAP_GATES', JSON.stringify(technicalGates));
console.log('WP_RV08_R4_CU_D3D_POST_B6_S2_BOOTSTRAP_STATUS', JSON.stringify({ front: result.front, status: result.status, jobs: records.length }));
assert.equal(technicalGates.ok, true, 'Post-B6-S2 next-stage bootstrap aggregate gate failed');
