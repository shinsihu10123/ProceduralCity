# WP-RV07 P36–P40 Root-Cause Batch Synthesis — 2026-08-20

## Overall verdict

**PASS — ROOT-CAUSE SPACE MATERIALLY NARROWED; SINGLE-SCALAR EXPLANATIONS REJECTED**

Canonical economic source changes: **0**  
Fitted parameter tuning: **0**  
Repair merge: **0**  
Empirical realism claim: **NO**

## A — VERIFIED RESULTS

### P36 Exact Unit-Factor Attribution

Baseline pooled 12-month firm-months under the existing P2 unit-basis candidate:

- RESOURCE: price/wage `0.584`, capacity/worker `0.940`, `100%` below labor break-even capacity, mean break-even capacity multiplier `1.912`, required price at canonical capacity `104.50`.
- MATERIALS: price/wage `0.827`, capacity/worker `0.976`, input coefficient `0.62`, `100%` below break-even, mean multiplier `2.334`, required price `133.22`.
- CONSUMER: price/wage `0.989`, capacity/worker `1.121`, input coefficient `0.52`, `99.3%` below break-even, mean multiplier `1.662`, required price `126.85`.
- CAPITAL: only `20.2%` below break-even; mean multiplier `0.877`.
- Productivity, capital, human-capital, resource and plan capacity factors are individually near unit scale. There is no single anomalously tiny multiplicative capacity term.

**Result:** the structural defect is not one low productivity factor. Revenue per worker, wages, relative prices and intermediate-input costs are mutually incoherent across the production graph.

### P37 One-Time Derived Break-Even Relative Prices

Run `32325380051`, job `96295440431`, artifact `9391193266`, digest `594ffb4faa1757af71495baf66bf3948d1788a1ad0e85d775f6aae8f94ef452a`.

All hard gates passed.

Baseline FULL control: unemployment `0.2514`, exits `248`, fulfillment `0.557`.

- RESOURCE-only initialization worsens unemployment to `0.2596`, exits `266`.
- MATERIALS-only lowers unemployment to `0.2376`, exits `220`, but does not repair the system.
- CONSUMER-only greatly improves cash/fulfillment (`0.719`) but pooled unemployment is slightly worse (`0.2567`).
- Non-capital joint derived prices improve fulfillment to `0.802` and firm cash strongly, but pooled unemployment is still `0.2475`; physical consumer output is below control.

**Result:** relative-price coherence matters, but price repair alone does not solve the collapse and can transfer stress downstream.

### P38 Intermediate-Input-Free Causal Upper Bound

Run `32325419065`, job `96295563001`, artifact `9391205488`, digest `788415fd3d1af60c345028685e99d82f4a41487107ab1267cb2e8ecc80183671`.

All hard gates passed.

Removing intermediate-input requirements is not a rescue. Baseline FULL:

- MATERIALS-input-free: unemployment `0.2533`, exits `255`.
- CONSUMER-input-free: unemployment `0.2949`, exits `284`.
- downstream-input-free: unemployment `0.2939`, exits `288`.
- all-input-free: unemployment `0.3114`, exits `295`.

The interventions reduce measured input shortage and can raise consumer output/firm cash, but they simultaneously destroy interfirm expenditure and upstream revenue circulation. In the all-input-free baseline, unemployment rises by about `+0.0600` despite consumer output rising to `1.232x` control.

**Result:** intermediate-input coefficients are not a standalone primary burden. The B2B network is also a demand/revenue transmission channel.

### P39 Relative Price × Physical Capacity Interaction

Run `32325471431`, job `96295716032`, artifact `9391208512`, digest `29c5bf1deffe73cb20da0cf972ec1a3cef4ec8526a190222ee25fd4ee77af0f7`.

All hard gates passed.

Baseline FULL:

- initial-price only: unemployment delta `-0.00390`, exits `-5`.
- non-capital capacity only: unemployment delta `-0.01640`, exits `-24`, arrears `-8325`, consumer output `1.658x`.
- price + capacity: unemployment delta `-0.01864`, exits `-14`, consumer output `1.133x`, large nominal/cash gains.

The combination only marginally improves pooled unemployment beyond capacity alone and actually preserves fewer exit reductions. Price changes mostly improve nominal sales/cash/fulfillment rather than physical productive recovery.

**Result:** physical-capacity correction is the stronger real-side intervention; there is no decisive positive price×capacity synergy.

### P40 Stockout-Censored Sales Memory × Capacity

Run `32325631752`, job `96296181921`, artifact `9391262424`, digest `22e1cf73f228ca6d833d334ded3d3a9d77be19a08e942e27bc74ea34ce17969d`.

All hard gates passed.

Baseline FULL:

- stockout-memory correction alone: unemployment delta `-0.00029`, exits `-1`; essentially no macro effect.
- capacity alone: unemployment delta `-0.01640`, exits `-24`.
- capacity + stockout-memory: unemployment delta `-0.01644`, exits `-24`; essentially identical to capacity alone.

**Result:** the conservative stockout-memory censoring correction is not the missing residual root. It is a real measurement issue from RV03, but not a major causal driver under this test.

## B — DIAGNOSTIC LEADS

1. The strongest remaining real-side lead is **physical production unit coherence / labor capacity**, especially outside CAPITAL.
2. Capacity normalization raises desired/actual output but also raises intermediate-input shortage, indicating **monthly supply-stage topology may prevent extra upstream output from becoming same-month downstream input**.
3. Residual unemployment around `23.5%` under the strongest capacity-only variant remains too large to attribute to the physical unit defect alone.
4. Earlier RV03 evidence showed planned layoffs precede mass exits. The remaining unemployment may therefore be driven by **firm hiring-plan contraction / defensive strategy feedback** even after productive feasibility improves.
5. Exit remains a later amplifier and should be interaction-tested with capacity/hiring rather than treated as the initial trigger.

## C — UPDATED HYPOTHESES

- H-ROOT-UNIT: cross-sector physical-unit / wage / price / input-cost architecture is a root structural defect. **STRONGLY SUPPORTED**.
- H-ROOT-PRICE-ONLY: relative prices alone are the root. **FALSIFIED**.
- H-ROOT-INPUT-COEFFICIENT-ONLY: intermediate-input requirements alone are the root burden. **FALSIFIED**.
- H-ROOT-STOCKOUT-MEMORY: stockout-censored `previousSales` learning is the major residual driver. **FALSIFIED under the conservative P40 intervention**.
- H-RESIDUAL-HIRING: defensive firm hiring decisions/planned layoffs are a major residual propagation loop. **OPEN / HIGH PRIORITY**.
- H-RESIDUAL-TOPOLOGY: procurement-before-production stage ordering prevents capacity gains from propagating through the input graph. **OPEN / HIGH PRIORITY**.

## D — NEXT EXPANDED EXECUTION

Open P41–P44 in parallel:

- P41 exact firm decision / hiring-contraction attribution,
- P42 planned-layoff suppression × capacity causal matrix,
- P43 exit-boundary suppression × capacity/hiring causal matrix,
- P44 topological same-month supply × capacity interaction.
