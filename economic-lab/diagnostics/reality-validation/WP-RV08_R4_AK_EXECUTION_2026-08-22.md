# WP-RV08 R4-AK — Accounting-Preserving Payroll Working-Capital Bridge Ablation

Date: 2026-08-22  
Status: EXECUTING  
Mode: ACTUAL DIAGNOSTIC EXECUTION / NO CANONICAL REPAIR

## 1. Dependency state

R4-AJ closed PASS and established that payroll-before-revenue timing is a real working-capital defect. It explains a minority of canonical CONSUMER underpayment overall, but becomes the majority underpayment classification in several max-ramp/grace states, especially after MATERIALS+CONSUMER normalization.

R4-AK therefore tests whether a booked short-term bridge actually converts that timing diagnosis into lower current-worker arrears without merely replacing wage arrears with unpayable bank debt.

## 2. Primary question

Does a pre-payroll, accounting-preserving, short-term liquidity bridge improve payroll settlement and macro survival while remaining repayable from endogenous operating cash?

The experiment compares four bridge regimes:

1. `control` — no bridge;
2. `gap-bridge` — diagnostic upper bound: bridge the current base-payroll cash gap in full;
3. `sales-backed` — bridge no more than the current base-payroll cash gap and the value of prior observed sales at the current price;
4. `inventory-backed` — bridge no more than the current base-payroll cash gap and current finished-goods inventory valued at the current price.

The sales-backed and inventory-backed rules use only information available before payroll. No future same-month sales are used to decide origination.

## 3. Accounting and repayment contract

Every bridge draw is booked as an actual bank loan using the existing settlement ledger and general-ledger loan origination entries:

- firm deposit money increases;
- firm `loan_payable` increases;
- bank deposits and bank loan assets increase correspondingly;
- the bridge loan is inserted into `country.loans` and borrower `loanBalance`.

The diagnostic bridge is zero-interest and one-month maturity to isolate timing rather than loan pricing.

After the household goods market and tax collection, but before monthly accounting close, the system attempts a same-month principal sweep limited by:

- remaining bridge principal;
- current firm cash;
- actual same-month consumer revenue.

Any unpaid principal remains a normal active loan and is subsequently exposed to canonical debt service/default mechanics. This prevents the diagnostic from silently forgiving the bridge.

## 4. Isolation

R4-AK does not change:

- wages;
- prices;
- household consumption behavior;
- goods-market matching;
- canonical bank credit decisions for ordinary loans;
- canonical payroll settlement;
- tax rates;
- production functions;
- canonical distress/exit thresholds, except in the separately labeled `ramp-grace` comparison state already defined by R4-AH/AI.

Bridge underwriting/capital limits are intentionally not imposed at this stage. This is a causal sufficiency/repayability audit, not a production banking design. If a bounded bridge is promising, bank-capital and risk feasibility become a later gate.

## 5. Matrix

48 primary simulations:

- state: `canonical`, `ramp-grace`;
- bridge: `control`, `gap-bridge`, `sales-backed`, `inventory-backed`;
- seed: original A, original C, held-out E;
- normalization: CONSUMER, MATERIALS+CONSUMER;
- horizon: 18 months.

Six independent Actions shards each execute eight state × bridge variants for one seed/base pair.

## 6. Metrics

Primary outcomes:

- average and terminal unemployment;
- total wage arrears;
- linked/current-worker wage arrears;
- GDP and output;
- active firms / exits where available;
- bridge principal created;
- same-month principal repaid;
- same-month repayment ratio;
- bridge principal still outstanding at horizon;
- bridge defaults/repaid/active counts;
- share of bridge draws fully repaid in the origination month;
- average bridge amount per draw.

## 7. Hard gates

- health PASS;
- complete matrix coverage;
- normalization active;
- bridge loan accounting recorded through existing accounting APIs;
- settlement ledger integrity;
- general accounting integrity;
- GDP arithmetic identity;
- finite metrics;
- control rows present;
- bridge draws present in non-control regimes.

## 8. Interpretation

A bridge is not a viable architectural lead merely because unemployment falls.

Promising result requires jointly:

- materially lower linked/current-worker arrears or lower arrears growth;
- employment/output preservation;
- high same-month or near-term bridge repayment;
- limited residual bridge debt/default accumulation.

If `gap-bridge` helps but backed variants do not, timing is real but realistic collateral/information may not support the needed financing scale.

If backed variants improve payroll with high repayment, a dedicated working-capital institution becomes a credible repair candidate for later bank-capital/risk validation.

If bridge regimes mostly convert wage arrears into persistent bank debt/defaults, R4-AJ timing is secondary to operating solvency and the bridge hypothesis is rejected as a repair path.

No canonical repair merge is authorized by R4-AK.
