# WP-RV07-P69 — Input-Output Absorption Gap Decomposition

## Objective

Explain the exact upstream overstock / downstream scarcity pattern confirmed by P66 using one reconciled physical input-output quantity waterfall.

## Variants

- CONSUMER productivity normalization
- RESOURCE + CONSUMER
- MATERIALS + CONSUMER
- RESOURCE + MATERIALS + CONSUMER

These retain the existing P2 unit-basis diagnostic transform and P61-P66 algebraic productivity intervention. P69 is not a repair experiment.

## Quantity waterfall

For every input-using firm and month:

1. gross technological input requirement = `desiredProduction * inputPerOutput`;
2. input already held before domestic procurement (carryover and/or imports already delivered before the domestic production cycle);
3. net domestic procurement need;
4. domestic supplier finished-goods inventory available at plan time;
5. actual domestic procurement;
6. canonical residual `supplyShortage`;
7. input actually consumed in production;
8. same-month supplier output that canonical sequencing makes unavailable to that earlier procurement round.

Country-product aggregation is performed separately for `raw_material` and `processed_material` so supplier stock is not double counted across buyers.

## Hard gates

- deterministic replay exact
- all runs healthy
- complete country/product coverage
- productivity intervention activated
- exact `shortage = netNeed - domesticProcured` reconciliation
- exact consumed input = output × inputPerOutput reconciliation
- ledger verification
- GDP identity reconciliation
- finite rows

## Diagnostic questions

P69 distinguishes three structurally different cases:

- **quantity-mapping gap:** downstream net input need is intrinsically small relative to upstream output/stock;
- **procurement/access gap:** aggregate supplier stock is sufficient but buyers still record shortage;
- **timing gap:** same-month upstream output could cover shortages but is unavailable because procurement precedes production.

## Authority

Canonical economic changes: 0. Parameter fitting: 0. Repair merge: NO. Empirical realism claim: NO.