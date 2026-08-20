import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Horizon-safe diagnostic launcher for WP-RV08-R4-D.
//
// The canonical TransactionLedger intentionally retains only a bounded ring of
// transaction detail (120,000 entries by default). The original R3 script
// compared the all-horizon funding audit rows against `ledger.entries` at the
// END of a run. That is exact at 12 months, but at 24 months older special
// funding transactions can be evicted from the retained-detail ring even though
// the ledger's cumulative balances and verification state remain correct.
//
// This launcher does NOT change any economic mechanism. It patches only the
// diagnostic evidence counter so that every actual settled special-equity or
// special-loan amount is accumulated at the instant the settlement API returns
// success. The original fundingRows are then reconciled against these cumulative
// settlement-return counters rather than against the bounded retained-detail
// observer buffer.

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(here, 'rv08-entrant-regeneration-supply-matrix-v10.mjs');
const runtimePath = resolve(here, '.rv08-r4d-long-horizon-runtime.mjs');
let src = readFileSync(sourcePath, 'utf8');

const substitutions = [
  [
    "const meta=w.__r3Entrants.get(f.id);meta.specialEquity+=paid;",
    "w.__r3SettledFunding.equity+=paid;const meta=w.__r3Entrants.get(f.id);meta.specialEquity+=paid;"
  ],
  [
    "const meta=w.__r3Entrants.get(app.borrower.id);meta.specialLoan+=created;",
    "w.__r3SettledFunding.loan+=created;const meta=w.__r3Entrants.get(app.borrower.id);meta.specialLoan+=created;"
  ],
  [
    "function configure(w,v,scale,seed,instrument=true){if(!instrument)return;w.__r3Variant=v.id;w.__r3FundingRows=[];",
    "function configure(w,v,scale,seed,instrument=true){if(!instrument)return;w.__r3Variant=v.id;w.__r3FundingRows=[];w.__r3SettledFunding={equity:0,loan:0};"
  ],
  [
    "specialEquityLedger:instrument?S(w.ledger.entries.filter(e=>e.kind==='equity_subscription'&&e.meta?.rv08R3===true).map(e=>e.amount)):0,specialLoanLedger:instrument?S(w.ledger.entries.filter(e=>e.kind==='bank_loan_origination'&&e.meta?.rv08R3===true).map(e=>e.amount)):0",
    "specialEquityLedger:instrument?F(w.__r3SettledFunding?.equity):0,specialLoanLedger:instrument?F(w.__r3SettledFunding?.loan):0"
  ],
  [
    "workPackage:'WP-RV08-R3',title:'Entrant regeneration institution x supply complementarity matrix'",
    "workPackage:'WP-RV08-R4-D',title:'24m entrant regeneration institution x supply complementarity matrix (horizon-safe settlement reconciliation)'"
  ]
];

for (const [from, to] of substitutions) {
  if (!src.includes(from)) throw new Error(`R4-D patch anchor missing: ${from.slice(0, 96)}`);
  src = src.replace(from, to);
}

src += "\nconsole.log('WP_RV08_R4D_HORIZON_SAFE_RECONCILIATION', JSON.stringify({mode:'cumulative-settlement-return', retainedLedgerIsBoundedObserver:true}));\n";
writeFileSync(runtimePath, src, 'utf8');
await import(`${pathToFileURL(runtimePath).href}?run=${Date.now()}`);
