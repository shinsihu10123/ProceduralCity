# WP-RV08 R4-Y/Z Ultra-Shard — Interim Causal Synthesis

Date: 2026-08-21
Status: PARTIAL / RUNNING
Run: `32481366521`
Launch commit: `823aecc9b06ced8b6508253a322b8cc79cd9cd8a`

## 1. Scope

This is an interim synthesis from completed R4-Y/Z single-regime artifacts. It is not a final Y/Z closure and it does not authorize a canonical repair.

All inspected completed JSON artifacts passed:

- deterministic replay;
- health;
- coverage;
- normalization activation;
- ledger verification;
- general accounting verification;
- GDP arithmetic identity;
- staffing observation;
- finite-row checks.

## 2. First direct same-seed comparison — original A / CONSUMER / 36m restructuring

### Control

- mean unemployment: `44.49%`
- terminal-6m unemployment: `73.41%`
- mean wage arrears: `229,300`
- terminal-6m arrears: `431,722`
- mean linked/current-worker arrears: `121,415`
- mean GDP: `24,342`
- mean sales: `18,851`
- mean output: `778.0`
- exits: `155`
- restructures: `421`
- mean requested workers: `7.45`
- mean physical-production workers: `30.20`
- mean settlement-supportable workers: `3.92`
- mean realized-contribution-supportable workers: `3.27`

### Production-need staffing

- mean unemployment: `8.90%`
- terminal-6m unemployment: `13.82%`
- mean wage arrears: `588,698`
- terminal-6m arrears: `1,463,704`
- mean linked/current-worker arrears: `503,818`
- mean GDP: `48,143`
- mean sales: `23,220`
- mean output: `1,012.6`
- exits: `49`
- restructures: `661`
- mean requested workers before intervention: `11.33`
- mean physical-production workers selected: `31.87`
- mean settlement-supportable workers: `4.15`
- mean realized-contribution-supportable workers: `3.52`

## 3. Effect size of production-need staffing in original A / CONSUMER

Relative to control:

- unemployment: `44.49% → 8.90%` (`-35.59 pp`)
- terminal unemployment: `73.41% → 13.82%` (`-59.59 pp`)
- output: `778.0 → 1,012.6` (`+30.1%`)
- GDP: `24,342 → 48,143` (`+97.8%`)
- exits: `155 → 49` (`-68.4%`)
- mean arrears: `229,300 → 588,698` (`2.57×`)
- terminal arrears: `431,722 → 1,463,704` (`3.39×`)
- linked/current-worker arrears: `121,415 → 503,818` (`4.15×`)
- restructures: `421 → 661` (`+57.0%`)

This is not an admissible repair despite the dramatic employment/output gain. The expansion is largely financed through unpaid payroll obligations.

## 4. Important causal correction

The early R4-X frontier used the shorthand that labor demand / retained workforce may be "over-estimated."

R4-Z now forces a more precise statement.

In the original A CONSUMER control, the canonical requested workforce is usually **below physical production need**, not above it:

- requested workers ≈ `7.45`
- physical-production requirement ≈ `30.20`
- only ~`6.4%` of staffing observations have requested workers above the physical requirement.

At the same time, requested workforce is frequently **above financially sustainable labor**:

- settlement-supportable ≈ `3.92`
- realized-contribution-supportable ≈ `3.27`
- requested exceeds realized-supportable labor in ~`80.0%` of observations.

Therefore the stronger present formulation is:

> **The model contains a wedge between physical production labor requirements and financially sustainable payroll capacity.**

Canonical labor demand is often too low to meet physical production plans while simultaneously too high to be supported by realized operating contribution or actual payroll settlement.

This is a deeper production–revenue–payroll coherence defect than a simple "too many workers" rule.

## 5. Cross-seed production signal

Original B / CONSUMER / production-need staffing also completed and passed all gates:

- mean unemployment: `9.52%`
- terminal unemployment: `16.93%`
- mean arrears: `585,084`
- terminal arrears: `1,463,749`
- linked/current-worker arrears: `486,996`
- GDP: `45,889`
- output: `1,016.9`
- exits: `39`
- restructures: `740`
- physical workers selected: `31.54`
- realized-supportable workers: `3.50`

The combination `very low unemployment + very high current-worker arrears + repeated restructuring` therefore reproduces beyond original seed A.

## 6. Production-base interaction

Original A / MATERIALS+CONSUMER / production-need staffing:

- mean unemployment: `4.81%`
- terminal unemployment: `9.19%`
- mean arrears: `458,282`
- terminal arrears: `1,119,390`
- linked/current-worker arrears: `416,968`
- GDP: `50,113`
- sales: `34,305`
- output: `1,640.2`
- exits: `18`
- restructures: `715`
- physical workers selected: `23.34`
- realized-supportable workers: `4.68`

The broader productive normalization improves physical throughput and reduces the arrears burden relative to CONSUMER-only production staffing, but payroll sustainability is still severely violated.

## 7. Additional controls already completed

Original C / CONSUMER control, 36m restructuring:

- mean unemployment: `46.16%`
- terminal unemployment: `76.49%`
- mean arrears: `226,056`
- terminal arrears: `413,236`
- exits: `172`
- restructures: `424`.

Held-out E / MATERIALS+CONSUMER control, 36m restructuring:

- mean unemployment: `28.83%`
- terminal unemployment: `49.03%`
- mean arrears: `239,020`
- terminal arrears: `495,887`
- exits: `84`
- restructures: `461`.

These controls confirm that the collapse/restructuring pattern remains present outside original A.

## 8. Interim hypothesis verdicts

### H-YZ-1: canonical requested labor is simply above physical production need

**FALSIFIED / TOO SIMPLE.**

In the inspected control, requested labor is predominantly below physical production need.

### H-YZ-2: canonical requested labor exceeds realized/settlement-supported payroll capacity

**SUPPORTED.**

Requested labor frequently exceeds both realized-contribution and settlement ceilings.

### H-YZ-3: staffing purely to physical production need is a valid repair

**FALSIFIED AS A PRODUCTION REPAIR CANDIDATE.**

It creates a large employment/output expansion but multiplies current-worker arrears and restructuring frequency.

### H-YZ-4: the dominant architecture problem is a production–revenue–payroll coherence wedge

**STRONGLY SUPPORTED AS THE CURRENT FRONTIER.**

The labor quantity required by physical plans and the labor quantity that firms can sustainably pay are far apart.

## 9. First completed hard-hybrid result — original C / CONSUMER / canonical 24m

A full 24-month R4-Y hybrid shard completed and passed all hard gates.

Same seed/base comparison:

### Control
- mean unemployment: `48.21%`
- terminal unemployment: `83.92%`
- mean arrears: `112,326`
- terminal arrears: `183,293`
- linked/current-worker arrears: `24,254`
- GDP: `24,879`
- output: `873.4`
- exits: `227`

### Production-linked
- mean unemployment: `22.59%`
- terminal unemployment: `55.66%`
- mean arrears: `256,107`
- terminal arrears: `562,748`
- linked/current-worker arrears: `143,754`
- GDP: `42,397`
- output: `1,173.9`
- exits: `257`

### Hard hybrid = min(physical-production labor, prior realized-contribution labor)
- mean unemployment: `87.26%`
- terminal unemployment: `95.23%`
- mean arrears: `0`
- terminal arrears: `0`
- linked/current-worker arrears: `0`
- GDP: `8,049`
- output: `241.2`
- exits: `0`
- mean chosen workers: `2.23`
- mean physical requirement: `36.20`

This is a decisive warning against a hard affordability ceiling.

The hybrid rule solves wage arrears by collapsing employment and real activity. Relative to control it raises mean unemployment by roughly `39.1 pp`, cuts output by roughly `72.4%`, and cuts GDP by roughly `67.6%`.

The zero-exit result must not be read as economic health: the rule eliminates payroll stress by retaining almost no labor, leaving a low-employment, low-output economy rather than restoring viable firms.

### H-YZ-5: hard physical×realized hybrid is a sufficient repair

**FALSIFIED ON THE FIRST FULL 24m COMPLETION.**

It is financially conservative but economically destructive.

This strengthens the next architectural direction: affordability should constrain labor adjustment through a **bounded transition / arrears-cure mechanism**, not through an immediate hard cap to prior realized contribution.

## 10. Runtime recovery and equivalence result

Several settlement/realized/hybrid jobs time out before producing JSON. This remains classified as an execution-runtime condition, not an economic verdict.

A diagnostic-only exact labor/payroll runtime fast path was introduced and independently verified:

- equivalence run: `32524000489`
- verdict: **PASS**
- canonical and accelerated executions produced bit-exact world fingerprints on original and held-out seeds plus a synthetic high-unemployment stress test.

Measured speedup was only about `1.03×–1.44×` in 8-month world runs and `1.07×–1.48×` in the synthetic labor/payroll stress test. Therefore the queue/payroll implementation cost is real but is not sufficient to explain the very large slow-variant runtime explosion.

A same-horizon 12-month probe has also been launched across control / production / settlement / realized / hybrid so that causal ranking does not depend on waiting for every pathological 24m/36m trajectory.

## 11. Remaining decisive comparisons

Still required for closure:

- settlement and realized economic direction at a common horizon;
- hybrid replication beyond original C / CONSUMER;
- original versus held-out consistency;
- whether slower variants create runtime explosion through firm/state churn rather than the labor-market queue itself;
- whether any bounded rule can reduce arrears without destroying employment/output.

Final verdict remains `PARTIAL — RUNNING`.
