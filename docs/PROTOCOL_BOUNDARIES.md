# Protocol Boundaries

This document defines ownership boundaries so TTP is not misrepresented as the full enforcement product.

## TTP owns

- trust transfer semantics
- trust route semantics
- delegation semantics
- trust decay expression
- trust proof expression
- trust context packaging

## TTP does not own

- production enforcement
- API gateway interception
- CI/CD blocking
- Azure deployment
- FrontDesk UI
- receipt storage implementation
- runtime policy engine implementation

These concerns are owned by Runtime Authority and FrontDesk.

## Practical interpretation

- TTP expresses trust context and protocol semantics.
- SCIM-RE structures runtime authority inputs/outputs.
- Runtime Authority enforces execution decisions.
- FrontDesk productizes enterprise operator experience.
