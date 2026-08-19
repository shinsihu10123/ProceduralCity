# WP-RV07-P17 — Firm Cash-Cycle Timing & Operating Margin Diagnosis

## Purpose

Identify whether the remaining payroll-liquidity failure is primarily caused by debt-service drain, insufficient operating revenue, or a timing mismatch in which revenue arrives after payroll settlement.

## Mode

Read-only diagnosis on the existing unit-basis candidate. No canonical mechanism change.

## Questions

1. How often does firm debt service convert an otherwise affordable payroll bill into an unaffordable one?
2. How often does canonical credit repair that shortfall?
3. Among firms short before payroll, how often would later same-month revenue or later positive cash inflows have been sufficient to cover the payroll bill?
4. Does realized same-month revenue cover payroll + input cash cost?
5. Which industries and windows dominate negative cash operating margin?

## Design

- scales: compact, baseline
- seeds: ECON-RV02-A/B/C
- horizon: 12 months
- unit-basis diagnostic seed transform retained
- exact observer non-interference replay
- stage snapshots: pre-debt, post-debt, post-credit, pre-payroll, post-household-goods, post-fiscal-demand/tax
- firm-level revenue/payroll/input-cost and cash-cycle classification

## Claim classes

A: directly measured stage/cash-flow facts after hard gates.

B: cross-stage diagnostic leads.

C: causal hypotheses for P18/P19.

D: no repair recommendation from P17 alone.

## Hard gates

Exact observer non-interference, all health checks, complete country coverage, complete stage snapshots, ledger validity, GDP identity, finite rows.

## Boundaries

No parameter fitting. No canonical economic changes. No empirical-realism claim from internal simulation evidence alone.
