# WP-RV07-P19 — Exact Payroll-Liquidity Bridge Sector Matrix

## Purpose

Run a stronger causal upper-bound than P4. P4 was collateral- and bank-capital-capped and consumer-facing only. P19 asks whether **the payroll timing shortfall itself** is causal when the exact missing cash is bridged without a fitted coefficient.

## Variants

1. unit-basis control
2. exact bridge for consumer-facing firms only
3. exact bridge for upstream/non-consumer firms only
4. exact bridge for all active firms

## Bridge definition

Immediately before payroll accrual/settlement, for an eligible firm:

`bridge = max(0, exact payroll due - current ledger cash)`

No collateral haircut, no fitted multiplier, no bank-capital cap. A zero-rate one-month synthetic loan is recorded through the existing ledger and accounting loan interfaces. After all domestic sales, fiscal demand and taxes, the bridge is repaid from available same-month cash before accounting close; any residual remains as a loan.

This is an **upper-bound causal experiment**, not a production credit policy.

## Interpretation

- Large improvement in consumer-only: consumer cash-cycle timing is central.
- Large improvement in upstream-only: B2B/payroll timing is central upstream.
- Only all-firm improvement: system-wide liquidity interaction.
- Little improvement in all variants: payroll liquidity stress is symptomatic rather than the primary residual cause.

## Design

compact + baseline, A/B/C seeds, 12 months, unit-basis candidate, deterministic replay.

## Hard gates

Determinism, health, complete coverage, bridge issuance, exact shortfall amount, scope correctness, ledger integrity, GDP identity, finite rows.

## Boundary

No canonical merge. No parameter tuning. Internal causal evidence is not empirical calibration.
