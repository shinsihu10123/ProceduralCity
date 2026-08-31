# WP-RV08 R4-CU-D3D-B7-D1 Supplier Topology Causal Preregistration v0.1

## Entry decision

**D0 PREREGISTRATION PASSED / EXECUTE EXACT OBSERVED CELL O AND DISPOSABLE TOPOLOGY-NEUTRAL CELL T / NO CANONICAL MUTATION / NO CANDIDATE RETUNING**

The governing contract is `economic-lab/diagnostics/reality-validation/r4-cu-d3d-b7-d1-supplier-topology-causal-contract.json`.

## Frozen dependency

- D0 closure commit: `223cf7cc588f20c7ed581eedc15ae1c9a7ae7b39`
- D0 workflow run: `33379687459`
- D0 workflow head: `843fc056846784feab1ad7fa0dac13065aecaf74`
- D0 artifact: `9753238862`
- D0 artifact digest: `sha256:ea4248e0feb98632a8118dae50a6130b10f4bf626d7ae7d1c9f9b00bc9be4390`
- D0 contract SHA-256: `d5e0780d389dfc7a7c6a18ba7a95d6b17ec7bee4c88a6f1eb88beab4de0bab69`
- D0 result: `SEQUENCED MIXED CAUSAL PREREGISTRATION PASSED`
- Authorized next front: `R4-CU-D3D-B7-D1 supplier-topology and reachable-inventory causal isolation`

B7 found supplier-topology binding in 18/24 failed-primary panels and 12/24 control panels. The +0.25 prevalence differential determines why topology is tested first, but it is not itself a causal estimate.

## Frozen panel

- Candidates: `V1_M1_C42`, `V24_M16_C42`
- Seeds: `ECON-RV08-LONG-G`, `ECON-RV08-LONG-H`
- Scenarios: `BASELINE_36`, `SUPPLY_SHOCK_M13`, `FINANCIAL_CONFIDENCE_STRESS_M13`
- Horizon: 36 months
- Windows: `FULL_36`, `PRE_SHOCK_12`, `TRANSITION_12`, `TERMINAL_12`
- Jobs: 12
- Cells per job: `O`, `T`
- Exact model replay states: 2 per cell, 48 total

## Cell O

`O` executes the exact B7 procurement path: random sampled supplier search with the canonical maximum of five rounds. It must reproduce all B7 technical, replay, scenario, accounting and observation gates.

## Cell T

`T` is a disposable noncanonical counterfactual. It changes only supplier traversal inside procurement:

1. retain the canonical lexicographic buyer order;
2. expose every country-local active seller with the exact required product and positive inventory;
3. exclude self-supply;
4. sort sellers by posted price, then reliability proxy, then seller ID;
5. visit each eligible supplier at most once;
6. continue until the buyer's need or unchanged 42% cash budget is exhausted;
7. use the canonical ledger transfer, accounting entry and seller-cost rules.

There is no inventory injection, cash injection, price change, wage change, input-coefficient change, candidate-axis change or canonical source change.

## Boundary and conservation gates

During each procurement call, firm identity, product identity, input coefficients, price, productivity, capacity, desired production, target inventory, workers, plans and beliefs must remain unchanged.

The following identities must reconcile:

- country firm cash before procurement equals country firm cash after procurement;
- finished-goods inventory decrease equals purchased units;
- input-inventory increase equals purchased units;
- input-book increase equals interfirm purchase spend;
- ledger purchase units and spend equal the returned procurement metrics.

## Frozen estimands

- `absoluteTopologyEffect = inputShortageRate_O - inputShortageRate_T`
- `relativeTopologyEffect = absoluteTopologyEffect / max(inputShortageRate_O, 1e-9)`
- `candidateSpecificDifferential = absoluteTopologyEffect_primary - absoluteTopologyEffect_control`
- `valueEffectOfTopology = normalizedValuePathologyIndex_O - normalizedValuePathologyIndex_T`

The normalized value-pathology index remains the maximum of nonpositive-GVA share divided by 0.25 and below-cost revenue share divided by 0.50.

## Frozen classification thresholds

| Threshold | Value |
|---|---:|
| Minimum absolute topology effect | 0.10 |
| Minimum relative topology effect | 0.20 |
| Maximum T search/execution residual share | 1e-7 |
| Minimum replicated panel frequency | 0.50 |
| Maximum opposite-sign panel frequency | 0.25 |
| Both seeds required | YES |
| Minimum primary-specific differential | 0.05 |
| Minimum active-firm ratio | 0.95 |
| Minimum purchasing-power ratio | 0.90 |
| Minimum normalized value-index reduction | 0.20 |

These thresholds classify a diagnostic counterfactual. They are not calibrated production parameters.

## Closure labels

- `TOPOLOGY_CAUSAL`: the failed-primary effect passes both effect thresholds in at least half of frozen panels, appears in both seeds, has limited opposite-sign panels and preserves the frozen viability ratios.
- `TOPOLOGY_NONCAUSAL`: every technical gate passes but the causal rule is not satisfied.
- `TOPOLOGY_INDETERMINATE`: any technical, replay, schedule, boundary, conservation, accounting or completeness gate fails.

Detail labels distinguish a primary-specific effect, a common effect and no replicated effect. They do not replace the three closure labels.

## Canonical lock

D1 cannot alter canonical supply-chain code, candidate values, opening inventories, prices, cash, the C42 budget share, input coefficients, wages, demand, inventory targets, goods matching, settlement, accounting, taxes, banks, trade credit, entry, exit, seeds, scenarios, horizon, windows or thresholds after observation.

After an authoritative D1 closure, the required next front remains D6 over both O and T traces. A D1 result cannot itself authorize canonical mutation.
