# Trust Decay
Formula: `T(t) = T0 * exp(-lambda * deltaTime) + Σ W(ai)R(ai)`.

Trust zones: Active 0.85–1.00; Degraded 0.65–0.85; Warning 0.40–0.65; Critical 0.00–0.40.

Determinism: fixed precision, explicit timestamps, deterministic signal ordering.

Worked examples: see `examples/trust-decay-application.json`.
