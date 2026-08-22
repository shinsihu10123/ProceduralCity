# WP-RV08 R4-BE2 — Compact New-Credit Stabilizer Replication Closure

Date: 2026-08-23
Run: `32583730272`
Coverage: 8/8 simulations, 4 seeds × control/no-new-credit, 24 months
Verdict: **PASS — current credit is a weak real stabilizer, not a sufficient repair**

## Why BE2 was required

The 36-month R4-BE fiscal/stabilizer matrix completed all non-credit variants, but the four `no-new-credit` shards exceeded runtime. BE2 repeated only the unresolved credit leg over 24 months and completed all seed pairs.

## Paired four-seed mean: no-new-credit minus control

- mean unemployment: **+1.87 percentage points**
- late unemployment: **+1.90 percentage points**
- terminal unemployment: **-0.02 percentage points** (effect disappears inside the late collapse attractor)
- terminal GDP: **-32.6** on average, highly seed-heterogeneous
- terminal output: **+1.45**, highly seed-heterogeneous
- terminal wage arrears: **-1,808**
- terminal active firms: essentially unchanged (**+0.06**)
- total exits: **-6.5**
- total consumption: **-48,478**
- total investment: **-10,240**
- transfers: **+78,543** as fiscal transfers partly compensate the weaker private-income/credit path

Control created about **52,526** of new credit per seed on average over the horizon; the removal arm created zero by construction.

## Interpretation

The current credit system has a measurable stabilizing role during the transition: removing new credit raises average and late-period unemployment and materially reduces cumulative consumption and investment.

However, the stabilizer is weak and does not change the terminal collapse attractor. By month 24 both arms remain severely depressed, terminal unemployment is almost unchanged in the four-seed mean, and output/GDP effects are inconsistent by seed.

Removing credit also slightly reduces wage arrears and exits on average. This is consistent with prior evidence that current lending can support demand/liquidity while also adding debt-service/default stress. Therefore credit is neither purely helpful nor the root of the collapse.

### Hypothesis verdicts

- **BE2-1 — current new credit is completely irrelevant: FALSIFIED.** It has a real transitional stabilizing effect.
- **BE2-2 — current credit is sufficient to prevent collapse: FALSIFIED.** The terminal attractor is essentially unchanged.
- **BE2-3 — expanding the existing credit rule alone is an admissible repair: NOT SUPPORTED.** Prior AK/AL evidence shows liquidity finance can transform arrears into persistent/defaulting debt, while BF-BK shows mean underwriting approval of only about 2.1% under the current architecture.

## Next credit question

The appropriate next banking investigation is not a generic loan-volume increase. It is to decompose rejection and borrower quality:

`application need -> underwriting rejection/capital cap -> origination -> productive use -> repayment/default`.

That will distinguish an excessively restrictive bank from an economy whose applicants are genuinely non-repayable under current production/payroll structure.

No canonical credit-policy change is authorized.
