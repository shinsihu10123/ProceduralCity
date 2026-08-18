# WP-RV02 — Baseline Reproduction & Compute Envelope

Status: PASS — STAGED SCOPE
Date: 2026-08-18

## 1. Frozen economic semantics

Economic Model Frozen Baseline remains commit `698d10749e2897d711e5bcee61913ac34e0650a0`.

Economic mechanism changes in WP-RV02: **0**.
Parameter tuning in WP-RV02: **0**.

WP-RV02 only added/used observational diagnostics, execution harnesses, runtime measurement, left-censored unemployment-spell accounting, and pre-exit firm snapshots.

## 2. Why the original 3-seed × 36-month suite was not used as the admission gate

The original candidate scope was 3 deterministic seeds × 36 months at compact scale followed by the same scope at baseline scale.

A superseded main-CI attempt (`32134724605`) showed that placing the full 3×36 diagnostic suite serially inside the standard regression workflow created a poor diagnostic-value/runtime tradeoff. Independently staged runs then demonstrated that the collapse onset is already fully visible within 12 months at baseline scale, while a 24-month compact run confirms persistence beyond the onset window.

The scope was therefore reduced under the handoff contract's explicit runtime/value rule. The reduction was made **before any structural repair** and does not select away an unfavorable economic result. Long reality-validation workloads were isolated from standard v0.10 CI so correctness/performance regression CI remains bounded.

The 36-month suite is **not declared failed**. It is not admitted as necessary evidence before causal diagnosis. It can be reintroduced after the retained-state/runtime behavior is separately understood or when a later hypothesis requires the longer horizon.

## 3. Executed evidence ladder

### E0 — runtime smoke

GitHub Actions run: `32136519860`
Artifact: `9324186026` — `economic-lab-rv02-compute-smoke`

- compact: 1 seed × 12 months
- baseline: 1 seed × 6 months
- all health/reconciliation/coverage gates PASS
- compact mean runtime: 151.51 ms/month
- baseline mean runtime: 495.62 ms/month

### E1 — horizon promotion

GitHub Actions run: `32136719394`
Artifact: `9324266786` — `economic-lab-rv02-stage2`

- compact: 1 seed × 24 months
- baseline: 1 seed × 12 months
- all health/reconciliation/coverage gates PASS
- compact 24-month mean runtime: 620.89 ms/month
- baseline 12-month mean runtime: 491.05 ms/month

The compact horizon extension therefore shows materially higher retained-run cost than the 12-month compact smoke. This is a compute-envelope observation, not yet a diagnosis of the retained-state cost source.

### E2 — promoted multi-seed baseline reproduction

GitHub Actions run: `32136923320`
Artifact: `9324341329` — `economic-lab-rv02-multiseed-12`

Same deterministic seeds at both scales:

- `ECON-RV02-A`
- `ECON-RV02-B`
- `ECON-RV02-C`

Executed:

- compact: 3 seeds × 12 months
- baseline: 3 seeds × 12 months

Both suites PASS:

- v0.10 health gate
- diagnostic finite-state gate
- complete country-month coverage
- labor stock-flow reconciliation
- GDP expenditure-identity reconciliation
- firm-exit count reconciliation
- left-censored unemployment-spell coverage
- pre-exit firm-snapshot reconciliation

## 4. Promoted diagnostic dataset

The **baseline 3 seeds × 12 months** dataset is promoted as the principal WP-RV03 causal-onset dataset.

It contains:

- 3 world runs
- 36 simulated world-months
- 144 country-month diagnostic records
- 12 country histories

Runtime per simulated month by seed:

- A: 443.60 ms/month
- B: 329.36 ms/month
- C: 301.06 ms/month
- mean: 358.01 ms/month
- maximum: 443.60 ms/month

Heap used after the 12-month runs ranged from approximately 410 MB to 682 MB on the GitHub Actions runner. This is execution evidence for the current diagnostic harness, not a production memory target.

## 5. Verified reproduction facts

These are reproduction facts for this frozen model and diagnostic suite. They are **not empirical realism targets**.

Across all 12 baseline country histories at month 12:

- terminal unemployment > 50%: 12 / 12
- terminal unemployment > 75%: 12 / 12
- mean terminal unemployment: 89.59%
- minimum terminal unemployment: 83.61%
- maximum terminal unemployment: 94.89%

Unemployment threshold timing across the 12 histories:

- first month >= 25%: month 6–8, median 7
- first month >= 50%: month 7–9, median 8
- first month >= 75%: month 9–11, median 9.5

Firm and demand markers at month 12 / over the 12-month path:

- mean terminal firm retention: 54.76%
- mean cumulative firm exits: 32.83 per country history
- terminal GDP / path peak mean: 5.77%
- terminal consumption / path peak mean: 1.38%

The descriptive GDP/consumption markers are not calibration pass/fail rules. They identify episodes for WP-RV05 forensic decomposition.

## 6. Labor-market onset pattern — DIAGNOSTIC LEAD

The multi-seed baseline panel shows a reproducible ordering:

1. unemployment is initially low,
2. vacancy creation rapidly contracts,
3. job finding approaches zero while separation rises,
4. firm exits and separations spike,
5. unemployment enters the 50–75% range within months 7–11.

Across the pooled baseline country-months, existing vacancies are generally filled when they exist. The WP-RV01 counters for reservation-wage rejection, hiring-capacity binding, scan-limit binding, and no-applicant vacancies do not currently show a large binding mass during the main collapse window because the number of vacancies itself approaches zero.

Therefore the earlier hypothesis that matching friction or the 35% hiring-capacity rule is the primary collapse cause is **not supported as the leading explanation by WP-RV02 alone**. It is not yet falsified, because WP-RV03 still needs direct instrumentation of labor-demand formation and vacancy creation/destruction.

This is a DIAGNOSTIC LEAD, not a structural diagnosis.

## 7. Household-demand pattern — DIAGNOSTIC LEAD

In the baseline multi-seed panel, aggregate household disposable income remains far above realized consumption from the opening months. For example, pooled month-1 averages are approximately:

- household income: 46.8k
- disposable income: 43.0k
- realized household consumption: 0.52k
- realized consumption / disposable income: about 1.2%

Subsequent months remain at very low realized consumption shares.

The current goods market settles actual household purchases from `desiredConsumptionBudget`, available cash, eligible consumer-facing sellers, seller inventory, and successful settlement. Consequently low realized consumption cannot yet be attributed to a single behavioral coefficient.

WP-RV03 must separately observe:

- desired household consumption budget
- available-cash constraint
- goods-market desired budget
- goods-market unmet budget
- eligible-seller availability
- available consumer inventory
- attempted versus settled purchase value

Until then, 'excessively weak household demand' remains a DIAGNOSTIC LEAD.

## 8. GDP / inventory pattern — DIAGNOSTIC LEAD

GDP arithmetic remains reconciled to machine-scale tolerance, so there is no evidence here of a simple expenditure-identity summation error.

However, the opening GDP level is dominated by inventory investment in the promoted baseline panel. Across the 12 country histories, the maximum absolute inventory-investment/GDP share has a mean of approximately 1.12 and reaches approximately 2.06.

This requires WP-RV05 to audit inventory valuation, stock changes, nominal/real interpretation, imports, and the sign of GDP components before any GDP smoothing or parameter change is considered.

## 9. Financial-stress correction — VERIFIED

Actual `lastMonetary.creditStress` is strongly non-zero during the collapse. In the promoted baseline panel the mean 12-month credit-stress measure across country histories is approximately 0.655, and pooled monthly credit stress rises sharply during the main contraction window.

Therefore the previous `creditStressMonths = 0` observation is confirmed as a diagnostic-history wiring defect, not evidence that the financial system experiences zero stress.

Whether the financial accelerator is too weak, too strong, or correctly transmitted remains open for WP-RV06.

## 10. Compute-envelope decision

PASS conditions achieved:

- baseline dynamics reproduced across multiple deterministic seeds
- accounting/health/reconciliation gates remain intact
- diagnostic evidence is complete for the promoted horizon
- anomaly onset occurs well inside the promoted horizon
- a longer compact run confirms persistence
- runtime and memory costs are measured
- no mechanism or parameter was changed

Promotion decision:

- **WP-RV02: PASS — STAGED SCOPE**
- **3-seed × 12-month baseline dataset: PROMOTED for WP-RV03**
- **1-seed × 24-month compact path: persistence support evidence**
- **3-seed × 36-month suite: DEFERRED / NOT REQUIRED FOR WP-RV03 ADMISSION**
- **R2/R3 long-horizon confirmation: reserved for later confirmation after causal diagnosis**

## 11. Next dependency-safe package

Next: **WP-RV03 — Extreme Unemployment Causal Decomposition**.

Before making any economic-rule change, WP-RV03 should instrument and reconcile at least:

- total desired workers and actual workers
- desired-worker increases/decreases by firm
- vacancy creation and vacancy destruction
- layoffs by source, including firm exit versus continuing-firm downsizing
- planned production versus realized sales/output
- household desired consumption budget and cash constraint
- goods-market desired versus unmet budget
- consumer-seller/inventory availability
- job finding, separation, vacancy and firm-exit flows

The purpose is to distinguish demand collapse, labor-demand formation, firm distress/exit, and matching frictions with falsifiable mechanism evidence.
