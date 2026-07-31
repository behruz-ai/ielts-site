// Updates the header's auth slot based on current Supabase session.
// Include this (after supabase-config.js) on every page that has
// <span id="auth-slot">...</span> in its header.
(function () {
  const slot = document.getElementById('auth-slot');
  if (!slot || typeof supabaseClient === 'undefined') return;

  function renderLoggedOut() {
    slot.innerHTML = '<a class="btn-login" href="/login.html">Log in</a>';
  }

  function renderLoggedIn(email) {
    const short = email.length > 20 ? email.slice(0, 18) + '…' : email;
    slot.innerHTML =
      '<span class="user-chip" title="' + escapeHtml(email) + '">👤 ' + escapeHtml(short) + '</span>' +
      '<button class="btn-logout" id="logout-btn" type="button">Log out</button>';
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.href = '/';
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session && data.session.user) renderLoggedIn(data.session.user.email);
    else renderLoggedOut();
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session && session.user) renderLoggedIn(session.user.email);
    else renderLoggedOut();
  });
})();
