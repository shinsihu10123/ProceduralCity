import fs from 'node:fs';

const file = 'economic-lab/diagnostics/reality-validation/r4-cu-d2-sector-liquidity-evidence-register.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const sectors = data.sectorBridge ?? [];
const liquidity = data.liquidityEvidence ?? [];

const gates = {
  schemaPresent: data.schemaVersion === '1.0' && data.front === 'R4-CU-D2',
  canonicalMutationLocked: data.canonicalMutationAuthorized === false,
  calibrationRangesLocked: data.calibrationRangesAuthorized === false,
  fourModelSectorsPresent: ['RESOURCE','MATERIALS','CAPITAL','CONSUMER'].every((s) => sectors.some((x) => x.modelSector === s)),
  noSectorTargetAuthorized: sectors.every((x) => x.targetAuthorized === false),
  interpretiveBridgeRule: data.rules?.sectorBridgeIsInterpretiveNotIdentity === true,
  ambiguityPreserved: data.rules?.isicMappingMustPreserveAmbiguity === true,
  servicesNotForcedToConsumer: data.rules?.servicesNotSilentlyForcedIntoConsumer === true,
  productUseFilteringRequired: ['MATERIALS','CAPITAL','CONSUMER'].every((s) => sectors.find((x) => x.modelSector === s)?.bridgeStatus?.includes('REQUIRES_')),
  officialSectorSourcesPresent: (data.officialSectorSources ?? []).some((s) => s.organization === 'OECD' && s.dataset.includes('STAN')) && (data.officialSectorSources ?? []).some((s) => s.organization === 'OECD' && s.dataset.includes('Supply and Use')),
  crisisCashNotSteadyStateTarget: data.rules?.crisisCashEvidenceNotSteadyStateTarget === true && liquidity.every((x) => x.steadyStateTargetAuthorized === false),
  liquidityComponentsSeparated: data.rules?.liquidityStockFlowComponentsSeparated === true,
  liquidityComponentCoverage: (data.requiredLiquidityComponentsBeforeTarget ?? []).length >= 9,
  rawObservationNotTarget: data.rules?.rawObservationIsNotCalibrationTarget === true,
};

gates.ok = Object.values(gates).every(Boolean);

const summary = {
  sectors: sectors.length,
  officialSectorSources: (data.officialSectorSources ?? []).length,
  liquidityEvidenceItems: liquidity.length,
  calibrationRangesAuthorized: data.calibrationRangesAuthorized,
  nextFront: data.nextFront,
};

console.log('WP_RV08_R4_CU_D2_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CU_D2_SUMMARY', JSON.stringify(summary));
if (!gates.ok) process.exit(1);
