# WP-RV08 R4-AP — Population Sufficiency / Labor Feasibility / Scale Sensitivity

Date: 2026-08-22
Run: 32555211095
Source SHA: 77194ddcb7475f741c30cdc66658dd017a144d01
Status: EXECUTION COMPLETE / INTERIM SYNTHESIS

## 1. Execution gate

GitHub status `economic-lab/wp-rv08-r4-ap` is SUCCESS. The 32-way matrix completed across:

- profiles: baseline, balanced2, households2, firms2
- seeds: original A, original C, held-out E, held-out F
- productive-normalization bases: CONSUMER, MATERIALS+CONSUMER
- horizon: 24 months

No canonical production repair is authorized by this result.

## 2. Question

Does the collapse occur mainly because the simulated world simply contains too few household/worker agents, or because labor demand, productive need, and payroll support are internally incoherent?

## 3. Representative scale evidence

Representative original-A / CONSUMER:

| profile | households | firms | physical need / household | viable physical need / household | desired jobs / household | target fill | mean unemployment | terminal unemployment | GDP / household | output / household | arrears / household |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 2110 | 170 | 2.179 | 0.765 | 0.563 | 99.978% | 47.18% | 85.12% | 47.92 | 0.436 | 196.48 |
| balanced2 | 4220 | 340 | 1.910 | 0.725 | 0.531 | 99.990% | 50.25% | 88.46% | 44.82 | 0.402 | 206.70 |
| households2 | 4220 | 170 | 1.050 | 0.265 | 0.375 | 99.984% | 64.90% | 93.94% | 29.16 | 0.283 | 143.07 |
| firms2 | 2110 | 340 | 4.337 | 1.833 | 0.422 | 99.744% | 61.04% | 87.47% | 48.52 | 0.317 | 254.39 |

Representative held-out-F / CONSUMER reproduces the direction:

- baseline unemployment 47.31%, terminal 86.41%, target fill 99.997%
- balanced2 unemployment 52.28%, terminal 88.88%, target fill 99.977%
- households2 unemployment 64.39%, terminal 94.29%, target fill 99.984%
- firms2 unemployment 60.33%, terminal 86.75%, target fill 99.801%

Representative original-A / MATERIALS+CONSUMER also preserves the same broad structure:

- baseline: viable physical need / household 0.916, desired jobs / household 0.625, target fill 99.948%, mean unemployment 40.42%
- balanced2: 0.857, 0.569, 99.965%, 46.19%
- households2: 0.418, 0.465, 99.978%, 55.75%
- firms2: 1.843, 0.425, 99.716%, 60.74%

## 4. Interpretation

### H-AP1 — Absolute agent count is the primary root

**DOWNGRADED / NOT SUPPORTED by the scale intervention.**

Doubling households and firms together does not normalize the economy. Doubling households alone does not repair the collapse and mechanically begins with far more non-employed household agents. Doubling firms worsens aggregate labor infeasibility but the actual labor market still fills almost all posted targets.

### H-AP2 — The labor market cannot find enough people for posted vacancies

**STRONGLY DOWNGRADED.**

Across the representative cases target fill remains approximately 99.7–100%. This is consistent with the earlier AF/AG result: matching is not the dominant labor bottleneck once the target has been formed.

### H-AP3 — Physical productive need can exceed total simulated household count

**SUPPORTED in some states, but not sufficient to explain the collapse.**

The physical production plan often requires more worker-equivalents than the total household count. However, economically viable physical need is much lower, and firms post labor targets far below both total physical need and often viable physical need. The economy therefore does not first fail because posted jobs exhaust the available population; it usually fails before that at target formation / payroll-support coherence.

## 5. Important newly exposed semantic issue

R4-AP treats every `household` object as a potential worker because that is how the current model is implemented. This must not be confused with a real population.

The current source has no explicit age, child/elderly state, retirement, labor-force participation state, birth, death, or aging mechanism in the household agent definition. Macro unemployment is currently `1 - employed / households.length`.

Therefore R4-AP answers only the narrow question of **current-model household-agent sufficiency**. It does not validate real-world demographic labor supply or the semantic correctness of the unemployment rate.

This structural issue is promoted to R4-AQ.

## 6. Verdict

- Execution: PASS
- Absolute population-shortage-as-primary-root: DOWNGRADED
- Posted-vacancy matching shortage: STRONGLY DOWNGRADED
- Aggregate physical labor infeasibility: PARTIALLY SUPPORTED in some states
- Demographic/labor-force realism: NOT VALIDATED; structural gap identified
- Canonical repair: NOT AUTHORIZED
