# WP-RV08-R4-CS — Sectoral Relative Value Coherence Gate

Date: 2026-08-28
Mode: shadow diagnostic only
Canonical mutation: forbidden

## Question

R4-CQ established that aggregate real unit labor cost (RULC) is structurally excessive and invariant to pure monetary or quantity-unit relabeling. R4-CR established that even a first-axis labor normalization leaves a separate household demand/capacity defect.

R4-CS asks a narrower identification question before any empirical anchor is introduced:

> Can one common labor/productive-value correction factor apply across RESOURCE, MATERIALS, CAPITAL and CONSUMER industries, or are relative sector price/productivity/value relations themselves incoherent?

## Definitions

For each active firm-month with positive workers, wage, price and capacity:

`RULC_f = wage / (price * (capacity / workers))`

For each country-month and industry `i`, compute the median firm RULC:

`R_i`

Use the CONSUMER industry as a purely internal reference, not an empirical target:

`relative_i = R_i / R_CONSUMER`

A common cross-industry correction factor would leave these relative ratios unchanged. Therefore persistent and large relative dispersion cannot be repaired by any single common wage/price/productivity scalar.

## Measurements

Across 24 months and four countries:

- industry median RULC;
- industry RULC relative to CONSUMER;
- max/min industry relative spread per country-month;
- pairwise RESOURCE/CONSUMER, MATERIALS/CONSUMER, CAPITAL/CONSUMER ratios;
- fraction of country-months with max/min spread > 2 and > 3;
- seed-level distribution and country cohorts.

## Interpretation rule

This gate does **not** assert realistic sector targets.

It only asks whether the industries are mutually compatible with a single common real-value normalization.

`sectorRelativeDispersionPersistent = true` when the median max/min sector RULC spread is at least 2x and all four industries are observed. This threshold is an identification screen, not a canonical calibration target.

If persistent dispersion is confirmed across original and heldout seeds, the next required object is a **Sector Semantic Anchor Register** distinguishing relative price, physical productivity and product-basket meaning by industry before any canonical repair.

## Hard gates

- no canonical mutation by audit construction;
- exact diagnostic replay;
- exact canonical replay;
- hard accounting health;
- finite positive observations;
- all four countries observed;
- all four industries observed;
- deterministic relative-factor calculation.

No canonical mutation is authorized by success or failure of this gate.
