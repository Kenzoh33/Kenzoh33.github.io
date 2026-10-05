/* Command palette: Cmd/Ctrl+K or "/" to jump to any page, project, or action.
   Builds its own <dialog>, so pages only need the script tag and an optional
   .palette-open button. Without JS nothing appears and the nav still works. */
(function () {
  // Site root, worked out from this script's own URL so links resolve
  // the same from index.html and from pages under /projects/.
  var base = new URL('..', document.currentScript.src);
  var EMAIL = 'rochakghimire2@gmail.com';

  var items = [
    { label: 'Home', hint: 'Page', href: 'index.html' },
    { label: 'About', hint: 'Page', href: 'about.html' },
    { label: 'Research', hint: 'Page', href: 'research.html' },
    { label: 'Projects', hint: 'Page', href: 'projects.html' },
    { label: 'Achievements', hint: 'Page', href: 'achievements.html' },
    { label: 'Resume', hint: 'Page', href: 'resume.html' },
    { label: 'MyVoice', hint: 'Project', href: 'projects/myvoice.html' },
    { label: 'Redis Clone', hint: 'Project', href: 'projects/redis-clone.html' },
    { label: 'MoodLens', hint: 'Project', href: 'projects/moodlens.html' },
    { label: 'advProm', hint: 'Project', href: 'projects/advprom.html' },
    { label: "Developer's Driver", hint: 'Project', href: 'projects/developers-driver.html' },
    { label: 'Photo Cleaner', hint: 'Project', href: 'projects/photo-cleaner.html' },
    { label: 'Toggle dark mode', hint: 'Action', run: toggleTheme },
    { label: 'Copy email address', hint: 'Action', run: copyEmail, keepOpen: true },
    { label: 'Download resume (PDF)', hint: 'Action', href: 'assets/resume.pdf' },
    { label: 'GitHub', hint: 'Link', href: 'https://github.com/Kenzoh33', external: true },
    { label: 'LinkedIn', hint: 'Link', href: 'https://linkedin.com/in/rochakghimire', external: true }
  ];

  var dialog = document.createElement('dialog');
  dialog.className = 'palette';
  dialog.setAttribute('aria-label', 'Command palette');
  dialog.innerHTML =
    '<input type="text" placeholder="Jump to a page, project, or action" aria-label="Search" ' +
    'role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list" ' +
    'autocomplete="off" spellcheck="false">' +
    '<ul class="palette-list" id="palette-list" role="listbox"></ul>' +
    '<p class="palette-foot"><span class="palette-status" aria-live="polite">' +
    '<kbd>&uarr;</kbd> <kbd>&darr;</kbd> to move &middot; <kbd>Enter</kbd> to open</span>' +
    '<span><kbd>Esc</kbd> to close</span></p>';
  document.body.appendChild(dialog);

  var input = dialog.querySelector('input');
  var list = dialog.querySelector('ul');
  var status = dialog.querySelector('.palette-status');
  var defaultStatus = status.innerHTML;
  var shown = [];
  var active = 0;

  // Subsequence match: every typed character appears in order.
  // Lower score = match starts earlier and has fewer gaps.
  function score(label, q) {
    var s = label.toLowerCase(), pos = -1, first = -1, gaps = 0;
    for (var i = 0; i < q.length; i++) {
      var next = s.indexOf(q[i], pos + 1);
      if (next === -1) return -1;
      if (first === -1) first = next;
      if (pos !== -1) gaps += next - pos - 1;
      pos = next;
    }
    return first + gaps;
  }

  function render() {
    var q = input.value.trim().toLowerCase();
    shown = items
      .map(function (item) { return { item: item, s: q ? score(item.label, q) : 0 }; })
      .filter(function (r) { return r.s !== -1; })
      .sort(function (a, b) { return a.s - b.s; })
      .map(function (r) { return r.item; });
    active = Math.min(active, Math.max(shown.length - 1, 0));
    list.innerHTML = shown.length ? '' : '<li class="palette-empty">No matches</li>';
    shown.forEach(function (item, i) {
      var li = document.createElement('li');
      li.id = 'palette-opt-' + i;
      li.setAttribute('role', 'option');
      li.innerHTML = '<span></span><span class="hint"></span>';
      li.firstChild.textContent = item.label;
      li.lastChild.textContent = item.hint;
      li.addEventListener('mousemove', function () {
        if (active !== i) { active = i; mark(); }
      });
      li.addEventListener('click', function () { choose(item); });
      list.appendChild(li);
    });
    mark();
  }

  function mark() {
    Array.prototype.forEach.call(list.children, function (li, i) {
      if (li.getAttribute('role') === 'option') {
        li.setAttribute('aria-selected', i === active ? 'true' : 'false');
      }
    });
    if (shown.length) {
      input.setAttribute('aria-activedescendant', 'palette-opt-' + active);
      var el = document.getElementById('palette-opt-' + active);
      if (el) el.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function choose(item) {
    if (!item) return;
    if (item.run) {
      item.run();
      if (!item.keepOpen) dialog.close();
      return;
    }
    var url = new URL(item.href, base).href;
    dialog.close();
    if (item.external) window.open(url, '_blank', 'noopener');
    else window.location.href = url;
  }

  function toggleTheme() {
    var btn = document.querySelector('.theme-toggle');
    if (btn) btn.click();
  }

  function copyEmail() {
    function done(msg) {
      status.textContent = msg;
      setTimeout(function () { status.innerHTML = defaultStatus; }, 1600);
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(EMAIL).then(
        function () { done('Copied ' + EMAIL); },
        function () { done(EMAIL); }
      );
    } else {
      done(EMAIL);
    }
  }

  function open() {
    if (dialog.open) return;
    input.value = '';
    active = 0;
    status.innerHTML = defaultStatus;
    render();
    dialog.showModal();
    input.focus();
  }

  input.addEventListener('input', function () { active = 0; render(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!shown.length) return;
      var step = e.key === 'ArrowDown' ? 1 : -1;
      active = (active + step + shown.length) % shown.length;
      mark();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(shown[active]);
    }
  });

  // A click that lands on the dialog itself (not its contents) is the backdrop
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) dialog.close();
  });

  document.addEventListener('keydown', function (e) {
    var el = document.activeElement;
    var typing = el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (dialog.open) dialog.close(); else open();
    } else if (e.key === '/' && !typing && !dialog.open) {
      e.preventDefault();
      open();
    }
  });

  document.querySelectorAll('.palette-open').forEach(function (b) {
    b.addEventListener('click', open);
  });
})();
