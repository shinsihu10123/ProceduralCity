import { clamp } from '../core/rng.js';

export function governmentDecision(government, signals, fiscalState, rng) {
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