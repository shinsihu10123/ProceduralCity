# WP-RV08 R4-BE2 — Compact New-Credit Stabilizer Replication

Date: 2026-08-23
Mode: DIAGNOSTIC CAUSAL ABLATION
Status: EXECUTION CONTRACT

## Why BE2 exists

R4-BE completed the fiscal removal variants, but all four 36-month `no-new-credit` shards hit runtime cancellation after producing only incomplete artifacts. This is a runtime/coverage limitation, not an economic verdict.

BE2 isolates the unresolved credit leg with a shorter 24-month paired design.

## Matrix

Seeds: original A, original C, heldout E, heldout F.

Variants:
- control
- no-new-credit

Horizon: 24 months.

Total: 8 independent simulations.

## Intervention

`no-new-credit` replaces only new loan origination with an empty origination result while preserving existing debt service, deposits, accounting, fiscal flows, production, prices, wages, labor, firm exit/entry, and all other canonical mechanisms.

## Questions

1. Does new bank credit causally stabilize employment/output?
2. Does it mainly postpone exits while increasing debt stress?
3. Does removing credit materially alter wage arrears?
4. Is current credit effectively neutral because underwriting rejects the firms that most need productive working capital?

## Gates

Accounting, ledger, GDP arithmetic, finite metrics, normalization activation, complete 24-month coverage.

No canonical repair is authorized.
