import assert from 'node:assert/strict';
import { TransactionLedger } from '../src/core/ledger.js';

const ledger = new TransactionLedger({ entryCapacity: 4 });
ledger.openAccount({ id: 'A', ownerId: 'A', countryId: 'TST', type: 'deposit', openingBalance: 100 });
ledger.openAccount({ id: 'B', ownerId: 'B', countryId: 'TST', type: 'deposit', openingBalance: 20 });

for (let month = 1; month <= 6; month++) {
  const from = month % 2 ? 'A' : 'B';
  const to = month % 2 ? 'B' : 'A';
  const paid = ledger.transfer({
    month,
    countryId: 'TST',
    from,
    to,
    amount: 1,
    kind: month % 2 ? 'odd_transfer' : 'even_transfer',
    meta: { month }
  });
  assert.equal(paid, 1);
}

assert.equal(ledger.entries.length, 4, 'ring buffer must retain only configured audit capacity');
assert.deepEqual(ledger.entries.map(entry => entry.month), [3, 4, 5, 6]);
assert.deepEqual(ledger.entries.map(entry => entry.id), [
  'TX-000000003',
  'TX-000000004',
  'TX-000000005',
  'TX-000000006'
]);
assert.equal(ledger.entriesFor({ month: 1, countryId: 'TST', kind: 'odd_transfer' }).length, 0, 'evicted audit rows must leave indexes');
assert.equal(ledger.entriesFor({ month: 5, countryId: 'TST', kind: 'odd_transfer' }).length, 1);
assert.equal(ledger.entriesFor({ month: 6, countryId: 'TST', kind: 'even_transfer' })[0].meta.month, 6);
assert.deepEqual(ledger.entriesFor({ month: 4, countryId: 'TST' }).map(entry => entry.month), [4]);

const beforeMoney = ledger.totalBalance('TST');
assert.equal(beforeMoney, 120);
ledger.adjustMoney({ month: 7, countryId: 'TST', accountId: 'A', amount: 7, kind: 'test_creation' });
assert.equal(ledger.totalBalance('TST'), 127);
assert.deepEqual(ledger.entries.map(entry => entry.month), [4, 5, 6, 7]);

const verification = ledger.verifyCountry('TST');
assert.ok(verification.ok);
assert.equal(verification.checkedEntries, 7, 'verification must retain full-history audit statistics beyond ring capacity');
assert.equal(verification.retainedEntries, 4);
assert.equal(verification.unbalancedEntries, 0);
assert.equal(verification.monetaryAdjustmentErrors, 0);
assert.ok(Math.abs(verification.moneyError) < 1e-9);

// Compatibility materialization must be detached from the ring storage array.
const materialized = ledger.entries;
materialized.length = 0;
assert.equal(ledger.entries.length, 4);

console.log('Economic Lab v0.10 settlement ledger ring/index gate PASS');
