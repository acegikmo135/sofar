# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-09-18

### Changed

- README demo is now a recorded GIF of the live playground (`assets/demo.gif`). The
  older `assets/demo.svg` is kept so the 0.1.0 README on npm keeps rendering.
- Added social cover image (`assets/cover.png`).
- `dist/` is no longer pre-minified: shipped code is readable and reviewable, and
  consumers' bundlers minify it anyway (459 B gzipped after minification).
- Releases are published from GitHub Actions with npm provenance.

## [0.1.0] - 2026-09-18

### Added

- `parsePartialJSON(input)` — stateless, single-pass, best-effort parse of a
  possibly-incomplete JSON string. Returns `undefined` when nothing is
  parseable yet; never throws.
- `createJSONStream()` — stateful chunk accumulator with `feed(chunk)` and a
  read-only `raw` buffer.
- Repair handling for: strings cut mid-word, dangling `\` and partial `\uXXXX`
  escapes, dangling object keys, trailing commas, partial literals
  (`tru` / `fals` / `nul`), partial numbers (`4.`, `1e`, `1e+`, bare `-`),
  arbitrarily deep nesting.
- Dual ESM + CJS build with bundled `.d.ts` / `.d.cts` types.
- `size-limit` budget of 2 kB gzipped, enforced in CI.
- Tree-shaking verification script (`npm run treeshake`).

[0.1.1]: https://github.com/acegikmo135/sofar/releases/tag/v0.1.1
[0.1.0]: https://github.com/acegikmo135/sofar/releases/tag/v0.1.0
