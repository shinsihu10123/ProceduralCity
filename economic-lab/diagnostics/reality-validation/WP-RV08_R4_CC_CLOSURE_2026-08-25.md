# WP-RV08 R4-CC Closure — Firm Size / Establishment Density / Payroll Viability Census — 2026-08-25

## Status

**Verdict: PASS / STRUCTURAL FIRM-SIZE AND PAYROLL-VIABILITY STRESS REPLICATED ACROSS ORIGINAL + HELDOUT SEEDS / NO SCALAR FIRM-COUNT REPAIR AUTHORIZED**

R4-CC is formally closed as a diagnostic census. The experiment does **not** identify a single causal repair, but it establishes that the current production structure contains persistent and seed-robust firm-level viability stress that is consistent with the earlier R4-AP household/firm-density diagnosis and the BR/BV payroll-liquidity evidence.

## Provenance

- repository: `shinsihu10123/ProceduralCity`
- branch: `scratch/new-project-2026-08-12`
- execution head SHA: `8ed2caecfd60a7b773002dc437d4527b3d5779ce`
- workflow run: `32593745888`
- script: `economic-lab/scripts/rv08-firm-size-density-viability-census-v10.mjs`
- workflow: `.github/workflows/economic-lab-rv08-r4-cc-firm-size-density.yml`
- horizon: 36 months
- seedcases:
  - original A — `ECON-RV02-A`
  - original C — `ECON-RV02-C`
  - heldout E — `ECON-RV08-HOLDOUT-E`
  - heldout F — `ECON-RV08-HOLDOUT-F`
- artifacts: **4/4 present and inspected**
- artifact gates: **4/4 `gates.ok = true`**

All four artifacts passed health, ledger, general accounting, GDP arithmetic, normalization activation, sector coverage, finite-data and observed-exit gates.

## Four-seed compact results

| Metric | Original A | Original C | Heldout E | Heldout F | Four-seed mean |
|---|---:|---:|---:|---:|---:|
| Initial households | 2,110 | 2,110 | 2,110 | 2,110 | 2,110 |
| Initial firms | 170 | 170 | 170 | 170 | 170 |
| Households / initial firm | 12.41 | 12.41 | 12.41 | 12.41 | 12.41 |
| Mean active firms | 126.78 | 119.28 | 121.14 | 121.28 | **122.12** |
| Terminal active firms, final 6m mean | 83.50 | 78.83 | 78.17 | 73.83 | **78.58** |
| Mean workers / active firm-month | 7.35 | 6.98 | 7.39 | 7.34 | **7.27** |
| Zero-worker firm share | 5.91% | 6.44% | 6.28% | 6.45% | **6.27%** |
| Revenue below payroll share | 69.16% | 73.86% | 71.14% | 72.34% | **71.62%** |
| Arrears-positive firm share | 38.54% | 39.30% | 39.65% | 40.01% | **39.38%** |
| Employment top-10 share | 38.29% | 36.23% | 35.25% | 32.81% | **35.64%** |
| Revenue top-10 share | 58.05% | 68.32% | 62.14% | 62.78% | **62.82%** |
| Output top-10 share | 52.17% | 57.28% | 54.61% | 55.53% | **54.90%** |
| Total exits | 329 | 336 | 329 | 339 | **333.25** |
| Entrant exits | 206 | 209 | 203 | 208 | **206.50** |

The seed spread is small relative to the magnitude of the core viability signals. In every seed, roughly seven in ten active firm-month observations have current revenue below current payroll, roughly four in ten show wage arrears, and active-firm counts contract substantially over the 36-month window.

## Size-bin census — pooled across four seeds

| Worker-size bin | Firm-months | Mean workers | Revenue < payroll | Arrears-positive | Zero output | Exits / 100 firm-months |
|---|---:|---:|---:|---:|---:|---:|
| 0 | 953 | 0.00 | 0.0% | 0.0% | 100.0% | 0.00 |
| 1–2 | 7,727 | 1.01 | **75.0%** | 34.9% | **56.5%** | **10.69** |
| 3–5 | 822 | 4.96 | 66.5% | 15.2% | 17.2% | 2.92 |
| 6–10 | 3,448 | 7.57 | 67.0% | 27.8% | 21.5% | 4.90 |
| 11–20 | 2,879 | 15.53 | **75.1%** | **58.7%** | 20.4% | **8.34** |
| 21+ | 1,756 | 25.69 | 67.9% | **78.6%** | 18.5% | 4.21 |

### Interpretation by size

The census does **not** show a simple monotonic rule such as “small firms are the only problem” or “large firms are the only problem.” Instead, different failure modes appear at different sizes:

- the `1–2` worker bin has the highest exit intensity and very high zero-output incidence;
- the `11–20` bin combines high revenue-below-payroll frequency with high arrears and elevated exit intensity;
- the `21+` bin has the highest arrears-positive share, even though its exit intensity is lower than the smallest firms;
- the `3–5` bin is comparatively less distressed, but it is a small share of observed firm-months.

This is evidence of a **misaligned size distribution / production scale / payroll burden**, not evidence for one universal firm-size threshold.

## Sector census — pooled across four seeds

| Sector | Firm-months | Mean workers | Revenue < payroll | Arrears-positive | Zero output | Exits / 100 firm-months |
|---|---:|---:|---:|---:|---:|---:|
| RESOURCE | 3,205 | 7.61 | **85.5%** | **55.8%** | 10.7% | **13.95** |
| MATERIALS | 3,642 | 8.69 | **76.9%** | **54.2%** | **50.2%** | **11.61** |
| CAPITAL | 2,230 | 9.95 | 68.7% | 47.5% | 35.5% | 7.98 |
| CONSUMER | 8,508 | 5.83 | 58.0% | 23.8% | 48.8% | 3.35 |

### Interpretation by sector

The viability problem is strongly heterogeneous.

- `RESOURCE` is the most severe exit-intensity sector and has the highest revenue-below-payroll share.
- `MATERIALS` also has severe payroll coverage failure and a very high zero-output share.
- `CAPITAL` remains stressed but is intermediate.
- `CONSUMER` has the lowest exit rate and arrears share of the four sectors, although its zero-output incidence remains high.

Therefore the current system should not be repaired by applying one global firm-count or payroll rule. Sectoral production technology, establishment scale, input topology, working-capital needs and labor productivity must be jointly calibrated.

## Direct hypothesis tests

### H-CC-1 — “The firm population is healthy enough; collapse is mainly outside the firm-production layer.”

**REJECTED.**

Across all four seeds, active firms contract sharply while revenue fails to cover payroll in approximately 70% of active firm-month observations. The firm-production layer is materially involved in the collapse mechanism.

### H-CC-2 — “Only very small firms are pathological.”

**REJECTED.**

The `1–2` worker bin is highly fragile, but larger bins also show severe payroll and arrears stress. The `11–20` and `21+` bins in particular demonstrate that the problem is not confined to micro-firms.

### H-CC-3 — “One common firm-size rule can repair every sector.”

**REJECTED.**

Sector results differ strongly. RESOURCE and MATERIALS show far greater exit intensity and payroll-coverage failure than CONSUMER. A global scalar resizing rule would conflate structurally distinct sectors.

### H-CC-4 — “Establishment density / production scale is materially implicated.”

**SUPPORTED AS A STRUCTURAL DIAGNOSIS, NOT YET AS A CAUSAL REPAIR.**

R4-AP already showed that firm-heavy population profiles become physically and economically less feasible, while simple whole-system scaling does not rescue the economy. R4-CC independently shows that the baseline firm ecology produces widespread payroll non-viability, exits and concentration across multiple seeds. The two fronts are mutually consistent.

However, R4-CC is observational within the diagnostic runtime. It does not tell us whether the correct repair is fewer firms, larger firms, higher productivity, different sector technologies, different labor units, better working capital, better initialization, or a combination.

## Integrated interpretation with prior fronts

R4-CC strengthens, but does not replace, the prior causal frontier:

1. **BR:** immediate exits are dominated by operating-cash / payroll-coverage failure;
2. **BS:** credit is constrained by both bank capitalization and weak borrower economics;
3. **AP/BU:** household, person, worker and labor-force ontology is under-specified, and firm density is not jointly coherent with labor requirements;
4. **BV:** exited firms strand material inventories and claims; inventory recycling matters more than fixed-capital transfer alone;
5. **BW:** the initial economy is a synthetic cold start with sparse institutional circulation;
6. **CC:** firm-level viability failure is replicated across original and heldout seeds and is heterogeneous by firm size and sector.

The collapse therefore cannot responsibly be reduced to a single threshold defect.

## Repair authorization

**No canonical production repair is authorized by R4-CC alone.**

Specifically, do **not** yet:

- mechanically reduce the total firm count;
- force all firms into one target worker size;
- globally raise productivity until payroll is covered;
- suppress exits;
- erase wage arrears;
- relax credit constraints globally;
- transfer inactive assets for free.

The next production-design stage should define an empirically coherent establishment ecology containing at minimum:

- sector-specific establishment-size distributions;
- persons / households / workers as separate ontologies;
- labor-force participation and hours/labor units;
- sectoral productivity and capital intensity;
- realistic working-capital requirements;
- firm entry capitalization and startup inventories;
- accounting-preserving restructuring/liquidation;
- initialization or warm-start rules that avoid arbitrary cold-start discontinuities.

## Closure decision

**R4-CC = CLOSED / PASS AS DIAGNOSTIC EVIDENCE.**

The next action is not to rerun R4-CC. The next action is to update the integrated causal frontier and then triage the still-incomplete BR/BS/BU/CB/BX/BY shards by decision value, cancelling or replacing experiments that are no longer informative before spending additional Actions runtime.
