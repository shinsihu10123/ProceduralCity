import { EconomicWorld } from '../src/core/world-v10.js';

const profiles = process.argv.slice(2).length ? process.argv.slice(2) : ['compact', 'baseline', 'x2'];
const measuredMonths = Math.max(1, Number(process.env.BENCH_MONTHS || 2));
const warmupMonths = Math.max(0, Number(process.env.BENCH_WARMUP || 1));
const rows = [];
const breakdowns = [];

for (const profile of profiles) {
  const constructionStart = globalThis.performance?.now?.() ?? Date.now();
  const world = new EconomicWorld(`ECON-V10-BENCH-${profile}`, {
    scaleProfile: profile,
    healthCheckInterval: 0
  });
  const constructionMs = (globalThis.performance?.now?.() ?? Date.now()) - constructionStart;

  if (warmupMonths) world.step(warmupMonths);
  world.resetRuntimeMetrics();

  const start = globalThis.performance?.now?.() ?? Date.now();
  world.step(measuredMonths);
  const elapsed = (globalThis.performance?.now?.() ?? Date.now()) - start;
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
    elapsedMs: elapsed,
    msPerMonth: elapsed / measuredMonths,
    msPer1000AgentsPerMonth: elapsed / measuredMonths / Math.max(1, scale.initialPopulation.cognitiveAgents / 1000),
    attributedShare: profiling.attributedShare,
    topPhase: top.label,
    topPhaseMsPerMonth: top.exclusiveMs / measuredMonths,
    topPhaseShare: top.shareOfObservedTime,
    unattributedMsPerMonth: profiling.unattributedMs / measuredMonths,
    healthOk: health.ok,
    failures: health.failures
  });

  breakdowns.push({
    profile,
    constructionMs,
    measuredMonths,
    totalObservedMs: profiling.totalObservedMs,
    attributedShare: profiling.attributedShare,
    unattributedMs: profiling.unattributedMs,
    phases: topPhases.map(row => ({
      label: row.label,
      calls: row.calls,
      exclusiveMs: row.exclusiveMs,
      msPerMonth: row.exclusiveMs / measuredMonths,
      share: row.shareOfObservedTime
    }))
  });
}

console.table(rows);
for (const breakdown of breakdowns) {
  console.log(`PROFILE_BREAKDOWN ${breakdown.profile}`);
  console.table(breakdown.phases);
}
console.log(JSON.stringify({ rows, breakdowns }, null, 2));
if (rows.some(row => !row.healthOk)) process.exitCode = 1;
