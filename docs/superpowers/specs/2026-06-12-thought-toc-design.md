# Thought Table of Contents — Design Spec

**Date:** 2026-06-12
**Status:** Draft (pending user review)
**Owner:** lipo

## Goal

Add an auto-generated table of contents (TOC) to the right sidebar of `/thoughts/<slug>/`. Reads the `## h2` headings from the thought's body, generates IDs, and renders an anchor-linked ordered list.

## Constraints

- Static site, GitHub Pages, no runtime backend
- Zero npm dependencies
- Existing 104 tests must keep passing
- Terminal brutalist aesthetic preserved
- No client-side JS (plain browser anchor jump)

## Algorithm

### `extractHeadings(text)` (new helper in build.mjs)

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

Returns `[{level: 2, text: string}, ...]` for every `## ` line. No nesting (h1 / h3+ ignored).

### Heading ID injection

`render.thoughtPage` already calls `renderMarkdown(thought.body)` to produce `contentHtml`. We wrap that:

```javascript
const rawHtml = renderMarkdown(thought.body);
const headings = extractHeadings(thought.body);
const contentHtml = rawHtml.replace(
  /<h2>([^<]+)<\/h2>/g,
  (_, text) => {
    const idx = headings.findIndex((h) => h.text === text);
    return idx >= 0
      ? `<h2 id="toc-${idx + 1}">${text}</h2>`
      : `<h2>${text}</h2>`;
  }
);
```

Generated IDs: `toc-1`, `toc-2`, ... matching the index in the `headings` array.

If the same heading text appears twice, the findIndex returns the first match and subsequent matches get no id. The TOC link for the second match would be a duplicate — the user would see a TOC link that points to the first match. Not perfect, but acceptable for a personal site where headings don't usually repeat.

## Render: `render.thoughtPage` update

```javascript
async thoughtPage(thought, allThoughts, site) {
  // ... existing tree / prev / next computation ...

  const headings = extractHeadings(thought.body);
  const contentHtml = (() => {
    const raw = renderMarkdown(thought.body);
    return raw.replace(
      /<h2>([^<]+)<\/h2>/g,
      (_, text) => {
        const idx = headings.findIndex((h) => h.text === text);
        return idx >= 0
          ? `<h2 id="toc-${idx + 1}">${text}</h2>`
          : `<h2>${text}</h2>`;
      }
    );
  })();

  const toc = headings;  // template uses {text} and {toc-N}

  const scope = {
    ...thought,
    contentHtml,
    treeForTemplate,
    prev: ...,
    next: ...,
    related: computeRelated(thought, allThoughts),
    readingMinutes: computeReadingMinutes(thought.body),
    toc,
    assets: ...,
    year: ...,
  };
  return renderTemplate(tpl, scope);
}
```

`{{toc.length}}` is used in the `{{#if toc.length}}` guard, so the empty case naturally short-circuits.

## Template: `templates/thought.html`

Insert the TOC `<aside>` between the existing `<aside class="file-tree">` and the `<article class="thought-page">`:

```html
<aside class="file-tree" aria-label="想法列表">...</aside>
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
<article class="thought-page">...</article>
```

The `<aside class="thought-toc">` is positioned via the `.thoughts-layout` grid (see CSS).

## CSS

```css
/* 3-column layout: file-tree | TOC | article */
.thoughts-layout {
  display: grid;
  grid-template-columns: 200px 180px 1fr;
  gap: 24px;
  align-items: start;
}

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

/* Mobile: hide TOC */
@media (max-width: 640px) {
  .thoughts-layout {
    grid-template-columns: 1fr;
  }
  .thought-toc { display: none; }
}
```

Note: `.thoughts-layout > .file-tree` still has its existing rules. The grid now has 3 children (file-tree + thought-toc + thought-page) so the grid-template-columns defines each.

If `.thought-toc` is absent (no headings), CSS Grid still allocates a column for it. To avoid this, the `{{#if}}` guard in the template omits the entire aside element when empty, leaving 2 columns. The grid then has only 2 children. To make the grid work with 2 or 3 children, we use `grid-template-columns: 200px 180px 1fr` (always 3 cols) — but since the TOC aside isn't rendered when empty, the second column is empty space. To avoid the empty column, use `auto`:

```css
.thoughts-layout {
  display: grid;
  grid-template-columns: 200px auto 1fr;
  gap: 24px;
  align-items: start;
}
```

When TOC is absent, the second `auto` column collapses to 0. When present, it sizes to its content. Cleaner than conditionally switching CSS.

## Tests (3 new, target 107/107)

| # | Test |
|---|---|
| 105 | `extractHeadings: returns h2 lines with text` |
| 106 | `extractHeadings: ignores non-h2 lines (h1, h3, regular text)` |
| 107 | `render.thoughtPage: produces thought-toc aside only when ≥ 2 h2 headings exist` |

## Out of scope (YAGNI)

- Client-side scroll-spy (active section highlighting)
- h3+ nesting in TOC
- Sticky TOC on mobile
- Smooth scroll (CSS `scroll-behavior: smooth`)
- JSON-LD ItemList (TOC as structured data)

## Risk notes

- The replace regex matches `<h2>{non-`<` content}</h2>`. If a heading contains a `<` character (e.g., `## <important>`), the regex would fail. For personal markdown, this is unlikely.
- `findIndex` for ID assignment uses text match. If a thought has duplicate h2 text (e.g., two `## Background`), the second one gets no id and its TOC entry links to the first match. Acceptable.
- Existing `{{#unless releases.length}}` workaround in templates shows the engine doesn't support `{{else}}` — TOC's `{{#if toc.length}}` is the inverse `{{#if}}` block, so `{{else}}` isn't used. The 1-column mobile fallback is CSS-only.