import { escHtml } from './util.js';
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

export function renderTemplate(tpl, scope) {
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

