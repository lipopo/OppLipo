# Open Graph & Twitter Card Metadata — Design Spec

**Date:** 2026-06-12
**Status:** Draft (pending user review)
**Owner:** lipo

## Goal

Add Open Graph + Twitter Card metadata to all content pages so shared links have rich previews on social platforms.

## Constraints

- Static site, GitHub Pages, no runtime backend
- Zero npm dependencies
- Existing 107 tests must keep passing
- Terminal brutalist aesthetic preserved

## Assets

`assets/og-default.png` — single 1200×630 PNG. Solid near-black background with green terminal text "info.opplipo.cn". Generated once at repo setup, committed, never rebuilt at runtime.

## Build helper

```javascript
function ogMetaTags({ title, description, url, type = 'website' }) {
  const base = 'https://info.opplipo.cn';
  const img = `${base}/assets/og-default.png`;
  return [
    `<meta property="og:title" content="${escHtml(title)}">`,
    `<meta property="og:description" content="${escHtml(description ?? '')}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:site_name" content="info.opplipo.cn">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escHtml(title)}">`,
    `<meta name="twitter:description" content="${escHtml(description ?? '')}">`,
    `<meta name="twitter:image" content="${img}">`,
  ].join('\n  ');
}
```

Each `render.*` function adds a field `ogMetaTags` to the scope, pre-computed at build time.

## Per-page mapping

| Route | og:title | og:description | og:type |
|---|---|---|---|
| `/` | `我的 APP \| info.opplipo.cn` | `site.tagline` | `website` |
| `/about/` | `{{author.name}} \| info.opplipo.cn` | `{{author.tagline}}` | `profile` |
| `/thoughts/<slug>/` | `{{title}} \| info.opplipo.cn` | `{{excerpt}}` | `article` |
| `/thoughts/` | `想法 \| info.opplipo.cn` | `开发笔记与思考` | `website` |
| `/apps/<slug>/` | `{{name}} \| info.opplipo.cn` | `{{tagline}}` | `website` |
| `/collections/` | `精选 \| info.opplipo.cn` | `按主题/质量分组的应用合集` | `website` |
| `/collections/<slug>/` | `{{title}} \| info.opplipo.cn` | `{{description}}` | `website` |
| `/now/` | `现在 \| info.opplipo.cn` | `现在 · {{updatedAt}}` | `website` |
| `/uses/` | `使用 \| info.opplipo.cn` | `{{itemCount}} 件装备` | `website` |
| `/search/` | `搜索 \| info.opplipo.cn` | `站内搜索` | `website` |
| `/colophon/` | `colophon \| info.opplipo.cn` | `本站是如何构建的` | `website` |
| `/changelog/` | `changelog \| info.opplipo.cn` | `{{releases.length}} 条发布` | `website` |
| `/archive/` | `archive \| info.opplipo.cn` | `所有 thoughts 的扁平时间线` | `website` |
| `/404.html` | `404 \| info.opplipo.cn` | (空) | `website` |

## Template

Each template's `<head>` block gets a `{{{ogMetaTags}}}` line (raw HTML, since the helper returns pre-escaped strings — `escHtml` was called inside).

```html
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{title}} | info.opplipo.cn</title>
  <meta name="description" content="{{description}}">
  <link rel="stylesheet" href="{{assets.styles}}">
  <link rel="alternate" type="application/atom+xml" href="/feed.xml" title="info.opplipo.cn">
  {{{ogMetaTags}}}
</head>
```

`templates/home.html` already has 3 og meta tags. Replace with `{{{ogMetaTags}}}`.

## Tests (2 new, target 109/109)

| # | Test |
|---|---|
| 108 | `ogMetaTags: produces expected meta tags with title and description` |
| 109 | `ogMetaTags: escapes special chars in title` |

## Out of scope (YAGNI)

- Per-thought dynamic OG image (would require image-generation library)
- og:locale / og:locale:alternate
- Twitter summary card (small) variant
- WeChat-specific tags

## Risk notes

- `escHtml` is called inside `ogMetaTags` on title and description. URL and image are URLs (not escaped — but URL fields are constructed by us, never from user input).
- `og:image` is a single 1200×630 PNG committed to the repo. If it ever needs regenerating, do it manually.
- The home page template currently has 3 hand-written og:title / og:description / og:type lines. Replacing with `{{{ogMetaTags}}}` removes them and adds the 7 missing fields (url, image, site_name, twitter:card, twitter:title, twitter:description, twitter:image).