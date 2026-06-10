# Personal Brand Site — Design Spec

**Date:** 2026-06-10
**Status:** Draft (pending user review)
**Owner:** lipo

## Goal

Evolve the existing app-showcase site (`info.opplipo.cn`) into a **personal developer
brand site**. The current site has a homepage + per-app detail pages built from
`apps.json` via `build.mjs`. We add:

1. Author identity (About)
2. Long-form thinking space (Thoughts)
3. Curated app groupings (Collections)

App showcase remains the homepage's primary content. The new sections are
supporting surfaces that let visitors get to know the developer.

## Brand posture

- **Independent, small, deliberate.** One person, handcrafted, no metrics
  theatre, no growth hacks.
- Voice lives in the prose — no marketing copy, no "elevator pitches" on the
  homepage.
- Visual: **terminal brutalist** (current CSS). No further design churn
  required — this is settled.

## Constraints

- Static site, GitHub Pages, no build server, no runtime backend.
- Zero npm dependencies (Node stdlib only — existing `build.mjs` pattern).
- 43 existing tests must keep passing.
- `apps.json` schema must remain backward-compatible (new fields are
  optional).

## Routes (final)

| Route | Type | Source |
|---|---|---|
| `/` | static HTML | `templates/home.html` |
| `/apps/<slug>/` | static HTML | `templates/app.html` |
| `/about/` | static HTML (new) | `templates/about.html` |
| `/thoughts/` | static HTML (new) | `templates/thoughts-index.html` |
| `/thoughts/<slug>/` | static HTML (new) | `templates/thought.html` |
| `/collections/` | static HTML (new) | `templates/collections-index.html` |
| `/collections/<slug>/` | static HTML (new) | `templates/collection.html` |

`<slug>` for thoughts = the `.md` file's relative path under
`content/thoughts/` with `/` replaced by `--` and `.md` stripped. This makes
deep folders possible without extra config.

## Data model

### `site.json` (new, top-level)

```json
{
  "author": {
    "name": "string",
    "tagline": "string",
    "bio": "string (Markdown)",
    "avatar": "path relative to repo root",
    "location": "string (optional)",
    "social": [
      { "label": "string", "url": "string" }
    ]
  },
  "thoughts": {
    "tree": [
      {
        "type": "folder",
        "name": "string",
        "children": [
          { "type": "file", "path": "string (content/thoughts/...)", "title": "string", "date": "YYYY-MM-DD", "excerpt": "string (optional)", "appSlugs": ["string"] }
        ]
      },
      { "type": "file", "...": "..." }
    ]
  },
  "collections": [
    { "slug": "string", "title": "string", "description": "string", "appSlugs": ["string"], "icon": "string (1-2 chars)" }
  ]
}
```

### `content/thoughts/**/*.md` (new)

Each file = one thought. Front-matter is required, body is Markdown.

```markdown
---
title: App X 的设计思路
date: 2026-06-01
excerpt: 一句话摘要 (optional)
appSlugs: [_sample]
---

## 引子

正文...
```

`site.json`'s `thoughts.tree` may include files directly, or group them
under folders. The build walk reads the on-disk `.md` files and merges with
the tree definition to produce the final file tree (site.json controls
ordering and grouping; the filesystem controls existence).

### `apps.json` extension (additive)

Each app may now include:

```json
{
  "slug": "_sample",
  "thoughtSlugs": ["dev--app-x-design"]
}
```

If `thoughtSlugs` is present, the app detail page renders a "相关想法"
(Related thoughts) block below `RELEASES` with a list of links.

## Build pipeline

`build.mjs` is extended with these new functions. All synchronous
where possible; existing `readFile`/`writeFile` pattern reused.

### New helpers

| Function | Inputs | Outputs |
|---|---|---|
| `readSiteJson()` | disk | parsed + validated object |
| `walkThoughts(site, contentDir)` | site.json + content dir | flat list + tree |
| `renderMarkdown(md)` | markdown string | HTML string |
| `slugify(path)` | relative path | URL slug |
| `render.about(site)` | site | HTML |
| `render.thoughtsIndex(site, thoughts)` | site + tree | HTML |
| `render.thoughtPage(file, allFiles, site)` | one thought | HTML |
| `render.collectionsIndex(site, apps, publicApps)` | site + apps | HTML |
| `render.collectionPage(coll, apps, site)` | one collection | HTML |
| `writeOutputs(apps, site)` | all of above | writes all pages |

### Markdown rendering

`renderMarkdownLite` (current, supports only `##` and paragraphs) is replaced
by `renderMarkdown`. New capabilities:

| Syntax | Output |
|---|---|
| `` ```lang `` ... `` ``` `` | `<pre><code class="lang-lang">...</code></pre>` |
| `` `x` `` | `<code>x</code>` |
| `- x` / `* x` (consecutive) | `<ul><li>x</li>...</ul>` |
| `1. x` (consecutive) | `<ol><li>x</li>...</ol>` |
| `[t](u)` | `<a href="u">t</a>` |
| `**x**` | `<strong>x</strong>` |
| `*x*` | `<em>x</em>` |
| `> x` | `<blockquote>x</blockquote>` |
| `## x` | `<h2>x</h2>` (kept) |

All input is HTML-escaped first, then the renderer walks line-by-line. The
output is **trusted HTML** that is injected via `{{{contentHtml}}}` in the
template (triple-brace, raw).

No markdown dependencies added. ~80 lines of regex/state-machine code.

### Validation

`validateSiteJson(site)` rejects:

- Missing `author.name` / `author.tagline`
- `author.social` items missing `label` or `url`
- `thoughts.tree` items missing `type`, and `type` not in `folder`/`file`
- Folder children must be an array
- File item missing `path`, `title`, or `date`
- `collections` items missing `slug`, `title`, `appSlugs`
- Duplicate collection slugs
- `appSlugs` / `thoughtSlugs` referencing unknown slugs (warning only,
  does not fail build — keeps build forward-compatible)

### File-existence checks

The existing sync `existsSync` pattern is reused. Each thought `.md`
referenced in `site.json` must exist on disk. Each `author.avatar` path
must exist. `collection.icon` is a glyph, not a file.

## Templates

Five new templates in `templates/`. All reuse the existing CSS variables
and the terminal brutalist aesthetic.

### `about.html`

```
<header><h1>姓名</h1><p class="tagline">...</p></header>
<section class="about">
  <img class="about__avatar" />
  <div class="prose">{{{bioHtml}}}</div>
  <ul class="about__social">
    {{#each social}}<li><a href="{{url}}">{{label}}</a></li>{{/each}}
  </ul>
</section>
```

### `thoughts-index.html`

```
<section class="thoughts-layout">
  <aside class="file-tree">
    {{#each tree}}
      {{#if folder}}<div class="file-tree__folder">{{name}}</div>
        <ul>{{#each children}}<li class="file-tree__file"><a href="/thoughts/{{slug}}/">{{title}}</a></li>{{/each}}</ul>
      {{/if}}
      {{#if file}}<a class="file-tree__file" href="/thoughts/{{slug}}/">{{title}}</a>{{/if}}
    {{/each}}
  </aside>
  <main>
    <h1>想法 / Thoughts</h1>
    <p class="prose">N 篇思考，按时间倒序排列。</p>
  </main>
</section>
```

### `thought.html`

```
<section class="thoughts-layout">
  <aside class="file-tree">
    (same as thoughts-index, with this file's link marked active)
  </aside>
  <main>
    <header>
      <h1>{{title}}</h1>
      <div class="thought__meta">
        <span>{{date}}</span>
        {{#if appSlugs.length}} · 相关 APP: {{#each appSlugs}}<a href="/apps/{{.}}/">{{.}}</a> {{/each}}{{/if}}
      </div>
      {{#if excerpt}}<p class="thought__excerpt">{{excerpt}}</p>{{/if}}
    </header>
    <article class="thought-content">{{{contentHtml}}}</article>
    <nav class="thought__nav">
      {{#if prev}}<a href="/thoughts/{{prev.slug}}/">← {{prev.title}}</a>{{/if}}
      {{#if next}}<a href="/thoughts/{{next.slug}}/">{{next.title}} →</a>{{/if}}
    </nav>

`prev` and `next` are computed from the file tree's top-down order
(folder contents in declaration order, with top-level files after all
folders). They are not chronological.
  </main>
</section>
```

### `collections-index.html`

```
<header><h1>精选 / Collections</h1></header>
<div class="coming-soon__grid">
  {{#each collections}}
    <a class="card card--small" href="/collections/{{slug}}/">
      <div class="collection-card__icon">{{icon}}</div>
      <div class="card__name">{{title}}</div>
      <div class="card__tagline">{{description}}</div>
    </a>
  {{/each}}
</div>
```

### `collection.html`

```
<header>
  <div class="collection-card__icon collection-card__icon--lg">{{icon}}</div>
  <h1>{{title}}</h1>
  <p class="prose">{{description}}</p>
</header>
<div class="recent-updates__grid">
  {{#each apps}}
    <a class="release-card" href="/apps/{{slug}}/">
      <div class="release-card__head">
        <span class="release-card__icon" style="--c1:{{color.0}}; --c2:{{color.1}};"></span>
        <span class="release-card__name">{{name}}</span>
        <span class="release-card__version">v{{version}}</span>
      </div>
    </a>
  {{/each}}
</div>
```

## Visual additions (CSS only)

| Class | Purpose |
|---|---|
| `.thoughts-layout` | `display: flex; gap: 32px;` (sidebar 240px / content 1fr) |
| `.file-tree` | monospace `ul`, indent 12px, folder headers in `--accent` |
| `.file-tree__folder` | green bold, no link |
| `.file-tree__file a` | `--text` color, hover `--accent` |
| `.file-tree__file--active a` | `--accent` color, current thought |
| `.thought-content` | extends `.prose` with `pre`, `code`, `ul`, `ol`, `blockquote` rules |
| `.thought__meta` | `--text-muted`, small, monospace |
| `.thought__excerpt` | larger, italic, `--text-dim` |
| `.thought__nav` | flex between prev/next, `--text-muted`, hover `--accent` |
| `.about-page` | grid 200px 1fr (avatar + content) |
| `.about__avatar` | `width: 200px; border: 1px solid var(--border)` |
| `.about__social` | flex wrap, `.cta--secondary` style chips |
| `.collection-card__icon` | huge monospace glyph, centered, `--accent` |
| `.collection-card__icon--lg` | 96px font size |
| `.more-block` | margin-top 36px, contains 3 cards |

Mobile: `.thoughts-layout` collapses to single column at `max-width: 640px`.

## Tests (target 55/55)

Existing 43 tests stay. New tests:

| # | Test |
|---|---|
| 44 | `validateSiteJson: rejects missing author.name` |
| 45 | `validateSiteJson: rejects social item missing url` |
| 46 | `walkThoughts: merges filesystem files with site.json tree` |
| 47 | `walkThoughts: warns (does not fail) on unknown appSlugs in front-matter` |
| 48 | `renderMarkdown: renders code blocks with language class` |
| 49 | `renderMarkdown: renders inline code, lists, links, emphasis, blockquote` |
| 50 | `slugify: produces URL-safe slug from path` |
| 51 | `render.about: produces page containing author name and bio` |
| 52 | `render.thoughtsIndex: produces page containing all thought titles` |
| 53 | `render.thoughtPage: produces page containing content and sidebar` |
| 54 | `render.collectionsIndex: produces page containing all collection titles` |
| 55 | `render.collectionPage: produces page containing all referenced apps` |

## Out of scope (YAGNI)

- Full-text search (file list only; search is a TODO for a future iteration)
- Tags / categories system beyond folders
- Comments / feedback forms
- RSS feed
- Multi-language
- Theme switcher
- WYSIWYG editor (the developer writes markdown in their own editor)
- Per-thought OG image generation (reuses site default)

## Risk notes

- **`renderMarkdown` correctness** — this is hand-written. Test the full
  feature matrix (44–49) before relying on it for production thoughts.
- **Thought slug collisions** — `slugify` must handle deep paths and
  non-ASCII filenames deterministically. Test with mixed CJK + nested
  folders.
- **Template engine depth** — `{{#each tree}}` with mixed `{{#if}}` over
  folder/file branches increases nesting. The engine already handles 8+
  levels; should be fine but flagged in plan.
