# WP-RV08 R4-CU-D3D-B1 ILOSTAT Labour-Share Closure v0.1

## Decision

**CLOSED / PASS AS PROVISIONAL DIMENSIONLESS REFERENCE EVIDENCE / NO DIRECT WAGE OR PRODUCTIVITY TARGET AUTHORIZED**

## Authoritative evidence

- Branch: `scratch/new-project-2026-08-12`
- Authoritative head: `ac7c762684d1c9feebc368714aae50ecaa89d247`
- GitHub Actions run: `33349801237`
- `official-ilostat-extraction`: success
- `final-beacon`: success
- Artifact: `r4-cu-d3d-b1-ilostat-labour-share`
- Artifact ID: `9743202078`
- Artifact ZIP digest: `sha256:8210ec6edec2a77deade93a00fbb9c1ba6ed41fa516459d5c905d618edecc15b`

## Official panel

- Publisher: International Labour Organization
- System: ILOSTAT
- Dataset: `SDG_1041_NOC_RT_A`
- Indicator: `SDG_1041_NOC_RT`
- Meaning: labour income share as a percent of GDP
- Requested years: 2021–2024
- Primary balanced window: 2021–2023
- Retained union-country observations: 72
- Country-year duplicates: 0
- Missing country-years: 0 across every frozen class

Source identifiers and observation-status flags were retained. The panel includes 48 observations without an explicit status flag, 16 marked `I`, and 8 marked `M`; no rows were removed after inspecting values or flags.

## Provisional class descriptors

| Reference class | Complete economies | P25 | Median | P75 | IQR | Mean |
|---|---:|---:|---:|---:|---:|---:|
| REF-ADV-DIV | 9 | 56.3193 | 56.4913 | 58.9613 | 2.6420 | 57.4051 |
| REF-MFG | 6 | 54.3503 | 56.9007 | 59.3648 | 5.0146 | 56.9010 |
| REF-RESOURCE | 5 | 52.1557 | 53.1190 | 56.4750 | 4.3193 | 52.4264 |
| REF-HIGHSAVE | 5 | 58.1723 | 58.9613 | 60.7117 | 2.5393 | 60.3103 |

All four classes satisfy the pre-registered five-economy and missingness gates for this indicator.

## Interpretation

The evidence shows that the frozen reference cohorts cluster around labour-income shares of roughly the mid-50s to low-60s percent, with the resource-exposed cohort lower and the high-saving cohort higher in this sample. These are national value-distribution descriptors, not direct targets for a firm's wage, payroll-to-sales ratio, physical productivity, or sector RULC.

Before model comparison, the simulation must reconstruct national value added and total labour compensation using a compatible accounting boundary, including an explicit treatment of self-employed or mixed income. Therefore this closure does not yet authorize a canonical labour-share target.

## Anti-tuning lock

This closure does **not** authorize:

- setting model wages to the class median;
- multiplying productivity until model labour share equals an observed median;
- interpreting national labour share as firm payroll divided by gross sales;
- dropping imputed/modelled observations after seeing their values;
- assigning a reference cohort directly to a fictional country;
- canonical economic mutation.

## Next dependency-safe front

`R4-CU-D3D-B2`: extract OECD net household saving as a share of household and NPISH net disposable income, preserve its national-accounts definition, and derive realized-consumption-share descriptors as `100 - net saving rate` without mapping them directly to `desiredConsumptionBudget`.
