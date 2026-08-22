# WP-RV08 R4-AN — Interim Synthesis (7/8 shards)

Date: 2026-08-22
Run: `32553592408`
Source SHA: `8ef505a2209921096d42e0b7c7c89856dbb0681d`
Status: **INTERIM — 7/8 seed/base shards complete; held-out E / MATERIALS+CONSUMER still executing at bounded check**

## Scope

R4-AN is a diagnostic-only causal ablation of revenue-supported staffing envelopes. Every shard compares five regimes under the same transformed unit basis, productive normalization, canonical credit execution, and 24-month diagnostic distress grace:

- `control`: prior max-ramp + grace diagnostic state;
- `mean3-immediate`: target workers = min(physical need, workers supported by mean realized operating contribution over prior 3 months);
- `mean3-ramp`: the same target approached through bounded monthly staffing adjustment;
- `floor3-ramp`: target based on the weakest realized-contribution month in the prior 3 months, approached gradually;
- `hysteresis-ramp`: expand when 3-month mean support exceeds current staffing, contract when 3-month floor support is below current staffing, otherwise hold.

This document does **not** close R4-AN while the final held-out E / MATERIALS+CONSUMER shard remains active.

## Execution gates already observed

The seven completed shards each report all hard gates true: deterministic control replay, health, full five-regime coverage inside the shard, productive normalization activation, ledger verification, general accounting verification, GDP identity arithmetic, ready staffing-decision rows, intervention activation, finite outputs.

Completed coverage at this checkpoint:

- CONSUMER: original A, original C, held-out E, held-out F = **4/4 complete**.
- MATERIALS+CONSUMER: original A, original C, held-out F = **3/4 complete**.
- Missing only: held-out E / MATERIALS+CONSUMER.

## Complete four-seed CONSUMER result

Four-seed means:

| Regime | Unemployment | Terminal U (last 6m) | Arrears | Linked/current-worker arrears | GDP | Output |
|---|---:|---:|---:|---:|---:|---:|
| control | 22.28% | 53.14% | 1.434m | 1.058m | 34.12k | 911.7 |
| mean3-immediate | **20.59%** | 54.93% | 1.441m | 1.046m | **34.84k** | **937.4** |
| mean3-ramp | 25.55% | 58.30% | 1.350m | 0.951m | 32.77k | 910.3 |
| floor3-ramp | 28.90% | 60.73% | **1.268m** | **0.878m** | 31.42k | 887.6 |
| hysteresis-ramp | 26.16% | 58.86% | 1.342m | 0.943m | 32.50k | 901.4 |

Mean effect versus same-seed control:

| Regime | Δ unemployment | Δ arrears | Δ linked arrears | Δ GDP | Δ output |
|---|---:|---:|---:|---:|---:|
| mean3-immediate | **-1.69 pp** | +0.52% | -1.12% | **+2.16%** | **+2.81%** |
| mean3-ramp | +3.27 pp | -5.81% | -10.05% | -3.92% | -0.16% |
| floor3-ramp | +6.61 pp | -11.58% | -16.95% | -7.86% | -2.64% |
| hysteresis-ramp | +3.87 pp | -6.42% | -10.77% | -4.74% | -1.14% |

### Interpretation

1. **No completed CONSUMER regime is a Pareto repair.**
   - `mean3-immediate` is the only regime that improves average unemployment, GDP, and output together, but it does not reduce total arrears and terminal unemployment is slightly worse than control.
   - the three gradual/conservative rules reduce arrears, especially linked/current-worker arrears, but do so together with materially higher unemployment and lower GDP/output.

2. The arrears reductions in `mean3-ramp`, `floor3-ramp`, and `hysteresis-ramp` are therefore consistent with **contraction-mediated relief**, not a demonstrated coherence repair.

3. `mean3-immediate` remains diagnostically interesting because it improves real activity without materially increasing linked arrears, but the large outstanding arrears stock prevents treating its near-flat arrears result as evidence that current-period payroll flow is unchanged.

## Interim MATERIALS+CONSUMER result (3/4 seeds)

Three-seed means show the same qualitative trade-off:

- `mean3-immediate`: unemployment approximately flat (-0.08 pp), GDP +1.80%, but total arrears +4.65% and linked arrears +0.66%; output -1.45%.
- `mean3-ramp`: unemployment +4.59 pp, arrears -3.62%, linked arrears -10.17%, GDP -4.52%, output -5.58%.
- `floor3-ramp`: unemployment +7.35 pp, arrears -6.54%, linked arrears -15.86%, GDP -6.87%, output -7.35%.
- `hysteresis-ramp`: unemployment +4.55 pp, arrears -4.24%, linked arrears -11.18%, GDP -3.96%, output -4.60%.

These are interim because held-out E / MATERIALS+CONSUMER is still running.

## Causal narrowing

R4-AN already falsifies a simple form of the hypothesis that a recent-revenue staffing envelope by itself can simultaneously solve employment and payroll solvency.

However, the primary outcome metric `household.wageArrears` is a **stock**. Canonical payroll settlement attempts to pay current wage plus up to 50% of one wage of prior arrears per worker each month. Therefore a regime can improve current-period wage coverage while the legacy arrears stock remains large, or can reduce stock mainly by contracting employment.

The next dependency-safe diagnostic is consequently **flow-versus-stock decomposition**, not another staffing parameter sweep.

## Next diagnostic frontier

R4-AO should measure, for every wage settlement and month:

- current wage due;
- current wage paid;
- newly created current-period shortfall;
- prior arrears presented for catch-up service;
- legacy arrears actually repaid;
- aggregate arrears-stock change;
- reconciliation `Δ arrears stock = new current shortfall - legacy repayment`;
- the same five R4-AN regimes across original and held-out seeds.

This will determine whether `mean3-immediate` is failing because it still creates large **new** payroll shortfalls, or whether legacy wage claims are masking an improvement in current payroll flow.

No canonical repair is authorized from this interim result.