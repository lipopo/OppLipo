# 404 Page + Sitemap — Design Spec

**Date:** 2026-06-11
**Status:** Draft (pending user review)
**Owner:** lipo

## Goal

Add two missing site infrastructure pieces:

1. **Custom 404 page** at `/404.html` (and `/404/index.html`) — replaces GitHub Pages' generic 404 with a styled, helpful terminal-brutalist page.
2. **Sitemap** at `/sitemap.xml` — helps search engines discover all pages; also adds a `/robots.txt` to advertise it.

## Constraints

- Static site, GitHub Pages, no runtime backend
- Zero npm dependencies
- Existing 87 tests must keep passing
- Terminal brutalist aesthetic preserved

## 404 page

### Render

`render.notFound()` returns the HTML for a 404 page. Reads `templates/404.html` template.

### Template

`templates/404.html`:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>404 | info.opplipo.cn</title>
  <link rel="stylesheet" href="{{assets.styles}}">
  <link rel="alternate" type="application/atom+xml" href="/feed.xml" title="info.opplipo.cn">
</head>
<body>
  <main class="page">
    <a class="back-link" href="/">← 返回首页</a>
    <div class="term-prompt">
      <span class="prompt-arrow">$</span><span class="prompt-user">cat</span><span class="prompt-path">{{requestedPath}}</span>
    </div>

    <section class="error-page">
      <div class="error-code">404</div>
      <h1>页面不存在</h1>
      <p class="error-hint">你访问的路径 <code>{{requestedPath}}</code> 在本站不存在。</p>

      <div class="error-search">
        <p class="term-label">// SEARCH</p>
        <form class="error-search-form" action="/search/" method="get">
          <input type="text" name="q" class="error-search-input" placeholder="搜索关键词..." autofocus>
          <button type="submit" class="cta cta--secondary">搜索 →</button>
        </form>
      </div>

      <div class="error-suggest">
        <p class="term-label">// SUGGESTED</p>
        <div id="suggest-list" class="suggest-list">
          <p class="error-loading">载入中...</p>
        </div>
      </div>

      <p class="error-actions">
        <a class="cta cta--secondary" href="/">返回首页</a>
        <a class="cta cta--secondary" href="/thoughts/">所有想法</a>
        <a class="cta cta--secondary" href="/collections/">所有精选</a>
      </p>
    </section>

    <footer class="site-footer">
      <p>© {{year}} lipo · 站点部署于 GitHub Pages · <a href="/search/">搜索</a></p>
      <p class="site-footer__contact"><a href="mailto:lipo8081@gmail.com">Contact · lipo8081@gmail.com</a></p>
    </footer>
  </main>
  <script type="module" src="{{assets.app}}"></script>
</body>
</html>
```

`requestedPath` defaults to `/` if undefined.

### Runtime: `init404()` in `assets/app.js`

```javascript
async function init404() {
  const list = document.getElementById('suggest-list');
  if (!list) return;
  let index;
  try {
    const res = await fetch('/assets/search-index.json');
    index = await res.json();
  } catch (e) {
    list.innerHTML = '<p class="error-loading">建议加载失败。</p>';
    return;
  }
  const items = (index.items ?? []).slice(0, 5);
  list.innerHTML = items.map((i) =>
    '<a class="search-result" href="' + escapeAttr(i.url) + '">' +
      '<span class="search-result__type">' + escapeHtml(i.type) + '</span>' +
      '<span class="search-result__title">' + escapeHtml(i.title) + '</span>' +
    '</a>'
  ).join('');
}
```

Add `init404()` to the boot block.

### Write outputs

```javascript
// 11. /404.html + /404/index.html
const notFoundHtml = await render.notFound();
await writeIfChanged(join(ROOT, '404.html'), notFoundHtml);
const notFoundDir = join(ROOT, '404');
await mkdir(notFoundDir, { recursive: true });
await writeIfChanged(join(notFoundDir, 'index.html'), notFoundHtml);
```

## Sitemap

### `buildSitemap(publicApps, site, thoughts)`

Returns:

```javascript
{
  urls: [
    { loc: 'https://info.opplipo.cn/', lastmod: '2026-06-11' },
    { loc: 'https://info.opplipo.cn/thoughts/', lastmod: '2026-06-11' },
    { loc: 'https://info.opplipo.cn/thoughts/dev--sample-thought/', lastmod: '2026-06-10' },
    ...
  ]
}
```

URL sources:

- Root: `/`
- Apps: `/apps/<slug>/` — lastmod = `app.releasedAt`
- Thoughts: `/thoughts/<slug>/` — lastmod = `thought.date`
- Collections: `/collections/<slug>/` — lastmod = today's build date (no content change tracking)
- Pages: `/about/`, `/thoughts/`, `/collections/`, `/now/` (if exists), `/uses/` (if exists), `/search/` — lastmod = today's build date

Order: home first, then top-level pages, then app pages, then thought pages, then collection pages.

Excludes: `/404.html` (not useful for crawlers).

### `renderSitemap(sitemap)`

```javascript
export function renderSitemap(sitemap) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const u of sitemap.urls) {
    lines.push('  <url>');
    lines.push(`    <loc>${u.loc}</loc>`);
    lines.push(`    <lastmod>${u.lastmod}</lastmod>`);
    lines.push('  </url>');
  }
  lines.push('</urlset>');
  return lines.join('\n') + '\n';
}
```

Uses the same `xmlEscape` from the RSS feature.

### Write outputs

```javascript
// 12. /sitemap.xml
const sitemap = buildSitemap(publicApps, site, thoughts);
const sitemapXml = renderSitemap(sitemap);
await writeIfChanged(join(ROOT, 'sitemap.xml'), sitemapXml);

// 13. /robots.txt
const today = new Date().toISOString().slice(0, 10);
const robotsTxt = `User-agent: *\nAllow: /\nSitemap: https://info.opplipo.cn/sitemap.xml\n`;
await writeIfChanged(join(ROOT, 'robots.txt'), robotsTxt);
```

## CSS

```css
/* 404 page */
.error-page { margin-top: 16px; }
.error-code {
  font-family: var(--font-heading); font-size: 80px;
  color: var(--accent); text-shadow: 0 0 20px rgba(0,255,60,0.3);
  line-height: 1;
}
.error-page h1 {
  font-family: var(--font-heading); font-size: var(--text-2xl);
  margin: 8px 0 16px;
}
.error-hint { color: var(--text-muted); margin-bottom: 24px; }
.error-hint code {
  background: var(--surface); padding: 2px 6px;
  border: 1px solid var(--border);
}
.error-search-form { display: flex; gap: 8px; margin: 8px 0 24px; }
.error-search-input {
  flex: 1; padding: 10px 12px;
  background: var(--surface); border: 1px solid var(--border);
  font-family: var(--font-mono); color: var(--text);
}
.error-search-input:focus { outline: 0; border-color: var(--accent); }
.error-suggest { margin-top: 24px; }
.suggest-list { display: flex; flex-direction: column; gap: 8px; }
.error-loading { color: var(--text-muted); padding: 12px 0; }
.error-actions {
  display: flex; flex-wrap: wrap; gap: 12px;
  margin-top: 32px; padding-top: 24px;
  border-top: 1px solid var(--border);
}
```

## Tests (5 new, target 92/92)

| # | Test |
|---|---|
| 88 | `buildSitemap: includes all public routes (home, about, thoughts, collections, now, uses, search, apps, thoughts, collections)` |
| 89 | `buildSitemap: excludes /404.html from the URL list` |
| 90 | `buildSitemap: uses thought.date for thought lastmod, app.releasedAt for apps` |
| 91 | `renderSitemap: produces valid XML with urlset root element` |
| 92 | `render.notFound: produces page with terminal prompt and requestedPath placeholder` |

## Out of scope (YAGNI)

- /404.html fallback to GitHub Pages 404 behavior (deploy concern, not build)
- Multiple sub-sitemaps + sitemap index
- `changefreq`, `priority` per URL
- Image sitemap
- News sitemap
- Custom 404 styling animations

## Risk notes

- 404 page is static — actual 404 status code is set by GitHub Pages based on the missing URL (so writing the same content to both `404.html` and `404/index.html` ensures the file is found regardless of how the server resolves).
- `lastmod` for top-level pages uses the build date (no content tracking). This is the standard approximation for static sites.
- `init404()` reuses the search index JSON. If that fetch fails (offline, broken build), the page still works — just without suggested links.