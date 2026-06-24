# Search Feature Implementation Plan

> Steps use checkbox syntax. Implement task-by-task with TDD where reasonable.

**Goal:** Add a static `/search/` page that filters content via a build-time JSON index + browser-side vanilla JS.

**Architecture:** `extractText()` + `buildSearchIndex()` produce `assets/search-index.json`. `initSearch()` in `app.js` fetches the JSON, filters on input, renders results with `<mark>` highlighting.

**Tech Stack:** Node 20+ stdlib, vanilla JS in browser, existing terminal brutalist CSS.

**Spec:** `docs/superpowers/specs/2026-06-11-search-feature-design.md`

---

## File Structure

**New files:**
- `templates/search.html`

**Modified files:**
- `build.mjs` — add `extractText`, `buildSearchIndex`, `validateSearchIndex`, `render.search`, wire into `writeOutputs` and `main`
- `assets/app.js` — add `initSearch()` and helpers (highlight, score, etc.)
- `assets/styles.css` — search page styles
- `templates/home.html` — add `search` to footer link area (optional)
- `tests/build.test.mjs` — add 8 new tests

---

## Task 1: `extractText` helper

**Files:**
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing tests**

```javascript
import { extractText } from '../build.mjs';

test('extractText: strips markdown noise to plain text', () => {
  const md = '## Hello\n\nThis is **bold** text with a [link](http://x.com).';
  const out = extractText(md);
  assert.equal(out, 'Hello This is bold text with a link.');
});

test('extractText: removes fenced code blocks', () => {
  const md = 'Before\n```js\nconst x = 1;\n```\nAfter';
  const out = extractText(md);
  assert.equal(out, 'Before After');
});

test('extractText: removes inline code', () => {
  const md = 'Use `npm install` to start';
  const out = extractText(md);
  assert.equal(out, 'Use npm install to start');
});

test('extractText: converts links to anchor text only', () => {
  const md = 'See [our docs](https://example.com/docs) for more';
  const out = extractText(md);
  assert.equal(out, 'See our docs for more');
});
```

- [ ] **Step 2: Run, expect failure**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 4 tests fail with "extractText is not a function".

- [ ] **Step 3: Add `extractText` to build.mjs**

Add near `renderMarkdownLite`:

```javascript
export function extractText(md) {
  if (typeof md !== 'string') return '';
  let s = md;
  // Remove fenced code blocks
  s = s.replace(/```[\w]*\n?[\s\S]*?```/g, ' ');
  // Remove inline code
  s = s.replace(/`[^`\n]+`/g, ' ');
  // Images: ![alt](url) → alt
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Links: [text](url) → text
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // Headings: ## ### etc.
  s = s.replace(/^#+\s+/gm, '');
  // Bold / italic: **x** *x* __x__ _x_ → x
  s = s.replace(/(\*\*|__)(.*?)\1/g, '$2');
  s = s.replace(/(\*|_)(.*?)\1/g, '$2');
  // Strikethrough
  s = s.replace(/~~(.*?)~~/g, '$1');
  // Blockquote markers
  s = s.replace(/^>\s*/gm, '');
  // List markers ( -, *, + and ordered 1. )
  s = s.replace(/^[\s]*[-*+]\s+/gm, '');
  s = s.replace(/^\s*\d+\.\s+/gm, '');
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}
```

- [ ] **Step 4: Run tests, verify 76 pass**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -5
```

Expected: 76 passing.

- [ ] **Step 5: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Add extractText helper for stripping markdown to plain text"
```

---

## Task 2: `buildSearchIndex` + `validateSearchIndex`

**Files:**
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing tests**

```javascript
import { buildSearchIndex, validateSearchIndex } from '../build.mjs';

test('buildSearchIndex: contains one item per app / thought / collection', () => {
  const apps = [
    { slug: 'a', name: 'A', tagline: 'tag', description: 'desc', highlights: ['h1'] },
    { slug: 'b', name: 'B', tagline: 'tag2', description: 'desc2' },
  ];
  const thoughts = [
    { slug: 't1', title: 'T1', excerpt: 'ex1', body: 'body1', path: 'p1', folder: null, appSlugs: [], date: '2026-01-01' },
  ];
  const site = {
    author: { name: 'lipo', tagline: 'tagline', bio: 'bio', social: [{ label: 'GH' }] },
    collections: [{ slug: 'c1', title: 'C1', description: 'cdesc' }],
  };
  const idx = buildSearchIndex(apps, site, thoughts);
  // Items: 2 apps + 1 thought + 1 collection + 1 about = 5
  assert.equal(idx.items.length, 5);
  const types = idx.items.map((i) => i.type);
  assert.ok(types.includes('app'));
  assert.ok(types.includes('thought'));
  assert.ok(types.includes('collection'));
  assert.ok(types.includes('about'));
  // Apps come first or include title check
  const appItem = idx.items.find((i) => i.type === 'app' && i.url === '/apps/a/');
  assert.equal(appItem.title, 'A');
  assert.match(appItem.content, /tag/);
  assert.match(appItem.content, /desc/);
  assert.match(appItem.content, /h1/);
});

test('buildSearchIndex: includes site.now and site.uses when present', () => {
  const idx = buildSearchIndex([], {
    author: { name: 'x', tagline: 't' },
    collections: [],
    now: { text: 'main focus' },
    uses: { categories: [{ name: 'c', items: [{ name: 'MacBook', notes: 'main machine' }] }] },
  }, []);
  const types = idx.items.map((i) => i.type);
  assert.ok(types.includes('now'));
  assert.ok(types.includes('use'));
  const useItem = idx.items.find((i) => i.type === 'use');
  assert.equal(useItem.title, 'MacBook');
  assert.match(useItem.content, /main machine/);
});

test('buildSearchIndex: skips thought files that failed to walk', () => {
  // thoughts with no body shouldn't break
  const idx = buildSearchIndex([], {
    author: { name: 'x', tagline: 't' }, collections: [],
  }, [
    { slug: 't1', title: 'T1', excerpt: '', body: '', path: 'p1', folder: null, appSlugs: [], date: '2026-01-01' },
  ]);
  const thoughtItem = idx.items.find((i) => i.type === 'thought');
  assert.ok(thoughtItem);
  assert.equal(thoughtItem.title, 'T1');
  assert.equal(thoughtItem.url, '/thoughts/t1/');
});

test('validateSearchIndex: rejects missing type / title / url / content', () => {
  assert.throws(() => validateSearchIndex({ items: [{ title: 't', url: '/x', content: 'c' }] }), /type/);
  assert.throws(() => validateSearchIndex({ items: [{ type: 'thought', url: '/x', content: 'c' }] }), /title/);
  assert.throws(() => validateSearchIndex({ items: [{ type: 'thought', title: 't', content: 'c' }] }), /url/);
  assert.throws(() => validateSearchIndex({ items: [{ type: 'thought', title: 't', url: '/x' }] }), /content/);
});
```

- [ ] **Step 2: Run, expect failure**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 4 tests fail.

- [ ] **Step 3: Add `buildSearchIndex` and `validateSearchIndex`**

```javascript
export function buildSearchIndex(apps, site, thoughts) {
  const items = [];

  // Apps
  for (const a of apps) {
    const parts = [a.tagline, a.description, (a.highlights ?? []).join(' ')].filter(Boolean);
    items.push({
      type: 'app',
      title: a.name,
      url: `/apps/${a.slug}/`,
      content: extractText(parts.join(' ')),
    });
  }

  // Thoughts
  for (const t of thoughts) {
    const parts = [t.excerpt, t.body].filter(Boolean);
    items.push({
      type: 'thought',
      title: t.title,
      url: `/thoughts/${t.slug}/`,
      content: extractText(parts.join(' ')),
    });
  }

  // Collections
  for (const c of site.collections ?? []) {
    items.push({
      type: 'collection',
      title: c.title,
      url: `/collections/${c.slug}/`,
      content: extractText(c.description ?? ''),
    });
  }

  // Now (single item)
  if (site.now?.text) {
    items.push({
      type: 'now',
      title: '现在',
      url: '/now/',
      content: extractText(site.now.text),
    });
  }

  // Uses — one item per equipment
  for (const cat of site.uses?.categories ?? []) {
    for (const it of cat.items ?? []) {
      items.push({
        type: 'use',
        title: it.name,
        url: '/uses/',
        content: extractText([it.notes ?? ''].join(' ')),
      });
    }
  }

  // Author / about
  if (site.author) {
    const parts = [site.author.tagline, site.author.bio, (site.author.social ?? []).map((s) => s.label).join(' ')].filter(Boolean);
    items.push({
      type: 'about',
      title: site.author.name,
      url: '/about/',
      content: extractText(parts.join(' ')),
    });
  }

  return { generatedAt: new Date().toISOString(), items };
}

export function validateSearchIndex(index) {
  const items = index?.items;
  if (!Array.isArray(items)) {
    throw new Error('search index: items must be an array');
  }
  const validTypes = new Set(['thought', 'app', 'collection', 'now', 'use', 'about']);
  for (const [i, item] of items.entries()) {
    if (!validTypes.has(item.type)) {
      throw new Error(`search index: items[${i}].type is invalid: ${item.type}`);
    }
    if (typeof item.title !== 'string' || !item.title) {
      throw new Error(`search index: items[${i}].title is required`);
    }
    if (typeof item.url !== 'string' || !item.url) {
      throw new Error(`search index: items[${i}].url is required`);
    }
    if (typeof item.content !== 'string') {
      throw new Error(`search index: items[${i}].content is required`);
    }
  }
}
```

- [ ] **Step 4: Run tests, verify 80 pass**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -5
```

Expected: 80 passing.

- [ ] **Step 5: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Add buildSearchIndex and validateSearchIndex"
```

---

## Task 3: `render.search` + `templates/search.html`

**Files:**
- Create: `templates/search.html`
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
test('render.search: produces page with input and term prompt', async () => {
  const html = await render.search({ author: { name: 'x' }, collections: [], thoughts: { tree: [] } });
  assert.match(html, /id="q"/);
  assert.match(html, /id="results"/);
  assert.match(html, /search-input/);
  assert.match(html, /grep/);
});
```

- [ ] **Step 2: Run, expect failure**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -10
```

- [ ] **Step 3: Create `templates/search.html`**

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

- [ ] **Step 4: Add `render.search`**

```javascript
async search(site) {
  const tpl = await readFile(join(ROOT, 'templates', 'search.html'), 'utf8');
  const scope = {
    ...site,
    assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
    year: String(new Date().getFullYear()),
  };
  return renderTemplate(tpl, scope);
},
```

- [ ] **Step 5: Run tests, verify 81 pass**

- [ ] **Step 6: Commit**

```bash
git add build.mjs templates/search.html tests/build.test.mjs
git commit -m "Add /search page with terminal prompt and input"
```

---

## Task 4: Wire `writeOutputs` to emit `/search/` and the index

**Files:**
- Modify: `build.mjs`

- [ ] **Step 1: Append to `writeOutputs`**

After the /uses/ block:

```javascript
  // 8. /search/
  const searchDir = join(ROOT, 'search');
  await mkdir(searchDir, { recursive: true });
  const searchHtml = await render.search(site);
  await writeIfChanged(join(searchDir, 'index.html'), searchHtml);

  // 9. assets/search-index.json (always written, no conditional)
  const searchIndex = buildSearchIndex(publicApps, site, thoughts);
  validateSearchIndex(searchIndex);
  await mkdir(join(ROOT, 'assets'), { recursive: true });
  await writeIfChanged(
    join(ROOT, 'assets', 'search-index.json'),
    JSON.stringify(searchIndex)
  );
```

- [ ] **Step 2: Build with no site changes — verify index emitted**

```bash
cd /home/lipo/workdir/OppLipo && node build.mjs
ls assets/search-index.json
```

- [ ] **Step 3: Commit**

```bash
git add build.mjs search/index.html assets/search-index.json
git commit -m "Wire writeOutputs to emit /search/ page and search index"
```

---

## Task 5: `initSearch` in `assets/app.js`

**Files:**
- Modify: `assets/app.js`

- [ ] **Step 1: Append to `assets/app.js`**

Add the search initialization functions at the end of the file:

```javascript
// ---- Search -------------------------------------------------------------

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scoreMatch(doc, q) {
  const title = doc.title.toLowerCase();
  const content = doc.content.toLowerCase();
  let score = 0;
  if (title.includes(q)) score += 10;
  if (content.slice(0, 100).includes(q)) score += 3;
  if (content.includes(q)) score += 1;
  return score;
}

function makeExcerpt(content, q, len) {
  if (!q) return content.slice(0, len);
  const lower = content.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return content.slice(0, len);
  const start = Math.max(0, idx - Math.floor(len / 2));
  const slice = content.slice(start, start + len);
  return (start > 0 ? '…' : '') + slice + (start + len < content.length ? '…' : '');
}

function highlight(text, q) {
  if (!q) return escapeHtml(text);
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

function renderSearchResults(container, matches, q) {
  if (!matches.length) {
    container.innerHTML = '<p class="search-empty">没有匹配 “' + escapeHtml(q) + '” 的内容。</p>';
    return;
  }
  container.innerHTML = matches.map(({ doc }) =>
    '<a class="search-result" href="' + escapeAttr(doc.url) + '">' +
      '<span class="search-result__type">' + escapeHtml(doc.type) + '</span>' +
      '<span class="search-result__title">' + highlight(doc.title, q) + '</span>' +
      '<span class="search-result__excerpt">' + highlight(makeExcerpt(doc.content, q, 80), q) + '</span>' +
    '</a>'
  ).join('');
}

export async function initSearch() {
  const input = document.getElementById('q');
  if (!input) return;
  const results = document.getElementById('results');
  const countEl = document.getElementById('search-count');
  const promptQuery = document.getElementById('prompt-query');

  let index;
  try {
    const res = await fetch('/assets/search-index.json');
    index = await res.json();
  } catch (e) {
    results.innerHTML = '<p class="search-empty">搜索索引加载失败。</p>';
    return;
  }

  const params = new URLSearchParams(location.search);
  if (params.get('q')) input.value = params.get('q');

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
    renderSearchResults(results, matches, q);
    countEl.textContent = '// ' + matches.length + ' matches';
  };

  input.addEventListener('input', update);
  update();
}
```

- [ ] **Step 2: Update the bottom of `app.js` to auto-init search**

Find the existing bottom of app.js (the part that runs on load) and add:

```javascript
// Run init functions based on what's present on the page.
if (document.getElementById('q')) {
  initSearch();
}
```

- [ ] **Step 3: Commit**

```bash
git add assets/app.js
git commit -m "Add initSearch to app.js with substring match and highlight"
```

---

## Task 6: Add CSS for the search page

**Files:**
- Modify: `assets/styles.css`

- [ ] **Step 1: Append at end of CSS file**

```css
/* === Search === */
.search-page { margin-top: 16px; }
.search-input-wrap {
  display: flex; align-items: center; gap: 8px;
  border: 1px solid var(--border);
  padding: 10px 12px;
  background: var(--surface);
}
.search-input-wrap:focus-within { border-color: var(--accent); }
.search-input__prefix {
  color: var(--accent); font-family: var(--font-mono);
  font-size: var(--text-base);
}
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
.search-results { display: flex; flex-direction: column; gap: 8px; }
.search-empty {
  font-family: var(--font-mono); font-size: var(--text-sm);
  color: var(--text-muted); padding: 16px 0;
}
.search-result {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 8px 12px;
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  text-decoration: none; color: var(--text);
}
.search-result:hover { border-color: var(--accent); }
.search-result__type {
  font-family: var(--font-mono); font-size: var(--text-xs);
  color: var(--accent); align-self: start;
  padding: 2px 6px; border: 1px solid var(--accent);
  text-align: center; grid-row: span 2;
}
.search-result__title {
  font-family: var(--font-mono); font-size: var(--text-base);
  color: var(--text); font-weight: 700;
}
.search-result__excerpt {
  font-family: var(--font-mono); font-size: var(--text-xs);
  color: var(--text-muted);
  line-height: 1.5;
}
.search-result__excerpt mark,
.search-result__title mark {
  background: var(--accent); color: #080808;
  padding: 0 2px;
}
```

- [ ] **Step 2: Commit**

```bash
git add assets/styles.css
git commit -m "Add CSS for the search page"
```

---

## Task 7: Add link from home to /search/

**Files:**
- Modify: `templates/home.html` (footer)

- [ ] **Step 1: Find the footer**

Find the `<footer class="site-footer">` in `templates/home.html`.

- [ ] **Step 2: Add a search link to the footer**

Replace the `<p>© ...</p>` paragraph with:

```html
<p>© {{year}} lipo · 站点部署于 GitHub Pages · <a href="/search/">搜索</a></p>
```

- [ ] **Step 3: Commit**

```bash
git add templates/home.html index.html
git commit -m "Add search link to home footer"
```

---

## Task 8: Final E2E verification

**Files:** none (read-only)

- [ ] **Step 1: All tests pass**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 80 passing.

- [ ] **Step 2: Build emits all routes**

```bash
cd /home/lipo/workdir/OppLipo && node build.mjs
test -f search/index.html && echo "/search ok"
test -f assets/search-index.json && echo "index ok"
```

- [ ] **Step 3: HTTP smoke test**

```bash
cd /home/lipo/workdir/OppLipo && python3 -m http.server 4000 >/tmp/httpd.log 2>&1 &
sleep 1
for p in / /search/ /assets/search-index.json; do
  s=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000$p)
  echo "$p -> $s"
done
pkill -f "python3 -m http.server 4000" 2>/dev/null
```

Expected: all 200.

- [ ] **Step 4: Visual smoke test (chromium headless)**

```bash
cd /home/lipo/workdir/OppLipo && python3 -m http.server 4000 >/tmp/httpd.log 2>&1 &
sleep 1
chromium --headless --disable-gpu --no-sandbox --hide-scrollbars --window-size=1280,1400 --virtual-time-budget=3000 --screenshot=/tmp/search-empty.png http://localhost:4000/search/ 2>&1 | tail -1
pkill -f "python3 -m http.server 4000" 2>/dev/null
```

View `/tmp/search-empty.png` to verify the search page renders.

## Self-Review

- Spec coverage: data model ✓, render function ✓, templates ✓, build wiring ✓, validation ✓, runtime JS ✓, CSS ✓, tests ✓
- All steps have actual code blocks (no TBDs)
- Type consistency: `buildSearchIndex` returns `{generatedAt, items[]}`; `validateSearchIndex` validates the same shape
- Risks: small (client-side only, no auth, no server); XSS mitigated by `escapeHtml` in highlight path