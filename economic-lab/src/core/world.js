import { COUNTRY_SEEDS } from '../config/countries.js';
import { industryById, industryForIndex } from '../config/industries.js';
import { RNG, hashSeed, clamp } from './rng.js';
import { TransactionLedger } from './ledger.js';
import { AccountingSystem } from '../accounting/accounting-system.js';
import { BankSystem } from '../banking/bank-system.js';
import { SupplyChainSystem } from '../industry/supply-chain.js';
import { GovernmentSystem } from '../fiscal/government-system.js';
import { householdDecision, firmDecision, updateForecastError } from '../ai/reasoning.js';
import { clearGoodsMarket } from '../markets/goods-market.js';
import { clearLaborMarket, settlePayroll } from '../markets/labor-market.js';

function makeHousehold(country, i, rng) {
  const employed = rng.next() > 0.075;
  const wage = country.initialWage * clamp(rng.normal(1, 0.18), 0.45, 1.8);
  const wealth = Math.max(20, country.householdWealth * clamp(rng.normal(1, 0.55), 0.08, 3.5));
  return {
    id: `${country.id}-H-${String(i + 1).padStart(4, '0')}`,
    kind: 'household',
    accountId: `${country.id}:HH:${String(i + 1).padStart(4, '0')}`,
    countryId: country.id,
    wealth,
    income: 0,
    incomeTaxPaid: 0,
    transferIncome: 0,
    disposableIncome: 0,
    wage,
    reservationWage: wage * rng.range(0.66, 0.86),
    wageArrears: 0,
    skill: clamp(country.humanCapital * rng.normal(1, 0.18), 0.15, 1.5),
    employed,
    employerId: null,
    bankId: null,
    loanBalance: 0,
    creditMisses: 0,
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

function makeFirm(country, i, rng, industryOverride = null, entrant = false) {
  const industry = industryOverride ? industryById(industryOverride) : industryForIndex(i, Number(country.firms) || 1);
  const workers = entrant ? 0 : rng.int(5, 26);
  const desiredWorkers = entrant ? rng.int(2, 6) : workers;
  const cash = entrant ? 0 : country.firmCash * clamp(rng.normal(1, 0.25), 0.4, 1.8);
  const inventory = entrant ? 0 : rng.range(18, 65);
  const capitalStock = entrant ? 0 : (18 + country.capitalDepth * 34) * clamp(rng.normal(1, 0.16), 0.6, 1.5);
  const serial = i + 1;
  return {
    id: `${country.id}-F-${String(serial).padStart(3, '0')}`,
    kind: 'firm',
    accountId: `${country.id}:FIRM:${String(serial).padStart(3, '0')}`,
    countryId: country.id,
    industryId: industry.id,
    industryName: industry.name,
    product: industry.product,
    consumerFacing: industry.consumerFacing,
    inputProduct: industry.inputProduct,
    inputPerOutput: industry.inputPerOutput,
    price: country.initialPrice * industry.priceMultiplier * clamp(rng.normal(1, 0.06), 0.78, 1.25),
    wage: country.initialWage * clamp(rng.normal(1, 0.08), 0.78, 1.28),
    workers,
    desiredWorkers,
    productivity: country.productivity * clamp(rng.normal(1, 0.09), 0.65, 1.35),
    output: 0,
    sales: 0,
    revenue: 0,
    consumerSales: 0,
    consumerRevenue: 0,
    b2bSales: 0,
    b2bRevenue: 0,
    capitalSales: 0,
    capitalRevenue: 0,
    inventory,
    targetInventory: entrant ? rng.range(12, 28) : rng.range(28, 52),
    inputInventory: industry.inputProduct ? { [industry.inputProduct]: 0 } : {},
    inputBookValues: industry.inputProduct ? { [industry.inputProduct]: 0 } : {},
    inputSpend: 0,
    investmentSpend: 0,
    supplyShortage: 0,
    desiredProduction: 0,
    capacity: 0,
    capitalStock,
    capitalBookValue: entrant ? 0 : capitalStock * country.initialPrice * 1.35,
    active: true,
    distressMonths: 0,
    cash,
    safeCash: country.firmCash * (entrant ? 0.45 : 0.65),
    wageArrears: 0,
    bookUnitCost: 0,
    bankId: null,
    loanBalance: 0,
    creditMisses: 0,
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
  const active = country.firms.filter(f => f.active !== false);
  const consumerFirms = active.filter(f => f.consumerFacing === true);
  const employed = households.filter(h => h.employed).length;
  const consumption = households.reduce((s, h) => s + h.consumption, 0);
  const disposableIncome = households.reduce((s, h) => s + Math.max(0, Number(h.disposableIncome || 0)), 0);
  const realOutput = consumerFirms.reduce((s, f) => s + f.output, 0);
  const nominalSales = active.reduce((s, f) => s + f.revenue, 0);
  const wages = households.reduce((s, h) => s + h.income, 0);
  const priceWeight = consumerFirms.reduce((s, f) => s + Math.max(0.01, f.consumerSales || 0), 0);
  const priceIndex = consumerFirms.length
    ? consumerFirms.reduce((s, f) => s + f.price * Math.max(0.01, f.consumerSales || 0), 0) / Math.max(1e-9, priceWeight)
    : 1;
  const workerTotal = active.reduce((s, f) => s + f.workers, 0);
  const avgWage = active.reduce((s, f) => s + f.wage * f.workers, 0) / Math.max(1, workerTotal);
  const inventory = active.reduce((s, f) => s + f.inventory + Object.values(f.inputInventory || {}).reduce((a, x) => a + Number(x || 0), 0), 0);
  const firmCash = country.firms.reduce((s, f) => s + ledger.balance(f.accountId), 0);
  const householdWealth = households.reduce((s, h) => s + ledger.balance(h.accountId), 0);
  const wageArrears = households.reduce((s, h) => s + Math.max(0, h.wageArrears || 0), 0);
  const goods = country.lastMarkets?.goods || {};
  const labor = country.lastMarkets?.labor || {};
  const payroll = country.lastMarkets?.payroll || {};
  const credit = country.lastCredit || {};
  const industry = country.lastIndustry || {};
  const fiscal = country.lastFiscal || {};
  const settlementAccounting = ledger.verifyCountry(country.id);
  const financial = country.lastAccounting || {};
  const inventoryBook = Number(financial.inventoryBook || 0);
  const previousInventoryBook = Number(country.previousInventoryBook || inventoryBook);
  const inventoryInvestment = inventoryBook - previousInventoryBook;
  const grossInvestment = Number(industry.grossInvestment || 0);
  const governmentConsumption = Number(fiscal.governmentConsumption || 0);
  const publicInvestment = Number(fiscal.publicInvestment || 0);
  const gdp = consumption + grossInvestment + publicInvestment + governmentConsumption + inventoryInvestment;

  return {
    gdp,
    realOutput,
    nominalSales,
    consumption,
    disposableIncome,
    grossInvestment,
    publicInvestment,
    governmentConsumption,
    governmentDemand: publicInvestment + governmentConsumption,
    inventoryInvestment,
    taxRevenue: fiscal.taxRevenue || 0,
    incomeTax: fiscal.incomeTax || 0,
    consumptionTax: fiscal.consumptionTax || 0,
    corporateTax: fiscal.corporateTax || 0,
    governmentTransfers: fiscal.transfers || 0,
    fiscalPrimaryBalance: fiscal.primaryBalance || 0,
    fiscalOverallBalance: fiscal.overallBalance || 0,
    publicDebt: fiscal.outstandingDebt || 0,
    publicDebtRatio: fiscal.debtRatio || 0,
    governmentCash: fiscal.governmentCash || 0,
    publicCapital: fiscal.publicCapital || 0,
    governmentBondIssued: fiscal.bondIssued || 0,
    governmentInterestPaid: fiscal.interestPaid || 0,
    governmentAccountingBalanced: fiscal.accountingOk === false ? 0 : 1,
    b2bTrade: industry.b2bSpend || 0,
    b2bTransactions: industry.b2bTransactions || 0,
    inputShortageUnits: industry.inputShortageUnits || 0,
    activeFirms: industry.activeFirms ?? active.length,
    firmExits: industry.exits || 0,
    firmEntries: industry.entries || 0,
    resourceOutput: industry.sectorOutputs?.RESOURCE || 0,
    materialsOutput: industry.sectorOutputs?.MATERIALS || 0,
    capitalGoodsOutput: industry.sectorOutputs?.CAPITAL || 0,
    consumerGoodsOutput: industry.sectorOutputs?.CONSUMER || 0,
    wageBill: wages,
    unemployment: 1 - employed / Math.max(1, households.length),
    priceIndex,
    avgWage,
    inventory,
    inventoryBook,
    fixedAssets: financial.fixedAssets || 0,
    firmCash,
    householdWealth,
    moneySupply: ledger.totalBalance(country.id),
    moneyCreatedNet: settlementAccounting.authorizedMoneyDelta || 0,
    goodsTransactions: goods.transactions || 0,
    payrollPayments: payroll.payments || 0,
    hires: labor.hires || 0,
    layoffs: labor.layoffs || 0,
    unfilledJobs: labor.unfilled || 0,
    unmetDemandRatio: goods.desiredBudget ? goods.unmetBudget / goods.desiredBudget : 0,
    wageArrears,
    creditApplications: credit.applications || 0,
    creditApproved: credit.approved || 0,
    newCredit: credit.newCredit || 0,
    principalRepaid: credit.principalRepaid || 0,
    interestPaid: credit.interestPaid || 0,
    loanDefaults: credit.defaults || 0,
    chargeOffs: credit.chargeOffs || 0,
    outstandingLoans: credit.outstandingLoans || 0,
    bankDeposits: financial.bankDeposits || 0,
    bankLoans: financial.bankLoans || 0,
    accountingBalanced: settlementAccounting.ok && financial.ok !== false && fiscal.accountingOk !== false ? 1 : 0,
    moneyError: settlementAccounting.moneyError,
    totalAssets: financial.assets || 0,
    totalLiabilities: financial.liabilities || 0,
    totalEquity: financial.equity || 0,
    firmProfit: financial.firmProfit || 0,
    bankProfit: financial.bankProfit || 0,
    householdNetIncome: financial.householdNetIncome || 0,
    accountingEquationError: financial.maxEquationError || 0,
    cashReconciliationError: financial.maxCashReconciliationError || 0,
    depositReconciliationError: financial.depositReconciliationError || 0,
    loanReconciliationError: financial.loanReconciliationError || 0
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
    this.banking = new BankSystem({ ledger: this.ledger, accounting: this.accounting, rng: this.rng });
    this.supply = new SupplyChainSystem({ ledger: this.ledger, accounting: this.accounting, rng: this.rng });
    this.fiscal = new GovernmentSystem({ ledger: this.ledger, accounting: this.accounting, rng: this.rng });

    for (const country of this.countries) {
      this.supply.initializeCountry(country);
      this.accounting.initializeCountry(country, this.ledger);
      this.banking.initializeCountry(country);
      this.fiscal.initializeCountry(country);
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
        bankRevenue: 0,
        bankExpense: 0,
        bankProfit: 0,
        ...this.accounting.verifyCountry(country, this.ledger, 0)
      };
      country.previousInventoryBook = country.lastAccounting.inventoryBook || 0;
      country.macro = macroFrom(country, this.ledger);
      country.previousMacro = { ...country.macro };
      country.history = [{ month: 0, ...country.macro }];
    }
  }

  createCountry(seed) {
    const local = new RNG(hashSeed(`${this.seedText}:${seed.id}`));
    const initialFirmCount = seed.firms;
    return {
      ...seed,
      firmsSeedCount: initialFirmCount,
      households: Array.from({ length: seed.households }, (_, i) => makeHousehold(seed, i, local)),
      firms: Array.from({ length: initialFirmCount }, (_, i) => makeFirm(seed, i, local)),
      nextFirmSerial: initialFirmCount + 1,
      banks: [],
      loans: [],
      governments: [],
      governmentBonds: [],
      macro: null,
      previousMacro: null,
      previousInventoryBook: 0,
      history: [],
      lastMarkets: null,
      lastCredit: null,
      lastIndustry: null,
      lastFiscal: null,
      lastAccounting: null
    };
  }

  createEntrant(country, industryId) {
    const serial = country.nextFirmSerial++;
    const f = makeFirm(country, serial - 1, this.rng, industryId, true);
    country.firms.push(f);
    this.supply.initializeFirm(f, country);
    this.ledger.openAccount({
      id: f.accountId,
      ownerId: f.id,
      countryId: country.id,
      type: 'firm_deposit',
      openingBalance: 0
    });
    this.accounting.initializeFirm(f, this.ledger, this.month);
    this.banking.registerFirm(country, f);
    this.fiscal.registerFirm(f);
    return f;
  }

  initializeLedger() {
    for (const country of this.countries) {
      for (const h of country.households) {
        this.ledger.openAccount({
          id: h.accountId,
          ownerId: h.id,
          countryId: country.id,
          type: 'household_deposit',
          openingBalance: h.wealth
        });
      }
      for (const f of country.firms) {
        this.ledger.openAccount({
          id: f.accountId,
          ownerId: f.id,
          countryId: country.id,
          type: 'firm_deposit',
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
      if (c.governments?.length) c.governments[0].cash = this.ledger.balance(c.governments[0].accountId);
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

    const debtService = this.banking.serviceDebt(country, this.month);
    this.fiscal.beginMonth(country, this.month, signals, prev);
    this.syncBalances(country);
    this.supply.beginMonth(country);

    for (const f of country.firms) {
      if (f.active === false) continue;
      const decision = firmDecision(f, signals, this.rng);
      f.lastTrace = decision.trace;
      f.currentPlan = decision;
      f.price = Math.max(0.08, f.price * (1 + clamp(decision.priceChange, -0.08, 0.10)));
      f.desiredWorkers = Math.max(0, Math.round(Math.max(1, f.workers) * (1 + clamp(decision.hiringChange, -0.10, 0.12))));
    }

    const creditOriginations = this.banking.originateCredit(country, this.month, signals);
    this.syncBalances(country);

    const labor = clearLaborMarket(country, this.rng);
    this.supply.planProduction(country);
    let industryMetrics = this.supply.procureInputs(country, this.month);
    industryMetrics = this.supply.produce(country, this.month, industryMetrics);

    const accrual = this.accounting.accrueMonthlyWages(country, this.month);
    const payroll = settlePayroll(country, this.ledger, this.month);
    this.syncBalances(country);

    this.fiscal.collectIncomeTaxes(country, this.month);
    this.fiscal.payAutomaticTransfers(country, this.month);
    this.syncBalances(country);

    industryMetrics = this.supply.clearInvestmentMarket(country, this.month, industryMetrics);
    this.syncBalances(country);

    for (const h of country.households) {
      const decision = householdDecision(h, signals, this.rng);
      h.lastTrace = decision.trace;
      const cash = this.ledger.balance(h.accountId);
      h.disposableIncome = Math.max(0, h.income - (h.incomeTaxPaid || 0) + (h.transferIncome || 0));
      const bufferDraw = h.employed
        ? Math.min(cash * 0.006, h.wage * 0.08)
        : Math.min(cash * 0.04, h.wage * 0.35);
      h.desiredConsumptionBudget = Math.min(
        cash,
        Math.max(0, h.disposableIncome * decision.consumeShare + bufferDraw)
      );
    }

    const goods = clearGoodsMarket(country, this.ledger, this.rng, this.month);
    const settlementEntries = [
      ...this.ledger.entriesFor({ month: this.month, countryId: country.id, kind: 'wage' }),
      ...this.ledger.entriesFor({ month: this.month, countryId: country.id, kind: 'goods_purchase' })
    ];
    this.accounting.ingestSettlementEntries(settlementEntries, country, this.month);

    this.fiscal.collectConsumptionTaxes(country, this.month);
    this.fiscal.executeGovernmentDemand(country, this.month, prev);
    this.fiscal.collectCorporateTaxes(country, this.month);
    this.syncBalances(country);

    for (const f of country.firms) {
      if (f.active === false) continue;
      const actualGrowth = f.previousSales > 0 ? f.sales / f.previousSales - 1 : 0;
      updateForecastError(f, f.beliefs.demandGrowth, actualGrowth, 'demandForecast');
      f.previousSales = Math.max(0.01, f.sales);
    }

    country.lastCredit = this.banking.combineMetrics(debtService, creditOriginations, country);
    country.lastMarkets = { labor, payroll, goods, accrual };
    country.lastIndustry = this.supply.finalizeMetrics(country, industryMetrics);
    country.lastFiscal = this.fiscal.finalizeMonth(country, this.month, prev);
    country.lastAccounting = this.accounting.closeCountryMonth(country, this.ledger, this.month);

    const exitIndustries = this.supply.evaluateExits(country);
    country.lastIndustry.exits = exitIndustries.length;
    country.lastIndustry.exitIndustries = exitIndustries.slice();
    let entries = 0;
    for (const industryId of exitIndustries.slice(0, 2)) {
      this.createEntrant(country, industryId);
      entries += 1;
    }
    country.lastIndustry.entries = entries;
    country.lastIndustry.activeFirms = country.firms.filter(f => f.active !== false).length;

    country.previousMacro = country.macro;
    country.macro = macroFrom(country, this.ledger);
    country.previousInventoryBook = country.lastAccounting.inventoryBook || country.previousInventoryBook;
    country.history.push({ month: this.month, ...country.macro });
    if (country.history.length > 240) country.history.shift();
  }

  accountingReport(countryId) {
    const country = this.countries.find(c => c.id === countryId);
    if (!country) return null;
    return {
      settlement: this.ledger.verifyCountry(countryId),
      general: this.accounting.verifyCountry(country, this.ledger, this.month),
      fiscal: this.fiscal.verifyCountry(country),
      summary: { ...country.lastAccounting },
      fiscalSummary: { ...country.lastFiscal }
    };
  }

  snapshot() {
    return {
      month: this.month,
      countries: this.countries.map(c => {
        const bank = c.banks[0];
        const government = c.governments[0];
        const sampleFirm = c.firms.find(f => f.active !== false && f.consumerFacing) || c.firms.find(f => f.active !== false) || c.firms[0];
        const recentB2B = this.ledger.entriesFor({ month: this.month, countryId: c.id })
          .filter(e => e.kind === 'interfirm_purchase' || e.kind === 'capital_investment')
          .slice(-12);
        const recentFiscal = this.ledger.entriesFor({ month: this.month, countryId: c.id })
          .filter(e => ['income_tax', 'consumption_tax', 'corporate_tax', 'unemployment_transfer', 'government_consumption', 'public_investment', 'government_bond_issue', 'government_bond_payment'].includes(e.kind))
          .slice(-14);
        const sectorFirms = {};
        for (const f of c.firms.filter(x => x.active !== false)) sectorFirms[f.industryId] = (sectorFirms[f.industryId] || 0) + 1;
        return {
          id: c.id,
          name: c.name,
          macro: { ...c.macro },
          markets: structuredClone(c.lastMarkets),
          credit: structuredClone(c.lastCredit),
          industry: structuredClone(c.lastIndustry),
          fiscal: structuredClone(c.lastFiscal),
          sectorFirms,
          accounting: this.ledger.verifyCountry(c.id),
          generalAccounting: structuredClone(c.lastAccounting),
          fiscalAccounting: this.fiscal.verifyCountry(c),
          households: c.households.length,
          firms: c.firms.length,
          activeFirms: c.firms.filter(f => f.active !== false).length,
          banks: c.banks.length,
          governments: c.governments.length,
          activeLoans: c.loans.filter(x => x.status === 'active').length,
          activeGovernmentBonds: c.governmentBonds.filter(x => x.status === 'active').length,
          sampleHousehold: structuredClone(c.households[0]),
          sampleFirm: structuredClone(sampleFirm),
          sampleBank: structuredClone(bank),
          sampleGovernment: structuredClone(government),
          sampleLoan: structuredClone(c.loans.find(x => x.status === 'active') || c.loans[0] || null),
          sampleGovernmentBond: structuredClone(c.governmentBonds.find(x => x.status === 'active') || c.governmentBonds[0] || null),
          sampleHouseholdFinancials: this.accounting.entityStatement(c.households[0].id, this.month),
          sampleFirmFinancials: this.accounting.entityStatement(sampleFirm.id, this.month),
          sampleBankFinancials: this.accounting.entityStatement(bank.id, this.month),
          sampleGovernmentFinancials: this.accounting.entityStatement(government.id, this.month),
          sampleHouseholdJournals: this.accounting.recentJournals(c.households[0].id, 8),
          sampleFirmJournals: this.accounting.recentJournals(sampleFirm.id, 10),
          sampleBankJournals: this.accounting.recentJournals(bank.id, 8),
          sampleGovernmentJournals: this.accounting.recentJournals(government.id, 10),
          recentB2B,
          recentFiscal,
          recentTransactions: this.ledger.entriesFor({ month: this.month, countryId: c.id }).slice(-18),
          history: c.history.slice()
        };
      })
    };
  }
}