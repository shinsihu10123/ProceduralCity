# WP-RV08 R4-AP Closure — Population Sufficiency / Labor Feasibility / Scale Sensitivity — 2026-08-23

## Status

**Verdict: PASS / SIMPLE “TOO FEW AGENTS” HYPOTHESIS REJECTED / HOUSEHOLD–FIRM DENSITY AND LABOR-ONTOLOGY DEFECTS CONFIRMED AS MATERIAL**

R4-AP directly tested the concern that the Economic Lab may collapse because the simulated population is simply too small. It also separated finite-size scaling from household/firm density effects.

## Provenance

- repository: `shinsihu10123/ProceduralCity`
- branch: `scratch/new-project-2026-08-12`
- workflow run: `32555211095`
- head SHA: `77194ddcb7475f741c30cdc66658dd017a144d01`
- script: `economic-lab/scripts/rv08-population-scale-labor-feasibility-audit-v10.mjs`
- seedcases: original A, original C, heldout E, heldout F
- bases: consumer; materials-consumer
- profiles: baseline, balanced2, households2, firms2
- horizon: 24 months
- primary artifacts: **32/32**
- downloaded artifact gates: **32/32 `gates.ok = true`**

The 32 primary simulations cover `4 seeds × 2 bases × 4 scale/density profiles`. Observer non-interference, health, ledger, general accounting, GDP arithmetic, normalization activation and finite-row gates passed in every inspected artifact.

## Profiles

- `baseline`: households ×1, firms ×1
- `balanced2`: households ×2, firms ×2 — same household/firm ratio, tests finite-size/discreteness
- `households2`: households ×2, firms ×1 — doubles households per firm
- `firms2`: households ×1, firms ×2 — halves households per firm

Opening baseline household/firm density is approximately **12.41 household objects per firm**. `households2` raises this to ~24.82; `firms2` lowers it to ~6.21. `balanced2` preserves 12.41.

## Four-seed means — CONSUMER base

| Profile | Mean U | Terminal U | GDP / HH | Output / HH | Arrears / HH | Physical need / HH | Viable physical need / HH | Desired jobs / HH | Target fill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 47.21% | 85.85% | 47.47 | 0.429 | 203.67 | 2.149 | 0.665 | 0.562 | 99.98% |
| balanced2 | 50.79% | 88.36% | 44.80 | 0.399 | 210.64 | 1.892 | 0.685 | 0.526 | 99.99% |
| households2 | 64.01% | 94.28% | 29.76 | 0.289 | 148.91 | 1.028 | 0.251 | 0.384 | 99.99% |
| firms2 | 60.95% | 87.24% | 48.31 | 0.315 | 256.48 | 4.202 | 1.867 | 0.422 | 99.78% |

Effects vs baseline:

- `balanced2`: mean unemployment **+3.58 pp**, terminal **+2.51 pp**, GDP/HH **-5.61%**, output/HH **-7.17%**, arrears/HH **+3.43%**.
- `households2`: mean unemployment **+16.80 pp**, terminal **+8.43 pp**, GDP/HH **-37.30%**, output/HH **-32.75%**, arrears/HH **-26.88%**.
- `firms2`: mean unemployment **+13.74 pp**, terminal **+1.39 pp**, output/HH **-26.73%**, arrears/HH **+25.93%**.

Physical labor need exceeds the total household count in **100% of observed baseline and balanced2 months**. Yet canonical desired jobs remain only ~0.53–0.56 per household and actual workers almost exactly fill those targets. This is the key identification result: the system simultaneously contains a large physical-labor requirement and a much smaller endogenous labor-demand target.

## Four-seed means — MATERIALS+CONSUMER base

| Profile | Mean U | Terminal U | GDP / HH | Output / HH | Arrears / HH | Physical need / HH | Viable physical need / HH | Desired jobs / HH | Target fill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 42.02% | 76.30% | 53.42 | 0.577 | 192.51 | 1.956 | 0.839 | 0.612 | 99.97% |
| balanced2 | 45.16% | 78.62% | 51.29 | 0.546 | 192.83 | 1.732 | 0.862 | 0.579 | 99.98% |
| households2 | 57.16% | 84.97% | 38.21 | 0.438 | 128.42 | 0.981 | 0.378 | 0.451 | 99.97% |
| firms2 | 60.45% | 86.68% | 49.28 | 0.369 | 255.17 | 3.952 | 1.914 | 0.427 | 99.77% |

Effects vs baseline:

- `balanced2`: mean unemployment **+3.14 pp**, terminal **+2.32 pp**, GDP/HH **-3.99%**, output/HH **-5.38%**, arrears/HH essentially unchanged (+0.17%).
- `households2`: mean unemployment **+15.13 pp**, terminal **+8.67 pp**, GDP/HH **-28.47%**, output/HH **-24.13%**, arrears/HH **-33.29%**.
- `firms2`: mean unemployment **+18.42 pp**, terminal **+10.38 pp**, GDP/HH **-7.75%**, output/HH **-36.13%**, arrears/HH **+32.55%**.

## Direct hypothesis tests

### H-AP-1 — “There are simply too few simulated people; doubling the whole simulation should materially stabilize it.”

**REJECTED.**

`balanced2` preserves the household/firm ratio and doubles both populations. It does not stabilize the normalized economy. Across both bases it slightly **worsens unemployment and per-household activity**. Therefore finite agent count/discreteness at baseline is not the primary collapse root.

This does not prove the baseline number of agents is empirically realistic. It only rejects simple agent-count insufficiency as the causal explanation for the tested collapse.

### H-AP-2 — “There are too few households/workers per firm.”

**NOT SUPPORTED AS A SIMPLE REPAIR.**

`households2` makes physical labor feasibility much easier, but unemployment rises sharply and GDP/output per household deteriorate. The reason is structural: a household object is not just a worker. Doubling households simultaneously doubles consumption units, balance sheets, deposit accounts and potential labor slots while the firm system is unchanged. It therefore changes demand, wealth and labor supply together.

Arrears per household fall, but this occurs alongside a large contraction in per-household activity and much higher unemployment. It is not a Pareto improvement.

### H-AP-3 — “There are too many firms relative to population.”

**STRONGLY SUPPORTED AS A STRUCTURAL DENSITY PROBLEM.**

`firms2` roughly doubles physical and viable labor need per household and substantially worsens unemployment, output per household and wage arrears. Under the consumer base the viable physical need rises from ~0.665 to ~1.867 workers per household; under M+C from ~0.839 to ~1.914. The share of months in which viable physical need exceeds the household population rises to roughly **93.75%**.

This does not imply that the production system should mechanically halve the number of firms. It shows that **firm count, production scale, labor productivity, household/person ontology and desired-worker formation are not jointly coherent** at the current density.

### H-AP-4 — “Labor matching fails because there are not enough applicants.”

**REJECTED for the tested canonical target.**

Target fill remains ~99.8–100% across profiles. The economy usually fills the jobs it actually asks for. The major gap is between `desiredWorkers` and physical/economically viable labor requirements, not between desired jobs and matching realization.

## Key structural interpretation

R4-AP resolves the original population concern into three distinct issues:

1. **finite simulation size:** not a primary root; balanced doubling does not rescue the economy;
2. **household/firm density:** highly material; firm-heavy configurations become physically infeasible, but household-heavy configurations do not automatically improve macro performance;
3. **ontology:** one household object currently acts simultaneously as a worker slot and a consumption/balance-sheet unit, so changing population count changes several economic margins at once.

The population question is therefore real, but the correct formulation is not “we need more NPCs.” It is:

> **How many persons, workers, households and firms exist; what fraction participates in the labor force; how many persons belong to each household; what labor input does each firm require; and are those quantities mutually feasible under productivity, demand and payroll constraints?**

## Relation to R4-BU

The later R4-BU working-age and household/person audits independently strengthen this conclusion. They show the canonical schema lacks age, household membership, working-age and participation fields, and that a hypothetical 60% labor-force fraction can make even plan-economically-viable labor demand close to or above feasible labor supply for large parts of the run.

R4-AP and R4-BU therefore converge on the same architectural diagnosis from different directions.

## Repair authorization

**No scale-profile change is authorized as a production repair.**

A production fix should eventually introduce separate concepts for:

- persons;
- households;
- working-age status;
- labor-force participation;
- dependents / students / retirement;
- hours or labor units rather than one-household-one-job;
- firm establishment count and size distribution;
- sectoral productivity and labor demand.

Only after those semantics exist should population scale be calibrated empirically.
