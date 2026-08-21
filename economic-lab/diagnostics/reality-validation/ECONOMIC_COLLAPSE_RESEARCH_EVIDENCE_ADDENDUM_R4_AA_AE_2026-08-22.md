# Economic Collapse Research Evidence Addendum — R4-AA through R4-AE

Date: 2026-08-22  
Status: ACTIVE / REPORT-GRADE ADDENDUM  
Parent register: `ECONOMIC_COLLAPSE_RESEARCH_EVIDENCE_REGISTER_2026-08-21.md`

## Purpose

This addendum preserves the causal narrowing after the original research register, so that transient Actions artifacts are not the only evidence carrier.

## A — VERIFIED: the production–payroll wedge is sector-specific, not a single global failure

R4-AA decomposed the gap between physical labor need and payroll support into:

- plan-economics shortfall;
- realization failure after a viable plan;
- a much smaller settlement-stage residual.

RESOURCE is entirely upstream-plan infeasible in the audited matrix. CAPITAL is usually plan viable and fails later. CONSUMER is mixed. MATERIALS is mostly upstream infeasible but improves under productive normalization.

## A — VERIFIED: RESOURCE value product is structurally below wage

R4-AB completed all 12 economic shards.

Across canonical/restructure, original A/C and held-out E, and both normalization bases:

- RESOURCE mean net value product / wage = **0.526–0.602**;
- **100%** of RESOURCE rows have net value product below wage;
- low-utilization/worker-indivisibility classification = **0%**;
- plan viability = **0%**;
- plan utilization remains approximately **97.4–98.3%**.

Therefore RESOURCE is not failing because integer labor is underused. At the current internal price/wage/productivity scale, a near-fully-utilized worker still does not generate enough contribution value to finance wage.

Permanent numeric evidence:
`evidence/WP-RV08_R4_AB_VALUE_PRODUCT_COMPACT_2026-08-22.csv`

Closure:
`WP-RV08_R4_AB_CLOSURE_2026-08-22.md`

## A — VERIFIED: CONSUMER realization failure occurs primarily before finished-goods absorption

R4-AC completed all 12 economic shards; the workflow final beacon is runner-queued at this checkpoint but the economic matrix is complete.

For plan-viable CONSUMER rows across all cases:

- plan viability = **51.9–71.3%**;
- actual output / plan = **12.5–25.7%**;
- sales / available inventory = **68.6–93.3%**;
- production-execution first loss = **73.8–91.7%**;
- inventory-absorption first loss = **0–0.31%**.

Thus the dominant CONSUMER loss is not "produce and fail to sell." Firms mostly fail to execute the planned production volume in the first place.

CAPITAL also loses strongly at production execution, but unlike CONSUMER it retains a second substantial investment-absorption problem.

Permanent numeric evidence:
`evidence/WP-RV08_R4_AC_REALIZATION_FUNNEL_BY_SECTOR_FINAL_2026-08-22.csv`

Closure:
`WP-RV08_R4_AC_CLOSURE_2026-08-22.md`

## B — DIAGNOSTIC LEAD: workforce capacity is the dominant first CONSUMER execution bottleneck

The first completed R4-AD held-out shard is canonical / held-out E / CONSUMER.

For plan-viable CONSUMER rows:

- current workers = **8.51** on average;
- physical workers required by the unconstrained plan = **30.84**;
- mean worker coverage = **26.1%**;
- median worker coverage = **4.8%**;
- pre-input executable production / plan = **25.8%**;
- actual output / plan = **16.4%**;
- workforce-capacity first-loss classification = **73.8%**;
- input-availability first-loss classification = **9.9%**.

This directly connects the world-level labor-target architecture to the R4-AC production-execution loss.

However prior Y/Z ablations already proved that simply staffing to physical need is financially inadmissible: it restores employment/output while exploding current-worker wage arrears.

Current structural diagnosis is therefore two-sided:

`canonical labor target too small for production plan`
AND
`physical-plan labor bill too large for sustainable realized contribution`.

R4-AD remains running across the rest of the matrix.

## B — DIAGNOSTIC LEAD: downstream demand starvation may explain much of intermediate/capital inventory absorption

R4-AE has begun producing artifacts.

First completed cases:

- canonical / original C / CONSUMER;
- restructure / original A / MATERIALS+CONSUMER.

Classification shares point toward weak downstream requirement/eligibility:

- raw material `downstream_demand_low`: **79.2%** and **73.6%**;
- processed material `downstream_demand_low`: **45.8%** and **80.6%**;
- capital goods `investment_demand_low`: **83.3%** and **100%**.

Buyer-budget-gap and generic market-execution classes are much smaller in these first shards.

These are preliminary until the full AE matrix completes. Arithmetic means of ratios with inventory in the denominator are not used as evidence because near-zero inventory can make those means numerically unstable; classification shares and robust quantities are preferred.

Interim synthesis:
`WP-RV08_R4_AE_FIRST_SHARDS_SYNTHESIS_2026-08-22.md`

## Updated causal graph

`RESOURCE/MATERIALS value-product infeasibility`
+
`canonical labor target disconnected from production-plan labor need`
→ low executable production
→ low downstream material/investment requirement
→ weak upstream/capital-goods revenue realization
→ current payroll underfunding
→ wage arrears
→ repeated restructuring
→ liquidity-driven exit
→ labor displacement + estate stranding
→ further supply/demand deterioration

The graph remains partially provisional because R4-AD and R4-AE are still executing.

## Repair gate

No canonical repair is authorized yet.

Before repair design is promoted, the remaining AD/AE matrix must establish whether the held-out workforce-capacity and downstream-demand patterns replicate across original/held-out seeds, canonical/restructure modes, and both productive-normalization bases.
