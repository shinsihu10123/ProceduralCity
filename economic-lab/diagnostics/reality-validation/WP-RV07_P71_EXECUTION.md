# WP-RV07-P71 — Productivity-Normalized Procurement Exact Stop-Reason Audit

## Objective

Identify the exact canonical procurement termination branches that remain after the physical productivity/unit-basis defects are partially relieved.

P69 established that large downstream shortages coexist with aggregate supplier stock several times larger than net domestic need. P71 therefore reproduces the canonical procurement loop exactly and classifies each short buyer by the branch that actually stopped procurement.

## Productivity bases

- CONSUMER
- MATERIALS + CONSUMER
- RESOURCE + MATERIALS + CONSUMER

All retain the P2 diagnostic unit-basis transform and the same algebraically-derived static productivity normalization used in P61-P70.

## Exact stop branches

For every buyer with remaining input need:

- `BUDGET_EXHAUSTED`
- `ROUND_CAP`
- `NO_SELLABLE_STOCK` / `EMPTY_CANDIDATE_LIST`
- `SELF_SUPPLIER_SELECTED`
- transfer/negligible-unit failures if observed
- remaining algorithmic/selection termination

At the stopping point the audit also records:

- eligible supplier count and stock excluding self
- minimum eligible price
- whether physical stock could cover the remaining need
- whether the remaining canonical budget could cover it at the minimum price
- rounds, transactions and budget utilization

## Hard gates

- exact non-interference against the same productivity-normalized economy without the tracer
- all runs healthy
- complete country coverage
- productivity normalization activated
- exact procurement shortage reconciliation
- ledger verification
- finite rows

## Interpretation

P71 distinguishes whether P69's stock-sufficient shortages are actually terminated by:

1. the 42% cash reservation;
2. search / round-cap / self-selection logic;
3. buyer-local lack of sellable stock;
4. another explicit settlement branch.

This audit is read-only with respect to economic behavior; the tracer duplicates the canonical procurement loop and must reproduce the uninstrumented state exactly.

## Authority

Canonical economic changes: 0. Parameter fitting: 0. Repair merge: NO. Empirical realism claim: NO.