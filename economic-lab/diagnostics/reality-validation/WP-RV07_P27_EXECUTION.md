# WP-RV07-P27 — Strategy-Specific Labor-Contraction Causal Matrix

## Purpose

P24/P25 show that negative labor targets are a major capacity-loss channel and that cash-stress cognition causally amplifies those targets. P27 isolates the **labor-action component of the selected strategy** without changing the strategy selection, production plan, price decision, objective cash, credit or exit rules.

## Variants

1. `unit-basis-control`
2. hold only `방어`-selected planned labor contraction
3. hold only `현금 보존`-selected planned labor contraction
4. hold both `방어` and `현금 보존` planned labor contraction

For a targeted active firm whose already-selected `desiredWorkers < current workers`, set `desiredWorkers = current workers` immediately before the labor market. Hiring above current workers and every non-targeted decision remain unchanged.

## Questions

- Which selected strategy's labor action drives the early versus late capacity collapse?
- Does preserving labor in `방어` plans mainly matter in M1-6?
- Does preserving labor in `현금 보존` plans mainly matter in M7-12?
- Does the combined path reproduce the P25 labor/output improvement or instead accumulate arrears/input stress?

## Hard gates

Deterministic replay, health, complete coverage, interventions actually applied, exact target-plan scope, targeted desired workers not below current workers, ledger integrity, GDP identity and finite rows.

## Boundary

This is a causal action-path ablation, not a production labor policy. It does not prevent exit displacement, does not guarantee jobs for infeasible aggregate targets, and does not alter cash constraints. Canonical mechanism changes: 0; tuning: 0; repair authorization: NO.

Workflow registration trigger: 2026-08-20.
