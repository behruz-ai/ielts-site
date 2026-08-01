// Renders the dedicated Volumes catalog (Reading or Listening) — full-volume
// tier only, grouped by volume, with a shortcut nav and a random-test picker.
// No search/question-type filtering here — that's a Premium-passage concept
// (see catalog.js for reading.html), Volumes are meant to be browsed by number.

(function () {
  const root = document.getElementById('catalog-root');
  if (!root) return;
  const section = root.dataset.section; // "reading" | "listening"

  const state = { attemptsByPath: null, items: null };

  function fetchAttempts() {
    if (typeof supabaseClient === 'undefined') return Promise.resolve(null);
    return supabaseClient.auth.getSession().then(({ data }) => {
      if (!data.session) return null;
      return supabaseClient.from('test_attempts').select('test_path, score, total')
        .eq('user_id', data.session.user.id)
        .then(({ data: rows }) => buildAttemptsMap(rows || []));
    }).catch(() => null);
  }

  function buildAttemptsMap(rows) {
    const map = {};
    rows.forEach((r) => {
      const pct = r.total ? r.score / r.total : 0;
      const existing = map[r.test_path];
      const count = (existing ? existing.count : 0) + 1;
      if (!existing || pct > existing.pct) map[r.test_path] = { score: r.score, total: r.total, pct, count };
      else existing.count = count;
    });
    return map;
  }

  Promise.all([
    fetch('/data/tests.json').then((r) => r.json()),
    fetchAttempts(),
  ])
    .then(([all, attemptsByPath]) => {
      state.attemptsByPath = attemptsByPath;
      state.items = all.filter((t) => t.section === section && t.tier === 'full-volume');
      init();
    })
    .catch((err) => {
      root.innerHTML = '<p class="empty-note">Could not load the test catalog. Please refresh.</p>';
      console.error(err);
    });

  // Browsers often restore a page from an in-memory snapshot (bfcache) on
  // back/forward navigation instead of re-running any of the above — so
  // completing a test, then hitting Back, showed stale Not Started badges
  // and a stale volume-progress percentage. Re-fetch just the attempts
  // (not the whole page setup) whenever that happens.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted || !state.items) return;
    fetchAttempts().then((attemptsByPath) => {
      state.attemptsByPath = attemptsByPath;
      render();
    });
  });

  function init() {
    buildShortcutBar();
    wireRandomButton();
    render();
  }

  function uniq(arr) { return [...new Set(arr)]; }

  function buildShortcutBar() {
    const bar = document.getElementById('volume-shortcuts');
    if (!bar) return;
    const volumes = uniq(state.items.map((t) => t.volume)).sort((a, b) => a - b);
    bar.innerHTML = volumes.map((v) => `<a href="#vol-${v}" class="filter-chip">Vol ${v}</a>`).join('');
  }

  function wireRandomButton() {
    const btn = document.getElementById('random-test-btn');
    if (!btn) return;
    const published = state.items.filter((t) => t.status === 'published');
    if (!published.length) { btn.style.display = 'none'; return; }
    btn.addEventListener('click', () => {
      const pick = published[Math.floor(Math.random() * published.length)];
      if (state.attemptsByPath === null) {
        window.location.href = '/login.html?next=' + encodeURIComponent('/tests/' + pick.file);
      } else {
        window.location.href = '/tests/' + pick.file;
      }
    });
  }

  function render() {
    const items = state.items;
    if (!items.length) {
      root.innerHTML = '<p class="empty-note">Nothing here yet — check back soon.</p>';
      return;
    }
    const volumes = uniq(items.map((t) => t.volume)).sort((a, b) => a - b);
    let html = '';
    volumes.forEach((v) => {
      const tests = items.filter((t) => t.volume === v).sort((a, b) => (a.testNumber || 999) - (b.testNumber || 999));
      html += `<div class="vol-group" id="vol-${v}"><h2>Volume ${v}${volumeProgressHtml(tests)}</h2><div class="test-grid">`;
      html += tests.map(cardHtml).join('');
      html += `</div></div>`;
    });
    root.innerHTML = html;
  }

  function volumeProgressHtml(tests) {
    if (state.attemptsByPath === null) return ''; // signed out — can't know progress
    const published = tests.filter((t) => t.status === 'published');
    if (!published.length) return '';
    const done = published.filter((t) => state.attemptsByPath['/tests/' + t.file]).length;
    const pct = Math.round((done / published.length) * 100);
    return ` <span class="vol-progress">${pct}% complete <span class="vol-progress-track"><span class="vol-progress-fill" style="width:${pct}%"></span></span></span>`;
  }

  function cardHtml(t) {
    const soon = t.status === 'coming-soon';
    const meta = `${t.questionCount} questions · ${t.durationMinutes} min`;
    const needsLogin = state.attemptsByPath === null;
    const startBtn = soon
      ? '<span class="tc-start">Coming soon</span>'
      : needsLogin
      ? `<a class="tc-start tc-locked" href="/login.html?next=${encodeURIComponent('/tests/' + t.file)}">🔒 Log in to start →</a>`
      : `<a class="tc-start" href="/tests/${t.file}">Start Test →</a>`;

    let doneBadge = '';
    if (!soon && state.attemptsByPath) {
      const attempt = state.attemptsByPath['/tests/' + t.file];
      doneBadge = attempt
        ? `<span class="badge-done">✓ Completed · ${attempt.score}/${attempt.total}${attempt.count > 1 ? ' · best of ' + attempt.count : ''}</span>`
        : '<span class="badge-todo">○ Not started</span>';
    }
    const badge = soon ? '<span class="badge-soon">Coming soon</span>' : '';

    return `<div class="test-card${soon ? ' soon' : ''}">
      <div class="tc-badges">${badge}${doneBadge}</div>
      <div class="tc-title">${escapeHtml(t.displayTitle)}</div>
      <div class="tc-meta"><span>${meta}</span></div>
      ${startBtn}
    </div>`;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
})();
