// Homepage "try a question, no account needed" widget. Self-contained sample
// questions (not pulled from the real test bank) so a first-time visitor can
// get a feel for the site before hitting any login wall.
(function () {
  const root = document.getElementById('trial-widget');
  if (!root) return;

  const QUESTIONS = [
    {
      kicker: 'Reading · Vocabulary in context',
      q: 'Passage: "Coral cover on the reef has diminished by half since 1990." Which word is closest in meaning to "diminished"?',
      options: ['Increased', 'Decreased', 'Changed color', 'Been measured'],
      correct: 1,
      explain: '"Diminished" means reduced or lessened — the reef has less coral cover now than in 1990.',
    },
    {
      kicker: 'Reading · True / False / Not Given',
      q: 'Passage: "While the bridge was completed in 1937, engineers had first proposed the design nearly a decade earlier, in 1928." Does the passage agree that the design was proposed before the bridge was built?',
      options: ['True', 'False', 'Not Given'],
      correct: 0,
      explain: '1928 (proposed) comes before 1937 (completed), so the statement agrees with the passage — True.',
    },
    {
      kicker: 'Listening · Part 1',
      q: 'A speaker says: "The class starts at half past six, not seven as advertised." What time does the class actually start?',
      options: ['6:00', '6:30', '7:00', '7:30'],
      correct: 1,
      explain: 'This is a classic Listening distractor — the advertised time (7:00) gets corrected mid-sentence to the real time, "half past six."',
    },
    {
      kicker: 'Reading · Sentence completion',
      q: 'Which word best completes this sentence? "The committee reached a ______ decision after months of negotiation."',
      options: ['unanimous', 'hesitant', 'temporary', 'accidental'],
      correct: 0,
      explain: '"Unanimous" (everyone agreeing) fits a decision reached after negotiation — the other options don’t make logical sense here.',
    },
  ];

  let lastIndex = -1;
  function pickIndex() {
    if (QUESTIONS.length === 1) return 0;
    let i;
    do { i = Math.floor(Math.random() * QUESTIONS.length); } while (i === lastIndex);
    lastIndex = i;
    return i;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function render() {
    const item = QUESTIONS[pickIndex()];
    const keys = ['A', 'B', 'C', 'D'];

    root.innerHTML =
      '<div class="trial-card">' +
        '<p class="trial-kicker">' + escapeHtml(item.kicker) + '</p>' +
        '<p class="trial-q">' + escapeHtml(item.q) + '</p>' +
        '<div class="trial-options">' +
          item.options.map((opt, i) =>
            '<button class="trial-option" type="button" data-idx="' + i + '">' +
              '<span class="trial-key">' + keys[i] + '</span><span>' + escapeHtml(opt) + '</span>' +
            '</button>'
          ).join('') +
        '</div>' +
        '<div id="trial-feedback-slot"></div>' +
      '</div>';

    root.querySelectorAll('.trial-option').forEach((btn) => {
      btn.addEventListener('click', () => onAnswer(btn, item), { once: true });
    });
  }

  function onAnswer(chosenBtn, item) {
    const allBtns = root.querySelectorAll('.trial-option');
    const chosenIdx = parseInt(chosenBtn.dataset.idx, 10);
    const wasCorrect = chosenIdx === item.correct;

    allBtns.forEach((btn) => {
      btn.disabled = true;
      const idx = parseInt(btn.dataset.idx, 10);
      if (idx === item.correct) btn.classList.add('correct');
      else if (idx === chosenIdx) btn.classList.add('wrong');
    });

    const slot = document.getElementById('trial-feedback-slot');
    slot.innerHTML =
      '<div class="trial-feedback">' +
        '<p>' + (wasCorrect ? '✅ Correct. ' : '❌ Not quite. ') + escapeHtml(item.explain) + '</p>' +
        '<a class="trial-cta" href="/login.html?tab=signup">Unlock 218 full tests →</a>' +
      '</div>' +
      '<button class="trial-next" type="button" id="trial-next-btn">Try another question →</button>';

    document.getElementById('trial-next-btn').addEventListener('click', render);
  }

  render();
})();
