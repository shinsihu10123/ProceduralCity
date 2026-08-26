# R4-CF-C — Procurement Counterfactual Envelope Design

Status: **DESIGN APPROVED FOR SHADOW-ONLY IMPLEMENTATION**

## Purpose

R4-CF-B showed that the canonical intermediate-input bottleneck cannot be attributed only to aggregate supplier scarcity. R4-CF-C quantifies how much input acquisition would be feasible under progressively relaxed settlement constraints without mutating the world.

This is not a policy calibration and not a canonical trade-credit implementation.

## Counterfactual envelopes

For every active buyer with an input requirement, compute four nested ceilings using the same current-world snapshot:

1. `ON_HAND_ONLY`
   - input already held by the buyer.
2. `CANONICAL_42PCT_CASH`
   - current canonical purchase budget (`cash * 0.42`) plus on-hand inventory.
3. `FULL_CURRENT_CASH`
   - all current buyer cash may be used for procurement; no new credit is created.
4. `INVENTORY_ONLY_NO_BUYER_CASH_CONSTRAINT`
   - buyer-cash settlement constraint removed, but acquisition still cannot exceed currently existing supplier inventory.
   - this is an **upper bound**, not an assumed trade-credit contract.

All envelopes must remain bounded by physical input requirement and existing supplier inventory.

## Required outputs

Per buyer:

- required input units
- on-hand units
- unmet units
- aggregate positive supplier inventory
- weighted supplier price
- buyer cash
- units available under each envelope
- incremental recovery from 42% → full cash
- incremental recovery from full cash → inventory-only
- residual shortage after each envelope
- limiting class

Aggregate by country and total.

## Interpretation rules

- A large `42% → full cash` recovery means the arbitrary cash reservation rule materially binds procurement.
- A large `full cash → inventory-only` recovery means settlement/working-capital architecture beyond current deposits could matter.
- A large residual shortage even in `inventory-only` means genuine supplier-production / inventory timing scarcity remains.
- Do not infer a specific trade-credit maturity, interest rate, credit limit, default probability, or invoice eligibility rule from this gate.

## Invariants

The implementation must:

- be read-only;
- not consume canonical RNG;
- not post ledger entries;
- not change inventory;
- not change firm cash;
- not change accounts payable / receivable;
- replay exactly on the same snapshot;
- preserve canonical multi-seed world digest.

## Exit gate

R4-CF-C may close only if all four standard seeds pass 24-month no-mutation / exact-replay / accounting-health gates and the nested envelope inequalities hold for every observed buyer.

Canonical supply-chain behavior remains locked during R4-CF-C.
