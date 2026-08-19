# WP-RV07-P8 — Topological Same-Month Supply Sequencing Ablation

Status: **EXECUTION REQUESTED**

## Purpose

WP-RV07-P7 falsified the existing `cash × 0.42` procurement reservation as the dominant system-level residual cause. WP-RV07-P8 isolates a stronger structural lead: the frozen monthly order makes all input procurement occur before any same-month production, even though the industry graph is acyclic.

Frozen order:

`planProduction → procureInputs(all industries) → produce(all industries)`

Industry graph:

`RESOURCE → MATERIALS → {CAPITAL, CONSUMER}`

## C. HYPOTHESIS

### H-SEQ1

After the unit-basis correction, a significant part of residual input shortage and downstream collapse is caused by within-month physical-availability sequencing: upstream output produced later in the month cannot be purchased by downstream firms earlier in that same month.

## Frozen boundary

- canonical economic mechanism changes: 0
- canonical parameter tuning: 0
- unit-basis candidate remains experimental and unmerged
- no production repair is admitted by this WP
- procurement cash reservation remains exactly `cash × 0.42`
- supplier scoring/search and five-round cap remain unchanged

## Variants

### Control

Existing unit-basis candidate with frozen global supply order.

### Diagnostic candidate

Topological same-month staging only:

1. produce RESOURCE
2. procure raw material for MATERIALS
3. produce MATERIALS
4. procure processed material for CAPITAL and CONSUMER
5. produce CAPITAL and CONSUMER

The candidate does not create synthetic inventory and does not increase production capacity. It only makes already-produced upstream output physically available to the next downstream stage in the same month.

## Important semantic boundary

This is a causal timing ablation, not a merge candidate. Because the canonical wage-accrual step still occurs after the supply phase, same-month upstream output may be sold before current-month labor cost is accrued into finished-goods book value. A future production repair would need explicit cost-recognition semantics before topological staging could be admitted.

## Execution matrix

- scales: compact, baseline
- seeds: ECON-RV02-A, ECON-RV02-B, ECON-RV02-C
- horizon: 12 months
- variants: 2
- deterministic replay: both variants, both scales, 3 months

## Hard gates

1. deterministic replay exact
2. all health checks pass
3. complete country-month coverage
4. aggregate firm supply shortage reconciles to `lastIndustry.inputShortageUnits`
5. aggregate firm output reconciles to sector outputs
6. no firm output exceeds `min(desiredProduction, capacity)`
7. settlement ledger verifies for every country-month
8. GDP expenditure identity reconciles
9. all diagnostic rows finite

## Decision rule

- If topological staging sharply reduces shortage and materially improves downstream output/fulfillment before later macro deterioration, H-SEQ1 is supported and supply timing becomes a viable structural repair family, subject to accounting/cost semantics.
- If shortage changes little or macro failure persists almost unchanged, H-SEQ1 is secondary or falsified; do not merge sequencing changes.
- No empirical realism claim is authorized from this internal ablation.
