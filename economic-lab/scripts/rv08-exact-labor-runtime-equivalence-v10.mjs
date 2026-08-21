import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';
import { clearLaborMarket, settlePayroll } from '../src/markets/labor-market.js';

const C = v => structuredClone(v);
const F = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const EPS = 1e-8;

function transformedSeeds() {
  return COUNTRY_SEEDS.map(s => ({ ...s, initialPrice: Math.max(EPS, F(s.initialWage, F(s.initialPrice, 1))) }));
}

function makeWorld(seed) {
  const old = COUNTRY_SEEDS.map(C);
  COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...transformedSeeds());
  try {
    return new EconomicWorld(seed, { scaleProfile: 'baseline', healthCheckInterval: 0 });
  } finally {
    COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...old);
  }
}

function enableExactRuntime(world) {
  for (const country of world.countries) {
    Object.defineProperty(country, '__diagnosticExactLaborRuntime', {
      value: true,
      writable: true,
      configurable: true,
      enumerable: false
    });
  }
}

function fingerprint(world) {
  const h = createHash('sha256');
  const put = value => h.update(JSON.stringify(value));
  put({ month: world.month, rng: world.rng });
  for (const country of world.countries) {
    put(country);
    put(world.accountingReport(country.id));
  }
  for (const entry of world.ledger.entries) put(entry);
  return h.digest('hex');
}

function runWorld(seed, months, fast) {
  const world = makeWorld(seed);
  if (fast) enableExactRuntime(world);
  const t0 = performance.now();
  for (let i = 0; i < months; i += 1) world.stepMonth();
  const elapsedMs = performance.now() - t0;
  const health = world.forceHealthCheck();
  assert.ok(health.ok, `health ${seed} fast=${fast}`);
  return { fingerprint: fingerprint(world), elapsedMs };
}

function stressPair(seed) {
  const slow = makeWorld(seed);
  const fast = makeWorld(seed);
  enableExactRuntime(fast);
  for (let i = 0; i < 4; i += 1) {
    slow.stepMonth();
    fast.stepMonth();
  }
  assert.equal(fingerprint(slow), fingerprint(fast), 'pre-stress worlds must match');

  const mutate = world => {
    for (const country of world.countries) {
      for (const h of country.households) {
        h.employed = false;
        h.employerId = null;
      }
      for (const f of country.firms) {
        f.workers = 0;
        f.desiredWorkers = f.active === false ? 0 : Math.max(2, Math.min(12, Math.round(F(f.desiredWorkers, 4) || 4)));
      }
    }
  };
  mutate(slow);
  mutate(fast);

  const runStress = world => {
    const t0 = performance.now();
    for (const country of world.countries) clearLaborMarket(country, world.rng);
    for (const country of world.countries) settlePayroll(country, world.ledger, world.month);
    return performance.now() - t0;
  };

  const slowMs = runStress(slow);
  const fastMs = runStress(fast);
  assert.equal(fingerprint(slow), fingerprint(fast), 'stress labor/payroll state must remain bit-exact');
  return { slowMs, fastMs, speedup: slowMs / Math.max(0.001, fastMs) };
}

const seeds = ['ECON-RV02-A', 'ECON-RV08-HOLDOUT-E'];
const rows = [];
for (const seed of seeds) {
  const slow = runWorld(seed, 8, false);
  const fast = runWorld(seed, 8, true);
  assert.equal(slow.fingerprint, fast.fingerprint, `world fingerprint mismatch: ${seed}`);
  const stress = stressPair(`${seed}-STRESS`);
  rows.push({
    seed,
    worldSlowMs: slow.elapsedMs,
    worldFastMs: fast.elapsedMs,
    worldSpeedup: slow.elapsedMs / Math.max(0.001, fast.elapsedMs),
    stressSlowMs: stress.slowMs,
    stressFastMs: stress.fastMs,
    stressSpeedup: stress.speedup
  });
}

console.table(rows.map(r => ({
  seed: r.seed,
  worldSlowMs: r.worldSlowMs.toFixed(1),
  worldFastMs: r.worldFastMs.toFixed(1),
  worldSpeedup: r.worldSpeedup.toFixed(2),
  stressSlowMs: r.stressSlowMs.toFixed(1),
  stressFastMs: r.stressFastMs.toFixed(1),
  stressSpeedup: r.stressSpeedup.toFixed(2)
})));
console.log('WP-RV08 exact diagnostic labor runtime equivalence: PASS');
