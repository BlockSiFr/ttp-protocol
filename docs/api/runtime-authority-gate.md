# Runtime Authority Gate API

`POST /re/authorize`

Request fields:
- `subject`, `action`, `resource`
- `context`
- `attestationRef`
- `requestedBy`
- `paramsHash`
- `bindingHash`
- `timestamp`

Response fields:
- `decision` (`PERMIT|DENY|STEP_UP|ESCALATE|THROTTLE|CONSTRAIN`)
- `trustScore`
- `trustZone`
- `receiptId`
- `evaluationTier`
- `latencyMs`
- `route.selectedPathId`
- `reasonCodes[]`

The gate always emits an `ExecutionReceipt`.
