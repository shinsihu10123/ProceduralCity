import { clamp } from '../core/rng.js';

export function householdDecision(h, signals, rng) {
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

export function firmDecision(f, signals, rng) {
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

export function updateForecastError(agent, predicted, actual, key, learningRate = 0.12) {
  const error = actual - predicted;
  if (!agent.learning) agent.learning = {};
  agent.learning[key] = (agent.learning[key] ?? 0) * (1 - learningRate) + error * learningRate;
  return error;
}
