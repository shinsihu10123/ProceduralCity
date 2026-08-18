let goodsMarketDiagnosticObserver = null;

export function setGoodsMarketDiagnosticObserver(observer = null) {
  if (observer !== null && typeof observer !== 'function') throw new TypeError('goods diagnostic observer must be a function or null');
  goodsMarketDiagnosticObserver = observer;
}

function chooseSeller(firms, rng, sampleSize = 8) {
  let best = null;
  let bestScore = Infinity;
  const eligible = firms.filter(f => f.active !== false && f.consumerFacing === true && f.inventory > 1e-8);
  const seen = new Set();
  const attempts = Math.min(sampleSize, eligible.length);
  for (let k = 0; k < attempts; k++) {
    let i = rng.int(0, eligible.length);
    let guard = 0;
    while (seen.has(i) && guard++ < eligible.length * 2) i = (i + 1) % eligible.length;
    seen.add(i);
    const f = eligible[i];
    if (!f || f.inventory <= 1e-8) continue;
    const perceivedQuality = 0.72 + f.productivity * 0.28;
    const score = f.price / Math.max(0.08, perceivedQuality) * (0.98 + rng.next() * 0.04);
    if (score < bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

function clearGoodsMarketCore(country, ledger, rng, month) {
  const consumerFirms = country.firms.filter(f => f.active !== false && f.consumerFacing === true);
  const diagnostics = goodsMarketDiagnosticObserver ? {
    initialActiveConsumerFirms: consumerFirms.length,
    initialEligibleSellers: 0,
    initialInventoryUnits: 0,
    initialInventoryValue: 0,
    households: country.households.length,
    householdsWithPositiveBudget: 0,
    householdsWithUnmetBudget: 0,
    fullySpentHouseholds: 0,
    noEligibleSellerStops: 0,
    roundLimitStops: 0,
    settlementFailureStops: 0,
    exhaustedSellerEvents: 0,
    endEligibleSellers: 0,
    endInventoryUnits: 0,
    endInventoryValue: 0
  } : null;

  for (const f of consumerFirms) {
    f.consumerSales = 0;
    f.consumerRevenue = 0;
    if (diagnostics) {
      const inventory = Math.max(0, Number(f.inventory || 0));
      diagnostics.initialInventoryUnits += inventory;
      diagnostics.initialInventoryValue += inventory * Math.max(0, Number(f.price || 0));
      if (inventory > 1e-8) diagnostics.initialEligibleSellers += 1;
    }
  }

  let transactions = 0;
  let nominalConsumption = 0;
  let units = 0;
  let desiredBudget = 0;
  let unmetBudget = 0;

  for (const h of country.households) {
    h.consumption = 0;
    h.lastPurchases = [];
    const availableCash = ledger.balance(h.accountId);
    let remaining = Math.min(availableCash, Math.max(0, h.desiredConsumptionBudget || 0));
    desiredBudget += remaining;
    const originalBudget = remaining;
    let stoppedNoSeller = false;
    let stoppedSettlementFailure = false;
    let roundsUsed = 0;
    if (diagnostics && originalBudget > 1e-7) diagnostics.householdsWithPositiveBudget += 1;

    for (let round = 0; round < 3 && remaining > 1e-7; round++) {
      roundsUsed = round + 1;
      const seller = chooseSeller(consumerFirms, rng, 8 + round * 3);
      if (!seller) {
        stoppedNoSeller = true;
        if (diagnostics) diagnostics.noEligibleSellerStops += 1;
        break;
      }
      const roundBudget = round < 2 ? remaining * 0.58 : remaining;
      const desiredUnits = roundBudget / Math.max(0.01, seller.price);
      const boughtUnits = Math.min(seller.inventory, desiredUnits);
      const requestedAmount = boughtUnits * seller.price;
      const paid = ledger.transfer({
        month,
        countryId: country.id,
        from: h.accountId,
        to: seller.accountId,
        amount: requestedAmount,
        kind: 'goods_purchase',
        meta: { householdId: h.id, firmId: seller.id, product: 'consumer_good', units: boughtUnits }
      });
      if (paid <= 1e-9) {
        stoppedSettlementFailure = true;
        if (diagnostics) diagnostics.settlementFailureStops += 1;
        break;
      }
      const settledUnits = paid / seller.price;
      seller.inventory = Math.max(0, seller.inventory - settledUnits);
      if (diagnostics && seller.inventory <= 1e-8) diagnostics.exhaustedSellerEvents += 1;
      seller.sales += settledUnits;
      seller.revenue += paid;
      seller.consumerSales = (seller.consumerSales || 0) + settledUnits;
      seller.consumerRevenue = (seller.consumerRevenue || 0) + paid;
      h.consumption += paid;
      h.lastPurchases.push({ firmId: seller.id, amount: paid, units: settledUnits, price: seller.price });
      remaining = Math.max(0, remaining - paid);
      transactions += 1;
      nominalConsumption += paid;
      units += settledUnits;
    }

    const unmet = Math.max(0, originalBudget - h.consumption);
    unmetBudget += unmet;
    if (diagnostics && originalBudget > 1e-7) {
      if (unmet <= 1e-7) diagnostics.fullySpentHouseholds += 1;
      else {
        diagnostics.householdsWithUnmetBudget += 1;
        if (!stoppedNoSeller && !stoppedSettlementFailure && roundsUsed >= 3) diagnostics.roundLimitStops += 1;
      }
    }
    h.savings = h.income - h.consumption;
  }

  const result = { transactions, nominalConsumption, units, desiredBudget, unmetBudget };
  if (goodsMarketDiagnosticObserver) {
    for (const f of consumerFirms) {
      const inventory = Math.max(0, Number(f.inventory || 0));
      diagnostics.endInventoryUnits += inventory;
      diagnostics.endInventoryValue += inventory * Math.max(0, Number(f.price || 0));
      if (inventory > 1e-8) diagnostics.endEligibleSellers += 1;
    }
    goodsMarketDiagnosticObserver({
      countryId: country.id,
      month,
      result: { ...result },
      diagnostics: { ...diagnostics }
    });
  }
  return result;
}

export function clearGoodsMarket(country, ledger, rng, month) {
  const profiler = country?.__runtimeProfiler;
  return profiler
    ? profiler.measure('market.goods', () => clearGoodsMarketCore(country, ledger, rng, month))
    : clearGoodsMarketCore(country, ledger, rng, month);
}
