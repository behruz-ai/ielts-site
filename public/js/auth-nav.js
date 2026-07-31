// Updates the header's auth slot based on current Supabase session, and
// shows "My Progress" / "Admin" links once we know the user's role.
// Include this (after supabase-config.js) on every page that has
// <span id="auth-slot">...</span> in its header.
(function () {
  const slot = document.getElementById('auth-slot');
  if (!slot || typeof supabaseClient === 'undefined') return;

  function renderLoggedOut() {
    slot.innerHTML = '<a class="btn-login" href="/login.html">Log in</a>';
  }

  function renderLoggedIn(email, role, isPremium) {
    const short = email.length > 20 ? email.slice(0, 18) + '…' : email;
    const adminLink = role === 'admin' ? '<a class="nav-link-sm" href="/admin.html">Admin</a>' : '';
    const analyticsLink = isPremium ? '<a class="nav-link-sm" href="/analytics.html">✨ Insights</a>' : '';
    slot.innerHTML =
      adminLink +
      analyticsLink +
      '<a class="nav-link-sm" href="/progress.html">My Progress</a>' +
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

  async function refresh(session) {
    if (!session || !session.user) { renderLoggedOut(); return; }
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role, is_premium')
      .eq('id', session.user.id)
      .maybeSingle();
    renderLoggedIn(session.user.email, profile ? profile.role : 'user', !!(profile && profile.is_premium));
  }

  supabaseClient.auth.getSession().then(({ data }) => refresh(data.session));
  supabaseClient.auth.onAuthStateChange((_event, session) => refresh(session));
})();
