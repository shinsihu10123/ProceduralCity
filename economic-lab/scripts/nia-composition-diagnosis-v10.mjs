import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';

const scaleProfile = process.env.DIAG_SCALE || 'baseline';
const months = Math.max(1, Number(process.env.DIAG_MONTHS || 12));
const seedText = process.env.DIAG_SEEDS || 'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C';
const seeds = seedText.split(',').map(seed => seed.trim()).filter(Boolean);
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const EPS = 1e-9;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = values => values.reduce((total, value) => total + finite(value), 0);
const mean = values => values.length ? sum(values) / values.length : 0;
const ratio = (a, b) => Math.abs(finite(b)) > EPS ? finite(a) / finite(b) : 0;

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = values.map(value => finite(value)).sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index];
}

function addObject(target, source) {
  for (const [key, value] of Object.entries(source || {})) target[key] = finite(target[key]) + finite(value);
  return target;
}

function inventorySnapshot(world, country) {
  const gl = world.accounting.gl;
  const bySector = {};
  let rawFinishedBook = 0;
  let rawInputBook = 0;
  let finishedBook = 0;
  let inputBook = 0;
  let activeBook = 0;
  let inactiveBook = 0;
  let consumerFinishedBook = 0;
  let nonConsumerFinishedBook = 0;
  let physicalFinishedUnits = 0;
  let physicalConsumerFinishedUnits = 0;
  let physicalInputUnits = 0;
  let negativeInventoryAccounts = 0;

  for (const firm of country.firms || []) {
    if (!gl.entities.has(firm.id)) continue;
    const rawFinished = finite(gl.naturalBalance(firm.id, 'inventory'));
    const rawInput = finite(gl.naturalBalance(firm.id, 'input_inventory'));
    const finished = Math.max(0, rawFinished);
    const input = Math.max(0, rawInput);
    const book = finished + input;
    rawFinishedBook += rawFinished;
    rawInputBook += rawInput;
    finishedBook += finished;
    inputBook += input;
    if (firm.active === false) inactiveBook += book;
    else activeBook += book;
    if (firm.consumerFacing === true) consumerFinishedBook += finished;
    else nonConsumerFinishedBook += finished;
    physicalFinishedUnits += Math.max(0, finite(firm.inventory));
    if (firm.consumerFacing === true) physicalConsumerFinishedUnits += Math.max(0, finite(firm.inventory));
    physicalInputUnits += sum(Object.values(firm.inputInventory || {}).map(value => Math.max(0, finite(value))));
    if (rawFinished < -1e-7) negativeInventoryAccounts += 1;
    if (rawInput < -1e-7) negativeInventoryAccounts += 1;

    const sector = bySector[firm.industryId] ||= {
      firms: 0,
      activeFirms: 0,
      finishedBook: 0,
      inputBook: 0,
      physicalFinishedUnits: 0,
      physicalInputUnits: 0
    };
    sector.firms += 1;
    if (firm.active !== false) sector.activeFirms += 1;
    sector.finishedBook += finished;
    sector.inputBook += input;
    sector.physicalFinishedUnits += Math.max(0, finite(firm.inventory));
    sector.physicalInputUnits += sum(Object.values(firm.inputInventory || {}).map(value => Math.max(0, finite(value))));
  }

  return {
    rawFinishedBook,
    rawInputBook,
    rawBook: rawFinishedBook + rawInputBook,
    finishedBook,
    inputBook,
    book: finishedBook + inputBook,
    activeBook,
    inactiveBook,
    consumerFinishedBook,
    nonConsumerFinishedBook,
    physicalFinishedUnits,
    physicalConsumerFinishedUnits,
    physicalInputUnits,
    negativeInventoryAccounts,
    bySector
  };
}

function inventoryJournalFlow(world, country, month) {
  const gl = world.accounting.gl;
  const byKind = {};
  let totalNet = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  let zeroOutputLaborCapitalization = 0;
  let zeroOutputLaborJournals = 0;
  let productionLaborCapitalization = 0;

  for (const firm of country.firms || []) {
    const entity = gl.entities.get(firm.id);
    if (!entity) continue;
    for (const journal of entity.journals || []) {
      if (Number(journal.month) !== Number(month)) continue;
      let net = 0;
      let debit = 0;
      let credit = 0;
      for (const line of journal.lines || []) {
        if (line.account !== 'inventory' && line.account !== 'input_inventory') continue;
        debit += finite(line.debit);
        credit += finite(line.credit);
        net += finite(line.debit) - finite(line.credit);
      }
      if (Math.abs(net) <= EPS && debit <= EPS && credit <= EPS) continue;
      const kind = String(journal.kind || 'unknown');
      const row = byKind[kind] ||= { net: 0, debit: 0, credit: 0, journals: 0 };
      row.net += net;
      row.debit += debit;
      row.credit += credit;
      row.journals += 1;
      totalNet += net;
      totalDebit += debit;
      totalCredit += credit;

      if (kind === 'production_labor_accrual') {
        productionLaborCapitalization += debit;
        if (finite(journal.meta?.output) <= EPS) {
          zeroOutputLaborCapitalization += debit;
          zeroOutputLaborJournals += 1;
        }
      }
    }
  }

  return {
    totalNet,
    totalDebit,
    totalCredit,
    productionLaborCapitalization,
    zeroOutputLaborCapitalization,
    zeroOutputLaborJournals,
    byKind
  };
}

function componentRow(macro) {
  const consumption = finite(macro?.consumption);
  const grossInvestment = finite(macro?.grossInvestment);
  const publicInvestment = finite(macro?.publicInvestment);
  const governmentConsumption = finite(macro?.governmentConsumption);
  const inventoryInvestment = finite(macro?.inventoryInvestment);
  const netExports = finite(macro?.netExports);
  const gdp = finite(macro?.gdp);
  const domesticFinalDemand = consumption + grossInvestment + publicInvestment + governmentConsumption;
  const gdpExInventory = domesticFinalDemand + netExports;
  const reconstructed = gdpExInventory + inventoryInvestment;
  const absComponentSum = [consumption, grossInvestment, publicInvestment, governmentConsumption, inventoryInvestment, netExports]
    .reduce((total, value) => total + Math.abs(value), 0);
  return {
    gdp,
    consumption,
    grossInvestment,
    publicInvestment,
    governmentConsumption,
    inventoryInvestment,
    netExports,
    domesticFinalDemand,
    gdpExInventory,
    reconstructed,
    identityResidual: gdp - reconstructed,
    inventoryShareOfGdp: ratio(inventoryInvestment, gdp),
    absInventoryShareOfGdp: ratio(Math.abs(inventoryInvestment), Math.abs(gdp)),
    inventoryShareOfAbsComponents: ratio(Math.abs(inventoryInvestment), absComponentSum),
    inventoryDominatesGdpMagnitude: Math.abs(inventoryInvestment) > Math.abs(gdp) + 1e-9
  };
}

function runSeed(seed) {
  const world = new EconomicWorld(seed, { scaleProfile, healthCheckInterval: 0 });
  const priorInventory = new Map(world.countries.map(country => [country.id, inventorySnapshot(world, country)]));
  const rows = [];
  const maxima = {
    accountingInventoryBookError: 0,
    inventoryDeltaError: 0,
    rawJournalFlowError: 0,
    gdpIdentityResidual: 0,
    laborCapitalizationError: 0,
    inputTransferNet: 0
  };

  for (let i = 0; i < months; i++) {
    world.stepMonth();
    for (const country of world.countries || []) {
      const before = priorInventory.get(country.id);
      const after = inventorySnapshot(world, country);
      const flow = inventoryJournalFlow(world, country, world.month);
      const macro = componentRow(country.macro);
      const accountingInventoryBook = finite(country.lastAccounting?.inventoryBook);
      const physicalOutputUnits = sum(Object.values(country.lastIndustry?.sectorOutputs || {}));
      const laborAccrual = finite(country.lastMarkets?.accrual?.accrued);
      const deltaBook = after.book - before.book;
      const deltaRawBook = after.rawBook - before.rawBook;
      const accountingInventoryBookError = after.book - accountingInventoryBook;
      const inventoryDeltaError = macro.inventoryInvestment - deltaBook;
      const rawJournalFlowError = flow.totalNet - deltaRawBook;
      const laborCapitalizationError = flow.productionLaborCapitalization - laborAccrual;
      const inputTransferNet = finite(flow.byKind.input_to_production?.net);

      maxima.accountingInventoryBookError = Math.max(maxima.accountingInventoryBookError, Math.abs(accountingInventoryBookError));
      maxima.inventoryDeltaError = Math.max(maxima.inventoryDeltaError, Math.abs(inventoryDeltaError));
      maxima.rawJournalFlowError = Math.max(maxima.rawJournalFlowError, Math.abs(rawJournalFlowError));
      maxima.gdpIdentityResidual = Math.max(maxima.gdpIdentityResidual, Math.abs(macro.identityResidual));
      maxima.laborCapitalizationError = Math.max(maxima.laborCapitalizationError, Math.abs(laborCapitalizationError));
      maxima.inputTransferNet = Math.max(maxima.inputTransferNet, Math.abs(inputTransferNet));

      rows.push({
        seed,
        month: world.month,
        countryId: country.id,
        macro,
        inventory: {
          before,
          after,
          deltaBook,
          deltaRawBook,
          accountingInventoryBook,
          accountingInventoryBookError,
          inventoryDeltaError,
          bookPerFinishedPhysicalUnit: ratio(after.finishedBook, after.physicalFinishedUnits),
          consumerBookPerPhysicalUnit: ratio(after.consumerFinishedBook, after.physicalConsumerFinishedUnits),
          inactiveInventoryShare: ratio(after.inactiveBook, after.book),
          consumerFinishedBookShare: ratio(after.consumerFinishedBook, after.book),
          physicalFinishedUnitChange: after.physicalFinishedUnits - before.physicalFinishedUnits,
          consumerPhysicalFinishedUnitChange: after.physicalConsumerFinishedUnits - before.physicalConsumerFinishedUnits
        },
        journalFlow: {
          ...flow,
          rawJournalFlowError,
          productionLaborCapitalizationToOutputUnit: ratio(flow.productionLaborCapitalization, physicalOutputUnits),
          zeroOutputLaborCapitalizationShare: ratio(flow.zeroOutputLaborCapitalization, flow.productionLaborCapitalization)
        },
        production: {
          physicalOutputUnits,
          consumerOutputUnits: finite(country.macro?.realOutput),
          laborAccrual,
          laborCapitalizationError
        },
        accountingContext: {
          householdIncome: finite(country.lastAccounting?.householdIncome),
          firmRevenue: finite(country.lastAccounting?.firmRevenue),
          firmExpense: finite(country.lastAccounting?.firmExpense),
          firmProfit: finite(country.lastAccounting?.firmProfit),
          bankProfit: finite(country.lastAccounting?.bankProfit),
          taxRevenue: finite(country.macro?.taxRevenue),
          wageBill: finite(country.macro?.wageBill)
        }
      });
      priorInventory.set(country.id, after);
    }
  }

  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${seed}: v0.10 health gate must pass`);
  assert.equal(rows.length, months * world.countries.length, `${seed}: complete country-month coverage required`);
  assert.ok(maxima.accountingInventoryBookError <= 1e-6, `${seed}: inventory snapshot must match accounting summary`);
  assert.ok(maxima.inventoryDeltaError <= 1e-6, `${seed}: inventory investment must equal inventory-book delta`);
  assert.ok(maxima.rawJournalFlowError <= 1e-6, `${seed}: inventory journal movements must reconcile to raw stock change`);
  assert.ok(maxima.gdpIdentityResidual <= 1e-6, `${seed}: expenditure GDP identity must reconcile`);
  assert.ok(maxima.laborCapitalizationError <= 1e-6, `${seed}: payroll accrual must reconcile to inventory labor capitalization`);
  assert.ok(maxima.inputTransferNet <= 1e-6, `${seed}: input-to-production transfer must be inventory-book neutral`);
  return { seed, health, rows, reconciliation: maxima, scale: world.scaleReport() };
}

function summarizeWindow(rows) {
  const journalNetByKind = {};
  const journalDebitByKind = {};
  const journalCreditByKind = {};
  for (const row of rows) {
    for (const [kind, flow] of Object.entries(row.journalFlow.byKind || {})) {
      journalNetByKind[kind] = finite(journalNetByKind[kind]) + finite(flow.net);
      journalDebitByKind[kind] = finite(journalDebitByKind[kind]) + finite(flow.debit);
      journalCreditByKind[kind] = finite(journalCreditByKind[kind]) + finite(flow.credit);
    }
  }
  const absInventoryShares = rows.map(row => row.macro.absInventoryShareOfGdp);
  const laborCapitalization = sum(rows.map(row => row.journalFlow.productionLaborCapitalization));
  const zeroOutputLaborCapitalization = sum(rows.map(row => row.journalFlow.zeroOutputLaborCapitalization));
  return {
    countryMonths: rows.length,
    totalGdp: sum(rows.map(row => row.macro.gdp)),
    totalConsumption: sum(rows.map(row => row.macro.consumption)),
    totalGrossInvestment: sum(rows.map(row => row.macro.grossInvestment)),
    totalPublicInvestment: sum(rows.map(row => row.macro.publicInvestment)),
    totalGovernmentConsumption: sum(rows.map(row => row.macro.governmentConsumption)),
    totalInventoryInvestment: sum(rows.map(row => row.macro.inventoryInvestment)),
    totalNetExports: sum(rows.map(row => row.macro.netExports)),
    totalDomesticFinalDemand: sum(rows.map(row => row.macro.domesticFinalDemand)),
    totalGdpExInventory: sum(rows.map(row => row.macro.gdpExInventory)),
    meanAbsInventoryShareOfGdp: mean(absInventoryShares),
    medianAbsInventoryShareOfGdp: quantile(absInventoryShares, 0.5),
    p90AbsInventoryShareOfGdp: quantile(absInventoryShares, 0.9),
    maxAbsInventoryShareOfGdp: absInventoryShares.length ? Math.max(...absInventoryShares) : 0,
    inventoryDominatesGdpMagnitudeRows: rows.filter(row => row.macro.inventoryDominatesGdpMagnitude).length,
    bookRisesWhileFinishedUnitsFallRows: rows.filter(row => row.inventory.deltaBook > EPS && row.inventory.physicalFinishedUnitChange < -EPS).length,
    bookRisesWhileConsumerUnitsFallRows: rows.filter(row => row.inventory.deltaBook > EPS && row.inventory.consumerPhysicalFinishedUnitChange < -EPS).length,
    productionLaborCapitalization: laborCapitalization,
    zeroOutputLaborCapitalization,
    zeroOutputLaborCapitalizationShare: ratio(zeroOutputLaborCapitalization, laborCapitalization),
    meanInactiveInventoryShare: mean(rows.map(row => row.inventory.inactiveInventoryShare)),
    meanConsumerFinishedBookShare: mean(rows.map(row => row.inventory.consumerFinishedBookShare)),
    journalNetByKind,
    journalDebitByKind,
    journalCreditByKind
  };
}

function aggregateMonthly(rows) {
  const monthsObserved = [...new Set(rows.map(row => row.month))].sort((a, b) => a - b);
  return monthsObserved.map(month => {
    const group = rows.filter(row => row.month === month);
    return {
      month,
      countryPaths: group.length,
      gdp: sum(group.map(row => row.macro.gdp)),
      consumption: sum(group.map(row => row.macro.consumption)),
      grossInvestment: sum(group.map(row => row.macro.grossInvestment)),
      publicInvestment: sum(group.map(row => row.macro.publicInvestment)),
      governmentConsumption: sum(group.map(row => row.macro.governmentConsumption)),
      inventoryInvestment: sum(group.map(row => row.macro.inventoryInvestment)),
      netExports: sum(group.map(row => row.macro.netExports)),
      gdpExInventory: sum(group.map(row => row.macro.gdpExInventory)),
      inventoryShareOfPooledGdp: ratio(sum(group.map(row => row.macro.inventoryInvestment)), sum(group.map(row => row.macro.gdp))),
      inventoryDominanceRows: group.filter(row => row.macro.inventoryDominatesGdpMagnitude).length,
      laborCapitalization: sum(group.map(row => row.journalFlow.productionLaborCapitalization)),
      zeroOutputLaborCapitalization: sum(group.map(row => row.journalFlow.zeroOutputLaborCapitalization)),
      finishedInventoryBook: sum(group.map(row => row.inventory.after.finishedBook)),
      inputInventoryBook: sum(group.map(row => row.inventory.after.inputBook)),
      inactiveInventoryBook: sum(group.map(row => row.inventory.after.inactiveBook)),
      physicalFinishedUnits: sum(group.map(row => row.inventory.after.physicalFinishedUnits)),
      consumerPhysicalFinishedUnits: sum(group.map(row => row.inventory.after.physicalConsumerFinishedUnits))
    };
  });
}

const runs = seeds.map(runSeed);
const rows = runs.flatMap(run => run.rows);
const preExit = rows.filter(row => row.month <= 6);
const collapse = rows.filter(row => row.month >= 7 && row.month <= Math.min(months, 9));
const late = rows.filter(row => row.month >= 10);
const terminalRows = rows.filter(row => row.month === months);
const report = {
  schemaVersion: 1,
  kind: 'economic-lab-wp-rv05-gdp-nia-composition-diagnosis',
  frozenEconomicBaseline: '698d10749e2897d711e5bcee61913ac34e0650a0',
  scaleProfile,
  months,
  seeds,
  methodology: {
    mechanismChanges: 0,
    parameterTuning: 0,
    explicitGdpImplementation: 'Expenditure-side GDP = C + gross private investment + public investment + government consumption + change in aggregate firm inventory book + net exports.',
    inventoryBookScope: 'Finished-goods plus raw/intermediate inventory accounts for every firm. The diagnostic traces exact GL debit/credit movements by journal kind.',
    independentIncomeApproachImplemented: false,
    independentProductionApproachImplemented: false,
    caution: 'Accounting-identity reconciliation is not empirical validation. This WP diagnoses composition and stock-flow semantics only.'
  },
  runs,
  monthly: aggregateMonthly(rows),
  windows: {
    months1to6: summarizeWindow(preExit),
    months7to9: summarizeWindow(collapse),
    months10to12: summarizeWindow(late),
    full: summarizeWindow(rows)
  },
  terminal: {
    countryRows: terminalRows.map(row => ({
      seed: row.seed,
      countryId: row.countryId,
      gdp: row.macro.gdp,
      inventoryInvestment: row.macro.inventoryInvestment,
      inventoryShareOfGdp: row.macro.inventoryShareOfGdp,
      inventoryBook: row.inventory.after.book,
      inactiveInventoryShare: row.inventory.inactiveInventoryShare,
      consumerFinishedBookShare: row.inventory.consumerFinishedBookShare,
      physicalFinishedUnits: row.inventory.after.physicalFinishedUnits,
      consumerPhysicalFinishedUnits: row.inventory.after.physicalConsumerFinishedUnits
    }))
  },
  gates: {
    allHealthy: runs.every(run => run.health.ok),
    completeCountryMonthCoverage: rows.length === seeds.length * months * 4,
    accountingInventoryBookReconciled: runs.every(run => run.reconciliation.accountingInventoryBookError <= 1e-6),
    inventoryInvestmentStockFlowReconciled: runs.every(run => run.reconciliation.inventoryDeltaError <= 1e-6),
    inventoryJournalFlowReconciled: runs.every(run => run.reconciliation.rawJournalFlowError <= 1e-6),
    expenditureGdpIdentityReconciled: runs.every(run => run.reconciliation.gdpIdentityResidual <= 1e-6),
    payrollInventoryCapitalizationReconciled: runs.every(run => run.reconciliation.laborCapitalizationError <= 1e-6),
    inputInventoryTransferNeutral: runs.every(run => run.reconciliation.inputTransferNet <= 1e-6)
  }
};
report.gates.ok = Object.values(report.gates).every(Boolean);
assert.ok(report.gates.ok, 'WP-RV05 NIA composition gates must pass');

console.table(report.monthly.map(row => ({
  month: row.month,
  gdp: Number(row.gdp.toFixed(2)),
  consumption: Number(row.consumption.toFixed(2)),
  inventoryInvestment: Number(row.inventoryInvestment.toFixed(2)),
  inventoryShare: Number(row.inventoryShareOfPooledGdp.toFixed(4)),
  inventoryDominanceRows: row.inventoryDominanceRows,
  laborCapitalization: Number(row.laborCapitalization.toFixed(2)),
  zeroOutputLaborCapitalization: Number(row.zeroOutputLaborCapitalization.toFixed(2)),
  inactiveInventoryBook: Number(row.inactiveInventoryBook.toFixed(2)),
  consumerUnits: Number(row.consumerPhysicalFinishedUnits.toFixed(2))
})));
console.log('WP_RV05_GATES', JSON.stringify(report.gates));
console.log('WP_RV05_FULL_WINDOW', JSON.stringify(report.windows.full));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`WP_RV05_JSON ${outputJson}`);
}

console.log('Economic Lab WP-RV05 GDP/NIA composition diagnosis PASS');
