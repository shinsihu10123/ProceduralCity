import fs from 'node:fs';

const p = 'economic-lab/diagnostics/reality-validation/r4-cu-d3b-reference-membership-register.json';
const r = JSON.parse(fs.readFileSync(p, 'utf8'));
const classes = r.referenceClasses ?? [];
const gates = {
  schemaPresent: r.schemaVersion === '1.0' && r.front === 'R4-CU-D3B',
  canonicalMutationLocked: r.canonicalMutationAuthorized === false,
  numericRangesLocked: r.numericCalibrationRangesAuthorized === false,
  fourReferenceClassesFrozen: classes.length === 4 && classes.every(x => Array.isArray(x.members) && x.members.length >= 5),
  uniqueClassIds: new Set(classes.map(x => x.id)).size === classes.length,
  noFictionalCountryDirectCopy: r.cohortPolicy?.fictionalCountryDirectCopyBlocked === true,
  minimumEconomiesEnforced: r.cohortPolicy?.minimumIndependentEconomiesPerBand >= 5,
  missingDataNoAdHocReplacement: /may not be replaced ad hoc/.test(r.cohortPolicy?.rule ?? ''),
  officialFirstExtractionDefined: r.firstExtraction?.source?.includes('OECD') && r.firstExtraction?.dataset === 'DSD_NAAG_IV@DF_NAAG_IV',
  manufacturingOnlyCharacterization: /cohort characterization only/.test(r.firstExtraction?.semanticUse ?? ''),
  sectorDirectMappingBlocked: (r.blockedMappings ?? []).some(x => x.includes('manufacturing GVA share -> model MATERIALS')),
  desiredBudgetMappingBlocked: (r.blockedMappings ?? []).some(x => x.includes('saving rate -> desiredConsumptionBudget')),
  singleObservationNotCenter: (r.blockedMappings ?? []).some(x => x.includes('single-year raw observation')),
};
gates.ok = Object.values(gates).every(Boolean);
console.log('WP_RV08_R4_CU_D3B_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CU_D3B_SUMMARY', JSON.stringify({
  referenceClasses: classes.length,
  frozenMemberships: classes.reduce((n, x) => n + x.members.length, 0),
  uniqueEconomies: new Set(classes.flatMap(x => x.members)).size,
  numericCalibrationRangesAuthorized: r.numericCalibrationRangesAuthorized,
  firstExtractionStatus: r.firstExtraction?.status,
  nextFront: r.nextFront,
}));
if (!gates.ok) process.exit(1);
