# WP-RV08 — NIA / Inventory Accounting External Evidence Map

Date: 2026-08-20
Status: **REFERENCE DOSSIER — NOT CALIBRATION**

This dossier is separate from internal simulation evidence. It constrains accounting semantics using official national-accounts references. It does not select coefficients or authorize a canonical code change.

## Official references

### United Nations — System of National Accounts 2008

Official SNA 2008 page:
https://unstats.un.org/unsd/nationalaccount/sna2008.asp

The SNA is the internationally agreed framework for measuring production, income, consumption, accumulation and balance sheets.

Relevant semantic boundary for the simulator:

- inventories are economic assets consisting of actual goods/services held for later use or sale;
- finished goods are products that have completed production but remain unsold;
- work-in-progress represents output for which production has begun but is not yet complete;
- changes in inventories are an accumulation transaction tied to produced/imported goods and services, not a free residual bucket detached from physical/economic production.

### IMF — Changes in Inventories in the National Accounts

IMF publication/search reference:
https://www.imf.org/external/pubs/ft/qna/2000/textbook/ch7.pdf

Relevant semantic boundary:

- work-in-progress is output currently in production;
- finished goods are goods produced and held by the producer before sale;
- value added is output less intermediate consumption;
- holding gains/losses should be separated from production and value added.

### IMF — Quarterly National Accounts Manual

Official QNA material:
https://www.imf.org/external/pubs/ft/qna/

Relevant semantic boundary:

- genuine work-in-progress can be recognized as output/inventory before completion when production activity has actually occurred;
- accounting for work-in-progress changes the sequence of output, inventory and subsequent sale recognition, but it does not justify recognizing finished-goods output when no corresponding production has occurred.

### OECD — Understanding National Accounts

OECD national-accounts explanatory material:
https://www.oecd.org/sdd/na/UnderstandingNA.pdf

Relevant semantic boundary:

- inventories include materials and supplies, work-in-progress, finished goods and goods for resale;
- expenditure GDP includes changes in inventories as part of gross capital formation;
- production GDP is fundamentally output less intermediate consumption plus relevant taxes less subsidies.

## Internal defect already observed

Earlier RV05 diagnostics found that the current simulator can post `production_labor_accrual` as a debit to finished-goods inventory even when the journal metadata reports zero physical output. This can make inventory book value, inventory investment and expenditure-side GDP rise without a corresponding physical production event.

The current accounting code therefore needs to distinguish at least:

1. labor actually embodied in produced finished goods;
2. labor embodied in genuine work-in-progress;
3. labor expense that did not produce an inventory asset during the period;
4. inventory remaining at active firms;
5. inventory/book balances stranded at inactive or exited firms;
6. holding/revaluation effects, if later implemented, from production flows.

## Design constraint

A future repair must not solve the RV05 defect by simply deleting wage expense or deleting inventory investment. The required invariant is stronger:

> inventory capitalization must be traceable to genuine produced output or genuine work-in-progress, and changes in inventory used in GDP must follow the same production boundary.

A mechanically balanced journal is necessary but not sufficient for national-accounting semantics.

## Validation requirements before canonical admission

Any accounting repair candidate must demonstrate simultaneously:

- settlement ledger balance;
- double-entry balance;
- physical finished-goods stock-flow reconciliation;
- input inventory reconciliation;
- zero or explicitly justified labor capitalization when physical output is zero;
- inactive-firm inventory disposition semantics;
- expenditure GDP identity;
- an independently reconstructed production-side GDP/value-added measure;
- an independently reconstructed income-side measure or documented scope limitation;
- no double counting between work-in-progress, finished goods and final sales.

## Claim taxonomy

### A — VERIFIED EXTERNAL STANDARD

National-account inventory assets are tied to actual goods/services in materials, work-in-progress, finished-goods or resale states. Work-in-progress is production in progress, not a bookkeeping substitute for absent production.

### B — DIAGNOSTIC LEAD

The simulator's current payroll-to-finished-inventory posting is semantically unsafe whenever output is zero or when no explicit WIP asset exists.

### C — HYPOTHESIS

A production-cost/WIP bridge followed by transfer to finished goods on physical completion is a likely coherent accounting architecture, but the exact implementation has not yet been admitted.

### D — PROPOSED CHANGE

None in this dossier. Internal 24-month accounting conformance audits are run separately before a repair candidate is constructed.

## Verdict

**PASS AS EXTERNAL ACCOUNTING-CONSTRAINT DOSSIER.**
