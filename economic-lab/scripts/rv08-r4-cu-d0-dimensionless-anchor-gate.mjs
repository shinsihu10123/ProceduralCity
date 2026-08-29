import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('economic-lab/diagnostics/reality-validation/r4-cu-d0-dimensionless-anchor-register.json');
const r = JSON.parse(readFileSync(path, 'utf8'));
const ids = new Set(r.sources.map(x => x.id));
const byId = Object.fromEntries(r.sources.map(x => [x.id, x]));
const allowed = new Set(['CANDIDATE_SOURCE','SEMANTIC_MATCH','TRANSFORMATION_REQUIRED','ADMITTED_RANGE','REJECTED_MISMATCH','INSUFFICIENT_EVIDENCE']);

const gates = {
  schemaPresent: r.schemaVersion === '1.0' && r.front === 'R4-CU-D0',
  canonicalMutationLocked: r.canonicalMutationAuthorized === false && r.rules?.canonicalMutationLocked === true,
  noNumericRangesAdmitted: r.numericRangesAdmitted === false && !r.sources.some(x => x.status === 'ADMITTED_RANGE'),
  uniqueIds: ids.size === r.sources.length,
  statusesValid: r.sources.every(x => allowed.has(x.status)),
  labourSharePresent: byId['CU-D0-LABSHARE']?.status === 'TRANSFORMATION_REQUIRED',
  householdSavingPresent: byId['CU-D0-HHSAVE']?.status === 'SEMANTIC_MATCH',
  desiredBudgetDirectMappingBlocked: /desiredConsumptionBudget/.test(byId['CU-D0-HHSAVE']?.blockedDirectUse || ''),
  sectorBridgeRequired: r.rules?.sectorBridgeRequiredBeforeSectorRatios === true && /classification bridge/.test(byId['CU-D0-STAN']?.blockedDirectUse || ''),
  liquidityUnresolvedNotFabricated: byId['CU-D0-LIQ']?.status === 'INSUFFICIENT_EVIDENCE' && byId['CU-D0-LIQ']?.sourceOrganization === null,
  realizedVsExAnteExplicit: r.rules?.realizedVsExAnteExplicit === true,
  valueAddedVsGrossOutputExplicit: r.rules?.valueAddedVsGrossOutputExplicit === true,
  internalDiagnosticsCannotSelfAuthorize: r.rules?.internalDiagnosticsCannotSelfAuthorize === true
};
gates.ok = Object.values(gates).every(Boolean);

const summary = {
  sources: r.sources.length,
  statusCounts: r.sources.reduce((m,x)=>(m[x.status]=(m[x.status]||0)+1,m),{}),
  numericRangesAdmitted: r.numericRangesAdmitted,
  nextFront: 'R4-CU-D1 empirical range extraction'
};

console.log('WP_RV08_R4_CU_D0_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CU_D0_SUMMARY', JSON.stringify(summary));
assert.equal(gates.ok, true, 'R4-CU-D0 gate failed');
