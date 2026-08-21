# WP-RV08 R4-AD — Production Execution Decomposition Closure

Date: 2026-08-22  
Status: **PASS — WORKFORCE-CAPACITY FIRST LOSS CONFIRMED FOR CONSUMER / NO CANONICAL REPAIR AUTHORIZED**  
Run: `32532999902`  
Executed source: `1a3344cc4a6c46bc0fe2f18366959c78d0a72a5f`  
Scope: canonical + diagnostic restructure; original A/C + held-out E; CONSUMER + MATERIALS+CONSUMER normalization; 18 months

## 1. Question

R4-AC showed that plan-economically viable CONSUMER and CAPITAL firms lose most of the plan before revenue realization. R4-AD decomposes that execution loss into:

1. workforce/capacity limitation before procurement;
2. input-availability limitation after procurement;
3. residual execution loss after both constraints.

This is a read-only diagnostic. No wage, hiring, price, credit, tax, settlement or exit parameter is calibrated here.

## 2. Execution gate

The workflow completed successfully. All 12 economic shards produced artifacts and passed health, ledger, general-accounting, GDP-arithmetic, normalization, row-coverage and finite-result gates.

Permanent compact evidence:
`economic-lab/diagnostics/reality-validation/evidence/WP-RV08_R4_AD_PRODUCTION_EXECUTION_COMPACT_2026-08-22.csv`

## 3. CONSUMER — decisive result

Across all 12 seed/base/mode cases, among plan-economically viable CONSUMER observations:

- plan-viable share: **51.9–71.3%**;
- mean actual workers: **6.62–10.79**;
- mean physical workers required by the unconstrained demand/inventory plan: **29.96–31.82**;
- mean worker coverage of physical need: **19.5–31.2%**;
- median worker coverage: **4.5–17.5%**;
- actual output / unconstrained plan: **12.5–25.7%**;
- workforce-capacity classified as first loss: **67.3–86.5%**;
- input-availability classified as first loss: **1.6–9.9%**;
- coherent execution: only **9.1–27.7%**.

The held-out E canonical / CONSUMER shard reproduces the same structure: roughly 8.5 actual workers against 30.8 physical-plan workers, mean worker coverage 26.1%, median coverage 4.8%, workforce-first 73.8%, and input-first 9.9%.

**H-AD1 — CONSUMER plan execution is primarily lost because current workforce/capacity is far below the labor implied by the demand/inventory production plan: STRONGLY SUPPORTED.**

**H-AD2 — CONSUMER plan execution is primarily lost at procurement/input availability after adequate labor capacity exists: FALSIFIED AS PRIMARY.**

Input shortages remain real and can be complementary, but they are not the dominant first loss in this matrix.

## 4. CAPITAL — mixed execution bottleneck

CAPITAL remains mostly plan-economically viable, but execution is mixed rather than purely labor-bound:

- plan-viable share: **67.0–91.2%**;
- output / plan: **21.1–51.6%**;
- workforce-first share: **26.8–53.4%**;
- input-first share: **20.1–45.1%**;
- coherent execution: **16.8–52.1%**.

Therefore CAPITAL's pre-revenue failure is a combination of labor-capacity and processed-material availability, consistent with R4-AC's finding that production execution is its first major loss.

## 5. MATERIALS

Without MATERIALS normalization, MATERIALS has no plan-viable rows, matching the upstream value-product failure already closed in R4-AB.

Under MATERIALS+CONSUMER normalization, the viable minority is only **19.4–26.7%** of observations. Within that minority:

- worker coverage is about **60.1–79.5%**;
- output / plan is about **29.1–48.6%**;
- workforce-first and input-first losses are both material;
- coherent execution reaches roughly **28.8–56.5%**.

This preserves the layered diagnosis: MATERIALS first has an upstream unit-economics defect, and even after diagnostic normalization still carries execution/supply limitations.

## 6. Causal integration

The strongest current CONSUMER chain is now:

`demand/inventory production plan`
→ `physical labor requirement ~30 workers`
→ `canonical actual workforce ~7–11 workers`
→ `capacity-capped production ~12–26% of plan`
→ `revenue realization far below planned contribution`
→ `current payroll under-coverage`
→ `wage arrears`
→ `recurrent restructuring / liquidity-driven exit`

This does **not** authorize simply hiring to the physical requirement. R4-Y/Z already showed that production-linked staffing can restore employment/output while exploding current-worker wage arrears. The remaining causal question is therefore why the canonical labor target stays far below physical need, and whether the gap is created by target formation or by labor-market matching/transition speed.

## 7. Verdict

**PASS — CONSUMER PRODUCTION EXECUTION LOSS IS DOMINATED BY WORKFORCE/CAPACITY UNDER-ALIGNMENT; CAPITAL IS MIXED WORKFORCE+INPUT; INPUT SHORTAGE IS SECONDARY FOR CONSUMER.**

Next dependency-safe diagnostic: decompose canonical labor-target formation versus labor-market fulfillment and compare the target-adjustment speed with the four-month distress/exit window.