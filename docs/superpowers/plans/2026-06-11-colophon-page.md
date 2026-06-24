# Colophon Page Implementation Plan

> Steps use checkbox syntax. Implement task-by-task.

**Goal:** `/colophon/` page covering stack, philosophy, structure, contribute, license, acknowledgments.

**Tech Stack:** Node 20+ stdlib, vanilla JS, terminal brutalist CSS.

**Spec:** `docs/superpowers/specs/2026-06-11-colophon-page-design.md`

---

## File Structure

**New files:**
- `templates/colophon.html`

**Modified files:**
- `build.mjs` — add `render.colophon`, extend `writeOutputs`, extend `buildSitemap`
- `site.json` — add `colophon` block
- `templates/home.html` — add colophon link to footer
- `assets/styles.css` — colophon page styles
- `tests/build.test.mjs` — add 4 new tests

---

## Task 1: `render.colophon` + `templates/colophon.html`

**Files:**
- Create: `templates/colophon.html`
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing tests**

```javascript
test('render.colophon: produces page with all 5 sections and terminal prompt', async () => {
  const site = {
    author: { name: 'x' },
    colophon: {
      stack: { build: 'b', deploy: 'd', font: 'f', colors: 'c', icons: 'i' },
      philosophy: 'why',
      structure: 's',
      contribute: { repo: 'r', issues: 'i', guidelines: 'g', thanks: 't' },
      license: { code: 'MIT', content: 'CC', note: 'n' },
      acknowledgments: 'a',
    },
  };
  const html = await render.colophon(site);
  assert.match(html, /COLOPHON/);
  assert.match(html, /\/\/ STACK/);
  assert.match(html, /\/\/ PHILOSOPHY/);
  assert.match(html, /\/\/ STRUCTURE/);
  assert.match(html, /\/\/ CONTRIBUTE/);
  assert.match(html, /\/\/ LICENSE/);
  assert.match(html, /\/\/ ACKNOWLEDGMENTS/);
  assert.match(html, /\/colophon\.md/);
});

test('render.colophon: renders markdown in philosophy and structure fields', async () => {
  const site = {
    author: { name: 'x' },
    colophon: {
      stack: { build: 'b' },
      philosophy: '**zero deps**',
      structure: '- `apps.json`\n- `site.json`',
      contribute: { repo: 'r', issues: 'i', guidelines: 'g', thanks: 't' },
      license: { code: 'M', content: 'C', note: 'n' },
      acknowledgments: 'a',
    },
  };
  const html = await render.colophon(site);
  assert.match(html, /<strong>zero deps<\/strong>/);
  assert.match(html, /<li>.*apps\.json<\/li>/);
});
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Create `templates/colophon.html`**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>colophon | info.opplipo.cn</title>
  <link rel="stylesheet" href="{{assets.styles}}">
  <link rel="alternate" type="application/atom+xml" href="/feed.xml" title="info.opplipo.cn">
</head>
<body>
  <main class="page">
    <a class="back-link" href="/">← 返回首页</a>

    <div class="term-prompt">
      <span class="prompt-arrow">$</span><span class="prompt-user">cat</span><span class="prompt-path">/colophon.md</span>
    </div>

    <section class="colophon-page">
      <h1 class="colophon-title">// COLOPHON</h1>
      <p class="colophon-subtitle">本站是如何构建的。</p>

      <div class="term-label">// STACK</div>
      <dl class="colophon-list">
        <dt>build</dt><dd>{{colophon.stack.build}}</dd>
        <dt>deploy</dt><dd>{{colophon.stack.deploy}}</dd>
        <dt>font</dt><dd>{{colophon.stack.font}}</dd>
        <dt>colors</dt><dd>{{colophon.stack.colors}}</dd>
        <dt>icons</dt><dd>{{colophon.stack.icons}}</dd>
      </dl>

      <div class="term-label">// PHILOSOPHY</div>
      <div class="prose colophon-philosophy">{{{colophon.philosophyHtml}}}</div>

      <div class="term-label">// STRUCTURE</div>
      <div class="prose">{{{colophon.structureHtml}}}</div>

      <div class="term-label">// CONTRIBUTE</div>
      <div class="prose">
        <p><strong>仓库：</strong> <a href="{{colophon.contribute.repo}}">{{colophon.contribute.repo}}</a></p>
        <p><strong>Issues：</strong> <a href="{{colophon.contribute.issues}}">{{colophon.contribute.issues}}</a></p>
        <p><strong>指南：</strong> {{colophon.contribute.guidelines}}</p>
        <p>{{colophon.contribute.thanks}}</p>
      </div>

      <div class="term-label">// LICENSE</div>
      <dl class="colophon-list">
        <dt>code</dt><dd>{{colophon.license.code}}</dd>
        <dt>content</dt><dd>{{colophon.license.content}}</dd>
        <dt>note</dt><dd>{{colophon.license.note}}</dd>
      </dl>

      <div class="term-label">// ACKNOWLEDGMENTS</div>
      <p class="prose">{{colophon.acknowledgments}}</p>
    </section>

    <footer class="site-footer">
      <p>© {{year}} lipo · 站点部署于 GitHub Pages · <a href="/search/">搜索</a> · <a href="/colophon/">colophon</a></p>
      <p class="site-footer__contact"><a href="mailto:lipo8081@gmail.com">Contact · lipo8081@gmail.com</a></p>
    </footer>
  </main>
  <script type="module" src="{{assets.app}}"></script>
</body>
</html>
```

- [ ] **Step 4: Add `render.colophon` to build.mjs**

```javascript
async colophon(site) {
  const tpl = await readFile(join(ROOT, 'templates', 'colophon.html'), 'utf8');
  const c = site.colophon ?? {};
  const scope = {
    ...site,
    colophon: {
      ...c,
      philosophyHtml: c.philosophy ? renderMarkdown(c.philosophy) : '',
      structureHtml: c.structure ? renderMarkdown(c.structure) : '',
    },
    assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
    year: String(new Date().getFullYear()),
  };
  return renderTemplate(tpl, scope);
},
```

- [ ] **Step 5: Run, verify 94 pass**

- [ ] **Step 6: Commit**

```bash
git add build.mjs templates/colophon.html tests/build.test.mjs
git commit -m "Add render.colophon and colophon.html template"
```

---

## Task 2: `site.json` validation for `colophon`

**Files:**
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Add the failing tests**

```javascript
test('validateSiteJson: accepts site.colophon as optional object', () => {
  const site = {
    author: { name: 'x', tagline: 'y' },
    thoughts: { tree: [] },
    collections: [],
  };
  assert.doesNotThrow(() => validateSiteJson(site));
});

test('validateSiteJson: rejects colophon with non-string fields', () => {
  const site = {
    author: { name: 'x', tagline: 'y' },
    thoughts: { tree: [] },
    collections: [],
    colophon: { stack: { build: 42 } },
  };
  assert.throws(() => validateSiteJson(site), /colophon\.stack\.build/);
});
```

- [ ] **Step 2: Extend `validateSiteJson`**

Add inside `validateSiteJson` (before the closing `}`):

```javascript
  if (site.colophon !== undefined) {
    if (typeof site.colophon !== 'object' || site.colophon === null) {
      throw new Error('site.json: colophon must be an object');
    }
    if (site.colophon.stack !== undefined) {
      if (typeof site.colophon.stack !== 'object' || site.colophon.stack === null) {
        throw new Error('site.json: colophon.stack must be an object');
      }
      for (const [k, v] of Object.entries(site.colophon.stack)) {
        if (typeof v !== 'string') {
          throw new Error(`site.json: colophon.stack.${k} must be a string`);
        }
      }
    }
    for (const f of ['philosophy', 'structure', 'acknowledgments']) {
      if (site.colophon[f] !== undefined && typeof site.colophon[f] !== 'string') {
        throw new Error(`site.json: colophon.${f} must be a string`);
      }
    }
    if (site.colophon.contribute !== undefined) {
      if (typeof site.colophon.contribute !== 'object' || site.colophon.contribute === null) {
        throw new Error('site.json: colophon.contribute must be an object');
      }
      for (const [k, v] of Object.entries(site.colophon.contribute)) {
        if (typeof v !== 'string') {
          throw new Error(`site.json: colophon.contribute.${k} must be a string`);
        }
      }
    }
    if (site.colophon.license !== undefined) {
      if (typeof site.colophon.license !== 'object' || site.colophon.license === null) {
        throw new Error('site.json: colophon.license must be an object');
      }
      for (const [k, v] of Object.entries(site.colophon.license)) {
        if (typeof v !== 'string') {
          throw new Error(`site.json: colophon.license.${k} must be a string`);
        }
      }
    }
  }
```

- [ ] **Step 3: Run, verify 96 pass**

- [ ] **Step 4: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Extend validateSiteJson for optional colophon block"
```

---

## Task 3: Wire `writeOutputs` and `buildSitemap` for colophon

**Files:**
- Modify: `build.mjs`

- [ ] **Step 1: Add colophon emission to `writeOutputs`**

After the robots.txt block:

```javascript
  // 14. /colophon/ (conditional)
  if (site.colophon) {
    const colophonDir = join(ROOT, 'colophon');
    await mkdir(colophonDir, { recursive: true });
    const colophonHtml = await render.colophon(site);
    await writeIfChanged(join(colophonDir, 'index.html'), colophonHtml);
  }
}
```

- [ ] **Step 2: Add `/colophon/` to `buildSitemap`**

After the `/search/` push:

```javascript
  if (site.colophon) {
    urls.push({ loc: `${base}/colophon/`, lastmod: today });
  }
```

- [ ] **Step 3: Add `colophon` block to `site.json`**

(Use the JSON from the spec.)

- [ ] **Step 4: Add colophon link to home footer**

Edit `templates/home.html`:

```html
<p>© {{year}} lipo · 站点部署于 GitHub Pages · <a href="/search/">搜索</a> · <a href="/colophon/">colophon</a></p>
```

- [ ] **Step 5: Add colophon CSS at end of styles.css**

```css
/* Colophon page */
.colophon-page { margin-top: 16px; }
.colophon-title {
  font-family: var(--font-heading);
  font-size: var(--text-2xl);
  margin: 0;
}
.colophon-subtitle {
  color: var(--text-muted);
  margin: 4px 0 24px;
}
.colophon-list {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 8px 16px;
  margin: 12px 0 28px;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}
.colophon-list dt {
  color: var(--accent);
  font-weight: 700;
}
.colophon-list dd {
  margin: 0;
  color: var(--text);
}
.colophon-philosophy {
  margin: 12px 0 28px;
}
```

- [ ] **Step 6: Build and verify all outputs**

```bash
cd /home/lipo/workdir/OppLipo && node build.mjs
ls -la colophon/index.html
grep -c '/colophon/' sitemap.xml
grep 'colophon' index.html
```

- [ ] **Step 7: Commit**

```bash
git add build.mjs site.json templates/home.html assets/styles.css colophon/ index.html sitemap.xml
git commit -m "Wire colophon into build, sitemap, and home footer"
```

---

## Task 4: Final verification

- [ ] **Step 1: All tests pass**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 96 passing.

- [ ] **Step 2: HTTP smoke test**

```bash
cd /home/lipo/workdir/OppLipo && python3 -m http.server 4000 >/tmp/httpd.log 2>&1 &
sleep 1
for p in /colophon/ /sitemap.xml /robots.txt; do
  s=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000$p)
  echo "$p -> $s"
done
pkill -f "python3 -m http.server 4000" 2>/dev/null
```

Expected: all 200.

- [ ] **Step 3: Visual smoke test**

```bash
cd /home/lipo/workdir/OppLipo && python3 -m http.server 4000 >/tmp/httpd.log 2>&1 &
sleep 1
chromium --headless --disable-gpu --no-sandbox --hide-scrollbars --window-size=1280,1600 --virtual-time-budget=4000 --screenshot=/tmp/v11-colophon.png http://localhost:4000/colophon/ 2>&1 | tail -1
pkill -f "python3 -m http.server 4000" 2>/dev/null
ls -la /tmp/v11-colophon.png
```

## Self-Review

- Spec coverage: data model ✓, template ✓, render function ✓, validation ✓, build wiring ✓, sitemap ✓, CSS ✓, tests ✓
- All steps have actual code blocks
- Type consistency: `render.colophon` returns the rendered HTML; validation matches
- Risks: minimal — colophon is static, no runtime behavior