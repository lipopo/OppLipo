# Thought TOC Implementation Plan

> Steps use checkbox syntax. Implement task-by-task.

**Goal:** Auto-generated TOC in right sidebar of `/thoughts/<slug>/`, only when ≥ 2 h2 headings exist.

**Tech Stack:** Node 20+ stdlib, no client-side JS, terminal brutalist CSS.

**Spec:** `docs/superpowers/specs/2026-06-12-thought-toc-design.md`

---

## File Structure

**Modified files:**
- `build.mjs` — add `extractHeadings`, extend `render.thoughtPage` to inject IDs
- `templates/thought.html` — add TOC aside
- `assets/styles.css` — 3-column layout + TOC styles
- `tests/build.test.mjs` — add 3 new tests

---

## Task 1: `extractHeadings` + extend `render.thoughtPage`

**Files:**
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing tests**

```javascript
import { extractHeadings, render } from '../build.mjs';

test('extractHeadings: returns h2 lines with text', () => {
  const md = '## First\n\nIntro\n\n## Second\n\nMore\n\n## Third';
  const hs = extractHeadings(md);
  assert.equal(hs.length, 3);
  assert.equal(hs[0].text, 'First');
  assert.equal(hs[1].text, 'Second');
  assert.equal(hs[2].text, 'Third');
  assert.equal(hs[0].level, 2);
});

test('extractHeadings: ignores non-h2 lines (h1, h3, regular text)', () => {
  const md = '# H1\n## H2\n### H3\nregular\n**bold**';
  const hs = extractHeadings(md);
  assert.equal(hs.length, 1);
  assert.equal(hs[0].text, 'H2');
});

test('render.thoughtPage: produces thought-toc aside only when ≥ 2 h2 headings exist', async () => {
  const allThoughts = [
    { slug: 't1', title: 'T1', excerpt: '', body: '## One\n## Two\n## Three', path: 'p', folder: null, appSlugs: [], date: '2026-01-01' },
  ];
  const withTOC = await render.thoughtPage(allThoughts[0], allThoughts, { author: { name: 'x' } });
  assert.match(withTOC, /thought-toc/);
  assert.match(withTOC, /toc-1/);
  assert.match(withTOC, /toc-3/);

  const noTOC = await render.thoughtPage(
    { slug: 't2', title: 'T2', excerpt: '', body: '## Only One', path: 'p', folder: null, appSlugs: [], date: '2026-01-01' },
    [{ slug: 't2', title: 'T2', excerpt: '', body: '## Only One', path: 'p', folder: null, appSlugs: [], date: '2026-01-01' }],
    { author: { name: 'x' } }
  );
  assert.ok(!/thought-toc/.test(noTOC), 'should not have TOC with < 2 headings');
});
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Add `extractHeadings` to build.mjs**

Add near the other content extractors (after `extractText`):

```javascript
export function extractHeadings(text) {
  if (typeof text !== 'string') return [];
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m2 = line.match(/^##\s+(.+)$/);
    if (m2) out.push({ level: 2, text: m2[1].trim() });
  }
  return out;
}
```

- [ ] **Step 4: Update `render.thoughtPage` to inject heading IDs and emit `toc`**

In the existing `thoughtPage` function, replace the simple `contentHtml: renderMarkdown(thought.body)` line with:

```javascript
  const headings = extractHeadings(thought.body);
  const contentHtml = renderMarkdown(thought.body).replace(
    /<h2>([^<]+)<\/h2>/g,
    (_, text) => {
      const idx = headings.findIndex((h) => h.text === text);
      return idx >= 0
        ? `<h2 id="toc-${idx + 1}">${text}</h2>`
        : `<h2>${text}</h2>`;
    }
  );
```

Then in the scope object, add `toc: headings,` after `readingMinutes: ...`.

- [ ] **Step 5: Run, verify 107 pass**

- [ ] **Step 6: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Add extractHeadings and ID injection in render.thoughtPage"
```

---

## Task 2: Template + CSS

**Files:**
- Modify: `templates/thought.html`
- Modify: `assets/styles.css`

- [ ] **Step 1: Add TOC aside to `templates/thought.html`**

Find the existing `<aside class="thought-toc">` ... actually the TOC aside doesn't exist yet. Find the line with `<aside class="file-tree" ...>` and add the TOC aside right after it (before the `<article class="thought-page">`):

```html
      </aside>
      {{#if toc.length}}
      <aside class="thought-toc" aria-label="目录">
        <div class="thought-toc__label">// TOC</div>
        <ol class="thought-toc__list">
          {{#each toc}}
            <li class="thought-toc__item"><a href="#toc-{{@index+1}}">{{text}}</a></li>
          {{/each}}
        </ol>
      </aside>
      {{/if}}
      <article class="thought-page">
```

- [ ] **Step 2: Update `.thoughts-layout` grid + add TOC CSS at end of styles.css**

Find `.thoughts-layout` and update its `grid-template-columns`. Then append new CSS.

Change:
```css
.thoughts-layout {
  display: flex;
  gap: 32px;
  align-items: flex-start;
}
```

To:
```css
.thoughts-layout {
  display: grid;
  grid-template-columns: 200px auto 1fr;
  gap: 24px;
  align-items: flex-start;
}
```

Append at end of `assets/styles.css`:

```css
/* TOC */
.thought-toc {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  position: sticky;
  top: 16px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
}
.thought-toc__label {
  color: var(--accent);
  font-weight: 700;
  letter-spacing: 1px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.thought-toc__list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.thought-toc__item a {
  color: var(--text-muted);
  text-decoration: none;
  display: block;
  padding: 6px 0 6px 10px;
  border-left: 2px solid transparent;
  margin-left: -10px;
  transition: color 0.06s ease, border-color 0.06s ease;
}
.thought-toc__item a:hover {
  color: var(--accent);
  border-left-color: var(--accent);
}

@media (max-width: 640px) {
  .thoughts-layout { grid-template-columns: 1fr; }
  .thought-toc { display: none; }
}
```

- [ ] **Step 3: Build and verify all 3 thought pages**

```bash
cd /home/lipo/workdir/OppLipo && node build.mjs
# dev--sample-thought has ## 背景 ## 实现思路 ## 代码示例 ## 一些想法 = 4 headings → should have TOC
grep -E "thought-toc|toc-[12345]" thoughts/dev--sample-thought/index.html | head -3
# life--why-indie has only 1 ## → no TOC
grep "thought-toc" thoughts/life--why-indie/index.html | head -1
# work--releasing has only 1 ## → no TOC
grep "thought-toc" thoughts/work--releasing/index.html | head -1
```

- [ ] **Step 4: Commit**

```bash
git add templates/thought.html assets/styles.css thoughts/
git commit -m "Add auto-generated TOC to thought sidebar with 3-column layout"
```

---

## Task 3: Final verification

- [ ] **Step 1: All tests pass**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 107 passing.

- [ ] **Step 2: Visual smoke test**

```bash
cd /home/lipo/workdir/OppLipo && python3 -m http.server 4000 >/tmp/httpd.log 2>&1 &
sleep 1
chromium --headless --disable-gpu --no-sandbox --hide-scrollbars --window-size=1280,1800 --virtual-time-budget=4000 --screenshot=/tmp/v15-thought-toc.png http://localhost:4000/thoughts/dev--sample-thought/ 2>&1 | tail -1
pkill -f "python3 -m http.server 4000" 2>/dev/null
ls -la /tmp/v15-thought-toc.png
```

## Self-Review

- Spec coverage: extractHeadings ✓, ID injection ✓, template guard ✓, CSS grid ✓, TOC styles ✓, mobile hide ✓, tests ✓
- All steps have actual code blocks
- Type consistency: `extractHeadings` returns `[{level, text}];` `toc` in scope is the same array
- Risks: minimal — pure additions, no breaking changes