# WP-RV08-R4-CF-E — Trade-Credit Aging & Seller Risk Capacity — Closure

Date: 2026-08-27
Authoritative run: 32937905006
Authoritative run HEAD: `66ff4abda31ff4e66ecdb976947453c75bf70b0c`

## Verdict

**CLOSED / ECONOMIC FAIL AS DESIGNED / DIAGNOSTIC EVIDENCE ACCEPTED**

All four 24-month seeds completed the shadow aging experiment and produced artifacts. The run failed economically, not because of syntax, harness, replay, accounting, or conservation defects.

### Gates that passed on all four seeds
- no canonical mutation;
- exact shadow replay;
- exact canonical replay;
- buyer AP == seller AR conservation;
- no negative invoice balance;
- invoice stock-flow conservation;
- physical procurement ceiling;
- deterministic oldest-due-first repayment;
- canonical accounting / ledger health;
- invoice issuance, repayment-capacity observation, and procurement recovery observation.

### Gate that failed on all four seeds
- `sellerRiskCapacityOk`.

## Cross-seed economic evidence

| Seed | Avg outstanding AP/AR | Avg arrears stock | Avg arrears ratio | Avg retained recovery share | Terminal arrears ratio | Max invoice age |
|---|---:|---:|---:|---:|---:|---:|
| Original A | 142.5850 | 128.6022 | 79.06% | 10.02% | 100% | 22 mo |
| Original C | 156.4493 | 141.4995 | 81.48% | 10.32% | 100% | 22 mo |
| Heldout E | 156.3380 | 140.8654 | 80.02% | 11.08% | 100% | 22 mo |
| Heldout F | 106.0413 | 95.0126 | 77.76% | 12.68% | 100% | 22 mo |

Repayment capacity was extremely small relative to new invoice issuance. Typical average new invoice value was roughly 5.7–8.0 per month while average analytical repayment capacity was only about 0.04–0.44 per month. Consequently, early procurement recovery converted into persistent receivables/payables and then arrears. By month 24, new invoice origination had effectively stopped while the open stock was almost entirely in arrears.

## Causal conclusion

R4-CF-D correctly showed that deferred settlement can unlock physically available supplier inventory in a one-month snapshot. R4-CF-E shows that **trade credit alone is not dynamically self-financing under the current canonical operating cycle**.

The tested causal chain is:

`input shortage -> buyer cash/settlement constraint -> trade credit temporarily restores procurement -> buyer fails to generate enough repayment capacity -> AP/AR accumulates -> arrears rises -> seller risk capacity is exhausted -> new trade credit stops -> input shortage returns`.

Therefore:
- canonical AP/AR architecture is **not yet approved**;
- increasing seller credit limits is prohibited;
- extending Net-30 to Net-60 is not a justified fix;
- the next causal frontier is buyer **operating cash-conversion cycle** and payment priority/timing.

## Next gate

Proceed to **WP-RV08-R4-CG — Operating Cash-Conversion Cycle Decomposition**.

Canonical supply-chain mutation remains locked until the source of repayment incapacity is decomposed.