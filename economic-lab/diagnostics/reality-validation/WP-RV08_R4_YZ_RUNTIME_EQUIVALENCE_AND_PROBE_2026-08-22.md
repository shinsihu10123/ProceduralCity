# WP-RV08 R4-Y/Z — Exact Runtime Equivalence + 12m Probe

Date: 2026-08-22
Status: EXECUTING / DIAGNOSTIC INFRASTRUCTURE RECOVERY
Scope: RV08 labor-demand / payroll-coherence frontier only

## 1. Why this recovery exists

The ultra-sharded R4-Y/Z design successfully converted each principal economic regime into an independent GitHub Actions job. Control and production-linked restructuring jobs began completing quickly and producing artifacts, but several settlement / realized / hybrid jobs still reached their per-job wall-clock limit.

Representative failure mode:
- R4-Z original-A / CONSUMER / settlement
- run: 32481366521
- the Node process remained active for the full configured 60 minutes and was then cancelled by Actions;
- only the partial log artifact was uploaded;
- therefore this is an execution-runtime condition, not an economic verdict.

The slow variants create much more severe unemployment / churn states than production-linked staffing, so runtime growth must be separated from the economic result itself.

## 2. State-equivalent diagnostic runtime acceleration

A diagnostic-only fast path was added to `economic-lab/src/markets/labor-market.js`.

It is OFF by default and is activated only when a country has the non-enumerable flag:

`__diagnosticExactLaborRuntime === true`

The fast path changes implementation cost only:
- unemployment queue `shift()` operations are represented with a head index while preserving queue order and RNG draw order;
- firm wage-arrears aggregation is performed in one pass rather than repeated household filtering.

No wage, matching probability, hiring capacity, reservation wage, settlement, debt, tax, production, exit or restructuring rule is changed.

## 3. Exact-equivalence gate

Workflow run: `32524000489`
Commit under test: `f6146870b7e5935ce0840b94f3986f78c2522f32`
Verdict: **PASS**

The verification script compared canonical and accelerated execution using full world fingerprints and a synthetic high-unemployment labor/payroll stress state.

Both original and held-out seeds produced bit-exact state fingerprints.

Observed runtime ratios:
- ECON-RV02-A 8m world: ~4.63s canonical vs ~3.21s accelerated, ~1.44x speedup;
- ECON-RV08-HOLDOUT-E 8m world: ~2.85s vs ~2.75s, ~1.03x;
- synthetic stress speedup: ~1.48x and ~1.07x respectively.

Interpretation:
- the acceleration is state-equivalent on the tested gates;
- the labor queue / payroll aggregation implementation contributes runtime cost;
- however its measured speedup is too small to explain a 60-minute slow-variant job by itself.

Therefore array-shift/payroll aggregation is **not sufficient as the sole explanation** for the slow-variant runtime explosion.

## 4. Economic evidence already available from successful 36m R4-Z shards

Production-linked staffing produces a strong real-activity improvement but an inadmissible payroll-liability tradeoff.

Original A / CONSUMER:
- control unemployment: ~44.49%
- production unemployment: ~8.90%
- control output: ~778
- production output: ~1,013
- control GDP: ~24,342
- production GDP: ~48,143
- control wage arrears: ~229k
- production wage arrears: ~589k
- production terminal arrears: ~1.464M

Original B / CONSUMER production reproduces the pattern:
- unemployment ~9.52%
- arrears ~585k
- terminal arrears ~1.464M

Original A / MATERIALS+CONSUMER production:
- unemployment ~4.81%
- output ~1,640
- arrears ~458k
- terminal arrears ~1.119M

Verified interpretation:
- physical production need can support much higher employment/output;
- realized / settled payroll support remains far below that physical labor requirement;
- physical-production staffing alone is not financially admissible.

Current strongest structural wedge:

`physical labor required for production` ≫ `labor supportable by realized/settled payroll`

## 5. Recovery execution now launched

Two dependency-safe recovery paths are active:

### A. Full-horizon slow-variant exact-runtime recovery

Workflow:
`.github/workflows/economic-lab-rv08-r4-yz-slow-variants-fast-exact.yml`

Scope:
- canonical 24m + restructure 36m;
- original A/B/C + held-out D/E/F;
- CONSUMER + MATERIALS+CONSUMER;
- settlement / realized / hybrid only;
- 72 principal jobs;
- exact-runtime equivalence is a hard prerequisite.

### B. Same-horizon 12m labor-rule probe

Workflow:
`.github/workflows/economic-lab-rv08-r4-yz-12m-probe.yml`

Scope:
- canonical + restructure;
- original A/C + held-out E;
- both productive bases;
- control / production / settlement / realized / hybrid;
- 60 principal jobs;
- all variants compared at the same 12-month horizon.

Purpose:
- obtain an early causal ranking even if the hardest 24m/36m slow variants remain computationally pathological;
- distinguish `arrears cure by sustainable staffing` from `arrears cure by mass unemployment/output destruction`;
- measure whether settlement, realized or hybrid staffing immediately induces firm-churn states.

## 6. Decision rule after probe completion

- If one slow rule lowers arrears while preserving materially better employment/output than control, promote it to a longer-horizon diagnostic candidate.
- If settlement/realized/hybrid only reduce arrears by destroying employment/output, reject them as sufficient repair rules.
- If hybrid is materially better than hard settlement/realized but still too contractionary, next candidate should combine production-linked labor demand with a finite affordability / arrears-cure transition rather than a hard prior-cash ceiling.
- No canonical economic repair is merged at this stage.
