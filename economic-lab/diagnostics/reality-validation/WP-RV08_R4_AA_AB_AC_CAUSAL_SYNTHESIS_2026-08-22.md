# WP-RV08 R4-AA / R4-AB / R4-AC — Causal Synthesis

Date: 2026-08-22
Status: AA PASS / AB PASS / AC PARTIAL (11 of 12 economic shards complete at this checkpoint)
Branch: `scratch/new-project-2026-08-12`
Scope: production–revenue–payroll coherence only

## 1. Execution state

R4-AA workflow run `32524831084` completed all 12 economic audit shards and final beacon successfully.

R4-AB workflow run `32528611154` completed all 12 economic audit shards successfully. The final beacon was still queueing when this synthesis checkpoint was taken, but the economic matrix itself is complete.

R4-AC workflow run `32528698633` had 11 of 12 economic audit shards complete successfully. The only outstanding shard at this checkpoint was restructure / held-out E / CONSUMER.

Detailed numerical inspection below uses eight R4-AB artifacts and eight R4-AC artifacts covering original A/C, held-out E, canonical/restructure, and both productive normalization bases. No claim below relies on the uncompleted R4-AC shard.

## 2. R4-AA closure — sector split is real

R4-AA established that the production–payroll wedge is not one global failure mode.

Two dominant mechanisms exist:

1. upstream plan-economics/value-product failure;
2. plan-viable but unrealized production/revenue failure.

The full AA matrix completed cleanly, so the earlier five-shard interim sector split is no longer an execution artifact.

Verdict: **PASS — sector-specific causal split confirmed.**

## 3. R4-AB — why plan economics fails

R4-AB decomposes plan viability into current unit contribution margin × one-worker physical capacity ÷ wage, plus the residual effect of integer-worker granularity / low plan utilization.

### RESOURCE

Across all eight inspected cases:

- mean net value product per worker / wage: `0.526–0.602`;
- share below wage: `100%`;
- worker-indivisibility/low-utilization classification: `0%`;
- plan viable: `0%`.

This is decisive. RESOURCE is not failing because of labor granularity or because a viable worker is under-utilized. At the tested transformed price/wage/productivity state, one worker's net contribution value is intrinsically well below one wage.

**A — VERIFIED EXISTING FACT:** RESOURCE has a first-order value-product-of-labor defect.

### MATERIALS

Under CONSUMER-only normalization:

- mean net value product / wage: about `0.431–0.475` in inspected cases;
- share below wage: `100%`;
- plan viable: `0%`.

Under MATERIALS+CONSUMER normalization:

- mean net value product / wage rises to roughly `0.828–0.988`;
- share below wage remains about `52–68%`;
- worker-indivisibility/low-utilization explains another roughly `13–21%` in the inspected M+C cases;
- only about `19–26%` of rows are plan viable.

Therefore productive normalization materially reduces the MATERIALS defect but does not close it.

**A — VERIFIED EXISTING FACT:** MATERIALS contains both a genuine value-product shortfall and a secondary granularity/utilization effect after normalization.

### CAPITAL

Across the eight inspected cases:

- mean net value product / wage: `1.148–1.285`;
- plan-viable share: `67.0–91.2%`;
- below-wage share: only `5.6–29.6%`.

CAPITAL therefore is not primarily an intrinsic unit-economics failure.

### CONSUMER

Across the eight inspected cases:

- mean net value product / wage: `1.020–1.050`;
- plan-viable share: `52.0–71.3%`;
- below-wage share: `14.6–27.9%`;
- worker-indivisibility/low-utilization share: `12.7–20.3%`.

CONSUMER sits close to the viability boundary. Some firms have a true value-product shortfall, while another material block fails because a one-worker discrete resolution is too coarse for the plan size.

## 4. R4-AC — where plan-viable contribution is lost

R4-AC follows plan-viable firms through:

`unconstrained plan -> actual output -> sell-through -> contribution realization -> payroll settlement`

### CONSUMER — the dominant gap is before sales

Across the eight inspected cases:

- plan-viable share: `52.0–71.3%`;
- actual output / unconstrained plan: only `12.5–22.3%`;
- sell-through of available inventory: `68.6–91.9%`;
- production-execution-gap classification: `77.6–91.7%`;
- inventory-absorption-gap classification: approximately `0–0.3%`.

This materially changes the previous interpretation.

For plan-viable CONSUMER firms, the main problem is not that finished goods are produced and then fail to sell. The dominant loss occurs **before enough goods are produced**. Once goods exist, they are generally absorbed at a much higher rate than the production plan is executed.

**A — VERIFIED EXISTING FACT:** the dominant CONSUMER realization defect is a production-execution/capacity-input gap, not a first-order finished-goods demand gap.

### CAPITAL — dual bottleneck

Across the inspected cases:

- plan-viable share: `67.0–91.2%`;
- output / plan: `28.2–51.6%`;
- sell-through: `20.7–39.4%`;
- production-execution-gap classification: `48.6–75.1%`;
- inventory-absorption-gap classification: `21.7–46.7%`.

CAPITAL has two distinct failures: it often cannot execute the plan physically, and even when inventory exists the investment market absorbs only a small fraction.

### MATERIALS under M+C normalization

For the plan-viable MATERIALS subset:

- plan-viable share: `19.4–26.2%`;
- output / plan: `29.1–48.6%`;
- sell-through: `11.4–18.8%`;
- production-execution-gap classification: `49.0–71.2%`;
- inventory-absorption-gap classification: `25.3–47.8%`.

MATERIALS therefore also has a dual bottleneck once its unit economics are partially normalized: insufficient production execution plus very weak downstream absorption.

## 5. Settlement is not the main wedge at this frontier

The sequential R4-AC funnel rarely reaches a pure payroll-settlement-gap classification because most plan-viable firms have already failed materially at production execution or inventory absorption.

This does not negate previously verified payroll-settlement defects. It means settlement is downstream of larger physical/market-flow failures in the current production–revenue–payroll wedge.

## 6. Revised sector causal map

### RESOURCE

`net value product per worker < wage`
-> plan economics intrinsically infeasible
-> no downstream realization explanation required.

### MATERIALS

`value-product defect`
+ after normalization, `production execution gap`
+ `weak processed-material absorption`.

### CAPITAL

`plan economics usually viable`
-> `production execution gap`
+ `investment-market absorption gap`.

### CONSUMER

`mixed boundary-level unit economics / worker granularity`
-> among plan-viable firms, dominant failure is `actual output << unconstrained plan`
-> finished inventory itself is generally absorbed relatively well.

## 7. Current strongest causal frontier

The earlier statement

`physical labor need >> financially supportable labor`

is now too coarse.

The current frontier is:

1. **upstream value-product incoherence** in RESOURCE and much of MATERIALS;
2. **workforce/capacity/input execution incoherence** in plan-viable CONSUMER and CAPITAL;
3. **downstream B2B/investment absorption weakness** in MATERIALS and CAPITAL;
4. payroll distress then converts these operating failures into repeated restructuring and exit propagation.

## 8. Next dependency-safe diagnostics

### R4-AD — Production Execution Decomposition

For each plan-viable firm, separate:

`unconstrained plan`
-> `actual workforce physical capacity`
-> `pre-input achievable target`
-> `post-procurement input-constrained target`
-> `actual output`.

Primary question: is `actual output << plan` caused mainly by too few workers/capacity, by input inventory shortage after procurement, or by another production-stage discrepancy?

### R4-AE — Downstream Demand / Inventory Absorption Audit

For raw material, processed material and capital goods, compare:

- seller inventory;
- downstream net input/investment demand;
- buyer cash-budget support;
- actual B2B/investment sales;
- unmet downstream need.

Primary question: is low upstream sell-through caused by insufficient downstream real demand, buyer liquidity/budget limits, market-search/timing, or an investment eligibility rule?

Both remain read-only diagnostics. No canonical economic repair is authorized yet.
