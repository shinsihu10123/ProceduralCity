# WP-RV08-R4-CM — Common Normalization Identification Gate

## Objective

Determine whether one scalar normalization factor can simultaneously reconcile the model's firm payroll/productive-value scale and household desired-budget/consumer-capacity scale without mutating canonical behavior.

## Read-only ratios

For each active firm-month with positive payroll and capacity value:

- `firmRequiredFactor = payrollOut / (capacity * price)`
- `firmOutputRequiredFactor = payrollOut / (output * price)` when output is positive

For each country-month:

- `demandRequiredFactor = desiredConsumptionBudget / consumerCapacityValue`
- `outputDemandRequiredFactor = desiredConsumptionBudget / consumerOutputValue`

These are identification statistics only. They are not proposed calibration constants.

## Common-factor test

Construct log-scale distributions of `firmRequiredFactor` and `demandRequiredFactor` and report:

- median, P25, P75, P90;
- ratio of the two medians;
- overlap of their interquartile ranges;
- country and industry cohorts;
- candidate scalar factors drawn only from observed medians/geometric means.

For each candidate factor `k`, compute two shadow residuals:

- payroll residual share: fraction of payroll firm-months where `capacityValue * k < payrollOut`;
- demand residual ratio: median `desiredBudget / (consumerCapacityValue * k)`.

A scalar is considered structurally plausible only if it can reduce both dimensions toward order-one magnitudes across original and heldout seeds without making one side several orders of magnitude excessive.

## Interpretation

- If the required-factor distributions materially overlap and the same candidate range works in all four seeds, proceed to an explicit scalar normalization contract design.
- If firm and household required factors remain widely separated, reject scalar normalization and proceed to a multi-dimensional unit contract separating at least monetary wage/account units, physical product units, and productive service/value units.

## Hard gates

No canonical mutation, exact canonical replay, exact diagnostic replay, accounting health, cash reconciliation, finite positive factors, all countries and industries observed.

## Lock

No canonical economic coefficient or settlement rule changes in R4-CM.
