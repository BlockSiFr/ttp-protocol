# TTP Visual Design System

The visual identity for the Trust Transfer Protocol. The repo should read as the
reference implementation for the **Trust-Before-Execution** category: dark,
precise, architectural, cryptographic, calm, enterprise-grade. Engineered, not
decorated.

> Metaphor: a runtime execution gate where **authority, trust, proof, and
> receipts** converge. Cyan is a precision signal, never a background fill.

---

## 1. Color tokens

| Token | Hex | Role |
| --- | --- | --- |
| Trust Black | `#0A0A0F` | Primary background |
| Cipher Dark | `#12141C` / `#101521` | Panels & cards |
| Border | `#1E2430` | Thin technical borders (1px) |
| Gridline | `#FFFFFF` @ 3% | Subtle structure |
| Signal Cyan | `#00D4FF` | Primary accent — verified trust, precision only |
| Deep Azure | `#0066CC` | Secondary accent — authorization |
| Near White | `#F0F2F5` | Primary text on dark |
| Steel Gray | `#8892A0` | Metadata, borders, subdued copy |
| Proof Green | `#00E676` | Verified / allow |
| Quantum Teal | `#00B8A9` | Protocol support / throttle |
| Drift Amber | `#FFB300` | Warning / step-up / escalate |
| Breach Red | `#FF3D00` | Deny / critical |

Functional colors map **only** to decision states: `allow` (green),
`throttle` (teal), `step-up` (amber), `escalate` (amber + flag), `deny` (red).

## 2. Typography tokens

| Use | Family | Weights |
| --- | --- | --- |
| Display / hero / headings | **Space Grotesk** | 600, 700 |
| Body / interface | **Inter** | 400, 600 |
| Code, API paths, policy, receipts, hashes, CLI | **JetBrains Mono** | 400, 500 |

GitHub Markdown cannot load custom fonts, so branded fonts live in **SVG
assets** with the real font files subset and embedded as base64 `@font-face`
(see [§7](#7-asset-build-pipeline)). Plain Markdown stays clean and accessible.

## 3. Visual principles

- Dark mode first · high contrast · generous whitespace
- Thin 1px borders (`#1E2430`); gridlines at 3–5% opacity
- Circular **trust-ring** motif; node-and-edge diagrams; small monospaced labels
- Sparse cyan highlights; no heavy gradients, glow, cyberpunk, robots, padlocks,
  or stock illustration
- Every element communicates **authority, execution, verification, or proof**

## 4. Badge system

Grouped, intentional, dark-labelled (`labelColor=0A0A0F`, `style=flat-square`):

- **Protocol status** — `spec v1.0` (cyan), `protocol TTP` (teal), `runtime in-progress` (amber), `reference Node.js` (green)
- **Security model** — `trust-model decay-enabled` (cyan), `receipts cryptographic` (teal)
- **Community** — `category agent-trust-infrastructure` (steel), `license Apache-2.0` (azure)

## 5. Label system

Canonical labels live in [`.github/labels.yml`](../../.github/labels.yml) and are
synced by [`.github/workflows/labels.yml`](../../.github/workflows/labels.yml).
`type:` (protocol/runtime/docs/examples/security), `status:`
(good-first-issue/needs-rfc), `priority:` (critical), and `area:`
(trust-decay/execution-receipts/zkp/compiler) — each colored from the palette.

## 6. Component inventory

| Component | Asset | Purpose |
| --- | --- | --- |
| Hero | `assets/ttp-hero.svg` | Above-the-fold identity + protocol flow |
| Social preview | `assets/social-preview.png` | 1280×640 share card |
| Trust ring | `assets/brand/trust-ring.svg` | Circular motif / watermark |
| Protocol loop | `assets/diagrams/protocol-loop.svg` | Identity → … → Receipt |
| Trust gap | `assets/diagrams/trust-gap.svg` | Identity vs Authorization vs TTP |
| Decision matrix | `assets/diagrams/decision-matrix.svg` | Five outcome pills |
| Authority gate | `assets/diagrams/runtime-authority-flow.svg` | Request in → decision out |
| Trust decay curve | `assets/diagrams/trust-decay-curve.svg` | Decay + attestation recharge |
| Execution receipt | `assets/diagrams/execution-receipt.svg` | Cryptographic proof card |
| Architecture stack | `assets/diagrams/architecture-stack.svg` | L0–L4 layers |
| Integration tiles | `assets/diagrams/integrations.svg` | Surfaces + status |
| Contributor path | `assets/diagrams/contributor-path.svg` | First issue → maintainer |
| Roadmap strip | `assets/diagrams/roadmap.svg` | Phase timeline |

## 7. Asset build pipeline

Sources are authored with brand `font-family` names and a `/*@FONTS@*/` marker.
The build subsets the real fonts to each file's glyphs and embeds them.

```bash
npm run assets:fonts    # embed brand fonts into every marked SVG (idempotent)
npm run assets:social   # render assets/social-preview.png from its SVG
```

Fonts (`assets/brand/fonts/*.ttf`) and scripts (`assets/brand/embed-fonts.py`,
`render-png.mjs`) are committed for reproducibility. See
[`assets/brand/README.md`](../../assets/brand/README.md).

## 8. Repository metadata

Set the GitHub description and topics:

```bash
gh repo edit --description "Trust-Before-Execution protocol for AI agents and non-human identities." \
  --add-topic ai-agents --add-topic agent-security --add-topic trust \
  --add-topic runtime-governance --add-topic zero-knowledge-proofs \
  --add-topic non-human-identity --add-topic scim --add-topic authorization \
  --add-topic protocol --add-topic execution-receipts \
  --add-topic agent-trust-infrastructure
```

## 9. Implementation checklist

- [x] Color & typography tokens defined
- [x] Hero SVG with embedded brand fonts
- [x] 1280×640 social preview PNG
- [x] Trust-ring motif
- [x] Protocol-loop, trust-gap, decision-matrix diagrams
- [x] Runtime authority flow, trust-decay curve, execution-receipt diagrams
- [x] Architecture stack, integrations, roadmap, contributor-path diagrams
- [x] README rebuilt as a visual landing page
- [x] Grouped badge strip
- [x] Label system + sync workflow
- [x] PR template, discussion templates, FUNDING
- [x] Reproducible font-embed / render build
- [ ] Set repo description + topics (run §8)
- [ ] Upload `assets/social-preview.png` in repo Settings → Social preview
- [ ] Docs site (Starlight/VitePress) — future phase
- [ ] CLI / docs screenshots — future phase
