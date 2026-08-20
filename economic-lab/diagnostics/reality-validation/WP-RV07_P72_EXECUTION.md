# WP-RV07-P72 — Productivity × Procurement-Budget × Supply-Sequencing Factorial

## Objective

Close the two live procurement residual axes identified by P69-P71 in one causal matrix:

1. canonical 42% procurement cash reservation versus full available ledger cash;
2. canonical procure-before-produce ordering versus topological same-month RESOURCE → MATERIALS → downstream availability.

## Productivity bases

- CONSUMER
- MATERIALS + CONSUMER
- RESOURCE + MATERIALS + CONSUMER (NONCAPITAL)

Each base uses the same P2 unit-basis transform and the same algebraically-derived static productivity normalization used in P61-P71. No fitted coefficient is introduced.

## 2 × 2 procurement/sequencing matrix per productivity base

- canonical sequencing + 42% reserved procurement budget
- canonical sequencing + full available ledger cash
- topological same-month sequencing + 42% reserved procurement budget
- topological same-month sequencing + full available ledger cash

Total: 12 variants across compact and baseline scales and three established diagnostic seeds.

## Topological diagnostic intervention

For the topological variants only, the within-country supply phase is reordered as:

1. RESOURCE produces;
2. MATERIALS procures raw material;
3. MATERIALS produces;
4. CAPITAL and CONSUMER procure processed material;
5. CAPITAL and CONSUMER produce.

All canonical input coefficients, prices, supplier-choice logic, maximum rounds, accounting transfers and production bounds remain unchanged. The full-cash axis changes only the procurement budget from `ledger cash × 0.42` to full available ledger cash.

### Important diagnostic caveat

As in P8, topological variants expose same-month upstream output before current-month wage accrual and labor-cost capitalization. Therefore this is a causal upper-bound experiment, not a production-ready sequencing design.

## Hard gates

- exact deterministic replay
- all runs healthy
- complete country-month coverage
- normalization intervention activated
- topological intervention activated in every topological run
- full-cash variants executed
- ledger country verification
- GDP identity reconciliation
- finite rows

## Primary questions

1. Does same-month topological availability materially reduce the processed-material no-stock component identified in P71?
2. Is timing a larger causal lever than the 42% cash reservation after productivity normalization?
3. Do cash and timing interact super-additively, or does one largely subsume the other?
4. Does the combined upper bound materially improve unemployment, exits, wage arrears, fulfillment and consumer output, or does severe collapse persist?

## Authority

Canonical economic changes: 0. Parameter tuning: 0. Repair merge: NO. Held-out validation: NO. Empirical realism claim: NO.