# WP-RV08 R4-Q/R/S/U Completed-Shard Interim Synthesis

Date: 2026-08-21
Status: **PARTIAL — STRONG CROSS-SEED SIGNAL; QRSTU WORKFLOW STILL RUNNING**
Frozen economic implementation baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`
Executed QRSTU source commit: `9956ad91c281aca16023d7b17921849c07f4a36f`
Workflow run: `32451260894`
Canonical mechanism changes: **0**
Parameter tuning: **0**
Empirical realism claim: **NO**

This document records only completed shards. It does not close QRSTU while compact-Q and remaining 48m jobs are still running.

## A — VERIFIED EXISTING FACT: Q baseline A/B/C now agrees on the main interaction

All completed 36m baseline Q shards A/B/C passed observer non-interference, deterministic replay, health, normalization/restructure/estate/supply activation, physical-estate conservation, ledger/accounting and GDP arithmetic gates.

Across all three baseline seeds, adding topo-fullcash supply to operating-rule restructure+estate improves the 36m FULL unemployment result, with the largest and most consistent effect in the MATERIALS+CONSUMER base.

### Seed B newly recovered

| Variant | FULL unemployment | Exits | Mean arrears | Consumer output | GDP |
|---|---:|---:|---:|---:|---:|
| consumer control | 0.6316 | 327 | 140,756 | 63.2 | 17,733 |
| consumer restructure+estate | 0.4657 | 139 | 229,467 | 80.0 | 24,141 |
| consumer restructure+estate+supply | 0.4421 | 145 | 227,070 | 84.4 | 26,128 |
| materials-consumer control | 0.6025 | 330 | 134,043 | 79.8 | 19,940 |
| materials-consumer restructure+estate | 0.3426 | 49 | 234,187 | 133.3 | 29,368 |
| materials-consumer restructure+estate+supply | 0.3015 | 42 | 224,125 | 166.9 | 32,810 |

The same direction was already present in A and C. In A, materials-consumer FULL unemployment fell from about `0.3074 -> 0.2573`; in C, from about `0.3129 -> 0.2658` when supply relief was added to restructure+estate. Arrears remained very high in every operating-restructure variant.

### Interim Q verdict

**SUPPORTED, NOT YET CLOSED — SUPPLY RELIEF BECOMES A REPRODUCIBLE COMPLEMENT AFTER THE LABOR/EXIT ARCHITECTURE IS PARTIALLY COHERED, ESPECIALLY IN MATERIALS+CONSUMER. IT DOES NOT BY ITSELF SOLVE THE ARREARS DISCIPLINE FAILURE.**

## A — VERIFIED EXISTING FACT: held-out recoverability ranking reproduces on D/E/F

Held-out S shards D/E/F all completed successfully and reproduce the same ordering observed on original seeds:

`control > realized-only > operating > multi` for unemployment, while the more permissive rules generally carry larger wage-arrears stocks.

Examples:

- D, consumer: `0.5294 -> 0.5138 -> 0.3798 -> 0.2980` unemployment; operating arrears `159,492`, multi `180,901`.
- D, materials-consumer: `0.5023 -> 0.4635 -> 0.2735 -> 0.2342`; operating arrears `157,964`, multi `174,261`.
- E, consumer: `0.4628 -> 0.4496 -> 0.3035 -> 0.2415`; operating arrears `146,223`, multi `165,878`.
- E, materials-consumer: `0.4199 -> 0.3679 -> 0.2034 -> 0.1729`; operating arrears `138,269`, multi `152,996`.
- F reproduced the same pattern: consumer operating about `0.3077`, multi about `0.2537`; materials-consumer operating about `0.2113`, multi about `0.1923`.

### Interim S verdict

**PASS — THE RECOVERABILITY TRADE-OFF IS NOT AN A/B/C-SEED ARTIFACT. LOWER EXIT/UNEMPLOYMENT UNDER OPERATING/MULTI RULES GENERALIZES TO HELD-OUT SEEDS, AND SO DOES THE ARREARS PENALTY.**

## A — VERIFIED EXISTING FACT: held-out supply interaction is real but heterogeneous

Held-out U D/E/F also all passed hard gates.

For MATERIALS+CONSUMER, adding supply relief to restructure+estate produced the following FULL unemployment changes:

- D: `0.2735 -> 0.2639`
- E: `0.2034 -> 0.1584`
- F: `0.2113 -> 0.1710`

It also raised physical output/sales substantially in E/F, and reduced mean arrears in all three held-out materials-consumer comparisons:

- D: `157,964 -> 153,220`
- E: `138,269 -> 120,582`
- F: `135,294 -> 123,696`

Consumer-only interaction is weaker and heterogeneous: D improves modestly, E is approximately neutral/slightly worse on FULL unemployment, and F improves materially.

### Interim U verdict

**PASS — SUPPLY COMPLEMENTARITY UNDER RESTRUCTURING GENERALIZES STRONGLY IN MATERIALS+CONSUMER, BUT IS NOT A UNIVERSAL MONOTONIC EFFECT IN THE CONSUMER-ONLY BASE.**

## A — VERIFIED EXISTING FACT: long-horizon recoverability benefit persists, arrears accumulate

Completed R seed A at 48m passed all gates. Relative to control, operating/multi restructuring retains a large unemployment advantage at 48m, but arrears roughly double or more:

- consumer control FULL u `0.7046`, arrears `155,379`;
- consumer operating u `0.5253`, arrears `302,737`;
- consumer multi u `0.4356`, arrears `365,129`;
- materials-consumer control u `0.6558`, arrears `163,722`;
- materials-consumer operating u `0.3685`, arrears `293,162`;
- materials-consumer multi u `0.3235`, arrears `325,252`.

This is consistent with the 24m O/P result and strengthens the arrears-discipline concern. Remaining R seeds are required before closure.

## B — DIAGNOSTIC LEAD: arrears stock may contain detached former-worker claims

Source inspection of `src/markets/labor-market.js` shows that payroll arrears are serviced only when a household is currently employed and has a live `employerId`. Layoff clears the employment link but does not clear the household's existing `wageArrears`. Meanwhile the macro arrears stock sums every household's arrears, employed or not.

Therefore the observed post-restructure arrears divergence may contain two economically distinct stocks:

1. current-worker arrears caused by insufficient ongoing payroll cashflow;
2. valid former-worker wage claims that survive separation but no longer have an employer linkage through which the current payroll routine can service them.

This is **not** evidence that former-worker arrears should be erased. It is evidence that the model may lack a wage-claim liability/estate-settlement state after employment termination.

R4-V/W has been launched separately to quantify this decomposition before any settlement repair is admitted.

## Current causal frontier

The strongest current architecture is now:

`operating recoverability + bounded workforce resize` substantially reduces destructive binary exit,

while

`upstream supply access` becomes a meaningful complement once firms survive long enough to use it,

but

`wage-arrears discipline` remains the admission blocker.

The arrears blocker must now be split into **ongoing payroll insolvency** versus **detached legacy wage claims after separation**. Production admission remains prohibited until that split is measured and long-horizon original/held-out evidence is complete.
