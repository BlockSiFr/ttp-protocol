#!/usr/bin/env python3
"""Subset the TTP brand fonts to the glyphs each SVG uses and embed them as
base64 @font-face rules. Self-contained SVGs render with true brand typography
on GitHub (where external font loading is blocked). Idempotent: re-run anytime.

Usage:  ./brand/embed-fonts.py            (from repo assets/ dir, or pass paths)
        python3 brand/embed-fonts.py assets/ttp-hero.svg
Requires fonttools + brotli (see brand/fonts/).
"""
import base64, glob, io, os, re, sys
from fontTools.subset import Subsetter, Options
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(HERE, "fonts")
FACES = [
    ("Space Grotesk", 700, "SpaceGrotesk-Bold.ttf"),
    ("Space Grotesk", 600, "SpaceGrotesk-SemiBold.ttf"),
    ("Space Grotesk", 500, "SpaceGrotesk-Medium.ttf"),
    ("Inter", 600, "Inter-SemiBold.ttf"),
    ("Inter", 400, "Inter-Regular.ttf"),
    ("JetBrains Mono", 500, "JetBrainsMono-Medium.ttf"),
    ("JetBrains Mono", 400, "JetBrainsMono-Regular.ttf"),
]
SAFETY = set(" ·–—…:/.,'&%@#-()[]+")
BEGIN, END = "/*@FONTS_BEGIN@*/", "/*@FONTS_END@*/"
MARKER = "/*@FONTS@*/"

def used_chars(svg):
    body = re.sub(r"<style.*?</style>", "", svg, flags=re.S)  # ignore CSS, count only rendered text
    text = " ".join(re.findall(r">([^<]*)<", body))
    chars = set(text) | SAFETY
    chars.discard("\n"); chars.discard("\t")
    return chars

def subset_b64(path, chars):
    opts = Options()
    opts.flavor = "woff2"
    opts.desubroutinize = True
    opts.notdef_outline = True
    opts.hinting = False
    opts.glyph_names = False
    opts.layout_features = ["kern", "liga", "calt"]
    font = TTFont(path)
    sub = Subsetter(options=opts)
    sub.populate(text="".join(sorted(chars)))
    sub.subset(font)
    font.flavor = "woff2"  # Options.flavor is not applied on save; set it on the font
    buf = io.BytesIO(); font.save(buf)
    return base64.b64encode(buf.getvalue()).decode("ascii")

def build_block(svg, chars):
    weights = {int(w) for w in re.findall(r"font-weight:(\d+)", svg)} or {400}
    weights.add(400)  # default for faces declared without an explicit weight
    rules = []
    for fam, wght, fname in FACES:
        if fam not in svg or wght not in weights:
            continue
        b64 = subset_b64(os.path.join(FONT_DIR, fname), chars)
        rules.append(
            "@font-face{font-family:'%s';font-style:normal;font-weight:%d;"
            "src:url(data:font/woff2;base64,%s) format('woff2');}" % (fam, wght, b64)
        )
    return BEGIN + "".join(rules) + END

def process(path):
    with open(path, "r", encoding="utf-8") as f:
        svg = f.read()
    if MARKER not in svg:
        return False
    svg = re.sub(re.escape(BEGIN) + ".*?" + re.escape(END), "", svg, flags=re.S)
    block = build_block(svg, used_chars(svg))
    svg = svg.replace(MARKER, MARKER + block, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)
    return True

def main(argv):
    targets = argv or glob.glob(os.path.join(HERE, "..", "**", "*.svg"), recursive=True)
    n = 0
    for t in targets:
        if process(t):
            print("embedded fonts:", os.path.relpath(t)); n += 1
    print("done:", n, "file(s)")

if __name__ == "__main__":
    main(sys.argv[1:])
