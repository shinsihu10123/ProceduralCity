# Autonomous WP Execution Controller v1

## Authority

The controller is orchestration only. It does **not** own or modify WHAT/HOW/ORDER semantics.

Execution order is read from `FROZEN_WP_GRAPH.v2.1.3a.json.gz`, an exact control-field projection of `wp_execution_v2.1.3a.json` from the Frozen `FINAL_v2.1.3a` package. The projection records both the package SHA-256 and member SHA-256 so source drift can be detected.

## Single-worker rule

Controller v1 admits at most one WP at a time. A new admission is rejected if `current_wp != null` or the state is one of `ADMISSION / IMPLEMENTING / TESTING / VALIDATING / EVIDENCE / CLOSING`.

## Dependency resolver

A WP is a candidate only when:

1. it is not already PASS/CLOSED;
2. it is not explicitly BLOCKED;
3. every Frozen hard predecessor is in `completed_wps`;
4. none of its predecessors is in `blocked_wps`;
5. no other WP is active;
6. the controller correction budget has not been exceeded.

Among candidates, the controller selects the lowest Frozen `(Week, Dependency-safe Admission Order)`. `Source Intra-week Order` and WP ID are deterministic tie-breakers only. Numeric WP ID is never used to bypass dependency order.

## Stop gate and correction budget

Default correction limit is `2`. `correction_cycle > correction_limit` is a hard stop. A Frozen semantic change is not a correction cycle; it is a BCR/authority stop and must not be auto-applied.

## State machine

Primary worker path:

`IDLE → ADMISSION → IMPLEMENTING → TESTING → VALIDATING → EVIDENCE → CLOSED → IDLE`

`CLOSING` is supported as an optional explicit closure state. Invalid transitions fail closed.

## CLI

From repository root:

```bash
python production/execution/controller.py validate
python production/execution/controller.py dry-run
python -m unittest production/execution/tests/test_controller.py
```

`admit --write` and `transition ... --write` can mutate the local `STATE.json`, but repository automation remains disabled until the Automation Gate is separately verified.

## Current dry-run expectation

With the recovered PASS/CLOSED set, the safe frontier is:

`WP-019, WP-021, WP-022, WP-023`

Frozen order selects **WP-019**. Its hard predecessors are `WP-011`, `WP-012`, `WP-013`.
