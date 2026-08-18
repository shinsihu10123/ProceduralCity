import assert from 'node:assert/strict';
import { clamp } from '../src/core/rng.js';
import { retrieveAnalogies } from '../src/ai/episodic-reasoning.js';

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function comparableKeys(a, b) {
  return [
    'inflation', 'unemployment', 'demandGrowth', 'wageGrowth',
    'externalStress', 'creditStress', 'policyRate', 'exchangeRateChange',
    'cashStress', 'inventoryPressure'
  ].filter(key => Number.isFinite(Number(a?.[key])) && Number.isFinite(Number(b?.[key])));
}

function distance(query, observation) {
  const keys = comparableKeys(query, observation);
  if (!keys.length) return Infinity;
  let total = 0;
  for (const key of keys) {
    const scale = key === 'unemployment' || key === 'policyRate'
      ? 10
      : key === 'creditStress' || key === 'externalStress'
        ? 1.5
        : key === 'exchangeRateChange'
          ? 8
          : 6;
    total += Math.min(2.5, Math.abs(finite(query[key]) - finite(observation[key])) * scale);
  }
  return total / keys.length;
}

function legacyRetrieveAnalogies(agent, query, limit = 3) {
  const episodes = agent?.cognition?.memory?.episodes || [];
  const currentMonth = Number(query?.month ?? Infinity);
  return episodes
    .filter(ep => Number(ep.month) < currentMonth && ep.outcome && typeof ep.outcome === 'object')
    .map(ep => {
      const d = distance(query, ep.observation || {});
      const salience = clamp(finite(ep.attention?.salience), 0, 1.5);
      const recency = Number.isFinite(currentMonth) ? 1 / (1 + Math.max(0, currentMonth - Number(ep.month || 0)) * 0.035) : 1;
      const similarity = Number.isFinite(d) ? (1 / (1 + d)) * (1 + salience * 0.12) * recency : 0;
      return {
        month: ep.month,
        similarity,
        topHypothesis: ep.topHypothesis?.name || null,
        observation: { ...(ep.observation || {}) },
        outcome: { ...(ep.outcome || {}) },
        decision: ep.decision || null,
        reward: finite(ep.reward, 0)
      };
    })
    .filter(x => x.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, Math.max(1, limit));
}

const episodes = [
  {
    month: 1,
    attention: { salience: 0.2 },
    observation: { inflation: 0.02, unemployment: 0.06, demandGrowth: 0.01, wageGrowth: 0.01, cashStress: 0.2 },
    outcome: { inflation: 0.021, unemployment: 0.058, incomeGrowth: 0.012 },
    topHypothesis: { name: '경기 회복' },
    decision: '소비 유지',
    reward: 0.4
  },
  {
    month: 2,
    attention: { salience: 0.8 },
    observation: { inflation: 0.055, unemployment: 0.09, demandGrowth: -0.04, wageGrowth: 0.02, externalStress: 0.3, creditStress: 0.25 },
    outcome: { inflation: 0.061, unemployment: 0.102, incomeGrowth: -0.025 },
    topHypothesis: { name: '신용 경색' },
    decision: '유동성 방어',
    reward: -0.2
  },
  {
    month: 3,
    attention: { salience: 1.1 },
    observation: { inflation: 0.041, unemployment: 0.075, demandGrowth: -0.015, wageGrowth: 0.012, externalStress: 0.15, creditStress: 0.12 },
    outcome: { inflation: 0.039, unemployment: 0.078, incomeGrowth: -0.004 },
    topHypothesis: { name: '수요 약화' },
    decision: '소비 절제',
    reward: 0.05
  },
  {
    month: 4,
    attention: { salience: 0.4 },
    observation: { inflation: 0.028, unemployment: 0.064, demandGrowth: 0.008, wageGrowth: 0.009, externalStress: 0.04, creditStress: 0.05 },
    outcome: { inflation: 0.026, unemployment: 0.061, incomeGrowth: 0.01 },
    topHypothesis: { name: '경기 회복' },
    decision: '소비 유지',
    reward: 0.3
  },
  {
    month: 5,
    attention: { salience: 0.9 },
    observation: { inflation: 0.03, unemployment: 0.068, demandGrowth: -0.005 },
    outcome: null,
    topHypothesis: { name: '수요 약화' },
    decision: '소비 절제'
  }
];

const agent = { cognition: { memory: { episodes } } };
const query = {
  month: 6,
  inflation: 0.032,
  unemployment: 0.066,
  demandGrowth: 0.004,
  wageGrowth: 0.01,
  externalStress: 0.06,
  creditStress: 0.07,
  cashStress: 0.22
};

for (const limit of [1, 2, 3, 4, 8]) {
  const expected = legacyRetrieveAnalogies(agent, query, limit);
  const actual = retrieveAnalogies(agent, query, limit);
  assert.deepStrictEqual(actual, expected, `optimized analogy retrieval diverged at limit=${limit}`);
}

const independent = retrieveAnalogies(agent, query, 3);
assert.ok(independent.length > 0, 'expected at least one analogy');
const source = episodes.find(ep => ep.month === independent[0].month);
assert.notStrictEqual(independent[0].observation, source.observation, 'returned observation must remain an independent snapshot');
assert.notStrictEqual(independent[0].outcome, source.outcome, 'returned outcome must remain an independent snapshot');
const sourceInflation = source.observation.inflation;
const sourceOutcomeInflation = source.outcome.inflation;
independent[0].observation.inflation = 999;
independent[0].outcome.inflation = 999;
assert.equal(source.observation.inflation, sourceInflation, 'mutating returned observation must not mutate episodic memory');
assert.equal(source.outcome.inflation, sourceOutcomeInflation, 'mutating returned outcome must not mutate episodic memory');

console.log('Economic Lab v0.10 episodic analogy allocation semantic gate PASS');
