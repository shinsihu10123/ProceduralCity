import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import {
  applyB6FirmShadow,
  b6FacilityLoans,
  b6FirmTag,
  b6MonthMetrics,
  configureB6ShadowWorld
} from '../src/research/b6-input-output-working-capital-shadow.js';

const ROOT = process.cwd();
const CONTRACT_PATH = resolve(ROOT, 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b6-input-output-working-capital-contract.json');
const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const months = Math.max(1, Math.round(Number(process.env.DIAG_MONTHS || contract.stage1Execution.months || 12)));
const candidateId = (process.env.CANDIDATE || contract.factorial.controlCandidateId).trim();
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const candidate = contract.factorial.candidates.find((entry) => entry.id === candidateId);
const EPS = 1e-9;

assert.ok(candidate, `Unknown B6 candidate ${candidateId}`);
assert.ok(contract.stage1Execution.originalSeeds.includes(seed), `Seed ${seed} is outside frozen B6 Stage-1 set`);
assert.equal(months, contract.stage1Execution.months, 'B6 Stage-1 month horizon is frozen');

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = (values) => values.reduce((total, value) => total + finite(value), 0);
const ratio = (numerator, denominator) => Math.abs(finite(denominator)) > EPS ? finite(numerator) / finite(denominator) : null;
const safeShare = (numerator, denominator, zeroValue = 0) => Math.abs(finite(denominator)) > EPS ? finite(numerator) / finite(denominator) : zeroValue;

function percentile(values, probability) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function statistics(values) {
  const finiteValues = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finiteValues.length) return { count: 0, min: null, p25: null, median: null, p75: null, max: null, iqr: null, mean: null };
  const p25 = percentile(finiteValues, 0.25);
  const p75 = percentile(finiteValues, 0.75);
  return {
    count: finiteValues.length,
    min: finiteValues[0],
    p25,
    median: percentile(finiteValues, 0.5),
    p75,
    max: finiteValues.at(-1),
    iqr: p75 - p25,
    mean: sum(finiteValues) / finiteValues.length
  };
}

function worldDigest(world) {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({ month: world.month, rng: world.rng }));
  for (const country of world.countries) hash.update(JSON.stringify(country));
  hash.update(JSON.stringify(world.ledger.entries));
  for (const entity of [...world.accounting.gl.entities.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    hash.update(JSON.stringify({
      id: entity.id,
      accounts: [...entity.accounts.values()],
      journals: entity.journals,
      monthlyResults: [...entity.monthlyResults.entries()]
    }));
  }
  hash.update(JSON.stringify(world.international.trades));
  hash.update(JSON.stringify(world.international.fundingContracts));
  return hash.digest('hex');
}

function protectedSurface(world) {
  return world.countries.map((country) => ({
    id: country.id,
    macroParameters: {
      initialWage: country.initialWage,
      initialPrice: country.initialPrice,
      productivity: country.productivity,
      taxRate: country.taxRate,
      householdWealth: country.householdWealth,
      firmCash: country.firmCash,
      financialAccess: country.financialAccess,
      openness: country.openness,
      humanCapital: country.humanCapital,
      resourceBase: country.resourceBase
    },
    households: country.households.map((household) => ({
      id: household.id,
      accountId: household.accountId,
      wealth: household.wealth,
      wage: household.wage,
      desiredConsumptionBudget: household.desiredConsumptionBudget,
      employed: household.employed,
      employerId: household.employerId,
      riskAversion: household.riskAversion,
      optimism: household.optimism
    })),
    firms: country.firms.map((firm) => ({
      id: firm.id,
      accountId: firm.accountId,
      industryId: firm.industryId,
      product: firm.product,
      inputProduct: firm.inputProduct,
      price: firm.price,
      wage: firm.wage,
      workers: firm.workers,
      desiredWorkers: firm.desiredWorkers,
      inventory: firm.inventory,
      inputInventory: firm.inputInventory,
      inputBookValues: firm.inputBookValues,
      capitalStock: firm.capitalStock,
      capitalBookValue: firm.capitalBookValue,
      cash: firm.cash,
      safeCash: firm.safeCash,
      active: firm.active,
      riskAversion: firm.riskAversion,
      competitionSensitivity: firm.competitionSensitivity
    })),
    banks: country.banks.map((bank) => ({
      id: bank.id,
      baseAnnualRate: bank.baseAnnualRate,
      loanMarkup: bank.loanMarkup,
      minCapitalRatio: bank.minCapitalRatio,
      initialCapitalRatio: bank.initialCapitalRatio,
      riskAversion: bank.riskAversion
    })),
    governments: country.governments.map((government) => ({
      id: government.id,
      baseIncomeTaxRate: government.baseIncomeTaxRate,
      baseConsumptionTaxRate: government.baseConsumptionTaxRate,
      baseCorporateTaxRate: government.baseCorporateTaxRate,
      baseBenefitReplacementRate: government.baseBenefitReplacementRate
    }))
  }));
}

function axisApplicationExact(canonicalWorld, shadowWorld, initialOnly = false) {
  const canonicalByFirm = new Map(canonicalWorld.countries.flatMap((country) => country.firms.map((firm) => [firm.id, firm])));
  for (const country of shadowWorld.countries) {
    for (const firm of country.firms) {
      const tag = b6FirmTag(firm);
      if (!tag || tag.applicationCount !== 1 || tag.candidateId !== candidate.id) return false;
      const canonicalFirm = canonicalByFirm.get(firm.id);
      if (canonicalFirm) {
        if (Math.abs(tag.baseProductivity - finite(canonicalFirm.productivity)) > 1e-10) return false;
        if (Math.abs(tag.baseInputPerOutput - finite(canonicalFirm.inputPerOutput)) > 1e-10) return false;
      } else if (initialOnly) return false;
      const expectedProductivity = tag.baseProductivity * tag.productivityFactor;
      if (Math.abs(finite(firm.productivity) - expectedProductivity) > 1e-8) return false;
      const expectedInput = firm.inputProduct ? tag.baseInputPerOutput / tag.materialEfficiencyDivisor : tag.baseInputPerOutput;
      if (Math.abs(finite(firm.inputPerOutput) - expectedInput) > 1e-10) return false;
    }
  }
  return true;
}

function openingStocks(world) {
  const output = new Map();
  for (const country of world.countries) {
    const firmFinished = new Map();
    const firmInput = new Map();
    const firmWagesPayable = new Map();
    const householdWageReceivable = new Map();
    for (const firm of country.firms) {
      firmFinished.set(firm.id, Math.max(0, world.accounting.gl.naturalBalance(firm.id, 'inventory')));
      firmInput.set(firm.id, Math.max(0, world.accounting.gl.naturalBalance(firm.id, 'input_inventory')));
      firmWagesPayable.set(firm.id, Math.max(0, world.accounting.gl.naturalBalance(firm.id, 'wages_payable')));
    }
    for (const household of country.households) householdWageReceivable.set(household.id, Math.max(0, world.accounting.gl.naturalBalance(household.id, 'wage_receivable')));
    output.set(country.id, {
      finished: sum([...firmFinished.values()]),
      input: sum([...firmInput.values()]),
      wagesPayable: sum([...firmWagesPayable.values()]),
      wageReceivable: sum([...householdWageReceivable.values()]),
      firmFinished,
      firmInput,
      firmWagesPayable,
      householdWageReceivable,
      householdCash: sum(country.households.map((household) => world.ledger.balance(household.accountId)))
    });
  }
  return output;
}

function journals(world, entities, month) {
  return entities.flatMap((entity) =>
    (world.accounting.gl.entities.get(entity.id)?.journals || []).filter((journal) => Number(journal.month) === Number(month) && journal.kind !== 'period_close')
  );
}

function journalAmount(journalRows, account, side, kind = null) {
  return sum(journalRows
    .filter((journal) => kind === null || journal.kind === kind)
    .flatMap((journal) => journal.lines || [])
    .filter((line) => line.account === account)
    .map((line) => finite(line[side])));
}

function facilityAccounting(world, country, month) {
  const loans = b6FacilityLoans(country, candidate.id);
  const loanIds = new Set(loans.map((loan) => loan.id));
  const firmJournals = journals(world, country.firms, month);
  const allFirmJournals = country.firms.flatMap((firm) => world.accounting.gl.entities.get(firm.id)?.journals || []);
  const paymentJournals = firmJournals.filter((journal) => journal.kind === 'loan_payment' && loanIds.has(journal.meta?.loanId));
  const defaultJournals = firmJournals.filter((journal) => journal.kind === 'loan_default_relief' && loanIds.has(journal.meta?.loanId));
  const allDefaultJournals = allFirmJournals.filter((journal) => journal.kind === 'loan_default_relief' && loanIds.has(journal.meta?.loanId));
  return {
    loans,
    originationsThisMonth: sum(loans.filter((loan) => loan.originatedMonth === month).map((loan) => loan.originalPrincipal)),
    cumulativeOriginations: sum(loans.map((loan) => loan.originalPrincipal)),
    principalRepaidThisMonth: journalAmount(paymentJournals, 'loan_payable', 'debit'),
    interestPaidThisMonth: journalAmount(paymentJournals, 'interest_expense', 'debit'),
    chargeOffsThisMonth: journalAmount(defaultJournals, 'loan_payable', 'debit'),
    cumulativeChargeOffs: journalAmount(allDefaultJournals, 'loan_payable', 'debit'),
    outstanding: sum(loans.filter((loan) => loan.status === 'active').map((loan) => loan.outstanding)),
    arrears: sum(loans.filter((loan) => loan.status === 'active').map((loan) => loan.arrears)),
    defaults: loans.filter((loan) => loan.status === 'defaulted').length,
    activeLoans: loans.filter((loan) => loan.status === 'active').length
  };
}

function measureMonth(world, open, month) {
  const rows = [];
  for (const country of world.countries) {
    const firmJournals = journals(world, country.firms, month);
    const householdJournals = journals(world, country.households, month);
    const entries = world.ledger.entriesFor({ month, countryId: country.id });
    const countryOpen = open.get(country.id);
    const procurement = b6MonthMetrics(world, country.id, month);

    const labourCompensationAccrued = journalAmount(firmJournals, 'inventory', 'debit', 'production_labor_accrual');
    const householdWageIncomeAccrued = journalAmount(householdJournals, 'wage_income', 'credit', 'wage_accrual');
    const salesRevenue = journalAmount(firmJournals, 'sales_revenue', 'credit');
    const cogs = journalAmount(firmJournals, 'cogs', 'debit');
    const intermediateInputConsumed = journalAmount(firmJournals, 'inventory', 'debit', 'input_to_production');
    const inputPurchasesBook = journalAmount(firmJournals, 'input_inventory', 'debit', 'interfirm_input_purchase') + journalAmount(firmJournals, 'input_inventory', 'debit', 'international_input_import');
    const finishedClosing = sum(country.firms.map((firm) => Math.max(0, world.accounting.gl.naturalBalance(firm.id, 'inventory'))));
    const inputClosing = sum(country.firms.map((firm) => Math.max(0, world.accounting.gl.naturalBalance(firm.id, 'input_inventory'))));
    const wagePayableClosing = sum(country.firms.map((firm) => Math.max(0, world.accounting.gl.naturalBalance(firm.id, 'wages_payable'))));
    const wageReceivableClosing = sum(country.households.map((household) => Math.max(0, world.accounting.gl.naturalBalance(household.id, 'wage_receivable'))));
    const finishedInventoryBookChange = finishedClosing - countryOpen.finished;
    const inputInventoryBookChange = inputClosing - countryOpen.input;
    const wagesSettled = sum(entries.filter((entry) => entry.kind === 'wage').map((entry) => entry.amount));
    const transfersReceived = sum(entries.filter((entry) => entry.kind === 'unemployment_transfer').map((entry) => entry.amount));
    const incomeTaxesPaid = sum(entries.filter((entry) => entry.kind === 'income_tax').map((entry) => entry.amount));
    const consumptionTaxesPaid = sum(entries.filter((entry) => entry.kind === 'consumption_tax').map((entry) => entry.amount));
    const tariffRevenue = sum(entries.filter((entry) => entry.kind === 'tariff_payment').map((entry) => entry.amount));
    const householdConsumptionExpense = journalAmount(householdJournals, 'consumption_expense', 'debit');
    const householdCashClosing = sum(country.households.map((household) => world.ledger.balance(household.accountId)));
    const householdCashChange = householdCashClosing - countryOpen.householdCash;
    const cashDisposableIncome = wagesSettled + transfersReceived - incomeTaxesPaid;
    const realizedHouseholdPurchaserOutlay = householdConsumptionExpense + consumptionTaxesPaid;
    const netHouseholdSavingFlowProxy = cashDisposableIncome - realizedHouseholdPurchaserOutlay;
    const householdCashFlowResidual = householdCashChange - netHouseholdSavingFlowProxy;
    const gvaBasicProduction = salesRevenue + finishedInventoryBookChange - intermediateInputConsumed;
    const grossOperatingSurplusProxy = salesRevenue - cogs;
    const gvaBasicIncome = labourCompensationAccrued + grossOperatingSurplusProxy;
    const gdpMarketProxy = gvaBasicProduction + consumptionTaxesPaid + tariffRevenue;
    const productionInventoryBridgeResidual = finishedInventoryBookChange - (intermediateInputConsumed + labourCompensationAccrued - cogs);
    const gvaApproachResidual = gvaBasicProduction - gvaBasicIncome;
    const inputInventoryBridgeResidual = inputInventoryBookChange - (inputPurchasesBook - intermediateInputConsumed);
    const wagePayableBridgeResidual = countryOpen.wagesPayable + labourCompensationAccrued - wagesSettled - wagePayableClosing;
    const wageReceivableBridgeResidual = countryOpen.wageReceivable + householdWageIncomeAccrued - wagesSettled - wageReceivableClosing;
    const householdFirmAccrualResidual = labourCompensationAccrued - householdWageIncomeAccrued;
    const macroDisposableIncomeResidual = finite(country.macro?.disposableIncome) - cashDisposableIncome;
    const macroConsumptionResidual = finite(country.macro?.consumption) - householdConsumptionExpense;
    const macroWageBillResidual = finite(country.macro?.wageBill) - wagesSettled;
    const facility = facilityAccounting(world, country, month);
    const facilityArrearsRatio = safeShare(facility.arrears, facility.outstanding, 0);
    const facilityChargeOffShare = safeShare(facility.cumulativeChargeOffs, facility.cumulativeOriginations, 0);
    const facilityDebtMonthsOfFirmSales = safeShare(facility.outstanding, salesRevenue, facility.outstanding > EPS ? Infinity : 0);
    const activeFirms = country.firms.filter((firm) => firm.active !== false).length;
    const employed = country.households.filter((household) => household.employed).length;
    const desiredBudget = sum(country.households.map((household) => Math.max(0, finite(household.desiredConsumptionBudget))));
    const nominalPurchasingPower = finite(country.macro?.priceIndex) > EPS ? cashDisposableIncome / finite(country.macro.priceIndex) : null;

    rows.push({
      seed,
      candidateId: candidate.id,
      V: candidate.V,
      M: candidate.M,
      W: candidate.W,
      control: candidate.control === true,
      month,
      countryId: country.id,
      labourCompensationAccrued,
      householdWageIncomeAccrued,
      wagesSettled,
      wageSettlementRatio: ratio(wagesSettled, labourCompensationAccrued),
      salesRevenue,
      cogs,
      grossOperatingSurplusProxy,
      intermediateInputConsumed,
      inputPurchasesBook,
      finishedInventoryBookChange,
      inputInventoryBookChange,
      totalInventoryBookChange: finishedInventoryBookChange + inputInventoryBookChange,
      gvaBasicProduction,
      gvaBasicIncome,
      gdpMarketProxy,
      employeeCompensationShareOfGva: ratio(labourCompensationAccrued, gvaBasicProduction),
      employeeCompensationShareOfGdpMarket: ratio(labourCompensationAccrued, gdpMarketProxy),
      cashDisposableIncome,
      realizedHouseholdPurchaserOutlay,
      realizedConsumptionShareOfCashDisposableIncome: ratio(realizedHouseholdPurchaserOutlay, cashDisposableIncome),
      netHouseholdSavingFlowProxy,
      netSavingShareOfCashDisposableIncome: ratio(netHouseholdSavingFlowProxy, cashDisposableIncome),
      householdCashChange,
      householdCashFlowResidual,
      householdCashFlowResidualShareOfIncome: ratio(householdCashFlowResidual, cashDisposableIncome),
      desiredBudget,
      householdConsumptionExpense,
      consumptionTaxesPaid,
      incomeTaxesPaid,
      transfersReceived,
      tariffRevenue,
      productionInventoryBridgeResidual,
      gvaApproachResidual,
      inputInventoryBridgeResidual,
      wagePayableBridgeResidual,
      wageReceivableBridgeResidual,
      householdFirmAccrualResidual,
      macroDisposableIncomeResidual,
      macroConsumptionResidual,
      macroWageBillResidual,
      plannedInputNeedUnits: finite(procurement?.plannedInputNeedUnits),
      estimatedPurchasableCost: finite(procurement?.estimatedPurchasableCost),
      purchasedInputUnits: finite(procurement?.purchasedInputUnits),
      inputShortageUnits: finite(country.lastIndustry?.inputShortageUnits, procurement?.inputShortageUnits),
      procurementBudget: finite(procurement?.procurementBudget),
      procurementSpend: finite(procurement?.procurementSpend),
      procurementBudgetUtilization: finite(procurement?.procurementBudgetUtilization),
      b2bSettlementValue: finite(country.lastIndustry?.b2bSpend),
      facilityApplicationsThisMonth: finite(procurement?.facilityApplications),
      facilityApprovalsThisMonth: finite(procurement?.facilityApprovals),
      facilityRequestedDrawThisMonth: finite(procurement?.facilityRequestedDraw),
      facilityActualDrawThisMonth: finite(procurement?.facilityActualDraw),
      facilityBankCapitalDeniedAmountThisMonth: finite(procurement?.facilityBankCapitalDeniedAmount),
      facilityLineLimitDeniedAmountThisMonth: finite(procurement?.facilityLineLimitDeniedAmount),
      facilityOriginationsThisMonth: facility.originationsThisMonth,
      facilityCumulativeOriginations: facility.cumulativeOriginations,
      facilityPrincipalRepaidThisMonth: facility.principalRepaidThisMonth,
      facilityInterestPaidThisMonth: facility.interestPaidThisMonth,
      facilityChargeOffsThisMonth: facility.chargeOffsThisMonth,
      facilityCumulativeChargeOffs: facility.cumulativeChargeOffs,
      facilityOutstanding: facility.outstanding,
      facilityArrears: facility.arrears,
      facilityArrearsRatio,
      facilityChargeOffShare,
      facilityDebtMonthsOfFirmSales,
      facilityDefaults: facility.defaults,
      facilityActiveLoans: facility.activeLoans,
      inputShortageBurden: finite(country.lastIndustry?.inputShortageUnits),
      goodsFulfillmentRatio: safeShare(finite(country.lastMarkets?.goods?.desiredBudget) - finite(country.lastMarkets?.goods?.unmetBudget), finite(country.lastMarkets?.goods?.desiredBudget), 0),
      payrollSettlementRatio: safeShare(finite(country.lastMarkets?.payroll?.payroll), finite(country.lastMarkets?.payroll?.payroll) + finite(country.lastMarkets?.payroll?.unpaid), 1),
      wageArrears: finite(country.macro?.wageArrears),
      unemployment: 1 - employed / Math.max(1, country.households.length),
      activeFirms,
      firmExits: finite(country.lastIndustry?.exits),
      firmEntries: finite(country.lastIndustry?.entries),
      nominalPurchasingPower,
      macroGdp: finite(country.macro?.gdp),
      inventoryInvestmentShareOfMacroGdp: ratio(finishedInventoryBookChange + inputInventoryBookChange, finite(country.macro?.gdp)),
      accountingHealthy: country.lastAccounting?.ok !== false && world.ledger.verifyCountry(country.id)?.ok === true
    });
  }
  return rows;
}

function summarize(rows) {
  const positiveGva = rows.filter((row) => row.gvaBasicProduction > EPS && Number.isFinite(row.employeeCompensationShareOfGva));
  const positiveIncome = rows.filter((row) => row.cashDisposableIncome > EPS && Number.isFinite(row.realizedConsumptionShareOfCashDisposableIncome));
  const terminal = rows.filter((row) => row.month === months);
  const cumulativeOriginations = sum(terminal.map((row) => row.facilityCumulativeOriginations));
  const cumulativeChargeOffs = sum(terminal.map((row) => row.facilityCumulativeChargeOffs));
  const terminalOutstanding = sum(terminal.map((row) => row.facilityOutstanding));
  const terminalArrears = sum(terminal.map((row) => row.facilityArrears));
  const terminalFirmSales = sum(terminal.map((row) => row.salesRevenue));
  return {
    rows: rows.length,
    positiveGvaRows: positiveGva.length,
    positiveIncomeRows: positiveIncome.length,
    nonPositiveGvaRows: rows.filter((row) => row.gvaBasicProduction <= EPS).length,
    nonPositiveGvaShare: safeShare(rows.filter((row) => row.gvaBasicProduction <= EPS).length, rows.length, 0),
    employeeCompensationSharePositiveGva: statistics(positiveGva.map((row) => row.employeeCompensationShareOfGva)),
    employeeCompensationShareMarketGdp: statistics(rows.map((row) => row.employeeCompensationShareOfGdpMarket).filter(Number.isFinite)),
    realizedConsumptionSharePositiveIncome: statistics(positiveIncome.map((row) => row.realizedConsumptionShareOfCashDisposableIncome)),
    netSavingSharePositiveIncome: statistics(positiveIncome.map((row) => row.netSavingShareOfCashDisposableIncome)),
    householdCashFlowResidualSharePositiveIncome: statistics(positiveIncome.map((row) => row.householdCashFlowResidualShareOfIncome).filter(Number.isFinite)),
    plannedInputNeedUnits: statistics(rows.map((row) => row.plannedInputNeedUnits)),
    purchasedInputUnits: statistics(rows.map((row) => row.purchasedInputUnits)),
    inputShortageUnits: statistics(rows.map((row) => row.inputShortageUnits)),
    procurementBudgetUtilization: statistics(rows.map((row) => row.procurementBudgetUtilization)),
    b2bSettlementValue: statistics(rows.map((row) => row.b2bSettlementValue)),
    goodsFulfillmentRatio: statistics(rows.map((row) => row.goodsFulfillmentRatio)),
    payrollSettlementRatio: statistics(rows.map((row) => row.payrollSettlementRatio)),
    wageArrears: statistics(rows.map((row) => row.wageArrears)),
    unemployment: statistics(rows.map((row) => row.unemployment)),
    activeFirms: statistics(rows.map((row) => row.activeFirms)),
    nominalPurchasingPower: statistics(rows.map((row) => row.nominalPurchasingPower).filter(Number.isFinite)),
    inventoryInvestmentShareOfMacroGdp: statistics(rows.map((row) => row.inventoryInvestmentShareOfMacroGdp).filter(Number.isFinite)),
    totalInputShortageUnits: sum(rows.map((row) => row.inputShortageUnits)),
    totalFacilityApplications: sum(rows.map((row) => row.facilityApplicationsThisMonth)),
    totalFacilityApprovals: sum(rows.map((row) => row.facilityApprovalsThisMonth)),
    totalFacilityRequestedDraw: sum(rows.map((row) => row.facilityRequestedDrawThisMonth)),
    totalFacilityActualDraw: sum(rows.map((row) => row.facilityActualDrawThisMonth)),
    totalFacilityBankCapitalDeniedAmount: sum(rows.map((row) => row.facilityBankCapitalDeniedAmountThisMonth)),
    totalFacilityLineLimitDeniedAmount: sum(rows.map((row) => row.facilityLineLimitDeniedAmountThisMonth)),
    totalFacilityPrincipalRepaid: sum(rows.map((row) => row.facilityPrincipalRepaidThisMonth)),
    totalFacilityInterestPaid: sum(rows.map((row) => row.facilityInterestPaidThisMonth)),
    facilityTerminal: {
      cumulativeOriginations,
      cumulativeChargeOffs,
      chargeOffShare: safeShare(cumulativeChargeOffs, cumulativeOriginations, 0),
      outstanding: terminalOutstanding,
      arrears: terminalArrears,
      arrearsRatio: safeShare(terminalArrears, terminalOutstanding, 0),
      firmSales: terminalFirmSales,
      debtMonthsOfFirmSales: safeShare(terminalOutstanding, terminalFirmSales, terminalOutstanding > EPS ? Infinity : 0),
      defaults: sum(terminal.map((row) => row.facilityDefaults)),
      activeLoans: sum(terminal.map((row) => row.facilityActiveLoans))
    },
    maxAbsoluteReconstructionResidual: Math.max(...rows.flatMap((row) => [
      row.productionInventoryBridgeResidual,
      row.gvaApproachResidual,
      row.inputInventoryBridgeResidual,
      row.wagePayableBridgeResidual,
      row.wageReceivableBridgeResidual,
      row.householdFirmAccrualResidual,
      row.macroDisposableIncomeResidual,
      row.macroConsumptionResidual,
      row.macroWageBillResidual
    ].map((value) => Math.abs(finite(value))))),
    accountingHealthyShare: safeShare(rows.filter((row) => row.accountingHealthy).length, rows.length, 0)
  };
}

class ShadowWorld extends EconomicWorld {
  constructor(seedText) {
    super(seedText, { scaleProfile: 'baseline', healthCheckInterval: 0 });
    Object.defineProperty(this, '__r4CuD3dB6Candidate', { value: candidate, enumerable: false, configurable: true, writable: false });
    configureB6ShadowWorld(this, candidate, contract);
  }

  createEntrant(country, industryId) {
    const firm = super.createEntrant(country, industryId);
    applyB6FirmShadow(firm, this.__r4CuD3dB6Candidate, contract);
    return firm;
  }
}

function facilityIntegrity(world) {
  const loans = world.countries.flatMap((country) => b6FacilityLoans(country, candidate.id));
  const borrowers = new Map(world.countries.flatMap((country) => country.firms.map((firm) => [firm.id, firm])));
  const shapeValid = loans.every((loan) =>
    loan.borrowerKind === 'firm' &&
    loan.termMonths === contract.axes.W.modes.LINE1.termMonths &&
    Number.isFinite(loan.monthlyRate) &&
    loan.b6Facility?.front === contract.front &&
    loan.b6Facility?.candidateId === candidate.id
  );
  const borrowersFirmOnly = loans.every((loan) => borrowers.has(loan.borrowerId));
  const originationEntries = world.ledger.entries.filter((entry) => entry.kind === 'b6_working_capital_origination' && entry.meta?.candidateId === candidate.id);
  const originationsMatched = loans.length === originationEntries.length && loans.every((loan) => originationEntries.some((entry) => entry.meta?.borrowerId === loan.borrowerId && Math.abs(entry.amount - loan.originalPrincipal) <= 1e-7));
  const sellerCreditKinds = world.ledger.entries.filter((entry) => /trade_credit|invoice_credit|accounts_payable|accounts_receivable/i.test(String(entry.kind)));
  return { loans: loans.length, shapeValid, borrowersFirmOnly, originationsMatched, sellerCreditAbsent: sellerCreditKinds.length === 0 };
}

function runOnce() {
  const canonicalWorld = new EconomicWorld(seed, { scaleProfile: 'baseline', healthCheckInterval: 0 });
  const world = new ShadowWorld(seed);
  const canonicalProtectedSurface = protectedSurface(canonicalWorld);
  const shadowProtectedSurface = protectedSurface(world);
  const protectedSurfaceExact = JSON.stringify(canonicalProtectedSurface) === JSON.stringify(shadowProtectedSurface);
  const initialAxisExact = axisApplicationExact(canonicalWorld, world, true);
  const rows = [];

  for (let index = 0; index < months; index += 1) {
    const open = openingStocks(world);
    world.stepMonth();
    if (candidate.control === true) canonicalWorld.stepMonth();
    rows.push(...measureMonth(world, open, world.month));
  }

  const health = world.forceHealthCheck();
  const ledgerHealthy = world.countries.every((country) => world.ledger.verifyCountry(country.id)?.ok === true);
  const accountingHealthy = world.countries.every((country) => world.accounting.verifyCountry(country, world.ledger, world.month)?.ok !== false);
  const fiscalHealthy = world.countries.every((country) => world.fiscal.verifyCountry(country)?.accountingOk !== false);
  const internationalHealthy = world.globalInternationalReport()?.ok === true;
  const integrity = facilityIntegrity(world);
  const terminalAxisExact = axisApplicationExact(canonicalWorld, world, false);
  const allFirmsTaggedExactlyOnce = world.countries.every((country) => country.firms.every((firm) => b6FirmTag(firm)?.applicationCount === 1));
  const finalDigest = worldDigest(world);
  const controlCanonicalDigestExact = candidate.control === true ? finalDigest === worldDigest(canonicalWorld) : true;

  return {
    world,
    rows,
    digest: finalDigest,
    protectedSurfaceExact,
    initialAxisExact,
    terminalAxisExact,
    allFirmsTaggedExactlyOnce,
    controlCanonicalDigestExact,
    integrity,
    hardAccountingHealthy: health.ok === true && ledgerHealthy && accountingHealthy && fiscalHealthy && internationalHealthy
  };
}

const first = runOnce();
const second = runOnce();
const exactCanonicalReplay = first.digest === second.digest;
const exactDiagnosticReplay = JSON.stringify(first.rows) === JSON.stringify(second.rows);
const summary = summarize(first.rows);
const tolerance = contract.measurementSurface.reconstructionTolerance;
const nonLineFacilityAbsent = candidate.W === 'LINE1'
  ? true
  : summary.totalFacilityActualDraw <= EPS && first.integrity.loans === 0;
const line1CanonicalShapeValid = candidate.W === 'LINE1'
  ? first.integrity.shapeValid && first.integrity.borrowersFirmOnly && first.integrity.originationsMatched && first.integrity.sellerCreditAbsent
  : true;

const gates = {
  contractExact: contract.front === 'R4-CU-D3D-B6-S1' && contract.status === 'FROZEN_PRE_IMPLEMENTATION',
  candidateRegistered: contract.factorial.candidates.some((entry) => entry.id === candidate.id),
  originalSeedOnly: contract.stage1Execution.originalSeeds.includes(seed),
  frozenHorizon: months === contract.stage1Execution.months,
  noCanonicalMutation: contract.canonicalMutationAuthorized === false && contract.canonicalCalibrationAuthorized === false,
  protectedSurfaceExact: first.protectedSurfaceExact && second.protectedSurfaceExact,
  initialAxisApplicationExact: first.initialAxisExact && second.initialAxisExact,
  terminalAxisApplicationExact: first.terminalAxisExact && second.terminalAxisExact,
  allFirmsAndEntrantsTaggedExactlyOnce: first.allFirmsTaggedExactlyOnce && second.allFirmsTaggedExactlyOnce,
  controlCanonicalEquivalence: first.controlCanonicalDigestExact && second.controlCanonicalDigestExact,
  exactCanonicalReplay,
  exactDiagnosticReplay,
  hardAccountingHealthy: first.hardAccountingHealthy && second.hardAccountingHealthy,
  completeCountryMonthPanel: first.rows.length === months * first.world.countries.length,
  productionApproachesReconcile: first.rows.every((row) => Math.abs(row.gvaApproachResidual) <= tolerance),
  inventoryBridgesReconcile: first.rows.every((row) => Math.abs(row.productionInventoryBridgeResidual) <= tolerance && Math.abs(row.inputInventoryBridgeResidual) <= tolerance),
  settlementBridgesReconcile: first.rows.every((row) => Math.abs(row.wagePayableBridgeResidual) <= tolerance && Math.abs(row.wageReceivableBridgeResidual) <= tolerance && Math.abs(row.householdFirmAccrualResidual) <= tolerance),
  macroFlowFieldsReconcile: first.rows.every((row) => Math.abs(row.macroDisposableIncomeResidual) <= tolerance && Math.abs(row.macroConsumptionResidual) <= tolerance && Math.abs(row.macroWageBillResidual) <= tolerance),
  mechanismMetricsPresent: first.rows.every((row) => Number.isFinite(row.plannedInputNeedUnits) && Number.isFinite(row.purchasedInputUnits) && Number.isFinite(row.inputShortageUnits) && Number.isFinite(row.procurementBudgetUtilization)),
  nonLineFacilityAbsent,
  line1CanonicalShapeValid,
  noSellerTradeCredit: first.integrity.sellerCreditAbsent,
  blockedSurfaceRemainsBlocked: contract.protectedSurface.blockedMutations.includes('household desired-consumption rule') && contract.protectedSurface.blockedMutations.includes('canonical bank underwriting'),
  semanticGapsExplicit: Object.values(contract.semanticBoundary.requiredExplicitGaps).every((value) => typeof value === 'string' && value.length > 0)
};
gates.ok = Object.values(gates).every(Boolean);

const result = {
  schemaVersion: 'r4-cu-d3d-b6-s1-shadow-screen-v0.1',
  front: contract.front,
  generatedAt: new Date().toISOString(),
  status: gates.ok ? 'PASS_AS_CAUSAL_SHADOW_SCREEN' : 'FAIL_INTEGRITY_GATE',
  seed,
  months,
  candidate,
  gates,
  summary,
  facilityIntegrity: first.integrity,
  rows: first.rows,
  worldDigest: first.digest,
  replayDigest: second.digest,
  interpretation: {
    role: 'COUNTERFACTUAL_CAUSAL_SCREEN_ONLY',
    empiricalBands: 'EXTERNAL_VALIDATION_ONLY',
    directParameterRecommendation: false,
    desiredConsumptionMappingAuthorized: false,
    canonicalMutationAuthorized: false
  }
};

console.log('WP_RV08_R4_CU_D3D_B6_S1_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CU_D3D_B6_S1_SUMMARY', JSON.stringify(summary));
console.log('WP_RV08_R4_CU_D3D_B6_S1_DIGEST', first.digest);
if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CU_D3D_B6_S1_OUTPUT', outputJson);
}
assert.equal(gates.ok, true, `${candidate.id}/${seed}: R4-CU-D3D-B6-S1 integrity gate failed`);
