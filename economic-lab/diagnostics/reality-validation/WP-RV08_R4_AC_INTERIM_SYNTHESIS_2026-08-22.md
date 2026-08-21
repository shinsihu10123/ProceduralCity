# WP-RV08 R4-AC — Revenue Realization Funnel Interim Synthesis

Date: 2026-08-22  
Status: PARTIAL — 11/12 ECONOMIC SHARDS COMPLETE  
Run: `32528698633`  
Executed source: `d92a41e73848a1cc02ae52f591de2f93a6166a59`  
Missing at this checkpoint: restructure / held-out E / CONSUMER  
Scope: canonical + restructure; original A/C + held-out E; CONSUMER + MATERIALS+CONSUMER; 18 months

## 1. Question

Among firms that are plan-economically viable, where is expected contribution lost?

`plan`
→ `actual output`
→ `inventory absorption / sales`
→ `realized operating contribution`
→ `payroll settlement`

The 50% stage gates are descriptive localization devices, not repair parameters or empirical calibration targets.

Permanent compact evidence:
`economic-lab/diagnostics/reality-validation/evidence/WP-RV08_R4_AC_REALIZATION_FUNNEL_COMPACT_PARTIAL_2026-08-22.csv`

## 2. Execution status

Eleven of twelve economic shards have completed successfully and passed all hard gates. The remaining `restructure / held-out E / CONSUMER` shard is runner-queued at this checkpoint; this is not an economic failure.

## 3. Decisive sector localization

### CONSUMER — overwhelmingly a production-execution gap

Across the 11 available cases:

- plan-viable share: **51.9–71.3%**;
- mean actual output / plan: **12.5–25.7%**;
- mean sales / available inventory: **68.6–93.3%**;
- production-execution classification: **73.8–91.7%**;
- inventory-absorption classification: only **0–0.3%**.

This sharply rejects the idea that plan-viable CONSUMER firms mainly fail because finished goods are produced and then cannot be sold. They generally fail **before** that point: actual output is only about one-eighth to one-quarter of planned production, while the inventory that does exist is absorbed relatively well.

**H-AC1 — CONSUMER realization failure is primarily finished-goods demand/absorption: FALSIFIED AS PRIMARY.**

**H-AC2 — CONSUMER realization failure is primarily production execution: STRONGLY SUPPORTED.**

### CAPITAL — production execution first, absorption second

Across the available cases:

- plan viability: **67.0–91.2%**;
- mean output / plan: **21.1–51.6%**;
- mean sales / available inventory: **17.0–39.4%**;
- production-execution classification: **48.6–83.5%**;
- inventory-absorption classification: **13.7–46.7%**.

CAPITAL therefore has a two-stage downstream defect. Production execution is the largest first failure, but even successfully available capital-goods inventory is often weakly absorbed. This justifies separate production-execution and investment-demand audits.

### MATERIALS — viable minority has both execution and absorption problems

MATERIALS plan viability is zero under CONSUMER-only normalization, so the realization funnel is only meaningful for the MATERIALS+CONSUMER normalized cases. There, only roughly 19–27% of rows become plan-viable. Within that viable minority both failures are visible:

- output / plan can remain below 50%;
- sell-through is extremely weak, roughly 11–19% on average in completed canonical M+C cases;
- production-execution and inventory-absorption classifications are both material.

## 4. Settlement is not the first-order funnel loss

For CONSUMER, explicit payroll-settlement-gap classification is approximately zero in the completed cases; CAPITAL's cash-contribution-gap classification is also tiny. Payroll coverage is poor, but primarily because sufficient contribution is never produced/realized in the first place.

This is consistent with earlier V/X findings: settlement institutions contain defects, but the current restructuring-arrears penalty is driven mainly by current operating shortfall, not by settlement sequencing alone.

## 5. Current causal frontier

The R4-AA → R4-AB → R4-AC chain now supports:

`RESOURCE`
→ intrinsic value-product below wage

`MATERIALS`
→ value-product problem
→ when normalized enough to become plan-viable:
   production-execution gap + downstream absorption gap

`CAPITAL`
→ plan economics mostly viable
→ production execution fails first
→ remaining inventory also has weak investment-market absorption

`CONSUMER`
→ plan economics near break-even / mixed
→ **dominant production-execution failure**
→ existing finished inventory generally sells much better than planned output is produced

## 6. Dependency-safe next step

R4-AD should decompose:

`desired production`
→ labor capacity
→ post-procurement input capacity
→ actual output

to determine whether the CONSUMER/CAPITAL production-execution failure is mainly insufficient labor capacity, insufficient physical input inventory, procurement timing/local availability, or another execution-stage constraint.

R4-AE should separately measure downstream demand/inventory absorption for MATERIALS and CAPITAL.

## 7. Interim verdict

**PARTIAL — PRODUCTION EXECUTION IS THE DOMINANT FIRST LOSS FOR CONSUMER AND CAPITAL; CAPITAL/MATERIALS ALSO SHOW SECOND-STAGE ABSORPTION DEFECTS.**

Final R4-AC closure awaits the last queued held-out E restructure/CONSUMER shard. No canonical repair is authorized.
