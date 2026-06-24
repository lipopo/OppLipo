# Archive Page — Design Spec

**Date:** 2026-06-12
**Status:** Draft (pending user review)
**Owner:** lipo

## Goal

Add `/archive/` — a flat chronological list of all thoughts, complementary to `/thoughts/` (which shows the folder tree). Reuses `walkThoughts` data, no schema change.

## Constraints

- Static site, GitHub Pages, no runtime backend
- Zero npm dependencies
- Existing 99 tests must keep passing
- Terminal brutalist aesthetic preserved

## Data source

`walkThoughts(publicApps, site.thoughts)` already returns the flat array (used by `buildSearchIndex`, `buildAtomFeed`, etc.). Each item:

```javascript
{
  slug: 'dev--sample-thought',
  title: '示例：Markdown 渲染管线',
  date: '2026-06-10',
  excerpt: '如何零依赖地实现一个 markdown 渲染器',
  appSlugs: [],
  folder: 'dev',
  body: '...'
}
```

`render.archive` re-sorts by `date` descending. No new data, no new fields needed.

## Render: `render.archive(site, thoughts)`

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
}
```

## Template: `templates/archive.html`

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

Each item is a 3-cell row: `[date] [folder] [title + excerpt]`. The title + excerpt is wrapped in a single `<div>` so they stack vertically in the third column.

## Build wiring

```javascript
// 16. /archive/ (always emitted)
const archiveDir = join(ROOT, 'archive');
await mkdir(archiveDir, { recursive: true });
const archiveHtml = await render.archive(site, thoughts);
await writeIfChanged(join(archiveDir, 'index.html'), archiveHtml);
```

Always emitted — even if there are no thoughts, the page shows the empty state. No `{{#if items.length}}` check at the build level.

## /thoughts page link

In `templates/thoughts-index.html`, just above the `thoughts-index__main > h1` (or in the main column header area), add:

```html
<p class="thoughts-index__archive-link"><a href="/archive/">// ARCHIVE →</a> 按时间倒序查看全部</a></p>
```

## Home footer

Append `· <a href="/archive/">archive</a>` to the existing footer paragraph.

## Sitemap

```javascript
urls.push({ loc: `${base}/archive/`, lastmod: today });
```

## CSS

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

## Tests (2 new, target 101/101)

| # | Test |
|---|---|
| 100 | `render.archive: produces page with all thoughts sorted by date desc` |
| 101 | `render.archive: empty state when no thoughts` |

## Out of scope (YAGNI)

- Year/month grouping (still uses /thoughts folder tree)
- Pagination (small site, no need)
- Per-page search box (have /search)
- Tag filtering
- Year-based RSS subscription

## Risk notes

- Each `<li>` is 3 cells (date / folder / main). Excerpt goes inside the "main" div so it stacks under the title, not as a 4th column. This keeps the row height manageable.
- The page is always emitted (even with 0 thoughts) to maintain URL stability — `{{#unless items.length}}` shows the empty state.