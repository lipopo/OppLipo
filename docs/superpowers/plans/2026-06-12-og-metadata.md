# OG Metadata Implementation Plan

> Steps use checkbox syntax. Implement task-by-task.

**Goal:** Open Graph + Twitter Card meta tags on all content pages + a default OG image asset.

**Tech Stack:** Node 20+ stdlib, vanilla HTML meta tags, terminal brutalist aesthetic.

**Spec:** `docs/superpowers/specs/2026-06-12-og-metadata-design.md`

---

## File Structure

**New files:**
- `assets/og-default.png` — 1200×630 default OG image (created via chromium screenshot)

**Modified files:**
- `build.mjs` — add `ogMetaTags` helper, add `ogMetaTags` to every `render.*` scope
- 12 template files — replace existing 3 OG lines in `home.html`, add `{{{ogMetaTags}}}` to the other 11
- `tests/build.test.mjs` — add 2 new tests

---

## Task 1: `ogMetaTags` helper + tests

**Files:**
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing tests**

```javascript
import { ogMetaTags } from '../build.mjs';

test('ogMetaTags: produces expected meta tags with title and description', () => {
  const tags = ogMetaTags({ title: 'Hello', description: 'World', url: 'https://x.com/y' });
  assert.match(tags, /property="og:title" content="Hello"/);
  assert.match(tags, /property="og:description" content="World"/);
  assert.match(tags, /property="og:url" content="https:\/\/x\.com\/y"/);
  assert.match(tags, /property="og:type" content="website"/);
  assert.match(tags, /property="og:image"/);
  assert.match(tags, /name="twitter:card" content="summary_large_image"/);
});

test('ogMetaTags: escapes special chars in title', () => {
  const tags = ogMetaTags({ title: 'a & b <c>', description: '', url: 'x' });
  assert.match(tags, /content="a &amp; b &lt;c&gt;"/);
  assert.ok(!/content="a & b <c>"/.test(tags), 'should not have raw < and >');
});
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Add `ogMetaTags` to build.mjs**

```javascript
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

- [ ] **Step 4: Run, verify 109 pass**

- [ ] **Step 5: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Add ogMetaTags helper for Open Graph and Twitter Card"
```

---

## Task 2: Generate default OG image

**Files:**
- Create: `assets/og-default.png`

- [ ] **Step 1: Create a simple HTML file for the OG image render**

```bash
cat > /tmp/og-render.html <<'EOF'
<!doctype html>
<html><head><style>
  body { margin: 0; width: 1200px; height: 630px;
    background: #080808; color: #00ff44;
    font-family: 'Courier New', monospace;
    display: flex; align-items: center; justify-content: center;
    border: 4px solid #00ff44; box-sizing: border-box; }
  h1 { font-size: 96px; text-shadow: 0 0 30px rgba(0,255,60,0.5); }
  p { font-size: 28px; color: #00b840; margin-top: 20px; }
</style></head><body>
  <div>
    <h1>> info.opplipo.cn</h1>
    <p>个人开发者 · 独立 APP · 想法与工具</p>
  </div>
</body></html>
EOF
```

- [ ] **Step 2: Render to PNG**

```bash
chromium --headless --disable-gpu --no-sandbox --hide-scrollbars --window-size=1200,630 --virtual-time-budget=3000 --screenshot=/home/lipo/workdir/OppLipo/assets/og-default.png file:///tmp/og-render.html 2>&1 | tail -1
ls -la /home/lipo/workdir/OppLipo/assets/og-default.png
```

- [ ] **Step 3: Commit**

```bash
git add assets/og-default.png
git commit -m "Add default OG image (1200x630 PNG)"
```

---

## Task 3: Wire `ogMetaTags` into all 14 render functions

**Files:**
- Modify: `build.mjs`

For each `render.*` function, compute `ogMetaTags` and add to scope. Pattern:

```javascript
const scope = {
  ...,
  ogMetaTags: ogMetaTags({ title: 'X | info.opplipo.cn', description: 'Y', url: 'https://info.opplipo.cn/Z/', type: 'T' }),
};
```

Per-route values:

| Render | title | description | url | type |
|---|---|---|---|---|
| `home` | `我的 APP \| info.opplipo.cn` | `site.tagline` | `${base}/` | `website` |
| `app` (apps[slug]) | `${app.name} \| info.opplipo.cn` | `app.tagline` | `${base}/apps/${slug}/` | `website` |
| `thought` (thoughts[slug]) | `${thought.title} \| info.opplipo.cn` | `thought.excerpt` | `${base}/thoughts/${slug}/` | `article` |
| `thoughtsIndex` | `想法 \| info.opplipo.cn` | `开发笔记与思考` | `${base}/thoughts/` | `website` |
| `collectionsIndex` | `精选 \| info.opplipo.cn` | `按主题/质量分组的应用合集` | `${base}/collections/` | `website` |
| `collectionPage` | `${collection.title} \| info.opplipo.cn` | `collection.description` | `${base}/collections/${slug}/` | `website` |
| `now` | `现在 \| info.opplipo.cn` | `现在 · ${updatedAt}` | `${base}/now/` | `website` |
| `uses` | `使用 \| info.opplipo.cn` | `${itemCount} 件装备` | `${base}/uses/` | `website` |
| `search` | `搜索 \| info.opplipo.cn` | `站内搜索` | `${base}/search/` | `website` |
| `colophon` | `colophon \| info.opplipo.cn` | `本站是如何构建的` | `${base}/colophon/` | `website` |
| `changelog` | `changelog \| info.opplipo.cn` | `${releases.length} 条发布` | `${base}/changelog/` | `website` |
| `archive` | `archive \| info.opplipo.cn` | `所有 thoughts 的扁平时间线` | `${base}/archive/` | `website` |
| `about` | `${site.author.name} \| info.opplipo.cn` | `site.author.tagline` | `${base}/about/` | `profile` |
| `notFound` | `404 \| info.opplipo.cn` | `` (empty) | `${base}/` | `website` |

- [ ] **Step 1: Add `ogMetaTags` to each render function**

```bash
cd /home/lipo/workdir/OppLipo
# For each render function, find the scope object and add ogMetaTags line
grep -n "const scope = {" build.mjs | head -20
```

Then manually edit each scope to add `ogMetaTags: ogMetaTags({...}),` using the table above.

- [ ] **Step 2: Run tests, verify 109 pass**

- [ ] **Step 3: Commit**

```bash
git add build.mjs
git commit -m "Add ogMetaTags to all 14 render functions"
```

---

## Task 4: Update all 12 templates

**Files:**
- Modify: 12 template files

For each template file:
1. Remove existing 3 og meta lines (only `templates/home.html` has them)
2. Add `  {{{ogMetaTags}}}` line after `  <link rel="alternate" type="application/atom+xml" ...`

- [ ] **Step 1: Update `templates/home.html`**

In `templates/home.html`, remove these 3 lines:
```html
<meta property="og:title" content="info.opplipo.cn">
<meta property="og:description" content="{{site.tagline}}">
<meta property="og:type" content="website">
```

Add after the RSS link:
```html
  {{{ogMetaTags}}}
```

- [ ] **Step 2: Add `{{{ogMetaTags}}}` to 11 other templates**

Templates: `app.html`, `about.html`, `thought.html`, `thoughts-index.html`, `collection.html`, `collections-index.html`, `now.html`, `uses.html`, `search.html`, `colophon.html`, `changelog.html`, `archive.html`, `notFound.html` (13 total, but notFound and search can be skipped if they don't have the RSS link — they do have it)

For each template, find the line `  <link rel="alternate" type="application/atom+xml" href="/feed.xml" title="info.opplipo.cn">` and add after it:
```html
  {{{ogMetaTags}}}
```

```bash
cd /home/lipo/workdir/OppLipo
for f in templates/app.html templates/about.html templates/thought.html templates/thoughts-index.html templates/collection.html templates/collections-index.html templates/now.html templates/uses.html templates/search.html templates/colophon.html templates/changelog.html templates/archive.html templates/notFound.html; do
  if ! grep -q '{{{ogMetaTags}}}' "$f"; then
    sed -i 's|<link rel="alternate" type="application/atom+xml" href="/feed.xml" title="info.opplipo.cn">|<link rel="alternate" type="application/atom+xml" href="/feed.xml" title="info.opplipo.cn">\n  {{{ogMetaTags}}}|' "$f"
  fi
done
grep -l 'ogMetaTags' templates/*.html | wc -l
```

Expected: 13 (all templates).

- [ ] **Step 3: Build and verify a sample**

```bash
cd /home/lipo/workdir/OppLipo && node build.mjs
grep -E "og:title|og:description" thoughts/dev--sample-thought/index.html | head -3
grep -E "og:title|og:description" now/index.html | head -3
```

- [ ] **Step 4: Commit**

```bash
git add templates/ index.html about/ apps/ collections/ thoughts/ now/ uses/ search/ colophon/ changelog/ archive/ 404.html
git commit -m "Add ogMetaTags to all 13 templates"
```

---

## Task 5: Final verification

- [ ] **Step 1: All tests pass**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 109 passing.

- [ ] **Step 2: Spot-check rendered HTML**

```bash
cd /home/lipo/workdir/OppLipo
for p in thoughts/dev--sample-thought/ now/ uses/ colophon/ archive/; do
  echo "=== /$p/ ==="
  grep -c "og:title" $p/index.html
  grep -c "twitter:card" $p/index.html
done
```

Expected: each shows 1 for both.

## Self-Review

- Spec coverage: helper function ✓, 14 page mappings ✓, 12 templates ✓, OG image asset ✓, tests ✓
- All steps have actual code blocks
- Risks: minimal — pure meta tag addition