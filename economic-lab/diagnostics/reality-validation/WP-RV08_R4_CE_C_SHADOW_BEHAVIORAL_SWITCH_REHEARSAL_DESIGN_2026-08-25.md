# WP-RV08 R4-CE-C — Shadow Behavioral Switch Rehearsal Design

Date: 2026-08-25
Status: **DESIGN GATE OPEN / IMPLEMENTATION NEXT**
Canonical mutation: **LOCKED**

## 1. Objective

Construct a complete person-level labor-market *proposal* from the existing shadow person layer and shadow labor-demand estimates, then compare it with the legacy household labor market without allowing the proposal to write back into canonical state.

R4-CE-C is the last broad non-mutating rehearsal before any controlled M3 switch experiment can be considered.

## 2. Inputs

R4-CE-C may read:
- `ShadowPersonHouseholdSystem` persons, household membership, working-age state, labor-force participation, hours available, and effective skill factor;
- `ShadowLaborDemandSystem` firm-level physical labor need, capacity labor limit, financeable labor estimate, and shadow desired labor units;
- active canonical firms and their wage offers;
- R4-CE-A contract-projection results as a legacy bridge only;
- R4-CE-B wage-attribution audit outputs for reconciliation.

It may not modify any of those canonical inputs.

## 3. Proposed person-level allocation

For each country, the rehearsal shall create an immutable `ShadowEmploymentAllocation` with:

- `personId`
- `householdId`
- `firmId`
- `contractedHours`
- `hoursWorked`
- `skillFactor`
- `laborUnits`
- `wageRatePerHour`
- `grossWageDue`
- `allocationSource`
- `transitionClass`

Eligible persons are alive, working-age, labor-force participants with positive available hours.

Firm demand is bounded by the R4-CD/R4-CE shadow labor-demand view. Cash-only financeability is diagnostic and must not be silently treated as the final credit-aware demand ceiling.

## 4. Transition classes

Every legacy employed household and every newly allocated person must be classifiable. At minimum:

- `LEGACY_MAPPED_SAME_FIRM`
- `LEGACY_MAPPED_DIFFERENT_PERSON`
- `LEGACY_EMPLOYED_NO_ELIGIBLE_PERSON`
- `PERSON_ALLOCATED_FROM_PREVIOUSLY_UNRESOLVED_HOUSEHOLD`
- `PERSON_NEWLY_EMPLOYED_FROM_NONEMPLOYED_HOUSEHOLD`
- `ELIGIBLE_PERSON_UNALLOCATED`
- `FIRM_DEMAND_UNFILLED`

No class may be auto-repaired away.

## 5. Household income pooling proposal

The rehearsal must aggregate person wage claims back to household level without posting them:

`householdProjectedLaborIncome = sum(person gross wage due in household)`

It must separately expose:
- households with zero labor income;
- households with one earner;
- households with multiple earners;
- labor income per household member;
- legacy-vs-proposed labor-income delta;
- proposed wage due vs legacy wage due.

This is a projection only. Fiscal taxes, transfers, consumption budgets, ledger cash, and GL accounts remain untouched.

## 6. Hard invariants

The implementation gate must fail if any of the following occurs:

1. Canonical world digest differs between control and rehearsal.
2. A person has more than one active primary allocation.
3. Allocated hours exceed person hours available.
4. Firm allocated labor exceeds the selected shadow demand bound beyond tolerance.
5. Household membership is broken.
6. Gross wage identity fails: `hoursWorked × wageRatePerHour = grossWageDue`.
7. Any legacy employed household disappears from the transition ledger without a transition class.
8. Any previously unresolved legacy household is silently marked resolved without a real eligible person allocation.
9. Deterministic replay differs for the same seed.

## 7. Required diagnostics

Per country and per seed, capture:
- eligible persons;
- labor-force persons;
- allocated persons;
- unallocated eligible persons;
- total allocated hours;
- total allocated labor units;
- firm demand labor units;
- unfilled firm demand;
- legacy employed households;
- legacy mapped households;
- previously unresolved households;
- previously unresolved households now genuinely resolved by a distinct eligible person allocation;
- households by number of earners;
- legacy gross wage due;
- proposed gross wage due;
- gross wage delta;
- transition-class counts.

## 8. Validation matrix

Use the same four diagnostic seeds:
- `ECON-RV02-A`
- `ECON-RV02-C`
- `ECON-RV08-HOLDOUT-E`
- `ECON-RV08-HOLDOUT-F`

Initial gate window: 12 months.

A later 24+ month window is required before behavioral activation, but not for the first CE-C implementation gate.

## 9. PASS criteria

R4-CE-C may close only if all four seeds satisfy:
- exact canonical replay;
- exact rehearsal replay;
- allocation validation OK;
- all legacy employed households represented in transition accounting;
- all person hours constraints respected;
- all firm labor allocation bounds respected;
- household income pooling identities exact;
- hard accounting/ledger/health gates remain healthy.

## 10. Explicit non-authorization

Even a PASS does **not** authorize immediately replacing `clearLaborMarket`, `settlePayroll`, household employment flags, or firm worker counts.

A PASS only authorizes designing the first controlled M3 A/B behavioral switch, with rollback and legacy shadow comparison retained.
