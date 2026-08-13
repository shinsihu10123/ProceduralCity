import { clamp } from '../core/rng.js';
import {
  beliefMean,
  beliefUncertainty,
  counterfactualPlan,
  recordDecision,
  registerForecast,
  topHypotheses
} from './cognitive-core.js';

function legacyCentralBankDecision(centralBank, signals, financialState, rng) {
  const perceivedInflation = signals.inflation + rng.normal(0, 0.003 + centralBank.modelUncertainty * 0.004);
  const perceivedUnemployment = clamp(
    signals.unemployment + rng.normal(0, 0.004 + centralBank.modelUncertainty * 0.006),
    0,
    1
  );
  const perceivedCreditStress = clamp(
    financialState.creditStress + rng.normal(0, 0.025 + centralBank.modelUncertainty * 0.025),
    0,
    1.5
  );
  const perceivedBankStress = clamp(
    financialState.bankStress + rng.normal(0, 0.02 + centralBank.modelUncertainty * 0.02),
    0,
    1.5
  );
  const perceivedAssetGap = clamp(
    financialState.assetMomentum + rng.normal(0, 0.018 + centralBank.modelUncertainty * 0.02),
    -0.8,
    0.8
  );

  const inflationGap = perceivedInflation - centralBank.inflationTarget;
  const unemploymentGap = perceivedUnemployment - centralBank.unemploymentReference;
  const financialStress = perceivedCreditStress * 0.55 + perceivedBankStress * 0.45;

  const easingUtility =
    unemploymentGap * 2.15 +
    financialStress * 1.65 -
    Math.max(0, inflationGap) * 2.6 -
    Math.max(0, perceivedAssetGap) * centralBank.financialStabilityWeight * 0.45 +
    centralBank.growthPreference * 0.16 +
    rng.normal(0, 0.025);

  const tighteningUtility =
    inflationGap * 2.75 +
    Math.max(0, perceivedAssetGap) * centralBank.financialStabilityWeight * 0.62 -
    unemploymentGap * 1.45 -
    financialStress * 1.55 +
    centralBank.inflationAversion * 0.12 +
    rng.normal(0, 0.025);

  const neutralUtility =
    0.16 -
    Math.abs(inflationGap) * 1.2 -
    Math.abs(unemploymentGap) * 0.65 -
    financialStress * 0.55 +
    rng.normal(0, 0.018);

  const candidates = [
    { name: '완화', utility: easingUtility },
    { name: '중립', utility: neutralUtility },
    { name: '긴축', utility: tighteningUtility }
  ].sort((a, b) => b.utility - a.utility);

  const selected = candidates[0].name;
  const neutralRate = centralBank.neutralRate;
  const taylorSignal =
    centralBank.inflationResponse * inflationGap -
    centralBank.unemploymentResponse * unemploymentGap;
  const stanceAdjustment = selected === '완화' ? -0.0045 : selected === '긴축' ? 0.0045 : 0;
  const stressAdjustment = financialStress > 0.42 ? -Math.min(0.012, (financialStress - 0.42) * 0.035) : 0;
  const desiredRate = clamp(
    neutralRate + taylorSignal + stanceAdjustment + stressAdjustment,
    centralBank.rateFloor,
    centralBank.rateCeiling
  );
  const policyRate = clamp(
    centralBank.policyRate * centralBank.rateSmoothing + desiredRate * (1 - centralBank.rateSmoothing),
    centralBank.rateFloor,
    centralBank.rateCeiling
  );

  return {
    selected,
    policyRate,
    desiredRate,
    trace: {
      perception: {
        inflation: perceivedInflation,
        unemployment: perceivedUnemployment,
        creditStress: perceivedCreditStress,
        bankStress: perceivedBankStress,
        assetMomentum: perceivedAssetGap
      },
      gaps: { inflationGap, unemploymentGap, financialStress },
      candidates,
      forecast: {
        neutralRate,
        desiredRate,
        policyRate,
        emergencyLiquidityBias: financialStress > 0.45
      },
      selected,
      reason:
        selected === '완화'
          ? '고용·신용·금융안정 위험의 가중치가 더 큼'
          : selected === '긴축'
            ? '물가·자산가격 과열 위험의 가중치가 더 큼'
            : '물가·고용·금융 위험이 중립범위에 가까움'
    }
  };
}

export function centralBankDecision(centralBank, signals, financialState, rng) {
  if (!centralBank.cognition?.enabled) return legacyCentralBankDecision(centralBank, signals, financialState, rng);

  const cognition = centralBank.cognition;
  const month = Number(cognition.lastObservation?.month || 0);
  const perceivedInflation =
    Number(signals.inflation || 0) * 0.46 +
    beliefMean(centralBank, 'inflation', signals.inflation) * 0.54 +
    rng.normal(0, 0.0015 + beliefUncertainty(centralBank, 'inflation') * 0.008);
  const perceivedUnemployment = clamp(
    Number(signals.unemployment || 0) * 0.48 +
    beliefMean(centralBank, 'unemployment', signals.unemployment) * 0.52 +
    rng.normal(0, 0.002 + beliefUncertainty(centralBank, 'unemployment') * 0.008),
    0,
    1
  );
  const perceivedCreditStress = clamp(
    Number(financialState.creditStress || 0) * 0.58 +
    beliefMean(centralBank, 'creditStress', financialState.creditStress) * 0.42 +
    rng.normal(0, 0.010 + beliefUncertainty(centralBank, 'creditStress') * 0.018),
    0,
    1.5
  );
  const perceivedBankStress = clamp(
    Number(financialState.bankStress || 0) + rng.normal(0, 0.012 + centralBank.modelUncertainty * 0.012),
    0,
    1.5
  );
  const perceivedAssetGap = clamp(
    Number(financialState.assetMomentum || 0) + rng.normal(0, 0.010 + centralBank.modelUncertainty * 0.012),
    -0.8,
    0.8
  );

  const inflationGap = perceivedInflation - centralBank.inflationTarget;
  const unemploymentGap = perceivedUnemployment - centralBank.unemploymentReference;
  const financialStress = perceivedCreditStress * 0.55 + perceivedBankStress * 0.45;
  const neutralRate = centralBank.neutralRate;
  const taylorSignal =
    centralBank.inflationResponse * inflationGap -
    centralBank.unemploymentResponse * unemploymentGap;
  const baselineDesiredRate = clamp(neutralRate + taylorSignal, centralBank.rateFloor, centralBank.rateCeiling);

  const candidates = [
    { name: '강한 완화', rateShift: -0.012 },
    { name: '완화', rateShift: -0.005 },
    { name: '중립', rateShift: 0 },
    { name: '긴축', rateShift: 0.005 },
    { name: '강한 긴축', rateShift: 0.012 }
  ];

  const evaluated = counterfactualPlan(centralBank, candidates, (candidate, env) => {
    const horizonYears = Math.max(0.25, env.horizon / 12);
    const proposedRate = clamp(baselineDesiredRate + candidate.rateShift, centralBank.rateFloor, centralBank.rateCeiling);
    const rateGap = proposedRate - neutralRate;
    const macroShock = env.shock * (0.004 + beliefUncertainty(centralBank, 'inflation') * 0.010);
    const projectedInflation = clamp(
      centralBank.inflationTarget +
      inflationGap * Math.pow(clamp(env.model.inflationPersistence, 0, 1.1), Math.max(1, env.horizon / 3)) +
      env.model.rateInflationTransmission * rateGap * horizonYears +
      macroShock,
      -0.15,
      0.50
    );
    const projectedUnemployment = clamp(
      centralBank.unemploymentReference +
      unemploymentGap * Math.pow(clamp(env.model.unemploymentPersistence, 0, 1.1), Math.max(1, env.horizon / 3)) -
      env.model.rateDemandTransmission * rateGap * horizonYears * 0.045 -
      macroShock * 0.55,
      0,
      0.45
    );
    const projectedCreditStress = clamp(
      financialStress + Math.max(0, rateGap) * 3.2 - Math.max(0, -rateGap) * 2.2 + env.shock * 0.025,
      0,
      1.5
    );
    const projectedAssetPressure = clamp(perceivedAssetGap - rateGap * 2.6 + env.shock * 0.02, -0.8, 0.8);
    const inflationLoss = Math.abs(projectedInflation - centralBank.inflationTarget) * (2.0 + centralBank.inflationAversion * 1.6);
    const employmentLoss = Math.abs(projectedUnemployment - centralBank.unemploymentReference) * (1.5 + centralBank.growthPreference * 1.2);
    const stabilityLoss = projectedCreditStress * centralBank.financialStabilityWeight * 0.72 + Math.max(0, projectedAssetPressure) * centralBank.financialStabilityWeight * 0.28;
    const rateChangeCost = Math.abs(proposedRate - centralBank.policyRate) * 1.8;
    const utility = -(inflationLoss + employmentLoss + stabilityLoss + rateChangeCost);
    return {
      utility,
      outcomes: { proposedRate, projectedInflation, projectedUnemployment, projectedCreditStress, projectedAssetPressure }
    };
  }, rng, { horizon: Math.max(6, cognition.profile.planningHorizon) });
  evaluated.sort((a, b) => b.cognitiveUtility - a.cognitiveUtility);
  const selectedPlan = evaluated[0];
  const baseScenario = selectedPlan.counterfactual.scenarios.reduce((best, row) => Math.abs(row.shock) < Math.abs(best.shock) ? row : best, selectedPlan.counterfactual.scenarios[0]);
  const desiredRate = clamp(Number(baseScenario.outcomes?.proposedRate ?? baselineDesiredRate), centralBank.rateFloor, centralBank.rateCeiling);
  const stressAdjustment = financialStress > 0.55 ? -Math.min(0.010, (financialStress - 0.55) * 0.024) : 0;
  const adjustedDesiredRate = clamp(desiredRate + stressAdjustment, centralBank.rateFloor, centralBank.rateCeiling);
  const policyRate = clamp(
    centralBank.policyRate * centralBank.rateSmoothing + adjustedDesiredRate * (1 - centralBank.rateSmoothing),
    centralBank.rateFloor,
    centralBank.rateCeiling
  );
  const selected = selectedPlan.name.includes('완화') ? '완화' : selectedPlan.name.includes('긴축') ? '긴축' : '중립';

  const oneMonthInflationForecast = clamp(
    perceivedInflation * cognition.worldModel.inflationPersistence +
    cognition.worldModel.rateInflationTransmission * (policyRate - centralBank.policyRate),
    -0.15,
    0.45
  );
  const oneMonthUnemploymentForecast = clamp(
    perceivedUnemployment * cognition.worldModel.unemploymentPersistence -
    cognition.worldModel.rateDemandTransmission * (policyRate - centralBank.policyRate) * 0.035,
    0,
    0.45
  );
  registerForecast(centralBank, 'inflation', oneMonthInflationForecast, month, 1, {
    parameter: 'rateInflationTransmission',
    predictor: policyRate - centralBank.policyRate
  });
  registerForecast(centralBank, 'unemployment', oneMonthUnemploymentForecast, month, 1, {
    parameter: 'rateDemandTransmission',
    predictor: policyRate - centralBank.policyRate
  });
  registerForecast(centralBank, 'creditStress', perceivedCreditStress, month, 1);

  const trace = {
    perception: {
      inflation: perceivedInflation,
      unemployment: perceivedUnemployment,
      creditStress: perceivedCreditStress,
      bankStress: perceivedBankStress,
      assetMomentum: perceivedAssetGap
    },
    hypotheses: topHypotheses(centralBank, 6),
    gaps: { inflationGap, unemploymentGap, financialStress },
    worldModel: {
      inflationPersistence: cognition.worldModel.inflationPersistence,
      unemploymentPersistence: cognition.worldModel.unemploymentPersistence,
      rateInflationTransmission: cognition.worldModel.rateInflationTransmission,
      rateDemandTransmission: cognition.worldModel.rateDemandTransmission
    },
    cognition: {
      attention: { ...cognition.attention },
      planningHorizon: selectedPlan.counterfactual.horizon,
      calibration: structuredClone(cognition.calibration)
    },
    candidates: evaluated.map(x => ({
      name: x.name,
      rateShift: x.rateShift,
      utility: x.cognitiveUtility,
      expectedUtility: x.counterfactual.expectedUtility,
      downside: x.counterfactual.downside,
      variance: x.counterfactual.variance,
      baseOutcome: x.counterfactual.scenarios.find(s => Math.abs(s.shock) < 1e-9)?.outcomes || null
    })),
    forecast: {
      neutralRate,
      baselineDesiredRate,
      desiredRate: adjustedDesiredRate,
      policyRate,
      oneMonthInflation: oneMonthInflationForecast,
      oneMonthUnemployment: oneMonthUnemploymentForecast,
      emergencyLiquidityBias: financialStress > 0.55
    },
    selected,
    selectedPlan: selectedPlan.name,
    reason: `${selectedPlan.counterfactual.horizon}개월 정책경로의 물가·고용·금융안정 손실을 비교해 ${selectedPlan.name} 선택`
  };

  const decision = { selected, policyRate, desiredRate: adjustedDesiredRate, trace };
  recordDecision(centralBank, decision, month);
  return decision;
}
