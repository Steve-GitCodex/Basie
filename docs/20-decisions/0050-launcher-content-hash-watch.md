# 0050 — Launcher watch: reload only on real content changes

**Date:** 2026-10-09. Extends ADR 0033.

## Context

Dev tabs reloaded often even when no code had changed, and some CSS-only edits did a full reload instead of a hot-swap.
`fs.watch` reports a write even when the content is identical (editor auto-save, `git checkout`/stash, agent sessions,
format-on-save, and the launcher smoke itself, which rewrote `dev.css`/`devSlots.js`). It also reports directory entries.
Any non-CSS path in a batch turned it into a full reload. An idle dev tab with nothing writing to disk did not reload, so the
cause was file events, not the bridge.

## Decision

- `scripts/launcher/changeFilter.mjs` keeps a SHA-1 hash per file. An event counts only if the file's bytes differ from the
  last seen hash, or a known file was deleted. Directory events and unknown vanished files (temp saves) are dropped.
- `js/`, `css/` and `index.html` are hashed at startup (about 2.6 MB). `assets/` (about 570 MB) is hashed lazily, so the first
  event for an asset counts once and identical rewrites after that are filtered.
- The terminal change line names the files (`↻ css/a.css, js/b.js +2 more changed → …`) so any reload can be traced to its cause.
- The launcher smoke edits throwaway fixtures (`css/__launcher-smoke.css`, `js/__launcher-smoke.js`, removed afterward) instead
  of touching real source, and checks that identical rewrites cause neither a reload nor a change line.

## Consequences

- A real edit still reloads dev tabs. Agent sessions that edit continuously will still cause reloads, but every one is now named.
- Covered by `tests/unit/launcherChangeFilter.test.js` and `tests/browser/launcher-smoke.mjs`.
