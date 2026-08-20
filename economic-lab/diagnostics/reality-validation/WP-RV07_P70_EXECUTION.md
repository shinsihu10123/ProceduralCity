# WP-RV07-P70 — Productivity × Full-Cash Procurement Interaction Matrix

## Objective

Test whether the procurement cash-reservation mechanism that was weak in P7 becomes a major causal bottleneck once the physical unit/productivity defects are partially relieved.

P69 showed that the productivity-normalized economies can hold aggregate domestic supplier stock several times larger than downstream net need while procurement fill remains low and shortages persist. P70 tests that interaction causally.

## Productivity bases

- CONSUMER
- MATERIALS + CONSUMER
- RESOURCE + MATERIALS + CONSUMER

For each base, compare:

- canonical procurement budget = `ledger cash * 0.42`
- full-cash procurement budget = actual available ledger cash, with all other canonical procurement features retained:
  - same five-round cap
  - same sampled supplier search
  - same reliability/price score
  - same seller inventories and prices
  - same ledger settlement and accounting entries
  - same production ordering

No credit or cash is created.

## Hard gates

- deterministic replay exact
- all runs healthy
- complete coverage
- productivity normalization activated
- full-cash path activated
- finite procurement accounting
- ledger verification
- GDP identity reconciliation
- finite macro rows

## Interpretation

A large improvement only after productivity normalization would identify an interaction: the 42% cash reservation was not the original root cause but becomes binding once physical supply is repaired. A weak response again would shift the residual toward search/round constraints, sector quantity mapping, labor/exit feedback, or other cash uses.

## Authority

Diagnostic causal ablation only. Canonical changes: 0. Parameter fitting: 0. Repair merge: NO. Empirical realism claim: NO.