# WP-RV08 R4-V Closure + R4-W Partial Persistence Synthesis

Date: 2026-08-21

Verdict:

- **R4-V: PASS / CAUSAL CLOSURE**
- **R4-W: PARTIAL / LONG-HORIZON SIGNAL REPRODUCED, 3 OF 6 SHARDS COMPLETE**

Executed source run: `32451833036`
Executed source commit: `59f81fcefc3fe4abfcbc5f6ef947b863ae2d7522`

## 1. Question

Does the restructuring wage-arrears penalty mainly come from detached former-worker claims that remain after separation, or from payroll failure among workers who remain linked to active firms?

A secondary question is whether the same arrears/employment trade-off persists beyond the 24-month window.

## 2. R4-V completion status

All six 24-month R4-V shards completed successfully:

- original A
- original B
- original C
- held-out D
- held-out E
- held-out F

Every completed artifact passed:

- observer non-interference;
- deterministic replay;
- health;
- complete coverage;
- normalization activation;
- restructuring activation;
- ledger verification;
- general accounting verification;
- GDP arithmetic identity;
- finite-row checks;
- orphan-claim observation;
- control presence.

Therefore R4-V is no longer an interim result.

## 3. Six-seed FULL-window means

### CONSUMER base

| Rule | Mean unemployment | Mean total arrears | Mean employed arrears | Mean unemployed arrears | Mean orphan share |
|---|---:|---:|---:|---:|---:|
| control | 48.17% | 109,122 | 23,875 | 85,247 | 59.1% |
| realized | 47.17% | 111,673 | 25,506 | 86,168 | 58.0% |
| operating | 32.77% | 148,268 | 82,636 | 65,632 | 32.2% |
| multi | 25.95% | 166,311 | 115,020 | 51,291 | 20.5% |

### MATERIALS+CONSUMER base

| Rule | Mean unemployment | Mean total arrears | Mean employed arrears | Mean unemployed arrears | Mean orphan share |
|---|---:|---:|---:|---:|---:|
| control | 44.29% | 103,414 | 27,719 | 75,695 | 56.5% |
| realized | 42.90% | 104,886 | 29,874 | 75,012 | 55.3% |
| operating | 23.69% | 145,276 | 106,551 | 38,725 | 19.7% |
| multi | 20.02% | 157,363 | 126,710 | 30,653 | 13.6% |

The direction is consistent across all original and held-out seeds.

## 4. Held-out D closes the final R4-V gap

Held-out D reproduced the existing causal pattern.

CONSUMER:

- control unemployment 52.94%, total arrears 115,598, unemployed arrears 92,407, orphan share 62.5%;
- operating unemployment 38.58%, total arrears 158,671, employed arrears 79,691, unemployed arrears 78,980, orphan share 36.9%;
- multi unemployment 29.70%, total arrears 180,787, employed arrears 120,800, unemployed arrears 59,987, orphan share 22.8%.

MATERIALS+CONSUMER:

- control unemployment 50.23%, total arrears 112,777, unemployed arrears 86,719, orphan share 60.5%;
- operating unemployment 27.29%, total arrears 161,294, employed arrears 115,898, unemployed arrears 45,396, orphan share 21.1%;
- multi unemployment 22.94%, total arrears 170,735, employed arrears 135,719, unemployed arrears 35,016, orphan share 14.7%.

This is a held-out replication, not an original-seed tuning result.

## 5. Causal interpretation

The core signature is now unambiguous:

1. operating/multi restructuring sharply lowers unemployment;
2. total wage arrears rise;
3. **unemployed/former-worker arrears fall** relative to control;
4. orphan share falls strongly;
5. **employed/current-worker arrears rise dramatically**.

Therefore the total-arrears increase cannot be attributed mainly to detached former-worker claims.

### Hypothesis verdicts

- **H-V1 — restructuring arrears are mainly detached old claims:** FALSIFIED AS PRIMARY EXPLANATION.
- **H-V2 — detached claims exist and lack a normal post-employment settlement path:** SUPPORTED.
- **H-V3 — incremental restructuring arrears primarily arise among retained/current workers:** STRONGLY SUPPORTED.
- **H-V4 — repeated restructuring is consistent with recoverability/workforce over-estimation:** SUPPORTED and further tested by R4-X.

Detached claims remain a genuine institutional/liability-state defect, but they are secondary to current payroll infeasibility for the restructuring penalty.

## 6. R4-W 48-month persistence

Completed 48-month shards:

- original A: PASS
- original C: PASS
- held-out F: PASS

Cancelled before completion:

- original B
- held-out D
- held-out E

The cancelled jobs uploaded only minimal/partial artifacts and are classified as execution-duration conditions, not economic failures.

All three completed 48-month shards passed the same hard gates as R4-V.

### Mean FULL-window results across completed A/C/F

| Rule | Mean unemployment | Mean total arrears | Mean employed arrears | Mean unemployed arrears | Mean orphan share | Mean restructures | Mean liquidations |
|---|---:|---:|---:|---:|---:|---:|---:|
| consumer-operating | 53.02% | 303,157 | 156,386 | 146,771 | 41.2% | 589.0 | 270.3 |
| consumer-multi | 44.60% | 363,821 | 239,449 | 124,372 | 27.5% | 811.3 | 201.7 |
| materials-consumer-operating | 37.66% | 318,070 | 211,331 | 106,738 | 26.9% | 655.0 | 148.3 |
| materials-consumer-multi | 33.22% | 348,302 | 249,857 | 98,446 | 20.6% | 757.7 | 100.3 |

The employment benefit survives into the longer horizon, especially under MATERIALS+CONSUMER, but the arrears burden becomes extremely large and remains concentrated among employed/current workers.

## 7. Long-horizon verdict

R4-W does **not** validate operating/multi restructuring as a production repair.

It instead strengthens the causal diagnosis:

`recoverability / labor support estimate`
→ `too many workers retained relative to sustainable realized payroll`
→ `current-worker arrears accumulation`
→ `renewed distress`
→ `repeated restructuring`
→ `later liquidation`.

The three successful 48-month shards show this mechanism is persistent rather than a transient 24-month artifact.

R4-W remains PARTIAL because three of six 48-month shards did not finish, but the successful original and held-out evidence is sufficient to keep labor-demand/payroll coherence as the dominant diagnostic frontier.

## 8. Dependency consequence

The next dependency-safe experiment must not merely alter liability bookkeeping or keep firms alive longer.

It must directly test whether staffing is coherent with:

- physical production need;
- actual payroll settlement capacity;
- realized operating contribution;
- combinations of those constraints.

That is the purpose of R4-Y/Z.

No canonical repair is authorized by this closure.
