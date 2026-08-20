# WP-RV08 R4 — Estate / Accounting Synthesis Closure

Date: 2026-08-20
Status: **PASS — DIAGNOSTIC SYNTHESIS**
Frozen economic implementation baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`
Canonical mechanism changes: **0**
Parameter tuning: **0**

## Scope

This closure synthesizes the validated 24-month diagnostic evidence from:

- R4-A residual propagation factorial
- R4-B solvency-aware propagation matrix
- R4-D horizon-safe entrant finance × supply recovery
- R4-E NIA / orphan-inventory / physical-runoff superbatch
- R4-F exit-candidate counterfactual viability matrix
- R4-G replacement-regeneration cube
- R4-H exit-estate stranded-assets audit

The interventions used in these work packages are diagnostic upper bounds and counterfactuals. None is a production repair candidate by itself.

## A — VERIFIED EXISTING FACTS

1. The initial nominal / unit basis is structurally incoherent. Earlier RV07 evidence showed payroll obligations orders of magnitude above nominal output value under the canonical seed basis.
2. Productive-capacity normalization materially improves the economy, especially in CONSUMER and later MATERIALS, but does not eliminate long-run collapse.
3. Procurement cash access and same-month topological supply availability are real throughput channels, but are secondary / complementary rather than sufficient roots.
4. Planned layoffs alone are not the dominant residual collapse mechanism.
5. Binary firm exit is a large late-stage propagation amplifier. In the 24-month baseline, suppressing all exits greatly reduces unemployment, while simultaneously causing very large wage-arrears accumulation; therefore no-exit is not a repair.
6. Selective exit eligibility based on realized sales or recent demand has negligible rescue power. Latent capacity and especially cash-plus-stock criteria identify a much larger counterfactual recoverable set, but simple protection increases arrears materially.
7. The per-month `slice(0,2)` replacement cap is a secondary amplifier. Full replacement restores firm counts far more than it restores employment and creates high churn.
8. Entrant finance strongly changes entrant activation and survival but has only modest aggregate employment effect. It is an entry/resilience mechanism, not the primary collapse root.
9. Exit-estate semantics are incomplete. Firms are deactivated and employer links are severed, but productive/noncash stocks and obligations are not liquidated, transferred, written down, or resolved by an estate process.
10. By month 24 in R4-H baseline diagnostics, approximately 96–97% of firm book inventory, fixed assets, total firm assets/liabilities/equity and roughly 95% of wages payable reside in inactive firms. Approximately 71% of physical finished inventory and 81% of physical input inventory are also held by inactive firms.
11. The accounting GDP identity reconciles arithmetically, but its inventory semantics are severely defective as a representation of physical production. Over the 24-month R4-E window, inventory investment dominates expenditure GDP, while GDP excluding inventory is negative.
12. Approximately 78.7% of observed production-labor capitalization over the 24-month R4-E window occurs in zero-physical-output journal contexts.
13. At month 24, the orphan-inventory probe finds essentially all finished-goods book inventory without corresponding physical finished units; consumer book inventory is entirely orphaned in the terminal rows.
14. Operational physical-market evidence is distinct from the book-accounting defect: RESOURCE and MATERIALS output are persistently weakly absorbed, while CONSUMER frequently clears against near-zero inventory / stockout conditions.
15. A prior R4-D long-horizon diagnostic failed only its retrospective special-funding reconciliation because the transaction ledger uses a bounded retained-entry ring buffer. The horizon-safe rerun reconciled using cumulative settlement-return values and passed. This was an observer/instrumentation issue, not an economic mechanism result.
16. Workflows that pipe Node output to `tee` without `set -o pipefail` can falsely appear green after a Node assertion failure. New diagnostic workflows must use `set -o pipefail`.

## B — DIAGNOSTIC LEADS

The strongest remaining causal architecture is now:

**unit / productive infeasibility → payroll and liquidity distress → exit-candidate creation → binary destructive exit → employer severance + productive/working stock stranded in inactive estates + unresolved claims → weak/zero-resource replacement → demand/supply feedback**

This chain is better supported than a single-cause explanation based only on credit, matching, household voluntary demand, procurement search, or planned layoffs.

A separate representation defect exists in GDP/NIA inventory accounting. It can make nominal/book GDP rise or remain large while the physical economy collapses. That defect must not be used to infer empirical macro realism.

## C — HYPOTHESES REQUIRING CAUSAL TESTS

1. Recycling usable physical capital / inventories from exited firms into replacement firms should recover part of the employment/output loss if estate stranding is causally important, even without changing the exit count.
2. Selective recoverability guards and throughput repair may be complementary. If so, a guard × topological/full-cash supply matrix should recover materially more than either intervention alone without requiring a universal no-exit upper bound.
3. The objective cash-flow composition of exit candidates should show whether distress is generated primarily by payroll, input purchases, debt service, taxes, or lost operating inflows; this must be measured separately from agent beliefs / selected strategy.
4. A production repair will likely need a genuine restructure/liquidate/estate state machine rather than a weaker distress threshold or arbitrary exit delay.

## D — PROPOSED CHANGE STATUS

No canonical repair is approved or merged.

Potential future repair components remain proposals only:

- coherent unit/per-worker production basis;
- explicit restructuring versus liquidation semantics;
- estate settlement, claim resolution, and productive-asset disposition;
- replacement/entry institution capable of acquiring recycled productive stock;
- startup finance as a complementary institution;
- physically grounded WIP / finished-goods accounting where labor capitalization is conditional on actual production state.

## Next execution batch

The next diagnostic superbatch is intentionally broad:

- **R4-I** — Estate Recycling Counterfactual Matrix
- **R4-J** — Selective Viability Guard × Supply Complementarity Matrix
- **R4-K** — Exit-Candidate Objective Cash-Flow Waterfall

These should execute in parallel with 24-month horizons, compact + baseline scales, three diagnostic seeds, deterministic replay, accounting/ledger health checks where applicable, and explicit non-canonical labeling.

## Verdict

**PASS — ROOT-CAUSE SEARCH NARROWED TO PRODUCTIVE FEASIBILITY + DESTRUCTIVE EXIT / ESTATE PROPAGATION, WITH A SEPARATE SEVERE NIA INVENTORY-REPRESENTATION DEFECT.**
