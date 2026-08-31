import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_DIR = path.resolve(ROOT, process.env.R4_CU_D3D_SOURCE_DIR ?? 'artifacts/r4-cu-d3d/source');
const OUT_DIR = path.resolve(ROOT, process.env.R4_CU_D3D_OUT_DIR ?? 'artifacts/r4-cu-d3d');
const SNAPSHOT_PATH = path.join(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-authoritative-evidence-snapshot.json');
const MEMBERSHIP_PATH = path.join(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3b-reference-membership-register.json');
const D3C_CONTRACT_PATH = path.join(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3c-official-extraction-contract.json');

const sha256 = (textOrBuffer) => createHash('sha256').update(textOrBuffer).digest('hex');
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const near = (actual, expected, tolerance = 1e-10) => Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= tolerance;

const snapshotText = await readFile(SNAPSHOT_PATH, 'utf8');
const membershipText = await readFile(MEMBERSHIP_PATH, 'utf8');
const contractText = await readFile(D3C_CONTRACT_PATH, 'utf8');
const snapshot = JSON.parse(snapshotText);
const membership = JSON.parse(membershipText);
const contract = JSON.parse(contractText);

invariant(snapshot.front === 'R4-CU-D3D', 'D3D snapshot required');
invariant(snapshot.canonicalMutationAuthorized === false, 'Canonical mutation must remain locked');
invariant(snapshot.numericCalibrationRangesAuthorized === false, 'Numeric calibration targets must remain locked');
invariant(contract.front === 'R4-CU-D3C', 'D3C contract required');
invariant(membership.front === 'R4-CU-D3B', 'D3B membership register required');

const resultPath = path.join(SOURCE_DIR, snapshot.authoritativeArtifact.expectedResultFile);
const rawPath = path.join(SOURCE_DIR, snapshot.authoritativeArtifact.expectedRawFile);
const summaryPath = path.join(SOURCE_DIR, snapshot.authoritativeArtifact.expectedSummaryFile);
const [resultText, rawCsv, sourceSummary] = await Promise.all([
  readFile(resultPath, 'utf8'),
  readFile(rawPath),
  readFile(summaryPath, 'utf8'),
]);
const result = JSON.parse(resultText);

const classChecks = [];
for (const expected of snapshot.expectedClassResults) {
  const actual = result.classResults.find((entry) => entry.id === expected.id);
  invariant(actual, `Missing class result ${expected.id}`);
  const actualStats = actual.primaryWindow2021_2023?.statistics;
  invariant(actualStats, `Missing primary statistics ${expected.id}`);
  const statisticChecks = Object.entries(expected.statistics).map(([key, expectedValue]) => ({
    key,
    expected: expectedValue,
    actual: actualStats[key],
    ok: near(actualStats[key], expectedValue),
  }));
  classChecks.push({
    id: expected.id,
    admissionExpected: expected.admissionStatus,
    admissionActual: actual.bandAdmission?.status,
    admissionExact: actual.bandAdmission?.status === expected.admissionStatus,
    completeEconomiesExact: actual.coverage?.completePrimaryEconomies === expected.completePrimaryEconomies,
    missingShareExact: near(actual.coverage?.missingShare, expected.missingShare),
    statistics: statisticChecks,
    statisticsExact: statisticChecks.every((entry) => entry.ok),
  });
}

const currentMembershipByClass = Object.fromEntries(membership.referenceClasses.map((entry) => [entry.id, entry.members]));
const artifactMembershipByClass = Object.fromEntries(result.classResults.map((entry) => [entry.id, entry.frozenMembers]));
const admitted = result.classResults.filter((entry) => entry.bandAdmission?.status === 'ADMITTED_PROVISIONAL_REFERENCE_BAND').map((entry) => entry.id).sort();
const blocked = result.classResults.filter((entry) => entry.bandAdmission?.status !== 'ADMITTED_PROVISIONAL_REFERENCE_BAND').map((entry) => entry.id).sort();
const resource = result.classResults.find((entry) => entry.id === 'REF-RESOURCE');
const canada = resource?.coverage?.countryCoverage?.find((entry) => entry.country === 'CAN');

const gates = {
  snapshotLocksPresent: snapshot.canonicalMutationAuthorized === false && snapshot.numericCalibrationRangesAuthorized === false,
  artifactFilesPresent: Boolean(resultText.length && rawCsv.length && sourceSummary.length),
  resultStatusExact: result.status === 'PASS_WITH_BLOCKED_REFERENCE_BANDS',
  sourcePublisherExact: result.source?.publisher === snapshot.expectedSource.publisher,
  sourceDatasetExact: result.source?.dataset === snapshot.expectedSource.dataset,
  requestedYearsExact: JSON.stringify(result.source?.requestedYears) === JSON.stringify(snapshot.expectedSource.requestedYears),
  primaryWindowExact: JSON.stringify(result.source?.primaryBalancedYears) === JSON.stringify(snapshot.expectedSource.primaryBalancedYears),
  rawCsvHashMatchesResult: sha256(rawCsv) === result.source?.rawCsvSha256,
  membershipHashMatchesResult: sha256(membershipText) === result.source?.membershipSha256,
  d3cContractHashMatchesResult: sha256(contractText) === result.source?.contractSha256,
  frozenMembershipExact: JSON.stringify(currentMembershipByClass) === JSON.stringify(artifactMembershipByClass),
  classEvidenceExact: classChecks.every((entry) => entry.admissionExact && entry.completeEconomiesExact && entry.missingShareExact && entry.statisticsExact),
  exactlyThreeClassesAdmitted: admitted.length === 3,
  onlyResourceClassBlocked: JSON.stringify(blocked) === JSON.stringify(['REF-RESOURCE']),
  resourceThresholdPreserved: resource?.coverage?.completePrimaryEconomies === 4 && membership.cohortPolicy?.minimumIndependentEconomiesPerBand === 5,
  resourceMemberNotSubstituted: JSON.stringify(resource?.frozenMembers) === JSON.stringify(currentMembershipByClass['REF-RESOURCE']),
  canadaMissingnessPreserved: JSON.stringify(canada?.missingYears) === JSON.stringify([2023, 2024]) && canada?.completePrimary === false,
  noModelSectorMapping: result.interpretation?.blockedUse?.includes('direct model-sector calibration') === true,
  noCanonicalPromotion: result.interpretation?.blockedUse?.includes('canonical parameter mutation') === true && contract.numericCalibrationRangesAuthorized === false,
  executionGatesPassed: result.executionGates?.ok === true,
};
gates.ok = Object.values(gates).every(Boolean);

const report = {
  schemaVersion: 'r4-cu-d3d-authoritative-evidence-gate-v0.1',
  front: 'R4-CU-D3D',
  generatedAt: new Date().toISOString(),
  status: gates.ok ? 'PASS_AUTHORITATIVE_D3C_ARTIFACT_REHYDRATED' : 'FAIL',
  authoritativeArtifact: snapshot.authoritativeArtifact,
  artifactEvidence: {
    resultSha256: sha256(resultText),
    rawCsvSha256: sha256(rawCsv),
    summarySha256: sha256(sourceSummary),
    rawPanelObservations: result.rawPanel?.length ?? 0,
    admittedClasses: admitted,
    blockedClasses: blocked,
  },
  classChecks,
  gates,
  nextFront: snapshot.nextFront,
};

await mkdir(OUT_DIR, { recursive: true });
await writeFile(path.join(OUT_DIR, 'r4-cu-d3d-authoritative-evidence-validation.json'), `${JSON.stringify(report, null, 2)}\n`);
const markdown = [
  '# R4-CU-D3D authoritative evidence gate',
  '',
  `- Status: **${report.status}**`,
  `- Source run: \`${snapshot.authoritativeArtifact.workflowRunId}\``,
  `- Source head: \`${snapshot.authoritativeArtifact.headSha}\``,
  `- Raw panel observations: ${report.artifactEvidence.rawPanelObservations}`,
  `- Admitted classes: ${admitted.join(', ')}`,
  `- Blocked classes: ${blocked.join(', ')}`,
  '',
  '| Class | Admission exact | Coverage exact | Statistics exact |',
  '|---|---:|---:|---:|',
  ...classChecks.map((entry) => `| ${entry.id} | ${entry.admissionExact} | ${entry.completeEconomiesExact && entry.missingShareExact} | ${entry.statisticsExact} |`),
  '',
  '> This gate validates provenance and preservation only. No empirical descriptor is promoted to a canonical calibration target.',
  '',
].join('\n');
await writeFile(path.join(OUT_DIR, 'r4-cu-d3d-summary.md'), markdown);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, markdown, { flag: 'a' });
console.log(JSON.stringify(report, null, 2));
if (!gates.ok) process.exitCode = 1;
