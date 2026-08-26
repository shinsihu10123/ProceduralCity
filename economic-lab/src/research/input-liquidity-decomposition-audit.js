const EPS = 1e-9;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function activeFirms(country) {
  return (country.firms || []).filter(f => f.active !== false);
}

function supplierPool(country, product, buyerId) {
  return activeFirms(country).filter(f => f.product === product && f.id !== buyerId);
}

function weightedSupplierPrice(suppliers) {
  let units = 0;
  let value = 0;
  for (const seller of suppliers) {
    const inv = Math.max(0, finite(seller.inventory));
    if (inv <= EPS) continue;
    units += inv;
    value += inv * Math.max(0.01, finite(seller.price, 0.01));
  }
  return units > EPS ? value / units : null;
}

function buyerRow(country, buyer, ledger) {
  const product = buyer.inputProduct;
  const required = Math.max(0, finite(buyer.desiredProduction) * Math.max(0, finite(buyer.inputPerOutput)));
  const onHand = Math.max(0, finite(buyer.inputInventory?.[product]));
  const unmetBeforeProcurement = Math.max(0, required - onHand);
  const suppliers = supplierPool(country, product, buyer.id);
  const positiveSuppliers = suppliers.filter(s => finite(s.inventory) > EPS);
  const aggregateSupplierInventory = positiveSuppliers.reduce((s, f) => s + Math.max(0, finite(f.inventory)), 0);
  const avgPrice = weightedSupplierPrice(positiveSuppliers);
  const cash = Math.max(0, finite(ledger.balance(buyer.accountId)));
  const canonicalBudget = cash * 0.42;
  const fullCashBudget = cash;
  const unitsByCanonicalBudget = avgPrice === null ? 0 : canonicalBudget / Math.max(0.01, avgPrice);
  const unitsByFullCash = avgPrice === null ? 0 : fullCashBudget / Math.max(0.01, avgPrice);
  const canonicalBudgetCeiling = Math.min(unmetBeforeProcurement, aggregateSupplierInventory, unitsByCanonicalBudget);
  const fullCashCeiling = Math.min(unmetBeforeProcurement, aggregateSupplierInventory, unitsByFullCash);
  const supplierInventoryCeiling = Math.min(unmetBeforeProcurement, aggregateSupplierInventory);
  const shortageFromSupplierScarcity = Math.max(0, unmetBeforeProcurement - supplierInventoryCeiling);
  const additionalShortageFrom42PctCap = Math.max(0, supplierInventoryCeiling - canonicalBudgetCeiling);
  const remainingAfterFullCash = Math.max(0, unmetBeforeProcurement - fullCashCeiling);

  let primaryConstraint = 'NO_SHORTAGE';
  if (unmetBeforeProcurement > EPS) {
    if (aggregateSupplierInventory <= EPS) primaryConstraint = 'NO_SUPPLIER_INVENTORY';
    else if (supplierInventoryCeiling + 1e-7 < unmetBeforeProcurement) primaryConstraint = 'AGGREGATE_SUPPLIER_INVENTORY';
    else if (canonicalBudgetCeiling + 1e-7 < supplierInventoryCeiling) primaryConstraint = 'BUYER_42PCT_CASH_BUDGET';
    else primaryConstraint = 'SEARCH_OR_TIMING_OR_OTHER';
  }

  return {
    countryId: String(country.id),
    buyerId: String(buyer.id),
    sectorId: String(buyer.industryId || 'UNKNOWN'),
    product: String(product),
    desiredProduction: Math.max(0, finite(buyer.desiredProduction)),
    requiredInputUnits: required,
    inputInventoryOnHand: onHand,
    unmetBeforeProcurement,
    positiveSupplierCount: positiveSuppliers.length,
    aggregateSupplierInventory,
    weightedSupplierPrice: avgPrice,
    buyerCash: cash,
    canonicalProcurementBudget: canonicalBudget,
    fullCashBudget,
    unitsByCanonicalBudget,
    unitsByFullCash,
    canonicalBudgetCeiling,
    fullCashCeiling,
    supplierInventoryCeiling,
    shortageFromSupplierScarcity,
    additionalShortageFrom42PctCap,
    remainingAfterFullCash,
    observedSupplyShortage: Math.max(0, finite(buyer.supplyShortage)),
    primaryConstraint
  };
}

function aggregate(rows) {
  const sum = key => rows.reduce((s, r) => s + finite(r[key]), 0);
  const count = key => rows.filter(r => r.primaryConstraint === key).length;
  return {
    buyers: rows.length,
    requiredInputUnits: sum('requiredInputUnits'),
    unmetBeforeProcurement: sum('unmetBeforeProcurement'),
    aggregateSupplierInventory: sum('aggregateSupplierInventory'),
    canonicalBudgetCeiling: sum('canonicalBudgetCeiling'),
    fullCashCeiling: sum('fullCashCeiling'),
    supplierInventoryCeiling: sum('supplierInventoryCeiling'),
    shortageFromSupplierScarcity: sum('shortageFromSupplierScarcity'),
    additionalShortageFrom42PctCap: sum('additionalShortageFrom42PctCap'),
    observedSupplyShortage: sum('observedSupplyShortage'),
    constraintCounts: {
      NO_SHORTAGE: count('NO_SHORTAGE'),
      NO_SUPPLIER_INVENTORY: count('NO_SUPPLIER_INVENTORY'),
      AGGREGATE_SUPPLIER_INVENTORY: count('AGGREGATE_SUPPLIER_INVENTORY'),
      BUYER_42PCT_CASH_BUDGET: count('BUYER_42PCT_CASH_BUDGET'),
      SEARCH_OR_TIMING_OR_OTHER: count('SEARCH_OR_TIMING_OR_OTHER')
    }
  };
}

export class InputLiquidityDecompositionAudit {
  constructor({ ledger }) {
    if (!ledger) throw new Error('ledger is required');
    this.ledger = ledger;
  }

  report(countries, month = 0) {
    const countryReports = [];
    for (const country of countries || []) {
      const rows = activeFirms(country).filter(f => f.inputProduct).map(f => buyerRow(country, f, this.ledger));
      countryReports.push({ countryId: String(country.id), month, rows, aggregate: aggregate(rows) });
    }
    return {
      version: 'r4-cf-b-input-liquidity-decomposition-v1',
      month,
      countries: countryReports,
      totals: aggregate(countryReports.flatMap(c => c.rows))
    };
  }
}
