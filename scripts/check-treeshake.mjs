// Bundles a consumer that imports only `parsePartialJSON` from the built ESM
// output and asserts that `createJSONStream` was dropped by tree-shaking.
// Run after `npm run build`.
import { build } from "esbuild";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const dist = resolve("dist/index.js");
if (!existsSync(dist)) {
  console.error("dist/index.js not found — run `npm run build` first.");
  process.exit(1);
}

const result = await build({
  stdin: {
    contents: `import { parsePartialJSON } from ${JSON.stringify(dist)};\nconsole.log(parsePartialJSON('{"a":1'));`,
    resolveDir: process.cwd(),
    loader: "js",
  },
  bundle: true,
  format: "esm",
  minify: false,
  write: false,
  platform: "neutral",
});

const code = result.outputFiles[0].text;

// `feed` and `raw` are property names on the stream object, so they survive
// minification and are a reliable signature for createJSONStream's body.
const leaked = [/\bfeed\b/, /\braw\b/, /createJSONStream/].filter((re) =>
  re.test(code),
);

if (leaked.length) {
  console.error("✗ Tree-shaking check FAILED — createJSONStream leaked into a bundle that only imports parsePartialJSON.");
  console.error("  Matched:", leaked.map(String).join(", "));
  console.error("\n--- bundle ---\n" + code);
  process.exit(1);
}

if (!/JSON\.parse/.test(code)) {
  console.error("✗ Tree-shaking check FAILED — parsePartialJSON body missing from bundle?");
  process.exit(1);
}

console.log(`✓ Tree-shaking OK — createJSONStream dropped (bundle ${code.length} bytes, unminified)`);
