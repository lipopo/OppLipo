# Reading Time & Related Thoughts Implementation Plan

> Steps use checkbox syntax. Implement task-by-task.

**Goal:** Per-thought reading time (in meta line) and "Related" section (below content, above prev/next nav).

**Tech Stack:** Node 20+ stdlib, vanilla JS, terminal brutalist CSS.

**Spec:** `docs/superpowers/specs/2026-06-12-reading-time-and-related-design.md`

---

## File Structure

**Modified files:**
- `build.mjs` — add `computeReadingMinutes`, `computeRelated`, extend `render.thoughtPage`
- `templates/thought.html` — add reading-time meta + related section
- `assets/styles.css` — related section styles
- `tests/build.test.mjs` — add 3 new tests

---

## Task 1: `computeReadingMinutes` + `computeRelated`

**Files:**
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing tests**

```javascript
import { computeReadingMinutes, computeRelated } from '../build.mjs';

test('computeReadingMinutes: counts Chinese chars at 350/min', () => {
  // 700 Chinese chars = 2 minutes
  const text = '测'.repeat(700);
  assert.equal(computeReadingMinutes(text), 2);
});

test('computeReadingMinutes: counts English words at 200/min', () => {
  // 400 English words = 2 minutes
  const text = Array(400).fill('word').join(' ');
  assert.equal(computeReadingMinutes(text), 2);
});

test('computeReadingMinutes: returns at least 1 minute for any input', () => {
  assert.equal(computeReadingMinutes('短'), 1);
  assert.equal(computeReadingMinutes(''), 1);
  assert.equal(computeReadingMinutes('hello world'), 1);
});
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Add `computeReadingMinutes` to build.mjs**

```javascript
export function computeReadingMinutes(text) {
  if (typeof text !== 'string' || !text) return 1;
  const clean = extractText(text);
  const chinese = (clean.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) ?? []).length;
  const english = (clean.match(/[a-zA-Z]+/g) ?? []).length;
  const minutes = Math.ceil(chinese / 350 + english / 200);
  return Math.max(1, minutes);
}
```

- [ ] **Step 4: Add `computeRelated` to build.mjs**

```javascript
export function computeRelated(current, all) {
  const out = [];
  for (const other of all ?? []) {
    if (other.slug === current.slug) continue;
    let score = 0;
    const sharedApps = (current.appSlugs ?? [])
      .filter((a) => (other.appSlugs ?? []).includes(a));
    score += sharedApps.length * 2;
    if (current.folder && other.folder && current.folder === other.folder) score += 1;
    if (score > 0) out.push({ t: other, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 3).map((x) => x.t);
}
```

- [ ] **Step 5: Run, verify 104 pass**

- [ ] **Step 6: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Add computeReadingMinutes and computeRelated helpers"
```

---

## Task 2: Wire into `render.thoughtPage` and template

**Files:**
- Modify: `build.mjs`
- Modify: `templates/thought.html`
- Modify: `assets/styles.css`

- [ ] **Step 1: Update `render.thoughtPage` scope**

In `build.mjs`, find `async thoughtPage(thought, allThoughts, site)`. Add to the scope:

```javascript
    related: computeRelated(thought, allThoughts),
    readingMinutes: computeReadingMinutes(thought.body),
```

- [ ] **Step 2: Add reading-time meta to `templates/thought.html`**

Find the `thought__meta` div. Add a new span after the `appSlugs` span:

```html
<span><span class="meta-key">read</span><span class="meta-val">~{{readingMinutes}} 分钟</span></span>
```

- [ ] **Step 3: Add related section to `templates/thought.html`**

Find the `thought__nav` block (with prev/next). Insert before it:

```html
{{#if related.length}}
  <section class="thought-related">
    <div class="term-label">// RELATED</div>
    <ul class="thought-related__list">
      {{#each related}}
        <li class="thought-related__item">
          <a class="thought-related__title" href="/thoughts/{{slug}}/">{{title}}</a>
          {{#if excerpt}}<span class="thought-related__excerpt">{{excerpt}}</span>{{/if}}
        </li>
      {{/each}}
    </ul>
  </section>
{{/if}}
```

- [ ] **Step 4: Add related section CSS**

```css
.thought-related { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--border); }
.thought-related__list { list-style: none; padding: 0; margin: 12px 0 0; }
.thought-related__item {
  padding: 10px 0;
  border-bottom: 1px dashed var(--border);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}
.thought-related__item:last-child { border-bottom: 0; }
.thought-related__title {
  color: var(--text);
  text-decoration: none;
  font-weight: 700;
  display: block;
}
.thought-related__title:hover { color: var(--accent); }
.thought-related__excerpt {
  color: var(--text-muted);
  font-size: var(--text-xs);
  margin-top: 2px;
  display: block;
}
```

- [ ] **Step 5: Build and verify all 3 thought pages**

```bash
cd /home/lipo/workdir/OppLipo && node build.mjs
for s in dev--sample-thought work--releasing life--why-indie; do
  echo "=== /thoughts/$s/ ==="
  grep -E "read|RELATED|thought-related" thoughts/$s/index.html | head -5
done
```

- [ ] **Step 6: Commit**

```bash
git add build.mjs templates/thought.html assets/styles.css thoughts/
git commit -m "Wire reading time and related thoughts into thought page"
```

---

## Task 3: Final verification

- [ ] **Step 1: All tests pass**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 104 passing.

- [ ] **Step 2: Visual smoke test**

```bash
cd /home/lipo/workdir/OppLipo && python3 -m http.server 4000 >/tmp/httpd.log 2>&1 &
sleep 1
chromium --headless --disable-gpu --no-sandbox --hide-scrollbars --window-size=1280,1800 --virtual-time-budget=4000 --screenshot=/tmp/v14-thought.png http://localhost:4000/thoughts/dev--sample-thought/ 2>&1 | tail -1
pkill -f "python3 -m http.server 4000" 2>/dev/null
ls -la /tmp/v14-thought.png
```

## Self-Review

- Spec coverage: reading time algorithm ✓, related algorithm ✓, template ✓, render wiring ✓, CSS ✓, tests ✓
- All steps have actual code blocks
- Type consistency: `computeRelated(thought, all)` returns array; `render.thoughtPage` consumes it
- Risks: minimal — pure additions, no breaking changes