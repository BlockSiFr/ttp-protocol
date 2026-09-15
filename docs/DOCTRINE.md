# TTP Doctrine

TTP exists because trust changed.

The old enterprise control model was:

authenticate -> authorize -> execute -> log

That model breaks when software acts autonomously.

AI agents call tools.
Copilots trigger workflows.
Pipelines deploy infrastructure.
Service accounts move data.
APIs execute business logic.
Managed service providers act across customer environments.

The new control model is:

identity -> trustworthiness -> authority -> execution -> receipt

TTP defines the open protocol layer for establishing trustworthiness in autonomous systems.

A governed system should not rely on an autonomous actor unless:

1. The actor is identified.
2. The trust claim is scoped.
3. The AuthorityGrant is valid.
4. Trust is current.
5. Attestations are fresh.
6. Trust decay has been evaluated.
7. Delegation is bounded.
8. Constraints are satisfied.
9. A downstream authority system can evaluate the result.
10. An ExecutionReceipt can be produced when the result is used for governed action.

TTP does not replace IAM.
TTP does not replace SCIM.
TTP does not replace OAuth.
TTP does not replace API gateways.
TTP does not replace policy engines.
TTP does not replace SIEM.
TTP does not enforce execution by itself.

TTP defines the missing trustworthiness protocol between assigned identity, delegated authority, and actual reliance on autonomous systems.
