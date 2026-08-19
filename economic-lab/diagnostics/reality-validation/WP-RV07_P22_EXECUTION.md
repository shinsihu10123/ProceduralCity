# WP-RV07-P22 — Output Collapse Extensive / Intensive Capacity Decomposition

## Purpose

P20 shows the revenue collapse is primarily a finished-goods quantity/availability collapse. P22 decomposes the output loss into:

- extensive margin: active firm count / exits
- labor intensive margin: workers per active firm
- productive-capacity margin
- capacity suppression of unconstrained plans
- input/execution suppression after desired production is set

## Exact decomposition

At canonical production planning:

- derive the existing unconstrained plan from existing terms
- reconcile canonical `desiredProduction = min(capacity × 1.08, unconstrained plan)`
- record workers and capacity

At canonical production:

- record actual output and input shortage
- reconcile summed firm output to `lastIndustry.sectorOutputs`

## Design

Read-only unit-basis candidate, compact + baseline, A/B/C seeds, 12 months, sector and time-window decomposition, exact non-interference replay.

## Questions

1. How much does active firm count decline?
2. How much does workers-per-firm decline among active firms?
3. How much does capacity per active firm decline?
4. How much planned output is suppressed by capacity vs input constraints?
5. Which sectors dominate each loss channel?

## Hard gates

Observer non-interference, health, complete coverage, exact desired-production equation, sector-output reconciliation, ledger integrity, GDP identity and finite rows.

## Boundary

No canonical changes, no tuning, no repair selection from P22 alone.

<!-- workflow-registration trigger: 2026-08-20 -->
