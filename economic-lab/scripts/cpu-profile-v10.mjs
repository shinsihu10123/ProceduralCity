import inspector from 'node:inspector';
import { promisify } from 'node:util';
import { EconomicWorld } from '../src/core/world-v10.js';

const profileName = process.argv[2] || 'x10';
const months = Math.max(1, Number(process.env.CPU_PROFILE_MONTHS || 1));
const warmup = Math.max(0, Number(process.env.CPU_PROFILE_WARMUP || 0));
const topN = Math.max(10, Number(process.env.CPU_PROFILE_TOP || 30));

const session = new inspector.Session();
session.connect();
const post = promisify(session.post.bind(session));

function shortUrl(url = '') {
  const marker = '/economic-lab/';
  const index = url.lastIndexOf(marker);
  return index >= 0 ? url.slice(index + marker.length) : url;
}

function aggregateProfile(profile) {
  const byId = new Map(profile.nodes.map(node => [node.id, node]));
  const rows = new Map();
  const samples = profile.samples || [];
  const deltas = profile.timeDeltas || [];
  let totalMicros = 0;

  for (let i = 0; i < samples.length; i++) {
    const node = byId.get(samples[i]);
    if (!node) continue;
    const delta = Math.max(0, Number(deltas[i] || 0));
    totalMicros += delta;
    const frame = node.callFrame || {};
    const functionName = frame.functionName || '(anonymous)';
    const url = shortUrl(frame.url || '');
    const line = Number(frame.lineNumber ?? -1) + 1;
    const key = `${functionName}|${url}|${line}`;
    const row = rows.get(key) || {
      functionName,
      url,
      line,
      samples: 0,
      selfMicros: 0
    };
    row.samples += 1;
    row.selfMicros += delta;
    rows.set(key, row);
  }

  const sorted = [...rows.values()]
    .map(row => ({
      ...row,
      selfMs: row.selfMicros / 1000,
      share: totalMicros > 0 ? row.selfMicros / totalMicros : 0
    }))
    .sort((a, b) => b.selfMicros - a.selfMicros || a.functionName.localeCompare(b.functionName));

  return {
    totalMs: totalMicros / 1000,
    rows: sorted,
    economicLabRows: sorted.filter(row => row.url.includes('src/') || row.url.includes('scripts/'))
  };
}

try {
  const world = new EconomicWorld(`ECON-V10-CPU-${profileName}`, {
    scaleProfile: profileName,
    healthCheckInterval: 0
  });

  if (warmup) world.step(warmup);
  world.resetRuntimeMetrics();

  await post('Profiler.enable');
  await post('Profiler.setSamplingInterval', { interval: 250 });
  await post('Profiler.start');

  const start = globalThis.performance?.now?.() ?? Date.now();
  world.step(months);
  const wallMs = (globalThis.performance?.now?.() ?? Date.now()) - start;

  const { profile } = await post('Profiler.stop');
  await post('Profiler.disable');

  const aggregate = aggregateProfile(profile);
  const health = world.forceHealthCheck();
  const scale = world.scaleReport();
  const phase = world.profilingReport();

  const topAll = aggregate.rows.slice(0, topN).map(row => ({
    function: row.functionName,
    file: row.url,
    line: row.line,
    selfMs: Number(row.selfMs.toFixed(3)),
    sharePct: Number((row.share * 100).toFixed(2)),
    samples: row.samples
  }));
  const topEconomic = aggregate.economicLabRows.slice(0, topN).map(row => ({
    function: row.functionName,
    file: row.url,
    line: row.line,
    selfMs: Number(row.selfMs.toFixed(3)),
    sharePct: Number((row.share * 100).toFixed(2)),
    samples: row.samples
  }));

  console.log('CPU_PROFILE_SUMMARY');
  console.table([{
    profile: profileName,
    months,
    households: scale.initialPopulation.households,
    firms: scale.initialPopulation.firms,
    cognitiveAgents: scale.initialPopulation.cognitiveAgents,
    wallMs,
    sampledMs: aggregate.totalMs,
    phaseAttributedShare: phase.attributedShare,
    healthOk: health.ok
  }]);
  console.log('CPU_PROFILE_TOP_ALL');
  console.table(topAll);
  console.log('CPU_PROFILE_TOP_ECONOMIC_LAB');
  console.table(topEconomic);
  console.log(JSON.stringify({
    profile: profileName,
    months,
    wallMs,
    sampledMs: aggregate.totalMs,
    scale: scale.initialPopulation,
    healthOk: health.ok,
    topAll,
    topEconomic
  }, null, 2));

  if (!health.ok) process.exitCode = 1;
} finally {
  try { session.disconnect(); } catch {}
}
