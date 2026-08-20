# WP-RV07 P41–P44 Expanded Residual-Cause Batch — 2026-08-20

## Objective

P36–P40 narrowed the root defect to a strongly supported cross-sector unit/capacity inconsistency, while leaving substantial residual unemployment under the strongest physical-capacity intervention. P41–P44 localize that residual in parallel across firm labor-demand decisions, exit amplification and within-month production topology.

## Shared controls

- Existing P2 unit-basis diagnostic seed transform (`initialPrice = initialWage`).
- `compact,baseline`, seeds `ECON-RV02-A/B/C`, 12 months.
- Canonical source edits: **0**.
- Fitted coefficient tuning: **0**.
- Existing P35 break-even capacity intervention may be reused as an already-tested diagnostic factor.
- Hard gates: determinism, health, complete coverage, ledger integrity, GDP identity, intervention activation/isolation, finite outputs.

## P41 — Firm Decision / Hiring-Contraction Attribution

Observe the firm decision state immediately after firm plans and credit origination but before labor-market clearing. Compare control and non-capital break-even-capacity variants.

Record by firm-month:
- sector,
- selected plan,
- `hiringChange`, workers, `desiredWorkers`, planned layoffs/vacancies,
- perceived expected demand growth,
- cash stress, inventory pressure, supply stress, debt burden,
- selected candidate base projected revenue/cash/distress risk when available.

Question: does capacity feasibility materially switch firms away from defensive labor contraction, or does labor demand keep shrinking despite larger feasible output?

## P42 — Planned-Layoff Suppression × Capacity

2×2 matrix:
1. control,
2. no planned layoffs,
3. non-capital break-even capacity,
4. capacity + no planned layoffs.

The no-planned-layoff diagnostic changes only the pre-labor desired-worker floor after credit decisions:

`desiredWorkers = max(current workers, canonical desiredWorkers)`

It does not prevent exit displacement and does not force new hiring.

## P43 — Exit Boundary Suppression × Capacity

2×2 matrix:
1. control,
2. exit suppression,
3. non-capital break-even capacity,
4. capacity + exit suppression.

Exit suppression replaces the diagnostic `evaluateExits` result with no exit transition while leaving distress accumulation and all earlier monthly economics untouched. This is an upper bound, not a repair.

## P44 — Topological Same-Month Supply × Capacity

2×2 matrix:
1. control,
2. topological same-month supply,
3. non-capital break-even capacity,
4. topological same-month supply + capacity.

Topological sequencing reuses the already tested P8 diagnostic logic:
RESOURCE production → MATERIALS procurement/production → CAPITAL/CONSUMER procurement/production.

The P8 accounting-timing caveat remains: this is causal localization only, not production-ready architecture.

## Decision rules

- Large P42 rescue: planned firm labor-demand contraction is a major residual propagation loop.
- Large P43 rescue only after month 6: exit remains an amplifier, not initial root.
- P44 combination materially stronger than either single intervention: current monthly procurement-before-production topology is blocking capacity repair from propagating through the input network.
- If all three interaction tests remain weak, move next to the cognitive firm counterfactual cash-flow model and labor-demand formula itself.
