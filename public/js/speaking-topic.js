// Renders a single Speaking Bank topic on speaking-topic.html?id=... — a
// question list on the left, and a detail panel on the right (below on
// mobile) showing that question's model answer plus the topic's shared
// structure/vocabulary. Only one question's answer is shown at a time.
// Highlighted vocab inside the model answer is clickable — it opens a
// popover with the term's meaning, the same click-to-reveal pattern the
// Premium Reading passages already use for their glossary.

(function () {
  const root = document.getElementById('sp-topic-root');
  if (!root) return;

  const HOWTO = '💡 <strong>How to use this:</strong> Treat this as a model to adapt, not a script to memorize — examiners can tell when an answer sounds rehearsed. Swap in your own details and practice saying it in your own words rather than reciting it.';
  const TYPE_LABELS = { collocation: 'Collocations', 'phrasal-verb': 'Phrasal Verbs', idiom: 'Idioms' };
  const TYPE_ORDER = ['collocation', 'phrasal-verb', 'idiom'];

  const id = new URLSearchParams(location.search).get('id');
  const state = { topic: null, isPremiumUser: false, branchId: null, questionId: null, versionIndex: null };

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
      } else if (state.topic.questions) {
        state.questionId = state.topic.questions[0].id;
      } else if (state.topic.models) {
        state.versionIndex = 0; // Part 2 cue-card topics: no questions, just answer versions
      }
      setupPopover();
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
    if (t.models && !t.branches && !t.questions) { renderPart2(); return; }

    const unlocked = t.tier === 'free' || state.isPremiumUser;
    const questions = currentQuestions();
    const activeQ = questions.find((q) => q.id === state.questionId) || questions[0];

    let html = detailHeaderHtml(t);
    html += '<div class="sp-howto">' + HOWTO + '</div>';

    if (t.topStructures && unlocked) html += topStructuresHtml(t.topStructures);

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

  function detailHeaderHtml(t) {
    return '<div class="sp-detail-hdr">' +
      '<a class="sp-back-link" href="/speaking.html">← Speaking Bank</a>' +
      '<h1>' + escapeHtml(t.theme) + '</h1>' +
      '<p class="sp-detail-tag">' + escapeHtml(t.tag || ('Part ' + t.part)) + '</p>' +
    '</div>';
  }

  // Part 2 cue-card topics have a different shape from Part 1: one prompt
  // with cue-card bullet points, shared vocab/structure for the whole
  // topic, and multiple full-length answer *versions* rather than a list
  // of separate questions to click through.
  function renderPart2() {
    const t = state.topic;
    const unlocked = t.tier === 'free' || state.isPremiumUser;

    let html = detailHeaderHtml(t);
    html += '<div class="sp-howto">' + HOWTO + '</div>';

    let panel = '<p class="sp-panel-question">Describe ' + escapeHtml(t.theme.charAt(0).toLowerCase() + t.theme.slice(1)) + '.</p>';
    if (t.cueCardPoints) {
      panel += '<ul class="sp-cue-points">' + t.cueCardPoints.map((c) => '<li>' + escapeHtml(c) + '</li>').join('') + '</ul>';
    }

    if (!unlocked) {
      panel += '<div class="sp-locked">' +
        '<p>The tips, structure, vocabulary, and model answers for this topic are Premium.</p>' +
        '<a href="/premium.html">🔒 Get Premium →</a>' +
      '</div>';
      root.innerHTML = html + '<div class="sp-panel">' + panel + '</div>';
      wireEvents();
      return;
    }

    if (t.howToBuildTips) {
      panel += '<div class="sp-section"><p class="sp-section-label">How to Build This Answer</p>' +
        '<ol class="sp-tips-list">' + t.howToBuildTips.map((tip) => '<li>' + escapeHtml(tip) + '</li>').join('') + '</ol>' +
      '</div>';
    }

    const activeModel = t.models[state.versionIndex] || t.models[0];
    const highlightSource = (t.vocabGroups || []).flatMap((g) => g.items);
    if (t.models.length > 1) {
      panel += '<div class="sp-version-tabs">' + t.models.map((m, i) =>
        '<button class="filter-chip' + (i === state.versionIndex ? ' active' : '') + '" data-version="' + i + '">' + escapeHtml(m.version) + '</button>'
      ).join('') + '</div>';
    }
    const paragraphs = highlight(activeModel.text, highlightSource).split('\n\n');
    const modelHtml = paragraphs.map((p, i) =>
      '<p>' + (i === 0 ? '<span class="sp-model-quote">&ldquo;</span>' : '') + p + '</p>'
    ).join('');
    panel += '<div class="sp-section"><p class="sp-model-label">🎤 Sample Answer</p>' +
      '<div class="sp-model-box">' + modelHtml + '</div></div>';

    if (t.usefulStructure) panel += collapseSection('Useful Structure', topStructureListHtml(t.usefulStructure));
    if (t.vocabGroups) panel += collapseSection('Most Useful Language', vocabGroupsHtml(t.vocabGroups));

    root.innerHTML = html + '<div class="sp-panel">' + panel + '</div>';
    wireEvents();
  }

  function topStructureListHtml(items) {
    return '<div class="sp-structure-group">' + items.map((it) =>
      '<p class="sp-structure-phrase">"' + escapeHtml(it.pattern) + '"<br><span style="opacity:.7">e.g. ' + escapeHtml(it.example) + '</span></p>'
    ).join('') + '</div>';
  }

  function vocabGroupsHtml(groups) {
    return groups.map((g) =>
      '<div class="sp-vocab-group">' +
        '<p class="sp-vocab-group-label">' + escapeHtml(g.label) + '</p>' +
        languageListHtml(g.items) +
      '</div>'
    ).join('');
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

    // Two content formats coexist: hand-written per-question sets carry
    // usefulLanguage/usefulStructure on the question itself; older topics
    // still use one shared vocab/structure bank for the whole topic.
    const perQuestion = !!q.usefulLanguage;
    const highlightSource = perQuestion ? q.usefulLanguage : t.vocab;

    html += '<div class="sp-section"><p class="sp-model-label">🎤 Sample Answer</p>' +
      '<div class="sp-model-box"><span class="sp-model-quote">&ldquo;</span>' + highlight(q.model, highlightSource) + '</div></div>';

    if (perQuestion) {
      html += collapseSection('Useful Structure', structureListHtml(q.usefulStructure));
      html += collapseSection('Most Useful Language', languageListHtml(q.usefulLanguage));
    } else {
      html += collapseSection('Useful Structures & Sentence Starters', structureHtml(t.structure));
      html += collapseSection('Vocabulary, Collocations & Phrasal Verbs', vocabByTypeHtml(t.vocab));
    }
    if (t.bandTip) html += section(null, '<div class="sp-bandtip">' + escapeHtml(t.bandTip) + '</div>');
    return html;
  }

  function section(label, html) {
    return '<div class="sp-section">' + (label ? '<p class="sp-section-label">' + escapeHtml(label) + '</p>' : '') + html + '</div>';
  }

  function collapseSection(label, bodyHtml) {
    return '<details class="sp-collapse">' +
      '<summary class="sp-collapse-summary"><span class="sp-section-label">' + escapeHtml(label) + '</span><span class="sp-collapse-arrow">▾</span></summary>' +
      '<div class="sp-collapse-body">' + bodyHtml + '</div>' +
    '</details>';
  }

  function structureHtml(groups) {
    return '<div class="sp-structure-groups">' + groups.map((g) =>
      '<div class="sp-structure-group">' +
        '<p class="sp-structure-group-label">' + escapeHtml(g.label) + '</p>' +
        g.phrases.map((p) => '<p class="sp-structure-phrase">"' + escapeHtml(p) + '"</p>').join('') +
      '</div>'
    ).join('') + '</div>';
  }

  function topStructuresHtml(top) {
    return '<div class="sp-top-structures">' +
      '<p class="sp-top-structures-title">⭐ Most Useful Structures for This Topic</p>' +
      (top.note ? '<p class="sp-top-structures-note">' + escapeHtml(top.note) + '</p>' : '') +
      '<ol class="sp-top-structures-list">' + top.items.map((it) =>
        '<li><span class="sp-top-structure-pattern">' + escapeHtml(it.pattern) + '</span>' +
        '<span class="sp-top-structure-example">' + escapeHtml(it.example) + '</span></li>'
      ).join('') + '</ol>' +
      (top.closingNote ? '<p class="sp-top-structures-note">' + escapeHtml(top.closingNote) + '</p>' : '') +
    '</div>';
  }

  function structureListHtml(phrases) {
    return '<div class="sp-structure-group">' +
      phrases.map((p) => '<p class="sp-structure-phrase">"' + escapeHtml(p) + '"</p>').join('') +
    '</div>';
  }

  function languageListHtml(items) {
    return '<div class="sp-vocab-list">' + items.map((it) => {
      const plain = typeof it === 'string';
      const term = plain ? it : it.term;
      const cls = plain ? ' sp-vocab-item-plain' : '';
      const dataAttrs = plain ? '' : (
        ' data-term="' + escapeHtml(it.term) + '" data-def="' + escapeHtml(it.meaning) + '"' +
        (it.example ? ' data-example="' + escapeHtml(it.example) + '"' : '')
      );
      return '<div class="sp-vocab-item' + cls + '"' + dataAttrs + '><div class="sp-vocab-term">' + escapeHtml(term) + '</div></div>';
    }).join('') + '</div>';
  }

  function vocabByTypeHtml(vocab) {
    let html = '';
    TYPE_ORDER.forEach((type) => {
      const items = vocab.filter((v) => v.type === type);
      if (!items.length) return;
      html += '<div class="sp-vocab-group">' +
        '<p class="sp-vocab-group-label">' + escapeHtml(TYPE_LABELS[type]) + '</p>' +
        '<div class="sp-vocab-list">' + items.map((v) =>
          '<div class="sp-vocab-item" data-term="' + escapeHtml(v.term) + '" data-type="' + escapeHtml(TYPE_LABELS[type]) + '" data-def="' + escapeHtml(v.meaning) + '" data-example="' + escapeHtml(v.example) + '">' +
            '<div class="sp-vocab-term">' + escapeHtml(v.term) + '</div>' +
            '<div class="sp-vocab-meaning">' + escapeHtml(v.meaning) + '</div>' +
            '<div class="sp-vocab-example">"' + highlight(v.example, [v]) + '"</div>' +
          '</div>'
        ).join('') + '</div>' +
      '</div>';
    });
    return html;
  }

  // Wraps every occurrence of a topic's vocab terms in <mark>, so students
  // see exactly where the "important language" lands inside a natural
  // sentence rather than only in a separate list. Accepts either full vocab
  // objects ({term, type, meaning} — old shared-bank topics) or plain
  // strings (hand-written per-question "useful language" lists, which have
  // no separate definition, so those marks highlight but aren't clickable).
  // Matches against already-escaped text/terms so escaping order never
  // breaks it. Template fragments like "rather than + -ing" simply won't
  // match anything literal in the answer and are silently skipped.
  function highlight(text, items) {
    let escaped = escapeHtml(text);
    const norm = (items || []).map((it) => (typeof it === 'string' ? { term: it } : it));
    const terms = norm.slice().sort((a, b) => b.term.length - a.term.length);
    terms.forEach((v) => {
      const term = escapeHtml(v.term);
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const typeAttr = v.type ? ' data-type="' + escapeHtml(TYPE_LABELS[v.type] || '') + '"' : '';
      const defAttr = v.meaning ? ' data-def="' + escapeHtml(v.meaning) + '"' : '';
      const exampleAttr = v.example ? ' data-example="' + escapeHtml(v.example) + '"' : '';
      escaped = escaped.replace(pattern, (m) =>
        '<mark class="sp-hl" data-term="' + escapeHtml(v.term) + '"' + typeAttr + defAttr + exampleAttr + '>' + m + '</mark>'
      );
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
    root.querySelectorAll('[data-version]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.versionIndex = Number(btn.dataset.version);
        render();
      });
    });
  }

  // Event delegation on the root: mark/vocab-card elements get replaced
  // wholesale on every render(), so the click listener is attached once
  // here rather than per-element.
  function setupPopover() {
    const pop = document.createElement('div');
    pop.id = 'sp-pop';
    document.body.appendChild(pop);

    root.addEventListener('click', (e) => {
      const target = e.target.closest('mark.sp-hl, .sp-vocab-item');
      if (!target || !target.dataset.def) { pop.classList.remove('show'); return; }
      e.stopPropagation();
      pop.innerHTML =
        (target.dataset.type ? '<span class="pop-type">' + escapeHtml(target.dataset.type) + '</span>' : '') +
        '<div class="pop-term">' + escapeHtml(target.dataset.term) + '</div>' +
        '<div class="pop-def">' + escapeHtml(target.dataset.def) + '</div>' +
        (target.dataset.example ? '<div class="pop-example">"' + escapeHtml(target.dataset.example) + '"</div>' : '');
      const rect = target.getBoundingClientRect();
      pop.classList.add('show');
      const popRect = pop.getBoundingClientRect();
      let left = rect.left;
      if (left + popRect.width > window.innerWidth - 12) left = window.innerWidth - popRect.width - 12;
      if (left < 12) left = 12;
      let top = rect.bottom + 8;
      if (top + popRect.height > window.innerHeight - 12) top = rect.top - popRect.height - 8;
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
    });

    document.addEventListener('click', () => pop.classList.remove('show'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') pop.classList.remove('show'); });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
})();
