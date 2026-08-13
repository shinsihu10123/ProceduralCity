import { EconomicWorld } from '../src/core/world-v10.js';

const profiles = process.argv.slice(2).length ? process.argv.slice(2) : ['compact', 'baseline', 'x2'];
const measuredMonths = Math.max(1, Number(process.env.BENCH_MONTHS || 2));
const warmupMonths = Math.max(0, Number(process.env.BENCH_WARMUP || 1));
const rows = [];

for (const profile of profiles) {
  const world = new EconomicWorld(`ECON-V10-BENCH-${profile}`, {
    scaleProfile: profile,
    healthCheckInterval: 0
  });

  if (warmupMonths) world.step(warmupMonths);
  const start = globalThis.performance?.now?.() ?? Date.now();
  world.step(measuredMonths);
  const elapsed = (globalThis.performance?.now?.() ?? Date.now()) - start;
  const health = world.forceHealthCheck();
  const scale = world.scaleReport();

  rows.push({
    profile,
    households: scale.initialPopulation.households,
    firms: scale.initialPopulation.firms,
    cognitiveAgents: scale.initialPopulation.cognitiveAgents,
    measuredMonths,
    elapsedMs: elapsed,
    msPerMonth: elapsed / measuredMonths,
    msPer1000AgentsPerMonth: elapsed / measuredMonths / Math.max(1, scale.initialPopulation.cognitiveAgents / 1000),
    healthOk: health.ok,
    failures: health.failures
  });
}

console.table(rows);
console.log(JSON.stringify(rows, null, 2));
if (rows.some(row => !row.healthOk)) process.exitCode = 1;
