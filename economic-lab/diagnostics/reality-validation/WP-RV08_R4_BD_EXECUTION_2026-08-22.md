# WP-RV08 R4-BD Execution — Endogenous Stabilizer / Destabilizer Feedback Sign-and-Lag Audit

Date: 2026-08-22
Status: EXECUTION
Mode: observational ecosystem audit; not causal repair

## Question

An economy survives disturbances through negative feedbacks: transfers, replacement entry, credit, rehiring, investment, policy demand and balance-sheet adaptation. It collapses when positive feedbacks dominate. R4-BD asks which modeled responses actually move countercyclically after unemployment jumps or output contractions, at what lag, and which responses instead amplify the downturn.

## Base and coverage

Use the prior MATERIALS+CONSUMER diagnostic normalization and initialPrice≈initialWage transformation.

- original A
- original C
- held-out E
- held-out F
- 48 months each
- four-country world in every seed shard

No behavioral rule is changed.

## Stress signals

- monthly unemployment change
- monthly real-output contraction
- severe event: unemployment rises at least 2 percentage points in a month OR real output contracts at least 10 percent

## Candidate stabilizers / amplifiers

- automatic fiscal transfers per household
- government demand per household
- new credit per active firm
- firm entry rate
- firm exit rate
- hire rate
- layoff rate
- gross investment per household
- consumption per household

## Measurements

1. contemporaneous and +1/+3 month correlations between stress and each response;
2. severe-event windows comparing the three months after stress with the three months before stress;
3. cumulative firm-entry replacement ratio relative to firm exits;
4. terminal unemployment and wage-arrears context.

## Interpretation discipline

- Positive transfer/government-demand response to unemployment or contraction is a candidate countercyclical stabilizer.
- Positive exits/layoffs response is a candidate destabilizing feedback.
- Credit response is ambiguous until borrower survival/default quality is considered.
- Entry response is only stabilizing if it actually replaces exits and supports durable employment/output.
- Correlations and event windows are DIAGNOSTIC LEADS, not causal effects.

## Hard gates

- 48-month complete histories
- accounting verification
- settlement-ledger verification
- GDP identity arithmetic
- normalization activation
- no canonical source mutation

R4-BD is intended to identify the next causal intervention targets rather than authorize a policy or architecture change.