// Soft-gates a premium-only passage: hides the page until we've confirmed
// the signed-in user has is_premium = true. Must load (in <head>, after
// supabase-config.js) before the page's own content is parsed/visible.
// NOTE: this is a client-side gate only — it stops casual browsing/link
// sharing, but the underlying HTML is still downloaded by the browser and
// viewable via "view source" by anyone determined enough. True server-side
// enforcement would need the site to move off pure static hosting.
(function () {
  document.documentElement.style.visibility = 'hidden';

  // This script runs in <head>, but the async auth check can resolve
  // before the browser has parsed <body> into existence — wait for it.
  function withBody(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  function reveal() {
    document.documentElement.style.visibility = '';
  }

  function lock() {
    withBody(() => {
      document.documentElement.style.visibility = '';
      document.body.innerHTML =
        '<div style="max-width:480px;margin:15vh auto;text-align:center;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;padding:0 24px;color:#f3f4f6">' +
        '<h1 style="font-size:22px;margin-bottom:12px">🔒 Premium passage</h1>' +
        '<p style="color:#9aa1b1;margin-bottom:24px">This passage — with full glossary, explanations, and mistake analytics — is available to Premium members only.</p>' +
        '<a href="/premium.html" style="display:inline-block;padding:11px 26px;border-radius:10px;background:linear-gradient(135deg,#ef4444,#f97316,#fbbf24);color:#180a04;font-weight:800;text-decoration:none;margin-right:10px">Get Premium</a>' +
        '<a href="/reading.html" style="display:inline-block;padding:11px 26px;border-radius:10px;border:1px solid rgba(255,255,255,.16);color:#e5e7eb;text-decoration:none">Back to Reading</a>' +
        '</div>';
      document.body.style.background = '#0a0a0f';
    });
  }

  async function check() {
    try {
      if (typeof supabaseClient === 'undefined') { lock(); return; }
      const { data: sessionData } = await supabaseClient.auth.getSession();
      if (!sessionData.session) { lock(); return; }
      const { data: profile } = await supabaseClient
        .from('profiles').select('is_premium').eq('id', sessionData.session.user.id).maybeSingle();
      if (profile && profile.is_premium) reveal();
      else lock();
    } catch (err) {
      console.error('premium-gate check failed:', err);
      lock();
    }
  }

  check();
})();
