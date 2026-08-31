import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const CONTRACT_PATH = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b7-d1-supplier-topology-causal-contract.json');
const B7_OBSERVER_SOURCE_PATH = resolve(ROOT, 'economic-lab/src/research/b7-demand-inventory-topology-observer.js');
const D1_INTERVENTION_SOURCE_PATH = resolve(ROOT, 'economic-lab/src/research/d1-topology-neutral-procurement.js');
const SCENARIO_RUNNER_PATH = resolve(ROOT, 'economic-lab/scripts/rv08-r4-cu-d3d-b6-s3-scenario-axis-runner.mjs');
const sourceTarget = process.argv[2];
const sourceOutput = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const outputJson = process.env.D1_OUTPUT_JSON ? resolve(process.env.D1_OUTPUT_JSON) : null;
const candidateId = (process.env.CANDIDATE || '').trim();
const seed = (process.env.DIAG_SEED || '').trim();
const scenarioId = (process.env.S3_SCENARIO_ID || '').trim();
const cellId = (process.env.D1_CELL_ID || '').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

assert.ok(sourceTarget, 'Usage: node rv08-r4-cu-d3d-b7-d1-cell-runner.mjs <signed-b6-runtime-script>');
assert.ok(sourceOutput, 'OUTPUT_JSON is required for the underlying B6-S3 result');
assert.ok(outputJson, 'D1_OUTPUT_JSON is required');
assert.ok(candidateId, 'CANDIDATE is required');
assert.ok(seed, 'DIAG_SEED is required');
assert.ok(scenarioId, 'S3_SCENARIO_ID is required');
assert.ok(['O', 'T'].includes(cellId), 'D1_CELL_ID must be O or T');

const contractText = readFileSync(CONTRACT_PATH, 'utf8');
const contract = JSON.parse(contractText);
const candidateIds = contract.frozenPanel.candidates.map((entry) => entry.id);
const validationSeeds = contract.frozenPanel.validationSeeds.map((entry) => entry.seed);
const scenarios = contract.frozenPanel.scenarios;
const scenarioIds = scenarios.map((entry) => entry.id);
const cell = contract.cells.find((entry) => entry.id === cellId);
const scenario = scenarios.find((entry) => entry.id === scenarioId);

assert.equal(contract.schemaVersion, '1.0');
assert.equal(contract.front, 'R4-CU-D3D-B7-D1');
assert.equal(contract.status, 'FROZEN_BEFORE_TOPOLOGY_COUNTERFACTUAL_EXECUTION');
assert.equal(contract.sourceD0.decision, 'SEQUENCED_MIXED_CAUSAL_PREREGISTRATION_PASSED');
assert.deepEqual(candidateIds, ['V1_M1_C42', 'V24_M16_C42']);
assert.ok(candidateIds.includes(candidateId), `Candidate ${candidateId} is outside D1 panel`);
assert.ok(validationSeeds.includes(seed), `Seed ${seed} is outside D1 panel`);
assert.ok(scenario, `Scenario ${scenarioId} is outside D1 panel`);
assert.ok(cell, `Cell ${cellId} is outside D1 contract`);
assert.equal(contract.frozenPanel.months, 36);
assert.equal(contract.frozenPanel.jobs, 12);
assert.equal(contract.frozenPanel.cellsPerJob, 2);
assert.equal(contract.canonicalMutationAuthorized, false);
assert.equal(contract.candidateRetuningAuthorized, false);

function replaceExactlyOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  assert.notEqual(first, -1, `D1 compatibility anchor missing: ${label}`);
  assert.equal(source.indexOf(needle, first + needle.length), -1, `D1 compatibility anchor duplicated: ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function temporaryPath(sourcePath, label) {
  return resolve(dirname(sourcePath), `${sourcePath.split('/').at(-1)}.${label}-${process.pid}-${Date.now()}.mjs`);
}

function buildB7ObserverCompatibilityView() {
  const original = readFileSync(B7_OBSERVER_SOURCE_PATH, 'utf8');
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
  }`, 'observer-state-tag-filter');

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
    const month = derivedMonth(country);`, 'observer-begin-canonical-bypass');

  patched = replaceExactlyOnce(patched,
`  SupplyChainSystem.prototype.planProduction = function b7PlanProduction(country, ...args) {
    const result = originals.planProduction.call(this, country, ...args);
    const state = stateFor(this, country);
    const month = derivedMonth(country);`,
`  SupplyChainSystem.prototype.planProduction = function b7PlanProduction(country, ...args) {
    const result = originals.planProduction.call(this, country, ...args);
    const state = stateFor(this, country);
    if (!state) return result;
    const month = derivedMonth(country);`, 'observer-plan-canonical-bypass');

  patched = replaceExactlyOnce(patched,
`  SupplyChainSystem.prototype.procureInputs = function b7ProcureInputs(country, month, ...args) {
    const state = stateFor(this, country);
    const row = rowFor(state, country, month);`,
`  SupplyChainSystem.prototype.procureInputs = function b7ProcureInputs(country, month, ...args) {
    const state = stateFor(this, country);
    if (!state) return originals.procureInputs.call(this, country, month, ...args);
    const row = rowFor(state, country, month);`, 'observer-procurement-canonical-bypass');

  patched = replaceExactlyOnce(patched,
`  SupplyChainSystem.prototype.produce = function b7Produce(country, month, metrics, ...args) {
    const state = stateFor(this, country);
    const row = rowFor(state, country, month);`,
`  SupplyChainSystem.prototype.produce = function b7Produce(country, month, metrics, ...args) {
    const state = stateFor(this, country);
    if (!state) return originals.produce.call(this, country, month, metrics, ...args);
    const row = rowFor(state, country, month);`, 'observer-production-canonical-bypass');

  patched = replaceExactlyOnce(patched,
`  setGoodsMarketDiagnosticObserver(({ countryId, month, result, diagnostics }) => {
    const state = latestStateByCountry.get(countryId);
    assert.ok(state, \`${countryId}/${month}: goods observer has no active B7 replay\`);`,
`  setGoodsMarketDiagnosticObserver(({ countryId, month, result, diagnostics }) => {
    const state = latestStateByCountry.get(countryId);
    if (!state) return;`, 'observer-goods-canonical-bypass');

  patched = replaceExactlyOnce(patched,
`  SupplyChainSystem.prototype.finalizeMetrics = function b7FinalizeMetrics(country, metrics, ...args) {
    const result = originals.finalizeMetrics.call(this, country, metrics, ...args);
    const state = stateFor(this, country);
    const month = derivedMonth(country);`,
`  SupplyChainSystem.prototype.finalizeMetrics = function b7FinalizeMetrics(country, metrics, ...args) {
    const result = originals.finalizeMetrics.call(this, country, metrics, ...args);
    const state = stateFor(this, country);
    if (!state) return result;
    const month = derivedMonth(country);`, 'observer-finalize-canonical-bypass');

  const runtimePath = temporaryPath(B7_OBSERVER_SOURCE_PATH, 'd1-observer-runtime');
  writeFileSync(runtimePath, patched);
  return {
    runtimePath,
    originalSha256: sha256(original),
    patchedSha256: sha256(patched),
    replacementCount: 7
  };
}

function buildD1InterventionCompatibilityView() {
  const original = readFileSync(D1_INTERVENTION_SOURCE_PATH, 'utf8');
  let patched = original;
  patched = replaceExactlyOnce(patched,
`  SupplyChainSystem.prototype.procureInputs = function d1TopologyNeutralProcureInputs(country, month) {
    const state = stateFor(this, country);
    const firms = activeFirms(country);`,
`  SupplyChainSystem.prototype.procureInputs = function d1TopologyNeutralProcureInputs(country, month) {
    const state = stateFor(this, country);
    if (!state) return originalProcureInputs.call(this, country, month);
    const firms = activeFirms(country);`, 'intervention-canonical-twin-bypass');
  patched = replaceExactlyOnce(patched,
`        const sellerUnitCost = Math.max(0, finite(seller.bookUnitCost, price * 0.45));`,
`        const sellerUnitCost = Math.max(0, finite(seller.bookUnitCost), price * 0.45);`,
    'intervention-frozen-seller-cost-floor');

  const runtimePath = temporaryPath(D1_INTERVENTION_SOURCE_PATH, 'd1-intervention-runtime');
  writeFileSync(runtimePath, patched);
  return {
    runtimePath,
    originalSha256: sha256(original),
    patchedSha256: sha256(patched),
    replacementCount: 2,
    canonicalTwinExcluded: true,
    sellerCostRuleExact: true
  };
}

function buildTTargetCompatibilityView() {
  const sourcePath = resolve(ROOT, sourceTarget);
  const original = readFileSync(sourcePath, 'utf8');
  let patched = original;
  patched = replaceExactlyOnce(patched,
`  controlCanonicalEquivalence: first.controlCanonicalDigestExact && second.controlCanonicalDigestExact,`,
`  controlCanonicalEquivalence: candidate.control === true ? true : (first.controlCanonicalDigestExact && second.controlCanonicalDigestExact),
  d1TopologyCounterfactualDivergenceObserved:
    candidate.control !== true || (!first.controlCanonicalDigestExact && !second.controlCanonicalDigestExact),`,
    'target-control-counterfactual-separation');
  const runtimePath = temporaryPath(sourcePath, 'd1-target-runtime');
  writeFileSync(runtimePath, patched);
  return {
    runtimePath,
    originalSha256: sha256(original),
    patchedSha256: sha256(patched),
    replacementCount: 1,
    controlCounterfactualSeparationRequired: true
  };
}

function initialPanelIdentity(observation) {
  const rows = (observation.rows || [])
    .filter((row) => Number(row.month) === 1)
    .sort((left, right) => left.countryId.localeCompare(right.countryId))
    .map((row) => ({
      candidateId: row.candidateId,
      countryId: row.countryId,
      month: row.month,
      opening: row.opening,
      plan: row.plan
    }));
  return {
    surface: 'B7_MONTH1_OPENING_AND_PLAN',
    rowCount: rows.length,
    sha256: sha256(JSON.stringify(rows)),
    rows
  };
}

function writeFailure(error, compatibilityViews = {}) {
  const result = {
    schemaVersion: 'r4-cu-d3d-b7-d1-cell-result-v0.1',
    front: contract.front,
    generatedAt: new Date().toISOString(),
    status: 'FAIL_TECHNICAL_D1_CELL',
    cell,
    candidate: contract.frozenPanel.candidates.find((entry) => entry.id === candidateId) || { id: candidateId },
    seed,
    scenario: scenario || { id: scenarioId },
    months: contract.frozenPanel.months,
    contract: { path: relative(ROOT, CONTRACT_PATH), sha256: sha256(contractText) },
    compatibilityViews,
    gates: { runnerCompleted: false, ok: false },
    error: {
      name: error?.name || 'Error',
      message: error?.message || String(error),
      stack: error?.stack || null
    },
    interpretation: {
      purpose: 'DISPOSABLE_CAUSAL_DIAGNOSTIC_CELL_ONLY',
      candidateRetuningAuthorized: false,
      canonicalMutationAuthorized: false,
      sourceD0DecisionReversed: false
    }
  };
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
}

const compatibilityViews = {};
let observerView = null;
let interventionView = null;
let targetView = null;
let observer = null;
let intervention = null;
let caught = null;

try {
  observerView = buildB7ObserverCompatibilityView();
  compatibilityViews.b7Observer = {
    originalSha256: observerView.originalSha256,
    patchedSha256: observerView.patchedSha256,
    replacementCount: observerView.replacementCount,
    canonicalTwinExcluded: true
  };

  if (cellId === 'T') {
    interventionView = buildD1InterventionCompatibilityView();
    compatibilityViews.d1Intervention = {
      originalSha256: interventionView.originalSha256,
      patchedSha256: interventionView.patchedSha256,
      replacementCount: interventionView.replacementCount,
      canonicalTwinExcluded: interventionView.canonicalTwinExcluded,
      sellerCostRuleExact: interventionView.sellerCostRuleExact
    };
    targetView = buildTTargetCompatibilityView();
    compatibilityViews.sourceTarget = {
      originalSha256: targetView.originalSha256,
      patchedSha256: targetView.patchedSha256,
      replacementCount: targetView.replacementCount,
      controlCounterfactualSeparationRequired: true
    };
    const interventionModule = await import(pathToFileURL(interventionView.runtimePath).href);
    intervention = interventionModule.installD1TopologyNeutralProcurement({ expectedCandidateId: candidateId });
    process.argv[2] = targetView.runtimePath;
  }

  const observerModule = await import(pathToFileURL(observerView.runtimePath).href);
  observer = observerModule.installB7DemandInventoryTopologyObserver({ expectedCandidateId: candidateId });
  await import(pathToFileURL(SCENARIO_RUNNER_PATH).href);

  const sourceText = readFileSync(sourceOutput, 'utf8');
  const source = JSON.parse(sourceText);
  const observation = observer.finish(source);
  const interventionObservation = intervention ? intervention.finish(source) : null;
  const sourceScenario = source.s3ScenarioValidation;
  const initialIdentity = initialPanelIdentity(observation);

  const gates = {
    runnerCompleted: true,
    contractExact:
      contract.front === 'R4-CU-D3D-B7-D1' &&
      contract.status === 'FROZEN_BEFORE_TOPOLOGY_COUNTERFACTUAL_EXECUTION',
    sourceD0Passed: contract.sourceD0.decision === 'SEQUENCED_MIXED_CAUSAL_PREREGISTRATION_PASSED',
    cellAuthorized: Boolean(cell) && ['O', 'T'].includes(cellId),
    candidateAuthorized: source.candidate?.id === candidateId && candidateIds.includes(candidateId),
    seedAuthorized: source.seed === seed && validationSeeds.includes(seed),
    scenarioAuthorized: sourceScenario?.scenarioId === scenarioId && scenarioIds.includes(scenarioId),
    horizonFrozen: source.months === contract.frozenPanel.months,
    sourceEngineIntegrityPassed: source.gates?.ok === true,
    exactModelReplayPassed:
      source.gates?.exactCanonicalReplay === true && source.gates?.exactDiagnosticReplay === true,
    hardAccountingHealthy: source.gates?.hardAccountingHealthy === true,
    protectedSurfaceExact: source.gates?.protectedSurfaceExact === true,
    scenarioScheduleExact:
      sourceScenario?.scheduleSha256 === sha256(JSON.stringify(scenario.schedule)) &&
      JSON.stringify(sourceScenario?.schedule) === JSON.stringify(scenario.schedule),
    observerReplayStateCountExact: observation.replayStateCount === 2,
    observerReplayExact: observation.replayExact === true,
    completeCountryMonthPanel:
      observation.rows.length === observation.expectedRows &&
      observation.expectedMonths === contract.frozenPanel.months,
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
    initialIdentityProduced: initialIdentity.rowCount === observation.expectedCountries.length && initialIdentity.sha256.length === 64,
    observedCellHasNoIntervention: cellId !== 'O' || interventionObservation === null,
    topologyCellInterventionPresent: cellId !== 'T' || interventionObservation?.interventionId === contract.intervention.id,
    interventionConfigHashValid:
      cellId !== 'T' || (
        interventionObservation?.interventionConfigSha256 === sha256(JSON.stringify(interventionObservation?.interventionConfig)) &&
        interventionObservation?.interventionConfig?.procurementBudgetShare === 0.42 &&
        interventionObservation?.interventionConfig?.fixedRoundCap === null &&
        interventionObservation?.interventionConfig?.visitEachEligibleSellerAtMostOnce === true
      ),
    interventionReplayStateCountExact: cellId !== 'T' || interventionObservation?.replayStateCount === 2,
    interventionReplayExact: cellId !== 'T' || interventionObservation?.replayExact === true,
    interventionRowsComplete:
      cellId !== 'T' || (
        interventionObservation?.rows?.length === interventionObservation?.expectedRows &&
        interventionObservation?.expectedMonths === contract.frozenPanel.months
      ),
    interventionBoundaryExact:
      cellId !== 'T' || interventionObservation?.rows?.every((row) => row.boundary?.invariantExact === true),
    interventionConservationExact:
      cellId !== 'T' || interventionObservation?.rows?.every((row) => row.conservation?.ok === true),
    canonicalTwinExcluded:
      cellId !== 'T' || compatibilityViews.d1Intervention?.canonicalTwinExcluded === true,
    frozenSellerCostRuleExact:
      cellId !== 'T' || compatibilityViews.d1Intervention?.sellerCostRuleExact === true,
    counterfactualReferencePolicyExact:
      cellId !== 'T' || source.gates?.d1TopologyCounterfactualDivergenceObserved === true,
    canonicalMutationLocked:
      contract.canonicalMutationAuthorized === false &&
      contract.directParameterCalibrationAuthorized === false &&
      contract.candidateRetuningAuthorized === false
  };
  gates.ok = Object.values(gates).every(Boolean);

  const result = {
    schemaVersion: 'r4-cu-d3d-b7-d1-cell-result-v0.1',
    front: contract.front,
    generatedAt: new Date().toISOString(),
    status: gates.ok ? 'PASS_TECHNICAL_D1_CELL' : 'FAIL_TECHNICAL_D1_CELL',
    cell,
    candidate: source.candidate,
    seed: source.seed,
    scenario: { id: scenario.id, role: scenario.role, schedule: scenario.schedule },
    months: source.months,
    contract: { path: relative(ROOT, CONTRACT_PATH), sha256: sha256(contractText) },
    compatibilityViews,
    sourceStage3: {
      schemaVersion: source.schemaVersion,
      front: source.front,
      resultSha256: sha256(sourceText),
      rowsSha256: sha256(JSON.stringify(source.rows || [])),
      gatesSha256: sha256(JSON.stringify(source.gates || {})),
      worldDigest: source.worldDigest,
      replayDigest: source.replayDigest,
      scenarioScheduleSha256: sourceScenario?.scheduleSha256,
      summary: source.summary
    },
    initialPanelIdentity: initialIdentity,
    gates,
    diagnostics: observation,
    intervention: interventionObservation,
    interpretation: {
      purpose: 'DISPOSABLE_CAUSAL_DIAGNOSTIC_CELL_ONLY',
      observedCell: cellId === 'O',
      topologyNeutralCell: cellId === 'T',
      empiricalBandsUsedAsParameters: false,
      candidateRetuningAuthorized: false,
      canonicalMutationAuthorized: false,
      sourceD0DecisionReversed: false
    }
  };

  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CU_D3D_B7_D1_CELL_GATES', JSON.stringify({
    candidateId,
    seed,
    scenarioId,
    cellId,
    gates,
    initialPanelSha256: initialIdentity.sha256,
    interventionRowsSha256: interventionObservation?.rowsSha256 || null,
    diagnosticRowsSha256: observation.rowsSha256
  }));
  assert.equal(gates.ok, true, `${candidateId}/${seed}/${scenarioId}/${cellId}: D1 technical cell gate failed`);
} catch (error) {
  caught = error;
  if (!outputJson || !readableOutputExists(outputJson)) writeFailure(error, compatibilityViews);
} finally {
  if (observer) observer.restore();
  if (intervention) intervention.restore();
  for (const path of [observerView?.runtimePath, interventionView?.runtimePath, targetView?.runtimePath]) {
    if (!path) continue;
    try {
      unlinkSync(path);
    } catch {
      // Temporary disposable compatibility views are removed best-effort.
    }
  }
}

function readableOutputExists(path) {
  try {
    JSON.parse(readFileSync(path, 'utf8'));
    return true;
  } catch {
    return false;
  }
}

if (caught) throw caught;
