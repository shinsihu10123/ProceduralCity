import { clamp } from '../core/rng.js';
import {
  beliefMean,
  beliefUncertainty,
  counterfactualPlan,
  recordDecision,
  registerForecast,
  topHypotheses
} from './cognitive-core.js';

function legacyGovernmentDecision(government, signals, fiscalState, rng) {
  const unemployment = clamp(Number(signals.unemployment || 0), 0, 1);
  const inflation = Number(signals.inflation || 0);
  const debtRatio = Math.max(0, Number(fiscalState.debtRatio || 0));
  const priorBalanceRatio = Number(fiscalState.priorBalanceRatio || 0);

  const perceivedUnemployment = clamp(
    unemployment + rng.normal(0, 0.004 + government.modelUncertainty * 0.012),
    0,
    1
  );
  const perceivedInflation = inflation + rng.normal(0, 0.002 + government.modelUncertainty * 0.006);
  const perceivedDebtRatio = Math.max(0, debtRatio * (1 + rng.normal(0, 0.02 + government.modelUncertainty * 0.05)));

  const unemploymentGap = perceivedUnemployment - government.unemploymentReference;
  const inflationGap = perceivedInflation - government.inflationReference;
  const debtPressure = Math.max(0, perceivedDebtRatio - government.debtComfortRatio);
  const deficitPressure = Math.max(0, -priorBalanceRatio - 0.015);

  const expansionScore =
    unemploymentGap * (5.0 + government.stabilizerStrength * 2.2)
    - inflationGap * 3.2
    - debtPressure * 0.85
    + government.growthPreference * 0.16
    + government.optimism * 0.08
    + rng.normal(0, government.modelUncertainty * 0.08);

  const consolidationScore =
    inflationGap * 4.2
    + debtPressure * (1.0 + government.debtAversion)
    + deficitPressure * 1.8
    - unemploymentGap * 2.8
    + government.debtAversion * 0.08
    + rng.normal(0, government.modelUncertainty * 0.07);

  const neutralScore = 0.09 - Math.abs(unemploymentGap) * 0.8 - Math.abs(inflationGap) * 1.2 + rng.normal(0, 0.025);
  const candidates = [
    { name: '확장', utility: expansionScore },
    { name: '중립', utility: neutralScore },
    { name: '재정건전화', utility: consolidationScore }
  ].sort((a, b) => b.utility - a.utility);

  const selected = candidates[0].name;
  let spendingMultiplier = 1;
  let investmentMultiplier = 1;
  let taxShift = 0;
  if (selected === '확장') {
    spendingMultiplier = 1.16 + clamp(unemploymentGap, 0, 0.12) * 1.4;
    investmentMultiplier = 1.22 + clamp(unemploymentGap, 0, 0.12) * 1.2;
    taxShift = -0.008;
  } else if (selected === '재정건전화') {
    spendingMultiplier = clamp(0.86 - debtPressure * 0.10, 0.72, 0.90);
    investmentMultiplier = clamp(0.90 - debtPressure * 0.08, 0.76, 0.94);
    taxShift = 0.009;
  }

  const incomeTaxRate = clamp(government.baseIncomeTaxRate + taxShift, 0.03, 0.28);
  const consumptionTaxRate = clamp(government.baseConsumptionTaxRate + taxShift * 0.45, 0.01, 0.18);
  const corporateTaxRate = clamp(government.baseCorporateTaxRate + taxShift * 0.75, 0.05, 0.30);
  const benefitReplacementRate = clamp(
    government.baseBenefitReplacementRate * (selected === '확장' ? 1.12 : selected === '재정건전화' ? 0.92 : 1),
    0.18,
    0.62
  );

  const trace = {
    perception: {
      unemployment: perceivedUnemployment,
      inflation: perceivedInflation,
      debtRatio: perceivedDebtRatio,
      priorBalanceRatio
    },
    gaps: { unemploymentGap, inflationGap, debtPressure, deficitPressure },
    candidates: candidates.map(x => ({ ...x })),
    selected,
    policy: {
      spendingMultiplier,
      investmentMultiplier,
      incomeTaxRate,
      consumptionTaxRate,
      corporateTaxRate,
      benefitReplacementRate
    },
    reason: selected === '확장'
      ? '실업·수요 약화 위험이 물가·부채 제약보다 크게 평가됨'
      : selected === '재정건전화'
        ? '물가·부채·적자 압력이 경기부양 필요보다 크게 평가됨'
        : '경기안정과 재정제약이 대체로 균형 상태로 평가됨'
  };

  return { ...trace.policy, selected, trace };
}

export function governmentDecision(government, signals, fiscalState, rng) {
  if (!government.cognition?.enabled) return legacyGovernmentDecision(government, signals, fiscalState, rng);

  const cognition = government.cognition;
  const month = Number(cognition.lastObservation?.month || 0);
  const unemployment = clamp(Number(signals.unemployment || 0), 0, 1);
  const inflation = Number(signals.inflation || 0);
  const debtRatio = Math.max(0, Number(fiscalState.debtRatio || 0));
  const priorBalanceRatio = Number(fiscalState.priorBalanceRatio || 0);

  const perceivedUnemployment = clamp(
    unemployment * 0.48 + beliefMean(government, 'unemployment', unemployment) * 0.52 + rng.normal(0, 0.002 + beliefUncertainty(government, 'unemployment') * 0.008),
    0,
    1
  );
  const perceivedInflation =
    inflation * 0.46 + beliefMean(government, 'inflation', inflation) * 0.54 + rng.normal(0, 0.0015 + beliefUncertainty(government, 'inflation') * 0.008);
  const perceivedDebtRatio = Math.max(0, debtRatio * (1 + rng.normal(0, 0.008 + government.modelUncertainty * 0.018)));

  const unemploymentGap = perceivedUnemployment - government.unemploymentReference;
  const inflationGap = perceivedInflation - government.inflationReference;
  const debtPressure = Math.max(0, perceivedDebtRatio - government.debtComfortRatio);
  const deficitPressure = Math.max(0, -priorBalanceRatio - 0.015);

  const candidates = [
    { name: '강한 확장', spendingMultiplier: 1.28, investmentMultiplier: 1.36, taxShift: -0.012, benefitMultiplier: 1.18, impulse: 0.22 },
    { name: '확장', spendingMultiplier: 1.15, investmentMultiplier: 1.22, taxShift: -0.007, benefitMultiplier: 1.10, impulse: 0.12 },
    { name: '중립', spendingMultiplier: 1.00, investmentMultiplier: 1.00, taxShift: 0, benefitMultiplier: 1.00, impulse: 0 },
    { name: '재정건전화', spendingMultiplier: 0.88, investmentMultiplier: 0.92, taxShift: 0.008, benefitMultiplier: 0.94, impulse: -0.10 },
    { name: '강한 건전화', spendingMultiplier: 0.78, investmentMultiplier: 0.84, taxShift: 0.014, benefitMultiplier: 0.88, impulse: -0.18 }
  ];

  const evaluated = counterfactualPlan(government, candidates, (candidate, env) => {
    const horizonYears = Math.max(0.25, env.horizon / 12);
    const demandEffect = candidate.impulse * env.model.fiscalDemandMultiplier * horizonYears;
    const shock = env.shock * (0.004 + beliefUncertainty(government, 'unemployment') * 0.010);
    const projectedUnemployment = clamp(
      government.unemploymentReference +
      unemploymentGap * Math.pow(clamp(env.model.unemploymentPersistence, 0, 1.1), Math.max(1, env.horizon / 3)) -
      demandEffect * 0.12 - shock,
      0,
      0.45
    );
    const projectedInflation = clamp(
      government.inflationReference +
      inflationGap * Math.pow(clamp(env.model.inflationPersistence, 0, 1.1), Math.max(1, env.horizon / 3)) +
      candidate.impulse * env.model.fiscalInflationMultiplier * horizonYears * 0.055 +
      shock * 0.55,
      -0.15,
      0.50
    );
    const structuralDeficit = -candidate.impulse * 0.055 + candidate.taxShift * 1.4;
    const cyclicalOffset = Math.max(0, unemploymentGap) * demandEffect * 0.08;
    const projectedDebtRatio = Math.max(0, perceivedDebtRatio - structuralDeficit * horizonYears - cyclicalOffset + env.shock * 0.012);
    const employmentLoss = Math.abs(projectedUnemployment - government.unemploymentReference) * (2.0 + government.growthPreference * 1.5);
    const inflationLoss = Math.abs(projectedInflation - government.inflationReference) * 2.3;
    const debtLoss = Math.max(0, projectedDebtRatio - government.debtComfortRatio) * (0.7 + government.debtAversion * 1.15);
    const deficitLoss = Math.max(0, -priorBalanceRatio - candidate.taxShift * 0.5) * 0.8;
    const policyVolatilityCost = Math.abs(candidate.impulse) * 0.12;
    const utility = -(employmentLoss + inflationLoss + debtLoss + deficitLoss + policyVolatilityCost);
    return {
      utility,
      outcomes: { projectedUnemployment, projectedInflation, projectedDebtRatio, demandEffect }
    };
  }, rng, { horizon: Math.max(6, cognition.profile.planningHorizon) });
  evaluated.sort((a, b) => b.cognitiveUtility - a.cognitiveUtility);
  const selectedPlan = evaluated[0];
  const selected = selectedPlan.name.includes('확장') ? '확장' : selectedPlan.name.includes('건전화') ? '재정건전화' : '중립';

  const spendingMultiplier = clamp(
    selectedPlan.spendingMultiplier + (selected === '확장' ? clamp(unemploymentGap, 0, 0.12) * 0.55 : selected === '재정건전화' ? -debtPressure * 0.04 : 0),
    0.70,
    1.45
  );
  const investmentMultiplier = clamp(
    selectedPlan.investmentMultiplier + (selected === '확장' ? clamp(unemploymentGap, 0, 0.12) * 0.50 : selected === '재정건전화' ? -debtPressure * 0.03 : 0),
    0.72,
    1.55
  );
  const incomeTaxRate = clamp(government.baseIncomeTaxRate + selectedPlan.taxShift, 0.03, 0.28);
  const consumptionTaxRate = clamp(government.baseConsumptionTaxRate + selectedPlan.taxShift * 0.45, 0.01, 0.18);
  const corporateTaxRate = clamp(government.baseCorporateTaxRate + selectedPlan.taxShift * 0.75, 0.05, 0.30);
  const benefitReplacementRate = clamp(
    government.baseBenefitReplacementRate * selectedPlan.benefitMultiplier,
    0.18,
    0.62
  );

  const baseScenario = selectedPlan.counterfactual.scenarios.reduce((best, row) => Math.abs(row.shock) < Math.abs(best.shock) ? row : best, selectedPlan.counterfactual.scenarios[0]);
  const oneMonthUnemployment = clamp(
    perceivedUnemployment * cognition.worldModel.unemploymentPersistence - selectedPlan.impulse * cognition.worldModel.fiscalDemandMultiplier * 0.018,
    0,
    0.45
  );
  const oneMonthInflation = clamp(
    perceivedInflation * cognition.worldModel.inflationPersistence + selectedPlan.impulse * cognition.worldModel.fiscalInflationMultiplier * 0.010,
    -0.15,
    0.45
  );
  const oneMonthDebtRatio = Math.max(0, perceivedDebtRatio + Math.max(0, selectedPlan.impulse) * 0.004 - selectedPlan.taxShift * 0.08);

  registerForecast(government, 'unemployment', oneMonthUnemployment, month, 1, {
    parameter: 'fiscalDemandMultiplier',
    predictor: -selectedPlan.impulse * 0.018
  });
  registerForecast(government, 'inflation', oneMonthInflation, month, 1, {
    parameter: 'fiscalInflationMultiplier',
    predictor: selectedPlan.impulse * 0.010
  });
  registerForecast(government, 'debtRatio', oneMonthDebtRatio, month, 1);

  const trace = {
    perception: {
      unemployment: perceivedUnemployment,
      inflation: perceivedInflation,
      debtRatio: perceivedDebtRatio,
      priorBalanceRatio
    },
    hypotheses: topHypotheses(government, 6),
    gaps: { unemploymentGap, inflationGap, debtPressure, deficitPressure },
    worldModel: {
      fiscalDemandMultiplier: cognition.worldModel.fiscalDemandMultiplier,
      fiscalInflationMultiplier: cognition.worldModel.fiscalInflationMultiplier,
      unemploymentPersistence: cognition.worldModel.unemploymentPersistence,
      inflationPersistence: cognition.worldModel.inflationPersistence
    },
    cognition: {
      attention: { ...cognition.attention },
      planningHorizon: selectedPlan.counterfactual.horizon,
      calibration: structuredClone(cognition.calibration)
    },
    candidates: evaluated.map(x => ({
      name: x.name,
      utility: x.cognitiveUtility,
      expectedUtility: x.counterfactual.expectedUtility,
      downside: x.counterfactual.downside,
      variance: x.counterfactual.variance,
      baseOutcome: x.counterfactual.scenarios.find(s => Math.abs(s.shock) < 1e-9)?.outcomes || null
    })),
    selected,
    selectedPlan: selectedPlan.name,
    policy: {
      spendingMultiplier,
      investmentMultiplier,
      incomeTaxRate,
      consumptionTaxRate,
      corporateTaxRate,
      benefitReplacementRate
    },
    forecast: {
      oneMonthUnemployment,
      oneMonthInflation,
      oneMonthDebtRatio,
      mediumTerm: baseScenario.outcomes || null
    },
    reason: `${selectedPlan.counterfactual.horizon}개월 재정경로에서 고용·물가·부채 손실을 함께 비교해 ${selectedPlan.name} 선택`
  };

  const result = { ...trace.policy, selected, trace };
  recordDecision(government, result, month);
  return result;
}
