# WP-RV08 R4-CU-D3D-B2 OECD Household-Saving Closure v0.1

## Decision

**CLOSED / PASS WITH TWO ADMITTED AND TWO COVERAGE-BLOCKED PROVISIONAL DESCRIPTORS / DESIRED-CONSUMPTION MAPPING NOT AUTHORIZED**

## Authoritative evidence

- Branch: `scratch/new-project-2026-08-12`
- Authoritative head: `0b8b55a4158d4a690d4826163778d47ee56e752c`
- GitHub Actions run: `33349972408`
- `official-oecd-extraction`: success
- `final-beacon`: success
- Artifact: `r4-cu-d3d-b2-oecd-household-saving`
- Artifact ID: `9743255753`
- Artifact ZIP digest: `sha256:c2f60fa8082367d2e6d643572a24aac171ac77eb5feacea87fa40cad6311369c`

## Official panel

- Publisher: OECD
- Dataset: `OECD.SDD.NAD,DSD_NAAG@DF_NAAG_V,1.0`
- Measure: `B8NS1M`, net saving of households and NPISH
- Unit: `PT_B6N_S1M`, percent of household and NPISH net disposable income
- Requested years: 2021–2024
- Primary balanced window: 2021–2023
- Retained country-year observations: 59
- Country-year duplicates: 0

The derived realized-consumption counterpart is defined mechanically as `100 - net saving rate` under the same OECD national-accounts denominator. It is not the model's ex-ante `desiredConsumptionBudget`.

## Admitted provisional descriptors

| Reference class | Complete economies | Missing share | Saving P25 | Saving median | Saving P75 | Saving IQR | Realized-consumption median |
|---|---:|---:|---:|---:|---:|---:|---:|
| REF-ADV-DIV | 9 | 0.00% | 5.7355 | 7.0506 | 11.6237 | 5.8882 | 92.9494 |
| REF-MFG | 5 | 16.67% | 2.0656 | 8.5161 | 11.6237 | 9.5580 | 91.4839 |

Both classes satisfy the pre-registered minimum of five complete economies and the maximum 25% country-year missing-share rule.

## Coverage-blocked descriptors

### REF-RESOURCE

- Status: `BLOCKED_INSUFFICIENT_COMPLETE_ECONOMIES`
- Complete primary-window economies: 4
- Missing share: 25.00%
- Missing frozen member: NOR has no observations in 2021–2024 in the extracted series
- NZL has 2021–2023 but lacks 2024
- Descriptive-only saving median: 5.3836%
- Descriptive-only realized-consumption counterpart median: 94.6164%

### REF-HIGHSAVE

- Status: `BLOCKED_INSUFFICIENT_COMPLETE_ECONOMIES`
- Complete primary-window economies: 4
- Missing share: 20.00%
- Missing frozen member: CHE has no observations in 2021–2024 in the extracted series
- Descriptive-only saving median: 10.5829%
- Descriptive-only realized-consumption counterpart median: 89.4171%

No missing member was replaced and the five-economy threshold was not lowered after observing coverage.

## Interpretation

The admitted reference cohorts devote, under the OECD net-saving identity, roughly 91–93% of compatible disposable income to realized consumption at the cohort median. The blocked cohorts remain useful as descriptive evidence only. These values constrain a future model-side realized-flow reconstruction; they do not determine desired budget, cash spending, marginal propensity to consume, or a canonical household parameter.

## Anti-tuning lock

This closure does **not** authorize:

- setting `desiredConsumptionBudget` to 91–95% of income;
- treating net saving as deposit accumulation alone;
- copying a cohort median into a fictional country;
- substituting NOR or CHE after observing missingness;
- promoting the four-economy resource or high-saving descriptors to admitted bands;
- canonical economic mutation.

## Next dependency-safe front

`R4-CU-D3D-B3`: reconstruct model-side national labour compensation, value added, disposable household income, and realized household consumption on compatible settlement boundaries; report semantic gaps such as self-employed/mixed income and pension adjustments rather than silently imputing them.
