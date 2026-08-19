# WP-RV05 — GDP / National-Income-Accounting Composition Diagnosis

Status: **EXECUTION REQUESTED**
Date: 2026-08-19

## Frozen economic semantics

Economic Model Frozen Baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`.

Economic mechanism changes authorized: **0**.
Parameter tuning authorized: **0**.

## Admission

- WP-RV02: PASS — bounded 12-month baseline reproduction across seeds A/B/C.
- WP-RV03: PASS — labor/goods causal decomposition.
- WP-RV04: PASS — firm distress & exit attribution.

WP-RV05 is dependency-safe.

## Promoted experiment

- scale: baseline
- seeds: `ECON-RV02-A`, `ECON-RV02-B`, `ECON-RV02-C`
- horizon: 12 months
- diagnostic runner: `economic-lab/scripts/nia-composition-diagnosis-v10.mjs`

## Questions

1. Does the implemented expenditure-side GDP identity reconcile exactly at every country-month?
2. Does reported inventory investment reconcile exactly to the change in the aggregate firm inventory book?
3. Do exact GL inventory debit/credit movements reconcile to that stock change, and which journal kinds create or extinguish the book value?
4. How often does inventory investment dominate measured GDP magnitude during the pathological contraction?
5. Does inventory book value rise while physical finished-goods quantities fall, indicating that nominal inventory composition/valuation must be separated from physical availability?
6. How much inventory book value remains attached to inactive firms after exits?
7. How much payroll accrual is capitalized into finished-goods inventory, including any capitalization on firms reporting zero physical output in the same month?
8. Does the code implement independent production-approach or income-approach GDP measures that could serve as cross-checks?

## Method

The runner performs read-only inspection after each normal monthly step. It does not wrap or replace any economic method.

For every country-month it records:

- `C`, gross private investment, public investment, government consumption, inventory investment, net exports and GDP;
- aggregate finished-goods and input-inventory book stocks from the General Ledger;
- physical finished and input inventory units;
- active/inactive and consumer/non-consumer inventory-book decomposition;
- every GL debit/credit touching `inventory` or `input_inventory`, grouped by journal kind;
- payroll accrual and its inventory capitalization;
- current physical output.

Hard gates require:

- health PASS;
- complete 3-seed × 4-country × 12-month coverage;
- accounting inventory book = diagnostic inventory snapshot;
- inventory investment = inventory-book stock change;
- exact journal inventory movement = raw inventory-book stock change;
- expenditure GDP identity reconciliation;
- payroll accrual = production-labor inventory capitalization;
- `input_to_production` transfer to be aggregate inventory-book neutral.

## Scope caution

The current code explicitly implements an expenditure-side GDP measure. The WP will not invent an income-approach or production-approach identity if the repository does not contain one. Exact accounting reconciliation is an integrity result, not evidence of empirical realism.
