# WP-RV07-P28 — Firm Decision Inventory-Pressure Signal Causal Ablation

## Purpose

P24 shows a phase change in decision context: early negative hiring is dominated by `방어` while inventory pressure is strongly positive; late negative hiring persists even when inventories are below target. P28 independently tests whether **inventory-pressure perception is an initial contraction trigger**.

## Variants

1. `unit-basis-control` — unchanged diagnostic control.
2. `unit-basis-firm-decision-inventory-neutral` — during the firm-decision call only, expose finished-goods inventory equal to the firm's existing target inventory. This makes the existing `inventoryPressure = (inventory-target)/target` signal exactly zero. Before credit origination, restore the exact objective inventory units.

No ledger balance, physical inventory available to procurement/goods clearing, target inventory, price coefficient, labor coefficient, production coefficient, credit rule or exit rule is changed outside the decision call.

## Isolation boundary

The intervention changes the decision model's perceived current inventory state and its counterfactual projection input for that call. It does not create or destroy physical goods; exact objective inventory is restored before the physical/financial pipeline proceeds.

## Questions

- Does neutral inventory pressure materially reduce M1-6 `방어` selection and negative labor targets?
- Does that prevent the later capacity collapse?
- Is early excess inventory pressure a root trigger, a co-trigger with cash stress, or mostly irrelevant?
- Does neutralization worsen overproduction, arrears, or input shortages?

## Hard gates

Deterministic replay, health, complete coverage, candidate trace inventoryPressure exactly zero, objective inventory pressure actually present, ledger integrity, GDP identity and finite rows.

## Boundary

This is a causal perception ablation, not a production inventory policy. Canonical mechanism changes: 0; tuning: 0; repair authorization: NO.

Workflow registration trigger: 2026-08-20.
