import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const months = Math.max(36, Number(process.env.DIAG_MONTHS || 48));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const EPS = 1e-8;
const TOL = 1e-7;
const F = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const C = v => structuredClone(v);
const S = a => a.reduce((s, v) => s + F(v), 0);
const M = a => a.length ? S(a) / a.length : 0;
const CL = (x, lo, hi) => Math.max(lo, Math.min(hi, F(x)));
const median = a => {
  const x = [...a].filter(Number.isFinite).sort((p, q) => p - q);
  if (!x.length) return 0;
  const m = Math.floor(x.length / 2);
  return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2;
};

function transformedSeeds() {
  return COUNTRY_SEEDS.map(s => ({ ...s, initialPrice: Math.max(EPS, F(s.initialWage, F(s.initialPrice, 1))) }));
}

function makeWorld() {
  const old = COUNTRY_SEEDS.map(C);
  COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...transformedSeeds());
  try {
    return new EconomicWorld(seed, { scaleProfile: 'baseline', healthCheckInterval: 0 });
  } finally {
    COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...old);
  }
}

function supplierMean(c, product) {
  const rows = c.firms.filter(f => f.active !== false && f.product === product && F(f.price) > EPS);
  return rows.length ? M(rows.map(f => f.price)) : 0;
}

function unconstrainedPlan(f) {
  const anchor = Math.max(2, F(f.previousSales), F(f.targetInventory) * 0.42);
  const expected = anchor * (1 + CL(f.beliefs?.demandGrowth || 0, -0.18, 0.22));
  const replenishment = Math.max(0, F(f.targetInventory) - F(f.inventory));
  return Math.max(0, expected * 0.72 + replenishment);
}

function installNormalization(w) {
  const target = new Set(['MATERIALS', 'CONSUMER']);
  const done = new Set();
  w.__wideNorm = 0;
  const original = w.supply.planProduction.bind(w.supply);
  w.supply.planProduction = c => {
    const out = original(c);
    if (done.has(c.id)) return out;
    const prices = {
      raw_material: supplierMean(c, 'raw_material'),
      processed_material: supplierMean(c, 'processed_material')
    };
    for (const f of c.firms.filter(x => x.active !== false && target.has(x.industryId))) {
      const inputCost = F(f.inputPerOutput) * (f.inputProduct ? F(prices[f.inputProduct]) : 0);
      const margin = F(f.price) - inputCost;
      const payroll = F(f.wage) * F(f.workers);
      const baseCapacity = F(f.capacity);
      const required = margin > EPS && baseCapacity > EPS ? payroll / (margin * baseCapacity) : Infinity;
      const factor = Number.isFinite(required) ? Math.max(1, required) : 1;
      if (factor > 1 + TOL) {
        f.productivity *= factor;
        f.capacity = baseCapacity * factor;
        f.desiredProduction = Math.max(0, Math.min(f.capacity * 1.08, unconstrainedPlan(f)));
        w.__wideNorm += 1;
      }
    }
    done.add(c.id);
    return out;
  };
}

function gdpResidual(m) {
  return F(m?.gdp) - (
    F(m?.consumption) + F(m?.grossInvestment) + F(m?.publicInvestment) +
    F(m?.governmentConsumption) + F(m?.inventoryInvestment) + F(m?.netExports)
  );
}

function publicShareRatio(c) {
  const active = c.firms.filter(f => f.active !== false && f.equityMarket);
  const pub = S(active.map(f => F(f.equityMarket?.publicShares)));
  const total = S(active.map(f => F(f.equityMarket?.sharesOutstanding)));
  return total > EPS ? pub / total : 0;
}

function portfolioOwnerShare(c) {
  return c.households.length
    ? c.households.filter(h => Object.keys(h.portfolio || {}).length > 0).length / c.households.length
    : 0;
}

function blankCountry(c) {
  return {
    countryId: c.id,
    months: 0,
    initialBanks: c.banks?.length || 0,
    initialCentralBanks: c.centralBanks?.length || 0,
    maxCommercialBanks: c.banks?.length || 0,
    maxCentralBanks: c.centralBanks?.length || 0,
    uniqueFirmBankIds: new Set(c.firms.map(f => f.bankId).filter(Boolean)),
    uniqueHouseholdBankIds: new Set(c.households.map(h => h.bankId).filter(Boolean)),
    entrants: new Map(),
    capitalUpEvents: 0,
    capitalDownEvents: 0,
    capitalAdded: 0,
    capitalRemoved: 0,
    grossInvestment: 0,
    inactiveCapitalShares: [],
    wageComparisons: 0,
    wageChangeEvents: 0,
    absWageChange: 0,
    priceComparisons: 0,
    priceChangeEvents: 0,
    absPriceChange: 0,
    wagePriceRatios: [],
    separationsToUnemployment: 0,
    reemploymentFromUnemployment: 0,
    directJobToJob: 0,
    entrantDestinationTransitions: 0,
    incumbentDestinationTransitions: 0,
    creditApplications: 0,
    creditApproved: 0,
    creditOriginations: 0,
    creditDefaults: 0,
    newCredit: 0,
    firmCreditOriginations: 0,
    firmCreditAmount: 0,
    householdCreditOriginations: 0,
    householdCreditAmount: 0,
    firmProfit: 0,
    positiveFirmProfit: 0,
    householdNetIncome: 0,
    wageIncome: 0,
    transfers: 0,
    primaryIssuance: 0,
    dividendLikeEntries: 0,
    dividendLikeAmount: 0,
    publicShareRatios: [],
    portfolioOwnerShares: [],
    interfirmTransactions: 0,
    pairCounts: new Map(),
    finalUnemployment: 0,
    finalArrears: 0,
    finalOutput: 0,
    finalGdp: 0,
    finalActiveFirms: 0
  };
}

function entrantSummary(rec, horizon) {
  const age = horizon - rec.birthMonth;
  const activeThrough = k => age >= k ? (rec.exitMonth === null || rec.exitMonth > rec.birthMonth + k) : null;
  const within = (eventMonth, k) => age >= k ? (eventMonth !== null && eventMonth <= rec.birthMonth + k) : null;
  return { ...rec, age, survival3: activeThrough(3), survival6: activeThrough(6), survival12: activeThrough(12), output3: within(rec.firstOutputMonth, 3), output6: within(rec.firstOutputMonth, 6), revenue3: within(rec.firstRevenueMonth, 3), revenue6: within(rec.firstRevenueMonth, 6) };
}

function shareKnown(rows, key) {
  const eligible = rows.filter(r => r[key] !== null);
  return eligible.length ? eligible.filter(r => r[key] === true).length / eligible.length : 0;
}

function eventDelay(rows, key) {
  return rows.filter(r => r[key] !== null).map(r => r[key] - r.birthMonth);
}

const w = makeWorld();
for (const c of w.countries) {
  Object.defineProperty(c, '__diagnosticExactLaborRuntime', { value: true, writable: true, configurable: true, enumerable: false });
}
installNormalization(w);

const stats = new Map(w.countries.map(c => [c.id, blankCountry(c)]));
const initialFirmIds = new Map(w.countries.map(c => [c.id, new Set(c.firms.map(f => f.id))]));
const prevCapital = new Map();
const prevWage = new Map();
const prevPrice = new Map();
const prevEmployer = new Map();

for (const c of w.countries) {
  for (const f of c.firms) {
    prevCapital.set(f.id, F(f.capitalStock));
    prevWage.set(f.id, F(f.wage));
    prevPrice.set(f.id, F(f.price));
  }
  for (const h of c.households) prevEmployer.set(h.id, h.employerId || null);
}

for (let step = 0; step < months; step++) {
  w.stepMonth();
  for (const c of w.countries) {
    const st = stats.get(c.id);
    st.months += 1;
    st.maxCommercialBanks = Math.max(st.maxCommercialBanks, c.banks?.length || 0);
    st.maxCentralBanks = Math.max(st.maxCentralBanks, c.centralBanks?.length || 0);
    for (const f of c.firms) if (f.bankId) st.uniqueFirmBankIds.add(f.bankId);
    for (const h of c.households) if (h.bankId) st.uniqueHouseholdBankIds.add(h.bankId);

    const initial = initialFirmIds.get(c.id);
    for (const f of c.firms) {
      if (!initial.has(f.id) && !st.entrants.has(f.id)) {
        st.entrants.set(f.id, {
          firmId: f.id,
          industryId: f.industryId,
          birthMonth: w.month,
          birthCash: F(w.ledger.balance(f.accountId)),
          birthCapital: F(f.capitalStock),
          birthInventory: F(f.inventory) + S(Object.values(f.inputInventory || {})),
          birthWorkers: F(f.workers),
          birthDesiredWorkers: F(f.desiredWorkers),
          firstHireMonth: F(f.workers) > 0 ? w.month : null,
          firstCapitalMonth: F(f.capitalStock) > EPS ? w.month : null,
          firstCreditMonth: null,
          firstOutputMonth: F(f.output) > EPS ? w.month : null,
          firstRevenueMonth: F(f.revenue) > EPS ? w.month : null,
          exitMonth: f.active === false ? w.month : null
        });
      }

      if (prevCapital.has(f.id)) {
        const before = F(prevCapital.get(f.id));
        const after = F(f.capitalStock);
        const d = after - before;
        if (d > TOL) { st.capitalUpEvents += 1; st.capitalAdded += d; }
        if (d < -TOL) { st.capitalDownEvents += 1; st.capitalRemoved += -d; }
      }
      if (prevWage.has(f.id) && f.active !== false) {
        const before = F(prevWage.get(f.id));
        const after = F(f.wage);
        st.wageComparisons += 1;
        if (Math.abs(after - before) > TOL) {
          st.wageChangeEvents += 1;
          st.absWageChange += Math.abs(after - before) / Math.max(EPS, Math.abs(before));
        }
      }
      if (prevPrice.has(f.id) && f.active !== false) {
        const before = F(prevPrice.get(f.id));
        const after = F(f.price);
        st.priceComparisons += 1;
        if (Math.abs(after - before) > TOL) {
          st.priceChangeEvents += 1;
          st.absPriceChange += Math.abs(after - before) / Math.max(EPS, Math.abs(before));
        }
      }
      prevCapital.set(f.id, F(f.capitalStock));
      prevWage.set(f.id, F(f.wage));
      prevPrice.set(f.id, F(f.price));
    }

    for (const rec of st.entrants.values()) {
      const f = c.firms.find(x => x.id === rec.firmId);
      if (!f) continue;
      if (rec.firstHireMonth === null && F(f.workers) > 0) rec.firstHireMonth = w.month;
      if (rec.firstCapitalMonth === null && F(f.capitalStock) > EPS) rec.firstCapitalMonth = w.month;
      if (rec.firstOutputMonth === null && F(f.output) > EPS) rec.firstOutputMonth = w.month;
      if (rec.firstRevenueMonth === null && F(f.revenue) > EPS) rec.firstRevenueMonth = w.month;
      if (rec.exitMonth === null && f.active === false) rec.exitMonth = w.month;
    }

    for (const h of c.households) {
      const before = prevEmployer.get(h.id) || null;
      const after = h.employerId || null;
      if (before !== after) {
        if (before && !after) st.separationsToUnemployment += 1;
        else if (!before && after) st.reemploymentFromUnemployment += 1;
        else if (before && after) st.directJobToJob += 1;
        if (after) {
          if (st.entrants.has(after)) st.entrantDestinationTransitions += 1;
          else st.incumbentDestinationTransitions += 1;
        }
      }
      prevEmployer.set(h.id, after);
    }

    const entries = w.ledger.entriesFor({ month: w.month, countryId: c.id });
    const firmIds = new Set(c.firms.map(f => f.id));
    const householdIds = new Set(c.households.map(h => h.id));
    for (const e of entries) {
      const kind = String(e.kind || '');
      if (kind === 'bank_loan_origination') {
        st.creditOriginations += 1;
        const borrowerId = e.meta?.borrowerId;
        if (firmIds.has(borrowerId)) { st.firmCreditOriginations += 1; st.firmCreditAmount += F(e.amount); }
        else if (householdIds.has(borrowerId)) { st.householdCreditOriginations += 1; st.householdCreditAmount += F(e.amount); }
        const rec = st.entrants.get(borrowerId);
        if (rec && rec.firstCreditMonth === null) rec.firstCreditMonth = w.month;
      }
      if (/dividend|profit[_-]?distribution|owner[_-]?distribution/i.test(kind)) {
        st.dividendLikeEntries += 1;
        st.dividendLikeAmount += F(e.amount);
      }
      if (kind === 'interfirm_purchase') {
        st.interfirmTransactions += 1;
        const buyer = e.meta?.buyerId || '?';
        const seller = e.meta?.sellerId || '?';
        const key = `${buyer}->${seller}`;
        st.pairCounts.set(key, (st.pairCounts.get(key) || 0) + 1);
      }
    }

    const m = c.macro || {};
    const credit = c.lastCredit || {};
    const asset = c.lastAssetMarket || {};
    st.creditApplications += F(credit.applications);
    st.creditApproved += F(credit.approved);
    st.creditDefaults += F(credit.defaults);
    st.newCredit += F(credit.newCredit);
    st.grossInvestment += F(m.grossInvestment);
    st.firmProfit += F(m.firmProfit);
    st.positiveFirmProfit += Math.max(0, F(m.firmProfit));
    st.householdNetIncome += F(m.householdNetIncome);
    st.wageIncome += F(m.wageBill);
    st.transfers += F(m.governmentTransfers);
    st.primaryIssuance += F(asset.primaryIssuance);
    st.publicShareRatios.push(publicShareRatio(c));
    st.portfolioOwnerShares.push(portfolioOwnerShare(c));

    const active = c.firms.filter(f => f.active !== false);
    const consumers = active.filter(f => f.consumerFacing === true);
    const avgFirmWage = M(active.map(f => F(f.wage)));
    const avgConsumerPrice = M(consumers.map(f => F(f.price)));
    if (avgConsumerPrice > EPS) st.wagePriceRatios.push(avgFirmWage / avgConsumerPrice);
    const activeCapital = S(active.map(f => F(f.capitalStock)));
    const inactiveCapital = S(c.firms.filter(f => f.active === false).map(f => F(f.capitalStock)));
    const totalCapital = activeCapital + inactiveCapital;
    st.inactiveCapitalShares.push(totalCapital > EPS ? inactiveCapital / totalCapital : 0);

    st.finalUnemployment = F(m.unemployment);
    st.finalArrears = F(m.wageArrears);
    st.finalOutput = F(m.realOutput);
    st.finalGdp = F(m.gdp);
    st.finalActiveFirms = F(m.activeFirms, active.length);
  }
}

const health = w.forceHealthCheck();
const accountingOk = w.countries.every(c => w.accounting.verifyCountry(c, w.ledger, w.month)?.ok !== false);
const ledgerOk = w.countries.every(c => w.ledger.verifyCountry(c.id)?.ok === true);
const gdpOk = w.countries.every(c => Math.abs(gdpResidual(c.macro)) < 1e-5);
assert.ok(accountingOk && ledgerOk && gdpOk, `${seed}: accounting/ledger/GDP gate`);

const countries = [];
for (const c of w.countries) {
  const st = stats.get(c.id);
  const entrants = [...st.entrants.values()].map(r => entrantSummary(r, months));
  const repeatedTransactions = S([...st.pairCounts.values()].map(n => Math.max(0, n - 1)));
  const hireDelays = eventDelay(entrants, 'firstHireMonth');
  const capitalDelays = eventDelay(entrants, 'firstCapitalMonth');
  const creditDelays = eventDelay(entrants, 'firstCreditMonth');
  const outputDelays = eventDelay(entrants, 'firstOutputMonth');
  const revenueDelays = eventDelay(entrants, 'firstRevenueMonth');
  countries.push({
    countryId: c.id,
    entrantLifecycle: {
      entrants: entrants.length,
      bornZeroCashShare: entrants.length ? entrants.filter(r => r.birthCash <= EPS).length / entrants.length : 0,
      bornZeroCapitalShare: entrants.length ? entrants.filter(r => r.birthCapital <= EPS).length / entrants.length : 0,
      bornZeroInventoryShare: entrants.length ? entrants.filter(r => r.birthInventory <= EPS).length / entrants.length : 0,
      bornZeroWorkersShare: entrants.length ? entrants.filter(r => r.birthWorkers <= EPS).length / entrants.length : 0,
      survival3: shareKnown(entrants, 'survival3'),
      survival6: shareKnown(entrants, 'survival6'),
      survival12: shareKnown(entrants, 'survival12'),
      outputWithin3: shareKnown(entrants, 'output3'),
      outputWithin6: shareKnown(entrants, 'output6'),
      revenueWithin3: shareKnown(entrants, 'revenue3'),
      revenueWithin6: shareKnown(entrants, 'revenue6'),
      medianFirstHireMonths: median(hireDelays),
      medianFirstCapitalMonths: median(capitalDelays),
      medianFirstCreditMonths: median(creditDelays),
      medianFirstOutputMonths: median(outputDelays),
      medianFirstRevenueMonths: median(revenueDelays),
      neverHiredShare: entrants.length ? entrants.filter(r => r.firstHireMonth === null).length / entrants.length : 0,
      neverCapitalizedShare: entrants.length ? entrants.filter(r => r.firstCapitalMonth === null).length / entrants.length : 0,
      neverProducedShare: entrants.length ? entrants.filter(r => r.firstOutputMonth === null).length / entrants.length : 0,
      neverEarnedRevenueShare: entrants.length ? entrants.filter(r => r.firstRevenueMonth === null).length / entrants.length : 0
    },
    circularFlow: {
      firmProfit: st.firmProfit,
      positiveFirmProfit: st.positiveFirmProfit,
      householdNetIncome: st.householdNetIncome,
      wageIncome: st.wageIncome,
      transfers: st.transfers,
      primaryIssuance: st.primaryIssuance,
      dividendLikeEntries: st.dividendLikeEntries,
      dividendLikeAmount: st.dividendLikeAmount,
      dividendToPositiveProfitRatio: st.positiveFirmProfit > EPS ? st.dividendLikeAmount / st.positiveFirmProfit : 0,
      meanPublicShareRatio: M(st.publicShareRatios),
      terminalPublicShareRatio: st.publicShareRatios.at(-1) || 0,
      meanPortfolioOwnerShare: M(st.portfolioOwnerShares),
      terminalPortfolioOwnerShare: st.portfolioOwnerShares.at(-1) || 0
    },
    capitalLifecycle: {
      grossInvestment: st.grossInvestment,
      capitalUpEvents: st.capitalUpEvents,
      capitalDownEvents: st.capitalDownEvents,
      capitalAdded: st.capitalAdded,
      capitalRemoved: st.capitalRemoved,
      capitalRemovalToAdditionRatio: st.capitalAdded > EPS ? st.capitalRemoved / st.capitalAdded : 0,
      meanInactiveCapitalShare: M(st.inactiveCapitalShares),
      terminalInactiveCapitalShare: st.inactiveCapitalShares.at(-1) || 0
    },
    bankingArchitecture: {
      initialBanks: st.initialBanks,
      maxBanks: st.maxCommercialBanks,
      initialCentralBanks: st.initialCentralBanks,
      maxCentralBanks: st.maxCentralBanks,
      uniqueFirmBankIds: st.uniqueFirmBankIds.size,
      uniqueHouseholdBankIds: st.uniqueHouseholdBankIds.size,
      applications: st.creditApplications,
      approved: st.creditApproved,
      approvalRate: st.creditApplications > EPS ? st.creditApproved / st.creditApplications : 0,
      originations: st.creditOriginations,
      newCredit: st.newCredit,
      defaults: st.creditDefaults,
      firmOriginations: st.firmCreditOriginations,
      firmOriginationAmount: st.firmCreditAmount,
      householdOriginations: st.householdCreditOriginations,
      householdOriginationAmount: st.householdCreditAmount
    },
    laborReallocation: {
      separationsToUnemployment: st.separationsToUnemployment,
      reemploymentFromUnemployment: st.reemploymentFromUnemployment,
      directJobToJob: st.directJobToJob,
      entrantDestinationTransitions: st.entrantDestinationTransitions,
      incumbentDestinationTransitions: st.incumbentDestinationTransitions,
      directJobToJobShareOfEmployerChanges: (st.separationsToUnemployment + st.reemploymentFromUnemployment + st.directJobToJob) > 0
        ? st.directJobToJob / (st.separationsToUnemployment + st.reemploymentFromUnemployment + st.directJobToJob)
        : 0,
      entrantDestinationShare: (st.entrantDestinationTransitions + st.incumbentDestinationTransitions) > 0
        ? st.entrantDestinationTransitions / (st.entrantDestinationTransitions + st.incumbentDestinationTransitions)
        : 0
    },
    priceWageAdjustment: {
      wageComparisons: st.wageComparisons,
      wageChangeEvents: st.wageChangeEvents,
      wageChangeShare: st.wageComparisons ? st.wageChangeEvents / st.wageComparisons : 0,
      meanAbsWageChangeWhenChanged: st.wageChangeEvents ? st.absWageChange / st.wageChangeEvents : 0,
      priceComparisons: st.priceComparisons,
      priceChangeEvents: st.priceChangeEvents,
      priceChangeShare: st.priceComparisons ? st.priceChangeEvents / st.priceComparisons : 0,
      meanAbsPriceChangeWhenChanged: st.priceChangeEvents ? st.absPriceChange / st.priceChangeEvents : 0,
      initialWagePriceRatio: st.wagePriceRatios[0] || 0,
      terminalWagePriceRatio: st.wagePriceRatios.at(-1) || 0
    },
    supplyNetwork: {
      interfirmTransactions: st.interfirmTransactions,
      uniqueBuyerSellerPairs: st.pairCounts.size,
      repeatedTransactionShare: st.interfirmTransactions ? repeatedTransactions / st.interfirmTransactions : 0
    },
    macroTerminal: {
      unemployment: st.finalUnemployment,
      wageArrears: st.finalArrears,
      output: st.finalOutput,
      gdp: st.finalGdp,
      activeFirms: st.finalActiveFirms
    }
  });
}

function finiteTree(x) {
  if (typeof x === 'number') return Number.isFinite(x);
  if (Array.isArray(x)) return x.every(finiteTree);
  if (x && typeof x === 'object') return Object.values(x).every(finiteTree);
  return true;
}

const report = {
  workPackage: 'WP-RV08-R4-BF-BK',
  title: 'Economic Ecosystem Lifecycle Wide Sweep',
  generatedAt: new Date().toISOString(),
  note: 'Observational multi-axis diagnostic under established MATERIALS+CONSUMER normalization. No canonical repair or tuning.',
  configuration: { seed, months, base: 'materials-consumer' },
  gates: {
    healthOk: health.ok,
    accountingOk,
    ledgerOk,
    gdpIdentityArithmetic: gdpOk,
    normalizationActivated: w.__wideNorm > 0,
    completeMonths: countries.every(() => w.month === months),
    finiteMetrics: finiteTree(countries),
    ok: health.ok && accountingOk && ledgerOk && gdpOk && w.__wideNorm > 0 && finiteTree(countries)
  },
  countries
};
assert.ok(report.gates.ok, `${seed}: R4-BF-BK hard gate`);

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
