import { extractText } from './extract.js';

export function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function computeReadingProgress(articleTop, articleHeight, scrollY, viewportHeight) {
  const scrolled = scrollY - articleTop;
  const total = Math.max(1, articleHeight - viewportHeight);
  return Math.max(0, Math.min(1, scrolled / total));
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

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
