# Changelog Page Implementation Plan

> Steps use checkbox syntax. Implement task-by-task.

**Goal:** `/changelog/` page consolidating all app releases in reverse chronological order. Plus home MORE card, footer link, sitemap, RSS entry.

**Tech Stack:** Node 20+ stdlib, vanilla JS, terminal brutalist CSS.

**Spec:** `docs/superpowers/specs/2026-06-11-changelog-page-design.md`

---

## File Structure

**New files:**
- `templates/changelog.html`

**Modified files:**
- `build.mjs` — add `render.changelog`, wire `writeOutputs`, extend `buildAtomFeed`, extend `buildSitemap`, extend `render.home` scope
- `templates/home.html` — add 6th MORE card + footer link
- `assets/styles.css` — changelog page styles
- `tests/build.test.mjs` — add 3 new tests

---

## Task 1: `render.changelog` + `templates/changelog.html`

**Files:**
- Create: `templates/changelog.html`
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing tests**

```javascript
test('aggregateRecentReleases: with Infinity limit returns all releases', () => {
  const apps = [
    { slug: 'a', name: 'A', tagline: 't', color: ['#000', '#111'],
      releases: [{ version: '1.0', releasedAt: '2026-01-01' }] },
    { slug: 'b', name: 'B', tagline: 't', color: ['#000', '#111'],
      releases: [{ version: '1.0', releasedAt: '2026-02-01' }] },
  ];
  const all = aggregateRecentReleases(apps, Infinity);
  assert.equal(all.length, 2);
});

test('render.changelog: produces page with all releases and terminal prompt', async () => {
  const apps = [{
    slug: 'a', name: 'A', tagline: 't', color: ['#000', '#111'],
    releases: [{ version: '1.0', releasedAt: '2026-01-01', notes: 'first' }],
  }];
  const html = await render.changelog({ author: { name: 'x' }, thoughts: { tree: [] }, collections: [] }, apps);
  assert.match(html, /CHANGELOG/);
  assert.match(html, /git log/);
  assert.match(html, /1 条发布/);
  assert.match(html, /\/apps\/a\//);
  assert.match(html, /v1\.0/);
  assert.match(html, /first/);
});

test('render.changelog: produces empty state when no releases', async () => {
  const apps = [{ slug: 'a', name: 'A', tagline: 't', color: ['#000', '#111'] }];
  const html = await render.changelog({ author: { name: 'x' }, thoughts: { tree: [] }, collections: [] }, apps);
  assert.match(html, /暂无 release 记录/);
});
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Create `templates/changelog.html`**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>changelog | info.opplipo.cn</title>
  <link rel="stylesheet" href="{{assets.styles}}">
  <link rel="alternate" type="application/atom+xml" href="/feed.xml" title="info.opplipo.cn">
</head>
<body>
  <main class="page">
    <a class="back-link" href="/">← 返回首页</a>

    <div class="term-prompt">
      <span class="prompt-arrow">$</span><span class="prompt-user">git</span><span class="prompt-path">log</span><span class="prompt-output">--all --oneline</span>
    </div>

    <section class="changelog-page">
      <h1 class="changelog-title">// CHANGELOG</h1>
      <p class="changelog-subtitle">所有 app 的发布记录，按时间倒序。</p>
      <p class="changelog-count">// {{releases.length}} 条发布</p>

      {{#if releases.length}}
        <ul class="releases">
          {{#each releases}}
            <li class="releases__item">
              <a class="releases__app" href="/apps/{{appSlug}}/">
                <span class="releases__app-icon" style="--c1:{{appColor.0}}; --c2:{{appColor.1}};"></span>
                <span class="releases__app-name">{{appName}}</span>
              </a>
              <span class="releases__version">v{{version}}</span>
              <time class="releases__date">{{releasedAt}}</time>
              {{#if notes}}<span class="releases__notes">{{notes}}</span>{{/if}}
            </li>
          {{/each}}
        </ul>
      {{else}}
        <p class="changelog-empty">暂无 release 记录。</p>
      {{/if}}
    </section>

    <footer class="site-footer">
      <p>© {{year}} lipo · 站点部署于 GitHub Pages · <a href="/search/">搜索</a> · <a href="/colophon/">colophon</a> · <a href="/changelog/">changelog</a></p>
      <p class="site-footer__contact"><a href="mailto:lipo8081@gmail.com">Contact · lipo8081@gmail.com</a></p>
    </footer>
  </main>
  <script type="module" src="{{assets.app}}"></script>
</body>
</html>
```

- [ ] **Step 4: Add `render.changelog` to build.mjs**

```javascript
async changelog(site, apps) {
  const tpl = await readFile(join(ROOT, 'templates', 'changelog.html'), 'utf8');
  const scope = {
    ...site,
    releases: aggregateRecentReleases(apps, Infinity),
    assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
    year: String(new Date().getFullYear()),
  };
  return renderTemplate(tpl, scope);
},
```

- [ ] **Step 5: Run, verify 99 pass**

- [ ] **Step 6: Commit**

```bash
git add build.mjs templates/changelog.html tests/build.test.mjs
git commit -m "Add render.changelog and changelog.html template"
```

---

## Task 2: Wire build, sitemap, RSS, home

**Files:**
- Modify: `build.mjs`
- Modify: `templates/home.html`
- Modify: `assets/styles.css`

- [ ] **Step 1: Wire `writeOutputs` for changelog**

After the colophon block:

```javascript
  // 15. /changelog/ (conditional)
  const allReleases = aggregateRecentReleases(publicApps, Infinity);
  if (allReleases.length > 0) {
    const changelogDir = join(ROOT, 'changelog');
    await mkdir(changelogDir, { recursive: true });
    const changelogHtml = await render.changelog(site, publicApps);
    await writeIfChanged(join(changelogDir, 'index.html'), changelogHtml);
  }
```

- [ ] **Step 2: Add `/changelog/` to `buildSitemap`**

After the `/colophon/` push:

```javascript
  if (aggregateRecentReleases(publicApps, Infinity).length > 0) {
    urls.push({ loc: `${base}/changelog/`, lastmod: today });
  }
```

- [ ] **Step 3: Extend `buildAtomFeed` with a changelog entry**

In `buildAtomFeed`, after the uses-entry block, add:

```javascript
  if (allReleases.length > 0) {
    const topThree = allReleases.slice(0, 3);
    const md = topThree
      .map((r) => `- **${r.appName} v${r.version}** (${r.releasedAt}) — ${r.notes ?? '—'}`)
      .join('\n');
    const latestDate = allReleases[0]?.releasedAt ?? new Date().toISOString().slice(0, 10);
    items.push({
      title: '发布记录 更新',
      url: `${baseUrl}/changelog/`,
      id: `${baseUrl}/changelog/#${latestDate}`,
      updated: `${latestDate}T00:00:00Z`,
      contentHtml: renderMarkdown(`## 最新发布\n\n${md}`),
    });
  }
```

Note: this references `allReleases`. The function should compute it once at the top:

```javascript
export function buildAtomFeed(publicApps, site, thoughts) {
  const allReleases = aggregateRecentReleases(publicApps, Infinity);
  const baseUrl = 'https://info.opplipo.cn';
  const items = [];
  // ... existing code ...
  // replace the inline aggregateRecentReleases(publicApps) loop with allReleases
  for (const a of publicApps) {
    for (const r of (a.lifecycle?.releases ?? [])) {
      // ... use allReleases[i] instead
    }
  }
  // ... add changelog entry ...
}
```

Simpler: keep the existing per-app release entries, then add the changelog entry at the end.

- [ ] **Step 4: Update `render.home` scope to add `changelogCount`**

```javascript
    changelogCount: aggregateRecentReleases(apps, Infinity).length,
```

- [ ] **Step 5: Add 6th MORE card to home**

```html
<a class="card card--small" href="/changelog/">
  <div class="card__icon more-block__glyph">▨</div>
  <div class="card__body">
    <div class="card__name">changelog</div>
    <div class="card__category">{{changelogCount}} 条发布</div>
  </div>
</a>
```

- [ ] **Step 6: Add changelog CSS at end of styles.css**

```css
/* Changelog page */
.changelog-page { margin-top: 16px; }
.changelog-title {
  font-family: var(--font-heading);
  font-size: var(--text-2xl);
  margin: 0;
}
.changelog-subtitle {
  color: var(--text-muted);
  margin: 4px 0 8px;
}
.changelog-count {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0 0 20px;
}
.changelog-empty {
  font-family: var(--font-mono);
  color: var(--text-muted);
  padding: 16px 0;
}
.releases__app {
  display: inline-flex; align-items: center; gap: 8px;
  text-decoration: none; color: var(--text);
}
.releases__app-icon {
  width: 16px; height: 16px;
  background: linear-gradient(135deg, var(--c1, #1a1a22) 0%, var(--c2, #16161c) 100%);
  border: 1px solid var(--border);
  flex: 0 0 16px;
}
.releases__app-name { font-weight: 700; }
.releases__app:hover .releases__app-name { color: var(--accent); }
```

- [ ] **Step 7: Build and verify all outputs**

```bash
cd /home/lipo/workdir/OppLipo && node build.mjs
ls -la changelog/index.html
grep -c "/changelog/" index.html feed.xml sitemap.xml
```

- [ ] **Step 8: Commit**

```bash
git add build.mjs templates/home.html assets/styles.css changelog/ feed.xml sitemap.xml index.html
git commit -m "Wire changelog into build, sitemap, RSS, and home MORE block"
```

---

## Task 3: Final verification

- [ ] **Step 1: All tests pass**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 99 passing.

- [ ] **Step 2: HTTP smoke test**

```bash
cd /home/lipo/workdir/OppLipo && python3 -m http.server 4000 >/tmp/httpd.log 2>&1 &
sleep 1
for p in /changelog/ /sitemap.xml /feed.xml; do
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
chromium --headless --disable-gpu --no-sandbox --hide-scrollbars --window-size=1280,1600 --virtual-time-budget=4000 --screenshot=/tmp/v12-changelog.png http://localhost:4000/changelog/ 2>&1 | tail -1
pkill -f "python3 -m http.server 4000" 2>/dev/null
ls -la /tmp/v12-changelog.png
```

## Self-Review

- Spec coverage: data source ✓, template ✓, render ✓, build wiring ✓, sitemap ✓, RSS ✓, home MORE ✓, footer ✓, CSS ✓, tests ✓
- All steps have actual code blocks
- Type consistency: `render.changelog(site, apps)` returns HTML; same shape used everywhere
- Risks: minimal — reuses existing data pipeline