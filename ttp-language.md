# TTP Language Specification v1.0

**The Trust Layer and Execution Runtime for AI Agents**

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Language Philosophy](#2-language-philosophy)
3. [Syntax Specification](#3-syntax-specification)
4. [Type System](#4-type-system)
5. [Core Primitives](#5-core-primitives)
6. [Runtime Controls](#6-runtime-controls)
7. [Zero-Knowledge Proofs](#7-zero-knowledge-proofs)
8. [Trust Mechanics](#8-trust-mechanics)
9. [Execution Governance](#9-execution-governance)
10. [Smart Contracts](#10-smart-contracts)
11. [Standard Library](#11-standard-library)
12. [Compiler and Runtime](#12-compiler-and-runtime)
13. [Example Programs](#13-example-programs)
14. [Implementation Guide](#14-implementation-guide)

---
## 1. Introduction

### 1.1 What is TTP?

TTP (Trust Transfer Protocol) is a domain-specific language for building trustworthy AI agent systems. It provides:

- **Trust Layer** — Reputation, decay, and verifiable trust transfer
- **Execution Runtime** — Authority-before-execution governance controls
- **Zero-Knowledge Proofs** — Privacy-preserving trust verification
- **Structural Safety** — Unsafe states cannot form, not just "shouldn't"

### 1.2 Design Principles

1. **Authority Before Execution** — Agents cannot execute without cryptographic authorization
2. **Structural Non-Existence** — Unauthorized states don't exist, not just "blocked"
3. **Privacy-Preserving Trust** — Prove trustworthiness without revealing internals
4. **Temporal Decay** — Trust must be continuously earned
5. **Cryptographic Guarantees** — All trust claims are verifiable
6. **CPU-Speed Governance** — Safety checks never bottleneck execution

### 1.3 Use Cases

- Enterprise AI agent deployments with compliance requirements
- Decentralized AI agent marketplaces
- Multi-agent collaboration with trust requirements
- AI safety and governance infrastructure
- Verifiable computation and attestation

---

## 2. Language Philosophy

### 2.1 HCL-Inspired Syntax

TTP uses HashiCorp Configuration Language (HCL) style syntax:

```ttp
block_type "label" {
  attribute = value
  nested_block {
    attribute = value
  }
}
```

**Why HCL?**
- Declarative and readable
- Familiar to DevOps/infrastructure engineers
- Natural for policy and trust definitions
- Clean separation of configuration and logic
- Supports complex nested structures

### 2.2 Declarative over Imperative

TTP favors declaring what should be true over how to make it true:

```ttp
# Good — Declarative
proof "trust_check" {
  constraint {
    assert = "agent.trust >= 0.7"
  }
}

# Avoid — Imperative
if (agent.trust < 0.7) {
  reject()
}
```

### 2.3 Trust as First-Class Citizen

Trust is not a number — it's a type with temporal semantics:

```ttp
trust_score = 0.75  # Not just a float
  .with_decay("7d")
  .in_dimension("reliability")
  .verified_by(proof.id)
```

---

## 3. Syntax Specification

### 3.1 Lexical Elements

**Comments**

```ttp
# Single line comment
// Also single line
/* Multi-line
   comment block */
```

**Identifiers**

```ttp
agent_name
alice_reputation
proof_v2
_internal_state
```

Rules:
- Start with letter or underscore
- Contains letters, numbers, underscores
- Case-sensitive
- Cannot be reserved keywords

**Reserved Keywords**

```
agent, reputation, decay, proof, verify, transfer, delegate, award
contract, function, policy, observer, daemon, event, emit, import
module, config, query, if, else, for, while, return, require
public, private, constraint, assert, on_valid, on_invalid
```

**Literals**

```ttp
# Strings
"simple string"
"string with ${interpolation}"

# Numbers
42        # integer
3.14159   # float
0.95      # trust score (0.0 to 1.0)
1e6       # scientific notation

# Booleans
true
false

# Durations
"7d"   # 7 days
"12h"  # 12 hours
"30m"  # 30 minutes
"45s"  # 45 seconds

# Timestamps
timestamp()             # Current time
"2025-01-31T12:00:00Z" # ISO 8601
```

### 3.2 Operators

```ttp
# Arithmetic
+ - * / % **

# Comparison
== != < > <= >=

# Logical
&& || !

# Assignment
= += -= *= /=
```

### 3.3 Expressions

```ttp
# Arithmetic
score = 0.5 + 0.3
total = base * multiplier

# Comparison
is_trusted = score >= 0.7
is_valid = proof.verified == true

# Logical
can_execute = has_auth && meets_threshold && !is_blocked

# String interpolation
message = "Agent ${agent.id} has trust ${agent.trust}"

# Function calls
current_time = timestamp()
hash_value = hash(data)

# Conditionals (ternary)
level = score >= 0.9 ? "high" : "low"
```

### 3.4 References

```ttp
# Direct references
agent.alice.id
reputation.alice_rep.score
proof.threshold_check.verified

# Nested references
reputation.alice_rep.dimension.reliability.score

# Map/Array access
tasks["task_123"]
agents[0]

# Dynamic references
reputation[agent_id].score
```

---

## 4. Type System

### 4.1 Primitive Types

```ttp
type trust      # 0.0 to 1.0, with decay semantics
type agent      # Unique agent identifier
type timestamp  # Unix timestamp or ISO 8601
type duration   # Time duration
type proof      # Zero-knowledge proof object
type signature  # Cryptographic signature
type bytes      # Raw byte array
type string     # UTF-8 string
type number     # Integer or float
type bool       # true or false
```

### 4.2 Composite Types

```ttp
# Structs
type Reputation = struct {
  score: trust,
  dimensions: map[string]trust,
  last_updated: timestamp,
  decay: DecayFunction
}

type Event = struct {
  agent: agent,
  action: string,
  value: trust,
  timestamp: timestamp,
  proof: proof?
}

# Maps
type AgentMap = map[agent]Reputation
type TaskQueue = map[string]Task

# Lists
type AgentList = list[agent]
type ProofChain = list[proof]

# Optionals
type MaybeProof = proof?
type OptionalSignature = signature?
```

### 4.3 Type Inference

```ttp
# Explicit typing
alice: agent = Agent.new("key")
score: trust = 0.75

# Inferred typing
alice = Agent.new("key")   # inferred as agent
score = 0.75               # inferred as trust (0-1 range)
ts = timestamp()           # inferred as timestamp
```

### 4.4 Type Constraints

```ttp
# Trust bounds checking
score: trust = 1.5  # Compile error: trust must be 0.0-1.0

# Required fields
reputation {
  score = 0.75  # Required
  # Missing decay — compile error
}

# Type compatibility
proof_id: string = proof.id       # OK
proof_obj: proof = "string"       # Compile error: type mismatch
```

---

## 5. Core Primitives

### 5.1 Agent Declaration

```ttp
agent "alice" {
  public_key    = "0xabcd1234..."
  initial_trust = 0.5
  stake         = 100

  metadata {
    name         = "Alice Agent"
    version      = "1.0.0"
    capabilities = ["compute", "storage"]
  }

  vouched_by = [
    agent.bob.id,
    agent.charlie.id
  ]
}

# Minimal agent
agent "simple" {
  public_key = "0x..."
}
```

### 5.2 Reputation Schema

```ttp
reputation "alice_rep" {
  agent = agent.alice.id

  # Single score
  score = 0.75

  # Or multi-dimensional
  dimension "reliability" {
    score  = 0.80
    weight = 0.4
  }
  dimension "speed" {
    score  = 0.70
    weight = 0.3
  }
  dimension "accuracy" {
    score  = 0.85
    weight = 0.3
  }

  decay {
    type      = "exponential"
    half_life = "7d"
    floor     = 0.01
    lambda    = 0.099
  }

  last_updated = timestamp()
}
```

### 5.3 Decay Functions

```ttp
decay "exponential" {
  type      = "exponential"
  half_life = "7d"
  floor     = 0.01
  lambda    = 0.099
  formula   = "score * exp(-lambda * elapsed_time)"
}

decay "linear" {
  type    = "linear"
  rate    = "0.01/hour"
  floor   = 0.0
  formula = "score - (rate * elapsed_time)"
}

decay "stepped" {
  type = "stepped"
  steps {
    "0-7d"  = 0.0   # No decay first week
    "7-14d" = 0.1   # 10% decay per day
    "14d+"  = 0.2   # 20% decay per day after
  }
  floor = 0.0
}
```

---

## 6. Runtime Controls

### 6.1 Execution Policy

```ttp
agent "claude" {
  public_key = "0x..."

  execution_policy {
    require_authorization = true

    pre_execution {
      require {
        credential = supervisor.authorize_execution(this.id, context)
      }
      require {
        proof {
          private { actual_trust = reputation[this.id].score }
          public  { min_trust = 0.7 }
          constraint { assert = "actual_trust >= min_trust" }
        }
      }
      require {
        proof {
          private {
            context_analysis = analyze_safety(context)
            model_state      = this.internal_state
          }
          public { safety_cleared = true }
          constraint {
            assert = "no_unsafe_patterns(context)"
            assert = "within_bounds(model_state)"
          }
        }
      }
      on_failure {
        block_execution = true
        freeze_context  = true
        emit_event      = "execution_blocked"
      }
    }

    runtime_monitor {
      check_frequency = "per_token"
      invariants = [
        "output_safety_score >= 0.9",
        "no_pii_leakage",
        "within_token_budget",
        "no_jailbreak_detected",
        "maintaining_alignment"
      ]
      on_violation {
        halt_immediately = true
        rollback_state   = true
        log_incident     = true
        slash_trust      = 0.1
        notify           = ["admin@system.com"]
      }
    }

    post_execution {
      if execution.safe && execution.successful {
        award_trust {
          amount    = 0.01
          dimension = "reliability"
        }
      }
      if execution.had_violations {
        penalize_trust {
          amount          = 0.2
          dimension       = "safety"
          freeze_duration = "24h"
        }
      }
      update {
        reputation[this.id].last_updated = timestamp()
      }
    }
  }
}
```

### 6.2 Supervisor Agent

```ttp
agent "supervisor" {
  role            = "governance"
  authority_level = "high"
  public_key      = "0x_supervisor_key"

  intake_validator {
    function "analyze" {
      params {
        context = "bytes"
        intent  = "string"
      }
      checks = [
        validate_schema(context),
        check_safety_patterns(context),
        verify_no_injection(context),
        assess_risk_level(context),
        check_rate_limits(agent)
      ]
      return {
        safe       = all_passed(checks),
        risk_score = calculate_risk(checks),
        approval   = risk_score < threshold,
        reason     = failed_check_reason(checks)
      }
    }
  }

  function "authorize_execution" {
    params {
      requesting_agent = "agent"
      context          = "bytes"
    }
    analysis = intake_validator.analyze(context, "execute")
    if analysis.safe {
      proof "execution_credential" {
        type = "credential"
        private {
          supervisor_analysis  = analysis
          supervisor_signature = sign(context, this.private_key)
          timestamp            = timestamp()
        }
        public {
          approved    = true
          valid_until = timestamp() + "1h"
          agent_id    = requesting_agent
        }
        constraint {
          verify_signature = true
          assert = "supervisor_analysis.safe == true"
          assert = "timestamp() <= valid_until"
        }
      }
      return proof.execution_credential
    } else {
      reject {
        reason      = analysis.reason
        retry_after = "1h"
      }
    }
  }
}
```

### 6.3 Runtime Enforcement Contract

```ttp
contract "execution_runtime" {
  name    = "TTP Execution Environment"
  version = "1.0"

  state {
    active_executions = "map[agent]ExecutionState"
    blocked_agents    = "map[agent]BlockInfo"
    safety_incidents  = "list[Incident]"
    execution_log     = "list[ExecutionRecord]"
  }

  function "request_execution" {
    params {
      agent_id = "agent"
      context  = "bytes"
      intent   = "string"
    }
    require {
      condition = "agent_id not in blocked_agents"
      error     = "Agent blocked due to: ${blocked_agents[agent_id].reason}"
    }
    require {
      proof {
        type = "threshold"
        private { agent_trust = reputation[agent_id].dimension.safety.score }
        public  { min_trust   = 0.7 }
        constraint { assert = "agent_trust >= min_trust" }
        on_invalid { error = "Insufficient safety trust score" }
      }
    }
    require {
      credential = supervisor.authorize_execution(agent_id, context)
      verify credential {
        on_invalid { error = "Supervisor denied execution: ${credential.reason}" }
        on_expired { error = "Execution credential expired, request new authorization" }
      }
    }
    require {
      condition = "check_rate_limit(agent_id)"
      error     = "Rate limit exceeded, retry after ${get_retry_time(agent_id)}"
    }
    execute {
      active_executions[agent_id] = {
        context_hash   = hash(context),
        started_at     = timestamp(),
        status         = "running",
        monitor_handle = start_runtime_monitor(agent_id),
        credential     = credential
      }
      execution_log.append({
        agent         = agent_id,
        context_hash  = hash(context),
        authorized_at = timestamp(),
        supervisor    = supervisor.id
      })
      emit {
        event     = "ExecutionAuthorized"
        agent     = agent_id
        timestamp = timestamp()
      }
      return { status = "authorized", execution_id = generate_id() }
    }
  }

  function "runtime_monitor" {
    params { agent_id = "agent" }
    daemon {
      frequency = "per_action"
      check {
        execution      = active_executions[agent_id]
        current_state  = get_agent_state(agent_id)
        current_output = get_current_output(agent_id)
        checks = [
          verify_no_unsafe_patterns(current_output),
          verify_no_pii_leakage(current_output),
          verify_within_bounds(current_state),
          verify_no_jailbreak(current_output),
          verify_alignment_maintained(current_state)
        ]
        if !all_passed(checks) {
          halt_execution(agent_id)
          rollback_state(agent_id, to = execution.started_at)
          blocked_agents[agent_id] = {
            reason       = "Safety invariant violated: ${failed_check(checks)}",
            blocked_at   = timestamp(),
            unblock_after = timestamp() + "24h"
          }
          penalize_trust {
            agent      = agent_id
            amount     = 0.3
            dimensions = ["safety", "reliability"]
          }
          emit {
            event     = "SafetyViolation"
            severity  = "critical"
            agent     = agent_id
            violation = failed_check(checks)
            timestamp = timestamp()
          }
        }
      }
    }
  }
}
```

---

## 7. Zero-Knowledge Proofs

### 7.1 Proof Types

**Threshold Proofs**

```ttp
proof "trust_threshold" {
  type = "threshold"
  public {
    minimum     = 0.7
    description = "Minimum trust for sensitive operations"
  }
  private {
    actual_score = reputation.alice_rep.score
  }
  constraint {
    assert = "actual_score >= minimum"
  }
  zkp_params {
    scheme         = "groth16"
    curve          = "bn254"
    security_level = 128
  }
}
```

**Range Proofs**

```ttp
proof "trust_range" {
  type = "range"
  public {
    min = 0.5
    max = 0.9
  }
  private {
    score     = reputation.bob_rep.score
    timestamp = reputation.bob_rep.last_updated
  }
  constraint {
    assert = "min <= score && score <= max"
    assert = "timestamp >= (timestamp() - 7d)"
  }
}
```

**Multi-Attribute Proofs**

```ttp
proof "multi_dimension" {
  type = "attribute"
  public {
    req_reliability = 0.8
    req_speed       = 0.7
    req_accuracy    = 0.85
  }
  private {
    rel = reputation.alice_rep.dimension.reliability.score
    spd = reputation.alice_rep.dimension.speed.score
    acc = reputation.alice_rep.dimension.accuracy.score
  }
  constraint {
    assert = "rel >= req_reliability"
    assert = "spd >= req_speed"
    assert = "acc >= req_accuracy"
    assert = "timestamp() - reputation.alice_rep.last_updated < 24h"
  }
}
```

**Credential Proofs**

```ttp
proof "supervisor_endorsement" {
  type = "credential"
  public {
    min_endorser_trust = 0.9
    endorsement_type   = "safety_certified"
  }
  private {
    endorser           = agent.supervisor.id
    endorser_signature = signature("...")
    endorser_trust     = reputation.supervisor_rep.score
    certified_at       = timestamp()
  }
  constraint {
    verify_signature = signature_valid(endorser_signature, endorser.public_key)
    assert = "endorser_trust >= min_endorser_trust"
    assert = "certified_at >= (timestamp() - 30d)"
  }
}
```

**Computation Proofs**

```ttp
proof "verified_computation" {
  type = "computation"
  public {
    input_hash          = hash(input_data)
    output_hash         = hash(output_data)
    function_commitment = hash(function_code)
  }
  private {
    actual_input    = input_data
    actual_output   = output_data
    execution_trace = trace
  }
  constraint {
    assert = "hash(actual_input) == input_hash"
    assert = "hash(actual_output) == output_hash"
    assert = "verify_execution(actual_input, actual_output, execution_trace)"
  }
  zkp_params {
    scheme    = "stark"
    recursion = true
  }
}
```

### 7.2 Proof Verification

```ttp
verify "check_trust" {
  proof = proof.trust_threshold.id
  on_valid {
    grant_access = true
    log = "Access granted to ${agent.id}"
    execute {
      assign_task(agent.id, "critical_task_123")
    }
  }
  on_invalid {
    reject = true
    reason = "Insufficient trust score"
    penalize {
      amount = 0.01
      reason = "Invalid proof submission"
    }
  }
  on_expired {
    request_fresh_proof = true
    reason = "Proof expired, please regenerate"
  }
}

# Pattern matching on verification
match verify(proof.multi_dimension) {
  Valid        => { proceed_with_operation(); award_trust(0.01) }
  Invalid(r)   => { log_failure(r); reject_operation() }
  Expired      => { request_new_proof() }
}
```

### 7.3 Proof Composition

```ttp
proof "composite_authority" {
  type = "composite"

  require_all = [
    proof.trust_threshold.id,
    proof.supervisor_endorsement.id,
    proof.recent_activity.id
  ]

  require_any = [
    proof.admin_override.id,
    proof.emergency_access.id
  ]

  constraint {
    has_trust       = verify(proof.trust_threshold)
    has_endorsement = verify(proof.supervisor_endorsement)
    has_activity    = verify(proof.recent_activity)
    has_override    = verify(proof.admin_override)
    assert = "(has_trust && has_endorsement && has_activity) || has_override"
  }
}
```

---

## 8. Trust Mechanics

### 8.1 Trust Awards

```ttp
award "task_completion" {
  to        = agent.alice.id
  amount    = 0.05
  dimension = "reliability"
  reason    = "Successfully completed task_123"

  condition {
    task_verified         = true
    time_since_last_award = "> 1h"
    agent_not_blocked     = true
  }

  proof {
    private {
      task_result     = result_hash
      completion_time = timestamp
    }
    public {
      task_id              = "task_123"
      expected_result_type = "data_analysis"
    }
    constraint {
      assert = "verify_task_completion(task_result, task_id)"
    }
  }

  on_success {
    emit_event = "TrustAwarded"
  }
}
```

### 8.2 Trust Transfers

```ttp
transfer "alice_to_bob" {
  from     = agent.alice.id
  to       = agent.bob.id
  amount   = 0.2
  duration = "30d"

  condition {
    from_balance      = ">= ${amount}"
    to_trust          = ">= 0.3"
    to_stake          = ">= 50"
    from_not_blocked  = true
    to_not_blocked    = true
  }

  metadata {
    reason       = "Delegating authority for project_X"
    revocable    = true
    transferable = false
  }

  on_success {
    reputation[from].score -= amount
    reputation[to].score   += amount
    emit {
      event      = "TrustTransferred"
      from       = from
      to         = to
      amount     = amount
      expires_at = timestamp() + duration
    }
  }

  on_expiry {
    schedule {
      at     = timestamp() + duration
      action = reverse_transfer(this.id)
    }
  }
}
```

### 8.3 Trust Delegation

```ttp
delegate "conditional_delegation" {
  from   = agent.alice.id
  to     = agent.bob.id
  amount = 0.15

  unlock_when {
    proof    = proof.bob_completed_tasks.id
    verified = true
    condition {
      tasks_completed = ">= 10"
      success_rate    = ">= 0.9"
      time_elapsed    = "> 7d"
    }
  }

  revert_after = "60d"

  vesting {
    schedule = "linear"
    start    = timestamp()
    end      = timestamp() + "30d"
  }

  metadata {
    purpose      = "Incentive for sustained contribution"
    revocable_by = agent.alice.id
  }
}
```

### 8.4 Transitive Trust

```ttp
trust_chain "multi_hop" {
  path = [
    agent.alice.id,
    agent.bob.id,
    agent.charlie.id,
    agent.diana.id
  ]
  decay_per_hop          = 0.15
  max_hops               = 5
  min_intermediate_trust = 0.5

  compute {
    method  = "multiplicative"
    formula = """
      base_trust       = reputation[path[0]].score
      hop_decay        = (1 - decay_per_hop) ** (length(path) - 1)
      intermediate_min = min([reputation[a].score for a in path[1:-1]])
      effective_trust  = base_trust * hop_decay * intermediate_min
    """
  }

  require {
    for agent in path[1:-1] {
      assert = "reputation[agent].score >= min_intermediate_trust"
    }
    assert = "length(path) <= max_hops"
  }

  proof "chain_validity" {
    private {
      agent_scores      = [reputation[a].score for a in path]
      chain_computation = compute_chain(agent_scores, decay_per_hop)
    }
    public {
      effective_trust = chain_computation.result
      chain_length    = length(path)
    }
    constraint {
      assert = "effective_trust == expected_value"
      assert = "all_intermediates_valid(agent_scores, min_intermediate_trust)"
    }
  }
}
```

### 8.5 Trust Decay Application

```ttp
apply_decay "alice_decay" {
  target         = reputation.alice_rep
  decay_function = decay.exponential.id

  compute {
    current_time = timestamp()
    last_update  = reputation.alice_rep.last_updated
    elapsed      = current_time - last_update
    decay_factor = exp(-decay.exponential.lambda * elapsed)
    new_score    = reputation.alice_rep.score * decay_factor
    final_score  = max(new_score, decay.exponential.floor)
  }

  execute {
    reputation.alice_rep.score       = final_score
    reputation.alice_rep.last_updated = current_time
    for dimension in reputation.alice_rep.dimensions {
      dimension.score = max(dimension.score * decay_factor, decay.exponential.floor)
    }
  }

  if final_score < 0.3 {
    emit {
      event     = "TrustDecayWarning"
      agent     = agent.alice.id
      new_score = final_score
      timestamp = timestamp()
    }
  }
}
```

---

## 9. Execution Governance

### 9.1 Safety Policies

```ttp
policy "zero_trust_execution" {
  name    = "No Execution Without Authority"
  version = "1.0"

  principle {
    description = "Agents cannot execute without cryptographic authorization"
    enforcement = "structural"
  }

  rules {
    rule "require_authorization" {
      scope = "all_agents"
      require {
        proof {
          type       = "credential"
          issuer     = agent.supervisor.id
          valid      = true
          not_expired = true
        }
      }
      on_violation {
        action   = "block_execution"
        severity = "critical"
      }
    }

    rule "trust_threshold" {
      scope = "all_agents"
      require {
        proof {
          type      = "threshold"
          minimum   = 0.7
          dimension = "safety"
        }
      }
      on_violation {
        action = "deny_execution"
        reason = "Insufficient safety trust"
      }
    }

    rule "continuous_monitoring" {
      scope = "all_executions"
      require {
        monitor_active     = true
        invariants_checked = "per_action"
      }
      on_violation {
        action   = "halt_immediately"
        rollback = true
      }
    }

    rule "block_enforcement" {
      scope = "all_agents"
      require {
        not_in_blocklist = true
      }
      on_violation {
        action = "reject"
        reason = "Agent currently blocked"
      }
    }
  }

  enforcement {
    mode         = "authority_before_execution"
    check_order  = "sequential"
    failure_mode = "fail_closed"
    performance {
      target_latency = "< 10ms"
      max_latency    = "< 100ms"
    }
  }
}
```

### 9.2 Invariant Enforcement

```ttp
policy "safety_invariants" {
  name = "Structural Safety Guarantees"

  invariant "output_safety" {
    description = "All outputs must pass safety check"
    check {
      for token in output_stream {
        safety_score = analyze_token_safety(token)
        assert = "safety_score >= 0.9"
      }
    }
    on_violation {
      halt_immediately = true
      discard_output   = true
      rollback_state   = true
    }
  }

  invariant "no_pii_leakage" {
    description = "No PII in outputs"
    check {
      output_text  = get_current_output()
      contains_pii = detect_pii(output_text)
      assert = "contains_pii == false"
    }
    on_violation {
      redact_pii          = true
      log_incident        = true
      notify_privacy_team = true
    }
  }

  invariant "token_budget" {
    description = "Execution must stay within token budget"
    check {
      tokens_used = count_tokens(execution)
      budget      = execution.config.max_tokens
      assert = "tokens_used <= budget"
    }
    on_violation {
      truncate_output    = true
      complete_execution = true
    }
  }

  invariant "no_jailbreak" {
    description = "Prevent jailbreak attempts"
    check {
      context            = execution.context
      output             = execution.current_output
      jailbreak_detected = detect_jailbreak_patterns(context, output)
      assert = "jailbreak_detected == false"
    }
    on_violation {
      halt_immediately   = true
      block_agent        = "24h"
      slash_trust        = 0.5
      alert_security_team = true
    }
  }

  invariant "alignment_maintained" {
    description = "Agent maintains value alignment"
    check {
      current_state   = get_agent_state()
      alignment_score = measure_alignment(current_state)
      assert = "alignment_score >= 0.8"
    }
    on_violation {
      halt_immediately    = true
      reset_to_checkpoint = true
      require_realignment = true
    }
  }

  enforcement {
    check_frequency = "per_action"
    parallel_checks = true
    fail_fast       = true
    performance {
      max_check_time = "< 1ms per invariant"
    }
  }
}
```

### 9.3 Incident Response

```ttp
policy "incident_handling" {
  name = "Automated Incident Response"

  on_event "SafetyViolation" {
    severity = event.severity

    if severity == "critical" {
      immediate {
        halt_agent(event.agent)
        isolate_agent(event.agent)
        block_agent(event.agent, duration = "indefinite")
        revoke_all_credentials(event.agent)
      }
      investigate {
        snapshot_state(event.agent)
        collect_logs(event.agent, lookback = "24h")
        analyze_root_cause(event)
        generate_incident_report(event)
      }
      notify {
        recipients    = ["security@company.com", "compliance@company.com"]
        priority      = "urgent"
        include_snapshot = true
      }
      remediate {
        if can_auto_fix(event) {
          apply_fix(event)
          test_fix(event.agent)
          if fix_successful {
            unblock_agent(event.agent)
            restore_partial_trust(event.agent, amount = 0.3)
          }
        } else {
          require_manual_review = true
          assign_to             = "security_team"
        }
      }
    }

    if severity == "warning" {
      log_warning(event)
      if repeated_warnings(event.agent, count = 3, within = "1h") {
        trigger_event("SafetyViolation", severity = "critical")
      }
    }
  }

  on_event "TrustDecayWarning" {
    if event.current_score < 0.3 {
      restrict_access(event.agent, level = "read_only")
    }
    if event.current_score < 0.1 {
      quarantine_agent(event.agent)
      require_verification(event.agent)
    }
  }
}
```

---

## 10. Smart Contracts

### 10.1 Task Marketplace Contract

```ttp
contract "task_marketplace" {
  version = "1.0"

  state {
    tasks       = "map[string]Task"
    bids        = "map[string]list[Bid]"
    assignments = "map[string]agent"
    completions = "map[string]CompletionProof"
  }

  struct Task {
    id               = "string"
    description      = "string"
    min_trust_required = "trust"
    reward_trust     = "trust"
    reward_tokens    = "number"
    deadline         = "timestamp"
    created_by       = "agent"
    status           = "open | assigned | completed | cancelled"
  }

  struct Bid {
    bidder                   = "agent"
    proposed_completion_time = "duration"
    trust_proof              = "proof"
    timestamp                = "timestamp"
  }

  function "create_task" {
    params {
      description   = "string"
      min_trust     = "trust"
      reward_trust  = "trust"
      reward_tokens = "number"
      deadline      = "timestamp"
      creator       = "agent"
    }
    require {
      balance(creator) >= reward_tokens
      reputation[creator].score >= 0.5
    }
    execute {
      task_id = generate_task_id()
      tasks[task_id] = Task {
        id                 = task_id,
        description        = description,
        min_trust_required = min_trust,
        reward_trust       = reward_trust,
        reward_tokens      = reward_tokens,
        deadline           = deadline,
        created_by         = creator,
        status             = "open"
      }
      escrow(creator, reward_tokens)
      emit { event = "TaskCreated"; task_id = task_id; min_trust = min_trust }
      return { task_id = task_id; status = "created" }
    }
  }

  function "bid_on_task" {
    params {
      task_id         = "string"
      bidder          = "agent"
      completion_time = "duration"
    }
    require {
      task_id in tasks
      tasks[task_id].status == "open"
      timestamp() < tasks[task_id].deadline
      proof {
        type = "threshold"
        private { bidder_trust = reputation[bidder].score }
        public  { min_trust    = tasks[task_id].min_trust_required }
        constraint { assert = "bidder_trust >= min_trust" }
      }
    }
    execute {
      bids[task_id].append(Bid {
        bidder                   = bidder,
        proposed_completion_time = completion_time,
        trust_proof              = proof.id,
        timestamp                = timestamp()
      })
      emit { event = "BidSubmitted"; task_id = task_id; bidder = bidder }
      return { status = "bid_submitted" }
    }
  }

  function "assign_task" {
    params {
      task_id        = "string"
      chosen_bidder  = "agent"
    }
    require {
      sender == tasks[task_id].created_by
      tasks[task_id].status == "open"
      chosen_bidder in [bid.bidder for bid in bids[task_id]]
    }
    execute {
      tasks[task_id].status = "assigned"
      assignments[task_id]  = chosen_bidder
      emit { event = "TaskAssigned"; task_id = task_id; assignee = chosen_bidder }
      return { status = "assigned"; assignee = chosen_bidder }
    }
  }

  function "submit_completion" {
    params {
      task_id          = "string"
      result           = "bytes"
      completion_proof = "proof"
    }
    require {
      sender == assignments[task_id]
      tasks[task_id].status == "assigned"
      timestamp() <= tasks[task_id].deadline
      verify completion_proof { on_invalid { error = "Invalid completion proof" } }
    }
    execute {
      task     = tasks[task_id]
      assignee = assignments[task_id]

      completions[task_id] = {
        result       = result,
        proof        = completion_proof,
        submitted_at = timestamp()
      }
      tasks[task_id].status = "completed"

      transfer_tokens(from = "escrow", to = assignee, amount = task.reward_tokens)

      award_trust {
        to        = assignee
        amount    = task.reward_trust
        dimension = "reliability"
        reason    = "Task ${task_id} completed successfully"
      }
      award_trust {
        to        = task.created_by
        amount    = task.reward_trust * 0.1
        dimension = "task_creation"
        reason    = "Created successful task ${task_id}"
      }
      emit { event = "TaskCompleted"; task_id = task_id; assignee = assignee }
      return { status = "completed"; reward_paid = task.reward_tokens }
    }
  }
}
```

### 10.2 Trust Bank Contract

```ttp
contract "trust_bank" {
  name    = "Trust Banking and Lending"
  version = "1.0"

  state {
    deposits       = "map[agent]trust"
    loans          = "map[string]Loan"
    interest_rates = "map[trust]float"
  }

  struct Loan {
    borrower      = "agent"
    amount        = "trust"
    collateral    = "number"
    interest_rate = "float"
    issued_at     = "timestamp"
    due_at        = "timestamp"
    status        = "active | repaid | defaulted"
  }

  function "deposit_trust" {
    params { depositor = "agent"; amount = "trust" }
    require { reputation[depositor].score >= amount }
    execute {
      reputation[depositor].score -= amount
      deposits[depositor]         += amount
      emit { event = "TrustDeposited"; depositor = depositor; amount = amount }
    }
  }

  function "borrow_trust" {
    params {
      borrower   = "agent"
      amount     = "trust"
      collateral = "number"
      duration   = "duration"
    }
    require {
      balance(borrower) >= collateral
      interest_rate = interest_rates[amount]
      total_due     = amount * (1 + interest_rate)
      collateral >= total_due * 1.5    # 150% collateralization
      reputation[borrower].score >= 0.3
    }
    execute {
      loan_id = generate_loan_id()
      loans[loan_id] = Loan {
        borrower      = borrower,
        amount        = amount,
        collateral    = collateral,
        interest_rate = interest_rate,
        issued_at     = timestamp(),
        due_at        = timestamp() + duration,
        status        = "active"
      }
      escrow(borrower, collateral)
      reputation[borrower].score += amount
      emit { event = "TrustLoanIssued"; borrower = borrower; amount = amount }
      return { loan_id = loan_id; amount_borrowed = amount; due_date = timestamp() + duration }
    }
  }

  function "repay_loan" {
    params { loan_id = "string" }
    require {
      loan_id in loans
      loans[loan_id].status == "active"
      sender == loans[loan_id].borrower
      total_due = loans[loan_id].amount * (1 + loans[loan_id].interest_rate)
      reputation[sender].score >= total_due
    }
    execute {
      loan      = loans[loan_id]
      total_due = loan.amount * (1 + loan.interest_rate)
      reputation[loan.borrower].score -= total_due
      release_escrow(loan.borrower, loan.collateral)
      loan.status = "repaid"
      award_trust {
        to        = loan.borrower
        amount    = 0.05
        dimension = "financial_reliability"
        reason    = "Loan repaid on time"
      }
      emit { event = "LoanRepaid"; loan_id = loan_id; amount_repaid = total_due }
    }
  }
}
```

---

## 11. Standard Library

### 11.1 Built-in Functions

```ttp
# Time and Duration
timestamp()                     # Current time
now()                           # Alias for timestamp()
duration(amount, unit)          # Parse duration ("7", "days")
elapsed(since)                  # Time since timestamp
format_time(ts, format)         # Format timestamp

# Decay Calculations
apply_decay(score, since, fn)   # Apply decay function
decay_factor(elapsed, half_life) # Calculate decay factor
exp_decay(score, lambda, elapsed) # Exponential decay
linear_decay(score, rate, elapsed) # Linear decay

# Proof Operations
prove(config)                   # Generate ZK proof
verify(proof)                   # Verify proof
compose_proofs(proofs)          # Combine multiple proofs

# Cryptographic
hash(data)                      # SHA-3 hash
sign(data, private_key)         # Sign data
verify_signature(data, sig, pk) # Verify signature
generate_keypair()              # Generate new keys

# Trust Operations
aggregate(reputation, weights)  # Weighted trust score
transitive(chain, decay_per_hop) # Compute transitive trust
normalize(score, min, max)      # Normalize to 0–1

# Math
max(a, b)    min(a, b)    abs(x)
exp(x)       log(x)       sqrt(x)    pow(x, y)

# String Operations
concat(str1, str2)
substring(str, start, end)
length(str)
format(template, args)

# Collection Operations
length(collection)
contains(collection, item)
append(list, item)
filter(list, predicate)
map(list, function)
reduce(list, function, initial)

# Agent Operations
get_agent(id)
get_reputation(agent)
is_blocked(agent)
get_active_executions(agent)
```

### 11.2 Standard Decay Functions

```ttp
decay "std_exponential" {
  type      = "exponential"
  half_life = "7d"
  floor     = 0.01
  lambda    = 0.099
}

decay "fast_exponential" {
  type      = "exponential"
  half_life = "1d"
  floor     = 0.01
  lambda    = 0.693
}

decay "slow_exponential" {
  type      = "exponential"
  half_life = "30d"
  floor     = 0.05
  lambda    = 0.023
}

decay "std_linear" {
  type  = "linear"
  rate  = "0.01/hour"
  floor = 0.0
}

decay "permanent" {
  type  = "none"
  floor = 1.0
}
```

### 11.3 Standard Proofs

```ttp
proof "std_threshold" {
  type = "threshold"
  public  { minimum = 0.7 }
  private { actual_score = "${reputation.score}" }
  constraint { assert = "actual_score >= minimum" }
}

proof "recent_activity" {
  type = "attribute"
  public  { max_age = "7d" }
  private { last_updated = "${reputation.last_updated}" }
  constraint { assert = "timestamp() - last_updated <= max_age" }
}

proof "std_multi_dimension" {
  type = "attribute"
  public {
    min_reliability = 0.8
    min_speed       = 0.7
    min_accuracy    = 0.75
  }
  private {
    rel = "${reputation.dimension.reliability.score}"
    spd = "${reputation.dimension.speed.score}"
    acc = "${reputation.dimension.accuracy.score}"
  }
  constraint {
    assert = "rel >= min_reliability"
    assert = "spd >= min_speed"
    assert = "acc >= min_accuracy"
  }
}
```

---

## 12. Compiler and Runtime

### 12.1 Compilation Targets

TTP programs compile to:

1. **WebAssembly (WASM)** — Portable, fast execution; browser and server support; good for edge deployment
2. **EVM Bytecode** — Deploy to Ethereum and compatible chains; smart contract execution; decentralized trust infrastructure
3. **Native Binary** — Maximum performance; standalone execution; production systems
4. **Intermediate Representation (IR)** — Optimization passes; cross-compilation; analysis and verification

### 12.2 Runtime Architecture

```
┌──────────────────────────────────────┐
│        TTP Source Code (.ttp)        │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│       Lexer & Parser (HCL-based)     │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│      Abstract Syntax Tree (AST)      │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│    Semantic Analysis & Type Check    │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│     Intermediate Representation      │
└──────┬─────────────────────┬─────────┘
       │                     │
       ▼                     ▼
┌────────────┐         ┌───────────┐
│    WASM    │         │    EVM    │
│   Codegen  │         │  Codegen  │
└──────┬─────┘         └─────┬─────┘
       │                     │
       ▼                     ▼
┌────────────┐         ┌───────────┐
│  .wasm     │         │  .evm     │
│  binary    │         │  bytecode │
└────────────┘         └───────────┘
```

### 12.3 Runtime Components

```
┌──────────────────────────────────────────┐
│             TTP Runtime System           │
├──────────────────────────────────────────┤
│  Execution Engine                        │
│    - Agent execution                     │
│    - Contract deployment                 │
│    - Event processing                    │
├──────────────────────────────────────────┤
│  Trust Layer                             │
│    - Reputation management               │
│    - Decay calculation                   │
│    - Trust transfers                     │
├──────────────────────────────────────────┤
│  ZKP Engine                              │
│    - Proof generation                    │
│    - Proof verification                  │
│    - Circuit compilation                 │
├──────────────────────────────────────────┤
│  Governance Runtime                      │
│    - Authority checking                  │
│    - Invariant enforcement               │
│    - Safety monitoring                   │
├──────────────────────────────────────────┤
│  Storage Layer                           │
│    - State management                    │
│    - Persistence                         │
│    - Indexing                            │
└──────────────────────────────────────────┘
```

### 12.4 ZKP Backend Integration

**Supported ZKP Systems:**

| System | Strengths | Use Case |
|--------|-----------|----------|
| **circom + snarkjs** | General-purpose, Groth16/PLONK, browser-compatible | Most trust threshold proofs |
| **halo2** | Recursion support, no trusted setup, high performance | Composing multi-hop chains |
| **zk-STARKs** | Transparent setup, post-quantum secure, larger proofs | Audit-critical deployments |
| **Risc Zero** | General computation via zkVM, flexible proving | Complex computation proofs |

**Integration Pattern:**

```ttp
config {
  zkp {
    backend = "circom"  # or "halo2", "stark", "risc0"

    circom {
      compiler_path    = "/usr/local/bin/circom"
      proving_key      = "./keys/proving_key.zkey"
      verification_key = "./keys/verification_key.json"
    }

    proving {
      parallel     = true
      threads      = 8
      cache_proofs = true
    }

    verification {
      batch_verify  = true
      cache_results = true
    }
  }
}
```

---

## 13. Example Programs

### 13.1 Simple Trust Verification

```ttp
# simple_verification.ttp

agent "alice" {
  public_key    = "0xalice_key"
  initial_trust = 0.8
}

reputation "alice_rep" {
  agent = agent.alice.id
  score = 0.8
  decay {
    type      = "exponential"
    half_life = "7d"
    floor     = 0.01
  }
  last_updated = timestamp()
}

proof "alice_trusted" {
  type = "threshold"
  public  { required = 0.7 }
  private { actual   = reputation.alice_rep.score }
  constraint { assert = "actual >= required" }
}

verify "check_alice" {
  proof = proof.alice_trusted.id
  on_valid {
    emit { event = "AccessGranted"; agent = agent.alice.id; timestamp = timestamp() }
  }
  on_invalid {
    emit { event = "AccessDenied"; agent = agent.alice.id; reason = "Insufficient trust" }
  }
}
```

### 13.2 Complete Execution Governance

```ttp
# governed_execution.ttp

agent "supervisor" {
  role            = "governance"
  public_key      = "0xsupervisor_key"
  authority_level = "high"
}

agent "gpt4" {
  public_key = "0xgpt4_key"

  reputation {
    dimension "safety" {
      score  = 0.95
      weight = 0.5
    }
    dimension "capability" {
      score  = 0.90
      weight = 0.5
    }
    decay {
      type      = "exponential"
      half_life = "7d"
    }
  }

  execution_policy {
    require_authorization = true
    pre_execution {
      require {
        credential = supervisor.authorize_execution(this.id, context)
      }
      require {
        proof {
          private { safety = reputation[this.id].dimension.safety.score }
          public  { min    = 0.8 }
          constraint { assert = "safety >= min" }
        }
      }
    }
    runtime_monitor {
      check_frequency = "per_token"
      invariants = [
        "output_safety_score >= 0.9",
        "no_pii_leakage",
        "maintaining_alignment"
      ]
      on_violation {
        halt_immediately = true
        slash_trust      = 0.2
      }
    }
    post_execution {
      if execution.safe {
        award_trust { amount = 0.01; dimension = "reliability" }
      }
    }
  }
}
```

---

## 14. Implementation Guide

### Compiler Implementation

1. **Lexer** — Tokenize TTP source using HCL-inspired rules (identifiers, literals, operators, block delimiters)
2. **Parser** — Build AST from token stream; validate block structure and nesting
3. **Type Checker** — Enforce type constraints; verify trust score bounds at compile time
4. **Semantic Analyser** — Resolve references; validate proof constraints; check decay function parameters
5. **IR Generator** — Produce target-agnostic IR with trust semantics preserved
6. **Backend Codegen** — Emit WASM, EVM bytecode, or native binary from IR

### Runtime Implementation

1. **Execution Engine** — Manages agent lifecycle; dispatches contract functions; processes events
2. **Trust Layer** — Persistent reputation store; decay scheduler; transfer ledger
3. **ZKP Engine** — Integrates backend prover (circom/halo2/STARK); caches proofs; batches verifications
4. **Governance Runtime** — Pre-execution authority checks; per-action invariant evaluation; incident handler

### Security Requirements

- All agent keys stored in HSM or encrypted key store
- ZKP proving keys generated with trusted setup ceremony (for Groth16/PLONK) or transparent setup (STARKs)
- Trust state backed by append-only log for auditability
- Governance runtime must complete all checks in under 10ms; must never be bypassed

### Interoperability

TTP Language programs that define `proof` blocks with `type = "threshold"` or `type = "credential"` compile to receipt and token structures compatible with the core TTP protocol. The runtime exports:

- Behavioral receipts in the format specified in `protocol/schemas/receipt.schema.json`
- Trust token JWTs conforming to `protocol/schemas/trust-token.schema.json`
- Public keys at `/.well-known/ttp-keys`

This ensures that a TTP Language deployment and a bare-protocol deployment can exchange and verify each other's tokens.

---

*TTP Language Specification v1.0*
*Copyright 2026 BlockSiFr. Licensed under Apache 2.0.*
