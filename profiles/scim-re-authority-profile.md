# SCIM-RE Authority Profile
SCIM-RE owns WorkloadIdentity, AuthorityGrant, Attestation, AuthorizationRequest, AuthorizationResponse, ExecutionReceipt.
TTP owns trust proofs, decay, transfer, delegation, and route verification.

Mapping:
- Attestation → verify_attestation()
- WorkloadIdentity.trustScore → apply_decay()
- AuthorityGrant.minTrustScore → prove_trust_threshold()
- delegationChain → verify_delegation()
- trustRouteRef → verify_trust_route()
- authorization proof → generate_trust_proof()
- trust transfer → validate_transfer()
