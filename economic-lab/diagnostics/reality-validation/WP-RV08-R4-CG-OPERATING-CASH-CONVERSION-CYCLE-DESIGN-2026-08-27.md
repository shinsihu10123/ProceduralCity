# WP-RV08-R4-CG — Operating Cash-Conversion Cycle Decomposition

Date: 2026-08-27
Dependency: R4-CF-E CLOSED / ECONOMIC FAIL AS DESIGNED

## Objective

Determine why firms that can temporarily obtain inputs through deferred settlement fail to generate enough cash to repay those obligations. Decompose the monthly operating cycle without mutating canonical behavior.

The target chain is:

`opening cash -> input procurement -> production -> inventory -> sales -> cash receipts -> payroll -> debt service -> taxes/other drains -> closing cash`.

R4-CG must distinguish **stock**, **flow**, and **timing** failures. It must not infer a solution from end-of-month cash alone.

## Canonical timing facts already established

The current supply-chain implementation resets monthly firm sales/revenue counters at the beginning of the month, plans production from previous sales and inventory targets, purchases inputs before production, and limits canonical input procurement cash to 42% of the buyer's current deposit balance. Production is then hard-limited by available input inventory. B2B purchase settlement is immediate cash transfer, and seller revenue is recognized at that point.

R4-CG must measure the rest of the canonical month in execution order rather than assume textbook timing.

## Required decomposition

For every active firm-month observe at least:

### Opening position
- opening deposit cash;
- opening finished-goods inventory units and book value where observable;
- opening input inventory and book value;
- outstanding canonical loan principal;
- wage arrears and other observable arrears;
- workers, wage, desired production, capacity.

### Operating outflows
- B2B input cash spend;
- capital investment cash spend;
- payroll due and payroll actually paid;
- canonical debt-service due and paid where observable;
- taxes / fees / other identified firm cash drains;
- unexplained cash delta residual.

### Operating inflows
- consumer-facing sales cash receipts;
- B2B sales cash receipts;
- capital-good sales cash receipts;
- any credit origination / deposit creation received by the firm;
- other identified inflows.

### Production and conversion
- desired production;
- actual output;
- input shortage;
- beginning and ending finished inventory;
- units sold;
- revenue;
- inventory accumulation ratio;
- sales/output ratio;
- cash receipts/output value proxy;
- gross operating cash flow before financing;
- post-payroll operating cash flow;
- post-debt-service cash flow.

## Timing classification

Each firm-month must be assigned evidence-based constraint flags, not one exclusive label:
- `INPUT_BLOCKED`;
- `PRODUCTION_WITHOUT_SALES`;
- `INVENTORY_ACCUMULATION`;
- `LOW_REALIZED_MARGIN`;
- `PAYROLL_DRAIN`;
- `DEBT_SERVICE_DRAIN`;
- `OTHER_CASH_DRAIN`;
- `CASH_CONVERSION_OK`;
- `UNRESOLVED_ACCOUNTING_TIMING`.

## Required aggregate outputs

Across country, sector, size bin, seed, and month report:
- share of active firms with revenue < payroll;
- share with operating inflow < operating outflow;
- median sales/output ratio;
- median ending-inventory/output ratio;
- median cash conversion from production to receipts;
- payroll share of realized receipts;
- debt-service share of realized receipts;
- months from production to cash recovery where inferable;
- frequency of each constraint flag;
- transition matrix from one month's constraint flags to the next;
- exit probability conditional on major flags;
- entrant vs incumbent comparison.

## Hard gates

- no canonical mutation;
- exact diagnostic replay;
- exact canonical replay;
- opening cash + identified inflows - identified outflows ~= closing cash, with residual explicitly reported rather than silently repaired;
- no negative physical-flow invention;
- canonical accounting / ledger health remains true;
- no fitted threshold chosen to force a causal conclusion.

## Decision tree

1. If firms produce but cannot sell, proceed toward demand / market-clearing / inventory realization diagnosis.
2. If firms sell but receipts are consumed mainly by payroll, decompose wage-setting and labor allocation against realized value added.
3. If debt service dominates, return to credit lifecycle / refinancing architecture.
4. If receipts are healthy before an unexplained cash drain, isolate the missing flow before any structural mutation.
5. If multiple mechanisms jointly bind, construct a factorial shadow experiment rather than selecting one variable by inspection.

Canonical behavior remains locked throughout R4-CG.