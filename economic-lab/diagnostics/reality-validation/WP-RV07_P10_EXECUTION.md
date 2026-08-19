# WP-RV07-P10 — Production Plan Binding-Term Decomposition

Date: 2026-08-20

## Purpose

WP-RV07-P9 showed that holding downwards-censored `previousSales` raised the sales-memory anchor by roughly 2.6x on the baseline 12-month window, but `desiredProduction` remained effectively unchanged. P10 therefore diagnoses the exact frozen `planProduction` equation before any further ablation.

This WP is **diagnostic only**.

## A — VERIFIED SOURCE EQUATION TO AUDIT

For each active firm the frozen supply-chain implementation computes:

1. `capacity` from workers, productivity, capital effect, human-capital effect, resource effect, and the selected plan's bounded production change;
2. `demandAnchor = max(2, previousSales, targetInventory * 0.42)`;
3. `expectedDemand = demandAnchor * (1 + bounded demandGrowth belief)`;
4. `replenishment = max(0, targetInventory - inventory)`;
5. `unconstrainedPlan = expectedDemand * 0.72 + replenishment`;
6. `desiredProduction = min(capacity * 1.08, unconstrainedPlan)`.

P10 does not alter this equation. It wraps the canonical `planProduction` method, executes it unchanged, and reads back the exact terms.

## B — QUESTIONS

For each scale, seed, country, firm, industry, month, and time window:

- Which demand-anchor branch wins?
  - `PREVIOUS_SALES`
  - `TARGET_INVENTORY`
  - `FLOOR`
  - exact tie
- Which final plan term binds?
  - `CAPACITY_CAP`
  - `PLAN_DEMAND`
  - exact tie
- How much of the unconstrained plan comes from replenishment versus expected demand?
- How much of desired production becomes actual output?
- How often is the later output gap associated with an input shortage?
- How does the answer change from M1-3 to M10-12 and across industries?

## C — HYPOTHESES

### H-P10-1 — capacity/labor binding
The `capacity * 1.08` branch dominates `desiredProduction`, masking large changes in `previousSales`.

### H-P10-2 — target-inventory/replenishment dominance
`targetInventory * 0.42` and/or replenishment dominate the plan, making the prior-sales anchor non-binding.

### H-P10-3 — sales anchor is primary but capacity clips it
`previousSales` frequently wins `demandAnchor`, but the final desired plan is nevertheless capacity-bound.

### H-P10-4 — downstream input constraint dominates realization
Even where planning is not capacity-bound, actual output is substantially below desired production because of the input constraint already diagnosed in P5/P8.

No hypothesis is accepted before the run passes hard gates.

## D — HARD GATES

P10 must pass all of the following:

- exact observer non-interference against an unwrapped unit-basis world;
- world health;
- complete country-month coverage;
- plan rows present;
- exact reconstruction of the canonical capacity equation;
- exact reconstruction of the canonical desired-production equation;
- every demand-anchor branch classified;
- every final binding branch classified;
- ledger verification;
- GDP identity reconciliation;
- finite diagnostic rows.

Any gate failure means **BLOCKED**. No economic inference may be taken from a failed run.

## E — EXECUTION MATRIX

- scales: `compact`, `baseline`
- seeds: `ECON-RV02-A`, `ECON-RV02-B`, `ECON-RV02-C`
- horizon: 12 months
- country count per world: 4
- structural basis: diagnostic unit-basis candidate (`initialPrice := existing initialWage`)

## F — CHANGE AUTHORITY

- canonical mechanism changes: **0**
- parameter tuning: **0**
- economic ablation: **0**
- repair merge: **0**

P10 only determines which structural dimension is dependency-safe to test next.