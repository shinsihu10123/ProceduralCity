# WP-RV08-R4-CK — Unit-Scale Factorial Shadow Normalization Audit

## Status

DESIGNED / SHADOW ONLY / CANONICAL MUTATION LOCKED

## Objective

R4-CJ established a reproducible scale incoherence among payroll, product prices, and physical quantities. R4-CK must determine which normalization families are mathematically capable of restoring firm payroll coverage and at what order of magnitude, without changing canonical world behavior.

This is **not** a calibration pass. It is a causal localization pass.

## Canonical baseline quantities

For each active firm-month collect from the unchanged canonical run:

- settlement-native operating revenue;
- actual wage/payroll settlement;
- canonical price;
- canonical sales units;
- canonical output units;
- canonical desired production;
- workers and wage;
- industry and country.

## Shadow factor families

Evaluate independent factors over the fixed grid `{1, 3, 10, 30, 100, 300}`.

### P — price/revenue denomination family

`shadowRevenue = canonicalOperatingRevenue * P`

Interpretation: asks what pure nominal price/revenue rescaling would be required if physical quantities and payroll remained unchanged.

### W — payroll denomination family

`shadowPayroll = canonicalPayroll / W`

Interpretation: asks what pure payroll/wage denomination rescaling would be required if revenue and quantities remained unchanged.

### Q — physical quantity-capacity family

Use canonical realized unit revenue where observable:

`unitRevenue = canonicalOperatingRevenue / canonicalSalesUnits`

Then:

`shadowRevenue_Q = canonicalOperatingRevenue + unitRevenue * canonicalUnsoldCapacity * (Q - 1)`

where the conservative capacity basis is bounded by canonical output and desired production. R4-CK must not invent sales beyond a reported physical envelope. Report both:

- realized-sales scaling diagnostic (`canonicalOperatingRevenue * Q`) as a pure algebraic upper sensitivity;
- capacity-bounded quantity diagnostic using canonical output/desired-production information.

The first is not economic authorization; it is an order-of-magnitude comparator.

## Required metrics

For every factor family and factor:

- payroll-coverage share;
- median revenue/payroll ratio;
- p25/p50/p75 ratio where available;
- country coverage shares;
- industry coverage shares;
- share of previously uncovered firm-months flipped to covered;
- minimum factor required for each firm-month, discretized to the tested grid plus `>300`;
- distribution of required factors.

Also report cross-family equivalence: because pure P and W transforms are algebraically symmetric for the revenue/payroll ratio, any difference in reported result indicates a harness defect.

## Hard gates

- no canonical mutation by audit;
- exact canonical replay;
- exact diagnostic replay;
- hard accounting health;
- exact cash reconciliation;
- all transform outputs finite and nonnegative;
- P/W symmetry exact within tolerance;
- factor monotonicity: coverage cannot decrease as P, W, or algebraic Q factor rises;
- all countries and industries observed.

## Decision rule

R4-CK may establish an **order-of-magnitude normalization requirement**, but it may not choose a canonical repair.

If P/W require approximately the same large factor and quantity coverage requires a similar order, proceed to a semantic-unit audit of household income/consumption capacity versus firm production units before any mutation.

If one family alone resolves the majority of firm-months at a low factor while the others require extreme factors, that family becomes the next targeted causal branch, still shadow-only.

If even 300x normalization fails broadly, the problem is not a simple scalar mismatch and the next step must inspect the production/market-accounting ontology itself.
