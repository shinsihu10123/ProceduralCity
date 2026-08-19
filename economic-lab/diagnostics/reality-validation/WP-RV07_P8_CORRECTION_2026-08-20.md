# WP-RV07-P8 — Instrumentation Correction

Status: **RE-RUN REQUIRED**

## Failure classification

The first WP-RV07-P8 run (`32277091374`) failed only the `sectorOutputReconciled` hard gate. All other hard gates passed:

- deterministic replay exact
- health
- complete coverage
- supply-shortage reconciliation
- production bounds
- ledger verification
- GDP identity
- finite rows

The failed gate was a diagnostic-population mismatch, not evidence that the topological intervention itself violated sector output accounting.

## Root cause

`country.lastIndustry.sectorOutputs` records output produced during the current month. Firm exit evaluation occurs later in the monthly step. The original P8 row-level reconciliation summed current-month firm output only for firms whose end-of-step `active` flag remained true. A firm that produced earlier in the month and exited later in the same month was therefore present in `sectorOutputs` but incorrectly excluded from the diagnostic comparison sum.

The same end-of-step active filter was also removed from the production-bound diagnostic so that every firm with current-month output is checked on the same population basis.

## Correction boundary

- canonical economic mechanism changes: 0
- ablation mechanism changes: 0
- parameter tuning: 0
- supplier selection changes: 0
- transaction-order changes: 0
- only the P8 hard-gate reconciliation population changes

The corrected runner is `scripts/topological-supply-sequencing-ablation-v10b.mjs`. It applies two exact text substitutions to the frozen P8 diagnostic runner at runtime and then executes the corrected diagnostic from the same scripts directory, preserving all relative imports and economic code.

## Verdict

First run: **BLOCKED — INSTRUMENTATION DEFECT**

The economic result from the first run is not admitted. P8 must be re-run with the corrected reconciliation before any causal conclusion is made.
