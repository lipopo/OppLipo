// Lightweight: scroll-snap carousel + native <dialog> lightbox. No deps.

function initCarousels() {
  document.querySelectorAll('[data-carousel]').forEach((carousel) => {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    carousel.addEventListener('pointerdown', (e) => {
      isDown = true;
      startX = e.pageX - carousel.offsetLeft;
      scrollLeft = carousel.scrollLeft;
      carousel.style.cursor = 'grabbing';
    });
    carousel.addEventListener('pointerup', () => {
      isDown = false;
      carousel.style.cursor = '';
    });
    carousel.addEventListener('pointercancel', () => {
      isDown = false;
      carousel.style.cursor = '';
    });
    carousel.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - carousel.offsetLeft;
      carousel.scrollLeft = scrollLeft - (x - startX) * 1.2;
    });
  });
}

function ensureDialog() {
  let d = document.getElementById('lightbox-dialog');
  if (d) return d;
  d = document.createElement('dialog');
  d.id = 'lightbox-dialog';
  d.innerHTML = `
    <button class="lightbox-close" aria-label="关闭">×</button>
    <img class="lightbox-img" alt="">
  `;
  d.querySelector('.lightbox-close').addEventListener('click', () => d.close());
  d.addEventListener('click', (e) => {
    // Click on backdrop closes; click on image does not.
    if (e.target === d) d.close();
  });
  document.body.appendChild(d);
  return d;
}

function initLightbox() {
  const dialog = ensureDialog();
  const img = dialog.querySelector('.lightbox-img');
  document.querySelectorAll('[data-lightbox-src]').forEach((btn) => {
    btn.addEventListener('click', () => {
      img.src = btn.dataset.lightboxSrc;
      img.alt = btn.dataset.lightboxAlt || '';
      dialog.showModal();
    });
  });
  // ESC to close
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dialog.close();
  });
}

// Featured carousel (homepage hero)
function initFeaturedCarousel() {
  document.querySelectorAll('[data-featured-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('.carousel-hero__track');
    const slides = carousel.querySelectorAll('.carousel-hero__slide');
    const dots = carousel.querySelectorAll('.carousel-hero__dot');
    const prev = carousel.querySelector('.carousel-hero__arrow--prev');
    const next = carousel.querySelector('.carousel-hero__arrow--next');
    if (slides.length === 0) return;

    let index = 0;
    let timer = null;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function go(i) {
      index = (i + slides.length) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((d, di) => d.classList.toggle('carousel-hero__dot--active', di === index));
    }
    function tick() { go(index + 1); }
    function start() { if (reduced || slides.length < 2) return; stop(); timer = setInterval(tick, 7000); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    // Pause on hover/focus
    carousel.addEventListener('mouseenter', stop);
    carousel.addEventListener('mouseleave', start);
    carousel.addEventListener('focusin', stop);
    carousel.addEventListener('focusout', start);

    // Pause when tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else start();
    });

    // Manual controls
    if (prev) prev.addEventListener('click', () => { go(index - 1); start(); });
    if (next) next.addEventListener('click', () => { go(index + 1); start(); });
    dots.forEach((dot, di) => {
      dot.addEventListener('click', () => { go(di); start(); });
    });

    // Keyboard nav when carousel is focused
    carousel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { go(index - 1); start(); }
      else if (e.key === 'ArrowRight') { go(index + 1); start(); }
    });

    // Touch swipe
    let touchStartX = 0;
    let touchStartY = 0;
    carousel.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      stop();
    }, { passive: true });
    carousel.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        go(index + (dx < 0 ? 1 : -1));
      }
      start();
    }, { passive: true });

    // Init: sync dot active state with initial slide index
    go(0);
    start();
  });
}

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initFeaturedCarousel();
    initCarousels();
    initLightbox();
    if (document.getElementById('q')) initSearch();
    if (document.getElementById('suggest-list')) init404();
  });
} else {
  initFeaturedCarousel();
  initCarousels();
  initLightbox();
  if (document.getElementById('q')) initSearch();
  if (document.getElementById('suggest-list')) init404();
}

// ---- Search -------------------------------------------------------------

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function scoreMatch(doc, q) {
  const title = doc.title.toLowerCase();
  const content = doc.content.toLowerCase();
  let score = 0;
  if (title.includes(q)) score += 10;
  if (content.slice(0, 100).includes(q)) score += 3;
  if (content.includes(q)) score += 1;
  return score;
}

function makeExcerpt(content, q, len) {
  if (!q) return content.slice(0, len);
  const lower = content.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return content.slice(0, len);
  const start = Math.max(0, idx - Math.floor(len / 2));
  const slice = content.slice(start, start + len);
  return (start > 0 ? '…' : '') + slice + (start + len < content.length ? '…' : '');
}

function highlight(text, q) {
  if (!q) return escapeHtml(text);
  const re = new RegExp(escapeRe(q), 'gi');
  let result = '';
  let last = 0;
  for (const m of text.matchAll(re)) {
    result += escapeHtml(text.slice(last, m.index));
    result += '<mark>' + escapeHtml(m[0]) + '</mark>';
    last = m.index + m[0].length;
  }
  result += escapeHtml(text.slice(last));
  return result;
}

function renderSearchResults(container, matches, q) {
  if (!matches.length) {
    container.innerHTML = '<p class="search-empty">没有匹配 “' + escapeHtml(q) + '” 的内容。</p>';
    return;
  }
  container.innerHTML = matches.map(({ doc }) =>
    '<a class="search-result" href="' + escapeAttr(doc.url) + '">' +
      '<span class="search-result__type">' + escapeHtml(doc.type) + '</span>' +
      '<span class="search-result__title">' + highlight(doc.title, q) + '</span>' +
      '<span class="search-result__excerpt">' + highlight(makeExcerpt(doc.content, q, 80), q) + '</span>' +
    '</a>'
  ).join('');
}

async function initSearch() {
  const input = document.getElementById('q');
  if (!input) return;
  const results = document.getElementById('results');
  const countEl = document.getElementById('search-count');
  const promptQuery = document.getElementById('prompt-query');

  let index;
  try {
    const res = await fetch('/assets/search-index.json');
    index = await res.json();
  } catch (e) {
    results.innerHTML = '<p class="search-empty">搜索索引加载失败。</p>';
    return;
  }

  const params = new URLSearchParams(location.search);
  if (params.get('q')) input.value = params.get('q');

  const update = () => {
    const q = input.value.trim().toLowerCase();
    if (promptQuery) promptQuery.textContent = q || 'query';
    if (!q) {
      results.innerHTML = '<p class="search-empty">输入关键词开始搜索。</p>';
      countEl.textContent = '';
      return;
    }
    const matches = (index.items ?? [])
      .map((doc) => ({ doc, score: scoreMatch(doc, q) }))
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score);
    renderSearchResults(results, matches, q);
    countEl.textContent = '// ' + matches.length + ' matches';
  };

  input.addEventListener('input', update);
  update();
}

async function init404() {
  const list = document.getElementById('suggest-list');
  if (!list) return;
  let index;
  try {
    const res = await fetch('/assets/search-index.json');
    index = await res.json();
  } catch (e) {
    list.innerHTML = '<p class="error-loading">建议加载失败。</p>';
    return;
  }
  const items = (index.items ?? []).slice(0, 5);
  list.innerHTML = items.map((i) =>
    '<a class="search-result" href="' + escapeAttr(i.url) + '">' +
      '<span class="search-result__type">' + escapeHtml(i.type) + '</span>' +
      '<span class="search-result__title">' + escapeHtml(i.title) + '</span>' +
    '</a>'
  ).join('');
}

// ---- Reading progress -----------------------------------------------

export function computeReadingProgress(articleTop, articleHeight, scrollY, viewportHeight) {
  const scrolled = scrollY - articleTop;
  const total = Math.max(1, articleHeight - viewportHeight);
  return Math.max(0, Math.min(1, scrolled / total));
}

export function initReadingProgress() {
  const bar = document.getElementById('reading-progress');
  if (!bar) return;
  const fill = bar.querySelector('.reading-progress__fill');
  const label = bar.querySelector('.reading-progress__label');
  const article = document.querySelector('.thought-content');
  if (!article || !fill) return;

  let raf = null;
  const update = () => {
    raf = null;
    const rect = article.getBoundingClientRect();
    const articleTop = window.scrollY + rect.top;
    const articleHeight = rect.height;
    const viewportH = window.innerHeight;
    const scrolled = window.scrollY - articleTop;
    const total = Math.max(1, articleHeight - viewportH);
    const progress = Math.max(0, Math.min(1, scrolled / total));
    fill.style.width = (progress * 100).toFixed(1) + '%';
    if (label) label.textContent = Math.round(progress * 100) + '%';
  };
  const onScroll = () => {
    if (raf != null) return;
    raf = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();

  bar.addEventListener('click', (e) => {
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const articleTop = window.scrollY + article.getBoundingClientRect().top;
    const targetY = articleTop + ratio * (article.offsetHeight - window.innerHeight);
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  });
}
