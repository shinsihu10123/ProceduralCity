export * from './episodic-reasoning-base-v10.js';

import { clamp } from '../core/rng.js';

const EPS = 1e-9;
const COMPARABLE_KEYS = [
  'inflation', 'unemployment', 'demandGrowth', 'wageGrowth',
  'externalStress', 'creditStress', 'policyRate', 'exchangeRateChange',
  'cashStress', 'inventoryPressure'
];

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function distance(query, observation) {
  let total = 0;
  let count = 0;
  for (const key of COMPARABLE_KEYS) {
    if (!Number.isFinite(Number(query?.[key])) || !Number.isFinite(Number(observation?.[key]))) continue;
    const scale = key === 'unemployment' || key === 'policyRate'
      ? 10
      : key === 'creditStress' || key === 'externalStress'
        ? 1.5
        : key === 'exchangeRateChange'
          ? 8
          : 6;
    total += Math.min(2.5, Math.abs(finite(query[key]) - finite(observation[key])) * scale);
    count += 1;
  }
  return count ? total / count : Infinity;
}

function querySignature(query, currentMonth) {
  let signature = String(currentMonth);
  for (const key of COMPARABLE_KEYS) {
    const value = Number(query?.[key]);
    signature += Number.isFinite(value) ? `|${key}:${value}` : `|${key}:_`;
  }
  return signature;
}

function buildRanking(episodes, query, currentMonth) {
  const ranked = [];
  for (const ep of episodes) {
    if (!(Number(ep.month) < currentMonth) || !ep.outcome || typeof ep.outcome !== 'object') continue;
    const d = distance(query, ep.observation || {});
    const salience = clamp(finite(ep.attention?.salience), 0, 1.5);
    const recency = Number.isFinite(currentMonth) ? 1 / (1 + Math.max(0, currentMonth - Number(ep.month || 0)) * 0.035) : 1;
    const similarity = Number.isFinite(d) ? (1 / (1 + d)) * (1 + salience * 0.12) * recency : 0;
    if (similarity > 0) ranked.push({ ep, similarity });
  }
  ranked.sort((a, b) => b.similarity - a.similarity);
  return ranked;
}

function rankedAnalogies(agent, query) {
  const cognition = agent?.cognition;
  const episodes = cognition?.memory?.episodes || [];
  const currentMonth = Number(query?.month ?? Infinity);

  // The simulation always reasons with a finite current month. Keep the legacy
  // uncached behavior for generic external calls that do not provide one.
  if (!cognition || !Number.isFinite(currentMonth)) return buildRanking(episodes, query, currentMonth);

  const signature = querySignature(query, currentMonth);
  const cache = cognition.__analogyRankingCache;
  if (cache && cache.signature === signature && cache.episodeCount === episodes.length) return cache.ranked;

  const ranked = buildRanking(episodes, query, currentMonth);
  const next = { signature, episodeCount: episodes.length, ranked };
  if (Object.prototype.hasOwnProperty.call(cognition, '__analogyRankingCache')) {
    cognition.__analogyRankingCache = next;
  } else {
    Object.defineProperty(cognition, '__analogyRankingCache', {
      value: next,
      enumerable: false,
      configurable: true,
      writable: true
    });
  }
  return ranked;
}

export function retrieveAnalogies(agent, query, limit = 3) {
  const ranked = rankedAnalogies(agent, query);
  const count = Math.min(ranked.length, Math.max(1, limit));
  const result = new Array(count);
  for (let i = 0; i < count; i++) {
    const { ep, similarity } = ranked[i];
    result[i] = {
      month: ep.month,
      similarity,
      topHypothesis: ep.topHypothesis?.name || null,
      observation: { ...(ep.observation || {}) },
      outcome: { ...(ep.outcome || {}) },
      decision: ep.decision || null,
      reward: finite(ep.reward, 0)
    };
  }
  return result;
}

export function analogicalForecast(agent, target, query, fallback = 0, limit = 4) {
  const analogies = retrieveAnalogies(agent, query, limit).filter(x => Number.isFinite(Number(x.outcome?.[target])));
  if (!analogies.length) return { value: finite(fallback), confidence: 0, analogies: [] };
  const totalWeight = analogies.reduce((sum, row) => sum + row.similarity, 0);
  if (totalWeight <= EPS) return { value: finite(fallback), confidence: 0, analogies };
  const value = analogies.reduce((sum, row) => sum + row.similarity * finite(row.outcome[target]), 0) / totalWeight;
  const dispersion = Math.sqrt(
    analogies.reduce((sum, row) => sum + row.similarity * (finite(row.outcome[target]) - value) ** 2, 0) / totalWeight
  );
  const confidence = clamp((totalWeight / Math.max(1, analogies.length)) * (1 / (1 + dispersion * 5)), 0, 1);
  return { value, confidence, analogies };
}
