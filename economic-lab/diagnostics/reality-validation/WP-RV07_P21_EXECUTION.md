# WP-RV07-P21 — Household Goods Funding & Seller-Availability Decomposition

## Purpose

Run the buyer-side complement to P20. Determine whether consumer-firm revenue is constrained primarily by household budget funding or by lack/exhaustion of eligible consumer-goods sellers.

## Existing exact observer

The canonical goods market already exposes a read-only diagnostic observer reporting:

- initial/end eligible sellers
- initial/end inventory units and value
- households with positive budgets
- households with unmet budgets
- no-eligible-seller stops
- round-limit stops
- settlement failures
- seller exhaustion events

P21 uses that observer without changing the market algorithm.

## Additional funding measures

By country-month P21 also records:

- desired consumption budget per household
- wage income per household
- disposable income per household
- transfer income per household
- unemployment
- consumer output and input shortage

## Design

- unit-basis candidate
- compact + baseline
- seeds A/B/C
- 12 months
- exact observer non-interference replay
- M1-3 / M4-6 / M7-9 / M10-12 / FULL

## Hard gates

Exact non-interference, health, coverage, desired-budget reconciliation, consumption reconciliation, zero settlement-failure stops, ledger integrity, GDP identity, finite rows.

## Interpretation

Persistent positive budgets plus high no-seller stop share and seller exhaustion supports a supply-availability constraint. Strong desired-budget/income collapse while inventory remains available supports buyer-funding/demand constraint. Both may coexist.

## Boundary

Read-only diagnosis. No canonical changes, no tuning, no empirical calibration claim.
