(function () {
  fetch('/data/tests.json')
    .then((r) => r.json())
    .then((all) => {
      const published = all.filter((t) => t.status === 'published');
      const readingCount = published.filter((t) => t.section === 'reading').length;
      const listeningCount = published.filter((t) => t.section === 'listening').length;
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('reading-count', readingCount + ' tests available');
      set('listening-count', listeningCount + ' tests available');
      set('stat-reading', readingCount);
      set('stat-listening', listeningCount);
    })
    .catch(() => {});
})();
