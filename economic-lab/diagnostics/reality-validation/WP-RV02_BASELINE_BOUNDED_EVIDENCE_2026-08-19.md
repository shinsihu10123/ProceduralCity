# WP-RV02 Baseline Bounded Evidence — 2026-08-19

Status: **PARTIAL PASS — single-seed baseline reproduction passed; multi-seed promotion required**

## Scope

- Repository: `shinsihu10123/ProceduralCity`
- Branch: `scratch/new-project-2026-08-12`
- Evidence run: GitHub Actions `32201384077`
- Head SHA used by run: `e1e657d666b9d14703b8f7f4cff64a934a0082f0`
- Scale: `baseline`
- Seed: `ECON-RV02-A`
- Horizon: 6 months gate, then 12 months gate
- Economic mechanism changes: **0**
- Parameter tuning: **0**

This note records diagnostic evidence only. It does not assert empirical realism and does not authorize mechanism changes.

## A — VERIFIED EXISTING FACTS

### Execution / integrity gates

The 6-month and 12-month baseline jobs completed successfully. The 12-month artifact reports:

- all health gates: PASS
- diagnostic reconciliation: PASS
- complete country-month coverage: PASS
- complete labor-spell coverage: PASS
- pre-exit snapshot reconciliation: PASS
- labor stock-flow maximum error: `0`
- GDP identity maximum residual: `3.637978807091713e-12`
- firm-exit reconciliation maximum error: `0`
- diagnostic exit events: `132`
- pre-exit events: `132`

### Compute envelope — baseline, one seed, 12 months

- construction: `112.54 ms`
- simulation: `4204.01 ms`
- mean runtime: `350.33 ms / simulated month`
- RSS after simulation: `601,694,208 bytes`
- heap used after simulation: `500,475,008 bytes`

The bounded 12-month baseline run therefore fits comfortably inside the current GitHub Actions execution envelope. This does **not** establish that 36/60/120-month suites are safe.

### Terminal state at month 12

| Country | Unemployment | Active firms | Firm retention | GDP / peak | Consumption / peak | Credit stress |
|---|---:|---:|---:|---:|---:|---:|
| AST | 0.9192 | 23 | 0.5476 | 0.0468 | 0.0133 | 0.62 |
| BRN | 0.9421 | 22 | 0.3929 | 0.0353 | 0.0028 | 1.00 |
| CYR | 0.8361 | 24 | 0.7059 | 0.0173 | 0.0378 | 0.62 |
| DRN | 0.9340 | 19 | 0.5000 | 0.0126 | 0.0085 | 1.00 |

All four countries finish above 75% unemployment. All four finish below 5% of their observed peak nominal GDP and below 4% of peak consumption.

### Timing of contraction and firm exits

The baseline run shows substantial contraction before the main exit wave.

- Month 2 consumption is already approximately 14.5%, 16.2%, 8.5%, and 15.2% of observed peak consumption in AST, BRN, CYR, and DRN respectively.
- By months 3–6, vacancies fall to approximately zero in most countries while unemployment rises.
- Firm exits by month: M6 `5`, M7 `29`, M8 `20`, M9 `24`, M10 `18`, M11 `18`, M12 `18`.
- Total firm exits: `132`.

Pre-exit flags across all 132 exits:

- severe payroll stress: `132 / 132`
- liquidity failure: `132 / 132`
- severe credit stress: `13 / 132`

Thus, under the current diagnostic definitions, severe payroll stress and liquidity failure are universal immediately before observed exits, while severe credit stress is not.

### Labor path

The major unemployment acceleration overlaps the exit wave. Examples:

- AST unemployment rises from 0.177 at M6 to 0.558 at M7 while 11 firms exit.
- BRN rises from 0.253 at M6 to 0.595 at M7 while 15 firms exit.
- CYR rises from 0.214 at M7 to 0.406 at M8 while 4 firms exit, then to 0.658 at M9 while 7 firms exit.
- DRN rises from 0.270 at M7 to 0.426 at M8 while 4 firms exit, then to 0.604 at M9 while 6 firms exit.

Vacancy counts are near zero during much of the deterioration. Job-finding rates therefore collapse toward zero even before terminal unemployment is reached.

### GDP composition diagnostic

The accounting identity reconciles numerically, but inventory investment is unusually dominant in several months. Maximum absolute inventory-investment / GDP ratios in the 12-month path are:

- AST: `1.2220`
- BRN: `0.9896`
- CYR: `0.9836`
- DRN: `0.9915`

This is an accounting/composition diagnostic lead, not evidence that the GDP identity is broken.

## B — DIAGNOSTIC LEADS

1. **Early demand/consumption contraction precedes the large firm-exit wave.** The collapse cannot be attributed solely to exits because large consumption reductions are already present by month 2 while exits are still zero.
2. **Exit-linked labor destruction appears to amplify an already contracting economy.** The sharpest unemployment jumps overlap the main exit wave.
3. **Vacancy scarcity is at least as important as worker-side matching frictions in the observed collapse path.** During much of the deterioration the model has few or zero vacancies, so job-finding cannot recover regardless of unemployed-worker search behavior.
4. **Liquidity/payroll distress is strongly associated with firm exits.** Severe credit stress is not universal and therefore cannot currently be treated as the sole exit channel.
5. **Inventory investment dominates measured GDP in several months despite exact identity reconciliation.** GDP construction/composition requires dedicated diagnosis under WP-RV05.
6. The same qualitative collapse observed in compact scale is reproduced at baseline scale for seed A, reducing—but not eliminating—the probability that the pattern is a compact-scale artifact.

## C — HYPOTHESES — NOT YET ESTABLISHED

- H-L1: desired-worker dynamics and low vacancy creation create employment-recovery hysteresis after the initial contraction.
- H-L2: reservation/information/matching frictions may amplify unemployment once vacancies reappear, but they do not explain periods with zero vacancies.
- H-L3: an endogenous demand → layoff / hiring contraction → income → consumption feedback is a major propagation channel.
- H-F1: liquidity/payroll distress → exit → worker separation is a second-stage amplification channel.
- H-G1: inventory accounting/production dynamics amplify GDP volatility and obscure underlying final demand/output dynamics.
- H-C1: financial stress may amplify contraction, but current evidence does not establish severe credit stress as the universal initiating cause of firm exits.

## D — PROPOSED NEXT ACTIONS — DIAGNOSTIC ONLY

1. Promote baseline reproduction to independent bounded runs for seeds A/B/C at 12 months. Each seed must run in a separate process/job to avoid the long-horizon memory/runtime failure previously observed in aggregated execution.
2. If A/B/C reproduce the same ordering, close WP-RV02 as PASS for the 12-month reproduction/compute-envelope gate.
3. Enter WP-RV03 Labor Diagnosis without changing economic mechanisms. Focus on vacancy generation, desired-worker stock dependence, separations, exit-linked separations, scan/capacity limits, and recovery hysteresis.
4. Preserve the early consumption contraction and inventory-dominant GDP observations as cross-WP evidence for WP-RV04/WP-RV05 rather than prematurely tuning them here.

## Admission decision

**Single-seed baseline 12-month gate: PASS.**

**WP-RV02 overall: PARTIAL PASS pending bounded multi-seed baseline replication.**
