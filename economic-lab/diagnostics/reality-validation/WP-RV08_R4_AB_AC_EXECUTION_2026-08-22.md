# WP-RV08 R4-AB / R4-AC — Execution Contract

Date: 2026-08-22
Status: EXECUTING
Dependency: R4-AA interim sector split

## R4-AB — Value Product of Labor Decomposition

Question: when a sector is plan-economically short, is the shortfall caused by contribution value product per worker being below wage, or by low plan utilization / integer-worker indivisibility despite a viable full-capacity worker?

Read-only metrics:
- product price and input-unit cost;
- unit contribution margin;
- one-worker physical capacity;
- gross and net value product per worker divided by wage;
- planned contribution / physical payroll coverage;
- plan utilization of the integer physical workforce;
- sector-level classification: missing input price, nonpositive margin, value-product-below-wage, worker-indivisibility/low-utilization, plan-viable.

No economic rule is changed.

Workflow: `.github/workflows/economic-lab-rv08-r4-ab-value-product-audit.yml`
Scope: canonical + restructure, original A/C + held-out E, CONSUMER + MATERIALS+CONSUMER, 18m.

## R4-AC — Revenue Realization Funnel Audit

Question: among firms that are plan-economically viable, where is expected contribution lost before it becomes payroll-supporting realized cash flow?

Read-only funnel:

`unconstrained plan`
→ `actual output`
→ `sales relative to available inventory`
→ `gross revenue / contribution realization`
→ `actual payroll settlement`

Descriptive 50% gates are used only to localize the loss stage. They are not policy targets, calibrations or repair parameters.

Workflow: `.github/workflows/economic-lab-rv08-r4-ac-realization-funnel.yml`
Scope: canonical + restructure, original A/C + held-out E, CONSUMER + MATERIALS+CONSUMER, 18m.

## Shared hard gates

- deterministic source/state semantics preserved;
- diagnostic exact-runtime path only, already bit-exact gated;
- health PASS;
- ledger PASS;
- general accounting PASS;
- GDP arithmetic identity PASS;
- productive normalization activation PASS;
- required audit rows present;
- finite result rows.

## Decision logic

- If RESOURCE/MATERIALS plan shortfall is dominated by net value product below wage, the next root is price–wage–productivity/unit-economics coherence, not market realization.
- If it is dominated by low utilization / integer worker indivisibility, labor granularity/resolution becomes a structural concern.
- If CAPITAL/CONSUMER plan-viable rows fail mainly before output, investigate labor/input execution.
- If output is produced but sales/realized contribution fails, investigate market absorption, inventory flow, pricing and revenue realization.
- If realized contribution is adequate but payroll settlement fails, investigate settlement sequencing/institutions.

No canonical repair is authorized by AB/AC alone.