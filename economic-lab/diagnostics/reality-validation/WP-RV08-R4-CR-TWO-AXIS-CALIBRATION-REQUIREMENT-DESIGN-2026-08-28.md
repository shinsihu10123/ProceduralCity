# WP-RV08-R4-CR — Two-Axis Calibration Requirement Gate

Date: 2026-08-28
Mode: shadow diagnostic only
Canonical mutation: forbidden

## Objective

R4-CQ established that the labor-cost/productive-value mismatch is a real, dimensionless calibration defect rather than a pure unit relabel problem. R4-CR tests whether correcting that first axis would be sufficient to reconcile the household-demand/consumer-capacity side of the economy.

The null hypothesis is:

> One real labor-value correction is enough; after correcting the consumer-sector real unit labor cost to approximately 1, household desired consumption demand is also brought near consumer productive capacity.

The alternative is:

> A material residual demand/capacity mismatch remains after the labor-value correction, proving that at least two independent calibration dimensions are required.

## Measurement contract

For each country-month:

1. Observe consumer-facing active firms with positive workers, price and capacity.
2. Compute firm consumer RULC:
   `rulc_i = wage_i / (price_i * capacityPerWorker_i)`.
3. Define the country-month labor-value correction factor `L` as median consumer RULC.
4. Compute canonical household desired-consumption budget `B` as the sum of household `desiredConsumptionBudget`.
5. Compute canonical consumer capacity value `V = Σ(price_i * capacity_i)`.
6. Compute canonical demand-capacity ratio `D0 = B / V`.
7. Compute the residual ratio after a generic RULC-neutralizing productive-value correction: `D1 = D0 / L`.

`D1` is intentionally family-neutral: price uplift by L or physical productive-value uplift by L produces the same static capacity-value denominator. R4-CR does not authorize either implementation.

A second required factor is `S = max(1, D1)`. This is the remaining independent household-demand/consumer-capacity correction after the labor-value axis is neutralized.

## Hard gates

- exact diagnostic replay;
- exact canonical replay;
- no canonical mutation;
- accounting health;
- finite positive observations;
- all four countries observed;
- original and heldout matrix execution;
- deterministic factor calculation.

## Diagnostic outputs

Across all country-months and by country:

- distribution of `L`;
- distribution of `D0`;
- distribution of `D1`;
- share of country-months with `D1 > 1`, `> 2`, `> 5`, `> 10`;
- distribution of `S`;
- correlation-free cohort ranges rather than fitted calibration.

## Decision rule

R4-CR declares **TWO-AXIS REQUIREMENT CONFIRMED** if, in every seed:

1. median `L` is materially above 1;
2. median `D1 > 2`; and
3. at least 50% of country-months have `D1 > 2`.

Otherwise the two-axis hypothesis remains unresolved and no canonical mutation is authorized.

## Interpretation boundary

Passing R4-CR would not tell us whether the first axis should be repaired by wage, price, productivity, or another structural contract. Nor would it tell us how the second household-demand axis should be repaired. It only establishes dimensional independence of the two mismatches.

## Next step if confirmed

Construct a Semantic Anchor Register that explicitly assigns intended meanings and external/empirical targets to:

- monthly wage purchasing power;
- consumer bundle size;
- physical productivity per worker-month;
- product unit price;
- household monthly consumption propensity/budget;
- firm cost-recovery margin.

Only after those anchors exist can a canonical repair family be selected without arbitrary tuning.
