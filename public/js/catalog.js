// Renders a catalog page (Reading or Listening) from data/tests.json.
// Zero-build: this fetches the manifest at runtime and builds the DOM client-side.
// To add a new test: add one object to data/tests.json and drop the file under tests/<section>/...
// No rebuild step, no template to touch.

(function () {
  const root = document.getElementById('catalog-root');
  if (!root) return;
  const section = root.dataset.section; // "reading" | "listening"

  const state = { tier: 'all', volume: 'all', isPremiumUser: false };

  const premiumStatus = (typeof supabaseClient === 'undefined')
    ? Promise.resolve(false)
    : supabaseClient.auth.getSession().then(({ data }) => {
        if (!data.session) return false;
        return supabaseClient.from('profiles').select('is_premium').eq('id', data.session.user.id)
          .maybeSingle().then(({ data: profile }) => !!(profile && profile.is_premium));
      }).catch(() => false);

  Promise.all([
    fetch('/data/tests.json').then((r) => r.json()),
    premiumStatus,
  ])
    .then(([all, isPremiumUser]) => {
      state.isPremiumUser = isPremiumUser;
      const items = all.filter((t) => t.section === section);
      init(items);
    })
    .catch((err) => {
      root.innerHTML = '<p class="empty-note">Could not load the test catalog. Please refresh.</p>';
      console.error(err);
    });

  function init(items) {
    buildFilterBar(items);
    render(items);
  }

  function buildFilterBar(items) {
    const bar = document.getElementById('filter-bar');
    if (!bar) return;

    const tiers = uniq(items.map((t) => t.tier));
    const tierLabel = {
      'full-volume': 'Full Volume Tests',
      'premium-passage': 'Premium Passages',
    };

    const chips = [];
    chips.push(chip('All', 'all', 'tier', true));
    tiers.forEach((t) => chips.push(chip(tierLabel[t] || t, t, 'tier', false)));
    bar.innerHTML = chips.join('');

    bar.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        bar.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.tier = btn.dataset.value;
        render(items);
      });
    });
  }

  function chip(label, value, group, active) {
    return `<button class="filter-chip${active ? ' active' : ''}" data-group="${group}" data-value="${value}">${label}</button>`;
  }

  function uniq(arr) {
    return [...new Set(arr)];
  }

  function render(items) {
    let filtered = items;
    if (state.tier !== 'all') filtered = filtered.filter((t) => t.tier === state.tier);

    if (!filtered.length) {
      root.innerHTML = '<p class="empty-note">Nothing here yet — check back soon.</p>';
      return;
    }

    const fullVolume = filtered.filter((t) => t.tier === 'full-volume');
    const premiumPassage = filtered.filter((t) => t.tier === 'premium-passage');

    let html = '';

    if (fullVolume.length) {
      const volumes = uniq(fullVolume.map((t) => t.volume)).sort((a, b) => a - b);
      volumes.forEach((v) => {
        const tests = fullVolume
          .filter((t) => t.volume === v)
          .sort((a, b) => (a.testNumber || 999) - (b.testNumber || 999));
        html += `<div class="vol-group"><h2>Volume ${v}</h2><div class="test-grid">`;
        html += tests.map(cardHtml).join('');
        html += `</div></div>`;
      });
    }

    if (premiumPassage.length) {
      const types = uniq(premiumPassage.map((t) => t.passageType)).sort();
      types.forEach((pt) => {
        const tests = premiumPassage.filter((t) => t.passageType === pt);
        html += `<div class="vol-group"><h2>${pt} — Premium</h2><div class="test-grid">`;
        html += tests.map(cardHtml).join('');
        html += `</div></div>`;
      });
    }

    root.innerHTML = html;
  }

  function cardHtml(t) {
    const soon = t.status === 'coming-soon';
    const locked = t.tier === 'premium-passage' && t.access === 'premium' && !state.isPremiumUser;
    const badge = soon
      ? '<span class="badge-soon">Coming soon</span>'
      : t.tier === 'premium-passage'
      ? (t.access === 'free'
          ? `<span class="badge-tier badge-premium">✨ ${escapeHtml(t.passageType || '')} · Free sample</span>`
          : `<span class="badge-tier badge-premium">🔒 ${escapeHtml(t.passageType || '')} Premium</span>`)
      : '';
    const meta = `${t.questionCount} questions · ${t.durationMinutes} min`;
    const startBtn = soon
      ? '<span class="tc-start">Coming soon</span>'
      : locked
      ? '<a class="tc-start tc-locked" href="/premium.html">🔒 Get Premium →</a>'
      : `<a class="tc-start" href="/tests/${t.file}">Start Test →</a>`;

    return `<div class="test-card${soon ? ' soon' : ''}">
      ${badge}
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
