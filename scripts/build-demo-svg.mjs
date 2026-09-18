// Generates assets/demo.svg: a looping, self-contained SMIL animation of a
// JSON stream arriving token by token with the parsed value beside it.
// GitHub renders animated SVGs in READMEs, so no GIF is needed.
import { writeFileSync } from "node:fs";

const frames = [
  ['{"recipe": "Pad Th', '{ recipe: "Pad Th" }'],
  ['{"recipe": "Pad Thai", "serv', '{ recipe: "Pad Thai" }'],
  ['{"recipe": "Pad Thai", "servings": 4,', '{ recipe: "Pad Thai", servings: 4 }'],
  ['{"recipe": "Pad Thai", "servings": 4, "vegan": fals', '{ recipe: "Pad Thai", servings: 4 }'],
  ['{"recipe": "Pad Thai", "servings": 4, "vegan": false, "tags": ["thai", "noo', '{ recipe: "Pad Thai", servings: 4, vegan: false, tags: ["thai", "noo"] }'],
  ['{"recipe": "Pad Thai", "servings": 4, "vegan": false, "tags": ["thai", "noodles"]}', '{ recipe: "Pad Thai", servings: 4, vegan: false, tags: ["thai", "noodles"] }'],
];

const W = 880, H = 236, step = 1.5, hold = 2.2;
const total = frames.length * step + hold;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function visible(start, end) {
  // opacity keyframes: hidden until start, visible until end, hidden after
  const k = [0, start / total, start / total, end / total, end / total, 1].map((n) => n.toFixed(4));
  return `<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="${k.join(";")}" dur="${total}s" repeatCount="indefinite"/>`;
}

let body = "";
frames.forEach((f, i) => {
  const start = i * step, end = i === frames.length - 1 ? total : (i + 1) * step;
  const [raw, out] = f;
  body += `<g opacity="0">${visible(start, end)}
    <text x="28" y="98" class="mono raw">${esc(raw)}<tspan class="cursor">▍</tspan></text>
    <text x="28" y="178" class="mono out">${esc(out)}</text>
    <text x="${W - 28}" y="-15" text-anchor="end" class="mono dim">${raw.length} chars · ${i === frames.length - 1 ? "complete" : "receiving"}</text>
    <rect x="0" y="0" width="${(raw.length / frames[frames.length - 1][0].length * W).toFixed(1)}" height="2" fill="#4FCDB4"/>
  </g>\n`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-size="15">
  <style>
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
    .raw { fill: #E9D9A8; }
    .out { fill: #7FE3CB; }
    .dim { fill: #6F7E78; font-size: 12px; }
    .label { fill: #6F7E78; font-size: 11px; letter-spacing: .08em; }
    .cursor { fill: #4FCDB4; }
  </style>
  <rect width="${W}" height="${H}" rx="14" fill="#0F1513" stroke="#22302B"/>
  <rect x="1" y="1" width="${W - 2}" height="38" rx="13" fill="#141B19"/>
  <rect x="1" y="26" width="${W - 2}" height="14" fill="#141B19"/>
  <line x1="1" y1="40" x2="${W - 1}" y2="40" stroke="#22302B"/>
  <circle cx="24" cy="20" r="4.5" fill="#22302B"/><circle cx="38" cy="20" r="4.5" fill="#22302B"/><circle cx="52" cy="20" r="4.5" fill="#22302B"/>
  <text x="70" y="25" class="mono dim">streaming from model</text>
  <text x="28" y="70" class="mono label">RAW BUFFER</text>
  <text x="28" y="150" class="mono label">parsePartialJSON(raw)</text>
  <line x1="1" y1="122" x2="${W - 1}" y2="122" stroke="#22302B"/>
  <g transform="translate(0 40)">
${body}  </g>
</svg>
`;

writeFileSync("assets/demo.svg", svg);
console.log(`assets/demo.svg written (${svg.length} bytes, ${frames.length} frames, ${total}s loop)`);
