# WP-RV07-P7 — Procurement Cash-Reservation Causal Ablation

Status: **EXECUTION REQUESTED**

## Admission basis

WP-RV07-P6 passed all hard gates and identified `BUDGET_EXHAUSTED` as the dominant actual procurement stop branch under the experimental unit-basis candidate.

Baseline full-panel shortage attribution:

- budget-exhausted shortage share: 80.62%
- no-stock cases: material mainly in later windows
- round-cap/search residual: negligible

Therefore the next causal ablation targets the existing 42% procurement cash reservation rule and nothing else.

## Frozen boundary

- canonical economic mechanism changes: 0
- canonical parameter tuning: 0
- unit-basis candidate remains experimental/unmerged
- this work package does not authorize a production repair

## Variants

### Control

`unit-basis-control`

- experimental unit-basis seed transformation only
- existing procurement rule: buyer cash × 0.42
- existing supplier search, five-round limit, pricing, transfer and accounting semantics unchanged

### Candidate

`unit-basis-full-cash-procurement`

- same experimental unit-basis seed transformation
- procurement budget becomes the buyer's full currently available settlement cash
- no intermediate coefficient, fitted haircut or target outcome
- all other procurement/search/accounting behavior source-equivalent to control

This is an **upper-bound causal ablation**, not a production liquidity policy proposal. It deliberately asks whether the 42% reservation is causally constraining supply. It does not assume that spending all cash is desirable; payroll arrears, exits and other side effects are measured explicitly.

## Execution matrix

- scales: compact, baseline
- seeds: ECON-RV02-A / B / C
- horizon: 12 months
- deterministic replay: both variants × both scales, bounded 3 months
- CI timeout: 10 minutes

## Measurements

For each country-month:

- input shortage units
- procurement spend
- candidate spend / starting cash
- goods fulfillment
- unemployment
- firm exits
- wage arrears
- GDP and exact expenditure-identity residual
- settlement-ledger country verification

Window comparisons:

- M1-3
- M4-6
- M7-9
- M10-12
- full 12-month panel

## Hard gates

1. deterministic replay exact for every variant/scale pair
2. all health checks pass
3. complete matrix coverage
4. firm shortage reconciles to `lastIndustry.inputShortageUnits`
5. every country settlement ledger verifies
6. GDP expenditure identity reconciles
7. all recorded economic values are finite

No economic-improvement threshold is a hard gate.

## Interpretation rule

- If full-cash procurement sharply reduces input shortage but worsens payroll/exit dynamics, the 42% rule is a real supply constraint **and** a liquidity-protection tradeoff; the next repair must model obligation-aware liquidity allocation rather than simply set the coefficient to 1.0.
- If shortage and macro outcomes barely change, H-P7 is falsified and the next diagnosis returns to physical upstream supply/production sequencing.
- If broad outcomes improve without destructive liquidity side effects, the result supports replacing the fixed 42% reservation with an endogenous obligation-aware liquidity rule, but still does not authorize an arbitrary coefficient.
