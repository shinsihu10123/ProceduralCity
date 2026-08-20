# WP-RV08-R4 External Evidence Map

Date: 2026-08-20
Status: **REFERENCE DOSSIER — NOT CALIBRATION**

This document is intentionally separate from internal simulation evidence. It records authoritative external evidence relevant to the mechanism boundaries currently under diagnosis. It does **not** choose simulation coefficients, assert empirical validity of the model, or authorize canonical changes.

## 1. Working capital and employment

### IMF Working Paper 2017/189

Mai Dao & Lucy Qian Liu, *Finance and Employment in Developing Countries: The Working Capital Channel*.

IMF publication page:
https://www.imf.org/en/publications/wp/issues/2017/08/15/finance-and-employment-in-developing-countries-the-working-capital-channel-45068

PDF:
https://www.imf.org/en/-/media/files/publications/wp/2017/wp17189.pdf

External finding relevant to model design:

- firms require operating liquidity / working capital to support payroll and other operating expenses;
- external financing constraints can therefore affect employment through a working-capital channel even holding fixed capital constant;
- the paper reports a stronger finance-employment relationship for smaller and more labor-intensive firms.

### Design implication for the simulation

The internal distinction already made between `operating viability` and `cash/payroll liquidity` is economically meaningful. A firm can possess productive technology and demand while still being unable to support current payroll if operating liquidity is unavailable. However, this does **not** imply that every liquidity-stressed firm should receive credit or that credit alone should determine labor demand.

## 2. Young-firm survival and post-entry dynamics

### OECD — Cross-country evidence on start-up dynamics

Flavio Calvino, Chiara Criscuolo, Carlo Menon (2015), OECD STI Working Paper 2015/06.

Publication page:
https://www.oecd.org/en/publications/cross-country-evidence-on-start-up-dynamics_5jrxtkb9mxtb-en.html

DOI:
https://doi.org/10.1787/5jrxtkb9mxtb-en

External findings relevant to model design:

- aggregate start-up job contribution decomposes into entry rate, size at entry, survival and growth of survivors;
- cross-country survival is roughly just above 60% after three years, around 50% after five years and a little above 40% after seven years in the reported DynEmp sample;
- exit probability is generally highest early in the life cycle;
- a small share of surviving young firms contributes disproportionately to job creation.

### Design implication for the simulation

The current replacement-entrant boundary should not target `zero exit` as an empirical objective. R2/R3 bank-upper zero re-exit is only an upper-bound diagnostic. A production design needs explicit post-entry survival/growth dynamics and should eventually validate entrant cohorts over a much longer horizon than 12 or 24 simulation months.

## 3. Startup finance should not be reduced to ordinary bank debt

### OECD — Financing SMEs and Entrepreneurs 2026, Venture Capital chapter

Publication page:
https://www.oecd.org/en/publications/financing-smes-and-entrepreneurs-2026_075d8058-en/full-report/leveraging-venture-capital-for-smes_484042d0.html

External finding relevant to model design:

- alternative finance is important in the startup/SME financing mix;
- venture/equity finance is particularly relevant for innovative startups whose assets are difficult to collateralize and whose growth needs may be poorly suited to traditional bank financing;
- information asymmetry and valuation problems create allocation frictions even in equity markets.

### Design implication for the simulation

R2's result — commercial-bank underwriting rejects replacement entrants even after several hard constraints are relaxed — should not be repaired by simply deleting bank risk logic. A separate startup-capital institution, equity channel, guarantee/risk-sharing balance sheet, or retained-owner-capital path is structurally more defensible. Exact mechanism choice remains open.

## 4. Viable-but-financially-strained firms are a distinct policy/finance category

### OECD — Korea, Financing SMEs and Entrepreneurs 2026

Country chapter:
https://www.oecd.org/en/publications/financing-smes-and-entrepreneurs-2026_075d8058-en/full-report/korea_6d71f5bd.html

External evidence relevant to model design:

- Korea has used maturity extensions, repayment deferrals, debt adjustment, targeted guarantees and refinancing mechanisms;
- the OECD chapter explicitly discusses support for viable but financially strained firms;
- short-term operating loans remain a large part of business finance, while SME credit quality and payment delay are separately observed.

### Design implication for the simulation

The simulation should distinguish at least:

1. operating-viable + liquid;
2. operating-viable + temporarily liquidity-stressed;
3. operating-unviable but liquid due to legacy cash/credit;
4. operating-unviable + insolvent/distressed.

Exit should not be inferred from a single liquidity state, while prolonged inability to cover obligations must still be able to generate genuine exit.

## 5. Credit constraints and small firms

### World Bank Enterprise Surveys research

Kuntchev, Rodriguez Meza, Ramalho, Yang, *What have we learned from the Enterprise Surveys regarding access to finance by SMEs?*

Document page:
https://documents.worldbank.org/en/publication/documents-reports/documentdetail/958291468331867463

External finding relevant to model design:

- SMEs are more likely than large firms to be credit constrained in the reported Enterprise Survey evidence;
- working capital for smaller firms is often financed through multiple channels including trade/informal finance rather than only conventional bank loans.

### Design implication for the simulation

A single bank-loan channel is too narrow as the eventual complete working-capital institution. Trade credit, owner/equity capital and other financing instruments should be represented as distinct balance-sheet channels if they become necessary for the full economic system.

## 6. Guardrails for use of these sources

These sources establish qualitative mechanism plausibility, not model calibration targets.

Do **not** infer from them that:

- a particular `safeCash` ratio is correct;
- a particular loan approval probability is empirically justified;
- the current firm survival rate should match the OECD annual figures directly;
- equity should always outperform debt;
- liquidity support should prevent economically unviable firms from exiting.

Those questions require separate variable definitions, time-unit alignment, empirical datasets and held-out validation.

## External-evidence status for R4

**PASS AS DESIGN-CONSTRAINT DOSSIER.**

The external literature supports maintaining separate mechanisms for:

- productive/operating viability;
- working-capital liquidity;
- commercial-bank underwriting;
- startup/equity finance;
- post-entry survival/growth;
- insolvency/exit.

It does not yet justify any fitted numerical parameter in the simulator.
