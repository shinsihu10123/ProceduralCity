# WP-RV07-P68 — Extended Productivity Transition-Horizon Audit

## Objective

Test whether the month-12 employment reversal identified by P64 persists beyond the original 12-month diagnostic horizon or is itself temporary.

## Variants

- CONSUMER
- RESOURCE + CONSUMER
- MATERIALS + CONSUMER
- RESOURCE + MATERIALS + CONSUMER

All use the same P2 unit-basis and P61-P64 algebraic productivity diagnostic intervention.

## Horizon

24 months on compact and baseline scales across the three established RV02 diagnostic seeds. These are diagnosis seeds, not held-out validation seeds.

## Measurements

Monthly:

- unemployment and employment stock
- hires, layoffs, vacancies
- exits, entries, active firms
- wage arrears
- fulfillment and input shortage
- sector output
- firm cash and nominal sales

For each broader productivity variant, compute the first month unemployment becomes lower than CONSUMER-only and whether a persistent lower-unemployment tail exists through month 24.

## Hard gates

- deterministic replay exact
- all runs healthy
- complete coverage
- intervention activated
- ledger verification
- GDP identity reconciliation
- finite rows

## Authority

Diagnostic only. Canonical mechanism changes: 0. Parameter fitting: 0. Repair merge: NO. This is not held-out empirical validation.