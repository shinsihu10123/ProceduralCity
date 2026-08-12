import { ACCOUNT_TYPES, GeneralLedger } from './general-ledger.js';

const householdChart = [
  { code: 'cash', name: 'Cash', type: ACCOUNT_TYPES.ASSET },
  { code: 'wage_receivable', name: 'Wage Receivable', type: ACCOUNT_TYPES.ASSET },
  { code: 'opening_equity', name: 'Opening Equity', type: ACCOUNT_TYPES.EQUITY },
  { code: 'retained_earnings', name: 'Retained Earnings', type: ACCOUNT_TYPES.EQUITY },
  { code: 'wage_income', name: 'Wage Income', type: ACCOUNT_TYPES.REVENUE },
  { code: 'consumption_expense', name: 'Consumption Expense', type: ACCOUNT_TYPES.EXPENSE }
];

const firmChart = [
  { code: 'cash', name: 'Cash', type: ACCOUNT_TYPES.ASSET },
  { code: 'inventory', name: 'Inventory', type: ACCOUNT_TYPES.ASSET },
  { code: 'wages_payable', name: 'Wages Payable', type: ACCOUNT_TYPES.LIABILITY },
  { code: 'opening_equity', name: 'Opening Equity', type: ACCOUNT_TYPES.EQUITY },
  { code: 'retained_earnings', name: 'Retained Earnings', type: ACCOUNT_TYPES.EQUITY },
  { code: 'sales_revenue', name: 'Sales Revenue', type: ACCOUNT_TYPES.REVENUE },
  { code: 'cogs', name: 'Cost of Goods Sold', type: ACCOUNT_TYPES.EXPENSE }
];

export class AccountingSystem {
  constructor() {
    this.gl = new GeneralLedger();
    this.lastCountryReports = new Map();
  }

  initializeCountry(country, settlementLedger) {
    for (const h of country.households) {
      this.gl.createEntity({ id: h.id, countryId: country.id, kind: 'household', accounts: householdChart });
      const cash = settlementLedger.balance(h.accountId);
      if (cash > 0) {
        this.gl.post({
          month: 0,
          entityId: h.id,
          kind: 'opening_balance',
          lines: [
            { account: 'cash', debit: cash },
            { account: 'opening_equity', credit: cash }
          ]
        });
      }
    }

    for (const f of country.firms) {
      this.gl.createEntity({ id: f.id, countryId: country.id, kind: 'firm', accounts: firmChart });
      const cash = settlementLedger.balance(f.accountId);
      const unitCost = Math.max(0.02, f.price * 0.42);
      const inventoryValue = Math.max(0, f.inventory * unitCost);
      f.bookUnitCost = unitCost;
      const openingAssets = cash + inventoryValue;
      this.gl.post({
        month: 0,
        entityId: f.id,
        kind: 'opening_balance',
        lines: [
          ...(cash > 0 ? [{ account: 'cash', debit: cash }] : []),
          ...(inventoryValue > 0 ? [{ account: 'inventory', debit: inventoryValue }] : []),
          { account: 'opening_equity', credit: openingAssets }
        ]
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
      const inventoryBook = this.gl.naturalBalance(f.id, 'inventory');
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

    const report = this.verifyCountry(country, settlementLedger, month);
    const summary = {
      month,
      householdIncome,
      householdExpense,
      householdNetIncome,
      firmRevenue,
      firmExpense,
      firmProfit,
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

    const all = [...country.households, ...country.firms];
    for (const entity of all) {
      const verify = this.gl.verifyEntity(entity.id);
      const bs = this.gl.balanceSheet(entity.id);
      if (!verify.ok) entityFailures += 1;
      maxEquationError = Math.max(maxEquationError, Math.abs(verify.equationError));
      assets += bs.assets;
      liabilities += bs.liabilities;
      equity += bs.equity;
      const accountingCash = this.gl.naturalBalance(entity.id, 'cash');
      const settlementCash = settlementLedger.balance(entity.accountId);
      cashError = Math.max(cashError, Math.abs(accountingCash - settlementCash));
    }

    const settlement = settlementLedger.verifyCountry(country.id);
    return {
      ok: entityFailures === 0 && maxEquationError < 1e-6 && cashError < 1e-6 && settlement.ok,
      entityFailures,
      maxEquationError,
      maxCashReconciliationError: cashError,
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
