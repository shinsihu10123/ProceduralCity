# WP-RV08 R4-BM / R4-BN / R4-BQ Closure — 2026-08-23

## Status

**Verdict: PASS WITH FOLLOW-ON DIAGNOSIS**

This closure records the complete four-seed evidence from GitHub Actions run `32584670965` for the integrated 36-month R4-BM / R4-BN / R4-BQ audit. It closes the observational questions posed by these three diagnostics, but does **not** authorize a canonical repair. Ultimate-cause decomposition continues in R4-BR onward.

## Provenance

- Repository: `shinsihu10123/ProceduralCity`
- Branch: `scratch/new-project-2026-08-12`
- Workflow: `.github/workflows/economic-lab-rv08-r4-bm-bn-bq-integrated-audit.yml`
- Script: `economic-lab/scripts/rv08-wage-entrant-credit-integrated-audit-v10.mjs`
- Run: `32584670965`
- Horizon: 36 months
- Seedcases: original A, original C, heldout E, heldout F
- Artifact coverage: 4/4 seed artifacts
- Health/accounting/finite-data gates: all true in all four artifacts

## Provenance correction

An earlier interim briefing used a subset/misaggregated interpretation for R4-BN (`510 entrants`, `244 exits`, classified as `other`). The complete 4-seed artifacts from run `32584670965` supersede that interim statement.

**Correct complete result:** `922 entrants`, `797 entrant exits`; all `797/797` observed entrant exits are classified by the integrated audit as **payrollLiquidity**. Credit-only, both, and other classifications are zero.

This is a provenance/aggregation correction. The simulation itself did not change.

## R4-BM — Wage-ratchet / nominal adjustment asymmetry

Across the four complete artifacts:

- mean firm wage-change share: `0.00192763` ≈ **0.193%**
- maximum observed wage-down share: **0%**
- mean price-move share: `0.9642357` ≈ **96.42%**

### Claim

**A — VERIFIED EXISTING FACT:** In the tested canonical runs, firm wages are almost static at monthly frequency and no downward wage movement is observed, while prices move in nearly every firm-month observation.

**B — DIAGNOSTIC LEAD:** The economy contains a strong nominal adjustment asymmetry. This can amplify payroll stress when firm revenue falls because the price system adjusts rapidly while nominal payroll obligations do not symmetrically adapt.

**Limit:** This does not establish that wage downward rigidity is a sufficient root cause. A causal wage-flexibility ablation is required because wage cuts can also depress household income and demand.

**R4-BM verdict: PASS.**

## R4-BN — Entrant exit proximate condition

Complete four-seed aggregation:

- entrants: **922**
- entrant exits: **797**
- payroll/liquidity classified exits: **797**
- credit-only: **0**
- both: **0**
- other: **0**

### Claim

**A — VERIFIED EXISTING FACT:** Every entrant exit classified by the integrated audit is proximate to payroll/liquidity distress.

**B — DIAGNOSTIC LEAD:** The entrant-regeneration failure is therefore not an unidentified miscellaneous exit process at the final trigger. The next question is what generates the payroll/liquidity deficit: zero/low startup finance, failure to obtain workers, missing capital/input bootstrap, weak revenue realization, debt/tax drains, wage rigidity, credit timing/rationing, or combinations of these.

**Limit:** `payrollLiquidity` is a proximate exit-state classification, not an ultimate structural cause. Treating it as the root cause would conflate trigger with mechanism.

**R4-BN verdict: PASS for proximate classification; ultimate cause remains INCOMPLETE pending R4-BR.**

## R4-BQ — Credit underwriting selectivity

Complete four-seed aggregation:

- firm credit applications: **891**
- approved: **35**
- weighted approval rate: **3.928%**
- approved borrowers mean prior revenue: **61,710.5**
- rejected borrowers mean prior revenue: **2,754.5**
- approved 3-month active share: **71.43%**
- rejected 3-month active share: **59.35%**

### Claim

**A — VERIFIED EXISTING FACT:** Credit approval is extremely rare in the observed applications and is strongly associated with higher prior revenue. Approved firms also have modestly better three-month survival than rejected firms.

**B — DIAGNOSTIC LEAD:** Underwriting is selecting materially stronger borrowers, so low approval cannot by itself be interpreted as evidence that banks are simply too strict. The observed rate can arise from bank lending-capacity constraints, risk/AI underwriting gates, extremely weak applicant quality, requested-amount mismatch, or several of these simultaneously.

**R4-BQ verdict: PASS/PARTIAL.** Selectivity is established; rejection-gate decomposition remains open and moves to R4-BS.

## Integrated interpretation

The combined BM/BN/BQ evidence narrows the regeneration failure into a lifecycle problem rather than a single market-friction explanation:

1. entrant firms overwhelmingly terminate under payroll/liquidity distress;
2. nominal wages show essentially no downward adaptation while prices adjust continuously;
3. credit exists as a weak stabilizer but only a small minority of applying firms receive loans;
4. approved borrowers are already much healthier than rejected borrowers.

The next causal frontier must therefore decompose the **cash-flow waterfall, credit rejection gates, wage-flexibility trade-off, labor-force ontology, asset liquidation/recycling, and ownership/profit circulation** in parallel. No canonical repair is authorized by this closure.

## Next frontier

R4-BR through R4-BW will be executed as a widened, high-throughput diagnostic batch with original and heldout seeds. Independent fronts must remain separable in artifacts so a favorable result in one subsystem cannot hide deterioration in another.
