# IELTS CDI Practice — website

A static catalog site: no build step, no server, no database. Every "test" is a
complete, self-contained HTML file that already has its own timer and scoring.

## How to add a new test

1. Finish and verify the test HTML file as usual.
2. Copy that one file into the matching folder under `tests/`:
   - Full volume Reading test → `tests/reading/volume-<N>/test-<M>.html`
   - Full volume Listening test → `tests/listening/volume-<N>/test-<M>.html`
   - Single-passage Lite practice → `tests/lite/<slug>.html`
3. Open `data/tests.json` and add one entry (copy an existing one of the same
   type and edit the fields). Example for a full-volume Reading test:

   ```json
   { "id": "reading-vol3-t1", "section": "reading", "tier": "full-volume",
     "volume": 3, "testNumber": 1, "displayTitle": "Reading Test 1",
     "status": "published", "questionCount": 40, "durationMinutes": 60,
     "file": "reading/volume-3/test-1.html" }
   ```

   Example for a single-passage Lite test:

   ```json
   { "id": "lite-my-new-passage", "section": "reading", "tier": "lite-passage",
     "passageType": "Passage 2", "displayTitle": "My New Passage",
     "status": "published", "questionCount": 13, "durationMinutes": 18,
     "file": "lite/my-new-passage.html" }
   ```

4. Save, commit, push. That's it — no build command, nothing to install.

Set `"status": "coming-soon"` (and `"file": null`) to list a volume before its
files are ready — it shows up in the catalog with a disabled Start button.

## Local preview

No Node.js needed. Any static file server works, e.g. from this folder:

```
py -m http.server 8080
```

then open http://localhost:8080

## Deployment

This is a 100%-static folder — point Cloudflare Pages (or Netlify/GitHub
Pages) at this repo with **no build command** and output directory `/`.
