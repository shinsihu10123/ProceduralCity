# WP-RV08 R4-L/M/N — Accounting Recognition / Tax Cash-Flow / Estate Interaction

Date: 2026-08-21
Status: **EXECUTION ADMITTED — DIAGNOSTIC ONLY**
Parent closure: `WP-RV08_R4_IJK_CLOSURE_2026-08-21.md`
Frozen implementation baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`
Canonical mechanism changes: **0**
Parameter tuning: **0**
Held-out validation: **NO**
Empirical realism claim: **NO**

## Source-admission finding

The canonical source creates a source-supported causal path that was not closed by R4-K alone:

1. `AccountingSystem.accrueMonthlyWages()` posts production labor as `Dr inventory / Cr wages_payable` for every active firm with accrued wages, irrespective of whether current physical output is zero.
2. `GovernmentSystem.collectCorporateTaxes()` later in the same month obtains `GeneralLedger.incomeStatement(f.id).netIncome` and taxes positive net income.
3. Corporate-tax payment transfers settlement cash out of the firm before `SupplyChainSystem.evaluateExits()` is executed.

Therefore zero-output labor capitalization is not guaranteed to be a reporting-only defect. It can affect taxable profit and settlement cash, and may propagate into payroll/liquidity distress and exit.

## Diagnostic intervention contract

No tax rate, underwriting threshold, price, wage, productivity coefficient or exit threshold is changed.

The accounting intervention first lets canonical wage accrual occur. It then reclassifies the current-month labor amount with a balanced journal:

`Dr cogs / Cr finished-goods inventory`

under explicitly bounded diagnostic conditions. Household wage income/receivable accrual, wage settlement and money balances are untouched by the reclassification itself.

This is not a final accounting design. It is a causal isolation of the verified defect.

## Track L — recognition timing decomposition

Variants for each admitted productivity-normalized base:

- control;
- zero-output labor reclassified **after corporate tax collection**;
- zero-output labor reclassified **before corporate tax collection**.

Question: does accounting recognition materially change the real path, and how much additional effect appears when the corrected recognition is visible to the same-month tax base?

## Track M — recognition scope upper bound

Variants:

- control;
- zero-output-only labor expense before tax;
- all current production labor expensed before tax.

`all-labor-expensed` is an explicit upper bound only. It is not a production proposal.

Question: is the causal effect concentrated in the objectively defective zero-output contexts, or does a much larger accounting/tax upper bound produce a qualitatively different path?

## Track N — accounting × estate interaction

2×2 variants:

- control;
- capital+inventory physical estate recycling;
- zero-output labor reclassification before tax;
- both together.

Question: are the accounting/tax feedback and destructive estate-stranding channel complementary, redundant, or interacting nonlinearly over 24 months?

## Common execution envelope

- horizons: 24 months;
- scale profiles: compact + baseline;
- diagnostic seeds: `ECON-RV02-A`, `ECON-RV02-B`, `ECON-RV02-C`;
- admitted productive-capacity normalization bases: CONSUMER and MATERIALS+CONSUMER;
- deterministic replay checks;
- health checks;
- settlement-ledger verification;
- general-accounting equation/reconciliation checks;
- GDP arithmetic identity checks;
- physical estate-transfer conservation for Track N;
- observer/instrumentation non-interference on control.

## Admission verdict

**PASS — R4-L/M/N IS DEPENDENCY-SAFE AND DIRECTLY TESTS A SOURCE-VERIFIED REMAINING CAUSAL PATH WITHOUT AUTHORIZING A CANONICAL REPAIR.**
