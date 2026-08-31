# WP-RV08 R4-CU-D3B Reference Membership Closure v0.1

## Decision

**CLOSED / PASS AS REFERENCE-SAMPLE GOVERNANCE / NO CALIBRATION TARGET AUTHORIZED**

## Authoritative evidence

- Branch: `scratch/new-project-2026-08-12`
- Gate commit: `1e7140fa44a374e7bd94784fbc5fd96c5b5ea706`
- GitHub Actions run: `33299225959`
- `reference-membership-gate`: success
- `final-beacon`: success

## What is now frozen

The four non-exclusive OECD comparison cohorts in `r4-cu-d3b-reference-membership-register.json` are frozen before outcome extraction. Cohort overlap is allowed because the classes describe different structural dimensions. Missing observations may reduce a metric-specific analytic sample, but countries may not be replaced after values are inspected merely to obtain a preferred band.

The first extraction is limited to the OECD annual manufacturing gross-value-added share for 2021–2024. This metric may characterize reference cohorts only. It may not be mapped directly to the model's `MATERIALS`, `CAPITAL`, or `CONSUMER` sectors because the OECD Supply-Use classification bridge remains a separate dependency.

## Anti-tuning lock

This closure does **not** authorize:

- direct copying from a reference economy into a fictional country;
- a numeric canonical calibration range;
- a single-year observation as a calibration center;
- manufacturing share as a model-sector share;
- replacement of missing cohort members after observing results.

## Next dependency-safe front

`R4-CU-D3C`: execute the official OECD country-year extraction, retain the raw panel and provenance hash, compute balanced multi-year cohort dispersion, and publish only **provisional reference bands**, not canonical targets.
