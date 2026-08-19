// Renders a single Speaking Bank topic on speaking-topic.html?id=... — a
// question list on the left, and a detail panel on the right (below on
// mobile) showing that question's model answer plus the topic's shared
// structure/vocabulary. Only one question's answer is shown at a time.

(function () {
  const root = document.getElementById('sp-topic-root');
  if (!root) return;

  const HOWTO = '💡 <strong>How to use this:</strong> Treat this as a model to adapt, not a script to memorize — examiners can tell when an answer sounds rehearsed. Swap in your own details and practice saying it in your own words rather than reciting it.';

  const id = new URLSearchParams(location.search).get('id');
  const state = { topic: null, isPremiumUser: false, branchId: null, questionId: null };

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
      state.isPremiumUser = isPremiumUser;
      state.topic = items.find((t) => t.id === id) || null;
      if (!state.topic) {
        root.innerHTML = '<p class="empty-note">Topic not found. <a href="/speaking.html" style="color:#7fb3ff">Back to Speaking Bank</a></p>';
        return;
      }
      if (state.topic.branches) {
        state.branchId = state.topic.branches[0].id;
        state.questionId = state.topic.branches[0].questions[0].id;
      } else {
        state.questionId = state.topic.questions[0].id;
      }
      render();
    })
    .catch((err) => {
      root.innerHTML = '<p class="empty-note">Could not load this topic. Please refresh.</p>';
      console.error(err);
    });

  function currentQuestions() {
    if (state.topic.branches) {
      const branch = state.topic.branches.find((b) => b.id === state.branchId);
      return branch ? branch.questions : [];
    }
    return state.topic.questions;
  }

  function render() {
    const t = state.topic;
    const unlocked = t.tier === 'free' || state.isPremiumUser;
    const questions = currentQuestions();
    const activeQ = questions.find((q) => q.id === state.questionId) || questions[0];

    let html = '<div class="sp-detail-hdr">' +
      '<a class="sp-back-link" href="/speaking.html">← Speaking Bank</a>' +
      '<h1>' + escapeHtml(t.theme) + '</h1>' +
      '<p class="sp-detail-tag">' + escapeHtml(t.tag || ('Part ' + t.part)) + '</p>' +
      '</div>';

    html += '<div class="sp-howto">' + HOWTO + '</div>';

    if (t.branches) {
      html += '<div class="sp-branch-tabs">' + t.branches.map((b) =>
        '<button class="filter-chip' + (b.id === state.branchId ? ' active' : '') + '" data-branch="' + escapeHtml(b.id) + '">' + escapeHtml(b.label) + '</button>'
      ).join('') + '</div>';
    }

    html += '<div class="sp-layout">' +
      '<div class="sp-qlist">' + questions.map((q) =>
        '<button class="sp-qbtn' + (q.id === activeQ.id ? ' active' : '') + '" data-qid="' + escapeHtml(q.id) + '">' + escapeHtml(q.text) + '</button>'
      ).join('') + '</div>' +
      '<div class="sp-panel">' + panelHtml(t, activeQ, unlocked) + '</div>' +
    '</div>';

    root.innerHTML = html;
    wireEvents();
  }

  function panelHtml(t, q, unlocked) {
    let html = '<p class="sp-panel-question">' + escapeHtml(q.text) + '</p>';

    if (!unlocked) {
      html += '<div class="sp-locked">' +
        '<p>The structure, vocabulary, and model answer for this topic are Premium.</p>' +
        '<a href="/premium.html">🔒 Get Premium →</a>' +
      '</div>';
      return html;
    }

    html += section('Structure', structureHtml(t.structure));
    html += section('Vocabulary & Collocations', vocabHtml(t.vocab));
    html += section('Model Answer', '<div class="sp-model-text">' + highlight(q.model, t.vocab) + '</div>');
    html += section(null, '<div class="sp-bandtip">' + escapeHtml(t.bandTip) + '</div>');
    return html;
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
        '<div class="sp-vocab-example">"' + highlight(v.example, [v]) + '"</div>' +
      '</div>'
    ).join('') + '</div>';
  }

  // Wraps every occurrence of a topic's vocab terms in <mark>, so students
  // see exactly where the "important language" lands inside a natural
  // sentence rather than only in a separate glossary list. Matches against
  // already-escaped text/terms so escaping order never breaks matching.
  function highlight(text, vocab) {
    let escaped = escapeHtml(text);
    const terms = vocab.map((v) => escapeHtml(v.term)).sort((a, b) => b.length - a.length);
    terms.forEach((term) => {
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      escaped = escaped.replace(pattern, (m) => '<mark class="sp-hl">' + m + '</mark>');
    });
    return escaped;
  }

  function wireEvents() {
    root.querySelectorAll('[data-branch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.branchId = btn.dataset.branch;
        const qs = currentQuestions();
        state.questionId = qs.length ? qs[0].id : null;
        render();
      });
    });
    root.querySelectorAll('[data-qid]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.questionId = btn.dataset.qid;
        render();
      });
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
})();
