// Reports a completed test's score to Supabase, if the visitor is logged in.
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
    } catch (err) {
      console.warn('Progress reporting failed (test result itself is unaffected):', err);
    }
  }

  const observer = new MutationObserver(scheduleCheck);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
})();
