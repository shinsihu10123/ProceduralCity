# WP-RV08 R4-L/M/N Superbatch Closure

Date: 2026-08-21
Status: **PASS — ACCOUNTING REPRESENTATION DEFECT CONFIRMED; TAX-FEEDBACK ROOT HYPOTHESIS FALSIFIED; ESTATE PROPAGATION REMAINS MATERIAL BUT INSUFFICIENT**
Frozen economic implementation baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`
Executed source commit: `a1b42d428afa0ef922bca78612df10d3f1dee7a3`
Canonical mechanism changes: **0**
Parameter tuning: **0**
Empirical realism claim: **NO**

## Execution evidence

Workflow run: `32436396970` — **SUCCESS**

| Track | Job ID | Artifact | Artifact ID | SHA-256 |
|---|---:|---|---:|---|
| R4-L recognition timing × tax boundary | `96638368250` | `economic-lab-wp-rv08-r4-l` | `9430951298` | `afa427c757dc1234a285598a1934fe1cebdf881370a32b57e37fce7347def797` |
| R4-M recognition scope upper bound | `96638368121` | `economic-lab-wp-rv08-r4-m` | `9430971212` | `e53bc1599089df16166aaf24ba8323c0a3b4aa4cc1879007f89979deafdc860b` |
| R4-N accounting × estate 2×2 | `96638368229` | `economic-lab-wp-rv08-r4-n` | `9430991077` | `e79bfb76cb35ff320acdedb8164bb5e44d6cfc9a49d8a897d68fce91e8a9f5fc` |

All jobs completed successfully. All hard gates passed: exact observer non-interference, deterministic replay, health, complete compact/baseline × three-seed × 24-month coverage, normalization activation, recognition activation, estate activation where applicable, physical-estate conservation, settlement ledger, general accounting, GDP arithmetic identity and finite rows.

The accounting interventions are diagnostic journal reclassifications only. They do not change household wage accrual, wage settlement, physical production, procurement, prices, underwriting thresholds or tax rates.

## R4-L — Recognition timing × corporate-tax boundary

The tested zero-output reclassification moves current production-labor book value from finished-goods inventory to `cogs` when current physical output is zero.

Baseline FULL results:

| Base | Variant | Unemployment | Exits | Mean arrears | Corporate tax | Mean firm cash | Mean GDP | Mean inventory investment | Mean book finished | Mean physical finished |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CONSUMER | control | `0.475321` | `666` | `108,454` | `123,468` | `105,170` | `25,098` | `9,343` | `204,219` | `502.3` |
| CONSUMER | zero-output after tax | `0.482665` | `678` | `109,264` | `125,053` | `105,343` | `18,866` | `3,464` | `140,441` | `500.7` |
| CONSUMER | zero-output before tax | `0.485040` | `687` | `110,195` | `124,306` | `104,443` | `18,630` | `3,550` | `142,289` | `502.0` |
| MATERIALS+CONSUMER | control | `0.439944` | `644` | `101,604` | `140,801` | `112,821` | `27,798` | `9,429` | `209,884` | `580.6` |
| MATERIALS+CONSUMER | zero-output after tax | `0.454443` | `645` | `104,402` | `142,774` | `111,293` | `21,459` | `4,003` | `148,957` | `580.2` |
| MATERIALS+CONSUMER | zero-output before tax | `0.452297` | `642` | `105,091` | `140,027` | `111,359` | `21,454` | `4,075` | `149,721` | `583.8` |

### A — VERIFIED EXISTING FACT

1. Reclassifying zero-output labor materially removes book finished-goods inventory and inventory-investment GDP while leaving physical finished inventory almost unchanged. The representation defect is therefore real and large.
2. Moving the reclassification from after-tax to before-tax does **not** produce a material macro rescue. The before-vs-after unemployment difference is only about `+0.237 pp` on CONSUMER and `-0.215 pp` on MATERIALS+CONSUMER.
3. The corporate-tax response is not consistent with the proposed root mechanism. Before-tax recognition changes aggregate corporate tax relative to after-tax by only about `-747` on CONSUMER and `-2,747` on MATERIALS+CONSUMER over the FULL baseline comparison, while unemployment remains worse than control.
4. R4-K had already shown zero measured corporate-tax outflow in the exit-candidate cash-flow group. R4-L now causally rejects the claim that the zero-output capitalization defect is materially driving the collapse through same-month corporate-tax cash drain.

### Verdict

**PASS — ZERO-OUTPUT LABOR CAPITALIZATION IS A SEVERE ACCOUNTING/NIA REPRESENTATION DEFECT, BUT THE HYPOTHESIZED CORPORATE-TAX LIQUIDITY CHANNEL IS NOT A MATERIAL COLLAPSE ROOT.**

## R4-M — Recognition scope upper bound

The broad `all-before-tax` variant expenses all current production-labor capitalization, including positive-output contexts. This is an intentionally aggressive diagnostic upper bound and is not a proposed accounting rule.

Relative to control at baseline FULL:

- CONSUMER all-labor reclassification: unemployment `+1.936 pp`, exits `+13`, arrears `+3,541`, mean firm cash `-3,512`, mean GDP `-12,061`, mean book finished inventory `-165,907`.
- MATERIALS+CONSUMER all-labor reclassification: unemployment `+1.366 pp`, exits `+4`, arrears `+3,121`, mean firm cash `-795`, mean GDP `-11,486`, mean book finished inventory `-163,887`.

### A — VERIFIED EXISTING FACT

1. The accounting defect is not hiding a latent macro recovery that appears once labor capitalization is broadly removed.
2. Pure journal reclassification can materially change reported GDP/book assets and can alter downstream decision/accounting states, but it does not repair objective operating cash generation.
3. A broad `expense all labor` rule is not admissible as a production repair from this evidence and is economically over-broad.

### Verdict

**PASS — ACCOUNTING SCOPE CORRECTION ALONE IS NOT A MACRO REPAIR; THE BROAD UPPER BOUND WORSENS REAL SURVIVAL/EMPLOYMENT METRICS.**

## R4-N — Accounting × estate interaction

Baseline FULL comparison:

### CONSUMER base

- estate only: unemployment `-1.227 pp`, exits `-127`, arrears `-2,132`, firm cash `+9,682`, consumer output `×1.165` vs control;
- zero-output accounting only: unemployment `+0.972 pp`, exits `+21`, arrears `+1,741`;
- accounting + estate: unemployment `+0.405 pp`, exits `-102`, firm cash `+7,900`, consumer output `×1.098` vs control.

Relative to estate-only, adding zero-output accounting recognition **worsens** unemployment by about `1.632 pp`, adds `25` exits and lowers consumer output by about `5.7%`.

### MATERIALS+CONSUMER base

- estate only: unemployment `-0.792 pp`, exits `-145`, arrears `-4,517`, firm cash `+14,628`, consumer output `×1.218` vs control;
- zero-output accounting only: unemployment `+1.235 pp`, exits `-2`, arrears `+3,487`;
- accounting + estate: unemployment `-0.983 pp`, exits `-154`, arrears `-3,315`, firm cash `+14,262`, consumer output `×1.226` vs control.

Relative to estate-only, adding accounting recognition improves unemployment by only about `0.191 pp` and output by less than `1%`, while mean arrears are higher by about `1,202`.

### Verdict

**PASS — ESTATE RECYCLING REMAINS A REAL CAUSAL PROPAGATION CHANNEL. ACCOUNTING RECOGNITION DOES NOT PROVIDE A ROBUST COMPLEMENT: THE INTERACTION CHANGES SIGN ACROSS BASES AND IS SMALL OR ADVERSE.**

## Cross-batch causal synthesis

### A — VERIFIED EXISTING FACTS

1. Physical/accounting divergence must be repaired for semantic correctness and later empirical validation, but it is now separated from the primary collapse root.
2. The proposed `book profit -> corporate tax -> cash drain -> exit` route is not materially supported.
3. Destructive exit/estate stranding remains a material causal amplifier and preserves a clear production-repair role, but it is insufficient by itself.
4. R4-K objective cash-flow evidence remains controlling: exit candidates are overwhelmingly liquidity/payroll-distress cases with genuine operating inflow shortfalls; severe credit stress is a minority condition and candidate corporate-tax cash outflow is effectively zero.
5. Therefore the next root question is **why operating inflows fail to support payroll and necessary inputs after the already-tested unit/capacity and supply relief**, not whether nominal book GDP is masking enough taxable cash to create the collapse.

### B — DIAGNOSTIC LEAD

The strongest remaining internal architecture is:

`independent labor-demand / production-plan semantics + incomplete realized demand/throughput -> operating contribution below payroll and input obligations -> arrears/liquidity distress -> binary exit -> estate stranding / weak regeneration -> further demand and supply contraction`.

Source architecture supports this frontier: labor demand is selected before production planning, while `planProduction()` derives actual capacity from current workers and separately derives desired production from expected demand/inventory. Exit candidates in R4-K frequently retain workers and payroll obligations while realized output/sales are zero or far below the contribution required to support those workers.

### C — HYPOTHESES FOR NEXT CAUSAL BATCH

1. **H-O1:** A substantial share of exit candidates are organizationally recoverable by downsizing to an objectively supportable workforce instead of binary liquidation.
2. **H-O2:** Preserving the firm shell alone is insufficient if payroll is not resized; a restructure state transition should outperform a simple exit guard on arrears discipline.
3. **H-P1:** Combining bounded operational restructuring with orderly estate recycling for genuinely nonrecoverable firms should preserve more employment/output than either binary exit or estate recycling alone without approaching the arrears explosion of blanket no-exit.
4. **H-Q1:** Supply relief may become complementary after labor/exit state coherence is repaired, even though it was non-additive with the looser multi-potential guard in R4-J.
5. **H-Q2:** If a restructure-or-liquidate architecture still collapses at 24–36 months, the remaining root is primarily operating-demand/production coordination rather than exit semantics.

## D — PROPOSED CHANGE STATUS

No canonical mechanism is approved or merged.

The next intervention may test a diagnostic **restructure vs liquidate state machine** using only current model quantities:

- realized operating contribution;
- recent-demand contribution;
- capacity contribution at current margin;
- cash plus saleable stock;
- current wage and worker count;
- severe-credit flag;
- existing distress state.

No coefficient fitting, unemployment target, tax-rate change, debt forgiveness or money creation is authorized.

## Overall verdict

**PASS — R4-L/M/N CLOSES THE ACCOUNTING-TAX CAUSAL BRANCH. ACCOUNTING/NIA REPAIR REMAINS REQUIRED FOR REPRESENTATION INTEGRITY, BUT THE COLLAPSE FRONTIER RETURNS TO REAL OPERATING CONTRIBUTION, LABOR/PRODUCTION COHERENCE, AND DESTRUCTIVE EXIT/ESTATE PROPAGATION.**

Next dependency-safe batch: **R4-O/P/Q — bounded restructure-vs-liquidate state machine + estate disposition + supply complementarity, with 24-month full coverage and an independent longer-horizon persistence job.**
