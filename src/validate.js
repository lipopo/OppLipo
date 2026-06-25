import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));

export function validate(apps) {
  if (!Array.isArray(apps)) {
    throw new Error('apps.json must be an array');
  }
  if (apps.length === 0) {
    throw new Error('apps.json must contain at least one app');
  }

  const slugs = new Set();

  for (const [i, app] of apps.entries()) {
    const where = `app[${i}]`;

    // Required fields depend on status:
    //   - status === "idea": only slug + name required (lifecycle.status already checked below)
    //   - all other statuses (including no lifecycle): v1 set
    const status = app.lifecycle?.status;
    const requiredForThisApp = status === 'idea'
      ? ['slug', 'name']
      : REQUIRED_FIELDS;
    for (const field of requiredForThisApp) {
      if (app[field] === undefined || app[field] === null || app[field] === '') {
        throw new Error(`${where} is missing required field: ${field}`);
      }
    }

    // NOTE: relaxed regex from Task 3 to accept leading underscores and short slugs.
    // The plan's original regex `/^[a-z0-9][a-z0-9-]*[a-z0-9]$/` rejects `_sample` and `a`.
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
    }

    // Platforms check: only required for non-idea statuses (idea apps skip the v1 set).
    if (status !== 'idea') {
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

    // --- Lifecycle (Task 1) ---
    if (app.lifecycle !== undefined) {
      if (typeof app.lifecycle !== 'object' || app.lifecycle === null) {
        throw new Error(`${where}.lifecycle must be an object`);
      }
      if (!LIFECYCLE_STATUSES.has(app.lifecycle.status)) {
        throw new Error(`invalid lifecycle.status for ${where}: ${JSON.stringify(app.lifecycle.status)}`);
      }
      if (app.lifecycle.targetDate !== undefined && parseISODate(app.lifecycle.targetDate) === null) {
        throw new Error(`${where}.lifecycle.targetDate is not a valid ISO date: ${JSON.stringify(app.lifecycle.targetDate)}`);
      }
      if (app.lifecycle.releases !== undefined) {
        if (!Array.isArray(app.lifecycle.releases)) {
          throw new Error(`${where}.lifecycle.releases must be an array`);
        }
        for (const [k, r] of app.lifecycle.releases.entries()) {
          if (typeof r.version !== 'string' || !r.version) {
            throw new Error(`${where}.lifecycle.releases[${k}].version must be a non-empty string`);
          }
          if (parseISODate(r.releasedAt) === null) {
            throw new Error(`${where}.lifecycle.releases[${k}].releasedAt is not a valid ISO date: ${JSON.stringify(r.releasedAt)}`);
          }
        }
      }
    }
  }

  // File existence checks (moved here from validateFileExistence, see Task 3's resolution)
  // Use Node's sync `existsSync` so the function stays sync (tests 10/11 call it sync).
  for (const [i, app] of apps.entries()) {
    const where = `app[${i}]`;
    // Idea apps have no v1 required fields (no icon, no screenshots) — skip file checks.
    if (app.lifecycle?.status === 'idea') continue;
    const iconPath = join(ROOT, app.icon);
    if (!existsSync(iconPath)) {
      throw new Error(`${where} icon not found: ${app.icon}`);
    }
    if (Array.isArray(app.screenshots)) {
      for (const s of app.screenshots) {
        const sp = join(ROOT, s);
        if (!existsSync(sp)) {
          throw new Error(`${where} screenshot not found: ${s}`);
        }
      }
    }
  }
}

export function validateSiteJson(site) {
  if (!site || typeof site !== 'object') {
    throw new Error('site.json must be an object');
  }
  if (!site.author || typeof site.author !== 'object') {
    throw new Error('site.json: author is required');
  }
  if (typeof site.author.name !== 'string' || !site.author.name) {
    throw new Error('site.json: author.name is required');
  }
  if (typeof site.author.tagline !== 'string' || !site.author.tagline) {
    throw new Error('site.json: author.tagline is required');
  }
  if (Array.isArray(site.author.social)) {
    for (const [i, s] of site.author.social.entries()) {
      if (typeof s.label !== 'string' || !s.label) {
        throw new Error(`site.json: author.social[${i}].label is required`);
      }
      if (typeof s.url !== 'string' || !s.url) {
        throw new Error(`site.json: author.social[${i}].url is required`);
      }
    }
  }
  if (!site.thoughts || typeof site.thoughts !== 'object') {
    throw new Error('site.json: thoughts is required');
  }
  if (Array.isArray(site.thoughts.tree)) {
    for (const [i, item] of site.thoughts.tree.entries()) {
      if (item.type === 'folder') {
        if (typeof item.name !== 'string' || !item.name) {
          throw new Error(`site.json: thoughts.tree[${i}].name is required`);
        }
        if (!Array.isArray(item.children)) {
          throw new Error(`site.json: thoughts.tree[${i}].children must be an array`);
        }
        for (const [j, child] of item.children.entries()) {
          if (child.type !== 'file') {
            throw new Error(`site.json: thoughts.tree[${i}].children[${j}].type must be "file"`);
          }
          if (typeof child.path !== 'string' || !child.path) {
            throw new Error(`site.json: thoughts.tree[${i}].children[${j}].path is required`);
          }
          if (typeof child.title !== 'string' || !child.title) {
            throw new Error(`site.json: thoughts.tree[${i}].children[${j}].title is required`);
          }
          if (typeof child.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(child.date)) {
            throw new Error(`site.json: thoughts.tree[${i}].children[${j}].date must be YYYY-MM-DD`);
          }
        }
      } else if (item.type === 'file') {
        if (typeof item.path !== 'string' || !item.path) {
          throw new Error(`site.json: thoughts.tree[${i}].path is required`);
        }
        if (typeof item.title !== 'string' || !item.title) {
          throw new Error(`site.json: thoughts.tree[${i}].title is required`);
        }
        if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(item.date)) {
          throw new Error(`site.json: thoughts.tree[${i}].date must be YYYY-MM-DD`);
        }
      } else {
        throw new Error(`site.json: thoughts.tree[${i}].type must be "folder" or "file"`);
      }
    }
  }
  if (Array.isArray(site.collections)) {
    const seen = new Set();
    for (const [i, c] of site.collections.entries()) {
      if (typeof c.slug !== 'string' || !c.slug) {
        throw new Error(`site.json: collections[${i}].slug is required`);
      }
      if (seen.has(c.slug)) {
        throw new Error(`site.json: duplicate collection slug: ${c.slug}`);
      }
      seen.add(c.slug);
      if (typeof c.title !== 'string' || !c.title) {
        throw new Error(`site.json: collections[${i}].title is required`);
      }
      if (!Array.isArray(c.appSlugs)) {
        throw new Error(`site.json: collections[${i}].appSlugs must be an array`);
      }
    }
  }
  if (site.now !== undefined) {
    if (typeof site.now !== 'object' || site.now === null) {
      throw new Error('site.json: now must be an object');
    }
    if (typeof site.now.text !== 'string' || !site.now.text) {
      throw new Error('site.json: now.text is required');
    }
    if (site.now.lastModified !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(site.now.lastModified)) {
      throw new Error('site.json: now.lastModified must be YYYY-MM-DD');
    }
  }
  if (site.uses !== undefined) {
    if (typeof site.uses !== 'object' || site.uses === null) {
      throw new Error('site.json: uses must be an object');
    }
    if (!Array.isArray(site.uses.categories)) {
      throw new Error('site.json: uses.categories must be an array');
    }
    for (const [i, cat] of site.uses.categories.entries()) {
      if (typeof cat.name !== 'string' || !cat.name) {
        throw new Error(`site.json: uses.categories[${i}].name is required`);
      }
      if (!Array.isArray(cat.items)) {
        throw new Error(`site.json: uses.categories[${i}].items must be an array`);
      }
      for (const [j, it] of cat.items.entries()) {
        if (typeof it.name !== 'string' || !it.name) {
          throw new Error(`site.json: uses.categories[${i}].items[${j}].name is required`);
        }
      }
    }
    if (site.uses.lastModified !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(site.uses.lastModified)) {
      throw new Error('site.json: uses.lastModified must be YYYY-MM-DD');
    }
  }
  if (site.colophon !== undefined) {
    if (typeof site.colophon !== 'object' || site.colophon === null) {
      throw new Error('site.json: colophon must be an object');
    }
    if (site.colophon.stack !== undefined) {
      if (typeof site.colophon.stack !== 'object' || site.colophon.stack === null) {
        throw new Error('site.json: colophon.stack must be an object');
      }
      for (const [k, v] of Object.entries(site.colophon.stack)) {
        if (typeof v !== 'string') {
          throw new Error(`site.json: colophon.stack.${k} must be a string`);
        }
      }
    }
    for (const f of ['philosophy', 'structure', 'acknowledgments']) {
      if (site.colophon[f] !== undefined && typeof site.colophon[f] !== 'string') {
        throw new Error(`site.json: colophon.${f} must be a string`);
      }
    }
    if (site.colophon.contribute !== undefined) {
      if (typeof site.colophon.contribute !== 'object' || site.colophon.contribute === null) {
        throw new Error('site.json: colophon.contribute must be an object');
      }
      for (const [k, v] of Object.entries(site.colophon.contribute)) {
        if (typeof v !== 'string') {
          throw new Error(`site.json: colophon.contribute.${k} must be a string`);
        }
      }
    }
    if (site.colophon.license !== undefined) {
      if (typeof site.colophon.license !== 'object' || site.colophon.license === null) {
        throw new Error('site.json: colophon.license must be an object');
      }
      for (const [k, v] of Object.entries(site.colophon.license)) {
        if (typeof v !== 'string') {
          throw new Error(`site.json: colophon.license.${k} must be a string`);
        }
      }
    }
  }
}

// --- walkThoughts --------------------------------------------------------

