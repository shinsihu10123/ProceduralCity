# WP-RV08 R4-CU-D3D-B6-S2 Closure v0.1

## Decision

**HELDOUT REPLICATION CONFIRMED / 3 REPLICATED CANDIDATE(S) / PRIMARY V24_M16_C42 / CANONICAL MUTATION NOT AUTHORIZED**

## Authoritative execution

- Source workflow run ID: `33359245264`
- Source workflow head SHA: `afe69ad54fde20bd62ea2527c757a6416b027249`
- Source workflow URL: `https://github.com/shinsihu10123/ProceduralCity/actions/runs/33359245264`
- Aggregate artifact ID: `9746153192`
- Aggregate artifact digest: `sha256:57b745f6c5abda572cf06cd2fd56e067f80c2a3a668ff959fb86ba665227a15b`
- Aggregate JSON SHA-256: `3a08ec790636bc239757567eed5c265c9cf369c30e526c518fdbb00a2377f41f`
- Closure generated at: `2026-08-31T05:12:04.142Z`
- Technical status: `PASS_TECHNICAL_HELDOUT_AGGREGATION`
- Economic decision: `HELDOUT_REPLICATION_CONFIRMED`
- Observed jobs: `8/8`

## Frozen heldout panel

- Control: `V1_M1_C42`
- Stage-1 finalists: `V1_M16_C42`, `V1_M4_C42`, `V24_M16_C42`
- Heldout seeds: `ECON-RV08-HOLDOUT-E`, `ECON-RV08-HOLDOUT-F`
- Horizon: 12 months
- Candidate retuning after heldout observation: prohibited
- Threshold relaxation after heldout observation: prohibited

## Heldout replication result

- Replicated candidates: `V24_M16_C42`, `V1_M4_C42`, `V1_M16_C42`
- Replicated candidate count: `3`
- Primary replicated candidate: `V24_M16_C42`
- Worst-heldout headline distance: 2.742626
- Worst-heldout input-shortage ratio vs control: 0.111670
- Mean nonpositive-GVA share: 0.000000
- Minimum active-firm ratio vs control: 1.088235
- Dependency-safe routing: `R4-CU-D3D-B6-S3 long-horizon and stress validation of the preregistered primary replicated candidate against canonical control`

## Candidate × heldout-seed evidence

| Candidate | Seed | Replicated | Labour share | Control labour share | Consumption share | Control consumption share | Input shortage ratio | Active-firm ratio | Purchasing-power ratio | Integrity | Labour improvement | Consumption improvement | Shortage gate | Firm gate | Purchasing-power gate |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| V1_M16_C42 | ECON-RV08-HOLDOUT-E | PASS | 1.957311 | 3.876753 | 0.004739 | 0.003651 | 0.036594 | 1.000000 | 0.966935 | PASS | PASS | PASS | PASS | PASS | PASS |
| V1_M16_C42 | ECON-RV08-HOLDOUT-F | PASS | 2.053538 | 3.817773 | 0.006254 | 0.004818 | 0.036733 | 1.000000 | 1.038584 | PASS | PASS | PASS | PASS | PASS | PASS |
| V1_M4_C42 | ECON-RV08-HOLDOUT-E | PASS | 2.147316 | 3.876753 | 0.005729 | 0.003651 | 0.161218 | 1.000000 | 0.849088 | PASS | PASS | PASS | PASS | PASS | PASS |
| V1_M4_C42 | ECON-RV08-HOLDOUT-F | PASS | 2.137274 | 3.817773 | 0.006412 | 0.004818 | 0.140475 | 1.014706 | 1.009375 | PASS | PASS | PASS | PASS | PASS | PASS |
| V24_M16_C42 | ECON-RV08-HOLDOUT-E | PASS | 1.933589 | 3.876753 | 0.052476 | 0.003651 | 0.111670 | 1.088235 | 1.010109 | PASS | PASS | PASS | PASS | PASS | PASS |
| V24_M16_C42 | ECON-RV08-HOLDOUT-F | PASS | 2.012475 | 3.817773 | 0.055560 | 0.004818 | 0.094010 | 1.088235 | 1.080954 | PASS | PASS | PASS | PASS | PASS | PASS |

The empirical labour-share and realized-consumption bands remain external validation bands. They are not direct values for canonical wages, prices, productivity, material coefficients or household demand parameters.

## Technical gates

| Gate | Result |
|---|---:|
| protocolExact | PASS |
| sourceStage1EvidenceFrozen | PASS |
| frozenCandidatePanelExact | PASS |
| c42OnlyPanel | PASS |
| expectedJobCount | PASS |
| completeResultCount | PASS |
| noDuplicateJobs | PASS |
| noMissingJobs | PASS |
| noUnexpectedJobs | PASS |
| allHeldoutEnvelopesPassed | PASS |
| allSourceEngineIntegrityPassed | PASS |
| allExactReplayPassed | PASS |
| allAccountingHealthy | PASS |
| payloadHashesPresent | PASS |
| controlPresentBothSeeds | PASS |
| controlCanonicalEquivalenceExact | PASS |
| allFinalistsEvaluated | PASS |
| noFacilityDrawInC42Panel | PASS |
| postHocRelaxationLocked | PASS |
| canonicalMutationLocked | PASS |

## Interpretation

The heldout result answers only whether one or more preregistered B6 causal families reproduce on untouched seeds under the same 12-month measurement and eligibility surface. It does not identify a fully calibrated economy, and it does not authorize canonical mutation.

The next permitted front is `R4-CU-D3D-B6-S3 long-horizon and stress validation of the preregistered primary replicated candidate against canonical control`. Only the preregistered primary candidate may advance, and its values remain frozen during long-horizon and stress validation.

## Canonical lock

This closure does **not** authorize:

- changing canonical wages, prices, productivity, material coefficients or procurement rules;
- changing household desired-consumption behavior;
- adding, replacing or tuning a heldout candidate;
- changing the heldout seeds or 12-month horizon;
- relaxing eligibility or ranking rules;
- converting an external empirical band into a direct parameter target.
