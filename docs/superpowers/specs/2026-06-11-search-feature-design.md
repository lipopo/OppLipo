# Search Feature — Design Spec

**Date:** 2026-06-11
**Status:** Draft (pending user review)
**Owner:** lipo

## Goal

Add a static search feature to the site so visitors can find specific content across thoughts, apps, collections, the now page, the uses page, and the about page.

## Constraints

- Static site, GitHub Pages, no runtime backend
- Zero npm dependencies — search runs in the browser using vanilla JS
- Existing 72 tests must keep passing
- Visual style: terminal brutalist (current site aesthetic)

## Architecture

Two phases:

**Build time:** extract plain-text content from all source data (apps, thoughts, collections, now, uses, about) into a single JSON file `assets/search-index.json`.

**Runtime:** the `/search/` page loads that JSON via `fetch`, filters client-side as the user types in an `<input>`. Match results render into the page DOM. No service worker, no external dependency.

## Data flow

```
build time:                              runtime:
                                          ┌─────────────────────────┐
apps.json ─┐                              │ /search/index.html      │
site.json ─┼─► buildSearchIndex() ─► assets/search-index.json
content/  ─┘                                       │
  *.md                                                 ▼
                                            fetch() in browser
                                                    ▼
                                            initSearch() filters
                                                    ▼
                                            renderResults() DOM
```

## Search index schema

`assets/search-index.json`:

```json
{
  "generatedAt": "2026-06-11T12:00:00.000Z",
  "items": [
    {
      "type": "thought",
      "title": "示例：Markdown 渲染管线",
      "url": "/thoughts/dev--sample-thought/",
      "content": "做这个站点的过程中，我需要一个 markdown 渲染器..."
    },
    {
      "type": "app",
      "title": "LiteTerm",
      "url": "/apps/liteterm/",
      "content": "一个为移动端设计的轻量级终端模拟器..."
    }
  ]
}
```

`type` values: `thought`, `app`, `collection`, `now`, `use`, `about`.

## Build functions

### `extractText(input)`

Strips markdown / HTML noise to plain text for indexing:

- Removes fenced code blocks (` ```...``` `)
- Removes inline code (`` `...` ``)
- Removes headings (`#`), bold (`**`), italic (`*`), links (`[t](u)` → `t`)
- Collapses all whitespace to single spaces
- Trims

Used for both markdown body (thoughts, about bio) and structured fields (app tagline/description/highlights).

### `buildSearchIndex(apps, site, thoughts)`

Returns the object described above. Source data:

- `apps[]` — each contributes one item: `title=name`, `type='app'`, `url='/apps/<slug>/'`, `content=tagline + ' ' + description + ' ' + highlights.join(' ')`
- `thoughts[]` — each contributes one item: `title`, `type='thought'`, `url='/thoughts/<slug>/'`, `content=excerpt + ' ' + body`
- `site.collections[]` — each: `title`, `type='collection'`, `url='/collections/<slug>/'`, `content=description`
- `site.now` — if present: `title='现在'`, `type='now'`, `url='/now/'`, `content=now.text`
- `site.uses.categories[].items[]` — each: `title=name`, `type='use'`, `url='/uses/'`, `content=name + ' ' + notes`
- `site.author` — one item: `title=name`, `type='about'`, `url='/about/'`, `content=tagline + ' ' + bio + ' ' + social labels`

### `writeOutputs` extension

After the existing page writes, add:

```javascript
const index = buildSearchIndex(publicApps, site, thoughts);
const indexJson = JSON.stringify(index);
await writeIfChanged(join(ROOT, 'assets', 'search-index.json'), indexJson);
```

The index is always written (not conditional on search feature presence).

### `/search/` page

`render.search(site)` → `templates/search.html` → `/search/index.html`.

The page contains:
- The terminal `term-prompt` (`$ grep -ri "<query>" /site`)
- An `<input>` with id `q`
- A results container `<div id="results">`
- A small `<script>` that imports `initSearch` from `/assets/app.js`

## Template

`templates/search.html`:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>搜索 | info.opplipo.cn</title>
  <link rel="stylesheet" href="{{assets.styles}}">
</head>
<body>
  <main class="page">
    <a class="back-link" href="/">← 返回首页</a>

    <div class="term-prompt">
      <span class="prompt-arrow">$</span><span class="prompt-user">grep</span><span class="prompt-path">-ri</span><span class="prompt-output">"<span id="prompt-query">query</span>" /site</span>
    </div>

    <section class="search-page">
      <div class="search-input-wrap">
        <span class="search-input__prefix">▸</span>
        <input id="q" class="search-input" type="text" autocomplete="off" placeholder="搜索 thoughts, apps, ..." spellcheck="false">
      </div>
      <p id="search-count" class="search-count"></p>
      <div id="results" class="search-results">
        <p class="search-empty">输入关键词开始搜索。</p>
      </div>
    </section>

    <footer class="site-footer">
      <p>© {{year}} lipo · 站点部署于 GitHub Pages</p>
      <p class="site-footer__contact"><a href="mailto:lipo8081@gmail.com">Contact · lipo8081@gmail.com</a></p>
    </footer>
  </main>
  <script type="module" src="{{assets.app}}"></script>
</body>
</html>
```

## Runtime: `initSearch()` in `assets/app.js`

```javascript
async function initSearch() {
  const input = document.getElementById('q');
  const results = document.getElementById('results');
  const countEl = document.getElementById('search-count');
  const promptQuery = document.getElementById('prompt-query');
  if (!input) return;  // not on the search page

  let index;
  try {
    const res = await fetch('/assets/search-index.json');
    index = await res.json();
  } catch (e) {
    results.innerHTML = '<p class="search-empty">搜索索引加载失败。</p>';
    return;
  }

  // ?q=... deep link
  const params = new URLSearchParams(location.search);
  if (params.get('q')) {
    input.value = params.get('q');
  }

  const update = () => {
    const q = input.value.trim().toLowerCase();
    if (promptQuery) promptQuery.textContent = q || 'query';
    if (!q) {
      results.innerHTML = '<p class="search-empty">输入关键词开始搜索。</p>';
      countEl.textContent = '';
      return;
    }
    const matches = (index.items ?? [])
      .map((doc) => ({ doc, score: scoreMatch(doc, q) }))
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score);
    renderResults(results, matches, q);
    countEl.textContent = `// ${matches.length} matches`;
  };

  input.addEventListener('input', update);
  update();
}

function scoreMatch(doc, q) {
  const title = doc.title.toLowerCase();
  const content = doc.content.toLowerCase();
  let score = 0;
  if (title.includes(q)) score += 10;
  // bonus for matches in the first 100 chars of content
  if (content.slice(0, 100).includes(q)) score += 3;
  if (content.includes(q)) score += 1;
  return score;
}

function renderResults(container, matches, q) {
  if (!matches.length) {
    container.innerHTML = `<p class="search-empty">没有匹配 "${escapeHtml(q)}" 的内容。</p>`;
    return;
  }
  container.innerHTML = matches.map(({ doc, score }) => {
    const titleHl = highlight(doc.title, q);
    const excerpt = makeExcerpt(doc.content, q, 80);
    const excerptHl = highlight(excerpt, q);
    return `<a class="search-result" href="${escapeAttr(doc.url)}">
      <span class="search-result__type">${escapeHtml(doc.type)}</span>
      <span class="search-result__title">${titleHl}</span>
      <span class="search-result__excerpt">${excerptHl}</span>
    </a>`;
  }).join('');
}

function highlight(text, q) {
  if (!q) return escapeHtml(text);
  // Split on case-insensitive matches; rebuild with <mark>.
  const re = new RegExp(escapeRe(q), 'gi');
  let result = '';
  let last = 0;
  for (const m of text.matchAll(re)) {
    result += escapeHtml(text.slice(last, m.index));
    result += '<mark>' + escapeHtml(m[0]) + '</mark>';
    last = m.index + m[0].length;
  }
  result += escapeHtml(text.slice(last));
  return result;
}

function makeExcerpt(content, q, len) {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return content.slice(0, len);
  const start = Math.max(0, idx - Math.floor(len / 2));
  return (start > 0 ? '…' : '') + content.slice(start, start + len) + (start + len < content.length ? '…' : '');
}

function escapeHtml(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
```

## CSS additions

```css
/* Search page */
.search-page { margin-top: 16px; }
.search-input-wrap {
  display: flex; align-items: center; gap: 8px;
  border: 1px solid var(--border);
  padding: 10px 12px;
  background: var(--surface);
}
.search-input-wrap:focus-within { border-color: var(--accent); }
.search-input__prefix { color: var(--accent); font-family: var(--font-mono); }
.search-input {
  flex: 1; background: transparent; border: 0; outline: 0;
  font-family: var(--font-mono); font-size: var(--text-base);
  color: var(--text);
}
.search-input::placeholder { color: var(--text-muted); }
.search-count {
  font-family: var(--font-mono); font-size: var(--text-xs);
  color: var(--text-muted); margin: 12px 0;
}
.search-results { display: flex; flex-direction: column; gap: 1px; }
.search-empty {
  font-family: var(--font-mono); font-size: var(--text-sm);
  color: var(--text-muted); padding: 16px 0;
}
.search-result {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 12px;
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  text-decoration: none; color: var(--text);
}
.search-result:hover { border-color: var(--accent); }
.search-result__type {
  font-family: var(--font-mono); font-size: var(--text-xs);
  color: var(--accent); align-self: center;
  padding: 2px 6px; border: 1px solid var(--accent);
  text-align: center;
}
.search-result__title {
  font-family: var(--font-mono); font-size: var(--text-base);
  color: var(--text); font-weight: 700;
}
.search-result__excerpt {
  grid-column: 2;
  font-family: var(--font-mono); font-size: var(--text-xs);
  color: var(--text-muted); margin-top: 4px;
  line-height: 1.5;
}
.search-result__excerpt mark,
.search-result__title mark {
  background: var(--accent); color: #080808; padding: 0 2px;
}
```

## Tests (target 78/78)

| # | Test |
|---|---|
| 73 | `extractText: strips markdown noise to plain text` |
| 74 | `extractText: removes fenced code blocks` |
| 75 | `extractText: removes inline code` |
| 76 | `extractText: converts links to anchor text only` |
| 77 | `buildSearchIndex: contains one item per app / thought / collection` |
| 78 | `buildSearchIndex: includes site.now and site.uses when present` |
| 79 | `buildSearchIndex: skips thought files that failed to walk` |
| 80 | `validateSearchIndex: rejects missing type / title / url / content` |

(Note: 7 tests added because spec got refined beyond initial 4. Target 80/80.)

## Out of scope (YAGNI)

- Fuzzy / typo-tolerant matching (could be added later via n-grams or Levenshtein)
- Search analytics / popular queries tracking
- Highlighting inside fenced code blocks (we strip them in the index)
- Tag-based faceted search
- Search suggestions / autocomplete dropdown
- Pagination of results

## Risk notes

- Index file size: ~14KB raw / ~4KB gzipped. Acceptable for GitHub Pages.
- `fetch` failure on the search page (offline, broken build): handled with try/catch + visible error.
- XSS via highlight: `highlight()` runs `escapeHtml` on each segment before wrapping in `<mark>`, so injected HTML in source data cannot escape.
- Performance: with ~25 items, naive substring filter is sub-millisecond. No need for indexing libraries.