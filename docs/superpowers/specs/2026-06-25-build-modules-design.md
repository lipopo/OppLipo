# Build Script Module Split — Design Spec

**Date:** 2026-06-25
**Status:** Draft (pending user review)
**Owner:** lipo

## Goal

Split `build.mjs` (~2500 lines, 14 render functions + 7 data builders + validation + engine) into a `src/` directory with focused modules. `build.mjs` becomes a thin entry point that re-exports everything. Tests and templates are not changed.

## Constraints

- Static site build, zero npm dependencies
- Existing 111 tests must keep passing
- Test import paths unchanged (`tests/build.test.mjs` still imports from `../build.mjs`)
- No behavior changes (refactor only)

## New file structure

```
build.mjs          # entry: re-exports + main() CLI
src/
  template.js      # renderTemplate, escHtml, engine: applyEach/applyIf/applyUnless/processNestedEach/applyBlock
  extract.js       # extractText, extractHeadings
  util.js          # xmlEscape, computeReadingMinutes, computeReadingProgress, computeRelated, todayISO
  validate.js      # validate, validateSiteJson, validateSearchIndex
  render.js        # render object (14 render.* methods) + render helpers
  data.js          # aggregateRecentReleases, buildSearchIndex, buildSitemap, buildAtomFeed, renderSitemap, renderAtomXml, buildChangelogFeedEntry
  og.js            # ogMetaTags
  output.js        # writeOutputs, copyAssets, pathExists
```

## Module boundaries (single responsibility)

| File | Responsibility | Approx lines |
|---|---|---|
| `src/template.js` | Mustache-like template engine (applyEach/applyIf/applyUnless/processNestedEach/applyBlock/findMatchingEachEnd) + escHtml + renderTemplate entry | ~250 |
| `src/extract.js` | Markdown → plain text extraction (extractText, extractHeadings) | ~50 |
| `src/util.js` | Pure helpers: xmlEscape, computeReadingMinutes, computeReadingProgress, computeRelated, todayISO | ~80 |
| `src/validate.js` | Validation: apps.json (`validate`), site.json (`validateSiteJson`), search index (`validateSearchIndex`) | ~150 |
| `src/render.js` | The 14 `render.*` methods + scope-building helpers (appsContext, sortTreeForTemplate, etc.) | ~700 |
| `src/data.js` | Build-time data generators: aggregateRecentReleases, buildSearchIndex, buildSitemap, buildAtomFeed, renderSitemap, renderAtomXml, buildChangelogFeedEntry, sitemap helpers | ~250 |
| `src/og.js` | ogMetaTags — only | ~25 |
| `src/output.js` | writeOutputs, copyAssets, pathExists | ~150 |

## build.mjs structure (after refactor)

```javascript
// build.mjs
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// Re-exports preserve test import paths (tests/build.test.mjs unchanged)
export * from './src/template.js';
export * from './src/extract.js';
export * from './src/util.js';
export * from './src/validate.js';
export * from './src/render.js';
export * from './src/data.js';
export * from './src/og.js';
export * from './src/output.js';

// CLI main
async function main() { /* unchanged */ }
```

After all moves, build.mjs is ~100 lines (mostly the main() CLI and a few top-level types).

## Inter-module dependencies (no cycles)

```
util.js   ← (no deps)
template.js ← util.js (escHtml)
extract.js ← util.js (no — extractText doesn't need escHtml)
og.js     ← (no deps)
data.js   ← util.js, extract.js (extractText for buildSearchIndex)
validate.js ← (no deps)
render.js ← template.js, util.js, data.js, extract.js, validate.js, og.js
output.js ← render.js, data.js, validate.js
build.mjs ← output.js
```

No cycles. Dependency direction: bottom (no deps) → top (depends on bottom).

## Refactor strategy: incremental per-module

For each module in order `util.js → extract.js → og.js → template.js → validate.js → data.js → render.js → output.js → build.mjs cleanup`:

1. Create the new module file with the moved code
2. Add any imports it needs
3. Mark functions as `export` if they were `function` in build.mjs
4. Update `build.mjs` to remove the moved code and add `export * from './src/X.js'`
5. Run `node --test tests/build.test.mjs` — confirm 111/111 pass
6. Run `node build.mjs` — confirm clean build
7. Commit: `Refactor: extract <module> from build.mjs into src/<module>.js`

Order rationale:
- `util.js` first: pure functions, no deps, easy to extract
- `extract.js`: depends on no other src module
- `og.js`: single function
- `template.js`: depends only on `util.js` (escHtml)
- `validate.js`: depends on no src module (uses Node `path.join`)
- `data.js`: depends on `util.js` (xmlEscape, todayISO) and `extract.js` (extractText)
- `render.js`: depends on all of the above (template, data, util, validate, og, extract)
- `output.js`: depends on `render.js` and `data.js`
- build.mjs: thin entry

This is bottom-up — leaves the heavy lifting (render.js) for last when most helpers are available.

## Tests (no new tests)

111/111 must keep passing. Refactor only.

## Out of scope (YAGNI)

- Convert to TypeScript (would force new toolchain)
- Add ESM-only exports (current code uses CommonJS-style `import/export` in .mjs files which works in Node 20+)
- Auto-generated index file per directory
- Each render.* as its own file (over-decomposition)

## Risk notes

- `tests/build.test.mjs` imports from `'../build.mjs'`. Re-exports preserve the surface; tests unchanged.
- `assets/app.js` references the build output only. Not affected.
- The engine code in `template.js` is the most complex. Move it carefully — 250 lines of regex + nested-function logic.

## Verification

After each module extraction:
- `node --test tests/build.test.mjs` — must show 111/111 passing
- `node build.mjs` — must build cleanly (`✓ built N app page(s), N thought(s), N collection(s)`)
- Visual smoke test on a thought page (already covered by previous tests + chromium screenshots)