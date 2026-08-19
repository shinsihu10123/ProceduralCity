# WP-RV04 — Firm Distress & Exit Attribution

Status: **EXECUTION IN PROGRESS — fresh bounded rerun after WP-RV02 closure**
Date: 2026-08-19

## Frozen economic semantics

Economic Model Frozen Baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`.

Economic mechanism changes authorized: **0**.
Parameter tuning authorized: **0**.

## Admission

WP-RV02 bounded 12-month baseline reproduction is PASS across independent seeds A/B/C. WP-RV03 causal decomposition is already PASS on the live branch and identifies firm exit as a secondary nonlinear amplifier after labor-demand contraction. WP-RV04 is therefore dependency-safe to execute now.

## Promoted experiment

- scale: baseline
- seeds: `ECON-RV02-A`, `ECON-RV02-B`, `ECON-RV02-C`
- horizon: 12 months
- source: WP-RV02 promoted multi-seed baseline dataset / WP-RV03 causal onset window
- dedicated workflow: `.github/workflows/economic-lab-rv04.yml`
- diagnostic runner: `economic-lab/scripts/firm-exit-diagnosis-v10.mjs`

## Questions

1. Which coded trigger actually closes each firm: liquidity/payroll distress, severe credit stress, or both?
2. What conditions precede the four-month distress threshold?
3. How prevalent are demand deterioration, cash shortage, wage arrears, inventory accumulation, input shortage, credit rejection, debt-service misses and loan default in the four-month pre-exit window?
4. Does firm exit mainly reflect financial-credit failure or an operating-cash/payroll failure after the real-side contraction?

## Instrumentation

The diagnostic runner wraps existing methods without changing their economic result:

- `BankSystem.originateCredit` — records firm applications and whether a new firm loan is actually created;
- `BankSystem.serviceDebt` — records due, exact loan-payment ledger settlement, arrears/misses/default transitions;
- `SupplyChainSystem.evaluateExits` — observes every firm at the exact exit-evaluation boundary and reproduces the frozen coded exit predicates.

The runner includes an exact observer non-interference comparison on a separate 6-month seed before running the promoted panel.

Every actual exit must reconcile to the macro exit count and to one of the frozen direct triggers. The runner also requires exit firms to move from distress month 3 to at least 4 on the exit evaluation.

No exit threshold is changed or weakened.

## Current execution rule

This file update intentionally triggers the dedicated WP-RV04 workflow. A PASS may be recorded only after the fresh GitHub Actions run completes successfully and its JSON artifact is inspected. Until then, WP-RV04 remains **EXECUTION IN PROGRESS**.
