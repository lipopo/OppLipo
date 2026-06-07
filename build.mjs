import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

export const ROOT = dirname(fileURLToPath(import.meta.url));

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

    if (typeof app.slug !== 'string' || !/^[a-z0-9_][a-z0-9_-]*$/.test(app.slug)) {
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

    if (!existsSync(join(ROOT, app.icon))) {
      throw new Error(`${where} icon not found: ${app.icon}`);
    }
    if (Array.isArray(app.screenshots)) {
      for (const s of app.screenshots) {
        if (!existsSync(join(ROOT, s))) {
          throw new Error(`${where} screenshot not found: ${s}`);
        }
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

// Placeholder; real implementation lands in Task 6.
export function render() {
  throw new Error('render() is not implemented yet');
}

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
