import { ACCOUNT_TYPES } from '../accounting/general-ledger.js';
import { clamp } from '../core/rng.js';
import { governmentDecision } from '../ai/government-reasoning.js';

const EPS = 1e-8;

const governmentChart = [
  { code: 'cash', name: 'Treasury Deposit', type: ACCOUNT_TYPES.ASSET },
  { code: 'public_capital', name: 'Public Capital', type: ACCOUNT_TYPES.ASSET },
  { code: 'bonds_payable', name: 'Government Bonds Payable', type: ACCOUNT_TYPES.LIABILITY },
  { code: 'opening_equity', name: 'Opening Net Worth', type: ACCOUNT_TYPES.EQUITY },
  { code: 'retained_earnings', name: 'Accumulated Fiscal Balance', type: ACCOUNT_TYPES.EQUITY },
  { code: 'tax_revenue', name: 'Tax Revenue', type: ACCOUNT_TYPES.REVENUE },
  { code: 'transfer_expense', name: 'Social Transfers', type: ACCOUNT_TYPES.EXPENSE },
  { code: 'government_consumption_expense', name: 'Government Consumption', type: ACCOUNT_TYPES.EXPENSE },
  { code: 'interest_expense', name: 'Government Interest Expense', type: ACCOUNT_TYPES.EXPENSE }
];

export class GovernmentSystem {
  constructor({ ledger, accounting, rng }) {
    this.ledger = ledger;
    this.accounting = accounting;
    this.rng = rng;
    this.bondSequence = 1;
    this.metrics = new Map();
  }

  emptyMetrics() {
    return {
      incomeTax: 0,
      consumptionTax: 0,
      corporateTax: 0,
      taxRevenue: 0,
      transfers: 0,
      transferRecipients: 0,
      governmentConsumption: 0,
      governmentConsumptionTransactions: 0,
      publicInvestment: 0,
      publicInvestmentTransactions: 0,
      bondIssued: 0,
      principalRepaid: 0,
      interestPaid: 0,
      missedDebtService: 0,
      outstandingDebt: 0,
      primaryBalance: 0,
      overallBalance: 0,
      governmentCash: 0,
      publicCapital: 0,
      debtRatio: 0,
      policyStance: '중립',
      accountingOk: true,
      bondReconciliationError: 0,
      securitiesReconciliationError: 0,
      cashReconciliationError: 0
    };
  }

  initializeCountry(country) {
    const government = {
      id: `${country.id}-GOV-01`,
      accountId: `${country.id}:GOV:TREASURY`,
      countryId: country.id,
      kind: 'government',
      name: `${country.name} 정부`,
      baseIncomeTaxRate: clamp(0.105 + this.rng.normal(0, 0.012), 0.07, 0.15),
      baseConsumptionTaxRate: clamp(0.055 + this.rng.normal(0, 0.009), 0.03, 0.085),
      baseCorporateTaxRate: clamp(0.155 + this.rng.normal(0, 0.018), 0.10, 0.22),
      baseBenefitReplacementRate: clamp(0.34 + this.rng.normal(0, 0.045), 0.24, 0.46),
      stabilizerStrength: clamp(0.55 + this.rng.normal(0, 0.12), 0.25, 0.9),
      debtAversion: clamp(0.55 + this.rng.normal(0, 0.16), 0.2, 0.95),
      growthPreference: clamp(0.58 + this.rng.normal(0, 0.15), 0.2, 0.95),
      optimism: clamp(this.rng.normal(0, 0.16), -0.55, 0.55),
      modelUncertainty: clamp(0.24 + this.rng.normal(0, 0.06), 0.10, 0.45),
      unemploymentReference: 0.055,
      inflationReference: 0.025,
      debtComfortRatio: clamp(0.58 + this.rng.normal(0, 0.08), 0.42, 0.75),
      publicCapitalStock: 0,
      lastTrace: null,
      currentPolicy: null,
      baselineBankSecurities: 0,
      lastDemandMonth: -1
    };

    country.governments = [government];
    country.governmentBonds = [];
    country.lastFiscal = this.emptyMetrics();

    this.ledger.openAccount({
      id: government.accountId,
      ownerId: government.id,
      countryId: country.id,
      type: 'government_deposit',
      openingBalance: 0
    });

    const gl = this.accounting.gl;
    gl.createEntity({ id: government.id, countryId: country.id, kind: 'government', accounts: governmentChart });
    for (const h of country.households) {
      gl.addAccount(h.id, { code: 'tax_expense', name: 'Household Taxes', type: ACCOUNT_TYPES.EXPENSE });
      gl.addAccount(h.id, { code: 'transfer_income', name: 'Government Transfer Income', type: ACCOUNT_TYPES.REVENUE });
    }
    for (const f of country.firms) gl.addAccount(f.id, { code: 'tax_expense', name: 'Corporate Taxes', type: ACCOUNT_TYPES.EXPENSE });

    const bank = country.banks[0];
    government.baselineBankSecurities = Math.max(0, gl.naturalBalance(bank.id, 'securities'));
  }

  registerFirm(firm) {
    this.accounting.gl.addAccount(firm.id, { code: 'tax_expense', name: 'Corporate Taxes', type: ACCOUNT_TYPES.EXPENSE });
  }

  beginMonth(country, month, signals, previousMacro) {
    const government = country.governments[0];
    const prior = country.lastFiscal || this.emptyMetrics();
    const annualizedGDP = Math.max(1, Number(previousMacro?.gdp || 0) * 12);
    const debt = this.outstandingDebt(country);
    const fiscalState = {
      debtRatio: debt / annualizedGDP,
      priorBalanceRatio: Number(prior.overallBalance || 0) / annualizedGDP
    };
    const decision = governmentDecision(government, signals, fiscalState, this.rng);
    government.currentPolicy = decision;
    government.lastTrace = decision.trace;

    const metrics = this.emptyMetrics();
    metrics.policyStance = decision.selected;
    metrics.debtRatio = fiscalState.debtRatio;
    this.metrics.set(country.id, metrics);

    this.serviceGovernmentDebt(country, month);
    return decision;
  }

  serviceGovernmentDebt(country, month) {
    const government = country.governments[0];
    const bank = country.banks[0];
    const metrics = this.metrics.get(country.id) || this.emptyMetrics();

    for (const bond of country.governmentBonds) {
      if (bond.status !== 'active' || month < bond.nextPaymentMonth) continue;
      const principalDue = Math.min(bond.outstanding, bond.originalPrincipal / bond.termMonths);
      const interestDue = bond.outstanding * bond.monthlyRate + Math.max(0, bond.interestArrears || 0);
      const totalDue = principalDue + interestDue;
      this.ensureLiquidity(country, month, totalDue, 'government_debt_service');

      const cash = this.ledger.balance(government.accountId);
      const requested = Math.min(totalDue, cash);
      const delta = this.ledger.adjustMoney({
        month,
        countryId: country.id,
        accountId: government.accountId,
        amount: -requested,
        kind: 'government_bond_payment',
        meta: { governmentId: government.id, bankId: bank.id, bondId: bond.id }
      });
      const paid = Math.max(0, -delta);
      const interestPaid = Math.min(paid, interestDue);
      const principalPaid = Math.min(principalDue, Math.max(0, paid - interestPaid));
      const unpaidInterest = Math.max(0, interestDue - interestPaid);

      if (paid > EPS) this.recordBondPayment(country, bond, month, principalPaid, interestPaid);
      bond.outstanding = Math.max(0, bond.outstanding - principalPaid);
      bond.interestArrears = unpaidInterest;
      bond.nextPaymentMonth = month + 1;
      metrics.principalRepaid += principalPaid;
      metrics.interestPaid += interestPaid;
      metrics.missedDebtService += Math.max(0, totalDue - paid);

      if (bond.outstanding <= EPS) {
        bond.status = 'repaid';
        bond.outstanding = 0;
        bond.interestArrears = 0;
      }
    }
  }

  collectIncomeTaxes(country, month) {
    const government = country.governments[0];
    const policy = government.currentPolicy;
    const metrics = this.metrics.get(country.id);
    const avgWage = Math.max(1, country.previousMacro?.avgWage || country.initialWage || 1);

    for (const h of country.households) {
      h.incomeTaxPaid = 0;
      h.transferIncome = 0;
      const income = Math.max(0, Number(h.income || 0));
      if (income <= EPS) continue;
      const progressivity = clamp(0.72 + 0.28 * income / avgWage, 0.62, 1.42);
      const due = income * policy.incomeTaxRate * progressivity;
      const paid = this.ledger.transfer({
        month,
        countryId: country.id,
        from: h.accountId,
        to: government.accountId,
        amount: due,
        kind: 'income_tax',
        meta: { householdId: h.id, governmentId: government.id }
      });
      if (paid <= EPS) continue;
      this.recordTaxPayment({ payer: h, government, month, amount: paid, taxType: 'income' });
      h.incomeTaxPaid = paid;
      metrics.incomeTax += paid;
      metrics.taxRevenue += paid;
    }

    // Government enters final-goods markets before private final demand so its
    // purchases compete for the same scarce inventories rather than seeing only leftovers.
    this.executeGovernmentDemand(country, month, country.previousMacro);
    return metrics.incomeTax;
  }

  payAutomaticTransfers(country, month) {
    const government = country.governments[0];
    const policy = government.currentPolicy;
    const metrics = this.metrics.get(country.id);
    const unemployed = country.households.filter(h => !h.employed);
    const avgWage = Math.max(1, country.previousMacro?.avgWage || country.initialWage || 1);
    const targetPerRecipient = avgWage * policy.benefitReplacementRate;
    const target = unemployed.length * targetPerRecipient;
    this.ensureLiquidity(country, month, target, 'automatic_stabilizer');

    for (const h of unemployed) {
      const paid = this.ledger.transfer({
        month,
        countryId: country.id,
        from: government.accountId,
        to: h.accountId,
        amount: targetPerRecipient,
        kind: 'unemployment_transfer',
        meta: { householdId: h.id, governmentId: government.id }
      });
      if (paid <= EPS) break;
      this.accounting.gl.post({
        month,
        entityId: government.id,
        kind: 'social_transfer',
        lines: [
          { account: 'transfer_expense', debit: paid },
          { account: 'cash', credit: paid }
        ],
        meta: { householdId: h.id }
      });
      this.accounting.gl.post({
        month,
        entityId: h.id,
        kind: 'government_transfer_income',
        lines: [
          { account: 'cash', debit: paid },
          { account: 'transfer_income', credit: paid }
        ],
        meta: { governmentId: government.id }
      });
      h.transferIncome = (h.transferIncome || 0) + paid;
      metrics.transfers += paid;
      metrics.transferRecipients += 1;
    }
    return metrics.transfers;
  }

  collectConsumptionTaxes(country, month) {
    const government = country.governments[0];
    const policy = government.currentPolicy;
    const metrics = this.metrics.get(country.id);
    for (const h of country.households) {
      const base = Math.max(0, Number(h.consumption || 0));
      const due = base * policy.consumptionTaxRate;
      if (due <= EPS) continue;
      const paid = this.ledger.transfer({
        month,
        countryId: country.id,
        from: h.accountId,
        to: government.accountId,
        amount: due,
        kind: 'consumption_tax',
        meta: { householdId: h.id, governmentId: government.id }
      });
      if (paid <= EPS) continue;
      this.recordTaxPayment({ payer: h, government, month, amount: paid, taxType: 'consumption' });
      metrics.consumptionTax += paid;
      metrics.taxRevenue += paid;
    }
    return metrics.consumptionTax;
  }

  executeGovernmentDemand(country, month, previousMacro) {
    const government = country.governments[0];
    if (government.lastDemandMonth === month) return;
    government.lastDemandMonth = month;
    const policy = government.currentPolicy;
    const baseGDP = Math.max(
      1,
      Number(previousMacro?.gdp || 0),
      Number(previousMacro?.consumption || 0) + Number(previousMacro?.grossInvestment || 0)
    );
    const consumptionTarget = baseGDP * 0.055 * policy.spendingMultiplier;
    const investmentTarget = baseGDP * 0.028 * policy.investmentMultiplier;
    this.purchaseFinalGoods(country, month, consumptionTarget, 'CONSUMER', false);
    this.purchaseFinalGoods(country, month, investmentTarget, 'CAPITAL', true);
  }

  purchaseFinalGoods(country, month, targetBudget, industryId, publicInvestment) {
    const government = country.governments[0];
    const metrics = this.metrics.get(country.id);
    if (targetBudget <= EPS) return 0;
    this.ensureLiquidity(country, month, targetBudget, publicInvestment ? 'public_investment' : 'government_consumption');

    let remaining = Math.min(targetBudget, this.ledger.balance(government.accountId));
    let spent = 0;
    const sellers = country.firms
      .filter(f => f.active !== false && f.industryId === industryId && f.inventory > EPS)
      .map(f => ({ f, score: f.price / Math.max(0.2, f.productivity) * (0.96 + this.rng.next() * 0.08) }))
      .sort((a, b) => a.score - b.score || a.f.id.localeCompare(b.f.id));

    for (const { f } of sellers) {
      if (remaining <= EPS) break;
      const maxUnits = Math.min(f.inventory, Math.max(1, f.inventory * 0.34));
      const requested = Math.min(remaining, maxUnits * f.price);
      const paid = this.ledger.transfer({
        month,
        countryId: country.id,
        from: government.accountId,
        to: f.accountId,
        amount: requested,
        kind: publicInvestment ? 'public_investment' : 'government_consumption',
        meta: { governmentId: government.id, firmId: f.id, industryId }
      });
      if (paid <= EPS) continue;
      const units = Math.min(f.inventory, paid / Math.max(0.01, f.price));
      const availableBook = Math.max(0, this.accounting.gl.naturalBalance(f.id, 'inventory'));
      const cost = Math.min(availableBook, units * Math.max(0, f.bookUnitCost || 0));
      f.inventory = Math.max(0, f.inventory - units);
      f.sales += units;
      f.revenue += paid;
      if (publicInvestment) {
        f.capitalSales = (f.capitalSales || 0) + units;
        f.capitalRevenue = (f.capitalRevenue || 0) + paid;
        government.publicCapitalStock += units;
      }
      this.recordGovernmentPurchase({ government, seller: f, month, amount: paid, units, cost, publicInvestment });
      remaining -= paid;
      spent += paid;
      if (publicInvestment) {
        metrics.publicInvestment += paid;
        metrics.publicInvestmentTransactions += 1;
      } else {
        metrics.governmentConsumption += paid;
        metrics.governmentConsumptionTransactions += 1;
      }
    }
    return spent;
  }

  collectCorporateTaxes(country, month) {
    const government = country.governments[0];
    const policy = government.currentPolicy;
    const metrics = this.metrics.get(country.id);
    for (const f of country.firms) {
      if (f.active === false) continue;
      const statement = this.accounting.gl.incomeStatement(f.id);
      const taxableProfit = Math.max(0, statement.netIncome);
      const due = taxableProfit * policy.corporateTaxRate;
      if (due <= EPS) continue;
      const paid = this.ledger.transfer({
        month,
        countryId: country.id,
        from: f.accountId,
        to: government.accountId,
        amount: due,
        kind: 'corporate_tax',
        meta: { firmId: f.id, governmentId: government.id }
      });
      if (paid <= EPS) continue;
      this.recordTaxPayment({ payer: f, government, month, amount: paid, taxType: 'corporate' });
      metrics.corporateTax += paid;
      metrics.taxRevenue += paid;
    }
    return metrics.corporateTax;
  }

  finalizeMonth(country, month, macroBase = null) {
    const government = country.governments[0];
    const metrics = this.metrics.get(country.id) || this.emptyMetrics();
    const governmentResult = this.accounting.gl.closeMonth(government.id, month);
    const debt = this.outstandingDebt(country);
    const annualizedGDP = Math.max(1, Number(macroBase?.gdp || country.previousMacro?.gdp || 0) * 12);
    const spendingExInterest = metrics.transfers + metrics.governmentConsumption + metrics.publicInvestment;
    metrics.primaryBalance = metrics.taxRevenue - spendingExInterest;
    metrics.overallBalance = metrics.primaryBalance - metrics.interestPaid;
    metrics.outstandingDebt = debt;
    metrics.governmentCash = this.ledger.balance(government.accountId);
    metrics.publicCapital = Math.max(0, this.accounting.gl.naturalBalance(government.id, 'public_capital'));
    metrics.debtRatio = debt / annualizedGDP;
    metrics.governmentRevenue = governmentResult.revenue;
    metrics.governmentExpense = governmentResult.expense;
    metrics.governmentNetIncome = governmentResult.netIncome;

    const verify = this.verifyCountry(country);
    Object.assign(metrics, verify);
    country.lastFiscal = metrics;
    return metrics;
  }

  verifyCountry(country) {
    const government = country.governments[0];
    const bank = country.banks[0];
    const gl = this.accounting.gl;
    const entity = gl.verifyEntity(government.id);
    const governmentCash = gl.naturalBalance(government.id, 'cash');
    const settlementCash = this.ledger.balance(government.accountId);
    const bondsPayable = Math.max(0, gl.naturalBalance(government.id, 'bonds_payable'));
    const outstanding = this.outstandingDebt(country);
    const bankSecurities = Math.max(0, gl.naturalBalance(bank.id, 'securities'));
    const incrementalGovernmentSecurities = bankSecurities - government.baselineBankSecurities;
    const cashReconciliationError = governmentCash - settlementCash;
    const bondReconciliationError = bondsPayable - outstanding;
    const securitiesReconciliationError = incrementalGovernmentSecurities - outstanding;
    return {
      accountingOk:
        entity.ok &&
        Math.abs(cashReconciliationError) < 1e-6 &&
        Math.abs(bondReconciliationError) < 1e-6 &&
        Math.abs(securitiesReconciliationError) < 1e-6,
      governmentEquationError: entity.equationError,
      cashReconciliationError,
      bondReconciliationError,
      securitiesReconciliationError
    };
  }

  outstandingDebt(country) {
    return country.governmentBonds.reduce((s, b) => s + (b.status === 'active' ? Math.max(0, b.outstanding) : 0), 0);
  }

  ensureLiquidity(country, month, requiredCash, reason) {
    const government = country.governments[0];
    const bank = country.banks[0];
    const current = this.ledger.balance(government.accountId);
    const shortfall = Math.max(0, requiredCash - current);
    if (shortfall <= EPS) return 0;

    const bankStatement = this.accounting.gl.balanceSheet(bank.id);
    const maxAssets = Math.max(0, bankStatement.equity) / Math.max(0.01, bank.minCapitalRatio);
    const capitalCapacity = Math.max(0, maxAssets - Math.max(0, bankStatement.assets));
    const amount = Math.min(shortfall, Math.max(0, capitalCapacity * 0.92));
    if (amount <= EPS) return 0;

    const debtRatio = this.outstandingDebt(country) / Math.max(1, (country.previousMacro?.gdp || 1) * 12);
    const annualRate = clamp(bank.baseAnnualRate + 0.012 + Math.max(0, debtRatio - 0.55) * 0.035, 0.015, 0.16);
    const created = this.ledger.adjustMoney({
      month,
      countryId: country.id,
      accountId: government.accountId,
      amount,
      kind: 'government_bond_issue',
      meta: { governmentId: government.id, bankId: bank.id, reason }
    });
    if (created <= EPS) return 0;

    const bond = {
      id: `GB-${String(this.bondSequence++).padStart(8, '0')}`,
      countryId: country.id,
      governmentId: government.id,
      bankId: bank.id,
      originalPrincipal: created,
      outstanding: created,
      annualRate,
      monthlyRate: annualRate / 12,
      termMonths: 48 + this.rng.int(0, 37),
      originatedMonth: month,
      nextPaymentMonth: month + 1,
      interestArrears: 0,
      reason,
      status: 'active'
    };
    country.governmentBonds.push(bond);
    this.recordBondIssue(country, bond, month, created);
    const metrics = this.metrics.get(country.id);
    if (metrics) metrics.bondIssued += created;
    return created;
  }

  recordBondIssue(country, bond, month, amount) {
    const government = country.governments[0];
    const bank = country.banks[0];
    const gl = this.accounting.gl;
    gl.post({
      month,
      entityId: government.id,
      kind: 'government_bond_issue',
      lines: [
        { account: 'cash', debit: amount },
        { account: 'bonds_payable', credit: amount }
      ],
      meta: { bondId: bond.id, bankId: bank.id }
    });
    gl.post({
      month,
      entityId: bank.id,
      kind: 'government_bond_purchase',
      lines: [
        { account: 'securities', debit: amount },
        { account: 'deposits', credit: amount }
      ],
      meta: { bondId: bond.id, governmentId: government.id }
    });
  }

  recordBondPayment(country, bond, month, principalPaid, interestPaid) {
    const government = country.governments[0];
    const bank = country.banks[0];
    const total = principalPaid + interestPaid;
    const gl = this.accounting.gl;
    const govLines = [];
    if (principalPaid > EPS) govLines.push({ account: 'bonds_payable', debit: principalPaid });
    if (interestPaid > EPS) govLines.push({ account: 'interest_expense', debit: interestPaid });
    govLines.push({ account: 'cash', credit: total });
    gl.post({ month, entityId: government.id, kind: 'government_bond_payment', lines: govLines, meta: { bondId: bond.id } });

    const bankLines = [{ account: 'deposits', debit: total }];
    if (principalPaid > EPS) bankLines.push({ account: 'securities', credit: principalPaid });
    if (interestPaid > EPS) bankLines.push({ account: 'interest_income', credit: interestPaid });
    gl.post({ month, entityId: bank.id, kind: 'government_bond_payment', lines: bankLines, meta: { bondId: bond.id } });
  }

  recordTaxPayment({ payer, government, month, amount, taxType }) {
    const gl = this.accounting.gl;
    gl.post({
      month,
      entityId: payer.id,
      kind: `${taxType}_tax_payment`,
      lines: [
        { account: 'tax_expense', debit: amount },
        { account: 'cash', credit: amount }
      ],
      meta: { governmentId: government.id }
    });
    gl.post({
      month,
      entityId: government.id,
      kind: `${taxType}_tax_receipt`,
      lines: [
        { account: 'cash', debit: amount },
        { account: 'tax_revenue', credit: amount }
      ],
      meta: { payerId: payer.id, payerKind: payer.kind }
    });
  }

  recordGovernmentPurchase({ government, seller, month, amount, units, cost, publicInvestment }) {
    const gl = this.accounting.gl;
    gl.post({
      month,
      entityId: government.id,
      kind: publicInvestment ? 'public_capital_purchase' : 'government_consumption_purchase',
      lines: [
        { account: publicInvestment ? 'public_capital' : 'government_consumption_expense', debit: amount },
        { account: 'cash', credit: amount }
      ],
      meta: { sellerId: seller.id, units }
    });
    gl.post({
      month,
      entityId: seller.id,
      kind: publicInvestment ? 'public_investment_sale' : 'government_goods_sale',
      lines: [
        { account: 'cash', debit: amount },
        { account: 'sales_revenue', credit: amount }
      ],
      meta: { governmentId: government.id, units }
    });
    if (cost > EPS) {
      gl.post({
        month,
        entityId: seller.id,
        kind: 'government_sale_cogs',
        lines: [
          { account: 'cogs', debit: cost },
          { account: 'inventory', credit: cost }
        ],
        meta: { governmentId: government.id, units }
      });
    }
  }
}