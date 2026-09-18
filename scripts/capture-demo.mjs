// Records the landing page's hero terminal (site/index.html) through one full
// stream loop with headless Chrome and writes it to assets/demo.gif.
//
//   npm run build:site && node scripts/capture-demo.mjs
//
// Uses the locally installed Chrome via puppeteer-core (no browser download)
// and the DevTools screencast API, which pushes a frame on every repaint.
import { launch } from "puppeteer-core";
import gifenc from "gifenc";
import { PNG } from "pngjs";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { GIFEncoder, quantize, applyPalette } = gifenc;

const OUT = "assets/demo.gif";
const PAD = 22;          // page background kept around the terminal (shows the glow)
const MIN_GAP = 66;      // ms between kept frames (~15 fps)
const HOLD_MS = 2600;    // keep recording this long after "complete" so the loop breathes
const MAX_MS = 22000;    // safety cap

const browser = await launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument(() => { try { localStorage.setItem("pjs-theme", "dark"); } catch {} });
await page.goto(pathToFileURL(resolve("site/index.html")).href, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);

// Let the load animation settle, then wait for the stream to wrap around to
// zero so the recording starts on a clean cycle.
await new Promise((r) => setTimeout(r, 1500));
const box = await page.evaluate(() => {
  const r = document.querySelector(".term-wrap").getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
});
const clip = { x: Math.round(box.x - PAD), y: Math.round(box.y - PAD), w: Math.round(box.width + PAD * 2), h: Math.round(box.height + PAD * 2) };
console.log(`clip ${clip.w}×${clip.h}`);
await page.waitForFunction(() => document.getElementById("hero-count").textContent === "0 chars", { timeout: 30000 });

const client = await page.createCDPSession();
const frames = [];
let lastKept = 0, t0 = 0, completeAt = 0, done = false;
let resolveDone; const finished = new Promise((r) => (resolveDone = r));

client.on("Page.screencastFrame", async ({ data, sessionId, metadata }) => {
  await client.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  if (done) return;
  const t = metadata.timestamp * 1000;
  if (!t0) t0 = t;
  if (t - lastKept >= MIN_GAP) {
    frames.push({ t, png: Buffer.from(data, "base64") });
    lastKept = t;
    const status = await page.$eval("#hero-status", (el) => el.textContent).catch(() => "");
    if (status === "complete" && !completeAt) completeAt = t;
  }
  if ((completeAt && t - completeAt > HOLD_MS) || t - t0 > MAX_MS) { done = true; resolveDone(); }
});
await client.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
await finished;
await client.send("Page.stopScreencast");
await browser.close();
console.log(`${frames.length} frames over ${((frames[frames.length - 1].t - frames[0].t) / 1000).toFixed(1)}s`);

// Crop each viewport frame to the terminal and encode.
function crop(png) {
  const src = PNG.sync.read(png);
  const out = Buffer.alloc(clip.w * clip.h * 4);
  for (let y = 0; y < clip.h; y++) {
    const from = ((clip.y + y) * src.width + clip.x) * 4;
    src.data.copy(out, y * clip.w * 4, from, from + clip.w * 4);
  }
  return out;
}
const gif = GIFEncoder();
for (let i = 0; i < frames.length; i++) {
  const rgba = crop(frames[i].png);
  const delay = i < frames.length - 1 ? frames[i + 1].t - frames[i].t : 400;
  const palette = quantize(rgba, 256, { format: "rgb444" });
  const index = applyPalette(rgba, palette, "rgb444");
  gif.writeFrame(index, clip.w, clip.h, { palette, delay: Math.max(20, Math.round(delay)), repeat: 0 });
  if (i === Math.floor(frames.length * 0.55)) {
    const still = new PNG({ width: clip.w, height: clip.h }); still.data = rgba;
    writeFileSync("assets/demo-frame.png", PNG.sync.write(still));
  }
}
gif.finish();
const bytes = gif.bytes();
writeFileSync(OUT, bytes);
console.log(`${OUT} written: ${(bytes.length / 1024).toFixed(0)} kB`);
