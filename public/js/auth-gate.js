// Requires a signed-in session to view this test page (any account — no
// premium needed). Must load in <head>, after supabase-config.js, before
// the page's own content is parsed/visible. Redirects to /login.html with
// a ?next= so login.html can send the student straight back here.
// NOTE: client-side only, same caveat as premium-gate.js — this stops
// casual browsing without an account, but the HTML is still downloaded.
(function () {
  document.documentElement.style.visibility = 'hidden';

  function withBody(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  function redirectToLogin() {
    withBody(() => {
      const next = encodeURIComponent(location.pathname);
      location.replace('/login.html?next=' + next);
    });
  }

  async function check() {
    try {
      if (typeof supabaseClient === 'undefined') { redirectToLogin(); return; }
      const { data } = await supabaseClient.auth.getSession();
      if (!data.session) { redirectToLogin(); return; }
      document.documentElement.style.visibility = '';
    } catch (err) {
      console.error('auth-gate check failed:', err);
      redirectToLogin();
    }
  }

  check();
})();
