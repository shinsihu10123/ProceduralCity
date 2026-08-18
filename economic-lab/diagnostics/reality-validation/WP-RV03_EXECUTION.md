# WP-RV03 — Extreme Unemployment Causal Decomposition

Status: **PASS — CAUSAL DECOMPOSITION**
Date: 2026-08-18

## 1. Frozen economic semantics

Economic Model Frozen Baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`.

Economic mechanism changes in WP-RV03: **0**.
Parameter tuning in WP-RV03: **0**.

The only model-path modification is optional read-only diagnostic observation. The standard WP-RV01 non-interference gate was extended to the goods-market observer and passed its Test step on the code-bearing main CI run.

## 2. Promoted experiment

- scale: baseline
- seeds: `ECON-RV02-A`, `ECON-RV02-B`, `ECON-RV02-C`
- horizon: 12 months
- country histories: 12
- country-month observations: 144
- source promotion: WP-RV02 PASS — STAGED SCOPE

Final dedicated GitHub Actions evidence:

- code commit: `527c18fe3ddb43f562b965a1c35b561cb17cd528`
- run: `32139091743`
- result: **SUCCESS**
- artifact: `9325152878` / `economic-lab-wp-rv03`
- artifact digest: `sha256:d6fbf4280f6805380f6318bb376e4938d9ebd72133032188021c184be4f2bc8c`

All final gates PASS:

- v0.10 health
- WP-RV01 diagnostic reconciliation
- complete country-month coverage
- planned vacancy reconstruction ↔ labor-market initial vacancies
- planned layoff reconstruction ↔ labor-market layoffs
- exact firm-exit boundary count and displaced-worker reconciliation
- household desired budget ↔ goods-market desired budget
- desired budget ↔ realized consumption + unmet budget
- exact goods observer result ↔ stored goods-market result

## 3. Methodological correction log

Two intermediate failed diagnostic assertions are intentionally retained as evidence.

### Attempt A — run `32138065043`

The initial runner incorrectly treated `RealityDiagnosticRecorder.exitSeparations` as disjoint from labor-market layoffs and asserted:

`net pre/post separations = labor-market layoffs + exit-associated separations`.

The assertion failed. Investigation showed that a household can be laid off during labor clearing and its former employer can exit later in the same month. The same transition can therefore be both a labor-market layoff and exit-associated in the coarse end-of-month attribution.

### Attempt B — run `32138264895`

The second runner incorrectly asserted:

`gross labor-market layoffs <= net pre/post separations`.

This also failed because a worker can be laid off and rehired during the same month. Gross event flows must not be forced to equal pre/post stock-transition flows.

### Corrected semantics

The final runner distinguishes:

- gross labor-market hires
- gross labor-market layoffs
- net observed employment transitions
- exact workers displaced at the `evaluateExits` boundary

The correction changed only diagnostic semantics, not the economy.

## 4. VERIFIED EXISTING FACTS — labor-market decomposition

### 4.1 Matching friction is not the primary collapse trigger in the promoted panel

Across the complete 3-seed baseline panel:

- every planned vacancy that appears in the pooled monthly panel is filled during that month;
- hiring-capacity-bound vacancies: 0;
- scan-limit-bound vacancies: 0;
- no-applicant vacancies: 0.

Reservation-wage and stochastic rejections do occur, but they do not leave vacancies unfilled in this experiment.

Disposition:

**H-L2 — matching friction as the primary unemployment-collapse mechanism: FALSIFIED for this promoted panel.**

This does not prove matching frictions can never matter in another regime.

### 4.2 Labor-demand contraction begins before mass firm exit

Pooled monthly path across 12 country histories:

| Month | Mean unemployment | Net desired-worker change | Planned vacancies | Planned layoffs | Firm exits |
|---:|---:|---:|---:|---:|---:|
| 1 | 5.23% | +138 | 148 | 10 | 0 |
| 2 | 3.85% | +82 | 121 | 39 | 0 |
| 3 | 5.48% | -111 | 20 | 131 | 0 |
| 4 | 8.22% | -179 | 3 | 182 | 0 |
| 5 | 11.62% | -216 | 1 | 217 | 0 |
| 6 | 18.84% | -223 | 0 | 223 | 15 |
| 7 | 41.31% | -183 | 13 | 196 | 83 |
| 8 | 59.59% | -88 | 22 | 110 | 69 |
| 9 | 73.46% | -16 | 24 | 40 | 66 |

During months 1–6:

- planned layoffs: 802
- planned layoffs at firms that continue operating: 788
- planned layoffs at firms that exit in the same month: 14
- firm exits: only 15, all beginning in month 6.

Therefore the initial unemployment acceleration is **not caused by firm exit**. Continuing firms reduce labor demand first.

### 4.3 Firm exit is a later nonlinear amplifier

During months 7–9:

- market layoffs: 346
- exact exit-boundary worker displacements: 3,190
- firm exits: 218
- mean unemployment rises to 58.12% over the window.

Disposition:

**H-F1 — firm exit amplification: SUPPORTED as a major secondary collapse accelerator, not the initial trigger.**

## 5. VERIFIED EXISTING FACTS — household goods-market rationing

A final refinement added a read-only observer at the exact entry and exit boundaries of household goods clearing.

The result is unambiguous for this baseline panel.

Across all 144 country-months:

- household goods-market starting inventory value equals realized household consumption to numerical tolerance;
- end-of-household-clearing eligible sellers = 0 in **144 / 144** country-months;
- settlement-failure stops = **0**;
- positive-budget household observations = **75,960**;
- households ending with unmet budget = **75,687**;
- share with unmet budget = **99.64%**;
- no-eligible-seller stops = **75,118**;
- three-round-limit stops = **569**;
- the two stop classes sum exactly to all unmet-budget households;
- all initially eligible sellers are exhausted during household clearing.

Across the full 12-month panel:

- household desired goods budget = approximately **2.650 million**
- consumer inventory value available at goods-market entry = approximately **11.826 thousand**
- realized household consumption = approximately **11.826 thousand**
- start-inventory-value / desired-budget coverage = **0.446%**.

Pre-exit months 1–6:

- desired goods budget = 1,621,260.76
- market-start inventory value = 10,278.00
- realized consumption = 10,278.00
- inventory-value coverage = 0.634%
- desired budget / disposable income = 83.09%.

Collapse months 7–9:

- desired goods budget = 505,334.31
- market-start inventory value = 1,198.50
- realized consumption = 1,198.50
- inventory-value coverage = 0.237%
- desired budget / disposable income = 142.68%.

Thus realized household spending is not low because households choose a tiny desired budget. The household market is quantity-rationed by the amount of consumer inventory actually available when household clearing starts.

Disposition:

**“voluntary household desired-demand collapse is the primary early sales shock”: FALSIFIED.**

**Persistent severe household goods quantity rationing: VERIFIED in the promoted baseline panel.**

## 6. Structural mechanism identified

The frozen code computes firm labor plans from demand beliefs and uses realized sales/revenue history as a demand-related learning/input channel. Production capacity is labor-dependent, and household goods purchases can settle only against active consumer-facing firms with positive inventory.

The evidence supports the following causal structure:

1. Household desired spending is large.
2. Consumer inventory available at household market entry covers only a small fraction of desired spending.
3. The market sells essentially all available household consumer inventory every month.
4. Realized sales therefore become strongly supply/capacity constrained and do not represent latent household demand.
5. Firms nevertheless learn/reason from realized sales-related demand signals and increasingly select negative hiring plans.
6. Continuing firms cut desired workers before mass exit begins.
7. Lower employment reduces labor-dependent production capacity.
8. The quantity constraint persists/tightens.
9. Distress and firm exits then become a major secondary amplifier, displacing thousands of remaining workers.

### Structural Diagnosis Candidate SD-RV03-01

**Supply-constrained realized sales are being used as evidence about demand in a permanently quantity-rationed household goods market. This confounds latent demand with realized quantity availability and creates a self-reinforcing labor-demand contraction path.**

Status: **STRONGLY SUPPORTED / promoted to the cross-WP structural diagnosis register.**

It is not yet a repair authorization. WP-RV04, WP-RV05 and WP-RV06 must still determine how firm distress, national-accounting dynamics and finance interact with this path before WP-RV07 selects a repair candidate.

## 7. Hypothesis disposition

| Hypothesis | WP-RV03 disposition |
|---|---|
| H-L1 hiring recovery hysteresis | OPEN as a persistence mechanism; not supported as the initial trigger |
| H-L2 matching / reservation-wage / scan / 35% hiring-capacity friction | FALSIFIED as primary trigger in this panel |
| H-L3 generic weak household demand → layoffs | REJECTED in its original form; desired household spending is not weak |
| H-F1 firm exit amplification | SUPPORTED as secondary nonlinear amplifier |
| H-RV03-NEW supply-rationed realized sales misread as demand weakness | STRONGLY SUPPORTED structural diagnosis candidate |

## 8. What is not claimed

WP-RV03 does not claim:

- that unemployment has been calibrated to a real-world target;
- that the correct repair is to increase production, inventory, firm count, hiring capacity, or any coefficient;
- that firm exits are fully diagnosed;
- that GDP volatility has been explained;
- that the financial accelerator has been diagnosed;
- that all long-run unemployment persistence is explained by one mechanism.

No coefficient or economic rule is changed in this WP.

## 9. Repository outputs

- `economic-lab/src/markets/goods-market.js` — optional read-only goods-market diagnostic observer
- `economic-lab/scripts/smoke-v10-reality-diagnostics.mjs` — expanded non-interference gate
- `economic-lab/scripts/labor-causal-diagnosis-v10.mjs` — 3-seed causal decomposition and exact market/exit boundary tracing
- `.github/workflows/economic-lab-rv03.yml` — dedicated WP-RV03 evidence workflow
- `economic-lab/diagnostics/reality-validation/WP-RV03_EXECUTION.md` — this closure record

## 10. Final WP result

**WP-RV03: PASS — CAUSAL DECOMPOSITION**

Economic semantics changed: **0**
Parameter tuning performed: **0**
Structural repair authorized: **NO**

Next dependency-safe work package: **WP-RV04 — Firm Distress & Exit Attribution**.
