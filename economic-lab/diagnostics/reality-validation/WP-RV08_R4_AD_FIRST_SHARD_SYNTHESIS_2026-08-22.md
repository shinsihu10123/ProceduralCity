# WP-RV08 R4-AD — First Completed Shard Synthesis

Date: 2026-08-22
Status: PARTIAL / RUNNING
Run: `32532999902`
Executed source: `1a3344cc4a6c46bc0fe2f18366959c78d0a72a5f`
Completed shard: canonical / held-out E / CONSUMER
Horizon: 18 months
Hard gates: PASS

## 1. Purpose

R4-AD decomposes the R4-AC production-execution gap into:

`unconstrained production plan`
→ `current workforce/labor capacity`
→ `post-procurement input capacity`
→ `actual output`

Classification order for plan-viable observations:

1. workforce/capacity gap if pre-input executable production is <50% of plan;
2. input-availability gap if workforce capacity passes but input coverage is <50%;
3. other execution gap if post-input target is not physically executed;
4. coherent execution otherwise.

This is read-only instrumentation.

## 2. Held-out E aggregate result

Across all plan-viable firm-month rows in the completed held-out E / CONSUMER shard:

- plan-viable rows: **954 / 2,748 = 34.72%**;
- mean current workers: **9.90**;
- mean physical workers required by the unconstrained plan: **28.49**;
- mean worker coverage: **41.83%**;
- median worker coverage: **28.57%**;
- mean pre-input executable production / plan: **37.39%**;
- mean input coverage: **64.02%**; median input coverage = **100%**;
- mean post-input target / plan: **23.49%**;
- mean actual output / plan: **23.49%**;
- share with workforce capacity below 50% of plan: **62.58%**;
- share with input coverage below 50%: **40.78%**;
- final first-loss classification:
  - workforce capacity gap **62.58%**;
  - input availability gap **14.57%**;
  - coherent execution **22.85%**.

This immediately establishes workforce/capacity as the largest first execution bottleneck in the held-out seed.

## 3. CONSUMER sector — decisive first-shard result

For plan-viable CONSUMER rows:

- mean current workers: **8.51**;
- mean physical workers required: **30.84**;
- mean worker coverage: **26.06%**;
- median worker coverage: only **4.76%**;
- mean pre-input executable production / plan: **25.78%**;
- mean post-input target / plan = actual output / plan: **16.44%**;
- workforce-capacity-below-50 share: **73.80%**;
- input-coverage-below-50 share: **41.19%**;
- first-loss classification:
  - **workforce capacity gap 73.80%**;
  - **input availability gap 9.90%**;
  - coherent execution 16.30%.

Therefore the R4-AC CONSUMER production-execution gap is not primarily an unknown residual and is not primarily finished-goods absorption. In this held-out seed, it is first and foremost a mismatch between the unconstrained production plan and the workforce actually present when production is executed.

## 4. CAPITAL sector

CAPITAL is less one-sided:

- mean current workers: **13.48**;
- mean physical workers required: **22.43**;
- mean worker coverage: **82.42%**;
- mean pre-input executable production / plan: **67.28%**;
- mean post-input output / plan: **41.62%**;
- first-loss classification:
  - workforce capacity gap **33.71%**;
  - input availability gap **26.59%**;
  - coherent execution **39.70%**.

CAPITAL therefore has a genuine mixed execution problem. Unlike CONSUMER, input availability is already a large co-equal secondary bottleneck.

## 5. Relation to earlier Y/Z evidence

R4-Y/Z showed that forcing staffing toward physical production need can sharply restore employment and output but generates very large wage arrears.

R4-AD now explains why that intervention had such a large real-output effect: canonical staffing leaves many plan-viable CONSUMER firms with far fewer workers than their own production plans require.

But the earlier arrears result remains binding. The correct repair cannot simply set workers equal to physical need because:

- RESOURCE has value product below wage;
- MATERIALS is often also value-product-infeasible;
- current realized contribution remains far below payroll;
- production-linked hiring without a financing/viability bridge creates unpaid payroll.

## 6. Updated causal chain

`independent bounded hiring target`
→ workforce << labor required by the firm's own production plan
→ desired production capped by labor capacity
→ low physical output
→ low realized contribution
→ payroll underfunding / arrears
→ restructuring / exit

At the same time:

`raising workers directly to physical need`
→ output/employment recovery
→ but payroll liabilities exceed sustainable realized contribution
→ arrears explosion

The model therefore contains a **two-sided labor coherence defect**:

- too little labor for the production plan;
- too much required payroll for the realized financial capacity.

## 7. Interim verdict

**PARTIAL PASS — HELD-OUT E CONFIRMS WORKFORCE/CAPACITY AS THE DOMINANT FIRST CONSUMER PRODUCTION-EXECUTION BOTTLENECK.**

Full R4-AD closure requires the remaining original/held-out and base/mode shards. No canonical repair is authorized.
