# WP-RV07-P8 Closure — Topological Same-Month Supply Sequencing Ablation

Date: 2026-08-20
Status: **PASS — STRUCTURAL CONTRIBUTOR CONFIRMED; NOT DOMINANT RESIDUAL CAUSE**

## Scope

WP-RV07-P8 tested whether the frozen monthly ordering

`planProduction -> procureInputs -> produce`

creates a material same-month upstream-availability lag. The diagnostic candidate preserved the unit-basis experiment and all procurement parameters while staging production in the existing acyclic industry topology:

`RESOURCE production -> MATERIALS procurement/production -> CAPITAL+CONSUMER procurement/production`.

No canonical economic source was changed.

## Execution evidence

- accepted run: `32280972298`
- accepted head: `dfea43c4d58fb1aaae74f40ee4e9b9993cea8250`
- artifact: `economic-lab-wp-rv07-p8`
- artifact id: `9375844836`
- artifact digest: `sha256:9079d0d8a54aeb67bf8a1645c0a59a5241e06f3540007e283d778dfb94c0c5f4`
- matrix: compact + baseline, 3 seeds, 12 months

Two preceding runs were rejected as instrumentation defects before any economic conclusion was admitted:

1. end-of-month active filtering omitted firms that produced and exited in the same month from sector-output reconciliation;
2. end-of-month exit mutation zeroed `desiredProduction`, invalidating a production-bound check performed after the production event.

The accepted v10c runner measures the production bound at the production event itself.

## Hard gates

All accepted-run hard gates passed:

- deterministic replay exact: PASS
- health: PASS
- complete coverage: PASS
- supply shortage reconciliation: PASS
- sector output reconciliation: PASS
- production bounds: PASS
- country ledgers: PASS
- GDP identity: PASS
- finite rows: PASS

Reconciliation maxima:

- input shortage error: `2.842170943040401e-14`
- sector output error: `4.547473508864641e-13`
- production bound error: `0`
- GDP identity residual: `1.4551915228366852e-11`

## Baseline 12-month result

| Metric | unit-basis control | topological same-month supply | Difference |
|---|---:|---:|---:|
| mean unemployment | 0.2514 | 0.2465 | -0.004846 |
| firm exits | 248 | 241 | -7 |
| mean wage arrears | 64,933.2 | 64,698.2 | -234.99 |
| goods fulfillment | 0.5575 | 0.5705 | +0.013055 |
| mean input shortage | 40.614 | 38.776 | -1.8384 (-4.53%) |
| mean materials output | 89.759 | 89.444 | x0.9965 |
| mean consumer output | 118.586 | 122.974 | x1.0370 |

The intervention improves several outcomes, but the magnitude is modest relative to the remaining failure state.

The late window is especially discriminating. In M10-12, input shortage is almost unchanged (`ratio = 0.9949`) even though consumer output rises about 9.7% and unemployment falls about 1.7 percentage points. Therefore same-month availability lag is not a sufficient explanation for the remaining late shortage/collapse.

## Claim classification

### A — VERIFIED EXISTING FACT

The frozen implementation procures all intermediate inputs before the monthly `produce` call. Same-month upstream output is therefore unavailable to downstream procurement in the control.

### B — DIAGNOSTIC LEAD

Topological same-month availability measurably improves goods fulfillment, consumer output, exits, and unemployment in the unit-basis experiment.

### C — HYPOTHESIS RESULT

**H-SC1: procurement-before-production timing is a structural propagation defect.**

Verdict: **SUPPORTED AS A CONTRIBUTOR, NOT AS THE DOMINANT RESIDUAL CAUSE.**

### D — PROPOSED CHANGE

A topological production/procurement scheduler remains a possible repair candidate, but it is **not admitted for canonical merge** at this stage.

## Next dependency-safe test

The next isolated causal target is the already-supported stockout-censoring feedback lead:

- realized `f.sales` is written into `f.previousSales` even when the firm is stocked out;
- `previousSales` then anchors projected sales and subsequent production planning;
- a supply-constrained sale can therefore be interpreted as weak demand.

WP-RV07-P9 will test a parameter-free stockout-censor correction as a diagnostic ablation before any combined repair candidate is constructed.

## Boundary

- canonical economic mechanism changes: 0
- canonical parameter tuning: 0
- empirical realism claim: NO
- repair merge authorization: NO
