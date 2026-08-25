# WP-RV08 R4-CE-A Closure — Deterministic Person Employment Contract Projection — 2026-08-25

## Verdict

**PASS / FOUR-SEED DETERMINISTIC LEGACY-EMPLOYMENT PROJECTION OPERATIONAL / UNRESOLVED DEMOGRAPHIC CONTRADICTIONS EXPOSED RATHER THAN SILENTLY REPAIRED / CANONICAL BEHAVIOR UNCHANGED**

R4-CE-A is formally closed.

The work package implements a read-only `PersonEmploymentContractRegistry` that projects the current household-slot employment state onto eligible shadow persons without mutating the canonical labor market, production, payroll, ledger or accounting paths.

## Provenance

- repository: `shinsihu10123/ProceduralCity`
- branch: `scratch/new-project-2026-08-12`
- workflow head: `98fb7a914d7a5932b5f3a7830cea705c4cb2db69`
- workflow run: `32801318804`
- implementation: `economic-lab/src/research/person-employment-contract-registry.js`
- diagnostic: `economic-lab/scripts/rv08-r4-ce-a-contract-projection-gate-v10.mjs`
- workflow: `.github/workflows/economic-lab-rv08-r4-ce-a-contract-projection.yml`
- horizon: 12 months
- seeds: original A, original C, heldout E, heldout F
- matrix: **4/4 success**

Every shard passed:

- exact world replay;
- exact projection replay;
- registry validation;
- canonical health/accounting gates;
- contract creation observed;
- contradiction detection observed;
- no-silent-repair count reconciliation.

## Final-month results

| Seed | Canonical employed households | Projected person contracts | Unresolved employed households | Projection coverage |
|---|---:|---:|---:|---:|
| Original A | 176 | 113 | 63 | 64.20% |
| Original C | 213 | 155 | 58 | 72.77% |
| Heldout E | 204 | 135 | 69 | 66.18% |
| Heldout F | 205 | 140 | 65 | 68.29% |
| Mean | **199.5** | **135.75** | **63.75** | **67.86%** |

The diagnostic demographic fixture therefore supports a deterministic person projection for roughly two thirds of currently employed household slots at month 12. Roughly one third remain structurally unresolved because the household is canonically employed while the fixture contains no eligible participating person that can legally receive the projected contract.

This is a diagnostic fixture result, not an empirical estimate of real-world labor-force eligibility.

## Contract semantics proven in R4-CE-A

The registry now represents, without behavioral mutation:

- person ID;
- household ID;
- firm ID;
- projection/start month;
- standard hours;
- contracted/worked hours;
- hourly wage rate derived from the legacy monthly wage compatibility bridge;
- gross wage due;
- observed wage cash paid;
- operational arrears attribution;
- effective skill factor;
- labor units.

Validation proves:

- no person has multiple active primary projected contracts;
- person-household references are coherent;
- projected firms exist and are active;
- worked hours do not exceed contracted/available hours;
- gross wage due equals hours × hourly wage;
- projected + unresolved employed households exactly reconcile to canonical employed households.

## Important identification result

R4-CE-A makes the opening/migration problem concrete.

A person-based labor switch cannot simply reinterpret every currently employed household as one valid employed person. Under the explicit diagnostic fixture, 27–36% of current employed household slots have no eligible participating person available for a direct one-to-one projection at the tested final month.

Therefore M3 treatment initialization must preserve the R4-CE rule:

- project a canonical job only when an eligible person exists;
- explicitly release or separately handle unresolved legacy jobs;
- never fabricate eligible workers silently merely to preserve the legacy employment count.

## What R4-CE-A does not establish

R4-CE-A does not prove:

- that the diagnostic demographic profile is realistic;
- that the projected contract count should become canonical employment;
- that unemployment should immediately switch to the shadow person rate;
- that wages should be converted to an hourly system in production yet;
- that firm production should use projected labor units;
- that unresolved contracts represent real demographic unemployment.

These remain downstream questions.

## Next gate

`R4-CE-B` must prove that person-attributed wage claims can be mapped onto the existing household/firm accounting entities with complete reconciliation before any alternate payroll behavior is enabled.

The accounting design remains:

- Person = labor attribution / contract counterparty;
- Household = deposit and GL income/receivable entity in first M3;
- Firm = wages-payable and payroll cash-outflow entity;
- person/contract IDs carried in wage accrual and settlement metadata when the behavioral adapter is eventually enabled.

## Checkpoint

`CHECKPOINT = R4-CE-A-CLOSED-PASS / FOUR-SEED-CONTRACT-PROJECTION-DETERMINISTIC / UNRESOLVED-LEGACY-JOBS-VISIBLE / R4-CE-B-PREFLIGHT-NEXT / LEGACY-DEFAULT-LOCKED`
