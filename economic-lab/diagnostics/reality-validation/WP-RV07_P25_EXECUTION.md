# WP-RV07-P25 — Firm Decision Cash-Stress Signal Causal Ablation

## Purpose

P24 shows a very large association between negative hiring decisions and decision-time cash stress, especially late in the collapse. P25 tests whether the **cognitive response to cash stress itself** is a major feedback amplifier, separately from objective ledger liquidity.

## Variants

1. `unit-basis-control` — unchanged diagnostic control.
2. `unit-basis-firm-decision-cash-neutral` — during the firm-decision call only, expose cached firm cash equal to existing `safeCash`, which makes the existing `cashStress = clamp(1 - cash / safeCash, ...)` signal exactly zero. Before credit origination, restore the exact objective cached cash and verify it equals the ledger balance.

No ledger balance, payroll obligation, loan, procurement budget, price coefficient, production coefficient or exit rule is altered.

## Isolation boundary

The intervention deliberately changes the firm's *perceived/current decision cash state* used by its cognitive counterfactual planner, including projected cash calculations. It does not give the firm money. Objective settlement remains unchanged.

## Questions

- Does neutralizing decision cash stress reduce negative hiring targets?
- Does that preserve workforce/capacity and consumer output?
- Does it improve fulfillment and exits, or merely increase arrears/input stress as in blanket labor-retention tests?
- Is cash-stress cognition a primary feedback amplifier or only a symptom of already-insolvent firms?

## Hard gates

Deterministic replay, health, complete coverage, candidate decision traces report zero perceived cash stress, objective cash stress is actually present, cached cash is restored to the ledger before credit, ledger integrity, GDP identity and finite rows.

## Boundary

This is a causal diagnostic upper bound, not a truthful-information or production policy. No canonical change, tuning or repair authorization.

Workflow registration trigger: 2026-08-20.
