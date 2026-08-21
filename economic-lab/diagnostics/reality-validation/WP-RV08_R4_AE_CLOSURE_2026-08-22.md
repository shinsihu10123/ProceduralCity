# WP-RV08 R4-AE — Downstream Demand / Inventory Absorption Audit Closure

Date: 2026-08-22  
Status: **PASS — DOWNSTREAM DEMAND WEAKNESS CONFIRMED; BUYER-CASH / MARKET-EXECUTION ROOT DOWNGRADED**  
Run: `32533167414`  
Executed source: `e644c8c0cb020a74c03a5a6bc747cbcf98e3d886`  
Scope: canonical + diagnostic restructure; original A/C + held-out E; CONSUMER + MATERIALS+CONSUMER normalization; 18 months

## 1. Question

R4-AE asks why upstream and capital-goods inventory is weakly absorbed after production-side defects are partially normalized. It separates:

1. low downstream physical requirement / investment appetite;
2. insufficient buyer cash budget;
3. market-execution failure despite demand and budget support.

This is a read-only diagnostic. It does not increase budgets, force transactions, change prices, or alter the investment rule.

## 2. Execution gate

The workflow completed successfully. All 12 economic shards produced artifacts and passed health, ledger, accounting, GDP-arithmetic, normalization, market-row and finite-result gates.

Permanent compact evidence:
`economic-lab/diagnostics/reality-validation/evidence/WP-RV08_R4_AE_DOWNSTREAM_ABSORPTION_COMPACT_2026-08-22.csv`

## 3. Raw materials

Across all 12 cases:

- median downstream need / seller inventory: **0.071–0.536**;
- downstream-demand-low classification: **45.8–100%**, mean about **74.5%**;
- buyer-budget-gap classification: **0–13.9%**, mean about **5.0%**;
- market-execution-gap classification: **0–13.9%**, mean about **3.9%**.

Buyer budget coverage is generally greater than one on the audit's value measure, while physical downstream requirement is often small relative to available upstream inventory.

**H-AE1 — raw-material non-absorption is primarily caused by downstream requirement being weak relative to inventory: STRONGLY SUPPORTED.**

**H-AE2 — raw-material non-absorption is primarily a buyer-cash-budget failure: FALSIFIED AS PRIMARY.**

## 4. Processed materials

Across all 12 cases:

- median downstream need / inventory ranges from roughly **0.099 to 2.263**;
- downstream-demand-low classification: **36.1–80.6%**, mean about **55.9%**;
- buyer-budget-gap classification: **0–1.4%**, mean about **0.2%**;
- market-execution-gap classification: **0–18.1%**, mean about **6.1%**.

Processed materials therefore show more variation than raw materials, but cash-budget failure is almost absent in this matrix. Weak downstream production need remains the largest repeated classification, with some genuine market-execution friction in selected shards.

## 5. Capital goods

Capital-goods absorption is even clearer:

- roughly half of non-CAPITAL firms can satisfy the audit's eligibility screen on average, but the potential quantity demanded remains small relative to capital-goods inventory;
- investment-demand-low classification: **83.3–100%**, mean about **96.5%**;
- investment-market-execution-gap: **0–1.4%**, mean about **0.1%**;
- coherent-investment classification averages only about **3.4%**.

The canonical investment market requires an expansion signal and cash at least `safeCash × 0.72`, then limits the investment budget to `min(cash × 0.055, safeCash × 0.18)`. R4-AE does not change those rules; it observes that the dominant failure is lack of effective expansion/investment demand rather than a transaction-clearing defect after adequate demand is present.

**H-AE3 — CAPITAL inventory fails mainly because the investment market cannot execute otherwise adequate investment demand: FALSIFIED AS PRIMARY.**

**H-AE4 — weak endogenous expansion/investment demand is the dominant capital-goods absorption problem: STRONGLY SUPPORTED.**

## 6. Measurement caution

When seller inventory is extremely close to zero, arithmetic ratios using inventory as a denominator can become very large. Therefore R4-AE closure does **not** use simple means of demand-to-inventory or sales-to-inventory ratios as decisive causal evidence. The closure relies primarily on:

- the predeclared absolute classification logic;
- median ratios;
- buyer budget coverage;
- cross-seed/base/mode replication.

No economic conclusion is inferred from denominator blow-ups.

## 7. Causal integration

R4-AD and R4-AE together support the following feedback structure:

`CONSUMER labor target far below physical plan need`
→ `consumer production under-execution`
→ `lower realized demand for processed inputs and capital expansion`
→ `weak MATERIALS / CAPITAL absorption`
→ `lower upstream realized revenue`
→ `payroll/liquidity stress`
→ `restructuring / exit`
→ `further labor and demand destruction`

This does not mean all upstream demand weakness is secondary; RESOURCE and much of MATERIALS also carry independent value-product defects from R4-AB. The model therefore contains interacting upstream unit-economics defects and downstream labor/production-demand feedback.

## 8. Verdict

**PASS — RAW/PROCESSED INPUT ABSORPTION IS MORE OFTEN DEMAND-CONSTRAINED THAN CASH-BUDGET-CONSTRAINED; CAPITAL GOODS ARE OVERWHELMINGLY INVESTMENT-DEMAND-CONSTRAINED RATHER THAN MARKET-EXECUTION-CONSTRAINED.**

Next dependency-safe diagnostic: determine whether CONSUMER's severe workforce deficit originates primarily in canonical target formation or in labor-market matching, and test whether the bounded ±10/12% staffing transition can close the physical gap before the four-month distress/exit clock.