# WP-RV07-P23 — Firm Exit Suppression Causal Upper-Bound

## Purpose

P20/P21 show that the residual goods-market failure is primarily a collapse in finished-goods quantity and seller availability. P23 directly tests the **extensive-margin firm-exit channel** by preventing firm deactivation while preserving the existing distress-state update logic.

## Variants

1. `unit-basis-control` — frozen unit-basis diagnostic control.
2. `unit-basis-no-firm-exit-upper-bound` — duplicate the existing exit stress/distress calculation exactly, but when `distressMonths >= 4`, do not deactivate the firm and return no exit industry for replacement entry.

No other mechanism is changed.

## Questions

- If exit deactivation is removed as an upper bound, does consumer output / seller availability materially recover?
- Does unemployment fall because existing employers survive?
- Does preserved firm count merely accumulate wage arrears or input shortages instead?
- Is extensive-margin exit a primary driver or mainly a late amplifier after intensive capacity loss?

## Hard gates

- deterministic replay exact
- health
- complete country/month coverage
- suppression actually activated
- candidate reports zero exits
- ledger integrity
- GDP identity reconciliation
- finite rows

## Interpretation boundary

This is deliberately a strong causal upper bound, not a viable insolvency rule. A positive result establishes causal importance of exit/deactivation, not permission to abolish exits in production.

Canonical mechanism changes: 0. Parameter tuning: 0. Repair authorization: NO.

Workflow registration trigger: 2026-08-20.
