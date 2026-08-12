const EPS = 1e-9;

export class TransactionLedger {
  constructor() {
    this.accounts = new Map();
    this.entries = [];
    this.sequence = 1;
    this.openingByCountry = new Map();
    this.authorizedMoneyDeltaByCountry = new Map();
  }

  openAccount({ id, ownerId, countryId, type, openingBalance = 0 }) {
    if (this.accounts.has(id)) throw new Error(`duplicate account: ${id}`);
    const balance = Number(openingBalance);
    if (!Number.isFinite(balance) || balance < 0) throw new Error(`invalid opening balance: ${id}`);
    this.accounts.set(id, { id, ownerId, countryId, type, balance });
    this.openingByCountry.set(countryId, (this.openingByCountry.get(countryId) || 0) + balance);
    return id;
  }

  balance(id) {
    const account = this.accounts.get(id);
    if (!account) throw new Error(`unknown account: ${id}`);
    return account.balance;
  }

  transfer({ month, countryId, from, to, amount, kind, meta = {} }) {
    const requested = Number(amount);
    if (!Number.isFinite(requested) || requested <= EPS || from === to) return 0;
    const debit = this.accounts.get(from);
    const credit = this.accounts.get(to);
    if (!debit || !credit) throw new Error(`unknown transfer account: ${from} -> ${to}`);
    if (debit.countryId !== countryId || credit.countryId !== countryId) {
      throw new Error(`cross-country transfer requires FX/settlement layer: ${from} -> ${to}`);
    }

    const settled = Math.min(requested, Math.max(0, debit.balance));
    if (settled <= EPS) return 0;

    debit.balance -= settled;
    credit.balance += settled;

    this.pushEntry({
      month,
      countryId,
      kind,
      amount: settled,
      postings: [
        { accountId: from, delta: -settled },
        { accountId: to, delta: settled }
      ],
      monetaryDelta: 0,
      meta
    });
    return settled;
  }

  adjustMoney({ month, countryId, accountId, amount, kind, meta = {} }) {
    const requested = Number(amount);
    if (!Number.isFinite(requested) || Math.abs(requested) <= EPS) return 0;
    const account = this.accounts.get(accountId);
    if (!account) throw new Error(`unknown monetary adjustment account: ${accountId}`);
    if (account.countryId !== countryId) throw new Error(`country mismatch for monetary adjustment: ${accountId}`);

    const actual = requested > 0
      ? requested
      : -Math.min(-requested, Math.max(0, account.balance));
    if (Math.abs(actual) <= EPS) return 0;

    account.balance += actual;
    this.authorizedMoneyDeltaByCountry.set(
      countryId,
      (this.authorizedMoneyDeltaByCountry.get(countryId) || 0) + actual
    );

    this.pushEntry({
      month,
      countryId,
      kind,
      amount: Math.abs(actual),
      postings: [{ accountId, delta: actual }],
      monetaryDelta: actual,
      meta
    });
    return actual;
  }

  pushEntry({ month, countryId, kind, amount, postings, monetaryDelta = 0, meta = {} }) {
    const entry = {
      id: `TX-${String(this.sequence++).padStart(9, '0')}`,
      month,
      countryId,
      kind,
      amount,
      postings,
      monetaryDelta,
      meta
    };
    this.entries.push(entry);
    if (this.entries.length > 120000) this.entries.splice(0, this.entries.length - 120000);
    return entry;
  }

  totalBalance(countryId) {
    let total = 0;
    for (const account of this.accounts.values()) if (account.countryId === countryId) total += account.balance;
    return total;
  }

  entriesFor({ month = null, countryId = null, kind = null } = {}) {
    return this.entries.filter(e =>
      (month === null || e.month === month) &&
      (countryId === null || e.countryId === countryId) &&
      (kind === null || e.kind === kind)
    );
  }

  verifyCountry(countryId) {
    const opening = this.openingByCountry.get(countryId) || 0;
    const authorizedDelta = this.authorizedMoneyDeltaByCountry.get(countryId) || 0;
    const expected = opening + authorizedDelta;
    const current = this.totalBalance(countryId);
    let maxPostingError = 0;
    let unbalancedEntries = 0;
    let monetaryAdjustmentErrors = 0;

    for (const entry of this.entries) {
      if (entry.countryId !== countryId) continue;
      const sum = entry.postings.reduce((s, p) => s + p.delta, 0);
      const monetaryDelta = Number(entry.monetaryDelta || 0);
      const error = sum - monetaryDelta;
      maxPostingError = Math.max(maxPostingError, Math.abs(error));
      if (Math.abs(error) > 1e-7) {
        if (Math.abs(monetaryDelta) > EPS) monetaryAdjustmentErrors += 1;
        else unbalancedEntries += 1;
      }
    }

    const negativeAccounts = [...this.accounts.values()].filter(a => a.countryId === countryId && a.balance < -1e-7).length;
    const moneyError = current - expected;
    return {
      ok: Math.abs(moneyError) < 1e-6 && unbalancedEntries === 0 && monetaryAdjustmentErrors === 0 && negativeAccounts === 0,
      openingMoney: opening,
      authorizedMoneyDelta: authorizedDelta,
      expectedMoney: expected,
      currentMoney: current,
      moneyError,
      unbalancedEntries,
      monetaryAdjustmentErrors,
      negativeAccounts,
      maxPostingError
    };
  }
}
