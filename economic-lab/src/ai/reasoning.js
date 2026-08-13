import { clamp } from '../core/rng.js';
import {
  beliefMean,
  beliefUncertainty,
  counterfactualPlan,
  recordDecision,
  registerForecast,
  topHypotheses
} from './cognitive-core.js';
import {
  analogicalForecast,
  causalExplanations,
  causalForecast,
  retrieveAnalogies
} from './episodic-reasoning.js';

function blendForecast(base, sources = []) {
  let value = Number(base || 0);
  let weight = 1;
  for (const source of sources) {
    const confidence = clamp(Number(source?.confidence || 0), 0, 1);
    const maxWeight = clamp(Number(source?.maxWeight ?? 0.25), 0, 0.5);
    const w = confidence * maxWeight;
    if (w <= 0 || !Number.isFinite(Number(source?.value))) continue;
    value = (value * weight + Number(source.value) * w) / (weight + w);
    weight += w;
  }
  return value;
}

function compactAnalogies(rows) {
  return (rows || []).slice(0, 4).map(x => ({
    month: x.month,
    similarity: x.similarity,
    topHypothesis: x.topHypothesis,
    decision: x.decision,
    reward: x.reward,
    outcome: x.outcome
  }));
}

function legacyHouseholdDecision(h, signals, rng) {
  const perceivedInflation = signals.inflation + h.biasInflation + rng.normal(0, 0.008);
  const perceivedJobRisk = clamp(signals.unemployment * (0.7 + h.riskAversion * 0.8) + rng.normal(0, 0.01), 0, 1);
  const expectedIncomeGrowth = signals.wageGrowth - perceivedJobRisk * 0.08 + h.optimism * 0.03 + rng.normal(0, 0.01);

  const hypotheses = [
    { name: '소득 안정', confidence: clamp(0.55 + expectedIncomeGrowth * 2 - perceivedJobRisk, 0, 1) },
    { name: '생활비 상승', confidence: clamp(0.45 + perceivedInflation * 3, 0, 1) },
    { name: '실직 위험', confidence: clamp(0.25 + perceivedJobRisk * 1.8, 0, 1) }
  ].sort((a, b) => b.confidence - a.confidence);

  const liquidityNeed = clamp(0.18 + perceivedJobRisk * 0.7 + h.riskAversion * 0.22 - h.wealth / 5000, 0.05, 0.85);
  const consumeShare = clamp(0.70 - perceivedInflation * 0.4 - liquidityNeed * 0.28 + expectedIncomeGrowth * 0.8 + h.optimism * 0.05, 0.30, 0.94);

  h.beliefs.inflation = 0.75 * h.beliefs.inflation + 0.25 * perceivedInflation;
  h.beliefs.jobRisk = 0.75 * h.beliefs.jobRisk + 0.25 * perceivedJobRisk;
  h.beliefs.incomeGrowth = 0.75 * h.beliefs.incomeGrowth + 0.25 * expectedIncomeGrowth;

  return {
    consumeShare,
    trace: {
      perception: { inflation: perceivedInflation, jobRisk: perceivedJobRisk, expectedIncomeGrowth },
      hypotheses,
      selected: consumeShare > 0.70 ? '소비 유지/확대' : consumeShare > 0.52 ? '소비 절제' : '유동성 방어',
      reason: hypotheses[0].name
    }
  };
}

export function householdDecision(h, signals, rng) {
  if (!h.cognition?.enabled) return legacyHouseholdDecision(h, signals, rng);

  const cognition = h.cognition;
  const month = Number(cognition.lastObservation?.month || 0);
  const currentState = {
    ...(cognition.lastObservation || {}),
    month,
    inflation: Number(signals.inflation || 0),
    unemployment: Number(signals.unemployment || 0),
    demandGrowth: Number(signals.demandGrowth || 0),
    wageGrowth: Number(signals.wageGrowth || 0),
    cashStress: clamp(1 - Number(h.wealth || 0) / Math.max(1, Number(h.wage || 1) * 2.2), 0, 1.5)
  };

  const rawInflation =
    signals.inflation * 0.42 +
    beliefMean(h, 'inflation', signals.inflation) * 0.58 +
    h.biasInflation * 0.65 +
    rng.normal(0, 0.003 + beliefUncertainty(h, 'inflation') * 0.012);
  const inflationMemory = analogicalForecast(h, 'inflation', currentState, rawInflation, 4);
  const perceivedInflation = clamp(
    blendForecast(rawInflation, [{ ...inflationMemory, maxWeight: 0.18 }]),
    -0.15,
    0.45
  );

  const rawUnemployment = clamp(
    signals.unemployment * 0.45 + beliefMean(h, 'unemployment', signals.unemployment) * 0.55 + rng.normal(0, 0.006),
    0,
    1
  );
  const unemploymentMemory = analogicalForecast(h, 'unemployment', currentState, rawUnemployment, 4);
  const expectedUnemployment = clamp(
    blendForecast(rawUnemployment, [{ ...unemploymentMemory, maxWeight: 0.22 }]),
    0,
    1
  );
  const perceivedJobRisk = clamp(
    expectedUnemployment * (0.62 + h.riskAversion * 0.72) + (h.employed ? 0 : 0.22) + rng.normal(0, 0.008),
    0,
    1
  );

  const baseIncomeGrowth = clamp(
    beliefMean(h, 'incomeGrowth', signals.wageGrowth) * 0.50 +
    signals.wageGrowth * 0.28 +
    cognition.worldModel.wagePersistence * signals.wageGrowth * 0.18 -
    perceivedJobRisk * 0.055 +
    h.optimism * 0.025,
    -0.35,
    0.35
  );
  const incomeMemory = analogicalForecast(h, 'incomeGrowth', currentState, baseIncomeGrowth, 4);
  const causalIncome = causalForecast(h, 'incomeGrowth', currentState, baseIncomeGrowth);
  const expectedIncomeGrowth = clamp(
    blendForecast(baseIncomeGrowth, [
      { ...incomeMemory, maxWeight: 0.32 },
      { ...causalIncome, maxWeight: 0.18 }
    ]),
    -0.40,
    0.40
  );
  const incomeCauses = causalExplanations(h, 'incomeGrowth', currentState, 5);
  const memoryAnalogies = retrieveAnalogies(h, currentState, 4);

  const cash = Math.max(0, Number(h.wealth || 0));
  const incomeBase = Math.max(1, Number(h.disposableIncome || h.income || h.wage || 1));
  const liquidityMonths = cash / incomeBase;
  const debtBurden = Math.max(0, Number(h.loanBalance || 0)) / Math.max(1, Number(h.wage || 1) * 12);
  const inflationUncertainty = beliefUncertainty(h, 'inflation');
  const incomeUncertainty = beliefUncertainty(h, 'incomeGrowth');

  const candidates = [
    { name: '유동성 방어', consumeShare: clamp(0.40 - perceivedJobRisk * 0.07, 0.28, 0.48), utility: 0.02 },
    { name: '강한 절약', consumeShare: 0.50, utility: 0.05 },
    { name: '소비 절제', consumeShare: 0.60, utility: 0.10 },
    { name: '소비 유지', consumeShare: 0.70, utility: 0.12 },
    { name: '소비 확대', consumeShare: clamp(0.80 + h.optimism * 0.03, 0.74, 0.88), utility: 0.08 }
  ];

  const evaluated = counterfactualPlan(h, candidates, (candidate, env) => {
    const horizon = env.horizon;
    const shockScale = 0.018 + incomeUncertainty * 0.045;
    const incomeGrowth = clamp(expectedIncomeGrowth + env.shock * shockScale, -0.45, 0.45);
    const inflation = clamp(
      perceivedInflation * env.model.inflationPersistence + env.shock * (0.008 + inflationUncertainty * 0.018),
      -0.12,
      0.45
    );
    const jobLossProbability = clamp(perceivedJobRisk * (0.75 + horizon * 0.04) + Math.max(0, -incomeGrowth) * 0.35, 0, 0.92);
    const expectedNominalIncome = incomeBase * Math.pow(Math.max(0.55, 1 + incomeGrowth), Math.min(4, horizon));
    const consumption = expectedNominalIncome * candidate.consumeShare;
    const realConsumption = consumption / Math.max(0.55, Math.pow(1 + inflation, Math.min(4, horizon)));
    const precautionarySaving = expectedNominalIncome - consumption;
    const unemploymentLoss = jobLossProbability * expectedNominalIncome * (0.22 + h.riskAversion * 0.30);
    const terminalLiquidity = Math.max(0, cash + precautionarySaving - unemploymentLoss - debtBurden * incomeBase * 0.5);
    const targetLiquidity = incomeBase * (1.4 + h.riskAversion * 2.4 + perceivedJobRisk * 2.0);
    const liquidityGap = (terminalLiquidity - targetLiquidity) / Math.max(1, targetLiquidity);
    const utility =
      Math.log1p(Math.max(0, realConsumption)) * 0.34 +
      clamp(liquidityGap, -1.5, 1.5) * 0.48 -
      jobLossProbability * (0.36 + h.riskAversion * 0.34) -
      debtBurden * 0.12 +
      candidate.utility;
    return {
      utility,
      outcomes: { incomeGrowth, inflation, jobLossProbability, realConsumption, terminalLiquidity, liquidityGap }
    };
  }, rng, { horizon: cognition.profile.planningHorizon });

  evaluated.sort((a, b) => b.cognitiveUtility - a.cognitiveUtility);
  const selected = evaluated[0];
  const baseScenario = selected.counterfactual.scenarios.reduce((best, row) => Math.abs(row.shock) < Math.abs(best.shock) ? row : best, selected.counterfactual.scenarios[0]);
  const predictedIncomeGrowth = Number(baseScenario.outcomes?.incomeGrowth ?? expectedIncomeGrowth);
  const predictedInflation = Number(baseScenario.outcomes?.inflation ?? perceivedInflation);

  h.beliefs.inflation = 0.82 * h.beliefs.inflation + 0.18 * perceivedInflation;
  h.beliefs.jobRisk = 0.82 * h.beliefs.jobRisk + 0.18 * perceivedJobRisk;
  h.beliefs.incomeGrowth = 0.82 * h.beliefs.incomeGrowth + 0.18 * expectedIncomeGrowth;

  registerForecast(h, 'incomeGrowth', predictedIncomeGrowth, month, 1, {
    parameter: 'wagePersistence',
    predictor: Number(signals.wageGrowth || 0)
  });
  registerForecast(h, 'inflation', predictedInflation, month, 1, {
    parameter: 'inflationPersistence',
    predictor: perceivedInflation
  });
  registerForecast(h, 'unemployment', expectedUnemployment, month, 1, {
    parameter: 'unemploymentPersistence',
    predictor: expectedUnemployment
  });

  const trace = {
    perception: {
      inflation: perceivedInflation,
      unemployment: expectedUnemployment,
      jobRisk: perceivedJobRisk,
      baseIncomeGrowth,
      expectedIncomeGrowth,
      liquidityMonths,
      debtBurden
    },
    hypotheses: topHypotheses(h, 5),
    memoryReasoning: {
      analogies: compactAnalogies(memoryAnalogies),
      incomeForecast: { value: incomeMemory.value, confidence: incomeMemory.confidence },
      unemploymentForecast: { value: unemploymentMemory.value, confidence: unemploymentMemory.confidence },
      inflationForecast: { value: inflationMemory.value, confidence: inflationMemory.confidence }
    },
    causalReasoning: {
      target: 'incomeGrowth',
      forecast: { value: causalIncome.value, confidence: causalIncome.confidence },
      explanations: incomeCauses
    },
    worldModel: {
      wagePersistence: cognition.worldModel.wagePersistence,
      inflationPersistence: cognition.worldModel.inflationPersistence,
      unemploymentPersistence: cognition.worldModel.unemploymentPersistence
    },
    cognition: {
      attention: { ...cognition.attention },
      planningHorizon: selected.counterfactual.horizon,
      uncertainty: { inflation: inflationUncertainty, income: incomeUncertainty },
      calibration: structuredClone(cognition.calibration)
    },
    candidates: evaluated.map(p => ({
      name: p.name,
      consumeShare: p.consumeShare,
      utility: p.cognitiveUtility,
      expectedUtility: p.counterfactual.expectedUtility,
      downside: p.counterfactual.downside,
      variance: p.counterfactual.variance
    })),
    selected: selected.name,
    forecast: {
      incomeGrowth: predictedIncomeGrowth,
      inflation: predictedInflation,
      unemployment: expectedUnemployment
    },
    reason: memoryAnalogies.length
      ? `과거 유사국면·인과모형·반사실적 계획을 결합한 결과 ${selected.name} 선택`
      : `반사실적 계획에서 ${selected.name}의 위험조정 효용이 가장 높음`
  };
  const decision = { consumeShare: selected.consumeShare, trace };
  recordDecision(h, { selected: selected.name, trace }, month);
  return decision;
}

function legacyFirmDecision(f, signals, rng) {
  const observedDemandGrowth = signals.demandGrowth + f.demandBias + rng.normal(0, 0.02);
  const expectedDemandGrowth = 0.55 * f.beliefs.demandGrowth + 0.45 * observedDemandGrowth;
  const expectedCostGrowth = signals.wageGrowth * 0.55 + signals.inflation * 0.35 + rng.normal(0, 0.01);

  const inventoryPressure = clamp((f.inventory - f.targetInventory) / Math.max(1, f.targetInventory), -1, 2);
  const cashStress = clamp(1 - f.cash / Math.max(1, f.safeCash), 0, 1);

  const plans = [
    {
      name: '확장',
      productionChange: 0.06 + expectedDemandGrowth * 0.7,
      priceChange: expectedCostGrowth * 0.45,
      hiringChange: 0.04 + expectedDemandGrowth * 0.5,
      utility: expectedDemandGrowth * 2.0 - cashStress * 0.7 - inventoryPressure * 0.9
    },
    {
      name: '방어',
      productionChange: -0.04 - Math.max(0, inventoryPressure) * 0.08,
      priceChange: expectedCostGrowth * 0.65,
      hiringChange: -0.03 - cashStress * 0.04,
      utility: cashStress * 1.0 + inventoryPressure * 0.8 - expectedDemandGrowth * 0.8
    },
    {
      name: '가격 경쟁',
      productionChange: 0.01,
      priceChange: -0.025 - Math.max(0, inventoryPressure) * 0.015,
      hiringChange: 0,
      utility: inventoryPressure * 0.75 - expectedCostGrowth * 0.6 + f.competitionSensitivity * 0.4
    },
    {
      name: '유지', productionChange: 0, priceChange: 0, hiringChange: 0,
      utility: 0.25 - Math.abs(expectedDemandGrowth) - cashStress * 0.2
    }
  ];

  for (const p of plans) p.utility += rng.normal(0, 0.05) - f.riskAversion * Math.max(0, p.productionChange) * 0.25;
  plans.sort((a, b) => b.utility - a.utility);
  const selected = plans[0];

  f.beliefs.demandGrowth = 0.72 * f.beliefs.demandGrowth + 0.28 * observedDemandGrowth;
  f.beliefs.costGrowth = 0.72 * f.beliefs.costGrowth + 0.28 * expectedCostGrowth;

  return {
    ...selected,
    trace: {
      perception: { observedDemandGrowth, expectedDemandGrowth, expectedCostGrowth, inventoryPressure, cashStress },
      candidates: plans.map(p => ({ name: p.name, utility: p.utility })),
      selected: selected.name,
      reason: selected.name === '방어' ? '현금/재고 위험' : selected.name === '확장' ? '수요 회복 기대' : selected.name === '가격 경쟁' ? '재고·경쟁 압력' : '불확실성 대기'
    }
  };
}

export function firmDecision(f, signals, rng) {
  if (!f.cognition?.enabled) return legacyFirmDecision(f, signals, rng);

  const cognition = f.cognition;
  const month = Number(cognition.lastObservation?.month || 0);
  const inventoryPressure = clamp((f.inventory - f.targetInventory) / Math.max(1, f.targetInventory), -1, 2.5);
  const cashStress = clamp(1 - f.cash / Math.max(1, f.safeCash), 0, 1.3);
  const supplyStress = clamp(Number(f.supplyShortage || 0) / Math.max(1, Number(f.desiredProduction || f.capacity || 1)), 0, 1);
  const debtBurden = Math.max(0, Number(f.loanBalance || 0)) / Math.max(1, Number(f.safeCash || 1) * 4);
  const currentState = {
    ...(cognition.lastObservation || {}),
    month,
    inflation: Number(signals.inflation || 0),
    unemployment: Number(signals.unemployment || 0),
    demandGrowth: Number(signals.demandGrowth || 0),
    wageGrowth: Number(signals.wageGrowth || 0),
    cashStress,
    inventoryPressure
  };

  const observedDemandGrowth = clamp(
    signals.demandGrowth * 0.48 + beliefMean(f, 'demandGrowth', signals.demandGrowth) * 0.52 + f.demandBias + rng.normal(0, 0.008 + beliefUncertainty(f, 'demandGrowth') * 0.025),
    -0.65,
    0.85
  );
  const modelDemandGrowth = clamp(
    cognition.worldModel.demandPersistence * observedDemandGrowth +
    (1 - Math.min(0.92, Math.abs(cognition.worldModel.demandPersistence))) * f.beliefs.demandGrowth * 0.55,
    -0.55,
    0.75
  );
  const memoryDemand = analogicalForecast(f, 'demandGrowth', currentState, modelDemandGrowth, 5);
  const causalDemand = causalForecast(f, 'demandGrowth', currentState, modelDemandGrowth);
  const expectedDemandGrowth = clamp(
    blendForecast(modelDemandGrowth, [
      { ...memoryDemand, maxWeight: 0.34 },
      { ...causalDemand, maxWeight: 0.22 }
    ]),
    -0.65,
    0.90
  );
  const demandCauses = causalExplanations(f, 'demandGrowth', currentState, 6);
  const memoryAnalogies = retrieveAnalogies(f, currentState, 5);

  const expectedCostGrowth = clamp(
    signals.wageGrowth * cognition.worldModel.wagePersistence * 0.55 +
    signals.inflation * cognition.worldModel.costPassThrough * 0.45 +
    beliefMean(f, 'inflation', signals.inflation) * 0.18,
    -0.25,
    0.45
  );

  const plans = [
    {
      name: '확장',
      productionChange: clamp(0.055 + expectedDemandGrowth * 0.58, -0.02, 0.18),
      priceChange: clamp(expectedCostGrowth * 0.42 + Math.max(0, expectedDemandGrowth) * 0.04, -0.03, 0.09),
      hiringChange: clamp(0.04 + expectedDemandGrowth * 0.42, -0.02, 0.12),
      utility: expectedDemandGrowth * 1.6 - cashStress * 0.55 - inventoryPressure * 0.55 - supplyStress * 0.35
    },
    {
      name: '방어',
      productionChange: clamp(-0.04 - Math.max(0, inventoryPressure) * 0.07 - cashStress * 0.035, -0.16, 0),
      priceChange: clamp(expectedCostGrowth * 0.60 + cashStress * 0.012, -0.02, 0.10),
      hiringChange: clamp(-0.025 - cashStress * 0.045, -0.10, 0),
      utility: cashStress * 0.9 + inventoryPressure * 0.65 + debtBurden * 0.25 - expectedDemandGrowth * 0.65
    },
    {
      name: '가격 경쟁',
      productionChange: clamp(0.01 - supplyStress * 0.025, -0.04, 0.04),
      priceChange: clamp(-0.018 - Math.max(0, inventoryPressure) * 0.014, -0.075, -0.004),
      hiringChange: 0,
      utility: inventoryPressure * 0.58 - expectedCostGrowth * 0.45 + f.competitionSensitivity * 0.34
    },
    {
      name: '현금 보존',
      productionChange: clamp(-0.015 - cashStress * 0.035, -0.08, 0),
      priceChange: clamp(expectedCostGrowth * 0.48, -0.015, 0.07),
      hiringChange: clamp(-cashStress * 0.035, -0.07, 0),
      utility: cashStress * 0.72 + debtBurden * 0.34 - Math.max(0, expectedDemandGrowth) * 0.30
    },
    {
      name: '유지',
      productionChange: 0,
      priceChange: 0,
      hiringChange: 0,
      utility: 0.20 - Math.abs(expectedDemandGrowth) * 0.55 - cashStress * 0.18
    }
  ];

  const demandUncertainty = beliefUncertainty(f, 'demandGrowth');
  const inflationUncertainty = beliefUncertainty(f, 'inflation');
  const evaluated = counterfactualPlan(f, plans, (plan, env) => {
    const horizon = env.horizon;
    const priceResponse = env.model.priceElasticity * plan.priceChange;
    const persistence = env.model.demandPersistence * expectedDemandGrowth;
    const shock = env.shock * (0.025 + demandUncertainty * 0.07);
    const demandGrowth = clamp(persistence + priceResponse + shock, -0.75, 1.1);
    const projectedSales = Math.max(0, Number(f.previousSales || 1) * Math.pow(Math.max(0.15, 1 + demandGrowth), Math.min(3, horizon)));
    const projectedPrice = Math.max(0.03, Number(f.price || 1) * (1 + plan.priceChange));
    const projectedRevenue = projectedSales * projectedPrice;
    const projectedWorkers = Math.max(0, Number(f.workers || 0) * (1 + plan.hiringChange));
    const wageCost = projectedWorkers * Math.max(0.01, Number(f.wage || 1)) * (1 + expectedCostGrowth);
    const productionCostProxy = Math.max(0, projectedRevenue * (0.22 + supplyStress * 0.22 + Math.max(0, expectedCostGrowth) * 0.35));
    const expectedOperatingCashFlow = projectedRevenue - wageCost - productionCostProxy;
    const inventoryNext = Math.max(0, Number(f.inventory || 0) * (1 - Math.max(-0.2, demandGrowth) * 0.32) + Number(f.targetInventory || 1) * plan.productionChange * 0.55);
    const inventoryGap = (inventoryNext - Number(f.targetInventory || 1)) / Math.max(1, Number(f.targetInventory || 1));
    const projectedCash = Number(f.cash || 0) + expectedOperatingCashFlow * Math.min(2.5, Math.max(0.5, horizon / 2));
    const distressRisk = clamp(
      Math.max(0, -projectedCash) / Math.max(1, Number(f.safeCash || 1)) * 0.55 +
      Math.max(0, inventoryGap) * 0.15 +
      debtBurden * 0.12 +
      supplyStress * 0.18,
      0,
      1.5
    );
    const scale = Math.max(1, Math.abs(wageCost) + Number(f.safeCash || 1));
    const utility =
      plan.utility +
      expectedOperatingCashFlow / scale * 0.82 -
      Math.abs(inventoryGap) * 0.22 -
      distressRisk * (0.42 + f.riskAversion * 0.42) +
      Math.max(0, demandGrowth) * 0.16;
    return {
      utility,
      outcomes: { demandGrowth, projectedSales, projectedRevenue, projectedCash, inventoryGap, distressRisk }
    };
  }, rng, { horizon: cognition.profile.planningHorizon });

  evaluated.sort((a, b) => b.cognitiveUtility - a.cognitiveUtility);
  const selected = evaluated[0];
  const baseScenario = selected.counterfactual.scenarios.reduce((best, row) => Math.abs(row.shock) < Math.abs(best.shock) ? row : best, selected.counterfactual.scenarios[0]);
  const predictedDemandGrowth = Number(baseScenario.outcomes?.demandGrowth ?? expectedDemandGrowth);

  f.beliefs.demandGrowth = 0.80 * f.beliefs.demandGrowth + 0.20 * expectedDemandGrowth;
  f.beliefs.costGrowth = 0.80 * f.beliefs.costGrowth + 0.20 * expectedCostGrowth;

  registerForecast(f, 'demandGrowth', predictedDemandGrowth, month, 1, {
    parameter: 'demandPersistence',
    predictor: observedDemandGrowth
  });
  registerForecast(f, 'inflation', signals.inflation * cognition.worldModel.inflationPersistence, month, 1, {
    parameter: 'inflationPersistence',
    predictor: Number(signals.inflation || 0)
  });
  registerForecast(f, 'wageGrowth', signals.wageGrowth * cognition.worldModel.wagePersistence, month, 1, {
    parameter: 'wagePersistence',
    predictor: Number(signals.wageGrowth || 0)
  });

  const trace = {
    perception: {
      observedDemandGrowth,
      modelDemandGrowth,
      expectedDemandGrowth,
      expectedCostGrowth,
      inventoryPressure,
      cashStress,
      supplyStress,
      debtBurden
    },
    hypotheses: topHypotheses(f, 6),
    memoryReasoning: {
      analogies: compactAnalogies(memoryAnalogies),
      demandForecast: { value: memoryDemand.value, confidence: memoryDemand.confidence }
    },
    causalReasoning: {
      target: 'demandGrowth',
      forecast: { value: causalDemand.value, confidence: causalDemand.confidence },
      explanations: demandCauses
    },
    worldModel: {
      demandPersistence: cognition.worldModel.demandPersistence,
      priceElasticity: cognition.worldModel.priceElasticity,
      costPassThrough: cognition.worldModel.costPassThrough,
      wagePersistence: cognition.worldModel.wagePersistence
    },
    cognition: {
      attention: { ...cognition.attention },
      planningHorizon: selected.counterfactual.horizon,
      uncertainty: { demand: demandUncertainty, inflation: inflationUncertainty },
      calibration: structuredClone(cognition.calibration),
      strategyStats: structuredClone(cognition.strategyStats)
    },
    candidates: evaluated.map(p => ({
      name: p.name,
      productionChange: p.productionChange,
      priceChange: p.priceChange,
      hiringChange: p.hiringChange,
      utility: p.cognitiveUtility,
      expectedUtility: p.counterfactual.expectedUtility,
      downside: p.counterfactual.downside,
      variance: p.counterfactual.variance,
      baseOutcome: p.counterfactual.scenarios.find(x => Math.abs(x.shock) < 1e-9)?.outcomes || null
    })),
    selected: selected.name,
    forecast: { demandGrowth: predictedDemandGrowth, costGrowth: expectedCostGrowth },
    reason: memoryAnalogies.length
      ? `과거 유사국면과 학습된 인과계수를 자기 수요모형에 결합한 뒤 ${selected.counterfactual.horizon}개월 반사실적 비교로 ${selected.name} 선택`
      : `자기 수요모형으로 ${selected.counterfactual.horizon}개월 반사실적 시나리오를 비교한 결과 ${selected.name} 선택`
  };
  const decision = {
    name: selected.name,
    selected: selected.name,
    productionChange: selected.productionChange,
    priceChange: selected.priceChange,
    hiringChange: selected.hiringChange,
    utility: selected.cognitiveUtility,
    trace
  };
  recordDecision(f, decision, month);
  return decision;
}

export function updateForecastError(agent, predicted, actual, key, learningRate = 0.12) {
  const error = actual - predicted;
  if (!agent.learning) agent.learning = {};
  agent.learning[key] = (agent.learning[key] ?? 0) * (1 - learningRate) + error * learningRate;
  return error;
}
