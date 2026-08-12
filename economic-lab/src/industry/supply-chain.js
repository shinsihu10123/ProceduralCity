import { clamp } from '../core/rng.js';
import { industryById } from '../config/industries.js';

const EPS = 1e-8;

function activeFirms(country) {
  return country.firms.filter(f => f.active !== false);
}

function chooseSupplier(candidates, rng, sampleSize = 7) {
  if (!candidates.length) return null;
  let best = null;
  let bestScore = Infinity;
  const pool = candidates.filter(f => f.active !== false && f.inventory > EPS);
  if (!pool.length) return null;
  const tries = Math.min(sampleSize, pool.length);
  const seen = new Set();
  for (let k = 0; k < tries; k++) {
    let i = rng.int(0, pool.length);
    let guard = 0;
    while (seen.has(i) && guard++ < pool.length * 2) i = (i + 1) % pool.length;
    seen.add(i);
    const f = pool[i];
    const reliability = 0.78 + Math.min(0.35, f.productivity * 0.18);
    const score = f.price / Math.max(0.1, reliability) * (0.97 + rng.next() * 0.06);
    if (score < bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

export class SupplyChainSystem {
  constructor({ ledger, accounting, rng }) {
    this.ledger = ledger;
    this.accounting = accounting;
    this.rng = rng;
  }

  initializeCountry(country) {
    for (const f of country.firms) this.initializeFirm(f, country);
    country.lastIndustry = this.emptyMetrics(country);
  }

  initializeFirm(f, country) {
    const def = industryById(f.industryId);
    f.industryId = def.id;
    f.industryName = def.name;
    f.product = def.product;
    f.consumerFacing = def.consumerFacing;
    f.inputProduct = def.inputProduct;
    f.inputPerOutput = def.inputPerOutput;
    f.inputInventory = f.inputInventory || {};
    f.inputBookValues = f.inputBookValues || {};
    if (def.inputProduct && f.inputInventory[def.inputProduct] === undefined) f.inputInventory[def.inputProduct] = 0;
    if (def.inputProduct && f.inputBookValues[def.inputProduct] === undefined) f.inputBookValues[def.inputProduct] = 0;
    f.capitalStock = Number.isFinite(f.capitalStock) ? f.capitalStock : (18 + country.capitalDepth * 34) * clamp(this.rng.normal(1, 0.16), 0.6, 1.5);
    f.capitalBookValue = Number.isFinite(f.capitalBookValue) ? f.capitalBookValue : f.capitalStock * country.initialPrice * 1.35;
    f.active = f.active !== false;
    f.distressMonths = f.distressMonths || 0;
    f.desiredProduction = f.desiredProduction || 0;
    f.capacity = f.capacity || 0;
    f.inputSpend = 0;
    f.b2bRevenue = 0;
    f.b2bSales = 0;
    f.investmentSpend = 0;
    f.capitalSales = 0;
    f.capitalRevenue = 0;
    f.supplyShortage = 0;
  }

  emptyMetrics(country = null) {
    const sectorOutputs = {};
    const sectorRevenues = {};
    if (country) {
      for (const f of country.firms) {
        sectorOutputs[f.industryId] = 0;
        sectorRevenues[f.industryId] = 0;
      }
    }
    return {
      b2bTransactions: 0,
      b2bSpend: 0,
      b2bUnits: 0,
      inputShortageUnits: 0,
      investmentTransactions: 0,
      grossInvestment: 0,
      capitalGoodsUnits: 0,
      sectorOutputs,
      sectorRevenues,
      activeFirms: country ? activeFirms(country).length : 0,
      exits: 0,
      entries: 0,
      exitIndustries: []
    };
  }

  beginMonth(country) {
    for (const f of country.firms) {
      f.output = 0;
      f.sales = 0;
      f.revenue = 0;
      f.inputSpend = 0;
      f.b2bRevenue = 0;
      f.b2bSales = 0;
      f.investmentSpend = 0;
      f.capitalSales = 0;
      f.capitalRevenue = 0;
      f.supplyShortage = 0;
      if (f.active === false) {
        f.desiredProduction = 0;
        f.desiredWorkers = 0;
      }
    }
  }

  planProduction(country) {
    for (const f of activeFirms(country)) {
      const capitalEffect = 0.72 + Math.log1p(Math.max(0, f.capitalStock)) * 0.105;
      const humanEffect = 0.82 + country.humanCapital * 0.30;
      const laborCapacity = Math.max(0, f.workers) * f.productivity * capitalEffect * humanEffect;
      const resourceEffect = f.industryId === 'RESOURCE' ? 0.62 + country.resourceBase * 0.62 : 1;
      const planEffect = 1 + clamp(f.currentPlan?.productionChange || 0, -0.12, 0.15);
      f.capacity = Math.max(0, laborCapacity * resourceEffect * planEffect);

      const demandAnchor = Math.max(2, f.previousSales || 0, f.targetInventory * 0.42);
      const expectedDemand = demandAnchor * (1 + clamp(f.beliefs?.demandGrowth || 0, -0.18, 0.22));
      const replenishment = Math.max(0, f.targetInventory - f.inventory);
      f.desiredProduction = Math.max(0, Math.min(f.capacity * 1.08, expectedDemand * 0.72 + replenishment));
    }
  }

  procureInputs(country, month) {
    const metrics = this.emptyMetrics(country);
    const firms = activeFirms(country);
    const suppliersByProduct = new Map();
    for (const seller of firms) {
      if (!suppliersByProduct.has(seller.product)) suppliersByProduct.set(seller.product, []);
      suppliersByProduct.get(seller.product).push(seller);
    }

    const buyers = firms.filter(f => f.inputProduct).sort((a, b) => a.id.localeCompare(b.id));
    for (const buyer of buyers) {
      const product = buyer.inputProduct;
      const required = Math.max(0, buyer.desiredProduction * buyer.inputPerOutput);
      let onHand = Math.max(0, buyer.inputInventory[product] || 0);
      let remainingNeed = Math.max(0, required - onHand);
      const startingNeed = remainingNeed;
      let budgetRemaining = this.ledger.balance(buyer.accountId) * 0.42;

      for (let round = 0; round < 5 && remainingNeed > EPS && budgetRemaining > EPS; round++) {
        const seller = chooseSupplier(suppliersByProduct.get(product) || [], this.rng, 6 + round * 2);
        if (!seller || seller.id === buyer.id) break;
        const affordableUnits = budgetRemaining / Math.max(0.01, seller.price);
        const desiredUnits = Math.min(remainingNeed, seller.inventory, affordableUnits);
        if (desiredUnits <= EPS) break;
        const requested = desiredUnits * seller.price;
        const paid = this.ledger.transfer({
          month,
          countryId: country.id,
          from: buyer.accountId,
          to: seller.accountId,
          amount: requested,
          kind: 'interfirm_purchase',
          meta: { buyerId: buyer.id, sellerId: seller.id, product, units: desiredUnits }
        });
        if (paid <= EPS) break;

        const units = paid / seller.price;
        const sellerUnitCost = Math.max(0, seller.bookUnitCost || seller.price * 0.45);
        const sellerCost = Math.min(
          Math.max(0, this.accounting.gl.naturalBalance(seller.id, 'inventory')),
          units * sellerUnitCost
        );
        seller.inventory = Math.max(0, seller.inventory - units);
        seller.b2bSales += units;
        seller.b2bRevenue += paid;
        seller.revenue += paid;
        seller.sales += units;
        buyer.inputInventory[product] = (buyer.inputInventory[product] || 0) + units;
        buyer.inputBookValues[product] = (buyer.inputBookValues[product] || 0) + paid;
        buyer.inputSpend += paid;
        budgetRemaining = Math.max(0, budgetRemaining - paid);
        remainingNeed = Math.max(0, remainingNeed - units);

        this.accounting.recordInterfirmPurchase({ buyer, seller, month, amount: paid, units, cost: sellerCost, product });
        metrics.b2bTransactions += 1;
        metrics.b2bSpend += paid;
        metrics.b2bUnits += units;
      }

      buyer.supplyShortage = Math.max(0, remainingNeed);
      metrics.inputShortageUnits += Math.max(0, startingNeed > 0 ? remainingNeed : 0);
    }

    return metrics;
  }

  produce(country, month, metrics) {
    for (const f of activeFirms(country)) {
      let output = Math.max(0, Math.min(f.desiredProduction, f.capacity));
      if (f.inputProduct) {
        const product = f.inputProduct;
        const available = Math.max(0, f.inputInventory[product] || 0);
        const maxByInput = available / Math.max(EPS, f.inputPerOutput);
        output = Math.min(output, maxByInput);
        const consumedUnits = output * f.inputPerOutput;
        if (consumedUnits > EPS && available > EPS) {
          const bookBefore = Math.max(0, f.inputBookValues[product] || 0);
          const consumedValue = Math.min(bookBefore, bookBefore * (consumedUnits / available));
          f.inputInventory[product] = Math.max(0, available - consumedUnits);
          f.inputBookValues[product] = Math.max(0, bookBefore - consumedValue);
          if (consumedValue > EPS) this.accounting.recordInputConsumption({ firm: f, month, amount: consumedValue, product, units: consumedUnits });
        }
      }

      f.output = Math.max(0, output);
      f.inventory += f.output;
      metrics.sectorOutputs[f.industryId] = (metrics.sectorOutputs[f.industryId] || 0) + f.output;
    }
    return metrics;
  }

  clearInvestmentMarket(country, month, metrics) {
    const capitalSuppliers = activeFirms(country).filter(f => f.product === 'capital_good' && f.inventory > EPS);
    if (!capitalSuppliers.length) return metrics;

    const buyers = activeFirms(country)
      .filter(f => f.industryId !== 'CAPITAL')
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const buyer of buyers) {
      const utilization = buyer.capacity > EPS ? buyer.desiredProduction / buyer.capacity : 0;
      const expansionSignal = buyer.currentPlan?.selected === '확장' || utilization > 0.88;
      const cash = this.ledger.balance(buyer.accountId);
      if (!expansionSignal || cash < buyer.safeCash * 0.72) continue;

      const seller = chooseSupplier(capitalSuppliers, this.rng, 8);
      if (!seller) continue;
      const budget = Math.min(cash * 0.055, buyer.safeCash * 0.18);
      const desiredUnits = Math.min(8, budget / Math.max(0.01, seller.price), seller.inventory);
      if (desiredUnits <= 0.08) continue;
      const requested = desiredUnits * seller.price;
      const paid = this.ledger.transfer({
        month,
        countryId: country.id,
        from: buyer.accountId,
        to: seller.accountId,
        amount: requested,
        kind: 'capital_investment',
        meta: { buyerId: buyer.id, sellerId: seller.id, units: desiredUnits }
      });
      if (paid <= EPS) continue;
      const units = paid / seller.price;
      const sellerUnitCost = Math.max(0, seller.bookUnitCost || seller.price * 0.5);
      const sellerCost = Math.min(
        Math.max(0, this.accounting.gl.naturalBalance(seller.id, 'inventory')),
        units * sellerUnitCost
      );
      seller.inventory = Math.max(0, seller.inventory - units);
      seller.capitalSales += units;
      seller.capitalRevenue += paid;
      seller.revenue += paid;
      seller.sales += units;
      buyer.capitalStock += units * 0.72;
      buyer.capitalBookValue = (buyer.capitalBookValue || 0) + paid;
      buyer.investmentSpend += paid;
      this.accounting.recordCapitalInvestment({ buyer, seller, month, amount: paid, units, cost: sellerCost });
      metrics.investmentTransactions += 1;
      metrics.grossInvestment += paid;
      metrics.capitalGoodsUnits += units;
    }
    return metrics;
  }

  finalizeMetrics(country, metrics) {
    for (const f of activeFirms(country)) {
      metrics.sectorRevenues[f.industryId] = (metrics.sectorRevenues[f.industryId] || 0) + Math.max(0, f.revenue || 0);
    }
    metrics.activeFirms = activeFirms(country).length;
    return metrics;
  }

  evaluateExits(country) {
    const exited = [];
    for (const f of activeFirms(country)) {
      const cash = this.ledger.balance(f.accountId);
      const severePayrollStress = (f.wageArrears || 0) > Math.max(100, f.wage * Math.max(1, f.workers) * 1.35);
      const severeCreditStress = (f.creditMisses || 0) >= 5;
      const liquidityFailure = cash < f.safeCash * 0.025 && severePayrollStress;
      if (liquidityFailure || severeCreditStress) f.distressMonths = (f.distressMonths || 0) + 1;
      else f.distressMonths = Math.max(0, (f.distressMonths || 0) - 1);

      if (f.distressMonths >= 4) {
        f.active = false;
        f.desiredWorkers = 0;
        f.desiredProduction = 0;
        for (const h of country.households) {
          if (h.employerId === f.id) {
            h.employed = false;
            h.employerId = null;
          }
        }
        f.workers = 0;
        exited.push(f.industryId);
      }
    }
    return exited;
  }
}
