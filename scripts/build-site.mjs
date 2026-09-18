// Wraps site/page.html (head-less fragment) into a complete document at
// site/index.html for static hosting (GitHub Pages, Netlify, etc.).
import { readFileSync, writeFileSync } from "node:fs";

const fragment = readFileSync("site/page.html", "utf8").trim();
const marker = "</style>\n";
if (!fragment.includes(marker)) {
  console.error("build-site: expected a </style> block in site/page.html");
  process.exit(1);
}

const doc =
  `<!doctype html>\n<html lang="en">\n<head>\n` +
  `<meta charset="utf-8">\n` +
  `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n` +
  `<meta name="color-scheme" content="light dark">\n` +
  `<link rel="icon" type="image/png" href="logo.png">\n` +
  `<meta property="og:title" content="SoFar — parse JSON while it's still streaming">\n` +
  `<meta property="og:description" content="Repairs incomplete JSON from LLM streams into the best value so far. Zero dependencies, 425 bytes, never throws.">\n` +
  `<meta property="og:image" content="https://acegikmo135.github.io/sofar/logo.png">\n` +
  `<meta name="twitter:card" content="summary">\n` +
  fragment.replace(marker, "</style>\n</head>\n<body>\n") +
  `\n</body>\n</html>\n`;

writeFileSync("site/index.html", doc);

// One-time syntax check of the main inline script (the last <script> block).
const js = fragment.slice(fragment.lastIndexOf("<script>") + 8, fragment.lastIndexOf("</script>"));
new Function(js);

console.log(`site/index.html written (${doc.length} bytes); inline script parses.`);
