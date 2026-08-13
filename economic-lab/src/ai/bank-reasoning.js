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

function logistic(x) {
  return 1 / (1 + Math.exp(-x));
}

function blend(base, sources = []) {
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
  return (rows || []).slice(0, 5).map(x => ({
    month: x.month,
    similarity: x.similarity,
    topHypothesis: x.topHypothesis,
    decision: x.decision,
    reward: x.reward,
    outcome: x.outcome
  }));
}

function legacyEvaluateCreditApplication(bank, borrower, application, bankState, signals, rng) {
  const amount = Math.max(0, Number(application.amount || 0));
  const incomeBase = Math.max(1, Number(application.incomeBase || 0));
  const cash = Math.max(0, Number(application.cash || 0));
  const debt = Math.max(0, Number(application.debt || 0));
  const arrears = Math.max(0, Number(application.arrears || 0));
  const debtToIncome = debt / incomeBase;
  const requestedToIncome = amount / incomeBase;
  const liquidityMonths = cash / incomeBase;
  const arrearsRatio = arrears / incomeBase;

  const macroStress = clamp(
    signals.unemployment * 0.9 + Math.max(0, -signals.demandGrowth) * 1.6 + Math.max(0, signals.inflation) * 0.4,
    0,
    1.5
  );
  const borrowerFragility =
    debtToIncome * 0.34 +
    requestedToIncome * 0.18 +
    arrearsRatio * 0.75 +
    Math.max(0, 0.8 - liquidityMonths) * 0.38;
  const kindAdjustment = borrower.kind === 'household' ? 0.08 : -0.02;
  const modelNoise = rng.normal(0, 0.10 + bank.modelUncertainty * 0.08);
  const latentRisk = -1.65 + borrowerFragility + macroStress * 0.72 + kindAdjustment + modelNoise;
  const estimatedDefaultProbability = clamp(logistic(latentRisk), 0.01, 0.92);

  const currentCapitalRatio = bankState.assets > 0 ? bankState.equity / bankState.assets : 1;
  const projectedCapitalRatio = (bankState.assets + amount) > 0
    ? bankState.equity / (bankState.assets + amount)
    : currentCapitalRatio;
  const capitalHeadroom = projectedCapitalRatio - bank.minCapitalRatio;
  const riskLimit = clamp(0.30 - bank.riskAversion * 0.085 + bank.optimism * 0.025, 0.12, 0.34);

  const annualRate = clamp(
    bank.baseAnnualRate +
    bank.loanMarkup +
    estimatedDefaultProbability * 0.13 +
    Math.max(0, -capitalHeadroom) * 0.7,
    0.025,
    0.36
  );

  const paymentBurden = (amount / Math.max(6, application.termMonths || 24)) / incomeBase + annualRate / 12 * debt / incomeBase;
  const affordabilityLimit = borrower.kind === 'household' ? 0.34 : 0.48;
  const affordable = paymentBurden <= affordabilityLimit;
  const capitalSafe = projectedCapitalRatio >= bank.minCapitalRatio;
  const riskAcceptable = estimatedDefaultProbability <= riskLimit;
  const approved = amount > 0 && affordable && capitalSafe && riskAcceptable;

  const hypotheses = [
    { name: '상환 가능', confidence: clamp(1 - estimatedDefaultProbability * 1.35, 0, 1) },
    { name: '경기 악화 위험', confidence: clamp(macroStress * 0.72, 0, 1) },
    { name: '유동성 부족', confidence: clamp(1 - liquidityMonths / 1.5, 0, 1) },
    { name: '자본제약', confidence: clamp((bank.minCapitalRatio - projectedCapitalRatio) * 8 + 0.2, 0, 1) }
  ].sort((a, b) => b.confidence - a.confidence);

  return {
    approved,
    annualRate,
    monthlyRate: annualRate / 12,
    estimatedDefaultProbability,
    projectedCapitalRatio,
    paymentBurden,
    trace: {
      borrowerId: borrower.id,
      borrowerKind: borrower.kind,
      requestedAmount: amount,
      perception: {
        debtToIncome,
        requestedToIncome,
        liquidityMonths,
        arrearsRatio,
        macroStress,
        currentCapitalRatio
      },
      hypotheses,
      forecast: {
        estimatedDefaultProbability,
        projectedCapitalRatio,
        paymentBurden,
        annualRate
      },
      constraints: { affordable, capitalSafe, riskAcceptable, riskLimit, affordabilityLimit },
      selected: approved ? '대출 승인' : '대출 거절',
      reason: !capitalSafe ? '은행 자본제약' : !riskAcceptable ? '추정 부도위험' : !affordable ? '상환부담 과다' : '위험조정 수익 허용'
    }
  };
}

export function evaluateCreditApplication(bank, borrower, application, bankState, signals, rng) {
  if (!bank.cognition?.enabled) return legacyEvaluateCreditApplication(bank, borrower, application, bankState, signals, rng);

  const cognition = bank.cognition;
  const month = Number(cognition.lastObservation?.month || 0);
  const amount = Math.max(0, Number(application.amount || 0));
  const incomeBase = Math.max(1, Number(application.incomeBase || 0));
  const cash = Math.max(0, Number(application.cash || 0));
  const debt = Math.max(0, Number(application.debt || 0));
  const arrears = Math.max(0, Number(application.arrears || 0));
  const debtToIncome = debt / incomeBase;
  const requestedToIncome = amount / incomeBase;
  const liquidityMonths = cash / incomeBase;
  const arrearsRatio = arrears / incomeBase;
  const currentState = {
    ...(cognition.lastObservation || {}),
    month,
    inflation: Number(signals.inflation || 0),
    unemployment: Number(signals.unemployment || 0),
    demandGrowth: Number(signals.demandGrowth || 0),
    creditStress: beliefMean(bank, 'creditStress', 0)
  };

  const perceivedCreditStress = clamp(
    Number(signals.unemployment || 0) * 0.42 +
    Math.max(0, -Number(signals.demandGrowth || 0)) * 0.72 +
    beliefMean(bank, 'creditStress', 0) * 0.62 +
    Math.max(0, Number(signals.inflation || 0)) * 0.18,
    0,
    1.6
  );
  currentState.creditStress = perceivedCreditStress;
  const borrowerFragility =
    debtToIncome * 0.34 +
    requestedToIncome * 0.18 +
    arrearsRatio * 0.78 +
    Math.max(0, 0.8 - liquidityMonths) * 0.40;
  const kindAdjustment = borrower.kind === 'household' ? 0.08 : -0.02;
  const modelNoise = rng.normal(0, 0.045 + bank.modelUncertainty * 0.055 + beliefUncertainty(bank, 'creditStress') * 0.035);
  const latentRisk = -1.65 + borrowerFragility + perceivedCreditStress * 0.72 + kindAdjustment + modelNoise;
  const rawDefaultProbability = clamp(logistic(latentRisk), 0.01, 0.92);
  const calibratedDefaultProbability = clamp(
    rawDefaultProbability * cognition.worldModel.creditRiskCalibration,
    0.008,
    0.94
  );
  const historicalDefault = analogicalForecast(bank, 'creditDefaultRate', currentState, calibratedDefaultProbability, 5);
  const causalDefault = causalForecast(bank, 'creditDefaultRate', currentState, calibratedDefaultProbability);
  const estimatedDefaultProbability = clamp(
    blend(calibratedDefaultProbability, [
      { ...historicalDefault, maxWeight: 0.14 },
      { ...causalDefault, maxWeight: 0.12 }
    ]),
    0.006,
    0.95
  );

  const currentCapitalRatio = bankState.assets > 0 ? bankState.equity / bankState.assets : 1;
  const projectedCapitalRatio = (bankState.assets + amount) > 0
    ? bankState.equity / (bankState.assets + amount)
    : currentCapitalRatio;
  const capitalHeadroom = projectedCapitalRatio - bank.minCapitalRatio;
  const riskLimit = clamp(0.30 - bank.riskAversion * 0.085 + bank.optimism * 0.025, 0.12, 0.34);

  const annualRate = clamp(
    bank.baseAnnualRate +
    bank.loanMarkup +
    estimatedDefaultProbability * 0.13 +
    Math.max(0, -capitalHeadroom) * 0.7,
    0.025,
    0.36
  );
  const paymentBurden = (amount / Math.max(6, application.termMonths || 24)) / incomeBase + annualRate / 12 * debt / incomeBase;
  const affordabilityLimit = borrower.kind === 'household' ? 0.34 : 0.48;
  const affordable = paymentBurden <= affordabilityLimit;
  const capitalSafe = projectedCapitalRatio >= bank.minCapitalRatio;
  const riskAcceptable = estimatedDefaultProbability <= riskLimit;

  const candidates = [
    { name: '대출 승인', approved: true },
    { name: '대출 거절', approved: false }
  ];
  const evaluated = counterfactualPlan(bank, candidates, (candidate, env) => {
    const horizonYears = Math.max(0.5, env.horizon / 12);
    const pdShock = env.shock * (0.025 + beliefUncertainty(bank, 'creditStress') * 0.055);
    const pd = clamp(estimatedDefaultProbability + pdShock + perceivedCreditStress * Math.max(0, env.shock) * 0.03, 0.005, 0.98);
    const lgd = borrower.kind === 'household' ? 0.62 : 0.48;
    const expectedInterest = amount * annualRate * horizonYears * (1 - pd * 0.45);
    const expectedLoss = amount * pd * lgd;
    const capitalCost = amount * Math.max(0, bank.minCapitalRatio - capitalHeadroom) * 0.11;
    const liquidityCost = amount * Math.max(0, 0.12 - currentCapitalRatio) * 0.04;
    const opportunityCost = amount * Math.max(0.006, annualRate * 0.16);
    const utility = candidate.approved
      ? (expectedInterest - expectedLoss - capitalCost - liquidityCost) / Math.max(1, amount) - pd * bank.riskAversion * 0.18
      : expectedLoss / Math.max(1, amount) * 0.22 - opportunityCost / Math.max(1, amount);
    return {
      utility,
      outcomes: { pd, expectedInterest, expectedLoss, capitalCost, projectedCapitalRatio }
    };
  }, rng, { horizon: Math.min(12, cognition.profile.planningHorizon) });
  evaluated.sort((a, b) => b.cognitiveUtility - a.cognitiveUtility);
  const preferred = evaluated[0];
  const hardConstraints = amount > 0 && affordable && capitalSafe;
  const approved = hardConstraints && riskAcceptable && preferred.approved;

  if (!cognition.pendingForecasts.some(x => x.metric === 'creditDefaultRate' && x.createdMonth === month)) {
    registerForecast(bank, 'creditDefaultRate', estimatedDefaultProbability, month, 1, {
      parameter: 'creditRiskCalibration',
      predictor: Math.max(0.05, rawDefaultProbability)
    });
  }

  const memoryAnalogies = retrieveAnalogies(bank, currentState, 5);
  const trace = {
    borrowerId: borrower.id,
    borrowerKind: borrower.kind,
    requestedAmount: amount,
    perception: {
      debtToIncome,
      requestedToIncome,
      liquidityMonths,
      arrearsRatio,
      macroStress: perceivedCreditStress,
      currentCapitalRatio
    },
    hypotheses: topHypotheses(bank, 5),
    memoryReasoning: {
      analogies: compactAnalogies(memoryAnalogies),
      historicalDefaultRate: { value: historicalDefault.value, confidence: historicalDefault.confidence }
    },
    causalReasoning: {
      defaultForecast: { value: causalDefault.value, confidence: causalDefault.confidence },
      explanations: causalExplanations(bank, 'creditDefaultRate', currentState, 6)
    },
    worldModel: {
      creditRiskCalibration: cognition.worldModel.creditRiskCalibration,
      demandPersistence: cognition.worldModel.demandPersistence,
      externalRiskSensitivity: cognition.worldModel.externalRiskSensitivity
    },
    cognition: {
      attention: { ...cognition.attention },
      planningHorizon: preferred.counterfactual.horizon,
      calibration: structuredClone(cognition.calibration)
    },
    counterfactuals: evaluated.map(x => ({
      name: x.name,
      utility: x.cognitiveUtility,
      expectedUtility: x.counterfactual.expectedUtility,
      downside: x.counterfactual.downside,
      variance: x.counterfactual.variance
    })),
    forecast: {
      rawDefaultProbability,
      calibratedDefaultProbability,
      estimatedDefaultProbability,
      projectedCapitalRatio,
      paymentBurden,
      annualRate
    },
    constraints: { affordable, capitalSafe, riskAcceptable, riskLimit, affordabilityLimit },
    selected: approved ? '대출 승인' : '대출 거절',
    reason: !capitalSafe
      ? '은행 자본제약'
      : !affordable
        ? '차주 상환부담 과다'
        : !riskAcceptable
          ? '과거 부도국면과 학습된 신용위험을 반영한 부도확률이 한도 초과'
          : !preferred.approved
            ? '승인·거절 반사실적 비교에서 거절의 위험조정 가치가 더 큼'
            : memoryAnalogies.length
              ? '유사 신용국면·인과위험·반사실적 수익을 결합했을 때 승인 가치가 더 큼'
              : '승인 시나리오의 위험조정 기대수익이 더 큼'
  };

  const result = {
    approved,
    annualRate,
    monthlyRate: annualRate / 12,
    estimatedDefaultProbability,
    projectedCapitalRatio,
    paymentBurden,
    trace
  };
  recordDecision(bank, { selected: trace.selected, trace }, month);
  return result;
}
