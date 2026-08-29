# WP-RV08 R4-CU-D0 — Dimensionless Empirical Anchor Design

Date: 2026-08-29
Mode: empirical evidence contract only
Canonical mutation: LOCKED

## Objective

R4-CU-B/C established that direct mapping of external wage, productivity and final-consumption levels into canonical model variables is not semantically admissible yet. R4-CU-D0 therefore prioritizes dimensionless or ratio-based anchors that are less sensitive to currency numeraire and product-unit ontology.

This front does not choose calibration multipliers. It defines which empirical ratios may constrain a later shadow calibration.

## Candidate anchor 1 — Labour income share

Official source family: ILOSTAT SDG 10.4.1, labour income share as a percent of GDP.

Empirical concept: aggregate labour income divided by GDP.

Usefulness: this is a dimensionless distributional constraint. It can test whether a future calibrated model allocates a plausible share of generated nominal value to labour without requiring a particular currency unit.

Mapping caveat: canonical model `wage * workers` is not automatically identical to national-accounts labour income, and canonical firm sales/output value is not automatically GDP/value added. A value-added bridge is required before this anchor can become an admitted numeric range.

Status: `TRANSFORMATION_REQUIRED`.

## Candidate anchor 2 — Household saving / consumption share of disposable income

Official source family: OECD household savings and disposable-income national accounts.

OECD defines household net saving as the portion of household income not spent on final consumption, and household saving rate as the share of household net disposable income that is saved. Therefore `1 - saving rate` is conceptually related to realized final consumption relative to disposable income, subject to the SNA pension-entitlement adjustment and gross/net convention.

Usefulness: this gives a dimensionless household-flow constraint and avoids importing an absolute currency level.

Mapping caveat: the model's `desiredConsumptionBudget` is an ex-ante decision budget, not realized household final consumption. This empirical ratio may constrain realized consumption/income accounting, but it must not directly set `desiredConsumptionBudget` without a separate behavioral bridge.

Status: `SEMANTIC_MATCH` for realized consumption/disposable-income accounting; `REJECTED_MISMATCH` for direct desired-budget calibration.

## Candidate anchor 3 — Industry relative value-added productivity

Official source family: OECD STAN Structural Analysis Database.

STAN provides annual industry-level output, value added, labour input, investment and capital stock using an ISIC Rev. 4-compatible industry list. Ratios such as value added per labour input can therefore supply dimensionless relative productivity comparisons across empirical industries after choosing a common price/PPP convention.

Usefulness: R4-CS proved that a sector-blind correction is invalid. STAN is a viable source family for sector-relative constraints.

Mapping caveat: the model's RESOURCE / MATERIALS / CAPITAL / CONSUMER sectors are functional simulation sectors, not direct ISIC industries. An explicit many-to-one classification bridge must be frozen before numeric sector ratios are admitted.

Status: `TRANSFORMATION_REQUIRED`.

## Candidate anchor 4 — Firm liquidity / operating-cost coverage

Desired form: cash or liquid assets divided by monthly operating expenditure/payroll, or working-capital days expressed relative to operating flows.

No sufficiently general official cross-country source has yet been admitted for the exact model concept. Current simulation cash/payroll-month ratios, arrears and exit rates are diagnostics only and cannot be used as empirical targets.

Status: `INSUFFICIENT_EVIDENCE`.

## Anti-overfitting gate

A dimensionless ratio is not automatically a valid target. Every admitted ratio must still match:

- numerator concept;
- denominator concept;
- institutional sector;
- time basis;
- gross/net convention;
- realized vs desired/ex-ante status;
- sector classification;
- value-added vs gross-output boundary.

No numeric target range is admitted in R4-CU-D0 itself.

## Decision

R4-CU-D0 may pass if the register distinguishes candidate ratios from admitted numeric targets, blocks direct use of the household saving identity for `desiredConsumptionBudget`, preserves the STAN classification bridge requirement, and leaves firm-liquidity anchors unresolved rather than fabricating a target.

Next if passed: R4-CU-D1 empirical range extraction, beginning with labour income share and realized household consumption/disposable-income ratios, followed by a separately frozen sector-classification bridge for STAN.