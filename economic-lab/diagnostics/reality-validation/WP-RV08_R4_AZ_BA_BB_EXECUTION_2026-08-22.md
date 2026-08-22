# WP-RV08 R4-AZ / R4-BA / R4-BB — Economic Ecosystem Structural Dynamics Audit

Date: 2026-08-22
Mode: **ACTUAL EXECUTION / DIAGNOSTIC-ONLY / NO CANONICAL REPAIR**

## Why this batch exists

R4-AU–AY showed that the economy is not failing from one scalar parameter. The model begins with mature-looking capital, inventories and institutions but almost no inherited private credit, supplier history, portfolio ownership or cognitive history; simple input buffers and startup grace alter the transient path but do not create a stable basin.

The next dependency-safe frontier is therefore to test three ecosystem-level failure classes in parallel:

1. **R4-AZ — Behavioral Synchronization / Diversity Audit**
   - Are firms or households collapsing into excessively synchronized decisions?
   - Does cross-sectional diversity in beliefs, risk tolerance and optimism survive the macro downturn?
   - Are modal actions becoming concentrated as unemployment and arrears accelerate?

2. **R4-BA — Historical-Age / Maturity Mismatch Audit**
   - Which mature stocks exist at month 0 without the relationship/history stocks that would normally have produced them?
   - How fast do private credit, supplier pairs, ownership and cognitive histories form relative to the collapse clock?

3. **R4-BB — Timescale Compatibility Audit**
   - Are planning, hiring, credit, unemployment, distress and bankruptcy clocks mutually compatible?
   - How long does a plan-viable CONSUMER firm need to reach physical staffing at the canonical maximum ramp versus the four-month distress threshold?
   - How long do arrears-to-exit, distress-to-exit, unemployment spells and loan outcomes actually take?

## Matrix

- Seeds: original A, original C, held-out E, held-out F
- Bases:
  - `raw`
  - `materials-consumer` diagnostic normalization
- Horizon: **36 months**
- Shards: **8 independent jobs**

The MATERIALS+CONSUMER base remains a diagnostic normalization inherited from earlier causal work. It is not a production calibration or authorized repair.

## Measurements

### R4-AZ

Per country-month:
- firm action modal share and normalized entropy;
- CONSUMER action modal share and entropy;
- household action modal share and entropy;
- action-run durations;
- cross-sectional standard deviation of demand/unemployment beliefs;
- risk-aversion and optimism dispersion;
- correlation of modal firm-action concentration with changes in unemployment and arrears.

### R4-BA

Month-0 inherited stocks:
- productive capital;
- finished inventories;
- input inventories;
- government debt;
- bank securities;
- active private loans;
- public-share ownership;
- household portfolio ownership;
- cognitive episodes;
- international trade records;
- supplier-pair history.

Maturity checkpoints at months 1, 3, 6, 12, 24, 36:
- active private loans;
- public-share ratio;
- household portfolio-owner share;
- cognitive episode depth;
- unique B2B pairs and transaction counts;
- international trade history.

### R4-BB

- four-month canonical distress threshold;
- cognitive planning horizons by agent type;
- plan-viable CONSUMER target/physical staffing gap;
- theoretical catch-up time at +12% monthly staffing ramp;
- share requiring >4m and >8m to close;
- first-arrears to exit duration;
- first-distress to exit duration;
- unemployment-spell duration;
- loan contractual terms and realized repayment/default durations;
- firm/household action persistence durations.

## Hard gates

Every shard must preserve:
- settlement-ledger consistency;
- general-ledger accounting consistency;
- GDP arithmetic identity;
- complete 36-month coverage;
- diagnostic normalization activation where requested.

The audit reads runtime state only. It does not change agent choices, labor eligibility, bankruptcy, credit, prices, wages, production, taxation, ownership or settlement.

## Hypotheses

### R4-AZ
- **H-AZ1:** macro collapse is accompanied by strong cross-sectional behavioral synchronization.
- **H-AZ2:** agent heterogeneity remains substantial, so synchronized behavior is not a primary collapse mechanism.

### R4-BA
- **H-BA1:** mature stocks materially precede the relationship/history structures that normally support them.
- **H-BA2:** those relationship structures mature before the main collapse window, weakening historical-age mismatch as a primary mechanism.

### R4-BB
- **H-BB1:** major adaptive clocks are dynamically incompatible, especially staffing recovery versus distress/exit.
- **H-BB2:** realized unemployment and debt-resolution durations are long enough that four-month firm distress amplifies otherwise recoverable states.
- **H-BB3:** timescale mismatch is secondary only; operating infeasibility remains dominant even when adaptation windows are longer.

## Interpretation discipline

This batch is diagnostic. A high synchronization score does not authorize adding noise. An age mismatch does not authorize synthetic prehistory. A timescale mismatch does not authorize arbitrary grace periods. Any intervention must follow causal closure and retain accounting/behavioral integrity.
