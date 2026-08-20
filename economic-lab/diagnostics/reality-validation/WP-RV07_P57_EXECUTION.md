# WP-RV07-P57 — Operating-Feasibility Utilization Waterfall

## Namespace note

P55 was already allocated concurrently to the exit-entry replacement-deficit audit. The utilization-waterfall diagnostic is therefore executed as **P57**. `operating-feasibility-utilization-waterfall-v10b.mjs` changes labels only and delegates the exact diagnostic logic from the base runner.

## Purpose

P36 established that non-capital firms are generally below labor break-even at canonical physical capacity. P35/P44 show that increasing capacity raises output but does not close unemployment. P47 shows that suppressing layoffs/exits prevents unemployment while arrears explode.

P57 identifies **where the payroll-support gap is created and how much remains after capacity normalization**.

For every positive-payroll firm-month it records:

`capacity -> planned physical production -> actual output -> realized sales`

and converts each stage into contribution-margin coverage of current payroll.

## Variants

1. `unit-basis-control`
2. `unit-basis-capacity` — existing non-capital algebraic break-even-capacity diagnostic.

## Metrics

By sector and window:
- contribution margin per unit,
- capacity / plan / output / sales contribution coverage of payroll,
- share covering payroll at each stage,
- plan utilization,
- output attainment,
- sales utilization of beginning inventory + output,
- beginning-inventory runoff contribution,
- normalized gap introduced by capacity, planning, output/input and sales realization.

## Decision rule

- Coverage <1 already at capacity => internal unit basis infeasible.
- Capacity coverage repaired but output coverage <1 => planning/input utilization residual.
- Output coverage repaired but sales coverage <1 => market/revenue-realization residual.
- Initial inventory materially raises sales coverage => early health is inventory-buffer dependent.

## Controls

Exact observer non-interference on control, deterministic replay, health, capacity-activation, production-bound and finite-value gates.

Canonical mechanism changes: **0**. Parameter fitting: **0**. Repair merge: **0**.
