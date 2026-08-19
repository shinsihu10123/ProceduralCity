# WP-RV04 — Firm Distress & Exit Attribution

Status: **PASS — FIRM DISTRESS & EXIT ATTRIBUTION**
Date: 2026-08-19

## 1. Frozen economic semantics

Economic Model Frozen Baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`.

Economic mechanism changes in WP-RV04: **0**.
Parameter tuning in WP-RV04: **0**.
Structural repair authorized: **NO**.

## 2. Admission and promoted experiment

WP-RV02 bounded 12-month baseline reproduction is PASS across independent seeds A/B/C. WP-RV03 causal decomposition is PASS and establishes that continuing firms contract labor demand before mass exit, while firm exit is a later nonlinear amplifier.

WP-RV04 promoted panel:

- scale: `baseline`
- seeds: `ECON-RV02-A`, `ECON-RV02-B`, `ECON-RV02-C`
- horizon: 12 months
- dedicated workflow: `.github/workflows/economic-lab-rv04.yml`
- diagnostic runner: `economic-lab/scripts/firm-exit-diagnosis-v10.mjs`
- bounded evidence wrapper: `economic-lab/scripts/firm-exit-diagnosis-safe-v10.mjs`

Final successful GitHub Actions evidence:

- workflow repair commit: `d4bd30c8a79d51e9d21dc9236e5fa4f3890fd876`
- run: `32217483677`
- result: **SUCCESS**
- artifact: `9352823730` / `economic-lab-wp-rv04`
- artifact digest: `sha256:1e52da5e27f9e67711690b908923956f71e4a822bd3ce98078cd826229d9c26e`

All final gates PASS:

- exact observer non-interference
- v0.10 health for all promoted seeds
- exits present
- every exit directly attributed to a frozen coded trigger
- distress threshold reconciled at month 3 → 4+
- complete four-month pre-exit window when observable

## 3. Diagnostic packaging correction

Fresh run `32217325358` completed the economic diagnosis but failed while serializing the report with:

`RangeError: Invalid string length`

The failure occurred after the per-seed attribution table had already been computed. The cause was diagnostic packaging: each promoted run retained a complete economic fingerprint containing full cognitive/world state, and the runner attempted to serialize all fingerprints into the final JSON/string output.

This was **not an economic-model failure**.

A bounded evidence wrapper was added that preserves the full fingerprint for the exact non-interference comparison, then removes the fingerprint from the serialized promoted evidence and prints only a compact summary to the job log. Economic state, RNG path, accounting, cognition, exit predicates and parameters are unchanged.

The corrected run `32217483677` passed and uploaded the full diagnostic evidence artifact.

## 4. A — VERIFIED EXISTING FACTS

### 4.1 Direct coded exit causes

Across all three seeds there are `394` firm exits.

| Direct coded cause | Exits | Share |
|---|---:|---:|
| Liquidity/payroll only | 367 | 93.15% |
| Severe credit only | 0 | 0.00% |
| Both liquidity/payroll + severe credit | 27 | 6.85% |
| Unexplained | 0 | 0.00% |

Per seed:

- Seed A: 132 exits = 119 liquidity/payroll only + 13 both + 0 severe-credit-only.
- Seed B: 132 exits = 128 liquidity/payroll only + 4 both + 0 severe-credit-only.
- Seed C: 130 exits = 120 liquidity/payroll only + 10 both + 0 severe-credit-only.

Therefore **no firm in the promoted panel exits from the severe-credit trigger alone**. The dominant direct coded exit path is operating liquidity/payroll distress.

### 4.2 Four-month pre-exit conditions

Across the 394 exit windows, prevalence of at least one occurrence in the four-month window is:

- negative expected demand: `97.97%`
- revenue decline: `57.87%`
- cash below safe cash: `100%`
- cash below 10% of safe cash: `100%`
- wage arrears: `100%`
- severe payroll stress: `100%`
- inventory above target: `29.19%`
- input shortage: `53.05%`
- firm credit application: `100%`
- firm credit rejection: `100%`
- debt-service miss: `32.49%`
- loan default: `32.23%`
- nonzero credit-miss state: `32.49%`

Mean counts / ratios within the four-month exit windows:

- negative-expected-demand months: `3.777 / 4`
- cash-below-safe months: `4 / 4`
- wage-arrears months: `4 / 4`
- credit rejections: `4` per exit window
- debt-service misses: `1.036` per exit window
- mean cash / safe-cash ratio: `0.00160`
- mean wage-arrears / current payroll ratio: `3.969`
- mean inventory / target ratio: `0.671`
- mean input-shortage / desired-production ratio: `0.207`

### 4.3 Credit access is impaired, but severe credit failure is not the universal direct exit trigger

Every exiting firm applies for credit and experiences a rejection somewhere in its four-month pre-exit window. However only 27/394 exits meet the severe-credit predicate at the exit boundary, and all 27 simultaneously meet the liquidity/payroll predicate. Debt-service misses/defaults occur in only about one-third of exit windows.

Thus the promoted evidence separates two statements that must not be conflated:

1. **Credit access is broadly impaired among firms approaching exit.** VERIFIED.
2. **Severe credit failure is the direct coded cause of most exits.** FALSIFIED in this panel.

### 4.4 Exit is downstream of sustained operating distress

All exit windows contain cash below safe cash and wage arrears for all four observed months, and 97.97% contain negative expected demand. Combined with WP-RV03, which shows labor-demand contraction and quantity-rationed realized sales before the mass exit wave, the evidence places firm exit primarily as an amplification stage downstream of a real-side/operating-cash deterioration rather than as a credit-only initiating shock.

## 5. B — DIAGNOSTIC LEADS

1. **Operating cash/payroll failure is the dominant immediate exit channel.** 93.15% of exits are liquidity/payroll-only and the remaining 6.85% satisfy both predicates.
2. **Credit rejection is nearly universal before exit but does not map one-to-one to the severe-credit exit predicate.** This suggests finance may amplify or fail to cushion real-side distress rather than directly close most firms.
3. **Negative expected demand is nearly universal in pre-exit windows**, consistent with WP-RV03's supply-constrained realized-sales/demand-signal diagnosis.
4. **Inventory accumulation is not universal before exit.** Inventory-above-target occurs in only 29.19% of exit windows, so a simple excess-inventory story cannot explain most closures.
5. **Input shortage is material but not universal** at 53.05%; it remains a possible heterogeneous amplifier rather than a single common exit cause.

## 6. C — HYPOTHESIS DISPOSITION

| Hypothesis | WP-RV04 disposition |
|---|---|
| H-F1 firm exit amplifies collapse | **SUPPORTED**; WP-RV03 timing + WP-RV04 direct attribution are consistent |
| Credit-only failure is the dominant direct exit mechanism | **FALSIFIED** for the promoted panel |
| Operating liquidity/payroll distress is the dominant direct exit mechanism | **SUPPORTED** |
| Credit impairment is irrelevant | **FALSIFIED**; applications/rejections are universal, but causal role remains for WP-RV06 |
| Excess inventory is the universal source of firm distress | **FALSIFIED** |
| Input shortage is the universal source of firm distress | **FALSIFIED** |

## 7. What is not claimed

WP-RV04 does not claim:

- that credit conditions are economically realistic or calibrated;
- that credit rejection is causal merely because it precedes exit;
- that the correct repair is to loosen credit, lower the exit threshold, inject cash, forgive arrears, alter wages or change firm entry;
- that GDP/NIA composition has been diagnosed;
- that financial amplification has been fully diagnosed;
- that the structural diagnosis from WP-RV03 is sufficient by itself to authorize repair.

No coefficient or economic rule is changed in this WP.

## 8. Final WP result

**WP-RV04: PASS — FIRM DISTRESS & EXIT ATTRIBUTION**

Economic semantics changed: **0**
Parameter tuning performed: **0**
Structural repair authorized: **NO**

Next dependency-safe work package: **WP-RV05 — GDP / National-Income-Accounting Composition Diagnosis**.
