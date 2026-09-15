# Isnad Chains

An isnad chain expresses the **chain of transmission** for trust: an ordered sequence of links carrying authority from a trusted root authority down to a terminal subject. The name follows the classical *isnad* — a chain of narrators whose soundness depends on every link, not just the source.

`verify_isnad_chain` records that a transmission chain was evaluated for soundness before downstream authority systems rely on the terminal subject.

## Boundary

TTP establishes trustworthiness. RAP evaluates authority. Execution Exchange enforces downstream runtime decisions in production. CortexTrace records evidence and receipts. Isnad chains express transmission continuity; they do not enforce execution.

## Soundness conditions

A chain is sound (`valid: true`) when:

* **Rooted** — the first link's issuer is the declared `rootAuthority`.
* **Continuous (muttasil)** — each link's `issuer` equals the previous link's `subject`. Any gap, self-transmission, or non-transferable intermediate breaks the chain.
* **Each link is valid** — unexpired, in scope for the requested action, issued by a trusted narrator (when `trustedAuthorities` is set), and backed by valid proof references.
* **Above the trust floor** — every link conveys at least `minLinkTrust`.

## Attenuation

Trust degrades along the chain — a longer chain conveys less, all else equal. `effectiveTrust` is computed by `attenuation` mode:

* `product` (default) — multiply every link's conveyed trust.
* `min` — grade the chain by its weakest link.
* `none` — take the terminal link's conveyed trust.

`weakestLink` identifies the link that grades the chain. With `enforceMonotonic`, a link that conveys more trust than its predecessor fails as amplification.

## Questions

* Who is the root authority of trust?
* Is the chain continuous, or is there a broken link?
* Which narrator is the weakest link?
* How much trust survives transmission to the terminal subject?
* What downstream system relies on the chain proof?
