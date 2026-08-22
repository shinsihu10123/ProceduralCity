# WP-RV08 R4-BC2 — Corrected Cognitive Synchronization Attribution Closure

Date: 2026-08-23
Run: `32572553486`
Coverage: 16/16 simulations, 4 seeds × 4 decision-system variants, 36 months
Verdict: **PASS — cognition-as-primary-synchronizer falsified**

## Correction from R4-BC

R4-BC's legacy-firm observer originally read only `currentPlan.selected`. The existing legacy firm decision path stores its action label under `currentPlan.name`. R4-BC2 corrected the observer to read:

`currentPlan.selected || currentPlan.name || cognitive decision history`.

All R4-BC2 jobs passed the economic/accounting observation gates.

## Four-seed means

| Variant | Firm top-action share | CONSUMER top-action share | Household top-action share | Mean unemployment | Late unemployment | Terminal unemployment | Terminal output |
|---|---:|---:|---:|---:|---:|---:|---:|
| control cognitive | 57.10% | **79.26%** | 47.71% | 42.41% | 64.19% | 81.51% | 14.73 |
| legacy firms | **67.59%** | **89.56%** | 47.67% | 42.66% | 64.97% | 80.31% | 17.08 |
| legacy households | 55.17% | 76.21% | **85.25%** | 45.96% | 67.83% | 82.09% | 9.11 |
| legacy both | 65.19% | 85.93% | **85.13%** | 45.28% | 67.87% | 82.61% | 10.74 |

## Firm synchronization result

Replacing cognitive firms with the existing legacy firm rule did **not** diversify firm behavior. It increased mean top-action share by about **+10.49 percentage points** for all firms and **+10.30 percentage points** for CONSUMER firms; CONSUMER action entropy fell sharply.

Therefore:

**H-BC2-F1 — sophisticated cognitive AI is the primary source of firm synchronization: FALSIFIED.**

The current cognitive layer is, if anything, more behaviorally diverse than the simpler legacy rule in this experiment. The common economic environment, common constraints, and/or the limited action-policy structure are stronger synchronization candidates.

This does not mean cognitive reasoning is economically optimal. Legacy-firm replacement produced heterogeneous seed-level macro effects and on average reduced terminal GDP while changing terminal unemployment only modestly. The synchronization result is specifically about attribution, not welfare.

## Household synchronization result

Replacing cognitive households with the legacy household rule increased household top-action share from **47.71% to 85.25%**, a **+37.54 percentage-point** jump, and reduced household action entropy substantially.

It also raised mean unemployment by **+3.55 percentage points**, late unemployment by **+3.63 points**, and reduced late consumption by about **854** in the four-seed average.

Therefore:

**H-BC2-H1 — cognitive households create excessive herd behavior: FALSIFIED.**

**H-BC2-H2 — the simpler common rule is substantially more synchronized and economically contractionary in this tested state: SUPPORTED.**

## Integrated interpretation

The high synchronization observed in R4-AZ is real, especially among CONSUMER firms, but it should not be blamed on the advanced cognition subsystem. Removing cognition makes the action distribution more concentrated, not less.

The active causal lead is now:

`shared structural stress + limited/common action mappings -> correlated responses`

rather than:

`advanced cognition -> herd behavior -> collapse`.

Future work should therefore examine the common signals and institutional constraints that push many firms into the same action region. A generic attempt to add more randomness or disable cognition would be unsupported and, for households, likely harmful.

No canonical AI change is authorized by this closure.
