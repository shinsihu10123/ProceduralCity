# WP-RV08 R4-CU-B/C — Empirical Source and Semantic Match Register

Date: 2026-08-29
Mode: evidence admission / semantic mapping only
Canonical mutation: LOCKED

## Purpose

This front executes R4-CU-B and R4-CU-C. It records authoritative candidate source concepts and determines whether they can be mapped directly to the model's semantic anchors.

No source in this document authorizes a calibration multiplier. Numeric target admission is deferred to R4-CU-D.

## Source family 1 — OECD average annual wages

Official source: OECD, `Average annual wages`.
Definition: average yearly wage paid per dependent employee in the total economy, adjusted to a full-time-equivalent basis. OECD calculates it from the national-accounts total wage bill divided by average employees, with an FTE adjustment based on usual weekly hours.

Semantic classification: `TRANSFORMATION_REQUIRED`.

Reason:
- model `wage` is a monthly firm/household wage flow;
- OECD measure is annual, total-economy, dependent-employee, FTE;
- gross wage is not automatically employer total compensation or household disposable income;
- cross-economy PPP/current-price conventions must be selected explicitly.

Permitted future transformation: annual-to-monthly time conversion is identity-like only after the wage concept and population universe are accepted. Currency/PPP normalization remains a separate operation.

## Source family 2 — ILO labour productivity

Official source: International Labour Organization labour-productivity methodology.
Definition: output per unit of labour input, commonly GDP per employed person or per hour worked; value-added-based labour productivity is a standard productivity statistic.

Semantic classification: `TRANSFORMATION_REQUIRED`.

Reason:
- canonical model `capacityPerWorker` is physical/gross productive capacity in sector-specific model units per worker-month;
- ILO productivity is value-added/GDP based, not physical gross output;
- aggregate GDP per worker cannot directly determine RESOURCE/MATERIALS/CAPITAL/CONSUMER physical unit productivity;
- hour-to-worker-month conversion additionally requires a working-time anchor.

Therefore GDP-per-worker must NOT be inserted directly as `capacityPerWorker`.

## Source family 3 — World Bank / SNA household final consumption expenditure

Official source: World Bank WDI / ICP national-accounts framework.
Relevant series family includes households and NPISHs final consumption expenditure; the concept is expenditure on goods and services for direct satisfaction of household needs/wants. Current-price and constant-price variants exist. The series is an annual national-accounts expenditure flow.

Semantic classification: `REJECTED_MISMATCH` for direct mapping to `desiredConsumptionBudget`; `CANDIDATE_SOURCE` for a realized-consumption anchor.

Reason:
- `desiredConsumptionBudget` is an ex-ante monthly behavioral budget before market clearing;
- national-accounts household final consumption expenditure is realized final expenditure;
- empirical household consumption includes services/categories not represented by the current model, including potentially imputed items depending on series definition;
- NPISH inclusion must be handled explicitly.

It may later constrain realized consumption expenditure or consumption-income shares, but it cannot directly define the behavioral desired-budget variable.

## Semantic decisions

1. OECD wage series: usable only after time/population/compensation convention mapping.
2. ILO labour productivity: useful as a real-economy value-productivity anchor, not a direct physical output-unit anchor.
3. World Bank/SNA HFCE: useful for realized consumption/expenditure shares; direct desired-budget mapping rejected.
4. None of these sources identifies the model product bundle `Q_i`.
5. None identifies sector-specific physical productivity without a sector/product classification bridge.
6. None independently authorizes changing canonical prices, wages, quantities, productivity, or consumption propensities.

## Remaining evidence gaps

Before R4-CU-D can admit a calibration range, the following are still required:

- a reference-economy strategy rather than arbitrary country selection;
- working-time convention if hour-based productivity is used;
- labor compensation share / value-added relationship to bridge wage and value productivity;
- sector classification bridge for RESOURCE / MATERIALS / CAPITAL / CONSUMER;
- household disposable-income / consumption relationship for behavioral budget calibration;
- firm liquidity / working-capital empirical evidence;
- explicit product-bundle ontology if physical quantity targets are to be calibrated.

## Decision

R4-CU-B/C: **PARTIAL PASS / AUTHORITATIVE SOURCE CONCEPTS ESTABLISHED / DIRECT NUMERIC MAPPING NOT YET ADMISSIBLE**.

The correct next front is R4-CU-D0: construct a dimensionless empirical-target bridge first. Prefer ratios that reduce dependence on arbitrary currency and quantity units, including labor compensation share, consumption-to-disposable-income/expenditure ratios, liquidity-to-payroll/operating-expense months, and sector-relative value-productivity indices.

Canonical mutation remains locked.