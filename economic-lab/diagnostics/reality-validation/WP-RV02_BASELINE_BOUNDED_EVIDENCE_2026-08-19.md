# WP-RV02 Baseline Bounded Evidence — 2026-08-19

Status: **PASS — bounded 12-month baseline reproduction replicated across seeds A/B/C**

## Scope

- Repository: `shinsihu10123/ProceduralCity`
- Branch: `scratch/new-project-2026-08-12`
- Single-seed bounded run: GitHub Actions `32201384077`
- Multi-seed promotion run: GitHub Actions `32217009366`
- Multi-seed head SHA: `430af779356ae241c7eae33ced47bcb6239aef88`
- Scale: `baseline`
- Seeds: `ECON-RV02-A`, `ECON-RV02-B`, `ECON-RV02-C`
- Horizon: 12 months per independent process/job
- Economic mechanism changes: **0**
- Parameter tuning: **0**

This note records diagnostic evidence only. It does not assert empirical realism and does not authorize mechanism changes.

## A — VERIFIED EXISTING FACTS

### Execution / integrity gates

The bounded baseline 12-month jobs for seeds A/B/C all completed successfully. Every seed reports:

- all health gates: PASS
- diagnostic reconciliation: PASS
- complete country-month coverage: PASS
- complete labor-spell coverage: PASS
- pre-exit snapshot reconciliation: PASS
- labor stock-flow maximum error: `0`
- firm-exit count reconciliation maximum error: `0`

Seed A GDP identity maximum residual was `3.637978807091713e-12`; the gate passed for all three seeds.

### Compute envelope — baseline, independent 12-month jobs

| Seed | Mean ms / month | RSS after simulation | Heap used after simulation |
|---|---:|---:|---:|
| A | 545.99 | 791,375,872 B | 677,967,240 B |
| B | 515.42 | 821,104,640 B | 720,913,808 B |
| C | 599.66 | 898,920,448 B | 366,855,256 B |

The 12-month baseline workload is therefore admissible when seeds are isolated into independent bounded jobs. This does **not** establish that 36/60/120-month suites are safe in one aggregated process.

### Multi-seed terminal reproduction

Across 3 seeds × 4 countries = 12 country-runs:

- terminal unemployment > 50%: `12 / 12`
- terminal unemployment > 75%: `12 / 12`
- terminal unemployment mean: `0.8959`
- terminal unemployment range: `0.8361`–`0.9489`
- GDP below 50% of observed peak: `12 / 12`
- GDP below 10% of observed peak: `9 / 12`
- consumption below 50% of observed peak: `12 / 12`
- firm retention <= 50%: `5 / 12`
- first month unemployment exceeds 50%: range M7–M9

Thus the extreme contraction is not seed-A-specific within the tested baseline sample.

### Seed A terminal state at month 12

| Country | Unemployment | Active firms | Firm retention | GDP / peak | Consumption / peak | Credit stress |
|---|---:|---:|---:|---:|---:|---:|
| AST | 0.9192 | 23 | 0.5476 | 0.0468 | 0.0133 | 0.62 |
| BRN | 0.9421 | 22 | 0.3929 | 0.0353 | 0.0028 | 1.00 |
| CYR | 0.8361 | 24 | 0.7059 | 0.0173 | 0.0378 | 0.62 |
| DRN | 0.9340 | 19 | 0.5000 | 0.0126 | 0.0085 | 1.00 |

### Firm-exit reproduction across seeds

- Seed A exits: `132`; severe payroll stress `132/132`; liquidity failure `132/132`; severe credit stress `13/132`.
- Seed B exits: `132`; severe payroll stress `132/132`; liquidity failure `132/132`; severe credit stress `3/132`.
- Seed C exits: `130`; severe payroll stress `130/130`; liquidity failure `130/130`; severe credit stress `10/130`.

Severe payroll stress and the current liquidity-failure diagnostic are universal immediately before observed exits in the tested sample; severe credit stress is not.

### Timing of contraction and firm exits

The baseline path shows substantial contraction before the main exit wave. In seed A, month-2 consumption is already approximately 14.5%, 16.2%, 8.5%, and 15.2% of observed peak consumption for AST, BRN, CYR, and DRN while firm exits are still zero. By months 3–6 vacancies are near zero in most countries while unemployment rises. The main exit wave then overlaps the sharpest unemployment increases.

### Labor path

Seed A examples:

- AST unemployment rises from 0.177 at M6 to 0.558 at M7 while 11 firms exit.
- BRN rises from 0.253 at M6 to 0.595 at M7 while 15 firms exit.
- CYR rises from 0.214 at M7 to 0.406 at M8 while 4 firms exit, then to 0.658 at M9 while 7 firms exit.
- DRN rises from 0.270 at M7 to 0.426 at M8 while 4 firms exit, then to 0.604 at M9 while 6 firms exit.

Vacancy counts are near zero during much of the deterioration. Worker-side matching frictions therefore cannot by themselves explain periods in which no jobs are being offered.

### GDP composition diagnostic

The accounting identity reconciles numerically, but inventory investment is unusually dominant. Across the 12 multi-seed country-runs, the maximum absolute inventory-investment / GDP ratio ranges from `0.9836` to `2.0638`.

This is an accounting/composition diagnostic lead, not evidence that the GDP identity is broken.

## B — DIAGNOSTIC LEADS

1. **Early demand/consumption contraction precedes the large firm-exit wave.** Large consumption reductions exist before exits can explain them.
2. **Exit-linked labor destruction appears to amplify an already contracting economy.** The sharpest unemployment jumps overlap or follow firm exits.
3. **Vacancy scarcity is a first-order labor-market symptom.** During many deteriorating months the market has few or zero vacancies despite large unemployed stocks.
4. **Liquidity/payroll distress is strongly associated with firm exits.** Severe credit stress is not universal and cannot currently be treated as the sole exit channel.
5. **Inventory investment dominates measured GDP in several months despite exact identity reconciliation.** GDP construction/composition requires dedicated diagnosis under WP-RV05.
6. **The collapse is reproduced across baseline seeds A/B/C.** The tested pattern is neither seed-A-specific nor compact-scale-specific.

## C — HYPOTHESES — NOT YET ESTABLISHED

- H-L1: desired-worker dynamics and low vacancy creation create employment-recovery hysteresis after the initial contraction.
- H-L2: reservation/information/matching frictions may amplify unemployment once vacancies reappear, but they do not explain zero-vacancy periods.
- H-L3: an endogenous demand → hiring contraction / layoff → income → consumption feedback is a major propagation channel.
- H-F1: liquidity/payroll distress → exit → worker separation is a second-stage amplification channel.
- H-G1: inventory accounting/production dynamics amplify GDP volatility and obscure underlying final demand/output dynamics.
- H-C1: financial stress may amplify contraction, but current evidence does not establish severe credit stress as the universal initiating cause of firm exits.

## D — NEXT ACTION — DIAGNOSTIC ONLY

Enter **WP-RV03 Labor Diagnosis** without changing economic mechanisms or parameters. The first probe must reconcile gross labor-market layoffs against two mechanically distinct channels:

1. workers attached at month start to firms already inactive from a prior-month exit; and
2. layoffs generated by current active firms reducing `desiredWorkers` before labor-market clearing.

It must also measure vacancy starvation, gross hires versus net job findings, same-month re-employment, plan-selection/hiring-change aggregates, and the one-month lag from end-of-month firm exit to next-month labor separation.

## Admission decision

**WP-RV02 bounded 12-month baseline reproduction / compute-envelope gate: PASS.**

Longer-horizon promotion remains deferred until causal diagnosis removes the need to spend compute on an already-reproduced pathological attractor.
