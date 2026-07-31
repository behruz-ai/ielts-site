// Reports a completed test's score to Supabase, if the visitor is logged in,
// then shows a small feedback toast (free: general praise/tip based on this
// score; Premium: also names the visitor's weakest question type overall,
// with a practice link).
//
// The test library spans several template generations with different
// scoring UIs (old doCheck()/#cnt text, an animated "results-score-fraction"
// counter, a "Score: X/Y" modal) and no single JS hook works across all of
// them. Instead of wrapping a specific function name, this watches the DOM
// for whichever scoring output appears and reports the first one it finds —
// works regardless of which template generation a given file uses.
(function () {
  if (typeof supabaseClient === 'undefined') return;

  let reported = false;
  let debounceTimer = null;

  function extractFromDataTarget() {
    const el = document.querySelector('.results-score-fraction [data-target]');
    if (!el) return null;
    const score = parseInt(el.getAttribute('data-target'), 10);
    const container = el.closest('div') || el.parentElement;
    const contextText = container ? container.textContent : '';
    const totalMatch = contextText.match(/(\d+)\s*correct/i);
    if (!isNaN(score) && totalMatch) return { score, total: parseInt(totalMatch[1], 10) };
    return null;
  }

  function extractFromText(text) {
    let m = text.match(/(\d+)\s+of\s+(\d+)\s+correct/i);
    if (m) return { score: parseInt(m[1], 10), total: parseInt(m[2], 10) };
    m = text.match(/(\d+)\s*\/\s*(\d+)\s+correct/i);
    if (m) return { score: parseInt(m[1], 10), total: parseInt(m[2], 10) };
    m = text.match(/score:\s*(\d+)\s*\/\s*(\d+)/i);
    if (m) return { score: parseInt(m[1], 10), total: parseInt(m[2], 10) };
    return null;
  }

  function checkNow() {
    if (reported) return;
    let parsed = extractFromDataTarget();
    if (!parsed) {
      const cnt = document.getElementById('cnt');
      if (cnt) parsed = extractFromText(cnt.textContent || '');
    }
    if (!parsed) parsed = extractFromText(document.body.innerText || '');
    if (parsed) {
      reported = true;
      observer.disconnect();
      reportProgress(parsed);
    }
  }

  function scheduleCheck() {
    if (reported) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(checkNow, 300);
  }

  async function reportProgress(parsed) {
    try {
      const { data } = await supabaseClient.auth.getSession();
      if (!data.session) return; // not logged in — nothing to report

      const section = location.pathname.includes('/listening/') ? 'listening' : 'reading';
      await supabaseClient.from('test_attempts').insert({
        user_id: data.session.user.id,
        test_path: location.pathname,
        test_title: document.title,
        section: section,
        score: parsed.score,
        total: parsed.total,
      });
      showFeedbackToast(parsed, data.session.user.id);
    } catch (err) {
      console.warn('Progress reporting failed (test result itself is unaffected):', err);
    }
  }

  // Non-ASCII characters below use \u escapes rather than literal glyphs —
  // this file is loaded via <script src>, and in one test environment its
  // script-encoding detection proved unreliable (garbled the em dash/emoji)
  // even though fetch()-based text decoding of the exact same file was
  // correct UTF-8. Escapes are pure ASCII in the source itself, so they
  // sidestep the ambiguity regardless of what serves this file or how a
  // given browser guesses its encoding.
  var EM_DASH = String.fromCharCode(0x2014);
  var ARROW = String.fromCharCode(0x2192);
  var EMOJI_PARTY = '\u{1F389}';
  var EMOJI_THUMB = '\u{1F44D}';
  var EMOJI_BULB = '\u{1F4A1}';

  function praiseMessage(pct) {
    if (pct >= 85) return { emoji: EMOJI_PARTY, text: 'Excellent work ' + EM_DASH + ' ' + pct + '%! That\'s a strong score.' };
    if (pct >= 65) return { emoji: EMOJI_THUMB, text: 'Solid effort ' + EM_DASH + ' ' + pct + '%. A bit more practice and you\'ll close the gap to your target band.' };
    return { emoji: EMOJI_BULB, text: pct + '% this time. Review what you missed and try a similar test again ' + EM_DASH + ' that repetition is what moves the score.' };
  }

  async function showFeedbackToast(parsed, userId) {
    const pct = parsed.total ? Math.round((parsed.score / parsed.total) * 100) : 0;
    const base = praiseMessage(pct);
    let extraHtml = '';

    try {
      const { data: profile } = await supabaseClient.from('profiles').select('is_premium').eq('id', userId).maybeSingle();
      if (profile && profile.is_premium) {
        const weak = await findWeakestType(userId);
        if (weak) {
          extraHtml = '<p style="margin:8px 0 0;font-size:13px">Your weakest area overall is <strong>' + escapeHtml(weak.qt) +
            '</strong> (' + weak.pct + '% avg) ' + EM_DASH + ' <a href="/reading.html?qtype=' + encodeURIComponent(weak.qt) +
            '" style="color:#7fb3ff;font-weight:700">practice more ' + ARROW + '</a></p>';
        }
      }
    } catch (err) {
      // Premium lookup is a nice-to-have on top of the toast — never block the base message on it.
    }

    renderToast(base.emoji, base.text, extraHtml);
  }

  async function findWeakestType(userId) {
    const [{ data: attempts }, manifest] = await Promise.all([
      supabaseClient.from('test_attempts').select('test_path, score, total').eq('user_id', userId),
      fetch('/data/tests.json').then((r) => r.json()),
    ]);
    if (!attempts || !attempts.length) return null;

    const fileToTest = {};
    manifest.forEach((t) => { if (t.file) fileToTest['/tests/' + t.file] = t; });

    const byType = {};
    attempts.forEach((a) => {
      if (!a.total) return;
      const p = a.score / a.total;
      const test = fileToTest[a.test_path];
      if (test && test.questionTypes) {
        test.questionTypes.forEach((qt) => {
          if (!byType[qt]) byType[qt] = { sum: 0, count: 0 };
          byType[qt].sum += p; byType[qt].count++;
        });
      }
    });

    const rows = Object.keys(byType).map((qt) => ({
      qt, pct: Math.round((byType[qt].sum / byType[qt].count) * 100), count: byType[qt].count,
    }));
    if (!rows.length) return null;
    rows.sort((a, b) => a.pct - b.pct);
    return rows[0];
  }

  function renderToast(emoji, text, extraHtml) {
    const existing = document.getElementById('feedback-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'feedback-toast';
    toast.className = 'feedback-toast';
    toast.innerHTML =
      '<button class="feedback-toast-close" type="button" aria-label="Dismiss">&times;</button>' +
      '<div style="font-size:22px;margin-bottom:6px">' + emoji + '</div>' +
      '<p style="margin:0;font-size:13.5px;line-height:1.5">' + escapeHtml(text) + '</p>' +
      extraHtml;
    document.body.appendChild(toast);
    toast.querySelector('.feedback-toast-close').addEventListener('click', () => toast.remove());
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  const observer = new MutationObserver(scheduleCheck);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
})();
