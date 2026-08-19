# WP-RV02 Compact Bounded Evidence — 2026-08-19

Status: **PARTIAL PASS — compact bounded reproduction complete; baseline-scale promotion in progress**

This note records evidence from GitHub Actions run `32197933462` at commit `81a21a40a457a899a80491c2cc929d8a43e722a8`.

Artifacts:

- `economic-lab-wp-rv02-compact-a-m6` — artifact `9346500201`, digest `sha256:596a65b4c4a237d4bf0b929481626da7b22fb6ab4863ee1f9541b8564db338a0`
- `economic-lab-wp-rv02-compact-a-m12` — artifact `9346514951`, digest `sha256:2193b41f3b5a67eb522ed974dae7588d669dc9bd850c50c9bd8c6863b578bd99`

Scope: `compact`, seed `ECON-RV02-A`, 6-month and 12-month bounded runs. No economic mechanism change and no parameter tuning were introduced for this evidence.

## A. VERIFIED EXISTING FACTS

### Gate integrity

Both bounded runs passed all health and diagnostic reconciliation gates.

12-month run:

- all health gates: PASS
- labor stock-flow reconciliation: PASS, max error `0`
- GDP identity reconciliation: PASS, max residual `5.684341886080802e-14`
- firm exit count reconciliation: PASS, max error `0`
- complete country-month coverage: PASS (`48` country-months)
- unemployment-spell coverage: PASS
- pre-exit snapshot reconciliation: PASS (`40/40` exit events)

### Compute envelope

Compact seed A:

- 6 months: `1104.899 ms` simulation time, `184.150 ms/month`
- 12 months: `2002.787 ms` simulation time, `166.899 ms/month`
- 12-month post-simulation RSS: about `236.2 MB`
- 12-month post-simulation heap used: about `147.9 MB`

This bounded scope is computationally safe. It does not explain the earlier multi-seed long-run cancellation by itself.

### Timing of the contraction

At month 6, before any recorded firm exit in this seed:

- unemployment remained below 16.4% in all four countries
- cumulative firm exits were `0` in all four countries
- nevertheless nominal GDP was already below half of its earlier peak in all four countries
- consumption was already below half of its earlier peak in all four countries

Month-6 terminal unemployment:

- AST `11.54%`
- BRN `16.32%`
- CYR `14.44%`
- DRN `13.56%`

The large employment break appears at month 7, concurrently with the first exit wave.

### Exit-linked separations dominate the acute unemployment jump

Month 7 separations / exit-linked separations:

- AST: `23 / 21`
- BRN: `61 / 58`
- CYR: `31 / 31`
- DRN: `31 / 29`

At month 7 there were no vacancies and no hires in any country in this seed.

By month 12 terminal unemployment was:

- AST `77.69%`
- BRN `94.21%`
- CYR `86.67%`
- DRN `89.83%`

All four country runs therefore hit the descriptive `severeTerminalUnemployment` marker.

### Pre-exit state

There were `40` firm exit events in the 12-month run. The pre-exit snapshot refinement reconciled all 40 events exactly.

Across those 40 exits:

- `40/40` had the reconstructed `severePayrollStress` flag
- `40/40` had the reconstructed `liquidityFailure` flag
- `4/40` had the reconstructed `severeCreditStress` flag

These are observations under the current diagnostic definitions, not yet a causal proof that liquidity/payroll stress is the root mechanism.

### Hiring-friction counters are not the dominant observed bottleneck in the acute exit wave

During the month-7 unemployment jump, all countries had zero vacancies, zero hiring-capacity slots, zero scan attempts, and zero hires. In later months, when small numbers of vacancies appeared, vacancy fill rates were often `1.0` despite some reservation-wage or stochastic rejections.

No hiring-capacity-bound or scan-limit-bound vacancies were recorded in months 7–12 in this seed.

### GDP identity is arithmetically consistent, but inventory investment is unusually dominant

The GDP accounting identity reconciles numerically. However, during months 6–12 the absolute inventory-investment term was approximately `0.84–1.09` times nominal GDP in the observed country-months, and the 12-month country summaries report maximum absolute inventory-investment/GDP shares near or above 1:

- AST `0.9913`
- BRN `0.9918`
- CYR `1.0555`
- DRN `1.0883`

This is an accounting-composition observation, not yet a conclusion that the inventory mechanism is wrong.

## B. DIAGNOSTIC LEADS

1. **The contraction begins before the first exit wave.** GDP and consumption have already contracted sharply by month 6, while firm exits remain zero. The root sequence therefore likely begins upstream of exit itself.
2. **Firm exits are an important propagation/amplification channel after the contraction begins.** The month-7 employment break is overwhelmingly exit-linked in this seed.
3. **Vacancy scarcity is more salient than failed matching during the acute collapse.** The model frequently presents no vacancy to match rather than many vacancies that cannot be filled.
4. **Liquidity/payroll stress is a high-priority firm-side precursor.** Every observed exit had the reconstructed liquidity/payroll flags immediately before exit; severe credit misses were much less universal.
5. **GDP composition requires separate diagnosis.** The arithmetic identity is sound, but inventory investment dominates nominal GDP to an unusual degree and may obscure interpretation of output dynamics.

## C. HYPOTHESES — NOT YET VERIFIED

- H-L1: desired-worker dynamics may make vacancy creation too weak after layoffs or exits, creating recovery hysteresis.
- H-L3: demand contraction may cause layoffs and payroll stress before exits, forming a demand-employment-consumption feedback loop.
- H-F1: exits may strongly amplify an already-running contraction through exit-linked worker separation and weak entrant recovery.
- H-G1: inventory accumulation/valuation may amplify or distort measured nominal GDP dynamics.
- H-C1: finance may contribute to propagation, but the current compact seed does **not** support treating severe credit misses as the universal immediate exit trigger.

No hypothesis above is promoted to a mechanism change at WP-RV02.

## D. PROPOSED CHANGE

**None to the economic model at this stage.**

The dependency-safe next action is baseline-scale bounded reproduction: one seed × 6 months, then one seed × 12 months only if the 6-month gate passes. After baseline evidence is available, WP-RV02 can decide whether to promote to multi-seed baseline reproduction or move to a narrower causal diagnostic experiment.
