# WP-RV08 R4-AQ — Demographic / Labor-Force Semantics and Population Invariance Audit

Date: 2026-08-22
Mode: diagnostic-only / no canonical economic intervention

## Motivation

R4-AP tested whether the current world simply contains too few household/worker agents. That hypothesis was downgraded, but it exposed a deeper semantic issue: every household object is currently a potential worker and the unemployment denominator is all households.

Real-world unemployment is normally defined relative to a labor force, not total population. Children, retirees, students, disabled/nonparticipating adults, and other out-of-labor-force groups therefore require a distinct representation if household agents are intended to stand for people/population.

## Source facts motivating R4-AQ

- `makeHousehold()` has no age or lifecycle state.
- `macroFrom()` uses `1 - employed / households.length`.
- `clearLaborMarket()` considers every non-employed household an applicant; there is no working-age/participation filter.
- the economic world has a firm entrant mechanism but no household birth/death/aging path.
- scale profiles only multiply household/firm counts.

## Execution questions

1. Does household population stay exactly fixed over the diagnostic horizon?
2. Does runtime macro unemployment exactly equal `1 - employed / all households`?
3. Are age, life-state, retirement, and labor-force-participation fields absent at runtime as expected from source inspection?
4. How sensitive is the reported unemployment number to the denominator definition, holding the economic world completely unchanged?

## Denominator sensitivity

The diagnostic reports shadow labor-force shares 0.5, 0.6, 0.7, 0.8, 0.9, and 1.0. These are not demographic estimates and are not calibration targets. They are measurement sensitivity calculations only.

For each share p:

`shadow labor force = max(employed, round(total households × p))`

`shadow unemployment = 1 - employed / shadow labor force`

The shadow calculation never changes employment, consumption, income, production, credit, settlement, household count, or any simulation state.

## Hard gates

- health PASS
- identical initial/final household ID set
- runtime macro unemployment identity matches exactly
- no demographic/labor-force state fields unexpectedly appear
- all requested seeds complete

## Seeds and horizon

- original A
- original C
- held-out E
- held-out F
- 24 months

## Interpretation contract

A PASS can establish that current unemployment is a household-agent nonemployment rate under a static population abstraction. It cannot supply a realistic age distribution or labor-force participation model.

If the structural gap is confirmed, a separate demographic architecture task must define population unit semantics, working-age transitions, participation, retirement, births/deaths, and income/consumption treatment of nonworkers before a canonical realism repair is authorized.
