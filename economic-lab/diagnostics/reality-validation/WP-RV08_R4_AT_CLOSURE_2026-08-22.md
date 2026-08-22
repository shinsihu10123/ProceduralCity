# WP-RV08 R4-AT Closure — Labor Eligibility Causal Counterfactual

Date: 2026-08-22
Run: `32556713392`
Source run SHA: `c5afab70cd8698de59606fb1b9b69990b40d43fb`
Verdict: **PASS — causal narrowing / FAIL-CONTINUE — demographic realism is not a sufficient repair**

## Coverage and gates

- 8/8 economic shards SUCCESS
- 32/32 primary 24-month counterfactual simulations completed
- 8 six-month 100%-eligibility noninterference pairs were bit-exact
- final beacon SUCCESS
- accounting, ledger, GDP arithmetic and health gates PASS

## Question

What changes if only a deterministic fraction of household-agents is eligible to enter the labor market, while the rest of the economic model is kept intact?

Shares 1.0, 0.8, 0.7 and 0.6 are sensitivity probes only. They are not empirical demographic calibration.

## Aggregate findings

Across original A/C and held-out E/F, reducing labor eligibility does **not** reveal a hidden reserve of unemployed workers that solves the collapse. Instead, the labor-force-corrected unemployment rate falls mechanically while the economy loses productive capacity.

### CONSUMER normalization

At 100% eligibility: corrected unemployment 47.00%, GDP 25.04k, output 94.47, arrears 107.4k.

At 80% eligibility: corrected unemployment 40.50%, but GDP falls 8.1%, output 11.4%, and economically viable labor need rises to 93.9% of the eligible labor force.

At 70% eligibility: corrected unemployment 37.01%, but GDP falls 12.4%, output 15.8%, and viable labor need exceeds the eligible labor force on average (`1.140x`).

At 60% eligibility: corrected unemployment 33.56%, but GDP falls 18.7%, output 28.5%, and viable labor need rises to `1.412x` the eligible labor force.

### MATERIALS+CONSUMER normalization

At 100% eligibility: corrected unemployment 42.41%, GDP 28.18k, output 127.07, arrears 101.6k.

At 80% eligibility: GDP falls 7.0%, output 7.3%, while viable labor need becomes `1.177x` the eligible labor force.

At 70% eligibility: GDP falls 14.4%, output 15.1%, viable need becomes `1.397x`.

At 60% eligibility: GDP falls 19.3%, output 20.2%, viable need becomes `1.766x`.

Full physical production need is already about `1.92–2.08x` the all-household labor pool at 100% eligibility and rises to `3.60–3.90x` at 60% eligibility.

## Key causal interpretation

1. **The legacy unemployment metric is structurally wrong for a realistic demographic model.** It treats all household-agents as labor-force members.
2. **Correcting the denominator alone does not remove the collapse.** Even after restricting the labor force, corrected unemployment remains very high.
3. **The current model is actually generous to production by allowing every household-agent to be a potential worker.** Removing children, retirees and other nonparticipants without changing the rest of the economy makes feasible labor supply tighter.
4. **Posted labor demand is still not the binding aggregate constraint.** Desired jobs remain below the eligible labor force in almost all cases and target fill remains about 96–97.5%. The deeper mismatch remains production need versus economically supportable and requested labor.
5. **Fiscal semantics are incompatible with nonparticipation.** Because the existing transfer system treats every non-employed household as unemployed, reducing labor eligibility raises transfer spending even though many newly non-employed agents are supposed to be outside the labor force. This is a separate structural defect.
6. Falling arrears and exits at lower eligibility are not evidence of improvement: GDP and output fall substantially at the same time. The model is shrinking activity rather than finding a healthier equilibrium.

## Hypotheses

- H-AT-1: high measured unemployment is mainly a denominator artifact — **FALSIFIED as a primary explanation**.
- H-AT-2: current all-households-eligible labor supply masks a demographic feasibility constraint — **SUPPORTED**.
- H-AT-3: realistic labor-force eligibility can be added independently of fiscal and household ontology — **FALSIFIED**.
- H-AT-4: labor matching is the main reason firms cannot obtain workers — **FALSIFIED again**; target fill remains near complete.
- H-AT-5: demography alone is a sufficient repair — **FALSIFIED**.

## Structural implication

Demography cannot be implemented as an `eligible=true/false` patch on the current household object. A credible architecture needs at least:

- person and household separation,
- age and life-cycle state,
- labor-force participation distinct from employment,
- student/retired/nonparticipant states,
- births, deaths and aging,
- household membership and multiple workers per household,
- fiscal eligibility rules that distinguish unemployment from nonparticipation,
- population-flow consistency with labor, consumption, savings and transfers.

These are architecture requirements, not yet authorized canonical changes.

## Evidence

Permanent compact evidence:
`economic-lab/diagnostics/reality-validation/evidence/WP-RV08_R4_AT_LABOR_ELIGIBILITY_COMPACT_2026-08-22.csv`

Workflow artifacts are retained for the full per-seed/per-base results.
