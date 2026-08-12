import { clamp } from '../core/rng.js';

export function evaluateForeignFunding({ lenderCountry, borrowerCountry, lenderBank, borrowerBank, requestedWXU, accounting, rng }) {
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
