# WP-RV08 R4-CO — Labor-Cost Embedding / Price Adequacy / Cost-Recovery Audit

Date: 2026-08-28
Mode: DIAGNOSTIC ONLY / NO CANONICAL MUTATION
Dependency: R4-CN CLOSED

## Objective

Determine whether the persistent ~85–88x firm productive-value gap is causally consistent with a specific canonical accounting/pricing disconnect:

1. monthly wage accrual is capitalized into finished-goods inventory,
2. `bookUnitCost` therefore embeds labor cost,
3. product prices are not explicitly cost-anchored,
4. canonical prices may remain far below the inventory cost required for labor-cost recovery.

R4-CO must distinguish this from generic low demand, generic low productivity, or arbitrary unit scaling.

## Canonical mechanism under test

`AccountingSystem.accrueMonthlyWages()` posts firm wage accrual as:

- debit `inventory`
- credit `wages_payable`

and recomputes `f.bookUnitCost = inventoryBook / inventory`.

Initial `bookUnitCost` is only `price * 0.42`; after wage accrual it can rise with labor cost.

Firm `price` is initialized from country initial price × industry multiplier and later changed by behavioral price adjustments. No explicit canonical rule requires price to cover `bookUnitCost`.

## Required observations per active firm-month

- canonical price
- canonical bookUnitCost after monthly close
- output, sales, inventory
- workers and firm wage
- settlement-native payroll outflow
- accounting-native production labor accrual
- operating revenue settlement inflow
- estimated current-month labor cost per produced unit = labor accrual / output when output > 0
- price/bookUnitCost
- price/current labor cost per output unit
- full-sell-through revenue at canonical price = output × price
- full-sell-through payroll coverage = output × price / payroll
- full-sell-through labor-accrual coverage = output × price / production labor accrual
- realized revenue / payroll
- realized revenue / production labor accrual

## Classification flags

- `PRICE_BELOW_BOOK_COST`: price < bookUnitCost
- `PRICE_SEVERELY_BELOW_BOOK_COST`: price/bookUnitCost < 0.25
- `PRICE_BELOW_CURRENT_LABOR_COST_PER_UNIT`: output > 0 and price < labor accrual/output
- `FULL_SELLTHROUGH_CANNOT_COVER_PAYROLL`: output×price < settlement payroll
- `FULL_SELLTHROUGH_CANNOT_COVER_LABOR_ACCRUAL`: output×price < labor accrual
- `REALIZED_REVENUE_CANNOT_COVER_PAYROLL`
- `ZERO_OUTPUT_WITH_LABOR_ACCRUAL`
- `COST_RECOVERY_PLAUSIBLE`

## Cohorts

Report by:

- country
- industry
- consumer-facing vs non-consumer-facing

## Hard gates

- no canonical mutation by audit
- exact diagnostic replay
- exact canonical replay
- hard accounting health
- exact firm settlement reconciliation at observation level
- finite positive cost metrics when denominators are positive
- observations present
- all countries observed
- all industries observed

## Decision logic

### Case A — price/book cost is persistently far below one across original + heldout
Then the wage-price-quantity mismatch has a concrete accounting transmission: labor cost is capitalized but product price does not recover it. Next front should design a **shadow cost-recovery pricing contract** and test it jointly with household purchasing-power and inflation effects. Canonical price mutation remains locked.

### Case B — bookUnitCost is not materially above price but labor-accrual/output is
Then inventory accounting may be diluting or carrying labor costs in a way that masks current production economics. Next inspect inventory-flow valuation and COGS recognition.

### Case C — full sell-through at price covers labor accrual but realized revenue does not
Then sell-through/market-clearing remains causal despite earlier aggregate demand evidence; inspect allocation and inventory timing.

### Case D — full sell-through cannot cover payroll/labor accrual
Then current price/output relation is structurally non-viable independent of sales allocation. This would be strong evidence for cost/price/unit-contract repair before trade credit, banking, or labor switching.

## Mutation policy

R4-CO is observational only. It does not authorize changing canonical prices, wages, production, accounting, demand, banking, supply chain, or fiscal behavior.
