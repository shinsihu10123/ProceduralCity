const EPS = 1e-9;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function activeFirms(country) {
  return (country.firms || []).filter(f => f.active !== false);
}

function supplierPool(country, product, buyerId) {
  return activeFirms(country)
    .filter(f => f.product === product && f.id !== buyerId && finite(f.inventory) > EPS)
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function supplierInventoryValue(suppliers) {
  return suppliers.reduce((sum, seller) => {
    const units = Math.max(0, finite(seller.inventory));
    const price = Math.max(0.01, finite(seller.price, 0.01));
    return sum + units * price;
  }, 0);
}

function weightedPrice(suppliers) {
  let units = 0;
  let value = 0;
  for (const seller of suppliers) {
    const inv = Math.max(0, finite(seller.inventory));
    if (inv <= EPS) continue;
    const price = Math.max(0.01, finite(seller.price, 0.01));
    units += inv;
    value += inv * price;
  }
  return units > EPS ? value / units : null;
}

function allocateSellerReceivables(suppliers, exposure) {
  const target = Math.max(0, finite(exposure));
  if (target <= EPS || suppliers.length === 0) return [];
  const values = suppliers.map(seller => ({
    sellerId: String(seller.id),
    inventoryValue: Math.max(0, finite(seller.inventory)) * Math.max(0.01, finite(seller.price, 0.01))
  }));
  const totalValue = values.reduce((s, row) => s + row.inventoryValue, 0);
  if (totalValue <= EPS) return [];

  let assigned = 0;
  return values.map((row, index) => {
    const receivable = index === values.length - 1
      ? Math.max(0, target - assigned)
      : Math.min(target - assigned, target * row.inventoryValue / totalValue);
    assigned += receivable;
    return { sellerId: row.sellerId, receivable };
  }).filter(row => row.receivable > EPS);
}

function buyerOperatingScaleValue(buyer) {
  // Observable planned-sales proxy. This is intentionally not calibrated to outcomes.
  const plannedUnits = Math.max(0, finite(buyer.desiredProduction));
  const unitPrice = Math.max(0.01, finite(buyer.price, 0.01));
  return plannedUnits * unitPrice;
}

function rowFor(country, buyer, ledger) {
  const product = buyer.inputProduct;
  const required = Math.max(0, finite(buyer.desiredProduction) * Math.max(0, finite(buyer.inputPerOutput)));
  const onHand = Math.max(0, finite(buyer.inputInventory?.[product]));
  const unmet = Math.max(0, required - onHand);
  const suppliers = supplierPool(country, product, buyer.id);
  const supplierInventory = suppliers.reduce((s, f) => s + Math.max(0, finite(f.inventory)), 0);
  const avgPrice = weightedPrice(suppliers);
  const inventoryValue = supplierInventoryValue(suppliers);
  const cash = Math.max(0, finite(ledger.balance(buyer.accountId)));
  const operatingScale = buyerOperatingScaleValue(buyer);

  const unitsByCash = avgPrice === null ? 0 : cash / Math.max(0.01, avgPrice);
  const cashProcurementUnits = Math.min(unmet, supplierInventory, unitsByCash);
  const remainingAfterCashUnits = Math.max(0, unmet - cashProcurementUnits);
  const physicalCreditUnitsCeiling = Math.max(0, Math.min(remainingAfterCashUnits, Math.max(0, supplierInventory - cashProcurementUnits)));
  const physicalCreditValueCeiling = avgPrice === null ? 0 : physicalCreditUnitsCeiling * avgPrice;

  const net30ExposureCap = Math.max(0, operatingScale);
  const net60ExposureCap = Math.max(0, operatingScale * 2);
  const net30CreditValue = Math.min(physicalCreditValueCeiling, net30ExposureCap, Math.max(0, inventoryValue));
  const net60CreditValue = Math.min(physicalCreditValueCeiling, net60ExposureCap, Math.max(0, inventoryValue));
  const net30CreditUnits = avgPrice === null ? 0 : net30CreditValue / Math.max(0.01, avgPrice);
  const net60CreditUnits = avgPrice === null ? 0 : net60CreditValue / Math.max(0.01, avgPrice);

  const d0FullCashEnvelope = Math.min(required, onHand + cashProcurementUnits);
  const d1Net30Envelope = Math.min(required, d0FullCashEnvelope + net30CreditUnits);
  const d2Net60Envelope = Math.min(required, d0FullCashEnvelope + net60CreditUnits);
  const d3InventoryOnlyEnvelope = Math.min(required, onHand + Math.min(unmet, supplierInventory));

  const d1Payable = Math.max(0, net30CreditValue);
  const d2Payable = Math.max(0, net60CreditValue);
  const d1SellerReceivables = allocateSellerReceivables(suppliers, d1Payable);
  const d2SellerReceivables = allocateSellerReceivables(suppliers, d2Payable);
  const d1Receivable = d1SellerReceivables.reduce((s, row) => s + row.receivable, 0);
  const d2Receivable = d2SellerReceivables.reduce((s, row) => s + row.receivable, 0);

  const recoveryPotential = Math.max(0, d3InventoryOnlyEnvelope - d0FullCashEnvelope);
  const d1Recovery = Math.max(0, d1Net30Envelope - d0FullCashEnvelope);
  const d2Recovery = Math.max(0, d2Net60Envelope - d0FullCashEnvelope);

  return {
    countryId: String(country.id),
    buyerId: String(buyer.id),
    sectorId: String(buyer.industryId || 'UNKNOWN'),
    product: String(product),
    requiredInputUnits: required,
    onHandInputUnits: onHand,
    unmetInputUnits: unmet,
    supplierCount: suppliers.length,
    supplierInventoryUnits: supplierInventory,
    supplierInventoryValue: inventoryValue,
    weightedSupplierPrice: avgPrice,
    buyerCash: cash,
    buyerOperatingScaleValue: operatingScale,
    d0FullCashEnvelope,
    d1Net30Envelope,
    d2Net60Envelope,
    d3InventoryOnlyEnvelope,
    d1IncrementalFinancedUnits: d1Recovery,
    d2IncrementalFinancedUnits: d2Recovery,
    d1IncrementalFinancedValue: d1Payable,
    d2IncrementalFinancedValue: d2Payable,
    d1BuyerPayable: d1Payable,
    d1SellerReceivable: d1Receivable,
    d2BuyerPayable: d2Payable,
    d2SellerReceivable: d2Receivable,
    d1SellerReceivables,
    d2SellerReceivables,
    d1ResidualShortage: Math.max(0, required - d1Net30Envelope),
    d2ResidualShortage: Math.max(0, required - d2Net60Envelope),
    d3ResidualShortage: Math.max(0, required - d3InventoryOnlyEnvelope),
    fullCashToInventoryRecoveryPotential: recoveryPotential,
    d1RecoveryShareOfPotential: recoveryPotential > EPS ? d1Recovery / recoveryPotential : 0,
    d2RecoveryShareOfPotential: recoveryPotential > EPS ? d2Recovery / recoveryPotential : 0,
    d1ExposureToOperatingScale: operatingScale > EPS ? d1Payable / operatingScale : 0,
    d2ExposureToOperatingScale: operatingScale > EPS ? d2Payable / operatingScale : 0
  };
}

function aggregate(rows) {
  const sum = key => rows.reduce((s, r) => s + finite(r[key]), 0);
  const recoveryPotential = sum('fullCashToInventoryRecoveryPotential');
  const d1Recovery = sum('d1IncrementalFinancedUnits');
  const d2Recovery = sum('d2IncrementalFinancedUnits');
  return {
    buyers: rows.length,
    requiredInputUnits: sum('requiredInputUnits'),
    unmetInputUnits: sum('unmetInputUnits'),
    d0FullCashEnvelope: sum('d0FullCashEnvelope'),
    d1Net30Envelope: sum('d1Net30Envelope'),
    d2Net60Envelope: sum('d2Net60Envelope'),
    d3InventoryOnlyEnvelope: sum('d3InventoryOnlyEnvelope'),
    d1IncrementalFinancedUnits: d1Recovery,
    d2IncrementalFinancedUnits: d2Recovery,
    d1BuyerPayable: sum('d1BuyerPayable'),
    d1SellerReceivable: sum('d1SellerReceivable'),
    d2BuyerPayable: sum('d2BuyerPayable'),
    d2SellerReceivable: sum('d2SellerReceivable'),
    d1ResidualShortage: sum('d1ResidualShortage'),
    d2ResidualShortage: sum('d2ResidualShortage'),
    d3ResidualShortage: sum('d3ResidualShortage'),
    fullCashToInventoryRecoveryPotential: recoveryPotential,
    d1RecoveryShareOfPotential: recoveryPotential > EPS ? d1Recovery / recoveryPotential : 0,
    d2RecoveryShareOfPotential: recoveryPotential > EPS ? d2Recovery / recoveryPotential : 0,
    buyersWithD1Payables: rows.filter(r => r.d1BuyerPayable > EPS).length,
    buyersWithD2Payables: rows.filter(r => r.d2BuyerPayable > EPS).length,
    sellersWithD1Receivables: new Set(rows.flatMap(r => r.d1SellerReceivables.filter(x => x.receivable > EPS).map(x => x.sellerId))).size,
    sellersWithD2Receivables: new Set(rows.flatMap(r => r.d2SellerReceivables.filter(x => x.receivable > EPS).map(x => x.sellerId))).size
  };
}

export class InvoiceTradeCreditShadowContract {
  constructor({ ledger }) {
    if (!ledger) throw new Error('ledger is required');
    this.ledger = ledger;
  }

  report(countries, month = 0) {
    const countryReports = [];
    const issues = [];

    for (const country of countries || []) {
      const rows = activeFirms(country)
        .filter(f => f.inputProduct)
        .map(f => rowFor(country, f, this.ledger));
      const countryAggregate = aggregate(rows);
      countryReports.push({ countryId: String(country.id), month, rows, aggregate: countryAggregate });

      for (const row of rows) {
        if (row.d0FullCashEnvelope > row.d1Net30Envelope + 1e-7) issues.push({ countryId: country.id, buyerId: row.buyerId, type: 'D0_EXCEEDS_D1' });
        if (row.d1Net30Envelope > row.d2Net60Envelope + 1e-7) issues.push({ countryId: country.id, buyerId: row.buyerId, type: 'D1_EXCEEDS_D2' });
        if (row.d2Net60Envelope > row.d3InventoryOnlyEnvelope + 1e-7) issues.push({ countryId: country.id, buyerId: row.buyerId, type: 'D2_EXCEEDS_D3' });
        if (row.d3InventoryOnlyEnvelope > row.requiredInputUnits + 1e-7) issues.push({ countryId: country.id, buyerId: row.buyerId, type: 'D3_EXCEEDS_REQUIREMENT' });
        if (Math.abs(row.d1BuyerPayable - row.d1SellerReceivable) > 1e-7) issues.push({ countryId: country.id, buyerId: row.buyerId, type: 'D1_AP_AR_MISMATCH' });
        if (Math.abs(row.d2BuyerPayable - row.d2SellerReceivable) > 1e-7) issues.push({ countryId: country.id, buyerId: row.buyerId, type: 'D2_AP_AR_MISMATCH' });
        for (const key of ['d1BuyerPayable','d1SellerReceivable','d2BuyerPayable','d2SellerReceivable','d1IncrementalFinancedUnits','d2IncrementalFinancedUnits']) {
          if (!Number.isFinite(row[key]) || row[key] < -1e-9) issues.push({ countryId: country.id, buyerId: row.buyerId, type: 'INVALID_EXPOSURE', field: key });
        }
      }
    }

    const totals = aggregate(countryReports.flatMap(c => c.rows));
    if (Math.abs(totals.d1BuyerPayable - totals.d1SellerReceivable) > 1e-7) issues.push({ type: 'AGGREGATE_D1_AP_AR_MISMATCH' });
    if (Math.abs(totals.d2BuyerPayable - totals.d2SellerReceivable) > 1e-7) issues.push({ type: 'AGGREGATE_D2_AP_AR_MISMATCH' });

    return {
      version: 'r4-cf-d-invoice-trade-credit-shadow-contract-v1',
      month,
      countries: countryReports,
      totals,
      validation: { ok: issues.length === 0, issues }
    };
  }
}
