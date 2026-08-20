# WP-RV07-P60 — Operating-Feasibility Utilization Waterfall

## Purpose

P36 established that non-capital firms are generally below labor break-even at canonical physical capacity. P35/P44 show that increasing capacity raises output but does not close unemployment. P47 shows that suppressing layoffs/exits prevents unemployment while wage arrears explode.

P60 identifies **where the payroll-support gap is created and how much remains after capacity normalization**.

For every positive-payroll firm-month it records:

`capacity -> planned physical production -> actual output -> realized sales`

and converts each stage into contribution-margin coverage of current payroll.

## Variants

1. `unit-basis-control`
2. `unit-basis-capacity` — existing non-capital algebraic break-even-capacity diagnostic.

## Metrics

By sector and time window:
- contribution margin per physical output unit,
- capacity / plan / output / realized-sales contribution coverage of payroll,
- share of firm-months covering payroll at each stage,
- plan utilization of capacity,
- output attainment of planned physical production,
- sales utilization of beginning inventory + current output,
- beginning-inventory runoff contribution,
- normalized gap introduced at capacity, planning, output/input and sales realization.

## Decision rule

- Coverage <1 already at capacity => internal unit basis infeasible.
- Capacity coverage repaired but output coverage <1 => planning/input utilization is residual.
- Output coverage repaired but sales coverage <1 => market/revenue realization is residual.
- Beginning inventory materially raises sales coverage => early apparent health is inventory-buffer dependent.

## Controls

Exact observer non-interference on control, deterministic replay, health, capacity activation, production-bound and finite-value gates.

Canonical mechanism changes: **0**. Parameter fitting/tuning: **0**. Repair merge: **0**. Empirical realism claim: **NO**.

## Execution trigger

Workflow-registration retrigger: `2026-08-20T12:22+09:00`. This line changes no diagnostic or economic behavior.
