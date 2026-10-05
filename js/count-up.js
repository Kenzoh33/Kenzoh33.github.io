/* Count-up for key numbers on the Home page. The real value is
   already in the HTML, so without JS (or with reduced motion) the
   number simply shows as written. Prefix, suffix, commas and decimal
   places are read from that text and preserved while counting. */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  var DURATION = 1400;

  function parse(text) {
    var m = text.match(/^([^\d]*)([\d,]*\.?\d+)(.*)$/);
    if (!m) return null;
    var raw = m[2];
    var dot = raw.indexOf('.');
    return {
      prefix: m[1],
      suffix: m[3],
      value: parseFloat(raw.replace(/,/g, '')),
      decimals: dot === -1 ? 0 : raw.length - dot - 1,
      commas: raw.indexOf(',') !== -1
    };
  }

  function format(n, spec) {
    var s = n.toFixed(spec.decimals);
    if (spec.commas) {
      var parts = s.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      s = parts.join('.');
    }
    return spec.prefix + s + spec.suffix;
  }

  function run(el) {
    var final = el.textContent;
    var spec = parse(final);
    if (!spec) return;
    var start = null;
    function tick(now) {
      if (start === null) start = now;
      var t = Math.min((now - start) / DURATION, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = t < 1 ? format(spec.value * eased, spec) : final;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        run(entry.target);
      }
    });
  }, { threshold: 0.6 });

  document.querySelectorAll('[data-count]').forEach(function (el) {
    observer.observe(el);
  });
})();
