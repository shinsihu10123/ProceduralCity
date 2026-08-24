# WP-RV08 Post-R4-CC Causal Frontier and Execution Triage — 2026-08-25

## Status

**EXECUTION CHECKPOINT — R4-CC CLOSED / DUPLICATE WORK PROHIBITED / NEXT EXPERIMENTS TRIAGED BY DECISION VALUE**

This document is the repository-native continuation checkpoint after formal closure of R4-CC. It exists to prevent duplicate work and to distinguish completed evidence, partial evidence, cancelled work and genuinely unresolved questions.

## Authoritative continuation point

- branch: `scratch/new-project-2026-08-12`
- R4-CC closure commit precedes this checkpoint
- canonical economic runtime remains unchanged by R4-CC closure
- current mode: **diagnostic integration and experiment triage**
- current mode is **not** production repair

## Closed or sufficiently evidenced fronts — DO NOT RERUN

### R4-AP — population scale / labor feasibility

**CLOSED / PASS AS DIAGNOSTIC EVIDENCE.**

Established:

- simple finite-agent insufficiency is not the collapse root;
- balanced doubling does not rescue normalized macro behavior;
- household/firm density is material;
- household = worker-slot = consumption/balance-sheet unit is an invalid long-run ontology;
- persons, households, labor force, workers and establishments must eventually be separate concepts.

### R4-CC — firm size / density / payroll viability

**CLOSED / PASS AS DIAGNOSTIC EVIDENCE.**

Established across original A/C and heldout E/F:

- all 4/4 artifact gates pass;
- roughly 71.6% of active firm-months have revenue below payroll;
- roughly 39.4% of active firm-months carry wage arrears;
- active-firm counts contract sharply over 36 months;
- distress is heterogeneous by worker-size bin and sector;
- RESOURCE and MATERIALS are especially fragile;
- no one global firm-size or firm-count scalar is justified.

### R4-BR cash-flow waterfall

**SUFFICIENTLY EVIDENCED FOR CURRENT FRONTIER.**

Four-seed evidence already established that immediate exit candidates are overwhelmingly operating-cash / payroll-coverage failures. Debt service and corporate tax are not the dominant proximate exit trigger.

Do not rerun the waterfall itself.

### R4-BV stranded estates / recycling / restructuring

**SUFFICIENTLY EVIDENCED FOR CURRENT FRONTIER.**

Established:

- inactive firms strand material inventories and claims;
- inventory recycling has far larger real effects than fixed-capital transfer alone;
- accounting reclassification without real resource transfer does not rescue the economy;
- restructuring preserves activity but can accumulate unpaid labor claims.

Do not repeat the completed BV matrices.

### R4-BW single-seed architectural census

**ARCHITECTURAL FACTS ACCEPTED; CAUSAL GENERALIZATION NOT CLOSED.**

The cold-start and sparse-institutional-network findings are accepted as architectural facts. The one-seed raw-base census itself does not need to be repeated; only missing multi-seed replication shards may still have value.

## Integrated causal frontier

The current collapse is best represented as a coupled structural failure rather than a single scalar defect.

### Frontier A — establishment economics / payroll viability

**High confidence.**

Evidence chain:

- BR: exit frontier dominated by operating-cash/payroll deficit;
- AP: firm-heavy density profiles worsen physical and economic feasibility;
- CC: ~71.6% revenue-below-payroll firm-month share across four seeds;
- CC: strong sector and firm-size heterogeneity;
- BV: keeping firms alive without resolving payroll solvency accumulates arrears.

Interpretation:

> Establishment count, establishment size, sector technology, labor requirement, productivity, wages and working capital are not jointly coherent.

### Frontier B — labor ontology / labor-demand formation

**High confidence.**

Evidence chain:

- AP/BU: household object simultaneously represents a worker slot and a household balance-sheet/consumption unit;
- canonical schema lacks working-age and labor-force participation semantics;
- desired jobs can remain far below physical labor need;
- matching usually fills the jobs actually requested, so applicant scarcity is not the primary target-level failure.

Interpretation:

> The simulation needs a separate person/household/worker/labor-unit ontology before population and firm density can be empirically calibrated.

### Frontier C — credit timing and capitalization

**Medium-high confidence, incomplete causal decomposition.**

Evidence chain:

- BS rejection trace finds bank capital commonly appears as the first binding reported gate;
- rejected firms also have weak borrower economics and affordability;
- BR finds finance inflow is negligible by the immediate exit-candidate stage.

Interpretation:

> Credit may matter earlier in the firm lifecycle, but broad credit relaxation is not authorized because weak operating economics remain.

### Frontier D — exit estates / secondary circulation

**High confidence as amplification channel.**

Evidence chain:

- BV finds large inactive inventory stocks;
- inventory recycling materially improves output and exits in upper-bound tests;
- fixed-capital transfer alone is weak.

Interpretation:

> Missing liquidation/secondary-market circulation amplifies the collapse, but is not sufficient as the primary root repair.

### Frontier E — initialization / institutional circulation

**Medium confidence, replication incomplete.**

Evidence chain:

- BW opening state is strongly synthetic: preloaded finished inventory, zero input inventory, arbitrary previous-sales anchors, zero current household income, homogeneous beliefs, no initial private loan stock;
- persistent private credit and job-to-job mobility are sparse in the observed network.

Interpretation:

> Cold-start discontinuities are plausible collapse amplifiers and should be tested through warm-start counterfactuals rather than fixed by arbitrary initialization tuning.

## Incomplete jobs and triage decision

### R4-BR entrant finance lifecycle

Previous job status: **CANCELLED**.

Decision: **DEFER, DO NOT BLINDLY RELAUNCH.**

Reason:

- immediate BR failure mechanism is already established;
- the unresolved question is specifically whether viable working capital arrives early enough in the entrant lifecycle;
- this question should be re-specified after the establishment-economics design is clearer, otherwise the experiment mixes pathological firm economics with credit timing.

### R4-BS underwriting timing matrix

Previous job status: **CANCELLED**.

Decision: **DEFER / REPLACE WITH NARROWER FACTORIAL LATER.**

Reason:

- broad matrix runtime was expensive;
- bank capital, borrower risk and affordability already interact;
- after AP/CC, the useful experiment must condition on economically coherent firm-size/payroll regimes, not the current structurally inconsistent baseline alone.

### R4-BU demographic labor-force structure

Previous job status: **CANCELLED**.

Decision: **DO NOT RELAUNCH THE OLD COUNTERFACTUAL AS-IS.**

Reason:

- AP/BU already establish that the current ontology lacks the required demographic semantics;
- further pseudo-demographic overlays on household objects have diminishing decision value;
- next step should be an ontology/design specification before another runtime experiment.

### R4-BU labor eligibility counterfactual

Previous job status: **CANCELLED**.

Decision: **SUPERSEDE BY ONTOLOGY DESIGN.**

Reason:

- eligibility cannot be made production-valid while households remain worker slots;
- old counterfactual may still be retained as historical diagnostic evidence but should not block progress.

### R4-CB institutional multi-seed replication

Previous result: **7/8 success; heldout-F/raw cancelled.**

Decision: **LOW-COST COMPLETION CANDIDATE, NOT CURRENT BLOCKER.**

Reason:

- seven shards already provide broad replication coverage;
- the one missing raw heldout-F shard can be completed later if needed for formal statistical closure;
- it does not block establishment/labor architecture design.

### R4-BX bank-capital × wage interaction

Previous result: **4/4 cancelled before completed matrices.**

Decision: **DO NOT RELAUNCH AS-IS.**

Reason:

- the interaction is conceptually relevant but computationally expensive;
- wage adjustment on the current labor/firm ontology risks interpreting an artifact as a policy result;
- redesign after establishment and labor semantics are specified.

### R4-BY credit application queue coverage

Previous result:

- original A: success
- heldout E: success
- original C: failure
- heldout F: cancelled

Decision: **INSPECT FAILURE BEFORE ANY RELAUNCH; PARTIAL RESULTS ARE NOT DISCARDED.**

Reason:

- original-C failure may represent a substantive invariant/assertion failure rather than mere infrastructure cancellation;
- duplicate successful shards must not be rerun;
- only failed/missing shards should ever be considered for a targeted rerun.

## Duplicate-work lock

The following work is now explicitly prohibited unless new contradictory evidence appears:

1. rerunning R4-AP scale profiles;
2. rerunning the four R4-CC seed shards;
3. rerunning completed BR waterfall shards;
4. rerunning completed BV recycling / estate / restructuring matrices;
5. repeating the one-seed BW census merely to reproduce already-known opening-state facts;
6. restarting WP-RV08 from its beginning;
7. modifying canonical economic code before the architecture/design gate below is completed.

## Next dependency-safe work package

### WP-RV08-R4-CD — Establishment + Labor Ontology Design Gate

**This is the next recommended dependency-safe front.**

It is a design/evidence synthesis package, not a production-code mutation.

Required outputs:

1. define canonical semantic distinction among:
   - person;
   - household;
   - working-age person;
   - labor-force participant;
   - employed person;
   - labor hours / labor units;
   - firm / establishment;
   - sector;
2. define how many persons can belong to one household and how household consumption/balance-sheet state aggregates from persons;
3. define firm employment demand in labor units rather than one-household-one-job slots;
4. define sector-specific establishment size and productivity concepts;
5. define payroll feasibility identities and invariants;
6. define startup working-capital and inventory requirements;
7. define which empirical targets will later calibrate population, establishment density and size distribution;
8. define migration path from current schema without mutating the canonical runtime yet;
9. define acceptance gates for a future causal implementation experiment.

## Stop gate

**Do not modify `world-v10` or other canonical economy mechanics during R4-CD.**

R4-CD closes only when the architecture can answer, without ambiguity:

> Given a population, household structure, labor-force participation rate, sectoral establishment distribution, productivity and wage system, is the implied labor demand and payroll burden physically and financially feasible before credit, liquidation or stabilization policy is applied?

Only after that gate passes should implementation begin.

## Current checkpoint

`CHECKPOINT = R4-CC-CLOSED / POST-CC-FRONTIER-FROZEN / R4-CD-NEXT`

This checkpoint supersedes the earlier `R4-CC-ARTIFACTS-RECOVERED-AND-AGGREGATED / FORMAL-CLOSURE-PENDING` checkpoint.
