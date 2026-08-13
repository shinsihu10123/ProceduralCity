import { clamp } from '../core/rng.js';

const EPS = 1e-9;
const MAX_EPISODES = 48;
const MAX_FORECAST_HISTORY = 96;
const MAX_DECISIONS = 48;

const MODEL_BOUNDS = {
  demandPersistence: [-0.2, 1.25],
  priceElasticity: [-4.5, -0.05],
  incomeSensitivity: [0.05, 2.5],
  inflationPersistence: [-0.1, 1.15],
  wagePersistence: [-0.1, 1.15],
  unemploymentPersistence: [0, 1.2],
  costPassThrough: [0.05, 1.5],
  rateDemandTransmission: [-3.5, -0.02],
  rateInflationTransmission: [-2.5, -0.01],
  fiscalDemandMultiplier: [0.1, 2.2],
  fiscalInflationMultiplier: [0, 1.4],
  creditRiskCalibration: [0.35, 2.5],
  externalRiskSensitivity: [0.2, 3.0]
};

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function profileFor(agent, rng) {
  const kind = agent.kind || 'agent';
  const baseHorizon = kind === 'central_bank' || kind === 'government' ? 12 : kind === 'bank' ? 6 : kind === 'firm' ? 6 : 3;
  const baseBudget = kind === 'central_bank' || kind === 'government' ? 5 : kind === 'bank' ? 4 : kind === 'firm' ? 4 : 3;
  return {
    learningRate: clamp(0.10 + rng.normal(0, 0.025), 0.04, 0.20),
    beliefRecency: clamp(0.26 + rng.normal(0, 0.055), 0.12, 0.46),
    exploration: clamp(0.055 + rng.normal(0, 0.018), 0.01, 0.12),
    confirmationBias: clamp(0.18 + rng.normal(0, 0.07), 0.02, 0.42),
    planningHorizon: Math.max(1, Math.round(baseHorizon * clamp(rng.normal(1, 0.16), 0.6, 1.45))),
    complexityBudget: Math.max(2, Math.round(baseBudget * clamp(rng.normal(1, 0.13), 0.7, 1.35))),
    structuralUncertainty: clamp(0.18 + rng.normal(0, 0.05), 0.06, 0.40)
  };
}

function initialModel(agent, rng) {
  const kind = agent.kind || 'agent';
  return {
    demandPersistence: clamp(0.56 + rng.normal(0, 0.12), 0.18, 0.88),
    priceElasticity: clamp(-1.15 + rng.normal(0, 0.28), -2.1, -0.42),
    incomeSensitivity: clamp(0.78 + rng.normal(0, 0.16), 0.35, 1.25),
    inflationPersistence: clamp(0.58 + rng.normal(0, 0.12), 0.20, 0.88),
    wagePersistence: clamp(0.52 + rng.normal(0, 0.13), 0.16, 0.86),
    unemploymentPersistence: clamp(0.68 + rng.normal(0, 0.10), 0.30, 0.92),
    costPassThrough: clamp(0.58 + rng.normal(0, 0.13), 0.22, 0.96),
    rateDemandTransmission: clamp(-0.62 + rng.normal(0, 0.18), -1.25, -0.18),
    rateInflationTransmission: clamp(-0.34 + rng.normal(0, 0.12), -0.82, -0.08),
    fiscalDemandMultiplier: clamp(0.84 + rng.normal(0, 0.20), 0.32, 1.45),
    fiscalInflationMultiplier: clamp(0.28 + rng.normal(0, 0.10), 0.06, 0.62),
    creditRiskCalibration: clamp(1 + rng.normal(0, 0.14), 0.65, 1.45),
    externalRiskSensitivity: clamp(1 + rng.normal(0, 0.18), 0.55, 1.65),
    kind
  };
}

function beliefSeed(value, uncertainty = 0.25) {
  return {
    mean: finite(value),
    uncertainty: clamp(uncertainty, 0.02, 1.5),
    observations: 0,
    lastError: 0
  };
}

export function ensureCognition(agent, rng) {
  if (agent.cognition?.version === '0.9') return agent.cognition;
  const profile = profileFor(agent, rng);
  agent.cognition = {
    version: '0.9',
    enabled: true,
    profile,
    attention: { level: 1, salience: 0, trigger: 'baseline', lastLevelChangeMonth: 0 },
    memory: { episodes: [], summaries: {} },
    beliefs: {
      inflation: beliefSeed(agent.beliefs?.inflation ?? 0.02, 0.18),
      unemployment: beliefSeed(agent.beliefs?.jobRisk ?? 0.07, 0.22),
      demandGrowth: beliefSeed(agent.beliefs?.demandGrowth ?? 0.01, 0.24),
      wageGrowth: beliefSeed(0, 0.22),
      incomeGrowth: beliefSeed(agent.beliefs?.incomeGrowth ?? 0, 0.25),
      externalStress: beliefSeed(0, 0.28),
      creditStress: beliefSeed(0, 0.26)
    },
    worldModel: initialModel(agent, rng),
    hypotheses: [],
    pendingForecasts: [],
    forecastHistory: [],
    calibration: {},
    strategyStats: {},
    decisions: [],
    lastObservation: null,
    lastReasoning: null
  };
  return agent.cognition;
}

function observationDistance(current, previous) {
  if (!previous) return 0;
  let sum = 0;
  let count = 0;
  for (const key of ['inflation', 'unemployment', 'demandGrowth', 'wageGrowth', 'externalStress', 'creditStress']) {
    const a = finite(current[key]);
    const b = finite(previous[key]);
    sum += Math.min(1, Math.abs(a - b) * (key === 'unemployment' ? 8 : 12));
    count += 1;
  }
  return count ? sum / count : 0;
}

function updateBelief(cognition, key, observed, observationNoise = 0.14) {
  if (!Number.isFinite(Number(observed))) return;
  if (!cognition.beliefs[key]) cognition.beliefs[key] = beliefSeed(observed, 0.3);
  const b = cognition.beliefs[key];
  const prior = finite(b.mean);
  const uncertainty = clamp(finite(b.uncertainty, 0.25), 0.02, 1.5);
  const surprise = finite(observed) - prior;
  const recency = cognition.profile.beliefRecency;
  const confirmation = cognition.profile.confirmationBias;
  const contradicts = Math.sign(prior) !== 0 && Math.sign(surprise) !== Math.sign(prior);
  const confirmationDiscount = contradicts ? 1 - confirmation * 0.45 : 1;
  const gain = clamp(recency * confirmationDiscount * (uncertainty / (uncertainty + observationNoise)), 0.04, 0.48);
  b.mean = prior + gain * surprise;
  b.lastError = surprise;
  b.observations += 1;
  b.uncertainty = clamp(
    uncertainty * (0.94 - gain * 0.18) + Math.min(0.45, Math.abs(surprise) * 0.9) * 0.08,
    0.025,
    1.2
  );
}

function generateHypotheses(agent, observation) {
  const c = agent.cognition;
  const previous = c.lastObservation;
  const changes = {
    inflation: previous ? finite(observation.inflation) - finite(previous.inflation) : 0,
    unemployment: previous ? finite(observation.unemployment) - finite(previous.unemployment) : 0,
    demandGrowth: previous ? finite(observation.demandGrowth) - finite(previous.demandGrowth) : 0,
    externalStress: previous ? finite(observation.externalStress) - finite(previous.externalStress) : 0,
    creditStress: previous ? finite(observation.creditStress) - finite(previous.creditStress) : 0
  };
  const hypotheses = [];
  const add = (name, confidence, evidence, causalClaim) => hypotheses.push({
    name,
    confidence: clamp(confidence, 0, 1),
    evidence,
    causalClaim
  });

  add(
    '수요 약화',
    0.18 + Math.max(0, -finite(observation.demandGrowth)) * 3.2 + Math.max(0, changes.unemployment) * 3.8,
    { demandGrowth: observation.demandGrowth, unemploymentChange: changes.unemployment },
    '총수요 둔화가 매출·고용을 약화시키고 있을 수 있음'
  );
  add(
    '비용·물가 압력',
    0.16 + Math.max(0, finite(observation.inflation)) * 3.0 + Math.max(0, finite(observation.wageGrowth)) * 2.0,
    { inflation: observation.inflation, wageGrowth: observation.wageGrowth },
    '임금·투입비용 상승이 가격과 실질구매력을 압박하고 있을 수 있음'
  );
  add(
    '신용 경색',
    0.12 + finite(observation.creditStress) * 0.75 + Math.max(0, changes.creditStress) * 1.8,
    { creditStress: observation.creditStress, creditStressChange: changes.creditStress },
    '금융중개 악화가 소비·투자·생산을 제약하고 있을 수 있음'
  );
  add(
    '대외 충격',
    0.10 + finite(observation.externalStress) * 0.72 + Math.max(0, changes.externalStress) * 1.7,
    { externalStress: observation.externalStress, externalStressChange: changes.externalStress },
    '환율·무역·대외금융 경로가 국내경제에 충격을 전달하고 있을 수 있음'
  );
  add(
    '경기 회복',
    0.16 + Math.max(0, finite(observation.demandGrowth)) * 2.8 + Math.max(0, -changes.unemployment) * 3.4,
    { demandGrowth: observation.demandGrowth, unemploymentChange: changes.unemployment },
    '수요와 고용의 동반개선이 자기강화적 회복으로 이어질 수 있음'
  );

  if (agent.kind === 'firm') {
    add(
      '기업 유동성 스트레스',
      0.12 + finite(observation.cashStress) * 0.78 + Math.max(0, finite(observation.inventoryPressure)) * 0.22,
      { cashStress: observation.cashStress, inventoryPressure: observation.inventoryPressure },
      '현금부족과 재고누적이 가격·생산·고용 축소를 유발할 수 있음'
    );
  } else if (agent.kind === 'household') {
    add(
      '가계 소득불안',
      0.12 + (observation.employed === false ? 0.62 : 0) + Math.max(0, -finite(observation.incomeGrowth)) * 2.0,
      { employed: observation.employed, incomeGrowth: observation.incomeGrowth },
      '고용·소득 불안이 예방적 저축과 소비감소를 유발할 수 있음'
    );
  }

  return hypotheses.sort((a, b) => b.confidence - a.confidence).slice(0, Math.max(3, c.profile.complexityBudget));
}

function selectAttention(cognition, observation) {
  const surprise = observationDistance(observation, cognition.lastObservation);
  const distress = Math.max(
    finite(observation.cashStress),
    finite(observation.externalStress),
    finite(observation.creditStress),
    Math.min(1, Math.abs(finite(observation.inflation)) * 8),
    Math.min(1, Math.abs(finite(observation.demandGrowth)) * 5)
  );
  const salience = clamp(surprise * 0.55 + distress * 0.65, 0, 1.5);
  const level = salience > 0.95 ? 4 : salience > 0.62 ? 3 : salience > 0.34 ? 2 : salience > 0.14 ? 1 : 0;
  return { level, salience, trigger: level >= 3 ? 'high-stakes/surprise' : level === 2 ? 'material-change' : level === 1 ? 'routine-review' : 'habit' };
}

export function observeAgent(agent, observation, month, rng) {
  const c = ensureCognition(agent, rng);
  const normalized = { month, ...observation };
  const attention = selectAttention(c, normalized);
  if (attention.level !== c.attention.level) attention.lastLevelChangeMonth = month;
  else attention.lastLevelChangeMonth = c.attention.lastLevelChangeMonth;
  c.attention = attention;

  for (const [key, noise] of [
    ['inflation', 0.12],
    ['unemployment', 0.14],
    ['demandGrowth', 0.18],
    ['wageGrowth', 0.16],
    ['incomeGrowth', 0.20],
    ['externalStress', 0.20],
    ['creditStress', 0.19]
  ]) updateBelief(c, key, normalized[key], noise + c.profile.structuralUncertainty * 0.2);

  c.hypotheses = generateHypotheses(agent, normalized);
  c.memory.episodes.push({
    month,
    attention: { ...c.attention },
    observation: { ...normalized },
    topHypothesis: c.hypotheses[0] ? { ...c.hypotheses[0] } : null
  });
  if (c.memory.episodes.length > MAX_EPISODES) c.memory.episodes.shift();
  c.lastObservation = normalized;
  return c;
}

export function beliefMean(agent, key, fallback = 0) {
  return finite(agent.cognition?.beliefs?.[key]?.mean, fallback);
}

export function beliefUncertainty(agent, key, fallback = 0.3) {
  return clamp(finite(agent.cognition?.beliefs?.[key]?.uncertainty, fallback), 0.02, 1.5);
}

export function topHypotheses(agent, limit = 4) {
  return (agent.cognition?.hypotheses || []).slice(0, limit).map(x => ({ ...x }));
}

export function counterfactualPlan(agent, candidates, simulator, rng, options = {}) {
  const c = agent.cognition;
  if (!c?.enabled) return candidates.map(candidate => ({ ...candidate, cognitiveUtility: finite(candidate.utility) }));
  const attention = c.attention?.level ?? 1;
  const baseHorizon = options.horizon || c.profile.planningHorizon;
  const horizon = Math.max(1, Math.round(baseHorizon * (attention >= 3 ? 1.35 : attention === 2 ? 1 : attention === 1 ? 0.72 : 0.45)));
  const scenarioSet = attention >= 3
    ? [{ shock: -1.15, weight: 0.18 }, { shock: -0.45, weight: 0.22 }, { shock: 0, weight: 0.28 }, { shock: 0.45, weight: 0.20 }, { shock: 1.15, weight: 0.12 }]
    : attention === 2
      ? [{ shock: -0.8, weight: 0.25 }, { shock: 0, weight: 0.5 }, { shock: 0.8, weight: 0.25 }]
      : [{ shock: -0.5, weight: 0.25 }, { shock: 0, weight: 0.5 }, { shock: 0.5, weight: 0.25 }];

  return candidates.map(candidate => {
    const scenarios = scenarioSet.map(s => {
      const result = simulator(candidate, {
        horizon,
        shock: s.shock,
        model: c.worldModel,
        beliefs: c.beliefs,
        attention,
        rng
      }) || {};
      return { weight: s.weight, shock: s.shock, utility: finite(result.utility), outcomes: result.outcomes || {} };
    });
    const expectedUtility = scenarios.reduce((sum, s) => sum + s.weight * s.utility, 0);
    const variance = scenarios.reduce((sum, s) => sum + s.weight * (s.utility - expectedUtility) ** 2, 0);
    const downside = Math.min(...scenarios.map(s => s.utility));
    const riskAversion = clamp(finite(agent.riskAversion, finite(agent.inflationAversion, 0.55)), 0, 1.2);
    const modelUncertainty = c.profile.structuralUncertainty + Object.values(c.beliefs).reduce((sum, b) => sum + finite(b.uncertainty), 0) / Math.max(1, Object.keys(c.beliefs).length) * 0.15;
    const cognitiveUtility = expectedUtility - Math.sqrt(Math.max(0, variance)) * riskAversion * 0.34 - modelUncertainty * 0.08 + rng.normal(0, c.profile.exploration);
    return {
      ...candidate,
      cognitiveUtility,
      counterfactual: {
        horizon,
        expectedUtility,
        downside,
        variance,
        modelUncertainty,
        scenarios
      }
    };
  });
}

export function registerForecast(agent, metric, expected, month, horizon = 1, meta = {}) {
  const c = agent.cognition;
  if (!c?.enabled || !Number.isFinite(Number(expected))) return null;
  const forecast = {
    id: `${agent.id}:${metric}:${month}:${c.pendingForecasts.length}`,
    metric,
    expected: finite(expected),
    createdMonth: month,
    dueMonth: month + Math.max(1, Math.round(horizon)),
    meta: { ...meta }
  };
  c.pendingForecasts.push(forecast);
  if (c.pendingForecasts.length > 64) c.pendingForecasts.shift();
  return forecast;
}

function updateCalibration(c, metric, error) {
  const old = c.calibration[metric] || { count: 0, bias: 0, mae: 0, mse: 0, lastError: 0 };
  const n = old.count + 1;
  old.count = n;
  old.bias += (error - old.bias) / n;
  old.mae += (Math.abs(error) - old.mae) / n;
  old.mse += (error * error - old.mse) / n;
  old.lastError = error;
  c.calibration[metric] = old;
}

function learnModelParameter(c, forecast, error) {
  const parameter = forecast.meta?.parameter;
  if (!parameter || !(parameter in c.worldModel)) return;
  const predictor = finite(forecast.meta?.predictor, 0);
  if (Math.abs(predictor) < EPS) return;
  const [lo, hi] = MODEL_BOUNDS[parameter] || [-10, 10];
  const step = c.profile.learningRate * error * predictor / (0.05 + predictor * predictor);
  c.worldModel[parameter] = clamp(finite(c.worldModel[parameter]) + step, lo, hi);
}

export function resolveForecasts(agent, actualMetrics, month) {
  const c = agent.cognition;
  if (!c?.enabled) return [];
  const resolved = [];
  const pending = [];
  for (const forecast of c.pendingForecasts) {
    if (forecast.dueMonth > month) {
      pending.push(forecast);
      continue;
    }
    const actual = Number(actualMetrics?.[forecast.metric]);
    if (!Number.isFinite(actual)) {
      pending.push(forecast);
      continue;
    }
    const error = actual - forecast.expected;
    updateCalibration(c, forecast.metric, error);
    learnModelParameter(c, forecast, error);
    const row = { ...forecast, actual, error, resolvedMonth: month };
    c.forecastHistory.push(row);
    resolved.push(row);
  }
  c.pendingForecasts = pending;
  if (c.forecastHistory.length > MAX_FORECAST_HISTORY) c.forecastHistory.splice(0, c.forecastHistory.length - MAX_FORECAST_HISTORY);
  return resolved;
}

export function recordDecision(agent, decision, month, realizedReward = null) {
  const c = agent.cognition;
  if (!c?.enabled) return;
  const selected = decision?.selected || decision?.name || 'unknown';
  c.decisions.push({ month, selected, trace: decision?.trace ? structuredClone(decision.trace) : null, realizedReward });
  if (c.decisions.length > MAX_DECISIONS) c.decisions.shift();
  if (!c.strategyStats[selected]) c.strategyStats[selected] = { count: 0, meanReward: 0, lastReward: 0 };
  c.strategyStats[selected].count += 1;
  c.lastReasoning = decision?.trace ? structuredClone(decision.trace) : null;
}

export function updateLastDecisionReward(agent, reward) {
  const c = agent.cognition;
  if (!c?.enabled || !c.decisions.length || !Number.isFinite(Number(reward))) return;
  const decision = c.decisions[c.decisions.length - 1];
  decision.realizedReward = finite(reward);
  const stats = c.strategyStats[decision.selected];
  const n = Math.max(1, stats.count);
  stats.meanReward += (finite(reward) - stats.meanReward) / n;
  stats.lastReward = finite(reward);
}

function monthlySignals(country) {
  const history = country.history || [];
  const current = country.macro || {};
  const prev = history.length > 1 ? history[history.length - 2] : country.previousMacro || current;
  const inflation = finite(prev?.priceIndex) > EPS ? finite(current.priceIndex) / Math.max(EPS, finite(prev.priceIndex)) - 1 : 0;
  const wageGrowth = finite(prev?.avgWage) > EPS ? finite(current.avgWage) / Math.max(EPS, finite(prev.avgWage)) - 1 : 0;
  const demandGrowth = finite(prev?.nominalSales) > EPS ? finite(current.nominalSales) / Math.max(EPS, finite(prev.nominalSales)) - 1 : 0;
  return {
    inflation,
    wageGrowth,
    demandGrowth,
    unemployment: finite(current.unemployment),
    externalStress: finite(current.externalStress),
    creditStress: finite(country.lastMonetary?.creditStress, finite(current.creditStress)),
    exchangeRateChange: finite(current.exchangeRateChange),
    policyRate: finite(current.policyRate),
    debtRatio: finite(current.publicDebtRatio),
    currentAccountWXU: finite(current.currentAccountWXU)
  };
}

export class CognitiveArchitecture {
  constructor({ rng }) {
    this.rng = rng;
  }

  initializeAgent(agent) {
    return ensureCognition(agent, this.rng);
  }

  initializeWorld(countries) {
    for (const country of countries) this.initializeCountry(country);
  }

  initializeCountry(country) {
    for (const agent of this.agents(country)) this.initializeAgent(agent);
  }

  agents(country) {
    return [
      ...(country.households || []),
      ...(country.firms || []),
      ...(country.banks || []),
      ...(country.governments || []),
      ...(country.centralBanks || [])
    ];
  }

  beginWorldMonth(countries, month) {
    for (const country of countries) this.beginCountryMonth(country, month);
  }

  beginCountryMonth(country, month) {
    const s = monthlySignals(country);
    for (const h of country.households || []) {
      const prior = h.cognition?.lastObservation;
      const incomeGrowth = prior && finite(prior.income) > EPS ? finite(h.income) / Math.max(EPS, finite(prior.income)) - 1 : 0;
      observeAgent(h, {
        ...s,
        incomeGrowth,
        income: finite(h.income),
        cash: finite(h.wealth),
        debt: finite(h.loanBalance),
        employed: Boolean(h.employed),
        wage: finite(h.wage),
        cashStress: clamp(1 - finite(h.wealth) / Math.max(1, finite(h.wage) * 2.2), 0, 1)
      }, month, this.rng);
    }
    for (const f of country.firms || []) {
      this.initializeAgent(f);
      const inventoryPressure = (finite(f.inventory) - finite(f.targetInventory)) / Math.max(1, finite(f.targetInventory, 1));
      const cashStress = clamp(1 - finite(f.cash) / Math.max(1, finite(f.safeCash, 1)), 0, 1);
      observeAgent(f, {
        ...s,
        sales: finite(f.sales),
        revenue: finite(f.revenue),
        cash: finite(f.cash),
        debt: finite(f.loanBalance),
        inventoryPressure,
        cashStress,
        supplyShortage: finite(f.supplyShortage),
        price: finite(f.price),
        wage: finite(f.wage)
      }, month, this.rng);
    }
    const bank = country.banks?.[0];
    if (bank) observeAgent(bank, {
      ...s,
      capitalStress: clamp(finite(country.lastMonetary?.bankStress), 0, 1.5),
      loanDefaults: finite(country.lastCredit?.defaults),
      loanApplications: finite(country.lastCredit?.applications),
      outstandingLoans: finite(country.lastCredit?.outstandingLoans)
    }, month, this.rng);
    const government = country.governments?.[0];
    if (government) observeAgent(government, { ...s }, month, this.rng);
    const centralBank = country.centralBanks?.[0];
    if (centralBank) observeAgent(centralBank, {
      ...s,
      assetMomentum: finite(country.lastAssetMarket?.indexReturn),
      bankStress: finite(country.lastMonetary?.bankStress),
      reserveRatio: finite(country.lastMonetary?.bankReserveRatio)
    }, month, this.rng);
  }

  endWorldMonth(countries, month) {
    for (const country of countries) this.endCountryMonth(country, month);
  }

  endCountryMonth(country, month) {
    const s = monthlySignals(country);
    for (const h of country.households || []) {
      resolveForecasts(h, {
        inflation: s.inflation,
        unemployment: s.unemployment,
        incomeGrowth: h.cognition?.lastObservation && finite(h.cognition.lastObservation.income) > EPS
          ? finite(h.income) / Math.max(EPS, finite(h.cognition.lastObservation.income)) - 1
          : 0
      }, month);
      const buffer = finite(h.wealth) / Math.max(1, finite(h.wage) * 2);
      const reward = Math.log1p(Math.max(0, finite(h.consumption))) + Math.min(2, buffer) * 0.18 - (h.employed ? 0 : 0.55) - finite(h.loanBalance) / Math.max(1, finite(h.wage) * 12) * 0.12;
      updateLastDecisionReward(h, reward);
    }
    for (const f of country.firms || []) {
      const obs = f.cognition?.lastObservation || {};
      const priorSales = Math.max(0.01, finite(obs.sales, 0.01));
      const realizedDemandGrowth = finite(f.sales) / priorSales - 1;
      resolveForecasts(f, {
        demandGrowth: realizedDemandGrowth,
        inflation: s.inflation,
        wageGrowth: s.wageGrowth
      }, month);
      const cashBuffer = finite(f.cash) / Math.max(1, finite(f.safeCash, 1));
      const reward = finite(f.revenue) / Math.max(1, finite(f.wage) * Math.max(1, finite(f.workers))) + Math.min(2, cashBuffer) * 0.2 - finite(f.distressMonths) * 0.16 - Math.max(0, finite(f.inventory) - finite(f.targetInventory)) / Math.max(1, finite(f.targetInventory)) * 0.08;
      updateLastDecisionReward(f, reward);
    }
    const bank = country.banks?.[0];
    if (bank) {
      const apps = Math.max(1, finite(country.lastCredit?.applications));
      resolveForecasts(bank, { creditDefaultRate: finite(country.lastCredit?.defaults) / apps }, month);
      updateLastDecisionReward(bank, finite(country.macro?.bankProfit) / Math.max(1, finite(country.macro?.bankDeposits)) - finite(country.lastMonetary?.bankStress) * 0.2);
    }
    const government = country.governments?.[0];
    if (government) {
      resolveForecasts(government, { unemployment: s.unemployment, inflation: s.inflation, debtRatio: finite(country.macro?.publicDebtRatio) }, month);
      updateLastDecisionReward(government, -Math.abs(s.unemployment - government.unemploymentReference) * 2.4 - Math.abs(s.inflation - government.inflationReference) * 2.0 - Math.max(0, finite(country.macro?.publicDebtRatio) - government.debtComfortRatio) * 0.35);
    }
    const centralBank = country.centralBanks?.[0];
    if (centralBank) {
      resolveForecasts(centralBank, { inflation: s.inflation, unemployment: s.unemployment, creditStress: finite(country.lastMonetary?.creditStress) }, month);
      updateLastDecisionReward(centralBank, -Math.abs(s.inflation - centralBank.inflationTarget) * 2.6 - Math.abs(s.unemployment - centralBank.unemploymentReference) * 1.8 - finite(country.lastMonetary?.bankStress) * 0.3);
    }
  }

  summary(country) {
    const agents = this.agents(country).filter(a => a.cognition?.enabled);
    const levels = [0, 0, 0, 0, 0];
    let forecastCount = 0;
    let resolvedCount = 0;
    let maeSum = 0;
    let maeCount = 0;
    for (const agent of agents) {
      const level = clamp(Math.round(finite(agent.cognition.attention?.level)), 0, 4);
      levels[level] += 1;
      forecastCount += agent.cognition.pendingForecasts.length;
      resolvedCount += agent.cognition.forecastHistory.length;
      for (const stat of Object.values(agent.cognition.calibration || {})) {
        if (stat.count > 0) {
          maeSum += finite(stat.mae);
          maeCount += 1;
        }
      }
    }
    return {
      agents: agents.length,
      attentionLevels: levels,
      pendingForecasts: forecastCount,
      resolvedForecasts: resolvedCount,
      meanCalibrationMAE: maeCount ? maeSum / maeCount : 0
    };
  }
}
