# 0033 — Basie dev launcher replaces `npx http-server -s`

**Date:** 2026-10-01. Spec: `docs/superpowers/specs/2026-10-01-launcher-design.md`.

## Context

`run.bat` ran `npx http-server -s -c-1`. Because of `-s` (silent), nothing was logged, so a
broken sprite path or a failed script load was invisible. Switching between the normal game and a dev
slot (ADR 0032) meant hand-editing URLs. In-game errors only showed up in DevTools, and every source
edit needed a manual refresh.

## Decision

**`run.bat` runs `node scripts/launcher/launch.mjs`, a dependency-free Node dev server built for
Basie.**

- **Serving:** files come from the repo root, bound to `127.0.0.1` only, with `Cache-Control: no-store`.
  Path traversal is rejected (`staticFiles.mjs`). Browser URLs use `localhost`, so existing saves (stored
  per origin) stay visible. On a port clash: if the port is another Basie launcher (`/__basie/ping`), it
  opens the tab there and exits; otherwise it tries the next port, up to 5 tries.
- **Terminal:** a page load collapses into one `page load · N files · X MB · T ms · K missing` line,
  with each missing file listed in red plus a bell. Single 200/304 lines appear only in verbose mode.
  Hotkeys: `[o]` normal, `[d]` dev, `[n]` new dev slot, `[t]` `npm test` summary, `[v]` verbose,
  `[c]` clear, `[q]` quit. Hotkeys are disabled when stdin isn't a TTY.
- **Bridge:** when the launcher serves `index.html`, it adds
  `<script type="module" src="/__basie/bridge.js">` before `</head>`. This is the only way the bridge
  gets in; game source never references it. The bridge forwards `error`/`unhandledrejection`,
  `console.error/warn`, and `window.game.log` error/warn entries (`main.js` now exposes
  `log: logManager`). Entries are batched and deduplicated, then POSTed to `/__basie/log` and printed
  tagged `[normal]` / `[dev:<slot>]`. The game's own `window`/`promise` logManager tags are skipped,
  because `main.js` already copies window errors into logManager and they would print twice.
- **Watch:** `js/`, `css/`, `assets/` and `index.html` are watched. Changes are batched over 150 ms and
  pushed over SSE (`/__basie/events`). A CSS-only batch re-links the matching stylesheets in place.
  Anything else reloads **dev tabs only** (each dev slot saves on unload, ADR 0032). A normal tab
  just shows a "Files changed — refresh when ready" note and never reloads a real game.

## Consequences

- The game still runs under any static server. `tests/browser/harness.mjs` keeps `npx http-server`,
  and the bridge is absent there.
- `/__basie/` is a reserved URL prefix. Every request must carry a `localhost:<port>` / `127.0.0.1:<port>`
  Host, and an Origin (if present) from the same pair, or it gets 403 (`requestGuards.mjs`). That blocks
  cross-site log POSTs and DNS-rebinding reads. Client log text is cleaned of control characters, so a
  page can't inject terminal escapes.
- Python is no longer part of the run story.
- Coverage: `tests/unit/launcherStaticFiles|LogView|Watcher.test.js` and
  `tests/browser/launcher-smoke.mjs`. Hotkeys (raw TTY) are verified by hand only.
