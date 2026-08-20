# WP-RV08-R5 — Held-Out Validation Protocol v1.0

Status: **FROZEN BEFORE REPAIR CANDIDATE SELECTION**
Date: 2026-08-20
Purpose: prevent diagnosis-set overfitting when the first coherent Economic Lab repair candidate is constructed.

## 1. Separation rule

The current diagnostic seeds:

- `ECON-RV02-A`
- `ECON-RV02-B`
- `ECON-RV02-C`

and all `DET`, `NI`, Pxx/Rx instrumentation seeds are **development/diagnostic evidence only**.

They may be used to identify mechanisms and build the first repair candidate, but they cannot be used to claim held-out validation.

## 2. Frozen held-out seed set

The first repair candidate must be code-frozen before any macro results from these seeds are inspected:

- `ECON-RV-HO-001`
- `ECON-RV-HO-002`
- `ECON-RV-HO-003`
- `ECON-RV-HO-004`
- `ECON-RV-HO-005`
- `ECON-RV-HO-006`
- `ECON-RV-HO-007`
- `ECON-RV-HO-008`
- `ECON-RV-HO-009`
- `ECON-RV-HO-010`
- `ECON-RV-HO-011`
- `ECON-RV-HO-012`

No seed may be dropped after results are known.

## 3. Candidate-freeze rule

Before held-out execution, record:

- exact repository SHA;
- exact candidate mechanism list;
- every changed source path;
- every changed numerical constant and whether it is derived, inherited or empirically calibrated;
- expected causal effect of each change;
- accounting treatment;
- explicit known limitations.

After the freeze, a held-out failure cannot be repaired and rerun under the same validation label. Any change creates a new candidate version and requires a fresh held-out admission cycle.

## 4. Comparison arms

At minimum run:

1. frozen canonical implementation baseline;
2. structural unit-basis comparison used during RV07/RV08;
3. first coherent repair candidate;
4. diagnostic upper bounds only where needed to interpret residual failure.

Upper bounds such as `no exits`, `no layoffs`, free physical bootstrap or unrestricted bank approval are never admissible as the production candidate merely because they score well.

## 5. Horizons

### Gate H12 — 12 months

Purpose: initialization and early-transition stability.

### Gate H24 — 24 months

Purpose: exit wave, replacement dynamics, supply propagation and financing lifecycle.

### Gate H60 — 60 months

Purpose: medium-run stability and avoidance of delayed synchronized collapse.

### Gate H120 — 120 months

Purpose: long-run regime stability and institutional stock-flow accumulation.

### Gate H240 — 240 months

Run after H12/H24/H60/H120 structural gates pass. Purpose: long-run health, bounded-history behavior, accounting drift and performance degradation.

## 6. Scale coverage

Required:

- `compact` for fast deterministic/debug equivalence;
- `baseline` for admission.

`large` or a later production-scale profile is a performance/scaling gate, not a substitute for baseline economic validation.

## 7. Non-negotiable structural gates

Every comparison arm must report:

### Determinism / execution

- exact deterministic replay where the system contract requires determinism;
- finite state;
- health monitor PASS;
- complete country/seed/horizon coverage;
- no silent job-success masking of failed diagnostic commands (`pipefail` or equivalent required).

### Settlement / accounting

- transaction-ledger verification PASS;
- double-entry accounting PASS;
- cash reconciliation PASS;
- deposit/loan reconciliation PASS;
- fiscal/monetary/international/asset-market accounting PASS where applicable;
- expenditure GDP arithmetic identity PASS;
- production/income-side reconstruction added before empirical NIA validation;
- physical ↔ book inventory reconciliation under the admitted accounting semantics;
- explicit inactive-firm estate disposition semantics.

### Economic stock-flow integrity

- no spontaneous unaccounted money creation/destruction;
- no free physical inventory/capital injection unless represented by a documented counterpart transaction/state transition;
- no employment attached to inactive firms;
- exit, liquidation, restructuring and successor entry must conserve or explicitly dispose assets/liabilities;
- entrant funding must have an identified funding source/counterparty;
- bank losses and guarantees, if added, must have balance-sheet counterparties.

## 8. Internal dynamic validation gates

These are **model-behavior gates**, not claims that a particular real economy should have a specific number.

Reject a candidate if held-out runs show any of the following as a generic attractor rather than an explicit shock outcome:

- synchronized near-total firm extinction;
- unemployment converging toward near-total unemployment across unrelated seeds/countries;
- persistent zero/near-zero household goods availability caused by model mechanics;
- permanent entrant non-operation caused solely by zero-resource construction with no feasible financing/asset-transfer path;
- ever-growing orphan book inventory disconnected from physical production;
- accumulating wage arrears while employment is mechanically protected with no solvency resolution;
- money/accounting drift;
- active-firm stock collapsing because of an arbitrary replacement throughput cap rather than economic entry conditions.

A candidate can still contain recessions, bankruptcies, unemployment, credit rationing, shortages and structural change. The gate is against a mechanically universal collapse attractor.

## 9. Distributional reporting

Do not validate only pooled means.

For every horizon report:

- per seed;
- per country;
- median;
- interquartile range;
- min/max or tail percentiles;
- fraction of country-runs crossing predefined severe-collapse flags;
- time-to-first threshold events;
- recovery/crossover timing where relevant.

No single favorable seed may carry admission.

## 10. Mechanism-specific held-out panels

### Firms / labor

- active firms;
- exits and entries;
- replacement deficit;
- workers displaced at exit;
- hires, planned layoffs and exit-boundary displacement;
- wage arrears;
- operating contribution/payroll coverage;
- liquidity vs solvency state.

### Supply / goods

- production by sector;
- B2B procurement fill;
- input shortage;
- seller stock vs buyer shortage;
- household goods fulfillment;
- finished/input inventories;
- active vs inactive inventory ownership.

### Finance

- credit applications/approval/origination;
- bank capital and reserves;
- defaults/charge-offs;
- startup equity/owner capital/trade credit if admitted;
- entrant finance and post-entry survival separately.

### National accounts

- consumption;
- gross fixed investment;
- inventory investment;
- government components;
- net exports;
- production-side value added;
- compensation/profit/income-side components where supported;
- inventory/WIP traceability.

## 11. Empirical validation is a separate phase

Passing R5 internal held-out validation does **not** establish realism.

After internal structural admission, create a separate empirical target registry from authoritative sources such as national statistical offices, OECD, IMF, BIS, World Bank and peer-reviewed literature. Each empirical target must specify:

- exact definition;
- unit/time aggregation;
- population/sample;
- source date;
- model mapping;
- calibration vs validation status;
- tolerance rationale.

Calibration data and empirical validation data must be separated before numerical fitting begins.

## 12. Anti-tuning rule

No coefficient may be changed merely because it improves unemployment, GDP, survival or another headline metric on the diagnostic or held-out ensemble.

A numerical change requires one of:

- dimensional/unit derivation;
- accounting identity;
- institutional rule derived from the model contract;
- documented external calibration target.

Otherwise it remains a diagnostic counterfactual.

## 13. Admission verdicts

### PASS

All structural/accounting gates pass and held-out dynamics remove the universal collapse pathology without relying on inadmissible upper bounds.

### PARTIAL

Major pathology is removed, but one or more bounded mechanism/semantic defects remain. No production realism claim.

### FAIL

The candidate retains the collapse attractor, violates accounting/stock-flow invariants, or depends on diagnostic-only upper bounds.

### BLOCKED

Execution/data tooling prevents a valid held-out judgment.

## Frozen protocol verdict

**PASS — VALIDATION CONTRACT FROZEN BEFORE REPAIR CANDIDATE SELECTION.**
