# WP-RV08 R4-CU-D3D-B5-S1 Two-Axis Shadow Family Closure v0.1

## Decision

**CLOSED / FAMILY_INSUFFICIENT / PRODUCTIVITY-ONLY FAMILY REJECTED / NO HELDOUT PROMOTION / CANONICAL MUTATION NOT AUTHORIZED**

## Authoritative evidence

- Branch: `scratch/new-project-2026-08-12`
- Authoritative execution head: `f94265a9dec1ce4bac107a78efa636541c70d2a5`
- GitHub Actions run: `33356281009`
- Matrix: 16 preregistered candidates × Original A/C = 32 candidate jobs
- Horizon: 12 months per candidate/seed
- Aggregate job: `99379236705`
- Final beacon: success
- Aggregate artifact ID: `9745255852`
- Aggregate artifact ZIP SHA-256: `fd3376f54eb7647b172870499072f450e8df02219a089e4c4f1e3e1e11901f18`

All 32 candidate jobs passed exact canonical replay, exact diagnostic replay, hard accounting health, protected nominal-surface equality, entrant tagging, productivity-factor provenance and reconstruction identities. The family failed economically, not technically.

## Frozen family tested

- Control: `CTRL`
- Value-recovery productivity scale: `V ∈ {24, 48, 96}`
- Additional consumer productivity yield: `C ∈ {1, 2, 4, 8, 16}`
- Fixed sector shape: RESOURCE 2.0, MATERIALS 1.4, CAPITAL 0.65, CONSUMER 1.0
- Prices, wages, opening cash, wealth, desired budgets, input coefficients, goods-market rules, procurement cash cap, trade credit and bank credit were unchanged.

## Aggregate decision

- Eligible candidates: **0 of 15** shadow candidates
- Finalists: none
- Heldout E/F use: forbidden and not executed
- Decision: `FAMILY_INSUFFICIENT`
- Next front: `R4-CU-D3D-B6 input-output and working-capital shadow family`

Every shadow candidate improved the household realized-consumption distance relative to its paired control on both Original seeds and passed the firm-retention and purchasing-power safeguards. Nevertheless, every candidate failed the labour-value-distance requirement on at least one Original seed.

## Ranking evidence

The best aggregate distance was `V24_C2`, but it was not eligible:

- worst-seed two-axis distance: `5.18071`;
- pooled non-positive-GVA share: `6.25%`;
- minimum median active-firm ratio to control: `1.00`;
- minimum median nominal purchasing-power ratio to control: `0.9897`;
- maximum input-shortage ratio to control: `13.97×`;
- failed rule: labour-distance on Original A.

For `V24_C2`:

| Seed | Labour share median | Realized consumption median | Goods-fulfillment median | Payroll-settlement median | Input-shortage units | Non-positive GVA |
|---|---:|---:|---:|---:|---:|---:|
| Original A | 3.7918 | 0.03104 | 0.02290 | 0.21631 | 17,131.69 | 4.17% |
| Original C | 2.5538 | 0.02416 | 0.01932 | 0.25227 | 19,696.37 | 8.33% |

The productivity family increased output and realized consumption relative to control, but it also drove input shortage sharply higher. Across all candidates, the maximum input-shortage ratio to paired control ranged from about `11.10×` to `15.85×`. Pooled non-positive-GVA shares ranged from about `5.21%` to `11.46%`.

## Causal interpretation

B5 rejects the hypothesis that the collapse can be repaired by increasing labour productivity or consumer yield while leaving the input-output and settlement architecture untouched.

The observed chain is:

`higher nominal productive capacity`

→ `higher required intermediate inputs under unchanged inputPerOutput`

→ `cash-only procurement and supplier-inventory limits bind much harder`

→ `large input shortage and incomplete production realization`

→ `realized consumption improves from an extremely low baseline`

→ `domestic GVA does not improve reliably enough relative to accrued employee compensation`

→ `labour-value distance fails on at least one seed for every candidate`.

This is consistent with the prior R4-CF evidence:

- the 42% cash reservation is a secondary restriction;
- buyer settlement/working-capital architecture is a major procurement restriction;
- one-period trade credit can unlock supplier inventory;
- trade credit alone becomes dynamically unsustainable because current operating cash conversion cannot repay it.

B5 adds a new result: **raising labour-side productive capacity without simultaneously correcting material throughput and working-capital realization amplifies the procurement bottleneck rather than closing the labour-value gap.**

## Rejected follow-ups

This closure prohibits:

- retuning the failed `V × C` grid after observing its results;
- lowering wages or raising prices to make B5 pass;
- increasing desired household budgets;
- treating the best failed candidate as a provisional winner;
- moving any B5 candidate to Heldout E/F;
- relaxing the eligibility gate post hoc;
- canonical mutation.

## Next dependency-safe front

Proceed to **R4-CU-D3D-B6 — Input-Output and Working-Capital Mechanism Family**.

B6 must be a separate preregistered family. It must distinguish:

1. material-efficiency / input-coefficient coherence;
2. buyer settlement and working-capital timing;
3. physically available supplier inventory;
4. dynamic repayment capacity;
5. labour-value and household-flow improvement.

It may reuse the lowest frozen B5 productivity level only as a fixed interaction probe, not retune or select it as a winner. Canonical mutation remains locked.
