# WP-RV08-R4-CF-E — Trade-Credit Aging, Repayment & Seller Risk-Capacity Shadow Ledger

Date: 2026-08-26
Dependency: R4-CF-D CLOSED / PASS AS SHADOW CAUSAL EVIDENCE

## Objective

Determine whether the procurement recovery demonstrated by R4-CF-D remains economically viable once invoices persist across months, become due, may be partially paid, age into arrears, and impose balance-sheet exposure on suppliers.

This is a **shadow intertemporal risk-capacity experiment**, not a canonical mutation.

## Required architecture

Maintain a deterministic shadow invoice ledger alongside an unchanged canonical `EconomicWorld`.

Each shadow invoice records at minimum:
- invoice id;
- buyer id;
- seller id;
- country id;
- issue month;
- due month;
- original face value;
- remaining face value;
- status (`CURRENT`, `DUE`, `ARREARS`, `SETTLED`, `WRITTEN_DOWN` if explicitly tested);
- age in months;
- originating input units and price;
- contract family.

## Contract family for the first gate

Use the R4-CF-D **Net-30 D1** family only. Net-60 remains a sensitivity envelope and is not needed until Net-30 aging behavior is understood.

New invoice origination in a month must remain bounded by:
1. R4-CF-D physical supplier-inventory ceiling;
2. buyer unmet input value after current-cash procurement;
3. observable one-month buyer operating-scale proxy;
4. seller-specific remaining risk capacity after existing shadow receivables.

## Seller risk-capacity envelope

Do not use a fitted target coefficient. Measure at least three transparent capacity views from canonical state:
- **inventory-value capacity**: current seller inventory value;
- **sales-scale capacity**: one month of observable seller planned-sales value;
- **liquidity capacity**: seller canonical cash/deposit balance.

For the first experiment, report results under each capacity view separately rather than choosing one as the final policy rule. A combined conservative envelope may use the minimum of the observable views, but its sensitivity must remain visible.

## Shadow repayment waterfall

At each new canonical month, before originating new shadow invoices:
1. identify invoices due or in arrears;
2. observe the buyer's current canonical cash as a repayment-capacity signal;
3. allocate a bounded shadow repayment budget without mutating canonical cash;
4. apply repayment oldest-due-first;
5. move unpaid due balances into arrears;
6. preserve buyer payable == seller receivable conservation after every transition.

The repayment budget is an analytical capacity estimate only. It must not be represented as a real canonical transfer.

## Required output

Across 24 months and all four seeds report:
- new invoice value/month;
- outstanding AP/AR stock;
- due amount/month;
- paid-capacity amount/month;
- arrears stock and arrears ratio;
- median/max invoice age;
- seller concentration of receivables;
- buyers with persistent arrears;
- sellers whose receivables exceed each observable risk-capacity view;
- procurement recovery retained after risk-capacity limits;
- ratio of retained recovery to R4-CF-D unconstrained recovery.

## Hard gates

- no canonical mutation;
- exact shadow replay;
- exact canonical replay;
- AP == AR at country and global level within tolerance;
- no negative invoice balance;
- invoice stock-flow conservation;
- physical procurement ceiling never exceeded;
- seller risk-capacity ceiling never exceeded for the tested envelope;
- aging monotonicity and deterministic oldest-due-first repayment;
- hard canonical accounting / ledger health remains true.

## Decision rule

Only if a bounded seller-risk-capacity envelope retains material procurement recovery across original and heldout seeds **without explosive receivable accumulation or persistent high arrears** may the project proceed to canonical invoice/AP/AR architecture design.

If receivables accumulate unsustainably, the next causal step is not to increase the limit. It is to test invoice financing / bank discounting, supplier liquidity, or deeper production/timing constraints.

Canonical supply-chain mutation remains locked throughout R4-CF-E.