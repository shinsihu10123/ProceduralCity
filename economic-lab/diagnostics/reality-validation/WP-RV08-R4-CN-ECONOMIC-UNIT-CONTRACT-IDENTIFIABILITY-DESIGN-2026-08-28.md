# WP-RV08-R4-CN — Economic Unit Contract Identifiability + Stock/Flow Coherence Audit

Date: 2026-08-28
Mode: shadow diagnostic only
Canonical mutation: **FORBIDDEN**

## Objective

R4-CM rejected one common scalar. R4-CN determines which independent unit dimensions are actually identified by current model evidence and which remain observationally equivalent.

The audit must not choose a preferred normalization merely because it repairs ratios. It must preserve the distinction between:

- **nominal money stock**: deposits, firm cash, wealth;
- **labor compensation flow**: wage/payroll per month;
- **physical productive quantity**: output/capacity units;
- **unit price**: money per product unit;
- **household consumption budget flow**: desired nominal spending per month;
- **consumption bundle scale**: physical consumer-good units represented by one simulated unit.

## Required canonical anchors

Per firm-month:
- opening/closing firm deposit;
- actual payroll settlement;
- worker count and wage;
- output, capacity and price;
- firm deposit / actual payroll;
- firm deposit / nominal wage bill;
- wage / output-value-per-worker;
- wage / capacity-value-per-worker.

Per country-month:
- household deposits;
- wage income/payroll;
- desired consumption budget;
- consumer output value;
- consumer capacity value;
- household deposits / payroll;
- desired budget / payroll;
- desired budget / consumer capacity value.

## Candidate normalization families

These are analytical transformations only. They must never alter the world.

### Q — physical/product-bundle scaling
Scale output and capacity values by `F`, leaving wages and money stocks unchanged.

Expected consequences:
- firm payroll/productive-value ratio divided by `F`;
- demand/capacity ratio divided by `F`;
- stock/wage liquidity anchors unchanged.

### W — labor-compensation scaling
Scale wage/payroll by `1/F`, leaving product value and money stocks unchanged.

Expected consequences:
- firm payroll/productive-value ratio divided by `F`;
- demand/capacity ratio unchanged;
- cash/payroll liquidity months multiplied by `F`.

### P — unit-price scaling
Scale all product prices/productive values by `F`, leaving wages and money stocks unchanged.

Expected consequences resemble Q in the two headline ratios, but real purchasing power of unchanged money stocks collapses by `F`; this is not semantically equivalent once stock anchors are considered.

### C — household-budget scaling
Scale desired consumption budgets by `1/F` only.

Expected consequences:
- firm payroll/productive-value ratio unchanged;
- demand/capacity ratio divided by `F`.

### Two-dimensional candidate families
At minimum evaluate:
- `Q + C`: productive quantity/bundle scale plus household budget/bundle scale;
- `W + C`: labor compensation scale plus household budget scale;
- `P + C`: price scale plus household budget scale.

Use the observed firm median break-even factor `F_firm` and demand median factor `F_demand`. For Q/P families, the residual household factor is `F_demand / F_firm`; for W families, the full demand factor remains independent.

## Identifiability test

A dimension is **identified by internal evidence** only if competing transformations that repair headline ratios produce materially different results on independently observed stock/flow anchors and one family is clearly inconsistent while another remains coherent.

If several families remain plausible after stock/flow anchors, R4-CN must conclude **UNDERIDENTIFIED** and require semantic or empirical anchors before canonical repair.

## Hard gates

- exact diagnostic replay;
- exact canonical replay;
- no canonical mutation;
- canonical accounting health;
- finite positive anchor observations;
- all four countries observed;
- all four industries observed;
- candidate-transform algebraic consistency.

## Decision rules

1. If one family uniquely preserves plausible stock/flow relations while repairing both major scale gaps, advance that family to a shadow normalization prototype.
2. If Q and P remain observationally close but P destroys money-stock purchasing-power coherence, prefer further investigation of physical/bundle semantics over price inflation; this is still not canonical authorization.
3. If W produces implausibly huge cash/payroll liquidity months, reject wage compression as a primary normalization family.
4. If more than one family remains plausible, declare the system underidentified and construct an **Economic Unit Contract semantic anchor register** before any canonical parameter change.

## Non-goals

R4-CN does not tune model outcomes to target unemployment, GDP growth, inflation, firm survival, or profitability. It diagnoses unit semantics only.