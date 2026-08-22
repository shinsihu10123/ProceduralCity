# WP-RV08 R4-AL / R4-AM Closure — Payroll Shortfall Persistence & Revenue-Supported Staffing Envelope

Date: 2026-08-22

## Verdict

**R4-AL: PASS — PAYROLL SHORTFALL IS PREDOMINANTLY RECURRENT / STRUCTURAL, NOT A ONE-MONTH TIMING EVENT**

**R4-AM: PASS — A BOUNDED REVENUE-SUPPORTED STAFFING INTERIOR EXISTS, BUT FULL PHYSICAL STAFFING IS RARELY SUPPORTABLE**

**Repair sufficiency: FAIL-CONTINUE. No canonical labor, credit, wage, settlement, exit, or production rule is authorized by this closure.**

## Provenance

- Repository: `shinsihu10123/ProceduralCity`
- Branch: `scratch/new-project-2026-08-12`
- Workflow run: `32544713761`
- Executed workflow/source SHA: `a638beec9c33d711dd9642045546047a0437db52`
- Diagnostic script: `economic-lab/scripts/rv08-payroll-persistence-staffing-envelope-audit-v10.mjs`
- Horizon: 24 months
- Seeds: original A/C + held-out E/F
- Bases: `consumer`, `materials-consumer`
- States: `canonical`, `ramp-grace`
- Economic shards: 16/16 success
- Final beacon: success
- Artifact retention: 90 days; durable compact evidence is checked into the repository separately.

All shards passed observer noninterference, health, normalization activation, ledger verification, general accounting verification, GDP arithmetic, cohort coverage, staffing-envelope coverage, and finite-row gates.

## Methodological scope

AL/AM is diagnostic-only. It does **not** apply a bridge loan, staffing-envelope rule, wage change, tax change, settlement change, write-off, or new credit mechanism. `ramp-grace` is a previously defined diagnostic state used only to expose the post-bottleneck employment/payroll regime with slower exit propagation.

AL starts a cohort whenever a plan-viable CONSUMER firm underpays base payroll, then follows that firm through age 0–6 where comparable plan-viable observations remain available.

Definitions used by the executed script:

- `timingAtStart`: cash before payroll + later same-month revenue could cover base payroll.
- `nextMonthCure`: next comparable month is not underpaid.
- `transitorySelfLiquidating`: timing candidate at start and no underpayment at ages 1 and 2.
- `recurrent3`: at least 2 underpaid months in a complete 3-month cohort.
- `persistent3`: all 3 months underpaid.
- `structural3`: cumulative 3-month realized operating contribution `(revenue - inputSpend)` is below cumulative base payroll.
- `structuralAge6`: same test over a complete 7-observation age-0-to-6 cohort.

AM uses the prior three comparable months of realized operating contribution. `meanSupport` is floor(mean trailing contribution / current wage), `floorSupport` is floor(min trailing contribution / current wage), and physical workers are derived from the unconstrained demand/inventory production plan and one-worker capacity.

## R4-AL — pooled evidence

### Ramp-grace state: the informative post-bottleneck regime

| Base | Viable firm-months | Underpaid share | Cohort starts | Timing candidates at start | Next-month cure | Truly transitory self-liquidating | Complete 3m | Recurrent 3m | Persistent 3m | Structural 3m | Complete age-6 | Recurrent age-6 | Structural age-6 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CONSUMER | 3,482 | 7.58% | 170 | 51.76% | 15.29% | **8.24%** | 111 | **87.39%** | 71.17% | **79.28%** | 75 | **88.00%** | **82.67%** |
| MATERIALS+CONSUMER | 3,069 | 9.97% | 156 | **75.00%** | 12.82% | **6.41%** | 103 | **90.29%** | 70.87% | 49.51% | 74 | **90.54%** | **64.86%** |

The key falsification is the gap between `timingAtStart` and actual self-liquidation. In M+C, 75% of underpayment cohort starts look bridgeable if only the same-month cash timing snapshot is examined, yet only 6.4% satisfy the stronger transitory/self-liquidating test through the next two months. CONSUMER shows the same pattern: 51.8% timing candidates versus 8.2% truly transitory.

Therefore the earlier R4-AJ timing signal is real but **not equivalent to recoverable one-period working-capital demand**. Most complete cohorts repeatedly underpay, and a large share remain cumulatively below payroll even after realized operating contribution is aggregated over three to seven observations.

### Canonical state

Canonical unemployment remains very high and follow-up is more heavily censored by the collapsing state. Pooled underpayment shares among plan-viable rows are 3.93% for CONSUMER and 5.35% for M+C; complete 3-month cohorts show recurrent underpayment of 97.1% and 96.3% respectively. Canonical CONSUMER produced zero complete age-6 comparable cohorts, so its reported age-6 zero values must **not** be interpreted as cure. Canonical M+C had 24 complete age-6 cohorts, all recurrent and all structurally below cumulative payroll; one of those 24 cohorts exited by age 6.

This censoring is why the causal persistence conclusion is anchored primarily in the ramp-grace state rather than in naive comparison of canonical age-6 percentages.

## R4-AM — pooled staffing-envelope evidence

### Ramp-grace

| Base | Envelope observations | 3m mean support >= current workers | 3m minimum support >= current workers | 3m mean support >= full physical workers | Interior expansion zone | Mean unemployment | Mean output |
|---|---:|---:|---:|---:|---:|---:|---:|
| CONSUMER | 2,492 | **73.31%** | 47.75% | **6.66%** | **21.55%** | 12.18% | 1,275.9 |
| MATERIALS+CONSUMER | 2,122 | **69.89%** | **58.44%** | **13.15%** | **24.55%** | 9.62% | 1,892.2 |

This closes an important gap between the two previously failing extremes.

1. Current employment is supportable by the trailing 3-month **mean** realized contribution in roughly 70% of observations.
2. A stricter trailing 3-month **minimum** supports current employment in only about 48–58%, showing substantial volatility and explaining repeated arrears even when average viability looks adequate.
3. Full physical staffing is supportable in only about 7–13% of observations.
4. A genuine interior region exists: about 22–25% of observations have financially supportable expansion above current employment but below the full physical labor requirement.

Therefore the evidence does **not** support either `keep canonical/physical staffing regardless of revenue` or `hard-cap staffing to a single prior realized month`. It supports testing a bounded, smoothed, trailing-realization staffing envelope.

## Causal update

The strongest integrated chain after R4-AL/AM is:

`upstream value-product / productive-feasibility defects`
→ `production-labor target incoherence`
→ `physical target often far above revenue-supported labor`
→ `current payroll sometimes viable on average but fragile to low-realization months`
→ `payroll underpayment`
→ `mostly recurrent / persistent rather than one-month timing-only`
→ `repeated distress / restructuring / exit`
→ `unemployment propagation and stranded estates`.

A conditional working-capital timing channel remains real, but R4-AL falsifies the interpretation that most observed payroll gaps are naturally self-liquidating short-term credit demand.

## Hypothesis disposition

- **H-AL1: most payroll shortfalls are one-month timing gaps** → **FALSIFIED**.
- **H-AL2: timing-candidate status overstates bridge recoverability** → **STRONGLY SUPPORTED**.
- **H-AL3: post-bottleneck payroll shortfalls are recurrent across months** → **STRONGLY SUPPORTED**.
- **H-AL4: a substantial share remains cumulatively below payroll over 3–7 observations** → **SUPPORTED**, especially CONSUMER; also material under M+C.
- **H-AM1: no financially meaningful staffing level exists between current and full physical labor** → **FALSIFIED**.
- **H-AM2: full physical staffing is broadly financeable from realized contribution** → **FALSIFIED**.
- **H-AM3: trailing realized contribution can define a bounded interior staffing envelope** → **SUPPORTED AS A DIAGNOSTIC LEAD; causal sufficiency not yet established**.

## Next dependency-safe test

Proceed to a causal staffing-envelope ablation that changes **only** labor targeting while preserving the existing diagnostic exit grace, transformed unit basis, productive normalization, canonical credit pass, wages, taxes, settlement rules, and accounting.

The next batch should compare:

- ramp-grace control;
- immediate 3-month-mean envelope;
- bounded-ramp 3-month-mean envelope;
- bounded-ramp 3-month-minimum envelope;
- hysteresis envelope: expand on trailing mean support, contract only when trailing minimum support falls below current staffing.

Use canonical ±10%/12% staffing movement bounds rather than introducing tuned transition coefficients. The test must reject any apparent arrears improvement that is obtained only by collapsing employment/output.

## Durable evidence

- `economic-lab/diagnostics/reality-validation/evidence/WP-RV08_R4_AL_AM_PAYROLL_PERSISTENCE_STAFFING_ENVELOPE_COMPACT_2026-08-22.csv`
- GitHub Actions run `32544713761`
- executed source SHA `a638beec9c33d711dd9642045546047a0437db52`
