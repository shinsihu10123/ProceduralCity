import { clamp } from '../core/rng.js';

function logistic(x) {
  return 1 / (1 + Math.exp(-x));
}

export function evaluateCreditApplication(bank, borrower, application, bankState, signals, rng) {
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
