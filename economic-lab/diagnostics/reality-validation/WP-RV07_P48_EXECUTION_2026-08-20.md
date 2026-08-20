# WP-RV07-P48 — Post-Exit Entrant Lifecycle Audit

## Why now

P43 shows that suppressing the exit boundary cuts pooled baseline unemployment roughly in half, especially after month 6. Canonical exit handling creates at most two replacement firms from the exited industry list, but `createEntrant` initializes a replacement with zero workers, zero cash, zero inventory and zero capital stock, then registers it with the normal banking/fiscal/cognitive systems.

P48 is a read-only lifecycle audit of those replacement entrants.

## Variants

1. existing unit-basis control,
2. existing non-capital break-even-capacity diagnostic variant.

No entry resources are changed.

## Birth record

For every canonical entrant record exactly at `createEntrant` return:
- entry month / country / industry / firm id,
- workers / desired workers,
- ledger cash,
- capital stock / book value,
- inventory,
- wage / price / safe cash,
- loan balance / bank registration.

## Follow-up

At the end of every month track entrant age and:
- active status,
- workers / desired workers,
- cash,
- capital stock,
- output / sales / revenue,
- wage arrears,
- loan balance / credit misses.

Aggregate by age and sector:
- share ever hiring,
- share ever producing,
- share ever generating revenue,
- survival / re-exit rate,
- mean cash and employment path.

## Question

Does canonical exit replacement regenerate productive/employment capacity, or does the zero-resource entrant state create persistent hysteresis after exits?

Canonical mechanism edits: **0**. Fitted tuning: **0**. Empirical realism claim: **NO**.
