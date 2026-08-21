# WP-RV08 R4-Y/Z — Runtime Recovery Record

Date: 2026-08-21
Status: EXECUTION RECOVERY / NO ECONOMIC VERDICT
Scope: Labor-demand coherence ablation only

## 1. Purpose

Preserve the distinction between an Economic Lab model failure and an execution-runtime failure while recovering the full R4-Y/Z experiment without changing its economic design.

## 2. Experiment preserved

R4-Y / R4-Z continue to test the same five labor-demand rules:

- control
- production
- settlement
- realized
- hybrid

Across:

- original seeds A/B/C;
- held-out seeds D/E/F;
- CONSUMER normalization;
- MATERIALS+CONSUMER normalization;
- R4-Y canonical exit, 24 months;
- R4-Z diagnostic restructuring, 36 months.

Total principal regimes remain 120.

No canonical production repair is merged by this recovery.

## 3. First execution architecture

Initial run: `32452759136`

The first workflow used 12 Actions jobs. Each job serialized ten principal regimes internally: two normalization bases × five labor-demand variants.

Configured timeout was 30 minutes per job.

Result: the jobs were cancelled at the configured wall-clock ceiling before the principal JSON artifacts were produced.

Classification: EXECUTION RUNTIME CONDITION, not economic-model failure.

## 4. First recovery attempt

Recovery run: `32455326123`

Changes:

- Y timeout: 30 → 120 minutes;
- Z timeout: 30 → 120 minutes;
- artifact retention: 30 → 90 days.

Repository evidence later showed the run itself completed with conclusion `cancelled` after approximately two hours. The economic process was still executing; the coarse 12-job architecture remained too serial because each job continued to execute ten principal regimes before writing its artifact.

No causal inference is taken from this cancellation.

## 5. Root execution diagnosis

The expensive unit was not one principal regime. The expensive unit was the original job bundle:

`1 seed × 2 bases × 5 variants`

Therefore raising the timeout only enlarged the wall-clock window without removing serialization.

The correct recovery is to preserve the economic experiment and change only the execution granularity.

## 6. Ultra-sharded recovery architecture

Workflow:

`.github/workflows/economic-lab-rv08-r4-yz-ultrashard.yml`

Launch commit:

`823aecc9b06ced8b6508253a322b8cc79cd9cd8a`

Run:

`32481366521`

The new mapping is:

`1 seed × 1 base × 1 labor variant = 1 independent Actions job`

Thus:

- R4-Y: 6 seeds × 2 bases × 5 variants = 60 jobs;
- R4-Z: 6 seeds × 2 bases × 5 variants = 60 jobs;
- total principal jobs = 120.

Each job patches only its temporary runner checkout so that the existing diagnostic script executes exactly one selected base and one selected variant. Repository source is not mutated by the runner.

Per-job limits:

- R4-Y: 45 minutes;
- R4-Z: 60 minutes;
- artifacts retained 90 days;
- artifact upload executes with `if: always()` so partial diagnostic material is not silently discarded when a job fails late.

## 7. Methodological status

Claim taxonomy:

- A VERIFIED EXISTING FACT: both coarse execution attempts exceeded their configured wall-clock limits.
- A VERIFIED EXISTING FACT: the coarse job serialized ten principal economic regimes.
- D PROPOSED/EXECUTED INFRASTRUCTURE CHANGE: one-regime-per-job ultra-sharding.
- Causal economic verdict: NOT YET ISSUED.

The intervention changes scheduling only. It does not change:

- initial conditions;
- seeds;
- economic horizon;
- labor-rule definitions;
- exit/restructuring semantics;
- accounting;
- credit;
- production normalization;
- supply mechanics.

## 8. Closure gate

R4-Y/Z may be causally synthesized only after principal regime artifacts exist and the following are checked:

- deterministic replay gate;
- health gate;
- accounting gate;
- ledger gate;
- GDP arithmetic gate;
- normalization activation;
- staffing observation;
- finite results;
- original vs held-out seed consistency;
- unemployment / arrears / output / exit trade-offs.

Until then, status remains `INCOMPLETE — EXECUTION IN PROGRESS`.
