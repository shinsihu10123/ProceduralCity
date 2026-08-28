# WP-RV08-R4-CP — Cost-Anchored Shadow Price / Bundle Counterfactual

Date: 2026-08-28
Status: DESIGNED / SHADOW ONLY / CANONICAL MUTATION LOCKED

## Objective

R4-CO confirmed that canonical prices are typically about 1% of book unit cost and that full sell-through at canonical price usually cannot recover labor accrual. R4-CP asks whether cost recovery is more coherently represented as a nominal price correction or as a product/bundle quantity reinterpretation once household affordability is included.

This is a causal-identification gate, not a calibration pass.

## Shadow families

For every active firm-month with positive output and book unit cost:

- **C0 Canonical**: price = canonical price, quantity = canonical output.
- **P1 Cost price**: shadow price = bookUnitCost; quantity unchanged.
- **P1.10 Cost+10%**: shadow price = 1.10 × bookUnitCost; quantity unchanged.
- **Q1 Cost-equivalent bundle scale**: canonical price retained; effective output units multiplied by `bookUnitCost / canonicalPrice`. This is algebraically equivalent for firm gross product value, but preserves household nominal unit price.

No family changes world state, ledger entries, RNG, firm prices, inventories, output, household deposits, or goods-market settlement.

## Required measurements

Firm side:

- canonical output value;
- P1 and P1.10 full-sell-through value;
- Q1 full-sell-through value;
- payroll and labor accrual coverage;
- required cost-equivalent scale;
- industry and consumer-facing cohorts.

Country/household side:

- household desired consumption budget;
- household deposits;
- consumer output and capacity;
- canonical consumer output value;
- P1 consumer output value;
- P1.10 consumer output value;
- Q1 effective consumer output value;
- desired-budget / supply-value ratio under each family;
- deposit purchasing-power distortion under P1/P1.10 relative to canonical;
- Q1 nominal purchasing-power preservation.

## Identification logic

P1 and Q1 intentionally deliver similar firm-side gross-value recovery if `bookUnitCost / price` is the operative missing scale. They differ in household semantics:

- P1 raises the nominal price of a canonical product unit, reducing the number of canonical units purchasable by a fixed nominal deposit stock.
- Q1 interprets one canonical output unit as an under-resolved bundle and expands effective quantity while leaving the nominal price unit unchanged.

If P1 resolves firm cost recovery but causes household affordability to collapse while Q1 preserves nominal household purchasing power and yields a more coherent demand/supply ratio, quantity/bundle ontology becomes the leading repair family.

If both remain economically incoherent, the defect is deeper than a single price-versus-bundle semantic split and the next gate must inspect household consumption-budget construction and product-unit semantics jointly.

## Hard gates

- exact canonical replay;
- exact diagnostic replay;
- accounting health;
- no canonical mutation by audit;
- finite nonnegative shadow transforms;
- P1/Q1 firm-value equivalence within numerical tolerance;
- all countries observed;
- all industries observed.

## Decision rule

R4-CP may rank semantic repair families. It may **not** mutate canonical pricing, output, wage, household budget, goods-market, accounting, or supply-chain code.
