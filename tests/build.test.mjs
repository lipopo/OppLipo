import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, mkdir, copyFile, stat, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { validate, render, ROOT, omitPrivate, deriveQuarter, aggregateRecentReleases } from '../build.mjs';

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
  for (const field of ['slug', 'name', 'tagline', 'icon']) {
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

test('validate: accepts multiple apps with featured: true (v1+ carousel allows any count)', () => {
  const a = { ...baseApp, featured: true };
  const b = { ...baseApp, slug: 'b', featured: true };
  const c = { ...baseApp, slug: 'c', featured: true };
  assert.doesNotThrow(() => validate([a, b, c]));
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

test('render: home.html contains featured app name and tagline', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'rendertest-'));
  try {
    const html = await render.home([{ ...baseApp, featured: true, name: 'TestApp', tagline: 'hello' }], { styles: '/assets/styles.css', app: '/assets/app.js' });
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
    const html = await render.app(app, { styles: '/a.css', app: '/a.js', canonical: 'https://x/', ogImage: '/i.png' });
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
    assert.match(html, /加入内测/);
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

// --- Lifecycle + private validation (Task 1) ---

const baseIdea = {
  slug: 'ideaproj',
  name: 'Idea Project',
  tagline: 'just an idea',
  icon: 'apps/ideaproj/icon.png',
  platforms: [{ type: 'android', label: 'L', url: 'https://x' }],
};

test('validate: idea status allows minimal fields (slug + name + lifecycle.status only)', () => {
  const app = { slug: 'min-idea', name: 'Min Idea', lifecycle: { status: 'idea' } };
  assert.doesNotThrow(() => validate([app]));
});

test('validate: idea status with empty platforms is accepted', () => {
  // Idea should not need the v1 required set; platforms optional.
  const app = { slug: 'min-idea2', name: 'Min Idea 2', lifecycle: { status: 'idea' } };
  // No `platforms` key at all — should not throw.
  assert.doesNotThrow(() => validate([app]));
});

test('validate: non-idea statuses still require the v1 set', () => {
  // beta must have platforms
  const app = { slug: 'b1', name: 'B1', tagline: 't', icon: 'apps/b1/i.png', lifecycle: { status: 'beta' } };
  assert.throws(() => validate([app]), /platforms.*at least one/);
});

test('validate: lifecycle.status must be in the enum if lifecycle is present', () => {
  const app = { ...baseIdea, lifecycle: { status: 'sideways' } };
  assert.throws(() => validate([app]), /invalid lifecycle\.status/);
});

test('validate: lifecycle.releases[].version must be a non-empty string', () => {
  const app = {
    ...baseIdea,
    lifecycle: { status: 'launched', releases: [{ version: '', releasedAt: '2026-01-01' }] },
  };
  assert.throws(() => validate([app]), /releases\[0\]\.version/);
});

test('validate: lifecycle.releases[].releasedAt must be a parseable date', () => {
  const app = {
    ...baseIdea,
    lifecycle: { status: 'launched', releases: [{ version: '1.0.0', releasedAt: 'not-a-date' }] },
  };
  assert.throws(() => validate([app]), /releases\[0\]\.releasedAt/);
});

test('validate: lifecycle.targetDate must be a parseable date when present', () => {
  const app = {
    ...baseIdea,
    lifecycle: { status: 'in-development', targetDate: 'not-a-date' },
  };
  assert.throws(() => validate([app]), /targetDate/);
});

test('validate: well-formed lifecycle + private block is accepted', () => {
  const app = {
    ...baseIdea,
    lifecycle: {
      status: 'launched',
      targetDate: '2026-08-15',
      releases: [
        { version: '1.0.0', releasedAt: '2026-06-01', notes: 'Initial release' },
      ],
    },
    private: { notes: 'internal', blockers: ['X'], todo: ['Y'] },
  };
  assert.doesNotThrow(() => validate([app]));
});

// --- omitPrivate + deriveQuarter (Task 2) ---

test('omitPrivate: removes the private field', () => {
  const app = { slug: 'a', name: 'A', private: { notes: 'secret' } };
  const out = omitPrivate(app);
  assert.equal(out.private, undefined);
  assert.equal(out.slug, 'a');
});

test('omitPrivate: removes lifecycle.targetDate (private)', () => {
  const app = {
    slug: 'a',
    name: 'A',
    lifecycle: { status: 'in-development', targetDate: '2026-08-15', releases: [] },
  };
  const out = omitPrivate(app);
  assert.equal(out.lifecycle.targetDate, undefined);
  assert.equal(out.lifecycle.status, 'in-development');
});

test('omitPrivate: preserves lifecycle.releases[] (public)', () => {
  const app = {
    slug: 'a',
    name: 'A',
    lifecycle: { status: 'launched', releases: [{ version: '1.0', releasedAt: '2026-06-01' }] },
  };
  const out = omitPrivate(app);
  assert.equal(out.lifecycle.releases.length, 1);
  assert.equal(out.lifecycle.releases[0].version, '1.0');
});

test('omitPrivate: does not mutate the input', () => {
  const app = { slug: 'a', private: { x: 1 } };
  const out = omitPrivate(app);
  assert.equal(app.private.x, 1, 'input should not be mutated');
  assert.notEqual(out, app, 'should return a new object');
});

test('omitPrivate: handles app with no private and no lifecycle', () => {
  const app = { slug: 'a', name: 'A' };
  const out = omitPrivate(app);
  assert.deepEqual(out, { slug: 'a', name: 'A' });
});

test('deriveQuarter: standard mapping', () => {
  assert.equal(deriveQuarter('2026-01-15'), 'Q1 2026');
  assert.equal(deriveQuarter('2026-04-01'), 'Q2 2026');
  assert.equal(deriveQuarter('2026-07-31'), 'Q3 2026');
  assert.equal(deriveQuarter('2026-10-15'), 'Q4 2026');
  assert.equal(deriveQuarter('2026-12-31'), 'Q4 2026');
});

test('deriveQuarter: returns null for unparseable input', () => {
  assert.equal(deriveQuarter('not-a-date'), null);
  assert.equal(deriveQuarter(''), null);
  assert.equal(deriveQuarter(null), null);
  assert.equal(deriveQuarter(undefined), null);
});

// --- render.roadmap (Task 3) ---

test('render.roadmap: produces a valid HTML page with the expected structure', async () => {
  const apps = [
    {
      slug: 'ship', name: 'Shipped App', tagline: 't', icon: 'apps/ship/icon.png',
      platforms: [{ type: 'android', label: 'L', url: 'https://x' }],
      version: '1.0.0', releasedAt: '2026-06-01',
      lifecycle: { status: 'launched', releases: [{ version: '1.0.0', releasedAt: '2026-06-01', notes: 'GA' }] },
    },
    {
      slug: 'idea1', name: 'Idea One',
      lifecycle: { status: 'idea', targetDate: '2026-09-01' },
      private: { notes: 'thinking' },
    },
    {
      slug: 'beta1', name: 'Beta One', tagline: 'beta tagline', icon: 'apps/beta1/icon.png',
      platforms: [{ type: 'android', label: 'L', url: 'https://x' }],
      lifecycle: { status: 'beta' },
      private: { blockers: ['waiting on review'], todo: ['add crashlytics'] },
    },
  ];
  const html = await render.roadmap(apps);
  // Top-level structure
  assert.match(html, /<title>Roadmap/);
  assert.match(html, /Last updated: \d{4}-\d{2}-\d{2}/);
  assert.match(html, /counts.*idea.*in-development.*beta/);
  // Sections present
  assert.match(html, /<h2>NOW<\/h2>/);
  assert.match(html, /<h2>PLANNED<\/h2>/);
  assert.match(html, /<h2>SHIPPED<\/h2>/);
  assert.match(html, /<h2>Blockers/);
  assert.match(html, /<h2>Todos/);
  // App names
  assert.match(html, /Shipped App/);
  assert.match(html, /Idea One/);
  assert.match(html, /Beta One/);
  // Status badges use the lifecycle.status class
  assert.match(html, /class="badge launched"/);
  assert.match(html, /class="badge idea"/);
  assert.match(html, /class="badge beta"/);
  // Private content visible
  assert.match(html, /waiting on review/);
  assert.match(html, /add crashlytics/);
  assert.match(html, /thinking/);
  // No {{...}} placeholders left
  assert.equal(html.match(/\{\{/g), null);
});

test('render.roadmap: handles empty apps array', async () => {
  const html = await render.roadmap([]);
  assert.match(html, /counts.*idea 0.*launched 0/);
  // No section headers for empty sections
  assert.doesNotMatch(html, /<h2>NOW<\/h2>/);
  assert.doesNotMatch(html, /<h2>PLANNED<\/h2>/);
  assert.doesNotMatch(html, /<h2>SHIPPED<\/h2>/);
});

// --- aggregateRecentReleases (Task 1) ---

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
  // A and C should appear in the carousel section, B should not
  const carouselSection = html.match(/<section class="carousel-hero"[\s\S]*?<\/section>/);
  assert.ok(carouselSection, 'should have a .carousel-hero section');
  const section = carouselSection[0];
  assert.match(section, /A/);
  assert.match(section, /C/);
});

test('render.home: exposes hasFeaturedApps=false when no app is featured', async () => {
  const html = await render.home([
    { slug: 'a', name: 'A', tagline: 't', icon: 'apps/a/i.png',
      platforms: [{ type: 'android', label: 'L', url: 'https://x' }] },
  ]);
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
  assert.match(html, /<section class="recent-updates"/);
  const recentSection = html.match(/<section class="recent-updates"[\s\S]*?<\/section>/);
  assert.ok(recentSection);
  assert.match(recentSection[0], /A/);
  assert.match(recentSection[0], /B/);
  // Order: 1.1 (2026-06-05) > 2.0 (2026-06-03) > 1.0 (2026-06-01).
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
  assert.doesNotMatch(html, /<section class="recent-updates"/);
});
