# WP-RV06 — Finance / Credit Transmission Diagnosis — Closure

Status: **PASS — DIAGNOSTIC DECOMPOSITION**
Date: 2026-08-19

## Frozen economic semantics

Economic Model Frozen Baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`.

Economic mechanism changes in WP-RV06: **0**.
Parameter tuning in WP-RV06: **0**.
Structural repair authorized by this WP: **NO**.

## Final evidence

- scale: `baseline`
- seeds: `ECON-RV02-A`, `ECON-RV02-B`, `ECON-RV02-C`
- horizon: 12 months
- country-month observations: 144
- corrected runner: `economic-lab/scripts/finance-transmission-diagnosis-v10b.mjs`
- final code/workflow head: `46ac563ce48e725059a5dd9207379bbb5e40df9c`
- GitHub Actions run: `32220023298`
- result: **SUCCESS**
- artifact: `9353620177` / `economic-lab-wp-rv06`
- artifact digest: `sha256:0f5a4815398c25697b8bc26101da83de3db7798885ed4735372d1aa9acadc330`

All final gates PASS:

- observer non-interference exact;
- all v0.10 health gates;
- complete 3 × 4 × 12 coverage;
- exact finance metric reconciliation to `lastCredit`;
- exact one-month `creditStress` lag reconciliation;
- complete application decision-trace coverage.

## Methodological correction log

### Failed attempt — run `32218565139`

The first WP-RV06 runner failed the assertion:

`observer credit events must reconcile with lastCredit metrics`.

The model itself did not fail. The diagnostic runner inferred loan-level misses from the borrower's aggregate `creditMisses` counter. If a borrower has multiple due loans, a miss on one loan can make the final borrower counter exceed the pre-service counter attached to more than one due-loan observation. That is not a valid loan-level event reconciliation rule.

The corrected runner does not weaken the gate. It instead reconciles `lastCredit` against the exact return values of the frozen `serviceDebt` and `originateCredit` calls, while keeping loan-level state transitions as diagnostic detail. Exact observer non-interference is re-tested before the promoted panel.

## A — VERIFIED EXISTING FACTS

### A1. Severe credit rationing exists before the mass unemployment/exit phase

Months 1–3, pooled across 12 country paths:

- applications: `1,375`
- approvals: `193`
- rejections: `1,182`
- approval rate: `14.04%`
- requested credit: `777,097.08`
- new credit supplied: `122,440.12`
- amount coverage: `15.76%`
- capital-unsafe decisions: `0`
- debt misses: `0`
- defaults: `0`
- mean unemployment: `4.85%`

The dominant rejection category in this early window is not a bank-capital violation. Rejection reasons are:

- risk-adjusted counterfactual choice favors rejection: `1,091`
- estimated-default-risk limit exceeded: `72`
- affordability constraint: `19`
- bank capital constraint: `0`

Thus credit supply is already restrictive while observed bank capital is not yet the coded binding constraint.

### A2. Bank capital constraint is a late collapse amplifier, not the initial trigger

Months 4–6:

- applications: `1,471`
- approvals: `148`
- approval rate: `10.06%`
- amount coverage: `3.69%`
- capital-unsafe decisions: `0`
- debt misses: `166`
- defaults: `14`
- mean unemployment: `12.89%`

Months 7–9:

- applications: `1,335`
- approvals: `34`
- approval rate: `2.55%`
- amount coverage: `0.50%`
- capital-unsafe decisions: `484`
- debt misses: `270`
- defaults: `109`
- charge-offs: `114,629.48`
- mean bank capital ratio: `9.28%`
- minimum observed bank capital ratio: `6.17%`
- mean unemployment: `58.12%`

Months 10–12:

- applications: `968`
- approvals: `3`
- approval rate: `0.31%`
- amount coverage: `0.0125%`
- capital-unsafe decisions: `703`
- defaults: `53`
- mean bank capital ratio: `8.35%`
- minimum observed bank capital ratio: `4.44%`
- mean unemployment: `85.67%`

Capital-safety rejection is therefore absent through month 6 and becomes dominant only after the real-side collapse is already advanced.

### A3. Debt-default feedback is not the initial collapse trigger

Pooled monthly timing:

- months 1–3: `0` debt misses, `0` defaults;
- month 4: first pooled debt misses appear (`14`), while defaults remain `0`;
- month 6: first pooled defaults appear (`14`);
- months 7–9: `270` misses and `109` defaults.

WP-RV03 already established that continuing firms begin net labor-demand contraction before mass firm exit and that unemployment acceleration is visible before the large exit wave. WP-RV06 adds that defaults are later than that initial labor-demand turn.

### A4. `creditStress` is a one-month lagged transformation of `lastCredit`

The final gate exactly reconciles every country-month monetary `creditStress` value to the frozen central-bank formula applied to the previous month's `lastCredit` state.

Therefore `lastMonetary.creditStress` must not be interpreted as a contemporaneous measure of the same month's credit-originations/default events.

### A5. Central-bank liquidity operations do not activate in this promoted panel

Across the 12-month promoted panel:

- total open-market purchases: `0`
- total central-bank lending: `0`

At the same time, late-period bank capital ratios and lending capacity deteriorate sharply. This panel therefore does not contain an observed central-bank liquidity rescue episode.

## B — DIAGNOSTIC LEADS

1. Credit rationing is an **early propagation condition**: it is already strong before debt defaults and before bank capital constraints become binding.
2. The early lending restriction is primarily generated by bank-agent risk/counterfactual decision logic, not by an exhausted regulatory-capital capacity.
3. The late financial accelerator is materially different from the early credit restriction: charge-offs and falling equity/capital capacity create a genuine balance-sheet constraint after the real-side collapse is underway.
4. Firm liquidity/payroll distress from WP-RV04 and severe early credit rationing from WP-RV06 are temporally compatible with a working-capital amplification channel, but the current observational panel alone does not establish that credit rationing caused the initial household-goods quantity shortage identified in WP-RV03.
5. A single metric named `creditStress` hides two economically distinct regimes: early decision/risk rationing and later capital/default-driven stress.

## C — HYPOTHESIS DISPOSITION

| Hypothesis | WP-RV06 disposition |
|---|---|
| H-C1 finance is the sole initial collapse trigger | **NOT SUPPORTED** |
| Bank capital constraint is the initial trigger | **FALSIFIED for the promoted panel** |
| Debt defaults are the initial trigger | **FALSIFIED for the promoted panel** |
| Early risk/counterfactual credit rationing is present before mass collapse | **VERIFIED** |
| Early credit rationing causally creates the initial supply shortage | **OPEN — requires causal repair/ablation evidence** |
| Finance becomes a late nonlinear amplifier through defaults/charge-offs/capital loss | **STRONGLY SUPPORTED** |
| `creditStress` is contemporaneous with same-month credit events | **FALSIFIED; it is lagged** |

## Cross-WP synthesis entering repair selection

The current promoted evidence supports a multi-stage collapse structure rather than a single financial trigger:

1. WP-RV03: household desired demand is large, but consumer goods are persistently quantity-rationed; realized sales are therefore supply constrained.
2. WP-RV03: firms use realized sales-related signals and continuing firms reduce labor demand before mass exit.
3. WP-RV06: credit is already heavily rationed in the early phase, mainly through risk/counterfactual bank decisions rather than bank capital exhaustion.
4. WP-RV04: operating cash/payroll distress accumulates and directly closes most firms; severe credit stress is not the universal direct exit trigger.
5. WP-RV04/WP-RV03: exits then displace remaining workers and sharply amplify unemployment.
6. WP-RV06: defaults, charge-offs and bank-capital impairment become a later financial accelerator, driving approvals toward zero.
7. WP-RV05: expenditure GDP remains algebraically reconciled, but inventory-book dynamics make measured GDP composition pathological and must not be used as an independent causal proof of real recovery/collapse.

## D — NEXT ACTION

Dependency-safe next stage: **WP-RV07 — Cross-WP Structural Synthesis & Repair-Candidate Selection**.

WP-RV07 may design discriminating repair candidates/ablations, but must preserve the Anti-tuning Rule: no coefficient tweaking to force a target path. Candidate interventions must address identified semantic/structural mechanisms and must be evaluated against accounting, determinism, health, non-interference boundaries and held-out seeds.

## Final result

**WP-RV06: PASS — FINANCE / CREDIT TRANSMISSION DIAGNOSIS**

Economic mechanism changes: **0**
Parameter tuning: **0**
Empirical realism claim: **NO**
Repair authorization: **NO — selection begins in WP-RV07**
