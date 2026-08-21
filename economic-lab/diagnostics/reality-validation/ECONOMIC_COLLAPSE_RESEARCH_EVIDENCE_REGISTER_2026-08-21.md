# Economic Lab — Endogenous Economic Collapse Research Evidence Register

Date: 2026-08-21
Status: ACTIVE / LIVING REGISTER
Scope: Economic Lab reality-validation and causal-diagnosis work only

## 1. Purpose

This document is the durable research-level index for the endogenous economic-collapse investigation performed inside the Gaon autonomous-world Economic Lab.

It exists for two reasons:

1. preserve the causal research trail independently of transient GitHub Actions artifacts;
2. make the work directly reusable later as a standalone research report on endogenous collapse in an agent-based economy.

GitHub Actions artifacts are evidence carriers, not the sole record. Artifact retention differs by workflow and remains finite. Therefore every major claim that survives causal review must eventually be summarized in repository-native Markdown and, where needed, compact JSON/CSV evidence.

## 2. Research question

Why does the Economic Lab economy converge toward severe unemployment, firm exit, production/consumption collapse, credit deterioration and synchronized macroeconomic failure over longer horizons, and which mechanisms are causal roots versus secondary amplifiers?

## 3. Methodological contract

- Diagnose before repair.
- Do not tune parameters merely to suppress collapse.
- Accounting identity is not equivalent to economic realism.
- Internal model consistency is not external empirical validation.
- Counterfactual interventions are diagnostic unless explicitly promoted later.
- Observer/instrumentation must not alter simulation state.
- Prefer multi-seed, long-horizon and held-out validation.
- Separate representation defects, causal roots, amplifiers and repair candidates.

Claim taxonomy:
- A — VERIFIED EXISTING FACT
- B — DIAGNOSTIC LEAD
- C — HYPOTHESIS
- D — PROPOSED CHANGE

Verdict taxonomy:
- PASS / PARTIAL / BLOCKED / FAIL / FAIL-CONTINUE / INCOMPLETE

## 4. Durable causal findings to date

### A. Baseline collapse is real and reproducible

The original model exhibits severe long-horizon unemployment, firm exits, output/consumption deterioration, credit stress and synchronized macro collapse across seeds. This is not a single-seed anomaly.

Primary durable sources include RV02–RV07 execution/closure documents in this directory.

### B. Labor matching is not the primary initial cause

Matching frictions do not explain the first collapse transition. Planned labor contraction appears earlier, while exit displacement becomes a much larger late-stage unemployment amplifier.

### C. Voluntary household consumption cuts are not the primary initial cause

Households can retain positive desired budgets while seller inventory shortages and unmet demand remain high. Therefore weak consumption is not adequately explained as a household-preference collapse.

### D. Firm exit is predominantly a liquidity/payroll failure channel

Exit candidates overwhelmingly show operating cash shortage, wage arrears and liquidity stress. Exit suppression can produce large employment gains, proving exit propagation is a strong amplifier, but indiscriminate no-exit protection creates large arrears and is not a valid repair.

### E. Nominal/unit-basis incoherence is a genuine structural defect

Initial price/wage scaling and productive feasibility are inconsistent enough to materially distort viability. Aligning initial price to the wage basis materially improves dynamics but does not fully repair the economy.

### F. Productive-capacity infeasibility is a genuine structural defect

Certain sectors, especially CONSUMER under the original scaling, can be unable to generate economically feasible output relative to payroll/input obligations. Productive normalization materially improves short-run outcomes.

### G. Supply/procurement frictions are material but secondary

Observed failure modes include local no-stock, timing/topological availability and procurement-budget exhaustion. Same-month upstream availability and full-cash diagnostic procurement can materially improve throughput, especially after other structural constraints are relieved, but supply alone does not eliminate macro collapse.

### H. Replacement-entry regeneration is weak

Replacement entrants may be mechanically created and credit-eligible yet fail to receive effective startup finance or generate meaningful output/revenue. Credit timing and underwriting constraints are real defects, but even strong entrant-finance counterfactuals have only limited aggregate unemployment effects. Startup finance is therefore a complement, not the sole root.

### I. Exited-firm estates strand large fractions of the economy

A very large share of book assets, liabilities, wage payables and physical inventories can remain attached to inactive firms. Physical estate recycling improves throughput and survival but is insufficient to explain or repair the full unemployment collapse.

### J. Zero-output labor capitalization is a representation defect

The accounting system can capitalize labor into inventory even when physical output is zero. This causes book/physical divergence and can make inventory investment dominate measured GDP. Correcting the accounting representation does not, by itself, repair macro collapse; tax-feedback-root explanations were therefore falsified.

### K. Binary liquidation versus restructuring is a major causal architecture choice

Diagnostic restructuring substantially reduces unemployment and exits relative to immediate liquidation. However broad operating/capacity-based recoverability rules retain too much labor relative to realized sustainable payroll and create materially larger wage arrears.

### L. Detached former-worker wage claims exist, but do not explain the restructuring arrears penalty

After layoff/exit, household wage claims can remain while employer linkage is removed, leaving no ordinary payroll service path. This is a genuine liability/settlement-state defect.

However cohort audits show that operating/multi restructuring often lowers unemployed/orphan arrears and orphan shares while total arrears rise. Therefore detached former-worker claims are not the primary explanation for the incremental restructuring arrears penalty.

### M. Current-worker payroll failure is the strongest present causal frontier

R4-X post-restructure cohort diagnostics show that retained firms frequently have extremely poor payroll coverage and realized operating contribution relative to retained payroll obligations.

Representative completed results:

Original A, CONSUMER:
- age 0 paid/base payroll coverage ≈ 0.0716
- age 0 realized contribution/payroll ≈ 0.0452
- age 6 paid/base payroll coverage ≈ 0.0943
- age 6 realized contribution/payroll ≈ 0.2481
- recurrent restructuring share ≈ 92.1%
- max repeats = 8

Original B, CONSUMER:
- age 0 paid/base payroll coverage ≈ 0.0831
- age 1 paid/base payroll coverage ≈ 0.0678
- age 6 paid/base payroll coverage ≈ 0.0810
- age 6 realized contribution/payroll ≈ 0.1095
- recurrent restructuring share ≈ 94.2%
- max repeats = 8

Held-out E, CONSUMER:
- age 0 paid/base payroll coverage ≈ 0.0517
- age 0 realized contribution/payroll ≈ 0.0286
- age 6 paid/base payroll coverage ≈ 0.0609
- age 6 realized contribution/payroll ≈ 0.1053
- recurrent restructuring share ≈ 91.7%
- max repeats = 8

Held-out F, CONSUMER:
- age 0 paid/base payroll coverage ≈ 0.0473
- age 0 realized contribution/payroll ≈ 0.0279
- age 6 paid/base payroll coverage ≈ 0.0637
- age 6 realized contribution/payroll ≈ 0.2072
- recurrent restructuring share ≈ 90.3%
- max repeats = 8

The MATERIALS+CONSUMER base generally raises realized coverage relative to CONSUMER-only but still leaves a large majority of post-restructure observations below full payroll coverage.

Current strongest causal chain:

labor-demand / recoverability over-estimation
→ workforce retained above realized sustainable payroll
→ current-worker arrears
→ renewed liquidity distress
→ repeated restructuring
→ eventual liquidation/exit
→ employment displacement + estate stranding
→ additional supply/demand deterioration

This remains a diagnostic causal frontier until labor-demand coherence ablations complete.

## 5. Supply interaction after restructuring

R4-Q/U evidence indicates supply relief becomes materially more effective after partial labor/exit architecture relief, especially in MATERIALS+CONSUMER configurations.

Representative unemployment effects for MATERIALS+CONSUMER restructuring+estate → +supply:
- original A: ~0.3074 → ~0.2573
- original B: ~0.3426 → ~0.3015
- original C: ~0.3129 → ~0.2658
- held-out E: ~0.2034 → ~0.1584

Interpretation: supply is a reproducible complement, not a universal standalone root repair.

## 6. Key falsified or downgraded explanations

The following explanations have been tested and cannot currently be treated as primary root causes on their own:

- labor matching failure alone;
- voluntary household consumption contraction alone;
- bank credit constraints alone;
- procurement budget cap alone;
- supply search/round/self-selection alone;
- accounting representation/tax feedback alone;
- stranded estates alone;
- entrant startup finance alone;
- detached former-worker wage claims as the main source of restructuring arrears.

These mechanisms may remain amplifiers or independent defects.

## 7. Current active experiment frontier

### WP-RV08 R4-Y / R4-Z — labor-demand coherence ablation

Initial workflow run: 32452759136
Recovery workflow run: 32455326123

Purpose: test whether labor demand itself must be anchored to production need and/or actual settlement/realized operating capacity.

Labor regimes under test:
- control
- production
- settlement
- realized
- hybrid

R4-Y:
- canonical exit
- 24 months
- original A/B/C + held-out D/E/F

R4-Z:
- diagnostic restructuring
- 36 months
- original A/B/C + held-out D/E/F

The superbatch represents 12 independent shards and 120 principal simulation regimes across two productive-normalization bases and five labor-demand rules.

The first superbatch attempt reached the former 30-minute per-job execution timeout before any Y/Z shard produced an artifact. Log inspection showed the simulation process itself was still running when GitHub Actions cancelled it at the configured wall-clock limit. This is classified as an execution-runtime condition, not an economic-model failure.

Recovery action:
- Y timeout expanded from 30 to 120 minutes;
- Z timeout expanded from 30 to 120 minutes;
- Y/Z artifact retention expanded from 30 to 90 days;
- the full batch was restarted as run 32455326123.

At the latest bounded status check, the recovery launch beacon had passed and all 12 principal Y/Z jobs were in progress. No causal verdict is recorded until actual shard evidence is produced.

## 8. R4-X execution status

Workflow run: 32452192028

Completed PASS shards:
- original A
- original B
- original C
- held-out E
- held-out F

Held-out D was cancelled by execution duration and has been explicitly re-run as an independent job. Its cancellation is treated as an execution/runtime condition, not an economic failure.

R4-X has already passed observer non-interference, deterministic replay, health, accounting, ledger and GDP-arithmetic gates on completed shards.

## 9. Important workflow/evidence run identifiers

- QRSTU high-throughput: 32451260894
- V/W arrears cohort/persistence: 32451833036
- X post-restructure payroll cohort: 32452192028
- Y/Z labor-demand coherence initial superbatch: 32452759136
- Y/Z labor-demand coherence timeout-recovery superbatch: 32455326123

Selected repository synthesis/closure commits in the current causal sequence:
- R4-I/J/K closure: 5f60c7500136c8411fc963fd1fd0bba073a11ca0
- R4-L/M/N closure: 626e9a8c9b10ff69d10a2287ae6b0c16f01123c8
- R4-O/P/Q state-machine engine: b77c5ac68b41a132d5eee445cd489749175b64ef
- QRSU interim synthesis: 4ba74def1d84737983feeb148c9b1adc1e54719b
- V interim causal synthesis: f81c042fa3c4d55eeab6be2d982f67b2694e9ee0
- R4-X interim synthesis / branch checkpoint before this register: 3fbdac360e15fcef98b2da1260217b1fcffdb204
- Y/Z timeout recovery workflow change: 6690580d3d770b5e291aa1464a9f7ca717d9bfec

## 10. Report-conversion map

If converted into a standalone research report later, the current evidence naturally supports the following narrative:

1. emergence of endogenous collapse in a nominally self-sustaining agent-based economy;
2. reproducibility and baseline characterization;
3. competing causal hypotheses;
4. counterfactual ablation of labor, demand, credit, supply, accounting, entry and exit explanations;
5. separation of root mechanisms from amplifiers and representation defects;
6. identification of liquidation/restructuring architecture as a major propagation channel;
7. identification of post-restructure payroll infeasibility and repeated-restructure cycles;
8. labor-demand coherence repair candidates;
9. long-horizon and held-out validation;
10. later external empirical calibration/validation against authoritative economic data.

## 11. Evidence-preservation rule from this point forward

For every new major causal closure:

- preserve the hypothesis and intervention definition;
- record executed source commit and workflow run ID;
- record seeds, horizon and scale profile;
- record hard-gate outcomes;
- record key numerical effect sizes, not only qualitative conclusions;
- distinguish timeout/cancellation from model failure;
- store a repository-native closure/synthesis document;
- promote compact machine-readable results into the repository when the artifact contains data needed for later report figures/tables;
- do not rely on finite-retention Actions artifacts as the only evidence.

## 12. Living visualization / report observer

A read-only Economic Lab research dashboard is maintained from the active diagnostic branch:
- source HTML: `economic-lab-dashboard.html`
- source data: `economic-lab-dashboard-data.json`
- live data source: the public raw form of the diagnostic-branch JSON
- intended Pages path: `economic-collapse/`

The repository's established `main` GitHub Pages pipeline has been extended to compose this dashboard as a subpath rather than creating a competing Pages deployment from the diagnostic branch. This preserves the existing site, 3D observer and execution dashboard while giving the economic-collapse research a stable visualization surface.

The dashboard is strictly observational: it may read repository evidence and GitHub Actions job state, but it must not write back into simulation state.

This register is intentionally a living document and should be updated after R4-X full completion and R4-Y/Z closure.