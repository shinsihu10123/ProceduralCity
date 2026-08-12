import { clamp } from '../core/rng.js';
import { evaluateCreditApplication } from '../ai/bank-reasoning.js';

const EPS = 1e-8;

export class BankSystem {
  constructor({ ledger, accounting, rng }) {
    this.ledger = ledger;
    this.accounting = accounting;
    this.rng = rng;
    this.loanSequence = 1;
  }

  initializeCountry(country) {
    const bank = {
      id: `${country.id}-BANK-01`,
      countryId: country.id,
      kind: 'bank',
      name: `${country.name} 상업은행`,
      baseAnnualRate: 0.032 + (1 - country.financialAccess) * 0.035,
      loanMarkup: 0.025 + (1 - country.financialAccess) * 0.02,
      minCapitalRatio: 0.085 + (1 - country.financialAccess) * 0.025,
      initialCapitalRatio: 0.11 + country.financialAccess * 0.035,
      riskAversion: clamp(0.48 + (1 - country.financialAccess) * 0.18 + this.rng.normal(0, 0.05), 0.2, 0.9),
      optimism: clamp(this.rng.normal(0, 0.18), -0.6, 0.6),
      modelUncertainty: clamp(0.35 + (1 - country.financialAccess) * 0.35, 0.15, 0.8),
      lastTrace: null,
      defaults: 0,
      cumulativeChargeOffs: 0,
      cumulativeInterestIncome: 0
    };

    country.banks = [bank];
    country.loans = [];
    for (const h of country.households) {
      h.bankId = bank.id;
      h.loanBalance = 0;
      h.creditMisses = 0;
    }
    for (const f of country.firms) {
      f.bankId = bank.id;
      f.loanBalance = 0;
      f.creditMisses = 0;
    }

    const openingDeposits = this.ledger.totalBalance(country.id);
    this.accounting.initializeBank(bank, openingDeposits);
    country.lastCredit = this.emptyMetrics();
  }

  registerFirm(country, firm) {
    const bank = country.banks[0];
    firm.bankId = bank.id;
    firm.loanBalance = firm.loanBalance || 0;
    firm.creditMisses = firm.creditMisses || 0;
  }

  emptyMetrics() {
    return {
      applications: 0,
      approved: 0,
      rejected: 0,
      newCredit: 0,
      moneyCreated: 0,
      payments: 0,
      principalRepaid: 0,
      interestPaid: 0,
      moneyDestroyed: 0,
      missedPayments: 0,
      defaults: 0,
      chargeOffs: 0,
      outstandingLoans: 0
    };
  }

  serviceDebt(country, month) {
    const metrics = this.emptyMetrics();
    const bank = country.banks[0];
    const borrowerMap = new Map([
      ...country.households.map(x => [x.id, x]),
      ...country.firms.map(x => [x.id, x])
    ]);

    for (const loan of country.loans) {
      if (loan.status !== 'active' || month < loan.nextPaymentMonth) continue;
      const borrower = borrowerMap.get(loan.borrowerId);
      if (!borrower) continue;

      const scheduledPrincipal = Math.min(loan.outstanding, loan.originalPrincipal / loan.termMonths);
      const interestDue = loan.outstanding * loan.monthlyRate;
      const totalDue = scheduledPrincipal + interestDue + Math.min(loan.arrears, scheduledPrincipal * 0.5);
      const balance = this.ledger.balance(borrower.accountId);
      const requestedPayment = Math.min(totalDue, balance);
      const monetaryDelta = this.ledger.adjustMoney({
        month,
        countryId: country.id,
        accountId: borrower.accountId,
        amount: -requestedPayment,
        kind: 'bank_loan_payment',
        meta: { loanId: loan.id, bankId: bank.id, borrowerId: borrower.id }
      });
      const paid = Math.max(0, -monetaryDelta);

      const interestPaid = Math.min(paid, interestDue);
      const principalPaid = Math.min(loan.outstanding, Math.max(0, paid - interestPaid));
      const unpaid = Math.max(0, totalDue - paid);

      if (paid > EPS) {
        this.accounting.recordLoanPayment({
          country,
          bank,
          borrower,
          loan,
          month,
          principalPaid,
          interestPaid
        });
        loan.outstanding = Math.max(0, loan.outstanding - principalPaid);
        borrower.loanBalance = Math.max(0, borrower.loanBalance - principalPaid);
        bank.cumulativeInterestIncome += interestPaid;
        metrics.payments += 1;
        metrics.principalRepaid += principalPaid;
        metrics.interestPaid += interestPaid;
        metrics.moneyDestroyed += paid;
      }

      if (unpaid > Math.max(1, totalDue * 0.35)) {
        loan.missedPayments += 1;
        borrower.creditMisses = (borrower.creditMisses || 0) + 1;
        metrics.missedPayments += 1;
      } else {
        loan.missedPayments = Math.max(0, loan.missedPayments - 1);
      }
      loan.arrears = Math.max(0, loan.arrears * 0.65 + unpaid);
      loan.nextPaymentMonth = month + 1;

      if (loan.outstanding <= EPS) {
        loan.status = 'repaid';
        loan.outstanding = 0;
        loan.arrears = 0;
        continue;
      }

      const severeArrears = loan.arrears > Math.max(loan.originalPrincipal * 0.22, scheduledPrincipal * 3);
      if (loan.missedPayments >= 3 || severeArrears) {
        const chargeOff = loan.outstanding;
        this.accounting.recordLoanDefault({ country, bank, borrower, loan, month, amount: chargeOff });
        borrower.loanBalance = Math.max(0, borrower.loanBalance - chargeOff);
        loan.outstanding = 0;
        loan.status = 'defaulted';
        loan.defaultMonth = month;
        bank.defaults += 1;
        bank.cumulativeChargeOffs += chargeOff;
        metrics.defaults += 1;
        metrics.chargeOffs += chargeOff;
      }
    }

    metrics.outstandingLoans = country.loans.reduce((s, l) => s + (l.status === 'active' ? l.outstanding : 0), 0);
    return metrics;
  }

  originateCredit(country, month, signals) {
    const metrics = this.emptyMetrics();
    const bank = country.banks[0];
    const applications = this.buildApplications(country);

    for (const application of applications) {
      const borrower = application.borrower;
      const bankStatement = this.accounting.entityStatement(bank.id, month).balanceSheet;
      const decision = evaluateCreditApplication(
        bank,
        { id: borrower.id, kind: application.kind },
        application,
        bankStatement,
        signals,
        this.rng
      );
      bank.lastTrace = decision.trace;
      metrics.applications += 1;

      if (!decision.approved) {
        metrics.rejected += 1;
        continue;
      }

      const amount = this.capByBankCapital(bank, bankStatement, application.amount);
      if (amount <= EPS) {
        metrics.rejected += 1;
        continue;
      }

      const created = this.ledger.adjustMoney({
        month,
        countryId: country.id,
        accountId: borrower.accountId,
        amount,
        kind: 'bank_loan_origination',
        meta: { bankId: bank.id, borrowerId: borrower.id }
      });
      if (created <= EPS) {
        metrics.rejected += 1;
        continue;
      }

      const loan = {
        id: `LN-${String(this.loanSequence++).padStart(8, '0')}`,
        countryId: country.id,
        bankId: bank.id,
        borrowerId: borrower.id,
        borrowerKind: application.kind,
        originalPrincipal: created,
        outstanding: created,
        annualRate: decision.annualRate,
        monthlyRate: decision.monthlyRate,
        termMonths: application.termMonths,
        originatedMonth: month,
        nextPaymentMonth: month + 1,
        missedPayments: 0,
        arrears: 0,
        status: 'active',
        estimatedDefaultProbabilityAtOrigination: decision.estimatedDefaultProbability
      };
      country.loans.push(loan);
      borrower.loanBalance = (borrower.loanBalance || 0) + created;
      this.accounting.recordLoanOrigination({ country, bank, borrower, loan, month, amount: created });

      metrics.approved += 1;
      metrics.newCredit += created;
      metrics.moneyCreated += created;
    }

    metrics.outstandingLoans = country.loans.reduce((s, l) => s + (l.status === 'active' ? l.outstanding : 0), 0);
    return metrics;
  }

  buildApplications(country) {
    const apps = [];

    for (const f of country.firms) {
      if (f.active === false) continue;
      const cash = this.ledger.balance(f.accountId);
      const payrollNeed = Math.max(1, f.wage * Math.max(1, f.desiredWorkers));
      const inputNeed = Math.max(0, (f.supplyShortage || 0) * Math.max(0.1, f.price));
      const workingCapitalTarget = Math.max(payrollNeed * 1.8 + inputNeed * 0.6, f.safeCash * 0.72);
      const shortfall = Math.max(0, workingCapitalTarget - cash);
      const expansionNeed = f.currentPlan?.selected === '확장' ? payrollNeed * 0.45 : 0;
      const amount = Math.min(Math.max(shortfall, expansionNeed), f.safeCash * 0.75);
      if (amount > payrollNeed * 0.12) {
        apps.push({
          borrower: f,
          kind: 'firm',
          amount,
          cash,
          debt: f.loanBalance || 0,
          arrears: f.wageArrears || 0,
          incomeBase: Math.max(payrollNeed, f.revenue || payrollNeed),
          termMonths: 18 + this.rng.int(0, 19)
        });
      }
    }

    for (const h of country.households) {
      const cash = this.ledger.balance(h.accountId);
      const incomeBase = Math.max(8, h.income || h.wage * (h.employed ? 1 : 0.16));
      const stressTarget = h.employed ? h.wage * 0.65 : h.wage * 1.25;
      const shortfall = Math.max(0, stressTarget - cash);
      if (shortfall > h.wage * 0.18 && (h.creditMisses || 0) < 5) {
        apps.push({
          borrower: h,
          kind: 'household',
          amount: Math.min(shortfall, h.wage * 1.6),
          cash,
          debt: h.loanBalance || 0,
          arrears: h.wageArrears || 0,
          incomeBase,
          termMonths: 10 + this.rng.int(0, 15)
        });
      }
    }

    apps.sort((a, b) => b.amount - a.amount);
    return apps.slice(0, Math.max(18, Math.round((country.firms.length + country.households.length) * 0.08)));
  }

  capByBankCapital(bank, bankStatement, requested) {
    const assets = Math.max(0, bankStatement.assets);
    const equity = Math.max(0, bankStatement.equity);
    const maxAssets = equity / Math.max(0.01, bank.minCapitalRatio);
    const capacity = Math.max(0, maxAssets - assets);
    return Math.min(requested, capacity);
  }

  combineMetrics(service, originations, country) {
    const out = this.emptyMetrics();
    for (const key of Object.keys(out)) out[key] = (service[key] || 0) + (originations[key] || 0);
    out.outstandingLoans = country.loans.reduce((s, l) => s + (l.status === 'active' ? l.outstanding : 0), 0);
    return out;
  }
}
