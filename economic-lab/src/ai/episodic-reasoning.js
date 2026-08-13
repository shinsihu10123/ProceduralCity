import { clamp } from '../core/rng.js';

const EPS = 1e-9;

const DEFAULT_LINKS = [
  { id: 'demand_to_unemployment', cause: 'demandGrowth', effect: 'unemployment', coefficient: -0.26, confidence: 0.34, min: -2.5, max: 0.2 },
  { id: 'demand_to_wages', cause: 'demandGrowth', effect: 'wageGrowth', coefficient: 0.18, confidence: 0.28, min: -0.2, max: 2.2 },
  { id: 'demand_to_inflation', cause: 'demandGrowth', effect: 'inflation', coefficient: 0.11, confidence: 0.24, min: -0.6, max: 1.8 },
  { id: 'inflation_to_demand', cause: 'inflation', effect: 'demandGrowth', coefficient: -0.17, confidence: 0.25, min: -2.8, max: 0.4 },
  { id: 'unemployment_to_demand', cause: 'unemployment', effect: 'demandGrowth', coefficient: -0.24, confidence: 0.28, min: -2.8, max: 0.4 },
  { id: 'credit_to_demand', cause: 'creditStress', effect: 'demandGrowth', coefficient: -0.22, confidence: 0.30, min: -2.5, max: 0.2 },
  { id: 'external_to_demand', cause: 'externalStress', effect: 'demandGrowth', coefficient: -0.18, confidence: 0.26, min: -2.5, max: 0.2 },
  { id: 'policy_to_demand', cause: 'policyRate', effect: 'demandGrowth', coefficient: -0.34, confidence: 0.22, min: -4.0, max: 0.1 },
  { id: 'policy_to_inflation', cause: 'policyRate', effect: 'inflation', coefficient: -0.20, confidence: 0.20, min: -3.0, max: 0.1 },
  { id: 'policy_to_credit', cause: 'policyRate', effect: 'creditStress', coefficient: 0.22, confidence: 0.22, min: -0.4, max: 3.5 },
  { id: 'credit_to_defaults', cause: 'creditStress', effect: 'creditDefaultRate', coefficient: 0.12, confidence: 0.26, min: -0.1, max: 2.8 },
  { id: 'external_to_defaults', cause: 'externalStress', effect: 'creditDefaultRate', coefficient: 0.08, confidence: 0.18, min: -0.1, max: 2.4 },
  { id: 'unemployment_to_defaults', cause: 'unemployment', effect: 'creditDefaultRate', coefficient: 0.16, confidence: 0.22, min: -0.2, max: 3.0 },
  { id: 'unemployment_to_income', cause: 'unemployment', effect: 'incomeGrowth', coefficient: -0.28, confidence: 0.30, min: -3.0, max: 0.2 },
  { id: 'inflation_to_income', cause: 'inflation', effect: 'incomeGrowth', coefficient: -0.10, confidence: 0.18, min: -2.0, max: 0.4 },
  { id: 'external_to_credit', cause: 'externalStress', effect: 'creditStress', coefficient: 0.16, confidence: 0.20, min: -0.2, max: 2.5 },
  { id: 'fx_to_external', cause: 'exchangeRateChange', effect: 'externalStress', coefficient: 0.45, confidence: 0.20, min: -2.0, max: 4.0 },
  { id: 'current_account_to_external', cause: 'currentAccountWXU', effect: 'externalStress', coefficient: -0.0008, confidence: 0.14, min: -0.05, max: 0.05 }
];

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSignal(key, value) {
  const v = finite(value);
  if (key === 'unemployment') return v - 0.06;
  if (key === 'policyRate') return v - 0.04;
  if (key === 'creditStress' || key === 'externalStress') return v;
  if (key === 'currentAccountWXU') return clamp(v / 100, -2, 2);
  return v;
}

export function ensureCausalModel(agent) {
  const cognition = agent?.cognition;
  if (!cognition?.enabled) return null;
  if (!cognition.causalModel) {
    cognition.causalModel = {
      links: DEFAULT_LINKS.map(link => ({ ...link, observations: 0, meanAbsError: 0, lastError: 0 })),
      updates: 0
    };
  } else {
    const existing = new Set(cognition.causalModel.links.map(link => link.id));
    for (const link of DEFAULT_LINKS) {
      if (!existing.has(link.id)) cognition.causalModel.links.push({ ...link, observations: 0, meanAbsError: 0, lastError: 0 });
    }
  }
  return cognition.causalModel;
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

export function retrieveAnalogies(agent, query, limit = 3) {
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

export function analogicalForecast(agent, target, query, fallback = 0, limit = 4) {
  const analogies = retrieveAnalogies(agent, query, limit).filter(x => Number.isFinite(Number(x.outcome?.[target])));
  if (!analogies.length) return { value: finite(fallback), confidence: 0, analogies: [] };
  const totalWeight = analogies.reduce((s, x) => s + x.similarity, 0);
  if (totalWeight <= EPS) return { value: finite(fallback), confidence: 0, analogies };
  const value = analogies.reduce((s, x) => s + x.similarity * finite(x.outcome[target]), 0) / totalWeight;
  const dispersion = Math.sqrt(analogies.reduce((s, x) => s + x.similarity * (finite(x.outcome[target]) - value) ** 2, 0) / totalWeight);
  const confidence = clamp((totalWeight / Math.max(1, analogies.length)) * (1 / (1 + dispersion * 5)), 0, 1);
  return { value, confidence, analogies };
}

export function causalExplanations(agent, target, observation = null, limit = 5) {
  const model = ensureCausalModel(agent);
  if (!model) return [];
  const obs = observation || agent.cognition?.lastObservation || {};
  return model.links
    .filter(link => link.effect === target && Number.isFinite(Number(obs?.[link.cause])))
    .map(link => {
      const signal = normalizeSignal(link.cause, obs[link.cause]);
      const contribution = link.coefficient * signal;
      return {
        linkId: link.id,
        cause: link.cause,
        effect: link.effect,
        coefficient: link.coefficient,
        confidence: link.confidence,
        contribution,
        evidence: finite(obs[link.cause]),
        observations: link.observations,
        meanAbsError: link.meanAbsError
      };
    })
    .sort((a, b) => Math.abs(b.contribution) * b.confidence - Math.abs(a.contribution) * a.confidence)
    .slice(0, Math.max(1, limit));
}

export function causalForecast(agent, target, observation = null, fallback = 0) {
  const explanations = causalExplanations(agent, target, observation, 12);
  if (!explanations.length) return { value: finite(fallback), confidence: 0, explanations: [] };
  let weighted = 0;
  let confidenceWeight = 0;
  for (const x of explanations) {
    weighted += x.contribution * x.confidence;
    confidenceWeight += x.confidence;
  }
  const contribution = confidenceWeight > EPS ? weighted / confidenceWeight : 0;
  const confidence = clamp(confidenceWeight / Math.max(1, explanations.length), 0, 1);
  return { value: finite(fallback) + contribution, confidence, explanations };
}

export function learnCausalModel(agent, causeObservation, actualOutcome) {
  const cognition = agent?.cognition;
  const model = ensureCausalModel(agent);
  if (!cognition || !model || !causeObservation || !actualOutcome) return [];
  const updates = [];
  const learningRate = clamp(finite(cognition.profile?.learningRate, 0.10), 0.03, 0.22);

  for (const link of model.links) {
    const causeRaw = Number(causeObservation?.[link.cause]);
    const effectRaw = Number(actualOutcome?.[link.effect]);
    if (!Number.isFinite(causeRaw) || !Number.isFinite(effectRaw)) continue;
    const cause = normalizeSignal(link.cause, causeRaw);
    const effect = normalizeSignal(link.effect, effectRaw);
    if (Math.abs(cause) < 1e-7) continue;
    const predicted = link.coefficient * cause;
    const error = effect - predicted;
    const step = learningRate * error * cause / (0.015 + cause * cause);
    const old = link.coefficient;
    link.coefficient = clamp(old + step, link.min, link.max);
    link.observations += 1;
    link.lastError = error;
    link.meanAbsError += (Math.abs(error) - link.meanAbsError) / link.observations;
    const accuracy = 1 / (1 + link.meanAbsError * 5);
    link.confidence = clamp(link.confidence * 0.94 + accuracy * 0.06, 0.05, 0.98);
    updates.push({ linkId: link.id, oldCoefficient: old, newCoefficient: link.coefficient, error, confidence: link.confidence });
  }
  model.updates += updates.length;
  return updates;
}

export function attachEpisodeOutcome(agent, month, outcome, reward = null) {
  const episodes = agent?.cognition?.memory?.episodes || [];
  if (!episodes.length) return null;
  let episode = null;
  for (let i = episodes.length - 1; i >= 0; i--) {
    if (Number(episodes[i].month) === Number(month)) {
      episode = episodes[i];
      break;
    }
  }
  if (!episode) episode = episodes[episodes.length - 1];
  episode.outcome = { ...(outcome || {}) };
  if (reward !== null && Number.isFinite(Number(reward))) episode.reward = finite(reward);
  const lastDecision = agent.cognition?.decisions?.[agent.cognition.decisions.length - 1];
  if (lastDecision && Number(lastDecision.month) === Number(month)) episode.decision = lastDecision.selected;
  return episode;
}

export function summarizeMemory(agent) {
  const episodes = agent?.cognition?.memory?.episodes || [];
  const resolved = episodes.filter(x => x.outcome);
  const causal = ensureCausalModel(agent);
  return {
    episodes: episodes.length,
    resolvedEpisodes: resolved.length,
    causalUpdates: causal?.updates || 0,
    strongestLinks: (causal?.links || [])
      .slice()
      .sort((a, b) => b.confidence * Math.abs(b.coefficient) - a.confidence * Math.abs(a.coefficient))
      .slice(0, 5)
      .map(x => ({ id: x.id, coefficient: x.coefficient, confidence: x.confidence, observations: x.observations }))
  };
}
