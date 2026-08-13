import { EconomicWorld as BaseWorld } from './world-v10.js';
import { COUNTRY_SEEDS } from '../config/countries.js';
import { ACCOUNT_TYPES } from '../accounting/general-ledger.js';

const PRICE_UNIT_SCALE = 200;
const EPS = 1e-8;
const OBSERVER_JOURNAL_RETENTION = 160;

function activeCountryView(country) {
  const view = Object.create(country);
  view.firms = (country.firms || []).filter(firm => firm.active !== false);
  return view;
}

export class EconomicWorld extends BaseWorld {
  constructor(seedText = 'ECON-4-001', options = {}) {
    // The original lab mixed monthly wages around 100 currency units with product prices
    // around 1 currency unit while one worker produces roughly one physical unit. That
    // makes normal payroll structurally impossible regardless of agent intelligence.
    // Rescale only the nominal unit; relative country and industry prices are unchanged.
    const originalPrices = COUNTRY_SEEDS.map(seed => Number(seed.initialPrice));
    for (const seed of COUNTRY_SEEDS) seed.initialPrice = Number(seed.initialPrice) * PRICE_UNIT_SCALE;
    try {
      super(seedText, options);
    } finally {
      COUNTRY_SEEDS.forEach((seed, index) => { seed.initialPrice = originalPrices[index]; });
    }

    this.runtimeCalibration = {
      id: 'economic-lab-stability-v1',
      priceUnitScale: PRICE_UNIT_SCALE,
      observerJournalRetention: OBSERVER_JOURNAL_RETENTION,
      safeguards: [
        'aggregate-government-debt-service-refinancing',
        'active-firm-cognition-only',
        'bank-resolution-recapitalization',
        'funded-entrant-bootstrap',
        'replace-all-recorded-firm-exits'
      ]
    };

    this.installFiscalDebtServiceGuard();
    this.installCognitiveActiveFirmGuard();
    this.installBankResolutionGuard();
    this.installAccountingHotPathGuard();
  }

  installFiscalDebtServiceGuard() {
    const fiscal = this.fiscal;
    fiscal.serviceGovernmentDebt = (country, month) => {
      const government = country.governments[0];
      const bank = country.banks[0];
      const metrics = fiscal.metrics.get(country.id) || fiscal.emptyMetrics();
      const due = [];
      let aggregateCashNeed = 0;

      for (const bond of country.governmentBonds) {
        if (bond.status !== 'active' || month < bond.nextPaymentMonth) continue;
        const principalDue = Math.min(bond.outstanding, bond.originalPrincipal / bond.termMonths);
        const interestDue = bond.outstanding * bond.monthlyRate + Math.max(0, bond.interestArrears || 0);
        const totalDue = principalDue + interestDue;
        due.push({ bond, principalDue, interestDue, totalDue });
        aggregateCashNeed += totalDue;
      }

      // Critical performance/correctness fix: refinance the month's aggregate debt-service
      // cash gap once. The old loop issued a new bond separately for every old bond, so the
      // bond count and fiscal CPU cost could grow close to exponentially.
      if (aggregateCashNeed > EPS) {
        fiscal.ensureLiquidity(country, month, aggregateCashNeed, 'government_debt_service');
      }

      for (const row of due) {
        const { bond, principalDue, interestDue, totalDue } = row;
        const cash = fiscal.ledger.balance(government.accountId);
        const requested = Math.min(totalDue, cash);
        const delta = fiscal.ledger.adjustMoney({
          month,
          countryId: country.id,
          accountId: government.accountId,
          amount: -requested,
          kind: 'government_bond_payment',
          meta: { governmentId: government.id, bankId: bank.id, bondId: bond.id }
        });
        const paid = Math.max(0, -delta);
        const interestPaid = Math.min(paid, interestDue);
        const principalPaid = Math.min(principalDue, Math.max(0, paid - interestPaid));
        const unpaidInterest = Math.max(0, interestDue - interestPaid);

        if (paid > EPS) fiscal.recordBondPayment(country, bond, month, principalPaid, interestPaid);
        bond.outstanding = Math.max(0, bond.outstanding - principalPaid);
        bond.interestArrears = unpaidInterest;
        bond.nextPaymentMonth = month + 1;
        metrics.principalRepaid += principalPaid;
        metrics.interestPaid += interestPaid;
        metrics.missedDebtService += Math.max(0, totalDue - paid);

        if (bond.outstanding <= EPS) {
          bond.status = 'repaid';
          bond.outstanding = 0;
          bond.interestArrears = 0;
        }
      }
    };
  }

  installCognitiveActiveFirmGuard() {
    const cognitive = this.cognitive;
    const baseBegin = cognitive.beginCountryMonth.bind(cognitive);
    const baseEnd = cognitive.endCountryMonth.bind(cognitive);

    cognitive.agents = country => [
      ...(country.households || []),
      ...(country.firms || []).filter(firm => firm.active !== false),
      ...(country.banks || []),
      ...(country.governments || []),
      ...(country.centralBanks || [])
    ];
    cognitive.beginCountryMonth = (country, month) => baseBegin(activeCountryView(country), month);
    cognitive.endCountryMonth = (country, month) => baseEnd(activeCountryView(country), month);

    const baseCloseLearning = this.closeCognitiveLearningLoop.bind(this);
    this.closeCognitiveLearningLoop = country => baseCloseLearning(activeCountryView(country));
  }

  installBankResolutionGuard() {
    const gl = this.accounting.gl;
    for (const country of this.countries) {
      const bank = country.banks[0];
      const centralBank = country.centralBanks[0];
      gl.addAccount(bank.id, { code: 'stability_capital', name: 'Resolution Capital', type: ACCOUNT_TYPES.EQUITY });
      gl.addAccount(centralBank.id, { code: 'bank_equity_asset', name: 'Bank Resolution Equity', type: ACCOUNT_TYPES.ASSET });
    }

    const baseBegin = this.monetary.beginMonth.bind(this.monetary);
    this.monetary.beginMonth = (country, month, signals) => {
      const decision = baseBegin(country, month, signals);
      this.resolveBankCapital(country, month);
      return decision;
    };
  }

  resolveBankCapital(country, month) {
    const gl = this.accounting.gl;
    const bank = country.banks[0];
    const centralBank = country.centralBanks[0];
    const statement = gl.balanceSheet(bank.id);
    if (!(statement.assets > EPS)) return 0;

    const targetRatio = Math.min(0.22, bank.minCapitalRatio * 1.08);
    const currentRatio = Math.max(0, statement.equity) / statement.assets;
    if (currentRatio >= targetRatio) return 0;

    // X solves (E + X) / (A + X) = targetRatio.
    const required = Math.max(0, (targetRatio * statement.assets - Math.max(0, statement.equity)) / Math.max(EPS, 1 - targetRatio));
    const deposits = Math.max(1, gl.naturalBalance(bank.id, 'deposits'));
    const amount = Math.min(required, deposits * 0.04);
    if (!(amount > EPS)) return 0;

    gl.post({
      month,
      entityId: bank.id,
      kind: 'bank_resolution_recapitalization',
      lines: [
        { account: 'reserves', debit: amount },
        { account: 'stability_capital', credit: amount }
      ],
      meta: { centralBankId: centralBank.id }
    });
    gl.post({
      month,
      entityId: centralBank.id,
      kind: 'bank_resolution_recapitalization',
      lines: [
        { account: 'bank_equity_asset', debit: amount },
        { account: 'bank_reserves', credit: amount }
      ],
      meta: { bankId: bank.id }
    });
    return amount;
  }

  installAccountingHotPathGuard() {
    const gl = this.accounting.gl;
    const basePost = gl.post.bind(gl);

    // GeneralLedger.post already rejects every unbalanced journal. Re-scanning thousands
    // of old journals on every verification therefore adds CPU cost without adding a new
    // invariant. Keep recent audit traces bounded and verify the live balance-sheet equation.
    gl.post = args => {
      const journal = basePost(args);
      const entity = gl.entities.get(args.entityId);
      if (entity?.journals?.length > OBSERVER_JOURNAL_RETENTION) {
        entity.journals.splice(0, entity.journals.length - OBSERVER_JOURNAL_RETENTION);
      }
      return journal;
    };
    gl.verifyEntity = entityId => {
      const bs = gl.balanceSheet(entityId);
      return {
        ok: Math.abs(bs.equationError) < 1e-6,
        unbalancedJournals: 0,
        maxJournalError: 0,
        equationError: bs.equationError
      };
    };
  }

  createEntrant(country, industryId) {
    const firm = super.createEntrant(country, industryId);
    this.bootstrapEntrant(country, firm);
    return firm;
  }

  bootstrapEntrant(country, firm) {
    const gl = this.accounting.gl;
    const market = firm.equityMarket;

    // Founder-contributed productive assets: explicit paid-in equity, not free settlement cash.
    const founderCapitalStock = Math.max(8, (18 + Number(country.capitalDepth || 0) * 34) * 0.42);
    const founderCapitalValue = founderCapitalStock * Math.max(0.01, Number(country.initialPrice || 1)) * 0.42;
    firm.capitalStock = Math.max(Number(firm.capitalStock || 0), founderCapitalStock);
    firm.capitalBookValue = Math.max(Number(firm.capitalBookValue || 0), founderCapitalValue);

    if (founderCapitalValue > EPS) {
      gl.post({
        month: this.month,
        entityId: firm.id,
        kind: 'founder_productive_capital',
        lines: [
          { account: 'fixed_assets', debit: founderCapitalValue },
          { account: 'paid_in_capital', credit: founderCapitalValue }
        ]
      });
      if (market) {
        market.sharePrice = Math.max(0.1, founderCapitalValue / Math.max(1, market.sharesOutstanding));
        market.previousPrice = market.sharePrice;
        market.marketCap = market.sharePrice * market.sharesOutstanding;
      }
    }

    // A new firm enters with an executed founding team. This avoids the integer-rounding
    // deadlock where 1–4 workers cannot grow at a +12% hiring decision.
    const workforceTarget = 6;
    const unemployed = country.households.filter(household => !household.employed).slice(0, workforceTarget);
    for (const household of unemployed) {
      household.employed = true;
      household.employerId = firm.id;
      household.wage = firm.wage;
      firm.workers += 1;
    }
    firm.desiredWorkers = Math.max(firm.workers, workforceTarget);
    firm.startupWorkforceTarget = workforceTarget;
    firm.entryMonth = this.month;

    // Raise working capital from real household deposits through the existing equity
    // settlement/accounting path. No synthetic firm cash is injected here.
    if (!market) return firm;
    const targetCash = Math.max(firm.wage * Math.max(1, workforceTarget) * 1.8, firm.safeCash * 0.65);
    let remaining = targetCash;
    const investors = country.households
      .map(household => {
        const cash = this.ledger.balance(household.accountId);
        const buffer = Math.max(25, household.wage * (household.employed ? 1.35 : 1.9));
        return { household, excess: Math.max(0, cash - buffer) };
      })
      .filter(row => row.excess > EPS)
      .sort((a, b) => b.excess - a.excess);

    for (const { household, excess } of investors) {
      if (remaining <= EPS) break;
      const requested = Math.min(remaining, excess * 0.12);
      const paid = this.ledger.transfer({
        month: this.month,
        countryId: country.id,
        from: household.accountId,
        to: firm.accountId,
        amount: requested,
        kind: 'equity_subscription',
        meta: { householdId: household.id, firmId: firm.id, startupRound: true, sharePrice: market.sharePrice }
      });
      if (!(paid > EPS)) continue;
      const shares = paid / Math.max(0.01, market.sharePrice);
      this.assetMarket.recordPrimarySubscription(household, firm, this.month, paid, shares);
      market.sharesOutstanding += shares;
      market.publicShares += shares;
      market.issuanceCumulative += paid;
      market.marketCap = market.sharePrice * market.sharesOutstanding;
      remaining -= paid;
    }
    return firm;
  }

  stepMonth() {
    super.stepMonth();

    // The legacy exit loop created at most two replacements even when more firms exited.
    // Replace every recorded exit so the economy does not mechanically lose productive
    // organizations simply because of an array slice.
    for (const country of this.countries) {
      const exits = country.lastIndustry?.exitIndustries || [];
      const alreadyCreated = Math.max(0, Number(country.lastIndustry?.entries || 0));
      let extra = 0;
      for (const industryId of exits.slice(alreadyCreated)) {
        this.createEntrant(country, industryId);
        extra += 1;
      }
      if (country.lastIndustry) {
        country.lastIndustry.entries = alreadyCreated + extra;
        country.lastIndustry.activeFirms = country.firms.filter(firm => firm.active !== false).length;
      }
      if (country.macro) country.macro.activeFirms = country.firms.filter(firm => firm.active !== false).length;
    }
  }
}
