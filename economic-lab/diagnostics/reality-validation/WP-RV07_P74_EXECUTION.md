# WP-RV07-P74 — Solvency-Aware Propagation Guard Matrix

## Objective

Convert the P51 and P73 causal evidence into a bounded structural candidate test without using blanket no-layoff/no-exit suppression.

P73 showed that firm exit is the largest late unemployment amplifier and planned labor contraction is a smaller upstream amplifier, but blanket suppression drives wage arrears sharply higher. P51 independently showed that canonical desired labor is often below a conservative internal financial-support shadow.

P74 therefore asks whether propagation can be reduced **only for firms whose observable internal finances support continued operation**, while structurally unsupported firms remain free to shrink or exit.

## Fixed base economy

- P2 diagnostic unit-basis transform (`initialPrice = initialWage`), not canonical.
- Static algebraic productivity normalization as used in P61-P73.
- Two productivity bases:
  1. CONSUMER
  2. MATERIALS + CONSUMER
- Canonical procurement sequencing and canonical 42% procurement cash reservation. P72/P73 already bounded the supply-axis effect separately.

## Candidate axes

For each productivity base run:

1. `control`
2. `support-labor-floor`
3. `viable-exit-guard`
4. `support-labor-floor + viable-exit-guard`
5. `no-exit-upper-bound` (diagnostic benchmark only)

### Financial-support labor floor

Before labor clearing, reconstruct the P51 conservative support shadow using only existing model quantities:

- prior realized sales contribution at current unit margin;
- current ledger cash payroll support;
- current wage and workers.

`support = max(priorContributionSupportedWorkers, min(currentWorkers, cashPayrollSupportedWorkers))`

If canonical `desiredWorkers < min(currentWorkers, support)`, raise desired workers only to that support floor. The intervention cannot create a target above current employment and cannot force hiring beyond financially supportable retention.

### Viable exit guard

Reproduce canonical distress accumulation and exit logic. When a liquidity-driven exit candidate reaches the terminal distress threshold, suppress the exit for one month only if:

- the candidate is **not** in severe credit stress; and
- current realized operating cash contribution `max(0, revenue - inputSpend)` is at least the current wage obligation `wage * workers`.

The guarded firm remains at distress month 3. Credit-stress exits and operating-cash-infeasible liquidity exits proceed canonically.

This is deliberately coefficient-free. It does not forgive debt, create cash, or permanently protect firms.

## Hard gates

- exact deterministic replay per variant/scale;
- all runs healthy;
- complete variant × scale × seed × month × country coverage;
- productivity normalization activated;
- support-floor intervention activates in relevant variants;
- viable-exit guard activates in relevant variants;
- no-exit upper bound activates and reports zero exits;
- ledger verification;
- GDP identity reconciliation;
- finite rows.

## Decision rule

- If the bounded support floor/viable-exit guard materially recovers employment without the arrears explosion seen in P73, promote it to repair-architecture candidate status.
- If unemployment barely improves, P73's no-exit result is mostly explained by structurally nonviable firms and weak replacement-entry rather than premature exit.
- If the viable-exit guard helps but arrears still surge, add a financially coherent temporary-liquidity/settlement test before any repair merge.
- If exit remains dominant even with viable guards, focus next on replacement-entry regeneration rather than stronger incumbent protection.

## Authority

Canonical economic changes: 0. Parameter tuning: 0. Repair merge: NO. Held-out seeds: NO. Empirical realism claim: NO.
