import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escHtml } from './util.js';
import { extractText } from './extract.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

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

const SITE_TAGLINE = '独立开发的多款 APP 介绍与下载';
