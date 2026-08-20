# WP-RV07-P35 — Break-Even Physical-Capacity Normalization Causal Matrix

## Purpose

P29-P33 show that the residual collapse is not fixed by a nominal price floor. The next causal question is whether the deeper problem is **too little physical output capacity per unit of payroll relative to the existing price/input structure**.

P35 therefore changes no prices and no wages. Instead it asks how much physical capacity would be required for an active firm to cover payroll plus required intermediate-input cost at its already-existing transaction price under a full-capacity optimistic assumption.

## Parameter-free capacity requirement

For a targeted active firm after canonical labor clearing and `planProduction`:

- payroll = `wage * workers`
- required input cash cost per output = `inputPerOutput * current mean upstream supplier price`
- unit margin available to pay labor = `price - required input cost per output`

If that margin is positive:

`breakEvenCapacity = payroll / unitMargin`

Candidate capacity becomes:

`max(canonicalCapacity, breakEvenCapacity)`

Then the existing production-planning equation is re-evaluated only to remove the old capacity cap:

`desiredProduction = min(newCapacity * 1.08, existing unconstrained production requirement)`

where the unconstrained requirement uses the unchanged existing demand-anchor, beliefs and replenishment formula.

No price, wage, input coefficient, cash, credit rule, labor target, procurement budget, supplier search or exit rule is altered.

## Variants

1. `unit-basis-control`
2. RESOURCE capacity normalization
3. MATERIALS capacity normalization
4. CONSUMER capacity normalization
5. CAPITAL capacity normalization — control/falsification sector
6. RESOURCE + MATERIALS normalization
7. RESOURCE + MATERIALS + CONSUMER normalization

## Questions

- Does correcting physical capacity instead of price restore output without the nominal-demand compression seen in P31/P33?
- Does RESOURCE capacity normalization propagate beneficially rather than shifting a price shock downstream?
- Is MATERIALS the key physical throughput bottleneck?
- Does the noncapital joint variant materially reduce cash stress, labor contraction and exits?
- Does CAPITAL again show little leverage?

## Hard gates

Deterministic replay, health, complete coverage, each non-control variant activates, only target sectors receive direct capacity changes, exact break-even capacity floor, exact desired-production re-plan equation, ledger integrity, GDP identity and finite rows.

## Boundary

This is a deliberately strong causal upper bound, not a productivity calibration or production-ready rule. It establishes causal importance of the physical unit basis only. Canonical changes: 0. Parameter tuning: 0. Repair authorization: NO. Empirical realism claim: NO.