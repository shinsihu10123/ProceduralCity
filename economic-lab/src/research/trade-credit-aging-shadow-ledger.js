const EPS = 1e-9;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function activeFirms(country) {
  return (country.firms || []).filter(f => f.active !== false);
}

function firmMap(countries) {
  const map = new Map();
  for (const country of countries || []) {
    for (const firm of activeFirms(country)) map.set(String(firm.id), firm);
  }
  return map;
}

function plannedSalesValue(firm) {
  return Math.max(0, finite(firm.desiredProduction)) * Math.max(0.01, finite(firm.price, 0.01));
}

function inventoryValue(firm) {
  return Math.max(0, finite(firm.inventory)) * Math.max(0.01, finite(firm.price, 0.01));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function sumBy(rows, key) {
  return rows.reduce((sum, row) => sum + finite(row[key]), 0);
}

function statusFor(invoice, month) {
  if (invoice.remainingFaceValue <= EPS) return 'SETTLED';
  if (month > invoice.dueMonth) return 'ARREARS';
  if (month === invoice.dueMonth) return 'DUE';
  return 'CURRENT';
}

function sortInvoicesOldestDue(a, b) {
  return a.dueMonth - b.dueMonth || a.issueMonth - b.issueMonth || String(a.id).localeCompare(String(b.id));
}

function sellerCapacityViews(firm, ledger) {
  return {
    inventoryValueCapacity: inventoryValue(firm),
    salesScaleCapacity: plannedSalesValue(firm),
    liquidityCapacity: Math.max(0, finite(ledger.balance(firm.accountId)))
  };
}

function conservativeCapacity(views) {
  return Math.max(0, Math.min(
    finite(views.inventoryValueCapacity),
    finite(views.salesScaleCapacity),
    finite(views.liquidityCapacity)
  ));
}

function aggregateRows(rows) {
  const recoveryPotential = sumBy(rows, 'unconstrainedRecoveryPotentialUnits');
  const retained = sumBy(rows, 'retainedRecoveryUnits');
  return {
    buyers: rows.length,
    requiredInputUnits: sumBy(rows, 'requiredInputUnits'),
    onHandInputUnits: sumBy(rows, 'onHandInputUnits'),
    baselineFullCashEnvelope: sumBy(rows, 'baselineFullCashEnvelope'),
    riskLimitedEnvelope: sumBy(rows, 'riskLimitedEnvelope'),
    unconstrainedInventoryEnvelope: sumBy(rows, 'unconstrainedInventoryEnvelope'),
    newInvoiceUnits: sumBy(rows, 'newInvoiceUnits'),
    newInvoiceValue: sumBy(rows, 'newInvoiceValue'),
    retainedRecoveryUnits: retained,
    unconstrainedRecoveryPotentialUnits: recoveryPotential,
    retainedRecoveryShare: recoveryPotential > EPS ? retained / recoveryPotential : 0,
    residualShortageRiskLimited: sumBy(rows, 'residualShortageRiskLimited'),
    residualShortageUnconstrained: sumBy(rows, 'residualShortageUnconstrained')
  };
}

export class TradeCreditAgingShadowLedger {
  constructor({ ledger }) {
    if (!ledger) throw new Error('ledger is required');
    this.ledger = ledger;
    this.invoices = [];
    this.sequence = 0;
    this.lastMonth = null;
    this.previousOutstanding = 0;
    this.history = [];
  }

  cloneState() {
    return {
      invoices: this.invoices.map(invoice => ({ ...invoice })),
      sequence: this.sequence,
      lastMonth: this.lastMonth,
      previousOutstanding: this.previousOutstanding,
      history: this.history.map(row => structuredClone(row))
    };
  }

  #openInvoices() {
    return this.invoices.filter(invoice => invoice.remainingFaceValue > EPS);
  }

  #outstandingBySeller() {
    const map = new Map();
    for (const invoice of this.#openInvoices()) {
      const key = String(invoice.sellerId);
      map.set(key, (map.get(key) || 0) + invoice.remainingFaceValue);
    }
    return map;
  }

  #outstandingByBuyer() {
    const map = new Map();
    for (const invoice of this.#openInvoices()) {
      const key = String(invoice.buyerId);
      map.set(key, (map.get(key) || 0) + invoice.remainingFaceValue);
    }
    return map;
  }

  #repay(countries, month) {
    const firms = firmMap(countries);
    const dueByBuyer = new Map();
    for (const invoice of this.#openInvoices()) {
      if (invoice.dueMonth > month) continue;
      const key = String(invoice.buyerId);
      if (!dueByBuyer.has(key)) dueByBuyer.set(key, []);
      dueByBuyer.get(key).push(invoice);
    }

    const repaymentBudget = new Map();
    const repaymentUsed = new Map();
    const paymentEvents = [];
    let dueAmount = 0;
    let paidAmount = 0;

    for (const [buyerId, invoices] of [...dueByBuyer.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const buyer = firms.get(buyerId);
      const budget = buyer ? Math.max(0, finite(this.ledger.balance(buyer.accountId))) : 0;
      repaymentBudget.set(buyerId, budget);
      let remainingBudget = budget;
      invoices.sort(sortInvoicesOldestDue);
      for (const invoice of invoices) {
        const before = invoice.remainingFaceValue;
        dueAmount += before;
        const payment = Math.min(before, remainingBudget);
        if (payment > EPS) {
          invoice.remainingFaceValue = Math.max(0, before - payment);
          invoice.cumulativePaid = finite(invoice.cumulativePaid) + payment;
          remainingBudget -= payment;
          paidAmount += payment;
          paymentEvents.push({
            buyerId,
            invoiceId: invoice.id,
            dueMonth: invoice.dueMonth,
            issueMonth: invoice.issueMonth,
            amount: payment
          });
        }
      }
      repaymentUsed.set(buyerId, budget - remainingBudget);
    }

    for (const invoice of this.invoices) {
      invoice.ageMonths = Math.max(0, month - invoice.issueMonth);
      invoice.status = statusFor(invoice, month);
    }

    return { repaymentBudget, repaymentUsed, paymentEvents, dueAmount, paidAmount };
  }

  #originateCountry(country, month, repayment) {
    const firms = activeFirms(country).slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const sellersByProduct = new Map();
    const remainingInventory = new Map();
    const initialInventory = new Map();
    const sellerViews = new Map();

    for (const seller of firms) {
      const id = String(seller.id);
      const units = Math.max(0, finite(seller.inventory));
      remainingInventory.set(id, units);
      initialInventory.set(id, units);
      sellerViews.set(id, sellerCapacityViews(seller, this.ledger));
      const product = String(seller.product || '');
      if (!sellersByProduct.has(product)) sellersByProduct.set(product, []);
      sellersByProduct.get(product).push(seller);
    }

    const sellerOutstanding = this.#outstandingBySeller();
    const buyerOutstanding = this.#outstandingByBuyer();
    const rows = [];
    const newInvoices = [];
    const sellerUsageUnits = new Map();

    for (const buyer of firms.filter(f => f.inputProduct)) {
      const buyerId = String(buyer.id);
      const product = String(buyer.inputProduct);
      const required = Math.max(0, finite(buyer.desiredProduction) * Math.max(0, finite(buyer.inputPerOutput)));
      const onHand = Math.max(0, finite(buyer.inputInventory?.[product]));
      let unmet = Math.max(0, required - onHand);
      const suppliers = (sellersByProduct.get(product) || []).filter(s => String(s.id) !== buyerId);
      const canonicalCash = Math.max(0, finite(this.ledger.balance(buyer.accountId)));
      const repaymentUsed = Math.max(0, finite(repayment.repaymentUsed.get(buyerId)));
      let analyticalCash = Math.max(0, canonicalCash - repaymentUsed);

      // Baseline full-cash envelope uses the pre-repayment canonical cash signal, matching R4-CF-D's D0 concept.
      let baselineBudget = canonicalCash;
      let baselineProcurement = 0;
      let baselineUnmet = unmet;
      for (const seller of suppliers) {
        if (baselineUnmet <= EPS || baselineBudget <= EPS) break;
        const sellerId = String(seller.id);
        const units = Math.max(0, finite(initialInventory.get(sellerId)));
        const price = Math.max(0.01, finite(seller.price, 0.01));
        const buy = Math.min(baselineUnmet, units, baselineBudget / price);
        baselineProcurement += buy;
        baselineUnmet -= buy;
        baselineBudget -= buy * price;
      }
      const baselineFullCashEnvelope = Math.min(required, onHand + baselineProcurement);

      // Risk-limited path consumes shared shadow inventory so aggregate physical supply cannot be double counted.
      let cashProcurement = 0;
      for (const seller of suppliers) {
        if (unmet <= EPS || analyticalCash <= EPS) break;
        const sellerId = String(seller.id);
        const available = Math.max(0, finite(remainingInventory.get(sellerId)));
        const price = Math.max(0.01, finite(seller.price, 0.01));
        const buy = Math.min(unmet, available, analyticalCash / price);
        if (buy <= EPS) continue;
        remainingInventory.set(sellerId, available - buy);
        sellerUsageUnits.set(sellerId, (sellerUsageUnits.get(sellerId) || 0) + buy);
        cashProcurement += buy;
        unmet -= buy;
        analyticalCash -= buy * price;
      }

      const operatingScale = plannedSalesValue(buyer);
      const existingBuyerPayables = Math.max(0, finite(buyerOutstanding.get(buyerId)));
      let buyerExposureRemaining = Math.max(0, operatingScale - existingBuyerPayables);
      let creditUnits = 0;
      let creditValue = 0;

      for (const seller of suppliers) {
        if (unmet <= EPS || buyerExposureRemaining <= EPS) break;
        const sellerId = String(seller.id);
        const availableUnits = Math.max(0, finite(remainingInventory.get(sellerId)));
        if (availableUnits <= EPS) continue;
        const price = Math.max(0.01, finite(seller.price, 0.01));
        const views = sellerViews.get(sellerId);
        const currentSellerOutstanding = Math.max(0, finite(sellerOutstanding.get(sellerId)));
        const sellerExposureRemaining = Math.max(0, conservativeCapacity(views) - currentSellerOutstanding);
        if (sellerExposureRemaining <= EPS) continue;
        const value = Math.min(unmet * price, availableUnits * price, buyerExposureRemaining, sellerExposureRemaining);
        if (value <= EPS) continue;
        const units = value / price;
        const invoice = {
          id: `R4-CF-E:${String(country.id)}:${month}:${String(++this.sequence).padStart(6, '0')}`,
          countryId: String(country.id),
          buyerId,
          sellerId,
          product,
          issueMonth: month,
          dueMonth: month + 1,
          originalFaceValue: value,
          remainingFaceValue: value,
          cumulativePaid: 0,
          inputUnits: units,
          unitPrice: price,
          contractFamily: 'NET30_D1',
          ageMonths: 0,
          status: 'CURRENT'
        };
        this.invoices.push(invoice);
        newInvoices.push(invoice);
        remainingInventory.set(sellerId, availableUnits - units);
        sellerUsageUnits.set(sellerId, (sellerUsageUnits.get(sellerId) || 0) + units);
        sellerOutstanding.set(sellerId, currentSellerOutstanding + value);
        buyerOutstanding.set(buyerId, (buyerOutstanding.get(buyerId) || 0) + value);
        buyerExposureRemaining -= value;
        creditUnits += units;
        creditValue += value;
        unmet -= units;
      }

      // Shared physical upper bound after the buyer's turn, using what was actually available to this buyer at decision time.
      const supplierInitialUnits = suppliers.reduce((sum, seller) => sum + Math.max(0, finite(initialInventory.get(String(seller.id)))), 0);
      const unconstrainedInventoryEnvelope = Math.min(required, onHand + Math.min(Math.max(0, required - onHand), supplierInitialUnits));
      const riskLimitedEnvelope = Math.min(required, onHand + cashProcurement + creditUnits);
      const unconstrainedPotential = Math.max(0, unconstrainedInventoryEnvelope - baselineFullCashEnvelope);
      const retainedRecovery = Math.max(0, riskLimitedEnvelope - baselineFullCashEnvelope);

      rows.push({
        countryId: String(country.id),
        buyerId,
        product,
        requiredInputUnits: required,
        onHandInputUnits: onHand,
        canonicalCash,
        repaymentUsed,
        analyticalCashAfterRepayment: Math.max(0, canonicalCash - repaymentUsed),
        existingBuyerPayables,
        buyerOperatingScaleValue: operatingScale,
        baselineFullCashEnvelope,
        cashProcurementUnitsAfterRepayment: cashProcurement,
        newInvoiceUnits: creditUnits,
        newInvoiceValue: creditValue,
        riskLimitedEnvelope,
        unconstrainedInventoryEnvelope,
        retainedRecoveryUnits: retainedRecovery,
        unconstrainedRecoveryPotentialUnits: unconstrainedPotential,
        retainedRecoveryShare: unconstrainedPotential > EPS ? retainedRecovery / unconstrainedPotential : 0,
        residualShortageRiskLimited: Math.max(0, required - riskLimitedEnvelope),
        residualShortageUnconstrained: Math.max(0, required - unconstrainedInventoryEnvelope)
      });
    }

    return {
      countryId: String(country.id),
      rows,
      aggregate: aggregateRows(rows),
      newInvoices,
      initialInventory,
      remainingInventory,
      sellerUsageUnits,
      sellerViews
    };
  }

  step(countries, month) {
    if (this.lastMonth !== null && month <= this.lastMonth) throw new Error(`month must increase: ${month} <= ${this.lastMonth}`);
    const openingOutstanding = this.#openInvoices().reduce((sum, invoice) => sum + invoice.remainingFaceValue, 0);
    const repayment = this.#repay(countries, month);
    const countryReports = [];
    const newInvoices = [];

    for (const country of countries || []) {
      const report = this.#originateCountry(country, month, repayment);
      countryReports.push(report);
      newInvoices.push(...report.newInvoices);
    }

    for (const invoice of this.invoices) {
      invoice.ageMonths = Math.max(0, month - invoice.issueMonth);
      invoice.status = statusFor(invoice, month);
    }

    const open = this.#openInvoices();
    const outstanding = open.reduce((sum, invoice) => sum + invoice.remainingFaceValue, 0);
    const arrears = open.filter(invoice => invoice.status === 'ARREARS');
    const arrearsStock = arrears.reduce((sum, invoice) => sum + invoice.remainingFaceValue, 0);
    const newInvoiceValue = newInvoices.reduce((sum, invoice) => sum + invoice.originalFaceValue, 0);
    const newInvoiceUnits = newInvoices.reduce((sum, invoice) => sum + invoice.inputUnits, 0);
    const expectedOutstanding = openingOutstanding + newInvoiceValue - repayment.paidAmount;
    const stockFlowError = outstanding - expectedOutstanding;
    const ages = open.map(invoice => invoice.ageMonths);

    const buyerArrearsMonths = new Map();
    for (const row of this.history) {
      for (const buyerId of row.buyersInArrears || []) buyerArrearsMonths.set(buyerId, (buyerArrearsMonths.get(buyerId) || 0) + 1);
    }
    for (const invoice of arrears) buyerArrearsMonths.set(String(invoice.buyerId), (buyerArrearsMonths.get(String(invoice.buyerId)) || 0) + 1);

    const firms = firmMap(countries);
    const sellerOutstanding = this.#outstandingBySeller();
    const sellerRows = [];
    for (const [sellerId, receivable] of [...sellerOutstanding.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const seller = firms.get(sellerId);
      if (!seller) continue;
      const views = sellerCapacityViews(seller, this.ledger);
      sellerRows.push({
        sellerId,
        receivable,
        ...views,
        conservativeCapacity: conservativeCapacity(views),
        exceedsInventoryValueCapacity: receivable > views.inventoryValueCapacity + 1e-7,
        exceedsSalesScaleCapacity: receivable > views.salesScaleCapacity + 1e-7,
        exceedsLiquidityCapacity: receivable > views.liquidityCapacity + 1e-7,
        exceedsConservativeCapacity: receivable > conservativeCapacity(views) + 1e-7
      });
    }

    const allRows = countryReports.flatMap(report => report.rows);
    const aggregate = aggregateRows(allRows);
    const buyersInArrears = [...new Set(arrears.map(invoice => String(invoice.buyerId)))].sort();
    const persistentArrearsBuyers = [...buyerArrearsMonths.entries()].filter(([, count]) => count >= 3).map(([id]) => id).sort();
    const totalReceivable = outstanding;
    const topSellerReceivable = sellerRows.reduce((max, row) => Math.max(max, row.receivable), 0);

    const issues = [];
    if (Math.abs(stockFlowError) > 1e-7) issues.push({ type: 'INVOICE_STOCK_FLOW_MISMATCH', stockFlowError });
    if (open.some(invoice => invoice.remainingFaceValue < -1e-9 || !Number.isFinite(invoice.remainingFaceValue))) issues.push({ type: 'NEGATIVE_OR_NONFINITE_INVOICE' });
    if (sellerRows.some(row => row.exceedsConservativeCapacity)) issues.push({ type: 'SELLER_CONSERVATIVE_CAPACITY_EXCEEDED', count: sellerRows.filter(row => row.exceedsConservativeCapacity).length });

    for (const countryReport of countryReports) {
      for (const [sellerId, used] of countryReport.sellerUsageUnits.entries()) {
        const initial = Math.max(0, finite(countryReport.initialInventory.get(sellerId)));
        if (used > initial + 1e-7) issues.push({ type: 'PHYSICAL_SUPPLIER_INVENTORY_EXCEEDED', countryId: countryReport.countryId, sellerId, used, initial });
      }
      for (const row of countryReport.rows) {
        if (row.riskLimitedEnvelope > row.requiredInputUnits + 1e-7) issues.push({ type: 'BUYER_REQUIREMENT_EXCEEDED', buyerId: row.buyerId });
      }
    }

    // Verify oldest-due-first ordering for every buyer's payment event sequence.
    const paymentByBuyer = new Map();
    for (const event of repayment.paymentEvents) {
      if (!paymentByBuyer.has(event.buyerId)) paymentByBuyer.set(event.buyerId, []);
      paymentByBuyer.get(event.buyerId).push(event);
    }
    for (const [buyerId, events] of paymentByBuyer.entries()) {
      for (let i = 1; i < events.length; i += 1) {
        const prev = events[i - 1];
        const current = events[i];
        if (prev.dueMonth > current.dueMonth || (prev.dueMonth === current.dueMonth && prev.issueMonth > current.issueMonth)) {
          issues.push({ type: 'OLDEST_DUE_FIRST_VIOLATION', buyerId });
          break;
        }
      }
    }

    const ap = outstanding;
    const ar = outstanding;
    const report = {
      version: 'r4-cf-e-trade-credit-aging-shadow-ledger-v1',
      month,
      flows: {
        openingOutstanding,
        newInvoiceValue,
        newInvoiceUnits,
        dueAmount: repayment.dueAmount,
        paidCapacityAmount: repayment.paidAmount,
        closingOutstanding: outstanding,
        stockFlowError
      },
      stocks: {
        accountsPayable: ap,
        accountsReceivable: ar,
        arrearsStock,
        arrearsRatio: outstanding > EPS ? arrearsStock / outstanding : 0,
        openInvoiceCount: open.length,
        arrearsInvoiceCount: arrears.length,
        medianInvoiceAgeMonths: median(ages),
        maxInvoiceAgeMonths: ages.length ? Math.max(...ages) : 0,
        buyersInArrears: buyersInArrears.length,
        persistentArrearsBuyers: persistentArrearsBuyers.length,
        sellerReceivableConcentrationTop1: totalReceivable > EPS ? topSellerReceivable / totalReceivable : 0
      },
      capacity: {
        sellersWithReceivables: sellerRows.length,
        sellersExceedingInventoryValueCapacity: sellerRows.filter(row => row.exceedsInventoryValueCapacity).length,
        sellersExceedingSalesScaleCapacity: sellerRows.filter(row => row.exceedsSalesScaleCapacity).length,
        sellersExceedingLiquidityCapacity: sellerRows.filter(row => row.exceedsLiquidityCapacity).length,
        sellersExceedingConservativeCapacity: sellerRows.filter(row => row.exceedsConservativeCapacity).length,
        sellerRows
      },
      procurement: aggregate,
      countryReports: countryReports.map(report => ({
        countryId: report.countryId,
        rows: report.rows,
        aggregate: report.aggregate
      })),
      buyersInArrears,
      persistentArrearsBuyerIds: persistentArrearsBuyers,
      paymentEvents: repayment.paymentEvents,
      validation: { ok: issues.length === 0, issues }
    };

    this.lastMonth = month;
    this.previousOutstanding = outstanding;
    this.history.push({
      month,
      buyersInArrears,
      closingOutstanding: outstanding,
      arrearsStock,
      newInvoiceValue,
      paidAmount: repayment.paidAmount
    });
    return structuredClone(report);
  }
}
