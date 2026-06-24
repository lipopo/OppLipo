# /now and /uses Pages — Design Spec

**Date:** 2026-06-10
**Status:** Draft (pending user review)
**Owner:** lipo

## Goal

Add two canonical indie-developer brand pages to the site:
- `/now/` — what the developer is focused on right now (Derek Sivers /nownownow.com format)
- `/uses/` — the tools, hardware, and services the developer uses (uses.tech format)

These complete the brand surface area alongside `/about/`, `/thoughts/`, `/collections/`.

## Brand posture

Existing site is terminal brutalist with phosphor green, monospace, hard borders. Both new pages inherit this aesthetic — no new design language.

## Constraints

- Static site, GitHub Pages, no runtime
- Zero new npm dependencies (Node stdlib only)
- Existing 68 tests must keep passing
- `site.json` is the data source for both pages
- The home page MORE block grows from 3 to 5 items to include links to the two new pages

## Data model

### `site.json` additions

```json
{
  "now": {
    "text": "Markdown string"
  },
  "uses": {
    "categories": [
      {
        "name": "string (category label)",
        "items": [
          { "name": "string", "notes": "Markdown string" }
        ]
      }
    ]
  }
}
```

### Validation

`validateSiteJson` (extended) rejects:
- Missing `now.text` when `now` is present (now must be an object with `text`)
- `uses.categories` items missing `name` or `items` array
- `uses.categories[].items[].name` missing

`now` and `uses` blocks are **optional** — if absent, the pages are skipped (no `/now/index.html` or `/uses/index.html` written).

## Routes

| Route | Source | Required |
|---|---|---|
| `/now/` | `templates/now.html` | conditional on `site.now` |
| `/uses/` | `templates/uses.html` | conditional on `site.uses` |

## Render functions

### `render.now(siteJson)` → `/now/index.html`

```javascript
async now(site) {
  const tpl = await readFile(join(ROOT, 'templates', 'now.html'), 'utf8');
  const scope = {
    ...site,
    now: { ...site.now, html: renderMarkdown(site.now.text) },
    updatedAt: new Date().toISOString().slice(0, 10),
    assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
    year: String(new Date().getFullYear()),
  };
  return renderTemplate(tpl, scope);
}
```

### `render.uses(siteJson)` → `/uses/index.html`

```javascript
async uses(site) {
  const tpl = await readFile(join(ROOT, 'templates', 'uses.html'), 'utf8');
  const categories = (site.uses?.categories ?? []).map((cat) => ({
    ...cat,
    items: (cat.items ?? []).map((it) => ({
      ...it,
      notesHtml: it.notes ? renderMarkdown(it.notes) : '',
    })),
  }));
  const scope = {
    ...site,
    uses: { ...site.uses, categories },
    itemCount: categories.reduce((sum, c) => sum + c.items.length, 0),
    categoryCount: categories.length,
    assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
    year: String(new Date().getFullYear()),
  };
  return renderTemplate(tpl, scope);
}
```

## Templates

### `templates/now.html`

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>现在 | info.opplipo.cn</title>
  <link rel="stylesheet" href="{{assets.styles}}">
</head>
<body>
  <main class="page page--narrow">
    <a class="back-link" href="/">← 返回首页</a>

    <div class="term-prompt">
      <span class="prompt-arrow">$</span><span class="prompt-user">cat</span><span class="prompt-path">/now.md</span>
    </div>

    <article class="now-page">
      <header class="now-page__header">
        <div class="term-label">UPDATED · {{updatedAt}}</div>
      </header>
      <div class="now-content">{{{now.html}}}</div>
    </article>

    <footer class="site-footer">...</footer>
  </main>
</body>
</html>
```

### `templates/uses.html`

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>使用 | info.opplipo.cn</title>
  <link rel="stylesheet" href="{{assets.styles}}">
</head>
<body>
  <main class="page">
    <a class="back-link" href="/">← 返回首页</a>

    <div class="term-prompt">
      <span class="prompt-arrow">$</span><span class="prompt-user">ls</span><span class="prompt-path">/uses/</span><span class="prompt-output">{{categoryCount}} 类别 · {{itemCount}} 件</span>
    </div>

    {{#each uses.categories}}
      <section class="uses-category">
        <div class="term-label">{{name}} <span class="term-label__count">{{items.length}}</span></div>
        <ul class="uses-list">
          {{#each items}}
            <li class="uses-item">
              <span class="uses-item__name">{{name}}</span>
              {{#if notesHtml}}<span class="uses-item__notes">{{{notesHtml}}}</span>{{/if}}
            </li>
          {{/each}}
        </ul>
      </section>
    {{/each}}

    <footer class="site-footer">...</footer>
  </main>
</body>
</html>
```

## Build wiring

### `writeOutputs` extension

After the existing blocks, add:

```javascript
// 6. /now/ (conditional)
if (site.now) {
  const nowDir = join(ROOT, 'now');
  await mkdir(nowDir, { recursive: true });
  const html = await render.now(site);
  await writeIfChanged(join(nowDir, 'index.html'), html);
}

// 7. /uses/ (conditional)
if (site.uses) {
  const usesDir = join(ROOT, 'uses');
  await mkdir(usesDir, { recursive: true });
  const html = await render.uses(site);
  await writeIfChanged(join(usesDir, 'index.html'), html);
}
```

### Home page MORE block

The MORE block in `templates/home.html` grows from 3 to 5 cards. Add two new entries:

```html
<a class="card card--small" href="/now/">
  <div class="card__icon more-block__glyph">▦</div>
  <div class="card__body">
    <div class="card__name">现在</div>
    <div class="card__category">最近更新 {{nowUpdatedAt}}</div>
  </div>
</a>
<a class="card card--small" href="/uses/">
  <div class="card__icon more-block__glyph">▧</div>
  <div class="card__body">
    <div class="card__name">使用</div>
    <div class="card__category">{{usesItemCount}} 件装备</div>
  </div>
</a>
```

The grid becomes 5 columns on wide screens via `auto-fit`:

```css
.more-block__grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
```

`render.home` adds `nowUpdatedAt` (string, "—" if absent) and `usesItemCount` (number, 0 if absent) to its scope.

## CSS additions

| Class | Purpose |
|---|---|
| `.page--narrow` | Optional reduced max-width for the `/now` page (600px) |
| `.now-page__header` | Spacing for the UPDATED label above the content |
| `.now-content` | Wider line-height, monospace, accent color for the now text |
| `.uses-category` | Spacing between categories |
| `.uses-list` | List reset |
| `.uses-item` | Flex row: `name` + `notes` |
| `.uses-item__name` | Bold accent color, terminal-style |
| `.uses-item__notes` | Muted dim color, monospace, inline notes |
| `.more-block__grid` | 5-column responsive grid for the home MORE block |

## Tests (4 new, target 72/72)

| # | Test |
|---|---|
| 69 | `render.now: produces page with markdown content and term prompt` |
| 70 | `render.uses: produces page with all categories and items` |
| 71 | `validateSiteJson: rejects missing now.text` |
| 72 | `validateSiteJson: rejects uses.categories without name` |

## Out of scope (YAGNI)

- Multiple now entries with history (could be added later if user wants)
- /now tags/categories
- /uses filtering by tag
- /now and /uses cross-link between each other
- Editing interface — user edits `site.json` directly

## Risk notes

- The 5-column MORE grid on small screens stacks to 1 column (auto-fit handles this).
- The `/now` page renders arbitrary Markdown; XSS surface is the same as `/thoughts/` (handled by `renderMarkdown`'s HTML-escape-first pipeline).
- The `/uses` page renders `notes` per item with the same Markdown pipeline.

## Sample data

To exercise the new pages in production output, add the following to `site.json`:

```json
{
  "now": {
    "text": "## 现在 · Q3 2026\n\n主线是 LiteTerm 收尾 —— 移动端 SSH 客户端终于要做到 1.0。\n\n副线是 TinyLog 修小 bug。\n\n[PageMail](/apps/pagemail/) 还在调研阶段，邮件投递通道还没定。"
  },
  "uses": {
    "categories": [
      {
        "name": "硬件",
        "items": [
          { "name": "MacBook Pro 14\" (M2 Pro, 32GB)", "notes": "日常开发主力" },
          { "name": "iPhone 15 Pro", "notes": "真机调试" },
          { "name": "HHKB Studio", "notes": "外接键盘，Vim 模式" }
        ]
      },
      {
        "name": "开发",
        "items": [
          { "name": "VS Code + Vim 插件", "notes": "主力编辑器" },
          { "name": "Android Studio", "notes": "仅做 Android 时用" },
          { "name": "Ghostty", "notes": "终端模拟器" }
        ]
      },
      {
        "name": "服务",
        "items": [
          { "name": "GitHub Pages", "notes": "本站部署" },
          { "name": "Cloudflare DNS", "notes": "info.opplipo.cn" }
        ]
      }
    ]
  }
}
```