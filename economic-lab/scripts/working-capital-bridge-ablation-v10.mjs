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
  Object.freeze({ id: 'unit-basis-control', kind: 'control', bridge: false }),
  Object.freeze({ id: 'unit-basis-collateral-bridge', kind: 'candidate', bridge: true })
]);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = values => values.reduce((total, value) => total + finite(value), 0);
const mean = values => values.length ? sum(values) / values.length : 0;
const ratio = (a, b) => Math.abs(finite(b)) > EPS ? finite(a) / finite(b) : 0;
const clone = value => structuredClone(value);

function transformedSeeds() {
  return COUNTRY_SEEDS.map(seed => ({
    ...seed,
    initialPrice: Math.max(EPS, finite(seed.initialWage, finite(seed.initialPrice, 1))),
    __rv07P4: {
      originalInitialPrice: Math.max(EPS, finite(seed.initialPrice, 1)),
      derivedPriceBasis: Math.max(EPS, finite(seed.initialWage, finite(seed.initialPrice, 1)))
    }
  }));
}

function createUnitBasisWorld(scaleProfile, seedText) {
  const originals = COUNTRY_SEEDS.map(seed => clone(seed));
  const replacement = transformedSeeds();
  COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...replacement);
  try {
    return new EconomicWorld(seedText, { scaleProfile, healthCheckInterval: 0 });
  } finally {
    COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...originals);
  }
}

function exactPayrollDue(country, firm) {
  return sum((country.households || [])
    .filter(h => h.employed && h.employerId === firm.id)
    .map(h => {
      const priorArrears = Math.max(0, finite(h.wageArrears));
      const wage = Math.max(0, finite(firm.wage));
      return wage + Math.min(priorArrears, wage * 0.5);
    }));
}

function taggedBridgeLoans(country) {
  return (country.loans || []).filter(loan => loan.__rv07P4Bridge === true);
}

function installBridgeAblation(world) {
  world.__rv07P4BridgeEvents = [];
  const originalAccrue = world.accounting.accrueMonthlyWages.bind(world.accounting);
  const originalIngest = world.accounting.ingestSettlementEntries.bind(world.accounting);

  world.accounting.accrueMonthlyWages = (country, month) => {
    const bank = country.banks[0];
    const firms = (country.firms || [])
      .filter(f => f.active !== false && f.consumerFacing === true)
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const firm of firms) {
      const due = exactPayrollDue(country, firm);
      const cashBefore = world.ledger.balance(firm.accountId);
      const shortfall = Math.max(0, due - cashBefore);
      if (shortfall <= EPS) continue;

      // Causal upper-bound collateral rule: no fitted haircut. The bridge can never exceed
      // current sellable finished-goods market value, exact payroll cash shortfall, or bank
      // capital capacity. This is an experimental ablation, not a production credit policy.
      const collateralMarketValue = Math.max(0, finite(firm.inventory) * Math.max(0, finite(firm.price)));
      const requested = Math.min(shortfall, collateralMarketValue);
      if (requested <= EPS) continue;

      const bankStatement = world.accounting.entityStatement(bank.id, month).balanceSheet;
      const capitalCapped = world.banking.capByBankCapital(bank, bankStatement, requested);
      if (capitalCapped <= EPS) {
        world.__rv07P4BridgeEvents.push({
          type: 'issue-denied-capital', month, countryId: country.id, firmId: firm.id,
          due, cashBefore, shortfall, collateralMarketValue, requested, amount: 0
        });
        continue;
      }

      const created = world.ledger.adjustMoney({
        month,
        countryId: country.id,
        accountId: firm.accountId,
        amount: capitalCapped,
        kind: 'rv07_payroll_bridge_origination',
        meta: { bankId: bank.id, borrowerId: firm.id, purpose: 'same_month_payroll_bridge' }
      });
      if (created <= EPS) continue;

      const loan = {
        id: `RV07P4-${country.id}-${String(month).padStart(3, '0')}-${firm.id}`,
        countryId: country.id,
        bankId: bank.id,
        borrowerId: firm.id,
        borrowerKind: 'firm',
        originalPrincipal: created,
        outstanding: created,
        annualRate: 0,
        monthlyRate: 0,
        termMonths: 1,
        originatedMonth: month,
        nextPaymentMonth: month + 1,
        missedPayments: 0,
        arrears: 0,
        status: 'active',
        estimatedDefaultProbabilityAtOrigination: null,
        __rv07P4Bridge: true
      };
      country.loans.push(loan);
      firm.loanBalance = (firm.loanBalance || 0) + created;
      world.accounting.recordLoanOrigination({ country, bank, borrower: firm, loan, month, amount: created });
      world.__rv07P4BridgeEvents.push({
        type: 'issued', month, countryId: country.id, firmId: firm.id, loanId: loan.id,
        due, cashBefore, shortfall, collateralMarketValue, requested, amount: created
      });
    }

    return originalAccrue(country, month);
  };

  world.accounting.ingestSettlementEntries = (entries, country, month) => {
    const result = originalIngest(entries, country, month);
    const bank = country.banks[0];
    const firmMap = new Map((country.firms || []).map(f => [f.id, f]));

    for (const loan of taggedBridgeLoans(country)) {
      if (loan.status !== 'active' || loan.originatedMonth !== month || loan.outstanding <= EPS) continue;
      const firm = firmMap.get(loan.borrowerId);
      if (!firm) continue;
      const cashBefore = world.ledger.balance(firm.accountId);
      const requested = Math.min(loan.outstanding, Math.max(0, cashBefore));
      if (requested <= EPS) continue;

      const monetaryDelta = world.ledger.adjustMoney({
        month,
        countryId: country.id,
        accountId: firm.accountId,
        amount: -requested,
        kind: 'rv07_payroll_bridge_repayment',
        meta: { loanId: loan.id, bankId: bank.id, borrowerId: firm.id, timing: 'post_household_goods' }
      });
      const principalPaid = Math.max(0, -monetaryDelta);
      if (principalPaid <= EPS) continue;

      world.accounting.recordLoanPayment({
        country,
        bank,
        borrower: firm,
        loan,
        month,
        principalPaid,
        interestPaid: 0
      });
      loan.outstanding = Math.max(0, loan.outstanding - principalPaid);
      firm.loanBalance = Math.max(0, finite(firm.loanBalance) - principalPaid);
      if (loan.outstanding <= EPS) {
        loan.outstanding = 0;
        loan.status = 'repaid';
        loan.arrears = 0;
      }
      world.__rv07P4BridgeEvents.push({
        type: 'repaid', month, countryId: country.id, firmId: firm.id, loanId: loan.id,
        cashBefore, amount: principalPaid, outstandingAfter: loan.outstanding
      });
    }

    return result;
  };
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

function gdpResidual(macro) {
  const reconstructed =
    finite(macro?.consumption) +
    finite(macro?.grossInvestment) +
    finite(macro?.publicInvestment) +
    finite(macro?.governmentConsumption) +
    finite(macro?.inventoryInvestment) +
    finite(macro?.netExports);
  return finite(macro?.gdp) - reconstructed;
}

function rowFor(world, variant, scaleProfile, seed, country) {
  const monthEvents = (world.__rv07P4BridgeEvents || []).filter(e => e.month === world.month && e.countryId === country.id);
  const issued = monthEvents.filter(e => e.type === 'issued');
  const repaid = monthEvents.filter(e => e.type === 'repaid');
  const denied = monthEvents.filter(e => e.type === 'issue-denied-capital');
  const bridgeLoans = taggedBridgeLoans(country);
  const activeBridgeOutstanding = sum(bridgeLoans.filter(l => l.status === 'active').map(l => l.outstanding));
  const goods = country.lastMarkets?.goods || {};
  const credit = country.lastCredit || {};
  const macro = country.macro || {};
  const desiredBudget = finite(goods.desiredBudget);
  const consumption = finite(goods.nominalConsumption ?? macro.consumption);
  return {
    variant: variant.id,
    variantKind: variant.kind,
    scaleProfile,
    seed,
    month: world.month,
    countryId: country.id,
    bridge: {
      issuedLoans: issued.length,
      deniedByBankCapital: denied.length,
      issuedAmount: sum(issued.map(e => e.amount)),
      repaidSameMonthAmount: sum(repaid.map(e => e.amount)),
      sameMonthRepaymentRate: ratio(sum(repaid.map(e => e.amount)), sum(issued.map(e => e.amount))),
      activeOutstanding: activeBridgeOutstanding,
      cumulativeTaggedLoans: bridgeLoans.length
    },
    economy: {
      unemployment: finite(macro.unemployment),
      firmExits: finite(macro.firmExits),
      activeFirms: finite(macro.activeFirms),
      wageArrears: finite(macro.wageArrears),
      inputShortageUnits: finite(macro.inputShortageUnits),
      consumption,
      desiredBudget,
      goodsFulfillmentRate: ratio(consumption, desiredBudget),
      gdp: finite(macro.gdp),
      gdpIdentityResidual: gdpResidual(macro),
      creditApplications: finite(credit.applications),
      creditApproved: finite(credit.approved),
      creditApprovalRate: ratio(credit.approved, credit.applications),
      outstandingLoans: finite(credit.outstandingLoans)
    },
    ledger: world.ledger.verifyCountry(country.id)
  };
}

function runVariant(variant, scaleProfile, seed, horizon, collect = true) {
  const world = createUnitBasisWorld(scaleProfile, seed);
  if (variant.bridge) installBridgeAblation(world);
  else world.__rv07P4BridgeEvents = [];

  const rows = [];
  for (let i = 0; i < horizon; i++) {
    world.stepMonth();
    if (collect) for (const country of world.countries) rows.push(rowFor(world, variant, scaleProfile, seed, country));
  }
  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${variant.id}/${scaleProfile}/${seed}: health gate must pass`);
  if (!collect) return { fingerprint: stateFingerprint(world) };

  const ledgerIssued = sum(world.ledger.entries.filter(e => e.kind === 'rv07_payroll_bridge_origination').map(e => e.amount));
  const ledgerRepaid = sum(world.ledger.entries.filter(e => e.kind === 'rv07_payroll_bridge_repayment').map(e => e.amount));
  const eventIssued = sum((world.__rv07P4BridgeEvents || []).filter(e => e.type === 'issued').map(e => e.amount));
  const eventRepaid = sum((world.__rv07P4BridgeEvents || []).filter(e => e.type === 'repaid').map(e => e.amount));
  const bridgeLoans = world.countries.flatMap(taggedBridgeLoans);
  const bridgeLoansWellFormed = bridgeLoans.every(loan =>
    Number.isFinite(loan.originalPrincipal) && Number.isFinite(loan.outstanding) &&
    loan.originalPrincipal >= -EPS && loan.outstanding >= -EPS && loan.outstanding <= loan.originalPrincipal + 1e-7
  );
  const ledgerCountriesOk = world.countries.every(country => world.ledger.verifyCountry(country.id).ok);
  return {
    variant: variant.id,
    scaleProfile,
    seed,
    rows,
    health,
    fingerprint: stateFingerprint(world),
    reconciliation: {
      ledgerIssued,
      eventIssued,
      issuanceError: ledgerIssued - eventIssued,
      ledgerRepaid,
      eventRepaid,
      repaymentError: ledgerRepaid - eventRepaid,
      bridgeLoansWellFormed,
      ledgerCountriesOk
    }
  };
}

const determinism = [];
for (const variant of VARIANTS) {
  for (const scaleProfile of scales) {
    const seed = `ECON-RV07-P4-DETERMINISM-${variant.id}-${scaleProfile}`;
    const a = runVariant(variant, scaleProfile, seed, Math.min(3, months), false).fingerprint;
    const b = runVariant(variant, scaleProfile, seed, Math.min(3, months), false).fingerprint;
    const exact = JSON.stringify(a) === JSON.stringify(b);
    assert.ok(exact, `${variant.id}/${scaleProfile}: deterministic replay must be exact`);
    determinism.push({ variant: variant.id, scaleProfile, exact });
  }
}

const runs = [];
for (const variant of VARIANTS) {
  for (const scaleProfile of scales) {
    for (const seed of seeds) runs.push(runVariant(variant, scaleProfile, seed, months, true));
  }
}
const rows = runs.flatMap(run => run.rows);

const windows = [
  { id: 'M1-3', from: 1, to: Math.min(3, months) },
  { id: 'M4-6', from: 4, to: Math.min(6, months) },
  { id: 'M7-9', from: 7, to: Math.min(9, months) },
  { id: 'M10-12', from: 10, to: months },
  { id: 'FULL', from: 1, to: months }
].filter(w => w.from <= months && w.to >= w.from);

function aggregate(rs) {
  const issued = sum(rs.map(r => r.bridge.issuedAmount));
  const repaid = sum(rs.map(r => r.bridge.repaidSameMonthAmount));
  const applications = sum(rs.map(r => r.economy.creditApplications));
  const approvals = sum(rs.map(r => r.economy.creditApproved));
  return {
    countryMonths: rs.length,
    meanUnemployment: mean(rs.map(r => r.economy.unemployment)),
    totalFirmExits: sum(rs.map(r => r.economy.firmExits)),
    meanWageArrears: mean(rs.map(r => r.economy.wageArrears)),
    meanGoodsFulfillmentRate: mean(rs.map(r => r.economy.goodsFulfillmentRate)),
    meanInputShortageUnits: mean(rs.map(r => r.economy.inputShortageUnits)),
    creditApprovalRate: ratio(approvals, applications),
    bridgeIssuedAmount: issued,
    bridgeRepaidSameMonthAmount: repaid,
    bridgeSameMonthRepaymentRate: ratio(repaid, issued),
    meanBridgeOutstanding: mean(rs.map(r => r.bridge.activeOutstanding)),
    totalBridgeIssuedLoans: sum(rs.map(r => r.bridge.issuedLoans)),
    totalBridgeDeniedByBankCapital: sum(rs.map(r => r.bridge.deniedByBankCapital)),
    maxAbsGdpIdentityResidual: rs.length ? Math.max(...rs.map(r => Math.abs(r.economy.gdpIdentityResidual))) : 0
  };
}

const aggregates = {};
for (const variant of VARIANTS) {
  aggregates[variant.id] = {};
  for (const scaleProfile of scales) {
    aggregates[variant.id][scaleProfile] = {};
    for (const window of windows) {
      aggregates[variant.id][scaleProfile][window.id] = aggregate(rows.filter(r =>
        r.variant === variant.id && r.scaleProfile === scaleProfile && r.month >= window.from && r.month <= window.to
      ));
    }
  }
}

const comparison = {};
for (const scaleProfile of scales) {
  const control = aggregates['unit-basis-control'][scaleProfile].FULL;
  const bridge = aggregates['unit-basis-collateral-bridge'][scaleProfile].FULL;
  comparison[scaleProfile] = {
    unemploymentDifference: bridge.meanUnemployment - control.meanUnemployment,
    firmExitDifference: bridge.totalFirmExits - control.totalFirmExits,
    wageArrearsDifference: bridge.meanWageArrears - control.meanWageArrears,
    goodsFulfillmentDifference: bridge.meanGoodsFulfillmentRate - control.meanGoodsFulfillmentRate,
    inputShortageDifference: bridge.meanInputShortageUnits - control.meanInputShortageUnits,
    creditApprovalDifference: bridge.creditApprovalRate - control.creditApprovalRate,
    bridgeSameMonthRepaymentRate: bridge.bridgeSameMonthRepaymentRate
  };
}

const report = {
  schemaVersion: 1,
  kind: 'economic-lab-wp-rv07-p4-working-capital-bridge-ablation',
  frozenEconomicBaseline: '698d10749e2897d711e5bcee61913ac34e0650a0',
  variants: VARIANTS,
  scales,
  seeds,
  months,
  methodology: {
    canonicalMechanismChanges: 0,
    canonicalParameterTuning: 0,
    candidateMerged: false,
    experimentalChanges: ['price-wage initialization basis', 'consumer-firm same-month collateralized payroll bridge'],
    bridgeAdmission: 'Exact payroll cash shortfall after labor/production; limited by current finished-goods market value and existing bank-capital capacity. No fitted haircut or free multiplier.',
    bridgeSettlement: 'Zero-fee causal ablation. Repay principal immediately after household-goods settlement; unpaid remainder becomes an explicit one-month bank loan serviced by existing debt machinery.',
    caution: 'This is a causal upper-bound experiment, not a production-ready credit institution or empirical calibration.'
  },
  determinism,
  runs: runs.map(({ fingerprint, ...rest }) => rest),
  aggregates,
  comparison,
  gates: {
    deterministicReplayExact: determinism.every(x => x.exact),
    allHealthy: runs.every(run => run.health.ok),
    completeCoverage: rows.length === VARIANTS.length * scales.length * seeds.length * months * 4,
    bridgeIssuanceLedgerReconciled: runs.every(run => Math.abs(run.reconciliation.issuanceError) <= 1e-7),
    bridgeRepaymentLedgerReconciled: runs.every(run => Math.abs(run.reconciliation.repaymentError) <= 1e-7),
    bridgeLoansWellFormed: runs.every(run => run.reconciliation.bridgeLoansWellFormed),
    ledgerCountriesOk: runs.every(run => run.reconciliation.ledgerCountriesOk),
    gdpIdentityReconciled: rows.every(r => Math.abs(r.economy.gdpIdentityResidual) <= 1e-6)
  }
};
report.gates.ok = Object.values(report.gates).every(Boolean);

console.table(VARIANTS.flatMap(variant => scales.map(scaleProfile => {
  const a = aggregates[variant.id][scaleProfile].FULL;
  return {
    variant: variant.id,
    scale: scaleProfile,
    unemployment: Number(a.meanUnemployment.toFixed(4)),
    exits: a.totalFirmExits,
    wageArrears: Number(a.meanWageArrears.toFixed(1)),
    goodsFulfillment: Number(a.meanGoodsFulfillmentRate.toFixed(4)),
    bridgeIssued: Number(a.bridgeIssuedAmount.toFixed(1)),
    bridgeRepaidRate: Number(a.bridgeSameMonthRepaymentRate.toFixed(4)),
    maxGdpResidual: Number(a.maxAbsGdpIdentityResidual.toExponential(3))
  };
})));
console.log('WP_RV07_P4_COMPARISON', JSON.stringify(comparison));
console.log('WP_RV07_P4_GATES', JSON.stringify(report.gates));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log('WP_RV07_P4_OUTPUT', outputJson);
}

if (!report.gates.ok) process.exitCode = 1;
