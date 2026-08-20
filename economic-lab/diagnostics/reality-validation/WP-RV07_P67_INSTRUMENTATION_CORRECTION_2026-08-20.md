# WP-RV07-P67 Instrumentation / Intervention-Integrity Correction

Date: 2026-08-20

## Original run

- Run: `32336493355`
- Job: `96326972948`
- Result: FAILURE

The original P67 run did **not** fail because of an Economic Lab health, ledger, GDP, determinism, finite-value, or intervention-activation failure. Every such gate passed.

The sole failed gate was:

`firstMonthPhysicalProductionEquivalent=false`

## Defect classification

**Instrumentation / experimental-integrity assumption defect.**

The original gate assumed that equal direct capacity normalization must imply identical realized month-1 sector output between the `productivity-state` and `capacity-only` variants.

That assumption is too strong and conflicts with the purpose of P67. Canonical `firm.productivity` is not a purely physical-capacity variable: it is consumed elsewhere in the economy, including household seller perceived-quality scoring. Same-month procurement or other consumers of the productivity state can therefore cause realized production or allocation to diverge even if the intended direct production plan is identical.

Using realized output equality as a hard integrity gate would preclude observing the semantic side effect that P67 is designed to measure.

## Correction

The corrected runner now:

1. records the firm-specific derived factor, post-intervention capacity and desiredProduction immediately after each target firm's plan-stage intervention;
2. requires the state and capacity-only variants to have the **same month-1 direct factor, capacity and desiredProduction** for the same seed/country/firm;
3. requires the capacity-only variant to leave `firm.productivity` unchanged;
4. records realized month-1 sector-production divergence as an **observed diagnostic result**, not a hard precondition;
5. writes the evidence JSON before final gate assertion so future hard-gate failures still archive evidence.

No economic mechanism, fitted parameter, or pass threshold was changed to improve an economic outcome.

## Authority

Canonical economic changes: 0. Parameter tuning: 0. Repair authorization: NO.