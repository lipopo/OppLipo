import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { existsSync } from 'node:fs';

export const ROOT = dirname(fileURLToPath(import.meta.url));

export function omitPrivate(app) {
  const out = { ...app };
  if (out.private !== undefined) {
    delete out.private;
  }
  if (out.lifecycle && typeof out.lifecycle === 'object') {
    const { targetDate, ...lifecycleRest } = out.lifecycle;
    out.lifecycle = lifecycleRest;
  }
  return out;
}

export function deriveQuarter(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const month = d.getUTCMonth() + 1; // 1-12
  const q = Math.floor((month - 1) / 3) + 1; // 1-4
  return `Q${q} ${d.getUTCFullYear()}`;
}

const PLATFORM_TYPES = new Set([
  'android', 'ios', 'macos', 'windows', 'linux', 'web',
]);

const LIFECYCLE_STATUSES = new Set(['idea', 'in-development', 'beta', 'launched', 'archived']);

function parseISODate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(str)) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

const REQUIRED_FIELDS = ['slug', 'name', 'tagline', 'icon'];

// --- Validation -----------------------------------------------------------

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

function findMatchingEachEnd(template, afterStartTag) {
  // Find the matching {{/each}} for the {{#each}} whose body starts at afterStartTag.
  // Tracks nesting depth to handle nested {{#each}} blocks.
  let depth = 1;
  let pos = afterStartTag;
  while (pos < template.length) {
    const nextEach = template.indexOf('{{#each ', pos);
    const nextEnd = template.indexOf('{{/each}}', pos);
    if (nextEnd === -1) return -1;
    if (nextEach !== -1 && nextEach < nextEnd) {
      depth++;
      pos = nextEach + '{{#each '.length;
    } else {
      depth--;
      if (depth === 0) return nextEnd;
      pos = nextEnd + '{{/each}}'.length;
    }
  }
  return -1;
}

function processNestedEach(template, item) {
  // Process {{#each expr}} blocks in template, resolving expr against item.
  // Uses non-greedy matching for single-level nesting (no {{#each}} inside the body).
  const re = /\{\{#each\s+([^\s}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  return template.replace(re, (m, expr, body) => {
    const items = resolveExpr(expr, item);
    if (!Array.isArray(items)) return '';
    return items.map((subItem, subIdx) => {
      let piece = body;
      if (typeof subItem === 'string') {
        piece = piece.replace(/\{\{\.\}\}/g, escHtml(subItem));
      } else {
        piece = applyIf(piece, subItem);
        piece = applyUnless(piece, subItem);
        piece = piece.replace(/\{\{([^#/.}][^}]*)\}\}/g, (mm, k) => {
          const v = resolveExpr(k.trim(), subItem);
          return v == null ? '' : escHtml(v);
        });
      }
      piece = piece.replace(/\{\{@index\}\}/g, String(subIdx));
      return piece;
    }).join('');
  });
}

function applyEach(template, key, items, parentScope) {
  // {{#each key}}...{{/each}} with optional {{.}}, {{@index}}, parent fields via {{../field}}
  const startTag = `{{#each ${key}}}`;
  const start = template.indexOf(startTag);
  if (start === -1) return template;
  const afterStart = start + startTag.length;
  const end = findMatchingEachEnd(template, afterStart);
  if (end === -1) throw new Error(`template: unclosed {{#each ${key}}}`);
  const before = template.slice(0, start);
  const body = template.slice(afterStart, end);
  const after = template.slice(end + '{{/each}}'.length);
  const rendered = items.map((item, idx) => {
    let piece = body;
    if (typeof item === 'string') {
      piece = piece.replace(/\{\{\.\}\}/g, escHtml(item));
    } else {
      // Nested {{#each}} blocks within the body use the item's fields as data.
      piece = processNestedEach(piece, item);
      // If/Unless blocks within each body use the item as scope
      piece = applyIf(piece, item);
      piece = applyUnless(piece, item);
      piece = piece.replace(/\{\{([^#/.}][^}]*)\}\}/g, (m, k) => {
        const v = resolveExpr(k.trim(), item);
        return v == null ? '' : escHtml(v);
      });
    }
    // {{../field}} from parent scope
    piece = piece.replace(/\{\{\.\.\/([^}]+)\}\}/g, (m, k) => {
      const v = parentScope[k.trim()];
      return v == null ? '' : escHtml(v);
    });
    // {{@index}}
    piece = piece.replace(/\{\{@index\}\}/g, String(idx));
    return piece;
  }).join('');
  return before + rendered + applyEach(after, key, items, parentScope);
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

// Generic nesting-aware block processor for {{#if}} and {{#unless}}.
// Tracks nesting depth of the same keyword so that nested blocks are matched correctly.
function applyBlock(template, scope, keyword, invert) {
  const openTag = `{{#${keyword} `;
  const closeTag = `{{/${keyword}}}`;
  let result = '';
  let pos = 0;
  while (pos < template.length) {
    const openIdx = template.indexOf(openTag, pos);
    if (openIdx === -1) {
      result += template.slice(pos);
      break;
    }
    result += template.slice(pos, openIdx);
    const tagEnd = template.indexOf('}}', openIdx);
    if (tagEnd === -1) {
      result += template.slice(openIdx);
      break;
    }
    const expr = template.slice(openIdx + openTag.length, tagEnd).trim();
    // Find matching closing tag, tracking nesting of the same keyword only
    let depth = 1;
    let searchPos = tagEnd + 2;
    while (depth > 0 && searchPos < template.length) {
      const nextOpen = template.indexOf(openTag, searchPos);
      const nextClose = template.indexOf(closeTag, searchPos);
      if (nextClose === -1) {
        // Unclosed block — leave the rest as-is
        result += template.slice(openIdx);
        return result;
      }
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        searchPos = nextOpen + openTag.length;
      } else {
        depth--;
        searchPos = nextClose + closeTag.length;
      }
    }
    const body = template.slice(tagEnd + 2, searchPos - closeTag.length);
    const val = resolveExpr(expr, scope);
    const keep = invert ? !isTruthy(val) : isTruthy(val);
    if (keep) {
      result += body;
    }
    pos = searchPos;
  }
  return result;
}

function applyIf(template, scope) {
  // Re-apply to peel nested {{#if}} layers (each pass consumes one nesting level).
  let prev;
  let result = template;
  let safety = 100;
  do {
    prev = result;
    result = applyBlock(result, scope, 'if', false);
  } while (result !== prev && --safety > 0);
  return result;
}

function applyUnless(template, scope) {
  let prev;
  let result = template;
  let safety = 100;
  do {
    prev = result;
    result = applyBlock(result, scope, 'unless', true);
  } while (result !== prev && --safety > 0);
  return result;
}

function renderTemplate(tpl, scope) {
  let out = tpl;
  // Each blocks first
  for (const key of Object.keys(scope)) {
    if (Array.isArray(scope[key])) {
      out = applyEach(out, key, scope[key], scope);
    }
  }
  // If/Unless blocks
  out = applyIf(out, scope);
  out = applyUnless(out, scope);
  // Triple-brace {{{...}}} for raw, pre-escaped HTML.
  out = out.replace(/\{\{\{([^#/}][^}]*)\}\}\}/g, (m, k) => {
    const v = resolveExpr(k.trim(), scope);
    return v == null ? '' : String(v);
  });
  // Plain {{key}} substitution
  out = out.replace(/\{\{([^#/}][^}]*)\}\}/g, (m, k) => {
    const v = resolveExpr(k.trim(), scope);
    return v == null ? '' : escHtml(v);
  });
  return out;
}

// --- Render functions -----------------------------------------------------

const SITE_TAGLINE = '独立开发的多款 APP 介绍与下载';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

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

function roadmapScope(apps) {
  const statusOf = (a) => a.lifecycle?.status ?? 'launched';
  const now = apps.filter((a) => ['in-development', 'beta'].includes(statusOf(a)));
  const planned = apps
    .filter((a) => statusOf(a) === 'idea')
    .sort((a, b) => (a.lifecycle?.targetDate ?? 'zz').localeCompare(b.lifecycle?.targetDate ?? 'zz'));
  const shipped = apps
    .filter((a) => ['launched', 'archived'].includes(statusOf(a)))
    .sort((a, b) => (b.lifecycle?.releases?.[0]?.releasedAt ?? '').localeCompare(a.lifecycle?.releases?.[0]?.releasedAt ?? ''));

  const counts = (() => {
    const c = { idea: 0, 'in-development': 0, beta: 0, launched: 0, archived: 0 };
    for (const a of apps) c[statusOf(a)]++;
    return `idea ${c.idea} · in-development ${c['in-development']} · beta ${c.beta} · launched ${c.launched} · archived ${c.archived}`;
  })();

  const allBlockers = [];
  const allTodos = [];
  for (const a of apps) {
    for (const b of a.private?.blockers ?? []) allBlockers.push({ appName: a.name, blocker: b });
    for (const t of a.private?.todo ?? []) allTodos.push({ appName: a.name, todo: t });
  }

  // Enrich each app with topVersion / topReleasedAt for the template
  const enrich = (a) => ({
    ...a,
    topVersion: a.lifecycle?.releases?.[0]?.version ?? a.version ?? '?',
    topReleasedAt: a.lifecycle?.releases?.[0]?.releasedAt ?? a.releasedAt ?? '',
  });
  const nowE = now.map(enrich);
  const plannedE = planned.map(enrich);
  const shippedE = shipped.map(enrich);

  // Flatten the cross-app lists for {{#each}} in template
  const flatten = (items, key) => items.map((x) => ({ appName: x.appName, [key]: x[key] }));
  const flatBlockers = flatten(allBlockers, 'blocker').map((x) => ({ appName: x.appName, '.': x.blocker }));
  const flatTodos = flatten(allTodos, 'todo').map((x) => ({ appName: x.appName, '.': x.todo }));

  return {
    today: todayISO(),
    counts,
    now: nowE,
    planned: plannedE,
    shipped: shippedE,
    allBlockers: flatBlockers,
    allTodos: flatTodos,
  };
}

function appsContext(apps) {
  const enriched = apps.map((a) => {
    const primary = a.platforms.find((p) => p.primary) || a.platforms[0];
    const others = a.platforms.filter((p) => p !== primary);
    const status = a.lifecycle?.status ?? 'launched';
    const statusLaunchedOrBeta = status === 'launched' || status === 'beta';
    const statusIsInDevOrIdea = status === 'in-development' || status === 'idea';
    const statusBadge = status === 'beta' ? 'Beta' : null;  // 'launched' has no badge
    return {
      ...a,
      primaryPlatform: primary,
      otherPlatforms: others,
      url: `/apps/${a.slug}/`,
      status,
      statusLaunchedOrBeta,
      statusIsInDevOrIdea,
      statusBadge,
      statusBadgeKey: statusBadge ? status : null,
      targetQuarter: a.lifecycle?.targetQuarter ?? null,
    };
  });
  const hasComingSoon = enriched.some((a) => a.statusIsInDevOrIdea);
  return {
    apps: enriched,
    hasComingSoon,
    assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
    'assets.styles': '/assets/styles.css',
    'assets.app': '/assets/app.js',
    'site.tagline': SITE_TAGLINE,
  };
}

export const render = {
  async home(apps) {
    const tpl = await readFile(join(ROOT, 'templates', 'home.html'), 'utf8');
    const featuredApps = apps.filter((a) => a.featured);

    // Enrich featured apps with status badges and CTA fields (same logic as appsContext + render.app)
    const enrichedFeaturedApps = featuredApps.map((a) => {
      const status = a.lifecycle?.status ?? 'launched';
      const statusBadge = status === 'beta' ? 'Beta' : null;
      const statusBadgeKey = status === 'beta' ? 'beta' : null;
      // CTA: for in-development/idea, prefer betaSignupUrl; for launched/beta, use primaryPlatform
      let primaryCtaUrl = null;
      let primaryCtaLabel = null;
      if (status === 'in-development' || status === 'idea') {
        if (a.lifecycle?.betaSignupUrl) {
          primaryCtaUrl = a.lifecycle.betaSignupUrl;
          primaryCtaLabel = '加入内测';
        }
      } else {
        const primary = a.platforms.find((p) => p.primary) || a.platforms[0];
        if (primary) {
          primaryCtaUrl = primary.url;
          primaryCtaLabel = primary.label;
        }
      }
      return {
        ...a,
        statusBadge,
        statusBadgeKey,
        primaryCtaUrl,
        primaryCtaLabel,
      };
    });

    const recentReleases = aggregateRecentReleases(apps);
    const scope = {
      ...appsContext(apps),
      site: { tagline: SITE_TAGLINE },
      featuredApps: enrichedFeaturedApps,
      recentReleases,
      hasFeaturedApps: enrichedFeaturedApps.length > 0,
      hasRecentReleases: recentReleases.length > 0,
    };
    scope['site.tagline'] = SITE_TAGLINE;
    return renderTemplate(tpl, scope);
  },

  async app(app) {
    const tpl = await readFile(join(ROOT, 'templates', 'app.html'), 'utf8');
    const status = app.lifecycle?.status ?? 'launched';
    // Decide primary CTA: for in-development/idea, prefer betaSignupUrl; for launched/beta, use primaryPlatform.
    let primaryCtaUrl = null;
    let primaryCtaLabel = null;
    if (status === 'in-development' || status === 'idea') {
      if (app.lifecycle?.betaSignupUrl) {
        primaryCtaUrl = app.lifecycle.betaSignupUrl;
        primaryCtaLabel = '加入内测';
      }
    } else {
      const primary = app.platforms.find((p) => p.primary) || app.platforms[0];
      if (primary) {
        primaryCtaUrl = primary.url;
        primaryCtaLabel = primary.label;
      }
    }
    // Status badge in hero meta: 'launched' has no badge, others get a text + class key.
    let statusBadge = null;
    let statusBadgeKey = null;
    if (status === 'beta') { statusBadge = 'Beta'; statusBadgeKey = 'beta'; }
    else if (status === 'in-development' || status === 'idea') { statusBadge = 'In development'; statusBadgeKey = 'in-development'; }
    else if (status === 'archived') { statusBadge = '已归档'; statusBadgeKey = 'archived'; }

    const enriched = {
      ...app,
      status,
      statusBadge,
      statusBadgeKey,
      primaryCtaUrl,
      primaryCtaLabel,
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

  async roadmap(apps) {
    const tpl = await readFile(join(ROOT, 'templates', 'roadmap.html'), 'utf8');
    return renderTemplate(tpl, roadmapScope(apps));
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
  const exists = await pathExists(join(ROOT, 'assets'));
  if (!exists) throw new Error('assets/ directory missing at repo root');
}

// --- Main -----------------------------------------------------------------

async function main() {
  const appsPath = join(ROOT, 'apps.json');
  const apps = JSON.parse(await readFile(appsPath, 'utf8'));
  validate(apps);
  await copyAssets();

  // Public build: strip private + lifecycle.targetDate, then derive public quarter.
  const publicApps = apps.map((app) => {
    const sanitized = omitPrivate(app);
    if (sanitized.lifecycle && app.lifecycle?.targetDate) {
      const q = deriveQuarter(app.lifecycle.targetDate);
      if (q) sanitized.lifecycle = { ...sanitized.lifecycle, targetQuarter: q };
    }
    return sanitized;
  });

  await writeOutputs(publicApps);

  if (process.argv.includes('--private')) {
    const html = await render.roadmap(apps);
    await writeFile(join(ROOT, 'roadmap.html'), html, 'utf8');
    console.log(`✓ wrote roadmap.html (private)`);
  }

  console.log(`✓ built ${apps.length} app page(s)`);
}

// NOTE: Entry-point guard from Task 3 fix — use pathToFileURL for cross-platform correctness.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(`Build failed: ${err.message}`);
    process.exit(1);
  });
}
