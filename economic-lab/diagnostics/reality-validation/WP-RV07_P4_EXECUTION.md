# WP-RV07-P4 — Working-Capital Bridge Causal Ablation

## Status

EXECUTION CANDIDATE

## Objective

Test whether the residual collapse that remains after the price/wage unit-basis correction is materially caused by intra-month payroll settlement timing.

This work package does **not** merge a repair into the canonical model.

## Paired variants

1. `unit-basis-control`
   - price/wage initialization basis ablation only

2. `unit-basis-collateral-bridge`
   - same unit-basis candidate
   - consumer-firm payroll bridge issued immediately before wage accrual/settlement when exact payroll due exceeds available cash
   - bridge amount is bounded by:
     - exact payroll cash shortfall
     - current finished-goods market value
     - existing bank-capital capacity
   - no fitted haircut, multiplier or target outcome
   - principal is repaid immediately after household-goods settlement when cash is available
   - unpaid principal remains an explicit bank loan and enters the existing debt-service path

## Why this experiment is admissible

WP-RV07-P3 verified that, under the unit-basis candidate, 44.67% of baseline consumer-firm cash-insufficient payroll events and 46.43% of the associated payroll shortfall value were bridgeable by household-goods revenue arriving later in the same month. The share exceeded 90% in M1–3 and declined materially later in the horizon.

Therefore this is a causal intervention against a measured transmission channel, not an arbitrary parameter tune.

## Hard gates

- exact deterministic replay
- long-run health
- complete country-month coverage
- bridge origination ledger/event reconciliation
- bridge repayment ledger/event reconciliation
- well-formed bridge loan states
- settlement-ledger country verification
- expenditure GDP identity reconciliation

Outcome improvements are descriptive only and cannot make a failed hard gate pass.

## Run envelope

- scales: compact, baseline
- seeds: ECON-RV02-A / B / C
- horizon: 12 months
- timeout: 12 minutes

## Interpretation rule

- If the bridge materially reduces early arrears/exits but late collapse remains, working-capital timing is a verified amplifier but not the terminal root cause; proceed to production/input/revenue dynamics.
- If the bridge removes most of the residual collapse while hard gates pass, promote working-capital institution design to an evidence-based repair track before merge.
- If the bridge has little effect, reject sequencing as a major causal repair target and continue structural diagnosis.

## Canonical-change rule

`canonicalMechanismChanges = 0`

The script monkey-patches only the experimental world instance. No production economic source file is changed by this work package.
