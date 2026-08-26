const EPS = 1e-9;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function activeFirms(country) {
  return (country.firms || []).filter(f => f.active !== false);
}

function supplierPool(country, product, buyerId) {
  return activeFirms(country).filter(f => f.product === product && f.id !== buyerId && finite(f.inventory) > EPS);
}

function weightedPrice(suppliers) {
  let units = 0;
  let value = 0;
  for (const s of suppliers) {
    const inv = Math.max(0, finite(s.inventory));
    if (inv <= EPS) continue;
    const price = Math.max(0.01, finite(s.price, 0.01));
    units += inv;
    value += inv * price;
  }
  return units > EPS ? value / units : null;
}

function rowFor(country, buyer, ledger) {
  const product = buyer.inputProduct;
  const required = Math.max(0, finite(buyer.desiredProduction) * Math.max(0, finite(buyer.inputPerOutput)));
  const onHand = Math.max(0, finite(buyer.inputInventory?.[product]));
  const unmet = Math.max(0, required - onHand);
  const suppliers = supplierPool(country, product, buyer.id);
  const supplierInventory = suppliers.reduce((s, f) => s + Math.max(0, finite(f.inventory)), 0);
  const price = weightedPrice(suppliers);
  const cash = Math.max(0, finite(ledger.balance(buyer.accountId)));
  const canonicalBudget = cash * 0.42;
  const units42 = price === null ? 0 : canonicalBudget / Math.max(0.01, price);
  const unitsCash = price === null ? 0 : cash / Math.max(0.01, price);

  const purch42 = Math.min(unmet, supplierInventory, units42);
  const purchCash = Math.min(unmet, supplierInventory, unitsCash);
  const purchInventoryOnly = Math.min(unmet, supplierInventory);

  const onHandOnly = Math.min(required, onHand);
  const canonical42 = Math.min(required, onHand + purch42);
  const fullCash = Math.min(required, onHand + purchCash);
  const inventoryOnly = Math.min(required, onHand + purchInventoryOnly);

  const recover42ToCash = Math.max(0, fullCash - canonical42);
  const recoverCashToInventory = Math.max(0, inventoryOnly - fullCash);
  const residual42 = Math.max(0, required - canonical42);
  const residualCash = Math.max(0, required - fullCash);
  const residualInventory = Math.max(0, required - inventoryOnly);

  let limitingClass = 'NO_SHORTAGE';
  if (required > onHand + EPS) {
    if (supplierInventory <= EPS) limitingClass = 'NO_SUPPLIER_INVENTORY';
    else if (residualInventory > EPS) limitingClass = 'SUPPLIER_INVENTORY_SCARCITY';
    else if (recoverCashToInventory > EPS) limitingClass = 'BUYER_SETTLEMENT_OR_WORKING_CAPITAL';
    else if (recover42ToCash > EPS) limitingClass = 'CANONICAL_42PCT_CASH_RESERVATION';
    else limitingClass = 'OTHER_TIMING_OR_SEARCH';
  }

  return {
    countryId: String(country.id), buyerId: String(buyer.id), sectorId: String(buyer.industryId || 'UNKNOWN'), product: String(product),
    requiredInputUnits: required, onHandInputUnits: onHand, unmetInputUnits: unmet,
    positiveSupplierCount: suppliers.length, aggregateSupplierInventory: supplierInventory, weightedSupplierPrice: price,
    buyerCash: cash, canonicalBudget, fullCashBudget: cash,
    onHandOnlyEnvelope: onHandOnly, canonical42PctCashEnvelope: canonical42, fullCurrentCashEnvelope: fullCash,
    inventoryOnlyNoBuyerCashConstraintEnvelope: inventoryOnly,
    recovery42PctToFullCash: recover42ToCash, recoveryFullCashToInventoryOnly: recoverCashToInventory,
    residualShortage42Pct: residual42, residualShortageFullCash: residualCash, residualShortageInventoryOnly: residualInventory,
    limitingClass
  };
}

function aggregate(rows) {
  const sum = key => rows.reduce((s, r) => s + finite(r[key]), 0);
  const classes = ['NO_SHORTAGE','NO_SUPPLIER_INVENTORY','SUPPLIER_INVENTORY_SCARCITY','BUYER_SETTLEMENT_OR_WORKING_CAPITAL','CANONICAL_42PCT_CASH_RESERVATION','OTHER_TIMING_OR_SEARCH'];
  return {
    buyers: rows.length,
    requiredInputUnits: sum('requiredInputUnits'), onHandInputUnits: sum('onHandInputUnits'), unmetInputUnits: sum('unmetInputUnits'),
    canonical42PctCashEnvelope: sum('canonical42PctCashEnvelope'), fullCurrentCashEnvelope: sum('fullCurrentCashEnvelope'),
    inventoryOnlyNoBuyerCashConstraintEnvelope: sum('inventoryOnlyNoBuyerCashConstraintEnvelope'),
    recovery42PctToFullCash: sum('recovery42PctToFullCash'), recoveryFullCashToInventoryOnly: sum('recoveryFullCashToInventoryOnly'),
    residualShortage42Pct: sum('residualShortage42Pct'), residualShortageFullCash: sum('residualShortageFullCash'),
    residualShortageInventoryOnly: sum('residualShortageInventoryOnly'),
    limitingCounts: Object.fromEntries(classes.map(k => [k, rows.filter(r => r.limitingClass === k).length]))
  };
}

export class ProcurementCounterfactualEnvelope {
  constructor({ ledger }) {
    if (!ledger) throw new Error('ledger is required');
    this.ledger = ledger;
  }

  report(countries, month = 0) {
    const countryReports = [];
    for (const country of countries || []) {
      const rows = activeFirms(country).filter(f => f.inputProduct).map(f => rowFor(country, f, this.ledger));
      countryReports.push({ countryId: String(country.id), month, rows, aggregate: aggregate(rows) });
    }
    const totals = aggregate(countryReports.flatMap(c => c.rows));
    const issues = [];
    for (const c of countryReports) for (const r of c.rows) {
      if (r.onHandOnlyEnvelope > r.canonical42PctCashEnvelope + 1e-7) issues.push({countryId:c.countryId,buyerId:r.buyerId,type:'NONMONOTONIC_ONHAND_TO_42'});
      if (r.canonical42PctCashEnvelope > r.fullCurrentCashEnvelope + 1e-7) issues.push({countryId:c.countryId,buyerId:r.buyerId,type:'NONMONOTONIC_42_TO_CASH'});
      if (r.fullCurrentCashEnvelope > r.inventoryOnlyNoBuyerCashConstraintEnvelope + 1e-7) issues.push({countryId:c.countryId,buyerId:r.buyerId,type:'NONMONOTONIC_CASH_TO_INVENTORY'});
      if (r.inventoryOnlyNoBuyerCashConstraintEnvelope > r.requiredInputUnits + 1e-7) issues.push({countryId:c.countryId,buyerId:r.buyerId,type:'ENVELOPE_EXCEEDS_REQUIREMENT'});
    }
    return { version:'r4-cf-c-procurement-counterfactual-envelope-v1', month, countries:countryReports, totals, validation:{ok:issues.length===0,issues} };
  }
}
