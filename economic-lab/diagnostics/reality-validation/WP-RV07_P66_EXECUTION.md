# WP-RV07-P66 — Productivity Finished-Goods Inventory Absorption Waterfall

## Objective

Determine whether added upstream productivity creates finished-goods inventory faster than domestic downstream/final demand absorbs it, thereby creating the inventory-pressure signal implicated by P63.

## Variants

- CONSUMER
- RESOURCE + CONSUMER
- MATERIALS + CONSUMER
- RESOURCE + MATERIALS + CONSUMER

All use the same P2 unit-basis and P61-P63 algebraic productivity diagnostic intervention.

## Exact stage snapshots

For every beginning-of-month active firm:

1. inventory after `supply.beginMonth`
2. inventory after B2B procurement
3. inventory after production
4. inventory at end of month

The audit derives:

- B2B finished-goods drain
- production addition
- post-production/final-demand drain
- total within-month absorption
- inventory accumulation
- absorption/output ratio
- end inventory / target inventory
- decision-time inventory pressure, cash stress, strategy and hiring change

## Hard gates

- deterministic replay exact
- all runs healthy
- complete country coverage
- intervention activated
- exact physical finished-goods stock-flow reconciliation
- production addition equals recorded physical output
- ledger country verification
- GDP identity reconciliation
- finite rows

## Authority

Diagnostic only. Canonical changes: 0. Fitted parameters: 0. Repair merge: NO. Empirical realism claim: NO.