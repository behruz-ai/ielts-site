(function () {
  fetch('/data/tests.json')
    .then((r) => r.json())
    .then((all) => {
      const published = all.filter((t) => t.status === 'published');
      const readingCount = published.filter((t) => t.section === 'reading').length;
      const listeningCount = published.filter((t) => t.section === 'listening').length;
      const readingVolumes = published.filter((t) => t.section === 'reading' && t.tier === 'full-volume').length;
      const listeningVolumes = published.filter((t) => t.section === 'listening' && t.tier === 'full-volume').length;
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      // Module cards link to the Volumes pages, so their subtitle counts match that content specifically.
      set('reading-count', readingVolumes + ' full tests available');
      set('listening-count', listeningVolumes + ' full tests available');
      set('stat-reading', readingCount);
      set('stat-listening', listeningCount);
    })
    .catch(() => {});
})();
