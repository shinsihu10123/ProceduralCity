# WP-RV07 — Cross-WP Structural Synthesis & Repair-Candidate Selection

Status: **P0 STOCK-FLOW SCALE AUDIT EXECUTION REQUESTED**
Date: 2026-08-19

## Frozen economic semantics

Economic Model Frozen Baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`.

Economic mechanism changes authorized in P0: **0**.
Parameter tuning authorized in P0: **0**.

## Admission

- WP-RV02: PASS — bounded baseline reproduction.
- WP-RV03: PASS — labor/goods causal decomposition.
- WP-RV04: PASS — firm distress/exit attribution.
- WP-RV05: PASS — GDP/NIA composition diagnosis.
- WP-RV06: PASS — finance/credit transmission diagnosis.

WP-RV07 is dependency-safe. However, repair implementation does **not** begin until P0 discriminates the remaining structural candidates.

## Why P0 is required

WP-RV03 established persistent household-goods quantity rationing and showed that realized sales are supply constrained while firm decisions and learning use realized-sales-related demand signals. That supports a demand-observation censoring defect.

A separate structural candidate remains open: the initial stock/capacity scale may itself be inconsistent with household expenditure units. Initial firm finished-goods inventories and target inventories are created per firm, while household expenditure is generated per household. Before changing learning semantics, WP-RV07 must determine whether the shortage is already embedded in initial stock/production units, is created by input constraints, is materially depleted by government demand before household clearing, or emerges only through later feedback.

## P0 experiment

- scales: `compact`, `baseline`
- seeds: `ECON-RV02-A`, `ECON-RV02-B`, `ECON-RV02-C`
- horizon: 3 months
- runner: `economic-lab/scripts/stock-flow-scale-audit-v10.mjs`

The scale comparison is diagnostic. It is not a calibration target.

## Exact boundaries observed

The read-only runner records:

1. opening country/consumer-firm stock before month 1;
2. consumer physical inventory immediately before and after `SupplyChainSystem.produce`;
3. consumer physical inventory immediately before and after `GovernmentSystem.executeGovernmentDemand`;
4. the existing exact household goods-market diagnostic boundary: desired budget, opening inventory, closing inventory, unmet budget and stop reason;
5. household count, consumer-firm count, consumer workers/capacity, desired production and input shortage.

## Hard reconciliation gates

- exact observer non-interference at both scales;
- all health gates PASS;
- complete 2-scale × 3-seed × 3-month × 4-country coverage;
- physical consumer inventory added during production = consumer output;
- consumer-inventory value removed by government demand = recorded government consumption;
- post-government consumer inventory = exact household goods-market opening inventory;
- household desired budget = realized consumption + unmet budget.

## Repair-candidate admission rule

P0 does not authorize a repair merely because a ratio looks abnormal. Candidate admission follows evidence:

- If shortage exists already at opening and survives scale normalization, investigate stock/unit initialization semantics.
- If opening stock is adequate but production cannot replenish it, investigate production/input/capacity units.
- If government demand materially exhausts otherwise adequate consumer supply before households clear, investigate market ordering/allocation semantics.
- If physical supply is adequate but firms later interpret stockout-censored realized sales as weak demand, prioritize censored-demand observation/learning semantics.
- Multiple mechanisms may be admitted if the evidence shows distinct stages.

No coefficient will be tuned to target an unemployment or GDP path.
