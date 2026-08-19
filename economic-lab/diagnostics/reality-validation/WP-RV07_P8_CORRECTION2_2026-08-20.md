# WP-RV07-P8 — Instrumentation Correction 2

Date: 2026-08-20

Status: **BLOCKED — INSTRUMENTATION DEFECT; ECONOMIC RESULT NOT ADMITTED**

## Failed corrected run

- run: `32279524133`
- commit: `2a48a8c313ada3c01a49bad319c3874399f9b400`
- failed hard gate: `productionBoundsRespected`
- passed gates: deterministic replay, health, coverage, supply-shortage reconciliation, sector-output reconciliation, ledger verification, GDP identity, finite rows

## Root cause

The first correction fixed sector-output population mismatch by including firms that produced earlier in the month but exited later in the same monthly step.

The remaining production-bound check still compared current-month `f.output` against end-of-month `f.desiredProduction` and `f.capacity`. This is invalid for a firm that exits after production because canonical `evaluateExits()` sets `desiredProduction = 0` after the output has already been produced and recorded.

Thus the failed bound gate is a diagnostic time-alignment defect, not evidence that the staged production intervention exceeded its production bound.

## Correction

`topological-supply-sequencing-ablation-v10c.mjs` keeps the economic intervention unchanged and changes only the diagnostic timing:

1. candidate production upper bound is snapshotted immediately inside `produceFirm()` before later exit-state mutations;
2. any positive `output - productionUpperBound` error is recorded at that exact production point;
3. the monthly stage record carries the maximum candidate bound error;
4. end-of-month hard-gate evaluation reads the stage-time snapshot rather than post-exit `desiredProduction`.

The control variant is not altered. Its canonical producer already defines output as `min(desiredProduction, capacity)`; this correction is specifically a hard gate on the diagnostic intervention implementation.

## Frozen boundary

- canonical economic mechanism changes: 0
- parameter tuning: 0
- candidate repair merge: 0
- failed-run economic outcomes: not admitted

Only a subsequent v10c run with all hard gates passing may support a WP-RV07-P8 causal conclusion.
