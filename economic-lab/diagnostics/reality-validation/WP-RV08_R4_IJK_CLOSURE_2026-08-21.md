# WP-RV08 R4-I/J/K Superbatch Closure

Date: 2026-08-21
Status: **PASS — CAUSAL NARROWING / REPAIR SUFFICIENCY FAIL-CONTINUE**
Frozen economic implementation baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`
Executed source commit: `8e1a8a3a5736b141fa7c24ffc78a42a2442ab624`
Canonical mechanism changes: **0**
Parameter tuning: **0**
Empirical realism claim: **NO**

## Execution evidence

Workflow run: `32383191416` — **SUCCESS**

| Track | Job | Artifact | Artifact ID | SHA-256 |
|---|---|---|---:|---|
| R4-I Estate recycling | R4-I estate recycling counterfactual | `economic-lab-wp-rv08-r4-i` | `9412060472` | `971b7a86688eb0e145d280d2527152fa0adff6a510c6dbe23a39fa2286f25af4` |
| R4-J Viability guard × supply | R4-J viability guard x supply | `economic-lab-wp-rv08-r4-j` | `9412187483` | `c84f35782b6640fdb513b164c966400930176f6f7aa6d12004f372ea6ec24127` |
| R4-K Exit cash-flow / accounting audit | R4-K exit candidate cashflow waterfall | `economic-lab-wp-rv08-r4-k` | `9411947712` | `0bffe6e7c17044c9747694ad24f6e8869ff2a13ef80ad97cf219f411e5c7db0a` |

All three jobs completed successfully. R4-K hard audit gates passed. R4-I and R4-J intentionally include sufficiency/long-horizon gates that failed because the diagnostic interventions did not close the collapse; this is an economic result, not an execution failure.

## R4-I — Estate recycling counterfactual

### A — VERIFIED EXISTING FACT

In the 24-month baseline control, terminal unemployment is approximately `0.895924`, employment `0.104076`, and exits `23.0833` on the aggregated terminal comparison used by the diagnostic.

The strongest tested physical estate disposition (`capital-inventory`) materially shifts the terminal state:

- unemployment: approximately `0.643529`;
- employment: approximately `0.356471`;
- exits: approximately `15.667`;
- facilities transferred: approximately `12.583`;
- recycled material: approximately `3290.67`.

Physical-transfer conservation and intervention-activation gates passed. However, the terminal employment gap and long-horizon sufficiency gates failed. Consumer book inventory without corresponding physical finished goods remains complete at the terminal comparison (`share = 1`).

### Verdict

**PARTIAL / FAIL-CONTINUE — EXIT-ESTATE STRANDING IS A MATERIAL CAUSAL AMPLIFIER, BUT PHYSICAL ESTATE RECYCLING ALONE IS NOT SUFFICIENT AND DOES NOT REPAIR THE BOOK/PHYSICAL ACCOUNTING DEFECT.**

## R4-J — Exit-candidate viability × supply complementarity

### A — VERIFIED EXISTING FACT

24-month terminal comparison:

| Variant | Terminal unemployment | Terminal employment | Exits |
|---|---:|---:|---:|
| Control | `0.895924` | `0.104076` | `23.0833` |
| Supply-only | `0.845624` | `0.154376` | `23.0833` |
| Exit-candidate-only | `0.447558` | `0.552442` | `20.5833` |
| Joint | `0.555852` | `0.444148` | `20.5833` |

Both causal axes activate and materially discriminate outcomes. The joint-sufficiency and long-horizon gates fail. The joint variant is not additive and is worse than the exit-candidate-only upper bound on terminal employment.

### Verdict

**PARTIAL / FAIL-CONTINUE — SUPPLY IS A REAL COMPLEMENT, BUT THE SELECTIVE EXIT-CANDIDATE × SUPPLY COMBINATION DOES NOT CLOSE THE COLLAPSE AND CANNOT BE ADMITTED AS A PRODUCTION REPAIR.**

## R4-K — Objective cash-flow and accounting audit

### A — VERIFIED EXISTING FACT

All audit gates pass. Key 24-month observations:

- zero-physical-output firm-month rows: `307`;
- rows with physical output: `921`;
- total physical output: `12,320.8503`;
- total finished-goods book inventory created: `19,569,655.37`;
- total production-labor capitalization: `17,013,725.01`;
- zero-output labor capitalization: `1,744,452.91`;
- zero-output rows with labor capitalization: `290`;
- zero-output rows with book inventory above `1,000`: `118`;
- rows with book inventory above `1,000` while physical finished inventory is near zero: `187`.

Cash-flow evidence:

- total tracked operating outflow: `35,238,349.48`;
- wages paid: `16,933,411.82`;
- procurement spend: `18,304,937.65`;
- tracked revenue: `17,821,570.39`;
- total negative operating cash flow: `17,416,779.08`;
- firm-month rows with negative operating cash flow: `459`;
- total payroll arrears: `3,785,918.37`;
- rows with payroll arrears: `127`.

The exit-decision trace captures `127` execution-layer exit candidates and `127` natural exits. The audit does **not** support the stronger claim that all exits occur at literal zero cash or at one raw cash threshold. It supports objective operating deficit / arrears distress plus a distinct book-versus-physical inventory defect.

### Verdict

**PASS — OBJECTIVE OPERATING DEFICITS ARE REAL, WHILE ZERO-OUTPUT LABOR CAPITALIZATION CREATES A SEVERE AND SEPARATE ACCOUNTING-REPRESENTATION DEFECT.**

## Cross-track synthesis

### A — VERIFIED EXISTING FACTS

1. Destructive exit/estate propagation is causal, not merely descriptive: recycling stranded productive stock materially improves employment and survival.
2. That channel is not sufficient. A large terminal unemployment gap remains after aggressive estate recycling.
3. Supply sequencing/access remains a material but secondary/complementary channel.
4. Selective exit protection can have large upper-bound employment effects, but interaction with supply is non-additive and still fails long-horizon sufficiency.
5. The model has genuine operating-cash deficits and wage arrears; collapse cannot be dismissed as a pure accounting illusion.
6. Separately, finished-goods accounting is physically defective because labor is capitalized into inventory even in many zero-output contexts.

### B — DIAGNOSTIC LEAD

Source inspection after R4-K identifies an additional causal route that must be tested before repair design is closed:

`production_labor_accrual -> finished-goods book inventory instead of period expense in zero-output contexts -> higher accounting net income -> corporate-tax base -> cash transfer out of firms -> liquidity/arrears/exit feedback`.

This is source-supported because `AccountingSystem.accrueMonthlyWages()` debits `inventory` for production labor irrespective of current physical output, while `GovernmentSystem.collectCorporateTaxes()` taxes positive `GeneralLedger.incomeStatement(f).netIncome` before the exit evaluation. The magnitude and causal importance of that tax-feedback route are not yet established.

### C — HYPOTHESES

- H-IJK-1: estate stranding is a material propagation amplifier — **SUPPORTED**.
- H-IJK-2: estate recycling alone is sufficient — **FALSIFIED**.
- H-IJK-3: supply repair plus selective exit protection is sufficient — **FALSIFIED**.
- H-IJK-4: the accounting defect is purely observational and cannot affect survival — **OPEN / SOURCE EVIDENCE SHOWS A POSSIBLE CORPORATE-TAX CASH-FLOW PATH**.
- H-IJK-5: physically conditional labor-cost recognition materially reduces tax-driven liquidity stress without blanket exit suppression — **NEXT CAUSAL TEST**.

### D — PROPOSED CHANGE STATUS

No canonical repair is authorized.

A diagnostic accounting reclassification is admitted for the next batch only: reclassify current-month production labor from finished-goods inventory to period expense when current physical output is zero, while leaving household wage accrual, wage settlement, money, prices, physical production, procurement, underwriting thresholds and tax rates unchanged. An `all-labor-expensed` variant may be used strictly as an upper bound, not as a production proposal.

## Overall verdict

**PASS — ROOT-CAUSE FRONTIER NARROWED FURTHER. DESTRUCTIVE EXIT/ESTATE PROPAGATION IS MATERIAL BUT INSUFFICIENT; OBJECTIVE OPERATING DEFICITS ARE REAL; AND THE SEPARATE ZERO-OUTPUT LABOR-CAPITALIZATION DEFECT NOW HAS A SOURCE-VERIFIED POSSIBLE CASH-FLOW FEEDBACK THROUGH CORPORATE TAXATION THAT REQUIRES DIRECT CAUSAL ISOLATION.**

Next dependency-safe batch: **R4-L/M/N accounting-recognition × tax-cashflow × estate interaction**, 24-month, compact + baseline, three diagnostic seeds, deterministic replay, ledger/accounting/GDP arithmetic gates, non-canonical only.
