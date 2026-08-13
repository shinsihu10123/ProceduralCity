import { clamp } from '../core/rng.js';

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function ensureLedger(agent) {
  const cognition = agent?.cognition;
  if (!cognition?.enabled) return null;
  if (!cognition.hypothesisLedger) cognition.hypothesisLedger = {};
  return cognition.hypothesisLedger;
}

function getEntry(agent, name) {
  const ledger = ensureLedger(agent);
  if (!ledger) return null;
  if (!ledger[name]) {
    ledger[name] = {
      tests: 0,
      successes: 0,
      failures: 0,
      softScore: 0.5,
      reliability: 0.5,
      lastScore: 0.5,
      lastMonth: null
    };
  }
  return ledger[name];
}

function directionScore(condition, strength = 1) {
  if (condition === true) return clamp(0.65 + strength * 0.30, 0.5, 1);
  if (condition === false) return clamp(0.35 - strength * 0.30, 0, 0.5);
  return 0.5;
}

function evaluate(name, observation, outcome) {
  const demand = finite(outcome.demandGrowth);
  const priorDemand = finite(observation.demandGrowth);
  const unemployment = finite(outcome.unemployment);
  const priorUnemployment = finite(observation.unemployment);
  const inflation = finite(outcome.inflation);
  const wageGrowth = finite(outcome.wageGrowth);
  const credit = finite(outcome.creditStress);
  const priorCredit = finite(observation.creditStress);
  const external = finite(outcome.externalStress);
  const priorExternal = finite(observation.externalStress);
  const cashStress = finite(outcome.cashStress);
  const incomeGrowth = finite(outcome.incomeGrowth);
  const inventoryPressure = finite(outcome.inventoryPressure);

  switch (name) {
    case '수요 약화': {
      const demandWeak = demand < -0.005 || demand < priorDemand - 0.01;
      const laborWeak = unemployment > priorUnemployment + 0.002;
      return clamp((directionScore(demandWeak, Math.min(1, Math.abs(demand) * 4)) * 0.65) + (directionScore(laborWeak, Math.min(1, Math.abs(unemployment - priorUnemployment) * 10)) * 0.35), 0, 1);
    }
    case '비용·물가 압력': {
      const pricePressure = inflation > 0.012;
      const wagePressure = wageGrowth > 0.008;
      return clamp(directionScore(pricePressure, Math.min(1, Math.max(0, inflation) * 8)) * 0.65 + directionScore(wagePressure, Math.min(1, Math.max(0, wageGrowth) * 6)) * 0.35, 0, 1);
    }
    case '신용 경색': {
      const stress = credit > Math.max(0.18, priorCredit + 0.02);
      const demandHit = demand < 0;
      return clamp(directionScore(stress, Math.min(1, credit)) * 0.68 + directionScore(demandHit, Math.min(1, Math.abs(demand) * 3)) * 0.32, 0, 1);
    }
    case '대외 충격': {
      const stress = external > Math.max(0.18, priorExternal + 0.02);
      const demandHit = demand < 0;
      return clamp(directionScore(stress, Math.min(1, external)) * 0.72 + directionScore(demandHit, Math.min(1, Math.abs(demand) * 3)) * 0.28, 0, 1);
    }
    case '경기 회복': {
      const demandUp = demand > 0.006;
      const laborImproves = unemployment < priorUnemployment - 0.001;
      return clamp(directionScore(demandUp, Math.min(1, Math.max(0, demand) * 4)) * 0.68 + directionScore(laborImproves, Math.min(1, Math.abs(unemployment - priorUnemployment) * 10)) * 0.32, 0, 1);
    }
    case '기업 유동성 스트레스': {
      const stress = cashStress > 0.45;
      const inventory = inventoryPressure > 0.20;
      return clamp(directionScore(stress, Math.min(1, cashStress)) * 0.75 + directionScore(inventory, Math.min(1, Math.max(0, inventoryPressure))) * 0.25, 0, 1);
    }
    case '가계 소득불안': {
      const incomeWeak = incomeGrowth < -0.01;
      const laborWeak = unemployment > priorUnemployment + 0.002;
      return clamp(directionScore(incomeWeak, Math.min(1, Math.abs(Math.min(0, incomeGrowth)) * 5)) * 0.72 + directionScore(laborWeak, Math.min(1, Math.abs(unemployment - priorUnemployment) * 10)) * 0.28, 0, 1);
    }
    default:
      return 0.5;
  }
}

export function applyHypothesisReliability(agent) {
  const cognition = agent?.cognition;
  if (!cognition?.enabled || !Array.isArray(cognition.hypotheses)) return [];
  const adjusted = cognition.hypotheses.map(h => {
    const entry = getEntry(agent, h.name);
    const reliability = entry?.reliability ?? 0.5;
    const evidenceWeight = clamp((entry?.tests || 0) / 10, 0, 1);
    const calibratedConfidence = clamp(
      finite(h.confidence) * (1 - 0.32 * evidenceWeight) + reliability * 0.32 * evidenceWeight,
      0,
      1
    );
    return {
      ...h,
      rawConfidence: finite(h.confidence),
      confidence: calibratedConfidence,
      learnedReliability: reliability,
      hypothesisTests: entry?.tests || 0
    };
  }).sort((a, b) => b.confidence - a.confidence);
  cognition.hypotheses = adjusted;
  return adjusted;
}

export function evaluateCurrentHypotheses(agent, observation, outcome, month) {
  const cognition = agent?.cognition;
  if (!cognition?.enabled || !Array.isArray(cognition.hypotheses)) return [];
  const results = [];
  for (const hypothesis of cognition.hypotheses) {
    const entry = getEntry(agent, hypothesis.name);
    const score = evaluate(hypothesis.name, observation || {}, outcome || {});
    entry.tests += 1;
    entry.lastScore = score;
    entry.lastMonth = month;
    if (score >= 0.58) entry.successes += 1;
    else if (score <= 0.42) entry.failures += 1;
    const alpha = 1 + entry.successes + entry.softScore * Math.max(0, entry.tests - entry.successes - entry.failures);
    const beta = 1 + entry.failures + (1 - entry.softScore) * Math.max(0, entry.tests - entry.successes - entry.failures);
    entry.softScore += (score - entry.softScore) / entry.tests;
    const empirical = alpha / Math.max(1e-9, alpha + beta);
    entry.reliability = clamp(empirical * 0.55 + entry.softScore * 0.45, 0.05, 0.95);
    results.push({ name: hypothesis.name, score, reliability: entry.reliability, tests: entry.tests });
  }
  const episode = cognition.memory?.episodes?.findLast?.(ep => Number(ep.month) === Number(month));
  if (episode) episode.hypothesisEvaluation = results.map(x => ({ ...x }));
  return results;
}

export function hypothesisSummary(agent) {
  const ledger = ensureLedger(agent) || {};
  return Object.entries(ledger)
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.tests - a.tests || b.reliability - a.reliability)
    .slice(0, 8);
}
