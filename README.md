# IELTS CDI Practice — website

A static catalog site: no build step, no server, no database. Every "test" is a
complete, self-contained HTML file that already has its own timer and scoring.

## How to add a new test

1. Finish and verify the test HTML file as usual.
2. Copy that one file into the matching folder under `public/tests/`:
   - Full volume Reading test → `public/tests/reading/volume-<N>/test-<M>.html`
   - Full volume Listening test → `public/tests/listening/volume-<N>/test-<M>.html`
   - Single-passage Premium practice → `public/tests/premium/<slug>.html`
3. Open `public/data/tests.json` and add one entry (copy an existing one of the
   same type and edit the fields). Example for a full-volume Reading test:

   ```json
   { "id": "reading-vol3-t1", "section": "reading", "tier": "full-volume",
     "volume": 3, "testNumber": 1, "displayTitle": "Reading Test 1",
     "status": "published", "questionCount": 40, "durationMinutes": 60,
     "file": "reading/volume-3/test-1.html" }
   ```

   Example for a single-passage Premium test — `access: "premium"` locks it
   behind a signed-in user's `is_premium` flag (see Premium gating below),
   `access: "free"` leaves it open to everyone as a sample:

   ```json
   { "id": "premium-my-new-passage", "section": "reading", "tier": "premium-passage",
     "access": "premium", "passageType": "Passage 2", "displayTitle": "My New Passage",
     "status": "published", "questionCount": 13, "durationMinutes": 18,
     "file": "premium/my-new-passage.html" }
   ```

4. If the new entry has `"access": "premium"`, gate the file itself: add these
   three lines right after `<head>` in the test's HTML —

   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
   <script src="/js/supabase-config.js"></script>
   <script src="/js/premium-gate.js"></script>
   ```

   — and make sure the existing bottom-of-body scripts only include
   `<script src="/js/report-progress.js"></script>` (not a second copy of the
   CDN/config scripts — those already loaded via `<head>`).

5. Save, commit, push. That's it — no build command, nothing to install.

Only ever add content that's actually yours (carries your `@bekhruzposts`
branding/Telegram link) — never files sourced from other creators.

Set `"status": "coming-soon"` (and `"file": null`) to list a volume before its
files are ready — it shows up in the catalog with a disabled Start button.

## Premium gating

Premium passages are unlocked per-user via `profiles.is_premium` in Supabase —
there's no payment gateway wired up, access is granted manually (message
@bekhruzposts on Telegram, then flip the "Grant Premium" button for that user
on `/admin.html`). `public/js/premium-gate.js` is a **client-side only** soft
gate: it hides a locked test's content until `is_premium` is confirmed, but
the HTML is still downloaded by the browser and viewable via "view source" by
a determined visitor. True server-side enforcement would require moving off
pure static hosting.

## Local preview

No Node.js needed. Any static file server works, e.g. from the `public/` folder:

```
cd public
py -m http.server 8080
```

then open http://localhost:8080

## Deployment

Deployed via Cloudflare Workers Static Assets (`wrangler.toml` in the repo
root points at `public/` as the assets directory, no Worker script needed).
`npx wrangler deploy` (or Cloudflare's own Git-connected deploy) serves
everything in `public/` directly — `.git`, `README.md` and `wrangler.toml`
itself are never exposed since they live outside that folder.
