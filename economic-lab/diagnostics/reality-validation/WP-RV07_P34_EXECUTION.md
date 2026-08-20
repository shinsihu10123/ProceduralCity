# WP-RV07-P34 — Finished-Goods Inventory Runoff / Sales-Sustainability Audit

## Purpose

P29 finds that CONSUMER firms generate strong early cash flow even though P30 shows their current-production unit economics are underwater. P34 tests whether early consumer cash generation is temporarily supported by **selling inherited beginning finished-goods inventory faster than current production replaces it**.

## Observation boundary

Read-only snapshots are taken around the existing domestic monthly cycle:

1. immediately after canonical `supply.beginMonth` — opening finished-goods inventory after the international pre-cycle has completed;
2. immediately after canonical `supply.produce` — physical current-month output;
3. immediately before/inside canonical `supply.finalizeMetrics` — domestic-cycle sales and closing finished-goods inventory, before exit deactivation.

For every beginning active firm/month, reconcile:

`opening finished inventory + current output - domestic-cycle sales = closing finished inventory`

`f.sales` is reset by `supply.beginMonth`, so this identity isolates the domestic cycle after the international pre-cycle.

## Diagnostics

By scale / window / industry:

- opening finished inventory;
- current output;
- domestic-cycle sales;
- closing inventory;
- net stock drawdown = `max(0, sales - output)`;
- net stock accumulation = `max(0, output - sales)`;
- sales/output ratio;
- stock-drawdown share of sales;
- share of firm-months with sales > current output;
- share ending with near-zero finished stock.

## Questions

- Is early CONSUMER revenue supported by inherited stock liquidation?
- How quickly does the stock buffer disappear?
- Do RESOURCE/MATERIALS differ because their output is sold mainly into the intermediate market?
- Does the transition from stock drawdown to stockout align with the later cash/capacity collapse?

## Hard gates

Exact observer non-interference, health, complete snapshots, exact finished-goods stock reconciliation, ledger integrity, GDP identity, finite rows.

## Boundary

Read-only diagnosis. No canonical mechanism change, parameter tuning, repair authorization or empirical-realism claim.