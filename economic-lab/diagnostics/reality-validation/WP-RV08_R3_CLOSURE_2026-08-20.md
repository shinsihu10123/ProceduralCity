# WP-RV08-R3 Closure — Entrant Regeneration Institution × Supply Complementarity Matrix

Date: 2026-08-20
Status: **PASS**
Canonical mechanism changes: **0**
Fitted parameter tuning: **0**

## Execution evidence

Workflow run: `32369074125`
Job: `96425188767`
Conclusion: **SUCCESS**
Artifact: `economic-lab-wp-rv08-r3`, ID `9406499783`
Artifact SHA256: `c5365131be3757ea30c522001345df99d20390a24f1327b49dc2bd2eb2f8a36a`

All hard gates passed, including deterministic replay, health, complete 8 × 2 × 3 coverage, settlement ledger, general accounting, asset-market ownership/book reconciliation, GDP identity, special-equity reconciliation, special-loan reconciliation, and non-entrant exclusion.

## Baseline 12-month macro matrix

| Variant | Unemployment | Exits | Wage arrears | Goods fulfillment | Input shortage | Consumer output |
|---|---:|---:|---:|---:|---:|---:|
| control-canonical | 0.2514 | 248 | 64,933 | 0.557 | 40.6 | 118.6 |
| control-topo-fullcash | 0.2473 | 237 | 64,774 | 0.574 | 36.3 | 123.9 |
| priority-equity-canonical | 0.2524 | 249 | 64,933 | 0.533 | 44.8 | 113.8 |
| priority-equity-topo-fullcash | 0.2471 | 237 | 64,457 | 0.573 | 34.2 | 124.3 |
| safe-cash-equity-canonical | 0.2527 | 249 | 64,675 | 0.544 | 41.2 | 115.3 |
| safe-cash-equity-topo-fullcash | 0.2450 | 233 | 64,466 | 0.581 | 35.1 | 125.4 |
| bank-upper-canonical | 0.2495 | 186 | 63,451 | 0.553 | 39.4 | 118.9 |
| bank-upper-topo-fullcash | 0.2470 | 183 | 63,616 | 0.565 | 36.4 | 122.0 |

## Entrant regeneration results

### Control

Baseline canonical:

- births 159;
- ever-credit share 0;
- downstream output share 0;
- downstream revenue share 0;
- re-exit share 39.6%.

### Priority equity

Baseline canonical:

- births 159;
- ever-equity share 84.9%;
- downstream output share 83.3%;
- downstream revenue share 46.4%;
- special entrant equity only about 500 total;
- re-exit share 40.3%.

This is a sharp distinction: **very small real-cash equity subscriptions are enough to activate downstream production for many entrants, but not enough to make those entrants durable.**

### Safe-cash equity

Baseline canonical:

- births 159;
- ever-equity share 84.9%;
- downstream output share 78.2%;
- downstream revenue share 27.6%;
- special equity about 11,800;
- re-exit share 39.0%.

The larger accounting-conserving equity raise does not materially reduce baseline re-exit or aggregate unemployment. More startup cash is therefore not monotonically equivalent to better regeneration.

### Bank upper bound

Baseline canonical:

- births 132;
- ever-credit share 88.6%;
- downstream output share 85.3%;
- downstream revenue share 37.3%;
- special loan credit about 259,275;
- re-exit share 0%.

This upper bound eliminates entrant re-exit but changes 12-month mean unemployment only from 0.2514 to 0.2495. It strongly changes firm survival while barely changing the aggregate labor-collapse path.

With topo-fullcash, downstream revenue rises to 66.1% and output to 93.5%, yet mean unemployment remains 0.2470.

## Supply interaction

Topological sequencing + full-cash procurement is consistently physically helpful but macro-secondary over 12 months.

Control baseline effect versus canonical:

- unemployment: -0.00414;
- exits: -11;
- fulfillment: +0.01698;
- shortage: -4.32;
- consumer output: +4.49%.

Safe-cash equity receives the largest near-term macro benefit from the supply upper bound among the tested real-cash entrant-finance variants, but the resulting unemployment 0.2450 is still far from a stable economy.

## Claim ledger

### A — VERIFIED EXISTING FACT

1. Explicit entrant equity can activate downstream entrant production without creating money or deleting bank risk constraints.
2. Priority equity and safe-cash equity do **not** materially cure entrant re-exit at baseline scale.
3. The bank upper bound does eliminate entrant re-exit but barely changes aggregate unemployment.
4. Topological/full-cash supply improves physical throughput and reduces shortages, but does not by itself close the macro collapse.
5. Entrant survival and aggregate labor stability are therefore separable failure dimensions.

### B — DIAGNOSTIC LEAD

The dominant remaining collapse is now upstream of, or broader than, entrant startup finance: labor-demand contraction, operating viability/exit propagation, and economy-wide cash-flow feedback must be tested jointly.

### C — HYPOTHESIS

A coherent repair requires at least three distinct boundaries rather than one scalar fix:

- feasible production/unit basis;
- labor demand constrained by objectively supportable operating capacity rather than unstable defensive signals alone;
- exit/solvency propagation that distinguishes temporarily liquid but operating-viable firms from genuinely insolvent firms.

Entrant finance may remain a required institutional module, but it is not the primary aggregate-collapse repair.

### D — PROPOSED CHANGE

No production rule is admitted yet. R4 will stress the propagation/labor/solvency hypotheses over a longer horizon and simultaneously re-run the entrant-finance/supply matrix at 24 months.

## Verdict

**PASS — STARTUP FINANCE CAN RESTORE ENTRANT ACTIVITY AND, AT AN EXTREME BANK UPPER BOUND, SURVIVAL; IT DOES NOT EXPLAIN OR REPAIR THE AGGREGATE LABOR COLLAPSE. SUPPLY IS A REAL BUT SECONDARY COMPLEMENT.**
