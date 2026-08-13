const EPS = 1e-9;
const DEFAULT_ENTRY_CAPACITY = 120000;

function exactIndexKey(month, countryId, kind) {
  return `${month}\u0000${countryId}\u0000${kind}`;
}

function monthCountryIndexKey(month, countryId) {
  return `${month}\u0000${countryId}`;
}

function addToIndex(index, key, entry) {
  let bucket = index.get(key);
  if (!bucket) {
    bucket = new Set();
    index.set(key, bucket);
  }
  bucket.add(entry);
}

function removeFromIndex(index, key, entry) {
  const bucket = index.get(key);
  if (!bucket) return;
  bucket.delete(entry);
  if (bucket.size === 0) index.delete(key);
}

export class TransactionLedger {
  constructor({ entryCapacity = DEFAULT_ENTRY_CAPACITY } = {}) {
    this.accounts = new Map();
    this.sequence = 1;
    this.openingByCountry = new Map();
    this.authorizedMoneyDeltaByCountry = new Map();
    this.totalBalanceByCountry = new Map();
    this.accountIdsByCountry = new Map();
    this.verificationByCountry = new Map();

    this.entryCapacity = Math.max(1, Math.round(Number(entryCapacity || DEFAULT_ENTRY_CAPACITY)));
    this._entryBuffer = new Array(this.entryCapacity);
    this._entryHead = 0;
    this._entrySize = 0;
    this._entriesByExactKey = new Map();
    this._entriesByMonthCountry = new Map();
  }

  // Compatibility view for observer/debug code. The simulation hot path uses the
  // indexed ring buffer directly and does not materialize this array.
  get entries() {
    return this.retainedEntries();
  }

  openAccount({ id, ownerId, countryId, type, openingBalance = 0 }) {
    if (this.accounts.has(id)) throw new Error(`duplicate account: ${id}`);
    const balance = Number(openingBalance);
    if (!Number.isFinite(balance) || balance < 0) throw new Error(`invalid opening balance: ${id}`);
    this.accounts.set(id, { id, ownerId, countryId, type, balance });
    this.openingByCountry.set(countryId, (this.openingByCountry.get(countryId) || 0) + balance);
    this.totalBalanceByCountry.set(countryId, (this.totalBalanceByCountry.get(countryId) || 0) + balance);
    if (!this.accountIdsByCountry.has(countryId)) this.accountIdsByCountry.set(countryId, new Set());
    this.accountIdsByCountry.get(countryId).add(id);
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
    this.totalBalanceByCountry.set(
      countryId,
      (this.totalBalanceByCountry.get(countryId) || 0) + actual
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

  verificationState(countryId) {
    let state = this.verificationByCountry.get(countryId);
    if (!state) {
      state = {
        unbalancedEntries: 0,
        monetaryAdjustmentErrors: 0,
        maxPostingError: 0,
        checkedEntries: 0
      };
      this.verificationByCountry.set(countryId, state);
    }
    return state;
  }

  recordEntryVerification(entry) {
    const state = this.verificationState(entry.countryId);
    const sum = entry.postings.reduce((s, p) => s + p.delta, 0);
    const monetaryDelta = Number(entry.monetaryDelta || 0);
    const error = sum - monetaryDelta;
    state.checkedEntries += 1;
    state.maxPostingError = Math.max(state.maxPostingError, Math.abs(error));
    if (Math.abs(error) > 1e-7) {
      if (Math.abs(monetaryDelta) > EPS) state.monetaryAdjustmentErrors += 1;
      else state.unbalancedEntries += 1;
    }
  }

  indexEntry(entry) {
    addToIndex(
      this._entriesByExactKey,
      exactIndexKey(entry.month, entry.countryId, entry.kind),
      entry
    );
    addToIndex(
      this._entriesByMonthCountry,
      monthCountryIndexKey(entry.month, entry.countryId),
      entry
    );
  }

  deindexEntry(entry) {
    if (!entry) return;
    removeFromIndex(
      this._entriesByExactKey,
      exactIndexKey(entry.month, entry.countryId, entry.kind),
      entry
    );
    removeFromIndex(
      this._entriesByMonthCountry,
      monthCountryIndexKey(entry.month, entry.countryId),
      entry
    );
  }

  retainEntry(entry) {
    if (this._entrySize < this.entryCapacity) {
      const index = (this._entryHead + this._entrySize) % this.entryCapacity;
      this._entryBuffer[index] = entry;
      this._entrySize += 1;
    } else {
      const evicted = this._entryBuffer[this._entryHead];
      this.deindexEntry(evicted);
      this._entryBuffer[this._entryHead] = entry;
      this._entryHead = (this._entryHead + 1) % this.entryCapacity;
    }
    this.indexEntry(entry);
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
    this.recordEntryVerification(entry);
    this.retainEntry(entry);
    return entry;
  }

  retainedEntries() {
    const out = new Array(this._entrySize);
    for (let i = 0; i < this._entrySize; i++) {
      out[i] = this._entryBuffer[(this._entryHead + i) % this.entryCapacity];
    }
    return out;
  }

  totalBalance(countryId) {
    return this.totalBalanceByCountry.get(countryId) || 0;
  }

  entriesFor({ month = null, countryId = null, kind = null } = {}) {
    if (month !== null && countryId !== null && kind !== null) {
      return Array.from(this._entriesByExactKey.get(exactIndexKey(month, countryId, kind)) || []);
    }
    if (month !== null && countryId !== null) {
      const bucket = this._entriesByMonthCountry.get(monthCountryIndexKey(month, countryId));
      if (!bucket) return [];
      if (kind === null) return Array.from(bucket);
      return Array.from(bucket).filter(e => e.kind === kind);
    }

    return this.retainedEntries().filter(e =>
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
    const verification = this.verificationState(countryId);

    let negativeAccounts = 0;
    const accountIds = this.accountIdsByCountry.get(countryId) || [];
    for (const accountId of accountIds) {
      if ((this.accounts.get(accountId)?.balance || 0) < -1e-7) negativeAccounts += 1;
    }

    const moneyError = current - expected;
    return {
      ok:
        Math.abs(moneyError) < 1e-6 &&
        verification.unbalancedEntries === 0 &&
        verification.monetaryAdjustmentErrors === 0 &&
        negativeAccounts === 0,
      openingMoney: opening,
      authorizedMoneyDelta: authorizedDelta,
      expectedMoney: expected,
      currentMoney: current,
      moneyError,
      unbalancedEntries: verification.unbalancedEntries,
      monetaryAdjustmentErrors: verification.monetaryAdjustmentErrors,
      negativeAccounts,
      maxPostingError: verification.maxPostingError,
      checkedEntries: verification.checkedEntries,
      retainedEntries: this._entrySize
    };
  }
}
