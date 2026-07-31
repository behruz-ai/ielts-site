// Standard approximate IELTS raw-score-to-band conversion, applied uniformly
// across every test on the site. Only meaningful for full 40-question tests
// (Reading/Listening Volumes) — single-passage Premium attempts don't have
// enough questions for a band score to mean anything, so this returns null
// for anything that isn't out of 40.
window.ieltsBand = function ieltsBand(score, total) {
  if (total !== 40 || typeof score !== 'number') return null;
  const table = [
    [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5],
    [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5],
  ];
  for (const [min, band] of table) {
    if (score >= min) return band;
  }
  return 2;
};
