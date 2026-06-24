import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
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

export function walkThoughts(site) {
  const tree = site.thoughts?.tree ?? [];
  const out = [];
  for (const item of tree) {
    if (item.type === 'file') {
      out.push(loadThought(item, null));
    } else if (item.type === 'folder') {
      for (const child of item.children) {
        out.push(loadThought(child, item.name));
      }
    }
  }
  return out;
}

function loadThought(item, folder) {
  if (!existsSync(item.path)) {
    throw new Error(`thought file not found: ${item.path}`);
  }
  const raw = readFileSync(item.path, 'utf8');
  const { frontmatter, body } = parseFrontmatter(raw);
  return {
    path: item.path,
    title: item.title,
    date: item.date,
    excerpt: item.excerpt ?? frontmatter.excerpt ?? '',
    appSlugs: item.appSlugs ?? frontmatter.appSlugs ?? [],
    folder,
    slug: slugify(item.path),
    body,
  };
}

function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { frontmatter: {}, body: md };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    // Strip surrounding quotes
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    // Parse [a, b, c] as array
    if (v.startsWith('[') && v.endsWith(']')) {
      fm[k] = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    } else {
      fm[k] = v;
    }
  }
  return { frontmatter: fm, body: m[2] };
}

// --- Template engine ------------------------------------------------------

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function extractText(md) {
  if (typeof md !== 'string') return '';
  let s = md;
  s = s.replace(/```[\w]*\n?[\s\S]*?```/g, ' ');
  s = s.replace(/`([^`\n]+)`/g, '$1');
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  s = s.replace(/^#+\s+/gm, '');
  s = s.replace(/(\*\*|__)(.*?)\1/g, '$2');
  s = s.replace(/(\*|_)(.*?)\1/g, '$2');
  s = s.replace(/~~(.*?)~~/g, '$1');
  s = s.replace(/^>\s*/gm, '');
  s = s.replace(/^[\s]*[-*+]\s+/gm, '');
  s = s.replace(/^\s*\d+\.\s+/gm, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function computeReadingMinutes(text) {
  if (typeof text !== 'string' || !text) return 1;
  const clean = extractText(text);
  const chinese = (clean.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) ?? []).length;
  const english = (clean.match(/[a-zA-Z]+/g) ?? []).length;
  const minutes = Math.ceil(chinese / 350 + english / 200);
  return Math.max(1, minutes);
}

export function computeRelated(current, all) {
  const out = [];
  for (const other of all ?? []) {
    if (other.slug === current.slug) continue;
    let score = 0;
    const sharedApps = (current.appSlugs ?? [])
      .filter((a) => (other.appSlugs ?? []).includes(a));
    score += sharedApps.length * 2;
    if (current.folder && other.folder && current.folder === other.folder) score += 1;
    if (score > 0) out.push({ t: other, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 3).map((x) => x.t);
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

export function renderMarkdown(md) {
  // Extract fenced code blocks and blockquote regions first (before HTML
  // escape, so the `>` markers survive) and replace them with placeholders
  // that we re-inject at the end. This keeps block-level HTML out of the
  // line-by-line pass, which is what lets a code-block-only or
  // blockquote-only document avoid getting wrapped in <p>...</p>.
  let src = String(md);

  // Extract fenced code blocks.
  const codeBlocks = [];
  src = src.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, body) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code class="lang-${lang || 'plain'}">${escHtml(body.replace(/\n$/, ''))}</code></pre>`);
    return `\u0000CODE${idx}\u0000`;
  });

  // Extract blockquote regions (consecutive `> ...` lines, separated from
  // other content by blank lines). Each region becomes a single placeholder
  // that we expand to <blockquote>...</blockquote> at the end. We do this
  // BEFORE HTML-escaping so the leading `>` isn't turned into `&gt;`.
  const quotes = [];
  src = src.replace(/(^|\n)(?:> ?[^\n]*(?:\n> ?[^\n]*)*\n?)+/g, (m) => {
    // Pull out the individual `> ...` lines (dropping the `> ` prefix)
    // and HTML-escape each. A bare `>` becomes an empty line. We escape
    // here because the global escape pass below would otherwise turn any
    // `<` or `>` we keep as-is into entities.
    const inner = m
      .replace(/^\n/, '')
      .split('\n')
      .map((l) => (l === '>' ? '' : l.replace(/^> ?/, '')))
      .map(escHtml)
      .join('<br>');
    const idx = quotes.length;
    quotes.push(`<blockquote>${inner}</blockquote>`);
    return `\u0000QUOTE${idx}\u0000`;
  });

  // Escape HTML everywhere except our placeholders.
  src = escHtml(src);

  // Inline code (backticks): extract then re-inject escaped content.
  const inlineCodes = [];
  src = src.replace(/`([^`\n]+)`/g, (m, body) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code>${body}</code>`);  // body was already escaped above
    return `\u0000IC${idx}\u0000`;
  });

  // Split into lines for block-level processing.
  const lines = src.split(/\r?\n/);
  const out = [];
  let para = [];
  let list = null;     // null | { type: 'ul' | 'ol', items: [] }

  const flushPara = () => {
    if (para.length) { out.push(`<p>${para.join(' ')}</p>`); para = []; }
  };
  const flushList = () => {
    if (list) {
      const tag = list.type;
      out.push(`<${tag}>${list.items.map((i) => `<li>${i}</li>`).join('')}</${tag}>`);
      list = null;
    }
  };
  const flushAll = () => { flushPara(); flushList(); };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Block-level placeholder (fenced code block or blockquote): emit as-is
    // and don't start a paragraph around it.
    if (/^\u0000(CODE|QUOTE)\d+\u0000$/.test(line)) {
      flushAll();
      out.push(line);
      continue;
    }

    // Headings
    if (line.startsWith('## ')) { flushAll(); out.push(`<h2>${line.slice(3)}</h2>`); continue; }
    if (line.startsWith('# '))  { flushAll(); out.push(`<h1>${line.slice(2)}</h1>`); continue; }

    // Unordered list
    if (/^[-*] /.test(line)) {
      flushPara();
      if (list && list.type !== 'ul') flushList();
      list = list || { type: 'ul', items: [] };
      list.items.push(line.slice(2));
      continue;
    }
    // Ordered list
    if (/^\d+\. /.test(line)) {
      flushPara();
      if (list && list.type !== 'ol') flushList();
      list = list || { type: 'ol', items: [] };
      list.items.push(line.replace(/^\d+\. /, ''));
      continue;
    }
    if (list) flushList();

    // Empty line = paragraph break
    if (line.trim() === '') { flushPara(); continue; }

    para.push(line);
  }
  flushAll();

  let html = out.join('\n');

  // Emphasis (do this on the joined HTML, after block processing).
  // Bold: **x** -> <strong>x</strong>
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  // Italic: *x* -> <em>x</em>  (avoid colliding with bold by requiring non-asterisk on both sides)
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Restore code blocks, blockquotes, and inline code.
  html = html.replace(/\u0000CODE(\d+)\u0000/g, (m, i) => codeBlocks[Number(i)]);
  html = html.replace(/\u0000QUOTE(\d+)\u0000/g, (m, i) => quotes[Number(i)]);
  html = html.replace(/\u0000IC(\d+)\u0000/g, (m, i) => inlineCodes[Number(i)]);

  return html;
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
        // {{@index}} — must run BEFORE generic {{key}} substitution (which eats @index)
        piece = piece.replace(/\{\{@index\}\}/g, String(subIdx));
        piece = applyIf(piece, subItem);
        piece = applyUnless(piece, subItem);
        // Triple-brace {{{key}}} for raw HTML — must run BEFORE double-brace
        // (otherwise the double-brace regex eats the inner {{key}} part and leaves
        // a stray `}` artifact).
        piece = piece.replace(/\{\{\{([^#/}][^}]*)\}\}\}/g, (mm, k) => {
          const v = resolveExpr(k.trim(), subItem);
          return v == null ? '' : String(v);
        });
        piece = piece.replace(/\{\{([^#/.}][^}]*)\}\}/g, (mm, k) => {
          const v = resolveExpr(k.trim(), subItem);
          return v == null ? '' : escHtml(v);
        });
      }
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
      // {{@index}} — must run BEFORE generic {{key}} substitution (which eats @index)
      piece = piece.replace(/\{\{@index\}\}/g, String(idx));
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

export function buildSearchIndex(apps, site, thoughts) {
  const items = [];

  for (const a of apps) {
    const parts = [a.tagline, a.description, (a.highlights ?? []).join(' ')].filter(Boolean);
    items.push({
      type: 'app',
      title: a.name,
      url: `/apps/${a.slug}/`,
      content: extractText(parts.join(' ')),
    });
  }

  for (const t of thoughts) {
    const parts = [t.excerpt, t.body].filter(Boolean);
    items.push({
      type: 'thought',
      title: t.title,
      url: `/thoughts/${t.slug}/`,
      content: extractText(parts.join(' ')),
    });
  }

  for (const c of site.collections ?? []) {
    items.push({
      type: 'collection',
      title: c.title,
      url: `/collections/${c.slug}/`,
      content: extractText(c.description ?? ''),
    });
  }

  if (site.now?.text) {
    items.push({
      type: 'now',
      title: '现在',
      url: '/now/',
      content: extractText(site.now.text),
    });
  }

  for (const cat of site.uses?.categories ?? []) {
    for (const it of cat.items ?? []) {
      items.push({
        type: 'use',
        title: it.name,
        url: '/uses/',
        content: extractText([it.notes ?? ''].join(' ')),
      });
    }
  }

  if (site.author) {
    const labels = (site.author.social ?? []).map((s) => s.label).join(' ');
    const parts = [site.author.tagline, site.author.bio, labels].filter(Boolean);
    items.push({
      type: 'about',
      title: site.author.name,
      url: '/about/',
      content: extractText(parts.join(' ')),
    });
  }

  return { generatedAt: new Date().toISOString(), items };
}

// ---- RSS feed (Atom 1.0) -----------------------------------------------

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildAtomFeed(publicApps, site, thoughts) {
  const baseUrl = 'https://info.opplipo.cn';
  const items = [];

  for (const t of thoughts) {
    items.push({
      title: t.title,
      url: `${baseUrl}/thoughts/${t.slug}/`,
      id: `${baseUrl}/thoughts/${t.slug}/`,
      updated: `${t.date}T00:00:00Z`,
      contentHtml: renderMarkdown(t.body),
    });
  }

  for (const a of publicApps) {
    for (const r of (a.lifecycle?.releases ?? [])) {
      items.push({
        title: `${a.name} v${r.version}`,
        url: `${baseUrl}/apps/${a.slug}/`,
        id: `${baseUrl}/apps/${a.slug}/#v${r.version}`,
        updated: `${r.releasedAt}T00:00:00Z`,
        contentHtml: renderMarkdown(r.notes ?? ''),
      });
    }
  }

  if (site.now?.lastModified && site.now?.text) {
    items.push({
      title: '现在 更新',
      url: `${baseUrl}/now/`,
      id: `${baseUrl}/now/#${site.now.lastModified}`,
      updated: `${site.now.lastModified}T00:00:00Z`,
      contentHtml: renderMarkdown(site.now.text),
    });
  }

  if (site.uses?.lastModified && site.uses?.categories) {
    const synth = site.uses.categories.map((c) =>
      `## ${c.name}\n\n` + c.items.map((i) => `- **${i.name}** — ${i.notes ?? ''}`).join('\n')
    ).join('\n\n');
    items.push({
      title: '使用 更新',
      url: `${baseUrl}/uses/`,
      id: `${baseUrl}/uses/#${site.uses.lastModified}`,
      updated: `${site.uses.lastModified}T00:00:00Z`,
      contentHtml: renderMarkdown(synth),
    });
  }

  const allReleases = aggregateRecentReleases(publicApps, Infinity);
  if (allReleases.length > 0) {
    const topThree = allReleases.slice(0, 3);
    const md = topThree
      .map((r) => `- **${r.appName} v${r.version}** (${r.releasedAt}) — ${r.notes ?? '—'}`)
      .join('\n');
    const latestDate = allReleases[0]?.releasedAt ?? new Date().toISOString().slice(0, 10);
    items.push({
      title: '发布记录 更新',
      url: `${baseUrl}/changelog/`,
      id: `${baseUrl}/changelog/#${latestDate}`,
      updated: `${latestDate}T00:00:00Z`,
      contentHtml: renderMarkdown(`## 最新发布\n\n${md}`),
    });
  }

  items.sort((a, b) => b.updated.localeCompare(a.updated));
  const feedUpdated = items[0]?.updated ?? new Date().toISOString();
  return { feedUpdated, items };
}

export function renderAtomXml(feed) {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<feed xmlns="http://www.w3.org/2005/Atom">');
  lines.push('  <title>info.opplipo.cn</title>');
  lines.push('  <link href="https://info.opplipo.cn/" />');
  lines.push('  <link rel="self" href="https://info.opplipo.cn/feed.xml" />');
  lines.push('  <id>https://info.opplipo.cn/</id>');
  lines.push(`  <updated>${feed.feedUpdated}</updated>`);
  for (const item of feed.items) {
    lines.push('  <entry>');
    lines.push(`    <title>${xmlEscape(item.title)}</title>`);
    lines.push(`    <link href="${xmlEscape(item.url)}" />`);
    lines.push(`    <id>${xmlEscape(item.id)}</id>`);
    lines.push(`    <updated>${item.updated}</updated>`);
    lines.push(`    <content type="html"><![CDATA[${item.contentHtml}]]></content>`);
    lines.push('  </entry>');
  }
  lines.push('</feed>');
  return lines.join('\n') + '\n';
}

// ---- Sitemap ------------------------------------------------------------

export function buildSitemap(publicApps, site, thoughts) {
  const base = 'https://info.opplipo.cn';
  const today = new Date().toISOString().slice(0, 10);
  const urls = [];

  urls.push({ loc: `${base}/`, lastmod: today });
  urls.push({ loc: `${base}/about/`, lastmod: today });
  urls.push({ loc: `${base}/thoughts/`, lastmod: today });
  urls.push({ loc: `${base}/collections/`, lastmod: today });
  if (site.now) urls.push({ loc: `${base}/now/`, lastmod: site.now.lastModified ?? today });
  if (site.uses) urls.push({ loc: `${base}/uses/`, lastmod: site.uses.lastModified ?? today });
  urls.push({ loc: `${base}/search/`, lastmod: today });
  if (site.colophon) urls.push({ loc: `${base}/colophon/`, lastmod: today });
  if (aggregateRecentReleases(publicApps, Infinity).length > 0) {
    urls.push({ loc: `${base}/changelog/`, lastmod: today });
  }
  urls.push({ loc: `${base}/archive/`, lastmod: today });

  for (const a of publicApps) {
    urls.push({ loc: `${base}/apps/${a.slug}/`, lastmod: a.releasedAt ?? today });
  }

  for (const t of thoughts) {
    urls.push({ loc: `${base}/thoughts/${t.slug}/`, lastmod: t.date });
  }

  for (const c of site.collections ?? []) {
    urls.push({ loc: `${base}/collections/${c.slug}/`, lastmod: today });
  }

  return { urls };
}

export function renderSitemap(sitemap) {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  for (const u of sitemap.urls) {
    lines.push('  <url>');
    lines.push(`    <loc>${u.loc}</loc>`);
    lines.push(`    <lastmod>${u.lastmod}</lastmod>`);
    lines.push('  </url>');
  }
  lines.push('</urlset>');
  return lines.join('\n') + '\n';
}

export function validateSearchIndex(index) {
  const items = index?.items;
  if (!Array.isArray(items)) {
    throw new Error('search index: items must be an array');
  }
  const validTypes = new Set(['thought', 'app', 'collection', 'now', 'use', 'about']);
  for (const [i, item] of items.entries()) {
    if (!validTypes.has(item.type)) {
      throw new Error(`search index: items[${i}].type is invalid: ${item.type}`);
    }
    if (typeof item.title !== 'string' || !item.title) {
      throw new Error(`search index: items[${i}].title is required`);
    }
    if (typeof item.url !== 'string' || !item.url) {
      throw new Error(`search index: items[${i}].url is required`);
    }
    if (typeof item.content !== 'string') {
      throw new Error(`search index: items[${i}].content is required`);
    }
  }
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
    year: String(new Date().getFullYear()),
  };
}

export const render = {
  async home(apps, site, thoughts) {
    const tpl = await readFile(join(ROOT, 'templates', 'home.html'), 'utf8');
    const featuredApps = apps.filter((a) => a.featured);

    // Enrich featured apps with status badges and CTA fields (same logic as appsContext + render.app)
    const enrichedFeaturedApps = featuredApps.map((a, idx) => {
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
        targetQuarter: a.lifecycle?.targetQuarter ?? null,
        firstDotActive: idx === 0,
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
      thoughtCount: (thoughts ?? []).length,
      collectionCount: (site?.collections ?? []).length,
      nowUpdatedAt: site?.now?.text ? new Date().toISOString().slice(0, 10) : '—',
      usesItemCount: (site?.uses?.categories ?? []).reduce(
        (sum, c) => sum + (c.items?.length ?? 0), 0),
      changelogCount: aggregateRecentReleases(apps, Infinity).length,
    };
    scope['site.tagline'] = SITE_TAGLINE;
    return renderTemplate(tpl, scope);
  },

  async app(app, thoughts) {
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

    const relatedThoughts = (thoughts ?? []).filter((t) => {
      const refs = t.appSlugs ?? [];
      return refs.includes(app.slug) || (app.thoughtSlugs ?? []).includes(t.slug);
    });

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
      relatedThoughts,
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

  async about(site) {
    const tpl = await readFile(join(ROOT, 'templates', 'about.html'), 'utf8');
    const scope = {
      ...site,
      author: {
        ...site.author,
        bioHtml: site.author.bio ? renderMarkdown(site.author.bio) : '',
      },
      authorBioHtml: site.author.bio ? renderMarkdown(site.author.bio) : '',
      social: site.author.social ?? [],
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
    };
    return renderTemplate(tpl, scope);
  },

  async thoughtsIndex(site, thoughts) {
    const tpl = await readFile(join(ROOT, 'templates', 'thoughts-index.html'), 'utf8');
    // Build tree structure for template (preserves folder grouping).
    const tree = site.thoughts?.tree ?? [];
    const treeForTemplate = tree.map((item) => {
      if (item.type === 'folder') {
        return {
          isFolder: true,
          name: item.name,
          children: item.children.map((c) => {
            const t = thoughts.find((x) => x.path === c.path);
            return { slug: t ? t.slug : slugify(c.path), title: c.title };
          }),
        };
      } else {
        const t = thoughts.find((x) => x.path === item.path);
        return { isFile: true, slug: t ? t.slug : slugify(item.path), title: item.title };
      }
    });
    // Recent 10 thoughts, sorted by date desc
    const recentThoughts = [...thoughts]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10)
      .map((t) => ({ slug: t.slug, title: t.title, date: t.date }));
    const scope = {
      ...site,
      treeForTemplate,
      recentThoughts,
      thoughtCount: thoughts.length,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
    };
    return renderTemplate(tpl, scope);
  },

  async collectionsIndex(site, apps) {
    const tpl = await readFile(join(ROOT, 'templates', 'collections-index.html'), 'utf8');
    const scope = {
      ...site,
      apps,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
    };
    return renderTemplate(tpl, scope);
  },

  async collectionPage(collection, apps, site) {
    const tpl = await readFile(join(ROOT, 'templates', 'collection.html'), 'utf8');
    const filteredApps = apps.filter((a) => collection.appSlugs.includes(a.slug));
    const scope = {
      ...collection,
      apps: filteredApps,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
    };
    return renderTemplate(tpl, scope);
  },

  async now(site) {
    const tpl = await readFile(join(ROOT, 'templates', 'now.html'), 'utf8');
    const scope = {
      ...site,
      now: { ...site.now, html: site.now?.text ? renderMarkdown(site.now.text) : '' },
      updatedAt: new Date().toISOString().slice(0, 10),
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
    };
    return renderTemplate(tpl, scope);
  },

  async uses(site) {
    const tpl = await readFile(join(ROOT, 'templates', 'uses.html'), 'utf8');
    const categories = (site.uses?.categories ?? []).map((cat) => ({
      ...cat,
      items: (cat.items ?? []).map((it) => ({
        ...it,
        notesHtml: it.notes ? renderMarkdown(it.notes) : '',
      })),
    }));
    const scope = {
      ...site,
      uses: { ...site.uses, categories },
      // Hoist categories to top-level so the engine's applyEach picks it up
      // (engine only iterates top-level array keys).
      categories,
      itemCount: categories.reduce((sum, c) => sum + c.items.length, 0),
      categoryCount: categories.length,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
    };
    return renderTemplate(tpl, scope);
  },

  async search(site) {
    const tpl = await readFile(join(ROOT, 'templates', 'search.html'), 'utf8');
    const scope = {
      ...site,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
    };
    return renderTemplate(tpl, scope);
  },

  async notFound(requestedPath = '/') {
    const tpl = await readFile(join(ROOT, 'templates', '404.html'), 'utf8');
    const scope = {
      requestedPath,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
    };
    return renderTemplate(tpl, scope);
  },

  async changelog(site, apps) {
    const tpl = await readFile(join(ROOT, 'templates', 'changelog.html'), 'utf8');
    const scope = {
      ...site,
      releases: aggregateRecentReleases(apps, Infinity),
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
    };
    return renderTemplate(tpl, scope);
  },

  async archive(site, thoughts) {
    const tpl = await readFile(join(ROOT, 'templates', 'archive.html'), 'utf8');
    const sorted = [...(thoughts ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    const scope = {
      ...site,
      items: sorted,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
    };
    return renderTemplate(tpl, scope);
  },

  async colophon(site) {
    const tpl = await readFile(join(ROOT, 'templates', 'colophon.html'), 'utf8');
    const c = site.colophon ?? {};
    const scope = {
      ...site,
      colophon: {
        ...c,
        philosophyHtml: c.philosophy ? renderMarkdown(c.philosophy) : '',
        structureHtml: c.structure ? renderMarkdown(c.structure) : '',
      },
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
    };
    return renderTemplate(tpl, scope);
  },

  async thoughtPage(thought, allThoughts, site) {
    const tpl = await readFile(join(ROOT, 'templates', 'thought.html'), 'utf8');
    // Build the file tree in the same order as the index page.
    // If the tree is empty (e.g. in tests), fall back to a flat list of
    // all thoughts so the sidebar is still meaningful.
    const tree = site.thoughts?.tree ?? [];
    let treeForTemplate;
    if (tree.length > 0) {
      treeForTemplate = tree.map((item) => {
        if (item.type === 'folder') {
          return {
            isFolder: true,
            name: item.name,
            children: item.children.map((c) => {
              const t = allThoughts.find((x) => x.path === c.path);
              return {
                slug: t ? t.slug : slugify(c.path),
                title: c.title,
                isActive: t && t.slug === thought.slug,
              };
            }),
          };
        } else {
          const t = allThoughts.find((x) => x.path === item.path);
          return {
            isFile: true,
            slug: t ? t.slug : slugify(item.path),
            title: item.title,
            isActive: t && t.slug === thought.slug,
          };
        }
      });
    } else {
      // Flat-list fallback: bucket thoughts by folder, preserving the order
      // they appear in `allThoughts` (top-level files first, then folders
      // grouped by first occurrence).
      const folders = new Map();
      const topFiles = [];
      for (const t of allThoughts) {
        if (t.folder) {
          if (!folders.has(t.folder)) folders.set(t.folder, []);
          folders.get(t.folder).push(t);
        } else {
          topFiles.push(t);
        }
      }
      treeForTemplate = [
        ...topFiles.map((t) => ({
          isFile: true,
          slug: t.slug,
          title: t.title,
          isActive: t.slug === thought.slug,
        })),
        ...[...folders.entries()].map(([name, items]) => ({
          isFolder: true,
          name,
          children: items.map((t) => ({
            slug: t.slug,
            title: t.title,
            isActive: t.slug === thought.slug,
          })),
        })),
      ];
    }
    // Prev/next: top-down order. When the tree is non-empty, follow the
    // tree's order; otherwise follow the order of `allThoughts` itself.
    const flat = [];
    if (tree.length > 0) {
      for (const item of tree) {
        if (item.type === 'file') flat.push(item.path);
        else if (item.type === 'folder') for (const c of item.children) flat.push(c.path);
      }
    } else {
      for (const t of allThoughts) flat.push(t);
    }
    const idx = tree.length > 0
      ? flat.indexOf(thought.path)
      : flat.findIndex((t) => t.slug === thought.slug);
    const prevEntry = idx > 0 ? flat[idx - 1] : null;
    const nextEntry = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;
    const prev = prevEntry
      ? (tree.length > 0
          ? allThoughts.find((x) => x.path === prevEntry)
          : prevEntry)
      : null;
    const next = nextEntry
      ? (tree.length > 0
          ? allThoughts.find((x) => x.path === nextEntry)
          : nextEntry)
      : null;
    const scope = {
      ...thought,
      contentHtml: renderMarkdown(thought.body),
      treeForTemplate,
      prev: prev ? { slug: prev.slug, title: prev.title } : null,
      next: next ? { slug: next.slug, title: next.title } : null,
      related: computeRelated(thought, allThoughts),
      readingMinutes: computeReadingMinutes(thought.body),
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
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

async function writeOutputs(publicApps, site, thoughts) {
  // 1. index.html at root
  const home = await render.home(publicApps, site, thoughts);
  await writeIfChanged(join(ROOT, 'index.html'), home);

  // 2. apps/<slug>/index.html for each
  for (const app of publicApps) {
    const dir = join(ROOT, 'apps', app.slug);
    await mkdir(dir, { recursive: true });
    const html = await render.app(app, thoughts);
    await writeIfChanged(join(dir, 'index.html'), html);
  }

  // 3. /about/
  const aboutDir = join(ROOT, 'about');
  await mkdir(aboutDir, { recursive: true });
  const aboutHtml = await render.about(site);
  await writeIfChanged(join(aboutDir, 'index.html'), aboutHtml);

  // 4. /thoughts/ and /thoughts/<slug>/
  const thoughtsDir = join(ROOT, 'thoughts');
  await mkdir(thoughtsDir, { recursive: true });
  const thoughtsIndexHtml = await render.thoughtsIndex(site, thoughts);
  await writeIfChanged(join(thoughtsDir, 'index.html'), thoughtsIndexHtml);
  for (const t of thoughts) {
    const dir = join(thoughtsDir, t.slug);
    await mkdir(dir, { recursive: true });
    const html = await render.thoughtPage(t, thoughts, site);
    await writeIfChanged(join(dir, 'index.html'), html);
  }

  // 5. /collections/ and /collections/<slug>/
  const collDir = join(ROOT, 'collections');
  await mkdir(collDir, { recursive: true });
  const collIndexHtml = await render.collectionsIndex(site, publicApps);
  await writeIfChanged(join(collDir, 'index.html'), collIndexHtml);
  for (const c of (site.collections ?? [])) {
    const dir = join(collDir, c.slug);
    await mkdir(dir, { recursive: true });
    const html = await render.collectionPage(c, publicApps, site);
    await writeIfChanged(join(dir, 'index.html'), html);
  }

  // 6. /now/ (conditional)
  if (site.now) {
    const nowDir = join(ROOT, 'now');
    await mkdir(nowDir, { recursive: true });
    const nowHtml = await render.now(site);
    await writeIfChanged(join(nowDir, 'index.html'), nowHtml);
  }

  // 7. /uses/ (conditional)
  if (site.uses) {
    const usesDir = join(ROOT, 'uses');
    await mkdir(usesDir, { recursive: true });
    const usesHtml = await render.uses(site);
    await writeIfChanged(join(usesDir, 'index.html'), usesHtml);
  }

  // 8. /search/
  const searchDir = join(ROOT, 'search');
  await mkdir(searchDir, { recursive: true });
  const searchHtml = await render.search(site);
  await writeIfChanged(join(searchDir, 'index.html'), searchHtml);

  // 9. assets/search-index.json (always written)
  const searchIndex = buildSearchIndex(publicApps, site, thoughts);
  validateSearchIndex(searchIndex);
  await mkdir(join(ROOT, 'assets'), { recursive: true });
  await writeIfChanged(
    join(ROOT, 'assets', 'search-index.json'),
    JSON.stringify(searchIndex)
  );

  // 10. /feed.xml (Atom)
  const feed = buildAtomFeed(publicApps, site, thoughts);
  const feedXml = renderAtomXml(feed);
  await writeIfChanged(join(ROOT, 'feed.xml'), feedXml);

  // 11. /404.html + /404/index.html
  const notFoundHtml = await render.notFound();
  await writeIfChanged(join(ROOT, '404.html'), notFoundHtml);
  const notFoundDir = join(ROOT, '404');
  await mkdir(notFoundDir, { recursive: true });
  await writeIfChanged(join(notFoundDir, 'index.html'), notFoundHtml);

  // 12. /sitemap.xml
  const sitemap = buildSitemap(publicApps, site, thoughts);
  const sitemapXml = renderSitemap(sitemap);
  await writeIfChanged(join(ROOT, 'sitemap.xml'), sitemapXml);

  // 13. /robots.txt
  const robotsTxt = 'User-agent: *\nAllow: /\nSitemap: https://info.opplipo.cn/sitemap.xml\n';
  await writeIfChanged(join(ROOT, 'robots.txt'), robotsTxt);

  // 14. /colophon/ (conditional)
  if (site.colophon) {
    const colophonDir = join(ROOT, 'colophon');
    await mkdir(colophonDir, { recursive: true });
    const colophonHtml = await render.colophon(site);
    await writeIfChanged(join(colophonDir, 'index.html'), colophonHtml);
  }

  // 15. /changelog/ (conditional: only if there are releases)
  const allReleases = aggregateRecentReleases(publicApps, Infinity);
  if (allReleases.length > 0) {
    const changelogDir = join(ROOT, 'changelog');
    await mkdir(changelogDir, { recursive: true });
    const changelogHtml = await render.changelog(site, publicApps);
    await writeIfChanged(join(changelogDir, 'index.html'), changelogHtml);
  }

  // 16. /archive/ (always emitted)
  const archiveDir = join(ROOT, 'archive');
  await mkdir(archiveDir, { recursive: true });
  const archiveHtml = await render.archive(site, thoughts);
  await writeIfChanged(join(archiveDir, 'index.html'), archiveHtml);
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

  // Read site config if present; if absent, writeOutputs still works for app pages only.
  let site = { author: { name: 'lipo', tagline: '' }, thoughts: { tree: [] }, collections: [] };
  const sitePath = join(ROOT, 'site.json');
  if (existsSync(sitePath)) {
    site = JSON.parse(await readFile(sitePath, 'utf8'));
    validateSiteJson(site);
  }

  // Walk thoughts (validates file existence)
  const thoughts = walkThoughts(site);

  // Public build: strip private + lifecycle.targetDate, then derive public quarter.
  const publicApps = apps.map((app) => {
    const sanitized = omitPrivate(app);
    if (sanitized.lifecycle && app.lifecycle?.targetDate) {
      const q = deriveQuarter(app.lifecycle.targetDate);
      if (q) sanitized.lifecycle = { ...sanitized.lifecycle, targetQuarter: q };
    }
    return sanitized;
  });

  await writeOutputs(publicApps, site, thoughts);

  if (process.argv.includes('--private')) {
    const html = await render.roadmap(apps);
    await writeFile(join(ROOT, 'roadmap.html'), html, 'utf8');
    console.log(`✓ wrote roadmap.html (private)`);
  }

  console.log(`✓ built ${apps.length} app page(s), ${thoughts.length} thought(s), ${(site.collections ?? []).length} collection(s)`);
}

// NOTE: Entry-point guard from Task 3 fix — use pathToFileURL for cross-platform correctness.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(`Build failed: ${err.message}`);
    process.exit(1);
  });
}

export function slugify(p) {
  const marker = 'content/thoughts/';
  const idx = p.indexOf(marker);
  if (idx !== -1) {
    let rel = p.slice(idx + marker.length);
    if (rel.endsWith('.md')) rel = rel.slice(0, -3);
    return rel.replace(/\//g, '--');
  }
  // Fallback for paths not under content/thoughts/ (e.g., test tmp paths):
  // return the basename without extension.
  const base = p.split('/').pop();
  return base.endsWith('.md') ? base.slice(0, -3) : base;
}
