import { ACCOUNT_TYPES } from '../accounting/general-ledger.js';
import { clamp } from '../core/rng.js';
import { centralBankDecision } from '../ai/central-bank-reasoning.js';

const EPS = 1e-8;

const centralBankChart = [
  { code: 'legacy_assets', name: 'Legacy Monetary Assets', type: ACCOUNT_TYPES.ASSET },
  { code: 'market_securities', name: 'Open Market Securities', type: ACCOUNT_TYPES.ASSET },
  { code: 'lending_to_banks', name: 'Lending to Banks', type: ACCOUNT_TYPES.ASSET },
  { code: 'bank_reserves', name: 'Reserve Balances', type: ACCOUNT_TYPES.LIABILITY },
  { code: 'opening_equity', name: 'Opening Equity', type: ACCOUNT_TYPES.EQUITY },
  { code: 'retained_earnings', name: 'Retained Earnings', type: ACCOUNT_TYPES.EQUITY },
  { code: 'interest_income', name: 'Facility Interest Income', type: ACCOUNT_TYPES.REVENUE },
  { code: 'market_loss_expense', name: 'Market Loss Expense', type: ACCOUNT_TYPES.EXPENSE }
];

export class CentralBankSystem {
  constructor({ accounting, rng }) {
    this.accounting = accounting;
    this.rng = rng;
    this.facilitySequence = 1;
  }

  emptyMetrics() {
    return {
      policyRate: 0,
      stance: '중립',
      reserveTargetRatio: 0,
      bankReserveRatio: 0,
      reserves: 0,
      targetReserves: 0,
      openMarketPurchases: 0,
      openMarketSales: 0,
      centralBankLending: 0,
      facilityPrincipalRepaid: 0,
      facilityInterestPaid: 0,
      outstandingFacilities: 0,
      centralBankSecurities: 0,
      creditStress: 0,
      bankStress: 0,
      accountingOk: true,
      reserveReconciliationError: 0,
      facilityReconciliationError: 0,
      centralBankEquationError: 0
    };
  }

  initializeCountry(country) {
    const bank = country.banks[0];
    const gl = this.accounting.gl;
    const centralBank = {
      id: `${country.id}-CB-01`,
      countryId: country.id,
      kind: 'central_bank',
      name: `${country.name} 중앙은행`,
      inflationTarget: 0.02,
      unemploymentReference: 0.055,
      neutralRate: clamp(0.034 + (1 - country.financialAccess) * 0.008 + this.rng.normal(0, 0.002), 0.02, 0.055),
      policyRate: clamp(0.033 + (1 - country.financialAccess) * 0.009, 0.02, 0.055),
      rateFloor: 0.001,
      rateCeiling: 0.16,
      rateSmoothing: 0.68,
      inflationResponse: clamp(1.35 + this.rng.normal(0, 0.12), 1.05, 1.75),
      unemploymentResponse: clamp(0.72 + this.rng.normal(0, 0.12), 0.45, 1.05),
      inflationAversion: clamp(0.62 + this.rng.normal(0, 0.12), 0.25, 0.95),
      growthPreference: clamp(0.55 + this.rng.normal(0, 0.12), 0.25, 0.9),
      financialStabilityWeight: clamp(0.68 + this.rng.normal(0, 0.1), 0.35, 0.95),
      modelUncertainty: clamp(0.22 + this.rng.normal(0, 0.05), 0.1, 0.42),
      reserveTargetRatio: clamp(0.105 + (1 - country.financialAccess) * 0.025, 0.08, 0.15),
      lastTrace: null,
      currentPolicy: null
    };

    country.centralBanks = [centralBank];
    country.centralBankFacilities = [];
    country.centralBankOperations = [];
    country.lastMonetary = this.emptyMetrics();

    gl.addAccount(bank.id, { code: 'central_bank_borrowing', name: 'Central Bank Borrowing', type: ACCOUNT_TYPES.LIABILITY });
    gl.addAccount(bank.id, { code: 'central_bank_interest_expense', name: 'Central Bank Interest Expense', type: ACCOUNT_TYPES.EXPENSE });
    gl.createEntity({ id: centralBank.id, countryId: country.id, kind: 'central_bank', accounts: centralBankChart });

    const openingReserves = Math.max(0, gl.naturalBalance(bank.id, 'reserves'));
    if (openingReserves > EPS) {
      gl.post({
        month: 0,
        entityId: centralBank.id,
        kind: 'opening_reserve_liability',
        lines: [
          { account: 'legacy_assets', debit: openingReserves },
          { account: 'bank_reserves', credit: openingReserves }
        ],
        meta: { bankId: bank.id }
      });
    }
    this.applyPolicyTransmission(country);
    country.lastMonetary = { ...this.emptyMetrics(), ...this.snapshotMetrics(country) };
  }

  beginMonth(country, month, signals) {
    const centralBank = country.centralBanks[0];
    const financialState = this.financialState(country);
    const service = this.serviceFacilities(country, month);
    const decision = centralBankDecision(centralBank, signals, financialState, this.rng);
    centralBank.policyRate = decision.policyRate;
    centralBank.currentPolicy = decision;
    centralBank.lastTrace = decision.trace;
    this.applyPolicyTransmission(country);

    const metrics = {
      ...this.emptyMetrics(),
      ...service,
      policyRate: centralBank.policyRate,
      stance: decision.selected,
      reserveTargetRatio: centralBank.reserveTargetRatio,
      creditStress: financialState.creditStress,
      bankStress: financialState.bankStress
    };
    country.lastMonetary = metrics;
    return decision;
  }

  applyPolicyTransmission(country) {
    const centralBank = country.centralBanks[0];
    const bank = country.banks[0];
    const gl = this.accounting.gl;
    const deposits = Math.max(1, gl.naturalBalance(bank.id, 'deposits'));
    const borrowing = Math.max(0, gl.naturalBalance(bank.id, 'central_bank_borrowing'));
    const reserveRatio = Math.max(0, gl.naturalBalance(bank.id, 'reserves')) / deposits;
    const liquidityPremium = Math.max(0, centralBank.reserveTargetRatio - reserveRatio) * 0.12 + (borrowing / deposits) * 0.08;
    const structuralFundingSpread = 0.006 + (1 - country.financialAccess) * 0.012;
    bank.policyRate = centralBank.policyRate;
    bank.baseAnnualRate = clamp(centralBank.policyRate + structuralFundingSpread + liquidityPremium, 0.005, 0.22);
  }

  financialState(country) {
    const bank = country.banks[0];
    const gl = this.accounting.gl;
    const bs = gl.balanceSheet(bank.id);
    const deposits = Math.max(1, gl.naturalBalance(bank.id, 'deposits'));
    const reserves = Math.max(0, gl.naturalBalance(bank.id, 'reserves'));
    const reserveRatio = reserves / deposits;
    const capitalRatio = bs.assets > EPS ? Math.max(0, bs.equity) / bs.assets : 1;
    const credit = country.lastCredit || {};
    const rejectionRatio = Number(credit.applications || 0) > 0 ? Number(credit.rejected || 0) / Number(credit.applications || 1) : 0;
    const defaultRatio = Number(credit.outstandingLoans || 0) > 0 ? Number(credit.chargeOffs || 0) / Number(credit.outstandingLoans || 1) : 0;
    const creditStress = clamp(rejectionRatio * 0.62 + Math.min(1, defaultRatio * 5) * 0.38, 0, 1.5);
    const reserveGap = Math.max(0, country.centralBanks[0].reserveTargetRatio - reserveRatio) / Math.max(0.01, country.centralBanks[0].reserveTargetRatio);
    const capitalGap = Math.max(0, bank.minCapitalRatio * 1.12 - capitalRatio) / Math.max(0.01, bank.minCapitalRatio);
    const bankStress = clamp(reserveGap * 0.52 + capitalGap * 0.48, 0, 1.5);
    const assetMomentum = Number(country.lastAssetMarket?.indexReturn || 0);
    return { reserveRatio, capitalRatio, creditStress, bankStress, assetMomentum };
  }

  serviceFacilities(country, month) {
    const centralBank = country.centralBanks[0];
    const bank = country.banks[0];
    const gl = this.accounting.gl;
    let principalRepaid = 0;
    let interestPaid = 0;

    for (const facility of country.centralBankFacilities) {
      if (facility.status !== 'active' || month < facility.nextPaymentMonth) continue;
      const reserves = Math.max(0, gl.naturalBalance(bank.id, 'reserves'));
      const scheduledPrincipal = Math.min(facility.outstanding, facility.originalPrincipal / facility.termMonths);
      const interestDue = facility.outstanding * facility.monthlyRate;
      const totalDue = scheduledPrincipal + interestDue;
      const paid = Math.min(reserves * 0.22, totalDue);
      if (paid <= EPS) {
        facility.nextPaymentMonth = month + 1;
        continue;
      }
      const paidInterest = Math.min(interestDue, paid);
      const paidPrincipal = Math.min(scheduledPrincipal, Math.max(0, paid - paidInterest));
      this.recordFacilityPayment(country, facility, month, paidPrincipal, paidInterest);
      facility.outstanding = Math.max(0, facility.outstanding - paidPrincipal);
      facility.nextPaymentMonth = month + 1;
      principalRepaid += paidPrincipal;
      interestPaid += paidInterest;
      if (facility.outstanding <= EPS) facility.status = 'repaid';
    }

    return {
      facilityPrincipalRepaid: principalRepaid,
      facilityInterestPaid: interestPaid,
      outstandingFacilities: this.outstandingFacilities(country)
    };
  }

  manageLiquidity(country, month) {
    const centralBank = country.centralBanks[0];
    const bank = country.banks[0];
    const gl = this.accounting.gl;
    const metrics = country.lastMonetary || this.emptyMetrics();
    const deposits = Math.max(0, gl.naturalBalance(bank.id, 'deposits'));
    const reserves = Math.max(0, gl.naturalBalance(bank.id, 'reserves'));
    const stressBoost = centralBank.currentPolicy?.selected === '완화' ? 1.08 : centralBank.currentPolicy?.selected === '긴축' ? 0.96 : 1;
    const target = deposits * centralBank.reserveTargetRatio * stressBoost;
    let gap = Math.max(0, target - reserves);

    if (gap > EPS) {
      const securities = Math.max(0, gl.naturalBalance(bank.id, 'securities'));
      const purchase = Math.min(gap * 0.62, securities * 0.08);
      if (purchase > EPS) {
        this.openMarketPurchase(country, month, purchase);
        metrics.openMarketPurchases += purchase;
        gap -= purchase;
      }
    }

    if (gap > EPS) {
      const facility = this.extendFacility(country, month, gap);
      if (facility > EPS) metrics.centralBankLending += facility;
    }

    const afterReserves = Math.max(0, gl.naturalBalance(bank.id, 'reserves'));
    const afterTarget = Math.max(EPS, target);
    const excess = Math.max(0, afterReserves - afterTarget * 1.45);
    const cbSecurities = Math.max(0, gl.naturalBalance(centralBank.id, 'market_securities'));
    if (centralBank.currentPolicy?.selected === '긴축' && excess > EPS && cbSecurities > EPS) {
      const sale = Math.min(excess * 0.55, cbSecurities * 0.35);
      if (sale > EPS) {
        this.openMarketSale(country, month, sale);
        metrics.openMarketSales += sale;
      }
    }

    this.applyPolicyTransmission(country);
    Object.assign(metrics, this.snapshotMetrics(country));
    country.lastMonetary = metrics;
    return metrics;
  }

  openMarketPurchase(country, month, amount) {
    const centralBank = country.centralBanks[0];
    const bank = country.banks[0];
    const gl = this.accounting.gl;
    const available = Math.max(0, gl.naturalBalance(bank.id, 'securities'));
    const value = Math.min(amount, available);
    if (value <= EPS) return 0;
    gl.post({
      month,
      entityId: bank.id,
      kind: 'open_market_sale_to_central_bank',
      lines: [
        { account: 'reserves', debit: value },
        { account: 'securities', credit: value }
      ],
      meta: { centralBankId: centralBank.id }
    });
    gl.post({
      month,
      entityId: centralBank.id,
      kind: 'open_market_purchase',
      lines: [
        { account: 'market_securities', debit: value },
        { account: 'bank_reserves', credit: value }
      ],
      meta: { bankId: bank.id }
    });
    this.logOperation(country, month, 'open_market_purchase', value);
    return value;
  }

  openMarketSale(country, month, amount) {
    const centralBank = country.centralBanks[0];
    const bank = country.banks[0];
    const gl = this.accounting.gl;
    const cbHoldings = Math.max(0, gl.naturalBalance(centralBank.id, 'market_securities'));
    const reserves = Math.max(0, gl.naturalBalance(bank.id, 'reserves'));
    const value = Math.min(amount, cbHoldings, reserves);
    if (value <= EPS) return 0;
    gl.post({
      month,
      entityId: bank.id,
      kind: 'open_market_purchase_from_central_bank',
      lines: [
        { account: 'securities', debit: value },
        { account: 'reserves', credit: value }
      ],
      meta: { centralBankId: centralBank.id }
    });
    gl.post({
      month,
      entityId: centralBank.id,
      kind: 'open_market_sale',
      lines: [
        { account: 'bank_reserves', debit: value },
        { account: 'market_securities', credit: value }
      ],
      meta: { bankId: bank.id }
    });
    this.logOperation(country, month, 'open_market_sale', value);
    return value;
  }

  extendFacility(country, month, amount) {
    const centralBank = country.centralBanks[0];
    const bank = country.banks[0];
    const gl = this.accounting.gl;
    const bankStatement = gl.balanceSheet(bank.id);
    const equity = Math.max(0, bankStatement.equity);
    const maxFacility = Math.max(0, equity * 1.6);
    const current = this.outstandingFacilities(country);
    const value = Math.min(amount, Math.max(0, maxFacility - current));
    if (value <= EPS) return 0;
    const annualRate = clamp(centralBank.policyRate + 0.012 + country.lastMonetary.bankStress * 0.015, 0.005, 0.24);
    const facility = {
      id: `CBF-${String(this.facilitySequence++).padStart(8, '0')}`,
      countryId: country.id,
      bankId: bank.id,
      centralBankId: centralBank.id,
      originalPrincipal: value,
      outstanding: value,
      annualRate,
      monthlyRate: annualRate / 12,
      termMonths: 12,
      originatedMonth: month,
      nextPaymentMonth: month + 1,
      status: 'active'
    };
    country.centralBankFacilities.push(facility);
    gl.post({
      month,
      entityId: bank.id,
      kind: 'central_bank_facility_draw',
      lines: [
        { account: 'reserves', debit: value },
        { account: 'central_bank_borrowing', credit: value }
      ],
      meta: { facilityId: facility.id, centralBankId: centralBank.id }
    });
    gl.post({
      month,
      entityId: centralBank.id,
      kind: 'central_bank_facility_draw',
      lines: [
        { account: 'lending_to_banks', debit: value },
        { account: 'bank_reserves', credit: value }
      ],
      meta: { facilityId: facility.id, bankId: bank.id }
    });
    this.logOperation(country, month, 'central_bank_facility_draw', value, { facilityId: facility.id });
    return value;
  }

  recordFacilityPayment(country, facility, month, principalPaid, interestPaid) {
    const centralBank = country.centralBanks[0];
    const bank = country.banks[0];
    const total = principalPaid + interestPaid;
    if (total <= EPS) return;
    const gl = this.accounting.gl;
    const bankLines = [];
    if (principalPaid > EPS) bankLines.push({ account: 'central_bank_borrowing', debit: principalPaid });
    if (interestPaid > EPS) bankLines.push({ account: 'central_bank_interest_expense', debit: interestPaid });
    bankLines.push({ account: 'reserves', credit: total });
    gl.post({ month, entityId: bank.id, kind: 'central_bank_facility_payment', lines: bankLines, meta: { facilityId: facility.id } });

    const cbLines = [{ account: 'bank_reserves', debit: total }];
    if (principalPaid > EPS) cbLines.push({ account: 'lending_to_banks', credit: principalPaid });
    if (interestPaid > EPS) cbLines.push({ account: 'interest_income', credit: interestPaid });
    gl.post({ month, entityId: centralBank.id, kind: 'central_bank_facility_payment', lines: cbLines, meta: { facilityId: facility.id } });
    this.logOperation(country, month, 'central_bank_facility_payment', total, { facilityId: facility.id, principalPaid, interestPaid });
  }

  finalizeMonth(country) {
    const metrics = country.lastMonetary || this.emptyMetrics();
    Object.assign(metrics, this.snapshotMetrics(country), this.verifyCountry(country));
    country.lastMonetary = metrics;
    return metrics;
  }

  snapshotMetrics(country) {
    const centralBank = country.centralBanks[0];
    const bank = country.banks[0];
    const gl = this.accounting.gl;
    const deposits = Math.max(0, gl.naturalBalance(bank.id, 'deposits'));
    const reserves = Math.max(0, gl.naturalBalance(bank.id, 'reserves'));
    return {
      policyRate: centralBank.policyRate,
      stance: centralBank.currentPolicy?.selected || '중립',
      reserveTargetRatio: centralBank.reserveTargetRatio,
      bankReserveRatio: deposits > EPS ? reserves / deposits : 0,
      reserves,
      targetReserves: deposits * centralBank.reserveTargetRatio,
      outstandingFacilities: this.outstandingFacilities(country),
      centralBankSecurities: Math.max(0, gl.naturalBalance(centralBank.id, 'market_securities'))
    };
  }

  verifyCountry(country) {
    const centralBank = country.centralBanks[0];
    const bank = country.banks[0];
    const gl = this.accounting.gl;
    const cbVerify = gl.verifyEntity(centralBank.id);
    const bankReserves = Math.max(0, gl.naturalBalance(bank.id, 'reserves'));
    const cbReserveLiability = Math.max(0, gl.naturalBalance(centralBank.id, 'bank_reserves'));
    const bankBorrowing = Math.max(0, gl.naturalBalance(bank.id, 'central_bank_borrowing'));
    const cbLending = Math.max(0, gl.naturalBalance(centralBank.id, 'lending_to_banks'));
    const reserveReconciliationError = bankReserves - cbReserveLiability;
    const facilityReconciliationError = bankBorrowing - cbLending;
    return {
      accountingOk: cbVerify.ok && Math.abs(reserveReconciliationError) < 1e-6 && Math.abs(facilityReconciliationError) < 1e-6,
      reserveReconciliationError,
      facilityReconciliationError,
      centralBankEquationError: cbVerify.equationError
    };
  }

  outstandingFacilities(country) {
    return country.centralBankFacilities.reduce((s, facility) => s + (facility.status === 'active' ? Math.max(0, facility.outstanding) : 0), 0);
  }

  logOperation(country, month, kind, amount, meta = {}) {
    country.centralBankOperations.push({ month, kind, amount, meta });
    if (country.centralBankOperations.length > 500) country.centralBankOperations.splice(0, country.centralBankOperations.length - 500);
  }
}
