# World Realism Structural Gap Register — Demography / Labor Force

Date: 2026-08-22
Status: VERIFIED STRUCTURAL GAP / NOT YET A REPAIR SPECIFICATION

## Verified source facts

1. `economic-lab/src/core/world.js::makeHousehold` creates household agents with employment, wage, wealth, skill, beliefs, and finance fields, but no age, birth date, death state, retirement state, student/child state, or labor-force participation state.
2. `macroFrom()` computes unemployment as `1 - employed / households.length`.
3. `economic-lab/src/markets/labor-market.js` constructs the unemployment/applicant pool from every household with `!h.employed`; there is no working-age or participation filter.
4. `EconomicWorld.createCountry()` creates the household array once at initialization. There is a firm entrant path (`createEntrant`) but no corresponding household birth/entry lifecycle in the current economic world source.
5. The scale-profile layer changes household and firm counts multiplicatively; it does not introduce age structure or demographic transitions.

## Semantic consequence

The current `household` object simultaneously acts as:

- a consumer unit,
- a bank-deposit owner,
- a single potential worker,
- and the denominator unit for unemployment.

That abstraction can be computationally useful, but it is not equivalent to a real population unless the intended semantics are explicitly "one labor-force-capable economic household agent". The current code does not state or enforce that narrower interpretation.

If the model intends to represent people/population, the current unemployment measure is structurally non-comparable to official unemployment concepts because children, retirees, and other nonparticipants are not represented as out-of-labor-force states; instead every non-employed household is counted as unemployed.

## Population dynamics gap

No canonical mechanism currently represents:

- aging,
- births,
- deaths,
- retirement,
- school-age entry into working age,
- labor-force entry/exit,
- demographic migration.

Therefore the household population is effectively exogenous/static in the current Economic Lab world. Long-horizon realism claims involving unemployment, dependency ratios, aging, population growth, or labor-force participation must remain blocked until this is addressed or the agent semantics are explicitly narrowed.

## Why this is separate from R4-AP

R4-AP asks whether the **existing household-agent count** is numerically sufficient for the existing production system. It cannot answer whether the population/labor-force representation itself is realistic.

The next diagnostic R4-AQ therefore checks runtime population invariance, confirms the unemployment denominator identity, and reports unemployment-denominator sensitivity without altering economic state.

## Claim classification

- Absence of age/participation/lifecycle fields: VERIFIED EXISTING FACT
- Current unemployment denominator = all households: VERIFIED EXISTING FACT
- Household population static under current world execution: SOURCE-LEVEL VERIFIED LEAD; R4-AQ runtime confirmation pending
- Demographic omission materially affects empirical unemployment comparability: STRUCTURAL REALISM DEFECT
- Specific demographic repair/calibration: NOT PROPOSED HERE
