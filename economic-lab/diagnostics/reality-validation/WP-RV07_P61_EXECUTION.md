# WP-RV07-P61 — Static Unit-Productivity Normalization Matrix

## Purpose

P36 shows that RESOURCE, MATERIALS and CONSUMER labor-unit economics are below break-even under the current internal unit basis. P35's monthly capacity override improves throughput but is not a production-ready rule.

P61 tests a smaller structural hypothesis: **is the initial physical productivity scale itself misaligned with wage / price / input units?**

## Intervention

At the first canonical `planProduction` call only, targeted firms receive a permanent diagnostic productivity rescaling derived algebraically from their existing state:

`factor = max(1, payroll / (contributionMarginPerUnit × canonicalCapacity))`

where:
- payroll = current workers × current wage,
- contribution margin = current output price − input coefficient × current mean input-product price,
- canonical capacity is the capacity already calculated by the frozen model.

The factor is applied once to `firm.productivity`, and first-month capacity/desired production are updated consistently. Future months use canonical planning with that permanently rescaled productivity. There is no monthly break-even floor.

## Variants

1. control
2. RESOURCE only
3. MATERIALS only
4. CONSUMER only
5. all non-capital sectors jointly

## Decision rule

- Strong recovery from one sector only => localize the primary unit-scale defect.
- Joint recovery much stronger than singles => unit inconsistency is network-coupled across non-capital sectors.
- Weak recovery despite corrected static break-even productivity => realized utilization/revenue and propagation dominate after the initial unit defect.
- Worsening downstream output after one sector normalization => relative-price/input-flow transmission remains important.

## Controls

No fitted coefficient. The factor is derived from current frozen quantities. Determinism, health, intervention activation, ledger integrity, GDP identity and finite rows are hard gates.

This is a diagnostic causal candidate only. Canonical mechanism changes: **0**. Repair merge: **0**. Empirical realism claim: **NO**.
