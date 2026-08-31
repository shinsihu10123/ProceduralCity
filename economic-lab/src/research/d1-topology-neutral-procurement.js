import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SupplyChainSystem } from '../industry/supply-chain.js';

const EPS = 1e-8;
const INTERVENTION_ID = 'D1-TOPOLOGY-REACHABILITY-EXHAUSTIVE-V1';
const CONFIG = {
  interventionId: INTERVENTION_ID,
  buyerOrder: 'LEXICOGRAPHIC_ID',
  supplierEligibility: 'COUNTRY_LOCAL_ACTIVE_EXACT_PRODUCT_POSITIVE_INVENTORY_NONSELF',
  sellerOrder: ['POSTED_PRICE_ASC', 'RELIABILITY_DESC', 'SELLER_ID_ASC'],
  fixedRoundCap: null,
  visitEachEligibleSellerAtMostOnce: true,
  procurementBudgetShare: 0.42,
  accountingAndSettlement: 'CANONICAL'
};
const CONFIG_SHA256 = createHash('sha256').update(JSON.stringify(CONFIG)).digest('hex');

const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const sum = (values) => values.reduce((total, value) => total + finite(value), 0);
const safeRatio = (numerator, denominator, fallback = 0) =>
  Math.abs(finite(denominator)) > EPS ? finite(numerator) / finite(denominator) : fallback;
const near = (left, right, scale = 1) =>
  Math.abs(finite(left) - finite(right)) <= 1e-7 * Math.max(1, Math.abs(finite(scale)));

function activeFirms(country) {
  return (country.firms || []).filter((firm) => firm.active !== false);
}

function candidateIdFromCountry(country) {
  const ids = new Set(
    (country.firms || [])
      .map((firm) => firm?.__r4CuD3dB6?.candidateId)
      .filter(Boolean)
  );
  assert.ok(ids.size <= 1, `Multiple D1 candidate tags in ${country.id}: ${[...ids].join(', ')}`);
  return [...ids][0] || null;
}

function objectUnits(object) {
  return sum(Object.values(object || {}).map((value) => Math.max(0, finite(value))));
}

function invariantSnapshot(country) {
  return activeFirms(country)
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((firm) => ({
      id: firm.id,
      active: firm.active !== false,
      industryId: firm.industryId,
      product: firm.product,
      consumerFacing: firm.consumerFacing === true,
      inputProduct: firm.inputProduct || null,
      inputPerOutput: finite(firm.inputPerOutput),
      price: finite(firm.price),
      productivity: finite(firm.productivity),
      capacity: finite(firm.capacity),
      desiredProduction: finite(firm.desiredProduction),
      targetInventory: finite(firm.targetInventory),
      workers: finite(firm.workers),
      currentPlan: firm.currentPlan || null,
      beliefs: firm.beliefs || null
    }));
}

function percentile(values, probability) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function statistics(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) {
    return { count: 0, min: null, p25: null, median: null, p75: null, max: null, mean: null };
  }
  return {
    count: sorted.length,
    min: sorted[0],
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    max: sorted.at(-1),
    mean: sum(sorted) / sorted.length
  };
}

function sellerReliability(seller) {
  return 0.78 + Math.min(0.35, Math.max(0, finite(seller.productivity)) * 0.18);
}

function sellerOrder(left, right) {
  const priceDifference = Math.max(0.01, finite(left.price, 0.01)) - Math.max(0.01, finite(right.price, 0.01));
  if (Math.abs(priceDifference) > EPS) return priceDifference;
  const reliabilityDifference = sellerReliability(right) - sellerReliability(left);
  if (Math.abs(reliabilityDifference) > EPS) return reliabilityDifference;
  return left.id.localeCompare(right.id);
}

function firmCash(supply, firms) {
  return sum(firms.map((firm) => supply.ledger.balance(firm.accountId)));
}

function physicalSnapshot(supply, firms) {
  return {
    firmCash: firmCash(supply, firms),
    finishedInventoryUnits: sum(firms.map((firm) => Math.max(0, finite(firm.inventory)))),
    inputInventoryUnits: sum(firms.map((firm) => objectUnits(firm.inputInventory))),
    inputBookValue: sum(firms.map((firm) => objectUnits(firm.inputBookValues)))
  };
}

function summarizeRows(rows) {
  const plannedInputNeedUnits = sum(rows.map((row) => row.procurement.plannedInputNeedUnits));
  const purchasedInputUnits = sum(rows.map((row) => row.procurement.purchasedInputUnits));
  const inputShortageUnits = sum(rows.map((row) => row.procurement.inputShortageUnits));
  const purchaseSpend = sum(rows.map((row) => row.procurement.purchaseSpend));
  return {
    countryMonths: rows.length,
    plannedInputNeedUnits,
    purchasedInputUnits,
    inputShortageUnits,
    inputShortageRate: safeRatio(inputShortageUnits, plannedInputNeedUnits, 0),
    fillRate: safeRatio(purchasedInputUnits, plannedInputNeedUnits, 1),
    purchaseSpend,
    realizedSupplierLinks: sum(rows.map((row) => row.procurement.realizedSupplierLinks)),
    buyersUsingMoreThanFiveSuppliers: sum(
      rows.map((row) => row.procurement.buyersUsingMoreThanFiveSuppliers)
    ),
    maximumAbsoluteConservationResidual: Math.max(
      0,
      ...rows.flatMap((row) => Object.values(row.conservation.residuals).map((value) => Math.abs(finite(value))))
    ),
    boundaryInvariantPassShare: safeRatio(
      rows.filter((row) => row.boundary.invariantExact === true).length,
      rows.length,
      0
    ),
    conservationPassShare: safeRatio(
      rows.filter((row) => row.conservation.ok === true).length,
      rows.length,
      0
    ),
    compatibleSupplierCount: statistics(
      rows.flatMap((row) => row.buyers.map((buyer) => buyer.compatibleSupplierCount))
    ),
    reachableStockCoverage: statistics(
      rows.flatMap((row) => row.buyers.map((buyer) => buyer.reachableStockCoverage))
    ),
    realizedLinksPerPositiveNeedBuyer: statistics(
      rows.flatMap((row) =>
        row.buyers
          .filter((buyer) => buyer.startingNeedUnits > EPS)
          .map((buyer) => buyer.realizedSupplierLinks)
      )
    )
  };
}

export function installD1TopologyNeutralProcurement({ expectedCandidateId = null } = {}) {
  const originalProcureInputs = SupplyChainSystem.prototype.procureInputs;
  const stateBySupply = new WeakMap();
  const states = [];
  let restored = false;

  function stateFor(supply, country) {
    const candidateId = candidateIdFromCountry(country);
    if (!candidateId) return null;
    let state = stateBySupply.get(supply);
    if (!state) {
      state = { candidateId, rows: new Map(), countries: new Set() };
      if (expectedCandidateId) {
        assert.equal(candidateId, expectedCandidateId, 'D1 topology intervention candidate mismatch');
      }
      stateBySupply.set(supply, state);
      states.push(state);
    }
    assert.equal(candidateId, state.candidateId, 'D1 candidate changed inside replay');
    state.countries.add(country.id);
    return state;
  }

  SupplyChainSystem.prototype.procureInputs = function d1TopologyNeutralProcureInputs(country, month) {
    const state = stateFor(this, country);
    const firms = activeFirms(country);
    const invariantsBefore = invariantSnapshot(country);
    const physicalBefore = physicalSnapshot(this, firms);
    const ledgerBefore = this.ledger.entriesFor({ month, countryId: country.id }).length;
    const metrics = this.emptyMetrics(country);
    const suppliersByProduct = new Map();

    for (const seller of firms) {
      if (!suppliersByProduct.has(seller.product)) suppliersByProduct.set(seller.product, []);
      suppliersByProduct.get(seller.product).push(seller);
    }
    for (const suppliers of suppliersByProduct.values()) suppliers.sort(sellerOrder);

    const buyers = firms
      .filter((firm) => Boolean(firm.inputProduct))
      .slice()
      .sort((left, right) => left.id.localeCompare(right.id));
    const buyerRows = [];

    for (const buyer of buyers) {
      const product = buyer.inputProduct;
      const requiredUnits = Math.max(0, finite(buyer.desiredProduction) * Math.max(0, finite(buyer.inputPerOutput)));
      const onHandUnits = Math.max(0, finite(buyer.inputInventory?.[product]));
      let remainingNeedUnits = Math.max(0, requiredUnits - onHandUnits);
      const startingNeedUnits = remainingNeedUnits;
      const openingCash = this.ledger.balance(buyer.accountId);
      let budgetRemaining = Math.max(0, openingCash * CONFIG.procurementBudgetShare);
      const openingBudget = budgetRemaining;
      const eligible = (suppliersByProduct.get(product) || [])
        .filter((seller) => seller.active !== false && seller.id !== buyer.id && finite(seller.inventory) > EPS)
        .slice()
        .sort(sellerOrder);
      const compatibleSupplierCount = eligible.length;
      const reachableStockUnits = sum(eligible.map((seller) => Math.max(0, finite(seller.inventory))));
      const openingInventories = eligible.map((seller) => Math.max(0, finite(seller.inventory)));
      const inventoryShares = reachableStockUnits > EPS
        ? openingInventories.map((value) => value / reachableStockUnits)
        : [];
      const supplierInventoryHhi = inventoryShares.length
        ? sum(inventoryShares.map((share) => share * share))
        : null;
      const topSupplierInventoryShare = inventoryShares.length ? Math.max(...inventoryShares) : null;
      let purchasedUnits = 0;
      let purchaseSpend = 0;
      let realizedSupplierLinks = 0;
      let visitedSuppliers = 0;

      for (const seller of eligible) {
        if (remainingNeedUnits <= EPS || budgetRemaining <= EPS) break;
        visitedSuppliers += 1;
        const price = Math.max(0.01, finite(seller.price, 0.01));
        const affordableUnits = budgetRemaining / price;
        const desiredUnits = Math.min(
          remainingNeedUnits,
          Math.max(0, finite(seller.inventory)),
          affordableUnits
        );
        if (desiredUnits <= EPS) continue;
        const requested = desiredUnits * price;
        const paid = this.ledger.transfer({
          month,
          countryId: country.id,
          from: buyer.accountId,
          to: seller.accountId,
          amount: requested,
          kind: 'interfirm_purchase',
          meta: {
            buyerId: buyer.id,
            sellerId: seller.id,
            product,
            units: desiredUnits,
            d1InterventionId: INTERVENTION_ID
          }
        });
        if (paid <= EPS) continue;

        const units = paid / price;
        const sellerUnitCost = Math.max(0, finite(seller.bookUnitCost, price * 0.45));
        const sellerCost = Math.min(
          Math.max(0, this.accounting.gl.naturalBalance(seller.id, 'inventory')),
          units * sellerUnitCost
        );
        seller.inventory = Math.max(0, finite(seller.inventory) - units);
        seller.b2bSales = finite(seller.b2bSales) + units;
        seller.b2bRevenue = finite(seller.b2bRevenue) + paid;
        seller.revenue = finite(seller.revenue) + paid;
        seller.sales = finite(seller.sales) + units;
        buyer.inputInventory[product] = finite(buyer.inputInventory[product]) + units;
        buyer.inputBookValues[product] = finite(buyer.inputBookValues[product]) + paid;
        buyer.inputSpend = finite(buyer.inputSpend) + paid;
        budgetRemaining = Math.max(0, budgetRemaining - paid);
        remainingNeedUnits = Math.max(0, remainingNeedUnits - units);
        purchasedUnits += units;
        purchaseSpend += paid;
        realizedSupplierLinks += 1;

        this.accounting.recordInterfirmPurchase({
          buyer,
          seller,
          month,
          amount: paid,
          units,
          cost: sellerCost,
          product
        });
        metrics.b2bTransactions += 1;
        metrics.b2bSpend += paid;
        metrics.b2bUnits += units;
      }

      buyer.supplyShortage = Math.max(0, remainingNeedUnits);
      metrics.inputShortageUnits += startingNeedUnits > 0 ? Math.max(0, remainingNeedUnits) : 0;
      buyerRows.push({
        buyerId: buyer.id,
        industryId: buyer.industryId,
        product,
        requiredUnits,
        onHandUnits,
        startingNeedUnits,
        openingCash,
        openingBudget,
        compatibleSupplierCount,
        reachableStockUnits,
        reachableStockCoverage: safeRatio(reachableStockUnits, startingNeedUnits, 0),
        supplierInventoryHhi,
        topSupplierInventoryShare,
        visitedSuppliers,
        realizedSupplierLinks,
        purchasedUnits,
        purchaseSpend,
        endingShortageUnits: Math.max(0, remainingNeedUnits),
        budgetUtilization: safeRatio(purchaseSpend, openingBudget, 0)
      });
    }

    const invariantsAfter = invariantSnapshot(country);
    const physicalAfter = physicalSnapshot(this, firms);
    const addedLedgerEntries = this.ledger.entriesFor({ month, countryId: country.id }).slice(ledgerBefore);
    const purchaseEntries = addedLedgerEntries.filter((entry) => entry.kind === 'interfirm_purchase');
    const ledgerPurchaseSpend = sum(purchaseEntries.map((entry) => entry.amount));
    const ledgerPurchaseUnits = sum(
      purchaseEntries.map((entry) => finite(entry.meta?.units, finite(entry.amount)))
    );
    const invariantExact = JSON.stringify(invariantsBefore) === JSON.stringify(invariantsAfter);
    const residuals = {
      firmCash: physicalAfter.firmCash - physicalBefore.firmCash,
      finishedInventoryUnits:
        physicalBefore.finishedInventoryUnits - physicalAfter.finishedInventoryUnits - metrics.b2bUnits,
      inputInventoryUnits:
        physicalAfter.inputInventoryUnits - physicalBefore.inputInventoryUnits - metrics.b2bUnits,
      inputBookValue:
        physicalAfter.inputBookValue - physicalBefore.inputBookValue - metrics.b2bSpend,
      ledgerPurchaseUnits: ledgerPurchaseUnits - metrics.b2bUnits,
      ledgerPurchaseSpend: ledgerPurchaseSpend - metrics.b2bSpend
    };
    const conservation = {
      residuals,
      firmCashConserved: near(physicalAfter.firmCash, physicalBefore.firmCash, physicalBefore.firmCash),
      finishedInventoryConserved: near(
        physicalBefore.finishedInventoryUnits - physicalAfter.finishedInventoryUnits,
        metrics.b2bUnits,
        metrics.b2bUnits
      ),
      inputInventoryConserved: near(
        physicalAfter.inputInventoryUnits - physicalBefore.inputInventoryUnits,
        metrics.b2bUnits,
        metrics.b2bUnits
      ),
      inputBookValueConserved: near(
        physicalAfter.inputBookValue - physicalBefore.inputBookValue,
        metrics.b2bSpend,
        metrics.b2bSpend
      ),
      ledgerUnitsReconcile: near(ledgerPurchaseUnits, metrics.b2bUnits, metrics.b2bUnits),
      ledgerSpendReconcile: near(ledgerPurchaseSpend, metrics.b2bSpend, metrics.b2bSpend)
    };
    conservation.ok = Object.entries(conservation)
      .filter(([key]) => key !== 'residuals' && key !== 'ok')
      .every(([, value]) => value === true);

    assert.equal(invariantExact, true, `${country.id}/${month}: D1 procurement changed a blocked boundary field`);
    assert.equal(conservation.ok, true, `${country.id}/${month}: D1 procurement conservation failed`);

    if (state) {
      const key = `${country.id}@@${month}`;
      assert.equal(state.rows.has(key), false, `${country.id}/${month}: duplicate D1 intervention row`);
      state.rows.set(key, {
        candidateId: state.candidateId,
        countryId: country.id,
        month,
        interventionId: INTERVENTION_ID,
        interventionConfigSha256: CONFIG_SHA256,
        boundary: { invariantExact },
        conservation,
        procurement: {
          buyerCount: buyerRows.length,
          positiveNeedBuyers: buyerRows.filter((buyer) => buyer.startingNeedUnits > EPS).length,
          plannedInputNeedUnits: sum(buyerRows.map((buyer) => buyer.startingNeedUnits)),
          purchasedInputUnits: metrics.b2bUnits,
          inputShortageUnits: metrics.inputShortageUnits,
          purchaseSpend: metrics.b2bSpend,
          realizedSupplierLinks: metrics.b2bTransactions,
          buyersUsingMoreThanFiveSuppliers: buyerRows.filter(
            (buyer) => buyer.realizedSupplierLinks > 5
          ).length
        },
        buyers: buyerRows
      });
    }

    return metrics;
  };

  function finish(sourceResult) {
    const sourceRows = Array.isArray(sourceResult?.rows) ? sourceResult.rows : [];
    const countries = [...new Set(sourceRows.map((row) => row.countryId))].sort();
    const months = Math.max(0, ...sourceRows.map((row) => finite(row.month)));
    const expectedRows = countries.length * months;
    assert.equal(states.length, 2, `Expected two tagged D1 replay states; observed ${states.length}`);

    const replayRows = states.map((state) => {
      assert.equal(state.candidateId, sourceResult.candidate?.id, 'D1 candidate differs from source result');
      const rows = [...state.rows.values()].sort(
        (left, right) => left.month - right.month || left.countryId.localeCompare(right.countryId)
      );
      assert.equal(rows.length, expectedRows, `D1 row count mismatch for ${state.candidateId}`);
      assert.ok(rows.every((row) => row.boundary.invariantExact === true));
      assert.ok(rows.every((row) => row.conservation.ok === true));
      return rows;
    });
    const replayExact = JSON.stringify(replayRows[0]) === JSON.stringify(replayRows[1]);
    const rows = replayRows[0];
    const rowsText = JSON.stringify(rows);
    return {
      schemaVersion: 'r4-cu-d3d-b7-d1-topology-intervention-observation-v0.1',
      interventionId: INTERVENTION_ID,
      interventionConfig: CONFIG,
      interventionConfigSha256: CONFIG_SHA256,
      replayStateCount: states.length,
      replayExact,
      expectedCountries: countries,
      expectedMonths: months,
      expectedRows,
      rowsSha256: createHash('sha256').update(rowsText).digest('hex'),
      rows,
      summary: summarizeRows(rows)
    };
  }

  function restore() {
    if (restored) return;
    SupplyChainSystem.prototype.procureInputs = originalProcureInputs;
    restored = true;
  }

  return { finish, restore, interventionId: INTERVENTION_ID, interventionConfigSha256: CONFIG_SHA256 };
}
