# WP-RV08-R4-CL — Closure

Date: 2026-08-28
Authoritative run: `33146405036`
Authoritative head: `721e990b6a925a045f3f81d3c235d4f3087d9322`

## Verdict

**CLOSED / PASS AS DIAGNOSTIC EVIDENCE / UNIT-ONTOLOGY MISMATCH CONFIRMED / CANONICAL MUTATION NOT APPROVED**

All four original/heldout matrix jobs passed deterministic replay, accounting, cash reconciliation, finite-value, country coverage, and industry coverage gates.

## Core evidence

Across Original A, Original C, Heldout E, and Heldout F:

- configured initial wage/price ratios are roughly `91–106` monetary units of wage per one priced output unit;
- median productive output value per worker is only about `0.56–0.61` while median capacity value per worker is about `0.90–0.95`;
- median wage / output-value-per-worker is about `106–112`;
- median wage / capacity-value-per-worker is about `98–99`;
- median firm payroll / output value is about `84–88`;
- median firm payroll / capacity value is about `84–87`;
- unit-ontology stress appears in about `90–91%` of active firm-months;
- at country-month level, desired household consumption budget exceeds consumer output value by roughly `269–387×` and consumer capacity value by roughly `494–954×` at the median;
- demand-not-scarce share is `1.0` and demand-scarcity-plausible share is `0.0` in all four runs;
- aggregate capacity value remains below aggregate payroll in every observed country-month (`capacityValueBelowPayrollShare = 1.0`).

Industry cohorts reproduce the same ordering. Capital goods are less extreme because of their higher configured price multiplier, while consumer firms exhibit the highest pervasive stress (~96–97% unit-ontology stress), but no industry is exempt.

## Causal interpretation

R4-CL rejects the hypothesis that weak firm revenue is primarily a shortage of household nominal demand. Household desired budgets are vastly larger than the nominal value of consumer productive capacity. The model instead places wages, product prices, and physical production quantities on mutually inconsistent scales.

This is consistent with the canonical construction: wages are initialized near `82–112`, prices near `0.9–1.06` before industry multipliers, while labor capacity is on the order of workers times productivity and modest capital/human-capital multipliers. A worker therefore produces physical quantities with nominal value near one monetary unit per month while the wage liability is near one hundred monetary units.

R4-CK already showed that a single arbitrary `100×` or `300×` price/payroll/quantity transformation does not broadly repair coverage. R4-CL strengthens this: the household-demand scale and firm payroll/productive-value scale are not even aligned to the same single factor.

## Locks

Do **not** canonically change wages, prices, productivity, output quantities, household budgets, payroll settlement, procurement, trade credit, banking limits, or accounting rules from R4-CL alone.

## Next dependency-safe question

R4-CM must identify whether any **single common normalization factor** can jointly reconcile:

1. firm payroll vs productive capacity value; and
2. household desired consumption budget vs consumer productive capacity value.

If no common factor exists across original and heldout seeds, the next design must be a multi-dimensional economic unit contract rather than scalar tuning.
