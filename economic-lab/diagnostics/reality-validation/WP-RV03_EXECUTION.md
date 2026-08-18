# WP-RV03 — Extreme Unemployment Causal Decomposition

Status: EXECUTION REQUESTED
Date: 2026-08-18

## Frozen economic semantics

Economic Model Frozen Baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`.

Economic mechanism changes authorized in this WP: **0**.
Parameter tuning authorized in this WP: **0**.

## Promoted experiment

- scale: baseline
- seeds: `ECON-RV02-A`, `ECON-RV02-B`, `ECON-RV02-C`
- horizon: 12 months
- country histories: 12
- source promotion: WP-RV02 PASS — STAGED SCOPE

## Questions

1. Does unemployment rise because firms stop creating labor demand before matching can occur?
2. Are reservation-wage, stochastic matching, scan limits, or the 35% hiring-capacity rule materially binding during the onset?
3. How much separation is continuing-firm downsizing versus firm-exit separation?
4. Does desired household consumption collapse, or is desired spending mostly unmet in the goods market?
5. Which sequence is visible before the mass-exit window?

## Observational reconstruction

The WP reconstructs the exact labor target used by the frozen v0.10 model from each firm's pre-month worker stock and the already-realized `currentPlan.hiringChange`. It does not alter `hiringChange`, `desiredWorkers`, matching, firm exit, household consumption, or any settlement rule.

It also reconciles:

- reconstructed vacancy slots ↔ labor-market initial vacancies
- reconstructed planned layoff slots ↔ labor-market layoffs
- total employment separations ↔ market layoffs + firm-exit separations
- household `desiredConsumptionBudget` ↔ goods-market desired budget
- goods-market desired budget ↔ realized consumption + unmet budget

## PASS condition

PASS requires all three seeds to retain v0.10 health/accounting diagnostics and all five causal reconciliation identities to close over every country-month.

A PASS means that the causal decomposition evidence is trustworthy enough to evaluate hypotheses. It does **not** mean that any structural repair has been approved.
