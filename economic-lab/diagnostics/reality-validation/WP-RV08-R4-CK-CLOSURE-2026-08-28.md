# WP-RV08-R4-CK Closure — Unit-Scale Factorial Shadow Audit

Date: 2026-08-28
Authoritative run: `33145913260`
Head: `0bf0c6fc0d63008e246ad6a3065ad26316260abb`

## Verdict

**CLOSED / PASS AS DIAGNOSTIC EVIDENCE / SIMPLE ONE-AXIS NORMALIZATION REJECTED**

Canonical price, wage, output, labor, procurement, banking and accounting behavior remains locked.

## Gate result

All four matrix cases (`ECON-RV02-A`, `ECON-RV02-C`, `ECON-RV08-HOLDOUT-E`, `ECON-RV08-HOLDOUT-F`) completed successfully. Every case passed exact canonical replay, exact diagnostic replay, accounting health, cash reconciliation, finite transform outputs, price/payroll algebraic symmetry, factor monotonicity, and country/industry observation coverage.

## Main evidence

The algebraic price-up (`P`), payroll-down (`W`) and unconstrained quantity-up (`Q_ALGEBRAIC`) families are intentionally symmetric and produced identical coverage curves. They show how large a pure nominal/quantity multiplier would need to be before observed operating revenue covers payroll.

At factor 100, coverage is still only approximately 23.5%–28.8% across the four seeds. At factor 300 it is only approximately 35.9%–41.7%. The share requiring more than 300× under the algebraic families remains approximately 58.3%–64.1%.

The physically bounded `Q_CAPACITY` branch barely improves coverage. At factor 100, coverage remains roughly 8.1%–11.4% depending on seed; at factor 300 it remains roughly 8.2%–11.5%. Approximately 88.5%–91.8% of payroll-bearing firm-months still require more than the physically available capacity envelope.

This sharply rejects a simple sell-through explanation. Merely assuming that currently feasible output/capacity is fully sold does not repair the operating-payroll relation.

Industry splits reinforce the structural result. A 100× algebraic transform often makes CAPITAL firms appear much more viable, but RESOURCE, MATERIALS and especially CONSUMER cohorts remain substantially uncovered. The physically bounded capacity branch remains weak in every industry.

## Interpretation

R4-CK does **not** identify a justified canonical multiplier. It shows that the mismatch is deeper than a single price, wage or sales-volume knob:

1. Current nominal wage scale is around two orders of magnitude larger than product prices.
2. Current production technology yields only a few product units per firm/worker scale.
3. Even selling the physically available capacity is insufficient for most payroll-bearing firms.
4. Therefore a one-axis 100× or 300× normalization would mask the dimensional inconsistency rather than explain it.

The next causal question is whether the model's **unit ontology** is internally coherent: what one unit of `wage`, `price`, `output`, `capacity`, household consumption budget, and firm payroll is supposed to represent, and whether aggregate household nominal demand is actually scarce relative to the nominal value of feasible consumer supply.

## Next gate

Proceed to **R4-CL — Unit Ontology / Productive Value / Aggregate Demand-Supply Scale Audit**. Quantify, without mutation:

- configured initial wage-to-price anchors;
- productive output value per worker at current price;
- payroll-to-current-output-value and payroll-to-capacity-value ratios;
- aggregate household desired consumption budget versus consumer output/capacity value;
- realized consumption versus desired budget;
- country and industry decomposition;
- whether low firm revenue is caused by insufficient nominal demand or by nominal productive-value scale being far below the wage bill.

No canonical scale correction is authorized by R4-CK alone.