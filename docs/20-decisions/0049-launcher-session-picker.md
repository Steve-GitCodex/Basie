# 0049 — Launcher: server only, with a terminal session picker

**Date:** 2026-10-08. Extends ADR 0033.

## Context

`run.bat` always opened a normal-mode tab. Opening any other session meant `[d]` (default dev slot only), `[n]` (typing a slot
name from memory), or editing the URL. Dev slots live in the browser's localStorage (ADR 0032), so the launcher had no idea which
slots existed.

## Decision

- `run.bat` with no arguments starts the server and opens nothing. `run.bat normal` and `run.bat dev [slot]` still open a tab directly.
- The terminal prints a numbered **session list**: `[1] normal`, then every known dev slot in sorted order. `[l]` reprints the list
  and asks for a number to launch. The `[o]` and `[d]` hotkeys are removed. `[n]` still creates or opens a slot by name.
- The page bridge reports `listDevSlots(localStorage)` to `POST /__basie/slots` on load and whenever the list changes (2 s poll).
  The launcher sanitizes the list (`sessions.mjs`: strings only, slot-name sanitized, de-duplicated, at most 100), reprints it when
  it changes, and saves it to the gitignored `.basie-launcher-slots.json` (`--slots-file` overrides the path, which tests use).

## Consequences

- The list is only as fresh as the last page load. A slot made in another browser, or on another port's origin, appears after a
  tab on this launcher's origin loads once.
- `/__basie/slots` is covered by the same Host/Origin trust check as `/__basie/log`, and slot names can't carry terminal escapes.
- Covered by `tests/unit/launcherSessions.test.js` and `tests/browser/launcher-smoke.mjs` (startup lists sessions, a dev slot is
  reported and persisted).
