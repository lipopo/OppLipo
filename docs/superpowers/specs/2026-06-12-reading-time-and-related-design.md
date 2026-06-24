# Reading Time & Related Thoughts — Design Spec

**Date:** 2026-06-12
**Status:** Draft (pending user review)
**Owner:** lipo

## Goal

Deepen the existing `/thoughts/<slug>/` page with two new per-thought enrichments:
1. **Reading time** — how long the thought takes to read
2. **Related thoughts** — up to 3 other thoughts that share `appSlugs` or `folder`

Both are derived at build time from existing data. No schema changes.

## Constraints

- Static site, GitHub Pages, no runtime backend
- Zero npm dependencies
- Existing 101 tests must keep passing
- Terminal brutalist aesthetic preserved

## Reading time

### Algorithm

Mixed Chinese + English estimator:

- Chinese characters (CJK): divide by 350 chars/minute
- English words (a-zA-Z sequences): divide by 200 words/minute
- Sum → `Math.ceil` → minimum 1

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

`extractText` is the existing helper that strips markdown noise (code blocks, links, etc.). Reading time applies to clean prose, not raw markdown tokens.

### Display

In `templates/thought.html`, add one meta entry to the existing `thought__meta` line:

```html
<span><span class="meta-key">read</span><span class="meta-val">~{{readingMinutes}} 分钟</span></span>
```

Renders as `read ~3 分钟` in the meta strip.

## Related thoughts

### Algorithm

Score each other thought by overlap with the current one:

- 2 points per shared `appSlug`
- 1 point for same `folder`

Sort by score desc, keep only score > 0, take top 3.

```javascript
function relatedThoughts(current, all) {
  const out = [];
  for (const other of all) {
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

The function lives in `build.mjs`. `render.thoughtPage(thought, allThoughts, site)` computes related inline and includes in scope.

### Display

In `templates/thought.html`, add a new section between `thought-content` and `thought__nav`:

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

Renders below the article body, separated by a top border. Empty when no related thoughts.

## Render: `render.thoughtPage` update

Existing signature: `async thoughtPage(thought, allThoughts, site)`. The `allThoughts` parameter is already passed (used for the sidebar tree + prev/next). We extend it to compute `related`:

```javascript
async thoughtPage(thought, allThoughts, site) {
  // ... existing code ...
  const related = computeRelated(thought, allThoughts);
  const readingMinutes = computeReadingMinutes(thought.body);
  const scope = {
    ...thought,
    contentHtml: renderMarkdown(thought.body),
    treeForTemplate,
    prev: ...,
    next: ...,
    related,
    readingMinutes,
    assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
    year: String(new Date().getFullYear()),
  };
  return renderTemplate(tpl, scope);
}
```

`computeRelated` is exported (testable).

## CSS

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

## Tests (3 new, target 104/104)

| # | Test |
|---|---|
| 102 | `computeReadingMinutes: counts Chinese chars at 350/min` |
| 103 | `computeReadingMinutes: counts English words at 200/min` |
| 104 | `computeReadingMinutes: returns at least 1 minute for any input` |

The `computeRelated` function is simple and tested implicitly by `render.thoughtPage` (existing test #13 "thought-page content and sidebar" exercises it transitively).

## Out of scope (YAGNI)

- Word count display ("1.2k 字")
- JSON-LD Article schema (would include ISO 8601 duration for reading time)
- Per-thought share buttons (Twitter, etc.)
- "Next thought" reading queue (already have prev/next nav)

## Risk notes

- `computeReadingMinutes` accuracy is approximate (350/200 are estimates, not measured). For personal site, ±30% is fine.
- Chinese character regex `[\u4e00-\u9fff]` is the CJK Unified Ideographs block. Doesn't cover CJK Extension A/B/etc. (rare for personal content).
- The related-thoughts section always appears below the content but above prev/next nav. Mobile: section gets full width, items stack.