# Archive Page Implementation Plan

> Steps use checkbox syntax. Implement task-by-task.

**Goal:** `/archive/` — flat reverse-chronological list of all thoughts. Plus link in /thoughts, footer, and sitemap.

**Tech Stack:** Node 20+ stdlib, vanilla JS, terminal brutalist CSS.

**Spec:** `docs/superpowers/specs/2026-06-12-archive-page-design.md`

---

## File Structure

**New files:**
- `templates/archive.html`

**Modified files:**
- `build.mjs` — add `render.archive`, wire `writeOutputs`, extend `buildSitemap`
- `templates/thoughts-index.html` — add link to /archive/
- `templates/home.html` — add archive link to footer
- `assets/styles.css` — archive page styles
- `tests/build.test.mjs` — add 2 new tests

---

## Task 1: `render.archive` + `templates/archive.html`

**Files:**
- Create: `templates/archive.html`
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing tests**

```javascript
test('render.archive: produces page with all thoughts sorted by date desc', async () => {
  const thoughts = [
    { slug: 't1', title: 'T1', excerpt: 'e1', body: 'b1', path: 'p', folder: 'dev', appSlugs: [], date: '2026-06-10' },
    { slug: 't2', title: 'T2', excerpt: 'e2', body: 'b2', path: 'p', folder: null, appSlugs: [], date: '2026-06-11' },
  ];
  const html = await render.archive({ author: { name: 'x' }, thoughts: { tree: [] }, collections: [] }, thoughts);
  assert.match(html, /ARCHIVE/);
  assert.match(html, /T2/);
  // t2 (2026-06-11) should come before t1 (2026-06-10)
  const t2Idx = html.indexOf('T2');
  const t1Idx = html.indexOf('T1');
  assert.ok(t2Idx < t1Idx, 'T2 should appear before T1');
  assert.match(html, /2 篇/);
});

test('render.archive: empty state when no thoughts', async () => {
  const html = await render.archive({ author: { name: 'x' }, thoughts: { tree: [] }, collections: [] }, []);
  assert.match(html, /暂无 thoughts/);
});
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Create `templates/archive.html`**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>archive | info.opplipo.cn</title>
  <link rel="stylesheet" href="{{assets.styles}}">
  <link rel="alternate" type="application/atom+xml" href="/feed.xml" title="info.opplipo.cn">
</head>
<body>
  <main class="page">
    <a class="back-link" href="/">← 返回首页</a>

    <div class="term-prompt">
      <span class="prompt-arrow">$</span><span class="prompt-user">ls</span><span class="prompt-path">-lt</span><span class="prompt-output">/thoughts/ | head -20</span>
    </div>

    <section class="archive-page">
      <h1 class="archive-title">// ARCHIVE</h1>
      <p class="archive-subtitle">所有 thoughts 的扁平时间线，按日期倒序。</p>
      <p class="archive-count">// {{items.length}} 篇</p>

      {{#if items.length}}
        <ul class="archive-list">
          {{#each items}}
            <li class="archive-item">
              <time class="archive-item__date">{{date}}</time>
              {{#if folder}}<span class="archive-item__folder">{{folder}}</span>{{/if}}
              <div class="archive-item__main">
                <a class="archive-item__title" href="/thoughts/{{slug}}/">{{title}}</a>
                {{#if excerpt}}<span class="archive-item__excerpt">{{excerpt}}</span>{{/if}}
              </div>
            </li>
          {{/each}}
        </ul>
      {{/if}}
      {{#unless items.length}}
        <p class="archive-empty">暂无 thoughts。</p>
      {{/unless}}
    </section>

    <footer class="site-footer">
      <p>© {{year}} lipo · 站点部署于 GitHub Pages · <a href="/search/">搜索</a> · <a href="/colophon/">colophon</a> · <a href="/changelog/">changelog</a> · <a href="/archive/">archive</a></p>
      <p class="site-footer__contact"><a href="mailto:lipo8081@gmail.com">Contact · lipo8081@gmail.com</a></p>
    </footer>
  </main>
  <script type="module" src="{{assets.app}}"></script>
</body>
</html>
```

- [ ] **Step 4: Add `render.archive` to build.mjs**

```javascript
async archive(site, thoughts) {
  const tpl = await readFile(join(ROOT, 'templates', 'archive.html'), 'utf8');
  const sorted = [...(thoughts ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const scope = {
    ...site,
    items: sorted,
    assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
    year: String(new Date().getFullYear()),
  };
  return renderTemplate(tpl, scope);
},
```

- [ ] **Step 5: Run, verify 101 pass**

- [ ] **Step 6: Commit**

```bash
git add build.mjs templates/archive.html tests/build.test.mjs
git commit -m "Add render.archive and archive.html template"
```

---

## Task 2: Wire build, sitemap, /thoughts link, home footer

**Files:**
- Modify: `build.mjs`
- Modify: `templates/thoughts-index.html`
- Modify: `templates/home.html`
- Modify: `assets/styles.css`

- [ ] **Step 1: Wire `writeOutputs` for archive**

After the changelog block:

```javascript
  // 16. /archive/ (always emitted)
  const archiveDir = join(ROOT, 'archive');
  await mkdir(archiveDir, { recursive: true });
  const archiveHtml = await render.archive(site, thoughts);
  await writeIfChanged(join(archiveDir, 'index.html'), archiveHtml);
}
```

- [ ] **Step 2: Add `/archive/` to `buildSitemap`**

After the changelog push:

```javascript
urls.push({ loc: `${base}/archive/`, lastmod: today });
```

- [ ] **Step 3: Add archive link to /thoughts page**

In `templates/thoughts-index.html`, find the `<main class="thoughts-index__main">` and add a link above the `<h1>`:

```html
<p class="thoughts-index__archive-link"><a href="/archive/">// ARCHIVE →</a> 按时间倒序查看全部</p>
```

- [ ] **Step 4: Add archive link to home footer**

In `templates/home.html`, find the footer paragraph and append `· <a href="/archive/">archive</a>`:

```html
<p>© {{year}} lipo · 站点部署于 GitHub Pages · <a href="/search/">搜索</a> · <a href="/colophon/">colophon</a> · <a href="/changelog/">changelog</a> · <a href="/archive/">archive</a></p>
```

- [ ] **Step 5: Add archive CSS at end of styles.css**

```css
/* Archive page */
.archive-page { margin-top: 16px; }
.archive-title {
  font-family: var(--font-heading);
  font-size: var(--text-2xl);
  margin: 0;
}
.archive-subtitle {
  color: var(--text-muted);
  margin: 4px 0 8px;
}
.archive-count {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0 0 16px;
}
.archive-list { list-style: none; padding: 0; margin: 0; }
.archive-item {
  display: grid;
  grid-template-columns: 100px 120px 1fr;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px dashed var(--border);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  align-items: baseline;
}
.archive-item:last-child { border-bottom: 0; }
.archive-item__date {
  color: var(--text-muted);
  font-size: var(--text-xs);
}
.archive-item__folder {
  color: var(--accent);
  font-size: var(--text-xs);
}
.archive-item__main { display: flex; flex-direction: column; gap: 2px; }
.archive-item__title {
  color: var(--text);
  text-decoration: none;
  font-weight: 700;
}
.archive-item__title:hover { color: var(--accent); }
.archive-item__excerpt {
  color: var(--text-muted);
  font-size: var(--text-xs);
  opacity: 0.7;
}
.archive-empty {
  font-family: var(--font-mono);
  color: var(--text-muted);
  padding: 16px 0;
}
.thoughts-index__archive-link {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0 0 12px;
}
.thoughts-index__archive-link a { color: var(--accent); }

@media (max-width: 640px) {
  .archive-item {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
```

- [ ] **Step 6: Build and verify all outputs**

```bash
cd /home/lipo/workdir/OppLipo && node build.mjs
ls -la archive/index.html
grep -c "/archive/" index.html thoughts/index.html sitemap.xml
```

- [ ] **Step 7: Commit**

```bash
git add build.mjs templates/thoughts-index.html templates/home.html assets/styles.css archive/ index.html thoughts/ sitemap.xml
git commit -m "Wire archive into build, sitemap, /thoughts link, and home footer"
```

---

## Task 3: Final verification

- [ ] **Step 1: All tests pass**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 101 passing.

- [ ] **Step 2: HTTP smoke test**

```bash
cd /home/lipo/workdir/OppLipo && python3 -m http.server 4000 >/tmp/httpd.log 2>&1 &
sleep 1
for p in /archive/ /sitemap.xml; do
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
chromium --headless --disable-gpu --no-sandbox --hide-scrollbars --window-size=1280,1400 --virtual-time-budget=4000 --screenshot=/tmp/v13-archive.png http://localhost:4000/archive/ 2>&1 | tail -1
pkill -f "python3 -m http.server 4000" 2>/dev/null
ls -la /tmp/v13-archive.png
```

## Self-Review

- Spec coverage: data source ✓, template ✓, render ✓, build wiring ✓, sitemap ✓, /thoughts link ✓, footer ✓, CSS ✓, tests ✓
- All steps have actual code blocks
- Type consistency: `render.archive(site, thoughts)` returns HTML; same shape used everywhere
- Risks: minimal — reuses existing data pipeline