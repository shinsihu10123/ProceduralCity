# Economic Ecosystem Structural Realism Audit Register

Date: 2026-08-22
Status: ACTIVE DIAGNOSTIC PROGRAM
Scope: Economic Lab v0.10 reality validation; no canonical repair authorized by this register.

## 1. Why this register exists

The economy is treated as a co-evolving system rather than a collection of independently tunable modules. A stable mature economy contains stocks, relationships, institutions, expectations and population structures that were created by prior history. If a simulation instantiates a mature-looking economy at month 0 without a coherent prehistory, one subsystem can begin from a stock while another begins from a zero flow/history, causing endogenous cascades that look like economic behavior but are initialization or ontology defects.

The investigation therefore expands from single-cause collapse diagnosis to **ecosystem structural coherence**.

## 2. Verified cold-start facts from current source

### Households / people
- Every country begins with a fixed list of `household` agents.
- Each household has one employment flag, one employer, one wage and one skill state, while the same object also owns household wealth, savings, consumption and debt.
- Initial employment is sampled, then relinked to firm job slots.
- Initial household income is zero even for agents marked employed; wage settlement begins only after the first production cycle.
- Initial household loan balance and credit misses are zero.
- Household beliefs start from the same baseline belief object before subsequent learning.
- Age, birth, death, student, retirement, labor-force participation and household-member structure are absent from the canonical object.

### Firms
- Firms are born at month 0 with positive workers, cash, finished-goods inventory and capital stock.
- Initial output, sales and revenue are zero.
- Input-using firms begin with zero input inventory.
- Initial loan balance and credit misses are zero.
- `previousSales` begins at the synthetic value 1 and `currentPlan` is null.
- Firm age/founding history, owners, durable supplier relationships, labor tenure and explicit contractual history are not represented in the base firm object.

### Institutions
- Each country receives one commercial bank during base-world initialization.
- Household and firm loan histories start empty.
- A government is created immediately and begins with an inherited public-debt stock created by the initialization mechanism.
- Monetary/financial v0.7 then creates one central bank and an asset-market system.
- International v0.8 creates FX/trade/international-position machinery immediately.
- Cognitive/information v0.9 initializes agent cognition and information networks after the economic agents already exist.
- v0.10 adds scale, experiments, health and runtime profiling.

These facts establish a diagnostic lead: the initial world is a **synthetic mature institutional stack with partially ahistorical stocks and zero/placeholder operating histories**.

## 3. Audit domains

The following domains are audited as an interacting system. Absence is not automatically a defect; it becomes a defect when the omitted state materially changes causal meaning, feasibility or stability.

| Domain | Core coherence question | Current evidence / status |
|---|---|---|
| Person–household ontology | Are people, families, earners and consumers represented at the correct unit? | Structural defect verified by AQ/AS/AT. |
| Demography / labor force | Can age, participation, retirement, entry/exit and population change be represented without treating nonparticipants as unemployed? | Structural defect verified; no canonical lifecycle yet. |
| Labor demand / production | Does requested staffing follow production need while remaining financially sustainable? | Major two-sided coherence defect strongly supported by AD–AN. |
| Payroll / claims | Are current wages, legacy arrears and employer provenance consistent? | Persistent payroll insolvency is major; cross-employer arrears provenance is secondary real defect. |
| Firm lifecycle | Do firms have age, founding capital, learning, entry maturation, restructuring and exit states that form a coherent lifecycle? | Entry/exit investigated; broader lifecycle/prehistory is open. |
| Firm ownership / household capital income | Who owns firms and receives profits/losses? Does enterprise wealth connect to household wealth? | Audit target; source-level ontology review required. |
| Supply relationships | Do suppliers/buyers form persistent relationships, contracts, buffers and reliability histories rather than re-forming a market from scratch? | Procurement mechanics diagnosed; relationship maturity is open. |
| Inventory / working capital | Are inventory stocks, input stocks, payment timing and operating cash historically compatible? | Timing is real amplifier; cold-start compatibility open. |
| Credit / banking | Do borrower histories, bank portfolios and credit relationships exist coherently at start? Is one-bank structure materially distorting? | Credit not sufficient repair; initial loan history is zero. Network/competition open. |
| Fiscal system | Are taxes/transfers tied to correct social states and realistic inherited tax bases/debt/service histories? | Nonparticipant/unemployment semantics verified defective; wider prehistory open. |
| Monetary system | Does policy start from observations/history consistent with inherited prices, debt, reserves and activity? | Policy stack appears immediately; historical-state coherence open. |
| Asset ownership / wealth | Are initial securities, ownership, wealth distribution and income streams mutually consistent? | Open systemic audit. |
| Capital formation | Is capital stock supported by vintages, depreciation and past investment rather than exogenous mature stock alone? | Positive opening capital verified; prehistory consistency open. |
| Prices / wages | Are relative prices, wages and sector productivity jointly feasible? | Major unit/value-product defects verified, especially RESOURCE/MATERIALS. |
| Market structure | Are firm counts, concentration, competition and product differentiation coherent with population/demand? | Population/firm scale tested; deeper industrial organization open. |
| International economy | Are bilateral trade, FX, external assets/debt and openness compatible with an inherited trade history? | International stack instant-initialized; maturity audit open. |
| Expectations / information | Do beliefs and causal models have realistic inherited heterogeneity/history at month 0? | Common starting beliefs / fresh cognition create cold-start lead. |
| Institutional plurality | Does one bank/one government/one central bank per country create unrealistic bottlenecks or perfect aggregation? | Verified topology fact; causal materiality open. |
| Accounting / statistical ontology | Do accounting identities map to economically meaningful quantities and official concepts? | Identity may pass despite meaning defects; unemployment definition defect verified. |
| Shock / adaptation timescales | Are hiring, distress, investment, debt service and policy response clocks mutually compatible? | Major mismatch verified: staffing convergence often slower than distress clock. |
| Replacement / reallocation | Are failed firms' assets, workers, claims and productive relationships reallocated rather than destroyed/frozen? | Inactive-estate and weak-entry problems verified; full ecology open. |
| Spatial / physical constraints | Do transport, geography, energy and resource constraints belong in this Economic Lab abstraction or in later world layer? | Scope decision pending; do not inject without evidence/architecture contract. |

## 4. Systemic failure classes

The expanded diagnosis distinguishes five failure classes:

1. **Ontology failure** — the simulated object is the wrong economic unit (for example household = one worker = one consumer).
2. **Stock–flow initialization failure** — inherited stocks exist without the flows/history that could have generated or supported them.
3. **Timescale failure** — subsystems adjust at mutually incompatible speeds, producing artificial cascades.
4. **Network / relationship failure** — mature economic functions are represented as repeated anonymous clearing without persistent relationships or histories where those relationships are causally necessary.
5. **Feedback topology failure** — individually plausible rules connect into an unstable positive-feedback loop with no realistic stabilizing pathway.

## 5. Active causal graph

Current evidence supports this broad chain:

`sector value-product infeasibility + synthetic initial state`
→ `production plan / financially supportable staffing / requested staffing mismatch`
→ `production execution failure`
→ `weak downstream material and investment demand`
→ `revenue and payroll shortfall`
→ `wage arrears + distress`
→ `firm exit / restructuring`
→ `labor displacement + demand loss + supplier demand loss`
→ `further revenue weakness`
→ `credit stress and fiscal transfers amplify/redistribute the shock`
→ `common collapse attractor`.

This graph is not yet complete. AU/AV/AW is explicitly designed to identify omitted cold-start and feedback edges before any repair architecture is selected.

## 6. Diagnostic program from this point

- **R4-AU — Initial-State Coherence Census:** stocks, zero flows, placeholder history, institutional counts, ontology fields, opening balance-sheet coverage.
- **R4-AV — Cold-Start Concentration Audit:** how much exit, credit creation, unemployment acceleration and distress occur in months 1–6 versus later periods.
- **R4-AW — Feedback Propagation Audit:** lagged associations among arrears, exits and unemployment, plus regime-crossing timing and real-activity windows.
- **R4-AX — Prehistory / Maturity Sensitivity:** only if AU–AW show material front-loaded discontinuity; create diagnostic prehistory conditions without calling them a repair.
- **R4-AY+ — Domain-specific structural probes:** ownership, capital vintages, bank plurality, supplier relationship maturity, fiscal social-state semantics, expectation inheritance, international maturity, chosen according to AU–AW evidence.

## 7. Repair gate

No demographic subsystem, prehistory generator, staffing rule, working-capital facility, bank plurality or other canonical repair may be merged merely because it sounds realistic. A candidate must:

- correspond to a demonstrated causal defect,
- preserve accounting and observer noninterference,
- improve real activity without hiding distress through contraction or debt substitution,
- replicate across original and held-out seeds,
- survive long-horizon validation,
- and later be calibrated/validated against authoritative empirical evidence separately from causal diagnosis.
