# WP-RV08 R4-AA — Interim Causal Synthesis

Date: 2026-08-22
Status: PARTIAL / RUNNING
Run: `32524831084`
Executed source: `f126d67ad7d9288c22d5d4f6ed39923e2a90f90c`
Scope: production–revenue–payroll wedge decomposition only

## 1. Purpose

R4-AA separates the current production–revenue–payroll wedge into two economically distinct failure classes:

1. **plan-economics shortfall** — even under an optimistic plan-level gross-contribution upper bound, the planned production volume at current product/input prices cannot support the physical workforce required to execute that plan;
2. **realization gap** — plan-level gross contribution is sufficient in principle, but actual realized operating contribution is insufficient to support the physical workforce.

A third, smaller class is **settlement gap** — realized support is sufficient but actual wage settlement support is not.

This is a diagnostic audit only. It does not authorize a canonical repair or empirical calibration.

## 2. Evidence available at this interim checkpoint

Five completed artifacts have passed all hard gates:

- canonical / original A / CONSUMER;
- restructure / original A / CONSUMER;
- restructure / original C / MATERIALS+CONSUMER;
- restructure / held-out E / CONSUMER;
- restructure / held-out E / MATERIALS+CONSUMER.

All inspected artifacts passed health, ledger, accounting, GDP arithmetic, normalization activation, audit coverage and finite-row gates.

## 3. Aggregate decomposition

| Case | Physical workers | Plan-supportable | Realized-supportable | Settled-supportable | Plan viable | Realized viable | Plan viable but realized fails | Dominant classification |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| canonical A / CONSUMER | 32.51 | 23.86 | 4.82 | 5.83 | 38.65% | 4.89% | 34.29% | plan shortfall 61.35% |
| restructure A / CONSUMER | 30.13 | 22.53 | 4.53 | 5.17 | 35.26% | 4.37% | 31.65% | plan shortfall 64.74% |
| restructure C / M+C | 25.57 | 22.70 | 5.73 | 5.97 | 39.98% | 6.52% | 35.66% | plan shortfall 60.02% |
| restructure held-out E / CONSUMER | 30.86 | 21.99 | 4.46 | 5.29 | 30.05% | 5.02% | 26.14% | plan shortfall 69.95% |
| restructure held-out E / M+C | 25.39 | 22.07 | 6.15 | 6.47 | 39.18% | 7.90% | 33.22% | plan shortfall 60.82% |

The aggregate result is therefore not consistent with a single failure mode.

Across these completed cases:

- only about `30–40%` of physical-production rows are plan-economically viable even under the optimistic gross-contribution test;
- only about `4–8%` are realized-contribution viable;
- roughly `26–36%` of all physical-production rows are plan-viable but fail at realization;
- fully coherent rows remain below `1%` in the inspected aggregate cases.

## 4. Sector decomposition — decisive result

The failure mode differs sharply by industry.

### RESOURCE

Across all five inspected cases:

- `shareExpectedViable = 0%`;
- classification = **100% plan_economics_shortfall**.

RESOURCE therefore fails before a market-realization explanation is needed. At current transformed price/wage/productivity conditions, optimistic plan-level product value is itself insufficient to support the physical labor required by the plan.

### MATERIALS

Under CONSUMER-only normalization:

- original A canonical: **100% plan_economics_shortfall**;
- original A restructure: **100% plan_economics_shortfall**;
- held-out E restructure: **100% plan_economics_shortfall**.

Under MATERIALS+CONSUMER normalization the defect is reduced but not removed:

- original C: plan shortfall `70.3%`, realization gap `25.8%`;
- held-out E: plan shortfall `69.4%`, realization gap `27.1%`.

This confirms that productive normalization materially changes MATERIALS feasibility, but most MATERIALS observations remain plan-economically unable to finance their physical labor requirement.

### CAPITAL

CAPITAL shows the opposite architecture.

Representative plan-viability shares:

- canonical A: `82.9%`;
- restructure A: `91.7%`;
- restructure C / M+C: `85.3%`;
- held-out E / CONSUMER: `81.2%`;
- held-out E / M+C: `79.3%`.

But most of those plan-viable rows subsequently fail at realization:

- realization-gap shares range roughly `69.7–84.0%`.

CAPITAL is therefore primarily a **revenue-realization / market-access problem**, not a first-order physical unit-economics shortfall.

### CONSUMER

CONSUMER is mixed:

- plan shortfall ranges roughly `37.8–56.4%`;
- realization gap ranges roughly `36.9–55.8%`;
- fully coherent rows are approximately zero in the inspected cases.

CONSUMER therefore sits at the junction of both mechanisms: part of the sector is already plan-economically infeasible, while another large part is viable on paper but fails to realize sufficient contribution.

## 5. Hypothesis verdicts

### H-AA1 — the production–payroll wedge is mainly a downstream sales-realization problem

**FALSIFIED AS A GENERAL EXPLANATION.**

RESOURCE and much of MATERIALS fail before realization: optimistic plan-level contribution cannot support physical labor need.

### H-AA2 — the wedge is mainly intrinsic unit economics / productivity / price-wage infeasibility

**FALSIFIED AS A GENERAL EXPLANATION.**

CAPITAL is usually plan-economically viable, yet realized contribution fails for the majority of observations. CONSUMER also contains a large realization-gap population.

### H-AA3 — the model contains at least two sector-specific causal mechanisms

**STRONGLY SUPPORTED.**

Current decomposition:

`RESOURCE / much of MATERIALS`
→ plan economics / value-product-of-labor shortfall

`CAPITAL / part of CONSUMER`
→ plan viable
→ realized revenue/contribution failure

`CONSUMER`
→ mixed plan-economics + realization failure

### H-AA4 — settlement mechanics alone explain the wedge

**DOWNGRADED.**

The settlement-gap class is small relative to plan-economics and realization-gap classes in all inspected aggregate cases. Settlement defects still exist elsewhere, but they are not the dominant explanation for this wedge.

## 6. Current causal frontier after R4-AA partial evidence

The previous single statement

`physical labor need >> financially supportable labor`

can now be decomposed more precisely:

1. **upstream value-product defect**: in RESOURCE and much of MATERIALS, current price × contribution margin × labor productivity cannot finance the workforce physically required by the plan;
2. **realization defect**: in CAPITAL and part of CONSUMER, the planned economics are viable but actual output/sales/revenue realization fails to convert the plan into payroll-supporting operating contribution;
3. **mixed downstream defect**: CONSUMER contains both populations.

This is a materially stronger causal narrowing than a global labor-demand formula explanation.

## 7. Dependency-safe next diagnostics

Two read-only audits are justified while the remaining R4-AA shards continue:

- **R4-AB — Value Product of Labor Decomposition**: decompose upstream plan shortfall into unit contribution margin, one-worker physical capacity, wage, price and input-cost terms by sector.
- **R4-AC — Revenue Realization Funnel Audit**: for plan-viable firms, measure where expected contribution is lost across planned production → actual output → sales → realized revenue/contribution → payroll settlement.

Neither audit changes wage, price, productivity, labor demand, credit, procurement, settlement, restructuring or exit rules.

## 8. Interim verdict

**PARTIAL — TWO-MECHANISM SECTOR SPLIT CONFIRMED IN FIVE COMPLETED SHARDS.**

R4-AA remains running. Final closure awaits the remaining canonical/restructure and base/seed matrix. No canonical repair is authorized.