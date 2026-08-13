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

function legacyEvaluateForeignFunding({ lenderCountry, borrowerCountry, lenderBank, borrowerBank, requestedWXU, accounting, rng }) {
  const gl = accounting.gl;
  const borrowerBS = gl.balanceSheet(borrowerBank.id);
  const lenderBS = gl.balanceSheet(lenderBank.id);
  const borrowerPosition = borrowerCountry.internationalPosition || {};
  const borrowerGDPWXU = Math.max(1, Number(borrowerCountry.macro?.gdp || 0) / Math.max(0.05, borrowerCountry.fx?.rate || 1));
  const foreignDebt = Math.max(0, Number(borrowerPosition.payablesWXU || 0) + Number(borrowerPosition.borrowingWXU || 0));
  const externalDebtRatio = foreignDebt / Math.max(1, borrowerGDPWXU * 12);
  const capitalRatio = borrowerBS.assets > 0 ? Math.max(0, borrowerBS.equity) / borrowerBS.assets : 1;
  const lenderCapitalRatio = lenderBS.assets > 0 ? Math.max(0, lenderBS.equity) / lenderBS.assets : 1;
  const depreciation = Math.max(0, Number(borrowerCountry.fx?.lastChange || 0));
  const currentAccountDeficit = Math.max(0, -Number(borrowerCountry.lastInternational?.currentAccountWXU || 0));
  const currentAccountStress = currentAccountDeficit / Math.max(1, borrowerGDPWXU);
  const modelNoise = rng.normal(0, 0.055 + lenderBank.modelUncertainty * 0.035);

  const riskScore =
    externalDebtRatio * 1.25 +
    currentAccountStress * 0.85 +
    depreciation * 2.2 +
    Math.max(0, borrowerBank.minCapitalRatio * 1.1 - capitalRatio) * 5.5 +
    modelNoise;

  const estimatedDefaultProbability = clamp(0.035 + riskScore * 0.34, 0.01, 0.78);
  const rateSpread = Math.max(0, Number(borrowerCountry.macro?.policyRate || 0) - Number(lenderCountry.macro?.policyRate || 0));
  const expectedReturn = rateSpread + 0.018 + estimatedDefaultProbability * 0.065;
  const riskLimit = clamp(0.29 - lenderBank.riskAversion * 0.10 + lenderBank.optimism * 0.025, 0.12, 0.31);
  const lenderCapacity = lenderCapitalRatio > lenderBank.minCapitalRatio * 1.08;
  const approved = requestedWXU > 0 && lenderCapacity && estimatedDefaultProbability <= riskLimit;
  const annualRate = clamp(
    Math.max(0.012, Number(lenderCountry.macro?.policyRate || 0)) + 0.014 + estimatedDefaultProbability * 0.11,
    0.015,
    0.28
  );

  return {
    approved,
    annualRate,
    estimatedDefaultProbability,
    trace: {
      lenderCountryId: lenderCountry.id,
      borrowerCountryId: borrowerCountry.id,
      requestedWXU,
      perception: {
        externalDebtRatio,
        currentAccountStress,
        depreciation,
        borrowerCapitalRatio: capitalRatio,
        lenderCapitalRatio
      },
      forecast: { estimatedDefaultProbability, expectedReturn, annualRate },
      constraints: { riskLimit, lenderCapacity },
      selected: approved ? '해외자금 공급' : '해외자금 거절',
      reason: !lenderCapacity ? '대주은행 자본여력 부족' : estimatedDefaultProbability > riskLimit ? '대외부도위험 과다' : '위험조정수익 허용'
    }
  };
}

export function evaluateForeignFunding(args) {
  const { lenderCountry, borrowerCountry, lenderBank, borrowerBank, requestedWXU, accounting, rng } = args;
  if (!lenderBank.cognition?.enabled) return legacyEvaluateForeignFunding(args);

  const cognition = lenderBank.cognition;
  const month = Number(cognition.lastObservation?.month || 0);
  const gl = accounting.gl;
  const borrowerBS = gl.balanceSheet(borrowerBank.id);
  const lenderBS = gl.balanceSheet(lenderBank.id);
  const borrowerPosition = borrowerCountry.internationalPosition || {};
  const borrowerGDPWXU = Math.max(1, Number(borrowerCountry.macro?.gdp || 0) / Math.max(0.05, borrowerCountry.fx?.rate || 1));
  const foreignDebt = Math.max(0, Number(borrowerPosition.payablesWXU || 0) + Number(borrowerPosition.foreignBorrowingWXU || borrowerPosition.borrowingWXU || 0));
  const externalDebtRatio = foreignDebt / Math.max(1, borrowerGDPWXU * 12);
  const capitalRatio = borrowerBS.assets > 0 ? Math.max(0, borrowerBS.equity) / borrowerBS.assets : 1;
  const lenderCapitalRatio = lenderBS.assets > 0 ? Math.max(0, lenderBS.equity) / lenderBS.assets : 1;
  const depreciation = Math.max(0, Number(borrowerCountry.fx?.lastChange || 0));
  const currentAccountWXU = Number(borrowerCountry.lastInternational?.currentAccountWXU || 0);
  const currentAccountDeficit = Math.max(0, -currentAccountWXU);
  const currentAccountStress = currentAccountDeficit / Math.max(1, borrowerGDPWXU);

  const currentState = {
    ...(cognition.lastObservation || {}),
    month,
    externalStress: Number(borrowerCountry.macro?.externalStress || 0),
    exchangeRateChange: Number(borrowerCountry.fx?.lastChange || 0),
    currentAccountWXU,
    unemployment: Number(borrowerCountry.macro?.unemployment || 0),
    creditStress: Number(borrowerCountry.lastMonetary?.creditStress || 0),
    policyRate: Number(borrowerCountry.macro?.policyRate || 0)
  };

  const rawExternalStress = clamp(
    externalDebtRatio * 0.55 + currentAccountStress * 0.45 + depreciation * 1.8 + beliefMean(lenderBank, 'externalStress', 0) * 0.35,
    0,
    1.8
  );
  const externalMemory = analogicalForecast(lenderBank, 'externalStress', currentState, rawExternalStress, 5);
  const externalCausal = causalForecast(lenderBank, 'externalStress', currentState, rawExternalStress);
  const observedExternalStress = clamp(
    blend(rawExternalStress, [
      { ...externalMemory, maxWeight: 0.28 },
      { ...externalCausal, maxWeight: 0.20 }
    ]),
    0,
    2
  );

  const modelNoise = rng.normal(0, 0.025 + lenderBank.modelUncertainty * 0.025 + beliefUncertainty(lenderBank, 'externalStress') * 0.025);
  const riskScore = (
    externalDebtRatio * 1.25 +
    currentAccountStress * 0.85 +
    depreciation * 2.2 +
    observedExternalStress * 0.55 +
    Math.max(0, borrowerBank.minCapitalRatio * 1.1 - capitalRatio) * 5.5
  ) * cognition.worldModel.externalRiskSensitivity + modelNoise;
  const rawDefaultProbability = clamp(0.035 + riskScore * 0.34, 0.01, 0.84);
  const calibratedDefaultProbability = clamp(rawDefaultProbability * cognition.worldModel.creditRiskCalibration, 0.008, 0.90);
  const defaultMemory = analogicalForecast(lenderBank, 'creditDefaultRate', currentState, calibratedDefaultProbability, 5);
  const defaultCausal = causalForecast(lenderBank, 'creditDefaultRate', currentState, calibratedDefaultProbability);
  const estimatedDefaultProbability = clamp(
    blend(calibratedDefaultProbability, [
      { ...defaultMemory, maxWeight: 0.14 },
      { ...defaultCausal, maxWeight: 0.12 }
    ]),
    0.006,
    0.92
  );

  const rateSpread = Number(borrowerCountry.macro?.policyRate || 0) - Number(lenderCountry.macro?.policyRate || 0);
  const riskLimit = clamp(0.29 - lenderBank.riskAversion * 0.10 + lenderBank.optimism * 0.025, 0.12, 0.31);
  const lenderCapacity = lenderCapitalRatio > lenderBank.minCapitalRatio * 1.08;
  const annualRate = clamp(
    Math.max(0.012, Number(lenderCountry.macro?.policyRate || 0)) + 0.014 + estimatedDefaultProbability * 0.11 + depreciation * 0.08,
    0.015,
    0.30
  );

  const candidates = [
    { name: '해외자금 공급', approved: true },
    { name: '해외자금 거절', approved: false }
  ];
  const evaluated = counterfactualPlan(lenderBank, candidates, (candidate, env) => {
    const horizonYears = Math.max(0.5, env.horizon / 12);
    const stressShock = env.shock * (0.035 + beliefUncertainty(lenderBank, 'externalStress') * 0.06);
    const futureStress = clamp(observedExternalStress + stressShock + depreciation * horizonYears * 0.2, 0, 2);
    const pd = clamp(estimatedDefaultProbability + futureStress * 0.05 * cognition.worldModel.externalRiskSensitivity, 0.005, 0.97);
    const expectedInterest = requestedWXU * annualRate * horizonYears * (1 - pd * 0.45);
    const expectedLoss = requestedWXU * pd * 0.58;
    const capitalCost = requestedWXU * Math.max(0, lenderBank.minCapitalRatio * 1.15 - lenderCapitalRatio) * 0.20;
    const diversificationBenefit = requestedWXU * Math.max(-0.01, rateSpread) * 0.25;
    const systemicPenalty = futureStress * requestedWXU * lenderBank.riskAversion * 0.035;
    const utility = candidate.approved
      ? (expectedInterest + diversificationBenefit - expectedLoss - capitalCost - systemicPenalty) / Math.max(1, requestedWXU)
      : expectedLoss / Math.max(1, requestedWXU) * 0.18 - Math.max(0, rateSpread) * 0.08;
    return {
      utility,
      outcomes: { pd, futureStress, expectedInterest, expectedLoss, capitalCost }
    };
  }, rng, { horizon: Math.max(6, cognition.profile.planningHorizon) });
  evaluated.sort((a, b) => b.cognitiveUtility - a.cognitiveUtility);
  const preferred = evaluated[0];
  const approved = requestedWXU > 0 && lenderCapacity && estimatedDefaultProbability <= riskLimit && preferred.approved;

  if (!cognition.pendingForecasts.some(x => x.metric === 'creditDefaultRate' && x.createdMonth === month)) {
    registerForecast(lenderBank, 'creditDefaultRate', estimatedDefaultProbability, month, 1, {
      parameter: 'creditRiskCalibration',
      predictor: Math.max(0.05, rawDefaultProbability)
    });
  }

  const expectedReturn = rateSpread + annualRate - estimatedDefaultProbability * 0.58;
  const memoryAnalogies = retrieveAnalogies(lenderBank, currentState, 5);
  const trace = {
    lenderCountryId: lenderCountry.id,
    borrowerCountryId: borrowerCountry.id,
    requestedWXU,
    perception: {
      externalDebtRatio,
      currentAccountStress,
      depreciation,
      rawExternalStress,
      observedExternalStress,
      borrowerCapitalRatio: capitalRatio,
      lenderCapitalRatio
    },
    hypotheses: topHypotheses(lenderBank, 6),
    memoryReasoning: {
      analogies: compactAnalogies(memoryAnalogies),
      externalStressForecast: { value: externalMemory.value, confidence: externalMemory.confidence },
      defaultRateForecast: { value: defaultMemory.value, confidence: defaultMemory.confidence }
    },
    causalReasoning: {
      externalStress: {
        forecast: { value: externalCausal.value, confidence: externalCausal.confidence },
        explanations: causalExplanations(lenderBank, 'externalStress', currentState, 6)
      },
      defaultRisk: {
        forecast: { value: defaultCausal.value, confidence: defaultCausal.confidence },
        explanations: causalExplanations(lenderBank, 'creditDefaultRate', currentState, 6)
      }
    },
    worldModel: {
      externalRiskSensitivity: cognition.worldModel.externalRiskSensitivity,
      creditRiskCalibration: cognition.worldModel.creditRiskCalibration
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
      expectedReturn,
      annualRate
    },
    constraints: { riskLimit, lenderCapacity },
    selected: approved ? '해외자금 공급' : '해외자금 거절',
    reason: !lenderCapacity
      ? '대주은행 자본여력 부족'
      : estimatedDefaultProbability > riskLimit
        ? '과거 대외위기 경험과 학습된 외부위험을 반영한 부도위험이 한도 초과'
        : !preferred.approved
          ? '해외대출·거절 반사실적 비교에서 거절 가치가 더 큼'
          : memoryAnalogies.length
            ? '유사 대외위기 경험·인과위험·반사실적 수익을 결합했을 때 해외대출 가치가 더 큼'
            : '국제대출의 위험조정 기대수익이 더 큼'
  };
  const result = { approved, annualRate, estimatedDefaultProbability, trace };
  recordDecision(lenderBank, { selected: trace.selected, trace }, month);
  return result;
}
