# WP-RV08-R4-CP Closure — 2026-08-28

## Verdict

**CLOSED / STATIC FIRM-VALUE EQUIVALENCE CONFIRMED / PRICE REPRICING CAUSES LARGE NOMINAL PURCHASING-POWER DISTORTION / CANONICAL MUTATION NOT APPROVED**

Authoritative run: `33162490424`
Head: `907b7cdd6cabed6238a2bea95c5f05d4a67d8519`
Matrix: Original A, Original C, Heldout E, Heldout F — all SUCCESS; final beacon SUCCESS.

## Gate result

All four seeds passed replay, accounting-health, no-mutation, finite-transform, four-country/four-industry coverage, and P1/Q1 firm-value-equivalence gates.

## Repeated quantitative result

Median cost-equivalent scale (`bookUnitCost / price`) was approximately:

- Original A: 95.38x
- Original C: 95.62x
- Heldout E: 97.65x
- Heldout F: 98.10x

Under both P1 (`price := bookUnitCost`) and Q1 (same shadow productive-value expansion through quantity/bundle side), firm-level productive value is identical to floating-point precision. Median payroll coverage becomes approximately 1.005 in all seeds; payroll-covered share rises to roughly 77.6%–80.4% overall and about 90% for consumer firms.

However, P1 changes nominal household purchasing power materially. Median P1 purchasing-power multiplier was only about 0.0109–0.0120 in the four seeds, i.e. a roughly 83x–92x reduction in purchasing power for months where the repriced consumer basket is observed. This is a stock/flow consequence of changing prices while leaving nominal household stocks and wages unchanged.

The shadow demand/capacity ratios under P1 and Q1 are numerically identical because both were constructed to deliver the same shadow productive value. This is static algebraic equivalence, not proof that price repricing and real quantity/productivity changes are economically equivalent in a dynamic canonical world.

## Interpretation

R4-CP rejects a blind `price ≈ bookUnitCost` canonical patch. It would repair firm-value arithmetic while imposing a very large one-sided real-wealth shock unless all linked nominal stocks/flows were transformed consistently.

Q1 avoids the direct nominal purchasing-power distortion in this shadow representation, but Q1 must not be mislabeled a pure unit rename. If effective output is raised while nominal price is held fixed, the transformation behaves like a real productive-capacity/bundle change unless the complete quantity-unit contract (inventory, input coefficients, capacity, sales, trade, capital and accounting valuation) is transformed consistently.

Therefore R4-CP does **not** authorize either canonical repricing or canonical productivity scaling.

## Next gate

R4-CQ must test the dimensionless **real unit labor cost** invariant:

`RULC = wage / (price × capacity_per_worker)`

and related real-wage/productivity ratios. A common monetary numeraire rescaling and a consistent quantity-unit relabel cannot eliminate an excessive RULC. If RULC remains O(10^2), the defect is a genuine real calibration/technology inconsistency, not merely a naming or currency-unit problem.
