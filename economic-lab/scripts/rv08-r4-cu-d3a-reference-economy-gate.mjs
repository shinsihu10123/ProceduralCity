import fs from 'node:fs';

const file = 'economic-lab/diagnostics/reality-validation/r4-cu-d3a-reference-economy-extraction-contract.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const classes = data.referenceEconomyClasses ?? [];
const families = data.extractionFamilies ?? [];

const gates = {
  schemaPresent: data.schemaVersion === '1.0' && data.front === 'R4-CU-D3A',
  canonicalMutationLocked: data.canonicalMutationAuthorized === false,
  numericRangesLocked: data.numericCalibrationRangesAuthorized === false,
  classBeforeCountry: data.rules?.classBeforeCountry === true,
  noFictionalCountryDirectCopy: data.rules?.noFictionalCountryDirectCopy === true,
  sampleRulesFrozenBeforeExtraction: data.rules?.sampleInclusionRulesFrozenBeforeExtraction === true,
  rawObservationNotTarget: data.rules?.rawObservationIsNotCalibrationTarget === true,
  fourReferenceClassesDefined: classes.length === 4,
  classIdsUnique: new Set(classes.map((x) => x.id)).size === classes.length,
  noDirectModelMapping: classes.every((x) => x.directModelCountryMappingAuthorized === false),
  membershipsNotPrematurelyFrozen: classes.every((x) => x.membershipFrozen === false),
  fourExtractionFamiliesDefined: families.length === 4,
  desiredBudgetMappingBlocked: families.some((x) => x.id === 'D3A-HOUSEHOLD-SAVING' && x.directDesiredBudgetMapping === 'BLOCKED'),
  sectorExtractionStillBlocked: families.some((x) => x.id === 'D3A-SECTOR-PRODUCTIVITY' && String(x.admissionStatus).startsWith('BLOCKED_')),
  liquidityComponentsSeparated: families.some((x) => x.id === 'D3A-FIRM-LIQUIDITY' && Array.isArray(x.requiredSeparation) && x.requiredSeparation.length >= 6),
  minimumIndependentEconomies: data.rangeAdmissionGate?.minimumIndependentEconomiesPerClass >= 5,
  provenanceRequired: data.rangeAdmissionGate?.requiresSourceProvenance === true,
  semanticMatchRequired: data.rangeAdmissionGate?.requiresSemanticMatch === true,
  dispersionRequired: data.rangeAdmissionGate?.requiresUncertaintyOrDispersion === true,
};

gates.ok = Object.values(gates).every(Boolean);

const summary = {
  referenceClasses: classes.length,
  extractionFamilies: families.length,
  numericCalibrationRangesAuthorized: data.numericCalibrationRangesAuthorized,
  membershipsFrozen: classes.filter((x) => x.membershipFrozen === true).length,
  nextFront: data.nextFront
};

console.log('WP_RV08_R4_CU_D3A_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CU_D3A_SUMMARY', JSON.stringify(summary));
if (!gates.ok) process.exit(1);
