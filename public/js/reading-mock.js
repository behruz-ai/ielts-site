// Random Reading Mock — combines one random Passage 1 + Passage 2 + Passage 3
// from the Premium passage pool under a single continuous 60-minute timer,
// with one combined score, like the real exam. A Premium feature (see
// README/plan): this pulls from content that's mostly Premium-gated anyway.
//
// Each passage file is a fully self-contained page (own timer, own answer
// checking, own results modal) from the same standing template generation —
// see D:\ielts-site\public\tests\premium\*.html. Rather than parsing/merging
// their markup (fragile across 20+ files), this loads each in an iframe and
// drives it exactly like a real user would: dismiss its own welcome popup
// into "Full Passage, Casual Mode" (casual = counts up, never independently
// auto-submits and fights this page's own master timer), then at submit time
// clicks its own #chk-btn and reads the "X of Y correct" text it renders into
// #cnt. This deliberately avoids reading the iframe's internal `let`-scoped
// JS variables (lastScore, checked, CA) — those are NOT window properties in
// a classic script, only `function`-declared names and DOM state are
// reliably readable across the iframe boundary.
(function () {
  const root = document.getElementById('mock-root');
  if (!root) return;

  const MOCK_SECONDS = 60 * 60; // 60 minutes total, matches the real IELTS Reading paper

  const state = {
    session: null,
    isPremium: false,
    picks: null,
    timerLeft: MOCK_SECONDS,
    timerId: null,
    submitted: false,
  };

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  async function init() {
    if (typeof supabaseClient === 'undefined') { renderError('Could not load — please refresh.'); return; }
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData.session) { renderLoggedOut(); return; }
    state.session = sessionData.session;

    const { data: profile } = await supabaseClient
      .from('profiles').select('is_premium').eq('id', sessionData.session.user.id).maybeSingle();
    state.isPremium = !!(profile && profile.is_premium);
    if (!state.isPremium) { renderLocked(); return; }

    renderIntro();
  }

  function renderLoggedOut() {
    root.innerHTML = '<div class="page-wrap"><div class="gate-note"><h2>Log in to start a Reading Mock</h2>' +
      '<p>Create a free account (or log in) to take a randomly-assembled full Reading mock.</p>' +
      '<a class="auth-submit" style="display:inline-block;width:auto;padding:11px 26px;text-decoration:none" href="/login.html?next=' + encodeURIComponent('/reading-mock.html') + '">Log in</a></div></div>';
  }

  function renderLocked() {
    root.innerHTML = '<div class="page-wrap"><div class="gate-note"><h2>Reading Mock is a Premium feature</h2>' +
      '<p>It draws from the Premium passage library to build a random full-length test — message ' +
      '<a href="https://t.me/Bekhruz_Ibodullaev" target="_blank" rel="noopener" style="color:#7fb3ff">@Bekhruz_Ibodullaev</a> to get Premium.</p>' +
      '<a class="auth-submit" style="display:inline-block;width:auto;padding:11px 26px;text-decoration:none" href="/premium.html">See Premium</a></div></div>';
  }

  function renderError(msg) {
    root.innerHTML = '<div class="page-wrap"><p class="empty-note">' + escapeHtml(msg) + '</p></div>';
  }

  function renderIntro() {
    root.innerHTML = '<div class="page-wrap" style="max-width:760px">' +
      '<div class="catalog-hdr"><div><h1>Reading Mock</h1>' +
      '<p>One Passage 1, one Passage 2, one Passage 3 — picked at random from the Premium library — under a single continuous <strong>60-minute</strong> timer, just like the real exam. One combined score at the end.</p></div></div>' +
      '<button class="auth-submit" id="start-mock-btn" style="display:inline-block;width:auto;padding:12px 28px">🎲 Start a Random Mock</button>' +
      '<p class="empty-note" id="intro-note" style="margin-top:14px"></p>' +
      '</div>';
    document.getElementById('start-mock-btn').addEventListener('click', startMock);
  }

  async function startMock() {
    const note = document.getElementById('intro-note');
    const btn = document.getElementById('start-mock-btn');
    btn.disabled = true; btn.textContent = 'Picking passages…';

    let all, overrideRows;
    try {
      const res = await Promise.all([
        fetch('/data/tests.json').then((r) => r.json()),
        supabaseClient.from('test_overrides').select('test_path, access').then(({ data }) => data || []),
      ]);
      all = res[0]; overrideRows = res[1];
    } catch (e) {
      btn.disabled = false; btn.textContent = '🎲 Start a Random Mock';
      if (note) note.textContent = 'Could not load the test catalog. Please try again.';
      return;
    }

    const overrideMap = {};
    overrideRows.forEach((r) => { overrideMap[r.test_path] = r.access; });

    const pool = all
      .filter((t) => t.section === 'reading' && t.tier === 'premium-passage' && t.status === 'published')
      .map((t) => ({ ...t, path: '/tests/' + t.file, access: overrideMap['/tests/' + t.file] || t.access }))
      .filter((t) => t.access !== 'real-exam');

    const byType = { 'Passage 1': [], 'Passage 2': [], 'Passage 3': [] };
    pool.forEach((t) => { if (byType[t.passageType]) byType[t.passageType].push(t); });

    const missing = Object.keys(byType).filter((k) => !byType[k].length);
    if (missing.length) {
      btn.disabled = false; btn.textContent = '🎲 Start a Random Mock';
      if (note) note.textContent = 'Not enough passages yet (missing ' + missing.join(', ') + ') — check back soon.';
      return;
    }

    state.picks = ['Passage 1', 'Passage 2', 'Passage 3'].map((k) => {
      const list = byType[k];
      return list[Math.floor(Math.random() * list.length)];
    });

    renderMock();
  }

  function renderMock() {
    state.timerLeft = MOCK_SECONDS;
    state.submitted = false;
    const footer = document.getElementById('mock-footer');
    if (footer) footer.style.display = 'none';

    let html = '<div class="mock-bar">' +
      '<div class="mock-bar-title">Reading Mock</div>' +
      '<div class="mock-tabs" id="mock-tabs">' +
      state.picks.map((p, i) => '<button class="mock-tab' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '" type="button">' + escapeHtml(p.passageType) + '</button>').join('') +
      '</div>' +
      '<div class="mock-timer" id="mock-timer">60:00</div>' +
      '<button class="mock-submit-btn" id="mock-submit-btn" type="button">Submit Mock</button>' +
      '</div>' +
      '<p class="empty-note" style="text-align:left;margin-bottom:10px">This clock is your official time for all 3 passages combined — each passage\u2019s own internal timer doesn\u2019t matter, ignore it.</p>' +
      '<div class="mock-frames">' +
      state.picks.map((p, i) => '<iframe class="mock-frame' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '" src="/tests/' + p.file + '"></iframe>').join('') +
      '</div>';

    root.innerHTML = html;

    root.querySelectorAll('.mock-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = btn.dataset.idx;
        root.querySelectorAll('.mock-tab').forEach((b) => b.classList.toggle('active', b === btn));
        root.querySelectorAll('.mock-frame').forEach((f) => f.classList.toggle('active', f.dataset.idx === idx));
      });
    });

    root.querySelectorAll('.mock-frame').forEach((frame) => {
      frame.addEventListener('load', () => setupFrame(frame));
    });

    document.getElementById('mock-submit-btn').addEventListener('click', () => confirmSubmit(false));

    state.timerId = setInterval(tick, 1000);
    window.addEventListener('beforeunload', beforeUnload);
  }

  function beforeUnload(e) {
    if (!state.submitted) { e.preventDefault(); e.returnValue = ''; }
  }

  function setupFrame(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      const allCard = doc.querySelector('.ptype-card[data-group="all"]');
      if (allCard) allCard.click();
      setTimeout(() => {
        const casualBtn = doc.getElementById('casualBtn');
        if (casualBtn) casualBtn.click();
      }, 50);
    } catch (e) {
      console.warn('[reading-mock] could not auto-configure a passage frame:', e);
    }
  }

  function tick() {
    state.timerLeft--;
    const el = document.getElementById('mock-timer');
    if (el) {
      const left = Math.max(0, state.timerLeft);
      const m = Math.floor(left / 60);
      const s = left % 60;
      el.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      if (state.timerLeft <= 300) el.classList.add('warn');
    }
    if (state.timerLeft <= 0) {
      clearInterval(state.timerId);
      confirmSubmit(true);
    }
  }

  function confirmSubmit(auto) {
    if (state.submitted) return;
    if (!auto && !window.confirm('Submit your Reading Mock now? You won\u2019t be able to change answers afterwards.')) return;
    submitMock();
  }

  function submitMock() {
    if (state.submitted) return;
    state.submitted = true;
    clearInterval(state.timerId);
    window.removeEventListener('beforeunload', beforeUnload);

    let totalScore = 0, totalQuestions = 0;
    const perPassage = [];
    root.querySelectorAll('.mock-frame').forEach((frame) => {
      const idx = Number(frame.dataset.idx);
      const p = state.picks[idx];
      let score = 0, total = p.questionCount;
      try {
        const doc = frame.contentDocument;
        const chkBtn = doc.getElementById('chk-btn');
        if (chkBtn) chkBtn.click();
        const cntEl = doc.getElementById('cnt');
        const m = cntEl ? cntEl.textContent.match(/(\d+)\s+of\s+(\d+)\s+correct/i) : null;
        if (m) { score = Number(m[1]); total = Number(m[2]); }
      } catch (e) {
        console.warn('[reading-mock] could not grade a passage frame, counting as 0:', e);
      }
      totalScore += score;
      totalQuestions += total;
      perPassage.push({ passageType: p.passageType, title: p.displayTitle, score, total });
    });

    saveAndShowResults(totalScore, totalQuestions, perPassage);
  }

  async function saveAndShowResults(score, total, perPassage) {
    const band = window.ieltsBand ? window.ieltsBand(score, total) : null;
    try {
      await supabaseClient.from('test_attempts').insert({
        user_id: state.session.user.id,
        test_path: '/reading-mock/' + Date.now(),
        test_title: 'Reading Mock \u2014 ' + perPassage.map((p) => p.passageType).join(' + '),
        section: 'reading',
        score,
        total,
      });
    } catch (e) {
      console.error('[reading-mock] failed to save mock result:', e);
    }
    renderResults(score, total, band, perPassage);
  }

  function renderResults(score, total, band, perPassage) {
    const footer = document.getElementById('mock-footer');
    if (footer) footer.style.display = '';
    const pct = total ? Math.round((score / total) * 100) : 0;

    const html = '<div class="page-wrap" style="max-width:640px">' +
      '<div class="mock-results">' +
      '<h1>Mock complete</h1>' +
      '<div class="mock-score">' + score + ' <span>/ ' + total + '</span></div>' +
      '<p class="mock-pct">' + pct + '%' + (band ? ' \u00b7 Band ' + band : '') + '</p>' +
      '<table class="data-table" style="margin:20px 0;text-align:left"><thead><tr><th>Passage</th><th>Title</th><th>Score</th></tr></thead><tbody>' +
      perPassage.map((p) => '<tr><td>' + escapeHtml(p.passageType) + '</td><td>' + escapeHtml(p.title) + '</td><td>' + p.score + ' / ' + p.total + '</td></tr>').join('') +
      '</tbody></table>' +
      '<button class="auth-submit" id="new-mock-btn" type="button" style="display:inline-block;width:auto;padding:11px 26px;margin-right:10px">🎲 New Random Mock</button>' +
      '<a class="btn-logout" style="display:inline-block;padding:11px 26px;text-decoration:none" href="/progress.html">View in My Progress</a>' +
      '</div></div>';

    root.innerHTML = html;
    document.getElementById('new-mock-btn').addEventListener('click', renderIntro);
  }

  init();
})();
