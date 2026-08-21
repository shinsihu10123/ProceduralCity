# WP-RV08 R4-AE — First Completed Shards Synthesis

Date: 2026-08-22  
Status: PARTIAL / RUNNING  
Run: `32533167414`  
Executed source: `e644c8c0cb020a74c03a5a6bc747cbcf98e3d886`  
Completed at this checkpoint:
- canonical / original C / CONSUMER
- restructure / original A / MATERIALS+CONSUMER

All hard gates passed in both completed shards.

## 1. Purpose

R4-AE asks whether weak upstream/intermediate/capital-goods absorption is caused primarily by:

1. insufficient downstream physical demand;
2. buyer cash-budget insufficiency;
3. market execution failure despite inventory, need and budget;
4. in the capital-goods market, insufficient investment eligibility/demand.

This is read-only diagnostic instrumentation.

## 2. Important metric caution

Per-country-month ratios such as `need / inventory`, `potential investment units / inventory`, and `sales / inventory` can become numerically very large when the denominator is near zero. Therefore the **arithmetic mean of those ratio fields is not used as causal evidence** at this checkpoint.

The first-shard interpretation relies instead on:

- finite hard-gate status;
- classification shares based on the pre-defined stage conditions;
- median ratios where useful;
- inventory/need levels;
- buyer-budget coverage only as a supporting signal.

A later closure should preserve robust aggregate numerator/denominator ratios if the denominator instability matters for final reporting.

## 3. Canonical original C / CONSUMER base

### raw material market

72 country-month observations:

- `downstream_demand_low`: **79.17%**;
- `coherent_b2b`: 13.89%;
- `buyer_budget_gap`: 4.17%;
- `market_execution_gap`: 2.78%.

Mean buyer-budget coverage is above one, while the median downstream need/inventory ratio is only about 0.17. The first evidence therefore points much more strongly to **weak downstream material requirement relative to available raw-material inventory** than to a generic cash-budget or matching failure.

### processed material market

72 observations:

- `downstream_demand_low`: **45.83%**;
- `coherent_b2b`: 41.67%;
- `market_execution_gap`: 12.50%;
- no material buyer-budget-gap share in this shard.

The processed-material market is less one-sided than raw materials, but weak downstream requirement is still the single largest class.

### capital goods market

72 observations:

- `investment_demand_low`: **83.33%**;
- `coherent_investment`: 16.67%.

This is an early strong signal that CAPITAL's R4-AC absorption loss may be driven substantially by the investment-demand/eligibility architecture rather than seller-side search alone.

## 4. Restructure original A / MATERIALS+CONSUMER base

### raw material market

- `downstream_demand_low`: **73.61%**;
- `coherent_b2b`: 20.83%;
- `buyer_budget_gap`: 4.17%;
- `market_execution_gap`: 1.39%.

### processed material market

- `downstream_demand_low`: **80.56%**;
- `coherent_b2b`: 15.28%;
- `market_execution_gap`: 4.17%;
- buyer-budget gap: 0%.

### capital goods market

- `investment_demand_low`: **100%**.

The same qualitative direction persists after restructuring and MATERIALS+CONSUMER normalization: abundant seller inventory frequently faces too little effective downstream requirement, while buyer-budget and generic market-execution classes are much smaller.

## 5. Interim causal interpretation

These first two shards support the following diagnostic lead:

`CONSUMER/CAPITAL production execution weakness`
→ weak downstream demand for processed inputs / capital expansion
→ intermediate and capital-goods inventory accumulates relative to buyer requirements
→ upstream realized revenue remains low despite physical inventory availability

This can coexist with the previously confirmed upstream value-product defect. In other words, the model may simultaneously contain:

- **RESOURCE/MATERIALS unit-economics infeasibility**, and
- **endogenous downstream-demand starvation** created by weak execution and investment demand.

The first AE results do **not** support a generic buyer-cash-budget explanation as the dominant absorption root in these two shards.

## 6. Capital-market architecture lead

The canonical investment market requires:

- a non-CAPITAL buyer;
- expansion signal (`currentPlan.selected === '확장'` or utilization > 0.88);
- cash >= `safeCash × 0.72`;
- investment budget limited to `min(cash × 0.055, safeCash × 0.18)`;
- requested purchase above the minimum transaction threshold.

R4-AE's 83–100% `investment_demand_low` classification in the first two shards makes these eligibility/demand conditions a strong next object of decomposition if the pattern replicates.

## 7. Interim verdict

**PARTIAL — DOWNSTREAM DEMAND/ELIGIBILITY STARVATION IS THE LEADING ABSORPTION MECHANISM IN THE FIRST TWO SHARDS; BUYER BUDGET AND GENERIC MARKET EXECUTION ARE SECONDARY SO FAR.**

No canonical repair is authorized. Full closure requires the remaining original/held-out, canonical/restructure and normalization matrix, with care around near-zero-inventory ratio summaries.
