import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { setLaborMarketDiagnosticObserver } from '../src/markets/labor-market.js';
import { RealityDiagnosticRecorder } from '../src/research/reality-diagnostics.js';

const scaleProfile = process.env.DIAG_SCALE || 'baseline';
const months = Math.max(1, Number(process.env.DIAG_MONTHS || 12));
const seedText = process.env.DIAG_SEEDS || 'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C';
const seeds = seedText.split(',').map(seed => seed.trim()).filter(Boolean);
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, finite(value)));
}

function ratio(numerator, denominator) {
  const d = finite(denominator);
  return Math.abs(d) > 1e-9 ? finite(numerator) / d : 0;
}

function sum(values) {
  return values.reduce((total, value) => total + finite(value), 0);
}

function mean(values) {
  return values.length ? sum(values) / values.length : 0;
}

function firmSnapshot(world) {
  const result = new Map();
  for (const country of world.countries || []) {
    const firms = new Map();
    for (const firm of country.firms || []) {
      firms.set(firm.id, {
        active: firm.active !== false,
        workers: finite(firm.workers),
        desiredWorkers: finite(firm.desiredWorkers),
        previousSales: finite(firm.previousSales),
        sales: finite(firm.sales),
        revenue: finite(firm.revenue),
        inventory: finite(firm.inventory),
        targetInventory: finite(firm.targetInventory),
        output: finite(firm.output),
        cash: finite(world.ledger?.balance?.(firm.accountId), finite(firm.cash)),
        safeCash: finite(firm.safeCash),
        wageArrears: finite(firm.wageArrears),
        creditMisses: finite(firm.creditMisses),
        consumerFacing: firm.consumerFacing === true
      });
    }
    result.set(country.id, firms);
  }
  return result;
}

function plannedTargetWorkers(preWorkers, plan) {
  const hiringChange = clamp(plan?.hiringChange, -0.10, 0.12);
  return Math.max(0, Math.round(Math.max(1, finite(preWorkers)) * (1 + hiringChange)));
}

function planDiagnostics(country, preFirms) {
  const current = new Map((country.firms || []).map(firm => [firm.id, firm]));
  let activeAtStart = 0;
  let priorWorkers = 0;
  let desiredWorkersBeforeLabor = 0;
  let plannedVacancies = 0;
  let plannedLayoffSlots = 0;
  let positiveHiringPlans = 0;
  let negativeHiringPlans = 0;
  let zeroHiringPlans = 0;
  let expansionPlans = 0;
  let defensivePlans = 0;
  let cashPreservationPlans = 0;
  let priceCompetitionPlans = 0;
  let maintainPlans = 0;
  const hiringChanges = [];
  const expectedDemandGrowth = [];
  const cashStress = [];
  const inventoryPressure = [];
  const supplyStress = [];
  const debtBurden = [];

  for (const [firmId, pre] of preFirms || []) {
    if (!pre.active) continue;
    activeAtStart += 1;
    priorWorkers += pre.workers;
    const firm = current.get(firmId);
    assert.ok(firm, `${country.id}:${firmId}: firm must remain addressable after monthly step`);
    const plan = firm.currentPlan || {};
    const target = plannedTargetWorkers(pre.workers, plan);
    const change = clamp(plan.hiringChange, -0.10, 0.12);
    desiredWorkersBeforeLabor += target;
    plannedVacancies += Math.max(0, target - pre.workers);
    plannedLayoffSlots += Math.max(0, pre.workers - target);
    hiringChanges.push(change);
    if (change > 1e-12) positiveHiringPlans += 1;
    else if (change < -1e-12) negativeHiringPlans += 1;
    else zeroHiringPlans += 1;

    const selected = String(plan.selected || plan.name || plan.trace?.selected || 'unknown');
    if (selected === '확장') expansionPlans += 1;
    else if (selected === '방어') defensivePlans += 1;
    else if (selected === '현금 보존') cashPreservationPlans += 1;
    else if (selected === '가격 경쟁') priceCompetitionPlans += 1;
    else if (selected === '유지') maintainPlans += 1;

    const perception = plan.trace?.perception || {};
    expectedDemandGrowth.push(finite(perception.expectedDemandGrowth));
    cashStress.push(finite(perception.cashStress));
    inventoryPressure.push(finite(perception.inventoryPressure));
    supplyStress.push(finite(perception.supplyStress));
    debtBurden.push(finite(perception.debtBurden));
  }

  return {
    activeAtStart,
    priorWorkers,
    desiredWorkersBeforeLabor,
    netDesiredWorkerChange: desiredWorkersBeforeLabor - priorWorkers,
    plannedVacancies,
    plannedLayoffSlots,
    positiveHiringPlans,
    negativeHiringPlans,
    zeroHiringPlans,
    expansionPlans,
    defensivePlans,
    cashPreservationPlans,
    priceCompetitionPlans,
    maintainPlans,
    positiveHiringPlanShare: ratio(positiveHiringPlans, activeAtStart),
    negativeHiringPlanShare: ratio(negativeHiringPlans, activeAtStart),
    meanHiringChange: mean(hiringChanges),
    meanExpectedDemandGrowth: mean(expectedDemandGrowth),
    meanCashStress: mean(cashStress),
    meanInventoryPressure: mean(inventoryPressure),
    meanSupplyStress: mean(supplyStress),
    meanDebtBurden: mean(debtBurden)
  };
}

function goodsDiagnostics(world, country, preFirms) {
  const goods = country.lastMarkets?.goods || {};
  const households = country.households || [];
  const desiredHouseholdBudget = sum(households.map(h => h.desiredConsumptionBudget));
  const disposableIncome = sum(households.map(h => h.disposableIncome));
  const actualConsumption = finite(goods.nominalConsumption, sum(households.map(h => h.consumption)));
  const desiredBudget = finite(goods.desiredBudget);
  const unmetBudget = finite(goods.unmetBudget);
  const activeConsumers = (country.firms || []).filter(firm => firm.active !== false && firm.consumerFacing === true);
  const preConsumerFirms = [...(preFirms || new Map()).values()].filter(firm => firm.active && firm.consumerFacing);
  const preConsumerInventory = sum(preConsumerFirms.map(firm => firm.inventory));
  const consumerOutput = sum(activeConsumers.map(firm => firm.output));
  const consumerSalesUnits = sum(activeConsumers.map(firm => firm.consumerSales));
  const consumerRevenue = sum(activeConsumers.map(firm => firm.consumerRevenue));
  const postConsumerInventory = sum(activeConsumers.map(firm => firm.inventory));
  const sellersWithPostInventory = activeConsumers.filter(firm => finite(firm.inventory) > 1e-8).length;

  return {
    disposableIncome,
    desiredHouseholdBudget,
    goodsDesiredBudget: desiredBudget,
    actualConsumption,
    unmetBudget,
    budgetFulfillmentRate: ratio(actualConsumption, desiredBudget),
    unmetBudgetRate: ratio(unmetBudget, desiredBudget),
    desiredBudgetToDisposableIncome: ratio(desiredBudget, disposableIncome),
    desiredBudgetReconciliationError: desiredHouseholdBudget - desiredBudget,
    goodsBudgetIdentityError: desiredBudget - actualConsumption - unmetBudget,
    transactions: finite(goods.transactions),
    units: finite(goods.units),
    preConsumerFirmCount: preConsumerFirms.length,
    activeConsumerFirmCount: activeConsumers.length,
    preConsumerInventory,
    consumerOutput,
    consumerSalesUnits,
    consumerRevenue,
    postConsumerInventory,
    sellersWithPostInventory
  };
}

function aggregateMonthly(rows) {
  const monthsSeen = [...new Set(rows.map(row => row.month))].sort((a, b) => a - b);
  return monthsSeen.map(month => {
    const group = rows.filter(row => row.month === month);
    const totalSeparations = sum(group.map(row => row.labor.separations));
    const exitSeparations = sum(group.map(row => row.labor.exitSeparations));
    const marketLayoffs = sum(group.map(row => row.labor.layoffs));
    const plannedVacancies = sum(group.map(row => row.firmPlans.plannedVacancies));
    const hires = sum(group.map(row => row.labor.hires));
    const desiredBudget = sum(group.map(row => row.goods.goodsDesiredBudget));
    const actualConsumption = sum(group.map(row => row.goods.actualConsumption));
    const unmetBudget = sum(group.map(row => row.goods.unmetBudget));
    return {
      month,
      countryPaths: group.length,
      meanUnemployment: mean(group.map(row => row.macro.unemployment)),
      totalPriorWorkers: sum(group.map(row => row.firmPlans.priorWorkers)),
      totalDesiredWorkersBeforeLabor: sum(group.map(row => row.firmPlans.desiredWorkersBeforeLabor)),
      totalNetDesiredWorkerChange: sum(group.map(row => row.firmPlans.netDesiredWorkerChange)),
      plannedVacancies,
      plannedLayoffSlots: sum(group.map(row => row.firmPlans.plannedLayoffSlots)),
      hires,
      vacancyFillRate: ratio(hires, plannedVacancies),
      marketLayoffs,
      exitSeparations,
      totalSeparations,
      exitSeparationShare: ratio(exitSeparations, totalSeparations),
      meanPositiveHiringPlanShare: mean(group.map(row => row.firmPlans.positiveHiringPlanShare)),
      meanNegativeHiringPlanShare: mean(group.map(row => row.firmPlans.negativeHiringPlanShare)),
      meanExpectedDemandGrowth: mean(group.map(row => row.firmPlans.meanExpectedDemandGrowth)),
      meanCashStress: mean(group.map(row => row.firmPlans.meanCashStress)),
      meanInventoryPressure: mean(group.map(row => row.firmPlans.meanInventoryPressure)),
      meanJobFindingRate: mean(group.map(row => row.labor.jobFindingRate)),
      meanSeparationRate: mean(group.map(row => row.labor.separationRate)),
      reservationWageRejections: sum(group.map(row => row.labor.reservationWageRejections)),
      stochasticMatchRejections: sum(group.map(row => row.labor.stochasticMatchRejections)),
      hiringCapacityBoundVacancies: sum(group.map(row => row.labor.hiringCapacityBoundVacancies)),
      scanLimitBoundVacancies: sum(group.map(row => row.labor.scanLimitBoundVacancies)),
      noApplicantVacancies: sum(group.map(row => row.labor.noApplicantVacancies)),
      desiredBudget,
      actualConsumption,
      unmetBudget,
      budgetFulfillmentRate: ratio(actualConsumption, desiredBudget),
      desiredBudgetToDisposableIncome: ratio(desiredBudget, sum(group.map(row => row.goods.disposableIncome))),
      postConsumerInventory: sum(group.map(row => row.goods.postConsumerInventory)),
      consumerOutput: sum(group.map(row => row.goods.consumerOutput)),
      firmExits: sum(group.map(row => row.firms.newExits)),
      creditStress: mean(group.map(row => row.banking.creditStress))
    };
  });
}

function runSeed(seed) {
  const world = new EconomicWorld(seed, { scaleProfile, healthCheckInterval: 0 });
  const recorder = new RealityDiagnosticRecorder(world);
  const causalRows = [];
  let maxVacancyReconciliationError = 0;
  let maxLayoffReconciliationError = 0;
  let maxSeparationReconciliationError = 0;
  let maxDesiredBudgetReconciliationError = 0;
  let maxGoodsBudgetIdentityError = 0;

  setLaborMarketDiagnosticObserver(event => recorder.recordLaborMarket(event));
  try {
    for (let step = 0; step < months; step++) {
      const pre = firmSnapshot(world);
      world.stepMonth();
      recorder.captureMonth(world);
      const currentRows = recorder.records.slice(-world.countries.length);
      const diagnosticByCountry = new Map(currentRows.map(row => [row.countryId, row]));

      for (const country of world.countries) {
        const diagnostic = diagnosticByCountry.get(country.id);
        assert.ok(diagnostic, `${seed}:${world.month}:${country.id}: diagnostic row required`);
        const firmPlans = planDiagnostics(country, pre.get(country.id));
        const goods = goodsDiagnostics(world, country, pre.get(country.id));
        const vacancyError = firmPlans.plannedVacancies - diagnostic.labor.vacancies;
        const layoffError = firmPlans.plannedLayoffSlots - diagnostic.labor.layoffs;
        const separationError = diagnostic.labor.separations - (diagnostic.labor.layoffs + diagnostic.labor.exitSeparations);

        maxVacancyReconciliationError = Math.max(maxVacancyReconciliationError, Math.abs(vacancyError));
        maxLayoffReconciliationError = Math.max(maxLayoffReconciliationError, Math.abs(layoffError));
        maxSeparationReconciliationError = Math.max(maxSeparationReconciliationError, Math.abs(separationError));
        maxDesiredBudgetReconciliationError = Math.max(maxDesiredBudgetReconciliationError, Math.abs(goods.desiredBudgetReconciliationError));
        maxGoodsBudgetIdentityError = Math.max(maxGoodsBudgetIdentityError, Math.abs(goods.goodsBudgetIdentityError));

        causalRows.push({
          seed,
          month: world.month,
          countryId: country.id,
          macro: structuredClone(diagnostic.macro),
          labor: structuredClone(diagnostic.labor),
          firms: structuredClone(diagnostic.firms),
          banking: structuredClone(diagnostic.banking),
          firmPlans,
          goods,
          reconciliation: {
            vacancyError,
            layoffError,
            separationError
          }
        });
      }
    }
  } finally {
    setLaborMarketDiagnosticObserver(null);
  }

  const health = world.forceHealthCheck();
  const diagnostics = recorder.report();
  assert.ok(health.ok, `${seed}: v0.10 health gate must pass`);
  assert.ok(diagnostics.gates.ok, `${seed}: WP-RV01 diagnostic gates must pass`);
  assert.equal(causalRows.length, months * world.countries.length, `${seed}: complete causal country-month coverage`);
  assert.ok(maxVacancyReconciliationError <= 1e-9, `${seed}: planned vacancies must reconcile to labor-market initial vacancies`);
  assert.ok(maxLayoffReconciliationError <= 1e-9, `${seed}: planned layoff slots must reconcile to labor-market layoffs`);
  assert.ok(maxSeparationReconciliationError <= 1e-9, `${seed}: separations must reconcile to market layoffs plus exit separations`);
  assert.ok(maxDesiredBudgetReconciliationError <= 1e-6, `${seed}: household desired budgets must reconcile to goods-market desired budget`);
  assert.ok(maxGoodsBudgetIdentityError <= 1e-6, `${seed}: desired goods budget must reconcile to consumption plus unmet budget`);

  return {
    seed,
    health,
    diagnosticGates: diagnostics.gates,
    causalRows,
    reconciliation: {
      maxVacancyReconciliationError,
      maxLayoffReconciliationError,
      maxSeparationReconciliationError,
      maxDesiredBudgetReconciliationError,
      maxGoodsBudgetIdentityError
    },
    scale: world.scaleReport()
  };
}

const runs = seeds.map(runSeed);
const allRows = runs.flatMap(run => run.causalRows);
const monthly = aggregateMonthly(allRows);
const preExitWindow = allRows.filter(row => row.month <= 6);
const collapseWindow = allRows.filter(row => row.month >= 7 && row.month <= Math.min(months, 9));

const report = {
  schemaVersion: 1,
  kind: 'economic-lab-wp-rv03-extreme-unemployment-causal-decomposition',
  frozenEconomicBaseline: '698d10749e2897d711e5bcee61913ac34e0650a0',
  scaleProfile,
  months,
  seeds,
  runs,
  monthly,
  hypothesisEvidence: {
    preExitWindow: {
      countryMonths: preExitWindow.length,
      meanUnemployment: mean(preExitWindow.map(row => row.macro.unemployment)),
      plannedVacancies: sum(preExitWindow.map(row => row.firmPlans.plannedVacancies)),
      plannedLayoffSlots: sum(preExitWindow.map(row => row.firmPlans.plannedLayoffSlots)),
      meanNegativeHiringPlanShare: mean(preExitWindow.map(row => row.firmPlans.negativeHiringPlanShare)),
      reservationWageRejections: sum(preExitWindow.map(row => row.labor.reservationWageRejections)),
      stochasticMatchRejections: sum(preExitWindow.map(row => row.labor.stochasticMatchRejections)),
      bindingVacancies: sum(preExitWindow.map(row => row.labor.hiringCapacityBoundVacancies + row.labor.scanLimitBoundVacancies + row.labor.noApplicantVacancies)),
      goodsDesiredBudget: sum(preExitWindow.map(row => row.goods.goodsDesiredBudget)),
      actualConsumption: sum(preExitWindow.map(row => row.goods.actualConsumption)),
      unmetBudget: sum(preExitWindow.map(row => row.goods.unmetBudget)),
      budgetFulfillmentRate: ratio(sum(preExitWindow.map(row => row.goods.actualConsumption)), sum(preExitWindow.map(row => row.goods.goodsDesiredBudget)))
    },
    collapseWindow: {
      countryMonths: collapseWindow.length,
      meanUnemployment: mean(collapseWindow.map(row => row.macro.unemployment)),
      plannedVacancies: sum(collapseWindow.map(row => row.firmPlans.plannedVacancies)),
      plannedLayoffSlots: sum(collapseWindow.map(row => row.firmPlans.plannedLayoffSlots)),
      marketLayoffs: sum(collapseWindow.map(row => row.labor.layoffs)),
      exitSeparations: sum(collapseWindow.map(row => row.labor.exitSeparations)),
      totalSeparations: sum(collapseWindow.map(row => row.labor.separations)),
      exitSeparationShare: ratio(sum(collapseWindow.map(row => row.labor.exitSeparations)), sum(collapseWindow.map(row => row.labor.separations))),
      firmExits: sum(collapseWindow.map(row => row.firms.newExits)),
      meanNegativeHiringPlanShare: mean(collapseWindow.map(row => row.firmPlans.negativeHiringPlanShare)),
      goodsDesiredBudget: sum(collapseWindow.map(row => row.goods.goodsDesiredBudget)),
      actualConsumption: sum(collapseWindow.map(row => row.goods.actualConsumption)),
      unmetBudget: sum(collapseWindow.map(row => row.goods.unmetBudget)),
      budgetFulfillmentRate: ratio(sum(collapseWindow.map(row => row.goods.actualConsumption)), sum(collapseWindow.map(row => row.goods.goodsDesiredBudget)))
    }
  },
  gates: {
    allHealthy: runs.every(run => run.health.ok),
    allWpRv01DiagnosticsReconciled: runs.every(run => run.diagnosticGates.ok),
    completeCountryMonthCoverage: allRows.length === seeds.length * months * 4,
    laborDemandReconciled: runs.every(run => run.reconciliation.maxVacancyReconciliationError <= 1e-9 && run.reconciliation.maxLayoffReconciliationError <= 1e-9),
    separationSourcesReconciled: runs.every(run => run.reconciliation.maxSeparationReconciliationError <= 1e-9),
    householdGoodsBudgetReconciled: runs.every(run => run.reconciliation.maxDesiredBudgetReconciliationError <= 1e-6 && run.reconciliation.maxGoodsBudgetIdentityError <= 1e-6)
  }
};
report.gates.ok = Object.values(report.gates).every(Boolean);
assert.ok(report.gates.ok, 'WP-RV03 causal decomposition gates must pass');

console.table(monthly.map(row => ({
  month: row.month,
  unemployment: row.meanUnemployment,
  desiredWorkerChange: row.totalNetDesiredWorkerChange,
  vacancies: row.plannedVacancies,
  plannedLayoffs: row.plannedLayoffSlots,
  exitSeparations: row.exitSeparations,
  firmExits: row.firmExits,
  negativePlanShare: row.meanNegativeHiringPlanShare,
  desiredBudget: row.desiredBudget,
  consumption: row.actualConsumption,
  fulfillment: row.budgetFulfillmentRate
})));
console.log(JSON.stringify(report, null, 2));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`WP_RV03_JSON ${outputJson}`);
}

console.log('Economic Lab WP-RV03 extreme-unemployment causal decomposition evidence PASS');
