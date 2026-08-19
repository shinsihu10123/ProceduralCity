# WP-RV07-P18 — Firm Debt-Service Holiday Causal Ablation

## Purpose

Test whether firm debt service is a material causal source of the pre-payroll liquidity failures identified in P16.

## Intervention

Diagnostic upper bound only: every due **firm** loan payment is deferred one month on every month of the experiment. Household debt service, credit origination, bank decision logic, production, labor, procurement, prices, wages and exits remain canonical.

This is not a proposed debt policy or repair.

## Design

- control vs firm-debt-service-holiday
- compact + baseline
- seeds A/B/C
- 12 months
- unit-basis candidate retained
- exact deterministic replay for each variant/scale

## Causal interpretation

If unemployment/exits/payroll arrears materially improve, debt-service cash drain is a causal amplifier. If effects are negligible or adverse, firm debt service is not the dominant residual cause.

## Hard gates

Deterministic replay, health, complete coverage, holiday applied, zero firm debt-payment entries in the holiday variant, ledger integrity, GDP identity, finite rows.

## Boundary

No canonical merge, no parameter tuning, no empirical-realism claim.
