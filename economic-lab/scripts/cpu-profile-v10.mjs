import inspector from 'node:inspector';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { EconomicWorld } from '../src/core/world-v10.js';

const profileName = process.argv[2] || 'x10';
const months = Math.max(1, Number(process.env.CPU_PROFILE_MONTHS || 1));
const warmup = Math.max(0, Number(process.env.CPU_PROFILE_WARMUP || 0));
const topN = Math.max(10, Number(process.env.CPU_PROFILE_TOP || 30));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;

const session = new inspector.Session();
session.connect();
const post = promisify(session.post.bind(session));

function shortUrl(url = '') {
  const marker = '/economic-lab/';
  const index = url.lastIndexOf(marker);
  return index >= 0 ? url.slice(index + marker.length) : url;
}

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

function compactRow(row) {
  return {
    function: row.functionName,
    file: row.url,
    line: row.line,
    selfMs: Number(row.selfMs.toFixed(3)),
    sharePct: Number((row.share * 100).toFixed(2)),
    samples: row.samples
  };
}

function sumMatching(rows, predicate) {
  const selected = rows.filter(predicate);
  const selfMs = selected.reduce((sum, row) => sum + Number(row.selfMs || 0), 0);
  const share = selected.reduce((sum, row) => sum + Number(row.share || 0), 0);
  return {
    selfMs: Number(selfMs.toFixed(3)),
    sharePct: Number((share * 100).toFixed(2)),
    samples: selected.reduce((sum, row) => sum + Number(row.samples || 0), 0),
    rows: selected.slice(0, 12).map(compactRow)
  };
}

try {
  const memoryBeforeConstruction = memorySnapshot();
  const constructionStart = globalThis.performance?.now?.() ?? Date.now();
  const world = new EconomicWorld(`ECON-V10-CPU-${profileName}`, {
    scaleProfile: profileName,
    healthCheckInterval: 0
  });
  const constructionMs = (globalThis.performance?.now?.() ?? Date.now()) - constructionStart;
  const memoryAfterConstruction = memorySnapshot();

  if (warmup) world.step(warmup);
  const memoryAfterWarmup = memorySnapshot();
  world.resetRuntimeMetrics();

  await post('Profiler.enable');
  await post('Profiler.setSamplingInterval', { interval: 250 });
  await post('Profiler.start');

  const start = globalThis.performance?.now?.() ?? Date.now();
  world.step(months);
  const wallMs = (globalThis.performance?.now?.() ?? Date.now()) - start;
  const memoryAfterMeasured = memorySnapshot();

  const { profile } = await post('Profiler.stop');
  await post('Profiler.disable');

  const aggregate = aggregateProfile(profile);
  const health = world.forceHealthCheck();
  const scale = world.scaleReport();
  const phase = world.profilingReport();

  const topAll = aggregate.rows.slice(0, topN).map(compactRow);
  const topEconomic = aggregate.economicLabRows.slice(0, topN).map(compactRow);
  const structuredClone = sumMatching(aggregate.rows, row =>
    row.functionName.toLowerCase().includes('structuredclone') || row.url.toLowerCase().includes('structured_clone')
  );
  const garbageCollection = sumMatching(aggregate.rows, row => {
    const fn = row.functionName.toLowerCase();
    const url = row.url.toLowerCase();
    return fn.includes('garbage collector') || fn.includes('(gc)') || url.includes('gc');
  });

  const result = {
    schemaVersion: 1,
    kind: 'economic-lab-v10-cpu-profile',
    generatedAt: new Date().toISOString(),
    node: process.version,
    profile: profileName,
    warmupMonths: warmup,
    measuredMonths: months,
    constructionMs,
    wallMs,
    sampledMs: aggregate.totalMs,
    scale: scale.initialPopulation,
    healthOk: health.ok,
    failures: health.failures,
    memory: {
      beforeConstruction: memoryBeforeConstruction,
      afterConstruction: memoryAfterConstruction,
      afterWarmup: memoryAfterWarmup,
      afterMeasured: memoryAfterMeasured,
      constructionDelta: memoryDelta(memoryAfterConstruction, memoryBeforeConstruction),
      warmupDelta: memoryDelta(memoryAfterWarmup, memoryAfterConstruction),
      measuredDelta: memoryDelta(memoryAfterMeasured, memoryAfterWarmup)
    },
    phaseProfiling: {
      attributedShare: phase.attributedShare,
      attributedMs: phase.attributedMs,
      unattributedMs: phase.unattributedMs,
      phases: phase.phases.slice(0, 20)
    },
    selectedHotspots: {
      structuredClone,
      garbageCollection
    },
    topAll,
    topEconomic
  };

  console.log('CPU_PROFILE_SUMMARY');
  console.table([{
    profile: profileName,
    warmup,
    months,
    households: scale.initialPopulation.households,
    firms: scale.initialPopulation.firms,
    cognitiveAgents: scale.initialPopulation.cognitiveAgents,
    constructionMs,
    wallMs,
    sampledMs: aggregate.totalMs,
    structuredClonePct: structuredClone.sharePct,
    garbageCollectionPct: garbageCollection.sharePct,
    heapUsedAfterMeasured: memoryAfterMeasured.heapUsed,
    phaseAttributedShare: phase.attributedShare,
    healthOk: health.ok
  }]);
  console.log('CPU_PROFILE_TOP_ALL');
  console.table(topAll);
  console.log('CPU_PROFILE_TOP_ECONOMIC_LAB');
  console.table(topEconomic);
  console.log(JSON.stringify(result, null, 2));

  if (outputJson) {
    mkdirSync(dirname(outputJson), { recursive: true });
    writeFileSync(outputJson, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(`PERFORMANCE_JSON ${outputJson}`);
  }

  if (!health.ok) process.exitCode = 1;
} finally {
  try { session.disconnect(); } catch {}
}
