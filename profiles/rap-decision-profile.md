# RAP Decision Profile
RAP consumes TTP proof results and returns allow/deny/step-up/throttle/escalate/constrain.

Decision mapping:
- valid proof + threshold + grant → allow
- degraded zone → throttle
- warning zone → step-up
- invalid route/delegation → deny
- anomaly/ambiguous route → escalate
- valid route with broad scope → constrain

Fail-closed: missing/invalid required proof MUST deny or escalate.
