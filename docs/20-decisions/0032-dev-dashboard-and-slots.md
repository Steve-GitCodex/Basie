# 0032 — Dev dashboard + persistent named dev slots (amends 0014)

**Date:** 2026-10-01.

## Context

ADR 0014 made `?dev` ephemeral: the preset re-ran on every boot and nothing was saved,
so a refresh threw away whatever had been set up in the session. The four dev tools
(level switcher, popup muter, anchor nudger, sprite source) were each a separate
`position: fixed` widget on `<body>` with no way to hide them, so they cluttered every
screen during a dev session.

## Decision

**Dev sessions persist to named slots, and every dev tool lives in one dashboard you can
hide.**

- **Slots:** `?dev=<slot>` (bare `?dev` → `default`). The name is normalised by
  `sanitizeSlotName` (`js/core/devSlots.js`). Each slot is stored under
  `basie_dev_save:<slot>`. In dev, `main.js` builds the `SaveManager` with that key
  (`SaveManager` now takes an optional key, default `basie_game_state`). Dev sessions
  then use the same autosave, beforeunload save and save-on-queue/purchase hooks as
  normal play.
- **Boot:** if the slot has a save, it loads. Otherwise `runDevSession` runs the preset
  once and the result is saved straight away. Auth, the tutorial, the new-game modal,
  story, daily login and the offline modal are still skipped in dev.
- **Dashboard:** `js/ui/dev/DevDashboard.js` adds a 🛠 toggle button (bottom left) and a
  panel. The **Session** section has a slot switcher, "+ New slot…", Save now, Reset slot
  and a last-saved status line. The **Tools** section is where the four widgets mount:
  each widget's `init()` now takes a mount element instead of appending to `<body>`.
  Backtick toggles the panel (ignored while typing in a field). Whether the panel is open
  is per-browser state in `basie_dev_dashboard_open`.
- **Reset slot:** calls `suppressSaves()`, deletes the slot key and reloads, so the
  preset re-runs. Without `suppressSaves()` the beforeunload handler would save the slot
  again.

## Consequences

- **What 0014 still guarantees:** in dev the real save (`basie_game_state`) is never
  read or written. A dev slot key always has the `basie_dev_save:` prefix, so it can't
  collide with it. Covered by `tests/unit/devSlots.test.js`, `tests/unit/saveManager.test.js`
  and `tests/browser/dev-dashboard-smoke.mjs`.
- **What 0014 no longer guarantees:** a dev session is no longer a fresh preset on every
  boot. After serializer changes, an old slot can hold stale state. Reset slot (or a new
  slot) gets back to a clean preset. A slot also goes through the normal load path, so
  ADR 0002 seed/reconcile covers it like any other save.
- Settings → wipe in a dev session wipes the current slot, not the real save.
- Slots pile up in localStorage. There is no delete-other-slot UI yet; add one if it
  becomes a nuisance.
