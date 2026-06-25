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

export function extractHeadings(text) {
  if (typeof text !== 'string') return [];
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m2 = line.match(/^##\s+(.+)$/);
    if (m2) out.push({ level: 2, text: m2[1].trim() });
  }
  return out;
}
