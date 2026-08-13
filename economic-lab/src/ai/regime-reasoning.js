import { clamp } from '../core/rng.js';

const REGIMES = ['normal', 'recession', 'inflation', 'overheating', 'credit_crisis', 'external_crisis'];

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function logistic(x) {
  return 1 / (1 + Math.exp(-x));
}

function normalize(scores) {
  const clean = {};
  let total = 0;
  for (const regime of REGIMES) {
    const value = Math.max(1e-6, finite(scores[regime], 0));
    clean[regime] = value;
    total += value;
  }
  for (const regime of REGIMES) clean[regime] /= total;
  return clean;
}

function entropy(probabilities) {
  let value = 0;
  for (const p of Object.values(probabilities || {})) {
    const q = Math.max(1e-12, finite(p));
    value -= q * Math.log(q);
  }
  return value / Math.log(REGIMES.length);
}

function regimeScores(observation) {
  const inflation = finite(observation.inflation);
  const unemployment = finite(observation.unemployment, 0.06);
  const demand = finite(observation.demandGrowth);
  const wageGrowth = finite(observation.wageGrowth);
  const credit = Math.max(0, finite(observation.creditStress));
  const external = Math.max(0, finite(observation.externalStress));
  const fx = finite(observation.exchangeRateChange);
  const inventory = finite(observation.inventoryPressure);
  const cashStress = Math.max(0, finite(observation.cashStress));

  const recessionSignal =
    Math.max(0, -demand) * 5.0 +
    Math.max(0, unemployment - 0.055) * 7.0 +
    Math.max(0, inventory) * 0.22 +
    cashStress * 0.24;
  const inflationSignal =
    Math.max(0, inflation - 0.018) * 8.5 +
    Math.max(0, wageGrowth - 0.015) * 3.0 +
    Math.max(0, demand) * 0.8;
  const overheatingSignal =
    Math.max(0, demand) * 4.1 +
    Math.max(0, 0.05 - unemployment) * 8.0 +
    Math.max(0, inflation - 0.02) * 3.2;
  const creditSignal =
    credit * 1.55 +
    Math.max(0, unemployment - 0.06) * 3.0 +
    cashStress * 0.30 +
    Math.max(0, -demand) * 1.2;
  const externalSignal =
    external * 1.65 +
    Math.max(0, fx) * 5.0 +
    Math.max(0, -demand) * 0.75;
  const calm =
    Math.abs(inflation - 0.02) * 3.5 +
    Math.abs(unemployment - 0.055) * 4.0 +
    Math.abs(demand) * 1.7 +
    credit * 0.65 +
    external * 0.65;

  return {
    normal: clamp(1.15 - calm, 0.06, 1.3),
    recession: 0.08 + logistic(recessionSignal - 0.65),
    inflation: 0.08 + logistic(inflationSignal - 0.60),
    overheating: 0.06 + logistic(overheatingSignal - 0.72),
    credit_crisis: 0.06 + logistic(creditSignal - 0.82),
    external_crisis: 0.06 + logistic(externalSignal - 0.80)
  };
}

function transitionTable() {
  const table = {};
  for (const from of REGIMES) {
    table[from] = {};
    for (const to of REGIMES) table[from][to] = 0;
  }
  return table;
}

export function ensureRegimeState(cognition) {
  if (!cognition.regime) {
    cognition.regime = {
      current: 'normal',
      confidence: 1 / REGIMES.length,
      uncertainty: 1,
      probabilities: normalize(Object.fromEntries(REGIMES.map(r => [r, 1]))),
      previous: null,
      changed: false,
      changeMagnitude: 0,
      transitionCounts: transitionTable(),
      history: []
    };
  }
  return cognition.regime;
}

export function inferRegime(cognition, observation, month) {
  const state = ensureRegimeState(cognition);
  const raw = normalize(regimeScores(observation));
  const previousProbabilities = state.probabilities || raw;
  const inertia = clamp(0.28 + finite(cognition.profile?.confirmationBias) * 0.22, 0.20, 0.42);
  const probabilities = {};
  for (const regime of REGIMES) {
    probabilities[regime] = raw[regime] * (1 - inertia) + finite(previousProbabilities[regime]) * inertia;
  }
  const normalized = normalize(probabilities);
  const ranking = Object.entries(normalized).sort((a, b) => b[1] - a[1]);
  const current = ranking[0][0];
  const confidence = ranking[0][1];
  const priorCurrent = state.current;
  const changed = Boolean(priorCurrent && current !== priorCurrent && confidence > 0.23);
  let changeMagnitude = 0;
  for (const regime of REGIMES) {
    changeMagnitude += Math.abs(finite(normalized[regime]) - finite(previousProbabilities[regime]));
  }
  changeMagnitude *= 0.5;

  if (priorCurrent && current) state.transitionCounts[priorCurrent][current] += 1;
  state.previous = priorCurrent;
  state.current = current;
  state.confidence = confidence;
  state.uncertainty = clamp(entropy(normalized), 0, 1);
  state.probabilities = normalized;
  state.changed = changed;
  state.changeMagnitude = changeMagnitude;
  state.history.push({
    month,
    current,
    confidence,
    uncertainty: state.uncertainty,
    probabilities: { ...normalized },
    changed,
    changeMagnitude
  });
  if (state.history.length > 36) state.history.shift();
  return state;
}

export function regimeRisk(cognition) {
  const state = ensureRegimeState(cognition);
  const p = state.probabilities;
  return clamp(
    finite(p.recession) * 0.55 +
    finite(p.credit_crisis) * 0.92 +
    finite(p.external_crisis) * 0.82 +
    finite(p.inflation) * 0.30 +
    finite(p.overheating) * 0.18,
    0,
    1
  );
}

export function regimeSummary(agent) {
  const state = agent?.cognition?.regime;
  if (!state) return null;
  return {
    current: state.current,
    previous: state.previous,
    confidence: state.confidence,
    uncertainty: state.uncertainty,
    changed: state.changed,
    changeMagnitude: state.changeMagnitude,
    probabilities: { ...state.probabilities }
  };
}

export { REGIMES };
