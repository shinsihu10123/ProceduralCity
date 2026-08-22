# WP-RV08 R4-BC2 Execution — Corrected Decision-Synchronization Attribution

Date: 2026-08-22
Parent: R4-BC
Mode: diagnostic instrumentation correction

## Reason for correction

R4-BC economic outcomes are usable, but its direct firm synchronization metric is incomplete for legacy-firm variants. The legacy firm decision path returns the selected plan under `currentPlan.name`, while the first R4-BC observer looked only at `currentPlan.selected` or cognitive decision history. Disabling cognition therefore produced missing firm-action observations and artificial zero synchronization metrics.

This is an observer defect, not an economic failure.

## Corrected observer

Firm action is read as:

`currentPlan.selected || currentPlan.name || latest cognitive decision`

Household action remains:

`lastTrace.selected || latest cognitive decision`

The observer does not write to simulation state.

## Matrix

- original A / C
- held-out E / F
- control
- legacy-firms
- legacy-households
- legacy-both
- MATERIALS+CONSUMER normalization
- 24 months
- 16 independent jobs

## Primary question

Does replacing current cognitive reasoning with the already-existing legacy decision path materially reduce firm/CONSUMER action concentration, and if so does that materially change unemployment, output, arrears, firm survival, or consumption?

## Hard gate

Every completed shard must observe nonzero firm actions. A legacy-firm shard with zero observed firm actions is an instrumentation failure and cannot support a synchronization verdict.

No production repair is authorized.
