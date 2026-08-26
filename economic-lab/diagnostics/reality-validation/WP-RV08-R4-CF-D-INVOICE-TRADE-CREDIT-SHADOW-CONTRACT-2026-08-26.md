# WP-RV08-R4-CF-D — Invoice / Trade-Credit Shadow Contract

Date: 2026-08-26
Dependency: WP-RV08-R4-CF-C CLOSED / PASS

## Objective

Test whether a bounded, economically structured deferred-settlement mechanism can recover a material part of the procurement gap identified by R4-CF-C without mutating canonical simulation state, inventing free goods, or violating accounting conservation.

## Hard constraints

1. **Shadow-only.** No canonical `EconomicWorld`, firm, ledger, accounting, inventory, price, production, or bank state may be mutated.
2. **No free liquidity.** Trade credit is a seller-financed receivable/payable exposure, not a cash grant.
3. **Physical ceiling.** Shadow procurement can never exceed buyer unmet physical input requirement or currently available supplier inventory.
4. **Exposure conservation.** Every shadow buyer payable must have an equal seller receivable.
5. **Bounded terms.** Credit capacity is constrained by observable transaction/economic state, not by a fitted seed-specific coefficient.
6. **No coefficient tuning to pass.** Parameters are contract assumptions for sensitivity envelopes, not calibration knobs.
7. **Exact replay and no-mutation gates are mandatory.**

## Shadow contract families

Evaluate at least three policy-neutral envelopes from the same monthly canonical snapshot:

### D0 — CASH-ONLY BASELINE
Existing full-current-cash procurement ceiling from R4-CF-C.

### D1 — NET-30 SELLER TRADE CREDIT
A buyer may procure physically available input beyond current cash by creating a 30-day accounts payable to the seller and a matched accounts receivable for the seller. Shadow exposure is capped by the lower of:
- remaining physical unmet input value,
- seller inventory value available to the buyer,
- one month of the buyer's observable recent operating-scale proxy.

### D2 — NET-60 STRESSED EXPOSURE ENVELOPE
Same matched AP/AR mechanism, with a two-month operating-scale exposure ceiling. This is an upper sensitivity envelope, not a proposed canonical default.

### D3 — INVENTORY-ONLY UPPER BOUND
Reuse the R4-CF-C no-buyer-cash-constraint physical ceiling. D1 and D2 must never exceed D3.

## Required measurements

For each buyer, country, month, and seed record:
- unmet input units and value before procurement;
- full-cash procurement units;
- supplier inventory physical ceiling;
- D1 and D2 incremental financed units and value;
- matched AP and AR exposure;
- D1/D2 residual physical shortage;
- share of R4-CF-C full-cash→inventory-only recovery captured;
- exposure relative to buyer operating-scale proxy;
- sellers with positive receivables and buyers with positive payables.

## Mandatory invariants / gates

- `noMutation === true`
- `exactShadowReplay === true`
- `exactCanonicalReplay === true`
- `hardAccountingHealthy === true`
- `physicalOrderingOk === true`: D0 ≤ D1 ≤ D2 ≤ D3 ≤ unmet requirement
- `apArConservationOk === true`: aggregate shadow AP == aggregate shadow AR within tolerance
- `noNegativeExposure === true`
- `creditRecoveryObserved === true` on at least one month
- no seed-specific parameter overrides

## Interpretation gate

R4-CF-D may support a future canonical settlement architecture only if recovery is material across both original and heldout seeds and all conservation/replay gates pass. It must not be interpreted as proof that Net-30 or Net-60 is the correct final institutional design. The purpose is to determine whether explicit receivable/payable settlement architecture is causally capable of closing the diagnosed working-capital gap.

If D1/D2 recovery is weak, move causal focus toward supplier production/inventory/timing. If recovery is strong but requires implausibly large exposure, proceed to financing/risk-capacity diagnosis before any canonical mutation.