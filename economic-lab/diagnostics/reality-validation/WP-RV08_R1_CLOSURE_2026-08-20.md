# WP-RV08-R1 Closure — 2026-08-20

## Verdict

**PASS — CURRENT-PLAN INPUT-FINANCE TIMING DEFECT CONFIRMED, BUT TIMING REPAIR ALONE DOES NOT REGENERATE ENTRANTS OR REPAIR THE MACRO COLLAPSE**

Run: `32366773882`  
Job: `96417875130`  
Artifact: `economic-lab-wp-rv08-r1`, ID `9405601299`  
Artifact SHA-256: `c16d7378837d39aa4fd32e6e96c2fc48b1e71a7f63e0806dfa929c20501584f9`

All hard gates passed: exact control observer non-interference, deterministic replay, health, complete coverage, ledger reconciliation, GDP identity reconciliation, intervention activation and finite entrant lifecycle evidence.

## A — VERIFIED EXISTING FACTS

The canonical control at baseline reproduces the admitted RV08 starting point:

- unemployment `0.251393`
- exits `248`
- wage arrears `64,933.22`
- goods fulfillment `0.55747`
- input shortage `40.61396`
- consumer output `118.58623`
- approved credit `262`
- new credit `124,254.76`

`provisional-current-input` computes current planned intermediate-input needs before canonical credit without changing the credit stage order. It materially changes aggregate credit volume but does not repair the economy:

- unemployment `0.252882`
- exits `250`
- wage arrears `64,784.94`
- fulfillment `0.55326`
- shortage `41.96746`
- consumer output `116.03294`
- approved credit `271`
- new credit `147,640.82`

`postplan-exact-input` defers credit until after labor clearing and exact production planning, then uses the current planned input requirement. It produces a small reduction in unemployment/exits/arrears, but does not create a broad recovery:

- unemployment `0.249964` (`-0.143` percentage points vs control)
- exits `245` (`-3`)
- wage arrears `63,197.97` (`-1,735.25`)
- fulfillment `0.54844` (lower than control)
- shortage `42.00589` (higher than control)
- consumer output `115.16204` (`-2.89%` vs control)
- approved credit `242`
- new credit `148,689.36`

Most importantly, replacement entrants receive **zero credit in every R1 variant**. Baseline entrant outcomes:

| Variant | births | ever credit | ever output | ever revenue | re-exit |
|---|---:|---:|---:|---:|---:|
| control | 159 | `0%` | `38.36%` | `13.84%` | `39.62%` |
| provisional-current-input | 153 | `0%` | `41.18%` | `13.73%` | `40.52%` |
| postplan-exact-input | 151 | `0%` | `37.75%` | `8.61%` | `40.40%` |

Therefore the P75 timing defect is real, but correcting current input-need measurement does **not** penetrate the P76 entrant underwriting blockade.

## B — DIAGNOSTIC LEADS

- Working-capital timing is a genuine architecture defect because canonical credit is evaluated before the exact current production/input plan is known.
- The defect affects aggregate requested/extended credit, but it is not the dominant reason replacement entrants fail to regenerate productive capacity.
- P76 remains controlling for entrant finance: zero-resource entrants are rejected by overlapping capital, affordability and risk constraints before current-plan input finance can matter.
- The small R1 post-plan improvement is insufficient for canonical admission and is partly offset by weaker fulfillment/output.

## C — HYPOTHESES

- H-R1-1: stale `supplyShortage` is the sole reason entrants obtain no credit. **FALSIFIED**.
- H-R1-2: current-plan input financing is a real structural repair requirement. **SUPPORTED**.
- H-R1-3: fixing stage timing alone is sufficient to repair the macro collapse. **FALSIFIED**.
- H-R1-4: entrant underwriting constraints must be isolated jointly with current-plan timing before an accounting-coherent regeneration design can be selected. **STRONGLY SUPPORTED**.

## D — REPAIR ADMISSION

R1 does **not** authorize a canonical stage reorder by itself. It admits current-plan working-capital semantics as one component of the eventual repair architecture, conditional on interaction evidence with entrant financing and later regression/held-out validation.

Next: **WP-RV08-R2 — Entrant Underwriting Constraint × Current-Plan Timing Matrix**.

## Controls

Canonical source changes: **0**.  
Fitted parameter tuning: **0**.  
Repair merge: **0**.  
Empirical realism claim: **NO**.
