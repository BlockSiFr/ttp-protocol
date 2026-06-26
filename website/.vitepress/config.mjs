import { defineConfig } from "vitepress";
import container from "markdown-it-container";

// Custom protocol callouts: ::: authority / attestation / decay / receipt / step-up / deny
const CALLOUTS = {
  authority: "AUTHORITY",
  attestation: "ATTESTATION",
  decay: "DECAY",
  receipt: "RECEIPT",
  "step-up": "STEP-UP",
  deny: "DENY",
};

function calloutPlugin(md) {
  for (const [name, label] of Object.entries(CALLOUTS)) {
    md.use(container, name, {
      render(tokens, idx) {
        const token = tokens[idx];
        if (token.nesting === 1) {
          const title = token.info.trim().slice(name.length).trim() || label;
          return `<div class="ttp-callout ttp-${name}"><p class="ttp-callout-title">${md.utils.escapeHtml(title)}</p>\n`;
        }
        return "</div>\n";
      },
    });
  }
}

export default defineConfig({
  title: "Trust Transfer Protocol",
  description: "Trust-Before-Execution for AI agents and non-human identities.",
  appearance: "dark",
  cleanUrls: true,
  ignoreDeadLinks: true,
  head: [
    ["meta", { name: "theme-color", content: "#0A0A0F" }],
    ["meta", { property: "og:image", content: "/social-preview.png" }],
  ],
  markdown: {
    theme: { light: "github-dark", dark: "github-dark" },
    languageAlias: { ttp: "hcl" },
    config: (md) => calloutPlugin(md),
  },
  themeConfig: {
    logo: "/repo-icon.svg",
    nav: [
      { text: "Start", link: "/guide/start" },
      { text: "Concepts", link: "/guide/concepts" },
      { text: "Runtime", link: "/guide/runtime" },
      { text: "Receipts", link: "/guide/receipts" },
      { text: "Spec", link: "https://github.com/BlockSiFr/ttp-protocol/blob/main/SPECIFICATION.md" },
    ],
    sidebar: [
      {
        text: "Start",
        items: [
          { text: "Overview", link: "/guide/start" },
          { text: "Quickstart", link: "/guide/start#quickstart" },
        ],
      },
      {
        text: "Protocol",
        items: [
          { text: "Concepts", link: "/guide/concepts" },
          { text: "Language Specification", link: "/guide/language" },
          { text: "Runtime Authority", link: "/guide/runtime" },
          { text: "Trust Decay", link: "/guide/decay" },
          { text: "Proofs", link: "/guide/proofs" },
          { text: "Execution Receipts", link: "/guide/receipts" },
        ],
      },
      {
        text: "Build",
        items: [
          { text: "Examples", link: "/guide/examples" },
          { text: "Integrations", link: "/guide/integrations" },
          { text: "RFCs", link: "/guide/rfcs" },
          { text: "Contributing", link: "/guide/contributing" },
          { text: "Security", link: "/guide/security" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/BlockSiFr/ttp-protocol" },
    ],
    footer: {
      message: "Apache-2.0 · A BlockSiFr open protocol",
      copyright: "Trust-Before-Execution for autonomous systems",
    },
  },
});
