# WP-RV08-R4-CJ — Firm Unit-Scale / Payroll Burden / Break-Even Coherence Audit

Date: 2026-08-28
Mode: shadow diagnostic only
Canonical mutation: forbidden

## Objective

R4-CI established a stable cross-seed gap between settlement-native operating inflow (~3.5–3.7 per active firm-month) and realized payroll outflow (~301–315). R4-CJ tests whether this is a coherent economic outcome caused by low sales/productivity, or a unit-scale mismatch among wages, prices, worker counts, output, and sales.

## Questions

For every active firm-month, measure:

1. How many product units must be sold at the observed firm price to cover actual payroll settlement?
2. How many product units must be sold to cover the nominal payroll obligation `workers × wage`?
3. How do those break-even quantities compare with actual sales, output, desired production, and inventory?
4. Is the deficit mainly explained by insufficient physical output, weak sell-through, or a wage/price scale mismatch?
5. Does the pattern differ by industry and country?

## Core measures

- `actualPayrollOut`: settlement-native `wage` outflow.
- `nominalPayrollObligation`: `workers × wage`.
- `operatingRevenue`: settlement-native goods + B2B + capital-goods inflow.
- `observedPrice`: canonical firm price after the monthly step.
- `salesUnits`, `outputUnits`, `desiredProduction`, `inventoryUnits`.
- `actualPayrollBreakEvenUnits = actualPayrollOut / observedPrice`.
- `nominalPayrollBreakEvenUnits = nominalPayrollObligation / observedPrice`.
- `salesCoverageOfActualPayroll = salesUnits / actualPayrollBreakEvenUnits`.
- `outputCoverageOfActualPayroll = outputUnits / actualPayrollBreakEvenUnits`.
- `salesCoverageOfNominalPayroll = salesUnits / nominalPayrollBreakEvenUnits`.
- `revenuePerWorker = operatingRevenue / workers`.
- `wageToPriceRatio = wage / observedPrice`, interpretable as product units per worker required to cover one wage before inputs, taxes, financing, and profit.

## Diagnostic classifications

A firm-month may receive multiple flags:

- `PHYSICAL_OUTPUT_INSUFFICIENT`: output units below actual-payroll break-even units.
- `SELL_THROUGH_INSUFFICIENT`: output could cover payroll at current price but realized sales cannot.
- `NOMINAL_PAYROLL_SCALE_STRESS`: nominal payroll break-even units far exceed desired production or output.
- `PRICE_WAGE_SCALE_STRESS`: wage/price ratio is very large relative to realized per-worker sales units.
- `OPERATING_REVENUE_COVERS_PAYROLL`: operating revenue >= actual payroll settlement.
- `ZERO_OR_NEAR_ZERO_OPERATIONS`: negligible output and sales.

Threshold-dependent flags are descriptive only; raw ratios remain authoritative.

## Hard gates

- exact canonical replay
- exact diagnostic replay
- no mutation by audit
- hard accounting health
- exact firm-account cash reconciliation
- all computed break-even values finite/non-negative where defined
- observations present across all four countries

## Decision rule

If break-even unit requirements consistently exceed both actual output and desired production by orders of magnitude across original and heldout seeds, prioritize a canonical unit-scale / wage-price-output consistency review before any financing repair.

If physical output could cover payroll but sales cannot, prioritize demand/sell-through/market-clearing diagnostics.

If sales and output could cover payroll in units but settlement revenue still cannot, inspect price formation and settlement valuation.

No canonical parameter or mechanism change is authorized by R4-CJ alone.
