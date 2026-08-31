# WP-RV08 R4-CU-D3D Post-B6-S2 Next-Stage Bootstrap v0.1

## Decision status

**PREREGISTERED CONDITIONAL ROUTE / NO RESULT-DEPENDENT RETUNING / CANONICAL MUTATION NOT AUTHORIZED**

## Purpose

This bootstrap starts exactly one dependency-safe front after the authoritative B6 Stage-2 heldout result is available.

- If B6-S2 identifies at least one replicated candidate, start **R4-CU-D3D-B6-S3 long-horizon integrity and persistence bootstrap**.
- If B6-S2 identifies no replicated candidate, start **R4-CU-D3D-B7 structural-diagnosis baseline bootstrap**.

The router may read an aggregate committed to the repository or download the latest successful B6-S2 authoritative aggregate artifact. It may not reinterpret, relax or alter the B6-S2 decision.

## Frozen route rule

### S3 route

The S3 bootstrap uses:

- canonical control `V1_M1_C42`;
- exactly one primary candidate selected by the frozen B6-S2 aggregate;
- fresh seeds `ECON-RV08-LONGRUN-G` and `ECON-RV08-LONGRUN-H`;
- 36 months per candidate/seed;
- 2 candidates × 2 seeds = 4 jobs;
- exact replay, hard accounting, protected-surface and reconstruction gates inherited from B6;
- no economic admission decision at this bootstrap stage.

This is a long-horizon integrity and persistence bootstrap. A separate S3 closure must freeze any subsequent stress scenarios and economic persistence thresholds before those tests run.

### B7 route

The B7 bootstrap uses:

- canonical control only;
- fresh seeds `ECON-RV08-LONGRUN-G` and `ECON-RV08-LONGRUN-H`;
- 36 months per seed;
- exact replay, hard accounting and reconstruction gates;
- output retained as the canonical long-horizon baseline for demand–inventory topology and value-transformation diagnosis.

No B6 candidate may be retuned or substituted into the B7 route.

## Immutable boundaries

The bootstrap does not authorize changes to:

- canonical productivity or input coefficients;
- prices, wages, opening cash, wealth or desired budgets;
- procurement coefficients or goods-market rules;
- bank underwriting, trade credit, taxes or fiscal rules;
- B6-S2 candidate selection, heldout results or thresholds.

## Failure handling

A missing, technically failed or ambiguous B6-S2 aggregate causes the router to fail closed. It must not guess a route. A failed S3 or B7 bootstrap is an implementation or integrity failure, not an economic result.
