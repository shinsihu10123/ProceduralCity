# WP-RV08 R4-AH / R4-AI — Production-Informed Staffing Ramp and Distress-Clock Ablation

Date: 2026-08-22  
Status: EXECUTING  
Mode: ACTUAL DIAGNOSTIC EXECUTION / NO CANONICAL REPAIR

## 1. Dependency state

R4-AF/AG closed PASS with two decisive results:

- essentially all of the plan-viable CONSUMER workforce deficit is created at target formation, not labor-market matching;
- the physical workforce gap would generally require far longer than the four-month distress clock even at continuous +12% monthly staffing growth.

R4-Y/Z separately showed that immediately setting staffing to the physical production need is not financially admissible because employment/output improve while current-worker wage arrears explode.

The next dependency-safe question is therefore whether the collapse is driven mainly by the weak production-blind hiring signal, the short distress clock, or their interaction.

## 2. R4-AH — staffing-signal ablation

For plan-economically viable CONSUMER firms only, compare:

- `control`: canonical target unchanged;
- `max-ramp`: preserve canonical credit view, then force only the upward staffing signal toward physical need at the canonical +12% ceiling;
- `full-need`: reference condition that declares the full physical workforce need immediately.

`full-need` is a falsification/reference regime, not a proposed repair. Prior Y/Z evidence already indicates that it is likely to overproduce payroll obligations.

Primary hypotheses:

- H-AH1: the weak production-blind canonical hiring signal is a material cause of under-execution; `max-ramp` should improve staffing/output relative to control.
- H-AH2: replacing the weak signal with maximum ramp is sufficient to solve the macro problem without materially worsening payroll stress.

## 3. R4-AI — distress-clock ablation

Compare:

- `grace`: canonical staffing with a diagnostic 24-month distress threshold;
- `max-ramp-grace`: maximum production-informed staffing ramp plus the same diagnostic 24-month distress threshold.

The 24-month threshold is deliberately much longer than the canonical four-month window and is used only to test dynamic compatibility. It is not a calibrated or proposed production threshold.

Primary hypotheses:

- H-AI1: extending the distress clock alone materially improves employment/output even with the canonical weak hiring signal.
- H-AI2: the staffing signal and distress clock interact: allowing firms time to ramp toward production need produces materially different outcomes from either intervention alone.
- H-AI3: any apparent employment rescue that is purchased mainly through accelerating current-worker arrears is not a sufficient repair.

## 4. Isolation

The script preserves canonical credit's view of `desiredWorkers`: credit is originated first, then the diagnostic staffing target is changed before the labor market.

The intervention changes no:

- wage rate;
- labor matching probability/search logic;
- price rule;
- procurement budget;
- credit underwriting;
- payroll settlement rule;
- tax rule;
- household behavior;
- accounting rule.

Only two diagnostic dimensions are altered: the CONSUMER upward staffing target and, in grace regimes, the distress threshold.

## 5. Matrix

6 independent shards:

- seeds: original A / original C / held-out E;
- normalization: CONSUMER / MATERIALS+CONSUMER;
- horizon: 18 months;
- each shard executes five regimes: control, max-ramp, grace, max-ramp-grace, full-need.

Total: 30 primary simulations.

## 6. Required metrics and hard gates

For every regime:

- unemployment and terminal-six-month unemployment;
- total and linked/current-worker wage arrears;
- GDP and physical output;
- active firms and exits;
- canonical target / physical need;
- applied target / physical need;
- actual workers / physical need;
- actual workers / applied target.

Hard gates:

- health PASS;
- complete matrix coverage;
- productive normalization active;
- ledger integrity;
- general accounting integrity;
- GDP arithmetic identity;
- plan-viable CONSUMER observations present;
- finite summaries.

## 7. Interpretation rule

A regime is not considered a useful architecture lead merely because unemployment falls.

- output/employment improvement + large linked arrears increase => financially inadmissible;
- grace without staffing improvement => distress clock is secondary to target formation;
- max-ramp improvement with bounded arrears => staffing signal is a strong architecture lead;
- max-ramp-grace materially dominates both single interventions => transition/distress interaction is causally important;
- full-need again produces very large arrears => immediate physical-need hiring remains rejected.

No canonical repair merge is authorized by this execution document.
