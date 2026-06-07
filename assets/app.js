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

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initCarousels();
    initLightbox();
  });
} else {
  initCarousels();
  initLightbox();
}
