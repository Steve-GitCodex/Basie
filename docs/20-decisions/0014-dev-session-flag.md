# 0014 — `?dev` session flag: ephemeral, real-API-driven boot preset

**Date:** 2026-07-18.

## Context

Eyeballing anything gated behind progression (the world map above all) meant a full
cold start every time: click through auth, skip the tutorial, then hand-build HQ to
Lv.3 and a Rally Point to unlock the World tab. That is a minutes-long tax on a
one-second visual check, and it was blocking the B2 grid-map judgement call the reskin
plan explicitly hangs on a human look (`docs/40-active.md`, "eyeball B2").

Three ways to remove the tax were on the table:

1. **A hand-crafted save** loaded on boot. Fast, but couples to the serialize format —
   it silently rots the moment a manager's `serialize()` shape changes (exactly the
   ADR 0002 gotcha), and it would need seed/reconcile parity of its own.
2. **State pokes** — reach into manager internals and set building levels directly.
   Bypasses `_recalculateAllCaps`/placement/event emission, so the resulting state is
   subtly unlike a real game.
3. **Drive the real public APIs** to the target state and let the existing systems do
   their own bookkeeping.

## Decision

**A `?dev` query flag runs a one-shot preset that drives real manager methods, and the
session is never persisted.** `js/core/devSession.js` owns it; `main.js` gates on
`isDevSession()`.

- **Boot path:** with `?dev`, `initAuthScreen` launches straight as a guest (no auth
  screen), `launchGame` forces `savedState = null` (a real save is never *loaded*), and
  the new-game modal, story, tutorial, daily-login and offline timers are all skipped.
- **Preset:** sandbox mode → `completeTutorial()` → drive `buildingManager.build()` to
  raise HQ to Lv.3 and build a Rally Point (+ Barracks and Infantry Hall), then train a
  batch of infantry and form a squad, then `ui:navigateTo` `world`. Sandbox build/train
  queues are drained synchronously by calling the managers' own `update(dt)` in a loop —
  no internal poking. Resources are floored via the public `setCap`/`add` before each
  build so nothing hits an affordability wall.
- **Ephemeral:** with `?dev`, `main.js` skips `startAutosave`, the `beforeunload` save,
  and the queue/purchase save hooks. A dev session therefore cannot read or overwrite
  `basie_game_state` — the player's real save is untouched no matter what happens in it.

## Consequences

- **No format drift.** Because the preset only calls public APIs, it exercises the same
  build/train/squad chain a player would and can never diverge from the serialize format
  the way a crafted save would. The dev boot doubles as a smoke of that whole chain.
- **Closes the march-test gap.** B1 left march dispatch unverifiable end-to-end because a
  fresh guest save has no squads (`docs/40-active.md`). `?dev` now boots with troops in
  reserve and a formed squad, so a real march is drivable.
- **Covered by `tests/browser/dev-smoke.mjs`** — asserts the preset lands in sandbox at
  HQ Lv.3 with the Rally Point built and a squad, on the world map, and that a pre-seeded
  real save survives untouched.
- **The military step is best-effort.** It is wrapped so that if the training/squad model
  changes underneath it, the flag still boots to an unlocked world map (the primary goal).
- The flag is a dev affordance only — it does no harm shipped (a player would have to
  append `?dev` by hand), but it is not an authenticated gate and grants sandbox freely,
  which is fine for a single-player offline game.
