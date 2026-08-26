# R4-CF-A Supplier/Input-Flow Contract Extraction

Status: **CLOSED / CONTRACT EXTRACTED / CANONICAL MUTATION LOCKED**

Date: 2026-08-26
Depends on: R4-CE-D4 closure

## 1. Canonical procurement path

The current `SupplyChainSystem.procureInputs()` performs inter-firm procurement in this order:

1. For every active buyer with `inputProduct`, compute required input as `desiredProduction * inputPerOutput`.
2. Subtract the buyer's existing input inventory.
3. Set procurement cash budget to exactly `42%` of the buyer's current deposit balance.
4. Search active suppliers that sell the required product and currently have positive finished-goods inventory.
5. Choose suppliers through a stochastic sampled price/reliability score.
6. Limit each purchase by remaining need, supplier inventory and remaining cash budget.
7. Settle the transaction immediately by ledger transfer from buyer deposit to seller deposit.
8. Increase buyer input inventory and book value immediately.
9. Reduce seller inventory and recognize seller B2B revenue/sales immediately.
10. Record the purchase in accounting.
11. Repeat for at most five supplier-search rounds.
12. Any unresolved quantity becomes `buyer.supplyShortage`.

## 2. Structural findings

### 2.1 Procurement has a hard cash-budget fraction

The buyer cannot spend more than `0.42 * current deposit cash` on monthly input procurement regardless of:

- production order value;
- expected sales cash flow;
- committed customer demand;
- supplier credit terms;
- bank working-capital availability;
- invoice-backed finance;
- trade credit.

This is a behavioral hard cap, not an accounting identity.

### 2.2 All inter-firm input trades are cash-on-delivery

The canonical path performs an immediate ledger transfer. There is no accounts payable/accounts receivable settlement delay for ordinary inter-firm input purchases.

Therefore the model currently lacks a normal trade-credit channel in which a supplier ships inputs now and receives cash later.

### 2.3 Supplier availability requires positive finished-goods inventory at procurement time

A supplier with no currently available inventory cannot satisfy the buyer even if it has production capacity to replenish later in the period.

This makes procurement dependent on intra-month sequencing and stock timing.

### 2.4 Supplier search is capped

Each buyer gets at most five procurement rounds. Supplier choice samples subsets of the available pool rather than clearing a centralized market.

This can produce search-friction shortages in addition to true aggregate scarcity.

### 2.5 Production happens after procurement and is hard-bounded by acquired input stock

After procurement, output is reduced to `inputInventory / inputPerOutput` when input inventory is insufficient.

This directly explains why R4-CE-D4 identifies `INPUT_AVAILABILITY` as the dominant labor-demand ceiling.

## 3. Accounting contract

Current ordinary B2B procurement is a settled cash transaction, not an invoice contract. Consequently there is no canonical B2B payable/receivable stock to finance or age.

A future production-grade operating-cycle model must not fabricate trade receivables from the current data. It must add an explicit purchase-order/invoice lifecycle with matching accounting entries.

## 4. Causal hypotheses to test next

R4-CF-B must decompose observed shortage into at least:

1. true supplier inventory scarcity;
2. buyer 42% cash-budget cap;
3. supplier-search/round limit;
4. intra-month timing/sequence scarcity;
5. lack of trade credit or invoice-backed bank finance.

No canonical change is approved until this decomposition is measured across original and held-out seeds.

## 5. Decision

`R4-CF-A = CLOSED`.

The immediate next step is a read-only **Input Liquidity Decomposition Audit**. It must compare current canonical procurement capacity against counterfactual ceilings without transferring money, creating inventory, issuing credit or changing supplier selection.

Checkpoint:

`R4-CF-A-CLOSED / 42PCT-PROCUREMENT-BUDGET-IDENTIFIED / CASH-ON-DELIVERY-B2B / NO-TRADE-CREDIT / R4-CF-B-AUDIT-NEXT`
