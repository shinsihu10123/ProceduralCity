# WP-RV08 R4-AK Closure — Payroll Working-Capital Bridge Ablation

Date: 2026-08-22

## Verdict

**PASS — causal narrowing / FAIL-CONTINUE — repair sufficiency**

R4-AK confirms that payroll-before-consumer-revenue timing is a real secondary constraint after production/labor/survival relief, but none of the tested accounting-preserving bridge rules is sufficient or admissible as a canonical repair.

## Provenance

- Repository: `shinsihu10123/ProceduralCity`
- Branch: `scratch/new-project-2026-08-12`
- Workflow: `.github/workflows/economic-lab-rv08-r4-ak-payroll-bridge.yml`
- Run: `32544064114`
- Executed source SHA: `c733f9ec14120e9fd31a4a8f1182961ef3d5515d`
- Script: `economic-lab/scripts/rv08-payroll-working-capital-bridge-ablation-v10.mjs`
- Script blob SHA at closure line: `469a5b43f93a8afc946bfd1481d332d6c08e2132`
- Coverage: 3 seeds (`original-A`, `original-C`, `heldout-E`) × 2 normalization bases (`consumer`, `materials-consumer`) × 2 states (`canonical`, `ramp-grace`) × 4 bridge regimes = **48 primary simulations**.
- Workflow result: **6/6 economic shards SUCCESS + final beacon SUCCESS**.
- Artifact retention: 90 days; durable aggregate evidence is committed separately as CSV.

## Hard gates

All six artifacts report all gates true:

- health
- complete coverage
- normalization activation
- settlement ledger verification
- general accounting verification
- GDP arithmetic identity
- bridge draws observed
- finite rows

The bridges are not free cash. Draws are booked as bank loans with matching borrower liability / bank loan asset and deposit creation. Same-month repayment is limited by actual realized consumer revenue and post-tax cash; residual principal remains normal debt and is exposed to the canonical debt-service/default path.

## Aggregate results

Values below are arithmetic means across the six seed/base cells.

| State | Bridge | U | terminal U | wage arrears | linked/current-worker arrears | GDP | output | same-month repayment | horizon outstanding/originated | defaults |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| canonical | control | 33.35% | 58.06% | 322,032 | 112,335 | 32,422 | 1,355.7 | — | — | — |
| canonical | gap-bridge | 33.93% | 59.09% | 320,180 | 106,170 | 32,434 | 1,338.0 | 14.47% | 42.72% | 9.17 |
| canonical | inventory-backed | 34.07% | 59.57% | 324,002 | 107,399 | 32,309 | 1,337.6 | 96.09% | 0.34% | 0.00 |
| canonical | sales-backed | 33.74% | 58.76% | 323,850 | 109,948 | 32,242 | 1,344.5 | 59.55% | 12.45% | 2.17 |
| ramp-grace | control | 8.86% | 12.36% | 450,988 | 422,095 | 39,941 | 1,824.7 | — | — | — |
| ramp-grace | gap-bridge | 8.71% | 12.01% | 440,515 | 411,557 | 40,000 | 1,833.9 | 57.17% | 19.33% | 5.67 |
| ramp-grace | inventory-backed | 8.77% | 12.18% | 445,056 | 416,020 | 39,920 | 1,823.7 | 87.85% | 2.66% | 1.00 |
| ramp-grace | sales-backed | 8.73% | 12.07% | 444,251 | 415,482 | 39,878 | 1,834.6 | 92.57% | 4.41% | 2.50 |

## Effect decomposition

### Canonical state

The bridges do not repair the collapsed economy.

- `gap-bridge`: unemployment **+0.57 pp**, terminal unemployment **+1.03 pp**; total arrears only **-0.58%**; linked arrears **-5.49%**. Only **14.47%** of bridge principal is repaid in the same month and **42.72%** remains outstanding at the horizon, with about **9.17 defaults** per seed/base cell.
- `inventory-backed`: financially clean repayment, but unemployment **+0.71 pp**, total arrears **+0.61%**, GDP/output slightly lower.
- `sales-backed`: unemployment **+0.38 pp**, total arrears **+0.56%**, GDP/output slightly lower; debt is cleaner than the gap bridge but macro repair is absent.

This rejects the proposition that canonical collapse is primarily a short intramonth financing gap.

### Ramp-grace state

Once weak staffing transition and the four-month exit amplifier are relaxed, bridges become more relevant, but effects remain small and inconsistent.

- `gap-bridge`: unemployment **-0.14 pp**, total arrears **-2.32%**, linked arrears **-2.50%**, output modestly higher. However same-month repayment is only **57.17%**, horizon outstanding/originated is **19.33%**, and defaults average **5.67**.
- `inventory-backed`: arrears **-1.32%**, linked arrears **-1.44%** with clean repayment, but virtually no macro gain.
- `sales-backed`: arrears **-1.49%**, linked arrears **-1.57%** with **92.57%** same-month repayment and low residual debt, but virtually no macro gain.

No tested bridge robustly reduces arrears across all seed/base cells. For example, under ramp-grace the gap bridge lowers mean arrears strongly in some cells but worsens `original-A / MATERIALS+CONSUMER`; inventory- and sales-backed variants also worsen arrears in multiple cells.

## Hypothesis verdicts

- **H-AK1 — exact unsecured payroll-gap bridge is sufficient:** **FALSIFIED.** It provides the largest average arrears relief only in the relieved state, but converts a material share of the gap into persistent bank debt/default risk and is not robust across cells.
- **H-AK2 — prior-sales-backed bridge is financially clean and macro sufficient:** **PARTIAL mechanism / FAIL sufficiency.** Repayment is much cleaner, but unemployment/output and arrears effects are too small and seed-sensitive.
- **H-AK3 — inventory-backed bridge is financially clean and macro sufficient:** **PARTIAL mechanism / FAIL sufficiency.** Repayment is cleanest, but economic effect is negligible/inconsistent.
- **H-AK4 — short-term credit alone closes the current-worker payroll wedge:** **FALSIFIED.** The dominant residual is not removed by any tested bridge.

## Causal interpretation

R4-AJ showed that payroll-before-revenue timing becomes a major binding constraint after production/labor/survival relief. R4-AK now shows that this does **not** imply that generic extra credit is the repair.

The remaining structure is:

`production/labor coherence defect`
→ `persistent or recurrent payroll shortfall`
→ `intramonth timing worsens some shortfalls`
→ `bridge can temporarily finance a subset`
→ `many gaps recur or fail to self-liquidate`
→ `debt/default substitutes for arrears if bridge is too broad`

Therefore the next diagnostic must distinguish **transitory self-liquidating timing gaps** from **persistent operating deficits / recurrent bridge dependence**, rather than tuning loan size or underwriting thresholds.

## Next dependency-safe frontier

1. **R4-AL — Payroll Shortfall Persistence / Bridge Recoverability Cohort Audit**
   - observer-only; follow underpaid firm-month cohorts for 0–6 months;
   - classify one-month self-liquidating gaps, recurrent bridge-dependent gaps, structural operating deficits, and debt-shift cases;
   - compare canonical and ramp-grace states across original and held-out seeds.

2. **R4-AM — Revenue-Supported Staffing Envelope Audit**
   - observer-only; estimate a smoothed 3-month payroll-support envelope without changing employment;
   - test whether a financially supportable staffing zone exists between the inadmissible hard-realized cap and the inadmissible full physical-need target.

No canonical repair is authorized by R4-AK.
