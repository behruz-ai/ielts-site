// Renders the Reading catalog — Premium single-passage practice only.
// Full-volume tests live on /volumes-reading.html now (see volumes-catalog.js);
// search and question-type filtering are a passage-practice concept, not
// something that applies to full exam-length volumes.

(function () {
  const root = document.getElementById('catalog-root');
  if (!root) return;

  const state = { isPremiumUser: false, search: '', qtypes: new Set(), attemptsByPath: null, completedPaths: null, passageType: 'all', items: null };

  function fetchPremiumStatus() {
    if (typeof supabaseClient === 'undefined') return Promise.resolve(false);
    return supabaseClient.auth.getSession().then(({ data }) => {
      if (!data.session) return false;
      return supabaseClient.from('profiles').select('is_premium').eq('id', data.session.user.id)
        .maybeSingle().then(({ data: profile }) => !!(profile && profile.is_premium));
    }).catch(() => false);
  }

  // null = signed out (completion status unknown, no badge shown); an object
  // (possibly empty) = signed in, so every card gets a Completed/Not started badge.
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
          if (error) { console.warn('[catalog] completed_tests fetch failed (has the migration been run?):', error); return new Set(); }
          return new Set((rows || []).map((r) => r.test_path));
        });
    }).catch(() => null);
  }

  const params = new URLSearchParams(location.search);
  const isFullReading = params.get('full') === '1';

  Promise.all([
    fetch('/data/tests.json').then((r) => r.json()),
    fetchPremiumStatus(),
    fetchAttempts(),
    fetchCompletions(),
  ])
    .then(([all, isPremiumUser, attemptsByPath, completedPaths]) => {
      state.isPremiumUser = isPremiumUser;
      state.attemptsByPath = attemptsByPath;
      state.completedPaths = completedPaths;
      state.items = all.filter((t) => t.section === 'reading' && t.tier === 'premium-passage');
      init(state.items);
    })
    .catch((err) => {
      root.innerHTML = '<p class="empty-note">Could not load the test catalog. Please refresh.</p>';
      console.error(err);
    });

  // See volumes-catalog.js for why: bfcache-restored pages (browser Back)
  // don't re-run any of the above, so completion badges go stale.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted || !state.items || isFullReading) return;
    Promise.all([fetchPremiumStatus(), fetchAttempts(), fetchCompletions()]).then(([isPremiumUser, attemptsByPath, completedPaths]) => {
      state.isPremiumUser = isPremiumUser;
      state.attemptsByPath = attemptsByPath;
      state.completedPaths = completedPaths;
      render(state.items);
    });
  });

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
      else console.error('[catalog] mark-done failed:', error);
    } else {
      const { error } = await supabaseClient.from('completed_tests')
        .delete().eq('user_id', data.session.user.id).eq('test_path', path);
      if (!error) state.completedPaths.delete(path);
      else console.error('[catalog] unmark failed:', error);
    }
    render(state.items);
  });

  function init(items) {
    if (isFullReading) {
      root.innerHTML = '<div class="gate-note"><h2>Full Reading — coming soon</h2>' +
        '<p>Complete non-Volume Reading tests are on the way. Meanwhile, ' +
        '<a href="/volumes-reading.html" style="color:#7fb3ff">Reading Volumes</a> has full exam-length tests today.</p></div>';
      const bar = document.getElementById('filter-bar');
      const qbar = document.getElementById('qtype-bar');
      const box = document.getElementById('search-box');
      if (bar) bar.style.display = 'none';
      if (qbar) qbar.style.display = 'none';
      if (box) box.style.display = 'none';
      return;
    }

    buildPassageTypeBar(items);
    buildQtypeBar(items);
    buildSearchBox(items);
    render(items);
  }

  function buildSearchBox(items) {
    const box = document.getElementById('search-box');
    if (!box) return;
    box.addEventListener('input', () => {
      state.search = box.value.trim().toLowerCase();
      render(items);
    });
  }

  function buildPassageTypeBar(items) {
    const bar = document.getElementById('filter-bar');
    if (!bar) return;

    const preselect = new URLSearchParams(location.search).get('type');
    const types = uniq(items.map((t) => t.passageType)).sort();
    if (preselect && types.includes(preselect)) state.passageType = preselect;

    const counts = {};
    types.forEach((pt) => { counts[pt] = items.filter((t) => t.passageType === pt).length; });

    const chips = [chip('All', 'all')];
    types.forEach((pt) => chips.push(chip(`${pt} (${counts[pt]})`, pt)));
    bar.innerHTML = chips.join('');

    bar.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        bar.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.passageType = btn.dataset.value;
        render(items);
      });
    });
  }

  function chip(label, value) {
    const active = state.passageType === value;
    return `<button class="filter-chip${active ? ' active' : ''}" data-value="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
  }

  function buildQtypeBar(items) {
    const bar = document.getElementById('qtype-bar');
    if (!bar) return;

    const allTypes = uniq(items.flatMap((t) => t.questionTypes || [])).sort();
    if (!allTypes.length) { bar.style.display = 'none'; return; }

    const preselect = new URLSearchParams(location.search).get('qtype');
    if (preselect && allTypes.includes(preselect)) state.qtypes.add(preselect);

    bar.innerHTML = allTypes.map((qt) =>
      `<button class="filter-chip${state.qtypes.has(qt) ? ' active' : ''}" data-qtype="${escapeHtml(qt)}">${escapeHtml(qt)}</button>`
    ).join('');

    bar.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qt = btn.dataset.qtype;
        if (state.qtypes.has(qt)) { state.qtypes.delete(qt); btn.classList.remove('active'); }
        else { state.qtypes.add(qt); btn.classList.add('active'); }
        render(items);
      });
    });
  }

  function uniq(arr) {
    return [...new Set(arr)];
  }

  function render(items) {
    let filtered = items;
    if (state.passageType !== 'all') filtered = filtered.filter((t) => t.passageType === state.passageType);
    if (state.qtypes.size) {
      filtered = filtered.filter((t) => (t.questionTypes || []).some((qt) => state.qtypes.has(qt)));
    }
    if (state.search) {
      const q = state.search;
      filtered = filtered.filter((t) => {
        const haystack = [t.displayTitle, t.passageType, ...(t.questionTypes || [])].join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }

    if (!filtered.length) {
      root.innerHTML = '<p class="empty-note">Nothing matches — try a different filter or search term.</p>';
      return;
    }

    const types = uniq(filtered.map((t) => t.passageType)).sort();
    let html = '';
    types.forEach((pt) => {
      const tests = filtered.filter((t) => t.passageType === pt);
      html += `<div class="vol-group"><h2>${escapeHtml(pt)}</h2><div class="test-grid">`;
      html += tests.map(cardHtml).join('');
      html += `</div></div>`;
    });

    root.innerHTML = html;
  }

  function cardHtml(t) {
    const soon = t.status === 'coming-soon';
    const locked = t.access === 'premium' && !state.isPremiumUser;
    const badge = soon
      ? '<span class="badge-soon">Coming soon</span>'
      : (t.access === 'free'
          ? `<span class="badge-tier badge-premium">✨ ${escapeHtml(t.passageType || '')} · Free sample</span>`
          : `<span class="badge-tier badge-premium">🔒 ${escapeHtml(t.passageType || '')} Premium</span>`);
    const meta = `${t.questionCount} questions · ${t.durationMinutes} min`;
    const needsLogin = state.attemptsByPath === null;
    const startBtn = soon
      ? '<span class="tc-start">Coming soon</span>'
      : locked
      ? '<a class="tc-start tc-locked" href="/premium.html">🔒 Get Premium →</a>'
      : needsLogin
      ? `<a class="tc-start tc-locked" href="/login.html?next=${encodeURIComponent('/tests/' + t.file)}">🔒 Log in to start →</a>`
      : `<a class="tc-start" href="/tests/${t.file}">Start Test →</a>`;

    let doneBadge = '';
    let manualCheck = '';
    if (!soon && !locked && state.attemptsByPath) {
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

    const qtypesLine = (t.questionTypes && t.questionTypes.length)
      ? `<div class="tc-qtypes">${t.questionTypes.map((qt) => `<span class="qtype-tag">${escapeHtml(qt)}</span>`).join('')}</div>`
      : '';

    return `<div class="test-card${soon ? ' soon' : ''}">
      <div class="tc-badges">${badge}${doneBadge}</div>
      <div class="tc-title">${escapeHtml(t.displayTitle)}</div>
      <div class="tc-meta"><span>${meta}</span></div>
      ${qtypesLine}
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
