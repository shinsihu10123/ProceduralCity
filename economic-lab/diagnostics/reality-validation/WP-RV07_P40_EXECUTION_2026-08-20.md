# WP-RV07-P40 — Stockout-Censored Sales Memory × Capacity Interaction

## Purpose

P36 verified that nearly all RESOURCE, MATERIALS and CONSUMER firm-months are below labor break-even capacity under the unit-basis candidate, while P35 showed physical-capacity normalization is beneficial but insufficient. RV03 independently established that realized sales are observed in a persistently quantity-rationed household goods market.

P40 tests whether a second causal loop remains: **downward revision of `previousSales` when the consumer seller is stockout-censored**.

## Matrix

1. `unit-basis-control`
2. `unit-basis-stockout-memory-floor`
3. `unit-basis-noncapital-capacity`
4. `unit-basis-capacity-plus-stockout-memory-floor`

## Stockout-memory intervention

At the start of each month, store each consumer firm's incoming `previousSales`.

After goods clearing and the canonical sales-memory update, but before exit evaluation, restore the prior memory only when all are true:

- the firm is active and consumer-facing,
- ending finished-goods inventory is effectively zero,
- country household goods market reports positive unmet budget,
- canonical current `previousSales` is below the incoming memory.

Then:

`previousSales = max(canonical current previousSales, incoming previousSales)`

This is a conservative censoring correction: it never invents higher demand than was already remembered and never changes memory when the market is not observably rationed.

## Capacity intervention

Same P35 diagnostic non-capital break-even capacity normalization for RESOURCE, MATERIALS and CONSUMER. No canonical source edit.

## Decision

- If stockout-memory correction materially improves unemployment/exits with little capacity change, promote stockout-censored demand feedback as a causal residual.
- If the combination sharply outperforms each single factor, classify collapse as an interaction between unit-capacity incoherence and censored demand learning.
- If correction has little effect, demote this feedback and move to monthly stage topology / entry-exit propagation.

Canonical mechanism changes: **0**. Fitted tuning: **0**. Diagnostic-only.

## Expanded rerun marker — 2026-08-20 12:22 KST

Re-run P40 against the same current branch state as the P36–P39 batch and P47 cube. No economic mechanism or parameter is changed by this marker.
