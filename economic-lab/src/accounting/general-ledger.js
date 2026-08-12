const EPS = 1e-9;

export const ACCOUNT_TYPES = {
  ASSET: 'asset',
  LIABILITY: 'liability',
  EQUITY: 'equity',
  REVENUE: 'revenue',
  EXPENSE: 'expense'
};

export class GeneralLedger {
  constructor() {
    this.entities = new Map();
    this.sequence = 1;
  }

  createEntity({ id, countryId, kind, accounts }) {
    if (this.entities.has(id)) throw new Error(`duplicate accounting entity: ${id}`);
    const chart = new Map();
    for (const account of accounts) chart.set(account.code, { ...account, balance: 0 });
    this.entities.set(id, {
      id,
      countryId,
      kind,
      accounts: chart,
      journals: [],
      monthlyResults: new Map()
    });
  }

  hasEntity(id) { return this.entities.has(id); }

  addAccount(entityId, account) {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`unknown accounting entity: ${entityId}`);
    if (entity.accounts.has(account.code)) return false;
    entity.accounts.set(account.code, { ...account, balance: 0 });
    return true;
  }

  account(entityId, code) {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`unknown accounting entity: ${entityId}`);
    const account = entity.accounts.get(code);
    if (!account) throw new Error(`unknown account ${entityId}:${code}`);
    return account;
  }

  rawBalance(entityId, code) {
    return this.account(entityId, code).balance;
  }

  naturalBalance(entityId, code) {
    const account = this.account(entityId, code);
    if (account.type === ACCOUNT_TYPES.ASSET || account.type === ACCOUNT_TYPES.EXPENSE) return account.balance;
    return -account.balance;
  }

  post({ month, entityId, kind, lines, meta = {} }) {
    if (!Array.isArray(lines) || lines.length < 2) throw new Error('journal requires at least two lines');
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`unknown accounting entity: ${entityId}`);

    let debit = 0;
    let credit = 0;
    const normalized = lines.map(line => {
      if (!entity.accounts.has(line.account)) throw new Error(`unknown account ${entityId}:${line.account}`);
      const dr = Number(line.debit || 0);
      const cr = Number(line.credit || 0);
      if (!Number.isFinite(dr) || !Number.isFinite(cr) || dr < -EPS || cr < -EPS) throw new Error('invalid journal amount');
      if (dr > EPS && cr > EPS) throw new Error('journal line cannot be both debit and credit');
      debit += dr;
      credit += cr;
      return { account: line.account, debit: dr, credit: cr };
    });

    if (Math.abs(debit - credit) > 1e-7) throw new Error(`unbalanced journal ${entityId}: ${debit} != ${credit}`);
    if (debit <= EPS) return null;

    for (const line of normalized) entity.accounts.get(line.account).balance += line.debit - line.credit;

    const journal = {
      id: `JE-${String(this.sequence++).padStart(9, '0')}`,
      month,
      entityId,
      countryId: entity.countryId,
      kind,
      lines: normalized,
      debit,
      credit,
      meta
    };
    entity.journals.push(journal);
    if (entity.journals.length > 5000) entity.journals.splice(0, entity.journals.length - 5000);
    return journal;
  }

  incomeStatement(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`unknown accounting entity: ${entityId}`);
    let revenue = 0;
    let expense = 0;
    for (const account of entity.accounts.values()) {
      if (account.type === ACCOUNT_TYPES.REVENUE) revenue += -account.balance;
      if (account.type === ACCOUNT_TYPES.EXPENSE) expense += account.balance;
    }
    return { revenue, expense, netIncome: revenue - expense };
  }

  balanceSheet(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`unknown accounting entity: ${entityId}`);
    let assets = 0;
    let liabilities = 0;
    let equity = 0;
    const accounts = {};
    for (const account of entity.accounts.values()) {
      const natural = account.type === ACCOUNT_TYPES.ASSET || account.type === ACCOUNT_TYPES.EXPENSE
        ? account.balance
        : -account.balance;
      accounts[account.code] = natural;
      if (account.type === ACCOUNT_TYPES.ASSET) assets += natural;
      if (account.type === ACCOUNT_TYPES.LIABILITY) liabilities += natural;
      if (account.type === ACCOUNT_TYPES.EQUITY) equity += natural;
    }
    const equationError = assets - liabilities - equity;
    return { assets, liabilities, equity, equationError, accounts };
  }

  closeMonth(entityId, month) {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`unknown accounting entity: ${entityId}`);
    const statement = this.incomeStatement(entityId);
    entity.monthlyResults.set(month, { ...statement });
    if (entity.monthlyResults.size > 240) {
      const oldest = [...entity.monthlyResults.keys()].sort((a, b) => a - b)[0];
      entity.monthlyResults.delete(oldest);
    }

    const lines = [];
    for (const account of entity.accounts.values()) {
      if (account.type === ACCOUNT_TYPES.REVENUE && account.balance < -EPS) lines.push({ account: account.code, debit: -account.balance });
      if (account.type === ACCOUNT_TYPES.EXPENSE && account.balance > EPS) lines.push({ account: account.code, credit: account.balance });
    }
    if (statement.netIncome > EPS) lines.push({ account: 'retained_earnings', credit: statement.netIncome });
    else if (statement.netIncome < -EPS) lines.push({ account: 'retained_earnings', debit: -statement.netIncome });

    if (lines.length >= 2) this.post({ month, entityId, kind: 'period_close', lines });
    return statement;
  }

  lastMonthlyResult(entityId, month) {
    return this.entities.get(entityId)?.monthlyResults.get(month) || { revenue: 0, expense: 0, netIncome: 0 };
  }

  verifyEntity(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`unknown accounting entity: ${entityId}`);
    let unbalancedJournals = 0;
    let maxJournalError = 0;
    for (const journal of entity.journals) {
      const error = Math.abs(journal.debit - journal.credit);
      maxJournalError = Math.max(maxJournalError, error);
      if (error > 1e-7) unbalancedJournals += 1;
    }
    const bs = this.balanceSheet(entityId);
    return {
      ok: unbalancedJournals === 0 && Math.abs(bs.equationError) < 1e-6,
      unbalancedJournals,
      maxJournalError,
      equationError: bs.equationError
    };
  }
}