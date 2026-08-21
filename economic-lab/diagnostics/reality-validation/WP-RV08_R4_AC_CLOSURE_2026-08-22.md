# WP-RV08 R4-AC — Revenue Realization Funnel Closure

Date: 2026-08-22  
Status: PASS — 12/12 ECONOMIC SHARDS COMPLETE / FINAL BEACON QUEUED / NO CANONICAL REPAIR AUTHORIZED  
Run: `32528698633`  
Executed source: `d92a41e73848a1cc02ae52f591de2f93a6166a59`  
Scope: canonical + restructure; original A/C + held-out E; CONSUMER + MATERIALS+CONSUMER; 18 months

## 1. Question

Among firms that are plan-economically viable, where is expected contribution lost before it can support payroll?

`plan`
→ `actual output`
→ `finished/in-process inventory absorption`
→ `realized operating contribution`
→ `payroll settlement`

The 50% stage thresholds are diagnostic localization gates only. They are not empirical targets or repair parameters.

## 2. Execution status

All 12 economic shards completed successfully and generated artifacts. Health, ledger integrity, general accounting, GDP arithmetic identity, productive-normalization activation, plan-viable row coverage and finite-result gates passed on every economic shard.

The workflow `final-beacon` is still runner-queued at this checkpoint. This is an orchestration condition, not an economic failure.

Permanent by-sector evidence:
`economic-lab/diagnostics/reality-validation/evidence/WP-RV08_R4_AC_REALIZATION_FUNNEL_BY_SECTOR_FINAL_2026-08-22.csv`

## 3. CONSUMER — production execution is the dominant first loss

Across all 12 seed/base/mode cases, plan-viable CONSUMER rows show:

- plan viability: **51.9–71.3%**;
- mean actual output / plan: **12.5–25.7%**;
- mean sales / available inventory: **68.6–93.3%**;
- production-execution first-loss share: **73.8–91.7%**;
- inventory-absorption first-loss share: **0–0.31%**;
- cash-contribution-gap share: **0–0.31%**;
- payroll-settlement-gap share: **0–0.25%**.

The final previously missing held-out E / restructure / CONSUMER shard reproduces the same pattern:

- plan viability **52.0%** at the CONSUMER-sector level;
- output / plan **19.4%**;
- sales / available inventory **80.2%**;
- production-execution first loss **81.5%**;
- inventory-absorption first loss **0.16%**.

Therefore the CONSUMER realization failure is not primarily "goods are produced but cannot be sold." The dominant loss occurs before finished-goods demand becomes the main constraint: firms fail to physically execute their own production plan.

**H-AC1 — finished-goods demand/absorption is the primary CONSUMER realization root: FALSIFIED.**

**H-AC2 — production execution is the primary CONSUMER realization root: STRONGLY SUPPORTED.**

## 4. CAPITAL — production execution first, investment absorption second

Across the 12 cases, plan-viable CAPITAL rows show:

- plan viability **67.0–91.2%**;
- mean output / plan **21.1–51.6%**;
- mean sales / available inventory **16.5–39.4%**;
- production-execution first loss **48.6–83.5%**;
- inventory-absorption first loss **13.7–46.7%**.

CAPITAL therefore contains two downstream defects. Production execution is generally the first and largest loss, but investment-market absorption remains independently material after inventory exists.

This supports a dependency split:

1. R4-AD — explain the production-execution loss;
2. R4-AE — explain why available capital-goods inventory is weakly absorbed.

## 5. MATERIALS — upstream infeasibility remains primary, downstream defects appear in the viable minority

Under CONSUMER-only normalization, MATERIALS has zero plan-viable rows, consistent with R4-AA/R4-AB.

Under MATERIALS+CONSUMER normalization, only about **19.4–26.7%** of MATERIALS rows become plan viable. Within that minority:

- mean output / plan reaches roughly **45.1–48.6%**;
- mean sales / available inventory remains only roughly **11.4–18.8%**;
- production-execution and inventory-absorption first-loss classes are both material.

Thus MATERIALS has a layered problem:

`value-product / plan infeasibility`
→ for the minority made viable by normalization
→ `production execution + downstream absorption`.

## 6. RESOURCE — realization funnel is downstream of an already-closed upstream failure

RESOURCE has zero plan-viable rows in all AC cases. R4-AB already established that its net value product per worker remains below wage even at high plan utilization. No downstream realization explanation is needed to explain the first failure.

## 7. Settlement hypothesis

Explicit settlement-stage first-loss classifications remain negligible across the complete matrix. Payroll coverage is often poor, but that is predominantly because output/contribution never reaches a sufficient level before settlement.

This does not erase the independent former-worker claim-settlement defect found in R4-V/W. It means settlement sequencing is not the first-order explanation for the current production–payroll wedge.

## 8. Causal closure

R4-AA → R4-AB → R4-AC now establishes a sector-specific causal architecture:

`RESOURCE`
→ value product below wage
→ plan economics infeasible

`MATERIALS`
→ mostly value-product infeasible
→ normalization creates a viable minority
→ execution + absorption problems remain

`CAPITAL`
→ plan economics usually viable
→ production execution fails
→ investment absorption also weak

`CONSUMER`
→ plan economics often viable/near break-even
→ **production execution overwhelmingly fails first**
→ available finished inventory is comparatively well absorbed

## 9. Verdict

**PASS — REALIZATION ROOT LOCALIZED. CONSUMER FAILURE IS PRIMARILY PRODUCTION EXECUTION; CAPITAL IS PRODUCTION EXECUTION PLUS INVESTMENT ABSORPTION; MATERIALS IS LAYERED; SETTLEMENT IS DOWNGRADED AS FIRST LOSS.**

No canonical repair is authorized. R4-AD and R4-AE are the next dependency-safe causal audits.
