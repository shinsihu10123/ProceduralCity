import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.resolve(ROOT, process.env.R4_CU_D3D_B2_OUT_DIR ?? 'artifacts/r4-cu-d3d-b2');
const MEMBERSHIP_PATH = path.join(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3b-reference-membership-register.json');
const CONTRACT_PATH = path.join(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b2-oecd-household-saving-extraction-contract.json');

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

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
  return rows.filter((entry) => entry.some((value) => String(value).trim() !== ''));
}

function normalized(value) {
  return String(value).trim().replace(/[\s-]+/g, '_').toUpperCase();
}

function column(headers, aliases, label, optional = false) {
  const normalizedHeaders = headers.map(normalized);
  for (const alias of aliases.map(normalized)) {
    const index = normalizedHeaders.indexOf(alias);
    if (index >= 0) return index;
  }
  if (optional) return -1;
  throw new Error(`Missing ${label} column; headers=${normalizedHeaders.join(',')}`);
}

function percentile(values, probability) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * probability;
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
    const timer = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'text/csv',
          'accept-language': 'en',
          'user-agent': 'ProceduralCity-R4-CU-D3D-B2/1.0',
        },
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`OECD SDMX HTTP ${response.status}: ${body.slice(0, 300)}`);
      if (!body.includes(',') || /^\s*</.test(body)) throw new Error(`Unexpected OECD response: ${body.slice(0, 300)}`);
      return {
        body,
        contentType: response.headers.get('content-type'),
        etag: response.headers.get('etag'),
        lastModified: response.headers.get('last-modified'),
      };
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

const membershipText = await readFile(MEMBERSHIP_PATH, 'utf8');
const contractText = await readFile(CONTRACT_PATH, 'utf8');
const membership = JSON.parse(membershipText);
const contract = JSON.parse(contractText);
invariant(membership.front === 'R4-CU-D3B', 'Frozen D3B membership register required');
invariant(contract.front === 'R4-CU-D3D-B2', 'D3D-B2 contract required');
invariant(contract.canonicalMutationAuthorized === false && contract.numericCalibrationRangesAuthorized === false, 'Calibration locks must remain false');

const countries = [...new Set(membership.referenceClasses.flatMap((entry) => entry.members))].sort();
const series = `${contract.source.frequency}.${countries.join('+')}.${contract.source.measure}..`;
const url = `https://sdmx.oecd.org/public/rest/data/${contract.source.dataset}/${series}?startPeriod=2021&endPeriod=2024&dimensionAtObservation=AllDimensions&format=csvfile`;
const retrievedAt = new Date().toISOString();
const response = await officialCsv(url);
const table = csvRows(response.body);
invariant(table.length > 1, 'OECD response contained no observations');

const headers = table[0];
const countryColumn = column(headers, ['REF_AREA', 'LOCATION', 'COUNTRY', 'GEO'], 'country');
const yearColumn = column(headers, ['TIME_PERIOD', 'TIME', 'YEAR'], 'year');
const valueColumn = column(headers, ['OBS_VALUE', 'VALUE', 'OBSERVATION_VALUE'], 'value');
const measureColumn = column(headers, ['MEASURE', 'TRANSACTION'], 'measure', true);
const unitColumn = column(headers, ['COMBINED_UNIT_MEASURE', 'UNIT_MEASURE', 'UNIT'], 'combined unit', true);
const statusColumn = column(headers, ['OBS_STATUS', 'OBSERVATION_STATUS'], 'observation status', true);
const requestedYears = new Set(contract.source.requestedYears);
const countrySet = new Set(countries);
const panel = [];
const seen = new Set();
const duplicateKeys = [];

for (const row of table.slice(1)) {
  const country = String(row[countryColumn] ?? '').trim();
  const year = Number(String(row[yearColumn] ?? '').trim());
  const value = Number(String(row[valueColumn] ?? '').trim());
  const measure = measureColumn >= 0 ? String(row[measureColumn] ?? '').trim() : contract.source.measure;
  const unit = unitColumn >= 0 ? String(row[unitColumn] ?? '').trim() : null;
  if (!countrySet.has(country) || !requestedYears.has(year) || !Number.isFinite(value)) continue;
  if (measure && measure !== contract.source.measure) continue;
  const key = `${country}:${year}`;
  if (seen.has(key)) {
    duplicateKeys.push(key);
    continue;
  }
  seen.add(key);
  panel.push({
    country,
    year,
    savingRatePercent: value,
    realizedConsumptionCounterpartPercent: 100 - value,
    measure: measure || contract.source.measure,
    combinedUnit: unit,
    observationStatus: statusColumn >= 0 ? String(row[statusColumn] ?? '').trim() || null : null,
  });
}

invariant(panel.length > 0, 'No requested OECD household-saving observations found');
invariant(duplicateKeys.length === 0, `Duplicate country-year observations found: ${duplicateKeys.slice(0, 10).join(',')}`);
const [lowerBound, upperBound] = contract.extractionRules.savingRateBoundsPercent;
invariant(panel.every((entry) => entry.savingRatePercent >= lowerBound && entry.savingRatePercent <= upperBound), 'Saving-rate observation outside pre-registered bounds');
invariant(panel.every((entry) => Math.abs(entry.realizedConsumptionCounterpartPercent - (100 - entry.savingRatePercent)) <= 1e-12), 'Derived consumption identity failed');
const observedUnits = [...new Set(panel.map((entry) => entry.combinedUnit).filter(Boolean))];
invariant(observedUnits.length <= 1, `Multiple combined units returned: ${observedUnits.join(',')}`);
if (observedUnits.length === 1) invariant(observedUnits[0] === contract.source.expectedCombinedUnit, `Unexpected combined unit ${observedUnits[0]}`);

panel.sort((a, b) => a.country.localeCompare(b.country) || a.year - b.year);
const lookup = new Map(panel.map((entry) => [`${entry.country}:${entry.year}`, entry]));
const primaryYears = contract.source.primaryBalancedYears;
const classResults = membership.referenceClasses.map((referenceClass) => {
  const countryMeans = [];
  const countryCoverage = [];
  for (const country of referenceClass.members) {
    const primary = primaryYears.map((year) => lookup.get(`${country}:${year}`)).filter(Boolean);
    const observedYears = contract.source.requestedYears.filter((year) => lookup.has(`${country}:${year}`));
    const completePrimary = primary.length === primaryYears.length;
    if (completePrimary) {
      countryMeans.push({
        country,
        savingRateMean2021_2023: primary.reduce((sum, entry) => sum + entry.savingRatePercent, 0) / primary.length,
        realizedConsumptionMean2021_2023: primary.reduce((sum, entry) => sum + entry.realizedConsumptionCounterpartPercent, 0) / primary.length,
      });
    }
    countryCoverage.push({ country, observedYears, missingYears: contract.source.requestedYears.filter((year) => !observedYears.includes(year)), completePrimary });
  }
  const expected = referenceClass.members.length * contract.source.requestedYears.length;
  const observed = countryCoverage.reduce((sum, entry) => sum + entry.observedYears.length, 0);
  const missingShare = 1 - observed / expected;
  const meetsMinimum = countryMeans.length >= contract.extractionRules.minimumIndependentEconomiesPerClass;
  const meetsMissingness = missingShare <= contract.extractionRules.maximumCountryYearMissingShare;
  const admissionStatus = !meetsMinimum
    ? contract.coveragePolicy.classBelowMinimumStatus
    : !meetsMissingness
      ? contract.coveragePolicy.classAboveMissingnessLimitStatus
      : 'ADMITTED_PROVISIONAL_REFERENCE_DESCRIPTOR';
  return {
    id: referenceClass.id,
    label: referenceClass.label,
    frozenMembers: referenceClass.members,
    coverage: {
      expectedCountryYearObservations: expected,
      observedCountryYearObservations: observed,
      missingShare,
      completePrimaryEconomies: countryMeans.length,
      countryCoverage,
    },
    admission: { status: admissionStatus, meetsMinimumIndependentEconomies: meetsMinimum, meetsMissingnessLimit: meetsMissingness },
    primaryWindow2021_2023: {
      role: admissionStatus === 'ADMITTED_PROVISIONAL_REFERENCE_DESCRIPTOR' ? 'PROVISIONAL_REFERENCE_DESCRIPTOR' : 'DESCRIPTIVE_ONLY_BLOCKED',
      countryMeans,
      savingRateStatistics: statistics(countryMeans.map((entry) => entry.savingRateMean2021_2023)),
      realizedConsumptionCounterpartStatistics: statistics(countryMeans.map((entry) => entry.realizedConsumptionMean2021_2023)),
    },
  };
});

const blocked = classResults.filter((entry) => entry.admission.status !== 'ADMITTED_PROVISIONAL_REFERENCE_DESCRIPTOR');
const gates = {
  officialDatasetExact: contract.source.dataset === 'OECD.SDD.NAD,DSD_NAAG@DF_NAAG_V,1.0',
  officialMeasureExact: contract.source.measure === 'B8NS1M',
  observedUnitExact: observedUnits.length === 0 || observedUnits[0] === contract.source.expectedCombinedUnit,
  frozenMembershipUsed: classResults.every((entry) => JSON.stringify(entry.frozenMembers) === JSON.stringify(membership.referenceClasses.find((source) => source.id === entry.id).members)),
  rawResponseRetained: response.body.length > 0,
  rawResponseHashProduced: sha256(response.body).length === 64,
  countryYearUnique: duplicateKeys.length === 0,
  savingRatesWithinBounds: panel.every((entry) => entry.savingRatePercent >= lowerBound && entry.savingRatePercent <= upperBound),
  derivedConsumptionIdentityExact: panel.every((entry) => Math.abs(entry.realizedConsumptionCounterpartPercent - (100 - entry.savingRatePercent)) <= 1e-12),
  everyClassExplicitlyClassified: classResults.every((entry) => Boolean(entry.admission.status)),
  blockedClassesPreservedWithoutSubstitution: blocked.every((entry) => JSON.stringify(entry.frozenMembers) === JSON.stringify(membership.referenceClasses.find((source) => source.id === entry.id).members)),
  desiredBudgetMappingBlocked: contract.semanticContract.notEquivalentTo.includes('desiredConsumptionBudget') && contract.interpretation.blockedUse.includes('direct desiredConsumptionBudget calibration'),
  calibrationRangeLocked: contract.numericCalibrationRangesAuthorized === false,
  canonicalMutationLocked: contract.canonicalMutationAuthorized === false,
};
gates.ok = Object.values(gates).every(Boolean);
const result = {
  schemaVersion: 'r4-cu-d3d-b2-oecd-household-saving-v0.1',
  front: 'R4-CU-D3D-B2',
  generatedAt: retrievedAt,
  status: !gates.ok ? 'FAIL' : blocked.length ? 'PASS_WITH_BLOCKED_REFERENCE_DESCRIPTORS' : 'PASS_AS_PROVISIONAL_REFERENCE_EVIDENCE',
  source: {
    publisher: contract.source.publisher,
    dataset: contract.source.dataset,
    series,
    url,
    measure: contract.source.measure,
    observedUnits,
    contentType: response.contentType,
    etag: response.etag,
    lastModified: response.lastModified,
    headers,
    rawResponseSha256: sha256(response.body),
    membershipSha256: sha256(membershipText),
    contractSha256: sha256(contractText),
  },
  semanticContract: contract.semanticContract,
  rawPanel: panel,
  classResults,
  gates,
};

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'r4-cu-d3d-b2-oecd-household-saving-raw.csv'), response.body);
await writeFile(path.join(OUT, 'r4-cu-d3d-b2-household-saving-reference-descriptors.json'), `${JSON.stringify(result, null, 2)}\n`);
const summary = [
  '# R4-CU-D3D-B2 OECD household saving extraction',
  '',
  `- Status: **${result.status}**`,
  `- Retained country-year observations: ${panel.length}`,
  `- Observed unit: ${observedUnits.join(', ') || 'not exposed in response'}`,
  `- Raw response SHA-256: \`${result.source.rawResponseSha256}\``,
  '',
  '| Class | Admission | Complete economies | Saving median | Saving IQR | Realized-consumption median | Missing |',
  '|---|---|---:|---:|---:|---:|---:|',
  ...classResults.map((entry) => `| ${entry.id} | ${entry.admission.status} | ${entry.coverage.completePrimaryEconomies} | ${entry.primaryWindow2021_2023.savingRateStatistics.median?.toFixed(3) ?? 'n/a'} | ${entry.primaryWindow2021_2023.savingRateStatistics.iqr?.toFixed(3) ?? 'n/a'} | ${entry.primaryWindow2021_2023.realizedConsumptionCounterpartStatistics.median?.toFixed(3) ?? 'n/a'} | ${(entry.coverage.missingShare * 100).toFixed(1)}% |`),
  '',
  '> The realized-consumption counterpart is a national-accounts identity, not the model desired-consumption budget.',
  '',
].join('\n');
await writeFile(path.join(OUT, 'r4-cu-d3d-b2-summary.md'), summary);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' });
console.log(JSON.stringify({ status: result.status, gates, panelObservations: panel.length, observedUnits, classResults: classResults.map((entry) => ({ id: entry.id, admission: entry.admission, coverage: entry.coverage, savingRateStatistics: entry.primaryWindow2021_2023.savingRateStatistics, realizedConsumptionCounterpartStatistics: entry.primaryWindow2021_2023.realizedConsumptionCounterpartStatistics })) }, null, 2));
if (!gates.ok) process.exitCode = 1;
