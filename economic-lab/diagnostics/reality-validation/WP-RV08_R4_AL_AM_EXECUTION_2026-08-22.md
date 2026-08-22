# WP-RV08 R4-AL / R4-AM Execution Contract

Date: 2026-08-22
Status at definition: READY FOR ACTIONS EXECUTION

## Why this is next

R4-AJ verified that payroll-before-consumer-revenue timing becomes material after production/labor/survival relief. R4-AK then showed that accounting-preserving short-term bridges provide only small, seed-sensitive relief and that broad exact-gap credit can transform wage arrears into persistent bank debt/default risk.

Therefore the next dependency-safe question is not “how much more credit?” It is whether observed payroll shortfalls are **transitory/self-liquidating** or **persistent/structural**, and whether a smoothed revenue-supported staffing zone exists between two previously rejected extremes:

- immediate physical-need staffing, which restored output/employment but exploded arrears;
- hard prior-realized affordability caps, which removed arrears by collapsing employment/output.

## R4-AL — Payroll Shortfall Persistence / Bridge Recoverability Cohorts

Observer-only classification of plan-viable CONSUMER firm-months that actually underpay current base payroll.

For each underpaid cohort start, follow the same firm through age 0–6 months and record:

- cash gap at payroll;
- later same-month own revenue;
- next-month cure;
- repeated underpayment over 3 months and age 6;
- cumulative realized operating contribution versus cumulative base payroll;
- exit by age 6;
- prior-sales-backed and current-inventory-backed self-liquidation upper bounds.

Primary causal split:

1. transitory/self-liquidating timing gap;
2. recurrent bridge-dependent gap;
3. persistent structural operating deficit;
4. exit before recovery.

### Hypotheses

- H-AL1: a large majority of ramp-grace underpayment is one-month and self-liquidating. If supported, a narrow finite working-capital institution remains plausible.
- H-AL2: most shortfalls recur or cumulative contribution remains below payroll over 3–6 months. If supported, credit cure is rejected and operating/labor commitment architecture remains the root frontier.
- H-AL3: ex-ante prior-sales/inventory backing identifies a substantial self-liquidating subset. If supported, later repair may use strict eligibility rather than universal gap finance.

## R4-AM — Revenue-Supported Staffing Envelope Audit

Observer-only. No staffing target is changed.

For each plan-viable CONSUMER firm-month with three consecutive prior observations, estimate:

- current workers / physical-need workers;
- rolling three-month mean realized-contribution-supported workers;
- rolling three-month minimum-contribution-supported workers;
- share where rolling support sustains current employment;
- share where rolling support supports full physical need;
- share with a non-empty interior expansion zone (`current < supported < physical need`);
- fraction of the physical staffing gap that could be filled inside that historical-revenue envelope.

### Hypotheses

- H-AM1: a broad interior expansion zone exists. This would support a future production-informed but financially smoothed staffing architecture.
- H-AM2: rolling support usually remains below current employment. This would show that smoothing alone cannot repair the economy and operating economics must be changed first.
- H-AM3: rolling support usually reaches physical need. This would imply timing/transition rather than durable operating feasibility is the dominant remaining labor constraint.

## Isolation and noninterference

R4-AL/AM do **not** apply:

- bridge credit;
- new cash;
- wage changes;
- tax changes;
- debt relief/write-off;
- settlement changes;
- staffing-envelope decisions.

The pre-existing `ramp-grace` state is retained only as a conditional diagnostic environment and is compared with canonical state.

Observer noninterference is a hard gate: each shard runs a plain and observed short control from identical seed/base/state and requires an exact economic fingerprint match before the 24-month audit is accepted.

## Width

Matrix:

- state: `canonical`, `ramp-grace`
- seed: original A, original C, held-out E, held-out F
- normalization: `consumer`, `materials-consumer`

Total: **16 independent shards**, one 24-month primary simulation per shard plus a 6-month plain/observed fingerprint check.

## Hard gates

- exact observer noninterference fingerprint;
- health PASS;
- complete 16-shard coverage;
- normalization activation;
- settlement-ledger verification;
- general-accounting verification;
- GDP arithmetic identity;
- payroll cohort observations present;
- staffing-envelope observations present;
- finite rows.

Economic sufficiency is not a workflow hard gate.

## Interpretation gate

Do not authorize canonical repair from R4-AL/AM alone.

- If transitory/self-liquidating cohorts dominate and strict backing predicts them, proceed to a narrow finite-cure financing institution test.
- If recurrent/structural cohorts dominate, stop bridge expansion and design the next diagnostic around durable payroll commitments, production realization, and firm-level operating viability.
- If a broad interior staffing envelope exists, test that architecture as a bounded diagnostic intervention only after AL closure.
