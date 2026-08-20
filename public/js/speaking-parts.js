// Renders the "choose a part" landing screen on speaking.html — three
// cards (Part 1/2/3) with a general description of what that part of the
// real exam involves, plus a live topic count. Clicking a card goes to
// speaking-part.html?part=N for that part's actual topic list.

(function () {
  const root = document.getElementById('sp-part-grid');
  if (!root) return;

  const PARTS = [
    { part: 1, label: 'Introduction & Interview', minutes: '4–5 min', desc: 'The examiner asks short, personal questions about familiar topics — work, study, your hometown, hobbies, and everyday life.' },
    { part: 2, label: 'Long Turn (Cue Card)', minutes: '3–4 min', desc: 'You get a cue card and 1 minute to prepare, then speak for up to 2 minutes without interruption on the topic given.' },
    { part: 3, label: 'Discussion', minutes: '4–5 min', desc: 'A deeper, more abstract discussion that follows on from your Part 2 topic — the examiner pushes you to develop and justify your ideas.' },
  ];

  fetch('/data/speaking.json')
    .then((r) => r.json())
    .then((items) => render(items))
    .catch(() => render(null));

  function render(items) {
    root.innerHTML = PARTS.map((p) => cardHtml(p, items)).join('');
  }

  function cardHtml(p, items) {
    const count = items ? items.filter((t) => t.part === p.part).length : null;
    const hasTopics = count === null || count > 0;
    const countLabel = count === null ? '' : (count > 0 ? count + (count === 1 ? ' topic' : ' topics') : 'Coming soon');
    const href = hasTopics ? '/speaking-part.html?part=' + p.part : '#';

    return '<a class="sp-part-card' + (hasTopics ? '' : ' soon') + '" href="' + href + '">' +
      '<span class="sp-part-num">' + p.part + '</span>' +
      '<h3 class="sp-part-title">Part ' + p.part + ' — ' + p.label + '</h3>' +
      '<p class="sp-part-minutes">' + p.minutes + '</p>' +
      '<p class="sp-part-desc">' + p.desc + '</p>' +
      '<div class="sp-topic-meta">' +
        (countLabel ? '<span class="sp-topic-count">' + countLabel + '</span>' : '') +
      '</div>' +
      '<span class="sp-topic-btn">' + (hasTopics ? 'Browse Part ' + p.part + ' →' : 'Coming soon') + '</span>' +
    '</a>';
  }
})();
