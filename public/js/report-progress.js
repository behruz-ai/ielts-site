// Reports a completed test's score to Supabase, if the visitor is logged in.
// Works by wrapping the page's existing doCheck() and reading the final
// score from the "X of Y correct" text every test's #cnt element shows —
// this is more robust across different test-file generations than relying
// on specific JS variable names (which vary: lastScore/lastTotal in newer
// single-passage files, lastScore + per-passage counters in older full
// volume tests). Needs no changes to each test's own scoring logic.
(function () {
  if (typeof doCheck !== 'function' || typeof supabaseClient === 'undefined') return;

  const originalDoCheck = doCheck;
  doCheck = function () {
    const result = originalDoCheck.apply(this, arguments);
    setTimeout(reportProgress, 400);
    return result;
  };

  function readScoreFromDom() {
    const cnt = document.getElementById('cnt');
    if (!cnt) return null;
    const m = cnt.textContent.match(/(\d+)\s+of\s+(\d+)\s+correct/i);
    if (!m) return null;
    return { score: parseInt(m[1], 10), total: parseInt(m[2], 10) };
  }

  async function reportProgress() {
    try {
      const { data } = await supabaseClient.auth.getSession();
      if (!data.session) return; // not logged in — nothing to report

      const parsed = readScoreFromDom();
      if (!parsed) return;

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
})();
