# WP-RV08 R4-CE-B — Person-attributed Wage Accounting Preflight Closure

Date: 2026-08-25
Status: **CLOSED / PASS AS NON-MUTATING PRECONDITION EVIDENCE**
Canonical behavior mutation: **NOT AUTHORIZED**

## 1. Purpose

R4-CE-B verifies that legacy household-level employment and wage accounting can be observed through a person-attributed contract projection without changing canonical world state, and that wage obligations remain reconcilable while unresolved household/person ontology conflicts stay explicit.

This is a migration preflight. It is not a calibration result and does not authorize a person-level labor-market switch.

## 2. Authoritative execution

Workflow: `Economic Lab RV08 R4-CE-B Wage Attribution Preflight`
Run: `32824666166`
Head SHA: `224f5b0c80d7181cd83770cb8f76682bc894e13f`
Cases:
- `ECON-RV02-A`
- `ECON-RV02-C`
- `ECON-RV08-HOLDOUT-E`
- `ECON-RV08-HOLDOUT-F`

Result: **4/4 SUCCESS**.

Required gates passed on every shard:
- exact world replay
- exact audit replay
- contract registry validation
- wage-attribution identities
- canonical health / ledger / accounting health
- unresolved attribution remains visible
- signed GL wage claims are observed

## 3. Defect isolated during preflight

An earlier R4-CE-B run reported an apparent cross-entity wage-claim mismatch. The diagnostic path was not suppressed. The audit was expanded to distinguish signed balances from positive-only balances.

The subsequent run showed the original apparent mismatch was not evidence of a persistent economic balance failure at the 12-month endpoint. For Original-A, signed household wage receivables and signed firm wage payables reconcile to numerical precision:

- signed household wage receivable: `767230.897362545`
- signed firm wages payable: `767230.8973625454`
- signed error: approximately `-3.49e-10`
- negative wage-receivable entities: `0`
- negative wages-payable entities: `0`

A second defect was then found in the preflight harness itself: `glWageClaimsObserved` still referenced removed pre-audit field names. Commit `224f5b0c80d7181cd83770cb8f76682bc894e13f` corrected that wiring to use the signed GL fields. The authoritative 4-seed run then passed.

## 4. What this closes

R4-CE-B establishes that:

1. Person-attributed employment contracts can be projected deterministically without modifying canonical simulation state.
2. Projected and unresolved wage-due components reconcile to the canonical gross wage obligation within numerical tolerance.
3. Signed household wage receivables and firm wages payable can be cross-checked explicitly.
4. The migration tooling can preserve unresolved household/person contradictions rather than silently inventing workers.
5. The accounting preflight itself is now protected against the stale-field wiring defect found during this WP.

## 5. What this does NOT prove

R4-CE-B does not prove that:

- the diagnostic demographic fixture is empirically calibrated;
- every legacy employed household has an eligible person;
- person-level hiring/firing dynamics are ready to replace the legacy labor market;
- person-level payroll posting may yet mutate canonical accounting safely;
- legacy `household.employed`, `household.employerId`, or `firm.workers` may be removed;
- the unresolved projection share may be silently redistributed.

R4-CE-A already showed material incomplete projection coverage. That remains a hard migration constraint.

## 6. Closure decision

**PASS / CLOSE R4-CE-B.**

The next dependency-safe unit is R4-CE-C: a shadow behavioral-switch rehearsal that computes a complete person-level employment allocation and household income-pooling proposal while leaving the canonical labor market, payroll settlement, tax base, firm worker counts, and GL postings unchanged.

No canonical person-level labor-market switch is authorized until R4-CE-C demonstrates deterministic allocation, population/contract conservation, capacity and hours constraints, explicit treatment of formerly unresolved households, and exact canonical replay.
