# R4-CE-D4 Working-Capital Labor Envelope — Closure

Status: **CLOSED / PASS AS DIAGNOSTIC EVIDENCE / PERSON BEHAVIORAL SWITCH STILL BLOCKED**

Date: 2026-08-26
Authoritative run: `32931771838`
Authoritative branch: `scratch/new-project-2026-08-12`
Validated head: `ca4febbcfa2617ad1ec20195f8542696c1633f07`

## 1. Gate result

All four required shards completed successfully across a 24-month horizon:

- `ECON-RV02-A`
- `ECON-RV02-C`
- `ECON-RV08-HOLDOUT-E`
- `ECON-RV08-HOLDOUT-F`

Every shard passed:

- no envelope mutation
- exact envelope replay
- envelope validation
- exact canonical replay
- hard accounting health
- credit observation
- financeable-labor observation
- bound preservation

The prior run failure was a harness defect in `Array.map(structuredClone)` under Node 22, not an economic-model failure. It was fixed by wrapping `structuredClone` in an explicit callback.

## 2. 24-month results

### Original A

24-month averages:

- physical labor need: `656.40`
- cash-only financeable labor: `2087.61`
- credit-inclusive financeable labor: `2087.61`
- full financeable labor: `66.54`
- canonical desired workers: `682.08`
- current workers: `660.54`
- working-capital credit requested: `113703.26`
- credit admissible: `0`
- approved applications: `0`
- eligible applications: `102.50`

Month-24 binding counts:

- physical need: 8
- input availability: 56
- new-credit underwriting: 8

### Original C

24-month averages:

- physical labor need: `677.36`
- cash-only financeable labor: `1993.54`
- credit-inclusive financeable labor: `1993.54`
- full financeable labor: `74.12`
- canonical desired workers: `699.46`
- current workers: `677.67`
- working-capital credit requested: `115947.31`
- credit admissible: `0`
- approved applications: `0`
- eligible applications: `101.13`

Month-24 binding counts:

- physical need: 8
- input availability: 49
- new-credit underwriting: 11

### Heldout E

24-month averages:

- physical labor need: `671.44`
- cash-only financeable labor: `2036.18`
- credit-inclusive financeable labor: `2056.87`
- full financeable labor: `75.97`
- canonical desired workers: `690.33`
- current workers: `670.92`
- working-capital credit requested: `112069.76`
- credit admissible: `1900.78`
- approved applications: `5.46`
- eligible applications: `99.46`

Month-24 binding counts:

- physical need: 8
- input availability: 47
- new-credit underwriting: 13

### Heldout F

24-month averages:

- physical labor need: `684.60`
- cash-only financeable labor: `1870.12`
- credit-inclusive financeable labor: `1930.97`
- full financeable labor: `70.87`
- canonical desired workers: `697.58`
- current workers: `675.54`
- working-capital credit requested: `120945.80`
- credit admissible: `5478.58`
- approved applications: `8.46`
- eligible applications: `99.42`

Month-24 binding counts:

- physical need: 8
- input availability: 46
- new-credit underwriting: 8

## 3. Causal conclusions

### 3.1 Cash-only labor finance was not the dominant constraint

The previous cash-only shadow estimator looked suspicious because it excluded new credit. D4 shows that raw cash/payroll financeability is actually far above physical labor need in all four seeds on average.

Therefore the very low full-financeable labor result is not primarily caused by firms simply lacking payroll cash.

### 3.2 Input availability is the dominant direct labor-demand ceiling

At month 24, most establishments are classified as `INPUT_AVAILABILITY` constrained in every seed.

This is consistent with earlier R4-CC and M2 evidence showing widespread input shortage and operating-cycle fragility.

The current full-financeable labor collapse is therefore mainly driven by production-chain input availability, with underwriting as a secondary constraint for a subset of establishments.

### 3.3 Current-bank-model credit is too weak and uneven to bridge operating-cycle gaps

Original A and Original C admit zero new working-capital credit over the 24-month diagnostic average despite roughly 100 eligible applications and more than 110k requested working capital per month-equivalent aggregate observation.

Heldout E and F admit some credit, but the amount is small relative to requested credit and does not materially restore full-financeable labor because input availability remains the dominant hard bound.

Thus current underwriting/bank-capital mechanics are still structurally weak, but credit is not sufficient by itself to explain the labor-demand collapse.

### 3.4 The next causal frontier is supply-chain operating capital, not a direct labor switch

D4 closes the question of whether adding ordinary working-capital credit alone would make person-level labor demand plausible. It does not.

The next dependency-safe frontier must explicitly model the operating cycle:

1. input purchasing and supplier settlement timing;
2. inventory acquisition and usable input stock;
3. supplier-side capacity and cash constraints;
4. receivables/payables timing between firms;
5. short-term working-capital finance tied to real purchase orders or invoices;
6. production and payroll after input feasibility is established.

## 4. Anti-tuning decision

The following are **not approved**:

- arbitrary bank capital relaxation;
- arbitrary credit approval-rate targets;
- arbitrary productivity increases;
- arbitrary wage reductions;
- forcing labor demand toward legacy employment counts;
- injecting input inventory without an economic transaction path.

## 5. Closure decision

`R4-CE-D4 = PASS AS DIAGNOSTIC EVIDENCE`.

The read-only envelope is deterministic and accounting-safe. The main result is that the current model's direct labor-demand collapse is dominated by input availability, while the bank/credit layer is a real but secondary and unevenly binding weakness.

Person-level canonical labor-market switching remains blocked.

## 6. Next dependency-safe package

Proceed to **R4-CF — Inter-Firm Operating Cycle and Input Liquidity**.

Initial subpackages:

- `R4-CF-A`: supplier/input-flow contract extraction
- `R4-CF-B`: inter-firm payable/receivable timing audit
- `R4-CF-C`: purchase-order / invoice-backed working-capital shadow facility
- `R4-CF-D`: input-restored labor-demand counterfactual
- `R4-CF-E`: multi-seed long-horizon gate

Current checkpoint:

`R4-CE-D4-CLOSED-PASS / INPUT-AVAILABILITY-DOMINANT / CREDIT-WEAK-BUT-SECONDARY / R4-CF-A-NEXT / PERSON-BEHAVIORAL-SWITCH-LOCKED`
