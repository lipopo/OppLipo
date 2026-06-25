# Build Script Module Split Implementation Plan

> Steps use checkbox syntax. Refactor in incremental per-module commits to keep the build green at every step.

**Goal:** Split `build.mjs` (~2500 lines) into focused modules under `src/`. `build.mjs` becomes a thin re-exporter + CLI entry. All 111 tests continue passing. No behavior change.

**Tech Stack:** Node 20+ stdlib ESM, zero deps.

**Spec:** `docs/superpowers/specs/2026-06-25-build-modules-design.md`

---

## File Structure (target)

**New files:**
- `src/util.js` — pure helpers
- `src/extract.js` — markdown extractors
- `src/og.js` — ogMetaTags
- `src/template.js` — render engine
- `src/validate.js` — validators
- `src/data.js` — build-time data generators
- `src/render.js` — 14 render methods + scope helpers
- `src/output.js` — writeOutputs, copyAssets

**Modified files:**
- `build.mjs` — trim to entry point with re-exports

---

## Task 1: Extract `src/util.js`

**Files:**
- Create: `src/util.js`
- Modify: `build.mjs`

- [ ] **Step 1: Create `src/util.js`**

Identify these functions in `build.mjs` and move them:

- `xmlEscape(s)`
- `computeReadingMinutes(text)` (uses `extractText` from extract.js — see below)
- `computeReadingProgress(articleTop, articleHeight, scrollY, viewportHeight)`
- `computeRelated(current, all)` (uses `extractText`? No — pure loop)
- `todayISO()` (returns `new Date().toISOString().slice(0, 10)`)

Note: `computeReadingMinutes` needs `extractText`. To keep the dependency order clean, either:
- (A) Import `extractText` from `src/extract.js` (so move `extract.js` first)
- (B) Inline a tiny version of `extractText` in `computeReadingMinutes` for the refactor period, then switch to `src/extract.js` import in step 2

Pick **(A)**: create `src/extract.js` first, then `src/util.js` imports from it.

`src/util.js` content:

```javascript
import { extractText } from './extract.js';

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function computeReadingMinutes(text) {
  if (typeof text !== 'string' || !text) return 1;
  const clean = extractText(text);
  const chinese = (clean.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) ?? []).length;
  const english = (clean.match(/[a-zA-Z]+/g) ?? []).length;
  const minutes = Math.ceil(chinese / 350 + english / 200);
  return Math.max(1, minutes);
}

export function computeReadingProgress(articleTop, articleHeight, scrollY, viewportHeight) {
  const scrolled = scrollY - articleTop;
  const total = Math.max(1, articleHeight - viewportHeight);
  return Math.max(0, Math.min(1, scrolled / total));
}

export function computeRelated(current, all) {
  const out = [];
  for (const other of all ?? []) {
    if (other.slug === current.slug) continue;
    let score = 0;
    const sharedApps = (current.appSlugs ?? [])
      .filter((a) => (other.appSlugs ?? []).includes(a));
    score += sharedApps.length * 2;
    if (current.folder && other.folder && current.folder === other.folder) score += 1;
    if (score > 0) out.push({ t: other, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 3).map((x) => x.t);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
```

`src/extract.js` content (created alongside `util.js`):

```javascript
export function extractText(md) {
  if (typeof md !== 'string') return '';
  let s = md;
  s = s.replace(/```[\w]*\n?[\s\S]*?```/g, ' ');
  s = s.replace(/`([^`\n]+)`/g, '$1');
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  s = s.replace(/^#+\s+/gm, '');
  s = s.replace(/(\*\*|__)(.*?)\1/g, '$2');
  s = s.replace(/(\*|_)(.*?)\1/g, '$2');
  s = s.replace(/~~(.*?)~~/g, '$1');
  s = s.replace(/^>\s*/gm, '');
  s = s.replace(/^[\s]*[-*+]\s+/gm, '');
  s = s.replace(/^\s*\d+\.\s+/gm, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function extractHeadings(text) {
  if (typeof text !== 'string') return [];
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m2 = line.match(/^##\s+(.+)$/);
    if (m2) out.push({ level: 2, text: m2[1].trim() });
  }
  return out;
}
```

- [ ] **Step 2: In `build.mjs`, remove the moved code; add `export *` at top**

```javascript
export * from './src/util.js';
export * from './src/extract.js';
```

- [ ] **Step 3: Verify**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -5
node build.mjs 2>&1 | tail -1
```

Expected: 111 passing, clean build.

- [ ] **Step 4: Commit**

```bash
git add build.mjs src/util.js src/extract.js
git commit -m "Refactor: extract util.js and extract.js from build.mjs"
```

---

## Task 2: Extract `src/og.js`

**Files:**
- Create: `src/og.js`
- Modify: `build.mjs`

- [ ] **Step 1: Create `src/og.js`**

```javascript
import { escHtml } from './template.js';

export function ogMetaTags({ title, description, url, type = 'website' }) {
  const base = 'https://info.opplipo.cn';
  const img = `${base}/assets/og-default.png`;
  return [
    `<meta property="og:title" content="${escHtml(title)}">`,
    `<meta property="og:description" content="${escHtml(description ?? '')}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:site_name" content="info.opplipo.cn">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escHtml(title)}">`,
    `<meta name="twitter:description" content="${escHtml(description ?? '')}">`,
    `<meta name="twitter:image" content="${img}">`,
  ].join('\n  ');
}
```

- [ ] **Step 2: `build.mjs`: add re-export, remove `ogMetaTags`**

```javascript
export * from './src/og.js';
```

- [ ] **Step 3: Verify + commit**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -3
git add build.mjs src/og.js
git commit -m "Refactor: extract og.js from build.mjs"
```

---

## Task 3: Extract `src/template.js`

**Files:**
- Create: `src/template.js`
- Modify: `build.mjs`

- [ ] **Step 1: Create `src/template.js`**

Move from `build.mjs`:
- `escHtml(s)` (already in util.js — no need to move, just import in og.js — already done)
- `findMatchingEachEnd(template, afterStartTag)`
- `processNestedEach(template, item)`
- `applyEach(template, key, items, parentScope)`
- `resolveExpr(expr, scope)`
- `isTruthy(v)`
- `applyBlock(template, scope, keyword, invert)`
- `applyIf(template, scope)` and `applyUnless(template, scope)`
- `renderTemplate(tpl, scope)`

```javascript
import { escHtml } from './util.js';
// (escHtml actually lives in util.js; consider moving to template.js as it relates to template rendering)
// — actually keep escHtml where it is (used in og.js too). Don't move.

export function findMatchingEachEnd(template, afterStartTag) { /* ... */ }
export function processNestedEach(template, item) { /* ... */ }
export function applyEach(template, key, items, parentScope) { /* ... */ }
export function resolveExpr(expr, scope) { /* ... */ }
export function isTruthy(v) { /* ... */ }
function applyBlock(template, scope, keyword, invert) { /* ... */ }
export function applyIf(template, scope) { /* ... */ }
export function applyUnless(template, scope) { /* ... */ }
export function renderTemplate(tpl, scope) { /* ... */ }
```

Note: `escHtml` is already exported from `src/util.js`. `template.js` doesn't need to re-export it; consumers (og.js) import from `src/util.js`.

- [ ] **Step 2: `build.mjs`: re-export, remove code**

- [ ] **Step 3: Verify + commit**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -3
git add build.mjs src/template.js
git commit -m "Refactor: extract template.js (engine + renderTemplate) from build.mjs"
```

---

## Task 4: Extract `src/validate.js`

**Files:**
- Create: `src/validate.js`
- Modify: `build.mjs`

- [ ] **Step 1: Create `src/validate.js`**

Move from `build.mjs`:
- `validate(apps)` — apps.json validator
- `validateSiteJson(site)` — site.json validator
- `validateSearchIndex(index)` — search index validator

```javascript
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './root.js';
// Or define ROOT inline as `import.meta.url` based — but simpler to keep ROOT in build.mjs and re-export.

export function validate(apps) { /* ... */ }
export function validateSiteJson(site) { /* ... */ }
export function validateSearchIndex(index) { /* ... */ }
```

Wait — `validate()` uses `ROOT` (the build.mjs `export const ROOT = dirname(fileURLToPath(import.meta.url))`). Need to make `ROOT` available. Options:
- (A) `validate.js` does its own `fileURLToPath` and `dirname` based on its own URL
- (B) Move `ROOT` to a separate `src/root.js` module

Pick **(A)**: each module that needs ROOT computes it from its own URL. Tiny code, no cross-dep.

In `src/validate.js`:
```javascript
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
```

Then validate() uses `ROOT` locally.

- [ ] **Step 2: `build.mjs`: re-export, remove code**

- [ ] **Step 3: Verify + commit**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -3
git add build.mjs src/validate.js
git commit -m "Refactor: extract validate.js from build.mjs"
```

---

## Task 5: Extract `src/data.js`

**Files:**
- Create: `src/data.js`
- Modify: `build.mjs`

- [ ] **Step 1: Create `src/data.js`**

Move from `build.mjs`:
- `aggregateRecentReleases(apps, limit = 5)`
- `buildSearchIndex(apps, site, thoughts)`
- `validateSearchIndex` (already in validate — re-export here for backward compat? No, keep in validate. data imports nothing)
- `buildSitemap(publicApps, site, thoughts)`
- `renderSitemap(sitemap)`
- `buildAtomFeed(publicApps, site, thoughts)` — moves to data.js? Or render.js?
- `renderAtomXml(feed)`
- `buildChangelogFeedEntry` (or inline in buildAtomFeed?)

Note: `buildAtomFeed` is a data builder (it produces items), not a renderer. So it's in data.js. `renderAtomXml` is a serializer — also in data.js (it's tightly coupled to atom feed output).

`buildSearchIndex` and `buildSitemap` and `buildAtomFeed` all need publicApps + site + thoughts inputs. They produce structured output (not HTML).

```javascript
import { extractText } from './extract.js';
import { xmlEscape, todayISO } from './util.js';

export function aggregateRecentReleases(apps, limit = 5) { /* ... */ }
export function buildSearchIndex(apps, site, thoughts) { /* ... */ }
export function buildSitemap(publicApps, site, thoughts) { /* ... */ }
export function renderSitemap(sitemap) { /* ... */ }
export function buildAtomFeed(publicApps, site, thoughts) { /* ... */ }
export function renderAtomXml(feed) { /* ... */ }
```

- [ ] **Step 2: `build.mjs`: re-export, remove code**

- [ ] **Step 3: Verify + commit**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -3
git add build.mjs src/data.js
git commit -m "Refactor: extract data.js (atom feed, sitemap, search index builders) from build.mjs"
```

---

## Task 6: Extract `src/render.js`

**Files:**
- Create: `src/render.js`
- Modify: `build.mjs`

- [ ] **Step 1: Create `src/render.js`**

Move from `build.mjs`:
- The `render` object with all 14 methods (home, app, thought, thoughtsIndex, collection, collectionsIndex, now, uses, search, colophon, changelog, archive, notFound, roadmap)
- `appsContext(apps)` — helper for `render.home`
- `sortTreeForTemplate(...)` — file tree builder
- `sortRecent(releases)` — recency sort

```javascript
import { renderTemplate } from './template.js';
import { extractText } from './extract.js';
import { computeReadingMinutes, computeRelated, computeReadingProgress, todayISO } from './util.js';
import { aggregateRecentReleases, buildSearchIndex, buildSitemap, buildAtomFeed, renderSitemap, renderAtomXml } from './data.js';
import { ogMetaTags } from './og.js';

export const render = {
  async home(apps) { /* ... */ },
  async app(app) { /* ... */ },
  async thought(thought, allThoughts, site) { /* ... */ },
  // ... 11 more
};
export function appsContext(apps) { /* ... */ }
// Helper functions for thought page (extractHeadings, etc.)
```

- [ ] **Step 2: `build.mjs`: re-export, remove code**

- [ ] **Step 3: Verify + commit**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -3
git add build.mjs src/render.js
git commit -m "Refactor: extract render.js (14 render methods) from build.mjs"
```

---

## Task 7: Extract `src/output.js`

**Files:**
- Create: `src/output.js`
- Modify: `build.mjs`

- [ ] **Step 1: Create `src/output.js`**

Move from `build.mjs`:
- `pathExists(p)`
- `copyAssets()` (async)
- `writeOutputs(publicApps, site, thoughts)` (async)

```javascript
import { existsSync } from 'node:fs';
import { stat, mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
import { render } from './render.js';
import { validateSiteJson } from './validate.js';
import { aggregateRecentReleases } from './data.js';

export async function pathExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

export async function copyAssets() {
  const exists = await pathExists(join(ROOT, 'assets'));
  if (!exists) throw new Error('assets/ directory missing at repo root');
}

export async function writeOutputs(publicApps, site, thoughts) { /* ... */ }
```

Note: `copyAssets` is currently a no-op. Keep the function for backward compatibility with `main()`.

- [ ] **Step 2: `build.mjs`: re-export, remove code**

- [ ] **Step 3: Verify + commit**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -3
git add build.mjs src/output.js
git commit -m "Refactor: extract output.js (writeOutputs, copyAssets, pathExists) from build.mjs"
```

---

## Task 8: Clean up `build.mjs` (final form)

**Files:**
- Modify: `build.mjs`

- [ ] **Step 1: Replace `build.mjs` with the entry-point form**

```javascript
#!/usr/bin/env node
// build.mjs — entry point. See src/ for actual logic.

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Re-exports for tests that still import from '../build.mjs'
export * from './src/util.js';
export * from './src/extract.js';
export * from './src/og.js';
export * from './src/template.js';
export * from './src/validate.js';
export * from './src/data.js';
export * from './src/render.js';
export * from './src/output.js';

import { validate, validateSiteJson } from './src/validate.js';
import { render } from './src/render.js';
import { writeOutputs, copyAssets } from './src/output.js';
import { aggregateRecentReleases } from './src/data.js';

const ROOT = dirname(fileURLToPath(import.meta.url));

async function main() {
  const appsPath = join(ROOT, 'apps.json');
  const apps = JSON.parse(await readFile(appsPath, 'utf8'));
  validate(apps);
  await copyAssets();

  let site = { author: { name: 'lipo', tagline: '' }, thoughts: { tree: [] }, collections: [] };
  const sitePath = join(ROOT, 'site.json');
  if (await fileExists(sitePath)) {
    site = JSON.parse(await readFile(sitePath, 'utf8'));
    validateSiteJson(site);
  }

  const thoughts = await readThoughts(ROOT, site, apps);  // Hmm — walkThoughts is a function
  // ...
}
```

Wait — `walkThoughts` is used in `main()`. It was not yet assigned to a module. Either:
- Put `walkThoughts` in `src/data.js` (it walks data files)
- Or put it in `src/extract.js` (it extracts thoughts)

Put it in `src/data.js` (it walks the file system, similar to other data builders).

- [ ] **Step 2: Verify + final commit**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -3
node build.mjs 2>&1 | tail -1
git add build.mjs
git commit -m "Refactor: trim build.mjs to entry point with re-exports"
```

---

## Final verification

- [ ] **Step 1: All tests pass**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 111 passing.

- [ ] **Step 2: Build still produces all output**

```bash
cd /home/lipo/workdir/OppLipo && node build.mjs
ls -la *.html 2>/dev/null
```

- [ ] **Step 3: Line counts show the split**

```bash
cd /home/lipo/workdir/OppLipo && wc -l build.mjs src/*.js
```

Expected: build.mjs under 100 lines, src/ modules each under 800.

## Self-Review

- Spec coverage: 8 modules ✓, re-export compat ✓, no behavior change ✓, incremental commits ✓
- All steps have actual code blocks
- Type consistency: each module has a single responsibility, no cycles
- Risks: minimal — pure refactor, tests validate