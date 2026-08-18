import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { setLaborMarketDiagnosticObserver } from '../src/markets/labor-market.js';
import { RealityDiagnosticRecorder } from '../src/research/reality-diagnostics.js';

const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const label = process.env.DIAG_LABEL || 'WP-RV02';
const scaleProfile = process.env.DIAG_SCALE || process.argv[2] || 'compact';
const months = Math.max(1, Number(process.env.DIAG_MONTHS || process.argv[3] || 36));
const seedText = process.env.DIAG_SEEDS || process.argv.slice(4).join(',') || 'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C';
const seeds = seedText.split(',').map(seed => seed.trim()).filter(Boolean);

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function ratio(numerator, denominator) {
  const d = finite(denominator);
  return Math.abs(d) > 1e-9 ? finite(numerator) / d : 0;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + finite(value), 0) / values.length : 0;
}

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = values.map(value => finite(value)).sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index];
}

function firstMonth(rows, predicate) {
  const row = rows.find(predicate);
  return row ? row.month : null;
}

function memorySnapshot() {
  const m = process.memoryUsage();
  return {
    rss: finite(m.rss),
    heapTotal: finite(m.heapTotal),
    heapUsed: finite(m.heapUsed),
    external: finite(m.external),
    arrayBuffers: finite(m.arrayBuffers)
  };
}

function memoryDelta(after, before) {
  return Object.fromEntries(Object.keys(after).map(key => [key, finite(after[key]) - finite(before[key])]));
}

function firmSnapshot(world) {
  const byCountry = new Map();
  for (const country of world.countries || []) {
    const firms = new Map();
    for (const firm of country.firms || []) {
      firms.set(firm.id, {
        active: firm.active !== false,
        industryId: firm.industryId,
        workers: finite(firm.workers),
        desiredWorkers: finite(firm.desiredWorkers),
        wage: finite(firm.wage),
        distressMonths: finite(firm.distressMonths),
        cash: finite(world.ledger?.balance?.(firm.accountId), finite(firm.cash)),
        safeCash: finite(firm.safeCash),
        creditMisses: finite(firm.creditMisses),
        wageArrears: finite(firm.wageArrears),
        revenue: finite(firm.revenue),
        sales: finite(firm.sales),
        output: finite(firm.output),
        inventory: finite(firm.inventory),
        inputShortage: finite(firm.supplyShortage),
        loanBalance: finite(firm.loanBalance)
      });
    }
    byCountry.set(country.id, firms);
  }
  return byCountry;
}

function postFirmState(world, firm) {
  if (!firm) return null;
  return {
    active: firm.active !== false,
    industryId: firm.industryId,
    workers: finite(firm.workers),
    desiredWorkers: finite(firm.desiredWorkers),
    wage: finite(firm.wage),
    distressMonths: finite(firm.distressMonths),
    cash: finite(world.ledger?.balance?.(firm.accountId), finite(firm.cash)),
    safeCash: finite(firm.safeCash),
    creditMisses: finite(firm.creditMisses),
    wageArrears: finite(firm.wageArrears),
    revenue: finite(firm.revenue),
    sales: finite(firm.sales),
    output: finite(firm.output),
    inventory: finite(firm.inventory),
    inputShortage: finite(firm.supplyShortage),
    loanBalance: finite(firm.loanBalance)
  };
}

function capturePreExitEvents(world, before, events) {
  for (const country of world.countries || []) {
    const current = new Map((country.firms || []).map(firm => [firm.id, firm]));
    const prior = before.get(country.id) || new Map();
    for (const [firmId, pre] of prior) {
      if (!pre.active) continue;
      const firm = current.get(firmId) || null;
      if (firm && firm.active !== false) continue;
      const post = postFirmState(world, firm);
      const severePayrollStressPre = pre.wageArrears > Math.max(100, pre.wage * Math.max(1, pre.workers) * 1.35);
      events.push({
        month: world.month,
        countryId: country.id,
        firmId,
        industryId: pre.industryId,
        preExit: pre,
        postExit: post,
        preExitFlags: {
          severePayrollStress: severePayrollStressPre,
          severeCreditStress: pre.creditMisses >= 5,
          liquidityFailure: pre.cash < pre.safeCash * 0.025 && severePayrollStressPre
        }
      });
    }
  }
}

function initializeLaborSpells(world) {
  const states = new Map();
  for (const country of world.countries || []) {
    for (const household of country.households || []) {
      states.set(`${country.id}:${household.id}`, {
        employed: Boolean(household.employed),
        observedDuration: 0,
        leftCensored: !household.employed
      });
    }
  }
  return states;
}

function captureLaborSpells(world, states, records) {
  for (const country of world.countries || []) {
    const observedDurations = [];
    const knownDurations = [];
    let leftCensoredUnemployed = 0;

    for (const household of country.households || []) {
      const key = `${country.id}:${household.id}`;
      const prior = states.get(key) || {
        employed: true,
        observedDuration: 0,
        leftCensored: false
      };

      let next;
      if (household.employed) {
        next = { employed: true, observedDuration: 0, leftCensored: false };
      } else if (prior.employed) {
        next = { employed: false, observedDuration: 1, leftCensored: false };
      } else {
        next = {
          employed: false,
          observedDuration: prior.observedDuration + 1,
          leftCensored: prior.leftCensored
        };
      }
      states.set(key, next);

      if (!next.employed) {
        observedDurations.push(next.observedDuration);
        if (next.leftCensored) leftCensoredUnemployed += 1;
        else knownDurations.push(next.observedDuration);
      }
    }

    records.push({
      month: world.month,
      countryId: country.id,
      currentUnemployed: observedDurations.length,
      leftCensoredUnemployed,
      leftCensoredShare: ratio(leftCensoredUnemployed, observedDurations.length),
      meanObservedDurationLowerBound: mean(observedDurations),
      medianObservedDurationLowerBound: quantile(observedDurations, 0.5),
      p90ObservedDurationLowerBound: quantile(observedDurations, 0.9),
      maxObservedDurationLowerBound: observedDurations.length ? Math.max(...observedDurations) : 0,
      knownSpellCount: knownDurations.length,
      meanKnownDuration: mean(knownDurations),
      p90KnownDuration: quantile(knownDurations, 0.9)
    });
  }
}

function reconcileExitCounts(diagnostics, preExitEvents) {
  const key = event => `${event.month}:${event.countryId}`;
  const diagnosticCounts = new Map();
  const preExitCounts = new Map();

  for (const event of diagnostics.exitEvents || []) {
    const k = key(event);
    diagnosticCounts.set(k, (diagnosticCounts.get(k) || 0) + 1);
  }
  for (const event of preExitEvents) {
    const k = key(event);
    preExitCounts.set(k, (preExitCounts.get(k) || 0) + 1);
  }

  const keys = new Set([...diagnosticCounts.keys(), ...preExitCounts.keys()]);
  let maxError = 0;
  for (const k of keys) {
    maxError = Math.max(maxError, Math.abs((diagnosticCounts.get(k) || 0) - (preExitCounts.get(k) || 0)));
  }
  return {
    diagnosticExitEvents: diagnostics.exitEvents?.length || 0,
    preExitEvents: preExitEvents.length,
    maxCountryMonthCountError: maxError,
    ok: maxError === 0 && (diagnostics.exitEvents?.length || 0) === preExitEvents.length
  };
}

function summarizeCountry(rows) {
  const terminal = rows.at(-1);
  const firstWindow = rows.slice(0, Math.min(12, rows.length));
  const lastWindow = rows.slice(Math.max(0, rows.length - 12));
  const peakGdp = Math.max(...rows.map(row => finite(row.macro.nominalGdp)));
  const peakConsumption = Math.max(...rows.map(row => finite(row.macro.consumption)));
  const initialFirmTotal = finite(rows[0]?.firms.total);
  const terminalFirmRetention = ratio(terminal.firms.active, initialFirmTotal);
  const terminalGdpToPeak = ratio(terminal.macro.nominalGdp, peakGdp);
  const terminalConsumptionToPeak = ratio(terminal.macro.consumption, peakConsumption);
  const maxAbsInventoryShare = Math.max(...rows.map(row => Math.abs(ratio(row.macro.inventoryInvestment, row.macro.nominalGdp))));

  return {
    countryId: terminal.countryId,
    terminal: {
      month: terminal.month,
      unemployment: terminal.macro.unemployment,
      activeFirms: terminal.firms.active,
      totalFirms: terminal.firms.total,
      nominalGdp: terminal.macro.nominalGdp,
      realOutput: terminal.macro.realOutput,
      consumption: terminal.macro.consumption,
      creditStress: terminal.banking.creditStress,
      bankStress: terminal.banking.bankStress,
      bankCapitalRatio: terminal.banking.bankCapitalRatio
    },
    path: {
      peakGdp,
      peakConsumption,
      terminalFirmRetention,
      terminalGdpToPeak,
      terminalConsumptionToPeak,
      cumulativeFirmExits: rows.reduce((sum, row) => sum + finite(row.firms.newExits), 0),
      firstUnemployment25Month: firstMonth(rows, row => row.macro.unemployment >= 0.25),
      firstUnemployment50Month: firstMonth(rows, row => row.macro.unemployment >= 0.50),
      firstUnemployment75Month: firstMonth(rows, row => row.macro.unemployment >= 0.75),
      firstFirmRetentionBelow75Month: firstMonth(rows, row => ratio(row.firms.active, initialFirmTotal) <= 0.75),
      firstFirmRetentionBelow50Month: firstMonth(rows, row => ratio(row.firms.active, initialFirmTotal) <= 0.50),
      maxAbsInventoryInvestmentShareOfGdp: maxAbsInventoryShare
    },
    flows: {
      first12MeanUnemployment: mean(firstWindow.map(row => row.macro.unemployment)),
      last12MeanUnemployment: mean(lastWindow.map(row => row.macro.unemployment)),
      first12MeanJobFindingRate: mean(firstWindow.map(row => row.labor.jobFindingRate)),
      last12MeanJobFindingRate: mean(lastWindow.map(row => row.labor.jobFindingRate)),
      first12MeanSeparationRate: mean(firstWindow.map(row => row.labor.separationRate)),
      last12MeanSeparationRate: mean(lastWindow.map(row => row.labor.separationRate)),
      first12MeanCreditStress: mean(firstWindow.map(row => row.banking.creditStress)),
      last12MeanCreditStress: mean(lastWindow.map(row => row.banking.creditStress))
    },
    descriptiveMarkers: {
      highTerminalUnemployment: terminal.macro.unemployment >= 0.50,
      severeTerminalUnemployment: terminal.macro.unemployment >= 0.75,
      majorFirmLoss: terminalFirmRetention <= 0.50,
      gdpBelowHalfPeak: terminalGdpToPeak <= 0.50,
      consumptionBelowHalfPeak: terminalConsumptionToPeak <= 0.50
    }
  };
}

function summarizeRun(diagnostics) {
  const countryIds = [...new Set(diagnostics.records.map(row => row.countryId))].sort();
  return countryIds.map(countryId => summarizeCountry(diagnostics.records.filter(row => row.countryId === countryId)));
}

function run(seed) {
  const memoryBeforeConstruction = memorySnapshot();
  const constructionStart = globalThis.performance?.now?.() ?? Date.now();
  const world = new EconomicWorld(seed, { scaleProfile, healthCheckInterval: 0 });
  const constructionMs = (globalThis.performance?.now?.() ?? Date.now()) - constructionStart;
  const memoryAfterConstruction = memorySnapshot();

  const recorder = new RealityDiagnosticRecorder(world);
  const laborSpellStates = initializeLaborSpells(world);
  const laborSpellRecords = [];
  const preExitEvents = [];
  setLaborMarketDiagnosticObserver(event => recorder.recordLaborMarket(event));

  const simulationStart = globalThis.performance?.now?.() ?? Date.now();
  try {
    for (let month = 0; month < months; month++) {
      const preFirms = firmSnapshot(world);
      world.stepMonth();
      recorder.captureMonth(world);
      captureLaborSpells(world, laborSpellStates, laborSpellRecords);
      capturePreExitEvents(world, preFirms, preExitEvents);
    }
  } finally {
    setLaborMarketDiagnosticObserver(null);
  }
  const simulationMs = (globalThis.performance?.now?.() ?? Date.now()) - simulationStart;
  const memoryAfterSimulation = memorySnapshot();

  const health = world.forceHealthCheck();
  const diagnostics = recorder.report();
  const exitReconciliation = reconcileExitCounts(diagnostics, preExitEvents);
  assert.ok(health.ok, `${seed}: v0.10 health gate must pass`);
  assert.ok(diagnostics.gates.ok, `${seed}: diagnostic reconciliation gates must pass`);
  assert.equal(diagnostics.records.length, months * 4, `${seed}: every country-month must be recorded`);
  assert.equal(laborSpellRecords.length, months * 4, `${seed}: every country-month labor spell record must be captured`);
  assert.ok(exitReconciliation.ok, `${seed}: pre-exit snapshots must reconcile with diagnostic firm exits`);

  return {
    seed,
    health,
    runtime: {
      constructionMs,
      simulationMs,
      msPerMonth: simulationMs / months,
      memory: {
        beforeConstruction: memoryBeforeConstruction,
        afterConstruction: memoryAfterConstruction,
        afterSimulation: memoryAfterSimulation,
        constructionDelta: memoryDelta(memoryAfterConstruction, memoryBeforeConstruction),
        simulationDelta: memoryDelta(memoryAfterSimulation, memoryAfterConstruction)
      }
    },
    diagnostics,
    refinements: {
      unemploymentSpells: {
        methodology: 'Initial unemployed spells are left-censored. Durations are observed lower bounds from month 1 onward; newly observed separations have known spell starts.',
        records: laborSpellRecords
      },
      firmExitSnapshots: {
        methodology: 'Firm state is snapshotted immediately before each monthly step and reconciled against post-step exit events.',
        reconciliation: exitReconciliation,
        events: preExitEvents
      }
    },
    summary: summarizeRun(diagnostics),
    emergence: world.emergenceReport(),
    scale: world.scaleReport()
  };
}

const runs = seeds.map(run);
const countrySummaries = runs.flatMap(run => run.summary.map(row => ({ seed: run.seed, ...row })));
const totalCountryRuns = countrySummaries.length;
const markerCount = name => countrySummaries.filter(row => row.descriptiveMarkers[name]).length;

const report = {
  schemaVersion: 1,
  kind: 'economic-lab-wp-rv02-baseline-reproduction',
  label,
  scaleProfile,
  months,
  seeds,
  methodology: {
    mechanismChanges: 0,
    parameterTuning: 0,
    purpose: 'Reproduce baseline dynamics and establish a compute envelope before causal diagnosis. Descriptive stress markers are not realism pass/fail criteria.'
  },
  computeEnvelope: {
    totalRuns: runs.length,
    totalSimulatedMonths: runs.length * months,
    totalCountryMonths: runs.length * months * 4,
    constructionMs: runs.map(run => run.runtime.constructionMs),
    simulationMs: runs.map(run => run.runtime.simulationMs),
    msPerMonth: runs.map(run => run.runtime.msPerMonth),
    meanMsPerMonth: mean(runs.map(run => run.runtime.msPerMonth)),
    maxMsPerMonth: Math.max(...runs.map(run => run.runtime.msPerMonth))
  },
  descriptiveReproduction: {
    totalCountryRuns,
    highTerminalUnemployment: markerCount('highTerminalUnemployment'),
    severeTerminalUnemployment: markerCount('severeTerminalUnemployment'),
    majorFirmLoss: markerCount('majorFirmLoss'),
    gdpBelowHalfPeak: markerCount('gdpBelowHalfPeak'),
    consumptionBelowHalfPeak: markerCount('consumptionBelowHalfPeak')
  },
  runs,
  gates: {
    allHealthy: runs.every(run => run.health.ok),
    allDiagnosticsReconciled: runs.every(run => run.diagnostics.gates.ok),
    completeCountryMonthCoverage: runs.every(run => run.diagnostics.records.length === months * 4),
    completeLaborSpellCoverage: runs.every(run => run.refinements.unemploymentSpells.records.length === months * 4),
    preExitSnapshotsReconciled: runs.every(run => run.refinements.firmExitSnapshots.reconciliation.ok)
  }
};
report.gates.ok = Object.values(report.gates).every(Boolean);

console.table(runs.map(run => ({
  seed: run.seed,
  scaleProfile,
  months,
  constructionMs: Number(run.runtime.constructionMs.toFixed(2)),
  simulationMs: Number(run.runtime.simulationMs.toFixed(2)),
  msPerMonth: Number(run.runtime.msPerMonth.toFixed(2)),
  exitEvents: run.diagnostics.exitEvents.length,
  loanTransitions: run.diagnostics.loanTransitions.length,
  health: run.health.ok,
  reconciled: run.diagnostics.gates.ok
})));

console.table(countrySummaries.map(row => ({
  seed: row.seed,
  country: row.countryId,
  unemployment: Number(row.terminal.unemployment.toFixed(4)),
  activeFirms: row.terminal.activeFirms,
  firmRetention: Number(row.path.terminalFirmRetention.toFixed(4)),
  gdpToPeak: Number(row.path.terminalGdpToPeak.toFixed(4)),
  consumptionToPeak: Number(row.path.terminalConsumptionToPeak.toFixed(4)),
  last12JobFinding: Number(row.flows.last12MeanJobFindingRate.toFixed(4)),
  last12Separation: Number(row.flows.last12MeanSeparationRate.toFixed(4)),
  last12CreditStress: Number(row.flows.last12MeanCreditStress.toFixed(4))
})));
console.log('WP_RV02_GATES', JSON.stringify(report.gates));
console.log('WP_RV02_REPRODUCTION', JSON.stringify(report.descriptiveReproduction));
console.log('WP_RV02_COMPUTE', JSON.stringify(report.computeEnvelope));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`WP_RV02_JSON ${outputJson}`);
} else {
  console.log(JSON.stringify(report, null, 2));
}

if (!report.gates.ok) process.exitCode = 1;
