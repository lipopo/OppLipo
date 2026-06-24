# Reading Progress Bar Implementation Plan

> Steps use checkbox syntax. Implement task-by-task.

**Goal:** Bottom-center reading progress bar on thought pages. Tracks scroll position over the article. Click to jump.

**Tech Stack:** Node 20+ stdlib, vanilla JS, terminal brutalist CSS.

**Spec:** `docs/superpowers/specs/2026-06-13-reading-progress-design.md`

---

## File Structure

**Modified files:**
- `assets/app.js` — add `computeReadingProgress` (pure) + `initReadingProgress` (DOM) + boot wiring
- `templates/thought.html` — add `<div class="reading-progress">` before `</main>`
- `assets/styles.css` — append `.reading-progress*` rules
- `tests/build.test.mjs` — add 2 new tests

---

## Task 1: `computeReadingProgress` helper + tests

**Files:**
- Modify: `assets/app.js`
- Test: `tests/build.test.mjs`

- [ ] **Step 1: Write the failing tests**

```javascript
import { computeReadingProgress } from '../build.mjs';

test('computeReadingProgress: 0% at top, 100% past article bottom, clamped', () => {
  // articleTop=1000, articleHeight=2000, viewportHeight=800
  // total = 2000 - 800 = 1200
  // scrollY=1000 → scrolled=0 → 0%
  assert.equal(computeReadingProgress(1000, 2000, 1000, 800), 0);
  // scrollY=1600 → scrolled=600 → 50%
  assert.equal(computeReadingProgress(1000, 2000, 1600, 800), 0.5);
  // scrollY=2200 → scrolled=1200 → 100%
  assert.equal(computeReadingProgress(1000, 2000, 2200, 800), 1);
  // scrollY > article bottom → clamped to 1
  assert.equal(computeReadingProgress(1000, 2000, 9999, 800), 1);
  // scrollY < article top → clamped to 0
  assert.equal(computeReadingProgress(1000, 2000, 500, 800), 0);
});

test('computeReadingProgress: handles tall articles (article taller than viewport)', () => {
  // articleHeight=3000, viewportHeight=800
  // total = 3000 - 800 = 2200
  // scrollY=2000 → scrolled=1000 → 1000/2200 ≈ 0.4545
  const r = computeReadingProgress(0, 3000, 2000, 800);
  assert.ok(r > 0.4 && r < 0.5, `expected ~0.45, got ${r}`);
});
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Add `computeReadingProgress` to `assets/app.js`**

Append at the end of `assets/app.js`:

```javascript
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
```

Also update the boot block to call `initReadingProgress` when `#reading-progress` exists.

- [ ] **Step 4: Run, verify 111 pass**

- [ ] **Step 5: Commit**

```bash
git add assets/app.js tests/build.test.mjs
git commit -m "Add computeReadingProgress and initReadingProgress to app.js"
```

---

## Task 2: Template + CSS

**Files:**
- Modify: `templates/thought.html`
- Modify: `assets/styles.css`

- [ ] **Step 1: Add progress bar to `templates/thought.html`**

In `templates/thought.html`, find the line `      </article>` and the line `    </main>`. Insert before `    </main>`:

```html
      </article>

      <div class="reading-progress" id="reading-progress" aria-label="阅读进度">
        <div class="reading-progress__fill"></div>
        <span class="reading-progress__label">0%</span>
      </div>
    </main>
```

- [ ] **Step 2: Append CSS at end of `assets/styles.css`**

```css
/* Reading progress */
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

- [ ] **Step 3: Build and verify all 3 thought pages**

```bash
cd /home/lipo/workdir/OppLipo && node build.mjs
grep "reading-progress" thoughts/dev--sample-thought/index.html | head -3
grep "reading-progress" thoughts/life--why-indie/index.html | head -1
grep "reading-progress" index.html | head -1
```

Expected:
- thought pages have the progress bar
- index.html does NOT have it
- life--why-indie thought page has it

- [ ] **Step 4: Commit**

```bash
git add templates/thought.html assets/styles.css thoughts/
git commit -m "Add reading progress bar to thought pages"
```

---

## Task 3: Final verification

- [ ] **Step 1: All tests pass**

```bash
cd /home/lipo/workdir/OppLipo && node --test tests/build.test.mjs 2>&1 | tail -10
```

Expected: 111 passing.

- [ ] **Step 2: Visual smoke test (progress bar visible at bottom)**

```bash
cd /home/lipo/workdir/OppLipo && python3 -m http.server 4000 >/tmp/httpd.log 2>&1 &
sleep 1
chromium --headless --disable-gpu --no-sandbox --hide-scrollbars --window-size=1280,2400 --virtual-time-budget=4000 --screenshot=/tmp/v16-thought-progress.png http://localhost:4000/thoughts/dev--sample-thought/ 2>&1 | tail -1
pkill -f "python3 -m http.server 4000" 2>/dev/null
ls -la /tmp/v16-thought-progress.png
```

## Self-Review

- Spec coverage: visual ✓, algorithm ✓, HTML ✓, CSS ✓, runtime ✓, tests ✓
- All steps have actual code blocks
- Type consistency: `computeReadingProgress(articleTop, articleHeight, scrollY, viewportHeight)` returns 0-1 number
- Risks: minimal — pure additions, no breaking changes