# WP-RV07-P65 — Positive Inventory Pressure × Productivity Interaction Causal Matrix

## Objective

Test the P63 lead that broader productivity normalization can create an absorption/overinventory signal which is translated into defensive labor contraction.

P28 previously neutralized **all** inventory pressure and worsened the economy because it also removed negative inventory-pressure signals that can support expansion. P65 therefore uses a narrower diagnostic intervention:

- if objective inventory pressure is positive, temporarily show `inventory = targetInventory` during the firm decision only;
- if inventory pressure is zero or negative, preserve the canonical signal exactly;
- restore objective inventory before credit, procurement, production, sales or settlement.

## Paired productivity bases

Each base runs with and without the positive-pressure-only cap:

- CONSUMER
- RESOURCE + CONSUMER
- MATERIALS + CONSUMER
- RESOURCE + MATERIALS + CONSUMER

The productivity intervention is the same algebraically-derived diagnostic normalization used by P61-P64.

## Hard gates

- deterministic replay exact
- all runs healthy
- complete country coverage
- productivity intervention activated
- positive inventory-pressure cap activated
- perceived inventory pressure exactly zero in capped positive cases
- all zero/negative inventory-pressure signals preserved exactly
- ledger verification
- GDP identity reconciliation
- finite rows

## Interpretation

If the broader productivity variants recover their physical gains while their unemployment penalty materially falls under positive-pressure-only capping, the inventory-absorption → labor-decision channel is causal. If not, sector reallocation, exit displacement, or another decision signal remains responsible.

## Authority

Diagnostic only. Canonical mechanism changes: 0. Parameter fitting: 0. Repair merge: NO. Empirical realism claim: NO.