# WP-RV07-P67 — Productivity-State vs Physical-Capacity-Only Semantics Matrix

## Objective

Separate the physical-capacity effect of the P61-P63 diagnostic productivity intervention from non-physical side effects of changing the canonical `firm.productivity` state.

This separation is required because household seller selection computes perceived quality from `0.72 + productivity * 0.28`; therefore changing `firm.productivity` affects both production capacity and household choice.

## Variants

- unit-basis control
- CONSUMER productivity-state normalization
- CONSUMER capacity-only normalization
- non-capital productivity-state normalization
- non-capital capacity-only normalization

The capacity-only intervention uses exactly the same algebraically-derived firm-specific factor as the productivity-state variant, but applies it only to canonical physical production capacity after planning. It does **not** change `firm.productivity`.

## Hard gates

- deterministic replay exact
- all runs healthy
- complete coverage
- intervention activated
- capacity-only variant leaves productivity state unchanged exactly
- state and capacity-only variants have identical month-1 physical sector production before later household-choice feedback can propagate
- ledger verification
- GDP identity reconciliation
- finite rows

## Interpretation

If productivity-state materially outperforms capacity-only despite equal month-1 physical production, part of the previously observed recovery is a semantic side effect through perceived quality or another productivity-state consumer. If they remain close, the physical-capacity channel is the dominant explanation.

## Authority

Diagnostic only. Canonical mechanism changes: 0. Parameter fitting: 0. Repair merge: NO. Empirical realism claim: NO.