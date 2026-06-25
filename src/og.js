import { escHtml } from './util.js';

export function ogMetaTags({ title, description, url, type = 'website' }) {
  const base = 'https://info.opplipo.cn';
  const img = `${base}/assets/og-default.png`;
  return [
    `<meta property="og:title" content="${escHtml(title)}">`,
    `<meta property="og:description" content="${escHtml(description ?? '')}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:site_name" content="info.opplipo.cn">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escHtml(title)}">`,
    `<meta name="twitter:description" content="${escHtml(description ?? '')}">`,
    `<meta name="twitter:image" content="${img}">`,
  ].join('\n  ');
}
