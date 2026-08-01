// Renders the dedicated Volumes catalog (Reading or Listening) — full-volume
// tier only, grouped by volume, with a shortcut nav and a random-test picker.
// No search/question-type filtering here — that's a Premium-passage concept
// (see catalog.js for reading.html), Volumes are meant to be browsed by number.

(function () {
  const root = document.getElementById('catalog-root');
  if (!root) return;
  const section = root.dataset.section; // "reading" | "listening"

  const state = { attemptsByPath: null, completedPaths: null, items: null };

  function fetchAttempts() {
    if (typeof supabaseClient === 'undefined') return Promise.resolve(null);
    return supabaseClient.auth.getSession().then(({ data }) => {
      if (!data.session) return null;
      return supabaseClient.from('test_attempts').select('test_path, score, total')
        .eq('user_id', data.session.user.id)
        .then(({ data: rows }) => buildAttemptsMap(rows || []));
    }).catch(() => null);
  }

  // Manual completion ticks — independent of automatic score detection,
  // since that's proven unreliable across this many test-file generations.
  // null = signed out; a Set (possibly empty) = signed in.
  function fetchCompletions() {
    if (typeof supabaseClient === 'undefined') return Promise.resolve(null);
    return supabaseClient.auth.getSession().then(({ data }) => {
      if (!data.session) return null;
      return supabaseClient.from('completed_tests').select('test_path')
        .eq('user_id', data.session.user.id)
        .then(({ data: rows, error }) => {
          if (error) { console.warn('[volumes-catalog] completed_tests fetch failed (has the migration been run?):', error); return new Set(); }
          return new Set((rows || []).map((r) => r.test_path));
        });
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
    fetchCompletions(),
  ])
    .then(([all, attemptsByPath, completedPaths]) => {
      state.attemptsByPath = attemptsByPath;
      state.completedPaths = completedPaths;
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
    Promise.all([fetchAttempts(), fetchCompletions()]).then(([attemptsByPath, completedPaths]) => {
      state.attemptsByPath = attemptsByPath;
      state.completedPaths = completedPaths;
      render();
    });
  });

  function init() {
    buildShortcutBar();
    wireRandomButton();
    wireCompletionToggle();
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
      // New tab: these test files have no shared "back to site" link built
      // in, so closing via the tab's X (a very natural instinct) would
      // otherwise take the whole site down with it in a single-tab flow.
      const url = state.attemptsByPath === null
        ? '/login.html?next=' + encodeURIComponent('/tests/' + pick.file)
        : '/tests/' + pick.file;
      window.open(url, '_blank', 'noopener');
    });
  }

  // Event delegation on the root: card HTML gets replaced wholesale on every
  // render(), so listeners are attached once here rather than per-checkbox.
  function wireCompletionToggle() {
    root.addEventListener('change', async (e) => {
      const box = e.target.closest('.manual-check-input');
      if (!box || typeof supabaseClient === 'undefined') return;
      const path = box.dataset.path;
      const { data } = await supabaseClient.auth.getSession();
      if (!data.session) { box.checked = !box.checked; return; }

      box.disabled = true;
      if (box.checked) {
        const { error } = await supabaseClient.from('completed_tests')
          .insert({ user_id: data.session.user.id, test_path: path });
        if (!error) state.completedPaths.add(path);
        else console.error('[volumes-catalog] mark-done failed:', error);
      } else {
        const { error } = await supabaseClient.from('completed_tests')
          .delete().eq('user_id', data.session.user.id).eq('test_path', path);
        if (!error) state.completedPaths.delete(path);
        else console.error('[volumes-catalog] unmark failed:', error);
      }
      render();
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

  function isDone(file) {
    const path = '/tests/' + file;
    return !!(state.attemptsByPath && state.attemptsByPath[path]) || !!(state.completedPaths && state.completedPaths.has(path));
  }

  function volumeProgressHtml(tests) {
    if (state.attemptsByPath === null) return ''; // signed out — can't know progress
    const published = tests.filter((t) => t.status === 'published');
    if (!published.length) return '';
    const done = published.filter((t) => isDone(t.file)).length;
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
      ? `<a class="tc-start tc-locked" href="/login.html?next=${encodeURIComponent('/tests/' + t.file)}" target="_blank" rel="noopener">🔒 Log in to start →</a>`
      : `<a class="tc-start" href="/tests/${t.file}" target="_blank" rel="noopener">Start Test →</a>`;

    let doneBadge = '';
    let manualCheck = '';
    if (!soon && !needsLogin) {
      const path = '/tests/' + t.file;
      const attempt = state.attemptsByPath[path];
      if (attempt) {
        doneBadge = `<span class="badge-done">✓ Completed · ${attempt.score}/${attempt.total}${attempt.count > 1 ? ' · best of ' + attempt.count : ''}</span>`;
      } else {
        const manuallyDone = state.completedPaths && state.completedPaths.has(path);
        doneBadge = manuallyDone
          ? '<span class="badge-done">✓ Completed</span>'
          : '<span class="badge-todo">○ Not started</span>';
        manualCheck = `<label class="manual-check" title="Mark this test as done yourself">
          <input type="checkbox" class="manual-check-input" data-path="${escapeHtml(path)}" ${manuallyDone ? 'checked' : ''}>
          <span>${manuallyDone ? 'Marked done' : 'Mark as done'}</span>
        </label>`;
      }
    }
    const badge = soon ? '<span class="badge-soon">Coming soon</span>' : '';

    return `<div class="test-card${soon ? ' soon' : ''}">
      <div class="tc-badges">${badge}${doneBadge}</div>
      <div class="tc-title">${escapeHtml(t.displayTitle)}</div>
      <div class="tc-meta"><span>${meta}</span></div>
      ${startBtn}
      ${manualCheck}
    </div>`;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
})();
