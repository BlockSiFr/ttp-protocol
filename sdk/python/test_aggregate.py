"""The normative aggregation vectors, run against the Python binding.

The same vectors run against the JavaScript binding in
packages/pctr/tests/aggregation.test.mjs. Both must agree with the spec and each other.
"""
import json
import os
import unittest

from aggregate import DEFAULT_PARAMS, INSUFFICIENT_TRUST_DATA, aggregate_trust, score_label

VECTORS = json.load(open(os.path.join(os.path.dirname(__file__), "..", "..",
                                      "protocol", "test-vectors", "aggregation-vectors.json")))


class ConformanceTests(unittest.TestCase):
    def test_defaults_match_the_spec(self):
        self.assertEqual(DEFAULT_PARAMS, VECTORS["params"])

    def test_every_vector(self):
        for case in VECTORS["cases"]:
            with self.subTest(case=case["id"]):
                result = aggregate_trust(case["receipts"], case["current_time_ms"], VECTORS["params"])
                if case["expected"].get("error"):
                    self.assertEqual(result["error"], case["expected"]["error"])
                    continue
                self.assertAlmostEqual(result["score"], case["expected"]["score"], delta=0.001,
                                       msg=f'{case["id"]}: {case["description"]}')
                if "contributing_receipts" in case["expected"]:
                    self.assertEqual(result["contributing_receipts"], case["expected"]["contributing_receipts"])
                if "contributing_issuers" in case["expected"]:
                    self.assertEqual(result["contributing_issuers"], case["expected"]["contributing_issuers"])


class PropertyTests(unittest.TestCase):
    def test_empty_window_is_insufficient_data_not_zero(self):
        result = aggregate_trust([{"receipt_id": "r", "issuer_id": "A", "score": 1.0, "timestamp": 0}], 10_000_000)
        self.assertEqual(result["error"], INSUFFICIENT_TRUST_DATA)
        self.assertIsNone(result["score"])

    def test_a_capped_issuer_holds_its_cap_and_no_more(self):
        now = 1_700_000_000_000
        receipts = [{"receipt_id": f"loud{i}", "issuer_id": "LOUD", "score": 1.0, "timestamp": now} for i in range(50)]
        receipts += [{"receipt_id": "b", "issuer_id": "B", "score": 0.2, "timestamp": now},
                     {"receipt_id": "c", "issuer_id": "C", "score": 0.2, "timestamp": now}]
        result = aggregate_trust(receipts, now)
        loud = next(i for i in result["issuers"] if i["issuer_id"] == "LOUD")
        self.assertTrue(loud["capped"])
        self.assertAlmostEqual(loud["weight"], 0.4, delta=0.001)
        self.assertLess(result["score"], 0.55)
        self.assertAlmostEqual(sum(i["weight"] for i in result["issuers"]), 1.0, delta=0.001)

    def test_danger_cannot_be_averaged_away(self):
        now = 1_700_000_000_000
        receipts = [{"receipt_id": f"g{i}", "issuer_id": "A", "score": 1.0, "timestamp": now} for i in range(9)]
        receipts.append({"receipt_id": "bad", "issuer_id": "A", "score": 0.0, "timestamp": now})
        self.assertLess(aggregate_trust(receipts, now)["score"], 0.87)

    def test_labels(self):
        self.assertEqual(score_label(0.95), "Excellent")
        self.assertEqual(score_label(0.05), "Critical")
        self.assertEqual(score_label(None), "Unknown")


if __name__ == "__main__":
    unittest.main()
