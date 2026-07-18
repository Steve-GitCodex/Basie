# 0016 — Concurrent build workers over a shared FIFO queue

**Date:** 2026-07-18.

## Context

The build queue ran **one build at a time**: `_buildQueue[0]` was the sole active
item, and the extra slots unlocked by the Construction Hall (and premium/VIP purchases)
only added *waiting* depth. Wall-clock development speed never improved with those
unlocks — they only reduced attention cost — so the throttle on base progression was
very expensive. The unlock most players want in this genre ("a second builder") did
nothing to the clock.

## Decision

Every unlocked slot becomes a **concurrent worker** drawing from **one shared FIFO
queue** (`_getMaxBuildSlots()` workers), plus a flat **waiting buffer of 2** so builds
can still be lined up ahead. Queue **capacity = workers + 2**. No build-time
compensation — the speed-up is intentional.

Model, implemented in the pure `js/systems/building/buildQueue.js` helpers:

- **Active = item with `endsAt` stamped.** Up to `workers` items are active at once.
  `_buildQueue` stays a single array in enqueue order; there is no "index 0 is active"
  invariant anymore and no prefix invariant (a freed worker skips ahead).
- **Universal workers:** when a worker frees, it starts the first *startable* waiting
  item in queue order.
- **Same-instance serial rule:** two items targeting the same `instanceId` are never
  active simultaneously, so queued upgrades of one building (Lv3→4→5) run in order.
- **Core operation `buildQueue.fill(queue, workers, atMs)`** stamps timers until workers
  are full or nothing is startable; every mutating path (enqueue, cancel, catchup,
  deserialize) calls it and then emits `building:queueUpdated` **once**.
- **Unified `BuildingManager._catchup(nowMs)`** replaces the three duplicated head-drain
  loops (live tick, offline, deserialize): complete each due item in `endsAt` order,
  refill freed workers retroactively at the completion time, then fill idle workers at
  `nowMs`, emitting a single `queueUpdated` for the batch.

## Consequences

- **Faster progression** past the first Construction Hall — 2–4× builder throughput once
  slots are unlocked. Deliberate; revisit costs/build times only if pacing feels too loose.
- **Save-compatible.** Old saves stamped timers only on the head item; `deserialize()`
  runs `_catchup(now)`, which drains anything already finished and stamps timers on up to
  N items respecting the same-instance rule — a legacy single-active save fans out to
  parallel workers on first load. Serialize shape is unchanged.
- **One save per catchup, not one per completion.** `main.js` saves on every
  `building:queueUpdated`; batching the emit removes the offline-burst save spam the old
  per-item loop caused.
- **Speed-ups target a specific active build.** `reduceActiveTimer(seconds, instanceId)`
  defaults to the earliest-ending active when no id is passed (back-compat); the sidebar
  and building-card pickers thread the item's `instanceId` through so each concurrent
  build can be sped up independently.
- Drive-by fix: `applyOffline` referenced an undefined `elapsedSec` (param was
  `_elapsedSec`) — a live `ReferenceError` that skipped the offline cafeteria drain;
  fixed with a regression test.
- New tests: `tests/unit/buildQueue.test.js` (pure helpers) and
  `tests/unit/buildingManager.test.js` (concurrency, same-instance serialization,
  skip-ahead, capacity, cancel/refill, offline batch, legacy migration, slot-drop grace).
