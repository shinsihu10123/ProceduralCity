import fs from 'node:fs';

const file = 'economic-lab/diagnostics/reality-validation/r4-cu-d3-operational-bridge-register.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const sectors = data.modelSectorOperationalRules ?? [];
const liqSources = data.officialLiquiditySources ?? [];

const gates = {
  schemaPresent: data.schemaVersion === '1.0' && data.front === 'R4-CU-D3',
  canonicalMutationLocked: data.canonicalMutationAuthorized === false,
  calibrationRangesLocked: data.calibrationRangesAuthorized === false,
  sutPrimarySource: data.sectorBridgeMethod?.primarySource === 'OECD Supply and Use Tables',
  useBucketsExplicit: (data.sectorBridgeMethod?.useBuckets ?? []).length >= 4,
  mixedUseNotForced: data.sectorBridgeMethod?.allocationRule?.includes('mixed-use products') === true,
  fourSectorMethodsDefined: ['RESOURCE','MATERIALS','CAPITAL','CONSUMER'].every((s) => sectors.some((x) => x.modelSector === s)),
  allSectorTargetsBlocked: sectors.every((x) => x.status?.endsWith('TARGET_BLOCKED')),
  sectorMetricsDefined: (data.sectorMetricsAfterBridge ?? []).length >= 5,
  liquidityTargetsSeparated: (data.liquidityEvidenceProtocol?.targetObjects ?? []).length >= 7,
  stressEvidenceNotCenter: data.liquidityEvidenceProtocol?.steadyStateRule?.includes('No stress-event') === true,
  sizeClassPreserved: data.liquidityEvidenceProtocol?.sizeClassRule?.includes('must not be pooled') === true,
  multipleOfficialLiquiditySources: liqSources.length >= 3,
  noLiquidityCalibrationAuthorized: liqSources.every((x) => x.calibrationTargetAuthorized === false),
  numericRangeAdmissionGateDefined: (data.admissionGateForNumericRanges ?? []).length >= 8,
};

gates.ok = Object.values(gates).every(Boolean);

console.log('WP_RV08_R4_CU_D3_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CU_D3_SUMMARY', JSON.stringify({
  sectorRules: sectors.length,
  liquiditySourceFamilies: liqSources.length,
  calibrationRangesAuthorized: data.calibrationRangesAuthorized,
  nextFront: data.nextFront,
}));
if (!gates.ok) process.exit(1);
