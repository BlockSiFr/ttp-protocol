"""Parity tests for the Python AGT bridge.

These assert the same behaviour as packages/pctr/tests/agt.test.mjs, so the two
language bindings cannot drift apart on the parts that matter to AGT.

Run: python3 -m unittest discover -s sdk/python -p 'test_*.py'
"""
import unittest

from agt import (
    AGT_TIER_THRESHOLDS, agt_claims, classify_action, domain_for, from_agt_score,
    from_agt_trust_score, is_spiffe_id, normalize_agt_event, parse_spiffe_id,
    ring_for_severity, to_agt_score, to_agt_trust_score, to_mesh_attestation,
    to_trust_evidence, trust_tier,
)

RECEIPT = {
    "receiptId": "rcpt-1", "receiptHash": "sha256:abc", "keyId": "ed25519:k1",
    "principal": "spiffe://blocksifr.com/ns/prod/sa/planner",
    "requestedBy": "spiffe://blocksifr.com/ns/prod/sa/finance",
    "requested": {"action": "payments.transfer", "target": "acct:1", "params": {"amount": 1800}},
    "consequence": {"class": "MONEY_MOVED", "severity": "HIGH", "reversible": False},
    "routeSelected": {"routeId": "r1", "effectiveTrust": 0.9178, "agents": ["spiffe://blocksifr.com/ns/prod/sa/finance"]},
    "verifier": {"decision": "EXECUTION_ALLOWED", "failures": []},
    "executed": {"status": "SUCCEEDED", "executedAt": "2026-09-15T00:00:00Z"},
    "issuedAt": "2026-09-15T00:00:00Z",
}


class TrustScaleTests(unittest.TestCase):
    def test_agt_scores_zero_to_one_with_tiers(self):
        # Upstream AGT (agent-governance-typescript/src/trust.ts), not the 0-1000 scale
        # our integration guide used to specify.
        self.assertEqual(AGT_TIER_THRESHOLDS,
                         {"untrusted": 0.0, "provisional": 0.3, "trusted": 0.6, "verified": 0.85})
        self.assertEqual(to_agt_trust_score(0.9178).as_dict(),
                         {"overall": 0.9178, "dimensions": {}, "tier": "Verified"})
        self.assertEqual(trust_tier(0.1), "Untrusted")
        self.assertEqual(trust_tier(0.3), "Provisional")
        self.assertEqual(trust_tier(0.6), "Trusted")
        self.assertEqual(trust_tier(0.85), "Verified")

    def test_scores_are_clamped_not_propagated(self):
        self.assertEqual(to_agt_trust_score(1.5).overall, 1.0)
        self.assertEqual(to_agt_trust_score(-2).overall, 0.0)
        self.assertEqual(to_agt_trust_score("not a number").overall, 0.0)

    def test_trust_score_accepts_every_inbound_shape(self):
        self.assertEqual(from_agt_trust_score({"overall": 0.42, "tier": "Provisional"}), 0.42)
        self.assertEqual(from_agt_trust_score(0.42), 0.42)
        self.assertEqual(from_agt_trust_score(to_agt_trust_score(0.42)), 0.42)

    def test_legacy_thousand_scale_still_available(self):
        self.assertEqual(to_agt_score(0.9178), 918)
        self.assertEqual(to_agt_score(1.5), 1000)
        self.assertEqual(from_agt_score(918), 0.918)

    def test_rings_come_from_the_consequence(self):
        self.assertEqual(ring_for_severity("CRITICAL"), 0)
        self.assertEqual(ring_for_severity("HIGH"), 1)
        self.assertEqual(ring_for_severity("MEDIUM"), 2)
        self.assertEqual(ring_for_severity(None), 3)


class SpiffeTests(unittest.TestCase):
    def test_svid_round_trips(self):
        svid = "spiffe://blocksifr.com/ns/prod/sa/finance"
        self.assertTrue(is_spiffe_id(svid))
        self.assertFalse(is_spiffe_id("finance"))
        self.assertEqual(parse_spiffe_id(svid),
                         {"trust_domain": "blocksifr.com", "path": "/ns/prod/sa/finance", "id": svid})
        self.assertIsNone(parse_spiffe_id("not-a-svid"))


class ConsequenceTests(unittest.TestCase):
    def test_verb_decides_over_namespace(self):
        self.assertEqual(classify_action("payments.status")["consequence"], "DATA_READ")
        self.assertEqual(classify_action("payments.transfer")["consequence"], "MONEY_MOVED")
        self.assertEqual(classify_action("customers.delete")["consequence"], "DATA_DELETED")
        self.assertEqual(classify_action("send_invoice_email")["consequence"], "MESSAGE_SENT")

    def test_scale_and_money_escalate_severity(self):
        self.assertEqual(classify_action("payments.transfer")["severity"], "HIGH")
        self.assertEqual(classify_action("payments.transfer", {"amount": 18000})["severity"], "CRITICAL")
        self.assertEqual(classify_action("records.update", {"recordsAffected": 5000})["severity"], "CRITICAL")

    def test_domains_match_the_javascript_bridge(self):
        self.assertEqual(domain_for("MONEY_MOVED"), "payments")
        self.assertEqual(domain_for("DATA_DELETED"), "data-destruction")
        self.assertEqual(domain_for("SOMETHING_NEW"), "general")


class ClaimsTests(unittest.TestCase):
    def test_rego_input_carries_every_evaluated_claim(self):
        claims = agt_claims(ttp_score=0.9178, action="payments.transfer", issuer_count=2,
                            agents=["spiffe://blocksifr.com/ns/prod/sa/finance", "planner"],
                            route_id="r1", receipt=RECEIPT)["ttp"]
        self.assertEqual(claims["ttp_domain"], "payments")
        self.assertEqual(claims["ttp_score"], 0.9178)
        self.assertEqual(claims["issuer_count"], 2)
        self.assertEqual(claims["trust_score"]["tier"], "Verified")
        self.assertEqual(claims["required_ring"], ring_for_severity(claims["severity"]))
        self.assertEqual(claims["spiffe_ids"], ["spiffe://blocksifr.com/ns/prod/sa/finance"])
        self.assertEqual(claims["receipt_hash"], "sha256:abc")


class EvidenceTests(unittest.TestCase):
    def test_receipt_becomes_behavioural_evidence(self):
        evidence = to_trust_evidence(RECEIPT)
        self.assertEqual(evidence["type"], "TTPBehavioralEvidence")
        self.assertEqual(evidence["outcome"], "allowed")
        self.assertEqual(evidence["domain"], "payments")
        self.assertEqual(evidence["receipt_hash"], "sha256:abc")
        self.assertEqual(evidence["weight"], 0.75)
        self.assertIsNone(to_trust_evidence(None))

    def test_denial_at_high_consequence_weighs_more(self):
        denied = dict(RECEIPT)
        denied["consequence"] = {"class": "MONEY_MOVED", "severity": "CRITICAL"}
        denied["verifier"] = {"decision": "EXECUTION_DENIED", "failures": [{"code": "APPROVAL_REQUIRED"}]}
        evidence = to_trust_evidence(denied)
        self.assertEqual(evidence["outcome"], "denied")
        self.assertEqual(evidence["failures"], ["APPROVAL_REQUIRED"])
        self.assertGreater(evidence["weight"], to_trust_evidence(RECEIPT)["weight"])

    def test_mesh_attestation_traces_back_to_the_receipt(self):
        attestation = to_mesh_attestation(RECEIPT, peer="spiffe://partner.example/ns/prod/sa/mesh")
        self.assertEqual(attestation["type"], "AgentMeshTrustAttestation")
        self.assertEqual(attestation["trust_domain"], "blocksifr.com")
        self.assertEqual(attestation["trust_score"]["tier"], "Verified")
        self.assertEqual(attestation["evidence"]["receipt_hash"], "sha256:abc")
        self.assertEqual(attestation["evidence"]["signed_by"], "ed25519:k1")
        self.assertIsNone(to_mesh_attestation(None))


class EventTests(unittest.TestCase):
    def test_policy_decision_result_covers_every_policy_action(self):
        def decision(action, allowed, **extra):
            return normalize_agt_event({"allowed": allowed, "action": action, "agentId": "finance",
                                        "operation": "payments.transfer", "policyName": "agt.authz",
                                        "approvers": [], "rateLimited": False, **extra})

        self.assertEqual(decision("allow", True)["event"], "EXECUTION_ALLOWED")
        self.assertEqual(decision("log", True)["event"], "EXECUTION_ALLOWED")
        self.assertEqual(decision("warn", True)["event"], "EXECUTION_ALLOWED")
        self.assertEqual(decision("deny", False)["event"], "EXECUTION_DENIED")

        pending = decision("require_approval", True, approvers=["ops-oncall"])
        self.assertEqual(pending["event"], "EXECUTION_DENIED")
        self.assertEqual(pending["detail"]["approvers"], ["ops-oncall"])
        self.assertEqual(pending["detail"]["policy_action"], "require_approval")

    def test_audit_entry_keeps_the_hash_chain(self):
        entry = normalize_agt_event({"timestamp": "t", "agentId": "finance", "action": "customers.delete",
                                     "decision": "review", "hash": "h1", "previousHash": "h0"})
        self.assertEqual(entry["event"], "EXECUTION_DENIED")
        self.assertEqual(entry["detail"]["audit_hash"], "h1")
        self.assertEqual(entry["detail"]["previous_hash"], "h0")

    def test_cascade_containment_and_ring_violations(self):
        quarantined = normalize_agt_event({"eventId": "e1", "timestamp": "t", "sourceAgentId": "finance",
                                           "affectedAgentIds": ["a", "b"], "action": "agent_quarantined",
                                           "reason": "breach", "blastRadius": 3})
        self.assertEqual(quarantined["event"], "TRUST_CHANGED")
        self.assertEqual(quarantined["detail"]["to"], 0.0)
        self.assertEqual(quarantined["detail"]["blast_radius"], 3)

        self.assertIsNone(normalize_agt_event({"eventId": "e2", "timestamp": "t", "sourceAgentId": "f",
                                               "affectedAgentIds": [], "action": "health_propagated"}))

        violation = normalize_agt_event({"agentId": "finance", "action": "prod.deploy",
                                         "agentRing": 2, "requiredRing": 0, "message": "Ring2 cannot reach Ring0"})
        self.assertEqual(violation["event"], "EXECUTION_DENIED")
        self.assertEqual(violation["detail"]["required_ring"], 0)

    def test_trust_verification_result_keeps_its_tier(self):
        verification = normalize_agt_event({"verified": False, "agentId": "finance", "reason": "stale attestation",
                                            "trustScore": {"overall": 0.42, "dimensions": {}, "tier": "Provisional"}})
        self.assertEqual(verification["detail"]["to"], 0.42)
        self.assertEqual(verification["detail"]["tier"], "Provisional")

    def test_invocations_get_the_consequence_agt_omits(self):
        proposed = normalize_agt_event({"type": "action.invocation", "agentId": "finance",
                                        "action": "payments.transfer", "parameters": {"amount": 18000}})
        self.assertEqual(proposed["event"], "ACTION_PROPOSED")
        self.assertEqual(proposed["detail"]["consequence"], "MONEY_MOVED")
        self.assertEqual(proposed["detail"]["severity"], "CRITICAL")
        self.assertEqual(proposed["detail"]["required_ring"], 0)

    def test_unrecognised_events_are_dropped_not_invented(self):
        self.assertIsNone(normalize_agt_event({"type": "telemetry.heartbeat", "agentId": "finance"}))
        self.assertIsNone(normalize_agt_event({"type": "action.invocation", "agentId": "finance"}))
        self.assertIsNone(normalize_agt_event(None))
        self.assertIsNone(normalize_agt_event("not-a-mapping"))


if __name__ == "__main__":
    unittest.main()
