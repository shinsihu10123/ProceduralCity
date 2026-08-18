import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';

const profiles = process.argv.slice(2).length ? process.argv.slice(2) : ['compact', 'baseline', 'x2'];
const measuredMonths = Math.max(1, Number(process.env.BENCH_MONTHS || 2));
const warmupMonths = Math.max(0, Number(process.env.BENCH_WARMUP || 1));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const rows = [];
const breakdowns = [];

function memorySnapshot() {
  const m = process.memoryUsage();
  return {
    rss: Number(m.rss || 0),
    heapTotal: Number(m.heapTotal || 0),
    heapUsed: Number(m.heapUsed || 0),
    external: Number(m.external || 0),
    arrayBuffers: Number(m.arrayBuffers || 0)
  };
}

function memoryDelta(after, before) {
  return Object.fromEntries(Object.keys(after).map(key => [key, Number(after[key] || 0) - Number(before[key] || 0)]));
}

function jsonBytes(value) {
  if (value === undefined) return 0;
  try {
    return Buffer.byteLength(JSON.stringify(value) || '', 'utf8');
  } catch {
    return -1;
  }
}

function retainedStateCensus(world, sampleLimitPerKind = 16) {
  const components = [
    'memory',
    'causalModel',
    'decisions',
    'lastReasoning',
    'forecastHistory',
    'pendingForecasts',
    'hypotheses'
  ];
  const totals = {
    agents: 0,
    episodes: 0,
    decisions: 0,
    pendingForecasts: 0,
    forecastHistory: 0,
    causalLinks: 0,
    hypotheses: 0,
    withLastReasoning: 0
  };
  const byKind = {};
  const samples = {};

  for (const country of world.countries || []) {
    for (const agent of world.cognitive.agents(country)) {
      const cognition = agent?.cognition;
      if (!cognition?.enabled) continue;
      const kind = agent.kind || 'agent';
      totals.agents += 1;
      totals.episodes += cognition.memory?.episodes?.length || 0;
      totals.decisions += cognition.decisions?.length || 0;
      totals.pendingForecasts += cognition.pendingForecasts?.length || 0;
      totals.forecastHistory += cognition.forecastHistory?.length || 0;
      totals.causalLinks += cognition.causalModel?.links?.length || 0;
      totals.hypotheses += cognition.hypotheses?.length || 0;
      if (cognition.lastReasoning) totals.withLastReasoning += 1;

      if (!byKind[kind]) {
        byKind[kind] = {
          agents: 0,
          episodes: 0,
          decisions: 0,
          pendingForecasts: 0,
          forecastHistory: 0,
          causalLinks: 0,
          hypotheses: 0,
          withLastReasoning: 0
        };
      }
      const row = byKind[kind];
      row.agents += 1;
      row.episodes += cognition.memory?.episodes?.length || 0;
      row.decisions += cognition.decisions?.length || 0;
      row.pendingForecasts += cognition.pendingForecasts?.length || 0;
      row.forecastHistory += cognition.forecastHistory?.length || 0;
      row.causalLinks += cognition.causalModel?.links?.length || 0;
      row.hypotheses += cognition.hypotheses?.length || 0;
      if (cognition.lastReasoning) row.withLastReasoning += 1;

      if (!samples[kind]) samples[kind] = [];
      if (samples[kind].length < sampleLimitPerKind) {
        const componentBytes = { cognition: jsonBytes(cognition) };
        for (const component of components) componentBytes[component] = jsonBytes(cognition[component]);
        samples[kind].push(componentBytes);
      }
    }
  }

  const sampleSummary = {};
  for (const [kind, kindSamples] of Object.entries(samples)) {
    const keys = ['cognition', ...components];
    const averageBytes = {};
    for (const key of keys) {
      const valid = kindSamples.map(row => row[key]).filter(value => value >= 0);
      averageBytes[key] = valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
    }
    sampleSummary[kind] = {
      samples: kindSamples.length,
      averageSerializedBytes: averageBytes,
      estimatedSerializedBytesByComponent: Object.fromEntries(
        keys.map(key => [key, averageBytes[key] === null ? null : averageBytes[key] * (byKind[kind]?.agents || 0)])
      )
    };
  }

  return {
    methodology: {
      exactCounts: true,
      serializedSizeIsHeapEstimate: false,
      sampleLimitPerKind,
      note: 'Counts are exact. Serialized byte estimates are deterministic diagnostic samples and are not V8 heap-size measurements.'
    },
    totals,
    byKind,
    sampleSummary
  };
}

for (const profile of profiles) {
  const memoryBeforeConstruction = memorySnapshot();
  const constructionStart = globalThis.performance?.now?.() ?? Date.now();
  const world = new EconomicWorld(`ECON-V10-BENCH-${profile}`, {
    scaleProfile: profile,
    healthCheckInterval: 0
  });
  const constructionMs = (globalThis.performance?.now?.() ?? Date.now()) - constructionStart;
  const memoryAfterConstruction = memorySnapshot();

  if (warmupMonths) world.step(warmupMonths);
  const memoryAfterWarmup = memorySnapshot();
  world.resetRuntimeMetrics();

  const start = globalThis.performance?.now?.() ?? Date.now();
  world.step(measuredMonths);
  const elapsed = (globalThis.performance?.now?.() ?? Date.now()) - start;
  const memoryAfterMeasured = memorySnapshot();
  const health = world.forceHealthCheck();
  const scale = world.scaleReport();
  const profiling = world.profilingReport();
  const topPhases = profiling.phases.slice(0, 10);
  const top = topPhases[0] || { label: '-', exclusiveMs: 0, shareOfObservedTime: 0 };
  const retainedState = retainedStateCensus(world);

  rows.push({
    profile,
    households: scale.initialPopulation.households,
    firms: scale.initialPopulation.firms,
    cognitiveAgents: scale.initialPopulation.cognitiveAgents,
    constructionMs,
    constructionMsPer1000Agents: constructionMs / Math.max(1, scale.initialPopulation.cognitiveAgents / 1000),
    measuredMonths,
    warmupMonths,
    elapsedMs: elapsed,
    msPerMonth: elapsed / measuredMonths,
    msPer1000AgentsPerMonth: elapsed / measuredMonths / Math.max(1, scale.initialPopulation.cognitiveAgents / 1000),
    attributedShare: profiling.attributedShare,
    topPhase: top.label,
    topPhaseMsPerMonth: top.exclusiveMs / measuredMonths,
    topPhaseShare: top.shareOfObservedTime,
    unattributedMsPerMonth: profiling.unattributedMs / measuredMonths,
    heapUsedAfterConstruction: memoryAfterConstruction.heapUsed,
    heapUsedAfterWarmup: memoryAfterWarmup.heapUsed,
    heapUsedAfterMeasured: memoryAfterMeasured.heapUsed,
    rssAfterMeasured: memoryAfterMeasured.rss,
    heapUsedMeasuredDelta: memoryAfterMeasured.heapUsed - memoryAfterWarmup.heapUsed,
    retainedEpisodes: retainedState.totals.episodes,
    retainedDecisions: retainedState.totals.decisions,
    retainedCausalLinks: retainedState.totals.causalLinks,
    healthOk: health.ok,
    failures: health.failures
  });

  breakdowns.push({
    profile,
    constructionMs,
    warmupMonths,
    measuredMonths,
    totalObservedMs: profiling.totalObservedMs,
    attributedShare: profiling.attributedShare,
    unattributedMs: profiling.unattributedMs,
    memory: {
      beforeConstruction: memoryBeforeConstruction,
      afterConstruction: memoryAfterConstruction,
      afterWarmup: memoryAfterWarmup,
      afterMeasured: memoryAfterMeasured,
      constructionDelta: memoryDelta(memoryAfterConstruction, memoryBeforeConstruction),
      warmupDelta: memoryDelta(memoryAfterWarmup, memoryAfterConstruction),
      measuredDelta: memoryDelta(memoryAfterMeasured, memoryAfterWarmup)
    },
    retainedState,
    phases: topPhases.map(row => ({
      label: row.label,
      calls: row.calls,
      exclusiveMs: row.exclusiveMs,
      msPerMonth: row.exclusiveMs / measuredMonths,
      share: row.shareOfObservedTime
    }))
  });
}

const result = {
  schemaVersion: 2,
  kind: 'economic-lab-v10-benchmark',
  generatedAt: new Date().toISOString(),
  node: process.version,
  warmupMonths,
  measuredMonths,
  profiles,
  rows,
  breakdowns
};

console.table(rows);
for (const breakdown of breakdowns) {
  console.log(`PROFILE_BREAKDOWN ${breakdown.profile}`);
  console.table(breakdown.phases);
  console.log(`RETAINED_STATE ${breakdown.profile}`, JSON.stringify(breakdown.retainedState));
}
console.log(JSON.stringify(result, null, 2));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`PERFORMANCE_JSON ${outputJson}`);
}

if (rows.some(row => !row.healthOk)) process.exitCode = 1;
