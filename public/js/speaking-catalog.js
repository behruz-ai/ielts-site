// Renders the Speaking Bank topic list on speaking.html. Each card links
// through to speaking-topic.html?id=... for the actual question-by-question
// view — this page is just the browse/entry point.

(function () {
  const root = document.getElementById('sp-root');
  if (!root) return;

  fetch('/data/speaking.json')
    .then((r) => r.json())
    .then((items) => render(items))
    .catch((err) => {
      root.innerHTML = '<p class="empty-note">Could not load the Speaking Bank. Please refresh.</p>';
      console.error(err);
    });

  function questionCount(t) {
    if (t.branches) return t.branches.reduce((n, b) => n + b.questions.length, 0);
    if (t.questions) return t.questions.length;
    return 1; // Part 2 cue-card topics: one prompt, multiple answer versions
  }

  function metaLabel(t) {
    return t.part === 2 ? ' cue card' : ' questions';
  }

  function render(items) {
    if (!items.length) {
      root.innerHTML = '<p class="empty-note">Nothing here yet — check back soon.</p>';
      return;
    }
    const html = items.map(cardHtml).join('');
    root.innerHTML = '<div class="sp-topic-grid">' + html + '</div>';
  }

  function cardHtml(t) {
    const tierBadge = t.tier === 'free'
      ? '<span class="badge-tier badge-premium">✨ Free</span>'
      : '<span class="badge-tier badge-premium">🔒 Premium</span>';
    const branchNote = t.branches ? '<span class="sp-topic-count">' + t.branches.length + ' branches</span>' : '';
    const versionNote = t.models ? '<span class="sp-topic-count">' + t.models.length + ' sample answers</span>' : '';

    return '<a class="sp-topic-card" href="/speaking-topic.html?id=' + encodeURIComponent(t.id) + '">' +
      '<span class="sp-topic-icon">🎙️</span>' +
      '<h3 class="sp-topic-theme">' + escapeHtml(t.theme) + '</h3>' +
      '<p class="sp-topic-tag">' + escapeHtml(t.tag || ('Part ' + t.part)) + '</p>' +
      '<div class="sp-topic-meta">' +
        tierBadge +
        '<span class="sp-topic-count">' + questionCount(t) + metaLabel(t) + '</span>' +
        branchNote + versionNote +
      '</div>' +
      '<span class="sp-topic-btn">Open topic →</span>' +
    '</a>';
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
})();
