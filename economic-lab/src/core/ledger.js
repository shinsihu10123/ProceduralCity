const EPS = 1e-9;

export class TransactionLedger {
  constructor() {
    this.accounts = new Map();
    this.entries = [];
    this.sequence = 1;
    this.openingByCountry = new Map();
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

    const entry = {
      id: `TX-${String(this.sequence++).padStart(9, '0')}`,
      month,
      countryId,
      kind,
      amount: settled,
      postings: [
        { accountId: from, delta: -settled },
        { accountId: to, delta: settled }
      ],
      meta
    };
    this.entries.push(entry);
    if (this.entries.length > 120000) this.entries.splice(0, this.entries.length - 120000);
    return settled;
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
    const current = this.totalBalance(countryId);
    let maxPostingError = 0;
    let unbalancedEntries = 0;
    for (const entry of this.entries) {
      if (entry.countryId !== countryId) continue;
      const sum = entry.postings.reduce((s, p) => s + p.delta, 0);
      maxPostingError = Math.max(maxPostingError, Math.abs(sum));
      if (Math.abs(sum) > 1e-7) unbalancedEntries += 1;
    }
    const negativeAccounts = [...this.accounts.values()].filter(a => a.countryId === countryId && a.balance < -1e-7).length;
    const moneyError = current - opening;
    return {
      ok: Math.abs(moneyError) < 1e-6 && unbalancedEntries === 0 && negativeAccounts === 0,
      openingMoney: opening,
      currentMoney: current,
      moneyError,
      unbalancedEntries,
      negativeAccounts,
      maxPostingError
    };
  }
}
