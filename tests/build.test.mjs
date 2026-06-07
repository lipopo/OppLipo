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
