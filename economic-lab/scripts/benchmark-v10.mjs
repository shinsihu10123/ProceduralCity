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
  schemaVersion: 1,
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
}
console.log(JSON.stringify(result, null, 2));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`PERFORMANCE_JSON ${outputJson}`);
}

if (rows.some(row => !row.healthOk)) process.exitCode = 1;
