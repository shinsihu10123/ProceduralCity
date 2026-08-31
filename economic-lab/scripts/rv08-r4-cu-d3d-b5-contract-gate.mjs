import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path = 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b5-two-axis-shadow-repair-contract.json';
const contract = JSON.parse(readFileSync(path, 'utf8'));

const requiredValueFamilies = new Set(['V-PRODUCTIVITY', 'V-BUNDLE', 'V-RELATIVE-VALUE', 'V-HYBRID']);
const requiredHouseholdFamilies = new Set(['H-BUDGET-FORMATION', 'H-MARKET-EXECUTION', 'H-BUFFER-SAVING', 'H-HYBRID']);
const requiredSectors = new Set(['RESOURCE', 'MATERIALS', 'CAPITAL', 'CONSUMER']);
const requiredCases = new Set(['original-A', 'original-C', 'heldout-E', 'heldout-F']);

const hasAll = (values, required) => {
  const actual = new Set(values || []);
  return [...required].every((value) => actual.has(value));
};

const gates = {
  correctFront: contract.front === 'R4-CU-D3D-B5',
  b4PassRequiredForActivation: contract.activationRequiresB4Pass === true && contract.dependencies?.requiredB4Decision === 'PASS_SEVERE_TWO_AXIS_EMPIRICAL_GAP_CONFIRMED',
  canonicalMutationLocked: contract.canonicalMutationAuthorized === false,
  directCalibrationLocked: contract.directParameterCalibrationAuthorized === false,
  postHocRetuningLocked: contract.postHocRetuningAuthorized === false,
  valueFamiliesComplete: hasAll(contract.axes?.valueProduction?.families, requiredValueFamilies),
  householdFamiliesComplete: hasAll(contract.axes?.householdRealization?.families, requiredHouseholdFamilies),
  sectorsComplete: hasAll(contract.axes?.valueProduction?.sectors, requiredSectors),
  sectorBlindScalarBlocked: contract.axes?.valueProduction?.sectorBlindScalarAuthorized === false,
  gapFactorMultiplierBlocked: contract.axes?.valueProduction?.gapFactorAsMultiplierAuthorized === false,
  realizedFlowDesiredBudgetMappingBlocked: contract.axes?.householdRealization?.empiricalFlowAsDesiredBudgetParameterAuthorized === false,
  cashInjectionToMeetBandBlocked: contract.axes?.householdRealization?.cashInjectionToMeetBandAuthorized === false,
  sameGridAcrossSeeds: contract.candidateGridPolicy?.sameGridAcrossSeeds === true,
  countryRetuningBlocked: contract.candidateGridPolicy?.countrySpecificRetuningAuthorized === false,
  seedRetuningBlocked: contract.candidateGridPolicy?.seedSpecificRetuningAuthorized === false,
  observedGapNotNumericSource: (contract.candidateGridPolicy?.numericLevelSourcesBlocked || []).some((x) => String(x).includes('B4 empirical/model gap factor')),
  fourFrozenCasesPresent: hasAll((contract.execution?.seeds || []).map((x) => x.case), requiredCases) && contract.execution?.seeds?.length === 4,
  horizonFrozen: contract.execution?.monthsPerSeed === 24,
  baselineRerunRequired: contract.execution?.baselineRerunRequired === true,
  sourceHashesRequired: contract.execution?.sourceHashRetentionRequired === true,
  paretoTableRequired: contract.execution?.aggregateParetoTableRequired === true,
  bothAxisImprovementRequired: contract.nonDominatedAdmission?.requiresBothAxisImprovementVersusBaseline === true,
  originalAndHeldoutReplicationRequired: contract.nonDominatedAdmission?.requiresOriginalAndHeldoutReplication === true,
  empiricalBandEntryNotForced: contract.nonDominatedAdmission?.insideEmpiricalBandRequired === false,
  shadowLabourBandNotDirectTarget: contract.shadowScoringBands?.labourValue?.directTargetAuthorized === false,
  shadowConsumptionBandNotDirectTarget: contract.shadowScoringBands?.realizedHouseholdConsumptionFlow?.directTargetAuthorized === false,
  desiredBudgetMappingStillBlocked: contract.shadowScoringBands?.realizedHouseholdConsumptionFlow?.desiredConsumptionBudgetMappingAuthorized === false
};

gates.ok = Object.values(gates).every(Boolean);
console.log('WP_RV08_R4_CU_D3D_B5_CONTRACT_GATES', JSON.stringify(gates));
assert.equal(gates.ok, true, 'R4-CU-D3D-B5 preregistration contract gate failed');
