# Demography / Labor Structural Realism Register

Date: 2026-08-22
Status: OPEN — structural diagnosis track parallel to economic-collapse diagnosis.

## Verified current-model facts

1. `household` has one `employed` boolean, one scalar `employerId`, one wage, one reservation wage and one skill.
2. The same object owns wealth, a deposit account, consumption, savings and household credit variables.
3. Current macro unemployment is calculated from employed household-agents divided by all household-agents.
4. Labor-market applicants are all household-agents with `employed === false`.
5. Automatic unemployment transfers are paid to all household-agents with `employed === false`.
6. No canonical age, birth, death, household-size/member list, child/student, retirement or labor-force-participation state has been observed.
7. R4-AQ verified that household count and IDs remain fixed over the audited horizon.
8. R4-AR showed that full physical production labor need is about two worker slots per household-agent even under 100% labor eligibility, while canonical desired jobs are far below that requirement.

## Structural defects / open questions

### D-01 Household-person ontology ambiguity — CRITICAL
The same agent behaves as both a single worker and a household balance-sheet/consumption unit. It is therefore unsafe to label the current household count as either persons or real households.

### D-02 Labor-force definition missing — CRITICAL
There is no working-age eligibility or labor-force participation state. Every nonemployed household-agent is a job seeker.

### D-03 Unemployment measurement denominator — CRITICAL
The current statistic is a nonemployment ratio over all household-agents, not an empirically standard unemployment rate over the labor force.

### D-04 Nonparticipant transfer semantics — HIGH
Because all nonemployed agents receive unemployment transfers, adding children, students, retirees or other nonparticipants without a separate status would misclassify them as unemployed benefit recipients.

### D-05 Population dynamics absent — HIGH
Birth, death, aging, retirement, labor-force entry/exit and migration are not represented in the current audited state.

### D-06 Worker slots per household undefined — CRITICAL
A household-agent can hold only one employer relation, but R4-AR indicates the production system often implies labor requirements approaching or exceeding two worker slots per current household-agent.

### D-07 Demographic calibration blocked by ontology — GATE
Empirical age shares or participation rates must not be inserted until the person-vs-household unit is resolved. Otherwise calibration would tune numbers on top of an undefined population unit.

## Current diagnostic order

R4-AQ: demographic field and fixed-population audit — closed.
R4-AR: labor-force feasibility sensitivity — closed.
R4-AS: household/person labor-unit ontology audit — executing.

After R4-AS, choose between:

- a person-level demographic architecture with explicit household membership, or
- a household-level economic architecture with multiple person/member and worker slots.

That choice is architectural and is **not authorized by this register alone**.