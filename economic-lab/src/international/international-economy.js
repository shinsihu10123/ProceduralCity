import { ACCOUNT_TYPES } from '../accounting/general-ledger.js';
import { clamp } from '../core/rng.js';
import { evaluateForeignFunding } from '../ai/international-reasoning.js';

const EPS = 1e-8;

export class InternationalEconomySystem {
  constructor({ ledger, accounting, rng }) {
    this.ledger = ledger;
    this.accounting = accounting;
    this.rng = rng;
    this.tradeSequence = 1;
    this.fundingSequence = 1;
    this.trades = [];
    this.fundingContracts = [];
    this.pairFriction = new Map();
  }

  emptyMetrics() {
    return {
      exportsWXU: 0,
      importsWXU: 0,
      exportsLocal: 0,
      importsLocal: 0,
      consumerImportsLocal: 0,
      capitalImportsLocal: 0,
      intermediateImportsLocal: 0,
      tariffRevenue: 0,
      tradeTransactions: 0,
      importUnits: 0,
      exportUnits: 0,
      tradeBalanceWXU: 0,
      netPrimaryIncomeWXU: 0,
      currentAccountWXU: 0,
      financialAccountNetInflowWXU: 0,
      formalFundingInflowWXU: 0,
      formalFundingOutflowWXU: 0,
      foreignFundingOriginations: 0,
      foreignFundingPrincipalDueWXU: 0,
      foreignInterestPaidWXU: 0,
      foreignInterestReceivedWXU: 0,
      foreignDebtWXU: 0,
      netForeignAssetsWXU: 0,
      fxRate: 1,
      fxChange: 0,
      tariffRate: 0,
      externalStress: 0,
      accountingOk: true,
      receivableBookError: 0,
      payableBookError: 0,
      foreignLoanBookError: 0,
      foreignBorrowingBookError: 0,
      globalNFAErrorWXU: 0,
      globalTradeErrorWXU: 0
    };
  }

  initializeWorld(countries) {
    const gl = this.accounting.gl;
    for (const country of countries) {
      const bank = country.banks[0];
      country.fx = {
        currency: `${country.id}C`,
        rate: clamp(country.initialPrice, 0.55, 1.65),
        lastChange: 0,
        volatility: clamp(0.008 + (1 - country.financialAccess) * 0.007, 0.006, 0.018)
      };
      country.tradePolicy = {
        tariffRate: clamp(0.075 - country.openness * 0.055 + this.rng.normal(0, 0.004), 0.012, 0.085)
      };
      country.internationalPosition = {
        receivablesWXU: 0,
        payablesWXU: 0,
        foreignLoansWXU: 0,
        foreignBorrowingWXU: 0,
        bookReceivablesLocal: 0,
        bookPayablesLocal: 0,
        bookForeignLoansLocal: 0,
        bookForeignBorrowingLocal: 0
      };
      country.lastInternational = { ...this.emptyMetrics(), fxRate: country.fx.rate, tariffRate: country.tradePolicy.tariffRate };
      country.internationalHistory = [{ month: 0, ...country.lastInternational }];
      country.lastForeignFundingTrace = null;

      gl.addAccount(bank.id, { code: 'foreign_receivables', name: 'Foreign Settlement Receivables', type: ACCOUNT_TYPES.ASSET });
      gl.addAccount(bank.id, { code: 'foreign_loans', name: 'Cross-Border Bank Loans', type: ACCOUNT_TYPES.ASSET });
      gl.addAccount(bank.id, { code: 'foreign_payables', name: 'Foreign Settlement Payables', type: ACCOUNT_TYPES.LIABILITY });
      gl.addAccount(bank.id, { code: 'foreign_borrowing', name: 'Cross-Border Bank Borrowing', type: ACCOUNT_TYPES.LIABILITY });
      gl.addAccount(bank.id, { code: 'foreign_interest_expense', name: 'Foreign Funding Interest', type: ACCOUNT_TYPES.EXPENSE });
    }

    for (let i = 0; i < countries.length; i++) {
      for (let j = i + 1; j < countries.length; j++) {
        const a = countries[i];
        const b = countries[j];
        const structural = 0.018 + (2 - a.openness - b.openness) * 0.032;
        this.pairFriction.set(this.pairKey(a.id, b.id), clamp(structural + this.rng.range(0.004, 0.028), 0.018, 0.095));
      }
    }
  }

  beginMonth(countries, month) {
    this.updateExchangeRates(countries);
    for (const country of countries) {
      country.lastInternational = {
        ...this.emptyMetrics(),
        fxRate: country.fx.rate,
        fxChange: country.fx.lastChange,
        tariffRate: country.tradePolicy.tariffRate
      };
      for (const f of country.firms) {
        f.internationalSalesUnits = 0;
        f.internationalRevenue = 0;
        f.internationalPurchases = 0;
      }
      for (const h of country.households) h.importConsumptionCarry = 0;
    }

    this.serviceForeignFunding(countries, month);
    this.clearIntermediateImports(countries, month);
    this.clearCapitalImports(countries, month);
    this.clearConsumerImports(countries, month);
    this.formalizeForeignFunding(countries, month);
    this.finalizeMetrics(countries, month);
  }

  updateExchangeRates(countries) {
    const averagePolicy = countries.reduce((s, c) => s + Number(c.macro?.policyRate || 0.03), 0) / Math.max(1, countries.length);
    for (const country of countries) {
      const prior = country.lastInternational || this.emptyMetrics();
      const tradeScale = Math.max(1, Number(prior.exportsWXU || 0) + Number(prior.importsWXU || 0));
      const tradePressure = clamp((Number(prior.importsWXU || 0) - Number(prior.exportsWXU || 0)) / tradeScale, -1, 1);
      const gdpWXU = Math.max(1, Number(country.macro?.gdp || 0) / Math.max(0.05, country.fx.rate));
      const debt = this.foreignDebtWXU(country);
      const debtPressure = clamp(debt / Math.max(1, gdpWXU * 12), 0, 1.2);
      const rateDifferential = Number(country.macro?.policyRate || 0.03) - averagePolicy;
      const momentum = clamp(Number(country.fx.lastChange || 0), -0.08, 0.08);
      const noise = this.rng.normal(0, country.fx.volatility);
      const change = clamp(
        tradePressure * 0.026 +
        debtPressure * 0.018 -
        rateDifferential * 0.22 +
        momentum * 0.12 +
        noise,
        -0.055,
        0.075
      );
      country.fx.rate = clamp(country.fx.rate * Math.exp(change), 0.28, 3.8);
      country.fx.lastChange = change;
    }
  }

  clearIntermediateImports(countries, month) {
    for (const importer of countries) {
      const buyers = importer.firms.filter(f => f.active !== false && f.inputProduct);
      for (const buyer of buyers) {
        const onHand = Math.max(0, buyer.inputInventory?.[buyer.inputProduct] || 0);
        const priorDesired = Math.max(0, Number(buyer.desiredProduction || 0));
        const required = priorDesired * Math.max(0, Number(buyer.inputPerOutput || 0));
        let need = Math.max(Number(buyer.supplyShortage || 0), required - onHand);
        if (need <= 0.15) continue;
        for (let round = 0; round < 2 && need > 0.15; round++) {
          const offer = this.chooseForeignSupplier(countries, importer, buyer.inputProduct, buyer, 'input');
          if (!offer) break;
          const cash = this.ledger.balance(buyer.accountId);
          const budget = Math.min(cash * 0.18, buyer.safeCash * 0.34);
          const unitTotal = offer.importUnitPriceLocal * (1 + importer.tradePolicy.tariffRate);
          const units = Math.min(need, offer.seller.inventory, budget / Math.max(0.01, unitTotal));
          if (units <= 0.08) break;
          const trade = this.settleTrade({ importer, exporter: offer.exporter, buyer, seller: offer.seller, month, units, product: buyer.inputProduct, purchaseType: 'input' });
          if (!trade) break;
          need = Math.max(0, need - trade.units);
        }
      }
    }
  }

  clearCapitalImports(countries, month) {
    for (const importer of countries) {
      const buyers = importer.firms.filter(f => f.active !== false && f.industryId !== 'CAPITAL');
      for (const buyer of buyers) {
        const utilization = buyer.capacity > EPS ? Number(buyer.desiredProduction || 0) / buyer.capacity : 0;
        const expansion = buyer.currentPlan?.selected === '확장' || utilization > 0.94;
        const cash = this.ledger.balance(buyer.accountId);
        if (!expansion || cash < buyer.safeCash * 0.9) continue;
        if (this.rng.next() > importer.openness * 0.34) continue;
        const offer = this.chooseForeignSupplier(countries, importer, 'capital_good', buyer, 'capital');
        if (!offer) continue;
        const budget = Math.min(cash * 0.032, buyer.safeCash * 0.11);
        const unitTotal = offer.importUnitPriceLocal * (1 + importer.tradePolicy.tariffRate);
        const units = Math.min(3.5, offer.seller.inventory, budget / Math.max(0.01, unitTotal));
        if (units <= 0.08) continue;
        this.settleTrade({ importer, exporter: offer.exporter, buyer, seller: offer.seller, month, units, product: 'capital_good', purchaseType: 'capital' });
      }
    }
  }

  clearConsumerImports(countries, month) {
    for (const importer of countries) {
      const goods = importer.lastMarkets?.goods || {};
      const unmetRatio = Number(goods.desiredBudget || 0) > 0 ? clamp(Number(goods.unmetBudget || 0) / Number(goods.desiredBudget || 1), 0, 1) : 0;
      if (unmetRatio < 0.01 && this.rng.next() > importer.openness * 0.18) continue;
      const households = importer.households
        .filter(h => this.ledger.balance(h.accountId) > Math.max(4, h.wage * 0.18))
        .slice(0, Math.min(48, importer.households.length));
      for (const h of households) {
        if (this.rng.next() > importer.openness * (0.10 + unmetRatio * 0.42)) continue;
        const offer = this.chooseForeignSupplier(countries, importer, 'consumer_good', h, 'consumer');
        if (!offer) break;
        const cash = this.ledger.balance(h.accountId);
        const budget = Math.min(cash * 0.018, h.wage * (0.07 + unmetRatio * 0.16));
        const unitTotal = offer.importUnitPriceLocal * (1 + importer.tradePolicy.tariffRate);
        const units = Math.min(offer.seller.inventory, budget / Math.max(0.01, unitTotal));
        if (units <= 0.03) continue;
        this.settleTrade({ importer, exporter: offer.exporter, buyer: h, seller: offer.seller, month, units, product: 'consumer_good', purchaseType: 'consumer' });
      }
    }
  }

  chooseForeignSupplier(countries, importer, product, buyer, purchaseType) {
    const candidates = [];
    for (const exporter of countries) {
      if (exporter.id === importer.id) continue;
      for (const seller of exporter.firms) {
        if (seller.active === false || seller.product !== product || seller.inventory <= EPS) continue;
        const worldUnitPrice = seller.price / Math.max(0.05, exporter.fx.rate);
        const localPrice = worldUnitPrice * importer.fx.rate;
        const friction = this.pairFriction.get(this.pairKey(importer.id, exporter.id)) || 0.05;
        const reliability = 0.76 + Math.min(0.34, seller.productivity * 0.18);
        const externalStress = this.externalStress(importer);
        const score = localPrice * (1 + importer.tradePolicy.tariffRate + friction + externalStress * 0.08) / reliability * (0.975 + this.rng.next() * 0.05);
        candidates.push({ exporter, seller, score, importUnitPriceLocal: localPrice, purchaseType });
      }
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.score - b.score || a.seller.id.localeCompare(b.seller.id));
    const shortlist = candidates.slice(0, Math.min(7, candidates.length));
    return shortlist[this.rng.int(0, Math.min(3, shortlist.length))] || shortlist[0];
  }

  settleTrade({ importer, exporter, buyer, seller, month, units, product, purchaseType }) {
    if (importer.id === exporter.id || units <= EPS || seller.inventory <= EPS) return null;
    const tariffRate = importer.tradePolicy.tariffRate;
    const worldUnitPrice = seller.price / Math.max(0.05, exporter.fx.rate);
    const requestedWorldValue = Math.min(units, seller.inventory) * worldUnitPrice;
    const capacityWXU = this.externalTradeCapacityWXU(importer);
    const cash = this.ledger.balance(buyer.accountId);
    const maxByCashWXU = cash / Math.max(0.05, importer.fx.rate * (1 + tariffRate));
    const worldValue = Math.min(requestedWorldValue, capacityWXU, maxByCashWXU);
    if (worldValue <= 0.01) return null;

    const settledUnits = worldValue / Math.max(EPS, worldUnitPrice);
    const importerBaseLocal = worldValue * importer.fx.rate;
    const tariffLocal = importerBaseLocal * tariffRate;
    const exporterReceiptLocal = worldValue * exporter.fx.rate;
    const totalAcquisitionLocal = importerBaseLocal + tariffLocal;

    const importDelta = this.ledger.adjustMoney({
      month,
      countryId: importer.id,
      accountId: buyer.accountId,
      amount: -importerBaseLocal,
      kind: 'fx_import_payment',
      meta: { importerId: importer.id, exporterId: exporter.id, buyerId: buyer.id, sellerId: seller.id, product, units: settledUnits, worldValue }
    });
    const paidBase = Math.max(0, -importDelta);
    if (paidBase <= EPS) return null;
    const actualWorldValue = paidBase / importer.fx.rate;
    const actualUnits = actualWorldValue / Math.max(EPS, worldUnitPrice);
    const actualExporterReceipt = actualWorldValue * exporter.fx.rate;
    const actualTariff = paidBase * tariffRate;
    const actualTotal = paidBase + actualTariff;

    const exportDelta = this.ledger.adjustMoney({
      month,
      countryId: exporter.id,
      accountId: seller.accountId,
      amount: actualExporterReceipt,
      kind: 'fx_export_receipt',
      meta: { importerId: importer.id, exporterId: exporter.id, buyerId: buyer.id, sellerId: seller.id, product, units: actualUnits, worldValue: actualWorldValue }
    });
    if (exportDelta <= EPS) throw new Error('international exporter settlement failed');

    const government = importer.governments[0];
    const tariffPaid = actualTariff > EPS ? this.ledger.transfer({
      month,
      countryId: importer.id,
      from: buyer.accountId,
      to: government.accountId,
      amount: actualTariff,
      kind: 'tariff_payment',
      meta: { importerId: importer.id, exporterId: exporter.id, payerId: buyer.id, product, worldValue: actualWorldValue }
    }) : 0;

    const sellerUnitCost = Math.max(0, seller.bookUnitCost || seller.price * 0.46);
    const sellerCost = Math.min(
      Math.max(0, this.accounting.gl.naturalBalance(seller.id, 'inventory')),
      actualUnits * sellerUnitCost
    );

    this.recordTradeAccounting({ importer, exporter, buyer, seller, government, month, purchaseType, product, units: actualUnits, importerBaseLocal: paidBase, tariffLocal: tariffPaid, exporterReceiptLocal: actualExporterReceipt, sellerCost });
    this.updatePhysicalTrade({ buyer, seller, purchaseType, product, units: actualUnits, acquisitionLocal: paidBase + tariffPaid, exporterReceiptLocal: actualExporterReceipt });
    this.updatePositionsForTrade(importer, exporter, actualWorldValue, paidBase, actualExporterReceipt);

    const trade = {
      id: `IT-${String(this.tradeSequence++).padStart(9, '0')}`,
      month,
      importerId: importer.id,
      exporterId: exporter.id,
      buyerId: buyer.id,
      sellerId: seller.id,
      purchaseType,
      product,
      units: actualUnits,
      worldValue: actualWorldValue,
      importerBaseLocal: paidBase,
      tariffLocal: tariffPaid,
      exporterReceiptLocal: actualExporterReceipt,
      importerFxRate: importer.fx.rate,
      exporterFxRate: exporter.fx.rate
    };
    this.trades.push(trade);
    if (this.trades.length > 30000) this.trades.splice(0, this.trades.length - 30000);

    const im = importer.lastInternational;
    const ex = exporter.lastInternational;
    im.importsWXU += actualWorldValue;
    im.importsLocal += paidBase;
    im.tariffRevenue += tariffPaid;
    im.tradeTransactions += 1;
    im.importUnits += actualUnits;
    if (purchaseType === 'consumer') im.consumerImportsLocal += paidBase + tariffPaid;
    if (purchaseType === 'capital') im.capitalImportsLocal += paidBase + tariffPaid;
    if (purchaseType === 'input') im.intermediateImportsLocal += paidBase + tariffPaid;
    ex.exportsWXU += actualWorldValue;
    ex.exportsLocal += actualExporterReceipt;
    ex.tradeTransactions += 1;
    ex.exportUnits += actualUnits;
    return trade;
  }

  recordTradeAccounting({ importer, exporter, buyer, seller, government, month, purchaseType, units, importerBaseLocal, tariffLocal, exporterReceiptLocal, sellerCost }) {
    const gl = this.accounting.gl;
    const importerBank = importer.banks[0];
    const exporterBank = exporter.banks[0];
    const total = importerBaseLocal + tariffLocal;
    const buyerAccount = purchaseType === 'consumer' ? 'consumption_expense' : purchaseType === 'capital' ? 'fixed_assets' : 'input_inventory';

    gl.post({
      month,
      entityId: buyer.id,
      kind: `international_${purchaseType}_import`,
      lines: [
        { account: buyerAccount, debit: total },
        { account: 'cash', credit: total }
      ],
      meta: { exporterId: exporter.id, sellerId: seller.id, units }
    });
    gl.post({
      month,
      entityId: seller.id,
      kind: 'international_export_sale',
      lines: [
        { account: 'cash', debit: exporterReceiptLocal },
        { account: 'sales_revenue', credit: exporterReceiptLocal }
      ],
      meta: { importerId: importer.id, buyerId: buyer.id, units }
    });
    if (sellerCost > EPS) {
      gl.post({
        month,
        entityId: seller.id,
        kind: 'international_export_cogs',
        lines: [
          { account: 'cogs', debit: sellerCost },
          { account: 'inventory', credit: sellerCost }
        ],
        meta: { importerId: importer.id, buyerId: buyer.id, units }
      });
    }
    gl.post({
      month,
      entityId: importerBank.id,
      kind: 'international_import_settlement',
      lines: [
        { account: 'deposits', debit: importerBaseLocal },
        { account: 'foreign_payables', credit: importerBaseLocal }
      ],
      meta: { exporterId: exporter.id, buyerId: buyer.id }
    });
    gl.post({
      month,
      entityId: exporterBank.id,
      kind: 'international_export_settlement',
      lines: [
        { account: 'foreign_receivables', debit: exporterReceiptLocal },
        { account: 'deposits', credit: exporterReceiptLocal }
      ],
      meta: { importerId: importer.id, sellerId: seller.id }
    });
    if (tariffLocal > EPS) {
      gl.post({
        month,
        entityId: government.id,
        kind: 'tariff_receipt',
        lines: [
          { account: 'cash', debit: tariffLocal },
          { account: 'tax_revenue', credit: tariffLocal }
        ],
        meta: { payerId: buyer.id, exporterId: exporter.id }
      });
    }
  }

  updatePhysicalTrade({ buyer, seller, purchaseType, product, units, acquisitionLocal, exporterReceiptLocal }) {
    seller.inventory = Math.max(0, seller.inventory - units);
    seller.internationalSalesUnits = (seller.internationalSalesUnits || 0) + units;
    seller.internationalRevenue = (seller.internationalRevenue || 0) + exporterReceiptLocal;
    if (purchaseType === 'input') {
      buyer.inputInventory[product] = (buyer.inputInventory[product] || 0) + units;
      buyer.inputBookValues[product] = (buyer.inputBookValues[product] || 0) + acquisitionLocal;
      buyer.internationalPurchases = (buyer.internationalPurchases || 0) + acquisitionLocal;
    } else if (purchaseType === 'capital') {
      buyer.capitalStock += units * 0.72;
      buyer.capitalBookValue = (buyer.capitalBookValue || 0) + acquisitionLocal;
      buyer.internationalPurchases = (buyer.internationalPurchases || 0) + acquisitionLocal;
    } else {
      buyer.importConsumptionCarry = (buyer.importConsumptionCarry || 0) + acquisitionLocal;
    }
  }

  updatePositionsForTrade(importer, exporter, worldValue, importerBookLocal, exporterBookLocal) {
    const ip = importer.internationalPosition;
    const ep = exporter.internationalPosition;
    ip.payablesWXU += worldValue;
    ip.bookPayablesLocal += importerBookLocal;
    ep.receivablesWXU += worldValue;
    ep.bookReceivablesLocal += exporterBookLocal;
  }

  formalizeForeignFunding(countries, month) {
    const borrowers = countries.slice().sort((a, b) => b.internationalPosition.payablesWXU - a.internationalPosition.payablesWXU);
    for (const borrower of borrowers) {
      let need = borrower.internationalPosition.payablesWXU * 0.58;
      if (need <= 0.05) continue;
      const lenders = countries
        .filter(c => c.id !== borrower.id && c.internationalPosition.receivablesWXU > 0.05)
        .sort((a, b) => b.internationalPosition.receivablesWXU - a.internationalPosition.receivablesWXU);
      for (const lender of lenders) {
        if (need <= 0.05) break;
        const available = lender.internationalPosition.receivablesWXU * 0.62;
        const requested = Math.min(need, available);
        if (requested <= 0.05) continue;
        const decision = evaluateForeignFunding({
          lenderCountry: lender,
          borrowerCountry: borrower,
          lenderBank: lender.banks[0],
          borrowerBank: borrower.banks[0],
          requestedWXU: requested,
          accounting: this.accounting,
          rng: this.rng
        });
        lender.lastForeignFundingTrace = decision.trace;
        borrower.lastForeignFundingTrace = decision.trace;
        if (!decision.approved) continue;
        const funded = this.createFundingContract(lender, borrower, month, requested, decision.annualRate);
        if (funded > EPS) {
          need -= funded;
          borrower.lastInternational.formalFundingInflowWXU += funded;
          borrower.lastInternational.foreignFundingOriginations += 1;
          lender.lastInternational.formalFundingOutflowWXU += funded;
          lender.lastInternational.foreignFundingOriginations += 1;
        }
      }
    }
  }

  createFundingContract(lender, borrower, month, amountWXU, annualRate) {
    const lp = lender.internationalPosition;
    const bp = borrower.internationalPosition;
    const amount = Math.min(amountWXU, lp.receivablesWXU, bp.payablesWXU);
    if (amount <= EPS) return 0;
    const lenderBookRate = lp.receivablesWXU > EPS ? lp.bookReceivablesLocal / lp.receivablesWXU : lender.fx.rate;
    const borrowerBookRate = bp.payablesWXU > EPS ? bp.bookPayablesLocal / bp.payablesWXU : borrower.fx.rate;
    const lenderBook = amount * lenderBookRate;
    const borrowerBook = amount * borrowerBookRate;
    const gl = this.accounting.gl;
    const lenderBank = lender.banks[0];
    const borrowerBank = borrower.banks[0];

    gl.post({
      month,
      entityId: borrowerBank.id,
      kind: 'foreign_funding_origination',
      lines: [
        { account: 'foreign_payables', debit: borrowerBook },
        { account: 'foreign_borrowing', credit: borrowerBook }
      ],
      meta: { lenderCountryId: lender.id, amountWXU: amount }
    });
    gl.post({
      month,
      entityId: lenderBank.id,
      kind: 'foreign_funding_asset',
      lines: [
        { account: 'foreign_loans', debit: lenderBook },
        { account: 'foreign_receivables', credit: lenderBook }
      ],
      meta: { borrowerCountryId: borrower.id, amountWXU: amount }
    });

    lp.receivablesWXU -= amount;
    lp.foreignLoansWXU += amount;
    lp.bookReceivablesLocal -= lenderBook;
    lp.bookForeignLoansLocal += lenderBook;
    bp.payablesWXU -= amount;
    bp.foreignBorrowingWXU += amount;
    bp.bookPayablesLocal -= borrowerBook;
    bp.bookForeignBorrowingLocal += borrowerBook;

    this.fundingContracts.push({
      id: `XF-${String(this.fundingSequence++).padStart(8, '0')}`,
      lenderCountryId: lender.id,
      borrowerCountryId: borrower.id,
      originalPrincipalWXU: amount,
      outstandingWXU: amount,
      annualRate,
      monthlyRate: annualRate / 12,
      termMonths: 18 + this.rng.int(0, 19),
      originatedMonth: month,
      nextPaymentMonth: month + 1,
      lenderBookLocalOutstanding: lenderBook,
      borrowerBookLocalOutstanding: borrowerBook,
      status: 'active'
    });
    return amount;
  }

  serviceForeignFunding(countries, month) {
    const byId = new Map(countries.map(c => [c.id, c]));
    const gl = this.accounting.gl;
    for (const contract of this.fundingContracts) {
      if (contract.status !== 'active' || month < contract.nextPaymentMonth) continue;
      const lender = byId.get(contract.lenderCountryId);
      const borrower = byId.get(contract.borrowerCountryId);
      if (!lender || !borrower) continue;
      const principalWXU = Math.min(contract.outstandingWXU, contract.originalPrincipalWXU / contract.termMonths);
      const interestWXU = contract.outstandingWXU * contract.monthlyRate;
      const ratio = contract.outstandingWXU > EPS ? principalWXU / contract.outstandingWXU : 0;
      const borrowerPrincipalBook = contract.borrowerBookLocalOutstanding * ratio;
      const lenderPrincipalBook = contract.lenderBookLocalOutstanding * ratio;
      const borrowerInterestLocal = interestWXU * borrower.fx.rate;
      const lenderInterestLocal = interestWXU * lender.fx.rate;
      const borrowerBank = borrower.banks[0];
      const lenderBank = lender.banks[0];

      gl.post({
        month,
        entityId: borrowerBank.id,
        kind: 'foreign_funding_debt_service',
        lines: [
          ...(borrowerPrincipalBook > EPS ? [{ account: 'foreign_borrowing', debit: borrowerPrincipalBook }] : []),
          ...(borrowerInterestLocal > EPS ? [{ account: 'foreign_interest_expense', debit: borrowerInterestLocal }] : []),
          { account: 'foreign_payables', credit: borrowerPrincipalBook + borrowerInterestLocal }
        ],
        meta: { contractId: contract.id, lenderCountryId: lender.id }
      });
      gl.post({
        month,
        entityId: lenderBank.id,
        kind: 'foreign_funding_receivable',
        lines: [
          { account: 'foreign_receivables', debit: lenderPrincipalBook + lenderInterestLocal },
          ...(lenderPrincipalBook > EPS ? [{ account: 'foreign_loans', credit: lenderPrincipalBook }] : []),
          ...(lenderInterestLocal > EPS ? [{ account: 'interest_income', credit: lenderInterestLocal }] : [])
        ],
        meta: { contractId: contract.id, borrowerCountryId: borrower.id }
      });

      const bp = borrower.internationalPosition;
      const lp = lender.internationalPosition;
      bp.foreignBorrowingWXU = Math.max(0, bp.foreignBorrowingWXU - principalWXU);
      bp.payablesWXU += principalWXU + interestWXU;
      bp.bookForeignBorrowingLocal = Math.max(0, bp.bookForeignBorrowingLocal - borrowerPrincipalBook);
      bp.bookPayablesLocal += borrowerPrincipalBook + borrowerInterestLocal;
      lp.foreignLoansWXU = Math.max(0, lp.foreignLoansWXU - principalWXU);
      lp.receivablesWXU += principalWXU + interestWXU;
      lp.bookForeignLoansLocal = Math.max(0, lp.bookForeignLoansLocal - lenderPrincipalBook);
      lp.bookReceivablesLocal += lenderPrincipalBook + lenderInterestLocal;

      contract.outstandingWXU = Math.max(0, contract.outstandingWXU - principalWXU);
      contract.borrowerBookLocalOutstanding = Math.max(0, contract.borrowerBookLocalOutstanding - borrowerPrincipalBook);
      contract.lenderBookLocalOutstanding = Math.max(0, contract.lenderBookLocalOutstanding - lenderPrincipalBook);
      contract.nextPaymentMonth = month + 1;
      if (contract.outstandingWXU <= EPS) contract.status = 'repaid';

      borrower.lastInternational.foreignFundingPrincipalDueWXU += principalWXU;
      borrower.lastInternational.foreignInterestPaidWXU += interestWXU;
      borrower.lastInternational.netPrimaryIncomeWXU -= interestWXU;
      lender.lastInternational.foreignInterestReceivedWXU += interestWXU;
      lender.lastInternational.netPrimaryIncomeWXU += interestWXU;
    }
  }

  finalizeMetrics(countries, month) {
    const globalExports = countries.reduce((s, c) => s + c.lastInternational.exportsWXU, 0);
    const globalImports = countries.reduce((s, c) => s + c.lastInternational.importsWXU, 0);
    const globalNFA = countries.reduce((s, c) => s + this.netForeignAssetsWXU(c), 0);
    for (const country of countries) {
      const m = country.lastInternational;
      m.tradeBalanceWXU = m.exportsWXU - m.importsWXU;
      m.currentAccountWXU = m.tradeBalanceWXU + m.netPrimaryIncomeWXU;
      m.financialAccountNetInflowWXU = -m.currentAccountWXU;
      m.foreignDebtWXU = this.foreignDebtWXU(country);
      m.netForeignAssetsWXU = this.netForeignAssetsWXU(country);
      m.externalStress = this.externalStress(country);
      m.fxRate = country.fx.rate;
      m.fxChange = country.fx.lastChange;
      m.tariffRate = country.tradePolicy.tariffRate;
      const verify = this.verifyCountry(country, countries);
      Object.assign(m, verify, {
        globalNFAErrorWXU: globalNFA,
        globalTradeErrorWXU: globalExports - globalImports
      });
      country.internationalHistory.push({ month, ...m });
      if (country.internationalHistory.length > 240) country.internationalHistory.shift();
    }
  }

  verifyCountry(country, countries = null) {
    const gl = this.accounting.gl;
    const bank = country.banks[0];
    const p = country.internationalPosition;
    const receivableBookError = gl.naturalBalance(bank.id, 'foreign_receivables') - p.bookReceivablesLocal;
    const payableBookError = gl.naturalBalance(bank.id, 'foreign_payables') - p.bookPayablesLocal;
    const foreignLoanBookError = gl.naturalBalance(bank.id, 'foreign_loans') - p.bookForeignLoansLocal;
    const foreignBorrowingBookError = gl.naturalBalance(bank.id, 'foreign_borrowing') - p.bookForeignBorrowingLocal;
    const world = countries || [];
    const globalNFAErrorWXU = world.length ? world.reduce((s, c) => s + this.netForeignAssetsWXU(c), 0) : 0;
    return {
      accountingOk:
        Math.abs(receivableBookError) < 1e-5 &&
        Math.abs(payableBookError) < 1e-5 &&
        Math.abs(foreignLoanBookError) < 1e-5 &&
        Math.abs(foreignBorrowingBookError) < 1e-5 &&
        (!world.length || Math.abs(globalNFAErrorWXU) < 1e-6),
      receivableBookError,
      payableBookError,
      foreignLoanBookError,
      foreignBorrowingBookError,
      globalNFAErrorWXU
    };
  }

  externalTradeCapacityWXU(country) {
    const gdpWXU = Math.max(1, Number(country.macro?.gdp || 0) / Math.max(0.05, country.fx.rate));
    const debt = this.foreignDebtWXU(country);
    const maxDebtRatio = 0.14 + country.openness * 0.24 + country.financialAccess * 0.18;
    const maxDebt = gdpWXU * 12 * maxDebtRatio;
    return Math.max(0, Math.min(gdpWXU * (0.22 + country.openness * 0.32), maxDebt - debt));
  }

  externalStress(country) {
    const gdpWXU = Math.max(1, Number(country.macro?.gdp || 0) / Math.max(0.05, country.fx.rate));
    const ratio = this.foreignDebtWXU(country) / Math.max(1, gdpWXU * 12);
    return clamp(ratio / Math.max(0.12, 0.24 + country.financialAccess * 0.18), 0, 1.6);
  }

  foreignDebtWXU(country) {
    const p = country.internationalPosition;
    return Math.max(0, Number(p?.payablesWXU || 0) + Number(p?.foreignBorrowingWXU || 0));
  }

  netForeignAssetsWXU(country) {
    const p = country.internationalPosition;
    return Number(p?.receivablesWXU || 0) + Number(p?.foreignLoansWXU || 0) - Number(p?.payablesWXU || 0) - Number(p?.foreignBorrowingWXU || 0);
  }

  bilateralRate(fromCountry, toCountry) {
    return toCountry.fx.rate / Math.max(0.05, fromCountry.fx.rate);
  }

  pairKey(a, b) {
    return [a, b].sort().join(':');
  }

  recentTrades(month = null, countryId = null, limit = 18) {
    return this.trades.filter(t =>
      (month === null || t.month === month) &&
      (countryId === null || t.importerId === countryId || t.exporterId === countryId)
    ).slice(-limit);
  }

  recentFunding(countryId = null, limit = 12) {
    return this.fundingContracts.filter(c =>
      countryId === null || c.lenderCountryId === countryId || c.borrowerCountryId === countryId
    ).slice(-limit);
  }
}
