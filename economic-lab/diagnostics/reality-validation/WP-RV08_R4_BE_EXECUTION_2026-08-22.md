# WP-RV08 R4-BE Execution — Existing Stabilizer Removal Causal Ablation

Date: 2026-08-22
Mode: **diagnostic causal ablation, not production repair**
Parent: R4-BD endogenous stabilizer / destabilizer sign-and-lag audit

## Question

R4-BD found that transfers are directionally countercyclical, while government demand, private credit, labor adjustment, investment and consumption do not collectively reverse the collapse. Observational correlations cannot establish causal contribution.

R4-BE asks:

> How much stabilization is actually produced by the institutions that already exist in the canonical economy?

The test removes existing channels one at a time. It does **not** introduce stronger benefits, larger government spending, easier credit, new policy rules, or calibrated parameters.

## Base

- Economic Lab v0.10
- established initialPrice≈wage unit normalization
- established MATERIALS+CONSUMER productive normalization
- exact diagnostic labor runtime
- original A/C + held-out E/F
- 36 months

## Variants

1. `control`
2. `no-transfers` — suppress automatic unemployment transfers only
3. `no-government-demand` — suppress government consumption/public-investment purchases only
4. `no-new-credit` — suppress new private bank loan origination; existing debt service remains canonical
5. `no-fiscal-stabilizers` — suppress transfers + government final demand
6. `no-stabilizers` — suppress transfers + government final demand + new private credit

## Interpretation

For each channel:

- **removal worsens unemployment/output/firm survival** -> channel is genuinely stabilizing but insufficient;
- **removal has little effect** -> channel is economically weak at current scale/timing;
- **removal improves outcomes** -> channel is likely mistimed, crowding out another activity, or structurally procyclical in the current topology.

The combined removals test interaction effects. It is not interpreted as a realistic policy regime.

## Hard constraints

- no wage or price tuning
- no cash grants except suppressing an existing transfer channel
- no bankruptcy changes
- no labor target changes
- no production-plan changes beyond the already-established normalization scaffold
- no accounting reorder
- no new credit institution
- no canonical merge

## Gates

Every shard must pass:

- complete horizon
- ledger reconciliation
- accounting verification
- GDP arithmetic identity
- normalization activated
- finite compact metrics

## Outputs

Primary outcomes:

- mean / late / terminal unemployment
- terminal GDP and real output
- terminal wage arrears
- terminal active firms
- total firm exits and entries
- total private new credit
- total government transfers
- total government final demand
- total consumption and gross investment

R4-BE authorizes causal ranking only. It does not authorize a stronger fiscal or credit rule.
