# WP-RV08 R4-CU — Empirical Anchor Target Protocol

Date: 2026-08-28
Mode: evidence-contract construction only
Canonical mutation: LOCKED

## Purpose

R4-CT established that the model is underidentified without semantic and empirical anchors. R4-CU defines the admission protocol for those empirical targets before any calibration parameter is changed.

This phase does **not** choose repair multipliers and does **not** mutate canonical wage, price, quantity, productivity, consumption, accounting, credit, procurement, or labor behavior.

## Evidence hierarchy

Preferred evidence order:

1. international statistical organization / national accounts / official statistical agency;
2. official administrative or survey series;
3. peer-reviewed or documented secondary datasets where no direct official series exists;
4. derived model target only when the derivation is explicit and all upstream empirical anchors are admitted.

Uncited intuition, internal simulation ratios, and convenient round numbers are not admissible empirical targets.

## Required metadata for every admitted target

Every target record must carry:

- target ID and semantic-anchor ID;
- concept name and exact definition;
- source organization and dataset/indicator;
- source URL or stable dataset identifier;
- observation geography or reference-economy class;
- reference year / period;
- nominal vs real status;
- currency / PPP / price-base convention when monetary;
- stock vs flow;
- time basis (monthly, annual, per hour, etc.);
- denominator and population universe;
- point/range/distribution form;
- uncertainty / limitation note;
- transformation required to map source concept into the model;
- whether the transformation is identity-preserving, empirical, or assumption-dependent;
- admission status.

## Admission statuses

- `CANDIDATE_SOURCE`: relevant source found, not yet mapped.
- `SEMANTIC_MATCH`: concept and denominator match established.
- `TRANSFORMATION_REQUIRED`: source is usable only after an explicit conversion.
- `ADMITTED_RANGE`: defensible target range admitted for shadow calibration.
- `REJECTED_MISMATCH`: source is not semantically equivalent.
- `INSUFFICIENT_EVIDENCE`: no defensible target yet.

No `CANDIDATE_SOURCE` may directly authorize a canonical mutation.

## Initial external anchor families

### A. Wage / compensation

Candidate source family: OECD average annual wages / official national accounts and labor-market wage series.

Required mapping checks:
- dependent employee vs all employed persons;
- gross wage vs employer compensation vs disposable income;
- annual FTE vs model monthly wage;
- PPP/real comparison vs domestic nominal accounting unit.

### B. Labor productivity

Candidate source family: ILO/OECD labor productivity, preferably GDP or value added per hour worked, with output per employed person as secondary fallback.

Required mapping checks:
- value added vs gross output;
- hour-based vs worker-month labor input;
- total economy vs sector;
- real/PPP valuation convention.

### C. Household consumption

Candidate source family: World Bank/ICP/SNA household and NPISH final consumption expenditure and related shares.

Required mapping checks:
- final consumption expenditure vs model desired consumption budget;
- realized expenditure vs desired budget;
- annual national-accounts flow vs monthly household decision flow;
- housing, health, imputed services and other categories not represented in the model.

### D. Relative sector values and prices

A sector-blind target is prohibited. Sector-relative calibration requires an explicit classification bridge between model sectors RESOURCE / MATERIALS / CAPITAL / CONSUMER and empirical industry/product classifications. Until that bridge exists, sector-specific price/productivity multipliers remain unauthorized.

### E. Firm liquidity / working capital

Cash-to-payroll-months, liquidity buffers, working-capital needs, and trade-credit terms require separately sourced firm-finance evidence. These cannot be inferred from the current model's bankruptcy frequency or arrears rate.

## Core anti-overfitting rules

1. Original A/C and heldout E/F diagnostics may identify defects but may not be used as empirical truth.
2. A target must not be chosen because it makes a failing gate pass.
3. A single external statistic must not be stretched across incompatible sectors or concepts.
4. Range targets are preferred over false point precision where definitions or mappings are uncertain.
5. Monetary numeraire conversion must be separated from real behavioral calibration.
6. Quantity/bundle reinterpretation requires an explicit product-unit ontology; it cannot be inferred from a desired multiplier.
7. Calibration is shadow-only until an independent validation front passes.

## First execution sequence

R4-CU-A: build machine-readable empirical target register schema.

R4-CU-B: populate source candidates for wage, productivity, household consumption, relative-sector mapping, and firm liquidity.

R4-CU-C: classify each candidate by semantic match and required transformation.

R4-CU-D: admit only defensible ranges; leave unsupported anchors unresolved.

R4-CU-E: construct the first shadow calibration vector from admitted ranges and validate on independent seeds before any canonical proposal.

## Gate

R4-CU protocol passes only if:

- canonical mutation remains locked;
- every empirical target requires provenance and period metadata;
- semantic mapping is explicit;
- nominal/real and stock/flow distinctions are explicit;
- unresolved anchors may remain unresolved without fabricated values;
- sector-blind normalization remains prohibited;
- internal diagnostic values cannot self-authorize empirical targets;
- shadow validation is required before a canonical repair proposal.
