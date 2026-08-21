# WP-RV08 R4-V/W — Restructure Arrears Cohort Execution

Date: 2026-08-21
Mode: **ACTUAL EXECUTION — DIAGNOSTIC ONLY**
Canonical mechanism merge: **PROHIBITED**
Parameter tuning: **PROHIBITED**
Empirical realism claim: **PROHIBITED**

## Why this batch is admitted now

R4-O/P established a robust causal trade-off: bounded restructuring sharply reduces unemployment and binary exits but produces a large wage-arrears penalty. Early R4-Q/R/S/U shards preserve the same pattern across longer horizons and held-out seeds.

Source inspection identifies a separate settlement-semantics lead in `src/markets/labor-market.js`:

1. `settlePayroll()` services wage arrears only for households that are currently employed and retain an `employerId`.
2. On layoff, the employment link is cleared.
3. Household `wageArrears` itself is not cleared.
4. Aggregate macro wage arrears sum all household arrears, including unemployed former workers.

Therefore a restructuring event can leave pre-existing unpaid wage claims on former workers while removing the only link through which the current payroll routine can service those claims. This does **not** mean the arrears are fictitious: they are valid unpaid wage claims. The diagnostic question is whether the apparent post-restructure arrears explosion is primarily current payroll overstaffing or a missing post-employment liability-settlement state.

## R4-V — 24m cohort decomposition

Baseline scale. Original A/B/C and held-out D/E/F are sharded one seed per job.

Variants per seed and both bases:

- control;
- realized-contribution restructuring;
- operating-support restructuring;
- permissive multi-support restructuring.

Read-only cohort metrics include:

- total household wage arrears;
- arrears attached to current employment;
- arrears held by unemployed households;
- arrears carried by workers separated during restructure/liquidation;
- claims at least three months past separation;
- firm-linked versus household-unlinked arrears;
- restructuring count, layoffs and recurrence.

## R4-W — 48m persistence decomposition

Baseline scale. Original A/B/C and held-out D/E/F, one seed per job.

Only the operating and multi restructure rules are retained, because R4-P already showed realized-only is a conservative near-control lower bound.

Goal: determine whether detached former-worker claims become a growing long-horizon stock, and whether repeated restructuring rather than current payroll alone explains arrears divergence.

## Hard gates

Every shard requires:

- exact observer non-interference on the control path;
- deterministic replay;
- health;
- requested run coverage;
- unit/capacity normalization activation;
- restructuring activation where applicable;
- ledger integrity;
- general accounting integrity;
- GDP arithmetic identity;
- finite metrics;
- observed separated-worker wage claims in restructure runs.

No arrears are written off. No former-worker claim is paid by a new diagnostic mechanism. No wage, price, tax, credit or unemployment target is introduced.

## Causal interpretation boundary

If most of the incremental restructure arrears remain attached to currently employed workers, the next repair frontier is current payroll sizing / operating contribution.

If a large and persistent share is held by separated workers whose employer link has been removed, the model additionally requires a wage-claim liability state that survives employment termination and is handled in restructuring/liquidation settlement. That would be a **distinct institutional/accounting repair**, not permission to erase arrears.

## Execution width

- R4-V: 6 seed shards × 24m.
- R4-W: 6 seed shards × 48m.
- Total: **12 independent jobs**, plus launch/final beacons.

This batch runs concurrently with the already-launched R4-Q/R/S/T/U superbatch and does not depend on its unfinished shards.