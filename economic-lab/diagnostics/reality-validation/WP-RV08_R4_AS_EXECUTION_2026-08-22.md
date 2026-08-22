# WP-RV08 R4-AS Execution — Household / Person Labor-Unit Ontology Audit

Date: 2026-08-22
Mode: diagnostic-only; no canonical demographic or labor repair.

## Question

Does the simulation use `household` as a coherent economic unit, or does the same object simultaneously behave as an individual worker and as a multi-person household? If the latter, how much of the labor-feasibility problem can be traced to an undefined worker-slots-per-household ontology?

## Audit

R4-AS runs original A/C and held-out E/F under CONSUMER and MATERIALS+CONSUMER diagnostic bases for 24 months.

It verifies:

- household count and household IDs remain fixed,
- presence/absence of demographic fields such as age, household size, members, children, student, retirement and labor-force participation,
- presence of person-level labor fields (`employed`, `employerId`, `wage`, `reservationWage`, `skill`),
- simultaneous presence of household-level wealth/consumption/accounting fields,
- one scalar employer and one scalar employment state per household-agent,
- economically viable and full physical labor slots required per household-agent,
- semantic sensitivity at 0.5, 0.75, 1, 1.25, 1.5 and 2 worker slots per household-agent.

Worker-slot capacities are **not** demographic calibration and do not change economic state. They only expose which population ontology would be required for the current production system to be feasible.

## Interpretation gates

- If physical production requires near 2 worker slots per household-agent while each agent supports only one employment relation, a population-unit/technology-scale contradiction is present.
- If viable production also requires >1 slot per household-agent in many cases, demographic realism will tighten rather than solve the collapse.
- If one slot is enough for viable need but not physical need, then the main defect remains production-plan/labor-target coherence rather than absolute population scarcity.
- No age shares, birth/death rates, retirement age or empirical participation rates are authorized until the household/person ontology is resolved.

## Hard gates

Health, ledger, general accounting, GDP arithmetic, coverage, normalization, fixed household count/IDs, schema audit and finite outputs must pass.

Workflow: `.github/workflows/economic-lab-rv08-r4-as-household-person-ontology.yml`
Script: `economic-lab/scripts/rv08-household-person-labor-unit-ontology-audit-v10.mjs`
