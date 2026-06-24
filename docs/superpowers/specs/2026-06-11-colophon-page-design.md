# Colophon Page — Design Spec

**Date:** 2026-06-11
**Status:** Draft (pending user review)
**Owner:** lipo

## Goal

Add `/colophon/` — the classic "how this site was built" page that completes the indie-dev brand surface area (alongside `/about/`, `/now/`, `/uses/`, `/thoughts/`, `/collections/`).

## Constraints

- Static site, GitHub Pages, no runtime backend
- Zero npm dependencies
- Existing 92 tests must keep passing
- Terminal brutalist aesthetic preserved

## Sections (5)

1. **Stack** — build / deploy / font / colors / icons (key-value list)
2. **Philosophy** — why zero-deps, why Markdown, why terminal brutalist (Markdown)
3. **Structure** — page inventory, file layout, build script summary (Markdown)
4. **Contribute** — repo URL, issues URL, guidelines, thanks
5. **License** — code (MIT) + content (CC-BY-4.0) + note
6. **Acknowledgments** — inspirations (Sivers, uses.tech), font/library thanks

## Data model: `site.colophon`

```json
{
  "colophon": {
    "stack": {
      "build": "Node.js 20+ stdlib，零 npm 依赖",
      "deploy": "GitHub Pages",
      "font": "JetBrains Mono / Fira Code / SF Mono（系统 monospace 回退）",
      "colors": "Terminal phosphor green (#00e050 / #00ff44) on near-black (#080808)",
      "icons": "项目自带 SVG，无图标库"
    },
    "philosophy": "本站是一个 **零 npm 依赖** 的静态站点。**Markdown 文件夹结构** + **JSON manifest** + **Node 脚本** 把数据渲染成 HTML。**没有任何前端框架** —— 只有 ~150 行 vanilla JS 用于轮播/灯箱/搜索。**Terminal brutalist** 美学：等宽字体、硬边框、零圆角、CRT 扫描线、闪烁光标。\n\n为什么？\n\n- *少依赖 = 易维护* —— `npm install` 不会失败，Node stdlib 已足够\n- *Markdown = 写作友好* —— 想法文可以直接用任意编辑器写\n- *静态站点 = 永久* —— 没有数据库、没有服务端、没有跟踪",
    "structure": "7 个内容路由 + 4 个基础设施文件：`/`、`/about/`、`/thoughts/`、`/collections/`、`/now/`、`/uses/`、`/search/`、`/feed.xml`、`/sitemap.xml`、`/robots.txt`、`/404.html`。\n\n源文件结构：\n- `apps.json` — 应用清单\n- `site.json` — 全站元数据 + thoughts 树\n- `content/thoughts/**/*.md` — 想法文正文\n- `templates/*.html` — 10 个 HTML 模板\n- `assets/styles.css` — 一份 CSS，所有页面\n- `assets/app.js` — vanilla JS\n- `build.mjs` — 单一构建脚本，无 npm 依赖",
    "contribute": {
      "repo": "https://github.com/lipopo/OppLipo",
      "issues": "https://github.com/lipopo/OppLipo/issues",
      "guidelines": "PR 前请开 issue 讨论；编辑 `apps.json` 或 `site.json` 后跑 `node build.mjs && node --test tests/build.test.mjs` 确认通过。",
      "thanks": "所有贡献者都列在 git log 里，谢谢 ❤️"
    },
    "license": {
      "code": "MIT",
      "content": "CC-BY-4.0",
      "note": "代码 MIT，正文（thoughts / about 等）CC-BY-4.0 署名。"
    },
    "acknowledgments": "灵感来源：Sivers 的 /now、uses.tech、Derek Sivers 的博客、Brad Frost 的 ATOMIC DESIGN。感谢 JetBrains Mono、Source Han Mono。"
  }
}
```

`colophon` block is **optional** — if absent, no `/colophon/` page is emitted.

## Render: `render.colophon(site)`

Returns the HTML. Scope includes:

- `colophon.stack` (object with string fields — pass through)
- `colophon.philosophyHtml = renderMarkdown(site.colophon.philosophy)`
- `colophon.structureHtml = renderMarkdown(site.colophon.structure)`
- `colophon.contribute` (object — pass through)
- `colophon.license` (object — pass through)
- `colophon.acknowledgments` (string — pass through)
- Standard `assets` and `year`

## Template: `templates/colophon.html`

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>colophon | info.opplipo.cn</title>
  <link rel="stylesheet" href="{{assets.styles}}">
  <link rel="alternate" type="application/atom+xml" href="/feed.xml" title="info.opplipo.cn">
</head>
<body>
  <main class="page">
    <a class="back-link" href="/">← 返回首页</a>

    <div class="term-prompt">
      <span class="prompt-arrow">$</span><span class="prompt-user">cat</span><span class="prompt-path">/colophon.md</span>
    </div>

    <section class="colophon-page">
      <h1 class="colophon-title">// COLOPHON</h1>
      <p class="colophon-subtitle">本站是如何构建的。</p>

      <div class="term-label">// STACK</div>
      <dl class="colophon-list">
        <dt>build</dt><dd>{{colophon.stack.build}}</dd>
        <dt>deploy</dt><dd>{{colophon.stack.deploy}}</dd>
        <dt>font</dt><dd>{{colophon.stack.font}}</dd>
        <dt>colors</dt><dd>{{colophon.stack.colors}}</dd>
        <dt>icons</dt><dd>{{colophon.stack.icons}}</dd>
      </dl>

      <div class="term-label">// PHILOSOPHY</div>
      <div class="prose colophon-philosophy">{{{colophon.philosophyHtml}}}</div>

      <div class="term-label">// STRUCTURE</div>
      <div class="prose">{{{colophon.structureHtml}}}</div>

      <div class="term-label">// CONTRIBUTE</div>
      <div class="prose">
        <p><strong>仓库：</strong> <a href="{{colophon.contribute.repo}}">{{colophon.contribute.repo}}</a></p>
        <p><strong>Issues：</strong> <a href="{{colophon.contribute.issues}}">{{colophon.contribute.issues}}</a></p>
        <p><strong>指南：</strong> {{colophon.contribute.guidelines}}</p>
        <p>{{colophon.contribute.thanks}}</p>
      </div>

      <div class="term-label">// LICENSE</div>
      <dl class="colophon-list">
        <dt>code</dt><dd>{{colophon.license.code}}</dd>
        <dt>content</dt><dd>{{colophon.license.content}}</dd>
        <dt>note</dt><dd>{{colophon.license.note}}</dd>
      </dl>

      <div class="term-label">// ACKNOWLEDGMENTS</div>
      <p class="prose">{{colophon.acknowledgments}}</p>
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

## Build wiring

```javascript
// 14. /colophon/ (conditional)
if (site.colophon) {
  const colophonDir = join(ROOT, 'colophon');
  await mkdir(colophonDir, { recursive: true });
  const colophonHtml = await render.colophon(site);
  await writeIfChanged(join(colophonDir, 'index.html'), colophonHtml);
}
```

## Sitemap addition

Update `buildSitemap` to include `/colophon/` when present:

```javascript
if (site.colophon) {
  urls.push({ loc: `${base}/colophon/`, lastmod: today });
}
```

## Home footer link

Update `templates/home.html` footer paragraph:

```html
<p>© {{year}} lipo · 站点部署于 GitHub Pages · <a href="/search/">搜索</a> · <a href="/colophon/">colophon</a></p>
```

## CSS

```css
/* Colophon page */
.colophon-page { margin-top: 16px; }
.colophon-title {
  font-family: var(--font-heading);
  font-size: var(--text-2xl);
  margin: 0;
}
.colophon-subtitle {
  color: var(--text-muted);
  margin: 4px 0 24px;
}
.colophon-list {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 8px 16px;
  margin: 12px 0 28px;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}
.colophon-list dt {
  color: var(--accent);
  font-weight: 700;
}
.colophon-list dd {
  margin: 0;
  color: var(--text);
}
.colophon-philosophy {
  margin: 12px 0 28px;
}
```

## Tests (4 new, target 96/96)

| # | Test |
|---|---|
| 93 | `render.colophon: produces page with all 5 sections and terminal prompt` |
| 94 | `render.colophon: renders markdown in philosophy and structure fields` |
| 95 | `validateSiteJson: accepts site.colophon as optional object` |
| 96 | `validateSiteJson: rejects colophon with non-string fields` |

## Out of scope (YAGNI)

- Auto build metrics (page count, file sizes, last build time)
- Plausible / analytics integration
- Generated API docs
- Changelog auto-generation (have RSS feed)
- Contribution leaderboard

## Risk notes

- The Markdown in `philosophy` and `structure` could be large. `renderMarkdown` already handles multi-line strings correctly.
- HTML in `philosophyHtml` and `structureHtml` is injected via `{{{ }}}` (triple-brace, raw). Safe because `renderMarkdown` produces already-escaped output from its HTML-escape-first pipeline.
- 4 sections × ~80px each ≈ 320px vertical, fits comfortably above the footer.