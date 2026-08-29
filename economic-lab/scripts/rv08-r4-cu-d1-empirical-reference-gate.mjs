import fs from 'node:fs';

const file = 'economic-lab/diagnostics/reality-validation/r4-cu-d1-empirical-reference-register.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const refs = data.references ?? [];
const ids = refs.map((r) => r.id);

const gates = {
  schemaPresent: data.schemaVersion === '1.0' && data.front === 'R4-CU-D1',
  canonicalMutationLocked: data.canonicalMutationAuthorized === false,
  referencesPresent: refs.length >= 6,
  uniqueIds: new Set(ids).size === ids.length,
  noCalibrationTargetsAuthorized: refs.every((r) => r.calibrationTargetAuthorized === false),
  rawObservationNotTargetRule: data.rules?.rawObservationIsNotCalibrationTarget === true,
  fictionalCountryMappingRequired: data.rules?.fictionalCountriesNeedMappingContract === true,
  desiredBudgetDirectMappingBlocked: data.rules?.desiredConsumptionBudgetDirectMappingBlocked === true,
  sectorBridgeRequired: data.rules?.sectorBridgeRequiredBeforeSectorTargets === true,
  labourShareReferencePresent: refs.some((r) => r.id === 'D1-LABOUR-SHARE-GLOBAL-2024' && r.observation === 52.4),
  savingReferencesPresent: refs.filter((r) => r.concept.includes('saving')).length >= 3,
  sectorTargetBlocked: refs.some((r) => r.id === 'D1-SECTOR-STAN' && r.modelApplicability === 'BLOCKED_PENDING_CLASSIFICATION_BRIDGE'),
  liquidityUnresolvedNotFabricated: refs.some((r) => r.id === 'D1-FIRM-LIQUIDITY' && r.evidenceStatus === 'INSUFFICIENT_EVIDENCE' && r.source === null),
};

gates.ok = Object.values(gates).every(Boolean);

const summary = {
  references: refs.length,
  officialReferencePoints: refs.filter((r) => r.evidenceStatus === 'OFFICIAL_REFERENCE_POINT').length,
  calibrationTargetsAuthorized: refs.filter((r) => r.calibrationTargetAuthorized === true).length,
  blockedOrUnresolved: refs.filter((r) => ['BLOCKED_PENDING_CLASSIFICATION_BRIDGE', 'UNRESOLVED'].includes(r.modelApplicability)).map((r) => r.id),
  nextFront: 'R4-CU-D1B classification bridge and firm-liquidity source acquisition'
};

console.log('WP_RV08_R4_CU_D1_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CU_D1_SUMMARY', JSON.stringify(summary));
if (!gates.ok) process.exit(1);
