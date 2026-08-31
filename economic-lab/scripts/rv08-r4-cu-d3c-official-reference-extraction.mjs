import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.resolve(ROOT, process.env.R4_CU_D3C_OUT_DIR ?? 'artifacts/r4-cu-d3c');
const MEMBERSHIP = path.join(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3b-reference-membership-register.json');
const CONTRACT = path.join(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3c-official-extraction-contract.json');
const DATASET = 'OECD.SDD.NAD,DSD_NAAG_IV@DF_NAAG_IV,1.0';
const YEARS = [2021, 2022, 2023, 2024];
const PRIMARY = [2021, 2022, 2023];

const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const hash = (text) => createHash('sha256').update(text).digest('hex');

function csvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (row.length || field.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim() !== ''));
}

function column(headers, aliases, label) {
  const normalized = headers.map((value) => String(value).trim().replace(/[\s-]+/g, '_').toUpperCase());
  for (const alias of aliases) {
    const index = normalized.indexOf(alias);
    if (index >= 0) return index;
  }
  throw new Error(`Missing ${label} column; headers=${normalized.join(',')}`);
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function statistics(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return { count: 0, min: null, p25: null, median: null, p75: null, max: null, iqr: null, mean: null };
  const p25 = percentile(finite, 0.25);
  const p75 = percentile(finite, 0.75);
  return {
    count: finite.length,
    min: finite[0],
    p25,
    median: percentile(finite, 0.5),
    p75,
    max: finite.at(-1),
    iqr: p75 - p25,
    mean: finite.reduce((sum, value) => sum + value, 0) / finite.length,
  };
}

async function officialCsv(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'text/csv',
          'accept-language': 'en',
          'user-agent': 'ProceduralCity-R4-CU-D3C/1.0',
        },
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`OECD SDMX HTTP ${response.status}: ${body.slice(0, 240)}`);
      if (!body.includes(',') || /^\s*</.test(body)) throw new Error(`Unexpected OECD response: ${body.slice(0, 240)}`);
      return {
        body,
        contentType: response.headers.get('content-type'),
        etag: response.headers.get('etag'),
        lastModified: response.headers.get('last-modified'),
      };
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

const membershipText = await readFile(MEMBERSHIP, 'utf8');
const contractText = await readFile(CONTRACT, 'utf8');
const membership = JSON.parse(membershipText);
const contract = JSON.parse(contractText);
invariant(membership.front === 'R4-CU-D3B', 'Frozen D3B membership register required');
invariant(contract.front === 'R4-CU-D3C', 'D3C contract required');
invariant(contract.source.dataset === DATASET, 'OECD dataset identifier changed');
invariant(!contract.canonicalMutationAuthorized && !contract.numericCalibrationRangesAuthorized, 'D3C locks must remain false');

const areas = [...new Set(membership.referenceClasses.flatMap((entry) => entry.members))].sort();
const series = `A.${areas.join('+')}.B1G.C.PT_B1G.`;
const url = `https://sdmx.oecd.org/public/rest/data/${DATASET}/${series}?startPeriod=2021&endPeriod=2024&dimensionAtObservation=AllDimensions&format=csvfile`;
const retrievedAt = new Date().toISOString();
const response = await officialCsv(url);
const table = csvRows(response.body);
invariant(table.length > 1, 'OECD response contained no observations');

const headers = table[0];
const countryColumn = column(headers, ['REF_AREA', 'LOCATION', 'COUNTRY', 'GEO'], 'country');
const yearColumn = column(headers, ['TIME_PERIOD', 'TIME', 'YEAR'], 'year');
const valueColumn = column(headers, ['OBS_VALUE', 'VALUE', 'OBSERVATION_VALUE'], 'value');
const areaSet = new Set(areas);
const yearSet = new Set(YEARS);
const panel = [];
const seen = new Set();

for (const row of table.slice(1)) {
  const country = String(row[countryColumn] ?? '').trim();
  const year = Number(String(row[yearColumn] ?? '').trim());
  const value = Number(String(row[valueColumn] ?? '').trim());
  if (!areaSet.has(country) || !yearSet.has(year) || !Number.isFinite(value)) continue;
  const key = `${country}:${year}`;
  invariant(!seen.has(key), `Duplicate observation ${key}`);
  seen.add(key);
  panel.push({ country, year, value });
}

invariant(panel.length > 0, 'No requested country-year observations found');
invariant(panel.every((row) => row.value >= 0 && row.value <= 100), 'Observed percentages must be in [0,100]');
panel.sort((a, b) => a.country.localeCompare(b.country) || a.year - b.year);
const lookup = new Map(panel.map((row) => [`${row.country}:${row.year}`, row.value]));

const classResults = membership.referenceClasses.map((referenceClass) => {
  const countryMeans = [];
  const countryCoverage = [];
  for (const country of referenceClass.members) {
    const primaryValues = PRIMARY.map((year) => lookup.get(`${country}:${year}`)).filter(Number.isFinite);
    const observedYears = YEARS.filter((year) => lookup.has(`${country}:${year}`));
    const completePrimary = primaryValues.length === PRIMARY.length;
    if (completePrimary) {
      countryMeans.push({
        country,
        mean2021_2023: primaryValues.reduce((sum, value) => sum + value, 0) / primaryValues.length,
      });
    }
    countryCoverage.push({ country, observedYears, missingYears: YEARS.filter((year) => !observedYears.includes(year)), completePrimary });
  }
  const observedCount = countryCoverage.reduce((sum, entry) => sum + entry.observedYears.length, 0);
  const expectedCount = referenceClass.members.length * YEARS.length;
  const missingShare = 1 - observedCount / expectedCount;
  const meetsMinimum = countryMeans.length >= contract.extractionRules.minimumIndependentEconomiesPerClass;
  const meetsMissingness = missingShare <= contract.extractionRules.maximumCountryYearMissingShare;
  const admissionStatus = !meetsMinimum
    ? contract.coveragePolicy.classBelowMinimumStatus
    : !meetsMissingness
      ? contract.coveragePolicy.classAboveMissingnessLimitStatus
      : 'ADMITTED_PROVISIONAL_REFERENCE_BAND';
  const latestValues = referenceClass.members.map((country) => lookup.get(`${country}:2024`)).filter(Number.isFinite);
  return {
    id: referenceClass.id,
    label: referenceClass.label,
    frozenMembers: referenceClass.members,
    coverage: {
      expectedCountryYearObservations: expectedCount,
      observedCountryYearObservations: observedCount,
      missingShare,
      completePrimaryEconomies: countryMeans.length,
      latest2024Economies: latestValues.length,
      countryCoverage,
    },
    bandAdmission: { status: admissionStatus, meetsMinimumIndependentEconomies: meetsMinimum, meetsMissingnessLimit: meetsMissingness },
    primaryWindow2021_2023: {
      role: admissionStatus === 'ADMITTED_PROVISIONAL_REFERENCE_BAND' ? 'PROVISIONAL_REFERENCE_BAND' : 'DESCRIPTIVE_ONLY_BLOCKED',
      method: 'unweighted distribution of complete-country 2021-2023 arithmetic means',
      countryMeans,
      statistics: statistics(countryMeans.map((entry) => entry.mean2021_2023)),
    },
    latest2024Snapshot: { status: 'DESCRIPTIVE_ONLY', statistics: statistics(latestValues) },
  };
});

const blockedClasses = classResults.filter((entry) => entry.bandAdmission.status !== 'ADMITTED_PROVISIONAL_REFERENCE_BAND');
const executionGates = {
  officialDatasetIdentifierExact: contract.source.dataset === DATASET,
  frozenMembershipUsedWithoutSubstitution: classResults.every((entry) => JSON.stringify(entry.frozenMembers) === JSON.stringify(membership.referenceClasses.find((source) => source.id === entry.id).members)),
  rawPanelRetained: panel.length > 0,
  noNumericTransformationBeyondPercentParsing: true,
  allValuesWithinPercentBounds: panel.every((row) => row.value >= 0 && row.value <= 100),
  everyClassExplicitlyClassified: classResults.every((entry) => Boolean(entry.bandAdmission.status)),
  insufficientClassesRemainBlocked: classResults.every((entry) => entry.bandAdmission.meetsMinimumIndependentEconomies || entry.bandAdmission.status === contract.coveragePolicy.classBelowMinimumStatus),
  excessiveMissingnessClassesRemainBlocked: classResults.every((entry) => entry.bandAdmission.meetsMissingnessLimit || entry.bandAdmission.status === contract.coveragePolicy.classAboveMissingnessLimitStatus),
  manufacturingDescriptorNotMappedToModelSector: true,
  provisionalBandsNotCalibrationTargets: !contract.numericCalibrationRangesAuthorized,
  canonicalMutationLocked: !contract.canonicalMutationAuthorized,
};
executionGates.ok = Object.values(executionGates).every(Boolean);

const status = !executionGates.ok
  ? 'FAIL'
  : blockedClasses.length
    ? 'PASS_WITH_BLOCKED_REFERENCE_BANDS'
    : 'PASS_AS_PROVISIONAL_REFERENCE_EVIDENCE';
const result = {
  schemaVersion: 'r4-cu-d3c-official-reference-extraction-v0.2',
  front: 'R4-CU-D3C',
  generatedAt: retrievedAt,
  status,
  source: {
    publisher: 'OECD', dataset: DATASET, series, url,
    requestedYears: YEARS, primaryBalancedYears: PRIMARY,
    contentType: response.contentType, etag: response.etag, lastModified: response.lastModified,
    rawCsvSha256: hash(response.body), membershipSha256: hash(membershipText), contractSha256: hash(contractText), headers,
  },
  interpretation: {
    observedMetric: 'manufacturing gross value added as percentage of total gross value added',
    allowedUse: 'reference-class characterization and dispersion only',
    blockedUse: ['direct model-sector calibration', 'fictional-country direct copying', 'canonical parameter mutation'],
    admittedClasses: classResults.filter((entry) => entry.bandAdmission.status === 'ADMITTED_PROVISIONAL_REFERENCE_BAND').map((entry) => entry.id),
    blockedClasses: blockedClasses.map((entry) => ({ id: entry.id, status: entry.bandAdmission.status })),
  },
  rawPanel: panel,
  classResults,
  executionGates,
};

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'r4-cu-d3c-oecd-manufacturing-gva-raw.csv'), response.body);
await writeFile(path.join(OUT, 'r4-cu-d3c-manufacturing-gva-reference-bands.json'), `${JSON.stringify(result, null, 2)}\n`);
const summary = [
  '# R4-CU-D3C official reference extraction', '',
  `- Status: **${result.status}**`,
  `- Raw observations retained: ${panel.length}`,
  `- Raw CSV SHA-256: \`${result.source.rawCsvSha256}\``, '',
  '| Class | Admission | Complete economies | Median | IQR | Missing |',
  '|---|---|---:|---:|---:|---:|',
  ...classResults.map((entry) => `| ${entry.id} | ${entry.bandAdmission.status} | ${entry.coverage.completePrimaryEconomies} | ${entry.primaryWindow2021_2023.statistics.median?.toFixed(3) ?? 'n/a'} | ${entry.primaryWindow2021_2023.statistics.iqr?.toFixed(3) ?? 'n/a'} | ${(entry.coverage.missingShare * 100).toFixed(1)}% |`),
  '', '> A blocked cohort remains descriptive only. Membership and the five-economy threshold were not changed after observing the data.', '',
].join('\n');
await writeFile(path.join(OUT, 'r4-cu-d3c-summary.md'), summary);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' });
console.log(JSON.stringify({ status: result.status, executionGates, classResults: classResults.map((entry) => ({ id: entry.id, admission: entry.bandAdmission, coverage: entry.coverage, statistics: entry.primaryWindow2021_2023.statistics })) }, null, 2));
if (!executionGates.ok) process.exitCode = 1;
