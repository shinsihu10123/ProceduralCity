import { evaluateCreditApplication } from '../ai/bank-reasoning.js';
import { RNG } from '../core/rng.js';

const EPS = 1e-9;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clone(value) {
  return structuredClone(value);
}

export function bankCapitalCapacity(bank, bankStatement) {
  const assets = Math.max(0, finite(bankStatement?.assets));
  const equity = Math.max(0, finite(bankStatement?.equity));
  const minCapitalRatio = Math.max(0.01, finite(bank?.minCapitalRatio, 0.1));
  const maxAssets = equity / minCapitalRatio;
  return Math.max(0, maxAssets - assets);
}

export function capitalCappedAmount(bank, bankStatement, requestedAmount) {
  return Math.min(
    Math.max(0, finite(requestedAmount)),
    bankCapitalCapacity(bank, bankStatement)
  );
}

export function buildFirmWorkingCapitalApplicationSnapshot({ firm, cash }) {
  if (!firm || firm.active === false) return null;
  const depositCash = Math.max(0, finite(cash));
  const payrollNeed = Math.max(1, finite(firm.wage) * Math.max(1, finite(firm.desiredWorkers, 1)));
  const inputNeed = Math.max(0, finite(firm.supplyShortage) * Math.max(0.1, finite(firm.price, 0.1)));
  const workingCapitalTarget = Math.max(
    payrollNeed * 1.8 + inputNeed * 0.6,
    Math.max(0, finite(firm.safeCash)) * 0.72
  );
  const shortfall = Math.max(0, workingCapitalTarget - depositCash);
  const expansionNeed = firm.currentPlan?.selected === '확장' ? payrollNeed * 0.45 : 0;
  const requestedAmount = Math.min(
    Math.max(shortfall, expansionNeed),
    Math.max(0, finite(firm.safeCash)) * 0.75
  );
  const applicationEligible = requestedAmount > payrollNeed * 0.12;

  return {
    borrower: { id: String(firm.id), kind: 'firm' },
    kind: 'firm',
    amount: requestedAmount,
    cash: depositCash,
    debt: Math.max(0, finite(firm.loanBalance)),
    arrears: Math.max(0, finite(firm.wageArrears)),
    incomeBase: Math.max(payrollNeed, finite(firm.revenue, payrollNeed)),
    termMonths: 24,
    applicationEligible,
    payrollNeed,
    inputNeed,
    workingCapitalTarget,
    shortfall,
    expansionNeed,
    source: 'canonical-firm-application-formula-snapshot-v1',
    termSource: 'fixed-24m-for-isolated-snapshot-comparability'
  };
}

export function evaluateUnderwritingSnapshot({ bank, application, bankStatement, signals, rngState }) {
  if (!bank) throw new Error('bank is required');
  if (!application) throw new Error('application is required');
  if (!bankStatement) throw new Error('bankStatement is required');

  const bankClone = clone(bank);
  const appClone = clone(application);
  const statementClone = clone(bankStatement);
  const signalsClone = clone(signals || {});
  const rng = new RNG(Math.max(1, Math.round(finite(rngState, 1))));

  const decision = evaluateCreditApplication(
    bankClone,
    clone(appClone.borrower || { id: appClone.borrowerId || 'snapshot-borrower', kind: appClone.kind || 'firm' }),
    appClone,
    statementClone,
    signalsClone,
    rng
  );
  const requestedAmount = Math.max(0, finite(appClone.amount));
  const capitalCapacity = bankCapitalCapacity(bankClone, statementClone);
  const admissibleAmount = decision.approved
    ? Math.min(requestedAmount, capitalCapacity)
    : 0;

  return {
    version: 'r4-ce-d2-snapshot-underwriting-v1',
    mode: 'ISOLATED_SNAPSHOT_UNDERWRITING',
    requestedAmount,
    applicationEligible: appClone.applicationEligible !== false && requestedAmount > EPS,
    approved: Boolean(decision.approved) && requestedAmount > EPS,
    admissibleAmount,
    capitalCapacity,
    annualRate: finite(decision.annualRate),
    monthlyRate: finite(decision.monthlyRate),
    estimatedDefaultProbability: finite(decision.estimatedDefaultProbability),
    projectedCapitalRatio: finite(decision.projectedCapitalRatio),
    paymentBurden: finite(decision.paymentBurden),
    rejectionReason: decision.approved ? null : String(decision.trace?.reason || 'UNSPECIFIED_REJECTION'),
    trace: clone(decision.trace || null),
    evaluatorRngStateAfter: rng.state,
    source: {
      evaluator: 'evaluateCreditApplication-on-cloned-bank-and-rng',
      committedUndrawnCredit: 0,
      committedUndrawnCreditSource: 'NOT_MODELED_IN_CANONICAL_BANK_SYSTEM'
    }
  };
}
