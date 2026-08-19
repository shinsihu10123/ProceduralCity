# WP-RV07-P26 — Lagged Supply-Stress Signal Timing Causal Ablation

## Purpose

P24 verified that the current monthly order resets `supplyShortage` before `firmDecision`, so the reasoning model's `supplyStress` input is always zero at decision time. P26 tests the causal importance of that signal-timing defect without changing physical procurement or production.

## Variants

1. `unit-basis-control` — current ordering and signal behavior.
2. `unit-basis-lagged-supply-stress-signal` — immediately before `supply.beginMonth` resets fields, save the prior month's `supplyShortage`, `desiredProduction`, and `capacity`; after reset, expose only that saved shortage to `firmDecision`. Immediately after all firm decisions and before credit origination, restore `supplyShortage` to zero so the rest of the monthly physical pipeline remains canonical.

The candidate therefore changes only the information available to the cognitive decision at that point.

## Exact reconciliation

Candidate decision-time expected signal:

`clamp(priorSupplyShortage / max(1, priorDesiredProduction || priorCapacity || 1), 0, 1)`

The observed trace `perception.supplyStress` must reconcile exactly to that value.

## Questions

- Does nonzero lagged shortage information change selected strategies / negative hiring?
- Does it improve workforce retention, output and fulfillment?
- Does it worsen contraction because firms rationally respond to scarce inputs by cutting labor?
- Is the verified zero-signal timing defect macro-material or locally irrelevant?

## Hard gates

Deterministic replay, health, complete coverage, exact lagged-signal reconciliation, positive lagged signal actually presented, ledger integrity, GDP identity and finite rows.

## Boundary

This is a diagnostic causal information-timing experiment. It does not authorize the lag convention as production architecture. Canonical mechanism changes: 0; tuning: 0; repair authorization: NO.

Workflow registration trigger: 2026-08-20.
