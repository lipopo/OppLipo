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
  });
} else {
  initFeaturedCarousel();
  initCarousels();
  initLightbox();
}
