# `info.opplipo.cn` v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1 of `https://info.opplipo.cn/` — a data-driven multi-APP showcase site with one featured app, other apps as small cards, per-app detail pages, screenshots carousel, and download links, deployed via GitHub Pages Actions.

**Architecture:** Single source of truth `apps.json` (data) + `build.mjs` (Node 20+ standard library only, no npm deps) reads `templates/*.html`, performs simple `{{key}}` and `{{#each}}` placeholder substitution, and writes generated `index.html` + `apps/<slug>/index.html`. GitHub Actions runs the build on push to `main` and deploys via `actions/deploy-pages@v4`.

**Tech Stack:** Node 20+ (built-in test runner `node --test`, no deps), HTML/CSS/Vanilla ES modules, GitHub Pages, `actions/deploy-pages@v4`.

**Spec:** `docs/superpowers/specs/2026-06-06-opplipo-info-design.md`

---

## File Structure (created by this plan)

```
/
├── CNAME                                      exists, untouched
├── .gitignore                                 exists, untouched
├── .nojekyll                                  CREATE (empty)
├── package.json                               CREATE
├── apps.json                                  CREATE (sample data)
├── build.mjs                                  CREATE
├── tests/
│   └── build.test.mjs                         CREATE
├── templates/
│   ├── home.html                              CREATE
│   └── app.html                               CREATE
├── assets/
│   ├── styles.css                             CREATE
│   ├── app.js                                 CREATE
│   └── platforms/                             CREATE
│       ├── android.svg
│       ├── ios.svg
│       ├── macos.svg
│       ├── windows.svg
│       ├── linux.svg
│       └── web.svg
├── apps/
│   └── _sample/                               CREATE (sample app, replace later)
│       ├── icon.svg                           (placeholder, easy to inspect in diff)
│       └── screenshots/
│           ├── 1.svg
│           ├── 2.svg
│           └── 3.svg
├── .github/
│   └── workflows/
│       └── pages.yml                          CREATE
└── README.md                                  REWRITE (currently UTF-16 BOM; rewrite as UTF-8)
```

Untouched existing files: `CNAME`, `CLAUDE.md` (still untracked from earlier; user handles separately).

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `.nojekyll`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "info-opplipo-cn",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Data-driven APP showcase for info.opplipo.cn",
  "scripts": {
    "build": "node build.mjs",
    "test": "node --test tests/",
    "serve": "python3 -m http.server 4000"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create empty `.nojekyll`**

Run: `touch .nojekyll`
Verify: `ls -la .nojekyll` shows a 0-byte file.

- [ ] **Step 3: Verify Node version**

Run: `node --version`
Expected: `v20.x.x` or higher. If lower, install Node 20+ before continuing.

- [ ] **Step 4: Commit**

```bash
git add package.json .nojekyll
git commit -m "Scaffold project with package.json and .nojekyll"
```

---

## Task 2: Sample data

**Files:**
- Create: `apps.json`
- Create: `apps/_sample/icon.svg`
- Create: `apps/_sample/screenshots/1.svg`
- Create: `apps/_sample/screenshots/2.svg`
- Create: `apps/_sample/screenshots/3.svg`

Note: using `.svg` placeholders (not PNG) for the sample app so this plan stays text-only and the diff is reviewable. The real first app can use PNG/WebP.

- [ ] **Step 1: Create sample icon**

Create `apps/_sample/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#f472b6"/>
    </linearGradient>
  </defs>
  <rect width="192" height="192" rx="42" fill="url(#g)"/>
  <text x="96" y="120" text-anchor="middle" font-family="system-ui,sans-serif" font-size="96" font-weight="700" fill="#fff">示</text>
</svg>
```

- [ ] **Step 2: Create three sample screenshots**

Create `apps/_sample/screenshots/1.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 1170">
  <rect width="540" height="1170" fill="#fef3c7"/>
  <text x="270" y="585" text-anchor="middle" font-family="system-ui,sans-serif" font-size="48" fill="#92400e">截图 1</text>
</svg>
```

Create `apps/_sample/screenshots/2.svg` and `apps/_sample/screenshots/3.svg` with identical content but different viewBox-positioned text:

- `2.svg`: text content `截图 2`, fill `#fce7f3`, fill text `#9d174d`
- `3.svg`: text content `截图 3`, fill `#dbeafe`, fill text `#1e40af`

(Each is the same 540×1170 rectangle with different background/text colors so they're visually distinguishable in the carousel.)

- [ ] **Step 3: Create `apps.json` with the sample app**

```json
[
  {
    "slug": "_sample",
    "name": "示例 APP",
    "tagline": "这是一个示例 APP，部署后会替换为你的真实作品",
    "description": "## 关于这个示例\n\n这是占位 APP，用于验证站点骨架工作正常。\n\n部署成功后，编辑 `apps.json` 把它换成你的真实 APP 即可。",
    "highlights": [
      "这是第一条特性",
      "这是第二条特性",
      "这是第三条特性",
      "这是第四条特性"
    ],
    "icon": "apps/_sample/icon.svg",
    "screenshots": [
      "apps/_sample/screenshots/1.svg",
      "apps/_sample/screenshots/2.svg",
      "apps/_sample/screenshots/3.svg"
    ],
    "color": ["#fbbf24", "#f472b6"],
    "category": "示例",
    "featured": true,
    "platforms": [
      {
        "type": "android",
        "label": "下载 APK",
        "url": "https://github.com/lipopo",
        "primary": true
      },
      {
        "type": "web",
        "label": "在线访问",
        "url": "https://info.opplipo.cn"
      }
    ],
    "version": "0.0.1",
    "releasedAt": "2026-06-07"
  }
]
```

- [ ] **Step 4: Commit**

```bash
git add apps.json apps/
git commit -m "Add sample app data and placeholder assets"
```

---

## Task 3: Build script — validation (TDD)

**Files:**
- Create: `tests/build.test.mjs`
- Create: `build.mjs` (validate-only first; rendering in next task)

The build script exports a pure `validate(apps)` function. We test each validation rule in isolation.

- [ ] **Step 1: Write the failing tests for validation**

Create `tests/build.test.mjs` with these imports (Task 6 will extend this same file):

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, mkdir, copyFile, stat, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { validate, render, ROOT } from '../build.mjs';

const baseApp = {
  slug: 'a',
  name: 'A',
  tagline: 't',
  icon: 'apps/a/icon.png',
  platforms: [{ type: 'android', label: 'L', url: 'https://x' }],
};

test('validate: accepts a minimal valid app', () => {
  assert.doesNotThrow(() => validate([baseApp]));
});

test('validate: rejects non-array input', () => {
  assert.throws(() => validate(null), /apps\.json must be an array/);
  assert.throws(() => validate({}), /apps\.json must be an array/);
});

test('validate: rejects empty array', () => {
  assert.throws(() => validate([]), /at least one app/);
});

test('validate: rejects duplicate slugs', () => {
  const a = { ...baseApp };
  const b = { ...baseApp, name: 'B' };
  assert.throws(() => validate([a, b]), /duplicate slug/);
});

test('validate: rejects missing required fields', () => {
  for (const field of ['slug', 'name', 'tagline', 'icon', 'platforms']) {
    const bad = { ...baseApp };
    delete bad[field];
    assert.throws(() => validate([bad]), new RegExp(`missing required field: ${field}`));
  }
});

test('validate: rejects empty platforms', () => {
  const bad = { ...baseApp, platforms: [] };
  assert.throws(() => validate([bad]), /platforms.*at least one/);
});

test('validate: rejects platform with invalid type', () => {
  const bad = { ...baseApp, platforms: [{ type: 'beos', label: 'L', url: 'https://x' }] };
  assert.throws(() => validate([bad]), /invalid platform type/);
});

test('validate: rejects more than one featured', () => {
  const a = { ...baseApp, featured: true };
  const b = { ...baseApp, slug: 'b', featured: true };
  assert.throws(() => validate([a, b]), /only one app can be featured/);
});

test('validate: rejects non-boolean featured', () => {
  const a = { ...baseApp, featured: 'yes' };
  assert.throws(() => validate([a]), /featured.*boolean/);
});

test('validate: rejects missing referenced icon file', () => {
  const a = { ...baseApp, icon: 'apps/a/does-not-exist.png' };
  assert.throws(() => validate([a]), /icon not found/);
});

test('validate: rejects missing referenced screenshot files', () => {
  const a = { ...baseApp, screenshots: ['apps/a/1.png', 'apps/a/missing.png'] };
  assert.throws(() => validate([a]), /screenshot not found.*missing\.png/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: all 11 tests fail because `build.mjs` does not exist yet (import error).

- [ ] **Step 3: Implement `validate` in `build.mjs`**

Create `build.mjs`:

```javascript
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));

const PLATFORM_TYPES = new Set([
  'android', 'ios', 'macos', 'windows', 'linux', 'web',
]);

const REQUIRED_FIELDS = ['slug', 'name', 'tagline', 'icon', 'platforms'];

export async function pathExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

export function validate(apps) {
  if (!Array.isArray(apps)) {
    throw new Error('apps.json must be an array');
  }
  if (apps.length === 0) {
    throw new Error('apps.json must contain at least one app');
  }

  const slugs = new Set();
  let featuredCount = 0;

  for (const [i, app] of apps.entries()) {
    const where = `app[${i}]`;

    for (const field of REQUIRED_FIELDS) {
      if (app[field] === undefined || app[field] === null || app[field] === '') {
        throw new Error(`${where} is missing required field: ${field}`);
      }
    }

    if (typeof app.slug !== 'string' || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(app.slug)) {
      throw new Error(`${where} has invalid slug: ${JSON.stringify(app.slug)}`);
    }
    if (slugs.has(app.slug)) {
      throw new Error(`duplicate slug: ${app.slug}`);
    }
    slugs.add(app.slug);

    if (app.featured !== undefined) {
      if (typeof app.featured !== 'boolean') {
        throw new Error(`${where}.featured must be boolean, got ${typeof app.featured}`);
      }
      if (app.featured) featuredCount++;
    }

    if (!Array.isArray(app.platforms) || app.platforms.length === 0) {
      throw new Error(`${where}.platforms must be an array with at least one entry`);
    }
    for (const [j, p] of app.platforms.entries()) {
      if (!PLATFORM_TYPES.has(p.type)) {
        throw new Error(`${where}.platforms[${j}] has invalid platform type: ${p.type}`);
      }
      if (typeof p.label !== 'string' || !p.label) {
        throw new Error(`${where}.platforms[${j}].label is required`);
      }
      if (typeof p.url !== 'string' || !p.url) {
        throw new Error(`${where}.platforms[${j}].url is required`);
      }
    }
  }

  if (featuredCount > 1) {
    throw new Error(`only one app can be featured, found ${featuredCount}`);
  }
}

// --- File existence checks (sync, called after validate) -------------------

export async function validateFileExistence(apps) {
  for (const [i, app] of apps.entries()) {
    const where = `app[${i}]`;
    const iconPath = join(ROOT, app.icon);
    if (!(await pathExists(iconPath))) {
      throw new Error(`${where} icon not found: ${app.icon}`);
    }
    if (Array.isArray(app.screenshots)) {
      for (const s of app.screenshots) {
        const sp = join(ROOT, s);
        if (!(await pathExists(sp))) {
          throw new Error(`${where} screenshot not found: ${s}`);
        }
      }
    }
  }
}

// --- Entry point -----------------------------------------------------------

async function main() {
  const appsPath = join(ROOT, 'apps.json');
  const apps = JSON.parse(await readFile(appsPath, 'utf8'));
  validate(apps);
  await validateFileExistence(apps);
  console.log(`✓ ${apps.length} app(s) validated`);
}

main().catch((err) => {
  console.error(`Build failed: ${err.message}`);
  process.exit(1);
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all 11 tests pass.

- [ ] **Step 5: Run build against the sample data**

Run: `node build.mjs`
Expected: `✓ 1 app(s) validated`

- [ ] **Step 6: Verify validation actually catches real failures**

Run: `cp apps.json /tmp/apps.bak && sed -i 's/"_sample"/"_sample2"/' apps.json && node build.mjs; echo "---"; mv /tmp/apps.bak apps.json`
Expected: `Build failed: app[0] icon not found: apps/_sample2/icon.svg` (since we changed the slug but didn't rename the folder, the icon path lookup fails).

- [ ] **Step 7: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Add build script with data validation"
```

---

## Task 4: Templates — homepage

**Files:**
- Create: `templates/home.html`

The home template is a single HTML file with `{{key}}` and `{{#each items}}...{{/each}}` placeholders. The build script handles the simple substitution.

- [ ] **Step 1: Create `templates/home.html`**

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

    {{#each apps}}
      {{#if featured}}
        <a class="card card--featured" href="{{url}}" style="--c1:{{color.0}}; --c2:{{color.1}};">
          <div class="card__icon"><img src="{{icon}}" alt="{{name}}"></div>
          <div class="card__body">
            <div class="card__category">{{category}}</div>
            <div class="card__name">{{name}}</div>
            <p class="card__tagline">{{tagline}}</p>
            <span class="card__cta" data-platform-label="{{primaryPlatform.label}}">{{primaryPlatform.label}} →</span>
          </div>
        </a>
      {{/if}}
    {{/each}}

    <section class="grid">
      {{#each apps}}
        {{#unless featured}}
          <a class="card card--small" href="{{url}}" style="--c1:{{color.0}}; --c2:{{color.1}};">
            <div class="card__icon"><img src="{{icon}}" alt="{{name}}"></div>
            <div class="card__body">
              <div class="card__name">{{name}}</div>
              <div class="card__category">{{category}}</div>
            </div>
          </a>
        {{/unless}}
      {{/each}}
    </section>

    <footer class="site-footer">
      <p>© lipo · 站点部署于 GitHub Pages</p>
    </footer>
  </main>
  <script type="module" src="{{assets.app}}"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add templates/home.html
git commit -m "Add homepage template"
```

---

## Task 5: Templates — app detail page

**Files:**
- Create: `templates/app.html`

- [ ] **Step 1: Create `templates/app.html`**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{name}} | info.opplipo.cn</title>
  <meta name="description" content="{{tagline}}">
  <meta property="og:title" content="{{name}} | info.opplipo.cn">
  <meta property="og:description" content="{{tagline}}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="{{ogImage}}">
  <link rel="canonical" href="{{canonical}}">
  <link rel="stylesheet" href="{{assets.styles}}">
</head>
<body>
  <main class="page">
    <a class="back-link" href="/">← 返回首页</a>

    <section class="hero" style="--c1:{{color.0}}; --c2:{{color.1}};">
      <div class="hero__icon"><img src="{{icon}}" alt="{{name}}"></div>
      <div class="hero__body">
        <h1 class="hero__name">{{name}}</h1>
        <div class="hero__meta">
          {{#if category}}<span>{{category}}</span>{{/if}}
          {{#if version}}<span>· v{{version}}</span>{{/if}}
          {{#if releasedAt}}<span>· {{releasedAt}}</span>{{/if}}
        </div>
        <p class="hero__tagline">{{tagline}}</p>
        {{#if primaryPlatform}}
          <a class="cta cta--primary" href="{{primaryPlatform.url}}">{{primaryPlatform.label}}</a>
        {{/if}}
      </div>
    </section>

    {{#if highlights.length}}
      <section class="block">
        <div class="block__label">FEATURES</div>
        <ul class="highlights">
          {{#each highlights}}<li>{{.}}</li>{{/each}}
        </ul>
      </section>
    {{/if}}

    {{#if description}}
      <section class="block">
        <div class="block__label">ABOUT</div>
        <div class="prose">{{descriptionHtml}}</div>
      </section>
    {{/if}}

    {{#if screenshots.length}}
      <section class="block">
        <div class="block__label">SCREENSHOTS</div>
        <div class="carousel" data-carousel>
          {{#each screenshots}}
            <button class="carousel__item" data-lightbox-src="{{.}}" data-lightbox-alt="{{../name}}">
              <img src="{{.}}" alt="{{../name}} 截图" loading="lazy">
            </button>
          {{/each}}
        </div>
        <div class="carousel__hint">← 左右滑动 / 点击放大 →</div>
      </section>
    {{/if}}

    {{#if otherPlatforms.length}}
      <section class="block">
        <div class="block__label">OTHER DOWNLOADS</div>
        <div class="other-downloads">
          {{#each otherPlatforms}}
            <a class="cta cta--secondary" href="{{url}}">
              <img class="platform-icon" src="/assets/platforms/{{type}}.svg" alt="" width="16" height="16">
              {{label}}
            </a>
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

- [ ] **Step 2: Commit**

```bash
git add templates/app.html
git commit -m "Add app detail page template"
```

---

## Task 6: Build script — render + write (TDD)

**Files:**
- Modify: `build.mjs`
- Modify: `tests/build.test.mjs`

The render step converts apps.json + templates to HTML files. We test:
- rendering produces expected substrings
- `index.html` is written
- `apps/<slug>/index.html` is written
- CNAME and `apps/_sample/` are NOT touched

- [ ] **Step 1: Add the failing tests**

Append to `tests/build.test.mjs` (do **not** re-add the imports — the file already has them from Task 3):

test('render: home.html contains featured app name and tagline', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'rendertest-'));
  try {
    const html = render.home([{ ...baseApp, featured: true, name: 'TestApp', tagline: 'hello' }], { styles: '/assets/styles.css', app: '/assets/app.js' });
    assert.match(html, /TestApp/);
    assert.match(html, /hello/);
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('render: app.html contains icon, name, version, primary platform', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'rendertest-'));
  try {
    const app = {
      ...baseApp, name: 'TestApp', tagline: 't', version: '1.0.0', releasedAt: '2026-01-01',
      platforms: [{ type: 'android', label: 'Get it', url: 'https://example.com', primary: true }],
    };
    const html = render.app(app, { styles: '/a.css', app: '/a.js', canonical: 'https://x/', ogImage: '/i.png' });
    assert.match(html, /TestApp/);
    assert.match(html, /v1\.0\.0/);
    assert.match(html, /https:\/\/example\.com/);
    assert.match(html, /TestApp \| info\.opplipo\.cn/);
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('build: writes index.html and apps/<slug>/index.html, leaves CNAME and assets untouched', async () => {
  // Integration test: run `node build.mjs` against a clean copy of the real
  // repo, then assert the expected files appear and the protected files
  // are unchanged.
  const { execFileSync } = await import('node:child_process');
  const tmp = await mkdtemp(join(tmpdir(), 'buildtest-'));
  try {
    // Copy the real repo (minus .git and node_modules) into a tmp dir.
    await cp(ROOT, tmp, { recursive: true, filter: (p) => {
      const rel = relative(ROOT, p);
      if (rel.startsWith('.git')) return false;
      if (rel.startsWith('node_modules')) return false;
      return true;
    }});

    // Pre-record hashes of files that must NOT be touched.
    const cnameBefore = await readFile(join(tmp, 'CNAME'), 'utf8');
    const iconBefore = await readFile(join(tmp, 'apps', '_sample', 'icon.svg'), 'utf8');
    const screenshotBefore = await readFile(join(tmp, 'apps', '_sample', 'screenshots', '1.svg'), 'utf8');

    // Run the build.
    execFileSync('node', ['build.mjs'], { cwd: tmp, stdio: 'pipe' });

    // Expected outputs exist.
    const statIndex = await stat(join(tmp, 'index.html'));
    const statApp = await stat(join(tmp, 'apps', '_sample', 'index.html'));
    assert.ok(statIndex.isFile(), 'index.html should exist');
    assert.ok(statApp.isFile(), 'apps/_sample/index.html should exist');

    // Protected files are unchanged.
    assert.equal(await readFile(join(tmp, 'CNAME'), 'utf8'), cnameBefore);
    assert.equal(await readFile(join(tmp, 'apps', '_sample', 'icon.svg'), 'utf8'), iconBefore);
    assert.equal(await readFile(join(tmp, 'apps', '_sample', 'screenshots', '1.svg'), 'utf8'), screenshotBefore);

    // Output contains the sample app's name and the primary platform label.
    const html = await readFile(join(tmp, 'apps', '_sample', 'index.html'), 'utf8');
    assert.match(html, /示例 APP/);
    assert.match(html, /下载 APK/);
  } finally { await rm(tmp, { recursive: true, force: true }); }
});
```

The test file's imports already include `ROOT` (added in Task 3), and the integration test uses it directly as `ROOT` (no aliasing needed).

- [ ] **Step 2: Run tests, see them fail**

Run: `npm test`
Expected: the new render/ROOT tests fail. (Validation tests from Task 3 still pass; the failures are limited to the new code.)

- [ ] **Step 3: Extend `build.mjs` with render + write + new exports**

Replace `build.mjs` with the following full version (extends the previous file):

```javascript
import { readFile, writeFile, mkdir, stat, readdir, copyFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

export const ROOT = dirname(fileURLToPath(import.meta.url));

const PLATFORM_TYPES = new Set([
  'android', 'ios', 'macos', 'windows', 'linux', 'web',
]);

const REQUIRED_FIELDS = ['slug', 'name', 'tagline', 'icon', 'platforms'];

// --- Validation (unchanged) -----------------------------------------------

export async function pathExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

export function validate(apps) {
  if (!Array.isArray(apps)) {
    throw new Error('apps.json must be an array');
  }
  if (apps.length === 0) {
    throw new Error('apps.json must contain at least one app');
  }

  const slugs = new Set();
  let featuredCount = 0;

  for (const [i, app] of apps.entries()) {
    const where = `app[${i}]`;

    for (const field of REQUIRED_FIELDS) {
      if (app[field] === undefined || app[field] === null || app[field] === '') {
        throw new Error(`${where} is missing required field: ${field}`);
      }
    }

    if (typeof app.slug !== 'string' || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(app.slug)) {
      throw new Error(`${where} has invalid slug: ${JSON.stringify(app.slug)}`);
    }
    if (slugs.has(app.slug)) {
      throw new Error(`duplicate slug: ${app.slug}`);
    }
    slugs.add(app.slug);

    if (app.featured !== undefined) {
      if (typeof app.featured !== 'boolean') {
        throw new Error(`${where}.featured must be boolean, got ${typeof app.featured}`);
      }
      if (app.featured) featuredCount++;
    }

    if (!Array.isArray(app.platforms) || app.platforms.length === 0) {
      throw new Error(`${where}.platforms must be an array with at least one entry`);
    }
    for (const [j, p] of app.platforms.entries()) {
      if (!PLATFORM_TYPES.has(p.type)) {
        throw new Error(`${where}.platforms[${j}] has invalid platform type: ${p.type}`);
      }
      if (typeof p.label !== 'string' || !p.label) {
        throw new Error(`${where}.platforms[${j}].label is required`);
      }
      if (typeof p.url !== 'string' || !p.url) {
        throw new Error(`${where}.platforms[${j}].url is required`);
      }
    }
  }

  if (featuredCount > 1) {
    throw new Error(`only one app can be featured, found ${featuredCount}`);
  }
}

export async function validateFileExistence(apps) {
  for (const [i, app] of apps.entries()) {
    const where = `app[${i}]`;
    const iconPath = join(ROOT, app.icon);
    if (!(await pathExists(iconPath))) {
      throw new Error(`${where} icon not found: ${app.icon}`);
    }
    if (Array.isArray(app.screenshots)) {
      for (const s of app.screenshots) {
        const sp = join(ROOT, s);
        if (!(await pathExists(sp))) {
          throw new Error(`${where} screenshot not found: ${s}`);
        }
      }
    }
  }
}

// --- Template engine ------------------------------------------------------

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMarkdownLite(md) {
  // Very small markdown subset: ## headings and blank-line paragraphs.
  // No links, no images, no code. Sufficient for app descriptions.
  const lines = md.split(/\r?\n/);
  const out = [];
  let para = [];
  const flushPara = () => {
    if (para.length) { out.push(`<p>${escHtml(para.join(' '))}</p>`); para = []; }
  };
  for (const line of lines) {
    if (line.startsWith('## ')) {
      flushPara();
      out.push(`<h2>${escHtml(line.slice(3))}</h2>`);
    } else if (line.trim() === '') {
      flushPara();
    } else {
      para.push(line);
    }
  }
  flushPara();
  return out.join('\n');
}

function applyEach(template, key, items, render) {
  // {{#each key}}...{{/each}} with optional {{.}}, {{@index}}, parent fields via {{../field}}
  const start = template.indexOf(`{{#each ${key}}}`);
  if (start === -1) return template;
  const end = template.indexOf('{{/each}}', start);
  if (end === -1) throw new Error(`template: unclosed {{#each ${key}}}`);
  const before = template.slice(0, start);
  const body = template.slice(start + `{{#each ${key}}}`.length, end);
  const after = template.slice(end + '{{/each}}'.length);
  const rendered = items.map((item, idx) => {
    let piece = body;
    // {{.}} and {{field}} in current scope
    if (typeof item === 'string') {
      piece = piece.replace(/\{\{\.\}\}/g, escHtml(item));
    } else {
      piece = piece.replace(/\{\{([^./}][^}]*)\}\}/g, (m, k) => {
        const v = item[k.trim()];
        return v == null ? '' : escHtml(v);
      });
    }
    // {{../field}} from parent
    piece = piece.replace(/\{\{\.\.\/([^}]+)\}\}/g, (m, k) => {
      const v = render[k.trim()];
      return v == null ? '' : escHtml(v);
    });
    // {{@index}}
    piece = piece.replace(/\{\{@index\}\}/g, String(idx));
    return piece;
  }).join('');
  return before + rendered + applyEach(after, key, items, render);
}

function applyIf(template, key, condition, render) {
  // {{#if key}}...{{/if}} or {{#if key.expr}}...{{/if}}
  // Supports: key, key.field, key.length
  const re = /\{\{#if\s+([^\s}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  return template.replace(re, (m, expr, body) => {
    const val = resolveExpr(expr, render);
    if (isTruthy(val)) return body;
    return '';
  });
}

function resolveExpr(expr, scope) {
  const parts = expr.split('.');
  let v = scope[parts[0]];
  for (let i = 1; i < parts.length; i++) {
    if (v == null) return undefined;
    if (parts[i] === 'length') return Array.isArray(v) ? v.length : (typeof v === 'string' ? v.length : undefined);
    v = v[parts[i]];
  }
  return v;
}

function isTruthy(v) {
  if (v == null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function applyUnless(template, key, condition, render) {
  const re = new RegExp(`\\{\\{#unless\\s+${key}\\}\\}([\\s\\S]*?)\\{\\{/unless\\}\\}`, 'g');
  return template.replace(re, (m, body) => {
    const v = scope[key];
    return (!v || v === false) ? body : '';
  });
}

function renderTemplate(tpl, scope) {
  let out = tpl;
  // Each blocks first
  for (const key of Object.keys(scope)) {
    if (Array.isArray(scope[key])) {
      out = applyEach(out, key, scope[key], scope);
    }
  }
  // If / unless
  out = applyIf(out, '', true, scope);
  // Plain {{key}} substitution
  out = out.replace(/\{\{([^#/}][^}]*)\}\}/g, (m, k) => {
    const v = resolveExpr(k.trim(), scope);
    return v == null ? '' : escHtml(v);
  });
  return out;
}

// --- Render functions -----------------------------------------------------

const SITE_TAGLINE = '独立开发的多款 APP 介绍与下载';

function appsContext(apps) {
  // Pre-compute primaryPlatform / otherPlatforms and the apps-with-urls
  const enriched = apps.map((a) => {
    const primary = a.platforms.find((p) => p.primary) || a.platforms[0];
    const others = a.platforms.filter((p) => p !== primary);
    return {
      ...a,
      primaryPlatform: primary,
      otherPlatforms: others,
      url: `/apps/${a.slug}/`,
    };
  });
  return {
    apps: enriched,
    'site.tagline': SITE_TAGLINE,
    'assets.styles': '/assets/styles.css',
    'assets.app': '/assets/app.js',
  };
}

export const render = {
  async home(apps) {
    const tpl = await readFile(join(ROOT, 'templates', 'home.html'), 'utf8');
    const scope = {
      ...appsContext(apps),
      site: { tagline: SITE_TAGLINE },
    };
    // The template uses both "site.tagline" and "site.tagline" via the scope; expose flat keys too.
    scope['site.tagline'] = SITE_TAGLINE;
    return renderTemplate(tpl, scope);
  },

  async app(app) {
    const tpl = await readFile(join(ROOT, 'templates', 'app.html'), 'utf8');
    const enriched = {
      ...app,
      primaryPlatform: app.platforms.find((p) => p.primary) || app.platforms[0],
      otherPlatforms: app.platforms.filter((p) => p.primary !== true),
      descriptionHtml: app.description ? renderMarkdownLite(app.description) : '',
      ogImage: app.screenshots?.[0] ? `/${app.screenshots[0]}` : `/${app.icon}`,
      canonical: `https://info.opplipo.cn/apps/${app.slug}/`,
    };
    const scope = {
      ...enriched,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
    };
    return renderTemplate(tpl, scope);
  },
};

// --- File writer ----------------------------------------------------------

async function writeIfChanged(path, content) {
  let existing = null;
  try { existing = await readFile(path, 'utf8'); } catch {}
  if (existing === content) return false;
  await writeFile(path, content, 'utf8');
  return true;
}

async function writeOutputs(apps) {
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
}

async function copyAssets() {
  // Ensure assets/ is present in the published tree. We don't *copy* it
  // (it's already a real folder) — this function exists so future SSG
  // steps that need to copy templates/assets have a single seam.
  const exists = await pathExists(join(ROOT, 'assets'));
  if (!exists) throw new Error('assets/ directory missing at repo root');
}

async function writeSampleData() {
  // Defensive: if apps/<slug>/icon or screenshot paths are missing, this fails.
  // (validateFileExistence already covers it; this is a no-op for now.)
}

// --- Main -----------------------------------------------------------------

async function main() {
  const appsPath = join(ROOT, 'apps.json');
  const apps = JSON.parse(await readFile(appsPath, 'utf8'));
  validate(apps);
  await validateFileExistence(apps);
  await copyAssets();
  await writeOutputs(apps);
  console.log(`✓ built ${apps.length} app page(s)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`Build failed: ${err.message}`);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Run the build and inspect output**

Run: `node build.mjs`
Expected: `✓ built 1 app page(s)`

Verify the outputs exist:
Run: `ls -la index.html apps/_sample/index.html`
Expected: both files present.

Run: `head -40 index.html`
Expected: real HTML containing "示例 APP".

Run: `head -20 apps/_sample/index.html`
Expected: real HTML containing "示例 APP" and "下载 APK".

- [ ] **Step 6: Verify CNAME was NOT touched**

Run: `cat CNAME`
Expected: `info.opplipo.cn` (unchanged).

- [ ] **Step 7: Run build again — should be idempotent**

Run: `node build.mjs && node build.mjs`
Expected: both runs print the success line. No errors.

- [ ] **Step 8: Commit**

```bash
git add build.mjs tests/build.test.mjs index.html apps/_sample/index.html
git commit -m "Wire build script: render templates, write output files"
```

Note: the generated `index.html` and `apps/_sample/index.html` are committed. Future builds will overwrite them in place; `writeIfChanged` avoids touching them when content is identical.

---

## Task 7: Add `.nojekyll` and verify Jekyll is skipped

**Files:**
- Verify: `.nojekyll` exists (created in Task 1)

- [ ] **Step 1: Verify `.nojekyll` exists**

Run: `ls -la .nojekyll`
Expected: `-rw-r--r-- ... .nojekyll` with size 0.

- [ ] **Step 2: Confirm the build output would not be filtered**

The `.nojekyll` file's only job is to exist in the publishing root. After Task 6 it should already be committed. Re-verify with `git ls-files .nojekyll`.

Run: `git ls-files .nojekyll`
Expected: `.nojekyll`

(If not present, run `git add .nojekyll && git commit -m "Add .nojekyll"`.)

- [ ] **Step 3: No code changes — move to next task**

---

## Task 8: Styles — base + C 风格 tokens

**Files:**
- Create: `assets/styles.css`

The CSS uses custom properties for the C 风格 palette and base typography.

- [ ] **Step 1: Create `assets/styles.css`**

```css
:root {
  --bg: #fffaf5;
  --bg-gradient: linear-gradient(180deg, #fef3c7 0%, #fce7f3 50%, #dbeafe 100%);
  --surface: rgba(255, 255, 255, 0.6);
  --surface-strong: rgba(255, 255, 255, 0.85);
  --border: rgba(255, 255, 255, 0.8);
  --text: #1f2937;
  --text-muted: #6b7280;
  --label: #a16207;
  --accent: #f472b6;
  --radius: 18px;
  --radius-lg: 24px;
  --shadow-card: 0 8px 24px rgba(0, 0, 0, 0.06);
  --shadow-cta: 0 4px 12px rgba(244, 114, 182, 0.3);
  --font: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  --max-width: 720px;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  font-family: var(--font);
  color: var(--text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  background: var(--bg);
  background-image: var(--bg-gradient);
  background-attachment: fixed;
  min-height: 100vh;
}

img { max-width: 100%; height: auto; display: block; }

a { color: inherit; text-decoration: none; }

.page {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 32px 20px 64px;
}

.site-header {
  text-align: center;
  margin-bottom: 32px;
}
.site-title { font-size: 28px; margin: 0 0 4px; }
.site-tagline { color: var(--text-muted); margin: 0; }

.site-footer {
  text-align: center;
  margin-top: 48px;
  color: var(--text-muted);
  font-size: 13px;
}
```

- [ ] **Step 2: Commit**

```bash
git add assets/styles.css
git commit -m "Add base styles and C-style design tokens"
```

---

## Task 9: Styles — homepage layout (D · 主推大卡 + 其他小卡)

**Files:**
- Modify: `assets/styles.css`

- [ ] **Step 1: Append homepage-specific styles**

Append to `assets/styles.css`:

```css
/* Homepage: featured big card + small card grid */
.card {
  display: block;
  background: var(--surface);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: var(--shadow-card);
  transition: transform 0.2s ease;
}
.card:hover { transform: translateY(-2px); }

.card--featured {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 20px;
  align-items: center;
  padding: 28px;
  background:
    linear-gradient(135deg, var(--c1, #fbbf24) 0%, var(--c2, #f472b6) 100%),
    var(--surface-strong);
  background-blend-mode: soft-light;
  color: var(--text);
}
.card--featured .card__icon img {
  width: 88px;
  height: 88px;
  border-radius: 22px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
.card--featured .card__category {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--label);
  text-transform: uppercase;
}
.card--featured .card__name {
  font-size: 24px;
  font-weight: 700;
  margin: 2px 0 8px;
}
.card--featured .card__tagline {
  font-size: 15px;
  color: var(--text);
  margin: 0 0 16px;
}
.card--featured .card__cta {
  display: inline-block;
  background: linear-gradient(90deg, var(--c1, #fbbf24), var(--c2, #f472b6));
  color: #fff;
  padding: 10px 20px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: var(--shadow-cta);
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 24px;
}

.card--small {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card--small .card__icon img {
  width: 48px;
  height: 48px;
  border-radius: 12px;
}
.card--small .card__name {
  font-size: 14px;
  font-weight: 600;
}
.card--small .card__category {
  font-size: 11px;
  color: var(--text-muted);
}
```

- [ ] **Step 2: Commit**

```bash
git add assets/styles.css
git commit -m "Style homepage with featured + small card layout"
```

---

## Task 10: Styles — detail page (5 sections)

**Files:**
- Modify: `assets/styles.css`

- [ ] **Step 1: Append detail-page styles**

Append to `assets/styles.css`:

```css
/* Detail page */
.back-link {
  display: inline-block;
  margin-bottom: 16px;
  color: var(--text-muted);
  font-size: 14px;
}

.hero {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 20px;
  align-items: center;
  padding: 32px 24px;
  border-radius: var(--radius-lg);
  background:
    linear-gradient(135deg, var(--c1, #fbbf24) 0%, var(--c2, #f472b6) 100%);
  color: #fff;
  box-shadow: var(--shadow-card);
}
.hero__icon img {
  width: 96px;
  height: 96px;
  border-radius: 24px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}
.hero__name { font-size: 28px; margin: 0; }
.hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 13px;
  opacity: 0.85;
  margin: 4px 0 12px;
}
.hero__tagline {
  font-size: 16px;
  margin: 0 0 18px;
  opacity: 0.95;
}

.cta {
  display: inline-block;
  padding: 11px 22px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 15px;
  transition: transform 0.15s ease;
}
.cta:hover { transform: translateY(-1px); }
.cta--primary {
  background: #fff;
  color: var(--text);
  box-shadow: var(--shadow-cta);
}
.cta--secondary {
  background: #fff;
  color: var(--text);
  border: 1px solid #e5e7eb;
}

.block {
  margin-top: 16px;
  background: var(--surface);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px 22px;
}
.block__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--label);
  text-transform: uppercase;
}

.highlights {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
}
.highlights li {
  display: flex;
  gap: 10px;
  padding: 6px 0;
  font-size: 14px;
}
.highlights li::before {
  content: "✦";
  color: var(--accent);
  font-size: 16px;
  line-height: 1.4;
}

.prose {
  margin-top: 12px;
  font-size: 14px;
  color: var(--text);
  line-height: 1.7;
}
.prose p { margin: 0 0 12px; }
.prose h2 { font-size: 18px; margin: 20px 0 8px; }
```

- [ ] **Step 2: Commit**

```bash
git add assets/styles.css
git commit -m "Style app detail page: hero, features, about, other downloads"
```

---

## Task 11: Styles — screenshot carousel + responsive

**Files:**
- Modify: `assets/styles.css`

- [ ] **Step 1: Append carousel + responsive styles**

Append to `assets/styles.css`:

```css
/* Screenshot carousel */
.carousel {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  margin-top: 14px;
  padding: 4px;
}
.carousel::-webkit-scrollbar { height: 6px; }
.carousel::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}
.carousel__item {
  flex: 0 0 auto;
  width: 140px;
  height: 240px;
  background: transparent;
  border: 0;
  padding: 0;
  cursor: zoom-in;
  border-radius: 14px;
  scroll-snap-align: start;
  overflow: hidden;
  transition: transform 0.2s ease;
}
.carousel__item:hover { transform: scale(1.03); }
.carousel__item img { width: 100%; height: 100%; object-fit: cover; }
.carousel__hint {
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 8px;
}

.other-downloads {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}
.platform-icon {
  display: inline-block;
  vertical-align: middle;
  margin-right: 6px;
}

/* Responsive */
@media (max-width: 640px) {
  .page { padding: 20px 14px 48px; }
  .grid { grid-template-columns: 1fr; }
  .card--featured { grid-template-columns: 64px 1fr; padding: 18px; gap: 14px; }
  .card--featured .card__icon img { width: 64px; height: 64px; }
  .card--featured .card__name { font-size: 19px; }
  .hero { grid-template-columns: 72px 1fr; padding: 22px 18px; }
  .hero__icon img { width: 72px; height: 72px; }
  .hero__name { font-size: 22px; }
  .cta { width: 100%; text-align: center; }
}
```

- [ ] **Step 2: Verify in browser later (Task 16)**

Visual verification of the responsive behavior happens during the local smoke test (Task 16), not here.

- [ ] **Step 3: Commit**

```bash
git add assets/styles.css
git commit -m "Style screenshot carousel and mobile breakpoints"
```

---

## Task 12: Platform SVG icons

**Files:**
- Create: `assets/platforms/android.svg`
- Create: `assets/platforms/ios.svg`
- Create: `assets/platforms/macos.svg`
- Create: `assets/platforms/windows.svg`
- Create: `assets/platforms/linux.svg`
- Create: `assets/platforms/web.svg`

These are minimal monochrome icons (16×16 viewBox) used inline next to download buttons.

- [ ] **Step 1: Create `assets/platforms/android.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
  <path d="M3.5 5.5a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V6a.5.5 0 0 0-.5-.5h-9Zm-1-1.7a.5.5 0 0 0-.7.7l.7.7a.5.5 0 0 0 .7-.7l-.7-.7Zm11 0a.5.5 0 0 0-.7-.7l-.7.7a.5.5 0 0 0 .7.7l.7-.7ZM6.5 3l-.5-1h4l-.5 1h-3Z"/>
</svg>
```

- [ ] **Step 2: Create `assets/platforms/ios.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
  <path d="M11.5 8.4c0-1.7 1.4-2.5 1.5-2.6-.8-1.2-2.1-1.4-2.5-1.4-1.1-.1-2.1.6-2.6.6-.6 0-1.4-.6-2.4-.6-1.2 0-2.4.7-3 1.8-1.3 2.2-.3 5.4.9 7.2.6.9 1.4 1.9 2.3 1.8.9 0 1.3-.6 2.4-.6s1.5.6 2.4.6c1 0 1.6-.9 2.2-1.8.7-1 1-2 1-2.1 0 0-2-.7-2-2.9ZM9.7 3.4c.5-.6.8-1.4.7-2.3-.7 0-1.6.5-2.1 1.1-.5.5-.9 1.4-.7 2.2.8.1 1.6-.4 2.1-1Z"/>
</svg>
```

- [ ] **Step 3: Create `assets/platforms/macos.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
  <path d="M11.2 8.4c0-1.8 1.5-2.7 1.6-2.7-.9-1.3-2.2-1.4-2.7-1.5-1.1-.1-2.2.7-2.8.7-.6 0-1.5-.6-2.5-.6-1.3 0-2.5.7-3.1 1.9-1.3 2.3-.3 5.7 1 7.6.6.9 1.4 1.9 2.3 1.9 1 0 1.3-.6 2.5-.6 1.1 0 1.5.6 2.5.6 1 0 1.7-.9 2.3-1.9.7-1.1 1-2.1 1.1-2.2 0 0-2.2-.8-2.2-3.2ZM9.4 3.2c.5-.6.9-1.5.8-2.4-.8 0-1.7.5-2.2 1.2-.5.6-.9 1.4-.8 2.3.8 0 1.7-.5 2.2-1.1Z"/>
</svg>
```

- [ ] **Step 4: Create `assets/platforms/windows.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
  <path d="M1 3l6.5-1v6H1V3Zm0 6h6.5v6L1 14V9Zm7.5-7.2L15 1v7H8.5V1.8ZM8.5 9H15v7l-6.5-.8V9Z"/>
</svg>
```

- [ ] **Step 5: Create `assets/platforms/linux.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
  <path d="M8 1c-1.7 0-2.5 1.5-2.5 3 0 .9.2 1.5.4 2-.7.4-1.4 1.2-1.9 2.2C3.4 9.4 3 10.7 3 12c0 1.3.5 2 1.4 2.5.6.3 1.3.4 2 .5.4 0 .8.1 1.2.3.5.3.8.7.9.7.3 0 .4-.3.5-.5.1.1.2.3.4.3.2 0 .3-.2.4-.4 0 .1.1.3.3.3.2 0 .3-.2.4-.4.1.2.2.4.4.4.2 0 .4-.2.5-.4.1.2.2.4.4.4.2 0 .3-.2.4-.4.1.1.2.2.3.2.1 0 .2-.1.2-.2 0-.1.1-.2.1-.3 0-.2-.2-.4-.4-.5.4-.2.7-.5.8-1 .1-.3.1-.6.1-.9 0-1.3-.4-2.6-1-3.8-.5-1-1.2-1.8-1.9-2.2.2-.5.4-1.1.4-2C10.5 2.5 9.7 1 8 1ZM6.5 5a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1Zm3 0a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1Z"/>
</svg>
```

- [ ] **Step 6: Create `assets/platforms/web.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
  <circle cx="8" cy="8" r="6.5"/>
  <path d="M1.5 8h13M8 1.5c2 2 2 11 0 13M8 1.5c-2 2-2 11 0 13"/>
</svg>
```

- [ ] **Step 7: Commit**

```bash
git add assets/platforms/
git commit -m "Add platform SVG icons (android, ios, macos, windows, linux, web)"
```

---

## Task 13: Interactivity — carousel, lightbox, app.js

**Files:**
- Create: `assets/app.js`

- [ ] **Step 1: Create `assets/app.js`**

```javascript
// Lightweight: scroll-snap carousel + native <dialog> lightbox. No deps.

function initCarousels() {
  document.querySelectorAll('[data-carousel]').forEach((carousel) => {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    carousel.addEventListener('pointerdown', (e) => {
      isDown = true;
      startX = e.pageX - carousel.offsetLeft;
      scrollLeft = carousel.scrollLeft;
      carousel.style.cursor = 'grabbing';
    });
    carousel.addEventListener('pointerup', () => {
      isDown = false;
      carousel.style.cursor = '';
    });
    carousel.addEventListener('pointercancel', () => {
      isDown = false;
      carousel.style.cursor = '';
    });
    carousel.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - carousel.offsetLeft;
      carousel.scrollLeft = scrollLeft - (x - startX) * 1.2;
    });
  });
}

function ensureDialog() {
  let d = document.getElementById('lightbox-dialog');
  if (d) return d;
  d = document.createElement('dialog');
  d.id = 'lightbox-dialog';
  d.innerHTML = `
    <button class="lightbox-close" aria-label="关闭">×</button>
    <img class="lightbox-img" alt="">
  `;
  d.querySelector('.lightbox-close').addEventListener('click', () => d.close());
  d.addEventListener('click', (e) => {
    // Click on backdrop closes; click on image does not.
    if (e.target === d) d.close();
  });
  document.body.appendChild(d);
  return d;
}

function initLightbox() {
  const dialog = ensureDialog();
  const img = dialog.querySelector('.lightbox-img');
  document.querySelectorAll('[data-lightbox-src]').forEach((btn) => {
    btn.addEventListener('click', () => {
      img.src = btn.dataset.lightboxSrc;
      img.alt = btn.dataset.lightboxAlt || '';
      dialog.showModal();
    });
  });
  // ESC to close
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dialog.close();
  });
}

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

- [ ] **Step 2: Append lightbox CSS**

Append to `assets/styles.css`:

```css
/* Lightbox */
#lightbox-dialog {
  border: 0;
  padding: 0;
  background: transparent;
  max-width: 92vw;
  max-height: 92vh;
}
#lightbox-dialog::backdrop {
  background: rgba(0, 0, 0, 0.85);
}
.lightbox-img {
  max-width: 92vw;
  max-height: 92vh;
  border-radius: 12px;
  display: block;
}
.lightbox-close {
  position: fixed;
  top: 16px;
  right: 20px;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  color: #111;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}
```

- [ ] **Step 3: Commit**

```bash
git add assets/app.js assets/styles.css
git commit -m "Add carousel drag-scroll and lightbox dialog"
```

---

## Task 14: CI workflow — GitHub Pages deployment

**Files:**
- Create: `.github/workflows/pages.yml`

- [ ] **Step 1: Create `.github/workflows/pages.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install (none required)
        run: node --version

      - name: Validate
        run: node -e "import('./build.mjs').then(m => m.validate(JSON.parse(require('fs').readFileSync('apps.json','utf8')))).then(() => console.log('✓ validation passed'))"

      - name: Build
        run: node build.mjs

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Verify workflow YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/pages.yml'))" && echo OK`
Expected: `OK`

(Requires `python3 -c` to have PyYAML. If not installed, run `node -e "const y=require('fs').readFileSync('.github/workflows/pages.yml','utf8'); console.log('size:', y.length)"` to at least confirm the file is non-empty.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/pages.yml
git commit -m "Add GitHub Pages deploy workflow"
```

---

## Task 15: README — re-encode and rewrite

**Files:**
- Modify: `README.md` (currently UTF-16 BOM; rewrite as UTF-8)

- [ ] **Step 1: Rewrite `README.md` in UTF-8**

Overwrite `README.md` with the following content (plain UTF-8, no BOM):

````markdown
# info.opplipo.cn

Source for the multi-APP showcase site served at <https://info.opplipo.cn>.

## Stack

- Plain HTML/CSS/vanilla ES modules (no framework, no build deps).
- A tiny `build.mjs` (Node 20+ standard library) reads `apps.json` + the
  `templates/` directory and generates `index.html` + per-app detail pages.
- GitHub Actions runs the build and deploys to GitHub Pages on every push
  to `main`.

## Adding a new APP

1. Append an entry to `apps.json` (see the existing entry for the schema).
2. Create `apps/<slug>/` with `icon.svg` (or `.png`) and
   `screenshots/1.svg`, `2.svg`, … (or `.png`/`.webp`).
3. `git push` — GitHub Actions builds and deploys.

Full schema and conventions live in
[`docs/superpowers/specs/2026-06-06-opplipo-info-design.md`](docs/superpowers/specs/2026-06-06-opplipo-info-design.md).

## Local development

```bash
node build.mjs            # generate index.html and apps/*/index.html
npm test                  # run build.test.mjs
python3 -m http.server 4000   # serve the site locally
```

Open <http://localhost:4000/>.

## Layout

```
.
├── apps.json                data source — the only file you normally edit
├── build.mjs                build script (Node, no npm deps)
├── templates/               HTML templates
│   ├── home.html
│   └── app.html
├── assets/                  shared CSS, JS, and platform icons
│   ├── styles.css
│   ├── app.js
│   └── platforms/
└── apps/<slug>/             per-app icons and screenshots
```
````

- [ ] **Step 2: Verify encoding**

Run: `head -c 3 README.md | od -c | head -1`
Expected: `0000000   -   -   -`  (or similar) — i.e. the file does NOT start with `357 273 277` (the UTF-8 BOM). If it does, re-save without BOM.

Alternative: `file README.md` should report `UTF-8 Unicode text` (not `UTF-8 Unicode (with BOM) text`).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Rewrite README as UTF-8 with project documentation"
```

---

## Task 16: Local smoke test

**Files:** none (verification only)

- [ ] **Step 1: Clean + rebuild from scratch**

Run:
```bash
rm -f index.html
rm -rf apps/_sample/index.html
node build.mjs
```

Expected: `✓ built 1 app page(s)`.

- [ ] **Step 2: Start the local server in the background**

Run: `python3 -m http.server 4000 &`  (or use `npm run serve &`)

Expected: `Serving HTTP on 0.0.0.0 port 4000`.

- [ ] **Step 3: Hit the homepage**

Run: `curl -sI http://localhost:4000/ | head -1`
Expected: `HTTP/1.0 200 OK`.

Run: `curl -s http://localhost:4000/ | grep -E '示例 APP|示例 APP.*示例' | head -1`
Expected: a line containing the app name.

- [ ] **Step 4: Hit the detail page**

Run: `curl -sI http://localhost:4000/apps/_sample/ | head -1`
Expected: `HTTP/1.0 200 OK`.

Run: `curl -s http://localhost:4000/apps/_sample/ | grep -E '下载 APK|FEATURES|SCREENSHOTS'`
Expected: all three substrings present.

- [ ] **Step 5: Visual verification (manual)**

Open `http://localhost:4000/` in a browser.

Verify visually:
- [ ] Hero big card shows 示例 APP with gradient background, icon, name, tagline, and "下载 APK →" button.
- [ ] No 404s in the Network tab.
- [ ] The detail page renders: hero (with icon, name, version, release date, primary CTA), FEATURES bullets, ABOUT markdown, SCREENSHOTS carousel, OTHER DOWNLOADS buttons.
- [ ] Clicking a screenshot opens the lightbox.
- [ ] Resize to ~375px width: layout collapses to single column, CTAs are full width, no horizontal scroll.

- [ ] **Step 6: Run the test suite one more time**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Stop the local server**

Run: `pkill -f "http.server 4000"`  (or however you backgrounded it)

- [ ] **Step 8: No commit — verification only**

If anything is broken, fix and commit. Otherwise, proceed to Task 17.

---

## Task 17: Deploy — push, watch Actions, verify live

**Files:** none (deployment only)

- [ ] **Step 1: Push to origin**

Run: `git push origin main`

Expected: all commits land on `origin/main`. The local branch is now in sync.

- [ ] **Step 2: Watch the Actions run**

Either:
- Visit `https://github.com/lipopo/OppLipo/actions` in a browser, or
- Run: `tea actions list --repo lipopo/OppLipo --workflow "Deploy to GitHub Pages" --limit 1` (or use `tea` to watch).

Wait for the `build` job to complete (typically < 1 min for a static site of this size).

- [ ] **Step 3: Verify the live site**

Run: `curl -sI https://info.opplipo.cn/ | head -1`
Expected: `HTTP/2 200` (or `HTTP/1.1 200`).

Run: `curl -s https://info.opplipo.cn/ | grep -E '示例 APP' | head -1`
Expected: a line containing the app name.

Run: `curl -sI https://info.opplipo.cn/apps/_sample/ | head -1`
Expected: `HTTP/2 200`.

- [ ] **Step 4: Verify HTTPS is enforced**

Run: `curl -sI http://info.opplipo.cn/ | head -3`
Expected: response starts with `HTTP/1.1 301` (or `308`) redirecting to `https://`.

If you see `200` over plain HTTP: go to **Settings → Pages** on GitHub and enable **Enforce HTTPS**, then wait up to 24 hours for the certificate to provision (usually much faster).

- [ ] **Step 5: Done**

v1 is live at `https://info.opplipo.cn/`. To replace the sample app with a real one, follow the steps in `README.md` (Task 15).

---

## Self-Review

**Spec coverage:**

| Spec section | Implemented in |
|---|---|
| §1 Purpose | All tasks |
| §2 Audience | Implicit (templates use lang="zh-CN") |
| §3 Site structure | Tasks 4, 5, 6 |
| §4 Architecture | Tasks 1, 6, 14 |
| §5 Data schema + validation | Task 3 |
| §6.1 C 风格 | Tasks 8, 9, 10 |
| §6.2 D 布局 | Task 9 |
| §6.3 详情页 5 块 | Task 10 |
| §6.4 响应式 | Task 11 |
| §6.5 SEO/性能 | Tasks 4, 5 (meta tags), Task 8 (system font) |
| §6.6 可访问性 | Task 13 (alt, dialog, ESC, backdrop click), Tasks 4/5 (semantic HTML) |
| §7 CI | Task 14 |
| §8 加 APP 工作流 | Task 15 (README documents it) |
| §10 开放问题 | Tasks 11 (PNG/WebP/screenshot format), 15 (UTF-8 re-encode), 14 (no `npm ci`) |
| §11 验收标准 | Tasks 16, 17 |

**Placeholder scan:** None. Every code block is complete; every command has expected output.

**Type/name consistency:**
- `validate(apps)` and `validateFileExistence(apps)` are used consistently.
- `render.home(apps)` and `render.app(app)` signatures match between Task 3 tests, Task 4/5 templates, Task 6 build, and Task 17 verification.
- Template variables (`{{name}}`, `{{tagline}}`, `{{color.0}}` / `{{color.1}}`, `{{primaryPlatform.label}}`, `{{otherPlatforms}}`, `{{screenshots}}`, `{{descriptionHtml}}`, `{{assets.styles}}`) all match what `appsContext()` and `render.app()` produce in `build.mjs`.
- Data field names (`slug`, `name`, `tagline`, `description`, `highlights`, `icon`, `screenshots`, `color`, `category`, `featured`, `platforms`, `version`, `releasedAt`, `primary`) match the spec schema in §5.1 and the sample data in Task 2.
- Platform `type` values (`android`, `ios`, `macos`, `windows`, `linux`, `web`) match between `PLATFORM_TYPES` in `build.mjs`, the sample data, and the SVG filenames in `assets/platforms/`.
