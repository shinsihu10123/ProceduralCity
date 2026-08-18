# WP-RV04 — Firm Distress & Exit Attribution

Status: EXECUTION REQUESTED
Date: 2026-08-18

## Frozen economic semantics

Economic Model Frozen Baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`.

Economic mechanism changes authorized: **0**.
Parameter tuning authorized: **0**.

## Promoted experiment

- scale: baseline
- seeds: `ECON-RV02-A`, `ECON-RV02-B`, `ECON-RV02-C`
- horizon: 12 months
- source: WP-RV02 promoted multi-seed baseline dataset / WP-RV03 causal onset window

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

Every actual exit must reconcile to the macro exit count and to one of the frozen direct triggers. The runner also requires exit firms to move from distress month 3 to at least 4 on the exit evaluation.

No exit threshold is changed or weakened.
