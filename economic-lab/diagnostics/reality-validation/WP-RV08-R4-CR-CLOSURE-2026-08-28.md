# WP-RV08-R4-CR Closure — Two-Axis Calibration Requirement

Date: 2026-08-28
Authoritative run: `33164308730`
Run head: `71194f0392b935e5bf1c1da21acf833f08782fe5`

## Verdict

**CLOSED / PASS AS DIAGNOSTIC EVIDENCE / AT LEAST TWO REAL CALIBRATION AXES REQUIRED / CANONICAL MUTATION NOT APPROVED**

R4-CR tested whether the real labor-cost/productive-value defect identified in R4-CQ could, by itself, explain the household desired-consumption-budget versus consumer-capacity-value defect.

For each country-month the audit used the observed consumer real-unit-labor-cost anchor as a first-axis normalization factor and then measured the remaining household desired-budget / consumer-capacity-value ratio.

All four matrix jobs and the final beacon completed successfully. Replay, canonical replay, accounting health, finite-observation and deterministic-factor gates passed.

## Cross-seed result

| Seed | Median labor factor | Median canonical demand/capacity | Median residual after labor normalization | Residual > 1 share | Residual > 5 share | Two-axis confirmed |
|---|---:|---:|---:|---:|---:|---|
| Original A | 88.75 | 601.43 | 6.50 | 97.92% | 58.33% | true |
| Original C | 90.27 | 802.25 | 8.82 | 96.88% | 59.38% | true |
| Heldout E | 87.94 | 646.52 | 7.44 | 96.88% | 61.46% | true |
| Heldout F | 88.87 | 1003.66 | 11.59 | 93.75% | 62.50% | true |

The first-axis labor correction removes roughly the order-of-magnitude RULC defect, but it does not collapse the household-demand/capacity mismatch to unity. The median second factor remains about 6.5x to 11.6x across original and heldout seeds.

This is not a statement that the eventual canonical repair should literally divide or multiply any field by those factors. These are identification factors only.

## Artifact evidence

- Original A: artifact `9682936212`, digest `sha256:bf635cea11a443ee93df108d09d02a8be5505547152ce199516f75b4af0f5464`
- Original C: artifact `9682941178`, digest `sha256:d384871ff6ba368fcc5d3148ed84f086a3531ee2d4ad50f2b281274542af1f8a`
- Heldout E: artifact `9682940809`, digest `sha256:09e9bc3d52273f2e57c11044ba36908946ef451b579410f34f4a2a90df98a630`
- Heldout F: artifact `9682947149`, digest `sha256:e55cf15d5b4b83a39197a5665bf355cb698237b27c619b16efc2757cc81bf223`

## Causal interpretation

The current world has at least two distinct real-coherence problems:

1. labor compensation is far too large relative to productive value per worker;
2. household desired nominal consumption is still too large relative to consumer productive capacity value even after the first defect is normalized in shadow space.

Therefore a one-axis wage/price/productivity repair is not sufficient.

R4-CQ also showed large industry dispersion in RULC. The next diagnostic must determine whether a single labor/productive-value correction can even be common across industries, or whether the model also requires sector-relative price/productivity/value anchors.

## Lock

No canonical wage, price, productivity, output, household consumption budget, procurement, credit, accounting or settlement behavior is authorized to change by this closure.
