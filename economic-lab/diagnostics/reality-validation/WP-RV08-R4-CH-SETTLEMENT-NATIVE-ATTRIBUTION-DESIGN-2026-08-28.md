# WP-RV08-R4-CH — Settlement-Native Revenue / Payroll / Timing Attribution Audit

Date: 2026-08-28
Dependency: R4-CG CLOSED / PASS AS DIAGNOSTIC EVIDENCE

## Objective

Determine whether the extreme R4-CG revenue/payroll and cash-conversion results are economically real, or partly caused by observing mutable end-of-month firm fields instead of the authoritative settlement ledger.

This is a read-only attribution audit. Canonical behavior remains locked.

## Required measures per firm-month

Record from the settlement ledger:
- goods-purchase inflow;
- interfirm-purchase inflow;
- capital-investment inflow;
- any other operating inflow;
- wage/payroll outflow;
- interfirm-purchase outflow;
- capital-investment outflow;
- loan/debt/interest inflow and outflow;
- tax/fee outflow;
- all remaining classified inflow/outflow;
- opening and closing deposit balance.

Record from mutable firm state:
- `revenue`, `consumerRevenue`, `b2bRevenue`, `capitalRevenue`;
- `sales`, `consumerSales`, `b2bSales`, `capitalSales`;
- output, inventory, workers, wage, wage arrears, input spend.

## Derived identities

For each firm-month calculate:
1. ledger operating revenue = goods + B2B + capital-goods settlement inflows;
2. field revenue gap = ledger operating revenue - `firm.revenue`;
3. ledger payroll = absolute wage settlement outflow;
4. field payroll proxy = workers × wage;
5. ledger operating margin before non-operating finance = ledger operating revenue - input-purchase outflow - ledger payroll;
6. total ledger net flow = all inflows - all outflows;
7. cash reconciliation residual = closing cash - opening cash - total ledger net flow.

## Hard gates

- exact canonical replay;
- exact diagnostic replay;
- no mutation by audit;
- canonical accounting/ledger health;
- settlement observations present;
- cash reconciliation residual within tolerance for normal ledger-mediated changes, otherwise residual classes explicitly reported;
- operating revenue components exactly sum to ledger operating revenue;
- payroll attribution exactly matches wage-kind outflow.

## Decision rule

If ledger-native operating revenue remains far below payroll across original and heldout seeds, the low-margin diagnosis is strengthened and the next step is a controlled causal factorial around demand realization / input cost / payroll timing.

If ledger-native revenue is materially higher than `firm.revenue`, or cash changes cannot be reconciled to standard ledger entries, fix observability/accounting attribution before any economic intervention.

No wage, price, credit, or procurement coefficient may be changed in R4-CH.