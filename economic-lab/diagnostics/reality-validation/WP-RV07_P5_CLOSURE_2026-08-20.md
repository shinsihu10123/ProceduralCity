# WP-RV07-P5 — Supply-Chain Bottleneck Decomposition

Status: **PASS — DIAGNOSTIC DECOMPOSITION**

Date: 2026-08-20
Run: `32269778776`
Artifact: `economic-lab-wp-rv07-p5` / ID `9371690326`
Digest: `sha256:ddbcab50f4c2decab84ebdacb0b74877c103b483143cd5b015e9edfebb142611`

## Scope

This work package observed the unit-basis candidate only. It did not alter canonical economic mechanisms or tune parameters.

- canonical economic mechanism changes: 0
- canonical parameter tuning: 0
- diagnostic intervention: none
- scales: compact + baseline
- seeds: ECON-RV02-A/B/C
- horizon: 12 months

## Hard gates

All hard gates passed:

- observer non-interference exact
- health
- complete coverage
- procurement stock-flow reconciliation
- production input-constraint reconciliation
- `lastIndustry.inputShortageUnits` reconciliation
- sector-output reconciliation
- finite diagnostic rows

Maximum reconciliation errors:

- procurement: `3.552713678800501e-15`
- production: `0`
- industry shortage: `0`
- sector output: `4.547473508864641e-13`

## Baseline findings

Across baseline 3 seeds × 12 months:

- mean unemployment: `0.2514`
- mean goods fulfillment: `0.5575`
- input shortage rate: `0.4349`
- input-constrained output-loss rate: `0.1931`
- firm exits: `248`

The input shortage becomes material after the initial window:

| Window | Input shortage rate | Input-output loss rate | Goods fulfillment | Mean unemployment | Exits |
|---|---:|---:|---:|---:|---:|
| M1-3 | 0.0853 | 0.0373 | 0.9673 | 0.0572 | 0 |
| M4-6 | 0.6272 | 0.2078 | 0.4589 | 0.1101 | 19 |
| M7-9 | 0.4723 | 0.1939 | 0.4727 | 0.3422 | 111 |
| M10-12 | 0.5908 | 0.3728 | 0.3310 | 0.4961 | 118 |

Necessary-condition flags across the full baseline panel:

- buyer cases: `4,679`
- definitely budget-insufficient under the existing 42% cash budget upper bound: `1,027`
- definitely physical-stock-insufficient at procurement start: `84`
- shortage remained even though both simple upper bounds could cover: `181`

Same-month upstream production was large relative to shortage:

- processed-material same-month supplier output / shortage: `3.7565x` full panel
- raw-material same-month supplier output / shortage: `4.9130x` full panel

However these are timing counterfactual leads, not proof that same-month sequencing is causal.

## Important qualification

The existing procurement rule allocates 42% of buyer cash as the procurement budget, but mean realized procurement spend was only a small fraction of that budget in the observed panel. Therefore the `definitelyBudgetInsufficient` flag is only a necessary-condition diagnostic based on the starting upper bound; it does **not** establish that the 42% budget cap is the branch that actually stopped procurement.

Likewise, aggregate same-month upstream output does not prove that the right supplier/product/firm could have delivered the missing units to the affected buyer in the same month.

## Diagnostic conclusion

Classification:

- **A VERIFIED EXISTING FACT:** input shortage and input-constrained output loss become major after M3 in the unit-basis candidate.
- **B DIAGNOSTIC LEAD:** the existing 42% buyer-cash procurement budget is implicated in many buyer-month necessary-condition checks.
- **B DIAGNOSTIC LEAD:** same-month upstream production often exceeds aggregate shortage, so procurement-before-production sequencing may matter.
- **B DIAGNOSTIC LEAD:** 181 buyer-month cases remain short even when simple starting budget and stock upper bounds both appear sufficient, pointing to search/allocation/round-limit behavior.
- **C HYPOTHESIS:** the 42% cash budget is the dominant actual stop branch. Not yet established.
- **C HYPOTHESIS:** procurement-before-production sequencing is the dominant actual stop branch. Not yet established.

## Next work package

WP-RV07-P6 must instrument the procurement loop itself and identify the **actual stop branch** for every buyer-month without changing realized state. Only after that exact branch audit should a bounded causal ablation be admitted.
