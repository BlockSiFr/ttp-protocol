// Render brand SVGs to PNG with the real TTP brand fonts (resvg).
// Usage: node brand/render-png.mjs <in.svg> <out.png> [width]
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = join(HERE, "fonts");
const fontFiles = readdirSync(FONT_DIR).filter(f => f.endsWith(".ttf")).map(f => join(FONT_DIR, f));

const [, , inPath, outPath, width] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node render-png.mjs <in.svg> <out.png> [width]");
  process.exit(1);
}
const svg = readFileSync(inPath, "utf8");
const resvg = new Resvg(svg, {
  fitTo: width ? { mode: "width", value: Number(width) } : { mode: "original" },
  font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "Inter" },
  background: "#0A0A0F",
});
writeFileSync(outPath, resvg.render().asPng());
console.log("rendered", outPath);
