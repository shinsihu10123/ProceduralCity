import { ACCOUNT_TYPES, GeneralLedger } from './general-ledger.js';

const householdChart = [
  { code: 'cash', name: 'Bank Deposit', type: ACCOUNT_TYPES.ASSET },
  { code: 'wage_receivable', name: 'Wage Receivable', type: ACCOUNT_TYPES.ASSET },
  { code: 'loan_payable', name: 'Bank Loan Payable', type: ACCOUNT_TYPES.LIABILITY },
  { code: 'opening_equity', name: 'Opening Equity', type: ACCOUNT_TYPES.EQUITY },
  { code: 'retained_earnings', name: 'Retained Earnings', type: ACCOUNT_TYPES.EQUITY },
  { code: 'wage_income', name: 'Wage Income', type: ACCOUNT_TYPES.REVENUE },
  { code: 'debt_relief_income', name: 'Debt Relief Income', type: ACCOUNT_TYPES.REVENUE },
  { code: 'consumption_expense', name: 'Consumption Expense', type: ACCOUNT_TYPES.EXPENSE },
  { code: 'interest_expense', name: 'Interest Expense', type: ACCOUNT_TYPES.EXPENSE }
];

const firmChart = [
  { code: 'cash', name: 'Bank Deposit', type: ACCOUNT_TYPES.ASSET },
  { code: 'input_inventory', name: 'Raw / Intermediate Inventory', type: ACCOUNT_TYPES.ASSET },
  { code: 'inventory', name: 'Finished Goods Inventory', type: ACCOUNT_TYPES.ASSET },
  { code: 'fixed_assets', name: 'Productive Fixed Assets', type: ACCOUNT_TYPES.ASSET },
  { code: 'wages_payable', name: 'Wages Payable', type: ACCOUNT_TYPES.LIABILITY },
  { code: 'loan_payable', name: 'Bank Loan Payable', type: ACCOUNT_TYPES.LIABILITY },
  { code: 'opening_equity', name: 'Opening Equity', type: ACCOUNT_TYPES.EQUITY },
  { code: 'retained_earnings', name: 'Retained Earnings', type: ACCOUNT_TYPES.EQUITY },
  { code: 'sales_revenue', name: 'Sales Revenue', type: ACCOUNT_TYPES.REVENUE },
  { code: 'debt_relief_income', name: 'Debt Relief Income', type: ACCOUNT_TYPES.REVENUE },
  { code: 'cogs', name: 'Cost of Goods Sold', type: ACCOUNT_TYPES.EXPENSE },
  { code: 'interest_expense', name: 'Interest Expense', type: ACCOUNT_TYPES.EXPENSE }
];

const bankChart = [
  { code: 'reserves', name: 'Reserves', type: ACCOUNT_TYPES.ASSET },
  { code: 'securities', name: 'Securities', type: ACCOUNT_TYPES.ASSET },
  { code: 'loans', name: 'Loans to Customers', type: ACCOUNT_TYPES.ASSET },
  { code: 'deposits', name: 'Customer Deposits', type: ACCOUNT_TYPES.LIABILITY },
  { code: 'opening_equity', name: 'Opening Equity', type: ACCOUNT_TYPES.EQUITY },
  { code: 'retained_earnings', name: 'Retained Earnings', type: ACCOUNT_TYPES.EQUITY },
  { code: 'interest_income', name: 'Interest Income', type: ACCOUNT_TYPES.REVENUE },
  { code: 'credit_loss_expense', name: 'Credit Loss Expense', type: ACCOUNT_TYPES.EXPENSE }
];

export class AccountingSystem {
  constructor() {
    this.gl = new GeneralLedger();
    this.lastCountryReports = new Map();
  }

  initializeCountry(country, settlementLedger) {
    for (const h of country.households) this.initializeHousehold(h, settlementLedger, 0);
    for (const f of country.firms) this.initializeFirm(f, settlementLedger, 0);
  }

  initializeHousehold(h, settlementLedger, month = 0) {
    this.gl.createEntity({ id: h.id, countryId: h.countryId, kind: 'household', accounts: householdChart });
    const cash = settlementLedger.balance(h.accountId);
    if (cash > 0) {
      this.gl.post({
        month,
        entityId: h.id,
        kind: 'opening_balance',
        lines: [
          { account: 'cash', debit: cash },
          { account: 'opening_equity', credit: cash }
        ]
      });
    }
  }

  initializeFirm(f, settlementLedger, month = 0) {
    this.gl.createEntity({ id: f.id, countryId: f.countryId, kind: 'firm', accounts: firmChart });
    const cash = settlementLedger.balance(f.accountId);
    const unitCost = Math.max(0.02, f.price * 0.42);
    const finishedValue = Math.max(0, f.inventory * unitCost);
    const inputValue = Object.values(f.inputBookValues || {}).reduce((s, x) => s + Math.max(0, Number(x || 0)), 0);
    const fixedAssets = Math.max(0, Number(f.capitalBookValue || 0));
    f.bookUnitCost = unitCost;
    const openingAssets = cash + finishedValue + inputValue + fixedAssets;
    if (openingAssets > 0) {
      this.gl.post({
        month,
        entityId: f.id,
        kind: 'opening_balance',
        lines: [
          ...(cash > 0 ? [{ account: 'cash', debit: cash }] : []),
          ...(inputValue > 0 ? [{ account: 'input_inventory', debit: inputValue }] : []),
          ...(finishedValue > 0 ? [{ account: 'inventory', debit: finishedValue }] : []),
          ...(fixedAssets > 0 ? [{ account: 'fixed_assets', debit: fixedAssets }] : []),
          { account: 'opening_equity', credit: openingAssets }
        ]
      });
    }
  }

  initializeBank(bank, openingDeposits) {
    this.gl.createEntity({ id: bank.id, countryId: bank.countryId, kind: 'bank', accounts: bankChart });
    const deposits = Math.max(0, Number(openingDeposits || 0));
    const equity = deposits * bank.initialCapitalRatio;
    const reserves = deposits * 0.18;
    const securities = Math.max(0, deposits + equity - reserves);
    bank.openingDeposits = deposits;
    bank.openingEquity = equity;
    bank.initialReserves = reserves;

    if (deposits + equity > 0) {
      this.gl.post({
        month: 0,
        entityId: bank.id,
        kind: 'opening_bank_balance',
        lines: [
          ...(reserves > 0 ? [{ account: 'reserves', debit: reserves }] : []),
          ...(securities > 0 ? [{ account: 'securities', debit: securities }] : []),
          ...(deposits > 0 ? [{ account: 'deposits', credit: deposits }] : []),
          ...(equity > 0 ? [{ account: 'opening_equity', credit: equity }] : [])
        ]
      });
    }
  }

  recordLoanOrigination({ bank, borrower, loan, month, amount }) {
    if (amount <= 0) return;
    this.gl.post({
      month,
      entityId: borrower.id,
      kind: 'loan_origination',
      lines: [
        { account: 'cash', debit: amount },
        { account: 'loan_payable', credit: amount }
      ],
      meta: { bankId: bank.id, loanId: loan.id }
    });
    this.gl.post({
      month,
      entityId: bank.id,
      kind: 'loan_origination',
      lines: [
        { account: 'loans', debit: amount },
        { account: 'deposits', credit: amount }
      ],
      meta: { borrowerId: borrower.id, loanId: loan.id }
    });
  }

  recordLoanPayment({ bank, borrower, loan, month, principalPaid, interestPaid }) {
    const total = Math.max(0, principalPaid) + Math.max(0, interestPaid);
    if (total <= 0) return;
    const borrowerLines = [];
    if (principalPaid > 0) borrowerLines.push({ account: 'loan_payable', debit: principalPaid });
    if (interestPaid > 0) borrowerLines.push({ account: 'interest_expense', debit: interestPaid });
    borrowerLines.push({ account: 'cash', credit: total });
    this.gl.post({
      month,
      entityId: borrower.id,
      kind: 'loan_payment',
      lines: borrowerLines,
      meta: { bankId: bank.id, loanId: loan.id, principalPaid, interestPaid }
    });

    const bankLines = [{ account: 'deposits', debit: total }];
    if (principalPaid > 0) bankLines.push({ account: 'loans', credit: principalPaid });
    if (interestPaid > 0) bankLines.push({ account: 'interest_income', credit: interestPaid });
    this.gl.post({
      month,
      entityId: bank.id,
      kind: 'loan_payment',
      lines: bankLines,
      meta: { borrowerId: borrower.id, loanId: loan.id, principalPaid, interestPaid }
    });
  }

  recordLoanDefault({ bank, borrower, loan, month, amount }) {
    if (amount <= 0) return;
    this.gl.post({
      month,
      entityId: borrower.id,
      kind: 'loan_default_relief',
      lines: [
        { account: 'loan_payable', debit: amount },
        { account: 'debt_relief_income', credit: amount }
      ],
      meta: { bankId: bank.id, loanId: loan.id }
    });
    this.gl.post({
      month,
      entityId: bank.id,
      kind: 'loan_charge_off',
      lines: [
        { account: 'credit_loss_expense', debit: amount },
        { account: 'loans', credit: amount }
      ],
      meta: { borrowerId: borrower.id, loanId: loan.id }
    });
  }

  recordInterfirmPurchase({ buyer, seller, month, amount, units, cost, product }) {
    if (amount <= 0) return;
    this.gl.post({
      month,
      entityId: buyer.id,
      kind: 'interfirm_input_purchase',
      lines: [
        { account: 'input_inventory', debit: amount },
        { account: 'cash', credit: amount }
      ],
      meta: { sellerId: seller.id, product, units }
    });
    this.gl.post({
      month,
      entityId: seller.id,
      kind: 'interfirm_sale',
      lines: [
        { account: 'cash', debit: amount },
        { account: 'sales_revenue', credit: amount }
      ],
      meta: { buyerId: buyer.id, product, units }
    });
    if (cost > 0) {
      this.gl.post({
        month,
        entityId: seller.id,
        kind: 'interfirm_cogs',
        lines: [
          { account: 'cogs', debit: cost },
          { account: 'inventory', credit: cost }
        ],
        meta: { buyerId: buyer.id, product, units }
      });
    }
  }

  recordInputConsumption({ firm, month, amount, product, units }) {
    if (amount <= 0) return;
    const available = Math.max(0, this.gl.naturalBalance(firm.id, 'input_inventory'));
    const moved = Math.min(available, amount);
    if (moved <= 0) return;
    this.gl.post({
      month,
      entityId: firm.id,
      kind: 'input_to_production',
      lines: [
        { account: 'inventory', debit: moved },
        { account: 'input_inventory', credit: moved }
      ],
      meta: { product, units }
    });
  }

  recordCapitalInvestment({ buyer, seller, month, amount, units, cost }) {
    if (amount <= 0) return;
    this.gl.post({
      month,
      entityId: buyer.id,
      kind: 'capital_investment',
      lines: [
        { account: 'fixed_assets', debit: amount },
        { account: 'cash', credit: amount }
      ],
      meta: { sellerId: seller.id, units }
    });
    this.gl.post({
      month,
      entityId: seller.id,
      kind: 'capital_goods_sale',
      lines: [
        { account: 'cash', debit: amount },
        { account: 'sales_revenue', credit: amount }
      ],
      meta: { buyerId: buyer.id, units }
    });
    if (cost > 0) {
      this.gl.post({
        month,
        entityId: seller.id,
        kind: 'capital_goods_cogs',
        lines: [
          { account: 'cogs', debit: cost },
          { account: 'inventory', credit: cost }
        ],
        meta: { buyerId: buyer.id, units }
      });
    }
  }

  accrueMonthlyWages(country, month) {
    const firmMap = new Map(country.firms.map(f => [f.id, f]));
    const accruedByFirm = new Map();
    let accrued = 0;
    let workers = 0;

    for (const h of country.households) {
      if (!h.employed || !h.employerId || !firmMap.has(h.employerId)) continue;
      const f = firmMap.get(h.employerId);
      if (f.active === false) continue;
      const amount = Math.max(0, f.wage);
      if (amount <= 0) continue;

      this.gl.post({
        month,
        entityId: h.id,
        kind: 'wage_accrual',
        lines: [
          { account: 'wage_receivable', debit: amount },
          { account: 'wage_income', credit: amount }
        ],
        meta: { firmId: f.id }
      });
      accruedByFirm.set(f.id, (accruedByFirm.get(f.id) || 0) + amount);
      accrued += amount;
      workers += 1;
    }

    for (const f of country.firms) {
      if (f.active === false) continue;
      const amount = accruedByFirm.get(f.id) || 0;
      if (amount <= 0) continue;
      this.gl.post({
        month,
        entityId: f.id,
        kind: 'production_labor_accrual',
        lines: [
          { account: 'inventory', debit: amount },
          { account: 'wages_payable', credit: amount }
        ],
        meta: { workers: f.workers, output: f.output }
      });
      const inventoryBook = Math.max(0, this.gl.naturalBalance(f.id, 'inventory'));
      f.bookUnitCost = inventoryBook / Math.max(1e-9, f.inventory);
    }

    return { accrued, workers };
  }

  ingestSettlementEntries(entries, country, month) {
    const firmMap = new Map(country.firms.map(f => [f.id, f]));
    let wagePayments = 0;
    let goodsPayments = 0;
    let cogs = 0;

    for (const entry of entries) {
      if (entry.kind === 'wage') {
        const householdId = entry.meta.householdId;
        const firmId = entry.meta.firmId;
        const amount = entry.amount;
        this.gl.post({
          month,
          entityId: householdId,
          kind: 'wage_cash_settlement',
          lines: [
            { account: 'cash', debit: amount },
            { account: 'wage_receivable', credit: amount }
          ],
          meta: { settlementId: entry.id, firmId }
        });
        this.gl.post({
          month,
          entityId: firmId,
          kind: 'wage_cash_settlement',
          lines: [
            { account: 'wages_payable', debit: amount },
            { account: 'cash', credit: amount }
          ],
          meta: { settlementId: entry.id, householdId }
        });
        wagePayments += amount;
      }

      if (entry.kind === 'goods_purchase') {
        const householdId = entry.meta.householdId;
        const firmId = entry.meta.firmId;
        const amount = entry.amount;
        const units = Math.max(0, Number(entry.meta.units || 0));
        const f = firmMap.get(firmId);
        const availableInventoryBook = Math.max(0, this.gl.naturalBalance(firmId, 'inventory'));
        const estimatedCost = Math.max(0, units * Math.max(0, f?.bookUnitCost || 0));
        const cost = Math.min(availableInventoryBook, estimatedCost);

        this.gl.post({
          month,
          entityId: householdId,
          kind: 'consumption_purchase',
          lines: [
            { account: 'consumption_expense', debit: amount },
            { account: 'cash', credit: amount }
          ],
          meta: { settlementId: entry.id, firmId, units }
        });
        this.gl.post({
          month,
          entityId: firmId,
          kind: 'goods_sale',
          lines: [
            { account: 'cash', debit: amount },
            { account: 'sales_revenue', credit: amount }
          ],
          meta: { settlementId: entry.id, householdId, units }
        });
        if (cost > 0) {
          this.gl.post({
            month,
            entityId: firmId,
            kind: 'cost_of_goods_sold',
            lines: [
              { account: 'cogs', debit: cost },
              { account: 'inventory', credit: cost }
            ],
            meta: { settlementId: entry.id, units }
          });
        }
        goodsPayments += amount;
        cogs += cost;
      }
    }

    return { wagePayments, goodsPayments, cogs };
  }

  closeCountryMonth(country, settlementLedger, month) {
    let householdIncome = 0;
    let householdExpense = 0;
    let householdNetIncome = 0;
    let firmRevenue = 0;
    let firmExpense = 0;
    let firmProfit = 0;
    let bankRevenue = 0;
    let bankExpense = 0;
    let bankProfit = 0;

    for (const h of country.households) {
      const result = this.gl.closeMonth(h.id, month);
      householdIncome += result.revenue;
      householdExpense += result.expense;
      householdNetIncome += result.netIncome;
    }
    for (const f of country.firms) {
      const result = this.gl.closeMonth(f.id, month);
      firmRevenue += result.revenue;
      firmExpense += result.expense;
      firmProfit += result.netIncome;
    }
    for (const bank of country.banks || []) {
      const result = this.gl.closeMonth(bank.id, month);
      bankRevenue += result.revenue;
      bankExpense += result.expense;
      bankProfit += result.netIncome;
    }

    const report = this.verifyCountry(country, settlementLedger, month);
    const summary = {
      month,
      householdIncome,
      householdExpense,
      householdNetIncome,
      firmRevenue,
      firmExpense,
      firmProfit,
      bankRevenue,
      bankExpense,
      bankProfit,
      ...report
    };
    this.lastCountryReports.set(country.id, summary);
    return summary;
  }

  entityStatement(entityId, month) {
    return {
      balanceSheet: this.gl.balanceSheet(entityId),
      incomeStatement: this.gl.lastMonthlyResult(entityId, month),
      verification: this.gl.verifyEntity(entityId)
    };
  }

  verifyCountry(country, settlementLedger, month) {
    let maxEquationError = 0;
    let entityFailures = 0;
    let cashError = 0;
    let assets = 0;
    let liabilities = 0;
    let equity = 0;
    let inventoryBook = 0;
    let fixedAssets = 0;

    const customers = [...country.households, ...country.firms];
    const all = [...customers, ...(country.banks || [])];
    for (const entity of all) {
      const verify = this.gl.verifyEntity(entity.id);
      const bs = this.gl.balanceSheet(entity.id);
      if (!verify.ok) entityFailures += 1;
      maxEquationError = Math.max(maxEquationError, Math.abs(verify.equationError));
      assets += bs.assets;
      liabilities += bs.liabilities;
      equity += bs.equity;

      if (entity.kind === 'firm') {
        inventoryBook += Math.max(0, bs.accounts.inventory || 0) + Math.max(0, bs.accounts.input_inventory || 0);
        fixedAssets += Math.max(0, bs.accounts.fixed_assets || 0);
      }

      if (entity.kind !== 'bank') {
        const accountingCash = this.gl.naturalBalance(entity.id, 'cash');
        const settlementCash = settlementLedger.balance(entity.accountId);
        cashError = Math.max(cashError, Math.abs(accountingCash - settlementCash));
      }
    }

    const settlement = settlementLedger.verifyCountry(country.id);
    const borrowerLoanLiabilities = customers.reduce((s, entity) => s + Math.max(0, this.gl.naturalBalance(entity.id, 'loan_payable')), 0);
    const bankLoans = (country.banks || []).reduce((s, bank) => s + Math.max(0, this.gl.naturalBalance(bank.id, 'loans')), 0);
    const bankDeposits = (country.banks || []).reduce((s, bank) => s + Math.max(0, this.gl.naturalBalance(bank.id, 'deposits')), 0);
    const depositReconciliationError = bankDeposits - settlement.currentMoney;
    const loanReconciliationError = bankLoans - borrowerLoanLiabilities;

    return {
      ok:
        entityFailures === 0 &&
        maxEquationError < 1e-6 &&
        cashError < 1e-6 &&
        Math.abs(depositReconciliationError) < 1e-6 &&
        Math.abs(loanReconciliationError) < 1e-6 &&
        settlement.ok,
      entityFailures,
      maxEquationError,
      maxCashReconciliationError: cashError,
      depositReconciliationError,
      loanReconciliationError,
      bankDeposits,
      bankLoans,
      borrowerLoanLiabilities,
      inventoryBook,
      fixedAssets,
      assets,
      liabilities,
      equity,
      settlementMoneyError: settlement.moneyError,
      month
    };
  }

  recentJournals(entityId, limit = 10) {
    const entity = this.gl.entities.get(entityId);
    return entity ? entity.journals.slice(-limit).map(j => ({ ...j, lines: j.lines.map(x => ({ ...x })) })) : [];
  }
}
