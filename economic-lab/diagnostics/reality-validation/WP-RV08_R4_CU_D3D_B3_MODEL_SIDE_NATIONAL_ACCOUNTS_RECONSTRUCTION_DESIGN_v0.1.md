# WP-RV08 R4-CU-D3D-B3 Model-Side National Accounts Reconstruction Design v0.1

## Decision status

**DESIGN FROZEN / MEASUREMENT-ONLY FRONT / CANONICAL MUTATION NOT AUTHORIZED**

## Dependency checkpoint

This front starts strictly after:

- `R4-CU-D3D-B1`, which admitted ILOSTAT labour-income-share observations only as provisional national distribution evidence and explicitly blocked direct wage or productivity calibration;
- `R4-CU-D3D-B2`, which admitted two OECD household-saving reference descriptors, retained two coverage-blocked descriptors, and explicitly rejected mapping `100 - saving rate` to `desiredConsumptionBudget`.

No D3C, D3D, B1 or B2 extraction is repeated here. B3 reconstructs the corresponding **model-side accounting objects**.

## Question

Can the canonical simulation produce internally reconciled monthly measures for:

1. employee compensation;
2. domestic gross value added;
3. market-price GDP proxy;
4. household disposable cash income;
5. realized household final-consumption outlay;
6. household net-saving flow;

without silently treating cash settlement as accrual income, gross sales as value added, deposit changes as saving, or ex-ante desired budgets as realized consumption?

## Why existing headline fields are insufficient

The current model exposes useful operational fields, but they do not all share the same accounting boundary.

- `macro.wageBill` is based on wages actually settled in cash, whereas the external labour-share concept is accrual-oriented employee and self-employed labour income.
- `macro.consumption` includes domestic household purchases and consumer imports, but domestic consumption tax is settled separately.
- `desiredConsumptionBudget` is an ex-ante behavioural budget and is not household final consumption expenditure.
- `macro.gdp` is an operational expenditure aggregate whose equality to production- and income-side value added has not yet been proven.
- change in household deposits includes borrowing, debt service, asset trades and other financing flows, so it is not net saving.

B3 therefore reconstructs every numerator and denominator from the general ledger and settlement ledger and keeps the semantic gaps visible.

## Frozen measurement boundaries

### A. Employee compensation accrual boundary

`employeeCompensationAccrued`

is the firm-side credit to `wages_payable` in `production_labor_accrual` journals. It must reconcile exactly with household-side `wage_income` accrual.

`wagesSettled`

is the cash amount in settlement-ledger entries of kind `wage`. Accrual and cash settlement remain separate, with the bridge:

`closing wages payable = opening wages payable + accrued compensation - cash wages settled`.

### B. Firm production and gross-value-added boundary

For each country-month:

`grossOutputBookMarketHybrid = sales revenue + change in finished-goods inventory book value`

`GVA_basic_proxy = grossOutputBookMarketHybrid - intermediate input consumption at book value`

The independent income-side identity is:

`GVA_income_proxy = employee compensation accrued + gross operating surplus proxy`

where:

`gross operating surplus proxy = sales revenue - cost of goods sold`.

The two approaches must reconcile through the finished-inventory identity. Domestic intermediate sales are included in seller output and subtracted only when the buyer consumes the input. Imported intermediate inputs are subtracted when consumed. Capital goods, household purchases, government purchases and exports remain final uses or inventory accumulation.

### C. Market-price GDP proxy

`GDP_market_proxy = GVA_basic_proxy + consumption taxes + import tariffs`.

The model has no explicit product subsidies. Corporate and personal income taxes are not product taxes and are not added to this denominator.

This remains a proxy because banking FISIM, non-market government output and other SNA adjustments are not represented.

### D. Household disposable cash-income boundary

`cashDisposableHouseholdIncome = cash wages settled + unemployment transfers - income taxes paid`.

This is the compatible cash-flow denominator for realized household purchaser outlay. It must reconcile with aggregate household `disposableIncome` and the canonical macro field.

It does not impute employer social contributions, property income, self-employed mixed income or pension-entitlement adjustments.

### E. Realized household final-consumption purchaser-outlay boundary

`householdConsumptionExpense`

is the household general-ledger debit to `consumption_expense`, covering domestic goods and consumer imports including tariffs.

`realizedHouseholdConsumptionPurchaserOutlay = householdConsumptionExpense + domestic consumption taxes paid`.

The consumption-expense component must reconcile with settlement-ledger domestic goods purchases plus consumer-import base payments plus consumer-import tariffs.

### F. Net household saving-flow proxy

`netHouseholdSavingFlowProxy = cashDisposableHouseholdIncome - realizedHouseholdConsumptionPurchaserOutlay`.

This is not equated to deposit change. The audit separately reports:

`nonSavingFinancialAndOtherNetFlow = household cash change - netHouseholdSavingFlowProxy`.

That residual can contain credit origination, principal and interest payments, security transactions and other financing flows; it is not an accounting failure.

## Explicit semantic-gap register

The following items must be reported rather than replaced with zero-valued assumptions:

- employer social contributions;
- self-employed and mixed labour income;
- pension-entitlement adjustment used in the SNA saving identity;
- property income and social transfers in kind;
- bank FISIM and non-market government output;
- consumption of fixed capital and net/gross conversion.

A measured zero in the current ontology is not automatically an internationally comparable zero.

## Execution matrix

- Original A: `ECON-RV02-A`
- Original C: `ECON-RV02-C`
- Heldout E: `ECON-RV08-HOLDOUT-E`
- Heldout F: `ECON-RV08-HOLDOUT-F`
- Horizon: 24 months per seed
- Scale profile: `baseline`
- Exact canonical replay: required
- Exact diagnostic replay: required
- Canonical state mutation by the audit: forbidden

## Hard gates

1. Firm and household labour accruals reconcile.
2. Wage payable and wage receivable stock-flow bridges reconcile.
3. Finished- and input-inventory stock-flow bridges reconcile.
4. Production- and income-side GVA proxies reconcile.
5. Household cash changes reconcile to settlement-ledger postings.
6. Cash disposable income reconciles to household and macro fields.
7. Realized consumption reconciles across settlement and general-ledger views.
8. Product-tax totals reconcile to fiscal and international subsystems.
9. All required semantic gaps are explicit and none is silently imputed.
10. Exact replay and hard accounting health pass on all four seeds.
11. No external empirical descriptor is promoted to a canonical target.
12. Canonical mutation remains locked.

## Interpretation rule

A PASS means that internally coherent model-side comparator objects now exist. It does **not** mean they are already semantically identical to ILOSTAT labour income share or OECD net household saving, and it does not authorize parameter changes.

## Next dependency-safe front

`R4-CU-D3D-B4`: compare the reconstructed dimensionless model distributions with the admitted B1/B2 empirical descriptors, preserve partial semantic-match flags, and determine whether an empirical calibration envelope can be admitted before any shadow repair vector is constructed.
