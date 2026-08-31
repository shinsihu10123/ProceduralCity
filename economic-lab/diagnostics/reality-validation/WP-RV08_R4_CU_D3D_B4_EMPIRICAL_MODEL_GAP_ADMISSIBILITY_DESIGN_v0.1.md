# WP-RV08 R4-CU-D3D-B4 Empirical–Model Gap and Admissibility Gate v0.1

## Decision status

**DESIGN FROZEN / EMPIRICAL COMPARISON ONLY / SHADOW-SCORING ADMISSION POSSIBLE / CANONICAL MUTATION NOT AUTHORIZED**

## Dependency checkpoint

This front starts after the following closures and does not repeat their work:

- B1: official ILOSTAT labour-income-share cohort evidence;
- B2: official OECD household net-saving and derived realized-consumption evidence;
- B3: internally reconciled model-side employee-compensation, GVA, household disposable-income and realized-consumption reconstruction.

B4 compares those objects under explicit partial semantic-match flags. It does not assign any reference cohort to a fictional country.

## Question

Are the model distributions merely offset by definitional differences, or are they separated from the admitted empirical evidence so strongly that broad dimensionless reference bands can safely constrain the ranking of future **shadow** repair candidates?

## Frozen empirical comparison envelopes

### Labour-income-share evidence

All four B1 reference classes passed coverage gates.

- outer observed cohort-IQR envelope: `0.521557–0.607117`;
- observed cohort-median range: `0.531190–0.589613`.

This remains total labour income as a share of GDP, whereas the B3 model numerator is employee compensation only and its denominator is a reconstructed domestic GVA proxy. The comparison is therefore directional and diagnostic, not a direct parameter identity.

### Realized household-consumption-flow evidence

Only B2 `REF-ADV-DIV` and `REF-MFG` passed coverage gates.

After the preregistered transformation `1 - net saving rate`:

- outer admitted cohort-IQR envelope: `0.883763–0.979344`;
- admitted cohort-median range: `0.914839–0.929494`.

This remains an OECD national-accounts flow identity. The B3 model comparator is a cash disposable-income flow without pension-entitlement adjustment and must not be mapped to `desiredConsumptionBudget`.

## Model sensitivity views

For every Original/Heldout seed, B4 must publish:

1. all-observation statistics already retained by B3;
2. positive-GVA-only employee-compensation-share statistics;
3. positive-disposable-income-only realized-consumption and saving-flow statistics;
4. country-level medians and pooled country-month medians;
5. denominator-invalid or non-positive observation shares;
6. gap factors relative to the broad empirical envelope, not to a selected country or class center.

No non-positive-GVA observation may be deleted from evidence. It is excluded only from a ratio sensitivity view and remains counted as a denominator pathology.

## Severe-gap criteria

The following preregistered tests identify separation too large to explain by normal semantic noise:

- **labour axis:** the positive-GVA model P25 exceeds the highest B1 outer-IQR endpoint (`0.607117`) in every seed;
- **household-flow axis:** the maximum model realized-consumption share remains below the lowest admitted B2 outer-IQR endpoint (`0.883763`) in every seed.

These are intentionally conservative distribution-separation tests. They do not require exact equality with any empirical median.

## Admissibility decision

If both severe-gap criteria reproduce on Original and Heldout seeds while B3 reconciliation and exact replay remain healthy, the B1/B2 envelopes may be admitted only as:

> **dimensionless shadow-candidate scoring bands**

They may be used to rank whether a candidate moves the system toward realistic value distribution and realized household flow. They are not canonical parameter values and do not identify whether wages, physical productivity, bundle size, relative prices or market execution must carry a particular numeric adjustment.

## Anti-tuning lock

B4 forbids:

- selecting a preferred reference class after observing model output;
- copying a class median into a fictional country;
- using the model/empirical gap factor as a wage, price or productivity multiplier;
- setting `desiredConsumptionBudget` from the realized-consumption band;
- discarding denominator failures;
- promoting a shadow-scoring band to a canonical target;
- canonical economic mutation.

## Execution

- four frozen seeds: Original A/C and Heldout E/F;
- 24 months per seed;
- B3 reconstruction rerun through its authoritative script;
- all B3 exact-replay and hard-accounting gates must pass;
- source outputs hashed and retained;
- aggregate B4 result uploaded as an artifact.

## Next dependency-safe front

If the severe two-axis gap is confirmed, proceed to `R4-CU-D3D-B5`: preregister an empirically constrained shadow-repair family that separates sectoral value-production coherence from household consumption-realization mechanics. No candidate may mutate canonical parameters until it passes accounting, purchasing-power, supply-chain, firm-survival and multi-seed stability gates.
