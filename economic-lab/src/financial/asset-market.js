import { ACCOUNT_TYPES } from '../accounting/general-ledger.js';
import { clamp } from '../core/rng.js';

const EPS = 1e-8;

export class AssetMarketSystem {
  constructor({ ledger, accounting, rng }) {
    this.ledger = ledger;
    this.accounting = accounting;
    this.rng = rng;
  }

  emptyMetrics() {
    return {
      equityIndex: 100,
      indexReturn: 0,
      marketCapitalization: 0,
      primaryIssuance: 0,
      primaryTransactions: 0,
      secondaryTurnover: 0,
      secondaryTransactions: 0,
      householdEquityBook: 0,
      householdEquityMarketValue: 0,
      financialWealthEffect: 0,
      accountingOk: true,
      equityBookError: 0,
      shareOwnershipError: 0
    };
  }

  initializeCountry(country) {
    const gl = this.accounting.gl;
    for (const h of country.households) {
      gl.addAccount(h.id, { code: 'equity_investments', name: 'Equity Investments', type: ACCOUNT_TYPES.ASSET });
      gl.addAccount(h.id, { code: 'investment_gain_income', name: 'Investment Gain', type: ACCOUNT_TYPES.REVENUE });
      gl.addAccount(h.id, { code: 'investment_loss_expense', name: 'Investment Loss', type: ACCOUNT_TYPES.EXPENSE });
      h.portfolio = h.portfolio || {};
      h.portfolioMarketValue = 0;
    }
    for (const f of country.firms) this.initializeFirm(f);
    country.assetIndex = 100;
    country.lastAssetMarket = this.emptyMetrics();
    country.assetMarketHistory = [{ month: 0, equityIndex: 100, indexReturn: 0 }];
  }

  initializeFirm(firm) {
    const gl = this.accounting.gl;
    gl.addAccount(firm.id, { code: 'paid_in_capital', name: 'Paid-in Equity Capital', type: ACCOUNT_TYPES.EQUITY });
    const bs = gl.balanceSheet(firm.id);
    const openingEquity = Math.max(1, bs.equity);
    const sharesOutstanding = 1000;
    firm.equityMarket = {
      sharesOutstanding,
      publicShares: 0,
      sharePrice: Math.max(0.1, openingEquity / sharesOutstanding),
      previousPrice: Math.max(0.1, openingEquity / sharesOutstanding),
      lastReturn: 0,
      marketCap: openingEquity,
      issuanceCumulative: 0
    };
  }

  registerFirm(firm) {
    this.initializeFirm(firm);
  }

  runMarket(country, month) {
    const metrics = this.emptyMetrics();
    const previousIndex = Math.max(EPS, Number(country.assetIndex || 100));
    this.updatePrices(country);
    this.primaryIssuance(country, month, metrics);
    this.secondaryTrading(country, month, metrics);
    this.updateHouseholdPortfolioValues(country);

    const active = country.firms.filter(f => f.active !== false && f.equityMarket);
    const totalMarketCap = active.reduce((s, f) => s + Math.max(0, f.equityMarket.marketCap), 0);
    const previousMarketCap = active.reduce((s, f) => {
      const m = f.equityMarket;
      return s + Math.max(0, m.previousPrice * m.sharesOutstanding);
    }, 0);
    const capReturn = previousMarketCap > EPS ? totalMarketCap / previousMarketCap - 1 : 0;
    const indexReturn = clamp(capReturn, -0.35, 0.35);
    country.assetIndex = Math.max(1, previousIndex * (1 + indexReturn));

    metrics.equityIndex = country.assetIndex;
    metrics.indexReturn = indexReturn;
    metrics.marketCapitalization = totalMarketCap;
    metrics.householdEquityBook = country.households.reduce((s, h) => s + this.portfolioBookValue(h), 0);
    metrics.householdEquityMarketValue = country.households.reduce((s, h) => s + Number(h.portfolioMarketValue || 0), 0);
    const previousValue = Math.max(1, Number(country.lastAssetMarket?.householdEquityMarketValue || metrics.householdEquityMarketValue));
    metrics.financialWealthEffect = clamp((metrics.householdEquityMarketValue - previousValue) / previousValue, -0.5, 0.5);
    Object.assign(metrics, this.verifyCountry(country));
    country.lastAssetMarket = metrics;
    country.assetMarketHistory.push({ month, equityIndex: metrics.equityIndex, indexReturn: metrics.indexReturn, marketCapitalization: totalMarketCap });
    if (country.assetMarketHistory.length > 240) country.assetMarketHistory.shift();
    return metrics;
  }

  updatePrices(country) {
    const cb = country.centralBanks?.[0];
    const policyRate = Number(cb?.policyRate || 0.04);
    const neutralRate = Number(cb?.neutralRate || 0.04);
    for (const f of country.firms) {
      if (f.active === false || !f.equityMarket) continue;
      const m = f.equityMarket;
      m.previousPrice = m.sharePrice;
      const currentResult = this.accounting.gl.incomeStatement(f.id);
      const marketCap = Math.max(1, m.sharePrice * m.sharesOutstanding);
      const monthlyProfitYield = currentResult.netIncome / marketCap;
      const debt = Math.max(0, Number(f.loanBalance || 0));
      const leverage = debt / Math.max(1, marketCap);
      const demandBelief = clamp(Number(f.beliefs?.demandGrowth || 0), -0.4, 0.4);
      const monetaryPressure = (policyRate - neutralRate) * 1.8;
      const distress = clamp(Number(f.distressMonths || 0) / 8, 0, 1);
      const noisyReturn =
        monthlyProfitYield * 0.75 +
        demandBelief * 0.16 -
        leverage * 0.025 -
        monetaryPressure -
        distress * 0.075 +
        this.rng.normal(0, 0.025);
      const realizedReturn = clamp(noisyReturn, -0.18, 0.18);
      m.sharePrice = Math.max(0.03, m.sharePrice * (1 + realizedReturn));
      m.lastReturn = realizedReturn;
      m.marketCap = m.sharePrice * m.sharesOutstanding;
    }
  }

  primaryIssuance(country, month, metrics) {
    const candidates = country.firms
      .filter(f => f.active !== false && f.equityMarket)
      .map(f => {
        const cash = this.ledger.balance(f.accountId);
        const expansion = f.currentPlan?.selected === '확장' ? 1 : 0;
        const cashGap = Math.max(0, Number(f.safeCash || 0) - cash);
        const utilization = Number(f.capacity || 0) > EPS ? Number(f.output || 0) / Number(f.capacity) : 0;
        return { f, needScore: expansion * 1.2 + cashGap / Math.max(1, f.safeCash || 1) + Math.max(0, utilization - 0.82) };
      })
      .sort((a, b) => b.needScore - a.needScore)
      .slice(0, 5);

    const investors = country.households
      .filter(h => this.ledger.balance(h.accountId) > Math.max(25, h.wage * 1.1))
      .sort((a, b) => (b.optimism - b.riskAversion * 0.35) - (a.optimism - a.riskAversion * 0.35));

    for (const { f, needScore } of candidates) {
      if (needScore < 0.18 || investors.length === 0) continue;
      const market = f.equityMarket;
      const cash = this.ledger.balance(f.accountId);
      const desiredRaise = Math.min(
        Math.max(f.wage * Math.max(1, f.desiredWorkers) * 0.22, Math.max(0, f.safeCash - cash) * 0.45),
        market.marketCap * 0.035
      );
      let remaining = desiredRaise;
      for (const h of investors.slice(0, 20)) {
        if (remaining <= EPS) break;
        const balance = this.ledger.balance(h.accountId);
        const buffer = Math.max(h.wage * (h.employed ? 1.15 : 1.8), 20);
        const excess = Math.max(0, balance - buffer);
        const riskBudget = excess * clamp((1 - h.riskAversion) * 0.11 + Math.max(0, h.optimism) * 0.035, 0.008, 0.12);
        const requested = Math.min(remaining, riskBudget);
        if (requested <= EPS) continue;
        const paid = this.ledger.transfer({
          month,
          countryId: country.id,
          from: h.accountId,
          to: f.accountId,
          amount: requested,
          kind: 'equity_subscription',
          meta: { householdId: h.id, firmId: f.id, sharePrice: market.sharePrice }
        });
        if (paid <= EPS) continue;
        const shares = paid / market.sharePrice;
        this.recordPrimarySubscription(h, f, month, paid, shares);
        market.sharesOutstanding += shares;
        market.publicShares += shares;
        market.issuanceCumulative += paid;
        market.marketCap = market.sharePrice * market.sharesOutstanding;
        remaining -= paid;
        metrics.primaryIssuance += paid;
        metrics.primaryTransactions += 1;
      }
    }
  }

  secondaryTrading(country, month, metrics) {
    const sellers = country.households.filter(h => Object.values(h.portfolio || {}).some(x => x.shares > EPS));
    if (!sellers.length) return;
    const buyers = country.households
      .filter(h => this.ledger.balance(h.accountId) > Math.max(25, h.wage * 1.25))
      .sort((a, b) => (b.optimism - b.riskAversion * 0.3) - (a.optimism - a.riskAversion * 0.3));
    let trades = 0;

    for (const seller of sellers) {
      if (trades >= 12 || !buyers.length) break;
      const positions = Object.entries(seller.portfolio || {})
        .filter(([, p]) => p.shares > EPS)
        .map(([firmId, p]) => ({ firmId, p, firm: country.firms.find(f => f.id === firmId) }))
        .filter(x => x.firm?.equityMarket)
        .sort((a, b) => a.firm.equityMarket.lastReturn - b.firm.equityMarket.lastReturn);
      const position = positions[0];
      if (!position) continue;
      const sellPressure = seller.riskAversion * 0.55 - seller.optimism * 0.15 - position.firm.equityMarket.lastReturn * 2.4;
      if (sellPressure < 0.30) continue;
      const buyer = buyers.find(h => h.id !== seller.id);
      if (!buyer) continue;
      const price = position.firm.equityMarket.sharePrice;
      const shares = Math.min(position.p.shares * clamp(0.08 + sellPressure * 0.08, 0.08, 0.24), 12);
      const requested = shares * price;
      const buyerCash = this.ledger.balance(buyer.accountId);
      const maxSpend = Math.max(0, buyerCash - buyer.wage * 1.1) * 0.08;
      const paid = this.ledger.transfer({
        month,
        countryId: country.id,
        from: buyer.accountId,
        to: seller.accountId,
        amount: Math.min(requested, maxSpend),
        kind: 'equity_secondary_trade',
        meta: { buyerId: buyer.id, sellerId: seller.id, firmId: position.firmId, sharePrice: price }
      });
      if (paid <= EPS) continue;
      const actualShares = Math.min(position.p.shares, paid / price);
      this.recordSecondaryTrade(buyer, seller, position.firm, month, paid, actualShares);
      metrics.secondaryTurnover += paid;
      metrics.secondaryTransactions += 1;
      trades += 1;
    }
  }

  recordPrimarySubscription(household, firm, month, amount, shares) {
    const gl = this.accounting.gl;
    gl.post({
      month,
      entityId: household.id,
      kind: 'equity_subscription',
      lines: [
        { account: 'equity_investments', debit: amount },
        { account: 'cash', credit: amount }
      ],
      meta: { firmId: firm.id, shares }
    });
    gl.post({
      month,
      entityId: firm.id,
      kind: 'equity_issuance',
      lines: [
        { account: 'cash', debit: amount },
        { account: 'paid_in_capital', credit: amount }
      ],
      meta: { householdId: household.id, shares }
    });
    const holding = household.portfolio[firm.id] || { shares: 0, bookValue: 0 };
    holding.shares += shares;
    holding.bookValue += amount;
    household.portfolio[firm.id] = holding;
  }

  recordSecondaryTrade(buyer, seller, firm, month, amount, shares) {
    const gl = this.accounting.gl;
    const sellerHolding = seller.portfolio[firm.id];
    const fraction = Math.min(1, shares / Math.max(EPS, sellerHolding.shares));
    const costBasis = sellerHolding.bookValue * fraction;
    gl.post({
      month,
      entityId: buyer.id,
      kind: 'secondary_equity_purchase',
      lines: [
        { account: 'equity_investments', debit: amount },
        { account: 'cash', credit: amount }
      ],
      meta: { sellerId: seller.id, firmId: firm.id, shares }
    });
    const sellerLines = [{ account: 'cash', debit: amount }, { account: 'equity_investments', credit: costBasis }];
    if (amount > costBasis + EPS) sellerLines.push({ account: 'investment_gain_income', credit: amount - costBasis });
    else if (costBasis > amount + EPS) sellerLines.push({ account: 'investment_loss_expense', debit: costBasis - amount });
    gl.post({
      month,
      entityId: seller.id,
      kind: 'secondary_equity_sale',
      lines: sellerLines,
      meta: { buyerId: buyer.id, firmId: firm.id, shares, costBasis }
    });

    sellerHolding.shares = Math.max(0, sellerHolding.shares - shares);
    sellerHolding.bookValue = Math.max(0, sellerHolding.bookValue - costBasis);
    if (sellerHolding.shares <= EPS) delete seller.portfolio[firm.id];
    const buyerHolding = buyer.portfolio[firm.id] || { shares: 0, bookValue: 0 };
    buyerHolding.shares += shares;
    buyerHolding.bookValue += amount;
    buyer.portfolio[firm.id] = buyerHolding;
  }

  updateHouseholdPortfolioValues(country) {
    const firmMap = new Map(country.firms.map(f => [f.id, f]));
    for (const h of country.households) {
      let value = 0;
      for (const [firmId, holding] of Object.entries(h.portfolio || {})) {
        const f = firmMap.get(firmId);
        if (!f?.equityMarket) continue;
        value += Math.max(0, holding.shares) * f.equityMarket.sharePrice;
      }
      h.portfolioMarketValue = value;
      h.netWorth = this.ledger.balance(h.accountId) + value - Math.max(0, Number(h.loanBalance || 0));
    }
  }

  verifyCountry(country) {
    const gl = this.accounting.gl;
    let physicalBook = 0;
    let ledgerBook = 0;
    let shareOwnershipError = 0;
    const sharesByFirm = new Map();
    for (const h of country.households) {
      physicalBook += this.portfolioBookValue(h);
      ledgerBook += Math.max(0, gl.naturalBalance(h.id, 'equity_investments'));
      for (const [firmId, holding] of Object.entries(h.portfolio || {})) sharesByFirm.set(firmId, (sharesByFirm.get(firmId) || 0) + holding.shares);
    }
    for (const f of country.firms) {
      if (!f.equityMarket) continue;
      shareOwnershipError = Math.max(shareOwnershipError, Math.abs((sharesByFirm.get(f.id) || 0) - f.equityMarket.publicShares));
    }
    const equityBookError = ledgerBook - physicalBook;
    return {
      accountingOk: Math.abs(equityBookError) < 1e-6 && shareOwnershipError < 1e-6,
      equityBookError,
      shareOwnershipError
    };
  }

  portfolioBookValue(household) {
    return Object.values(household.portfolio || {}).reduce((s, p) => s + Math.max(0, Number(p.bookValue || 0)), 0);
  }
}
