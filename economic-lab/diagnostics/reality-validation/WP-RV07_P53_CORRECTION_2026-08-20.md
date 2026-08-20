# WP-RV07-P53 Instrumentation Correction — 2026-08-20

## Status

**BLOCKED — INSTRUMENTATION DEFECT IDENTIFIED; ECONOMIC CONCLUSION NOT ACCEPTED FROM FAILED RUN**

Failed run: `32328215176`

## Failure

All P53 hard gates passed except `projectedCashReconstructed`.

The v10 diagnostic wrapped `banking.originateCredit()` and reconstructed the firm counterfactual `projectedCash` after credit origination using the current ledger balance. That timestamp is wrong for this reconstruction.

Canonical monthly order is:

1. synchronize balances,
2. firm decision,
3. credit origination,
4. synchronize balances again.

`firmDecision()` constructs projected cash from the firm's synchronized `f.cash` at decision time, before current-month credit origination. Therefore a reconstruction that substitutes the post-origination ledger balance introduces an observer timing mismatch whenever current-month credit changes deposits.

## Correction

`firm-counterfactual-component-decomposition-v10b.mjs` changes observation only:

- snapshot each active firm's synchronized `f.cash` immediately before invoking the original `originateCredit()`;
- execute canonical credit origination unchanged;
- reconstruct P53 counterfactual projected cash from that pre-origination decision-time snapshot.

No firm decision, credit rule, ledger transaction, price, wage, productivity, supply, labor, exit, or accounting mechanism is modified.

## Controls

- Canonical economic mechanism changes: **0**
- Parameter tuning: **0**
- Repair merge: **0**
- Failed-run economic evidence admitted: **NO**
