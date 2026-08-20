# WP-RV07 P49–P52 Accelerated Root-Cause Batch — 2026-08-20

## Objective

P47 closed most of the unemployment propagation chain, while P48 verified that replacement entry is usually nonproductive downstream. This batch widens execution across four remaining high-value uncertainties in parallel.

## Shared controls

- Existing P2 diagnostic unit basis (`initialPrice = initialWage`).
- `compact,baseline`; seeds `ECON-RV02-A/B/C`; horizon 12 months unless a forecast target requires a bounded extension.
- Canonical source edits: **0**.
- Fitted scalar tuning: **0**.
- Empirical realism claims: **NO**.

## P49 — Exit-Displaced Worker Re-employment Audit

Read-only tracking around canonical `evaluateExits`.

For every household displaced by a firm exit record:
- displacement month/country/industry/employer,
- wage/skill/financial access where available,
- months until first re-employment,
- new employer sector,
- whether new employer is a post-exit entrant,
- still-unemployed share by 1/2/3/6 months.

Purpose: quantify the labor-market persistence created specifically by exit displacement rather than planned layoffs.

## P50 — Model-Effective-Horizon Firm Counterfactual Audit

P46 compared multi-month counterfactual plans with one-month realizations. P50 aligns the comparison to the actual counterfactual equations:

- sales/revenue projection compounds demand growth for `min(3, planningHorizon)` periods;
- projected cash multiplies one-period expected operating cash flow by `min(2.5, planningHorizon/2)`.

For every selected plan, record a forecast at month `t` and compare projected sales/revenue to the realized terminal month `t + round(min(3,horizon))`; compare projected cash to the closest integer effective cash horizon. Track only firms that survive to the target month; separately report attrition.

Purpose: determine whether strategy selection is being driven by structurally biased internal counterfactuals rather than the P46 horizon mismatch.

## P51 — Financially Supportable Labor-Demand Audit

Read-only shadow calculation after firm decisions, before labor clearing.

For each firm compute:
- canonical desired workers,
- current workers,
- one-month payroll at canonical desired workers,
- current cash,
- prior-month realized operating inflows,
- contribution-margin-supported workers using current price/input-cost/capacity-per-worker,
- cash-plus-realized-inflow-supported payroll workers,
- whether canonical layoffs are greater or smaller than the shadow financially supportable adjustment.

Purpose: distinguish necessary balance-sheet adjustment from excessive/poorly targeted defensive labor contraction. No desired-worker value is changed.

## P52 — Entrant Bootstrap Causal Upper-Bound Matrix

Canonical replacement entrants remain zero-cash. This matrix changes only physical startup state using values already present in same-industry active firms at the moment of entry:

1. canonical zero-resource entrants,
2. median same-industry capital stock only,
3. median same-industry intermediate-input inventory only,
4. capital + input inventory.

No cash is created or transferred, no price/wage rule is changed, and no incumbent is modified.

Purpose: test whether zero physical startup state alone explains downstream entrants' 0% production result. If even capital+input bootstrap fails, zero cash/working-capital finance becomes the remaining entrant bottleneck.

## Decision rules

- P49 long re-employment durations after exit strengthen exit/entry hysteresis as the late unemployment persistence channel.
- P50 systematic horizon-aligned overprediction in MATERIALS/RESOURCE promotes the counterfactual planner as a behavioral defect.
- P51 canonical labor demand consistently below financially supportable shadow levels supports excessive defensive layoffs; the opposite means layoffs are economically necessary under current unit economics.
- P52 physical bootstrap restoring production but not survival/revenue isolates physical startup state; no restoration isolates financing/market-access instead.
