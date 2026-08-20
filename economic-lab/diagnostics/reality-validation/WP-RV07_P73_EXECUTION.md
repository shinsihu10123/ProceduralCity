# WP-RV07-P73 — Residual Propagation Closure Factorial

## Objective

Determine whether the severe unemployment that remains after physical productivity relief and procurement/timing relief is primarily sustained by endogenous labor-contraction and firm-exit propagation.

P72 established that same-month topological supply and full-cash procurement materially improve throughput but do not close unemployment. P73 therefore moves one layer downstream and tests propagation upper bounds on the two strongest supply-side productivity bases.

## Productivity bases

1. CONSUMER normalization
2. MATERIALS + CONSUMER normalization

Both retain the P2 diagnostic unit-basis transform and the same algebraically-derived static productivity normalization used in P61-P72.

## Factorial axes

For each productivity base:

- supply architecture:
  - canonical sequencing + canonical 42% procurement reservation;
  - P72 joint upper bound: same-month RESOURCE→MATERIALS→downstream sequencing + full available ledger cash;
- planned labor contraction:
  - canonical;
  - no planned layoffs: if a firm enters labor clearing with `desiredWorkers < workers`, floor desired workers at current workers for that month;
- firm exit:
  - canonical;
  - no exits: reproduce canonical distress accumulation but prevent the terminal `active=false` transition.

This produces 16 variants total.

## Interpretation boundary

`no planned layoffs` and `no exits` are deliberately strong causal upper bounds. They are not repair candidates. If they create wage arrears, shortages or other stress, that stress is evidence that the suppressed propagation path was absorbing an underlying objective deficit rather than causing it by itself.

The P72 topological supply intervention is also diagnostic only. It can expose same-month upstream output before current-month wage-cost recognition is complete; therefore it is not production-ready accounting architecture.

## Hard gates

- exact deterministic replay per variant/scale;
- all runs healthy;
- complete variant × scale × seed × month × country coverage;
- productivity normalization activated;
- joint supply intervention activated in all joint-supply runs;
- no-layoff intervention activated and reported labor layoffs equal zero in those variants;
- no-exit intervention activated and reported firm exits equal zero in those variants;
- ledger verification;
- GDP identity reconciliation;
- finite rows.

## Decision rule

- If joint supply alone leaves high unemployment but no-layoff/no-exit axes collapse it, residual failure is dominated by propagation feedback after the objective supply-side defects.
- If no-layoff helps substantially but no-exit is mainly late, labor contraction remains the main endogenous amplifier and exit remains secondary.
- If even the all-axis upper bound remains severely depressed, another objective constraint precedes labor/exit and diagnosis must continue.
- If unemployment improves only by suppressing labor/exit while arrears explode, do not promote suppression rules; design the repair around the underlying cash-flow/operating-feasibility cause plus a bounded propagation rule.

## Authority

Canonical economic changes: 0. Parameter tuning: 0. Repair merge: NO. Held-out seeds: NO. Empirical realism claim: NO.