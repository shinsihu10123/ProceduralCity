# WP-RV08 R4-CU-D3D-B4 Empirical–Model Gap Closure v0.1

## Decision

**CLOSED / PASS — SEVERE TWO-AXIS EMPIRICAL GAP CONFIRMED / BROAD REFERENCE BANDS ADMITTED FOR SHADOW SCORING ONLY / DIRECT CANONICAL TARGETS NOT AUTHORIZED**

## Authoritative evidence

- Branch: `scratch/new-project-2026-08-12`
- Authoritative head: `72fd011f6204f93aaf876009811d1737ce9028c7`
- GitHub Actions run: `33355587385`
- `empirical-model-gap`: success
- `final-beacon`: success
- Artifact: `r4-cu-d3d-b4-empirical-model-gap`
- Artifact ID: `9745056061`
- Artifact ZIP digest: `sha256:0bb72384b714da718dcc3ecae5c9b5be531a94859103c8d1a2522efe9feba347`

B4 reran the authoritative B3 reconstruction for Original A/C and Heldout E/F. Every source rerun retained exact canonical replay, exact diagnostic replay and hard accounting health.

## Coverage and denominator sensitivity

- Total country-months: 384
- Positive-GVA country-months: 377
- Non-positive-GVA country-months retained in evidence: 7
- Non-positive-GVA share: 1.823%
- Positive-disposable-income country-months: 384
- Non-positive-disposable-income country-months: 0

Non-positive-GVA observations were not deleted. They were excluded only from the positive-denominator labour-share sensitivity distribution and remained reported as an economic denominator pathology.

## Labour-value axis

The admitted B1 ILOSTAT outer cohort-IQR envelope is `0.521557–0.607117` of GDP.

Across the four model seeds, the positive-GVA employee-compensation-share medians are:

| Seed | Positive-GVA P25 | Positive-GVA median | Median / empirical upper |
|---|---:|---:|---:|
| Original A | 1.0000 | 2.2010 | 3.6253× |
| Original C | 1.1679 | 2.3324 | 3.8417× |
| Heldout E | 1.0000 | 2.0443 | 3.3673× |
| Heldout F | 1.0623 | 2.8960 | 4.7701× |

The preregistered conservative separation criterion passed in every seed: even the positive-GVA model P25 exceeds the highest empirical IQR endpoint, `0.607117`. Every individual fictional-country median also lies above that endpoint.

The comparison remains partial because the model numerator excludes employer social contributions and self-employed/mixed labour income. Those omissions cannot plausibly explain an employee-compensation share already above 200% of GVA at the median.

## Household realized-flow axis

The admitted B2 OECD realized-consumption outer cohort-IQR envelope is `0.883763–0.979344` of compatible net disposable income.

Across the model seeds:

| Seed | Model median realized-consumption share | Model maximum | Empirical lower / model median |
|---|---:|---:|---:|
| Original A | 0.001237 | 0.015185 | 714.70× |
| Original C | 0.001904 | 0.020265 | 464.27× |
| Heldout E | 0.001424 | 0.013524 | 620.49× |
| Heldout F | 0.001849 | 0.013197 | 478.08× |

The preregistered separation criterion also passed in every seed: even the **maximum** observed model realized-consumption share remains below the empirical lower endpoint. The empirical lower endpoint is still at least 43.61 times the largest model observation.

Model median net-saving-flow shares are about `0.9981–0.9988`, exceeding the admitted empirical saving upper endpoint by about 88.2 percentage points.

This result must not be interpreted as a recommendation to set `desiredConsumptionBudget` to 91–93% of income. Desired budget is ex ante and already greatly exceeds productive consumer capacity; the failure lies in realized production/value and market-flow conversion.

## Joint decision

Both severe-gap criteria replicated on Original and Heldout seeds while:

- all B3 accounting identities remained reconciled;
- exact replay passed;
- source hashes were retained;
- semantic gaps remained explicit;
- no fictional-country/reference-class assignment was made.

Therefore the external envelopes are now admitted only as:

> **broad dimensionless shadow-candidate scoring bands**

They may rank whether future shadow candidates move toward realistic labour-value distribution and household realized-flow behavior. They are not canonical parameter values and do not identify a unique wage, price, productivity, bundle-size or market-clearing multiplier.

## Anti-tuning lock

This closure does **not** authorize:

- using the 3.37–4.77 labour gap as a wage, price or productivity multiplier;
- using the 464–715 household gap as a consumer-output multiplier;
- selecting a preferred reference class after observing model output;
- setting `desiredConsumptionBudget` from the OECD band;
- discarding non-positive-GVA observations;
- copying an empirical cohort into a fictional country;
- canonical economic mutation.

## Next dependency-safe front

`R4-CU-D3D-B5`: preregister an empirically constrained two-axis shadow-repair family. The first axis must repair sectoral real productivity/value recovery without blind repricing; the second must repair consumer-sector final-output realization without directly tuning desired budgets. Candidate selection must preserve accounting, household purchasing power, supply-chain feasibility, firm survival, exact replay and heldout replication.
