// Renders the Speaking Bank on speaking.html — 30 reference sets (not scored
// tests, so no test_attempts/login gating here, just the site's existing
// Premium-status check to decide how much of a locked set to show).

(function () {
  const root = document.getElementById('sp-root');
  if (!root) return;

  const state = { isPremiumUser: false, part: 'all', items: null };

  function fetchPremiumStatus() {
    if (typeof supabaseClient === 'undefined') return Promise.resolve(false);
    return supabaseClient.auth.getSession().then(({ data }) => {
      if (!data.session) return false;
      return supabaseClient.from('profiles').select('is_premium').eq('id', data.session.user.id)
        .maybeSingle().then(({ data: profile }) => !!(profile && profile.is_premium));
    }).catch(() => false);
  }

  Promise.all([
    fetch('/data/speaking.json').then((r) => r.json()),
    fetchPremiumStatus(),
  ])
    .then(([items, isPremiumUser]) => {
      state.items = items;
      state.isPremiumUser = isPremiumUser;
      init();
    })
    .catch((err) => {
      root.innerHTML = '<p class="empty-note">Could not load the Speaking Bank. Please refresh.</p>';
      console.error(err);
    });

  function init() {
    buildPartBar();
    render();
  }

  function buildPartBar() {
    const bar = document.getElementById('sp-part-bar');
    if (!bar) return;
    const preselect = new URLSearchParams(location.search).get('part');
    if (['1', '2', '3'].includes(preselect)) state.part = preselect;

    const counts = { 1: 0, 2: 0, 3: 0 };
    state.items.forEach((t) => { counts[t.part]++; });

    const chips = [chip('All', 'all', state.items.length)];
    [1, 2, 3].forEach((p) => chips.push(chip('Part ' + p, String(p), counts[p])));
    bar.innerHTML = chips.join('');

    bar.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        bar.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.part = btn.dataset.value;
        render();
      });
    });
  }

  function chip(label, value, count) {
    const active = state.part === value;
    return '<button class="filter-chip' + (active ? ' active' : '') + '" data-value="' + escapeHtml(value) + '">' +
      escapeHtml(label) + ' (' + count + ')</button>';
  }

  function render() {
    const filtered = state.part === 'all' ? state.items : state.items.filter((t) => String(t.part) === state.part);
    if (!filtered.length) {
      root.innerHTML = '<p class="empty-note">Nothing here yet — check back soon.</p>';
      return;
    }
    root.innerHTML = '<div class="sp-list">' + filtered.map(cardHtml).join('') + '</div>';
  }

  function cardHtml(t) {
    const unlocked = t.tier === 'free' || state.isPremiumUser;
    const partLabel = 'Part ' + t.part;

    const questionsHtml = '<ul class="sp-questions">' +
      t.questions.map((q) => '<li>' + escapeHtml(q) + '</li>').join('') + '</ul>';
    const cueHtml = t.cueCardPoints
      ? '<ul class="sp-cue-points">' + t.cueCardPoints.map((c) => '<li>' + escapeHtml(c) + '</li>').join('') + '</ul>'
      : '';

    const tierBadge = t.tier === 'free'
      ? '<span class="badge-tier badge-premium">✨ Free sample</span>'
      : (unlocked ? '<span class="badge-tier badge-premium">✨ Premium</span>' : '<span class="badge-tier badge-premium">🔒 Premium</span>');

    const body = unlocked
      ? '<div class="sp-body">' +
          section('Structure', structureHtml(t.structure)) +
          section('Vocabulary & Collocations', vocabHtml(t.vocab)) +
          section('Model Answers', modelsHtml(t.models)) +
          section(null, '<div class="sp-bandtip">' + escapeHtml(t.bandTip) + '</div>') +
          section(null, '<div class="sp-howto">💡 <strong>How to use this:</strong> Treat this as a model to adapt, not a script to memorize — examiners can tell when an answer sounds rehearsed. Swap in your own details and practice saying it in your own words rather than reciting it.</div>') +
        '</div>'
      : '<div class="sp-body"><div class="sp-locked">' +
          '<p>Structure, vocabulary, and both model answers for this set are Premium. The questions above are free to practice with right now.</p>' +
          '<a href="/premium.html">🔒 Get Premium →</a>' +
        '</div></div>';

    return '<details class="sp-card">' +
      '<summary class="sp-summary">' +
        '<div class="sp-summary-main">' +
          '<div class="sp-summary-top"><span class="badge-tier">' + escapeHtml(partLabel) + '</span>' + tierBadge + '</div>' +
          '<div class="sp-theme">' + escapeHtml(t.theme) + '</div>' +
          questionsHtml + cueHtml +
        '</div>' +
        '<span class="sp-arrow">▾</span>' +
      '</summary>' +
      body +
    '</details>';
  }

  function section(label, html) {
    return '<div class="sp-section">' + (label ? '<p class="sp-section-label">' + escapeHtml(label) + '</p>' : '') + html + '</div>';
  }

  function structureHtml(steps) {
    return '<div class="sp-structure">' +
      steps.map((s, i) => (i > 0 ? '<span class="sp-structure-arrow">→</span>' : '') + '<span class="sp-structure-step">' + escapeHtml(s) + '</span>').join('') +
      '</div>';
  }

  function vocabHtml(vocab) {
    return '<div class="sp-vocab-list">' + vocab.map((v) =>
      '<div class="sp-vocab-item">' +
        '<div class="sp-vocab-term">' + escapeHtml(v.term) + '</div>' +
        '<div class="sp-vocab-meaning">' + escapeHtml(v.meaning) + '</div>' +
        '<div class="sp-vocab-example">"' + escapeHtml(v.example) + '"</div>' +
      '</div>'
    ).join('') + '</div>';
  }

  function modelsHtml(models) {
    return models.map((m) =>
      '<div class="sp-model">' +
        '<div class="sp-model-angle">' + escapeHtml(m.angle) + '</div>' +
        '<div class="sp-model-text">' + escapeHtml(m.text) + '</div>' +
      '</div>'
    ).join('');
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
})();
