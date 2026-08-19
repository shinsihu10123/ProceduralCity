# WP-RV07-P11 — Labor-Demand Recursive Attrition Diagnosis

## Status
EXECUTION-READY / DIAGNOSTIC ONLY

## Admission
Admitted by WP-RV07-P10.

P10 verified that the unit-basis world is predominantly capacity-bound and that mean workers per active firm-month decline materially through the 12-month window. This WP determines whether the frozen recursive employment-target rule itself creates systematic workforce attrition.

## Frozen mechanism under audit
Before the labor market clears, each active firm sets:

`desiredWorkers = round(max(1, currentWorkers) * (1 + clamp(hiringChange, -0.10, 0.12)))`

The labor market then lays off workers above this target and attempts to fill vacancies below it.

## Method
Read-only observer only.

For each firm-month capture:
- workers at month start
- selected plan and hiring change
- exact derived desiredWorkers
- post-labor workers
- contraction / hold / expansion classification
- planned layoff slots and vacancy slots
- actual worker loss/gain
- target-inventory vs previous-sales demand anchor
- whether production plan is capacity-bound
- sector and month window

## Key diagnostic questions
1. How often does the recursive rule contract employment?
2. Are contractions occurring while target-inventory/replenishment pressure remains high?
3. Are capacity-bound firms simultaneously receiving contractionary labor targets?
4. Is the consumer sector disproportionately affected?
5. Does the contraction share rise as unemployment and capacity binding worsen?

## Hard gates
- exact observer non-interference
- health
- country/firm coverage
- exact desiredWorkers equation reconciliation
- direction classification completeness
- ledger verification
- GDP identity reconciliation
- finite rows

## Claim discipline
A = frozen source/runtime fact.
B = diagnostic lead.
C = causal hypothesis only after results.
D = no canonical repair in this WP.

## Run configuration
- scales: compact, baseline
- seeds: ECON-RV02-A/B/C
- horizon: 12 months
- non-interference replay: 3 months per scale

## Stop rule
No canonical source modification and no parameter tuning. If the desiredWorkers equation does not reconcile exactly, verdict is BLOCKED and economic inference is prohibited.
