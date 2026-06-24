# Reading Progress Bar — Design Spec

**Date:** 2026-06-13
**Status:** Draft (pending user review)
**Owner:** lipo

## Goal

Add a reading progress indicator to `/thoughts/<slug>/` — a thin bar at the bottom center that fills as the user scrolls through the article. Click to jump to that position.

## Constraints

- Static site, GitHub Pages, no runtime backend
- Zero npm dependencies
- Existing 109 tests must keep passing
- Terminal brutalist aesthetic preserved
- Pure vanilla JS (no framework, no library)

## Visual

- Position: fixed, bottom center
- Width: 60vw, max 480px
- Height: 2px
- Background: `var(--border)` (track)
- Fill: `var(--accent)` (progress), with `box-shadow: 0 0 8px var(--accent)` (subtle glow)
- Percentage label: `var(--text-muted)` mono, 10px, position `right: -36px` (right of the bar)
- Mobile (≤ 640px): bar 80vw, label hidden

## Algorithm

```javascript
function initReadingProgress() {
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
```

- `requestAnimationFrame` debounce: scroll fires many times per second; rAF ensures at most one update per frame.
- Click handler: maps click x-position to scroll y via article offset. Smooth scroll for niceness.
- `prefers-reduced-motion` handled in CSS: transitions disabled.

## HTML

Add to `templates/thought.html` immediately before `</main>` (after `<footer class="site-footer">`):

```html
<div class="reading-progress" id="reading-progress" aria-label="阅读进度">
  <div class="reading-progress__fill"></div>
  <span class="reading-progress__label">0%</span>
</div>
```

## CSS

```css
.reading-progress {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: 60vw;
  max-width: 480px;
  height: 2px;
  background: var(--border);
  cursor: pointer;
  z-index: 100;
  display: flex;
  align-items: center;
}
.reading-progress__fill {
  height: 100%;
  width: 0%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
  transition: width 0.1s linear;
}
.reading-progress__label {
  position: absolute;
  right: -36px;
  top: -8px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  width: 32px;
  text-align: right;
}
@media (prefers-reduced-motion: reduce) {
  .reading-progress__fill { transition: none; }
}
@media (max-width: 640px) {
  .reading-progress { width: 80vw; }
  .reading-progress__label { display: none; }
}
```

## Runtime: `initReadingProgress` in `assets/app.js`

Append to `assets/app.js` (after the search block). Update the boot block to call it:

```javascript
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initFeaturedCarousel();
    initCarousels();
    initLightbox();
    if (document.getElementById('q')) initSearch();
    if (document.getElementById('suggest-list')) init404();
    if (document.getElementById('reading-progress')) initReadingProgress();
  });
} else {
  initFeaturedCarousel();
  initCarousels();
  initLightbox();
  if (document.getElementById('q')) initSearch();
  if (document.getElementById('suggest-list')) init404();
  if (document.getElementById('reading-progress')) initReadingProgress();
}
```

## Tests (2 new, target 111/111)

| # | Test |
|---|---|
| 110 | `computeReadingProgress: 0% at top, 100% past article bottom, clamped` |
| 111 | `computeReadingProgress: handles tall articles (article taller than viewport)` |

Helper to test (extracted from `initReadingProgress`):

```javascript
export function computeReadingProgress(articleTop, articleHeight, scrollY, viewportHeight) {
  const scrolled = scrollY - articleTop;
  const total = Math.max(1, articleHeight - viewportHeight);
  return Math.max(0, Math.min(1, scrolled / total));
}
```

Pure function. Easy to test without DOM.

## Out of scope (YAGNI)

- Mini TOC scroll-spy (active section indicator)
- Persistent progress in localStorage
- Animated pulse / color shift
- Round percentage bubble indicator
- Reading time countdown ("3 min left")

## Risk notes

- `getBoundingClientRect()` in `update()` is the only thing that touches the DOM. Cheap. rAF debounce ensures ≤ 1 call per frame.
- Click handler fires only when `<div class="reading-progress">` is clicked (i.e., the bar itself, not the label which is positioned absolutely). Click target is clear.
- `prefers-reduced-motion` removes the transition for users with vestibular disorders. Bar still updates.