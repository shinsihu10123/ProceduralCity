import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const scales = (process.env.DIAG_SCALES || 'compact,baseline').split(',').map(x => x.trim()).filter(Boolean);
const seeds = (process.env.DIAG_SEEDS || 'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x => x.trim()).filter(Boolean);
const months = Math.max(1, Number(process.env.DIAG_MONTHS || 12));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const EPS = 1e-9;

const VARIANTS = Object.freeze([
  Object.freeze({ id: 'frozen-control', kind: 'control' }),
  Object.freeze({ id: 'price-wage-basis', kind: 'candidate' })
]);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = values => values.reduce((total, value) => total + finite(value), 0);
const mean = values => values.length ? sum(values) / values.length : 0;
const ratio = (a, b) => Math.abs(finite(b)) > EPS ? finite(a) / finite(b) : 0;
const clone = value => structuredClone(value);

function transformedSeeds(variantId) {
  return COUNTRY_SEEDS.map(seed => {
    if (variantId === 'frozen-control') return { ...seed };
    if (variantId === 'price-wage-basis') return { ...seed, initialPrice: Math.max(EPS, finite(seed.initialWage, seed.initialPrice)) };
    throw new Error(`unknown variant: ${variantId}`);
  });
}

function createVariantWorld(variantId, scaleProfile, seedText) {
  const originals = COUNTRY_SEEDS.map(seed => clone(seed));
  COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...transformedSeeds(variantId));
  try {
    return new EconomicWorld(seedText, { scaleProfile, healthCheckInterval: 0 });
  } finally {
    COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...originals);
  }
}

function stateFingerprint(world) {
  return {
    month: world.month,
    rng: clone(world.rng),
    countries: clone(world.countries),
    ledgerEntries: clone(world.ledger.entries),
    accounting: world.countries.map(country => ({ id: country.id, report: world.accountingReport(country.id) }))
  };
}

function firmDue(country, firm) {
  const workers = (country.households || []).filter(h => h.employed && h.employerId === firm.id);
  const base = Math.max(0, finite(firm.wage));
  return {
    workers: workers.length,
    basePayroll: base * workers.length,
    settlementDue: sum(workers.map(h => base + Math.min(Math.max(0, finite(h.wageArrears)), base * 0.5)))
  };
}

function stageSnapshot(world, country, stage) {
  const active = (country.firms || []).filter(f => f.active !== false);
  const consumer = active.filter(f => f.consumerFacing === true);
  const group = firms => {
    const dueRows = firms.map(f => ({ firm: f, due: firmDue(country, f) }));
    const cash = sum(firms.map(f => Math.max(0, finite(world.ledger.balance(f.accountId)))));
    const basePayroll = sum(dueRows.map(x => x.due.basePayroll));
    const settlementDue = sum(dueRows.map(x => x.due.settlementDue));
    const cashShortfall = sum(dueRows.map(({ firm, due }) => Math.max(0, due.settlementDue - Math.max(0, finite(world.ledger.balance(firm.accountId))))));
    return {
      firms: firms.length,
      workers: sum(dueRows.map(x => x.due.workers)),
      cash,
      basePayroll,
      settlementDue,
      cashCoverageOfSettlementDue: ratio(cash, settlementDue),
      cashShortfall,
      firmsCashBelowSettlementDue: dueRows.filter(({ firm, due }) => Math.max(0, finite(world.ledger.balance(firm.accountId))) + EPS < due.settlementDue).length,
      wageArrears: sum(firms.map(f => Math.max(0, finite(f.wageArrears)))),
      revenue: sum(firms.map(f => Math.max(0, finite(f.revenue)))),
      outputUnits: sum(firms.map(f => Math.max(0, finite(f.output)))),
      outputValue: sum(firms.map(f => Math.max(0, finite(f.output)) * Math.max(0, finite(f.price)))),
      inventoryUnits: sum(firms.map(f => Math.max(0, finite(f.inventory)))),
      inventoryValue: sum(firms.map(f => Math.max(0, finite(f.inventory)) * Math.max(0, finite(f.price)))),
      desiredProduction: sum(firms.map(f => Math.max(0, finite(f.desiredProduction)))),
      capacity: sum(firms.map(f => Math.max(0, finite(f.capacity)))),
      inputShortage: sum(firms.map(f => Math.max(0, finite(f.supplyShortage)))),
      loanBalance: sum(firms.map(f => Math.max(0, finite(f.loanBalance)))),
      creditMisses: sum(firms.map(f => Math.max(0, finite(f.creditMisses)))),
      planDefenseShare: ratio(firms.filter(f => f.currentPlan?.selected === '방어' || f.currentPlan?.name === '방어').length, firms.length),
      planCashPreservationShare: ratio(firms.filter(f => f.currentPlan?.selected === '현금 보존' || f.currentPlan?.name === '현금 보존').length, firms.length),
      desiredWorkers: sum(firms.map(f => Math.max(0, finite(f.desiredWorkers))))
    };
  };
  return {
    stage,
    month: world.month,
    countryId: country.id,
    all: group(active),
    consumer: group(consumer),
    unemployment: finite(country.macro?.unemployment),
    activeFirms: active.length
  };
}

function ledgerAmount(world, countryId, month, kind, predicate = null) {
  return sum(world.ledger.entriesFor({ month, countryId, kind })
    .filter(entry => !predicate || predicate(entry))
    .map(entry => entry.amount));
}

function firmPaymentMaps(world, country, month) {
  const wageByFirm = new Map();
  for (const entry of world.ledger.entriesFor({ month, countryId: country.id, kind: 'wage' })) {
    const firmId = entry.meta?.firmId;
    if (firmId) wageByFirm.set(firmId, (wageByFirm.get(firmId) || 0) + finite(entry.amount));
  }
  const goodsByFirm = new Map();
  for (const entry of world.ledger.entriesFor({ month, countryId: country.id, kind: 'goods_purchase' })) {
    const firmId = entry.meta?.firmId;
    if (firmId) goodsByFirm.set(firmId, (goodsByFirm.get(firmId) || 0) + finite(entry.amount));
  }
  return { wageByFirm, goodsByFirm };
}

function installObservers(world, stageEvents, bridgeEvents) {
  const prePayrollByKey = new Map();
  const push = (country, stage) => stageEvents.push(stageSnapshot(world, country, stage));
  const key = (country, month) => `${country.id}:${month}`;

  const originalOriginate = world.banking.originateCredit.bind(world.banking);
  world.banking.originateCredit = (country, month, signals) => {
    push(country, 'pre-credit');
    const result = originalOriginate(country, month, signals);
    push(country, 'post-credit');
    return result;
  };

  const originalInputs = world.supply.procureInputs.bind(world.supply);
  world.supply.procureInputs = (country, month) => {
    push(country, 'pre-inputs');
    const result = originalInputs(country, month);
    push(country, 'post-inputs');
    return result;
  };

  const originalProduce = world.supply.produce.bind(world.supply);
  world.supply.produce = (country, month, metrics) => {
    const result = originalProduce(country, month, metrics);
    push(country, 'post-production');
    return result;
  };

  const originalAccrual = world.accounting.accrueMonthlyWages.bind(world.accounting);
  world.accounting.accrueMonthlyWages = (country, month) => {
    push(country, 'pre-payroll');
    const rows = (country.firms || []).filter(f => f.active !== false).map(f => {
      const due = firmDue(country, f);
      return {
        firmId: f.id,
        consumerFacing: f.consumerFacing === true,
        cash: Math.max(0, finite(world.ledger.balance(f.accountId))),
        basePayroll: due.basePayroll,
        settlementDue: due.settlementDue,
        workers: due.workers,
        safeCash: Math.max(0, finite(f.safeCash)),
        loanBalance: Math.max(0, finite(f.loanBalance))
      };
    });
    prePayrollByKey.set(key(country, month), rows);
    return originalAccrual(country, month);
  };

  const originalIncomeTax = world.fiscal.collectIncomeTaxes.bind(world.fiscal);
  world.fiscal.collectIncomeTaxes = (country, month) => {
    push(country, 'post-payroll');
    return originalIncomeTax(country, month);
  };

  const originalInvestment = world.supply.clearInvestmentMarket.bind(world.supply);
  world.supply.clearInvestmentMarket = (country, month, metrics) => {
    const result = originalInvestment(country, month, metrics);
    push(country, 'post-investment');
    return result;
  };

  const originalIngest = world.accounting.ingestSettlementEntries.bind(world.accounting);
  world.accounting.ingestSettlementEntries = (entries, country, month) => {
    push(country, 'post-goods');
    const preRows = prePayrollByKey.get(key(country, month)) || [];
    const { wageByFirm, goodsByFirm } = firmPaymentMaps(world, country, month);
    let consumerDue = 0;
    let consumerPreCash = 0;
    let consumerWagesPaid = 0;
    let consumerGoodsRevenue = 0;
    let consumerPreCashShortfall = 0;
    let cashInsufficientFirms = 0;
    let goodsBridgeFirms = 0;
    let cashInsufficientPayroll = 0;
    let goodsBridgePayroll = 0;
    for (const pre of preRows.filter(x => x.consumerFacing)) {
      const due = pre.settlementDue;
      const wagesPaid = wageByFirm.get(pre.firmId) || 0;
      const goodsRevenue = goodsByFirm.get(pre.firmId) || 0;
      const shortfall = Math.max(0, due - pre.cash);
      consumerDue += due;
      consumerPreCash += pre.cash;
      consumerWagesPaid += wagesPaid;
      consumerGoodsRevenue += goodsRevenue;
      consumerPreCashShortfall += shortfall;
      if (shortfall > EPS) {
        cashInsufficientFirms += 1;
        cashInsufficientPayroll += due;
        if (goodsRevenue + EPS >= shortfall) {
          goodsBridgeFirms += 1;
          goodsBridgePayroll += due;
        }
      }
    }
    bridgeEvents.push({
      month,
      countryId: country.id,
      consumerFirms: preRows.filter(x => x.consumerFacing).length,
      consumerSettlementDue: consumerDue,
      consumerPrePayrollCash: consumerPreCash,
      consumerWagesPaid,
      consumerGoodsRevenue,
      consumerPrePayrollCashShortfall: consumerPreCashShortfall,
      cashInsufficientFirms,
      goodsRevenueCouldBridgeFirms: goodsBridgeFirms,
      cashInsufficientPayroll,
      goodsRevenueCouldBridgePayroll: goodsBridgePayroll,
      shareCashInsufficientFirmsBridgeableByLaterGoodsRevenue: ratio(goodsBridgeFirms, cashInsufficientFirms),
      shareCashInsufficientPayrollBridgeableByLaterGoodsRevenue: ratio(goodsBridgePayroll, cashInsufficientPayroll),
      goodsRevenueToSettlementDue: ratio(consumerGoodsRevenue, consumerDue),
      wagesPaidToSettlementDue: ratio(consumerWagesPaid, consumerDue)
    });
    return originalIngest(entries, country, month);
  };

  const originalCorporateTax = world.fiscal.collectCorporateTaxes.bind(world.fiscal);
  world.fiscal.collectCorporateTaxes = (country, month) => {
    push(country, 'post-government-demand');
    return originalCorporateTax(country, month);
  };

  const originalExit = world.supply.evaluateExits.bind(world.supply);
  world.supply.evaluateExits = country => {
    push(country, 'pre-exit');
    const result = originalExit(country);
    const snapshot = stageSnapshot(world, country, 'post-exit');
    snapshot.exitsThisMonth = Array.isArray(result) ? result.length : 0;
    stageEvents.push(snapshot);
    return result;
  };
}

function runObserved(variant, scaleProfile, seed, horizon, collect = true) {
  const world = createVariantWorld(variant.id, scaleProfile, seed);
  const stages = [];
  const bridges = [];
  installObservers(world, stages, bridges);
  const rows = [];
  let maxPayrollLedgerError = 0;
  let maxGoodsLedgerError = 0;

  for (let i = 0; i < horizon; i++) {
    world.stepMonth();
    if (!collect) continue;
    for (const country of world.countries) {
      const month = world.month;
      const stageRows = stages.filter(x => x.month === month && x.countryId === country.id);
      const expectedStages = ['pre-credit','post-credit','pre-inputs','post-inputs','post-production','pre-payroll','post-payroll','post-investment','post-goods','post-government-demand','pre-exit','post-exit'];
      assert.deepEqual(stageRows.map(x => x.stage), expectedStages, `${variant.id}/${scaleProfile}/${seed}/${country.id}/M${month}: exact domestic stage order required`);
      const bridge = bridges.find(x => x.month === month && x.countryId === country.id);
      assert.ok(bridge, `${variant.id}/${scaleProfile}/${seed}/${country.id}/M${month}: bridge event required`);
      const payrollLedger = ledgerAmount(world, country.id, month, 'wage');
      const goodsLedger = ledgerAmount(world, country.id, month, 'goods_purchase');
      const payrollMetric = finite(country.lastMarkets?.payroll?.payroll);
      const goodsMetric = finite(country.lastMarkets?.goods?.nominalConsumption);
      const payrollLedgerError = payrollLedger - payrollMetric;
      const goodsLedgerError = goodsLedger - goodsMetric;
      maxPayrollLedgerError = Math.max(maxPayrollLedgerError, Math.abs(payrollLedgerError));
      maxGoodsLedgerError = Math.max(maxGoodsLedgerError, Math.abs(goodsLedgerError));

      const byStage = Object.fromEntries(stageRows.map(x => [x.stage, x]));
      const prePayroll = byStage['pre-payroll'];
      const postPayroll = byStage['post-payroll'];
      const postGoods = byStage['post-goods'];
      const postGov = byStage['post-government-demand'];
      rows.push({
        variant: variant.id,
        variantKind: variant.kind,
        scaleProfile,
        seed,
        month,
        countryId: country.id,
        economy: {
          unemployment: finite(country.macro?.unemployment),
          consumption: finite(country.macro?.consumption),
          nominalSales: finite(country.macro?.nominalSales),
          activeFirms: (country.firms || []).filter(f => f.active !== false).length,
          firmExits: finite(country.macro?.firmExits),
          inputShortageUnits: finite(country.macro?.inputShortageUnits),
          creditApplications: finite(country.lastCredit?.applications),
          creditApproved: finite(country.lastCredit?.approved),
          creditApprovalRate: ratio(country.lastCredit?.approved, country.lastCredit?.applications)
        },
        stage: byStage,
        bridge,
        flow: {
          consumerPrePayrollCashCoverage: prePayroll.consumer.cashCoverageOfSettlementDue,
          consumerPrePayrollCashShortfall: prePayroll.consumer.cashShortfall,
          consumerPayrollCashOutflow: prePayroll.consumer.cash - postPayroll.consumer.cash,
          consumerGoodsCashInflow: postGoods.consumer.cash - byStage['post-investment'].consumer.cash,
          consumerGovernmentDemandCashInflowBeforeCorporateTax: postGov.consumer.cash - postGoods.consumer.cash,
          consumerEndogenousRevenueAtGoodsStage: postGoods.consumer.revenue,
          consumerRevenueToSettlementDueAtGoodsStage: ratio(postGoods.consumer.revenue, prePayroll.consumer.settlementDue),
          consumerOutputValueToSettlementDue: ratio(prePayroll.consumer.outputValue, prePayroll.consumer.settlementDue),
          consumerInputShortageToDesiredProduction: ratio(prePayroll.consumer.inputShortage, prePayroll.consumer.desiredProduction),
          consumerWageArrearsAfterPayroll: postPayroll.consumer.wageArrears,
          consumerPlanDefenseShare: prePayroll.consumer.planDefenseShare,
          consumerPlanCashPreservationShare: prePayroll.consumer.planCashPreservationShare,
          consumerDesiredWorkers: prePayroll.consumer.desiredWorkers,
          consumerWorkers: prePayroll.consumer.workers
        },
        reconciliation: { payrollLedgerError, goodsLedgerError }
      });
    }
  }

  const health = world.forceHealthCheck();
  if (!collect) return { fingerprint: stateFingerprint(world) };
  assert.ok(health.ok, `${variant.id}/${scaleProfile}/${seed}: health gate must pass`);
  assert.equal(rows.length, horizon * world.countries.length, `${variant.id}/${scaleProfile}/${seed}: complete country-month coverage required`);
  assert.ok(maxPayrollLedgerError <= 1e-7, `${variant.id}/${scaleProfile}/${seed}: payroll ledger must reconcile`);
  assert.ok(maxGoodsLedgerError <= 1e-7, `${variant.id}/${scaleProfile}/${seed}: goods ledger must reconcile`);
  return { variant: variant.id, scaleProfile, seed, health, rows, stages, bridges, reconciliation: { maxPayrollLedgerError, maxGoodsLedgerError }, scale: world.scaleReport() };
}

function runPlain(variant, scaleProfile, seed, horizon) {
  const world = createVariantWorld(variant.id, scaleProfile, seed);
  for (let i = 0; i < horizon; i++) world.stepMonth();
  return stateFingerprint(world);
}

const nonInterference = [];
for (const variant of VARIANTS) {
  for (const scaleProfile of scales) {
    const seed = `ECON-RV07-P3-NONINTERFERENCE-${variant.id}-${scaleProfile}`;
    const horizon = Math.min(2, months);
    const plain = runPlain(variant, scaleProfile, seed, horizon);
    const observed = runObserved(variant, scaleProfile, seed, horizon, false).fingerprint;
    assert.deepStrictEqual(observed, plain, `${variant.id}/${scaleProfile}: P3 observers must not alter economic state`);
    nonInterference.push({ variant: variant.id, scaleProfile, seed, months: horizon, exact: true });
  }
}

const runs = [];
for (const variant of VARIANTS) for (const scaleProfile of scales) for (const seed of seeds) runs.push(runObserved(variant, scaleProfile, seed, months, true));
const rows = runs.flatMap(run => run.rows);

function aggregate(rs) {
  return {
    countryMonths: rs.length,
    meanUnemployment: mean(rs.map(r => r.economy.unemployment)),
    totalFirmExits: sum(rs.map(r => r.economy.firmExits)),
    meanCreditApprovalRate: mean(rs.map(r => r.economy.creditApprovalRate)),
    meanConsumerPrePayrollCashCoverage: mean(rs.map(r => r.flow.consumerPrePayrollCashCoverage)),
    totalConsumerPrePayrollCashShortfall: sum(rs.map(r => r.flow.consumerPrePayrollCashShortfall)),
    meanConsumerRevenueToSettlementDueAtGoodsStage: mean(rs.map(r => r.flow.consumerRevenueToSettlementDueAtGoodsStage)),
    meanConsumerOutputValueToSettlementDue: mean(rs.map(r => r.flow.consumerOutputValueToSettlementDue)),
    totalConsumerWageArrearsAfterPayroll: sum(rs.map(r => r.flow.consumerWageArrearsAfterPayroll)),
    meanConsumerInputShortageToDesiredProduction: mean(rs.map(r => r.flow.consumerInputShortageToDesiredProduction)),
    meanConsumerPlanDefenseShare: mean(rs.map(r => r.flow.consumerPlanDefenseShare)),
    meanConsumerPlanCashPreservationShare: mean(rs.map(r => r.flow.consumerPlanCashPreservationShare)),
    totalCashInsufficientFirms: sum(rs.map(r => r.bridge.cashInsufficientFirms)),
    totalGoodsBridgeableFirms: sum(rs.map(r => r.bridge.goodsRevenueCouldBridgeFirms)),
    shareCashInsufficientFirmsBridgeableByLaterGoodsRevenue: ratio(sum(rs.map(r => r.bridge.goodsRevenueCouldBridgeFirms)), sum(rs.map(r => r.bridge.cashInsufficientFirms))),
    totalCashInsufficientPayroll: sum(rs.map(r => r.bridge.cashInsufficientPayroll)),
    totalGoodsBridgeablePayroll: sum(rs.map(r => r.bridge.goodsRevenueCouldBridgePayroll)),
    shareCashInsufficientPayrollBridgeableByLaterGoodsRevenue: ratio(sum(rs.map(r => r.bridge.goodsRevenueCouldBridgePayroll)), sum(rs.map(r => r.bridge.cashInsufficientPayroll))),
    totalConsumerGoodsRevenue: sum(rs.map(r => r.bridge.consumerGoodsRevenue)),
    totalConsumerSettlementDue: sum(rs.map(r => r.bridge.consumerSettlementDue)),
    goodsRevenueToSettlementDue: ratio(sum(rs.map(r => r.bridge.consumerGoodsRevenue)), sum(rs.map(r => r.bridge.consumerSettlementDue)))
  };
}

const windows = [
  { id: 'M1-3', from: 1, to: 3 },
  { id: 'M4-6', from: 4, to: 6 },
  { id: 'M7-9', from: 7, to: 9 },
  { id: 'M10-12', from: 10, to: months },
  { id: 'FULL', from: 1, to: months }
].filter(x => x.from <= months);

const aggregates = {};
for (const variant of VARIANTS) {
  aggregates[variant.id] = {};
  for (const scaleProfile of scales) {
    aggregates[variant.id][scaleProfile] = {};
    for (const window of windows) aggregates[variant.id][scaleProfile][window.id] = aggregate(rows.filter(r => r.variant === variant.id && r.scaleProfile === scaleProfile && r.month >= window.from && r.month <= window.to));
  }
}

const report = {
  schemaVersion: 1,
  kind: 'economic-lab-wp-rv07-p3-candidate-residual-failure-decomposition',
  frozenEconomicBaseline: '698d10749e2897d711e5bcee61913ac34e0650a0',
  variants: VARIANTS,
  scales,
  seeds,
  months,
  methodology: {
    canonicalMechanismChanges: 0,
    canonicalParameterTuning: 0,
    candidateMerged: false,
    exactCodeOrderVerified: ['credit origination', 'labor clearing', 'input procurement', 'production', 'wage accrual/payroll settlement', 'income tax/transfers', 'investment market', 'household goods market', 'government final demand', 'corporate tax', 'exit evaluation'],
    primaryQuestion: 'Does the candidate retain firms that are monthly-flow viable but cannot bridge payroll before household-goods revenue arrives later in the same month?'
  },
  nonInterference,
  runs,
  aggregates,
  gates: {
    observerNonInterferenceExact: nonInterference.every(x => x.exact),
    allHealthy: runs.every(run => run.health?.ok),
    completeCoverage: rows.length === VARIANTS.length * scales.length * seeds.length * months * 4,
    payrollLedgerReconciled: runs.every(run => run.reconciliation.maxPayrollLedgerError <= 1e-7),
    goodsLedgerReconciled: runs.every(run => run.reconciliation.maxGoodsLedgerError <= 1e-7),
    exactStageCoverage: runs.every(run => run.stages.length === months * 4 * 12),
    exactBridgeCoverage: runs.every(run => run.bridges.length === months * 4)
  }
};
report.gates.ok = Object.values(report.gates).every(Boolean);

console.table(VARIANTS.flatMap(variant => scales.map(scaleProfile => {
  const a = aggregates[variant.id][scaleProfile].FULL;
  return {
    variant: variant.id,
    scale: scaleProfile,
    prePayrollCashCoverage: Number(a.meanConsumerPrePayrollCashCoverage.toFixed(4)),
    revenueDue: Number(a.meanConsumerRevenueToSettlementDueAtGoodsStage.toFixed(4)),
    bridgeableFirmShare: Number(a.shareCashInsufficientFirmsBridgeableByLaterGoodsRevenue.toFixed(4)),
    bridgeablePayrollShare: Number(a.shareCashInsufficientPayrollBridgeableByLaterGoodsRevenue.toFixed(4)),
    inputShortage: Number(a.meanConsumerInputShortageToDesiredProduction.toFixed(4)),
    defense: Number(a.meanConsumerPlanDefenseShare.toFixed(4)),
    unemployment: Number(a.meanUnemployment.toFixed(4)),
    exits: a.totalFirmExits
  };
})));
console.log('WP_RV07_P3_GATES', JSON.stringify(report.gates));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log('WP_RV07_P3_OUTPUT', outputJson);
}

if (!report.gates.ok) process.exitCode = 1;
