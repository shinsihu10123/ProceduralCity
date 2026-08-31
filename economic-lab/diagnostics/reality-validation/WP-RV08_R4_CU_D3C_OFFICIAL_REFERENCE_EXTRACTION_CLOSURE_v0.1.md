# WP-RV08 R4-CU-D3C Official Reference Extraction Closure v0.1

## Decision

**CLOSED / PASS WITH THREE ADMITTED PROVISIONAL REFERENCE BANDS AND ONE COVERAGE-BLOCKED CLASS / NO CALIBRATION TARGET AUTHORIZED**

## Authoritative evidence

- Branch: `scratch/new-project-2026-08-12`
- Authoritative head: `d1c56dfb7e944cde7e5ff1ddf15a487bad3eba17`
- GitHub Actions run: `33349300802`
- `official-reference-extraction`: success
- `final-beacon`: success
- Artifact: `r4-cu-d3c-official-reference-extraction`
- Artifact ID: `9743045393`
- Artifact ZIP digest: `sha256:af0f1fb5d15e5e4babf3a53c859774f1775dd144284ccf8d311cea4aac614d93`

The authoritative run retained the official OECD CSV panel, provenance metadata, raw-response SHA-256, country-year coverage, class-level distributions, and a human-readable summary.

## Source and estimator

- Publisher: OECD
- Dataset: `OECD.SDD.NAD,DSD_NAAG_IV@DF_NAAG_IV,1.0`
- Measure: manufacturing gross value added as a percentage of total gross value added
- Requested years: 2021–2024
- Primary balanced window: 2021–2023
- Country statistic: arithmetic mean over complete 2021–2023 observations
- Class statistic: unweighted distribution across complete country means
- Frozen class membership: R4-CU-D3B register

These values characterize reference-economy cohorts only. Manufacturing GVA share is not a direct target for model `MATERIALS`, `CAPITAL`, or `CONSUMER` sectors.

## Admitted provisional descriptors

| Reference class | Complete economies | Missing share | P25 | Median | P75 | IQR |
|---|---:|---:|---:|---:|---:|---:|
| REF-ADV-DIV | 8 | 5.56% | 10.2398 | 11.2235 | 15.1324 | 4.8927 |
| REF-MFG | 6 | 0.00% | 19.7602 | 21.1574 | 22.2767 | 2.5165 |
| REF-HIGHSAVE | 5 | 0.00% | 14.9930 | 20.5295 | 20.6157 | 5.6227 |

All three satisfy the pre-registered minimum of five independent complete economies and the maximum country-year missing-share rule.

## Coverage-blocked class

`REF-RESOURCE` is **BLOCKED_INSUFFICIENT_COMPLETE_ECONOMIES** for this indicator/window.

- Frozen members: AUS, CAN, NOR, NZL, CHL
- Complete 2021–2023 economies: 4
- Country-year missing share: 15.00%
- Cause: CAN has OECD observations for 2021–2022 but not 2023–2024 in the extracted series
- Descriptive-only median: 7.6091
- Descriptive-only IQR: 3.8581

The five-economy threshold was not lowered and CAN was not replaced after observing the data. The blocked four-economy result may be retained as descriptive evidence but is not an admitted provisional band.

## Run-history classification

The first D3C run failed before extraction because the OECD endpoint returned HTTP 500 `languageTag1` under the original response negotiation. The request was changed to the documented CSV file response mode with an explicit English language header. That failure is classified as an API/request-harness failure, not empirical evidence.

The next run successfully extracted the official panel but failed the original all-classes band-admission gate because `REF-RESOURCE` had only four complete economies. The gate was not weakened. Instead, execution success was separated from per-class band admission so that the shortfall remains an explicit blocked empirical result.

## Anti-tuning lock

This closure does **not** authorize:

- canonical economic parameter changes;
- direct copying from any reference country into a fictional country;
- treating provisional descriptors as calibration centers;
- substituting a frozen cohort member after observing missingness or values;
- lowering the five-economy admission threshold;
- mapping manufacturing share directly to a model sector;
- using the coverage-blocked resource descriptor as an admitted band.

## Next dependency-safe front

`R4-CU-D3D`: independently rehydrate and validate the immutable D3C artifact, preserve the blocked resource-class result, and expand the empirical evidence set to labour income share, household saving/realized-consumption share, sector-relative value/labour compensation through the SUT bridge, and firm liquidity/working-capital measures.
