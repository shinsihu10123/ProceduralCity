# WP-RV08 R4-Q/R/S/T/U High-Throughput Execution Contract

Date: 2026-08-21
Mode: **ACTUAL EXECUTION — DIAGNOSTIC ONLY**
Parent evidence: R4-O/P PASS; prior monolithic R4-Q incomplete only because of 30-minute wall-clock cancellation.
Canonical mechanism merge: **PROHIBITED**
Parameter tuning: **PROHIBITED**
Empirical realism claim: **PROHIBITED**

## Purpose

Increase execution throughput without weakening diagnostic controls. Long-horizon matrices are sharded by scale and seed so each artifact is independently reproducible and no single serial job carries the entire causal matrix.

## R4-Q — 36m restructure × estate × supply recovery

Re-run the exact Q causal matrix, but split it into six independent jobs:

- compact × ECON-RV02-A/B/C
- baseline × ECON-RV02-A/B/C

Each shard evaluates both bases and the four Q variants:

1. control;
2. topo-fullcash supply only;
3. operating-rule restructure + estate;
4. operating-rule restructure + estate + topo-fullcash.

Goal: close H-Q1/H-Q2 without reducing horizon, variants, scales or seeds.

## R4-R — 48m recoverability persistence

Baseline scale, ECON-RV02-A/B/C, one seed per job, 48 months, track P.

Goal: determine whether realized/operating/multi recoverability effects persist beyond the 24-month window, and whether the arrears penalty continues to accumulate. This is a persistence diagnostic, not parameter selection.

## R4-S — held-out recoverability robustness

Baseline scale, 24 months, held-out deterministic seeds:

- ECON-RV08-HOLDOUT-D
- ECON-RV08-HOLDOUT-E
- ECON-RV08-HOLDOUT-F

Track P.

Goal: test whether the O/P ranking was seed-specific. These seeds were not used to choose or tune the recoverability rules.

## R4-T — 48m restructure × estate isolation

Baseline scale, ECON-RV02-A/B/C, 48 months, track O.

Goal: isolate whether physical estate recycling becomes a material complement or remains secondary once restructuring is sustained for twice the original horizon.

## R4-U — held-out restructure × supply interaction

Baseline scale, 24 months, held-out D/E/F seeds, track Q.

Goal: test whether supply complementarity under the restructure architecture generalizes beyond the original diagnostic seeds before any production admission discussion.

## Hard gates

Every shard inherits the script-level gates:

- exact observer non-interference;
- deterministic replay;
- health;
- complete requested run coverage;
- normalization activation;
- restructure activation where applicable;
- estate activation where applicable;
- supply activation where applicable;
- physical-estate conservation;
- ledger/accounting integrity;
- GDP arithmetic identity;
- finite outputs.

Additional synthesis gate:

**Employment gains cannot be treated as repair sufficiency if payroll arrears materially diverge or continue accelerating.**

No unemployment target, arrears target, price target or fitted threshold is introduced.

## Execution width

This superbatch launches **18 independent economic jobs** in one workflow:

- Q: 6 shards;
- R: 3 shards;
- S: 3 shards;
- T: 3 shards;
- U: 3 shards.

This replaces the prior monolithic long-horizon execution pattern. Each shard uploads an independent JSON + log artifact and can fail/retry independently without invalidating completed siblings.

## Admission boundary after this batch

Only if a restructure variant shows persistent survival/output improvement **and** acceptable arrears discipline across original and held-out seeds may a production-grade restructure/liquidation state-machine design be proposed for implementation. Otherwise, RV08 remains diagnostic and must narrow the post-restructure payroll/operating-demand mechanism further.
