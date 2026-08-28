import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('economic-lab/diagnostics/reality-validation/economic-semantic-anchor-register-v1.json');
const reg = JSON.parse(readFileSync(path, 'utf8'));
const allowed = new Set(reg.allowedTargetStatuses || []);
const anchors = Array.isArray(reg.anchors) ? reg.anchors : [];
const ids = new Set(anchors.map(a => a.id));
const requiredIds = ['A1','A2','A3','B1','B2','B3','C1','C2','C3','C4','D1','D2','D3','E1','E2','E3','F1','F2','F3'];

const gates = {
  schemaPresent: reg.schemaVersion === '1.0' && reg.workPackage === 'WP-RV08-R4-CT',
  canonicalMutationLocked: reg.canonicalMutationAuthorized === false && anchors.every(a => a.canonicalMutationAuthorized === false),
  allRequiredAnchorsPresent: requiredIds.every(id => ids.has(id)),
  uniqueAnchorIds: ids.size === anchors.length,
  dimensionsExplicit: anchors.every(a => typeof a.dimension === 'string' && a.dimension.length > 0),
  kindsExplicit: anchors.every(a => typeof a.kind === 'string' && a.kind.length > 0),
  targetStatusesValid: anchors.every(a => allowed.has(a.targetStatus)),
  dependenciesResolved: anchors.every(a => Array.isArray(a.dependencies) && a.dependencies.every(id => ids.has(id))),
  silentRescalingBlocked: anchors.every(a => a.prohibitedSilentRescaling === true),
  sectorBlindNormalizationBlocked: reg.sectorRequirement?.sectorBlindNormalizationAllowed === false,
  allFourSectorsPresent: ['RESOURCE','MATERIALS','CAPITAL','CONSUMER'].every(s => reg.sectorRequirement?.sectors?.includes(s)),
  prohibitedShortcutsPresent: Array.isArray(reg.prohibitedShortcuts) && reg.prohibitedShortcuts.length >= 6,
  unresolvedNotFabricated: anchors.filter(a => ['UNRESOLVED','EXTERNAL_EMPIRICAL_REQUIRED'].includes(a.targetStatus)).every(a => !('targetValue' in a) && !('targetRange' in a)),
};
gates.ok = Object.values(gates).every(Boolean);

const statusCounts = Object.fromEntries([...allowed].map(s => [s, anchors.filter(a => a.targetStatus === s).length]));
const summary = {
  anchors: anchors.length,
  statusCounts,
  unresolvedOrExternalRequired: anchors.filter(a => ['UNRESOLVED','EXTERNAL_EMPIRICAL_REQUIRED'].includes(a.targetStatus)).map(a => a.id),
  repositorySupported: anchors.filter(a => a.targetStatus === 'REPOSITORY_SUPPORTED').map(a => a.id),
  internalInvariant: anchors.filter(a => a.targetStatus === 'INTERNAL_INVARIANT').map(a => a.id),
  canonicalMutationAuthorized: reg.canonicalMutationAuthorized
};

console.log('WP_RV08_R4_CT_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CT_SUMMARY', JSON.stringify(summary));
assert.equal(gates.ok, true, 'R4-CT semantic anchor register gate failed');
