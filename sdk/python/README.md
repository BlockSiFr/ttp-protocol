# BlockSiFr Python SDK

Minimal Python SDK for SCIM-RE `POST /re/authorize`.

## API
- `authorize(request: AuthorizeRequest) -> AuthorizeResponse`
- Typed request/response models via dataclasses.
- Decision enum: `PERMIT`, `DENY`, `STEP_UP`, `ESCALATE`.
- Decision mode enum: `FULL`, `CONSTRAINED`, `REQUIRES_REATTESTATION`, `REQUIRES_HUMAN_APPROVAL`, `FAILED_CLOSED`.
