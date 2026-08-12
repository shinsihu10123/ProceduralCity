function chooseSeller(firms, rng, sampleSize = 8) {
  let best = null;
  let bestScore = Infinity;
  const seen = new Set();
  const attempts = Math.min(sampleSize, firms.length);
  for (let k = 0; k < attempts; k++) {
    let i = rng.int(0, firms.length);
    let guard = 0;
    while (seen.has(i) && guard++ < firms.length * 2) i = (i + 1) % firms.length;
    seen.add(i);
    const f = firms[i];
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

export function clearGoodsMarket(country, ledger, rng, month) {
  for (const f of country.firms) {
    f.sales = 0;
    f.revenue = 0;
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

    for (let round = 0; round < 3 && remaining > 1e-7; round++) {
      const seller = chooseSeller(country.firms, rng, 8 + round * 3);
      if (!seller) break;
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
        meta: { householdId: h.id, firmId: seller.id, units: boughtUnits }
      });
      if (paid <= 1e-9) break;
      const settledUnits = paid / seller.price;
      seller.inventory = Math.max(0, seller.inventory - settledUnits);
      seller.sales += settledUnits;
      seller.revenue += paid;
      h.consumption += paid;
      h.lastPurchases.push({ firmId: seller.id, amount: paid, units: settledUnits, price: seller.price });
      remaining = Math.max(0, remaining - paid);
      transactions += 1;
      nominalConsumption += paid;
      units += settledUnits;
    }

    unmetBudget += Math.max(0, originalBudget - h.consumption);
    h.savings = h.income - h.consumption;
  }

  return { transactions, nominalConsumption, units, desiredBudget, unmetBudget };
}
