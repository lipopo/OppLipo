# RSS Feed (Atom) — Design Spec

**Date:** 2026-06-11
**Status:** Draft (pending user review)
**Owner:** lipo

## Goal

Add an Atom 1.0 RSS feed at `/feed.xml` so visitors can subscribe to all site changes (thoughts, app releases, now-page updates, uses-page updates). All page templates gain an autodiscovery `<link rel="alternate">` so feed readers can find it.

## Constraints

- Static site, GitHub Pages, no runtime backend
- Zero npm dependencies (Node stdlib only)
- Existing 81 tests must keep passing
- Atom 1.0 format (covers 99% of feed readers)

## Format: Atom 1.0

`/feed.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>info.opplipo.cn</title>
  <link href="https://info.opplipo.cn/" />
  <link rel="self" href="https://info.opplipo.cn/feed.xml" />
  <id>https://info.opplipo.cn/</id>
  <updated>2026-06-11T00:00:00Z</updated>

  <entry>
    <title>示例：Markdown 渲染管线</title>
    <link href="https://info.opplipo.cn/thoughts/dev--sample-thought/" />
    <id>https://info.opplipo.cn/thoughts/dev--sample-thought/</id>
    <updated>2026-06-10T00:00:00Z</updated>
    <content type="html"><![CDATA[<p>...</p>]]></content>
  </entry>

  <entry>
    <title>LiteTerm v0.2.0</title>
    ...
  </entry>
  ...
</feed>
```

`<updated>` at the feed level is the most recent item's timestamp (RFC 3339).

## Data model extension

### `site.json` additions

```json
{
  "now": {
    "text": "...",
    "lastModified": "2026-06-11"
  },
  "uses": {
    "lastModified": "2026-06-11",
    "categories": [ ... ]
  }
}
```

`lastModified` is `YYYY-MM-DD`. Optional — if absent, the now/uses change entry is skipped.

### Validation

`validateSiteJson` rejects:

- `now.lastModified` present but not matching `YYYY-MM-DD`
- `uses.lastModified` present but not matching `YYYY-MM-DD`

Existing validations unchanged.

## Build functions

### `buildAtomFeed(publicApps, site, thoughts)`

Returns:

```javascript
{
  feedUpdated: '2026-06-11T00:00:00Z',
  items: [
    {
      title: '...',
      url: 'https://info.opplipo.cn/...',
      id: 'https://info.opplipo.cn/...',
      updated: '2026-06-11T00:00:00Z',
      contentHtml: '<p>...</p>'
    }
  ]
}
```

Items are sorted by `updated` descending (most recent first).

Item sources:

1. **Thoughts** — one entry per thought. `title`, `url`, `id` derived from slug. `updated` = `<date>T00:00:00Z` from frontmatter.
2. **App releases** — one entry per `app.lifecycle.releases[]` item. `title` = `<app-name> v<version>`. `url` = app page, `id` = `<url>#v<version>`. `updated` = `<releasedAt>T00:00:00Z`. `contentHtml` = `renderMarkdown(release.notes ?? '')`.
3. **Now update** — if `site.now.lastModified` is set: `title` = `现在 更新`. `url` = `/now/`, `id` = `<url>#<lastModified>`. `contentHtml` = `renderMarkdown(site.now.text)`.
4. **Uses update** — if `site.uses.lastModified` is set: `title` = `使用 更新`. `url` = `/uses/`, `id` = `<url>#<lastModified>`. `contentHtml` = synthesized markdown from categories: `## <name>\n- <item>: <notes>\n- ...`.

If `site.now.text` is set but `site.now.lastModified` is absent, no now-update entry is emitted (silent skip, no error).

### `renderAtomXml(feed)`

Returns the XML string. Helper for escaping:

```javascript
function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

Used for `title`, `link href`, `id`. Content body goes inside `<![CDATA[...]]>` so markup passes through unchanged.

### `writeOutputs` extension

After the search index emission:

```javascript
// 10. /feed.xml (Atom)
const feed = buildAtomFeed(publicApps, site, thoughts);
const feedXml = renderAtomXml(feed);
await writeIfChanged(join(ROOT, 'feed.xml'), feedXml);
```

## Autodiscovery in templates

Every page template's `<head>` block gains:

```html
<link rel="alternate" type="application/atom+xml" href="/feed.xml" title="info.opplipo.cn">
```

This goes after `<link rel="stylesheet">` in each template. Templates touched:

- `templates/home.html`
- `templates/app.html`
- `templates/about.html`
- `templates/thought.html`
- `templates/thoughts-index.html`
- `templates/collection.html`
- `templates/collections-index.html`
- `templates/now.html`
- `templates/uses.html`
- `templates/search.html`

## Tests (6 new, target 87/87)

| # | Test |
|---|---|
| 82 | `buildAtomFeed: includes thoughts sorted by date desc` |
| 83 | `buildAtomFeed: includes app releases with version in title` |
| 84 | `buildAtomFeed: includes now and uses when lastModified is set` |
| 85 | `renderAtomXml: produces valid Atom 1.0 XML with required elements` |
| 86 | `renderAtomXml: escapes special chars in titles and URLs` |
| 87 | `validateSiteJson: rejects invalid now.lastModified format` |

## Out of scope (YAGNI)

- RSS 2.0 / JSON Feed (Atom covers it)
- Per-section feeds (e.g., separate thoughts-only feed)
- WebSub / PubSubHubbub push notifications
- Excerpt vs full content (we ship full)
- Auto `lastModified` from git commit time
- feed.xml schema validation against the full Atom 1.0 spec (we trust our own output)

## Risk notes

- The 10-template `<head>` edit is tedious but mechanical; each template gets exactly one new line.
- `<content>` HTML is wrapped in `<![CDATA[...]]>` so user-authored markdown (which is itself safe per `renderMarkdown`'s HTML-escape-first pipeline) cannot break XML parsing.
- `feed.xml` is generated every build; size depends on item count, currently ~3-10 entries × 1-2KB = small.