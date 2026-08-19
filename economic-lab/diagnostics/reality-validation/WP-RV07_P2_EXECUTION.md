# WP-RV07-P2 — Structural Unit-Basis Repair Ablation

Status: **EXECUTION REQUESTED**
Date: 2026-08-19

## Admission

- WP-RV07-P0: PASS — stock-flow scale audit.
- WP-RV07-P1: PASS — payroll/output-value unit mismatch verified across compact and baseline.

P2 is dependency-safe.

## Frozen control

Economic Model Frozen Baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`.

Canonical economic mechanism changes: **0**.
Canonical parameter tuning: **0**.

## Candidate under test

Candidate ID: `price-wage-basis`.

This is an **experimental initialization semantic ablation**, not a committed repair.

For the candidate world only, before construction:

`country.initialPrice := country.initialWage`

Equivalently, the existing near-1 initial price basis is multiplied by the already-existing ratio `initialWage / initialPrice`.

This rule introduces no fitted free coefficient and is not chosen to hit an unemployment, GDP, inflation or exit target. It tests one specific semantic interpretation suggested by P0/P1: the current near-1 `initialPrice` may be functioning like a normalized price index while the settlement system treats it as a literal currency-denominated unit transaction price.

The frozen-control world is unchanged.

## Paired experiment

- variants: `frozen-control`, `price-wage-basis`
- scales: `compact`, `baseline`
- seeds: `ECON-RV02-A`, `ECON-RV02-B`, `ECON-RV02-C`
- horizon: 12 months
- runner: `economic-lab/scripts/structural-unit-basis-ablation-v10.mjs`

Same seed/scale pairs are used across variants.

## Questions

1. Does the candidate close the verified ~100x payroll/output-value mismatch without touching dynamic behavioral coefficients?
2. Does household goods-market fulfillment change materially?
3. Do firm revenues become capable of covering a materially larger fraction of payroll obligations?
4. Does the early unemployment/exit sequence change, and if so when?
5. Does the financial collapse sequence change as a downstream effect?
6. Does the candidate preserve all health/accounting/determinism invariants?
7. Does the candidate merely move the inconsistency elsewhere, e.g. through cash, credit, inventory or price dynamics?

## Hard gates

Hard gates are deliberately invariant-based, not outcome-target-based:

- exact paired deterministic replay for each variant × scale;
- frozen-control health PASS;
- candidate health PASS;
- complete variant × scale × seed × country × month coverage;
- expenditure GDP identity reconciliation in control;
- expenditure GDP identity reconciliation in candidate.

Lower unemployment, fewer exits, higher consumption or higher lending are **not** hard PASS criteria. They are descriptive outcomes only.

## Decision rule

P2 may classify the candidate as:

- `VIABLE STRUCTURAL CANDIDATE` — the unit mismatch is materially resolved and invariants remain intact, with no immediately dominant replacement pathology;
- `PARTIAL` — the unit mismatch improves but a second structural inconsistency remains;
- `REJECT` — the candidate fails invariants or simply relocates the pathology.

No candidate will be merged into canonical model code in P2.

## Scope caution

This is internal model-structure diagnosis. It does not claim that the derived price level is empirically calibrated or realistic. External calibration, if later authorized, remains a separate held-out validation stage.
