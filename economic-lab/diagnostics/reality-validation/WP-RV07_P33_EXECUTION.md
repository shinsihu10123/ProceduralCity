# WP-RV07-P33 — Sector-Selective Variable-Cost Floor Causal Matrix

## Purpose

P29 and P30 independently locate the earliest objective deficit in sector operating economics. P33 expands the causal search by applying the P30 optimistic variable-cost floor to selected sectors separately, so the contribution of RESOURCE, MATERIALS, CONSUMER and their upstream cascade can be identified without waiting for a single all-sector experiment.

## Variants

1. `unit-basis-control`
2. `unit-basis-resource-floor`
3. `unit-basis-materials-floor`
4. `unit-basis-consumer-floor`
5. `unit-basis-capital-floor` — falsification/control sector because P30 finds much weaker underpricing there
6. `unit-basis-upstream-floor` — RESOURCE + MATERIALS
7. `unit-basis-noncapital-floor` — RESOURCE + MATERIALS + CONSUMER

## Intervention

After canonical labor clearing and `planProduction`, before procurement and goods clearing, calculate for each targeted positive-capacity firm:

`floor = wage * workers / capacity + inputPerOutput * current mean upstream supplier price`

and set transaction price to `max(existing price, floor)`.

Sectors are processed in supply-chain order so an upstream floor can propagate into a downstream required-input cost floor within the same intervention pass.

## Questions

- Is RESOURCE underpricing alone sufficient to trigger a large recovery or does it shift losses into MATERIALS?
- Is MATERIALS the dominant bottleneck?
- Does an upstream joint correction propagate to downstream output/employment?
- Is CONSUMER underpricing independently material or mostly a later sustainability problem?
- Does CAPITAL, the sector not broadly underwater in P30, produce little benefit as expected?

## Hard gates

Deterministic replay, health, complete coverage, each non-control variant activates, non-target sectors are never directly floored, target floors are satisfied when applicable, ledger integrity, GDP identity and finite rows.

## Boundary

This is a diagnostic causal matrix, not a price-setting design or calibration. Canonical changes: 0. Parameter tuning: 0. Repair authorization: NO.