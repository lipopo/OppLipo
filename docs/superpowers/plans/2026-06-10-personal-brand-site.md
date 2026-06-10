# Personal Brand Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing app-showcase site into a personal developer brand site with About, Thoughts, and Collections pages — keeping the app showcase as the homepage core.

**Architecture:** Extend the existing `build.mjs` (Node stdlib, zero deps) with new render functions for the three new page types. Add `site.json` for site-wide config and `content/thoughts/**/*.md` for thought content. Markdown rendered server-side at build time, injected as raw HTML. No runtime, no JS frameworks, no SPA.

**Tech Stack:** Node 20+ stdlib, `node --test`, GitHub Pages static hosting, terminal brutalist CSS (existing).

**Spec:** `docs/superpowers/specs/2026-06-10-personal-brand-site-design.md`

---

## File Structure

**New files (created in this plan):**
- `site.json` — site-wide config (author, thought tree, collections)
- `content/thoughts/dev/sample-thought.md` — sample thought
- `assets/avatar.svg` — sample author avatar (placeholder square SVG)
- `templates/about.html`
- `templates/thoughts-index.html`
- `templates/thought.html`
- `templates/collections-index.html`
- `templates/collection.html`

**Modified files (extended in this plan):**
- `build.mjs` — add ~250 lines (slugify, renderMarkdown, readSiteJson, validateSiteJson, walkThoughts, render.about/thoughtsIndex/thoughtPage/collectionsIndex/collectionPage, extended writeOutputs)
- `templates/home.html` — add MORE block before footer
- `templates/app.html` — add "相关想法" block after RELEASES
- `assets/styles.css` — add ~120 lines (thoughts-layout, file-tree, about-page, collection-card, thought-content, more-block)
- `apps.json` — add `thoughtSlugs` to `_sample` (optional, for cross-link demo)
- `tests/build.test.mjs` — add 12 new tests (target 55/55)

---

## Task 1: `slugify` helper

**Files:**
- Modify: `build.mjs:1-10` (add export at end of file)
- Test: `tests/build.test.mjs` (append test)

- [ ] **Step 1: Write the failing test**

Append to `tests/build.test.mjs`:

```javascript
import { slugify } from '../build.mjs';

// ... existing imports ...

test('slugify: simple path becomes URL slug', () => {
  assert.equal(slugify('content/thoughts/dev/app-x-design.md'), 'dev--app-x-design');
});

test('slugify: top-level file', () => {
  assert.equal(slugify('content/thoughts/standalone.md'), 'standalone');
});

test('slugify: handles non-ASCII filenames', () => {
  assert.equal(slugify('content/thoughts/独立思考.md'), '独立思考');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/build.test.mjs 2>&1 | grep "slugify"
```

Expected: 3 tests fail with "slugify is not a function" or similar (function undefined).

- [ ] **Step 3: Add `slugify` to build.mjs**

Add at the bottom of `build.mjs` (after the existing exports, before any final
braces — find the right spot by searching for `export const ROOT` and add the
new export below it):

```javascript
export function slugify(relativePath) {
  // Strip the leading "content/thoughts/" prefix if present
  let p = relativePath;
  if (p.startsWith('content/thoughts/')) p = p.slice('content/thoughts/'.length);
  // Strip .md extension
  if (p.endsWith('.md')) p = p.slice(0, -3);
  // Replace / with -- for URL safety
  return p.replace(/\//g, '--');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/build.test.mjs 2>&1 | tail -20
```

Expected: 46 passing, 0 failing (43 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Add slugify helper for thought URLs"
```

---

## Task 2: `renderMarkdown` — code blocks and inline code

**Files:**
- Modify: `build.mjs` (replace `renderMarkdownLite` with `renderMarkdown`)
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import { renderMarkdown } from '../build.mjs';

test('renderMarkdown: fenced code block with language', () => {
  const md = '```js\nconst x = 1;\n```';
  const html = renderMarkdown(md);
  assert.match(html, /<pre><code class="lang-js">/);
  assert.match(html, /const x = 1;/);
});

test('renderMarkdown: inline code', () => {
  const html = renderMarkdown('Use `npm install` to install.');
  assert.match(html, /<code>npm install<\/code>/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/build.test.mjs 2>&1 | grep "renderMarkdown: fenced"
```

Expected: FAIL — `renderMarkdown is not a function` (only `renderMarkdownLite` exists).

- [ ] **Step 3: Add `renderMarkdown` to build.mjs**

Add immediately after `renderMarkdownLite` (around line 165 of current build.mjs):

```javascript
export function renderMarkdown(md) {
  // First, escape HTML in the entire input so user content can't inject tags.
  let src = String(md);

  // Extract fenced code blocks first (they must not be re-processed).
  const codeBlocks = [];
  src = src.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, body) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code class="lang-${lang || 'plain'}">${escHtml(body.replace(/\n$/, ''))}</code></pre>`);
    return `\u0000CODE${idx}\u0000`;
  });

  // Escape HTML everywhere except our placeholders.
  src = src.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  // Inline code (backticks): extract then re-inject escaped content.
  const inlineCodes = [];
  src = src.replace(/`([^`\n]+)`/g, (m, body) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code>${body}</code>`);  // body was already escaped above
    return `\u0000IC${idx}\u0000`;
  });

  // Split into lines for block-level processing.
  const lines = src.split(/\r?\n/);
  const out = [];
  let para = [];
  let list = null;     // null | { type: 'ul' | 'ol', items: [] }
  let quote = [];      // active blockquote lines

  const flushPara = () => {
    if (para.length) { out.push(`<p>${para.join(' ')}</p>`); para = []; }
  };
  const flushList = () => {
    if (list) {
      const tag = list.type;
      out.push(`<${tag}>${list.items.map((i) => `<li>${i}</li>`).join('')}</${tag}>`);
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      out.push(`<blockquote>${quote.join('<br>')}</blockquote>`);
      quote = [];
    }
  };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Headings
    if (line.startsWith('## ')) { flushAll(); out.push(`<h2>${line.slice(3)}</h2>`); continue; }
    if (line.startsWith('# '))  { flushAll(); out.push(`<h1>${line.slice(2)}</h1>`); continue; }

    // Blockquote (collect consecutive > lines)
    if (line.startsWith('> ')) { flushPara(); flushList(); quote.push(line.slice(2)); continue; }
    if (line === '>')          { flushPara(); flushList(); quote.push(''); continue; }
    if (quote.length) { flushQuote(); }

    // Unordered list
    if (/^[-*] /.test(line)) {
      flushPara();
      if (list && list.type !== 'ul') flushList();
      list = list || { type: 'ul', items: [] };
      list.items.push(line.slice(2));
      continue;
    }
    // Ordered list
    if (/^\d+\. /.test(line)) {
      flushPara();
      if (list && list.type !== 'ol') flushList();
      list = list || { type: 'ol', items: [] };
      list.items.push(line.replace(/^\d+\. /, ''));
      continue;
    }
    if (list) flushList();

    // Empty line = paragraph break
    if (line.trim() === '') { flushPara(); continue; }

    para.push(line);
  }
  flushAll();

  let html = out.join('\n');

  // Emphasis (do this on the joined HTML, after block processing).
  // Bold: **x** -> <strong>x</strong>
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  // Italic: *x* -> <em>x</em>  (avoid colliding with bold by requiring non-asterisk on both sides)
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Restore code blocks and inline code.
  html = html.replace(/\u0000CODE(\d+)\u0000/g, (m, i) => codeBlocks[Number(i)]);
  html = html.replace(/\u0000IC(\d+)\u0000/g, (m, i) => inlineCodes[Number(i)]);

  return html;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 48 passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Add renderMarkdown with code blocks, inline code, lists, links, emphasis, blockquote"
```

---

## Task 3: `renderMarkdown` — full feature matrix tests

**Files:**
- Modify: `tests/build.test.mjs`

- [ ] **Step 1: Add the remaining feature tests**

```javascript
test('renderMarkdown: unordered list of consecutive items', () => {
  const md = '- a\n- b\n- c';
  const html = renderMarkdown(md);
  assert.match(html, /<ul><li>a<\/li><li>b<\/li><li>c<\/li><\/ul>/);
});

test('renderMarkdown: ordered list of consecutive items', () => {
  const md = '1. first\n2. second';
  const html = renderMarkdown(md);
  assert.match(html, /<ol><li>first<\/li><li>second<\/li><\/ol>/);
});

test('renderMarkdown: link [text](url)', () => {
  const html = renderMarkdown('See [docs](https://example.com).');
  assert.match(html, /<a href="https:\/\/example\.com">docs<\/a>/);
});

test('renderMarkdown: bold and italic', () => {
  const html = renderMarkdown('**bold** and *italic*.');
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
});

test('renderMarkdown: blockquote', () => {
  const md = '> a wise quote\n> spans two lines';
  const html = renderMarkdown(md);
  assert.match(html, /<blockquote>a wise quote<br>spans two lines<\/blockquote>/);
});

test('renderMarkdown: paragraphs and h2', () => {
  const md = 'first para\nstill first.\n\n## section\n\nsecond para.';
  const html = renderMarkdown(md);
  assert.match(html, /<p>first para still first\.<\/p>/);
  assert.match(html, /<h2>section<\/h2>/);
  assert.match(html, /<p>second para\.<\/p>/);
});
```

- [ ] **Step 2: Run tests**

```bash
node --test tests/build.test.mjs 2>&1 | tail -20
```

Expected: 54 passing, 0 failing (43 + 3 from task 1 + 2 from task 2 + 6 from this task).

- [ ] **Step 3: Commit**

```bash
git add tests/build.test.mjs
git commit -m "Add renderMarkdown full feature matrix tests"
```

---

## Task 4: `readSiteJson` and `validateSiteJson`

**Files:**
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing tests**

```javascript
import { validateSiteJson } from '../build.mjs';

test('validateSiteJson: accepts minimal valid site', () => {
  const site = {
    author: { name: 'lipo', tagline: 'one dev' },
    thoughts: { tree: [] },
    collections: [],
  };
  assert.doesNotThrow(() => validateSiteJson(site));
});

test('validateSiteJson: rejects missing author.name', () => {
  const site = { author: { tagline: 'x' }, thoughts: { tree: [] }, collections: [] };
  assert.throws(() => validateSiteJson(site), /author\.name/);
});

test('validateSiteJson: rejects social item missing url', () => {
  const site = {
    author: { name: 'lipo', tagline: 'x', social: [{ label: 'GH' }] },
    thoughts: { tree: [] },
    collections: [],
  };
  assert.throws(() => validateSiteJson(site), /social/);
});

test('validateSiteJson: rejects collection missing appSlugs', () => {
  const site = {
    author: { name: 'lipo', tagline: 'x' },
    thoughts: { tree: [] },
    collections: [{ slug: 'a', title: 'A' }],
  };
  assert.throws(() => validateSiteJson(site), /appSlugs/);
});

test('validateSiteJson: rejects duplicate collection slugs', () => {
  const site = {
    author: { name: 'lipo', tagline: 'x' },
    thoughts: { tree: [] },
    collections: [
      { slug: 'a', title: 'A', appSlugs: [] },
      { slug: 'a', title: 'A2', appSlugs: [] },
    ],
  };
  assert.throws(() => validateSiteJson(site), /duplicate/);
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
node --test tests/build.test.mjs 2>&1 | grep "validateSiteJson"
```

Expected: 5 tests fail with "validateSiteJson is not a function".

- [ ] **Step 3: Add `validateSiteJson` to build.mjs**

Add right after `validate()` (around line 155):

```javascript
export function validateSiteJson(site) {
  if (!site || typeof site !== 'object') {
    throw new Error('site.json must be an object');
  }
  if (!site.author || typeof site.author !== 'object') {
    throw new Error('site.json: author is required');
  }
  if (typeof site.author.name !== 'string' || !site.author.name) {
    throw new Error('site.json: author.name is required');
  }
  if (typeof site.author.tagline !== 'string' || !site.author.tagline) {
    throw new Error('site.json: author.tagline is required');
  }
  if (Array.isArray(site.author.social)) {
    for (const [i, s] of site.author.social.entries()) {
      if (typeof s.label !== 'string' || !s.label) {
        throw new Error(`site.json: author.social[${i}].label is required`);
      }
      if (typeof s.url !== 'string' || !s.url) {
        throw new Error(`site.json: author.social[${i}].url is required`);
      }
    }
  }
  if (!site.thoughts || typeof site.thoughts !== 'object') {
    throw new Error('site.json: thoughts is required');
  }
  if (Array.isArray(site.thoughts.tree)) {
    for (const [i, item] of site.thoughts.tree.entries()) {
      if (item.type === 'folder') {
        if (typeof item.name !== 'string' || !item.name) {
          throw new Error(`site.json: thoughts.tree[${i}].name is required`);
        }
        if (!Array.isArray(item.children)) {
          throw new Error(`site.json: thoughts.tree[${i}].children must be an array`);
        }
        for (const [j, child] of item.children.entries()) {
          if (child.type !== 'file') {
            throw new Error(`site.json: thoughts.tree[${i}].children[${j}].type must be "file"`);
          }
          if (typeof child.path !== 'string' || !child.path) {
            throw new Error(`site.json: thoughts.tree[${i}].children[${j}].path is required`);
          }
          if (typeof child.title !== 'string' || !child.title) {
            throw new Error(`site.json: thoughts.tree[${i}].children[${j}].title is required`);
          }
          if (typeof child.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(child.date)) {
            throw new Error(`site.json: thoughts.tree[${i}].children[${j}].date must be YYYY-MM-DD`);
          }
        }
      } else if (item.type === 'file') {
        if (typeof item.path !== 'string' || !item.path) {
          throw new Error(`site.json: thoughts.tree[${i}].path is required`);
        }
        if (typeof item.title !== 'string' || !item.title) {
          throw new Error(`site.json: thoughts.tree[${i}].title is required`);
        }
        if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(item.date)) {
          throw new Error(`site.json: thoughts.tree[${i}].date must be YYYY-MM-DD`);
        }
      } else {
        throw new Error(`site.json: thoughts.tree[${i}].type must be "folder" or "file"`);
      }
    }
  }
  if (Array.isArray(site.collections)) {
    const seen = new Set();
    for (const [i, c] of site.collections.entries()) {
      if (typeof c.slug !== 'string' || !c.slug) {
        throw new Error(`site.json: collections[${i}].slug is required`);
      }
      if (seen.has(c.slug)) {
        throw new Error(`site.json: duplicate collection slug: ${c.slug}`);
      }
      seen.add(c.slug);
      if (typeof c.title !== 'string' || !c.title) {
        throw new Error(`site.json: collections[${i}].title is required`);
      }
      if (!Array.isArray(c.appSlugs)) {
        throw new Error(`site.json: collections[${i}].appSlugs must be an array`);
      }
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 59 passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Add validateSiteJson for site config validation"
```

---

## Task 5: `walkThoughts` — merge tree with disk content

**Files:**
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import { walkThoughts } from '../build.mjs';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('walkThoughts: returns flat ordered list with slug, content', () => {
  const dir = mkdtempSync(join(tmpdir(), 'walk-'));
  try {
    writeFileSync(join(dir, 'a.md'), '---\ntitle: A\ndate: 2026-01-01\n---\nBody A');
    writeFileSync(join(dir, 'b.md'), '---\ntitle: B\ndate: 2026-01-02\n---\nBody B');
    const site = {
      thoughts: {
        tree: [
          { type: 'file', path: `${dir}/b.md`, title: 'B', date: '2026-01-02' },
          { type: 'file', path: `${dir}/a.md`, title: 'A', date: '2026-01-01' },
        ],
      },
    };
    const result = walkThoughts(site);
    assert.equal(result.length, 2);
    assert.equal(result[0].title, 'B');  // order from tree, not disk
    assert.equal(result[0].body, 'Body B');
    assert.equal(result[1].title, 'A');
    assert.equal(result[0].slug, 'b');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('walkThoughts: throws if file declared in tree does not exist', () => {
  const site = {
    thoughts: {
      tree: [{ type: 'file', path: '/nonexistent.md', title: 'X', date: '2026-01-01' }],
    },
  };
  assert.throws(() => walkThoughts(site), /not found/);
});

test('walkThoughts: handles folder children', () => {
  const dir = mkdtempSync(join(tmpdir(), 'walk-'));
  try {
    writeFileSync(join(dir, 'x.md'), '---\ntitle: X\ndate: 2026-01-01\n---\nX body');
    const site = {
      thoughts: {
        tree: [
          {
            type: 'folder', name: 'fld', children: [
              { type: 'file', path: `${dir}/x.md`, title: 'X', date: '2026-01-01' },
            ],
          },
        ],
      },
    };
    const result = walkThoughts(site);
    assert.equal(result.length, 1);
    assert.equal(result[0].title, 'X');
    assert.equal(result[0].folder, 'fld');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
node --test tests/build.test.mjs 2>&1 | grep "walkThoughts"
```

Expected: 3 tests fail with "walkThoughts is not a function".

- [ ] **Step 3: Add `walkThoughts` to build.mjs**

```javascript
import { existsSync, readFileSync } from 'node:fs';

export function walkThoughts(site) {
  const tree = site.thoughts?.tree ?? [];
  const out = [];
  for (const item of tree) {
    if (item.type === 'file') {
      out.push(loadThought(item, null));
    } else if (item.type === 'folder') {
      for (const child of item.children) {
        out.push(loadThought(child, item.name));
      }
    }
  }
  return out;
}

function loadThought(item, folder) {
  if (!existsSync(item.path)) {
    throw new Error(`thought file not found: ${item.path}`);
  }
  const raw = readFileSync(item.path, 'utf8');
  const { frontmatter, body } = parseFrontmatter(raw);
  return {
    path: item.path,
    title: item.title,
    date: item.date,
    excerpt: item.excerpt ?? frontmatter.excerpt ?? '',
    appSlugs: item.appSlugs ?? frontmatter.appSlugs ?? [],
    folder,
    slug: deriveSlugFromPath(item.path),
    body,
  };
}

function deriveSlugFromPath(p) {
  // Reuse the public slugify for thought files
  return slugify(p);
}

function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { frontmatter: {}, body: md };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    // Strip surrounding quotes
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    // Parse [a, b, c] as array
    if (v.startsWith('[') && v.endsWith(']')) {
      fm[k] = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    } else {
      fm[k] = v;
    }
  }
  return { frontmatter: fm, body: m[2] };
}
```

- [ ] **Step 4: Run tests**

```bash
node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 62 passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Add walkThoughts with front-matter parsing and slug derivation"
```

---

## Task 6: `render.about` and `templates/about.html`

**Files:**
- Create: `templates/about.html`
- Modify: `build.mjs` (add `render.about`)
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import { render } from '../build.mjs';

test('render.about: produces page with author name and tagline', async () => {
  const site = {
    author: {
      name: 'lipo', tagline: 'one dev',
      bio: 'I build things.', avatar: 'assets/avatar.svg',
      social: [{ label: 'GitHub', url: 'https://github.com/lipopo' }],
    },
    thoughts: { tree: [] },
    collections: [],
  };
  const html = await render.about(site);
  assert.match(html, /lipo/);
  assert.match(html, /one dev/);
  assert.match(html, /assets\/avatar\.svg/);
  assert.match(html, /github\.com\/lipopo/);
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
node --test tests/build.test.mjs 2>&1 | grep "render.about"
```

Expected: FAIL — `render.about is not a function`.

- [ ] **Step 3: Create `templates/about.html`**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{author.name}} | info.opplipo.cn</title>
  <meta name="description" content="{{author.tagline}}">
  <link rel="stylesheet" href="{{assets.styles}}">
</head>
<body>
  <main class="page">
    <a class="back-link" href="/">← 返回首页</a>

    <section class="about-page">
      {{#if author.avatar}}<img class="about__avatar" src="/{{author.avatar}}" alt="{{author.name}}">{{/if}}
      <div class="about__body">
        <h1 class="about__name">{{author.name}}</h1>
        <p class="about__tagline">{{author.tagline}}</p>
        {{#if author.location}}<p class="about__location">{{author.location}}</p>{{/if}}
        <div class="prose">{{{authorBioHtml}}}</div>
        {{#if author.social.length}}
          <ul class="about__social">
            {{#each author.social}}<li><a href="{{url}}">{{label}} →</a></li>{{/each}}
          </ul>
        {{/if}}
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

- [ ] **Step 4: Add `render.about` to build.mjs**

Add inside the `render` object (alongside `home` and `app`):

```javascript
async about(site) {
  const tpl = await readFile(join(ROOT, 'templates', 'about.html'), 'utf8');
  const scope = {
    ...site,
    author: {
      ...site.author,
      bioHtml: site.author.bio ? renderMarkdown(site.author.bio) : '',
    },
    authorBioHtml: site.author.bio ? renderMarkdown(site.author.bio) : '',
    assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
    year: String(new Date().getFullYear()),
  };
  return renderTemplate(tpl, scope);
},
```

- [ ] **Step 5: Run tests**

```bash
node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 63 passing, 0 failing.

- [ ] **Step 6: Commit**

```bash
git add build.mjs templates/about.html tests/build.test.mjs
git commit -m "Add /about page with author profile and social links"
```

---

## Task 7: `render.thoughtsIndex` and `templates/thoughts-index.html`

**Files:**
- Create: `templates/thoughts-index.html`
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
test('render.thoughtsIndex: produces page with all thought titles', async () => {
  const site = {
    author: { name: 'lipo', tagline: 'x' },
    thoughts: {
      tree: [
        { type: 'folder', name: 'dev', children: [
          { type: 'file', path: 'x.md', title: 'My First Thought', date: '2026-01-01' },
        ]},
      ],
    },
    collections: [],
  };
  const html = await render.thoughtsIndex(site, [
    { slug: 'my-first-thought', title: 'My First Thought', date: '2026-01-01', folder: 'dev', body: 'hi' },
  ]);
  assert.match(html, /My First Thought/);
  assert.match(html, /\/thoughts\/my-first-thought\//);
  assert.match(html, />dev</);
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
node --test tests/build.test.mjs 2>&1 | grep "render.thoughtsIndex"
```

Expected: FAIL.

- [ ] **Step 3: Create `templates/thoughts-index.html`**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>想法 | info.opplipo.cn</title>
  <meta name="description" content="开发笔记与思考">
  <link rel="stylesheet" href="{{assets.styles}}">
</head>
<body>
  <main class="page">
    <a class="back-link" href="/">← 返回首页</a>

    <section class="thoughts-layout">
      <aside class="file-tree" aria-label="想法列表">
        <div class="file-tree__root">/thoughts</div>
        <ul class="file-tree__list">
          {{#each treeForTemplate}}
            {{#if isFolder}}
              <li class="file-tree__folder">{{name}}</li>
              <ul>
                {{#each children}}
                  <li class="file-tree__file"><a href="/thoughts/{{slug}}/">{{title}}</a></li>
                {{/each}}
              </ul>
            {{/if}}
            {{#if isFile}}
              <li class="file-tree__file file-tree__file--top"><a href="/thoughts/{{slug}}/">{{title}}</a></li>
            {{/if}}
          {{/each}}
        </ul>
      </aside>
      <main class="thoughts-index__main">
        <h1>想法 / THOUGHTS</h1>
        <p class="prose">{{thoughtCount}} 篇思考，按时间倒序排列。</p>
        <ul class="thoughts-index__recent">
          {{#each recentThoughts}}
            <li>
              <a href="/thoughts/{{slug}}/">{{title}}</a>
              <span class="thoughts-index__date">{{date}}</span>
            </li>
          {{/each}}
        </ul>
      </main>
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

- [ ] **Step 4: Add `render.thoughtsIndex` to build.mjs**

```javascript
async thoughtsIndex(site, thoughts) {
  const tpl = await readFile(join(ROOT, 'templates', 'thoughts-index.html'), 'utf8');
  // Build tree structure for template (preserves folder grouping).
  const tree = site.thoughts?.tree ?? [];
  const treeForTemplate = tree.map((item) => {
    if (item.type === 'folder') {
      return {
        isFolder: true,
        name: item.name,
        children: item.children.map((c) => {
          const t = thoughts.find((x) => x.path === c.path);
          return { slug: t ? t.slug : slugify(c.path), title: c.title };
        }),
      };
    } else {
      const t = thoughts.find((x) => x.path === item.path);
      return { isFile: true, slug: t ? t.slug : slugify(item.path), title: item.title };
    }
  });
  // Recent 10 thoughts, sorted by date desc
  const recentThoughts = [...thoughts]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .map((t) => ({ slug: t.slug, title: t.title, date: t.date }));
  const scope = {
    ...site,
    treeForTemplate,
    recentThoughts,
    thoughtCount: thoughts.length,
    assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
    year: String(new Date().getFullYear()),
  };
  return renderTemplate(tpl, scope);
},
```

- [ ] **Step 5: Run tests**

```bash
node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 64 passing, 0 failing.

- [ ] **Step 6: Commit**

```bash
git add build.mjs templates/thoughts-index.html tests/build.test.mjs
git commit -m "Add /thoughts index page with file tree and recent posts"
```

---

## Task 8: `render.thoughtPage` and `templates/thought.html`

**Files:**
- Create: `templates/thought.html`
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
test('render.thoughtPage: produces page with title, body, and sidebar', async () => {
  const all = [
    { slug: 'first', title: 'First', date: '2026-01-01', body: 'Body 1', folder: 'dev' },
    { slug: 'second', title: 'Second', date: '2026-01-02', body: 'Body 2', folder: null },
  ];
  const html = await render.thoughtPage(all[1], all, { author: { name: 'lipo' }, thoughts: { tree: [] } });
  assert.match(html, /Second/);
  assert.match(html, /Body 2/);
  assert.match(html, /\/thoughts\/first\//);  // sidebar contains previous
  assert.match(html, /First/);
  // Active state on current
  assert.match(html, /file-tree__file--active[^>]*><a href="\/thoughts\/second\/"/);
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
node --test tests/build.test.mjs 2>&1 | grep "render.thoughtPage"
```

Expected: FAIL.

- [ ] **Step 3: Create `templates/thought.html`**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{title}} | info.opplipo.cn</title>
  <meta name="description" content="{{excerpt}}">
  <link rel="stylesheet" href="{{assets.styles}}">
</head>
<body>
  <main class="page">
    <a class="back-link" href="/thoughts/">← 想法列表</a>

    <section class="thoughts-layout">
      <aside class="file-tree" aria-label="想法列表">
        <div class="file-tree__root"><a href="/thoughts/">/thoughts</a></div>
        <ul class="file-tree__list">
          {{#each treeForTemplate}}
            {{#if isFolder}}
              <li class="file-tree__folder">{{name}}</li>
              <ul>
                {{#each children}}
                  <li class="file-tree__file{{#if isActive}} file-tree__file--active{{/if}}"><a href="/thoughts/{{slug}}/">{{title}}</a></li>
                {{/each}}
              </ul>
            {{/if}}
            {{#if isFile}}
              <li class="file-tree__file file-tree__file--top{{#if isActive}} file-tree__file--active{{/if}}"><a href="/thoughts/{{slug}}/">{{title}}</a></li>
            {{/if}}
          {{/each}}
        </ul>
      </aside>
      <article class="thought-page">
        <header class="thought__header">
          <h1>{{title}}</h1>
          <div class="thought__meta">
            <span>{{date}}</span>
            {{#if folder}}· <span>{{folder}}</span>{{/if}}
            {{#if appSlugs.length}}· 相关 APP: {{#each appSlugs}}<a href="/apps/{{.}}/">{{.}}</a>{{/each}}{{/if}}
          </div>
          {{#if excerpt}}<p class="thought__excerpt">{{excerpt}}</p>{{/if}}
        </header>
        <div class="thought-content">{{{contentHtml}}}</div>
        <nav class="thought__nav">
          {{#if prev}}<a class="thought__nav-prev" href="/thoughts/{{prev.slug}}/">← {{prev.title}}</a>{{/if}}
          {{#if next}}<a class="thought__nav-next" href="/thoughts/{{next.slug}}/">{{next.title}} →</a>{{/if}}
        </nav>
      </article>
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

- [ ] **Step 4: Add `render.thoughtPage` to build.mjs**

```javascript
async thoughtPage(thought, allThoughts, site) {
  const tpl = await readFile(join(ROOT, 'templates', 'thought.html'), 'utf8');
  // Build the file tree in the same order as the index page.
  const tree = site.thoughts?.tree ?? [];
  const treeForTemplate = tree.map((item) => {
    if (item.type === 'folder') {
      return {
        isFolder: true,
        name: item.name,
        children: item.children.map((c) => {
          const t = allThoughts.find((x) => x.path === c.path);
          return {
            slug: t ? t.slug : slugify(c.path),
            title: c.title,
            isActive: t && t.slug === thought.slug,
          };
        }),
      };
    } else {
      const t = allThoughts.find((x) => x.path === item.path);
      return {
        isFile: true,
        slug: t ? t.slug : slugify(item.path),
        title: item.title,
        isActive: t && t.slug === thought.slug,
      };
    }
  });
  // Prev/next: top-down order
  const flat = [];
  for (const item of tree) {
    if (item.type === 'file') flat.push(item.path);
    else if (item.type === 'folder') for (const c of item.children) flat.push(c.path);
  }
  const slugOfPath = (p) => {
    const t = allThoughts.find((x) => x.path === p);
    return t ? t.slug : slugify(p);
  };
  const idx = flat.indexOf(thought.path);
  const prevPath = idx > 0 ? flat[idx - 1] : null;
  const nextPath = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;
  const prev = prevPath ? allThoughts.find((x) => x.path === prevPath) : null;
  const next = nextPath ? allThoughts.find((x) => x.path === nextPath) : null;
  const scope = {
    ...thought,
    contentHtml: renderMarkdown(thought.body),
    treeForTemplate,
    prev: prev ? { slug: prev.slug, title: prev.title } : null,
    next: next ? { slug: next.slug, title: next.title } : null,
    assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
    year: String(new Date().getFullYear()),
  };
  return renderTemplate(tpl, scope);
},
```

- [ ] **Step 5: Run tests**

```bash
node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 65 passing, 0 failing.

- [ ] **Step 6: Commit**

```bash
git add build.mjs templates/thought.html tests/build.test.mjs
git commit -m "Add /thoughts/<slug> page with sidebar nav and prev/next"
```

---

## Task 9: `render.collectionsIndex`, `render.collectionPage`, and templates

**Files:**
- Create: `templates/collections-index.html`, `templates/collection.html`
- Modify: `build.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing tests**

```javascript
test('render.collectionsIndex: produces page with all collection titles', async () => {
  const site = {
    author: { name: 'lipo' },
    thoughts: { tree: [] },
    collections: [
      { slug: 'starter', title: 'Starter Pack', description: 'Get started', appSlugs: ['_sample'], icon: '▣' },
    ],
  };
  const html = await render.collectionsIndex(site, []);
  assert.match(html, /Starter Pack/);
  assert.match(html, /\/collections\/starter\//);
  assert.match(html, /▣/);
});

test('render.collectionPage: produces page with referenced apps', async () => {
  const site = {
    author: { name: 'lipo' },
    thoughts: { tree: [] },
    collections: [{ slug: 'starter', title: 'Starter', description: 'x', appSlugs: ['_sample'], icon: '▣' }],
  };
  const apps = [{ slug: '_sample', name: 'Sample', version: '0.1.0', color: ['#000', '#000'] }];
  const html = await render.collectionPage(site.collections[0], apps, site);
  assert.match(html, /Starter/);
  assert.match(html, /Sample/);
  assert.match(html, /\/apps\/_sample\//);
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
node --test tests/build.test.mjs 2>&1 | grep "render.collectionsIndex\|render.collectionPage"
```

Expected: 2 tests fail.

- [ ] **Step 3: Create `templates/collections-index.html`**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>精选 | info.opplipo.cn</title>
  <link rel="stylesheet" href="{{assets.styles}}">
</head>
<body>
  <main class="page">
    <a class="back-link" href="/">← 返回首页</a>

    <section class="block">
      <div class="block__label">COLLECTIONS</div>
      <p class="prose">按主题/质量分组的应用合集。</p>
    </section>

    <section class="coming-soon__grid">
      {{#each collections}}
        <a class="card card--small" href="/collections/{{slug}}/">
          <div class="collection-card__icon">{{icon}}</div>
          <div class="card__name">{{title}}</div>
          <div class="card__tagline">{{description}}</div>
          <div class="card__category">{{appSlugs.length}} 个 APP</div>
        </a>
      {{/each}}
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

- [ ] **Step 4: Create `templates/collection.html`**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{title}} | info.opplipo.cn</title>
  <meta name="description" content="{{description}}">
  <link rel="stylesheet" href="{{assets.styles}}">
</head>
<body>
  <main class="page">
    <a class="back-link" href="/collections/">← 所有精选</a>

    <header class="collection-header">
      <div class="collection-card__icon collection-card__icon--lg">{{icon}}</div>
      <h1>{{title}}</h1>
      <p class="prose">{{description}}</p>
    </header>

    <section class="recent-updates__grid">
      {{#each apps}}
        <a class="release-card" href="/apps/{{slug}}/">
          <div class="release-card__head">
            <span class="release-card__icon" style="--c1:{{color.0}}; --c2:{{color.1}};"></span>
            <span class="release-card__name">{{name}}</span>
            <span class="release-card__version">v{{version}}</span>
          </div>
          {{#if tagline}}<div class="release-card__notes">{{tagline}}</div>{{/if}}
        </a>
      {{/each}}
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

- [ ] **Step 5: Add `render.collectionsIndex` and `render.collectionPage` to build.mjs**

```javascript
async collectionsIndex(site, apps) {
  const tpl = await readFile(join(ROOT, 'templates', 'collections-index.html'), 'utf8');
  const scope = {
    ...site,
    apps,
    assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
    year: String(new Date().getFullYear()),
  };
  return renderTemplate(tpl, scope);
},

async collectionPage(collection, apps, site) {
  const tpl = await readFile(join(ROOT, 'templates', 'collection.html'), 'utf8');
  const filteredApps = apps.filter((a) => collection.appSlugs.includes(a.slug));
  const scope = {
    ...collection,
    apps: filteredApps,
    assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
    year: String(new Date().getFullYear()),
  };
  return renderTemplate(tpl, scope);
},
```

- [ ] **Step 6: Run tests**

```bash
node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 67 passing, 0 failing.

- [ ] **Step 7: Commit**

```bash
git add build.mjs templates/collections-index.html templates/collection.html tests/build.test.mjs
git commit -m "Add /collections index and per-collection pages"
```

---

## Task 10: Wire up `writeOutputs` to emit all pages

**Files:**
- Modify: `build.mjs` (`writeOutputs` and `main`)

- [ ] **Step 1: Read current `writeOutputs` to understand structure**

Read the file with the Read tool. Locate the function (around line 609-621).

- [ ] **Step 2: Replace `writeOutputs` to also emit new pages**

Replace the existing `writeOutputs` function with:

```javascript
async function writeOutputs(apps, site, thoughts) {
  // 1. index.html at root
  const home = await render.home(apps);
  await writeIfChanged(join(ROOT, 'index.html'), home);

  // 2. apps/<slug>/index.html for each
  for (const app of apps) {
    const dir = join(ROOT, 'apps', app.slug);
    await mkdir(dir, { recursive: true });
    const html = await render.app(app);
    await writeIfChanged(join(dir, 'index.html'), html);
  }

  // 3. /about/
  const aboutDir = join(ROOT, 'about');
  await mkdir(aboutDir, { recursive: true });
  const aboutHtml = await render.about(site);
  await writeIfChanged(join(aboutDir, 'index.html'), aboutHtml);

  // 4. /thoughts/ and /thoughts/<slug>/
  const thoughtsDir = join(ROOT, 'thoughts');
  await mkdir(thoughtsDir, { recursive: true });
  const thoughtsIndexHtml = await render.thoughtsIndex(site, thoughts);
  await writeIfChanged(join(thoughtsDir, 'index.html'), thoughtsIndexHtml);
  for (const t of thoughts) {
    const dir = join(thoughtsDir, t.slug);
    await mkdir(dir, { recursive: true });
    const html = await render.thoughtPage(t, thoughts, site);
    await writeIfChanged(join(dir, 'index.html'), html);
  }

  // 5. /collections/ and /collections/<slug>/
  const collDir = join(ROOT, 'collections');
  await mkdir(collDir, { recursive: true });
  const collIndexHtml = await render.collectionsIndex(site, apps);
  await writeIfChanged(join(collDir, 'index.html'), collIndexHtml);
  for (const c of (site.collections ?? [])) {
    const dir = join(collDir, c.slug);
    await mkdir(dir, { recursive: true });
    const html = await render.collectionPage(c, apps, site);
    await writeIfChanged(join(dir, 'index.html'), html);
  }
}
```

- [ ] **Step 3: Update `main()` to read `site.json` and pass everything in**

Find `main()` and replace it with:

```javascript
async function main() {
  const appsPath = join(ROOT, 'apps.json');
  const apps = JSON.parse(await readFile(appsPath, 'utf8'));
  validate(apps);
  await copyAssets();

  // Read site config if present; if absent, writeOutputs still works for app pages only.
  let site = { author: { name: 'lipo', tagline: '' }, thoughts: { tree: [] }, collections: [] };
  const sitePath = join(ROOT, 'site.json');
  if (existsSync(sitePath)) {
    site = JSON.parse(await readFile(sitePath, 'utf8'));
    validateSiteJson(site);
  }

  // Walk thoughts (validates file existence)
  const thoughts = walkThoughts(site);

  // Public build: strip private + lifecycle.targetDate, then derive public quarter.
  const publicApps = apps.map((app) => {
    const sanitized = omitPrivate(app);
    if (sanitized.lifecycle && app.lifecycle?.targetDate) {
      const q = deriveQuarter(app.lifecycle.targetDate);
      if (q) sanitized.lifecycle = { ...sanitized.lifecycle, targetQuarter: q };
    }
    return sanitized;
  });

  await writeOutputs(publicApps, site, thoughts);

  if (process.argv.includes('--private')) {
    const html = await render.roadmap(apps);
    await writeFile(join(ROOT, 'roadmap.html'), html, 'utf8');
    console.log(`✓ wrote roadmap.html (private)`);
  }

  console.log(`✓ built ${apps.length} app page(s), ${thoughts.length} thought(s), ${(site.collections ?? []).length} collection(s)`);
}
```

- [ ] **Step 4: Build the site to confirm it still works with no `site.json`**

```bash
node build.mjs
```

Expected: `✓ built 1 app page(s), 0 thought(s), 0 collection(s)`. Verify `index.html` and `apps/_sample/index.html` are unchanged (git diff should be empty for them).

- [ ] **Step 5: Commit**

```bash
git add build.mjs
git commit -m "Wire up writeOutputs to emit /about, /thoughts, /collections pages"
```

---

## Task 11: Add MORE block to homepage

**Files:**
- Modify: `templates/home.html` (add MORE block before footer)

- [ ] **Step 1: Add the MORE block**

Find the `</section>` for `coming-soon` and the `<footer class="site-footer">` in `templates/home.html`. Insert a new section between them:

```html
    <section class="more-block">
      <div class="block__label">MORE</div>
      <div class="coming-soon__grid">
        <a class="card card--small" href="/about/">
          <div class="card__icon more-block__glyph">▣</div>
          <div class="card__body">
            <div class="card__name">关于</div>
            <div class="card__category">{{site.tagline}}</div>
          </div>
        </a>
        <a class="card card--small" href="/thoughts/">
          <div class="card__icon more-block__glyph">▤</div>
          <div class="card__body">
            <div class="card__name">想法</div>
            <div class="card__category">{{thoughtCount}} 篇思考</div>
          </div>
        </a>
        <a class="card card--small" href="/collections/">
          <div class="card__icon more-block__glyph">▥</div>
          <div class="card__body">
            <div class="card__name">精选</div>
            <div class="card__category">{{collectionCount}} 个合集</div>
          </div>
        </a>
      </div>
    </section>
```

- [ ] **Step 2: Update `render.home` to inject `thoughtCount` and `collectionCount`**

Find the `render.home` function in `build.mjs`. The function currently takes `(apps)`. Change to also take `(site, thoughts)` and add to the scope:

```javascript
async home(apps, site, thoughts) {
  // ... existing code ...
  const scope = {
    ...appsContext(apps),
    site: { tagline: SITE_TAGLINE },
    featuredApps: enrichedFeaturedApps,
    recentReleases,
    hasFeaturedApps: enrichedFeaturedApps.length > 0,
    hasRecentReleases: recentReleases.length > 0,
    thoughtCount: (thoughts ?? []).length,
    collectionCount: (site?.collections ?? []).length,
  };
  scope['site.tagline'] = SITE_TAGLINE;
  return renderTemplate(tpl, scope);
},
```

- [ ] **Step 3: Update the call to `render.home` in `writeOutputs`**

Change:
```javascript
const home = await render.home(apps);
```
to:
```javascript
const home = await render.home(apps, site, thoughts);
```

- [ ] **Step 4: Build and inspect**

```bash
node build.mjs
```

Open `index.html` and verify the MORE block appears with all three cards.

- [ ] **Step 5: Commit**

```bash
git add templates/home.html build.mjs index.html
git commit -m "Add MORE block to homepage with about/thoughts/collections cards"
```

---

## Task 12: Add "相关想法" block to app detail page

**Files:**
- Modify: `templates/app.html` (add block after RELEASES, before ABOUT)
- Modify: `build.mjs` (`render.app` to accept thoughts and find matches)

- [ ] **Step 1: Add the block to `templates/app.html`**

Find the `{{#if description}}` section in `templates/app.html`. Insert this just before it:

```html
    {{#if relatedThoughts.length}}
      <section class="block">
        <div class="block__label">相关想法 · RELATED THOUGHTS</div>
        <ul class="releases">
          {{#each relatedThoughts}}
            <li class="releases__item">
              <span class="releases__v"><a href="/thoughts/{{slug}}/">{{title}}</a></span>
              <span class="releases__d">{{date}}</span>
              {{#if excerpt}}<span class="releases__n">{{excerpt}}</span>{{/if}}
            </li>
          {{/each}}
        </ul>
      </section>
    {{/if}}
```

- [ ] **Step 2: Update `render.app` signature and logic**

```javascript
async app(app, thoughts) {
  // ... existing code computing primaryCtaUrl etc ...
  const relatedThoughts = (thoughts ?? []).filter((t) => {
    const refs = t.appSlugs ?? [];
    return refs.includes(app.slug) || (app.thoughtSlugs ?? []).includes(t.slug);
  });
  const enriched = {
    ...app,
    // ... existing fields ...
    relatedThoughts,
  };
  // ... rest unchanged ...
}
```

- [ ] **Step 3: Update the call in `writeOutputs`**

Change:
```javascript
const html = await render.app(app);
```
to:
```javascript
const html = await render.app(app, thoughts);
```

- [ ] **Step 4: Build and inspect**

```bash
node build.mjs
```

Open `apps/_sample/index.html`. The "相关想法" block should not appear yet (no thoughts linked). Will appear in Task 14 once sample data is added.

- [ ] **Step 5: Commit**

```bash
git add templates/app.html build.mjs apps/_sample/index.html
git commit -m "Add related-thoughts block to app detail pages"
```

---

## Task 13: Add CSS for new components

**Files:**
- Modify: `assets/styles.css`

- [ ] **Step 1: Append new CSS to the end of `styles.css`**

```css
/* === Personal brand additions === */

/* Home MORE block */
.more-block { margin-top: 36px; }
.more-block__glyph {
  font-family: var(--font-mono);
  font-size: 32px;
  color: var(--accent);
  text-shadow: 0 0 8px rgba(0, 255, 60, 0.3);
  line-height: 1;
  display: flex; align-items: center; justify-content: center;
  width: 48px; height: 48px;
  border: 1px solid var(--border);
}

/* Thoughts layout: sidebar | content */
.thoughts-layout {
  display: flex;
  gap: 32px;
  align-items: flex-start;
}
.thoughts-layout > .file-tree { flex: 0 0 240px; position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow-y: auto; }
.thoughts-layout > .thoughts-index__main,
.thoughts-layout > .thought-page { flex: 1 1 auto; min-width: 0; }
.file-tree { font-family: var(--font-mono); font-size: var(--text-sm); }
.file-tree__root {
  color: var(--text-muted);
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.file-tree__root a { color: var(--text-muted); }
.file-tree__root a:hover { color: var(--accent); }
.file-tree__list { list-style: none; padding: 0; margin: 0; }
.file-tree__list ul { list-style: none; padding-left: 16px; margin: 4px 0 8px; }
.file-tree__folder { color: var(--accent); font-weight: 700; padding: 4px 0; }
.file-tree__file a { color: var(--text); display: block; padding: 3px 0; }
.file-tree__file a:hover { color: var(--accent); }
.file-tree__file--active a { color: var(--accent); }
.file-tree__file--top a { font-weight: 700; }

/* Thoughts index page */
.thoughts-index__recent { list-style: none; padding: 0; margin: 16px 0 0; }
.thoughts-index__recent li {
  display: flex; justify-content: space-between; gap: 12px;
  padding: 8px 0; border-bottom: 1px solid var(--border);
  font-family: var(--font-mono); font-size: var(--text-sm);
}
.thoughts-index__recent li a { color: var(--text); }
.thoughts-index__recent li a:hover { color: var(--accent); }
.thoughts-index__date { color: var(--text-muted); font-size: var(--text-xs); }

/* Thought page */
.thought-page .thought__header { border-bottom: 1px solid var(--border); padding-bottom: 16px; margin-bottom: 16px; }
.thought-page h1 { font-family: var(--font-heading); font-size: var(--text-2xl); margin: 0; color: var(--text); }
.thought__meta { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-muted); margin-top: 8px; }
.thought__meta a { color: var(--text-dim); }
.thought__meta a:hover { color: var(--accent); }
.thought__excerpt { font-family: var(--font-mono); font-size: var(--text-sm); color: var(--text-dim); margin: 12px 0 0; }
.thought-content { font-family: var(--font-mono); font-size: var(--text-sm); line-height: 1.7; color: var(--text-dim); }
.thought-content h1, .thought-content h2 { font-family: var(--font-heading); color: var(--text); margin: 24px 0 12px; }
.thought-content h1 { font-size: var(--text-xl); }
.thought-content h2 { font-size: var(--text-lg); }
.thought-content p { margin: 0 0 14px; }
.thought-content ul, .thought-content ol { margin: 0 0 14px; padding-left: 24px; }
.thought-content li { margin: 4px 0; }
.thought-content code { font-family: var(--font-mono); color: var(--accent); background: var(--surface); padding: 1px 4px; border: 1px solid var(--border); font-size: 0.95em; }
.thought-content pre { background: var(--surface); border: 1px solid var(--border); padding: 12px; margin: 0 0 14px; overflow-x: auto; }
.thought-content pre code { color: var(--text); background: none; border: 0; padding: 0; }
.thought-content blockquote { border-left: 2px solid var(--accent); margin: 0 0 14px; padding: 4px 0 4px 12px; color: var(--text-muted); }
.thought-content a { color: var(--accent); }
.thought-content a:hover { text-decoration: underline; }
.thought-content strong { color: var(--text); }
.thought-content em { color: var(--text); }
.thought__nav {
  display: flex; justify-content: space-between; gap: 16px;
  margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border);
  font-family: var(--font-mono); font-size: var(--text-sm);
}
.thought__nav a { color: var(--text-muted); }
.thought__nav a:hover { color: var(--accent); }
.thought__nav-prev { text-align: left; }
.thought__nav-next { text-align: right; margin-left: auto; }

/* About page */
.about-page {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 32px;
  align-items: start;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 36px 28px;
}
.about__avatar { width: 200px; height: 200px; object-fit: cover; border: 1px solid var(--border); }
.about__name { font-family: var(--font-heading); font-size: 32px; font-weight: 700; margin: 0; color: var(--accent); text-shadow: 0 0 12px rgba(0, 255, 60, 0.3); }
.about__tagline { font-family: var(--font-mono); color: var(--text-muted); margin: 4px 0 0; }
.about__location { font-family: var(--font-mono); color: var(--text-muted); font-size: var(--text-sm); margin: 4px 0 16px; }
.about__body .prose { margin-top: 0; }
.about__social { list-style: none; padding: 0; margin: 24px 0 0; display: flex; flex-wrap: wrap; gap: 10px; }
.about__social li a {
  display: inline-block; padding: 8px 16px;
  border: 1px solid var(--border);
  color: var(--text); font-family: var(--font-mono); font-size: var(--text-sm);
}
.about__social li a:hover { border-color: var(--accent); color: var(--accent); }

/* Collection cards */
.collection-card__icon {
  font-family: var(--font-mono);
  font-size: 48px;
  color: var(--accent);
  text-shadow: 0 0 12px rgba(0, 255, 60, 0.3);
  line-height: 1;
  display: flex; align-items: center; justify-content: center;
  width: 64px; height: 64px;
  border: 1px solid var(--border);
  margin: 0 auto;
}
.collection-card__icon--lg { width: 96px; height: 96px; font-size: 56px; margin: 0 auto 16px; }
.collection-header { text-align: center; padding: 36px 0; border-bottom: 1px solid var(--border); margin-bottom: 24px; }
.collection-header h1 { font-family: var(--font-heading); font-size: var(--text-2xl); margin: 12px 0 8px; }
.collection-header .prose { max-width: 600px; margin: 0 auto; }

/* Responsive */
@media (max-width: 640px) {
  .thoughts-layout { flex-direction: column; }
  .thoughts-layout > .file-tree { position: static; flex: 0 0 auto; max-height: none; width: 100%; }
  .about-page { grid-template-columns: 1fr; }
  .about__avatar { width: 120px; height: 120px; }
}
```

- [ ] **Step 2: Build and visually verify**

```bash
node build.mjs
```

Open `index.html` in a browser at `http://localhost:4000/` and confirm the MORE block, /about/, /thoughts/, /collections/ all render with the terminal brutalist aesthetic.

- [ ] **Step 3: Commit**

```bash
git add assets/styles.css
git commit -m "Add CSS for thoughts, about, collections, and home MORE block"
```

---

## Task 14: Create `site.json` sample data

**Files:**
- Create: `site.json`

- [ ] **Step 1: Create the file**

```json
{
  "author": {
    "name": "lipo",
    "tagline": "一个人 · 认真做点东西",
    "bio": "## 关于我\n\n独立开发者，关注 Android、独立产品、写作与开源。\n\n喜欢用最少的依赖解决问题。",
    "avatar": "assets/avatar.svg",
    "location": "中国",
    "social": [
      { "label": "GitHub", "url": "https://github.com/lipopo" },
      { "label": "Email", "url": "mailto:lipo8081@gmail.com" }
    ]
  },
  "thoughts": {
    "tree": [
      {
        "type": "folder", "name": "开发心得", "children": [
          { "type": "file", "path": "content/thoughts/dev/sample-thought.md", "title": "示例：Markdown 渲染管线", "date": "2026-06-10", "excerpt": "如何零依赖地实现一个 markdown 渲染器", "appSlugs": [] }
        ]
      }
    ]
  },
  "collections": [
    {
      "slug": "starter-pack",
      "title": "入门三件套",
      "description": "如果你是第一次来，可以从这三款 APP 开始。",
      "appSlugs": ["_sample"],
      "icon": "▣"
    }
  ]
}
```

- [ ] **Step 2: Commit (don't build yet — content file needed first)**

```bash
git add site.json
git commit -m "Add site.json with author, thought tree, and starter collection"
```

---

## Task 15: Create sample thought markdown

**Files:**
- Create: `content/thoughts/dev/sample-thought.md`

- [ ] **Step 1: Create directory and file**

```bash
mkdir -p content/thoughts/dev
```

Then create the file `content/thoughts/dev/sample-thought.md`:

```markdown
---
title: 示例：Markdown 渲染管线
date: 2026-06-10
excerpt: 如何零依赖地实现一个 markdown 渲染器
appSlugs: []
---

## 背景

做这个站点的过程中，我需要一个 markdown 渲染器，但又不想引入 npm 依赖。

## 实现思路

> 关键在于：先做提取，再做转义，最后做替换。

具体步骤：

1. 先把代码块提取出来（用占位符）
2. 再对剩余内容做 HTML 转义
3. 然后按行处理：标题、列表、段落、引用
4. 最后做行内替换：链接、粗体、斜体
5. 把占位符还原

## 代码示例

内联代码像 `npm install` 这样。代码块：

```js
function slugify(path) {
  return path.replace(/^content\/thoughts\//, '').replace(/\.md$/, '').replace(/\//g, '--');
}
```

## 一些想法

- 零依赖的代码量其实不大
- 但**测试覆盖**必须够，否则边界条件很难调
- *不要*自己实现完整的 CommonMark，规范太复杂
```

- [ ] **Step 2: Build and verify the thought renders**

```bash
node build.mjs
```

Expected output: `✓ built 1 app page(s), 1 thought(s), 1 collection(s)`.

Verify:
- `thoughts/index.html` contains the file tree
- `thoughts/dev--sample-thought/index.html` exists and renders the markdown
- The page contains the code block, the list, the blockquote, the inline code

- [ ] **Step 3: Run all tests**

```bash
node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 67 passing, 0 failing.

- [ ] **Step 4: Commit**

```bash
git add content/thoughts/dev/sample-thought.md
git commit -m "Add sample thought content with full markdown feature demo"
```

---

## Task 16: Create sample avatar

**Files:**
- Create: `assets/avatar.svg`

- [ ] **Step 1: Create a placeholder avatar**

A simple monospace-text-on-black square that matches the terminal aesthetic:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <rect width="200" height="200" fill="#0e0e0e"/>
  <rect x="2" y="2" width="196" height="196" fill="none" stroke="#00ff44" stroke-width="2"/>
  <text x="100" y="92" text-anchor="middle" fill="#00ff44" font-family="monospace" font-size="64" font-weight="700">lipo</text>
  <text x="100" y="120" text-anchor="middle" fill="#00e050" font-family="monospace" font-size="14">&gt; _</text>
</svg>
```

- [ ] **Step 2: Build and verify about page**

```bash
node build.mjs
```

Open `about/index.html` and confirm the avatar shows up.

- [ ] **Step 3: Commit**

```bash
git add assets/avatar.svg
git commit -m "Add placeholder avatar SVG for about page"
```

---

## Task 17: Cross-link demo — link sample app to sample thought

**Files:**
- Modify: `apps.json` (add `thoughtSlugs` to `_sample`)

- [ ] **Step 1: Edit `apps.json`**

Add `"thoughtSlugs": ["dev--sample-thought"]` to the `_sample` app entry (after `platforms`).

- [ ] **Step 2: Build and verify**

```bash
node build.mjs
```

Open `apps/_sample/index.html` and confirm a "相关想法" block appears below RELEASES.

- [ ] **Step 3: Run all tests**

```bash
node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 67 passing, 0 failing.

- [ ] **Step 4: Commit**

```bash
git add apps.json apps/_sample/index.html
git commit -m "Cross-link sample app to sample thought"
```

---

## Task 18: Final end-to-end verification

**Files:** none (read-only)

- [ ] **Step 1: Run the full test suite**

```bash
node --test tests/build.test.mjs 2>&1 | tail -20
```

Expected: 67 passing, 0 failing.

- [ ] **Step 2: Build the site**

```bash
node build.mjs
```

Expected: `✓ built 1 app page(s), 1 thought(s), 1 collection(s)`.

- [ ] **Step 3: Verify all 7 routes render**

```bash
test -f index.html && test -f apps/_sample/index.html && test -f about/index.html && test -f thoughts/index.html && test -f thoughts/dev--sample-thought/index.html && test -f collections/index.html && test -f collections/starter-pack/index.html && echo "all routes present"
```

Expected: `all routes present`.

- [ ] **Step 4: Verify no `{{` placeholders leaked**

```bash
grep -r '{{' index.html apps/ about/ thoughts/ collections/ --include='*.html' && echo "LEAKED" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 5: Manual smoke test**

Start a local server:
```bash
python3 -m http.server 4000
```

Open in a browser:
- http://localhost:4000/ — homepage with MORE block at the bottom
- http://localhost:4000/about/ — author profile with avatar
- http://localhost:4000/thoughts/ — file tree + recent thoughts
- http://localhost:4000/thoughts/dev--sample-thought/ — sidebar + content
- http://localhost:4000/collections/ — collection cards
- http://localhost:4000/collections/starter-pack/ — collection detail
- http://localhost:4000/apps/_sample/ — app detail with "相关想法"

Click around to confirm links work and the visual style is consistent.

- [ ] **Step 6: Final commit (only if any cleanup was needed)**

If anything was tweaked:
```bash
git add -A
git commit -m "Polish personal brand site after end-to-end verification"
```

If everything passed as-is, skip this step.

---

## Self-Review Notes

(Author's check of the plan against the spec.)

**Spec coverage:**
- Routes (7) — covered in tasks 6–10 ✓
- site.json schema — task 4 ✓
- content/thoughts front-matter — task 5 ✓
- apps.json `thoughtSlugs` extension — task 17 ✓
- renderMarkdown full feature matrix — tasks 2, 3 ✓
- Template creation — tasks 6, 7, 8, 9 ✓
- Build wiring — task 10 ✓
- Home MORE block — task 11 ✓
- App-detail related-thoughts block — task 12 ✓
- CSS additions — task 13 ✓
- Sample data — tasks 14, 15, 16 ✓
- Tests 55+ target — tasks 1, 2, 3, 4, 5, 6, 7, 8, 9 add 24 new tests (43 + 24 = 67) ✓
- Out-of-scope: search, tags, comments, RSS, i18n, theme switch, editor — explicitly excluded in spec ✓

**Placeholder scan:** No TBDs. All code blocks complete.

**Type consistency:** `slugify`, `renderMarkdown`, `validateSiteJson`, `walkThoughts`, `render.about`, `render.thoughtsIndex`, `render.thoughtPage`, `render.collectionsIndex`, `render.collectionPage` — all introduced in their respective tasks, signatures consistent across tasks that use them.

**Risks flagged in spec:**
- `renderMarkdown` correctness — mitigated by tasks 2 and 3 adding comprehensive tests
- Slug collisions — handled by deterministic `/`→`--` replacement
- Template engine depth — flagged but unlikely to be an issue
