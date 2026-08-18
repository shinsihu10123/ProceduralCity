# Economic Lab — Reality Validation / Structural Diagnosis Handoff

Date: 2026-08-18
Project: Economic Lab — Four-Country Deep Cognitive Agent Economy
Repository: `shinsihu10123/ProceduralCity`
Working branch: `scratch/new-project-2026-08-12`
Project directory: `economic-lab/`

## 0. Purpose of this handoff

This document is the continuity anchor for moving Economic Lab development into a fresh conversation/work session.

The previous development sequence (v0.1 → v0.10) is complete at repository level. The next work is **not** to append another feature version by default. The immediate objective is to determine whether the economy that already runs is economically credible, why the current baseline generates extreme macro outcomes, and which mechanisms require structural repair.

The next work session must therefore begin with **Economic Reality Validation / Structural Diagnosis**, not arbitrary parameter tuning and not feature expansion.

---

## 1. Authority and recovery order

Before planning or modifying code, inspect the live repository and recover the current state from these sources, in this order:

1. `economic-lab/HANDOFF_ECONOMIC_REALITY_VALIDATION_2026-08-18.md` — this handoff
2. `economic-lab/V0.10_CLOSEOUT.md` — re-audited v0.10 implementation/evidence closeout
3. `economic-lab/MILESTONE_HISTORY.md` — repository milestone sequence v0.1 → v0.10
4. `economic-lab/README.md` — current model architecture and principles
5. live code under `economic-lab/src/`, `economic-lab/scripts/`, `.github/workflows/`
6. current GitHub branch HEAD / Actions status / performance artifacts

Do not trust a remembered branch SHA or past CI state without checking GitHub again.

### Frozen implementation audit anchor

The v0.10 economic implementation audit anchor is:

`698d10749e2897d711e5bcee61913ac34e0650a0`

Audited GitHub Actions run:

`32116473524` — SUCCESS

Evidence artifact:

`economic-lab-v10-performance`

Artifact ID:

`9317033398`

The branch may contain later documentation-only commits. The audit anchor above is the current frozen economic implementation reference unless the new session verifies a later code-changing commit and explicitly establishes a new baseline.

---

## 2. Implemented sequence — v0.1 to v0.10

### v0.1 — Four-country agent economy

- four economies: AST / BRN / CYR / DRN
- heterogeneous households and firms
- deterministic seed-based initialization
- macro statistics derived from micro states

### v0.2 — Transaction foundation

- actual wage settlement
- actual household purchases
- labor and goods markets
- settlement ledger
- no arbitrary wealth/revenue creation from consumption bookkeeping

### v0.3 — Accounting layer

- General Ledger separated from Settlement Ledger
- household/firm balance sheets and income statements
- inventory / receivable / payable / equity accounting
- `Assets = Liabilities + Equity` checks
- GL cash ↔ Settlement cash reconciliation

### v0.4 — Banking / credit economy

- bank agents
- deposits and loans
- credit assessment AI
- loan contracts, rates, repayment, delinquency and default
- endogenous deposit-money creation/destruction through lending/repayment
- bank balance-sheet reconciliation

### v0.5 — Industry / supply chain

- RESOURCE → MATERIALS → CAPITAL / CONSUMER production chains
- B2B procurement
- intermediate-input inventories
- capital-goods investment
- supply shortages
- firm entry/exit
- GDP expenditure accounting avoiding intermediate-goods double counting

### v0.6 — Government / fiscal system

- government agents
- income / consumption / corporate taxes
- automatic transfers
- government consumption
- public investment
- government deposits
- government bonds / public debt / interest / redemption
- fiscal accounting and bank-securities reconciliation

### v0.7 — Central bank / financial markets

- central bank agents
- policy-rate decisions
- reserves
- open-market operations and central-bank lending
- monetary transmission into credit
- equity issuance and secondary equity market
- household portfolios and equity accounting

### v0.8 — International economy

- four currencies and exchange rates
- imports / exports
- tariffs
- international supply chains
- external settlement positions
- foreign lending / borrowing
- current account / NFA / external stress
- open-economy GDP identity
- world-level external accounting checks

### v0.9 — Deep Cognitive Economy

Agent decision architecture was deepened from score-only decisions into persistent cognition:

`limited observation → beliefs / uncertainty → social information → regime inference → episodic analogies → competing hypotheses → learned causal graph → internal world model → counterfactual planning → intent → real markets / settlement / accounting → realized outcome → forecast error / reward / hypothesis scoring → learning`

Implemented concepts include:

- long-term episodic memory
- belief posterior with uncertainty
- hypothesis competition and learned reliability
- causal coefficients learned from experience
- probabilistic economic-regime inference
- L0–L4 attention / reasoning depth
- counterfactual scenario planning
- forecast calibration and world-model updating
- social learning / herding / information cascades
- objective economy kept separate from agent belief

### v0.10 — Scale / experiments / long-run / performance hardening

- `baseline / x2 / x5 / x10` scale profiles
- x10 = 21,100 households + 1,700 firms; 22,812 cognitive agents including institutions
- deterministic same-seed control/treatment experiments
- deterministic paired multi-seed ensembles
- 48-month long-run health gate
- 24-month emergence ensemble
- multi-shock stress matrix
- runtime profiling / Node CPU sampling
- retained-state census
- indexed/ring-buffer settlement ledger
- `compact-v2` historical decision records with full current reasoning retained
- episodic analogy semantic-equivalence oracle and per-agent ranking cache
- structured GitHub Actions performance evidence

Repository-level v0.10 closeout is CLOSED.

---

## 3. Current model principles that must not be broken

1. **Macro variables are outcomes.** GDP, CPI, unemployment, money, debt, prices, exchange rates, etc. must not be directly edited merely to make outputs look realistic.
2. **Agent belief ≠ objective reality.** Incorrect expectations must remain possible.
3. **AI creates intent, not final outcomes.** Markets, matching, contracts, settlement and accounting determine realized outcomes.
4. **Accounting is not optional.** Money, debt, inventory, securities and external positions cannot change outside modeled accounting mechanisms.
5. **Same Seed must reproduce the same world path** unless an explicit treatment/intervention differs.
6. **Do not tune to a desired chart.** Diagnose mechanisms before changing parameters or equations.
7. **One structural change at a time where possible.** Re-run identical Seed sets after each repair.
8. **Calibration and validation must eventually be separated.** Do not use the same evidence both to fit and to claim out-of-sample validity.

---

## 4. Why a new phase is necessary

The simulator now works technically, but current baseline macro outcomes show serious economic-reality concerns.

Previous emergence/diagnostic observations from the current v0.10 line include approximately:

- unemployment commonly reaching roughly 58–70% across countries/seeds;
- many recession months in a 24-month window;
- roughly 109–111 firm exits per seed in some observed runs;
- extremely high GDP-growth volatility in some countries/seeds;
- at least some GDP drawdown diagnostics exceeding 1, requiring accounting/statistical audit;
- `creditStressMonths` often remaining 0 even when the real economy is severely distressed.

These are **diagnostic leads, not immutable facts**. The new session must first reproduce them from the current baseline before using them as causal evidence.

The main suspected structural questions are:

- Is there a high-unemployment attractor?
- Does weak demand → layoffs → income loss → consumption loss form an overly strong positive feedback loop?
- Is labor-market rehiring too slow or vacancy matching too restrictive?
- Are firm exit rules too sensitive to temporary liquidity/revenue stress?
- Are inventory valuation / inventory change / GDP accounting amplifying measured volatility?
- Is the financial accelerator too weak despite severe real-economy distress?
- Are default, bank-loss and credit-tightening channels insufficiently connected?

No answer is assumed in advance.

---

## 5. Immediate next phase

Working name:

**Economic Reality Validation & Structural Diagnosis**

The new session should first design, then execute, a rigorous diagnostic program.

### Phase A — Repository recovery and baseline freeze

Verify:

- current branch HEAD
- current v0.10 code state
- current GitHub Actions status
- current test gates
- current scale profiles
- current performance artifact availability
- whether any code changed after audit anchor `698d107...`

Establish an explicit baseline SHA for the diagnostic program.

Do not modify economic mechanisms until the baseline is frozen.

### Phase B — Baseline reproduction

Construct a reproducible baseline experiment suite, initially targeting something like:

- 8–12 independent Seeds
- 120 simulated months where computationally feasible
- baseline-scale or another explicitly justified profile for causal diagnosis
- identical measurement schema across Seeds and countries

Record at least:

- GDP and components
- real output
- CPI / inflation
- unemployment
- employment transitions
- wages
- consumption
- private investment
- government demand / fiscal balance / debt
- firm births / exits
- firm sales / cash / debt / inventory / arrears
- vacancies / hires / layoffs / unfilled vacancies
- credit applications / approvals / rejection / new lending
- delinquency / defaults / charge-offs
- bank capital / liquidity / credit stress
- policy rate
- trade / exchange rate / current account / external stress

Do not choose a desired “normal” outcome before observing the baseline distribution.

### Phase C — Instrumentation for causal diagnosis

Add diagnostic instrumentation only where required. Prioritize measurements such as:

#### Labor

- job destruction rate
- job finding rate
- vacancy rate
- vacancy fill rate
- worker search success
- reservation-wage rejection
- hiring-capacity constraint
- layoffs by cause
- unemployment duration

#### Firms

- exit cause attribution
- cash-flow stress
- operating margin
- interest burden
- wage burden
- inventory pressure
- input shortage
- credit rejection
- demand shortfall
- distress duration before exit

#### Households

- disposable income
- MPC / consumption share
- precautionary saving response
- unemployment-induced income loss
- debt service

#### Finance

- delinquency transition
- default probability / realized default
- bank loss
- capital-ratio change
- credit-standard change
- approval-rate response to distress
- lending contraction following losses

#### Macro/accounting

- exact GDP contribution by `C + I_private + I_public + G + ΔInventory + NX`
- nominal vs real decomposition
- inventory valuation contribution
- sectoral value added where available
- money / debt / external balance reconciliation

### Phase D — Causal decomposition

The first high-priority diagnosis is the extreme unemployment path.

Build evidence for or against chains such as:

`demand weakness → sales decline → production cuts → layoffs → household income loss → consumption decline → further demand weakness`

and alternatives such as:

- matching frictions
- vacancy creation failure
- wage/reservation-wage mismatch
- liquidity-constrained firms
- supply-chain constraints
- credit constraints
- firm exits

Use event timelines, cross-Seed comparison, matched counterfactuals where possible, and direct mechanism statistics.

### Phase E — GDP / national-accounting audit

Audit whether extreme GDP volatility comes from genuine production/absorption dynamics or from measurement/accounting defects.

Explicitly inspect:

- inventory changes
- imported final/capital goods treatment
- exports/imports conversion
- negative or pathological expenditure components
- nominal/real mixing
- value-added consistency

Do not “smooth GDP” before identifying the source.

### Phase F — Financial-transmission audit

Explain why severe real distress can coexist with weak `creditStress` readings.

Trace:

`firm revenue/cash deterioration → missed debt service → delinquency/default → bank loss → capital/liquidity pressure → credit standards/approval → new lending → investment/employment`

Identify the first weak or broken link using evidence.

### Phase G — Structural repair

Only after diagnosis:

1. propose the smallest structural repair;
2. state the evidence supporting it;
3. modify one mechanism or tightly coupled mechanism set;
4. re-run the identical Seed panel;
5. compare distributions, not one lucky run;
6. run all accounting/regression gates;
7. reject a repair if it merely improves a headline metric while breaking another mechanism.

### Phase H — Calibration and out-of-sample validation

After structural defects are removed:

- identify empirical stylized facts and external datasets;
- separate calibration targets from validation targets;
- calibrate only the allowed parameter subset;
- validate against held-out moments / periods / economies where feasible;
- document uncertainty rather than forcing exact matches.

Candidate stylized facts include:

- unemployment distribution and persistence
- job finding / separation rates
- Beveridge-curve behavior
- Okun-type relationships
- inflation persistence
- consumption and investment volatility
- firm survival / exit patterns
- firm-size distribution
- credit/GDP and default behavior
- credit procyclicality
- policy transmission
- trade/exchange-rate response
- cross-country synchronization

---

## 6. Anti-tuning / anti-overfitting contract

The new session must follow these rules:

- Never change a parameter simply because “unemployment is too high”.
- Never force GDP/inflation/unemployment into a target band by direct clamping unless that clamp represents an explicit real-world institutional or physical constraint and is justified independently.
- Never weaken accounting tests to make a repair pass.
- Never interpret one Seed as model validation.
- Never change many unrelated mechanisms in one patch unless a dependency requires it.
- Always keep control/baseline results for comparison.
- Every repair needs a causal hypothesis and a falsifiable expected effect.
- If a hypothesis is contradicted by instrumentation, reject it and preserve the evidence.

---

## 7. Required first response in the new session

The new conversation should **not immediately start editing economic mechanisms**.

Its first substantial response should:

1. inspect GitHub and recover exact repository/branch/HEAD/CI state;
2. read the handoff, closeout, milestone history and README;
3. verify whether the diagnostic leads above reproduce from current code/evidence;
4. produce an execution plan for Economic Reality Validation / Structural Diagnosis;
5. break the plan into dependency-safe work packages;
6. define for each work package:
   - purpose
   - required instrumentation
   - experiment design
   - output/evidence
   - PASS / FAIL / BLOCKED criteria
   - dependencies
7. distinguish clearly between:
   - existing evidence,
   - hypotheses,
   - new measurements required,
   - proposed structural changes;
8. identify the first work package that can be executed without changing model semantics.

After presenting that plan, proceed with the first dependency-safe diagnostic work package when instructed by the user.

---

## 8. Expected work style

- execute against live GitHub evidence, not memory;
- prefer measurement over intuition;
- preserve v0.10 as a reproducible baseline;
- make small auditable commits;
- run relevant CI after meaningful changes;
- keep diagnostic artifacts/results in the repository so later conversations can recover them;
- if a run takes too long, reduce the experiment scope explicitly and document the reduction rather than silently changing methodology;
- report `PASS / PARTIAL / BLOCKED / FAIL` explicitly where useful;
- do not claim economic realism before empirical validation supports it.

---

## 9. Current handoff state

At handoff time:

- steps v0.1–v0.10 are repository-level complete;
- v0.10 is the frozen baseline generation to diagnose;
- no official v0.11 feature scope has been defined;
- the next work is a validation/diagnosis program, not automatic feature expansion;
- the highest-priority observed anomaly is persistent extreme unemployment, followed by firm exits/GDP volatility and weak financial-stress transmission.

End of handoff.
