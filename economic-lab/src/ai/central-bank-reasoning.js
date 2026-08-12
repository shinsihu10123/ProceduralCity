import { clamp } from '../core/rng.js';

export function centralBankDecision(centralBank, signals, financialState, rng) {
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
