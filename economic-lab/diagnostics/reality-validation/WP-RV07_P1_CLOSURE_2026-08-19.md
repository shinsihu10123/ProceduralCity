# WP-RV07-P1 — Unit-Economics / Wage-Output Coherence Audit — Closure

Status: **PASS — STRUCTURAL UNIT MISMATCH VERIFIED**
Date: 2026-08-19

## Frozen economic semantics

Economic Model Frozen Baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`.

Economic mechanism changes in P1: **0**.
Parameter tuning in P1: **0**.
Repair merged into model: **NO**.

## Evidence

- GitHub Actions run: `32221560944`
- head: `76beb83bfc5e79c40bff3509167cbc4f224776a3`
- artifact: `9354091830` / `economic-lab-wp-rv07-p1`
- digest: `sha256:e6ce95571a016c2c309f0f5a70842d84b9bc7371d4c2b60707c86c4b0aaf3949`
- scales: `compact`, `baseline`
- seeds: `ECON-RV02-A/B/C`
- horizon: 3 months
- all hard gates: PASS

Hard gates passed:

- exact observer non-interference;
- all v0.10 health gates;
- complete scale × seed × country × month coverage;
- exact payroll-ledger reconciliation.

## A — VERIFIED EXISTING FACTS

### A1. Payroll obligations are roughly two orders of magnitude larger than contemporaneous gross output value

Baseline, pooled over 36 country-months:

- mean consumer contractual payroll / consumer output value: `95.454x`
- minimum consumer contractual payroll / consumer output value: `77.096x`
- maximum consumer contractual payroll / consumer output value: `135.326x`
- mean all-firm contractual payroll / gross output value: `104.003x`
- mean consumer paid payroll / consumer output value: `89.235x`

Compact reproduces the same structure:

- mean consumer contractual payroll / output value: `92.328x`
- minimum: `76.905x`
- maximum: `160.377x`
- mean all-firm contractual payroll / gross output value: `116.975x`

The discrepancy is therefore not a compact-scale artifact.

### A2. The mismatch is visible in per-worker units

Baseline:

- mean consumer output value per worker: `1.036`
- mean consumer payroll obligation per worker: `96.420`
- mean all-firm output value per worker: `0.938`
- mean all-firm payroll obligation per worker: `96.209`

Compact:

- mean consumer output value per worker: `1.065`
- mean consumer payroll obligation per worker: `95.331`
- mean all-firm output value per worker: `0.856`
- mean all-firm payroll obligation per worker: `97.398`

This directly verifies a monetary/physical scale incoherence in the frozen initialization/production semantics.

### A3. Realized firm revenue cannot finance the payroll scale

Baseline:

- mean consumer revenue / paid payroll: `0.0382`
- mean all-firm revenue / paid payroll: `0.0168`

Compact:

- mean consumer revenue / paid payroll: `0.0765`
- mean all-firm revenue / paid payroll: `0.0144`

These ratios are descriptive coded outcomes, not empirical calibration targets.

### A4. Month 1 already contains the mismatch

Baseline month 1:

- consumer payroll / output value: `108.518x`
- all-firm payroll / gross output value: `116.175x`
- consumer output value per worker: `0.910`
- consumer payroll obligation per worker: `96.416`

The mismatch therefore precedes the later unemployment, exit, default and bank-capital collapse phases.

## B — DIAGNOSTIC INTERPRETATION

P0 established that household desired nominal demand is much larger than the nominal value of goods available to the household market, while early intermediate-input shortages are not sufficient to explain the initial gap.

P1 now verifies the deeper unit-economics condition: the frozen model pays monthly wages in the roughly `80–110` monetary-unit range while contemporaneous firm physical output valued at transaction prices is roughly `1` monetary unit per worker.

The current code therefore mixes nominal wage/wealth/cash magnitudes with a physical-output × price basis that is about two orders of magnitude smaller.

This is a structural semantic defect candidate, not a coefficient-calibration finding.

## C — HYPOTHESIS DISPOSITION

| Hypothesis | P1 disposition |
|---|---|
| The initial shortage is only a compact-scale artifact | **FALSIFIED** |
| Early input procurement alone explains the initial goods shortage | **NOT SUPPORTED by P0/P1** |
| Wage/payroll and physical-output value are on coherent units | **FALSIFIED** |
| A monetary/physical unit-basis mismatch exists before the collapse | **VERIFIED** |
| A particular repair coefficient is now justified | **NO — not yet** |

## D — NEXT ACTION

Dependency-safe next stage: **WP-RV07-P2 — Structural Unit-Basis Repair Ablation**.

P2 will not tune a free coefficient to force a target unemployment or GDP path. It will test a narrowly defined semantic repair candidate against the unchanged frozen control using paired seeds, preserving all health/accounting/determinism gates.

The first candidate is an initialization price-unit interpretation test: treat the country `initialPrice` near `1` as a normalized price index rather than as a literal one-currency-unit transaction price, and derive the transaction price basis from the country's existing initial wage basis. This is an experimental ablation only; it is not merged into canonical model code unless it survives the full repair gates.

## Final result

**WP-RV07-P1: PASS — STRUCTURAL UNIT MISMATCH VERIFIED**

Economic mechanism changes: **0**
Parameter tuning: **0**
Empirical realism claim: **NO**
Canonical repair: **NOT YET**
