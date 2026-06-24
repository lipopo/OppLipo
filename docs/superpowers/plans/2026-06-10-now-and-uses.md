# /now and /uses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Add `/now/` and `/uses/` pages with site.json-driven content, expanding the home MORE block from 3 to 5 items.

**Architecture:** Two new render functions (`render.now`, `render.uses`) plus two templates. `site.json` schema extended with `now.text` (Markdown) and `uses.categories[]` (predefined list). Build wiring conditionally emits the pages.

**Tech Stack:** Node 20+ stdlib, `node --test`, existing terminal brutalist CSS.

**Spec:** `docs/superpowers/specs/2026-06-10-now-and-uses-design.md`

---

## File Structure

**New files:**
- `templates/now.html`
- `templates/uses.html`

**Modified files:**
- `build.mjs` — add `render.now`, `render.uses`, extend `validateSiteJson`, extend `writeOutputs`, extend `render.home` scope
- `templates/home.html` — expand MORE block to 5 cards
- `assets/styles.css` — add `.page--narrow`, `.now-page`, `.now-content`, `.uses-category`, `.uses-item` rules
- `site.json` — add `now` and `uses` sample data
- `tests/build.test.mjs` — add 4 new tests

---

## Task 1: `render.now` + `templates/now.html`

**Files:**
- Create: `templates/now.html`
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
test('render.now: produces page with markdown content and term prompt', async () => {
  const site = {
    now: { text: '## 现在 · Q3 2026\n\n这是现在的内容。' },
    thoughts: { tree: [] },
    collections: [],
  };
  const html = await render.now(site);
  assert.match(html, /现在/);
  assert.match(html, /<h2>现在 · Q3 2026<\/h2>/);
  assert.match(html, /这是现在的内容/);
  assert.match(html, /\/now\.md/);
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 1 fail.

- [ ] **Step 3: Create `templates/now.html`**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>现在 | info.opplipo.cn</title>
  <link rel="stylesheet" href="{{assets.styles}}">
</head>
<body>
  <main class="page page--narrow">
    <a class="back-link" href="/">← 返回首页</a>

    <div class="term-prompt">
      <span class="prompt-arrow">$</span><span class="prompt-user">cat</span><span class="prompt-path">/now.md</span>
    </div>

    <article class="now-page">
      <header class="now-page__header">
        <div class="term-label">UPDATED · {{updatedAt}}</div>
      </header>
      <div class="now-content">{{{now.html}}}</div>
    </article>

    <footer class="site-footer">
      <p>© {{year}} lipo · 站点部署于 GitHub Pages</p>
      <p class="site-footer__contact"><a href="mailto:lipo8081@gmail.com">Contact · lipo8081@gmail.com</a></p>
    </footer>
  </main>
  <script type="module" src="{{assets.app}}"></script>
</body>
</html>
```

- [ ] **Step 4: Add `render.now` to build.mjs**

```javascript
async now(site) {
  const tpl = await readFile(join(ROOT, 'templates', 'now.html'), 'utf8');
  const scope = {
    ...site,
    now: { ...site.now, html: site.now?.text ? renderMarkdown(site.now.text) : '' },
    updatedAt: new Date().toISOString().slice(0, 10),
    assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
    year: String(new Date().getFullYear()),
  };
  return renderTemplate(tpl, scope);
},
```

- [ ] **Step 5: Run tests, verify 69 pass**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add build.mjs templates/now.html tests/build.test.mjs
git commit -m "Add /now page with terminal prompt and markdown content"
```

---

## Task 2: `render.uses` + `templates/uses.html`

**Files:**
- Create: `templates/uses.html`
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
test('render.uses: produces page with all categories and items', async () => {
  const site = {
    thoughts: { tree: [] },
    collections: [],
    uses: {
      categories: [
        { name: '硬件', items: [
          { name: 'MacBook Pro', notes: '主力开发本' },
          { name: 'HHKB', notes: '外接键盘' },
        ]},
        { name: '服务', items: [
          { name: 'GitHub Pages', notes: '' },
        ]},
      ],
    },
  };
  const html = await render.uses(site);
  assert.match(html, /硬件/);
  assert.match(html, /服务/);
  assert.match(html, /MacBook Pro/);
  assert.match(html, /HHKB/);
  assert.match(html, /GitHub Pages/);
  assert.match(html, /\/uses\//);
});
```

- [ ] **Step 2: Run test, expect failure**

- [ ] **Step 3: Create `templates/uses.html`**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>使用 | info.opplipo.cn</title>
  <link rel="stylesheet" href="{{assets.styles}}">
</head>
<body>
  <main class="page">
    <a class="back-link" href="/">← 返回首页</a>

    <div class="term-prompt">
      <span class="prompt-arrow">$</span><span class="prompt-user">ls</span><span class="prompt-path">/uses/</span><span class="prompt-output">{{categoryCount}} 类别 · {{itemCount}} 件</span>
    </div>

    {{#each uses.categories}}
      <section class="uses-category">
        <div class="term-label">{{name}} <span class="term-label__count">{{items.length}}</span></div>
        <ul class="uses-list">
          {{#each items}}
            <li class="uses-item">
              <span class="uses-item__name">{{name}}</span>
              {{#if notesHtml}}<span class="uses-item__notes">{{{notesHtml}}}</span>{{/if}}
            </li>
          {{/each}}
        </ul>
      </section>
    {{/each}}

    <footer class="site-footer">
      <p>© {{year}} lipo · 站点部署于 GitHub Pages</p>
      <p class="site-footer__contact"><a href="mailto:lipo8081@gmail.com">Contact · lipo8081@gmail.com</a></p>
    </footer>
  </main>
  <script type="module" src="{{assets.app}}"></script>
</body>
</html>
```

- [ ] **Step 4: Add `render.uses` to build.mjs**

```javascript
async uses(site) {
  const tpl = await readFile(join(ROOT, 'templates', 'uses.html'), 'utf8');
  const categories = (site.uses?.categories ?? []).map((cat) => ({
    ...cat,
    items: (cat.items ?? []).map((it) => ({
      ...it,
      notesHtml: it.notes ? renderMarkdown(it.notes) : '',
    })),
  }));
  const scope = {
    ...site,
    uses: { ...site.uses, categories },
    itemCount: categories.reduce((sum, c) => sum + c.items.length, 0),
    categoryCount: categories.length,
    assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
    year: String(new Date().getFullYear()),
  };
  return renderTemplate(tpl, scope);
},
```

- [ ] **Step 5: Run tests, verify 70 pass**

- [ ] **Step 6: Commit**

```bash
git add build.mjs templates/uses.html tests/build.test.mjs
git commit -m "Add /uses page with categorized tools list"
```

---

## Task 3: Validate `now.text` and `uses.categories`

**Files:**
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing tests**

```javascript
test('validateSiteJson: rejects missing now.text', () => {
  const site = {
    author: { name: 'x', tagline: 'x' },
    thoughts: { tree: [] },
    collections: [],
    now: {},
  };
  assert.throws(() => validateSiteJson(site), /now\.text/);
});

test('validateSiteJson: rejects uses.categories without name', () => {
  const site = {
    author: { name: 'x', tagline: 'x' },
    thoughts: { tree: [] },
    collections: [],
    uses: { categories: [{ items: [] }] },
  };
  assert.throws(() => validateSiteJson(site), /categories\[0\]\.name/);
});
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Extend `validateSiteJson`**

Add at the end of the function (after the `collections` block):

```javascript
  if (site.now !== undefined) {
    if (typeof site.now !== 'object' || site.now === null) {
      throw new Error('site.json: now must be an object');
    }
    if (typeof site.now.text !== 'string' || !site.now.text) {
      throw new Error('site.json: now.text is required');
    }
  }
  if (site.uses !== undefined) {
    if (typeof site.uses !== 'object' || site.uses === null) {
      throw new Error('site.json: uses must be an object');
    }
    if (!Array.isArray(site.uses.categories)) {
      throw new Error('site.json: uses.categories must be an array');
    }
    for (const [i, cat] of site.uses.categories.entries()) {
      if (typeof cat.name !== 'string' || !cat.name) {
        throw new Error(`site.json: uses.categories[${i}].name is required`);
      }
      if (!Array.isArray(cat.items)) {
        throw new Error(`site.json: uses.categories[${i}].items must be an array`);
      }
      for (const [j, it] of cat.items.entries()) {
        if (typeof it.name !== 'string' || !it.name) {
          throw new Error(`site.json: uses.categories[${i}].items[${j}].name is required`);
        }
      }
    }
  }
```

- [ ] **Step 4: Run tests, verify 72 pass**

- [ ] **Step 5: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Extend validateSiteJson for now and uses blocks"
```

---

## Task 4: Wire `writeOutputs` to emit `/now/` and `/uses/`

**Files:**
- Modify: `build.mjs`

- [ ] **Step 1: Find current `writeOutputs` ending**

- [ ] **Step 2: Append two new output blocks**

```javascript
  // 6. /now/ (conditional)
  if (site.now) {
    const nowDir = join(ROOT, 'now');
    await mkdir(nowDir, { recursive: true });
    const nowHtml = await render.now(site);
    await writeIfChanged(join(nowDir, 'index.html'), nowHtml);
  }

  // 7. /uses/ (conditional)
  if (site.uses) {
    const usesDir = join(ROOT, 'uses');
    await mkdir(usesDir, { recursive: true });
    const usesHtml = await render.uses(site);
    await writeIfChanged(join(usesDir, 'index.html'), usesHtml);
  }
```

- [ ] **Step 3: Build with empty site (no now/uses yet) — verify no crash**

```bash
cd /home/lipo/workdir/OppLipo && node build.mjs
```

Expected: clean build, no `/now/` or `/uses/` directories written.

- [ ] **Step 4: Commit**

```bash
git add build.mjs
git commit -m "Wire writeOutputs to emit /now/ and /uses/ pages"
```

---

## Task 5: Expand home MORE block from 3 to 5 cards

**Files:**
- Modify: `templates/home.html`
- Modify: `build.mjs` (`render.home` scope)

- [ ] **Step 1: Update `templates/home.html` MORE block**

Find the existing MORE block. After the 3 existing cards, add 2 more:

```html
        <a class="card card--small" href="/now/">
          <div class="card__icon more-block__glyph">▦</div>
          <div class="card__body">
            <div class="card__name">现在</div>
            <div class="card__category">{{nowUpdatedAt}}</div>
          </div>
        </a>
        <a class="card card--small" href="/uses/">
          <div class="card__icon more-block__glyph">▧</div>
          <div class="card__body">
            <div class="card__name">使用</div>
            <div class="card__category">{{usesItemCount}} 件装备</div>
          </div>
        </a>
```

- [ ] **Step 2: Extend `render.home` scope**

Find the scope object and add:

```javascript
    nowUpdatedAt: site?.now?.text ? new Date().toISOString().slice(0, 10) : '—',
    usesItemCount: (site?.uses?.categories ?? []).reduce((sum, c) => sum + (c.items?.length ?? 0), 0),
```

- [ ] **Step 3: Build and verify home page has 5 cards**

```bash
cd /home/lipo/workdir/OppLipo && node build.mjs && grep -c 'card--small' index.html
```

Expected: at least 5 matches.

- [ ] **Step 4: Commit**

```bash
git add templates/home.html build.mjs index.html
git commit -m "Expand home MORE block to 5 cards including /now and /uses"
```

---

## Task 6: Add CSS for the two new pages

**Files:**
- Modify: `assets/styles.css`

- [ ] **Step 1: Append at end of CSS file (inside the `/* === Personal brand additions === */` block)**

```css
/* Narrow page variant */
.page--narrow { max-width: 640px; }

/* /now page */
.now-page__header { margin-bottom: 24px; }
.now-content {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  line-height: 1.9;
  color: var(--text);
}
.now-content h1, .now-content h2 {
  font-family: var(--font-heading);
  font-weight: 700;
  margin: 28px 0 14px;
  color: var(--accent);
  text-shadow: 0 0 12px rgba(0, 255, 60, 0.2);
}
.now-content h1 { font-size: var(--text-2xl); }
.now-content h2 { font-size: var(--text-xl); }
.now-content p { margin: 0 0 16px; }
.now-content a { color: var(--accent); }
.now-content a:hover { text-decoration: underline; }

/* /uses page */
.uses-category { margin-top: 32px; }
.uses-category:first-of-type { margin-top: 24px; }
.uses-list { list-style: none; padding: 0; margin: 12px 0 0; }
.uses-item {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 2fr;
  gap: 16px;
  align-items: baseline;
  padding: 10px 0;
  border-bottom: 1px dashed var(--border);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}
.uses-item:last-child { border-bottom: 0; }
.uses-item__name {
  color: var(--text);
  font-weight: 700;
}
.uses-item__name::before { content: "▸ "; color: var(--accent); }
.uses-item__notes {
  color: var(--text-muted);
  font-size: var(--text-xs);
}
.uses-item__notes p { margin: 0; display: inline; }
.uses-item__notes a { color: var(--text-dim); }

/* MORE block grid (5 cards) */
.more-block__grid { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }

@media (max-width: 640px) {
  .uses-item {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
```

- [ ] **Step 2: Build and verify CSS is loaded**

```bash
cd /home/lipo/workdir/OppLipo && node build.mjs
```

- [ ] **Step 3: Commit**

```bash
git add assets/styles.css
git commit -m "Add CSS for /now and /uses pages"
```

---

## Task 7: Add sample data to `site.json`

**Files:**
- Modify: `site.json`

- [ ] **Step 1: Add `now` and `uses` blocks**

Read `site.json` first. Add at the top level:

```json
{
  "now": {
    "text": "## 现在 · Q3 2026\n\n主线是 LiteTerm 收尾 —— 移动端 SSH 客户端终于要做到 1.0。\n\n副线是 TinyLog 修小 bug。\n\n[PageMail](/apps/pagemail/) 还在调研阶段，邮件投递通道还没定。"
  },
  "uses": {
    "categories": [
      {
        "name": "硬件",
        "items": [
          { "name": "MacBook Pro 14\" (M2 Pro, 32GB)", "notes": "日常开发主力" },
          { "name": "iPhone 15 Pro", "notes": "真机调试" },
          { "name": "HHKB Studio", "notes": "外接键盘，Vim 模式" }
        ]
      },
      {
        "name": "开发",
        "items": [
          { "name": "VS Code + Vim 插件", "notes": "主力编辑器" },
          { "name": "Android Studio", "notes": "仅做 Android 时用" },
          { "name": "Ghostty", "notes": "终端模拟器" }
        ]
      },
      {
        "name": "服务",
        "items": [
          { "name": "GitHub Pages", "notes": "本站部署" },
          { "name": "Cloudflare DNS", "notes": "info.opplipo.cn" }
        ]
      }
    ]
  }
}
```

(Add these keys alongside the existing `author`, `thoughts`, `collections`.)

- [ ] **Step 2: Build and verify `/now/` and `/uses/` are emitted**

```bash
cd /home/lipo/workdir/OppLipo && node build.mjs
ls now/ uses/
```

Expected: `index.html` files exist in both directories.

- [ ] **Step 3: Run all tests**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -8
```

Expected: 72 passing.

- [ ] **Step 4: Commit**

```bash
git add site.json index.html about/ apps/ collections/ thoughts/ now/ uses/
git commit -m "Add now and uses sample data; build the two new pages"
```

---

## Task 8: Final verification

**Files:** none (read-only)

- [ ] **Step 1: All tests pass**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 72 passing, 0 failing.

- [ ] **Step 2: All routes present**

```bash
cd /home/lipo/workdir/OppLipo && for p in / /about/ /thoughts/ /collections/ /now/ /uses/; do test -f "${p%/}/index.html" && echo "$p ok" || echo "$p MISSING"; done
```

Expected: all 6 routes OK.

- [ ] **Step 3: No placeholder leaks**

```bash
cd /home/lipo/workdir/OppLipo && grep -r '{{' now/ uses/ --include='*.html' && echo LEAKED || echo clean
```

Expected: `clean`.

- [ ] **Step 4: HTTP smoke test**

```bash
cd /home/lipo/workdir/OppLipo && python3 -m http.server 4000 >/tmp/httpd.log 2>&1 &
sleep 1
for p in / /about/ /thoughts/ /collections/ /now/ /uses/; do
  s=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000$p)
  echo "$p -> $s"
done
pkill -f "python3 -m http.server 4000" 2>/dev/null
```

Expected: all 200.

- [ ] **Step 5: Commit any final tweaks**

If anything needed adjustment:

```bash
git add -A
git commit -m "Polish /now and /uses pages"
```

Otherwise skip.

## Self-Review

- Spec coverage: data model ✓, routes ✓, render functions ✓, templates ✓, validation ✓, build wiring ✓, MORE block expansion ✓, CSS ✓, tests ✓
- Placeholder scan: none — all code blocks complete
- Type consistency: `render.now`, `render.uses`, `validateSiteJson` extensions, scope fields (`nowUpdatedAt`, `usesItemCount`) all consistent across tasks
- Risks: small (5-col grid uses auto-fit; Markdown already escaped)