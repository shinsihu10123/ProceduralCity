# WP-RV07-P63 — Productivity × Labor-Decision Interaction Audit

## Purpose

P62 showed a non-monotonic result: CONSUMER-only static productivity normalization gives the lowest unemployment, while adding upstream productivity can increase physical throughput, fulfillment and cash yet worsen unemployment relative to CONSUMER-only.

P63 identifies the labor-decision mechanism behind that interaction.

## Variants

1. unit-basis control
2. CONSUMER normalization
3. RESOURCE + CONSUMER
4. MATERIALS + CONSUMER
5. RESOURCE + MATERIALS + CONSUMER

The static productivity normalization is exactly the algebraic diagnostic used in P61/P62. No coefficient is fitted.

## Firm-stage observations

At the post-decision / pre-credit stage:

- current strategy
- hiringChange
- workers before labor market
- desiredWorkers
- cashStress
- inventoryPressure
- supplyStress
- expectedDemandGrowth
- cash before new credit

At post-labor / production-plan stage:

- workers after labor market
- capacity
- desiredProduction
- planned layoffs
- executed layoffs
- vacancy demand

At month end:

- realized unit sales and revenue
- supply shortage
- firm cash
- active/inactive state
- distress months

Country outcomes retain unemployment, exits, wage arrears, fulfillment, input shortage, sector output, nominal sales and firm cash.

## Decision rule

If upstream additions worsen unemployment relative to CONSUMER-only while increasing:

- negative hiring,
- planned/executed layoffs,
- cash-preservation or defense strategy share,
- sector-specific cash stress,

then the P62 non-monotonicity is a labor-decision/operating-stress interaction rather than a simple physical-capacity effect.

If labor contraction does not increase, inspect vacancy allocation/reemployment and exit replacement next.

## Hard gates

- deterministic replay
- health
- country coverage
- intervention activation in all targeted variants
- decision/labor snapshot matching
- ledger integrity
- GDP identity
- finite observations

Canonical economic mechanism changes: **0**. Parameter tuning: **0**. Repair merge: **0**. Empirical realism claim: **NO**.
