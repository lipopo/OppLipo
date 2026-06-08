# Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace v1+'s 3-section homepage (featured big card + main grid + COMING SOON) with a new 3-section homepage (推荐轮播 + 最近更新 + COMING SOON). Remove the main grid. Allow multiple `featured: true` apps. Aggregate `lifecycle.releases[]` across all apps for the "最近更新" feed (top 5 by `releasedAt` desc).

**Architecture:** Drop-in for v1+ templates. `build.mjs` adds a pure `aggregateRecentReleases()` function and four new scope fields (`featuredApps`, `recentReleases`, `hasFeaturedApps`, `hasRecentReleases`) inside `render.home`. `validate()` removes the "at most one featured" check. New `initFeaturedCarousel()` function in `assets/app.js` handles 7s auto-advance, dots, arrows, touch swipe, keyboard nav, hover/focus pause, and `prefers-reduced-motion`. CSS is appended in a single block. No new dependencies; no data model change.

**Tech Stack:** Node 20+ standard library only, plain HTML/CSS, vanilla ES modules, GitHub Pages Actions. Same as v1+.

**Spec:** `docs/superpowers/specs/2026-06-09-homepage-redesign-design.md`
**Skill (will be updated in Task 7):** `.claude/skills/managing-apk-info/SKILL.md`

---

## Conventions carried from v1+

- **Slug regex (authoritative from v1 fix):** `/^[a-z0-9_][a-z0-9_-]*$/` (accepts underscores; kebab-case for new apps).
- **Entry-point guard:** `node build.mjs` is the CLI; tests import the module without running it.
- **Template engine:** supports `{{key}}`, `{{{key}}}` (raw), `{{key.path}}`, `{{#each}}`, `{{#if}}`, `{{#unless}}`, `{{#each key}}` with nested-`{{#if}}` and nested-`{{#each}}` (added in v1+ launch planning). No bracket notation.
- **Public writes (index.html, apps/*/index.html):** idempotent via `writeIfChanged`.
- **Commit style:** short, sentence-case subjects. No conventional-commit prefixes. No `Co-Authored-By`.
- **No `CLAUDE.md` in any commit** (still untracked at repo root; user handles separately).
- **`--private` flag for `roadmap.html`** unchanged.

---

## Task 1: Add `aggregateRecentReleases` pure function (TDD)

**Files:**
- Modify: `tests/build.test.mjs` (add tests)
- Modify: `build.mjs` (add the function and export it)

A pure function in `build.mjs`. For each app, iterate `lifecycle.releases[]` and emit one `RecentRelease` object per release. Sort by `releasedAt` desc, take top N (default 5).

- [ ] **Step 1: Add the failing tests**

Append to `tests/build.test.mjs` (the existing imports from Task 1 cover what's needed):

```javascript
// --- aggregateRecentReleases (Task 1) ---

import { aggregateRecentReleases } from '../build.mjs';

const makeApp = (overrides = {}) => ({
  slug: 'a',
  name: 'A',
  tagline: 't',
  icon: 'apps/a/icon.png',
  platforms: [{ type: 'android', label: 'L', url: 'https://x' }],
  ...overrides,
});

test('aggregateRecentReleases: returns empty array when no apps have releases', () => {
  const out = aggregateRecentReleases([
    makeApp(),
    makeApp({ slug: 'b', name: 'B' }),
  ]);
  assert.deepEqual(out, []);
});

test('aggregateRecentReleases: flattens releases from multiple apps', () => {
  const out = aggregateRecentReleases([
    makeApp({ slug: 'a', name: 'A', lifecycle: { releases: [
      { version: '1.0', releasedAt: '2026-06-01' },
      { version: '1.1', releasedAt: '2026-06-05' },
    ]}}),
    makeApp({ slug: 'b', name: 'B', lifecycle: { releases: [
      { version: '2.0', releasedAt: '2026-06-03' },
    ]}}),
  ]);
  assert.equal(out.length, 3);
  // Order by releasedAt desc
  assert.equal(out[0].version, '1.1');
  assert.equal(out[1].version, '2.0');
  assert.equal(out[2].version, '1.0');
});

test('aggregateRecentReleases: respects limit (default 5)', () => {
  const apps = [];
  for (let i = 0; i < 10; i++) {
    apps.push(makeApp({
      slug: `app-${i}`,
      name: `App ${i}`,
      lifecycle: { releases: [{ version: `1.${i}`, releasedAt: `2026-06-${String(i + 1).padStart(2, '0')}` }] },
    }));
  }
  const out = aggregateRecentReleases(apps);
  assert.equal(out.length, 5);
});

test('aggregateRecentReleases: respects custom limit', () => {
  const apps = [];
  for (let i = 0; i < 10; i++) {
    apps.push(makeApp({
      slug: `app-${i}`,
      name: `App ${i}`,
      lifecycle: { releases: [{ version: `1.${i}`, releasedAt: `2026-06-${String(i + 1).padStart(2, '0')}` }] },
    }));
  }
  const out = aggregateRecentReleases(apps, 2);
  assert.equal(out.length, 2);
});

test('aggregateRecentReleases: skips apps without lifecycle.releases', () => {
  const out = aggregateRecentReleases([
    makeApp(),  // no lifecycle
    makeApp({ slug: 'b', name: 'B', lifecycle: { status: 'in-development' } }),  // no releases
    makeApp({ slug: 'c', name: 'C', lifecycle: { releases: [{ version: '1.0', releasedAt: '2026-06-01' }] } }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].appSlug, 'c');
});

test('aggregateRecentReleases: copies app color/icon/slug/name into each item', () => {
  const out = aggregateRecentReleases([
    makeApp({
      slug: 'cool-app',
      name: 'Cool App',
      color: ['#3b82f6', '#06b6d4'],
      icon: 'apps/cool/icon.png',
      lifecycle: { releases: [{ version: '1.0', releasedAt: '2026-06-01', notes: 'GA' }] },
    }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].appSlug, 'cool-app');
  assert.equal(out[0].appName, 'Cool App');
  assert.deepEqual(out[0].appColor, ['#3b82f6', '#06b6d4']);
  assert.equal(out[0].appIcon, 'apps/cool/icon.png');
  assert.equal(out[0].version, '1.0');
  assert.equal(out[0].releasedAt, '2026-06-01');
  assert.equal(out[0].notes, 'GA');
});

test('aggregateRecentReleases: defaults missing color to slate-gray', () => {
  const out = aggregateRecentReleases([
    makeApp({ lifecycle: { releases: [{ version: '1.0', releasedAt: '2026-06-01' }] } }),
  ]);
  assert.deepEqual(out[0].appColor, ['#94a3b8', '#94a3b8']);
});

test('aggregateRecentReleases: defaults missing notes to empty string', () => {
  const out = aggregateRecentReleases([
    makeApp({ lifecycle: { releases: [{ version: '1.0', releasedAt: '2026-06-01' }] } }),
  ]);
  assert.equal(out[0].notes, '');
});
```

- [ ] **Step 2: Run tests, see them fail**

Run: `npm test`
Expected: 8 new tests fail (because `aggregateRecentReleases` is not exported yet). Existing 31 still pass.

- [ ] **Step 3: Implement `aggregateRecentReleases` in `build.mjs`**

Add this function near the other scope helpers (e.g., just above or below `roadmapScope`):

```javascript
export function aggregateRecentReleases(apps, limit = 5) {
  const items = [];
  for (const app of apps) {
    const releases = app.lifecycle?.releases;
    if (!releases || releases.length === 0) continue;
    for (const r of releases) {
      items.push({
        appSlug: app.slug,
        appName: app.name,
        appColor: app.color ?? ['#94a3b8', '#94a3b8'],
        appIcon: app.icon,
        version: r.version,
        releasedAt: r.releasedAt,
        notes: r.notes ?? '',
        status: app.lifecycle?.status ?? 'launched',
      });
    }
  }
  items.sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
  return items.slice(0, limit);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: 39 pass, 0 fail (31 existing + 8 new).

- [ ] **Step 5: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Add aggregateRecentReleases for recent-updates feed"
```

---

## Task 2: Update `validate()` — remove the "at most one featured" check (TDD)

**Files:**
- Modify: `tests/build.test.mjs` (replace the existing "rejects more than one featured" test with a positive version)
- Modify: `build.mjs` (remove the `if (featuredCount > 1)` block in `validate()`)

- [ ] **Step 1: Replace the existing test**

In `tests/build.test.mjs`, find the test that reads approximately:
```javascript
test('validate: rejects more than one featured', () => {
  const a = { ...baseApp, featured: true };
  const b = { ...baseApp, slug: 'b', featured: true };
  assert.throws(() => validate([a, b]), /only one app can be featured/);
});
```

Replace it with:
```javascript
test('validate: accepts multiple apps with featured: true (v1+ carousel allows any count)', () => {
  const a = { ...baseApp, featured: true };
  const b = { ...baseApp, slug: 'b', featured: true };
  const c = { ...baseApp, slug: 'c', featured: true };
  assert.doesNotThrow(() => validate([a, b, c]));
});
```

- [ ] **Step 2: Run tests, see the new one fail (the old assertion is gone, but the build still throws)**

Run: `npm test`
Expected: the new "accepts multiple featured" test fails because `validate()` still throws on the second `featured: true`. Existing 31 pass.

- [ ] **Step 3: Remove the "at most one featured" check from `build.mjs`**

In `build.mjs`, find this block (near the end of `validate()`, just before the closing `}` of the function):

```javascript
  if (featuredCount > 1) {
    throw new Error(`only one app can be featured, found ${featuredCount}`);
  }
}
```

Delete the entire `if` block. The function still works without it.

Also remove the now-unused `featuredCount` variable (it's no longer read after the `if` is removed). Find:

```javascript
  const slugs = new Set();
  let featuredCount = 0;
```

Replace with:

```javascript
  const slugs = new Set();
```

And remove the `if (app.featured) featuredCount++;` line in the per-app loop. Find:

```javascript
      if (app.featured) featuredCount++;
```

And delete that line.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: 39 pass, 0 fail.

- [ ] **Step 5: Verify the build still works**

Run: `node build.mjs`
Expected: `✓ built 1 app page(s)`.

- [ ] **Step 6: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Allow multiple featured apps; remove at-most-one constraint"
```

---

## Task 3: Add new scope fields to `render.home` (TDD)

**Files:**
- Modify: `tests/build.test.mjs` (add tests for the new scope fields)
- Modify: `build.mjs` (extend `render.home`)

`render.home` already returns scope. We need to add 4 new fields:
- `featuredApps`: `apps.filter(a => a.featured)`
- `recentReleases`: `aggregateRecentReleases(apps)` (default limit 5)
- `hasFeaturedApps`: `featuredApps.length > 0`
- `hasRecentReleases`: `recentReleases.length > 0`

- [ ] **Step 1: Add the failing tests**

Append to `tests/build.test.mjs`:

```javascript
// --- render.home new scope fields (Task 3) ---

test('render.home: exposes featuredApps in scope (filtered by featured=true, in apps.json order)', async () => {
  const html = await render.home([
    { slug: 'a', name: 'A', tagline: 't', icon: 'apps/a/i.png', color: ['#000', '#fff'],
      platforms: [{ type: 'android', label: 'L', url: 'https://x' }], featured: true },
    { slug: 'b', name: 'B', tagline: 't', icon: 'apps/b/i.png', color: ['#000', '#fff'],
      platforms: [{ type: 'android', label: 'L', url: 'https://x' }] },
    { slug: 'c', name: 'C', tagline: 't', icon: 'apps/c/i.png', color: ['#000', '#fff'],
      platforms: [{ type: 'android', label: 'L', url: 'https://x' }], featured: true },
  ]);
  assert.match(html, /data-featured-carousel/);
  assert.match(html, /A/);
  assert.match(html, /C/);
  // B is not featured — should not appear in the carousel
  // (it may appear in the home but not in the [data-featured-carousel] block)
  // We test by checking the carousel contains A and C; exact assertion below.
  // Simpler: extract carousel section and count featured items.
  const carouselMatch = html.match(/<div[^>]*data-featured-carousel[^>]*>([\s\S]*?)<\/div>\s*<!--\s*end-featured-carousel\s*-->/);
  // Fallback regex if comment marker not present:
  const carouselSection = html.match(/<section class="carousel-hero"[\s\S]*?<\/section>/);
  assert.ok(carouselSection, 'should have a .carousel-hero section');
  const section = carouselSection[0];
  // A and C should appear, B should not
  assert.match(section, /A/);
  assert.match(section, /C/);
});

test('render.home: exposes hasFeaturedApps=false when no app is featured', async () => {
  const html = await render.home([
    { slug: 'a', name: 'A', tagline: 't', icon: 'apps/a/i.png',
      platforms: [{ type: 'android', label: 'L', url: 'https://x' }] },
  ]);
  // The {{#if hasFeaturedApps}} wrapper should evaluate false, so no .carousel-hero section.
  assert.doesNotMatch(html, /<section class="carousel-hero"/);
});

test('render.home: exposes recentReleases in scope (aggregated, sorted desc, top 5)', async () => {
  const html = await render.home([
    { slug: 'a', name: 'A', tagline: 't', icon: 'apps/a/i.png',
      platforms: [{ type: 'android', label: 'L', url: 'https://x' }],
      lifecycle: { releases: [
        { version: '1.0', releasedAt: '2026-06-01', notes: 'GA' },
        { version: '1.1', releasedAt: '2026-06-05', notes: 'patch' },
      ]}},
    { slug: 'b', name: 'B', tagline: 't', icon: 'apps/b/i.png',
      platforms: [{ type: 'android', label: 'L', url: 'https://x' }],
      lifecycle: { releases: [
        { version: '2.0', releasedAt: '2026-06-03', notes: 'major' },
      ]}},
  ]);
  // The recent-updates section should be present.
  assert.match(html, /<section class="recent-updates"/);
  // Both apps' names should appear in the recent-updates section.
  const recentSection = html.match(/<section class="recent-updates"[\s\S]*?<\/section>/);
  assert.ok(recentSection);
  assert.match(recentSection[0], /A/);
  assert.match(recentSection[0], /B/);
  // Order: 1.1 (2026-06-05) > 2.0 (2026-06-03) > 1.0 (2026-06-01).
  // Check by string position in the recent-updates section.
  const a11 = recentSection[0].indexOf('1.1');
  const b2 = recentSection[0].indexOf('2.0');
  const a10 = recentSection[0].indexOf('1.0');
  assert.ok(a11 < b2, '1.1 should come before 2.0');
  assert.ok(b2 < a10, '2.0 should come before 1.0');
});

test('render.home: exposes hasRecentReleases=false when no app has any release', async () => {
  const html = await render.home([
    { slug: 'a', name: 'A', tagline: 't', icon: 'apps/a/i.png',
      platforms: [{ type: 'android', label: 'L', url: 'https://x' }] },
  ]);
  // No .recent-updates section.
  assert.doesNotMatch(html, /<section class="recent-updates"/);
});
```

- [ ] **Step 2: Run tests, see them fail**

Run: `npm test`
Expected: 4 new tests fail. The HTML won't contain the new sections. Existing 39 pass.

- [ ] **Step 3: Extend `render.home` to compute the new scope fields**

In `build.mjs`, find the `render.home` function. It currently returns an object with several keys. Find the `return` statement (or the object being returned) and add the 4 new keys.

The current `render.home` looks roughly like:

```javascript
render.home = async function (apps) {
  const tpl = await readFile(join(ROOT, 'templates', 'home.html'), 'utf8');
  const scope = {
    ...appsContext(apps),
    site: { tagline: SITE_TAGLINE },
  };
  scope['site.tagline'] = SITE_TAGLINE;
  return renderTemplate(tpl, scope);
};
```

Replace the entire function body with:

```javascript
render.home = async function (apps) {
  const tpl = await readFile(join(ROOT, 'templates', 'home.html'), 'utf8');
  const featuredApps = apps.filter((a) => a.featured);
  const recentReleases = aggregateRecentReleases(apps);
  const scope = {
    ...appsContext(apps),
    site: { tagline: SITE_TAGLINE },
    featuredApps,
    recentReleases,
    hasFeaturedApps: featuredApps.length > 0,
    hasRecentReleases: recentReleases.length > 0,
  };
  scope['site.tagline'] = SITE_TAGLINE;
  return renderTemplate(tpl, scope);
};
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: 43 pass, 0 fail (39 prior + 4 new).

- [ ] **Step 5: Verify the build still works**

Run: `node build.mjs`
Expected: `✓ built 1 app page(s)`.

- [ ] **Step 6: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Add featuredApps and recentReleases scope fields to render.home"
```

---

## Task 4: Rewrite `templates/home.html` (3 sections, no main grid)

**Files:**
- Modify: `templates/home.html` (full rewrite)

- [ ] **Step 1: Replace the file**

Replace `templates/home.html` entirely with:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>info.opplipo.cn</title>
  <meta name="description" content="{{site.tagline}}">
  <meta property="og:title" content="info.opplipo.cn">
  <meta property="og:description" content="{{site.tagline}}">
  <meta property="og:type" content="website">
  <link rel="stylesheet" href="{{assets.styles}}">
</head>
<body>
  <main class="page">
    <header class="site-header">
      <h1 class="site-title">我的 APP</h1>
      <p class="site-tagline">独立开发，持续更新。</p>
    </header>

    {{#if hasFeaturedApps}}
    <section class="carousel-hero" data-featured-carousel tabindex="0" aria-roledescription="carousel" aria-label="推荐 APP">
      <div class="carousel-hero__track">
        {{#each featuredApps}}
        <article class="carousel-hero__slide" data-slide-index="{{@index}}" aria-roledescription="slide" aria-label="{{name}}">
          <div class="carousel-hero__body">
            <div class="carousel-hero__icon"><img src="{{icon}}" alt="{{name}}"></div>
            <div class="carousel-hero__meta">
              <div class="carousel-hero__cat">
                {{category}}
                {{#if statusBadge}}<span class="status-badge status-badge--{{statusBadgeKey}}">{{statusBadge}}</span>{{/if}}
              </div>
              <h2 class="carousel-hero__name">{{name}}</h2>
              <p class="carousel-hero__tagline">{{tagline}}</p>
              {{#if targetQuarter}}<div class="carousel-hero__expected">预计 {{targetQuarter}} 上线</div>{{/if}}
              {{#if primaryCtaUrl}}<a class="cta cta--primary" href="{{primaryCtaUrl}}">{{primaryCtaLabel}} →</a>{{/if}}
            </div>
          </div>
          <div class="carousel-hero__media">
            {{#if screenshots.0}}
              <img src="{{screenshots.0}}" alt="{{name}} 截图">
            {{else}}
              <img src="{{icon}}" alt="{{name}}" class="carousel-hero__icon-fallback">
            {{/if}}
          </div>
        </article>
        {{/each}}
      </div>
      <button class="carousel-hero__arrow carousel-hero__arrow--prev" aria-label="上一张" type="button">‹</button>
      <button class="carousel-hero__arrow carousel-hero__arrow--next" aria-label="下一张" type="button">›</button>
      <div class="carousel-hero__dots" role="tablist" aria-label="选择幻灯片">
        {{#each featuredApps}}
        <button class="carousel-hero__dot{{#if @index=0}} carousel-hero__dot--active{{/if}}" role="tab" data-dot-index="{{@index}}" aria-label="幻灯片 {{@index}}"></button>
        {{/each}}
      </div>
    </section>
    {{/if}}

    {{#if hasRecentReleases}}
    <section class="recent-updates">
      <div class="block__label">📋 最近更新 · RECENT UPDATES</div>
      <div class="recent-updates__grid">
        {{#each recentReleases}}
        <a class="release-card" href="/apps/{{appSlug}}/">
          <div class="release-card__head">
            <span class="release-card__icon" style="--c1:{{appColor.0}}; --c2:{{appColor.1}};"></span>
            <span class="release-card__name">{{appName}}</span>
            <span class="release-card__version">v{{version}}</span>
          </div>
          {{#if notes}}<div class="release-card__notes">{{notes}}</div>{{/if}}
          <div class="release-card__date">{{releasedAt}}</div>
        </a>
        {{/each}}
      </div>
    </section>
    {{/if}}

    {{#if hasComingSoon}}
    <section class="coming-soon">
      <div class="block__label">即将上线 · COMING SOON</div>
      <div class="coming-soon__grid">
        {{#each apps}}
          {{#if statusIsInDevOrIdea}}
            <a class="card card--small" href="{{url}}">
              <div class="card__icon"><img src="{{icon}}" alt="{{name}}"></div>
              <div class="card__body">
                <div class="card__name">{{name}}</div>
                <div class="card__category">{{category}}</div>
                <div class="coming-soon__when">目标 {{#if targetQuarter}}{{targetQuarter}}{{/if}}{{#unless targetQuarter}}TBD{{/unless}}</div>
                <p class="card__tagline">{{tagline}}</p>
              </div>
            </a>
          {{/if}}
        {{/each}}
      </div>
    </section>
    {{/if}}

    <footer class="site-footer">
      <p>© lipo · 站点部署于 GitHub Pages</p>
    </footer>
  </main>
  <script type="module" src="{{assets.app}}"></script>
</body>
</html>
```

- [ ] **Step 2: Verify the build works**

Run: `node build.mjs`
Expected: `✓ built 1 app page(s)`. The build will succeed but `index.html` will be malformed (CSS for the new classes doesn't exist yet, so the layout will be broken). The HTML output should still have NO `{{...}}` placeholders.

Run: `grep -c "{{" index.html`
Expected: `0`.

- [ ] **Step 3: Commit**

```bash
git add templates/home.html
git commit -m "Rewrite home.html: featured carousel + recent updates + COMING SOON"
```

---

## Task 5: Append CSS for carousel, recent-updates, mobile responsive

**Files:**
- Modify: `assets/styles.css` (append ~120 lines)

- [ ] **Step 1: Append the new CSS to `assets/styles.css`**

```css
/* Featured carousel (homepage hero) */
.carousel-hero {
  position: relative;
  overflow: hidden;
  border-radius: 14px;
  outline: none;
  margin-bottom: 28px;
}
.carousel-hero:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
.carousel-hero__track {
  display: flex;
  transition: transform 200ms ease, opacity 200ms ease;
}
.carousel-hero__track--no-anim { transition: none; }
.carousel-hero__slide {
  min-width: 100%;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 1fr 40%;
  gap: 20px;
  align-items: center;
  background: linear-gradient(135deg, var(--c1, #fbbf24) 0%, var(--c2, #f472b6) 100%);
  border-radius: 14px;
  padding: 28px;
  color: #1f2937;
  min-height: 220px;
}
.carousel-hero__body {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.carousel-hero__icon img {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  flex: 0 0 64px;
}
.carousel-hero__meta { min-width: 0; flex: 1; }
.carousel-hero__cat {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #a16207;
  text-transform: uppercase;
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.carousel-hero__name {
  font-size: 22px;
  font-weight: 700;
  margin: 4px 0 4px;
  line-height: 1.2;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.carousel-hero__tagline {
  font-size: 13px;
  color: #374151;
  margin: 0 0 10px;
  line-height: 1.4;
}
.carousel-hero__expected {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  color: #c2410c;
  background: rgba(255, 255, 255, 0.7);
  padding: 2px 8px;
  border-radius: 99px;
  margin-bottom: 10px;
  letter-spacing: 0.3px;
}
.carousel-hero__media {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 9 / 19.5;
  max-height: 220px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  overflow: hidden;
}
.carousel-hero__media img {
  width: 92%;
  height: 92%;
  object-fit: cover;
  border-radius: 8px;
}
.carousel-hero__media img.carousel-hero__icon-fallback {
  width: 50%;
  height: auto;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.carousel-hero__arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  color: #1f2937;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: background 0.15s ease;
}
.carousel-hero__arrow:hover { background: #fff; }
.carousel-hero__arrow--prev { left: 12px; }
.carousel-hero__arrow--next { right: 12px; }
.carousel-hero__dots {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
}
.carousel-hero__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  border: 0;
  padding: 0;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}
.carousel-hero__dot--active {
  background: #fff;
  transform: scale(1.4);
}

/* Recent updates grid */
.recent-updates {
  margin-top: 28px;
}
.recent-updates__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 12px;
}
.release-card {
  display: block;
  background: var(--surface);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  color: #1f2937;
  text-decoration: none;
  transition: transform 0.15s ease;
}
.release-card:hover { transform: translateY(-2px); }
.release-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.release-card__icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: linear-gradient(135deg, var(--c1, #94a3b8) 0%, var(--c2, #94a3b8) 100%);
  flex: 0 0 24px;
}
.release-card__name {
  font-weight: 600;
  font-size: 13px;
  color: #1f2937;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.release-card__version {
  font-family: ui-monospace, monospace;
  font-size: 10px;
  color: #6b7280;
}
.release-card__notes {
  font-size: 11px;
  color: #374151;
  margin: 2px 0 4px 32px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.release-card__date {
  font-size: 10px;
  color: #9ca3af;
  font-family: ui-monospace, monospace;
  margin-left: 32px;
}

/* Mobile responsive (car + recent) */
@media (max-width: 640px) {
  .carousel-hero__slide {
    grid-template-columns: 1fr;
    padding: 18px;
    min-height: 0;
  }
  .carousel-hero__media {
    order: -1;
    aspect-ratio: 16 / 9;
    max-height: 140px;
  }
  .carousel-hero__arrow { display: none; }
  .recent-updates__grid { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .carousel-hero__track { transition: none; }
  .carousel-hero__arrow, .carousel-hero__dot { transition: none; }
}
```

- [ ] **Step 2: Verify the build still works and the new CSS loads**

Run: `node build.mjs`
Expected: no errors.

Run: `wc -l assets/styles.css`
Expected: 343 + 175 ≈ 518 lines.

- [ ] **Step 3: Commit**

```bash
git add assets/styles.css
git commit -m "Style featured carousel and recent-updates grid"
```

---

## Task 6: Add `initFeaturedCarousel` to `assets/app.js`

**Files:**
- Modify: `assets/app.js` (add a new function and call it on boot)

- [ ] **Step 1: Add the new function**

In `assets/app.js`, find the boot block at the bottom:

```javascript
// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initCarousels();
    initLightbox();
  });
} else {
  initCarousels();
  initLightbox();
}
```

Add a new function `initFeaturedCarousel` ABOVE the boot block, and call it in the boot block BEFORE `initCarousels` and `initLightbox`.

Add the new function (insert ABOVE the `// Boot` comment):

```javascript
// Featured carousel (homepage hero)
function initFeaturedCarousel() {
  document.querySelectorAll('[data-featured-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('.carousel-hero__track');
    const slides = carousel.querySelectorAll('.carousel-hero__slide');
    const dots = carousel.querySelectorAll('.carousel-hero__dot');
    const prev = carousel.querySelector('.carousel-hero__arrow--prev');
    const next = carousel.querySelector('.carousel-hero__arrow--next');
    if (slides.length === 0) return;

    let index = 0;
    let timer = null;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function go(i) {
      index = (i + slides.length) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((d, di) => d.classList.toggle('carousel-hero__dot--active', di === index));
    }
    function tick() { go(index + 1); }
    function start() { if (reduced || slides.length < 2) return; stop(); timer = setInterval(tick, 7000); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    // Pause on hover/focus
    carousel.addEventListener('mouseenter', stop);
    carousel.addEventListener('mouseleave', start);
    carousel.addEventListener('focusin', stop);
    carousel.addEventListener('focusout', start);

    // Pause when tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else start();
    });

    // Manual controls
    if (prev) prev.addEventListener('click', () => { go(index - 1); start(); });
    if (next) next.addEventListener('click', () => { go(index + 1); start(); });
    dots.forEach((dot, di) => {
      dot.addEventListener('click', () => { go(di); start(); });
    });

    // Keyboard nav when carousel is focused
    carousel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { go(index - 1); start(); }
      else if (e.key === 'ArrowRight') { go(index + 1); start(); }
    });

    // Touch swipe
    let touchStartX = 0;
    let touchStartY = 0;
    carousel.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      stop();
    }, { passive: true });
    carousel.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        go(index + (dx < 0 ? 1 : -1));
      }
      start();
    }, { passive: true });

    // Init
    go(0);
    start();
  });
}
```

Then update the boot block to call the new function:

```javascript
// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initFeaturedCarousel();
    initCarousels();
    initLightbox();
  });
} else {
  initFeaturedCarousel();
  initCarousels();
  initLightbox();
}
```

- [ ] **Step 2: Verify the build still works**

Run: `node build.mjs`
Expected: no errors. The JS is not executed by the build, but the build should still produce valid HTML.

- [ ] **Step 3: Commit**

```bash
git add assets/app.js
git commit -m "Add initFeaturedCarousel with auto-advance, swipe, keyboard, prefers-reduced-motion"
```

---

## Task 7: Update the `managing-apk-info` skill

**Files:**
- Modify: `.claude/skills/managing-apk-info/SKILL.md`

- [ ] **Step 1: Update the `featured` field description in the cheat sheet**

Find the line:
```markdown
| `featured` | boolean? | `true` = the big hero card on the homepage. **At most one** app at a time. |
```

Replace with:
```markdown
| `featured` | boolean? | `true` = included in the homepage **featured carousel** (rotates one card at a time). **Any number** of apps can be featured simultaneously. Carousel order = `apps.json` array order. |
```

- [ ] **Step 2: Remove the "Adding a second featured" mistake**

Find this in the "Common mistakes" section:
```markdown
- **Adding a second `featured: true`** — build fails with `only one app can be featured, found 2`. Either demote the existing one or omit `featured` from the new one.
```

Delete that bullet (it's no longer true; the v1+ launch removed the constraint).

- [ ] **Step 3: Add a "Homepage carousel & recent updates" section**

After the "Lifecycle planning" section, add a new section:

````markdown
## Homepage carousel & recent updates

The homepage has three sections, in order:
1. **Featured carousel** — one card at a time, auto-advances every 7s. Manual controls: arrows, dots, touch swipe, keyboard ← / → (when focused). Pause on hover/focus/tab-hidden. Respects `prefers-reduced-motion`.
2. **Recent updates** — top 5 `lifecycle.releases[]` entries across ALL apps, sorted by `releasedAt` desc. Each release shows the app name + version + a 1-line notes + the release date.
3. **COMING SOON** — apps with `lifecycle.status: "idea"` or `"in-development"`, with target quarter (Q3 2026-style) shown.

### Featured carousel: how to manage

- To add an app to the carousel: set `"featured": true` on that app's entry in `apps.json`.
- To remove: change to `"featured": false` (or omit the field).
- To reorder: change the order in the `apps.json` array (the carousel shows featured apps in array order).
- **Any number** of apps can have `featured: true`. The v1 constraint of "at most one" is gone.
- Apps with no `screenshots[]`: the carousel falls back to using the app's `icon` (square aspect).

### Recent updates: how it works

- Auto-aggregated from `lifecycle.releases[]` across all apps in `apps.json`.
- No new data, no config, no manual curation. The build script picks the 5 most recent releases.
- To feature a specific release, prepend it to the array (`releases[0]` is the latest). The build sorts by `releasedAt` desc and takes the top 5.
- To remove a release from the recent-updates feed, delete it from `lifecycle.releases[]`.
````

- [ ] **Step 4: Verify the file is well-formed**

Run: `head -20 .claude/skills/managing-apk-info/SKILL.md`
Expected: opening paragraph still mentions "private roadmap view" from v1+.

Run: `wc -w .claude/skills/managing-apk-info/SKILL.md`
Expected: ~2300 words (up from 1941).

Run: `grep -n "## Homepage carousel" .claude/skills/managing-apk-info/SKILL.md`
Expected: a line number (new section present).

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/managing-apk-info/SKILL.md
git commit -m "Update skill: featured carousel, recent updates, drop at-most-one rule"
```

---

## Task 8: Set `_sample.featured = true` to demo the carousel

**Files:**
- Modify: `apps.json` (one-line change: add `"featured": true` to the `_sample` object)

- [ ] **Step 1: Update `_sample` in `apps.json`**

Read `apps.json` to find the exact line. Add `"featured": true,` to the `_sample` object. Place it just after `"category": "示例",` (or wherever feels natural — the field is alphabetical-ish, so put it between `description` and `highlights`, or after `category` — either is fine).

After the change, the `_sample` object should include `"featured": true,` somewhere.

- [ ] **Step 2: Run the build and verify the carousel appears**

Run: `node build.mjs`
Expected: `✓ built 1 app page(s)`.

Run: `head -30 index.html`
Expected: the carousel-hero section appears. Look for `<section class="carousel-hero"` somewhere near the top (after the header, before the recent-updates section).

Run: `grep -c "{{" index.html`
Expected: `0`.

- [ ] **Step 3: Commit**

```bash
git add apps.json
git commit -m "Set _sample featured: true to demo the new carousel"
```

---

## Task 9: Local smoke test

**Files:** none (verification only)

- [ ] **Step 1: Clean + rebuild from scratch**

Run:
```bash
rm -f index.html
rm -rf apps/_sample/index.html
node build.mjs
node build.mjs --private
```

Expected: both runs print success lines; `index.html`, `apps/_sample/index.html`, and `roadmap.html` exist.

- [ ] **Step 2: Run the test suite**

Run: `npm test`
Expected: 43 pass, 0 fail.

- [ ] **Step 3: Verify the homepage structure**

Run: `grep -E "(carousel-hero|recent-updates|coming-soon)" index.html | head -10`
Expected: at least one match per section. Three sections present.

Run: `grep -E "(data-featured-carousel|carousel-hero__track|carousel-hero__dot)" index.html | head -3`
Expected: the carousel DOM markers are present.

- [ ] **Step 4: Verify the carousel item count and content**

Run: `grep -c "carousel-hero__slide" index.html`
Expected: `1` (one slide per `class="carousel-hero__slide"`).

- [ ] **Step 5: Verify the recent-updates section is correctly hidden (no `lifecycle.releases` in `_sample`)**

Run: `grep -E "recent-updates" index.html || echo "no recent-updates section (expected — _sample has no releases)"`
Expected: prints `no recent-updates section (expected — _sample has no releases)`.

- [ ] **Step 6: Verify the COMING SOON section is still present**

Run: `grep -E "coming-soon" index.html | head -3`
Expected: at least one match. The `_sample` is `in-development`, so it should appear in the COMING SOON section.

- [ ] **Step 7: Verify the private build doesn't leak**

Run: `grep -E "(\u672c\u6761\u76ee|board.conf|private\\.)" index.html apps/_sample/index.html || echo "no private content in public output"`
Expected: `no private content in public output` (since `lifecycle` is now public, the public data still doesn't include the `private` block).

- [ ] **Step 8: Verify the static server serves all three URLs**

Run: `python3 -m http.server 4000 &` (background it)
Save the PID: `echo $!`
sleep 1

Run: `curl -sI http://localhost:4000/ | head -1`
Expected: `HTTP/1.0 200 OK`.

Run: `curl -sI http://localhost:4000/apps/_sample/ | head -1`
Expected: `HTTP/1.0 200 OK`.

Stop the server: `kill <PID>`

- [ ] **Step 9: Visual check via curl (manual)**

Run: `curl -s http://localhost:4000/ | grep -E "(carousel-hero|carousel-hero__slide|carousel-hero__dot|carousel-hero__name|carousel-hero__tagline)" | head -10`
Expected: at least 3 matches (the carousel section, the slide, the name, the tagline, the dot).

- [ ] **Step 10: Clean up**

Run: `rm -f roadmap.html index.html && rm -rf apps/_sample/index.html && node build.mjs && node build.mjs --private`
Expected: rebuilds the public and private outputs (so the repo state is clean for the deploy step).

- [ ] **Step 11: No commit — verification only**

If anything is broken, fix and commit. Otherwise, proceed to Task 10.

---

## Task 10: Deploy — push, watch Actions, verify live

**Files:** none (deployment only)

- [ ] **Step 1: Commit the build outputs and push to origin**

```bash
git add index.html apps/_sample/index.html
git commit -m "Build public site artifacts (homepage carousel + recent updates)"
git push origin main
```

If the push fails due to authentication, network, or remote-rejection: STOP and report.

- [ ] **Step 2: Watch the Actions run**

The `tea` CLI is configured for a Gitea instance (not GitHub). Use the GitHub public REST API:

```bash
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  STATUS=$(curl -s https://api.github.com/repos/lipopo/OppLipo/actions/runs?per_page=1 | python3 -c "import json,sys; d=json.load(sys.stdin); r=d['workflow_runs'][0]; print(r['status'] + '/' + (r['conclusion'] or 'pending'))" 2>/dev/null)
  echo "[$i] $STATUS"
  if [[ "$STATUS" == completed/* ]]; then break; fi
  sleep 10
done
```

Wait up to ~3 minutes for the build+deploy to complete.

- [ ] **Step 3: Verify the live site shows the new homepage**

Run: `curl -sI https://info.opplipo.cn/ | head -1`
Expected: `HTTP/2 200`.

Run: `curl -s https://info.opplipo.cn/ | grep -E "(carousel-hero|recent-updates|coming-soon)" | head -5`
Expected: at least 3 matches (all three sections present in the live HTML).

Run: `curl -s https://info.opplipo.cn/ | grep "carousel-hero__slide" | wc -l`
Expected: `1` (one slide, since only `_sample` is `featured: true`).

- [ ] **Step 4: Verify HTTPS is still enforced**

Run: `curl -sI http://info.opplipo.cn/ | head -3`
Expected: `HTTP/1.1 301` (or `308`) redirecting to `https://`.

- [ ] **Step 5: Done**

The homepage redesign is live at `https://info.opplipo.cn/`. The featured carousel rotates `_sample` (with the "In development" badge and "加入内测" CTA). The COMING SOON section is preserved. The recent-updates section is hidden (no app has any `lifecycle.releases[]` yet — visible once a real app is added with releases).

---

## Self-Review

**Spec coverage:**

| Spec section | Implemented in |
|---|---|
| §1 Purpose | All tasks |
| §2 Audience | All tasks (no changes to the audience) |
| §3 Site structure | Tasks 2, 3, 4, 5, 6, 7, 8 |
| §4.1 New scope fields | Task 3 (render.home changes) + Task 1 (aggregateRecentReleases) |
| §4.2 内部函数 | Task 1 (aggregateRecentReleases) |
| §4.3 模板引擎要求 | No changes (engine already supports the needed syntax from v1+) |
| §4.4 零新依赖 | All tasks (no new deps) |
| §5 Data schema | Task 2 (drop at-most-one check) |
| §6.1 首页结构 | Task 4 (home.html rewrite) |
| §6.2 推荐轮播 | Tasks 3, 4, 5, 6, 8 |
| §6.3 最近更新 | Tasks 1, 3, 4, 5, 8 |
| §6.4 COMING SOON | Preserved (no changes in Task 4) |
| §6.5 全部为空 | Task 4 (gated by `{{#if hasFeaturedApps}}` and `{{#if hasRecentReleases}}`) |
| §7 CI/deployment | Task 10 (no workflow changes) |
| §8 工作流 | Documented in Task 7 (skill update) |
| §9 Skill 更新 | Task 7 |
| §10 验收标准 | Tasks 9, 10 (each criterion verified end-to-end) |
| §11 范围与未来 | Tasks 1-10 (only the v1+ scope is implemented) |
| §12 开放问题 | All 6 questions resolved in the design (no open questions) |

**Placeholder scan:** No `TBD` / `TODO` / `FIXME` / `XXX` in the plan. Every code block is complete. Every command has expected output.

**Type/name consistency:**

- `aggregateRecentReleases(apps, limit = 5)` exported from `build.mjs` — used in `render.home` and in tests.
- `featuredApps`, `recentReleases`, `hasFeaturedApps`, `hasRecentReleases` scope fields match between `render.home` (Task 3) and template references (Task 4).
- The inline-class pattern `class="carousel-hero__dot{{#if @index=0}} carousel-hero__dot--active{{/if}}"` works correctly with the v1+ engine: the engine's `applyIf` regex captures the body between `{{#if X}}` and `{{/if}}` and emits it only when X is truthy. So the dot template produces `class="carousel-hero__dot"` (not active) or `class="carousel-hero__dot carousel-hero__dot--active"` (active) — correct.
- `initFeaturedCarousel()` function name — used in `app.js` boot block and declared in the same file. No conflict with `initCarousels` (screenshot gallery, which iterates `[data-carousel]`, while `initFeaturedCarousel` iterates `[data-featured-carousel]`).
- CSS class names (`.carousel-hero`, `.carousel-hero__track`, `.carousel-hero__slide`, `.carousel-hero__body`, `.carousel-hero__media`, `.carousel-hero__arrow`, `.carousel-hero__dots`, `.carousel-hero__dot`, `.carousel-hero__name`, `.carousel-hero__tagline`, `.carousel-hero__expected`, `.recent-updates`, `.recent-updates__grid`, `.release-card`, `.release-card__head`, `.release-card__icon`, `.release-card__name`, `.release-card__version`, `.release-card__notes`, `.release-card__date`) — match between CSS (Task 5) and template (Task 4).
- Data attribute `data-featured-carousel` matches between template (Task 4) and JS selector (Task 6).

**Test count after plan:** 31 (existing v1+) + 8 (Task 1) + 0 (Task 2 replaces 1 test) + 4 (Task 3) = **43 tests, all expected to pass**.
