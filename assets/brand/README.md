# TTP brand assets

Self-contained SVGs with the real brand fonts (Space Grotesk, Inter, JetBrains
Mono) subset and embedded as base64 `@font-face`, so they render identically on
GitHub — where external font loading is blocked.

## Files

- `fonts/*.ttf` — brand font faces (decompressed from `@fontsource`), used by the
  build. Committed for reproducibility.
- `embed-fonts.py` — subsets each font to the glyphs a given SVG uses and embeds
  them. Idempotent; safe to re-run. Requires `fonttools` + `brotli`.
- `render-png.mjs` — renders an SVG to PNG with the brand fonts (`@resvg/resvg-js`).
- `trust-ring.svg` / `repo-icon.svg` — decorative marks (no embedded text).

## Authoring

1. Write the SVG with brand `font-family` names and a `/*@FONTS@*/` marker as the
   first thing inside `<defs><style>`. Draw arrows/marks as vector paths — the
   latin font subsets do not include glyphs like `→` or `✓`.
2. Embed fonts and (re)render:

```bash
python3 -m venv .venv && .venv/bin/pip install fonttools brotli
.venv/bin/python assets/brand/embed-fonts.py            # all marked SVGs
node assets/brand/render-png.mjs assets/social-preview.svg assets/social-preview.png 1280
```

Or via npm from the repo root: `npm run assets:fonts` and `npm run assets:social`.

To edit an already-embedded SVG, the script strips the previous
`/*@FONTS_BEGIN@*/…/*@FONTS_END@*/` block and re-embeds, so you can keep editing
the human-readable markup and just re-run.
