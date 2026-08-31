import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SupplyChainSystem } from '../industry/supply-chain.js';
import { setGoodsMarketDiagnosticObserver } from '../markets/goods-market.js';

const EPS = 1e-9;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = (values) => values.reduce((total, value) => total + finite(value), 0);
const safeRatio = (numerator, denominator, fallback = null) =>
  Math.abs(finite(denominator)) > EPS ? finite(numerator) / finite(denominator) : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, finite(value)));

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
  const finiteValues = values.map((value) => Number(value)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!finiteValues.length) {
    return { count: 0, min: null, p25: null, median: null, p75: null, max: null, mean: null };
  }
  return {
    count: finiteValues.length,
    min: finiteValues[0],
    p25: percentile(finiteValues, 0.25),
    median: percentile(finiteValues, 0.5),
    p75: percentile(finiteValues, 0.75),
    max: finiteValues.at(-1),
    mean: sum(finiteValues) / finiteValues.length
  };
}

function activeFirms(country) {
  return (country.firms || []).filter((firm) => firm.active !== false);
}

function inputUnits(firm) {
  return Object.values(firm.inputInventory || {}).reduce((total, value) => total + Math.max(0, finite(value)), 0);
}

function naturalBalance(supply, entityId, account) {
  return finite(supply.accounting.gl.naturalBalance(entityId, account));
}

function currentJournals(supply, entityId, month) {
  const entity = supply.accounting.gl.entities.get(entityId);
  return (entity?.journals || []).filter((journal) =>
    Number(journal.month) === Number(month) && journal.kind !== 'period_close'
  );
}

function journalAmount(journals, account, side, kind = null) {
  return sum(journals
    .filter((journal) => kind === null || journal.kind === kind)
    .flatMap((journal) => journal.lines || [])
    .filter((line) => line.account === account)
    .map((line) => line[side]));
}

function derivedMonth(country) {
  const previous = country.history?.at(-1)?.month;
  return Math.max(1, Math.round(finite(previous, 0) + 1));
}

function rowKey(countryId, month) {
  return `${countryId}@@${month}`;
}

function candidateIdFromCountry(country) {
  const ids = new Set((country.firms || [])
    .map((firm) => firm?.__r4CuD3dB6?.candidateId)
    .filter(Boolean));
  assert.ok(ids.size <= 1, `Multiple B6 candidates observed in ${country.id}: ${[...ids].join(', ')}`);
  return [...ids][0] || null;
}

function sectorAccumulator() {
  return {
    firms: 0,
    buyers: 0,
    consumerFirms: 0,
    openingInventoryUnits: 0,
    openingInventoryBook: 0,
    targetInventoryUnits: 0,
    previousSalesUnits: 0,
    desiredProductionUnits: 0,
    capacityUnits: 0,
    plannedInputNeedUnits: 0,
    purchasedInputUnits: 0,
    inputShortageUnits: 0,
    topologyAttributedShortageUnits: 0,
    cashAttributedShortageUnits: 0,
    searchExecutionAttributedShortageUnits: 0,
    outputUnits: 0,
    salesUnits: 0,
    revenue: 0,
    closingInventoryUnits: 0,
    closingInventoryBook: 0,
    inventoryAboveTargetUnits: 0,
    salesRevenueBook: 0,
    cogsBook: 0,
    inputConsumptionBook: 0,
    labourCompensationAccrued: 0,
    gvaBasicProduction: 0
  };
}

function addSector(map, industryId, fields) {
  const key = String(industryId || 'UNKNOWN');
  const target = map[key] || (map[key] = sectorAccumulator());
  for (const [field, value] of Object.entries(fields)) target[field] = finite(target[field]) + finite(value);
  return target;
}

function supplierEnvelope(suppliers, buyer, needUnits, cashBudget) {
  const eligible = (suppliers || [])
    .filter((seller) => seller.active !== false && seller.id !== buyer.id && finite(seller.inventory) > EPS)
    .slice()
    .sort((a, b) => finite(a.price) - finite(b.price) || a.id.localeCompare(b.id));
  const inventories = eligible.map((seller) => Math.max(0, finite(seller.inventory)));
  const totalStock = sum(inventories);
  const totalValue = sum(eligible.map((seller) => Math.max(0, finite(seller.inventory)) * Math.max(0.01, finite(seller.price, 0.01))));
  const shares = totalStock > EPS ? inventories.map((value) => value / totalStock) : [];
  const hhi = shares.length ? sum(shares.map((share) => share * share)) : null;
  const topShare = shares.length ? Math.max(...shares) : null;
  const cheapestPrice = eligible.length ? Math.max(0.01, finite(eligible[0].price, 0.01)) : null;
  const inventoryWeightedPrice = totalStock > EPS
    ? sum(eligible.map((seller) => finite(seller.inventory) * Math.max(0.01, finite(seller.price, 0.01)))) / totalStock
    : null;

  let unitsForFill = Math.max(0, finite(needUnits));
  let estimatedFillCost = 0;
  for (const seller of eligible) {
    if (unitsForFill <= EPS) break;
    const units = Math.min(unitsForFill, Math.max(0, finite(seller.inventory)));
    estimatedFillCost += units * Math.max(0.01, finite(seller.price, 0.01));
    unitsForFill -= units;
  }

  let budgetRemaining = Math.max(0, finite(cashBudget));
  let needRemaining = Math.max(0, finite(needUnits));
  let purchasableUnits = 0;
  for (const seller of eligible) {
    if (budgetRemaining <= EPS || needRemaining <= EPS) break;
    const price = Math.max(0.01, finite(seller.price, 0.01));
    const units = Math.min(
      needRemaining,
      Math.max(0, finite(seller.inventory)),
      budgetRemaining / price
    );
    if (units <= EPS) continue;
    purchasableUnits += units;
    needRemaining -= units;
    budgetRemaining -= units * price;
  }

  return {
    supplierCount: eligible.length,
    totalStock,
    totalValue,
    hhi,
    topShare,
    cheapestPrice,
    inventoryWeightedPrice,
    estimatedFillCost,
    purchasableUnits
  };
}

function aggregateOpening(supply, firms) {
  return {
    activeFirms: firms.length,
    buyerFirms: firms.filter((firm) => Boolean(firm.inputProduct)).length,
    consumerFirms: firms.filter((firm) => firm.consumerFacing === true).length,
    finishedInventoryUnits: sum(firms.map((firm) => firm.inventory)),
    finishedInventoryBook: sum(firms.map((firm) => naturalBalance(supply, firm.id, 'inventory'))),
    inputInventoryUnits: sum(firms.map(inputUnits)),
    inputInventoryBook: sum(firms.map((firm) => naturalBalance(supply, firm.id, 'input_inventory'))),
    targetInventoryUnits: sum(firms.map((firm) => firm.targetInventory)),
    previousSalesUnits: sum(firms.map((firm) => firm.previousSales)),
    firmCash: sum(firms.map((firm) => supply.ledger.balance(firm.accountId))),
    prices: statistics(firms.map((firm) => firm.price)),
    bookUnitCosts: statistics(firms.map((firm) => firm.bookUnitCost))
  };
}

function publicRow(row) {
  const output = {};
  for (const [key, value] of Object.entries(row)) {
    if (!key.startsWith('_')) output[key] = value;
  }
  return output;
}

function summarizeRows(rows) {
  const procurementNeed = sum(rows.map((row) => row.procurement?.plannedInputNeedUnits));
  const procurementShortage = sum(rows.map((row) => row.procurement?.inputShortageUnits));
  const desired = sum(rows.map((row) => row.plan?.desiredProductionUnits));
  const output = sum(rows.map((row) => row.production?.outputUnits));
  const sales = sum(rows.map((row) => row.closing?.salesUnits));
  const goodsDesired = sum(rows.map((row) => row.goods?.desiredBudget));
  const goodsConsumption = sum(rows.map((row) => row.goods?.nominalConsumption));
  const gva = sum(rows.map((row) => row.closing?.gvaBasicProduction));
  const labour = sum(rows.map((row) => row.closing?.labourCompensationAccrued));
  const totalTarget = sum(rows.map((row) => row.closing?.targetInventoryUnits));
  const aboveTarget = sum(rows.map((row) => row.closing?.inventoryAboveTargetUnits));
  const totalSalesRevenue = sum(rows.map((row) => row.closing?.salesRevenueBook));
  const belowCostRevenue = sum(rows.map((row) => row.closing?.salesRevenueAtOrBelowBookCost));
  return {
    countryMonths: rows.length,
    plannedProductionUnits: desired,
    outputUnits: output,
    salesUnits: sales,
    planRealizationRatio: safeRatio(output, desired, 1),
    salesToPlanRatio: safeRatio(sales, desired, 1),
    plannedInputNeedUnits: procurementNeed,
    purchasedInputUnits: sum(rows.map((row) => row.procurement?.purchasedInputUnits)),
    inputShortageUnits: procurementShortage,
    inputShortageRate: safeRatio(procurementShortage, procurementNeed, 0),
    topologyAttributedShortageUnits: sum(rows.map((row) => row.procurement?.topologyAttributedShortageUnits)),
    cashAttributedShortageUnits: sum(rows.map((row) => row.procurement?.cashAttributedShortageUnits)),
    searchExecutionAttributedShortageUnits: sum(rows.map((row) => row.procurement?.searchExecutionAttributedShortageUnits)),
    goodsDesiredBudget: goodsDesired,
    goodsConsumption: goodsConsumption,
    goodsUnmetBudget: sum(rows.map((row) => row.goods?.unmetBudget)),
    goodsFulfillmentRatio: safeRatio(goodsConsumption, goodsDesired, 1),
    goodsUnmetWithEndingInventory: sum(rows.map((row) =>
      finite(row.goods?.endInventoryUnits) > EPS ? finite(row.goods?.unmetBudget) : 0
    )),
    targetInventoryUnits: totalTarget,
    inventoryAboveTargetUnits: aboveTarget,
    inventoryAboveTargetRatio: safeRatio(aboveTarget, totalTarget, 0),
    gvaBasicProduction: gva,
    labourCompensationAccrued: labour,
    labourShareOfPositiveAggregateGva: gva > EPS ? labour / gva : null,
    nonPositiveGvaCountryMonthShare: safeRatio(rows.filter((row) => finite(row.closing?.gvaBasicProduction) <= EPS).length, rows.length, 0),
    salesRevenueBook: totalSalesRevenue,
    salesRevenueAtOrBelowBookCost: belowCostRevenue,
    belowCostRevenueShare: safeRatio(belowCostRevenue, totalSalesRevenue, 0),
    priceToBookUnitCost: statistics(rows.map((row) => row.closing?.priceToBookUnitCost?.median).filter(Number.isFinite)),
    compatibleSupplierCount: statistics(rows.map((row) => row.procurement?.compatibleSupplierCount?.median).filter(Number.isFinite)),
    supplierStockCoverage: statistics(rows.map((row) => row.procurement?.supplierStockCoverage?.median).filter(Number.isFinite)),
    procurementCashCoverage: statistics(rows.map((row) => row.procurement?.cashCoverage?.median).filter(Number.isFinite)),
    activeFirms: statistics(rows.map((row) => row.closing?.activeFirms)),
    sourceGoodsFulfillment: statistics(rows.map((row) => row.sourceMacro?.goodsFulfillmentRatio).filter(Number.isFinite)),
    sourceUnemployment: statistics(rows.map((row) => row.sourceMacro?.unemployment).filter(Number.isFinite))
  };
}

export function installB7DemandInventoryTopologyObserver({ expectedCandidateId = null } = {}) {
  const originals = {
    beginMonth: SupplyChainSystem.prototype.beginMonth,
    planProduction: SupplyChainSystem.prototype.planProduction,
    procureInputs: SupplyChainSystem.prototype.procureInputs,
    produce: SupplyChainSystem.prototype.produce,
    finalizeMetrics: SupplyChainSystem.prototype.finalizeMetrics
  };
  const stateBySupply = new WeakMap();
  const states = [];
  const latestStateByCountry = new Map();
  let restored = false;

  function stateFor(supply, country) {
    let state = stateBySupply.get(supply);
    if (!state) {
      state = {
        candidateId: candidateIdFromCountry(country),
        rows: new Map(),
        countries: new Set()
      };
      if (expectedCandidateId) assert.equal(state.candidateId, expectedCandidateId, 'B7 observer candidate mismatch');
      stateBySupply.set(supply, state);
      states.push(state);
    }
    const observedCandidate = candidateIdFromCountry(country);
    if (observedCandidate) {
      if (state.candidateId === null) state.candidateId = observedCandidate;
      assert.equal(observedCandidate, state.candidateId, 'B7 observer candidate changed inside a replay');
    }
    state.countries.add(country.id);
    return state;
  }

  function rowFor(state, country, month) {
    const key = rowKey(country.id, month);
    let row = state.rows.get(key);
    if (!row) {
      row = {
        candidateId: state.candidateId,
        countryId: country.id,
        month,
        stages: {
          began: false,
          planned: false,
          procured: false,
          produced: false,
          goodsObserved: false,
          finalized: false
        },
        sector: {}
      };
      state.rows.set(key, row);
    }
    return row;
  }

  SupplyChainSystem.prototype.beginMonth = function b7BeginMonth(country, ...args) {
    const result = originals.beginMonth.call(this, country, ...args);
    const state = stateFor(this, country);
    const month = derivedMonth(country);
    const row = rowFor(state, country, month);
    assert.equal(row.stages.began, false, `${country.id}/${month}: duplicate B7 begin`);
    const firms = activeFirms(country);
    row._openingFirms = new Map(firms.map((firm) => [firm.id, {
      id: firm.id,
      industryId: firm.industryId,
      product: firm.product,
      inputProduct: firm.inputProduct,
      openingInventory: Math.max(0, finite(firm.inventory)),
      openingInventoryBook: naturalBalance(this, firm.id, 'inventory'),
      openingInputUnits: inputUnits(firm),
      openingInputBook: naturalBalance(this, firm.id, 'input_inventory'),
      targetInventory: Math.max(0, finite(firm.targetInventory)),
      previousSales: Math.max(0, finite(firm.previousSales)),
      price: Math.max(0, finite(firm.price)),
      bookUnitCost: Math.max(0, finite(firm.bookUnitCost)),
      cash: this.ledger.balance(firm.accountId)
    }]));
    row.opening = aggregateOpening(this, firms);
    for (const firm of firms) {
      addSector(row.sector, firm.industryId, {
        firms: 1,
        buyers: firm.inputProduct ? 1 : 0,
        consumerFirms: firm.consumerFacing === true ? 1 : 0,
        openingInventoryUnits: firm.inventory,
        openingInventoryBook: naturalBalance(this, firm.id, 'inventory'),
        targetInventoryUnits: firm.targetInventory,
        previousSalesUnits: firm.previousSales
      });
    }
    row.stages.began = true;
    latestStateByCountry.set(country.id, state);
    return result;
  };

  SupplyChainSystem.prototype.planProduction = function b7PlanProduction(country, ...args) {
    const result = originals.planProduction.call(this, country, ...args);
    const state = stateFor(this, country);
    const month = derivedMonth(country);
    const row = rowFor(state, country, month);
    assert.equal(row.stages.began, true, `${country.id}/${month}: plan before begin`);
    assert.equal(row.stages.planned, false, `${country.id}/${month}: duplicate plan`);
    const firms = activeFirms(country);
    const planByFirm = new Map();
    const desired = [];
    const capacities = [];
    const planToPrior = [];
    let demandAnchorUnits = 0;
    let expectedDemandUnits = 0;
    let replenishmentUnits = 0;
    let capacityGapUnits = 0;

    for (const firm of firms) {
      const opening = row._openingFirms.get(firm.id);
      assert.ok(opening, `${country.id}/${month}/${firm.id}: missing opening snapshot`);
      const demandAnchor = Math.max(2, finite(opening.previousSales), finite(opening.targetInventory) * 0.42);
      const expectedDemand = demandAnchor * (1 + clamp(firm.beliefs?.demandGrowth || 0, -0.18, 0.22));
      const replenishment = Math.max(0, finite(opening.targetInventory) - finite(opening.openingInventory));
      const desiredProduction = Math.max(0, finite(firm.desiredProduction));
      const capacity = Math.max(0, finite(firm.capacity));
      const capacityGap = Math.max(0, desiredProduction - capacity);
      planByFirm.set(firm.id, {
        desiredProduction,
        capacity,
        demandAnchor,
        expectedDemand,
        replenishment,
        capacityGap
      });
      desired.push(desiredProduction);
      capacities.push(capacity);
      if (opening.previousSales > EPS) planToPrior.push(desiredProduction / opening.previousSales);
      demandAnchorUnits += demandAnchor;
      expectedDemandUnits += expectedDemand;
      replenishmentUnits += replenishment;
      capacityGapUnits += capacityGap;
      addSector(row.sector, firm.industryId, {
        desiredProductionUnits: desiredProduction,
        capacityUnits: capacity
      });
    }

    row._planByFirm = planByFirm;
    row.plan = {
      firmCount: firms.length,
      desiredProductionUnits: sum(desired),
      capacityUnits: sum(capacities),
      demandAnchorUnits,
      expectedDemandUnits,
      replenishmentUnits,
      capacityGapUnits,
      planToPriorSales: statistics(planToPrior),
      desiredProduction: statistics(desired),
      capacity: statistics(capacities)
    };
    row.stages.planned = true;
    return result;
  };

  SupplyChainSystem.prototype.procureInputs = function b7ProcureInputs(country, month, ...args) {
    const state = stateFor(this, country);
    const row = rowFor(state, country, month);
    assert.equal(row.stages.planned, true, `${country.id}/${month}: procurement before plan`);
    assert.equal(row.stages.procured, false, `${country.id}/${month}: duplicate procurement`);
    const firms = activeFirms(country);
    const suppliersByProduct = new Map();
    for (const seller of firms) {
      if (!suppliersByProduct.has(seller.product)) suppliersByProduct.set(seller.product, []);
      suppliersByProduct.get(seller.product).push(seller);
    }

    const buyerPre = new Map();
    for (const buyer of firms.filter((firm) => Boolean(firm.inputProduct))) {
      const plan = row._planByFirm.get(buyer.id);
      assert.ok(plan, `${country.id}/${month}/${buyer.id}: missing plan snapshot`);
      const requiredUnits = Math.max(0, plan.desiredProduction * Math.max(0, finite(buyer.inputPerOutput)));
      const onHandUnits = Math.max(0, finite(buyer.inputInventory?.[buyer.inputProduct]));
      const needUnits = Math.max(0, requiredUnits - onHandUnits);
      const cash = this.ledger.balance(buyer.accountId);
      const cashBudget = Math.max(0, cash * 0.42);
      const envelope = supplierEnvelope(suppliersByProduct.get(buyer.inputProduct) || [], buyer, needUnits, cashBudget);
      buyerPre.set(buyer.id, {
        buyerId: buyer.id,
        industryId: buyer.industryId,
        product: buyer.inputProduct,
        requiredUnits,
        onHandUnits,
        needUnits,
        cash,
        cashBudget,
        ...envelope
      });
    }
    row._buyerPre = buyerPre;

    const result = originals.procureInputs.call(this, country, month, ...args);
    const entries = this.ledger.entriesFor({ month, countryId: country.id })
      .filter((entry) => entry.kind === 'interfirm_purchase');
    const purchasedByBuyer = new Map();
    for (const entry of entries) {
      const buyerId = String(entry.meta?.buyerId || '');
      if (!purchasedByBuyer.has(buyerId)) purchasedByBuyer.set(buyerId, { units: 0, spend: 0, sellers: new Map() });
      const target = purchasedByBuyer.get(buyerId);
      const units = Math.max(0, finite(entry.meta?.units, finite(entry.amount)));
      target.units += units;
      target.spend += Math.max(0, finite(entry.amount));
      const sellerId = String(entry.meta?.sellerId || '');
      target.sellers.set(sellerId, (target.sellers.get(sellerId) || 0) + units);
    }

    const supplierCounts = [];
    const stockCoverages = [];
    const cashCoverages = [];
    const hhis = [];
    const topShares = [];
    const cheapestPrices = [];
    let positiveNeedBuyers = 0;
    let zeroSupplierBuyers = 0;
    let plannedInputNeedUnits = 0;
    let purchasedInputUnits = 0;
    let inputShortageUnits = 0;
    let purchaseSpend = 0;
    let cashBudget = 0;
    let estimatedFillCost = 0;
    let topologyAttributedShortageUnits = 0;
    let cashAttributedShortageUnits = 0;
    let searchExecutionAttributedShortageUnits = 0;
    let distinctSupplierLinks = 0;

    for (const buyer of firms.filter((firm) => Boolean(firm.inputProduct))) {
      const pre = buyerPre.get(buyer.id);
      const purchase = purchasedByBuyer.get(buyer.id) || { units: 0, spend: 0, sellers: new Map() };
      const shortage = Math.max(0, finite(buyer.supplyShortage));
      const topologyGap = Math.max(0, pre.needUnits - pre.totalStock);
      const cashGap = Math.max(0, Math.min(pre.needUnits, pre.totalStock) - pre.purchasableUnits);
      const topologyAttributed = Math.min(shortage, topologyGap);
      const afterTopology = Math.max(0, shortage - topologyAttributed);
      const cashAttributed = Math.min(afterTopology, cashGap);
      const searchExecutionAttributed = Math.max(0, afterTopology - cashAttributed);

      if (pre.needUnits > EPS) {
        positiveNeedBuyers += 1;
        if (pre.supplierCount === 0) zeroSupplierBuyers += 1;
        supplierCounts.push(pre.supplierCount);
        stockCoverages.push(pre.totalStock / pre.needUnits);
        cashCoverages.push(pre.estimatedFillCost > EPS ? pre.cashBudget / pre.estimatedFillCost : 0);
        if (Number.isFinite(pre.hhi)) hhis.push(pre.hhi);
        if (Number.isFinite(pre.topShare)) topShares.push(pre.topShare);
        if (Number.isFinite(pre.cheapestPrice)) cheapestPrices.push(pre.cheapestPrice);
      }

      plannedInputNeedUnits += pre.needUnits;
      purchasedInputUnits += purchase.units;
      inputShortageUnits += shortage;
      purchaseSpend += purchase.spend;
      cashBudget += pre.cashBudget;
      estimatedFillCost += pre.estimatedFillCost;
      topologyAttributedShortageUnits += topologyAttributed;
      cashAttributedShortageUnits += cashAttributed;
      searchExecutionAttributedShortageUnits += searchExecutionAttributed;
      distinctSupplierLinks += purchase.sellers.size;

      addSector(row.sector, buyer.industryId, {
        plannedInputNeedUnits: pre.needUnits,
        purchasedInputUnits: purchase.units,
        inputShortageUnits: shortage,
        topologyAttributedShortageUnits: topologyAttributed,
        cashAttributedShortageUnits: cashAttributed,
        searchExecutionAttributedShortageUnits: searchExecutionAttributed
      });
    }

    const attributedTotal = topologyAttributedShortageUnits + cashAttributedShortageUnits + searchExecutionAttributedShortageUnits;
    assert.ok(Math.abs(attributedTotal - inputShortageUnits) <= 1e-7 * Math.max(1, inputShortageUnits),
      `${country.id}/${month}: B7 shortage attribution does not reconcile`);

    row.procurement = {
      buyerCount: buyerPre.size,
      positiveNeedBuyers,
      zeroSupplierBuyers,
      zeroSupplierBuyerShare: safeRatio(zeroSupplierBuyers, positiveNeedBuyers, 0),
      plannedInputNeedUnits,
      purchasedInputUnits,
      inputShortageUnits,
      purchaseSpend,
      cashBudget,
      estimatedFillCost,
      fillRate: safeRatio(purchasedInputUnits, plannedInputNeedUnits, 1),
      shortageRate: safeRatio(inputShortageUnits, plannedInputNeedUnits, 0),
      budgetUtilization: safeRatio(purchaseSpend, cashBudget, 0),
      topologyAttributedShortageUnits,
      cashAttributedShortageUnits,
      searchExecutionAttributedShortageUnits,
      topologyShareOfShortage: safeRatio(topologyAttributedShortageUnits, inputShortageUnits, 0),
      cashShareOfShortage: safeRatio(cashAttributedShortageUnits, inputShortageUnits, 0),
      searchExecutionShareOfShortage: safeRatio(searchExecutionAttributedShortageUnits, inputShortageUnits, 0),
      distinctSupplierLinks,
      compatibleSupplierCount: statistics(supplierCounts),
      supplierStockCoverage: statistics(stockCoverages),
      cashCoverage: statistics(cashCoverages),
      supplierInventoryHhi: statistics(hhis),
      topSupplierInventoryShare: statistics(topShares),
      cheapestSupplierPrice: statistics(cheapestPrices)
    };
    row.stages.procured = true;
    return result;
  };

  SupplyChainSystem.prototype.produce = function b7Produce(country, month, metrics, ...args) {
    const state = stateFor(this, country);
    const row = rowFor(state, country, month);
    assert.equal(row.stages.procured, true, `${country.id}/${month}: production before procurement`);
    assert.equal(row.stages.produced, false, `${country.id}/${month}: duplicate production`);
    const firms = activeFirms(country);
    const preInput = new Map(firms.map((firm) => [firm.id, inputUnits(firm)]));
    const result = originals.produce.call(this, country, month, metrics, ...args);

    let desiredProductionUnits = 0;
    let potentialOutputUnits = 0;
    let outputUnits = 0;
    let capacityGapUnits = 0;
    let inputConstraintGapUnits = 0;
    let residualGapUnits = 0;
    let inputConsumedUnits = 0;
    const planRealization = [];
    const potentialRealization = [];

    for (const firm of firms) {
      const desired = Math.max(0, finite(firm.desiredProduction));
      const capacity = Math.max(0, finite(firm.capacity));
      const potential = Math.min(desired, capacity);
      const output = Math.max(0, finite(firm.output));
      const capacityGap = Math.max(0, desired - capacity);
      const inputGap = Math.max(0, potential - output);
      const residualGap = Math.max(0, desired - output - capacityGap - inputGap);
      const consumed = Math.max(0, finite(preInput.get(firm.id)) - inputUnits(firm));

      desiredProductionUnits += desired;
      potentialOutputUnits += potential;
      outputUnits += output;
      capacityGapUnits += capacityGap;
      inputConstraintGapUnits += inputGap;
      residualGapUnits += residualGap;
      inputConsumedUnits += consumed;
      if (desired > EPS) planRealization.push(output / desired);
      if (potential > EPS) potentialRealization.push(output / potential);

      addSector(row.sector, firm.industryId, { outputUnits: output });
    }

    row.production = {
      desiredProductionUnits,
      potentialOutputUnits,
      outputUnits,
      capacityGapUnits,
      inputConstraintGapUnits,
      residualGapUnits,
      inputConsumedUnits,
      planRealizationRatio: safeRatio(outputUnits, desiredProductionUnits, 1),
      potentialRealizationRatio: safeRatio(outputUnits, potentialOutputUnits, 1),
      planRealization: statistics(planRealization),
      potentialRealization: statistics(potentialRealization)
    };
    row.stages.produced = true;
    return result;
  };

  setGoodsMarketDiagnosticObserver(({ countryId, month, result, diagnostics }) => {
    const state = latestStateByCountry.get(countryId);
    assert.ok(state, `${countryId}/${month}: goods observer has no active B7 replay`);
    const row = state.rows.get(rowKey(countryId, month));
    assert.ok(row, `${countryId}/${month}: goods observer row missing`);
    assert.equal(row.stages.produced, true, `${countryId}/${month}: goods before production`);
    assert.equal(row.stages.goodsObserved, false, `${countryId}/${month}: duplicate goods observation`);
    row.goods = {
      ...result,
      ...diagnostics,
      fulfillmentRatio: safeRatio(result.nominalConsumption, result.desiredBudget, 1),
      unmetShare: safeRatio(result.unmetBudget, result.desiredBudget, 0),
      unmetWithEndingInventory: finite(diagnostics.endInventoryUnits) > EPS ? finite(result.unmetBudget) : 0,
      endingInventoryAvailable: finite(diagnostics.endInventoryUnits) > EPS
    };
    row.stages.goodsObserved = true;
  });

  SupplyChainSystem.prototype.finalizeMetrics = function b7FinalizeMetrics(country, metrics, ...args) {
    const result = originals.finalizeMetrics.call(this, country, metrics, ...args);
    const state = stateFor(this, country);
    const month = derivedMonth(country);
    const row = rowFor(state, country, month);
    assert.equal(row.stages.goodsObserved, true, `${country.id}/${month}: finalize before goods observation`);
    assert.equal(row.stages.finalized, false, `${country.id}/${month}: duplicate finalize`);
    const firms = activeFirms(country);
    const priceCostRatios = [];
    let closingInventoryUnits = 0;
    let closingInventoryBook = 0;
    let closingInputUnits = 0;
    let closingInputBook = 0;
    let targetInventoryUnits = 0;
    let inventoryAboveTargetUnits = 0;
    let salesUnits = 0;
    let revenue = 0;
    let consumerSales = 0;
    let b2bSales = 0;
    let capitalSales = 0;
    let salesRevenueBook = 0;
    let cogsBook = 0;
    let inputConsumptionBook = 0;
    let labourCompensationAccrued = 0;
    let salesRevenueAtOrBelowBookCost = 0;
    let belowCostFirmCount = 0;
    let pricedFirmCount = 0;

    for (const firm of firms) {
      const opening = row._openingFirms.get(firm.id);
      assert.ok(opening, `${country.id}/${month}/${firm.id}: missing opening snapshot at finalize`);
      const journals = currentJournals(this, firm.id, month);
      const firmSalesRevenue = journalAmount(journals, 'sales_revenue', 'credit');
      const firmCogs = journalAmount(journals, 'cogs', 'debit');
      const firmInputConsumption = journalAmount(journals, 'inventory', 'debit', 'input_to_production');
      const firmLabour = journalAmount(journals, 'inventory', 'debit', 'production_labor_accrual');
      const firmClosingBook = naturalBalance(this, firm.id, 'inventory');
      const firmInventoryChange = firmClosingBook - opening.openingInventoryBook;
      const firmGva = firmSalesRevenue + firmInventoryChange - firmInputConsumption;
      const firmClosingInventory = Math.max(0, finite(firm.inventory));
      const target = Math.max(0, finite(firm.targetInventory));
      const bookUnitCost = Math.max(0, finite(firm.bookUnitCost));
      const price = Math.max(0, finite(firm.price));
      const priceCostRatio = bookUnitCost > EPS ? price / bookUnitCost : null;

      if (Number.isFinite(priceCostRatio)) {
        priceCostRatios.push(priceCostRatio);
        pricedFirmCount += 1;
        if (priceCostRatio <= 1 + 1e-9) {
          belowCostFirmCount += 1;
          salesRevenueAtOrBelowBookCost += firmSalesRevenue;
        }
      }

      closingInventoryUnits += firmClosingInventory;
      closingInventoryBook += firmClosingBook;
      closingInputUnits += inputUnits(firm);
      closingInputBook += naturalBalance(this, firm.id, 'input_inventory');
      targetInventoryUnits += target;
      inventoryAboveTargetUnits += Math.max(0, firmClosingInventory - target);
      salesUnits += Math.max(0, finite(firm.sales));
      revenue += Math.max(0, finite(firm.revenue));
      consumerSales += Math.max(0, finite(firm.consumerSales));
      b2bSales += Math.max(0, finite(firm.b2bSales));
      capitalSales += Math.max(0, finite(firm.capitalSales));
      salesRevenueBook += firmSalesRevenue;
      cogsBook += firmCogs;
      inputConsumptionBook += firmInputConsumption;
      labourCompensationAccrued += firmLabour;

      addSector(row.sector, firm.industryId, {
        salesUnits: firm.sales,
        revenue: firm.revenue,
        closingInventoryUnits: firmClosingInventory,
        closingInventoryBook: firmClosingBook,
        inventoryAboveTargetUnits: Math.max(0, firmClosingInventory - target),
        salesRevenueBook: firmSalesRevenue,
        cogsBook: firmCogs,
        inputConsumptionBook: firmInputConsumption,
        labourCompensationAccrued: firmLabour,
        gvaBasicProduction: firmGva
      });
    }

    const finishedInventoryBookChange = closingInventoryBook - finite(row.opening?.finishedInventoryBook);
    const gvaBasicProduction = salesRevenueBook + finishedInventoryBookChange - inputConsumptionBook;
    const gvaBasicIncome = labourCompensationAccrued + salesRevenueBook - cogsBook;
    row.closing = {
      activeFirms: firms.length,
      finishedInventoryUnits: closingInventoryUnits,
      finishedInventoryBook: closingInventoryBook,
      inputInventoryUnits: closingInputUnits,
      inputInventoryBook: closingInputBook,
      targetInventoryUnits,
      inventoryAboveTargetUnits,
      inventoryAboveTargetRatio: safeRatio(inventoryAboveTargetUnits, targetInventoryUnits, 0),
      salesUnits,
      revenue,
      consumerSales,
      b2bSales,
      capitalSales,
      salesToPlanRatio: safeRatio(salesUnits, row.plan?.desiredProductionUnits, 1),
      outputToSalesRatio: safeRatio(row.production?.outputUnits, salesUnits, null),
      salesRevenueBook,
      cogsBook,
      grossOperatingSurplusProxy: salesRevenueBook - cogsBook,
      inputConsumptionBook,
      labourCompensationAccrued,
      finishedInventoryBookChange,
      gvaBasicProduction,
      gvaBasicIncome,
      gvaApproachResidual: gvaBasicProduction - gvaBasicIncome,
      nonPositiveGva: gvaBasicProduction <= EPS,
      priceToBookUnitCost: statistics(priceCostRatios),
      pricedFirmCount,
      belowCostFirmCount,
      belowCostFirmShare: safeRatio(belowCostFirmCount, pricedFirmCount, 0),
      salesRevenueAtOrBelowBookCost,
      belowCostRevenueShare: safeRatio(salesRevenueAtOrBelowBookCost, salesRevenueBook, 0)
    };
    row.stages.finalized = true;
    return result;
  };

  function restore() {
    if (restored) return;
    SupplyChainSystem.prototype.beginMonth = originals.beginMonth;
    SupplyChainSystem.prototype.planProduction = originals.planProduction;
    SupplyChainSystem.prototype.procureInputs = originals.procureInputs;
    SupplyChainSystem.prototype.produce = originals.produce;
    SupplyChainSystem.prototype.finalizeMetrics = originals.finalizeMetrics;
    setGoodsMarketDiagnosticObserver(null);
    restored = true;
  }

  function finish(sourceResult) {
    const sourceRows = Array.isArray(sourceResult?.rows) ? sourceResult.rows : [];
    const sourceByKey = new Map(sourceRows.map((row) => [rowKey(row.countryId, row.month), row]));
    const expectedCountries = new Set(sourceRows.map((row) => row.countryId));
    const expectedMonths = Math.max(0, ...sourceRows.map((row) => finite(row.month)));
    const expectedRows = expectedCountries.size * expectedMonths;
    assert.equal(states.length, 2, `Expected exactly two B7 replay states; observed ${states.length}`);

    const publicStates = states.map((state) => {
      assert.equal(state.candidateId, sourceResult.candidate?.id, 'B7 replay candidate does not match source result');
      const rows = [...state.rows.values()]
        .sort((a, b) => a.month - b.month || a.countryId.localeCompare(b.countryId))
        .map(publicRow);
      assert.equal(rows.length, expectedRows, `B7 replay row count mismatch for ${state.candidateId}`);
      for (const row of rows) {
        assert.ok(Object.values(row.stages).every(Boolean), `${row.countryId}/${row.month}: incomplete B7 observation stages`);
        assert.ok(sourceByKey.has(rowKey(row.countryId, row.month)), `${row.countryId}/${row.month}: B7 row outside source panel`);
      }
      return rows;
    });

    const replayExact = JSON.stringify(publicStates[0]) === JSON.stringify(publicStates[1]);
    const firstRows = publicStates[0].map((row) => {
      const source = sourceByKey.get(rowKey(row.countryId, row.month));
      return {
        ...row,
        sourceMacro: {
          gvaBasicProduction: source.gvaBasicProduction,
          labourCompensationAccrued: source.labourCompensationAccrued,
          realizedConsumptionShareOfCashDisposableIncome: source.realizedConsumptionShareOfCashDisposableIncome,
          goodsFulfillmentRatio: source.goodsFulfillmentRatio,
          payrollSettlementRatio: source.payrollSettlementRatio,
          unemployment: source.unemployment,
          activeFirms: source.activeFirms,
          firmExits: source.firmExits,
          firmEntries: source.firmEntries,
          nominalPurchasingPower: source.nominalPurchasingPower,
          macroGdp: source.macroGdp,
          inventoryInvestmentShareOfMacroGdp: source.inventoryInvestmentShareOfMacroGdp
        }
      };
    });

    const serialized = JSON.stringify(firstRows);
    return {
      replayStateCount: states.length,
      expectedCountries: [...expectedCountries].sort(),
      expectedMonths,
      expectedRows,
      replayExact,
      rowsSha256: createHash('sha256').update(serialized).digest('hex'),
      rows: firstRows,
      summary: summarizeRows(firstRows)
    };
  }

  return { restore, finish };
}
