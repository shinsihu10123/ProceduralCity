import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.resolve(ROOT, process.env.R4_CU_D3D_B1_OUT_DIR ?? 'artifacts/r4-cu-d3d-b1');
const MEMBERSHIP_PATH = path.join(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3b-reference-membership-register.json');
const CONTRACT_PATH = path.join(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b1-ilostat-labour-share-extraction-contract.json');

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

function parseCsv(text) {
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
  const filtered = rows.filter((entry) => entry.some((value) => String(value).trim() !== ''));
  invariant(filtered.length > 1, 'ILOSTAT CSV contains no data rows');
  const headers = filtered[0].map((value) => String(value).trim());
  return {
    headers,
    rows: filtered.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))),
  };
}

function normalizeKey(value) {
  return String(value).trim().replace(/[.\s-]+/g, '_').toLowerCase();
}

function firstValue(row, aliases) {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [normalizeKey(key), value]));
  for (const alias of aliases) {
    const value = normalized.get(normalizeKey(alias));
    if (value !== undefined && String(value).trim() !== '') return value;
  }
  return '';
}

function jsonRows(parsed) {
  if (Array.isArray(parsed)) return parsed;
  for (const key of ['data', 'records', 'observations', 'result', 'results']) {
    if (Array.isArray(parsed?.[key])) return parsed[key];
  }
  if (parsed && typeof parsed === 'object') {
    const firstArray = Object.values(parsed).find(Array.isArray);
    if (firstArray) return firstArray;
  }
  throw new Error('Unsupported ILOSTAT JSON response structure');
}

function parseResponse(body, contentType) {
  const trimmed = body.trimStart();
  if (String(contentType ?? '').includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const rows = jsonRows(JSON.parse(body));
    return { format: 'json', headers: [...new Set(rows.flatMap((row) => Object.keys(row)))], rows };
  }
  const parsed = parseCsv(body);
  return { format: 'csv', ...parsed };
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

async function fetchOfficial(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'text/csv, application/json;q=0.9',
          'accept-language': 'en',
          'user-agent': 'ProceduralCity-R4-CU-D3D-B1/1.0',
        },
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`ILOSTAT HTTP ${response.status}: ${body.slice(0, 300)}`);
      invariant(body.trim().length > 0, 'ILOSTAT response is empty');
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
invariant(contract.front === 'R4-CU-D3D-B1', 'D3D-B1 extraction contract required');
invariant(contract.canonicalMutationAuthorized === false && contract.numericCalibrationRangesAuthorized === false, 'Calibration locks must remain false');

const params = new URLSearchParams({
  id: contract.source.datasetId,
  type: contract.extractionRules.queryParameters.type,
  format: contract.extractionRules.queryParameters.format,
});
const url = `${contract.source.endpoint}?${params.toString()}`;
const retrievedAt = new Date().toISOString();
const response = await fetchOfficial(url);
const parsed = parseResponse(response.body, response.contentType);

const countries = [...new Set(membership.referenceClasses.flatMap((entry) => entry.members))].sort();
const countrySet = new Set(countries);
const requestedYears = new Set(contract.source.requestedYears);
const panel = [];
for (const row of parsed.rows) {
  const country = String(firstValue(row, ['ref_area', 'ref_area_code', 'country', 'location'])).trim();
  const year = Number(firstValue(row, ['time', 'time_period', 'year']));
  const indicator = String(firstValue(row, ['indicator', 'indicator_code'])).trim();
  const value = Number(firstValue(row, ['obs_value', 'value', 'observation_value']));
  if (!countrySet.has(country) || !requestedYears.has(year)) continue;
  if (indicator && indicator !== contract.source.indicatorCode) continue;
  if (!Number.isFinite(value)) continue;
  panel.push({
    country,
    year,
    value,
    source: String(firstValue(row, ['source', 'source_code'])).trim() || null,
    sourceLabel: String(firstValue(row, ['source_label', 'source.label'])).trim() || null,
    indicator: indicator || contract.source.indicatorCode,
    indicatorLabel: String(firstValue(row, ['indicator_label', 'indicator.label'])).trim() || null,
    observationStatus: String(firstValue(row, ['obs_status', 'observation_status'])).trim() || null,
    observationStatusLabel: String(firstValue(row, ['obs_status_label', 'obs_status.label'])).trim() || null,
  });
}

invariant(panel.length > 0, 'No requested ILOSTAT country-year observations found');
invariant(panel.every((entry) => entry.value >= 0 && entry.value <= 100), 'ILOSTAT labour-share values must be within [0,100]');
const duplicateKeys = [];
const seen = new Map();
for (const entry of panel) {
  const key = `${entry.country}:${entry.year}`;
  if (seen.has(key)) duplicateKeys.push({ key, first: seen.get(key), duplicate: entry });
  else seen.set(key, entry);
}
invariant(duplicateKeys.length === 0, `Duplicate ILOSTAT country-year observations require pre-registered source selection: ${JSON.stringify(duplicateKeys.slice(0, 5))}`);
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
        mean2021_2023: primary.reduce((sum, entry) => sum + entry.value, 0) / primary.length,
        sources: [...new Set(primary.map((entry) => entry.source).filter(Boolean))],
        observationStatuses: [...new Set(primary.map((entry) => entry.observationStatus).filter(Boolean))],
      });
    }
    countryCoverage.push({
      country,
      observedYears,
      missingYears: contract.source.requestedYears.filter((year) => !observedYears.includes(year)),
      completePrimary,
    });
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
    admission: {
      status: admissionStatus,
      meetsMinimumIndependentEconomies: meetsMinimum,
      meetsMissingnessLimit: meetsMissingness,
    },
    primaryWindow2021_2023: {
      role: admissionStatus === 'ADMITTED_PROVISIONAL_REFERENCE_DESCRIPTOR' ? 'PROVISIONAL_REFERENCE_DESCRIPTOR' : 'DESCRIPTIVE_ONLY_BLOCKED',
      countryMeans,
      statistics: statistics(countryMeans.map((entry) => entry.mean2021_2023)),
    },
  };
});

const sourceFrequency = Object.fromEntries([...new Set(panel.map((entry) => entry.source ?? 'UNSPECIFIED'))].sort().map((source) => [source, panel.filter((entry) => (entry.source ?? 'UNSPECIFIED') === source).length]));
const statusFrequency = Object.fromEntries([...new Set(panel.map((entry) => entry.observationStatus ?? 'UNSPECIFIED'))].sort().map((status) => [status, panel.filter((entry) => (entry.observationStatus ?? 'UNSPECIFIED') === status).length]));
const admitted = classResults.filter((entry) => entry.admission.status === 'ADMITTED_PROVISIONAL_REFERENCE_DESCRIPTOR');
const blocked = classResults.filter((entry) => entry.admission.status !== 'ADMITTED_PROVISIONAL_REFERENCE_DESCRIPTOR');
const gates = {
  officialDatasetExact: contract.source.datasetId === 'SDG_1041_NOC_RT_A' && contract.source.indicatorCode === 'SDG_1041_NOC_RT',
  frozenMembershipUsed: classResults.every((entry) => JSON.stringify(entry.frozenMembers) === JSON.stringify(membership.referenceClasses.find((source) => source.id === entry.id).members)),
  rawResponseRetained: response.body.length > 0,
  rawResponseHashProduced: sha256(response.body).length === 64,
  sourceAndStatusRetained: panel.every((entry) => Object.hasOwn(entry, 'source') && Object.hasOwn(entry, 'observationStatus')),
  countryYearUnique: duplicateKeys.length === 0,
  valuesWithinBounds: panel.every((entry) => entry.value >= 0 && entry.value <= 100),
  everyClassExplicitlyClassified: classResults.every((entry) => Boolean(entry.admission.status)),
  blockedClassesPreservedWithoutSubstitution: blocked.every((entry) => JSON.stringify(entry.frozenMembers) === JSON.stringify(membership.referenceClasses.find((source) => source.id === entry.id).members)),
  noDirectCanonicalMapping: contract.interpretation.blockedUse.includes('direct wage calibration') && contract.interpretation.blockedUse.includes('canonical parameter mutation'),
  calibrationRangeLocked: contract.numericCalibrationRangesAuthorized === false,
  canonicalMutationLocked: contract.canonicalMutationAuthorized === false,
};
gates.ok = Object.values(gates).every(Boolean);
const result = {
  schemaVersion: 'r4-cu-d3d-b1-ilostat-labour-share-v0.1',
  front: 'R4-CU-D3D-B1',
  generatedAt: retrievedAt,
  status: !gates.ok ? 'FAIL' : blocked.length ? 'PASS_WITH_BLOCKED_REFERENCE_DESCRIPTORS' : 'PASS_AS_PROVISIONAL_REFERENCE_EVIDENCE',
  source: {
    publisher: contract.source.publisher,
    system: contract.source.system,
    datasetId: contract.source.datasetId,
    indicatorCode: contract.source.indicatorCode,
    url,
    contentType: response.contentType,
    etag: response.etag,
    lastModified: response.lastModified,
    responseFormat: parsed.format,
    headers: parsed.headers,
    rawResponseSha256: sha256(response.body),
    membershipSha256: sha256(membershipText),
    contractSha256: sha256(contractText),
    sourceFrequency,
    observationStatusFrequency: statusFrequency,
  },
  interpretation: contract.semanticContract,
  rawPanel: panel,
  classResults,
  gates,
};

await mkdir(OUT, { recursive: true });
const rawExtension = parsed.format === 'json' ? 'json' : 'csv';
await writeFile(path.join(OUT, `r4-cu-d3d-b1-ilostat-raw.${rawExtension}`), response.body);
await writeFile(path.join(OUT, 'r4-cu-d3d-b1-labour-share-reference-descriptors.json'), `${JSON.stringify(result, null, 2)}\n`);
const summary = [
  '# R4-CU-D3D-B1 ILOSTAT labour-income-share extraction',
  '',
  `- Status: **${result.status}**`,
  `- Retained country-year observations: ${panel.length}`,
  `- Raw response SHA-256: \`${result.source.rawResponseSha256}\``,
  '',
  '| Class | Admission | Complete economies | Median | IQR | Missing |',
  '|---|---|---:|---:|---:|---:|',
  ...classResults.map((entry) => `| ${entry.id} | ${entry.admission.status} | ${entry.coverage.completePrimaryEconomies} | ${entry.primaryWindow2021_2023.statistics.median?.toFixed(3) ?? 'n/a'} | ${entry.primaryWindow2021_2023.statistics.iqr?.toFixed(3) ?? 'n/a'} | ${(entry.coverage.missingShare * 100).toFixed(1)}% |`),
  '',
  '> Labour-income-share descriptors are dimensionless reference evidence. They are not direct wage or productivity targets.',
  '',
].join('\n');
await writeFile(path.join(OUT, 'r4-cu-d3d-b1-summary.md'), summary);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' });
console.log(JSON.stringify({ status: result.status, gates, panelObservations: panel.length, sourceFrequency, statusFrequency, classResults: classResults.map((entry) => ({ id: entry.id, admission: entry.admission, coverage: entry.coverage, statistics: entry.primaryWindow2021_2023.statistics })) }, null, 2));
if (!gates.ok) process.exitCode = 1;
