# WP-RV08 R4-AD / R4-AE — Execution Contract

Date: 2026-08-22
Status: EXECUTING / DIAGNOSTIC ONLY
Dependency: R4-AA sector split + R4-AB value-product decomposition + R4-AC realization funnel

## 1. Why these diagnostics now

R4-AA/AB/AC narrowed the production–revenue–payroll wedge into sector-specific mechanisms.

Verified frontier at launch:

- RESOURCE: one-worker net value product remains below wage; this is intrinsic plan-economics infeasibility at the tested transformed basis.
- MATERIALS: normalization improves unit economics but leaves both value-product shortfall and weak realization.
- CAPITAL: plan economics are usually viable, but actual plan execution and investment absorption are both weak.
- CONSUMER: plan-viable firms generally lose most of the plan before actual output; finished inventory sell-through is comparatively high.

The next diagnostic question is therefore not whether there is a wedge, but **where the remaining plan-to-output and inventory-to-sale losses occur operationally**.

## 2. R4-AD — Production Execution Decomposition

Question:

Among plan-economically viable firms, how much of

`unconstrained production plan -> actual output`

is lost because of:

1. actual workforce / physical capacity;
2. post-procurement input availability;
3. another production-stage discrepancy after those two constraints?

Read-only chain:

`unconstrained plan`
-> `actual workforce physical capacity / canonical desiredProduction`
-> `pre-input achievable target`
-> `post-procurement input-constrained target`
-> `actual output`.

Key metrics:

- actual workers;
- physical workers required by the unconstrained plan;
- worker coverage;
- pre-input target / plan;
- input inventory coverage after procurement;
- post-input target / plan;
- actual output / plan;
- actual output / post-input target;
- canonical supply shortage.

Descriptive classifications:

- `workforce_capacity_gap`;
- `input_availability_gap`;
- `other_execution_gap`;
- `coherent_execution`.

Thresholds are diagnostic localization thresholds only, not targets or calibration parameters.

Workflow:
`.github/workflows/economic-lab-rv08-r4-ad-production-execution.yml`

Script:
`economic-lab/scripts/rv08-production-execution-decomposition-v10.mjs`

Scope:
- canonical + diagnostic restructure;
- original A/C + held-out E;
- CONSUMER + MATERIALS+CONSUMER normalization bases;
- 18 months;
- 12 independent economic shards.

## 3. R4-AE — Downstream Demand / Inventory Absorption Audit

Question:

Where upstream sell-through is weak, is the cause:

1. insufficient downstream real requirement;
2. buyer liquidity / canonical budget support;
3. market execution despite sufficient need and budget;
4. for capital goods, canonical investment eligibility / budget architecture?

### B2B raw/processed material chain

Before procurement:

- seller physical inventory;
- downstream net input requirement;
- supplier price;
- buyer canonical procurement budget (`cash * 0.42`);
- downstream demand / inventory;
- budget coverage of downstream need value.

After procurement:

- actual B2B units and revenue;
- remaining input shortage;
- sales / starting seller inventory.

Descriptive classifications:

- `downstream_demand_low`;
- `buyer_budget_gap`;
- `market_execution_gap`;
- `coherent_b2b`.

### CAPITAL investment-market chain

Before clearing:

- capital-good seller inventory;
- non-CAPITAL buyers;
- canonical expansion eligibility (`selected === '확장'` or utilization > 0.88);
- canonical cash threshold (`cash >= safeCash * 0.72`);
- canonical investment budget (`min(cash * 0.055, safeCash * 0.18)`);
- eligible buyer share;
- approximate potential units relative to inventory.

After clearing:

- actual capital-good sales and revenue;
- sales / starting inventory.

Descriptive classifications:

- `investment_demand_low`;
- `investment_market_execution_gap`;
- `coherent_investment`.

Workflow:
`.github/workflows/economic-lab-rv08-r4-ae-downstream-absorption.yml`

Script:
`economic-lab/scripts/rv08-downstream-absorption-audit-v10.mjs`

Scope:
- canonical + diagnostic restructure;
- original A/C + held-out E;
- CONSUMER + MATERIALS+CONSUMER bases;
- 18 months;
- 12 independent economic shards.

## 4. Shared hard gates

- diagnostic exact-runtime flag only; no production economic rule change;
- health PASS;
- ledger verification PASS;
- general accounting verification PASS;
- GDP arithmetic identity PASS;
- normalization activation PASS;
- required audit observations present;
- finite result metrics.

No repair-sufficiency criterion is encoded as a hard workflow gate.

## 5. Decision rules

### After R4-AD

- If `workforce_capacity_gap` dominates CONSUMER, combine this evidence with R4-Y/Z: production demand requires substantially more labor than canonical staffing provides, but pure production-linked hiring is financially inadmissible. The next repair candidate must therefore be a bounded production-linked labor/finance transition rather than a hard realized-cash cap.
- If `input_availability_gap` dominates, prioritize procurement sequencing / same-month intermediate availability / estate recycling before labor architecture.
- If both dominate by sector, preserve sector-specific causality rather than forcing one global labor rule.

### After R4-AE

- High downstream need + low budget coverage -> buyer liquidity/budget mechanism is material.
- High downstream need + sufficient budget + low sales -> market execution/search/timing remains causal.
- Low downstream need relative to inventory -> upstream sell-through weakness is induced by downstream capacity collapse.
- Low capital potential demand / inventory -> canonical investment eligibility and investment-budget architecture suppress capital-good realization.
- High potential demand but low actual capital sales -> investment-market execution is causal.

## 6. Governance

R4-AD and R4-AE are diagnostic interventions only.

They do not authorize changes to:
- wages;
- prices;
- productivity;
- labor demand;
- credit underwriting;
- procurement budget;
- investment eligibility;
- payroll settlement;
- restructuring or exit policy.

Canonical repair remains prohibited until the causal chain is closed and a repair candidate passes multi-seed, long-horizon, accounting, settlement and empirical-validity gates.
