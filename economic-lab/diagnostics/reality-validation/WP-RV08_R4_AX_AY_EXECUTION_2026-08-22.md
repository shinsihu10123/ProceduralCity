# WP-RV08 R4-AX / R4-AY Execution — Bootstrap and Institutional Maturity

Date: 2026-08-22
Mode: diagnostic-only systemic widening

## R4-AX — Bootstrap / Opening Stock-Flow / Startup Grace Sensitivity

R4-AU–AW showed a synthetic mature-looking month-0 state, immediate arrears/credit stress, but a delayed exit/unemployment cascade rather than instant collapse. R4-AX tests two bounded opening-state hypotheses without treating either as a repair.

### Variants

1. `control` — current unit-normalized diagnostic base.
2. `input-buffer` — input-using firms receive one inherited input buffer equal to one unconstrained opening production round. The stock is booked as opening input inventory financed by opening equity; no free cash or unbalanced accounting is introduced.
3. `grace6` — the first six months are an institutional startup grace in which firm exits are suppressed and distress clocks reset. All production, wages, goods, credit, taxes, transfers, investment, international and learning processes still run.
4. `input-buffer-grace6` — both interventions.

### Matrix

- original A/C + held-out E/F
- bases: `unit`, `materials-consumer`
- four variants
- 24 months
- 32 primary simulations in 8 independent shards

### Interpretation

- If input buffers materially improve long-run outcomes, zero inherited intermediate inventory is a material cold-start amplifier.
- If six months of operation before bankruptcy enforcement produces durable improvement after the grace ends, lack of settling/prehistory time is material.
- If grace merely stores larger arrears and collapse resumes, “the system only needs time to settle” is falsified.
- If the combination helps only temporarily, cold start is an amplifier but the persistent endogenous feedback remains the root frontier.

Workflow: `.github/workflows/economic-lab-rv08-r4-ax-bootstrap-prehistory.yml`
Script: `economic-lab/scripts/rv08-bootstrap-prehistory-sensitivity-v10.mjs`

## R4-AY — Institutional Maturity / Network Topology / Historical-State Census

R4-AY is observational. It asks which mature-economy relationships exist at month 0 and which are created only after the clock starts.

It records at months 0/1/3/6/12:

- bank/government/central-bank counts and assigned-bank concentration;
- active private loan contracts and unique borrowers;
- government bonds, central-bank facilities and central-bank operation history;
- household equity ownership and public-share ratio;
- asset-market and international-history lengths;
- foreign funding contracts and trade records;
- cognitive memory episode depth;
- cumulative unique B2B buyer-supplier pairs and repeat-transaction share;
- employment entries, exits and job-to-job transitions;
- capital-stock increases and decreases;
- unemployment, GDP, output and wage arrears.

The key distinction is between **topology** and **materiality**. One bank, zero inherited supplier relationships or zero portfolio ownership can be a simplification without being a root cause. R4-AY first establishes the actual topology and history formation; subsequent causal probes are selected only for structures that plausibly connect to the collapse graph.

Matrix:
- original A/C + held-out E/F
- `raw` and `materials-consumer`
- 12 months
- 8 independent shards.

Workflow: `.github/workflows/economic-lab-rv08-r4-ay-institutional-maturity.yml`
Script: `economic-lab/scripts/rv08-institutional-maturity-network-census-v10.mjs`

## Shared rule

Neither R4-AX nor R4-AY authorizes a canonical prehistory generator, multi-bank architecture, supplier contracts, demographic subsystem or other production change. They narrow the architecture only after replicated evidence.
