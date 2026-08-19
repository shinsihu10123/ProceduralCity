# WP-RV07-P20 — Revenue Collapse Price–Quantity–Availability Decomposition

## Purpose

P17 identified operating revenue coverage as the dominant remaining lead. P20 decomposes that revenue deterioration into price, sellable quantity/availability, and sales utilization without changing the economy.

## Questions

1. Does the price/wage ratio materially collapse by M7-12?
2. Does revenue fall because firms cannot produce/hold sellable finished goods?
3. When finished goods are available, are they actually sold?
4. Are zero-sales firms holding sellable inventory?
5. Which sectors and buyer channels (household consumer, B2B, capital, other/fiscal) account for revenue?

## Exact firm flow

Starting finished inventory is captured immediately before `supply.beginMonth` resets monthly flows. After the month:

`start finished inventory + output - total sales - ending finished inventory = 0`

This is a hard reconciliation gate.

## Design

- unit-basis candidate
- compact + baseline
- seeds A/B/C
- 12 months
- windows M1-3, M4-6, M7-9, M10-12, FULL
- industry decomposition RESOURCE / MATERIALS / CAPITAL / CONSUMER
- exact observer non-interference replay

## Claim classes

A: reconciled price, quantity, inventory and revenue facts.

B: binding-side diagnostic leads.

C: causal hypotheses for later ablations.

D: no repair recommendation from this diagnosis alone.

## Boundaries

No canonical mechanism changes, no parameter fitting, no empirical-realism claim.
