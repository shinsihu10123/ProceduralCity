import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const CONTRACT_PATH = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b7-demand-inventory-topology-contract.json');
const S3_CONTRACT_PATH = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b6-s3-long-horizon-stress-contract.json');
const OBSERVER_SOURCE_PATH = resolve(ROOT, 'economic-lab/src/research/b7-demand-inventory-topology-observer.js');
const target = process.argv[2];
const sourceOutput = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const outputJson = process.env.B7_OUTPUT_JSON ? resolve(process.env.B7_OUTPUT_JSON) : null;
const candidateId = (process.env.CANDIDATE || '').trim();
const seed = (process.env.DIAG_SEED || '').trim();
const scenarioId = (process.env.S3_SCENARIO_ID || '').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

assert.ok(target, 'Usage: node rv08-r4-cu-d3d-b7-diagnostic-runner.mjs <signed-b6-runtime-script>');
assert.ok(sourceOutput, 'OUTPUT_JSON is required for the underlying B6-S3 source result');
assert.ok(outputJson, 'B7_OUTPUT_JSON is required');
assert.ok(candidateId, 'CANDIDATE is required');
assert.ok(seed, 'DIAG_SEED is required');
assert.ok(scenarioId, 'S3_SCENARIO_ID is required');

const contractText = readFileSync(CONTRACT_PATH, 'utf8');
const contract = JSON.parse(contractText);
const s3ContractText = readFileSync(S3_CONTRACT_PATH, 'utf8');
const s3Contract = JSON.parse(s3ContractText);
const candidateIds = contract.candidatePanel.map((entry) => entry.id);
const validationSeeds = contract.execution.validationSeeds.map((entry) => entry.seed);
const scenarioIds = contract.execution.scenarios.map((entry) => entry.id);

assert.equal(contract.schemaVersion, '1.0');
assert.equal(contract.front, 'R4-CU-D3D-B7');
assert.equal(contract.status, 'FROZEN_BEFORE_DIAGNOSTIC_EXECUTION');
assert.equal(contract.sourceStage3.closureCommit, 'ab50c676947a6215a7d58acce9302cda5fb02611');
assert.deepEqual(candidateIds, ['V1_M1_C42', 'V24_M16_C42']);
assert.ok(candidateIds.includes(candidateId), `Candidate ${candidateId} is outside B7 diagnostic panel`);
assert.ok(validationSeeds.includes(seed), `Seed ${seed} is outside B7 diagnostic panel`);
assert.ok(scenarioIds.includes(scenarioId), `Scenario ${scenarioId} is outside B7 diagnostic panel`);
assert.equal(contract.execution.months, 36);
assert.equal(contract.execution.candidateSeedScenarioJobs, 12);
assert.equal(contract.canonicalMutationAuthorized, false);
assert.equal(contract.directParameterCalibrationAuthorized, false);
assert.equal(s3Contract.front, 'R4-CU-D3D-B6-S3');

function replaceExactlyOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  assert.notEqual(first, -1, `B7 observer compatibility anchor missing: ${label}`);
  assert.equal(source.indexOf(needle, first + needle.length), -1, `B7 observer compatibility anchor duplicated: ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function buildObserverCompatibilityView() {
  const original = readFileSync(OBSERVER_SOURCE_PATH, 'utf8');
  let patched = original;

  patched = replaceExactlyOnce(patched,
`  function stateFor(supply, country) {
    let state = stateBySupply.get(supply);
    if (!state) {
      state = {
        candidateId: candidateIdFromCountry(country),
        rows: new Map(),
        countries: new Set()
      };
      if (expectedCandidateId) assert.equal(state.candidateId, expectedCandidateId, 'B7 observer candidate mismatch');
      stateBySupply.set(supply, state);
      states.push(state);
    }
    const observedCandidate = candidateIdFromCountry(country);
    if (observedCandidate) {
      if (state.candidateId === null) state.candidateId = observedCandidate;
      assert.equal(observedCandidate, state.candidateId, 'B7 observer candidate changed inside a replay');
    }
    state.countries.add(country.id);
    return state;
  }`,
`  function stateFor(supply, country) {
    const observedCandidate = candidateIdFromCountry(country);
    if (!observedCandidate) return null;
    let state = stateBySupply.get(supply);
    if (!state) {
      state = {
        candidateId: observedCandidate,
        rows: new Map(),
        countries: new Set()
      };
      if (expectedCandidateId) assert.equal(state.candidateId, expectedCandidateId, 'B7 observer candidate mismatch');
      stateBySupply.set(supply, state);
      states.push(state);
    }
    assert.equal(observedCandidate, state.candidateId, 'B7 observer candidate changed inside a replay');
    state.countries.add(country.id);
    return state;
  }`, 'stateFor-tag-filter');

  patched = replaceExactlyOnce(patched,
`  SupplyChainSystem.prototype.beginMonth = function b7BeginMonth(country, ...args) {
    const result = originals.beginMonth.call(this, country, ...args);
    const state = stateFor(this, country);
    const month = derivedMonth(country);`,
`  SupplyChainSystem.prototype.beginMonth = function b7BeginMonth(country, ...args) {
    const result = originals.beginMonth.call(this, country, ...args);
    const state = stateFor(this, country);
    if (!state) {
      latestStateByCountry.delete(country.id);
      return result;
    }
    const month = derivedMonth(country);`, 'beginMonth-canonical-twin-bypass');

  patched = replaceExactlyOnce(patched,
`  SupplyChainSystem.prototype.planProduction = function b7PlanProduction(country, ...args) {
    const result = originals.planProduction.call(this, country, ...args);
    const state = stateFor(this, country);
    const month = derivedMonth(country);`,
`  SupplyChainSystem.prototype.planProduction = function b7PlanProduction(country, ...args) {
    const result = originals.planProduction.call(this, country, ...args);
    const state = stateFor(this, country);
    if (!state) return result;
    const month = derivedMonth(country);`, 'planProduction-canonical-twin-bypass');

  patched = replaceExactlyOnce(patched,
`  SupplyChainSystem.prototype.procureInputs = function b7ProcureInputs(country, month, ...args) {
    const state = stateFor(this, country);
    const row = rowFor(state, country, month);`,
`  SupplyChainSystem.prototype.procureInputs = function b7ProcureInputs(country, month, ...args) {
    const state = stateFor(this, country);
    if (!state) return originals.procureInputs.call(this, country, month, ...args);
    const row = rowFor(state, country, month);`, 'procureInputs-canonical-twin-bypass');

  patched = replaceExactlyOnce(patched,
`  SupplyChainSystem.prototype.produce = function b7Produce(country, month, metrics, ...args) {
    const state = stateFor(this, country);
    const row = rowFor(state, country, month);`,
`  SupplyChainSystem.prototype.produce = function b7Produce(country, month, metrics, ...args) {
    const state = stateFor(this, country);
    if (!state) return originals.produce.call(this, country, month, metrics, ...args);
    const row = rowFor(state, country, month);`, 'produce-canonical-twin-bypass');

  patched = replaceExactlyOnce(patched,
`  setGoodsMarketDiagnosticObserver(({ countryId, month, result, diagnostics }) => {
    const state = latestStateByCountry.get(countryId);
    assert.ok(state, \`${countryId}/${month}: goods observer has no active B7 replay\`);`,
`  setGoodsMarketDiagnosticObserver(({ countryId, month, result, diagnostics }) => {
    const state = latestStateByCountry.get(countryId);
    if (!state) return;`, 'goods-canonical-twin-bypass');

  patched = replaceExactlyOnce(patched,
`  SupplyChainSystem.prototype.finalizeMetrics = function b7FinalizeMetrics(country, metrics, ...args) {
    const result = originals.finalizeMetrics.call(this, country, metrics, ...args);
    const state = stateFor(this, country);
    const month = derivedMonth(country);`,
`  SupplyChainSystem.prototype.finalizeMetrics = function b7FinalizeMetrics(country, metrics, ...args) {
    const result = originals.finalizeMetrics.call(this, country, metrics, ...args);
    const state = stateFor(this, country);
    if (!state) return result;
    const month = derivedMonth(country);`, 'finalizeMetrics-canonical-twin-bypass');

  const runtimePath = resolve(dirname(OBSERVER_SOURCE_PATH), `b7-demand-inventory-topology-observer.runtime-${process.pid}-${Date.now()}.mjs`);
  writeFileSync(runtimePath, patched);
  return {
    runtimePath,
    originalSha256: sha256(original),
    patchedSha256: sha256(patched),
    replacementCount: 7
  };
}

const observerView = buildObserverCompatibilityView();
console.log('WP_RV08_R4_CU_D3D_B7_OBSERVER_VIEW', JSON.stringify({
  originalSha256: observerView.originalSha256,
  patchedSha256: observerView.patchedSha256,
  replacementCount: observerView.replacementCount,
  canonicalTwinExcluded: true,
  worldStateMutationAuthorized: false
}));

let observer = null;
try {
  const observerModule = await import(pathToFileURL(observerView.runtimePath).href);
  observer = observerModule.installB7DemandInventoryTopologyObserver({ expectedCandidateId: candidateId });
  await import(pathToFileURL(resolve(ROOT, 'economic-lab/scripts/rv08-r4-cu-d3d-b6-s3-scenario-axis-runner.mjs')).href);
  const sourceText = readFileSync(sourceOutput, 'utf8');
  const source = JSON.parse(sourceText);
  const observation = observer.finish(source);
  const scenario = contract.execution.scenarios.find((entry) => entry.id === scenarioId);
  const sourceScenario = source.s3ScenarioValidation;

  const gates = {
    contractExact: contract.front === 'R4-CU-D3D-B7' && contract.status === 'FROZEN_BEFORE_DIAGNOSTIC_EXECUTION',
    sourceStage3FailureFrozen: contract.sourceStage3.decision === 'LONG_HORIZON_OR_STRESS_VALIDATION_FAILED_NO_RETUNING',
    candidateAuthorized: candidateIds.includes(source.candidate?.id) && source.candidate?.id === candidateId,
    seedAuthorized: validationSeeds.includes(source.seed) && source.seed === seed,
    scenarioAuthorized: scenarioIds.includes(sourceScenario?.scenarioId) && sourceScenario?.scenarioId === scenarioId,
    horizonFrozen: source.months === contract.execution.months,
    sourceEngineIntegrityPassed: source.gates?.ok === true,
    exactCanonicalReplayPassed: source.gates?.exactCanonicalReplay === true,
    exactDiagnosticReplayPassed: source.gates?.exactDiagnosticReplay === true,
    hardAccountingHealthy: source.gates?.hardAccountingHealthy === true,
    protectedSurfaceExact: source.gates?.protectedSurfaceExact === true,
    scenarioScheduleExact:
      sourceScenario?.scheduleSha256 === sha256(JSON.stringify(scenario.schedule)) &&
      JSON.stringify(sourceScenario?.schedule) === JSON.stringify(scenario.schedule),
    observerReplayCountExact: observation.replayStateCount === 2,
    observerReplayExact: observation.replayExact === true,
    completeCountryMonthPanel: observation.rows.length === observation.expectedRows && observation.expectedMonths === 36,
    allObserverStagesComplete: observation.rows.every((row) => Object.values(row.stages || {}).every(Boolean)),
    shortageAttributionReconciles: observation.rows.every((row) => {
      const procurement = row.procurement || {};
      const attributed =
        Number(procurement.topologyAttributedShortageUnits || 0) +
        Number(procurement.cashAttributedShortageUnits || 0) +
        Number(procurement.searchExecutionAttributedShortageUnits || 0);
      return Math.abs(attributed - Number(procurement.inputShortageUnits || 0)) <=
        1e-7 * Math.max(1, Math.abs(Number(procurement.inputShortageUnits || 0)));
    }),
    gvaApproachesReconcile: observation.rows.every((row) =>
      Math.abs(Number(row.closing?.gvaApproachResidual || 0)) <= 1e-7 * Math.max(
        1,
        Math.abs(Number(row.closing?.gvaBasicProduction || 0)),
        Math.abs(Number(row.closing?.gvaBasicIncome || 0))
      )
    ),
    diagnosticOnlyNoCanonicalMutation:
      contract.canonicalMutationAuthorized === false &&
      contract.directParameterCalibrationAuthorized === false &&
      contract.diagnosticContract.worldStateMutationAuthorized === false
  };
  gates.ok = Object.values(gates).every(Boolean);
  console.log('WP_RV08_R4_CU_D3D_B7_GATE_TRACE', JSON.stringify({
    candidateId,
    seed,
    scenarioId,
    gates,
    observer: {
      replayStateCount: observation.replayStateCount,
      expectedRows: observation.expectedRows,
      rows: observation.rows.length,
      expectedMonths: observation.expectedMonths,
      replayExact: observation.replayExact,
      rowsSha256: observation.rowsSha256
    },
    source: {
      candidateId: source.candidate?.id,
      seed: source.seed,
      months: source.months,
      scenarioId: sourceScenario?.scenarioId,
      scheduleSha256: sourceScenario?.scheduleSha256
    }
  }));
  assert.equal(gates.ok, true, `${candidateId}/${seed}/${scenarioId}: B7 diagnostic integrity gate failed`);

  const result = {
    schemaVersion: 'r4-cu-d3d-b7-demand-inventory-topology-diagnostic-v0.1',
    front: contract.front,
    generatedAt: new Date().toISOString(),
    status: 'PASS_TECHNICAL_DIAGNOSTIC_CAPTURE_PENDING_CROSS_PANEL_AGGREGATION',
    candidate: source.candidate,
    seed: source.seed,
    scenario: {
      id: scenario.id,
      role: scenario.role,
      schedule: scenario.schedule
    },
    months: source.months,
    contract: {
      path: 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b7-demand-inventory-topology-contract.json',
      sha256: sha256(contractText)
    },
    observerCompatibilityView: {
      originalSha256: observerView.originalSha256,
      patchedSha256: observerView.patchedSha256,
      replacementCount: observerView.replacementCount,
      canonicalTwinExcluded: true,
      canonicalSourceMutationAuthorized: false
    },
    sourceStage3: {
      sourceSchemaVersion: source.schemaVersion,
      sourceFront: source.front,
      sourceResultSha256: sha256(sourceText),
      sourceWorldDigest: source.worldDigest,
      sourceScenarioScheduleSha256: sourceScenario?.scheduleSha256,
      sourceGatesSha256: sha256(JSON.stringify(source.gates || {})),
      sourceSummary: source.summary
    },
    gates,
    diagnostics: observation,
    interpretation: {
      purpose: 'DIAGNOSTIC_CAUSAL_DECOMPOSITION_ONLY',
      empiricalBandsUsedAsDirectParameters: false,
      candidateRetuningAuthorized: false,
      canonicalMutationAuthorized: false,
      sourceStage3DecisionReversed: false
    }
  };

  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CU_D3D_B7_GATES', JSON.stringify(gates));
  console.log('WP_RV08_R4_CU_D3D_B7_SUMMARY', JSON.stringify({
    candidateId,
    seed,
    scenarioId,
    rows: observation.rows.length,
    rowsSha256: observation.rowsSha256,
    summary: observation.summary
  }));
  console.log('WP_RV08_R4_CU_D3D_B7_OUTPUT', outputJson);
} finally {
  if (observer) observer.restore();
  try {
    unlinkSync(observerView.runtimePath);
  } catch {
    // Temporary observer views are removed best-effort after each isolated job.
  }
}
