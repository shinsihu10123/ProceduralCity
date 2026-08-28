# WP-RV08-R4-CI — Firm Settlement Kind Census + Operating Support Dependency Decomposition

Date: 2026-08-28
Status: DESIGN APPROVED FOR SHADOW/DIAGNOSTIC EXECUTION ONLY

## Objective

R4-CH proved exact settlement attribution and showed that firm operating inflows are small relative to finance and OTHER inflows. R4-CI determines exactly which transaction kinds create those non-operating cash movements and whether firms are structurally dependent on them to survive.

No canonical mechanism, parameter, price, wage, credit rule, bankruptcy rule, subsidy rule, or settlement ordering may be changed in this WP.

## Required measurements

For every firm-month over 24 months, using ledger postings rather than mutable firm fields:

- opening and closing deposit
- every ledger kind touching the firm account, with inflow/outflow separately
- operating inflow: goods_purchase + interfirm_purchase + capital investment sale receipts
- input/procurement outflow
- settled payroll outflow
- finance inflow/outflow by exact kind
- all previously-OTHER inflows/outflows by exact kind
- tax/fiscal flows by exact kind
- net settlement flow
- operating margin before support
- cash flow after finance only
- cash flow after all non-operating support

## Cohorts

Report separately by:

- country
- industry: RESOURCE / MATERIALS / CAPITAL / CONSUMER
- incumbent vs entrant
- surviving vs exiting firm-month
- operating-revenue-positive vs zero-operating-revenue firm-month

## Support-dependency views

For each firm-month compute deterministic analytical views without mutating canonical state:

- `OPERATING_ONLY`: operating revenue - procurement - payroll
- `PLUS_FINANCE`: OPERATING_ONLY + net finance settlement
- `PLUS_OTHER`: PLUS_FINANCE + net non-operating non-tax settlement
- `ACTUAL_SETTLEMENT`: all ledger postings

Required metrics:

- share negative under each view
- share whose sign flips only after finance
- share whose sign flips only after OTHER support
- mean/median support-to-operating-revenue ratio
- support concentration by exact transaction kind
- support concentration by industry and country
- exit rate conditional on support dependence

## Hard gates

- exact canonical replay
- exact diagnostic replay
- no canonical mutation
- hard accounting health
- exact cash reconciliation
- every retained transaction kind is attributable to a deterministic category
- per-kind sums equal total ledger inflow/outflow
- cohort totals reconcile to global totals
- observations present across original and heldout seeds

## Decision rule

If one or a small number of non-operating transaction kinds dominate firm survival, isolate that mechanism in the next causal WP before testing wages/prices/demand. If operating-only weakness persists broadly even after excluding artificial/temporary support, proceed to a controlled operating-margin factorial shadow experiment.

Canonical economic mutation remains locked throughout R4-CI.
