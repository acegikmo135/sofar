// Renders assets/cover.png (1000×420) for blog posts / social cards:
// logo + wordmark + tagline on the left, the mid-stream terminal still on the right.
import { launch } from "puppeteer-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const logo = "data:image/png;base64," + readFileSync(resolve("assets/logo.png")).toString("base64");
const still = "data:image/png;base64," + readFileSync(resolve("assets/demo-frame.png")).toString("base64");

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600&family=Instrument+Sans:wght@400;500&family=JetBrains+Mono:wght@500&display=swap">
<style>
  html,body{margin:0;width:1000px;height:420px;overflow:hidden;background:#0E1211;color:#ECEFEC;font-family:"Instrument Sans",system-ui,sans-serif}
  .grid{position:absolute;inset:0;background-image:radial-gradient(rgba(236,239,236,.07) 1px,transparent 1px);background-size:22px 22px;-webkit-mask-image:radial-gradient(ellipse 70% 80% at 70% 50%,#000 10%,transparent 70%)}
  .glow{position:absolute;right:40px;top:50%;width:560px;height:520px;transform:translateY(-50%);border-radius:50%;background:radial-gradient(closest-side,rgba(79,205,180,.16),transparent);filter:blur(12px)}
  .left{position:absolute;left:56px;top:0;height:100%;width:400px;display:flex;flex-direction:column;justify-content:center;gap:18px}
  .brand{display:flex;align-items:center;gap:14px}
  .brand img{width:64px;height:64px;border-radius:14px;background:#fff}
  .brand b{font-family:"Bricolage Grotesque",sans-serif;font-size:44px;font-weight:600;letter-spacing:-.03em}
  h1{margin:0;font-family:"Bricolage Grotesque",sans-serif;font-size:30px;line-height:1.1;letter-spacing:-.02em;font-weight:600}
  h1 em{font-style:normal;color:#4FCDB4}
  p{margin:0;font-size:16px;color:#A9B3AE;line-height:1.45}
  .pills{display:flex;gap:8px;font-family:"JetBrains Mono",monospace;font-size:12px}
  .pills span{border:1px solid #253029;border-radius:999px;padding:5px 10px;color:#A9B3AE}
  .pills span.t{color:#4FCDB4;border-color:#1c3f38;background:#123430}
  .term{position:absolute;right:48px;top:50%;transform:translateY(-50%);width:470px;border-radius:12px;box-shadow:0 30px 60px -24px rgba(0,0,0,.8);overflow:hidden}
  .term img{display:block;width:100%;margin:-3.5% 0 0 -3.5%;width:107%}
</style></head><body>
<div class="grid"></div><div class="glow"></div>
<div class="left">
  <div class="brand"><img src="${logo}" alt=""><b>SoFar</b></div>
  <h1>Parse JSON while the LLM is <em>still typing.</em></h1>
  <p>Every prefix becomes the best value so far. Never throws, never invents.</p>
  <div class="pills"><span class="t">425 B</span><span>0 deps</span><span>TypeScript</span><span>npm i sofar-json</span></div>
</div>
<div class="term"><img src="${still}" alt=""></div>
</body></html>`;

const browser = await launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 420, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: "assets/cover.png", type: "png" });
await browser.close();
console.log("assets/cover.png written (2000×840 @2x)");
