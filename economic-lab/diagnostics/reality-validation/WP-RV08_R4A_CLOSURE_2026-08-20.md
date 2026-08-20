# WP-RV08-R4A Closure — 24-Month Residual Propagation Factorial

Date: 2026-08-20
Status: **PASS**
Canonical mechanism changes: **0**
Fitted parameter tuning: **0**

## Execution evidence

Workflow run: `32369764253`
Job: `96427365222`
Conclusion: **SUCCESS**
Artifact: `economic-lab-wp-rv08-r4-a`, ID `9407049858`
Artifact SHA256: `65ce2f78e5ff2627c97ac0164d47c070c422627cd35136a03266f35db2550b76`

All hard gates PASS:

- deterministic replay;
- health;
- complete factorial coverage;
- capacity normalization activation;
- joint-supply activation;
- no-layoff and no-exit diagnostic activation;
- exact zero layoffs/exits in the corresponding upper bounds;
- settlement ledger;
- GDP arithmetic identity;
- finite rows.

## Baseline 24-month factorial

### CONSUMER capacity basis

Canonical control:

- unemployment 0.4753;
- exits 666;
- wage arrears 108,454;
- goods fulfillment 0.389;
- input shortage 76.1;
- planned layoffs 1,427;
- consumer output 92.4.

Single upper bounds versus control, full 24-month pooled window:

- joint supply: unemployment -0.0151; exits -2; fulfillment +0.0159; consumer output ×1.102;
- no layoffs: unemployment -0.0200; exits -2; arrears +28,342; consumer output ×0.963;
- no exits: unemployment -0.2981; exits -666; fulfillment +0.1924; consumer output ×1.377; arrears +72,572.

Combined no-layoff + no-exit:

- unemployment -0.4680 relative to control;
- pooled unemployment 0.0074;
- zero exits and zero planned layoffs;
- arrears rise to 264,607.

All three upper bounds (joint supply + no layoffs + no exits):

- pooled unemployment 0.0070;
- fulfillment 0.711;
- consumer output 142.9;
- arrears 248,509.

### MATERIALS + CONSUMER capacity basis

Canonical control:

- unemployment 0.4399;
- exits 644;
- arrears 101,604;
- fulfillment 0.488;
- input shortage 92.0;
- planned layoffs 1,581;
- consumer output 118.3.

Single upper bounds versus control:

- joint supply: unemployment -0.0280; fulfillment +0.0400; shortage -11.1; consumer output ×1.182;
- no layoffs: unemployment -0.0159; exits +6; arrears +32,008; consumer output ×0.931;
- no exits: unemployment -0.2572; exits -644; fulfillment +0.2642; consumer output ×1.459; arrears +62,469.

Joint supply + no exits:

- unemployment -0.2923 versus control;
- fulfillment +0.3887;
- consumer output ×1.928.

All three upper bounds:

- pooled unemployment 0.0068;
- fulfillment 0.924;
- input shortage 86.3;
- consumer output 203.1;
- arrears 247,019.

## Temporal decomposition

The no-exit effect is not an initialization artifact. It becomes large only after distress/exit waves begin:

- M1-3: essentially zero effect;
- M4-6: small effect;
- M7-9: unemployment reduction roughly 0.16–0.17 at baseline;
- M10-24: the effect becomes dominant.

This timing matches the previously observed transition from planned layoffs to exit-boundary worker displacement.

## Claim ledger

### A — VERIFIED EXISTING FACT

1. No-layoff alone has only a small 24-month unemployment effect and substantially raises arrears.
2. Supply repair alone is physically useful but far smaller than the no-exit upper bound in employment terms.
3. No-exit is the dominant single upper-bound intervention after the exit wave begins.
4. No-layoff and no-exit together are strongly complementary for the employment stock: they nearly eliminate unemployment in this diagnostic ceiling.
5. The same combined ceiling produces enormous arrears, proving that employment preservation alone is not an economically coherent repair.
6. MATERIALS+CONSUMER normalization plus joint supply materially improves real throughput, especially when firm relationships are preserved.

### B — DIAGNOSTIC LEAD

The collapse is a propagation loop rather than a one-scalar defect:

`weak unit economics / liquidity stress → firm distress → exit → destruction of employer relationships and productive capacity → weaker demand/sales/supply linkages → further distress`.

Supply repair reduces physical friction, but firm destruction truncates its macro benefit. Labor suppression alone cannot stabilize firms whose payroll is not financially supportable.

### C — HYPOTHESIS

A coherent production repair must preserve recoverable firms without preserving genuinely insolvent/zombie firms. The required state is therefore counterfactual operating viability / recoverability, not `no exit` and not current realized-revenue viability alone.

### D — PROPOSED CHANGE

None admitted by R4-A. R4-F is already testing objective counterfactual exit-candidate viability classes, while R4-G tests whether the canonical two-entrant replacement cap creates an independent regeneration deficit.

## Verdict

**PASS — EXIT/RELATIONSHIP DESTRUCTION IS THE DOMINANT LATE PROPAGATION AMPLIFIER; SUPPLY IS COMPLEMENTARY; NO-LAYOFF ALONE IS WEAK; THE NO-LAYOFF + NO-EXIT CEILING CONFIRMS A POWERFUL EMPLOYMENT-STOCK FEEDBACK BUT IS ECONOMICALLY INADMISSIBLE BECAUSE IT CREATES EXTREME ARREARS.**
