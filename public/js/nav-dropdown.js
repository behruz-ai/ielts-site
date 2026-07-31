// Nav dropdowns open on hover (desktop) via CSS alone. This adds a click
// fallback for touch devices, where :hover doesn't fire, and closes an
// open dropdown when the user taps elsewhere.
(function () {
  const items = document.querySelectorAll('.nav-item.has-dropdown');
  if (!items.length) return;

  items.forEach((item) => {
    const trigger = item.querySelector('.nav-trigger');
    if (!trigger) return;
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const wasOpen = item.classList.contains('open');
      items.forEach((i) => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-item.has-dropdown')) {
      items.forEach((i) => i.classList.remove('open'));
    }
  });
})();
