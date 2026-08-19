#!/usr/bin/env python3
"""Gaon repository-native autonomous WP execution controller v1.

This controller never edits the Frozen WBS/dependency graph. It resolves admission
from an immutable projection of FINAL v2.1.3a and fails closed on invalid state.
"""
from __future__ import annotations

import argparse
import copy
import json
import gzip
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DEFAULT_GRAPH = ROOT / "FROZEN_WP_GRAPH.v2.1.3a.json.gz"
DEFAULT_STATE = ROOT / "STATE.json"
DEFAULT_LEDGER = ROOT / "WP_LEDGER.jsonl"

ACTIVE_STATES = {"ADMISSION", "IMPLEMENTING", "TESTING", "VALIDATING", "EVIDENCE", "CLOSING"}
TERMINAL_STATES = {"CLOSED", "BLOCKED"}
ALLOWED_STATES = {"IDLE", *ACTIVE_STATES, *TERMINAL_STATES, "WAITING"}
ALLOWED_TRANSITIONS = {
    "IDLE": {"ADMISSION", "WAITING", "BLOCKED"},
    "ADMISSION": {"IMPLEMENTING", "IDLE", "BLOCKED"},
    "IMPLEMENTING": {"TESTING", "BLOCKED"},
    "TESTING": {"VALIDATING", "IMPLEMENTING", "BLOCKED"},
    "VALIDATING": {"EVIDENCE", "IMPLEMENTING", "BLOCKED"},
    "EVIDENCE": {"CLOSING", "CLOSED", "BLOCKED"},
    "CLOSING": {"CLOSED", "BLOCKED"},
    "CLOSED": {"IDLE"},
    "WAITING": {"IDLE", "ADMISSION", "BLOCKED"},
    "BLOCKED": {"IDLE"},
}

class StopGate(RuntimeError):
    pass

@dataclass(frozen=True)
class Resolution:
    frontier: tuple[str, ...]
    selected: str | None
    blocked_reasons: dict[str, tuple[str, ...]]


def load_json(path: Path) -> dict[str, Any]:
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as f:
            return json.load(f)
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json_atomic(path: Path, obj: dict[str, Any]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")
    tmp.replace(path)


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise StopGate(f"ledger line {lineno} is not valid JSON: {exc}") from exc
            if not isinstance(row, dict):
                raise StopGate(f"ledger line {lineno} must be an object")
            rows.append(row)
    return rows


def validate_ledger(rows: list[dict[str, Any]], graph: dict[str, Any], state: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    required = {
        "wp_id", "stage", "subsystem", "member_ids", "hard_predecessors",
        "admitted_at", "start_commit", "implementation_commit", "validated_commit",
        "evidence_commit", "branch", "dedicated_test_count", "correction_cycles",
        "verdict", "blocker", "ci_runs", "closed_at", "next_wp"
    }
    known = {w["wp_id"] for w in graph["wps"]}
    closed_seen: set[str] = set()
    for i, row in enumerate(rows, 1):
        missing = sorted(required - set(row))
        if missing:
            errors.append(f"ledger row {i} missing fields: {', '.join(missing)}")
        wp = row.get("wp_id")
        if wp not in known:
            errors.append(f"ledger row {i} references unknown WP {wp}")
        if row.get("verdict") == "PASS/CLOSED" and isinstance(wp, str):
            closed_seen.add(wp)
    missing_closed = sorted(set(state.get("completed_wps", [])) - closed_seen)
    if missing_closed:
        errors.append("completed_wps missing PASS/CLOSED ledger evidence: " + ", ".join(missing_closed))
    return errors


def validate_graph(graph: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if graph.get("authority_version") != "FINAL_v2.1.3a":
        errors.append("authority_version must be FINAL_v2.1.3a")
    wps = graph.get("wps")
    if not isinstance(wps, list):
        return errors + ["wps must be a list"]
    if graph.get("total_wp") != len(wps):
        errors.append("total_wp does not match wps length")
    ids = [w.get("wp_id") for w in wps]
    if len(ids) != len(set(ids)):
        errors.append("duplicate wp_id in frozen graph projection")
    known = set(ids)
    for w in wps:
        wp = w.get("wp_id")
        for pred in w.get("hard_predecessors", []):
            if pred not in known:
                errors.append(f"{wp}: unknown hard predecessor {pred}")
        if not isinstance(w.get("week"), int) or w["week"] < 1:
            errors.append(f"{wp}: invalid week")
        if not isinstance(w.get("dependency_safe_admission_order"), int):
            errors.append(f"{wp}: missing dependency-safe admission order")
    return errors


def validate_state(state: dict[str, Any], graph: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    required = [
        "schema_version", "project", "authority_version", "total_wp", "completed_wp_count",
        "current_wp", "execution_state", "correction_cycle", "correction_limit",
        "completed_wps", "blocked_wps", "automation_enabled", "updated_at",
    ]
    for key in required:
        if key not in state:
            errors.append(f"missing state field: {key}")
    if state.get("authority_version") != graph.get("authority_version"):
        errors.append("state authority_version differs from frozen graph")
    if state.get("total_wp") != graph.get("total_wp"):
        errors.append("state total_wp differs from frozen graph")
    completed = state.get("completed_wps", [])
    blocked = state.get("blocked_wps", [])
    if len(completed) != len(set(completed)):
        errors.append("completed_wps contains duplicates")
    if len(blocked) != len(set(blocked)):
        errors.append("blocked_wps contains duplicates")
    if set(completed) & set(blocked):
        errors.append("a WP cannot be both completed and blocked")
    if state.get("completed_wp_count") != len(completed):
        errors.append("completed_wp_count does not match completed_wps")
    known = {w["wp_id"] for w in graph["wps"]}
    for wp in [*completed, *blocked]:
        if wp not in known:
            errors.append(f"state references unknown WP {wp}")
    if state.get("current_wp") is not None and state["current_wp"] not in known:
        errors.append("current_wp is not in frozen graph")
    if state.get("execution_state") not in ALLOWED_STATES:
        errors.append("invalid execution_state")
    cycle = state.get("correction_cycle")
    limit = state.get("correction_limit")
    if not isinstance(cycle, int) or cycle < 0:
        errors.append("correction_cycle must be a non-negative integer")
    if not isinstance(limit, int) or limit < 0:
        errors.append("correction_limit must be a non-negative integer")
    return errors


def _wp_index(graph: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {w["wp_id"]: w for w in graph["wps"]}


def _sort_key(w: dict[str, Any]) -> tuple[int, int, int, str]:
    return (
        int(w["week"]),
        int(w["dependency_safe_admission_order"]),
        int(w.get("source_intra_week_order") or 10**9),
        str(w["wp_id"]),
    )


def resolve(graph: dict[str, Any], state: dict[str, Any]) -> Resolution:
    graph_errors = validate_graph(graph)
    state_errors = validate_state(state, graph)
    if graph_errors or state_errors:
        raise StopGate("invalid controller inputs: " + "; ".join(graph_errors + state_errors))
    if state["correction_cycle"] > state["correction_limit"]:
        raise StopGate("correction budget exceeded")
    if state["execution_state"] in ACTIVE_STATES or state.get("current_wp") is not None:
        raise StopGate("another WP is active; single-worker gate blocks new admission")

    completed = set(state["completed_wps"])
    blocked = set(state["blocked_wps"])
    candidates: list[dict[str, Any]] = []
    blocked_reasons: dict[str, tuple[str, ...]] = {}
    for w in graph["wps"]:
        wp = w["wp_id"]
        if wp in completed or wp in blocked:
            continue
        preds = tuple(w.get("hard_predecessors", []))
        blocked_preds = tuple(p for p in preds if p in blocked)
        missing_preds = tuple(p for p in preds if p not in completed)
        reasons: list[str] = []
        if blocked_preds:
            reasons.append("blocked predecessor(s): " + ", ".join(blocked_preds))
        if missing_preds:
            reasons.append("unclosed predecessor(s): " + ", ".join(missing_preds))
        if reasons:
            blocked_reasons[wp] = tuple(reasons)
            continue
        candidates.append(w)
    candidates.sort(key=_sort_key)
    frontier = tuple(w["wp_id"] for w in candidates)
    return Resolution(frontier=frontier, selected=(frontier[0] if frontier else None), blocked_reasons=blocked_reasons)


def dry_run(graph: dict[str, Any], state: dict[str, Any]) -> dict[str, Any]:
    r = resolve(graph, state)
    idx = _wp_index(graph)
    selected = idx[r.selected] if r.selected else None
    return {
        "mode": "DRY_RUN",
        "worker": "single",
        "authority_version": graph["authority_version"],
        "frontier": list(r.frontier),
        "selected_next": r.selected,
        "selected_hard_predecessors": selected.get("hard_predecessors", []) if selected else [],
        "selected_stage": selected.get("stage") if selected else None,
        "selected_subsystems": selected.get("subsystems", []) if selected else [],
        "selected_l3_range": [selected.get("first_l3"), selected.get("last_l3")] if selected else None,
        "reason": "lowest Frozen (Week, Dependency-safe Admission Order) among dependency-satisfied WPs" if selected else "no dependency-safe WP available",
        "automation_enabled": bool(state.get("automation_enabled")),
    }


def transition(state: dict[str, Any], to_state: str, *, now: str | None = None) -> dict[str, Any]:
    current = state["execution_state"]
    if to_state not in ALLOWED_TRANSITIONS.get(current, set()):
        raise StopGate(f"illegal state transition: {current} -> {to_state}")
    new = copy.deepcopy(state)
    new["execution_state"] = to_state
    new["updated_at"] = now or datetime.now(timezone.utc).isoformat()
    return new


def admit(graph: dict[str, Any], state: dict[str, Any], *, now: str | None = None) -> dict[str, Any]:
    resolution = resolve(graph, state)
    if not resolution.selected:
        raise StopGate("no dependency-safe WP available")
    idx = _wp_index(graph)
    wp = idx[resolution.selected]
    new = transition(state, "ADMISSION", now=now)
    new["current_wp"] = wp["wp_id"]
    new["current_subsystem"] = ", ".join(wp["subsystems"])
    new["current_l3"] = wp["first_l3"]
    new["current_member_index"] = 0
    new["current_member_count"] = wp["l3_count"]
    new["next_dependency_safe_wp"] = wp["wp_id"]
    new["worker_status"] = "ADMISSION"
    return new


def _print_json(obj: Any) -> None:
    print(json.dumps(obj, ensure_ascii=False, indent=2))


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--graph", type=Path, default=DEFAULT_GRAPH)
    p.add_argument("--state", type=Path, default=DEFAULT_STATE)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("validate")
    sub.add_parser("dry-run")
    a = sub.add_parser("admit")
    a.add_argument("--write", action="store_true", help="persist ADMISSION state to STATE.json")
    t = sub.add_parser("transition")
    t.add_argument("to_state", choices=sorted(ALLOWED_STATES))
    t.add_argument("--write", action="store_true")
    args = p.parse_args()

    graph = load_json(args.graph)
    state = load_json(args.state)
    ledger = load_jsonl(DEFAULT_LEDGER)
    if args.cmd == "validate":
        errors = validate_graph(graph) + validate_state(state, graph) + validate_ledger(ledger, graph, state)
        if errors:
            _print_json({"valid": False, "errors": errors})
            return 2
        _print_json({"valid": True, "total_wp": graph["total_wp"], "completed_wp_count": state["completed_wp_count"]})
        return 0
    if args.cmd == "dry-run":
        _print_json(dry_run(graph, state))
        return 0
    if args.cmd == "admit":
        new = admit(graph, state)
        _print_json(new)
        if args.write:
            write_json_atomic(args.state, new)
        return 0
    if args.cmd == "transition":
        new = transition(state, args.to_state)
        _print_json(new)
        if args.write:
            write_json_atomic(args.state, new)
        return 0
    return 2

if __name__ == "__main__":
    raise SystemExit(main())
