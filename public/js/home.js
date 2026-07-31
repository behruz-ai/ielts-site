(function () {
  fetch('/data/tests.json')
    .then((r) => r.json())
    .then((all) => {
      const published = all.filter((t) => t.status === 'published');
      const readingCount = published.filter((t) => t.section === 'reading').length;
      const listeningCount = published.filter((t) => t.section === 'listening').length;
      const rEl = document.getElementById('reading-count');
      const lEl = document.getElementById('listening-count');
      if (rEl) rEl.textContent = readingCount + ' tests available';
      if (lEl) lEl.textContent = listeningCount + ' tests available';
    })
    .catch(() => {});
})();
