# WP-RV08-R4 — Exit / Regeneration Source-Level Audit

Date: 2026-08-20
Status: **PASS — SOURCE AUDIT**
Canonical mechanism changes: **0**

## Source facts verified before further intervention work

### 1. Exit trigger

`SupplyChainSystem.evaluateExits()` defines:

- severe payroll stress when wage arrears exceed `max(100, wage × workers × 1.35)`;
- severe credit stress when `creditMisses >= 5`;
- liquidity failure when `cash < safeCash × 0.025` and severe payroll stress is already present;
- distress rises by one month under liquidity failure or severe credit stress and otherwise decays by one;
- a firm exits at `distressMonths >= 4`.

Exit immediately sets the firm inactive, clears desired labor/production, detaches every employed household from that employer, and sets the firm's worker count to zero.

### 2. Exit does not perform estate disposition

The exit path does **not**:

- close the firm's settlement account;
- distribute or destroy residual cash;
- liquidate finished inventory;
- liquidate input inventory;
- dispose of fixed assets;
- settle wages payable;
- settle or novate loans;
- transfer productive assets to entrants;
- write down accounting inventory merely because the firm became inactive.

This is not itself proof that every one of those actions should occur. It is proof that `active=false` currently has no explicit balance-sheet estate / liquidation semantics.

### 3. Replacement is mechanically capped at two firms per country-month

After `evaluateExits`, the world executes replacement only for:

`exitIndustries.slice(0, 2)`.

Therefore a country-month with more than two exits creates an immediate net decline in the active-firm stock even if every created entrant later survives.

### 4. Replacement entrants begin with a zero operating asset base

Canonical entrant construction initializes:

- workers = 0;
- cash = 0;
- finished inventory = 0;
- input inventory = 0;
- capital stock = 0;
- capital book value = 0;
- loan balance = 0;

while desired workers are positive and `safeCash` is inherited as a positive target from the country firm-cash scale.

The entrant is therefore not a transfer of an exited firm's going-concern assets. It is a new zero-resource legal/economic entity.

### 5. Macro and accounting aggregates treat inactive firms asymmetrically

The core macro function computes physical inventory from **active firms only**, but firm cash from **all firms**, including inactive firms.

The accounting verifier and `inventoryBook` aggregate likewise iterate over **all firms**, active and inactive.

Consequences requiring measurement:

- inactive-firm cash can remain inside macro `firmCash` even though that cash no longer supports production or employment;
- inactive-firm book inventory can remain in national-account `inventoryBook` and therefore affect inventory investment/GDP even though the physical macro inventory measure excludes that firm;
- the productive-firm stock can shrink while monetary and accounting assets remain trapped in inactive entities.

## Claim ledger

### A — VERIFIED EXISTING FACT

The present exit boundary combines four distinct operations without an explicit estate transition:

1. distress-triggered legal/operating deactivation;
2. immediate destruction of employment relationships;
3. preservation of the old firm's settlement/accounting balances;
4. creation of at most two independent zero-resource replacement firms.

### B — DIAGNOSTIC LEAD

The very large no-exit upper-bound effect can therefore include multiple channels simultaneously:

- preservation of employer relationships;
- preservation of active productive capacity;
- avoidance of stranded firm cash/assets;
- avoidance of a hard replacement-count deficit;
- avoidance of forcing new firms to restart from zero operating assets.

These channels must be separated before designing exit semantics.

### C — HYPOTHESIS

A coherent repair may need a formal `firm estate / restructuring / successor` boundary rather than only changing the exit threshold. Possible future states include liquidation, restructuring/bridge survival, asset sale, successor entry, creditor loss allocation and worker re-matching. No one mechanism is admitted yet.

### D — PROPOSED CHANGE

None. R4-G measures replacement-count/input-bootstrap effects, and R4-H measures stranded inactive-firm assets/liabilities and exit-estate stock flows without changing the simulation.

## Verdict

**PASS — THE EXIT BOUNDARY CURRENTLY DESTROYS OPERATING RELATIONSHIPS WITHOUT A CORRESPONDING ESTATE/ASSET TRANSITION, WHILE REPLACEMENT IS CAPPED AT TWO AND STARTS FROM ZERO RESOURCES. THIS IS NOW A FIRST-CLASS CAUSAL DECOMPOSITION TARGET.**
