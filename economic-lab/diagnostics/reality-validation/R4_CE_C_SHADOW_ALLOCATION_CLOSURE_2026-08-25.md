# R4-CE-C Shadow Employment Allocation Rehearsal — Closure

Status: **CLOSED / PASS AS SHADOW REHEARSAL / BEHAVIORAL SWITCH NOT APPROVED**

Date: 2026-08-25
Authoritative branch: `scratch/new-project-2026-08-12`
Authoritative implementation head: `d548f158dbea2a408773dcfeef788d1702020c0a`
Authoritative workflow run: `32825002210`

## 1. Scope

R4-CE-C tested whether person-level labor supply, establishment-level shadow labor demand, hours/labor-unit allocation, and household income pooling can be rehearsed deterministically without changing canonical Economic Lab behavior.

This package did **not** replace `clearLaborMarket`, payroll settlement, canonical household employment flags, firm worker counts, taxes, transfers, ledger entries, or general-ledger accounting.

## 2. Gate result

All four required shards passed:

- `ECON-RV02-A` — PASS
- `ECON-RV02-C` — PASS
- `ECON-RV08-HOLDOUT-E` — PASS
- `ECON-RV08-HOLDOUT-F` — PASS

For all four shards the following gates were true:

- exact canonical replay
- exact rehearsal replay
- allocation validation
- complete transition ledger
- person-hours and firm-demand bounds
- household income-pooling observation
- canonical accounting/health preservation

Artifacts were produced for all four shards and retained for 90 days under workflow run `32825002210`.

## 3. Final-month evidence

| Seed | Labor force persons | Allocated persons | Allocated labor units | Legacy employed households | Legacy mapped households | Legacy no eligible person | Legacy eligible but unallocated | Legacy gross wage due | Proposed shadow gross wage due |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Original A | 2166 | 65 | 56.1215 | 176 | 45 | 56 | 75 | 17050.17 | 5585.66 |
| Original C | 2166 | 76 | 71.4783 | 213 | 52 | 67 | 94 | 20769.48 | 6730.28 |
| Heldout E | 2166 | 66 | 59.6918 | 204 | 46 | 61 | 97 | 19945.70 | 5714.02 |
| Heldout F | 2166 | 82 | 75.6594 | 205 | 56 | 60 | 89 | 19619.85 | 7123.93 |

The rehearsal also produced multi-earner households in every seed while preserving household-level pooling identities.

## 4. Interpretation

The person/household/employment schema is operationally viable as a deterministic shadow layer. The allocator can assign persons to firms subject to hours, skill and establishment labor-demand bounds while preserving canonical state exactly.

However, the current shadow labor-demand envelope is **not suitable for behavioral switching**. Only 65–82 persons are allocated out of 2166 labor-force persons at month 12, while legacy employment remains 176–213 households. Proposed shadow gross wage due is roughly one third of legacy gross wage due.

This is not evidence that the realistic economy should employ only 65–82 people. The dominant constraint is the current M2 demand estimator, which intentionally uses a cash-only lower-bound working-capital treatment. In the current `ShadowLaborDemandSystem`, `existingUndrawnCredit` and `admissibleNewCreditCapacity` remain unresolved/null and `availableWorkingCapital` is effectively current cash. Therefore R4-CE-C exposes a lower-bound allocation regime, not a production-ready labor-demand function.

The near-zero unfilled firm-demand residual in all four shards confirms that the allocator is satisfying the demand signal it receives. The problem is therefore upstream of allocation: the demand/working-capital envelope is too restrictive for a behavioral switch.

## 5. Closure decision

R4-CE-C is closed as **PASS AS SHADOW REHEARSAL**.

It does **not** authorize:

- replacing canonical household employment with person contracts;
- replacing canonical firm worker counts with R4-CE-C allocations;
- using the current cash-only shadow demand as the production labor-demand rule;
- recalibrating wages or labor-force participation to force agreement with legacy employment.

## 6. Next dependency-safe work

The next required package is **R4-CE-D — Working-Capital-Aware Labor Demand Envelope**.

R4-CE-D must separate and measure, per establishment:

1. physical labor need;
2. canonical target labor;
3. cash-only financeable labor;
4. already-committed/undrawn credit capacity where representable;
5. admissible new working-capital credit under current underwriting rules;
6. full financeable labor after input and payroll requirements;
7. binding constraint classification.

Only after this envelope is deterministic, accounting-safe, and validated across original and held-out seeds may a person-level behavioral labor switch be reconsidered.

## 7. Locked checkpoint

`R4-CE-C-CLOSED-PASS-AS-SHADOW-REHEARSAL / BEHAVIORAL-SWITCH-BLOCKED-BY-WORKING-CAPITAL-DEMAND-ENVELOPE / R4-CE-D-NEXT`
