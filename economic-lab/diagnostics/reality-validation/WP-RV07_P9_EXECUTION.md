# WP-RV07-P9 — Stockout-Censored Sales Feedback Causal Ablation

Status: **EXECUTION REQUESTED**

## Purpose

WP-RV03 and WP-RV07-P0 identified a structural information problem: realized sales are quantity-rationed when sellers stock out, yet the frozen world writes realized `f.sales` directly into `f.previousSales`. That value subsequently anchors projected sales and production planning.

WP-RV07-P8 showed that same-month supply sequencing is a real contributor but not a sufficient explanation for the residual collapse. P9 therefore isolates the remaining sales-censoring feedback without combining it with P8.

## Frozen source path being tested

The current monthly close performs:

1. goods market clearing;
2. fiscal demand/taxes;
3. for every active firm, forecast-error update using `sales / previousSales`;
4. `f.previousSales = max(0.01, f.sales)`.

The supply planner later uses `previousSales` inside its demand anchor, while firm counterfactual planning also projects future sales from `previousSales`.

The causal question is therefore whether a downward realized-sales observation produced while the firm has no inventory should be allowed to reduce the next-month sales anchor.

## Diagnostic candidate

Variants:

- `unit-basis-control`: frozen sales feedback.
- `unit-basis-stockout-censor-hold`: after the canonical monthly close, and only for an active firm satisfying all of the following:
  - ending inventory `<= EPS`;
  - current sales `> EPS`;
  - canonical next-month `previousSales` is below the value entering the month;

  set next-month `previousSales` to:

  `max(prior previousSales, canonical previousSales)`.

This is a parameter-free lower-bound carry-forward. It does **not** estimate latent demand, add desired demand to revenue, change settlement, alter accounting, or alter current-month output.

It also deliberately does not correct the already-recorded current-month forecast-error update. P9 isolates the `previousSales` anchor channel first.

## Execution matrix

- scales: compact, baseline
- seeds: `ECON-RV02-A`, `ECON-RV02-B`, `ECON-RV02-C`
- horizon: 12 months
- unit-basis experimental environment retained from P2+

## Primary outcomes

- unemployment
- firm exits
- wage arrears
- goods fulfillment
- input shortage
- consumer output
- nominal sales
- next-month `previousSales`
- desired production
- demand belief
- defensive / cash-preservation plan shares

## Intervention audit

For each country-month P9 records:

- ending stockout + positive-sales firm cases;
- downward-censored cases;
- corrected cases;
- total and maximum `previousSales` lift;
- rule violations.

## Hard gates

1. deterministic replay exact within each variant;
2. all health checks pass;
3. complete country-month coverage;
4. current-month month-1 economic outcomes are exactly identical across control/candidate before the intervention can propagate;
5. control records zero correction mutations;
6. every candidate correction obeys the explicit stockout-censor rule;
7. candidate corrections never exceed diagnosed downward-censor cases;
8. country ledgers verify;
9. GDP identity reconciles;
10. all required metrics are finite.

No outcome-improvement threshold is a hard gate.

## Interpretation rule

- If the correction produces a large, coherent improvement in production/sales/fulfillment and materially weakens unemployment/exit dynamics, H-S4 survives causal ablation as a major residual mechanism.
- If it changes anchors but not macro outcomes, H-S4 is an information defect but not a dominant residual cause.
- If it worsens outcomes, the carry-forward candidate is rejected even if the diagnostic premise remains valid.
- Any hard-gate failure blocks economic interpretation.

## Boundary

- canonical economic mechanism changes: 0
- canonical parameter tuning: 0
- combined repair testing: not yet admitted
- empirical realism claim: NO
- production repair merge: NO
