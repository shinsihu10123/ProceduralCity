# WP-RV07-P9 Closure — Stockout-Censored Sales Feedback Causal Ablation

Date: 2026-08-20

## Verdict

**FAIL-CONTINUE — HARD GATES PASS; CANDIDATE REJECTED AS DOMINANT RESIDUAL REPAIR**

The diagnostic intervention executed correctly and all hard gates passed. The hypothesis that downward-censored realized sales are a dominant driver of the remaining collapse is **not supported at material macro scale** by this ablation.

## Execution evidence

- Workflow run: `32281441496`
- Job: `96160925631`
- Head SHA under test: `5ccb0769f42378eee90efafe6c9d94089dbde4dd`
- Artifact: `economic-lab-wp-rv07-p9`
- Artifact ID: `9376019294`
- Artifact digest: `sha256:6ad35dc62e91f473e6d8933a33a89cdeed4acbc2f05f233f79ee8b5fd8b90693`

All hard gates passed:

- deterministic replay exact
- health
- complete coverage
- first-month outcome parity
- control never mutates the prior-sales anchor
- correction rule validity
- correction applied only to diagnosed censoring cases
- ledger verification
- GDP identity reconciliation
- finite rows

Maximum GDP identity residual: `1.4551915228366852e-11`.

## A — VERIFIED EXISTING FACTS / EXECUTION RESULTS

### Baseline scale, full 12-month window

Control:

- mean unemployment: `0.2514`
- exits: `248`
- mean wage arrears: `64933.2`
- goods fulfillment: `0.5575`
- mean input shortage: `40.614`
- consumer output: `118.586`
- mean previousSales: `8.659`

Stockout-censor hold candidate:

- mean unemployment: `0.2511`
- exits: `247`
- mean wage arrears: `64981.2`
- goods fulfillment: `0.5557`
- mean input shortage: `40.226`
- consumer output: `118.198`
- mean previousSales: `22.499`
- corrected cases: `2046`

Candidate minus control, full window:

- unemployment: `-0.0002943`
- exits: `-1`
- wage arrears: `+47.99`
- goods fulfillment: `-0.001741`
- mean input shortage: `-0.3875`
- consumer output ratio: `0.99672`
- nominal sales ratio: `0.99943`
- previousSales ratio: `2.59839`
- desiredProduction ratio: `0.999887`
- demand-belief difference: `+0.0000195`
- mean GDP difference: `+76.79`

### Critical diagnostic observation

The intervention raised the `previousSales` anchor very substantially while barely changing planned production:

- full-window baseline `previousSales` ratio: `2.598x`
- full-window baseline `desiredProduction` ratio: `0.999887x`

The same disconnect appears earlier:

- M1-3 previousSales ratio `1.468x`, desiredProduction ratio `1.000x`
- M4-6 previousSales ratio `3.030x`, desiredProduction ratio `1.000x`
- M7-9 previousSales ratio `3.321x`, desiredProduction ratio `1.00026x`
- M10-12 previousSales ratio `3.799x`, desiredProduction ratio `0.99915x`

Thus the ablation changed the sales-memory signal strongly, but that signal did not materially propagate into production planning or the macro trajectory.

## B — DIAGNOSTIC LEADS

1. `previousSales` is not the binding term for most production plans under the unit-basis candidate.
2. Another component of `planProduction` is likely dominating the plan:
   - the `targetInventory * 0.42` demand anchor,
   - replenishment,
   - the capacity cap `capacity * 1.08`,
   - or a combination of these.
3. The remaining late collapse should therefore be decomposed at the exact production-plan binding-term level before another repair candidate is attempted.

## C — HYPOTHESIS STATUS

### H-P9-1

> Downward-censored realized sales are the dominant remaining feedback that drives production contraction.

**FALSIFIED AS A DOMINANT RESIDUAL CAUSE.**

### H-P9-2

> Preventing stockout-censored sales from lowering the next-month sales anchor materially improves unemployment, exits, fulfillment, and production.

**NOT SUPPORTED.**

### H-P9-3

> The sales-memory signal is currently being masked by another binding production-plan term.

**SUPPORTED AS THE NEXT DIAGNOSTIC LEAD**, because `previousSales` rose by roughly 2.6x over the full baseline window while `desiredProduction` remained effectively unchanged.

## D — CHANGE AUTHORITY

- canonical mechanism changes: **0**
- parameter tuning: **0**
- repair merge: **0**
- empirical realism claim: **NO**

The stockout-censor hold remains diagnostic only and is **not merge-ready**.

## Next dependency-safe step

Proceed to **WP-RV07-P10 — Production Plan Binding-Term Decomposition**.

P10 must observe the exact frozen planning equation and classify, by firm/month/industry/window:

- which `demandAnchor` branch wins: `previousSales`, `targetInventory * 0.42`, or floor `2`;
- expected-demand contribution;
- replenishment contribution;
- unconstrained plan;
- capacity cap;
- which term actually binds `desiredProduction`;
- later output/input constraint relative to the plan.

No ablation or parameter change is authorized in P10.