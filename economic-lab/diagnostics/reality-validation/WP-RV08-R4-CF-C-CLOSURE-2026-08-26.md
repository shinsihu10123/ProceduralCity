# WP-RV08-R4-CF-C — Procurement Counterfactual Envelope — Closure

Date: 2026-08-26
Authoritative run: 32935426796
Authoritative pre-run HEAD: `0669acf367f39965058f9199d8cdde74bcc3c7c4`

## Verdict

**CLOSED / PASS AS DIAGNOSTIC EVIDENCE**

All four 24-month seeds passed the R4-CF-C gate: Original A (`ECON-RV02-A`), Original C (`ECON-RV02-C`), Heldout E (`ECON-RV08-HOLDOUT-E`), Heldout F (`ECON-RV08-HOLDOUT-F`).

Required invariants passed on all seeds: no mutation by the diagnostic, exact audit replay, validation ordering, exact canonical replay, hard accounting health, buyer observation, and counterfactual recovery observation.

## 24-month average decomposition

| Seed | 42%→full-cash recovery | full-cash→inventory-only recovery | residual shortage at 42% | residual shortage at full cash | residual shortage inventory-only |
|---|---:|---:|---:|---:|---:|
| Original A | 9.0875 | 77.0673 | 109.0835 | 99.9960 | 22.9287 |
| Original C | 7.3115 | 75.6891 | 100.7827 | 93.4712 | 17.7820 |
| Heldout E | 8.5673 | 70.3750 | 96.9032 | 88.3359 | 17.9609 |
| Heldout F | 11.9416 | 68.2856 | 97.6660 | 85.7244 | 17.4387 |

Cross-seed mean:
- 42%→full-cash recovery: ~9.23 input units/month.
- full-cash→inventory-only recovery: ~72.85 input units/month.
- residual shortage under inventory-only upper bound: ~19.03 input units/month.

## Diagnostic conclusion

The canonical 42% cash reservation is a real contributor, but it is not the dominant procurement-side restriction. Removing only the 42% reservation and allowing buyers to spend all current cash recovers only about 7–12 units/month across seeds. Removing the buyer cash/settlement constraint while preserving the physically available supplier-inventory ceiling recovers about 68–77 additional units/month.

Therefore the evidence supports a **buyer settlement / working-capital architecture gap** as the dominant procurement-side constraint within the tested envelope. A smaller but persistent residual remains even at the inventory-only upper bound, so supplier inventory / production / timing remains a secondary causal component and must not be erased from the diagnosis.

This result does **not** authorize a canonical economic mutation and does not justify arbitrary tuning of the 42% coefficient. The next dependency-safe step is a shadow invoice/trade-credit contract experiment that preserves canonical world state and accounting invariants while testing whether economically structured deferred settlement can realize part of the identified 68–77 unit/month envelope without creating free liquidity or accounting violations.

## Next gate

Proceed to **WP-RV08-R4-CF-D — Invoice / Trade-Credit Shadow Contract**.

Canonical supply-chain mutation remains locked until R4-CF-D evidence is complete.