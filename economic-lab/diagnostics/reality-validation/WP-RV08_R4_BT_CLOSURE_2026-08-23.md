# WP-RV08 R4-BT Closure — Wage Flexibility Under Payroll Stress — 2026-08-23

## Status

**Verdict: PASS / MATERIAL AMPLIFIER CONFIRMED / SUFFICIENT-ROOT HYPOTHESIS REJECTED / NO ROBUST REPAIR AUTHORIZED**

R4-BT tested whether the canonical economy's observed absence of downward nominal wage adjustment is a major contributor to payroll distress, and whether a bounded downward-wage mechanism can stabilize the economy without merely transferring the collapse to household demand.

## Provenance

- repository: `shinsihu10123/ProceduralCity`
- branch: `scratch/new-project-2026-08-12`
- workflow: `.github/workflows/economic-lab-rv08-r4-bt-wage-flexibility.yml`
- script: `economic-lab/scripts/rv08-wage-flexibility-stress-ablation-v10.mjs`
- Actions run: `32591057266`
- launch commit: `83613beba00d429732dd11142400d7466dbc4b28`
- horizon: 36 months
- seedcases: original A, original C, heldout E, heldout F
- jobs: 4/4 primary seed jobs SUCCESS + final beacon SUCCESS
- artifacts: 4/4

All four artifacts passed deterministic-control, health, ledger, general-accounting, GDP-identity, diagnostic normalization, intervention activation, and finite-data gates.

## Regimes

1. `control`
2. `stress-cut-0p5`: -0.5% nominal wage step when the firm has workers, is under payroll/liquidity stress, and has no vacancy
3. `stress-cut-1p0`: -1.0% step under the same condition
4. `stress-cut-2p0-floor80`: -2.0% step with an 80% initial-wage floor

The test explicitly tracked firm-side and household-side effects together: unemployment, terminal unemployment, wage arrears, household labor income, consumption, GDP, sectoral output, nominal and real-wage proxy, exits, cash, credit and defaults.

## Four-seed means

| Regime | Mean U | Terminal U | Mean arrears | Consumption | GDP | Consumer output | Household labor income | Real-wage proxy | Exits |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| control | 57.93% | 93.33% | 137,856 | 8,693.9 | 20,219.8 | 86.64 | 15,745.3 | 1.0257 | 333.25 |
| -0.5% | 57.69% | 93.06% | 129,716 | 8,915.1 | 20,577.6 | 89.47 | 16,040.0 | 1.0052 | 328.50 |
| -1.0% | 56.96% | 92.44% | 124,237 | 9,076.6 | 20,515.0 | 90.97 | 16,161.0 | 0.9864 | 325.75 |
| -2.0% + 80% floor | 57.46% | 92.75% | 117,122 | 8,738.5 | 20,101.8 | 87.02 | 15,783.8 | 0.9543 | 327.75 |

## Mean effects vs control

### -0.5% stress step

- mean unemployment: **-0.24 pp**
- terminal unemployment: **-0.27 pp**
- mean arrears: **-5.90%**
- terminal arrears: **-6.80%**
- consumption: **+2.54%**
- GDP: **+1.77%**
- consumer output: **+3.27%**
- materials output: **+4.40%**
- household labor income: **+1.87%**
- real-wage proxy: **-2.00%**
- exits: **-1.43%**

### -1.0% stress step

- mean unemployment: **-0.97 pp**
- terminal unemployment: **-0.89 pp**
- mean arrears: **-9.88%**
- terminal arrears: **-11.10%**
- consumption: **+4.40%**
- GDP: **+1.46%**
- consumer output: **+5.00%**
- materials output: **+5.04%**
- household labor income: **+2.64%**
- real-wage proxy: **-3.84%**
- exits: **-2.25%**

### -2.0% step with 80% floor

- mean unemployment: **-0.47 pp**
- terminal unemployment: **-0.58 pp**
- mean arrears: **-15.04%**
- terminal arrears: **-16.49%**
- consumption: **+0.51%**
- GDP: **-0.58%**
- consumer output: **+0.43%**
- materials output: **+1.64%**
- household labor income: **+0.24%**
- real-wage proxy: **-6.96%**
- exits: **-1.65%**

## Heldout robustness

The aggregate -1.0% regime is the strongest interior candidate, but it is **not a robust Pareto winner across all seeds**.

For -1.0%:

- arrears fall in all four seedcases;
- mean unemployment improves in all four seedcases;
- original A and heldout E show meaningful activity gains;
- original C has a small GDP loss despite output gains;
- heldout F shows GDP, consumer output, consumption and labor-income deterioration despite lower arrears and slightly lower mean unemployment.

The aggressive -2.0% regime reduces arrears further but more often loses activity and real wage. This is consistent with a firm-side liquidity benefit eventually being offset by household-side income/demand damage.

## Causal interpretation

**A — VERIFIED EXISTING FACT:** downward nominal wage flexibility is essentially absent in the tested canonical path while price adjustment is much more active.

**A — VERIFIED CAUSAL FACT:** allowing bounded stress-triggered wage reductions consistently reduces wage arrears. Therefore canonical nominal wage rigidity is a material amplifier of payroll distress.

**C — REJECTED:** wage rigidity is the sufficient primary cause of the collapse. Even the best tested regime ends with approximately **92% terminal unemployment** on the four-seed mean. The macro collapse remains.

**C — REJECTED:** more aggressive wage flexibility is monotonically better. The -2% regime achieves larger arrears reduction but loses GDP and substantially lowers the real-wage proxy.

**B — DIAGNOSTIC LEAD:** a modest, state-contingent nominal adjustment mechanism may eventually belong in a realistic labor contract / renegotiation layer, but only together with revenue, liquidity, demand and worker-protection mechanisms.

## Repair authorization

**No canonical wage-cut rule is authorized.**

The current intervention is deliberately reduced-form. A production-quality mechanism would require contract duration, bargaining/renegotiation, minimum-wage or reservation-wage constraints, sector productivity, price-level/inflation state, worker exit/search responses, arrears-claim protection, and probably layoff-hours-wage trade-offs rather than direct monthly wage mutation.

## Next causal use

R4-BT should enter the next interaction stage only as a bounded factor, not as a standalone fix. The highest-value next interaction is with:

- working-capital / bank-capital relief;
- accounting-preserving exit-estate inventory recycling;
- restructuring rather than immediate liquidation;
- demand/revenue realization;
- explicit labor-force participation / demographic ontology.

The purpose is to test complementarity and collapse displacement, not tune a preferred unemployment number.
