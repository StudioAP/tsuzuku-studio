# tsuzuku — Codex / coding-agent instructions

## Goal
An iPhone-first, local-only, low-friction carousel editor. User chooses photos,
accepts an automatic aspect-ratio-based layout, optionally makes small corrections,
exports ordered images, then posts manually in the Instagram app.

## Non-negotiable user decisions
- No app login, photo upload, backend, API keys, analytics, remote AI, or automatic synchronization.
- No Instagram API or automatic publishing. Do not open an Instagram login flow.
- Photos stay within this browser until the user explicitly saves/shares a file.
- Do not send photos, names, drafts, or thumbnails to any server or developer tool.
- Favor simple controls over a general-purpose canvas editor.
- Do not replace this working implementation with a framework scaffold.

## Start here
Read README.md, docs/REQUIREMENTS.md, docs/ARCHITECTURE.md, and docs/TESTING.md.
Use docs/CODEX_HANDOFF.md for the next-task checklist. Communicate in Japanese.

## Commands
Node >=22.12.0. No npm dependencies are needed for normal operation.
- `npm run dev` — localhost:5173, source files, no service-worker caching by default.
- `npm run check` — syntax checks.
- `npm test` — pure-model, layout, image-magic, and ZIP tests.
- `npm run build` — deterministic static dist/ with content-versioned service worker.
- `npm run preview` — serve dist/.
Optional browser tests use Python Playwright; see docs/TESTING.md. Never count a
Chromium mobile viewport or a mocked navigator.share as a native iPhone test.

## Architecture invariants
`model.js` / `layout.js` remain pure. Layout is one virtual strip in 1080px-page
coordinates; a photo's transform is computed ONCE across its entire span.
`renderer.js` draws one output page at a time. Never allocate a 20-page full-resolution
canvas in production, and never independently crop the left and right halves.
Only two decoded working images are kept in the renderer pool. Serial import/export.
Use the same scene for preview and export. UI numbers/guides must not be exported.
All output files within a project share one ratio and use 01, 02… filenames.
Normalize input photos locally; the original Photos library files must not be edited.

## Safety and maintenance
Prepare Files before showing the final share button. Invoke navigator.share immediately
from its click handler, before any await. Treat AbortError as cancellation, not failure.
A fulfilled share promise is NOT confirmation of saving to Photos.
Maintain per-file open/download and ZIP fallbacks.
Validate backup structure, image references, sizes, transforms, and ZIP paths/CRC before use.
Escape every user-provided string inserted into HTML. Keep CSP and relative asset paths.
Keep originals, .tsuzuku archives, exports, .env, tokens, and personal photos out of Git.
Browser drafts are best-effort, one active project, one editing tab; warn rather than promise persistence.
Only app files are service-worker cached. No CDN imports, web fonts, tracking, or remote assets.
Do not alter platform limits based on the Instagram publishing API: this app uses manual app posting.

## Definition of done
Run check, tests, and build. Run browser smoke tests after renderer/export changes.
Verify iPhone Safari + Photos save + Instagram sequence on an actual device before
calling it production-validated. Record failures and untested items explicitly.
Make small reviewed commits. Obtain the user's approval before pushing or deploying;
never claim a GitHub/Pages action ran unless it actually did.
