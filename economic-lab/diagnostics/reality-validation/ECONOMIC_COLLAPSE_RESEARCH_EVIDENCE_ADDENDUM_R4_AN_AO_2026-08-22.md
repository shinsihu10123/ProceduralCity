# Economic Collapse Research Evidence Addendum — R4-AN / R4-AO

Date: 2026-08-22

## R4-AN interim evidence

Run `32553592408`, source SHA `8ef505a2209921096d42e0b7c7c89856dbb0681d`.

At the bounded checkpoint, 7/8 seed/base shards were complete and successful. CONSUMER coverage is already complete across original A/C and held-out E/F; MATERIALS+CONSUMER has original A/C and held-out F complete, with held-out E still executing.

Complete four-seed CONSUMER evidence shows no staffing-envelope Pareto winner:

- `mean3-immediate` improves average unemployment by about 1.69 pp, GDP by about 2.16%, and output by about 2.81%, but total arrears are essentially flat/slightly higher (+0.52%) and terminal unemployment is slightly worse.
- `mean3-ramp`, `floor3-ramp`, and `hysteresis-ramp` reduce total and linked/current-worker arrears but simultaneously increase unemployment and reduce GDP/output. These reductions are consistent with contraction-mediated relief rather than a solved production-payroll coherence mechanism.

Interim 3/4 MATERIALS+CONSUMER evidence has the same qualitative trade-off.

Permanent interim evidence:

- `WP-RV08_R4_AN_INTERIM_SYNTHESIS_2026-08-22.md`
- `evidence/WP-RV08_R4_AN_INTERIM_COMPACT_2026-08-22.csv`

No final R4-AN closure is declared until the remaining shard finishes or is explicitly classified as runtime-limited.

## New source-level semantic risk discovered during R4-AN synthesis

Canonical `settlePayroll()` uses a household-level scalar `wageArrears`:

`due = current employer wage + min(prior household wageArrears, 0.5 × current employer wage)`.

The payment is made by the household's **current** employer. The household arrears stock is then updated as:

`max(0, prior arrears + current wage - paid)`.

Separately, general accounting accrues the current month's household wage receivable and the current employer's wages payable with employer-specific journal metadata.

Therefore, when a worker changes employers while carrying old arrears, the runtime scalar does not preserve the employer-of-origin of the claim. A new employer may be asked to fund catch-up service on wage arrears that arose under an old employer.

This is a diagnostic lead, not yet a verified aggregate cause. It is materially different from the already-investigated detached-former-worker claim issue: the liability may re-enter active payroll after re-employment and burden a new firm.

## R4-AO launched

R4-AO is designed to separate three layers that R4-AN's stock metric conflates:

1. current-period wage flow;
2. legacy wage-arrears stock amortization;
3. employer-of-origin provenance of legacy claims.

The observer reconstructs a conservative claim ledger. Same-employer claims are assumed repaid first; only legacy payments exceeding that same-employer claim are classified as cross-employer. Consequently measured cross-employer legacy service is a lower bound.

Hard reconciliation requires:

`Δ aggregate household wageArrears = new current-wage shortfall − legacy arrears repaid`

and reconstructed provenance claims must equal the household arrears stock.

R4-AO does not change wages, staffing, credit, cash, taxes, settlement rules, claim write-offs, or exit behavior.

Execution contract:
- `WP-RV08_R4_AO_EXECUTION_2026-08-22.md`
- `scripts/rv08-payroll-flow-stock-decomposition-v10.mjs`
- workflow `.github/workflows/economic-lab-rv08-r4-ao-payroll-flow-stock.yml`

## Updated causal frontier

The current strongest integrated chain remains:

`sector-specific value-product defects`
→ `production / staffing target incoherence`
→ `production under-execution`
→ `weak realized operating contribution`
→ `current payroll under-coverage`
→ `legacy arrears accumulation`
→ `fast distress / exit amplification`.

R4-AO adds a newly testable side-channel:

`worker changes employer while carrying arrears`
→ `household-level arrears scalar loses employer-of-origin semantics`
→ `current employer may service old employer's wage debt`
→ `new-employer cash drain / payroll stress`.

This side-channel is not promoted to VERIFIED until R4-AO quantifies it across original and held-out seeds.