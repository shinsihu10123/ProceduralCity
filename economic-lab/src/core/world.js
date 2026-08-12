import { COUNTRY_SEEDS } from '../config/countries.js';
import { RNG, hashSeed, clamp } from './rng.js';
import { TransactionLedger } from './ledger.js';
import { AccountingSystem } from '../accounting/accounting-system.js';
import { householdDecision, firmDecision, updateForecastError } from '../ai/reasoning.js';
import { clearGoodsMarket } from '../markets/goods-market.js';
import { clearLaborMarket, settlePayroll } from '../markets/labor-market.js';

function makeHousehold(country, i, rng) {
  const employed = rng.next() > 0.075;
  const wage = country.initialWage * clamp(rng.normal(1, 0.18), 0.45, 1.8);
  const wealth = Math.max(20, country.householdWealth * clamp(rng.normal(1, 0.55), 0.08, 3.5));
  return {
    id: `${country.id}-H-${String(i + 1).padStart(4, '0')}`,
    accountId: `${country.id}:HH:${String(i + 1).padStart(4, '0')}`,
    countryId: country.id,
    wealth,
    income: 0,
    wage,
    reservationWage: wage * rng.range(0.66, 0.86),
    wageArrears: 0,
    skill: clamp(country.humanCapital * rng.normal(1, 0.18), 0.15, 1.5),
    employed,
    employerId: null,
    consumption: 0,
    desiredConsumptionBudget: 0,
    savings: 0,
    riskAversion: rng.range(0.15, 0.95),
    optimism: rng.range(-0.6, 0.6),
    biasInflation: rng.normal(0, 0.01),
    beliefs: { inflation: 0.02, jobRisk: 0.08, incomeGrowth: 0 },
    learning: {},
    lastPurchases: [],
    lastTrace: null
  };
}

function makeFirm(country, i, rng) {
  const workers = rng.int(5, 26);
  const cash = country.firmCash * clamp(rng.normal(1, 0.25), 0.4, 1.8);
  return {
    id: `${country.id}-F-${String(i + 1).padStart(3, '0')}`,
    accountId: `${country.id}:FIRM:${String(i + 1).padStart(3, '0')}`,
    countryId: country.id,
    price: country.initialPrice * clamp(rng.normal(1, 0.06), 0.78, 1.25),
    wage: country.initialWage * clamp(rng.normal(1, 0.08), 0.78, 1.28),
    workers,
    desiredWorkers: workers,
    productivity: country.productivity * clamp(rng.normal(1, 0.09), 0.65, 1.35),
    output: 0,
    sales: 0,
    revenue: 0,
    inventory: rng.range(18, 65),
    targetInventory: rng.range(28, 52),
    cash,
    safeCash: country.firmCash * 0.65,
    wageArrears: 0,
    bookUnitCost: 0,
    demandBias: rng.normal(0, 0.018),
    riskAversion: rng.range(0.10, 0.90),
    competitionSensitivity: rng.range(0.15, 0.95),
    beliefs: { demandGrowth: 0.01, costGrowth: 0.02 },
    learning: {},
    lastTrace: null,
    previousSales: 1,
    currentPlan: null
  };
}

function macroFrom(country, ledger) {
  const households = country.households;
  const firms = country.firms;
  const employed = households.filter(h => h.employed).length;
  const consumption = households.reduce((s, h) => s + h.consumption, 0);
  const realOutput = firms.reduce((s, f) => s + f.output, 0);
  const nominalOutput = firms.reduce((s, f) => s + f.output * f.price, 0);
  const nominalSales = firms.reduce((s, f) => s + f.revenue, 0);
  const wages = households.reduce((s, h) => s + h.income, 0);
  const priceWeight = firms.reduce((s, f) => s + Math.max(0.01, f.sales), 0);
  const priceIndex = firms.reduce((s, f) => s + f.price * Math.max(0.01, f.sales), 0) / Math.max(1e-9, priceWeight);
  const workerTotal = firms.reduce((s, f) => s + f.workers, 0);
  const avgWage = firms.reduce((s, f) => s + f.wage * f.workers, 0) / Math.max(1, workerTotal);
  const inventory = firms.reduce((s, f) => s + f.inventory, 0);
  const firmCash = firms.reduce((s, f) => s + ledger.balance(f.accountId), 0);
  const householdWealth = households.reduce((s, h) => s + ledger.balance(h.accountId), 0);
  const wageArrears = households.reduce((s, h) => s + Math.max(0, h.wageArrears || 0), 0);
  const goods = country.lastMarkets?.goods || {};
  const labor = country.lastMarkets?.labor || {};
  const payroll = country.lastMarkets?.payroll || {};
  const settlementAccounting = ledger.verifyCountry(country.id);
  const financial = country.lastAccounting || {};
  return {
    gdp: nominalOutput,
    realOutput,
    nominalSales,
    consumption,
    wageBill: wages,
    unemployment: 1 - employed / Math.max(1, households.length),
    priceIndex,
    avgWage,
    inventory,
    firmCash,
    householdWealth,
    moneySupply: ledger.totalBalance(country.id),
    goodsTransactions: goods.transactions || 0,
    payrollPayments: payroll.payments || 0,
    hires: labor.hires || 0,
    layoffs: labor.layoffs || 0,
    unfilledJobs: labor.unfilled || 0,
    unmetDemandRatio: goods.desiredBudget ? goods.unmetBudget / goods.desiredBudget : 0,
    wageArrears,
    accountingBalanced: settlementAccounting.ok && financial.ok !== false ? 1 : 0,
    moneyError: settlementAccounting.moneyError,
    totalAssets: financial.assets || 0,
    totalLiabilities: financial.liabilities || 0,
    totalEquity: financial.equity || 0,
    firmProfit: financial.firmProfit || 0,
    householdNetIncome: financial.householdNetIncome || 0,
    accountingEquationError: financial.maxEquationError || 0,
    cashReconciliationError: financial.maxCashReconciliationError || 0
  };
}

export class EconomicWorld {
  constructor(seedText = 'ECON-4-001') {
    this.seedText = seedText;
    this.rng = new RNG(hashSeed(seedText));
    this.month = 0;
    this.ledger = new TransactionLedger();
    this.accounting = new AccountingSystem();
    this.countries = COUNTRY_SEEDS.map(seed => this.createCountry(seed));
    this.relinkEmployment();
    this.initializeLedger();
    this.syncBalances();

    for (const country of this.countries) {
      this.accounting.initializeCountry(country, this.ledger);
      country.lastMarkets = {
        labor: { hires: 0, layoffs: 0, unfilled: 0 },
        payroll: { payroll: 0, unpaid: 0, payments: 0 },
        goods: { transactions: 0, nominalConsumption: 0, units: 0, desiredBudget: 0, unmetBudget: 0 },
        accrual: { accrued: 0, workers: 0 }
      };
      country.lastAccounting = {
        householdIncome: 0,
        householdExpense: 0,
        householdNetIncome: 0,
        firmRevenue: 0,
        firmExpense: 0,
        firmProfit: 0,
        ...this.accounting.verifyCountry(country, this.ledger, 0)
      };
      country.macro = macroFrom(country, this.ledger);
      country.previousMacro = { ...country.macro };
      country.history = [{ month: 0, ...country.macro }];
    }
  }

  createCountry(seed) {
    const local = new RNG(hashSeed(`${this.seedText}:${seed.id}`));
    return {
      ...seed,
      households: Array.from({ length: seed.households }, (_, i) => makeHousehold(seed, i, local)),
      firms: Array.from({ length: seed.firms }, (_, i) => makeFirm(seed, i, local)),
      macro: null,
      previousMacro: null,
      history: [],
      lastMarkets: null,
      lastAccounting: null
    };
  }

  initializeLedger() {
    for (const country of this.countries) {
      for (const h of country.households) {
        this.ledger.openAccount({
          id: h.accountId,
          ownerId: h.id,
          countryId: country.id,
          type: 'household_cash',
          openingBalance: h.wealth
        });
      }
      for (const f of country.firms) {
        this.ledger.openAccount({
          id: f.accountId,
          ownerId: f.id,
          countryId: country.id,
          type: 'firm_cash',
          openingBalance: f.cash
        });
      }
    }
  }

  syncBalances(country = null) {
    const countries = country ? [country] : this.countries;
    for (const c of countries) {
      for (const h of c.households) h.wealth = this.ledger.balance(h.accountId);
      for (const f of c.firms) f.cash = this.ledger.balance(f.accountId);
    }
  }

  relinkEmployment() {
    for (const country of this.countries) {
      const jobs = country.firms.flatMap(f => Array.from({ length: f.desiredWorkers }, () => f.id));
      for (const f of country.firms) f.workers = 0;
      let cursor = 0;
      for (const h of country.households) {
        if (h.employed && cursor < jobs.length) {
          h.employerId = jobs[cursor++];
          const f = country.firms.find(x => x.id === h.employerId);
          f.workers += 1;
          h.wage = f.wage;
        } else {
          h.employed = false;
          h.employerId = null;
        }
      }
    }
  }

  step(months = 1) {
    for (let k = 0; k < months; k++) this.stepMonth();
  }

  stepMonth() {
    this.month += 1;
    for (const country of this.countries) this.stepCountry(country);
  }

  stepCountry(country) {
    this.syncBalances(country);
    const prev = country.previousMacro;
    const prev2 = country.history.length > 1 ? country.history[country.history.length - 2] : prev;
    const inflation = prev2.priceIndex ? prev.priceIndex / prev2.priceIndex - 1 : 0;
    const wageGrowth = prev2.avgWage ? prev.avgWage / prev2.avgWage - 1 : 0;
    const demandGrowth = prev2.nominalSales ? prev.nominalSales / prev2.nominalSales - 1 : 0;
    const signals = { inflation, wageGrowth, demandGrowth, unemployment: prev.unemployment };

    for (const f of country.firms) {
      const decision = firmDecision(f, signals, this.rng);
      f.lastTrace = decision.trace;
      f.currentPlan = decision;
      f.price = Math.max(0.08, f.price * (1 + clamp(decision.priceChange, -0.08, 0.10)));
      f.desiredWorkers = Math.max(0, Math.round(Math.max(1, f.workers) * (1 + clamp(decision.hiringChange, -0.10, 0.12))));
    }

    const labor = clearLaborMarket(country, this.rng);

    for (const f of country.firms) {
      const decision = f.currentPlan;
      const laborInput = Math.max(0, f.workers);
      const capitalEffect = 0.78 + country.capitalDepth * 0.34;
      const humanEffect = 0.82 + country.humanCapital * 0.30;
      const resourceEffect = 0.90 + country.resourceBase * 0.14;
      f.output = laborInput * f.productivity * capitalEffect * humanEffect * resourceEffect * (1 + clamp(decision.productionChange, -0.12, 0.15));
      f.inventory += Math.max(0, f.output);
    }

    const accrual = this.accounting.accrueMonthlyWages(country, this.month);
    const payroll = settlePayroll(country, this.ledger, this.month);
    this.syncBalances(country);

    for (const h of country.households) {
      const decision = householdDecision(h, signals, this.rng);
      h.lastTrace = decision.trace;
      const cash = this.ledger.balance(h.accountId);
      const bufferDraw = h.employed
        ? Math.min(cash * 0.006, h.wage * 0.08)
        : Math.min(cash * 0.04, h.wage * 0.35);
      h.desiredConsumptionBudget = Math.min(
        cash,
        Math.max(0, h.income * decision.consumeShare + bufferDraw)
      );
    }

    const goods = clearGoodsMarket(country, this.ledger, this.rng, this.month);
    const settlementEntries = [
      ...this.ledger.entriesFor({ month: this.month, countryId: country.id, kind: 'wage' }),
      ...this.ledger.entriesFor({ month: this.month, countryId: country.id, kind: 'goods_purchase' })
    ];
    this.accounting.ingestSettlementEntries(settlementEntries, country, this.month);
    this.syncBalances(country);

    for (const f of country.firms) {
      const actualGrowth = f.previousSales > 0 ? f.sales / f.previousSales - 1 : 0;
      updateForecastError(f, f.beliefs.demandGrowth, actualGrowth, 'demandForecast');
      f.previousSales = Math.max(0.01, f.sales);
    }

    country.lastMarkets = { labor, payroll, goods, accrual };
    country.lastAccounting = this.accounting.closeCountryMonth(country, this.ledger, this.month);
    country.previousMacro = country.macro;
    country.macro = macroFrom(country, this.ledger);
    country.history.push({ month: this.month, ...country.macro });
    if (country.history.length > 240) country.history.shift();
  }

  accountingReport(countryId) {
    const country = this.countries.find(c => c.id === countryId);
    if (!country) return null;
    return {
      settlement: this.ledger.verifyCountry(countryId),
      general: this.accounting.verifyCountry(country, this.ledger, this.month),
      summary: { ...country.lastAccounting }
    };
  }

  snapshot() {
    return {
      month: this.month,
      countries: this.countries.map(c => ({
        id: c.id,
        name: c.name,
        macro: { ...c.macro },
        markets: structuredClone(c.lastMarkets),
        accounting: this.ledger.verifyCountry(c.id),
        generalAccounting: structuredClone(c.lastAccounting),
        households: c.households.length,
        firms: c.firms.length,
        sampleHousehold: structuredClone(c.households[0]),
        sampleFirm: structuredClone(c.firms[0]),
        sampleHouseholdFinancials: this.accounting.entityStatement(c.households[0].id, this.month),
        sampleFirmFinancials: this.accounting.entityStatement(c.firms[0].id, this.month),
        sampleHouseholdJournals: this.accounting.recentJournals(c.households[0].id, 8),
        sampleFirmJournals: this.accounting.recentJournals(c.firms[0].id, 8),
        recentTransactions: this.ledger.entriesFor({ month: this.month, countryId: c.id }).slice(-12),
        history: c.history.slice()
      }))
    };
  }
}
