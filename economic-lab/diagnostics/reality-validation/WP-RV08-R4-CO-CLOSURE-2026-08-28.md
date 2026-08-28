# WP-RV08-R4-CO Closure — Labor-Cost Embedding / Price Adequacy

Date: 2026-08-28
Authoritative run: 33148980397
Head: 6b622ebc958a96d9c4de874f17bd37491e336d8d
Mode: diagnostic only; canonical mutation locked

## Verdict

**CLOSED / PASS AS DIAGNOSTIC EVIDENCE / SYSTEMATIC COST-RECOVERY FAILURE CONFIRMED / CANONICAL PRICE MUTATION NOT YET APPROVED**

All four matrix seeds (Original A, Original C, Heldout E, Heldout F) and final beacon completed successfully. Replay, accounting, finite-metric, country-coverage and industry-coverage gates all passed.

## Reproducible result

Across all four seeds the median `price / bookUnitCost` is approximately 0.0102–0.0105. In other words, observed selling price is typically only about one percent of the accounting unit cost carried in finished inventory.

Median `price / laborCostPerOutput` is approximately 0.0089–0.0094. The same order-of-magnitude gap therefore appears even when focusing specifically on current-month labor cost per unit of output.

The following high-level failure shares repeat across original and heldout seeds:

- `priceBelowBookCostShare`: ~94.2–94.5%.
- `severePriceBelowBookCostShare`: ~93.2–93.3%.
- `priceBelowLaborCostPerUnitShare`: ~68.6–71.6%.
- `fullSellthroughCannotCoverPayrollShare`: ~61.8–64.9%.
- `fullSellthroughCannotCoverLaborAccrualShare`: ~94.2–94.5%.
- `realizedRevenueCannotCoverPayrollShare`: ~66.1–67.9%.
- `costRecoveryPlausibleShare`: only ~5.5–5.8%.

Consumer firms are the most extreme cohort. Their `priceBelowBookCostShare` is ~98.5–99.3% across the observed seeds, and their full-sell-through inability to cover payroll is commonly above ~84–88%.

## Interpretation

This materially strengthens the causal diagnosis from R4-CJ through R4-CN. The model does not merely have weak demand or poor sell-through. Labor compensation is capitalized into inventory accounting, but the realized firm price level is not operating at a scale remotely sufficient to recover that cost basis. Even a counterfactual in which all current output is sold at the canonical price fails to cover labor accrual for roughly 94% of active firm-month observations.

However, this still does **not** identify a safe canonical fix by itself. `bookUnitCost` inherits the current quantity ontology. Raising canonical prices directly to book cost could destroy household real purchasing power if the true defect is that one model output unit represents an under-scaled physical bundle. Conversely, multiplying quantity without addressing household consumption-budget semantics could preserve the existing demand-capacity mismatch.

Therefore R4-CO rejects a blind price-floor mutation and authorizes only a shadow cost-anchored pricing/bundle counterfactual.

## Artifact register

- Original A: artifact 9676924951, sha256:6def071032a66eaa570530cfae164f4825fdfe547be857c8a80509fe8b1206d2
- Original C: artifact 9676920042, sha256:732f515af8e55469bbae769bfe324bf70165d66e8fe74e99b0e60f85daea3043
- Heldout E: artifact 9676923608, sha256:e972089b7a1d6f5b60e20255cc2f0283984ecff739659cdf18938b3a3fbd1886
- Heldout F: artifact 9676926099, sha256:1b83bd114700eb8ccb83f4dc167c92ed4c5b5c7d111bc71a960bc12e967444cf

## Next gate

Proceed to **R4-CP — Cost-Anchored Shadow Price / Bundle Counterfactual**.

R4-CP must keep canonical world behavior unchanged and compare:

1. canonical price,
2. accounting-cost price (`bookUnitCost`),
3. modest markup over cost,
4. equivalent productive-bundle rescaling that preserves nominal price,
5. household affordability and desired-consumption coverage under each interpretation.

The decision question is whether the same accounting cost-recovery objective can be achieved more coherently through price-level repair or product/bundle-unit repair once household purchasing-power effects are included.
