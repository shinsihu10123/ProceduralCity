import copy
import json
import unittest
from pathlib import Path
import importlib.util
import sys

HERE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("controller", HERE / "controller.py")
controller = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = controller
spec.loader.exec_module(controller)

class ControllerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.graph = controller.load_json(HERE / "FROZEN_WP_GRAPH.v2.1.3a.json.gz")
        cls.state = json.loads((HERE / "STATE.json").read_text(encoding="utf-8"))
        cls.ledger = controller.load_jsonl(HERE / "WP_LEDGER.jsonl")

    def test_frozen_projection_has_exact_461_unique_wps(self):
        self.assertEqual(controller.validate_graph(self.graph), [])
        self.assertEqual(self.graph["total_wp"], 461)
        self.assertEqual(len({w["wp_id"] for w in self.graph["wps"]}), 461)

    def test_repository_state_is_valid(self):
        self.assertEqual(controller.validate_state(self.state, self.graph), [])
        self.assertEqual(controller.validate_ledger(self.ledger, self.graph, self.state), [])

    def test_ledger_missing_closed_wp_fails_validation(self):
        rows = [r for r in self.ledger if r["wp_id"] != "WP-018"]
        errors = controller.validate_ledger(rows, self.graph, self.state)
        self.assertTrue(any("WP-018" in e for e in errors))

    def test_dry_run_selects_wp019_not_lower_numeric_blocked_wps(self):
        result = controller.dry_run(self.graph, self.state)
        self.assertEqual(result["selected_next"], "WP-019")
        self.assertEqual(result["selected_hard_predecessors"], ["WP-011", "WP-012", "WP-013"])
        self.assertEqual(result["frontier"][:4], ["WP-019", "WP-021", "WP-022", "WP-023"])
        self.assertNotIn("WP-006", result["frontier"])
        self.assertNotIn("WP-007", result["frontier"])
        self.assertNotIn("WP-017", result["frontier"])

    def test_blocked_predecessor_excludes_successor(self):
        s = copy.deepcopy(self.state)
        s["completed_wps"].remove("WP-013")
        s["completed_wp_count"] -= 1
        s["blocked_wps"].append("WP-013")
        result = controller.resolve(self.graph, s)
        self.assertNotIn("WP-019", result.frontier)
        self.assertIn("blocked predecessor(s): WP-013", result.blocked_reasons["WP-019"])

    def test_correction_budget_gate_fails_closed(self):
        s = copy.deepcopy(self.state)
        s["correction_cycle"] = s["correction_limit"] + 1
        with self.assertRaises(controller.StopGate):
            controller.resolve(self.graph, s)

    def test_single_worker_gate_blocks_parallel_admission(self):
        s = copy.deepcopy(self.state)
        s["current_wp"] = "WP-019"
        s["execution_state"] = "IMPLEMENTING"
        with self.assertRaises(controller.StopGate):
            controller.resolve(self.graph, s)

    def test_state_transition_contract_for_first_worker(self):
        s = controller.transition(self.state, "ADMISSION", now="2026-08-20T00:00:00Z")
        for nxt in ["IMPLEMENTING", "TESTING", "VALIDATING", "EVIDENCE", "CLOSED", "IDLE"]:
            s = controller.transition(s, nxt, now="2026-08-20T00:00:00Z")
        self.assertEqual(s["execution_state"], "IDLE")

    def test_illegal_transition_rejected(self):
        with self.assertRaises(controller.StopGate):
            controller.transition(self.state, "VALIDATING")

if __name__ == "__main__":
    unittest.main()
