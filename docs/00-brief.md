# Basie — Brief

A browser-based base-building strategy game (Last Shelter: Survival / lords-mobile genre),
single-player today, built with **zero frameworks**: vanilla ES6 modules served statically
(`run.bat` → `python -m http.server 8000`). No build step, no automated tests — verification
is the browser plus a Playwright harness.

**Architecture in one line:** a three-tier event-driven design — Core (`GameEngine` fixed-tick
loop, `EventBus` singleton, `SaveManager` localStorage), Systems (21 `*Manager.js` domain
owners), UI (17 read-only `*UI.js` presenters). All cross-system mutation flows through the
EventBus; managers never touch each other's state.

**Where the game is:** city view (isometric canvas, hand-designed blueprint, plot placements)
and world map (top-down canvas, POIs/regions, timed marches, capture + buffs) are both shipped.
The current push is the **grit reskin** — closing the *feel* gap with Last Shelter (grit art
direction, tile-grid world, juice) before starting AI opponents (Phase 4).

**Long-term shape:** AI factions that grow with the player and contest regions (Phase 4), map
events (5), notification center + crafting (6), then a real backend enabling the **Arena**
(PvP/co-op boss fights) which eventually replaces the legacy menu campaign.

Read `docs/40-active.md` for the current session handoff and `docs/30-roadmap.md` for status.
