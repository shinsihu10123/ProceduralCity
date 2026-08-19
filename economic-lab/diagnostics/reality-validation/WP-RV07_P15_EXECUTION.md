# WP-RV07-P15 — Resource-Sector Capacity Retention Ablation

## Question

P14 showed that blanket capacity-bound labor retention worsens late payroll and supply stress. Does the same intervention become causally useful when restricted to `RESOURCE` firms, which have no upstream input requirement?

## Intervention

Control: unit-basis candidate with canonical labor demand.

Candidate: after firm decision and credit origination but before labor clearing, only for active `RESOURCE` firms where:

- canonical `desiredWorkers < currentWorkers`, and
- the existing unconstrained production plan exceeds current-workforce capacity × existing `1.08` cap,

set `desiredWorkers = currentWorkers` for that month.

No candidate may expand above current staff. Non-resource firms are untouched.

## Classification

### A — VERIFIED

- P14 blanket guard reduced layoffs but increased late wage arrears and input shortage.
- RESOURCE production requires no purchased upstream input.

### C — HYPOTHESIS

H-P15-1: upstream resource labor retention increases raw output without the downstream input-use conflict seen in P14.

H-P15-2: if raw-material scarcity is an important propagation bottleneck, downstream materials/consumer output and fulfillment should improve.

H-P15-3: if payroll affordability is dominant even in RESOURCE, the targeted guard will still raise arrears/exits or produce little macro benefit.

### D — DIAGNOSTIC CANDIDATE

This is an industry-structure ablation, not a proposed production rule.

## Design

- scales: compact, baseline
- seeds: ECON-RV02-A/B/C
- horizon: 12 months
- unit-basis price candidate retained from P2
- no fitted coefficients
- deterministic replay hard gate
- ledger/GDP/health/coverage hard gates

## Decision rule

A coherent increase in resource output must propagate to downstream output/fulfillment without material payroll deterioration before this mechanism can remain a repair lead.

Canonical mechanism changes: 0. Parameter tuning: 0. Repair merge authorization: NO.