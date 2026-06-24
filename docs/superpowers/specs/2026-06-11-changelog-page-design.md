# Changelog Page — Design Spec

**Date:** 2026-06-11
**Status:** Draft (pending user review)
**Owner:** lipo

## Goal

Add `/changelog/` — a consolidated release log across all apps. Reuses the existing `aggregateRecentReleases` (called with no limit). Single flat reverse-chronological list of releases with app name, version, date, and notes.

## Constraints

- Static site, GitHub Pages, no runtime backend
- Zero npm dependencies
- Existing 96 tests must keep passing
- Terminal brutalist aesthetic preserved

## Data source

`aggregateRecentReleases(apps)` (already exists) called with `limit=Infinity`. Returns the same shape as the home page's `recentReleases`:

```javascript
{
  appSlug: 'liteterm',
  appName: 'LiteTerm',
  appColor: ['#0a3320', '#031a10'],
  version: '0.2.0',
  releasedAt: '2026-05-20',
  notes: '首次内测'
}
```

No new data, no schema changes. The page is **conditional** — emitted only if at least one release exists.

## Template: `templates/changelog.html`

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

The `.releases` and `.releases__item` classes already exist in styles.css (used by the thought page for `// RELEASES`). We reuse them.

## Render: `render.changelog(site, apps)`

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
}
```

## Build wiring

```javascript
// 15. /changelog/ (conditional: only if there are releases)
const allReleases = aggregateRecentReleases(publicApps, Infinity);
if (allReleases.length > 0) {
  const changelogDir = join(ROOT, 'changelog');
  await mkdir(changelogDir, { recursive: true });
  const changelogHtml = await render.changelog(site, publicApps);
  await writeIfChanged(join(changelogDir, 'index.html'), changelogHtml);
}
```

## Sitemap

```javascript
if (aggregateRecentReleases(publicApps, Infinity).length > 0) {
  urls.push({ loc: `${base}/changelog/`, lastmod: today });
}
```

## RSS feed addition

`buildAtomFeed` gets one extra entry (after the existing thought / app-release / now / uses entries):

```javascript
if (allReleases.length > 0) {
  const topThree = allReleases.slice(0, 3);
  const md = topThree
    .map((r) => `- **${r.appName} v${r.version}** (${r.releasedAt}) — ${r.notes ?? '—'}`)
    .join('\n');
  const latestDate = allReleases[0]?.releasedAt ?? today;
  items.push({
    title: '发布记录 更新',
    url: `${baseUrl}/changelog/`,
    id: `${baseUrl}/changelog/#${latestDate}`,
    updated: `${latestDate}T00:00:00Z`,
    contentHtml: renderMarkdown(`## 最新发布\n\n${md}`),
  });
}
```

## Home page

Two changes:

### MORE block: add a 6th card

```html
<a class="card card--small" href="/changelog/">
  <div class="card__icon more-block__glyph">▨</div>
  <div class="card__body">
    <div class="card__name">changelog</div>
    <div class="card__category">{{changelogCount}} 条发布</div>
  </div>
</a>
```

`render.home` scope needs a new `changelogCount` (int from `aggregateRecentReleases(publicApps, Infinity).length`).

### Footer: add link

Append `· <a href="/changelog/">changelog</a>` to the existing footer paragraph.

## CSS additions

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

(The existing `.releases`, `.releases__item`, `.releases__version`, `.releases__date`, `.releases__notes` styles apply.)

## Tests (3 new, target 99/99)

| # | Test |
|---|---|
| 97 | `aggregateRecentReleases: with Infinity limit returns all releases` |
| 98 | `render.changelog: produces page with all releases and terminal prompt` |
| 99 | `render.changelog: produces empty state when no releases` |

## Out of scope (YAGNI)

- Per-app / per-month / per-year grouping
- Atom feed for /changelog alone (the main feed already has the changelog entry)
- Auto-generation from git tags
- Markdown file for full changelog history (site.json is the source)

## Risk notes

- `aggregateRecentReleases(apps, Infinity)` could return a large array if many apps each have many releases. For a personal site with ~5 apps and ~10 releases each = ~50 items. Trivial.
- Reuse of existing `.releases` class — the changelog rows use the same horizontal grid as the thought page's release list. Visual consistency is intentional.