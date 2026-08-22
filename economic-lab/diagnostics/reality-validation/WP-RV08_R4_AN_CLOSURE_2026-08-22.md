# WP-RV08 R4-AN Closure — Revenue-Supported Staffing Envelope Causal Ablation

Date: 2026-08-22
Run: `32553592408`
Source SHA: `8ef505a2209921096d42e0b7c7c89856dbb0681d`
Verdict: **PASS — causal narrowing / FAIL-CONTINUE — no staffing-envelope repair is sufficient**

## Execution closure

R4-AN completed all 8 seed/base shards and all 40 primary simulations successfully, plus the final status beacon. Coverage is original A/C + held-out E/F, each under CONSUMER and MATERIALS+CONSUMER normalization, with five staffing regimes over 36 months.

All runs retained the same transformed unit basis, productive normalization, canonical credit-before-staffing ordering, 24-month diagnostic distress grace, accounting/ledger/GDP gates, and deterministic control replay. No canonical production rule was changed.

## Main result

No regime is a Pareto improvement on employment, arrears, GDP, and output.

### CONSUMER — four-seed mean

| regime | unemployment | arrears | linked/current-worker arrears | GDP | output |
|---|---:|---:|---:|---:|---:|
| control | 22.28% | 1.434m | 1.058m | 34.12k | 911.7 |
| mean3-immediate | **20.59%** | 1.441m | 1.046m | **34.84k** | **937.4** |
| mean3-ramp | 25.55% | 1.350m | 0.951m | 32.77k | 910.3 |
| floor3-ramp | 28.90% | **1.268m** | **0.878m** | 31.42k | 887.6 |
| hysteresis-ramp | 26.16% | 1.342m | 0.943m | 32.50k | 901.4 |

Relative to control, mean3-immediate improves unemployment by about 1.69 percentage points, GDP by 2.13%, and output by 2.81%, but total arrears increase by about 0.51%. The ramped/conservative rules reduce arrears only by accepting higher unemployment and weaker activity.

### MATERIALS+CONSUMER — four-seed mean

| regime | unemployment | arrears | linked/current-worker arrears | GDP | output |
|---|---:|---:|---:|---:|---:|
| control | 15.08% | 1.145m | 0.942m | 35.16k | 1555.1 |
| mean3-immediate | 15.13% | 1.185m | 0.946m | **35.83k** | 1527.6 |
| mean3-ramp | 18.97% | 1.101m | 0.850m | 33.83k | 1489.9 |
| floor3-ramp | 21.91% | **1.069m** | **0.801m** | 32.85k | 1444.1 |
| hysteresis-ramp | 19.18% | 1.096m | 0.841m | 34.00k | 1492.1 |

The same trade-off reproduces in the broader normalized base. Conservative revenue envelopes lower wage-arrears stock but do so alongside a material reduction in employment and output.

## Causal interpretation

**A VERIFIED EXISTING FACT:** A three-month revenue-supported staffing envelope contains useful information about financially sustainable labor, but applying that information as a direct staffing rule does not resolve the collapse mechanism.

**A VERIFIED EXISTING FACT:** Immediate mean-support targeting is the strongest activity-preserving variant but does not reduce aggregate arrears.

**A VERIFIED EXISTING FACT:** Ramped or floor/hysteresis variants reduce arrears mainly by lowering employment/activity. This is not an admissible structural repair.

**C HYPOTHESIS REJECTED:** `Recent realized contribution -> bounded staffing target` alone is sufficient to restore a healthy equilibrium.

The next question is therefore not which scalar staffing cap to tune. The remaining wedge must be decomposed into current wage-flow underfunding versus inherited arrears stock, and any claim-provenance defect must be separated from the primary current-period payroll problem.

## Closure

R4-AN closes as a successful causal ablation. No staffing regime from this batch is authorized for canonical merge.
