# WP-RV08-R4-CQ — Real Unit Labor Cost Invariant Gate

Date: 2026-08-28
Mode: shadow diagnostic only
Canonical mutation: FORBIDDEN

## Question

Is the observed wage/price/output mismatch removable by a pure monetary/quantity-unit relabel, or does the baseline contain a genuine real wage-productivity inconsistency?

## Core invariant

For every active firm-month with workers > 0, price > 0 and productive capacity > 0:

`capacityPerWorker = capacity / workers`

`realWageInOwnGood = wage / price`

`RULC = realWageInOwnGood / capacityPerWorker = wage / (price × capacityPerWorker)`

RULC is dimensionless. A common monetary numeraire transformation (`wage` and `price` multiplied by the same factor) leaves RULC unchanged. A consistent physical quantity-unit relabel (`Q' = Q/k`, `price' = k price`, `capacity' = capacity/k`) also leaves RULC unchanged.

Therefore an RULC far above 1 cannot be repaired by relabeling units alone.

## Measurements

Across 24 months and four countries/industries:

- workers, wage, price, capacity, output
- capacity per worker
- output per worker
- real wage in own-good units
- RULC using capacity
- realized unit labor cost analogue using output
- share RULC > 1, > 2, > 10, > 30, > 100
- industry and consumer-facing cohorts

Country-month consumer anchor:

- median consumer price
- employed household median wage
- real wage in consumer-good units
- consumer capacity per worker

## Invariance proof checks

For each observation evaluate two shadow transformations without changing world state:

1. Monetary rescale `M10`: wage' = 10 wage; price' = 10 price.
2. Quantity relabel `Q10`: capacity' = capacity/10; output' = output/10; price' = 10 price.

Recomputed RULC must match baseline within 1e-10.

## Decision gate

If median RULC is materially > 1 across original and heldout seeds, especially if >10, classify the problem as **REAL CALIBRATION / TECHNOLOGY COHERENCE DEFECT**, not a pure unit-label defect.

No canonical wage, price, productivity, capacity or quantity switch is authorized by this gate. The following stage must identify the intended real primitive using explicit empirical/semantic anchors before any behavior change.
