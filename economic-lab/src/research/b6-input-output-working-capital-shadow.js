const EPS = 1e-8;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = (values) => values.reduce((total, value) => total + finite(value), 0);

function defineHidden(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    enumerable: false,
    configurable: true,
    writable: true
  });
  return value;
}

function activeFirms(country) {
  return (country.firms || []).filter((firm) => firm.active !== false);
}

export function b6ProductivityFactor(firm, candidate, contract) {
  const valueScale = finite(candidate?.V, 1);
  if (Math.abs(valueScale - 1) <= EPS) return 1;
  const shape = finite(contract?.axes?.V?.sectorShape?.[firm.industryId], 1);
  return valueScale * shape;
}

export function b6MaterialEfficiencyDivisor(candidate) {
  return Math.max(1, finite(candidate?.M, 1));
}

export function b6FirmTag(firm) {
  return firm?.__r4CuD3dB6 || null;
}

export function applyB6FirmShadow(firm, candidate, contract) {
  const existing = b6FirmTag(firm);
  if (existing?.applied === true) {
    if (existing.candidateId !== candidate.id) {
      throw new Error(`B6 candidate collision on ${firm.id}: ${existing.candidateId} != ${candidate.id}`);
    }
    return firm;
  }

  const baseProductivity = finite(firm.productivity);
  const baseInputPerOutput = finite(firm.inputPerOutput);
  const productivityFactor = b6ProductivityFactor(firm, candidate, contract);
  const materialEfficiencyDivisor = b6MaterialEfficiencyDivisor(candidate);

  firm.productivity = baseProductivity * productivityFactor;
  if (firm.inputProduct) firm.inputPerOutput = baseInputPerOutput / materialEfficiencyDivisor;

  defineHidden(firm, '__r4CuD3dB6', {
    applied: true,
    applicationCount: 1,
    front: contract.front,
    candidateId: candidate.id,
    industryId: firm.industryId,
    workingCapitalMode: candidate.W,
    baseProductivity,
    productivityFactor,
    baseInputPerOutput,
    materialEfficiencyDivisor
  });
  return firm;
}

function chooseSupplier(candidates, rng, sampleSize = 7) {
  if (!candidates.length) return null;
  let best = null;
  let bestScore = Infinity;
  const pool = candidates.filter((firm) => firm.active !== false && finite(firm.inventory) > EPS);
  if (!pool.length) return null;
  const tries = Math.min(sampleSize, pool.length);
  const seen = new Set();

  for (let index = 0; index < tries; index += 1) {
    let candidateIndex = rng.int(0, pool.length);
    let guard = 0;
    while (seen.has(candidateIndex) && guard++ < pool.length * 2) candidateIndex = (candidateIndex + 1) % pool.length;
    seen.add(candidateIndex);
    const firm = pool[candidateIndex];
    const reliability = 0.78 + Math.min(0.35, finite(firm.productivity) * 0.18);
    const score = finite(firm.price) / Math.max(0.1, reliability) * (0.97 + rng.next() * 0.06);
    if (score < bestScore) {
      bestScore = score;
      best = firm;
    }
  }
  return best;
}

function estimatePurchasableCost(suppliers, buyer, requiredUnits) {
  let unitsRemaining = Math.max(0, finite(requiredUnits));
  let cost = 0;
  const eligible = (suppliers || [])
    .filter((seller) => seller.active !== false && seller.id !== buyer.id && finite(seller.inventory) > EPS)
    .slice()
    .sort((a, b) => finite(a.price) - finite(b.price) || a.id.localeCompare(b.id));

  for (const seller of eligible) {
    if (unitsRemaining <= EPS) break;
    const units = Math.min(unitsRemaining, Math.max(0, finite(seller.inventory)));
    cost += units * Math.max(0.01, finite(seller.price, 0.01));
    unitsRemaining -= units;
  }
  return cost;
}

function facilityLoansForBorrower(country, borrowerId, candidateId) {
  return (country.loans || []).filter((loan) =>
    loan?.b6Facility?.candidateId === candidateId && loan.borrowerId === borrowerId
  );
}

export function b6FacilityLoans(country, candidateId = null) {
  return (country.loans || []).filter((loan) =>
    loan?.b6Facility && (candidateId === null || loan.b6Facility.candidateId === candidateId)
  );
}

function originateFacility({ world, country, buyer, month, candidate, contract, plannedInputCost, requestedDraw, diagnostics }) {
  const requested = Math.max(0, finite(requestedDraw));
  if (requested <= EPS) return 0;

  diagnostics.facilityApplications += 1;
  diagnostics.facilityRequestedDraw += requested;

  const lineSpec = contract.axes.W.modes.LINE1;
  const estimatedPayroll = Math.max(0, finite(buyer.wage) * Math.max(1, finite(buyer.desiredWorkers, buyer.workers)));
  const activeFacilityDebt = sum(facilityLoansForBorrower(country, buyer.id, candidate.id)
    .filter((loan) => loan.status === 'active')
    .map((loan) => loan.outstanding));
  const grossLineLimit = estimatedPayroll + Math.max(0, finite(plannedInputCost));
  const unusedLine = Math.max(0, grossLineLimit - activeFacilityDebt);
  const lineCappedRequest = Math.min(requested, unusedLine);

  diagnostics.facilityGrossLineLimit += grossLineLimit;
  diagnostics.facilityUnusedLineAtApplication += unusedLine;
  diagnostics.facilityLineLimitDeniedAmount += Math.max(0, requested - lineCappedRequest);
  if (lineCappedRequest <= EPS) return 0;

  const bank = country.banks[0];
  const bankStatement = world.accounting.entityStatement(bank.id, month).balanceSheet;
  const capitalCapped = world.banking.capByBankCapital(bank, bankStatement, lineCappedRequest);
  diagnostics.facilityBankCapitalDeniedAmount += Math.max(0, lineCappedRequest - capitalCapped);
  if (capitalCapped <= EPS) {
    diagnostics.facilityBankCapitalDenials += 1;
    return 0;
  }

  const created = world.ledger.adjustMoney({
    month,
    countryId: country.id,
    accountId: buyer.accountId,
    amount: capitalCapped,
    kind: 'b6_working_capital_origination',
    meta: {
      front: contract.front,
      candidateId: candidate.id,
      bankId: bank.id,
      borrowerId: buyer.id,
      plannedInputCost,
      estimatedPayroll,
      grossLineLimit,
      activeFacilityDebt,
      requestedDraw: requested
    }
  });
  if (created <= EPS) return 0;

  const annualRate = Math.max(0, finite(bank.baseAnnualRate) + finite(bank.loanMarkup) + finite(lineSpec.annualRateSpread));
  const loan = {
    id: `LN-${String(world.banking.loanSequence++).padStart(8, '0')}`,
    countryId: country.id,
    bankId: bank.id,
    borrowerId: buyer.id,
    borrowerKind: 'firm',
    originalPrincipal: created,
    outstanding: created,
    annualRate,
    monthlyRate: annualRate / 12,
    termMonths: lineSpec.termMonths,
    originatedMonth: month,
    nextPaymentMonth: month + 1,
    missedPayments: 0,
    arrears: 0,
    status: 'active',
    estimatedDefaultProbabilityAtOrigination: null,
    b6Facility: {
      front: contract.front,
      candidateId: candidate.id,
      plannedInputCost,
      estimatedPayroll,
      grossLineLimit,
      activeFacilityDebtAtOrigination: activeFacilityDebt,
      requestedDraw: requested,
      bankCapitalCappedDraw: capitalCapped
    }
  };

  country.loans.push(loan);
  buyer.loanBalance = Math.max(0, finite(buyer.loanBalance)) + created;
  world.accounting.recordLoanOrigination({ country, bank, borrower: buyer, loan, month, amount: created });

  diagnostics.facilityApprovals += 1;
  diagnostics.facilityActualDraw += created;
  diagnostics.facilityOriginations += 1;
  return created;
}

function captureCanonicalOpening(world, country, budgetShare) {
  const buyers = activeFirms(country).filter((firm) => firm.inputProduct);
  let plannedInputNeedUnits = 0;
  let procurementBudget = 0;
  let estimatedPurchasableCost = 0;
  const suppliersByProduct = new Map();

  for (const seller of activeFirms(country)) {
    if (!suppliersByProduct.has(seller.product)) suppliersByProduct.set(seller.product, []);
    suppliersByProduct.get(seller.product).push(seller);
  }

  for (const buyer of buyers) {
    const required = Math.max(0, finite(buyer.desiredProduction) * Math.max(0, finite(buyer.inputPerOutput)));
    const onHand = Math.max(0, finite(buyer.inputInventory?.[buyer.inputProduct]));
    const need = Math.max(0, required - onHand);
    plannedInputNeedUnits += need;
    procurementBudget += world.ledger.balance(buyer.accountId) * budgetShare;
    estimatedPurchasableCost += estimatePurchasableCost(suppliersByProduct.get(buyer.inputProduct) || [], buyer, need);
  }
  return { plannedInputNeedUnits, procurementBudget, estimatedPurchasableCost };
}

function monthKey(countryId, month) {
  return `${countryId}@@${month}`;
}

function recordMonth(state, country, month, values) {
  const row = { countryId: country.id, month, candidateId: state.candidate.id, workingCapitalMode: state.candidate.W, ...values };
  state.monthMetrics.set(monthKey(country.id, month), row);
  return row;
}

function customProcureInputs(world, country, month, state) {
  const candidate = state.candidate;
  const contract = state.contract;
  const metrics = world.supply.emptyMetrics(country);
  const firms = activeFirms(country);
  const suppliersByProduct = new Map();

  for (const seller of firms) {
    if (!suppliersByProduct.has(seller.product)) suppliersByProduct.set(seller.product, []);
    suppliersByProduct.get(seller.product).push(seller);
  }

  const diagnostics = {
    plannedInputNeedUnits: 0,
    estimatedPurchasableCost: 0,
    purchasedInputUnits: 0,
    procurementBudget: 0,
    procurementSpend: 0,
    facilityApplications: 0,
    facilityApprovals: 0,
    facilityRequestedDraw: 0,
    facilityActualDraw: 0,
    facilityOriginations: 0,
    facilityGrossLineLimit: 0,
    facilityUnusedLineAtApplication: 0,
    facilityLineLimitDeniedAmount: 0,
    facilityBankCapitalDeniedAmount: 0,
    facilityBankCapitalDenials: 0
  };

  const buyers = firms.filter((firm) => firm.inputProduct).sort((a, b) => a.id.localeCompare(b.id));
  for (const buyer of buyers) {
    const product = buyer.inputProduct;
    const required = Math.max(0, finite(buyer.desiredProduction) * Math.max(0, finite(buyer.inputPerOutput)));
    const onHand = Math.max(0, finite(buyer.inputInventory?.[product]));
    let remainingNeed = Math.max(0, required - onHand);
    const startingNeed = remainingNeed;
    const supplierPool = suppliersByProduct.get(product) || [];
    const plannedInputCost = estimatePurchasableCost(supplierPool, buyer, remainingNeed);
    diagnostics.plannedInputNeedUnits += startingNeed;
    diagnostics.estimatedPurchasableCost += plannedInputCost;

    if (candidate.W === 'LINE1' && plannedInputCost > EPS) {
      const cash = world.ledger.balance(buyer.accountId);
      originateFacility({
        world,
        country,
        buyer,
        month,
        candidate,
        contract,
        plannedInputCost,
        requestedDraw: Math.max(0, plannedInputCost - cash),
        diagnostics
      });
    }

    let budgetRemaining = world.ledger.balance(buyer.accountId);
    diagnostics.procurementBudget += budgetRemaining;

    for (let round = 0; round < 5 && remainingNeed > EPS && budgetRemaining > EPS; round += 1) {
      const seller = chooseSupplier(supplierPool, world.rng, 6 + round * 2);
      if (!seller || seller.id === buyer.id) break;
      const affordableUnits = budgetRemaining / Math.max(0.01, finite(seller.price, 0.01));
      const desiredUnits = Math.min(remainingNeed, finite(seller.inventory), affordableUnits);
      if (desiredUnits <= EPS) break;
      const requested = desiredUnits * finite(seller.price);
      const paid = world.ledger.transfer({
        month,
        countryId: country.id,
        from: buyer.accountId,
        to: seller.accountId,
        amount: requested,
        kind: 'interfirm_purchase',
        meta: { buyerId: buyer.id, sellerId: seller.id, product, units: desiredUnits }
      });
      if (paid <= EPS) break;

      const units = paid / Math.max(0.01, finite(seller.price, 0.01));
      const sellerUnitCost = Math.max(0, finite(seller.bookUnitCost, finite(seller.price) * 0.45));
      const sellerCost = Math.min(Math.max(0, world.accounting.gl.naturalBalance(seller.id, 'inventory')), units * sellerUnitCost);
      seller.inventory = Math.max(0, finite(seller.inventory) - units);
      seller.b2bSales = finite(seller.b2bSales) + units;
      seller.b2bRevenue = finite(seller.b2bRevenue) + paid;
      seller.revenue = finite(seller.revenue) + paid;
      seller.sales = finite(seller.sales) + units;
      buyer.inputInventory[product] = finite(buyer.inputInventory?.[product]) + units;
      buyer.inputBookValues[product] = finite(buyer.inputBookValues?.[product]) + paid;
      buyer.inputSpend = finite(buyer.inputSpend) + paid;
      budgetRemaining = Math.max(0, budgetRemaining - paid);
      remainingNeed = Math.max(0, remainingNeed - units);

      world.accounting.recordInterfirmPurchase({ buyer, seller, month, amount: paid, units, cost: sellerCost, product });
      metrics.b2bTransactions += 1;
      metrics.b2bSpend += paid;
      metrics.b2bUnits += units;
      diagnostics.procurementSpend += paid;
      diagnostics.purchasedInputUnits += units;
    }

    buyer.supplyShortage = Math.max(0, remainingNeed);
    metrics.inputShortageUnits += Math.max(0, startingNeed > 0 ? remainingNeed : 0);
  }

  recordMonth(state, country, month, {
    ...diagnostics,
    inputShortageUnits: metrics.inputShortageUnits,
    procurementBudgetUtilization: diagnostics.procurementBudget > EPS ? diagnostics.procurementSpend / diagnostics.procurementBudget : 0
  });
  return metrics;
}

export function configureB6ShadowWorld(world, candidate, contract) {
  if (!world || !candidate || !contract) throw new Error('B6 shadow configuration requires world, candidate and contract');
  if (world.__r4CuD3dB6State) return world.__r4CuD3dB6State;

  const state = defineHidden(world, '__r4CuD3dB6State', {
    front: contract.front,
    candidate,
    contract,
    monthMetrics: new Map(),
    originalProcureInputs: world.supply.procureInputs.bind(world.supply)
  });

  for (const country of world.countries) for (const firm of country.firms) applyB6FirmShadow(firm, candidate, contract);

  world.supply.procureInputs = (country, month) => {
    if (candidate.W === 'C42') {
      const opening = captureCanonicalOpening(world, country, 0.42);
      const metrics = state.originalProcureInputs(country, month);
      recordMonth(state, country, month, {
        ...opening,
        purchasedInputUnits: finite(metrics.b2bUnits),
        inputShortageUnits: finite(metrics.inputShortageUnits),
        procurementSpend: finite(metrics.b2bSpend),
        procurementBudgetUtilization: opening.procurementBudget > EPS ? finite(metrics.b2bSpend) / opening.procurementBudget : 0,
        facilityApplications: 0,
        facilityApprovals: 0,
        facilityRequestedDraw: 0,
        facilityActualDraw: 0,
        facilityOriginations: 0,
        facilityGrossLineLimit: 0,
        facilityUnusedLineAtApplication: 0,
        facilityLineLimitDeniedAmount: 0,
        facilityBankCapitalDeniedAmount: 0,
        facilityBankCapitalDenials: 0
      });
      return metrics;
    }
    return customProcureInputs(world, country, month, state);
  };

  return state;
}

export function b6MonthMetrics(world, countryId, month) {
  return world?.__r4CuD3dB6State?.monthMetrics?.get(monthKey(countryId, month)) || null;
}

export function b6ShadowState(world) {
  return world?.__r4CuD3dB6State || null;
}
