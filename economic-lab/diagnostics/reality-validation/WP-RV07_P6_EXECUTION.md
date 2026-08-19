# WP-RV07-P6 — Exact Procurement Stop-Reason Audit

Status: **EXECUTION REQUESTED**

## Purpose

WP-RV07-P5 established that input shortage becomes large after M3, but its budget/physical flags were only necessary-condition upper bounds. WP-RV07-P6 identifies the actual terminal branch of the existing five-round procurement loop for every buyer-month.

## Frozen boundary

- canonical economic mechanism changes: 0
- canonical parameter tuning: 0
- unit-basis candidate remains experimental and unmerged
- no repair is admitted in this work package

## Method

The diagnostic replaces `SupplyChainSystem.procureInputs` only inside the diagnostic world with a source-equivalent traced implementation. It preserves the original loop, RNG calls, supplier scoring, transfer order, accounting calls, inventory updates, budget rule, and round limit.

A plain world and traced world are replayed with the same seed. Exact serialized state equality is a hard gate. If exact replay fails, the diagnostic is invalid.

Actual terminal branches recorded:

- `NO_STARTING_NEED`
- `FILLED`
- `BUDGET_EXHAUSTED`
- `ROUND_CAP`
- `NO_SELLABLE_STOCK`
- `EMPTY_CANDIDATE_LIST`
- `SELF_SUPPLIER_SELECTED`
- `NEGLIGIBLE_DESIRED_UNITS`
- `TRANSFER_FAILED`
- fallback/unclassified branches if encountered

For every short buyer, the audit also records whether non-self sellable stock and remaining budget were jointly sufficient at the exact stop point. This distinguishes a genuine resource/cash stop from a search/allocation/round-limit stop.

## Execution matrix

- scales: compact, baseline
- seeds: ECON-RV02-A, ECON-RV02-B, ECON-RV02-C
- horizon: 12 months
- non-interference replay: each scale, 3 months
- workflow timeout: 10 minutes

## Hard gates

1. source-equivalent traced replay is exact
2. all health checks pass
3. complete country-month coverage
4. diagnosed shortage reconciles exactly to `lastIndustry.inputShortageUnits`
5. every short case has a terminal branch
6. no buyer exceeds the existing five-transaction procurement cap
7. all shortage values are finite and non-negative

## Admission rule for next causal ablation

The next ablation must target the empirically dominant **actual stop branch**, not a parameter selected from outcome preference.

## Dispatch note

2026-08-20: execution contract touched after the workflow existed on-branch so the path-filtered push can dispatch the bounded P6 audit without changing economic semantics.
