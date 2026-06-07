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
    assert.match(html, /下载 APK/);
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
