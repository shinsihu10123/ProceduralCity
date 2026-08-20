# WP-RV07-P55 — Operating-Feasibility Utilization Waterfall

## Purpose

P36 established that non-capital firms are generally below labor break-even at canonical physical capacity. P35/P44 show that increasing capacity raises output but does not close unemployment. P47 shows that suppressing layoffs/exits prevents unemployment while arrears explode.

P55 identifies **where the payroll-support gap is created and how much remains after capacity normalization**.

For every positive-payroll firm-month it records the ordered physical/financial waterfall:

`capacity -> planned physical production -> actual output -> realized sales`

and converts each stage into contribution-margin coverage of current payroll.

## Variants

1. `unit-basis-control`
2. `unit-basis-capacity` — existing non-capital algebraic break-even-capacity diagnostic used in P35/P39/P40/P44.

## Metrics

By sector and M1–3 / M4–6 / M7–9 / M10–12 / FULL:

- contribution margin per output unit,
- capacity contribution / payroll,
- planned-physical contribution / payroll,
- actual-output contribution / payroll,
- realized-sales contribution / payroll,
- share of firm-months covering payroll at each stage,
- plan utilization of capacity,
- output attainment of planned physical production,
- sales utilization of beginning inventory + current output,
- beginning-inventory runoff contribution,
- normalized gap introduced at capacity, planning, output/input and sales stages.

## Interpretation

- If coverage is already <1 at capacity, the unit basis itself is infeasible.
- If capacity coverage becomes >=1 under the diagnostic but output coverage remains <1, planning/input utilization is the residual bottleneck.
- If output coverage is adequate but sales coverage fails, market/revenue realization is the residual bottleneck.
- If beginning inventory temporarily raises sales coverage, early apparent health is inventory-buffer dependent.

## Controls

Observer non-interference is exact-tested on control. Deterministic replay, health, production bounds and finite core metrics are hard gates.

Canonical economic mechanism changes: **0**. Parameter fitting: **0**. Repair merge: **0**.
