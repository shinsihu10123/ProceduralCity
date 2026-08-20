# WP-RV07-P62 — Three-Sector Static Productivity Factorial

## Purpose

P61 showed that CONSUMER-only static productivity normalization materially improves unemployment, exits, household-goods clearing and cash, while RESOURCE-only and MATERIALS-only normalization do not improve unemployment. Broad non-capital normalization produces the largest physical throughput but a weaker unemployment response than CONSUMER-only.

P62 tests whether that non-monotonic response is caused by cross-sector interaction.

## Design

Run the complete 2^3 factorial over diagnostic static productivity normalization for:

- RESOURCE
- MATERIALS
- CONSUMER

Variants:

1. control
2. RESOURCE
3. MATERIALS
4. CONSUMER
5. RESOURCE + MATERIALS
6. RESOURCE + CONSUMER
7. MATERIALS + CONSUMER
8. RESOURCE + MATERIALS + CONSUMER

The normalization algebra is exactly the P61 diagnostic: at first production planning, targeted firms receive the algebraically derived productivity multiplier required for existing contribution margin at then-current capacity to cover current payroll. No fitted coefficient is introduced.

## Metrics

For compact and baseline, 3 seeds, 12 months:

- unemployment
- firm exits
- wage arrears
- goods fulfillment
- input shortage
- RESOURCE / MATERIALS / CONSUMER output
- nominal sales
- firm cash
- GDP identity residual

Report M1–3 / M4–6 / M7–9 / M10–12 / FULL windows.

## Decision

- If CONSUMER-containing pairs preserve the CONSUMER-only unemployment improvement, upstream productivity is complementary or neutral.
- If adding RESOURCE or MATERIALS to CONSUMER reverses employment gains while increasing throughput, identify a cross-sector labor/finance/procurement interaction rather than a simple productive-capacity deficiency.
- If one pair dominates all single sectors and the three-sector case, prioritize that pair for the next causal closure matrix.

## Controls

P61 deterministic replay, health, intervention activation, ledger, GDP and finite-value gates are retained.

Canonical economic mechanism changes: **0**. Parameter tuning: **0**. Repair merge: **0**. Empirical realism claim: **NO**.
