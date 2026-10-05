/* Theme toggle. The inline <head> script has already set data-theme. */
(function () {
  var root = document.documentElement;
  var btn = document.querySelector('.theme-toggle');
  if (!btn) return;

  function apply(theme, save) {
    root.dataset.theme = theme;
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    if (save) {
      try { localStorage.setItem('theme', theme); } catch (e) {}
    }
  }

  apply(root.dataset.theme === 'dark' ? 'dark' : 'light', false);
  btn.addEventListener('click', function () {
    apply(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
  });

  // Follow the system setting live until the visitor picks a theme
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    var saved = null;
    try { saved = localStorage.getItem('theme'); } catch (err) {}
    if (!saved) apply(e.matches ? 'dark' : 'light', false);
  });
})();

// Phones: the nav row scrolls sideways, so bring the current page's link into view
(function () {
  var row = document.querySelector('.nav-links');
  var current = row && row.querySelector('[aria-current="page"]');
  if (!current || row.scrollWidth <= row.clientWidth) return;
  var overflowRight = current.getBoundingClientRect().right - row.getBoundingClientRect().right;
  if (overflowRight > 0) row.scrollLeft += overflowRight;
})();

(function () {
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('[data-reveal-group]').forEach(function (group) {
    var items = group.querySelectorAll('.reveal');
    items.forEach(function (el, i) {
      el.style.transitionDelay = prefersReduced ? '0ms' : (i * 80) + 'ms';
    });
  });

  if (prefersReduced || !('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(function (el) {
      el.classList.add('is-visible');
    });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.reveal').forEach(function (el) {
    observer.observe(el);
  });
})();
