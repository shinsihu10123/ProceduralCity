# WP-RV08 R4-AT Execution — Labor Eligibility Causal Counterfactual

Date: 2026-08-22
Mode: diagnostic-only causal probe.

## Purpose

R4-AQ/R4-AR/R4-AS established that the current household-agent lacks age/participation states and simultaneously acts as both worker and household. R4-AT asks what happens if only a deterministic fraction of household-agents is eligible to enter the labor market.

This is **not** an empirical age or participation calibration. Shares 1.0, 0.8, 0.7 and 0.6 are sensitivity probes only.

## Isolation design

A default-OFF diagnostic filter was added to `labor-market.js`:

- canonical behavior is unchanged unless `country.__diagnosticLaborEligibility === true`;
- when enabled, only household-agents whose hidden `__diagnosticLaborEligible` flag is not false can enter the unemployment applicant queue;
- noneligible workers are detached from employment and cannot be rehired;
- the existing fiscal transfer mechanism is deliberately left unchanged.

Therefore noneligible agents continue to be handled by current transfer semantics. This is intentional: the run exposes both the labor-supply consequence and the fact that the existing fiscal system cannot distinguish unemployment from labor-force nonparticipation.

## Noninterference gate

For every seed/base pair, a 100%-eligible diagnostic world is replayed against a world with the diagnostic filter disabled for six months. Economic fingerprints must be bit-identical before lower eligibility shares are accepted.

## Scope

- original A/C + held-out E/F
- CONSUMER + MATERIALS+CONSUMER
- eligibility shares: 100%, 80%, 70%, 60%
- 24 months
- 32 primary counterfactual simulations plus 8 six-month exact noninterference pairs

## Metrics

- labor-force-corrected unemployment among eligible agents
- legacy macro nonemployment ratio
- desired jobs / eligible labor force
- economically viable physical need / eligible labor force
- full physical need / eligible labor force
- target fill and unfilled jobs
- GDP, real output, arrears, active firms, exits
- government transfers and transfer recipients

## Interpretation

- If 60–80% eligibility causes large unfilled-job and output losses, current all-households-eligible logic is masking a genuine demographic feasibility problem.
- If corrected unemployment remains high despite a tighter labor force, the collapse is not merely a denominator artifact.
- If transfer recipients surge automatically when agents are marked noneligible, fiscal semantics require a distinct nonparticipant category before any demographic implementation.
- No production repair or empirical demographic parameter is authorized by this experiment.

Workflow: `.github/workflows/economic-lab-rv08-r4-at-labor-eligibility.yml`
Script: `economic-lab/scripts/rv08-labor-eligibility-counterfactual-v10.mjs`
