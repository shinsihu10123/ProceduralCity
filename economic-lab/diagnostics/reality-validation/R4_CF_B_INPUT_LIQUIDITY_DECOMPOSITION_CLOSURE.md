# R4-CF-B Input Liquidity Decomposition — Closure

Status: **CLOSED / PASS AS DIAGNOSTIC EVIDENCE**

Authoritative run: `32934044629`
Branch: `scratch/new-project-2026-08-12`
Validated seeds: `ECON-RV02-A`, `ECON-RV02-C`, `ECON-RV08-HOLDOUT-E`, `ECON-RV08-HOLDOUT-F`
Horizon: 24 months each

## Gate result

All four shards passed:

- no diagnostic mutation
- exact audit replay
- exact canonical replay
- accounting / ledger health
- active buyers observed
- shortages observed
- decomposition signal observed

## Main result

R4-CF-B narrows the input bottleneck identified by R4-CE-D4.

Across the four seed runs, the 24-month averages show a repeated pattern:

- substantial unmet input demand before procurement;
- aggregate supplier inventory is often large enough in the economy as a whole to cover much of that demand;
- the canonical buyer budget rule (`cash * 0.42`) removes a large additional quantity from the feasible procurement envelope;
- supplier scarcity remains real, but it is not sufficient to explain the full canonical shortage;
- by the terminal month, many buyers have no usable supplier inventory available, showing that the system eventually enters a genuine inventory-collapse state after the earlier liquidity/procurement friction has propagated.

Representative 24-month averages:

| Seed | Unmet before procurement | Supplier-scarcity component | Additional shortage from 42% cash cap | Observed shortage |
|---|---:|---:|---:|---:|
| Original A | 306.02 | 22.93 | 86.15 | 68.50 |
| Original C | 310.86 | 17.78 | 83.00 | 62.41 |
| Heldout E | 305.41 | 17.96 | 78.94 | 59.66 |
| Heldout F | 318.81 | 17.44 | 80.23 | 58.24 |

The decomposition quantities are ceilings rather than realized transactions, so they are not additive accounting identities against observed shortage. Their purpose is causal separation.

## Interpretation

The evidence rejects the simple statement that the production collapse is caused only by an exogenous lack of supplier output.

The stronger supported mechanism is:

`cash-only procurement rule + no trade credit / invoice channel + supplier inventory timing`

→ reduced intermediate-input acquisition

→ production capped by input inventory

→ weak seller revenue and buyer output

→ subsequent supplier inventory collapse

→ later genuine no-supplier-inventory state.

This is consistent with the canonical implementation in `SupplyChainSystem.procureInputs()`, where each buyer receives a monthly procurement budget equal to only 42% of current cash, purchases settle immediately in cash, and no accounts-payable / accounts-receivable or purchase-order financing layer exists.

## Decision

1. Do **not** tune the `0.42` coefficient directly as a fix.
2. Do **not** inject arbitrary supplier inventory.
3. Do **not** unlock canonical person-level employment yet.
4. Proceed to R4-CF-C as a no-mutation counterfactual procurement envelope.
5. R4-CF-C must separately measure:
   - canonical 42%-cash envelope,
   - full-current-cash envelope,
   - supplier-inventory-only envelope (buyer-cash constraint removed),
   - recoverable input quantity at each relaxation.
6. Only after that gate may an invoice / trade-credit / purchase-order mechanism be designed for canonical experimentation.

## Closure

`R4-CF-B = CLOSED / PASS AS DIAGNOSTIC EVIDENCE`

No canonical economic behavior was changed by this work package.
