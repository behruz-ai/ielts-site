// Wires up the header's theme toggle button. The actual theme attribute is
// set earlier by an inline script in <head> (before first paint, to avoid a
// flash of the wrong theme) — this just syncs the button icon and handles clicks.
(function () {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const root = document.documentElement;

  function sync() {
    btn.textContent = root.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
  }
  sync();

  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('ielts-theme', next); } catch (e) {}
    sync();
  });
})();
