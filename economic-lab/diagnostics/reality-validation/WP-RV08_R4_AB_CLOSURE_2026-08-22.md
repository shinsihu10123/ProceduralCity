# WP-RV08 R4-AB — Value Product of Labor Decomposition Closure

Date: 2026-08-22  
Status: PASS — ECONOMIC SHARDS COMPLETE / ORCHESTRATION FINAL BEACON QUEUED / NO CANONICAL REPAIR AUTHORIZED  
Run: `32528611154`  
Executed source: `4fcd83e27850028d6b436049d3c44000510963c5`  
Scope: canonical + restructure; original A/C + held-out E; CONSUMER + MATERIALS+CONSUMER; 18 months

## 1. Question

R4-AB asks whether the plan-economics shortfall isolated by R4-AA is mainly:

1. a **net value product below wage** problem — one worker's physical contribution value at current prices/input costs/productivity cannot cover that worker's wage; or
2. a **labor granularity / low-utilization** problem — a full worker is economically viable, but the plan is too small to use the integer worker efficiently.

This is a read-only diagnostic. It changes no canonical economic rule.

## 2. Execution / hard gates

All 12 economic shards completed successfully. All artifacts passed health, ledger integrity, general accounting, GDP arithmetic identity, productive-normalization activation, audit row coverage and finite-result checks.

At this checkpoint, the workflow `final-beacon` is still queued because of Actions runner backlog. This is an orchestration-completion condition, not an economic-model failure, and does not alter the 12/12 successful economic-shard evidence below.

Permanent compact evidence:
`economic-lab/diagnostics/reality-validation/evidence/WP-RV08_R4_AB_VALUE_PRODUCT_COMPACT_2026-08-22.csv`

## 3. Sector result

| Sector | Mean net value product / wage across 12 cases | Share VPL below wage | Low-utilization / indivisibility share | Plan-viable share | Interpretation |
|---|---:|---:|---:|---:|---|
| RESOURCE | 0.526–0.602 | 100% | 0% | 0% | **structural value-product infeasibility** |
| MATERIALS | 0.431–0.988 | 52.4–100% | 0–21.4% | 0–26.7% | mostly value-product infeasibility; normalization partly relieves it |
| CAPITAL | 1.148–1.285 | 5.6–29.6% | 2.1–4.4% | 67.0–91.2% | value product usually viable; failure lies later |
| CONSUMER | 1.016–1.050 | 14.6–32.6% | 12.7–20.3% | 51.9–71.3% | near break-even VPL; mixed marginal infeasibility + labor granularity |

## 4. Decisive findings

### RESOURCE

RESOURCE is the cleanest result in the entire AB matrix:

- mean net value product / wage is only **0.526–0.602**;
- **100%** of audited RESOURCE rows have net value product below wage;
- low-utilization / worker-indivisibility is **0%**;
- plan viability is **0%**;
- plan utilization is nevertheless very high: **97.4–98.3%**.

Therefore RESOURCE does not fail because a one-worker firm is being underused. At current internal price, wage and productivity scales, the worker is almost fully utilized and still produces only roughly 53–60% of the contribution value needed to cover wage.

**H-AB1 — RESOURCE shortfall is primarily worker indivisibility / low utilization: FALSIFIED.**

**H-AB2 — RESOURCE shortfall is intrinsic price–wage–productivity/value-product incoherence: STRONGLY SUPPORTED.**

### MATERIALS

Under CONSUMER-only normalization, MATERIALS remains completely infeasible: every audited row has VPL below wage and plan viability is zero.

Under MATERIALS+CONSUMER normalization, mean VPL rises toward one, but the sector remains fragile:

- mean VPL reaches roughly 0.83–0.99 depending on seed/mode;
- 52–68% of rows can still remain below wage;
- low-utilization / indivisibility explains only a minority, at most about 21%;
- plan viability reaches only about 19–27%.

So MATERIALS is not a pure granularity problem either. Productive normalization materially reduces the defect but does not close the unit-economics gap.

### CAPITAL

CAPITAL behaves oppositely:

- mean VPL / wage is consistently **> 1.14**;
- mean plan-payroll coverage is **> 1.11**;
- plan viability is usually **67–91%**.

Its failure is therefore downstream of plan economics. This independently corroborates R4-AA's classification of CAPITAL as a realization/market-access problem rather than a first-order value-product problem.

### CONSUMER

CONSUMER lies close to the knife-edge:

- mean VPL / wage is about **1.016–1.050**;
- mean plan-payroll coverage is about **0.994–1.028**;
- plan utilization is about **97.7–97.9%**.

But 15–33% of rows still have VPL below wage and another 13–20% are classified as low-utilization/worker-indivisibility gaps. CONSUMER therefore mixes a marginal unit-economics problem with labor granularity; neither explains the large downstream realized-payroll shortfall by itself.

## 5. Causal conclusion

R4-AB closes the upstream branch of the R4-AA split:

`RESOURCE`
→ high plan utilization
→ net value product per worker < wage
→ plan contribution cannot fund physical payroll
→ **price–wage–productivity/value-product incoherence**

`MATERIALS`
→ same defect in stronger form without normalization
→ partial improvement under productive normalization
→ residual VPL shortfall + smaller granularity component

`CAPITAL`
→ plan economics mostly viable
→ proceed to realization funnel

`CONSUMER`
→ near-break-even plan economics
→ mixed marginal VPL/granularity issue
→ large remaining failure must be localized downstream

## 6. Verdict

**PASS — VALUE-PRODUCT ROOT CONFIRMED FOR RESOURCE; MATERIALS PARTIALLY SAME; CAPITAL FALSIFIED AS UPSTREAM VALUE-PRODUCT ROOT.**

No canonical parameter change or calibration is authorized. R4-AD/R4-AE remain the dependency-safe next diagnostics for production execution and downstream absorption.
