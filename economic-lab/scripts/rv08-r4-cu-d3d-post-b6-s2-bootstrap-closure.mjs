import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const routePath = resolve(process.env.ROUTE_JSON || '');
const aggregatePath = resolve(process.env.AGGREGATE_JSON || '');
assert.ok(process.env.ROUTE_JSON, 'ROUTE_JSON is required');
assert.ok(process.env.AGGREGATE_JSON, 'AGGREGATE_JSON is required');

const routeText = readFileSync(routePath, 'utf8');
const aggregateText = readFileSync(aggregatePath, 'utf8');
const route = JSON.parse(routeText);
const aggregate = JSON.parse(aggregateText);
assert.ok(route.route === 'S3' || route.route === 'B7');
assert.equal(aggregate.technicalGates?.ok, true, 'Bootstrap aggregate technical gates did not pass');
assert.equal(aggregate.routeSource?.route, route.route, 'Route/aggregate mismatch');

const runId = process.env.AUTHORITATIVE_RUN_ID || 'unknown';
const headSha = process.env.AUTHORITATIVE_HEAD_SHA || 'unknown';
const artifactId = process.env.AUTHORITATIVE_ARTIFACT_ID || 'unknown';
const artifactDigest = process.env.AUTHORITATIVE_ARTIFACT_DIGEST || 'unknown';
const aggregateSha256 = createHash('sha256').update(aggregateText).digest('hex');
const routeSha256 = createHash('sha256').update(routeText).digest('hex');

const isS3 = route.route === 'S3';
const closurePath = resolve(process.env.CLOSURE_MD || (isS3
  ? 'economic-lab/diagnostics/reality-validation/WP-RV08_R4_CU_D3D_B6_S3_LONG_HORIZON_BOOTSTRAP_CLOSURE_v0.1.md'
  : 'economic-lab/diagnostics/reality-validation/WP-RV08_R4_CU_D3D_B7_STRUCTURAL_BASELINE_BOOTSTRAP_CLOSURE_v0.1.md'));

const rows = aggregate.summaries || [];
const table = rows.map((row) =>
  `| ${row.candidateId} | ${row.seed} | ${row.months} | ${row.labourShareMedian ?? ''} | ${row.consumptionShareMedian ?? ''} | ${row.inputShortageMedian ?? ''} | ${row.activeFirmsMedian ?? ''} | ${row.purchasingPowerMedian ?? ''} | ${row.allIntegrityGatesPassed ? 'PASS' : 'FAIL'} |`
).join('\n');

const title = isS3
  ? 'WP-RV08 R4-CU-D3D-B6-S3 Long-Horizon Bootstrap Closure v0.1'
  : 'WP-RV08 R4-CU-D3D-B7 Structural Baseline Bootstrap Closure v0.1';
const decision = isS3
  ? 'BOOTSTRAP_CLOSED / LONG-HORIZON INTEGRITY EVIDENCE FROZEN / ECONOMIC PROMOTION NOT YET AUTHORIZED'
  : 'BOOTSTRAP_CLOSED / CANONICAL STRUCTURAL BASELINE FROZEN / B6 RETUNING NOT AUTHORIZED';
const next = isS3
  ? 'Freeze a separate B6-S3 stress-scenario and persistence-threshold contract before any economic promotion decision.'
  : 'Proceed to a separately preregistered B7 demand–inventory topology and value-transformation diagnosis.';

const markdown = `# ${title}\n\n## Decision\n\n**${decision}**\n\n## Authoritative evidence\n\n- Branch: \`scratch/new-project-2026-08-12\`\n- Workflow run: \`${runId}\`\n- Execution head: \`${headSha}\`\n- Route: \`${route.route}\`\n- B6-S2 decision: \`${route.aggregateDecision}\`\n- B6-S2 primary candidate: \`${route.primaryCandidateId || 'none'}\`\n- Aggregate artifact ID: \`${artifactId}\`\n- Aggregate artifact digest: \`${artifactDigest}\`\n- Route JSON SHA-256: \`${routeSha256}\`\n- Aggregate JSON SHA-256: \`${aggregateSha256}\`\n\nAll expected bootstrap jobs passed the frozen exact-replay, accounting, protected-surface and reconstruction gates. This closure does not authorize canonical mutation or an economic promotion decision.\n\n## Frozen observations\n\n| Candidate | Seed | Months | Labour share median | Consumption share median | Input shortage median | Active firms median | Purchasing power median | Integrity |\n|---|---|---:|---:|---:|---:|---:|---:|---|\n${table}\n\n## Boundary\n\n- Canonical mutation: **not authorized**.\n- Result-dependent retuning: **not authorized**.\n- Economic promotion at this bootstrap: **not authorized**.\n- B6-S2 reinterpretation: **not authorized**.\n\n## Next dependency-safe front\n\n${next}\n`;

mkdirSync(dirname(closurePath), { recursive: true });
writeFileSync(closurePath, markdown);
console.log('WP_RV08_R4_CU_D3D_POST_B6_S2_BOOTSTRAP_CLOSURE', JSON.stringify({ closurePath, route: route.route, aggregateSha256 }));
