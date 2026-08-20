# WP-RV07-P32 — Non-Operating Firm Cash-Drain Causal Matrix

## Purpose

Run a broad elimination matrix in parallel with P29/P30/P31 to test whether objective firm cash stress is mainly created by two non-core uses of cash rather than by core operating economics.

## Variants

1. `unit-basis-control`
2. `unit-basis-firm-debt-holiday`
3. `unit-basis-no-capex`
4. `unit-basis-firm-debt-holiday-no-capex`

### Firm-debt holiday

Only already-due **firm** loan service is skipped. Household debt service remains canonical. Firm loan balances, credit applications and every other mechanism remain present. This is a strong diagnostic upper bound, not a viable contract rule.

### No-capex

The private capital-goods investment market is skipped. Production capacity stocks are otherwise unchanged for this 12-month diagnostic horizon.

## Questions

- Is debt service a material creator of cash stress or only a later symptom?
- Does private capital investment materially drain firms before payroll failure?
- Do the two together explain the labor/capacity collapse?
- If neither produces a large recovery, the search should concentrate on core sales-versus-wage/input economics.

## Hard gates

Deterministic replay, health, complete coverage, debt-holiday activation, zero private gross investment in no-capex variants, ledger integrity, GDP identity and finite rows.

## Boundary

Diagnostic causal upper bounds only. Canonical changes: 0. Parameter tuning: 0. Repair authorization: NO. Empirical realism claim: NO.